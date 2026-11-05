import { sleep, waitIframeLoad, saveFile, getCommonPrefix, scrollToLoad, fetchBlobWithXHR, arrayBufferToBase64 } from './utils.js';
import { extractEpisodeData } from './extractor.js';
import { ParserFactory } from './parsers/ParserFactory.js';
import { detectSite } from './detector.js';
import { EpubBuilder } from './epub.js';
import { CbzBuilder } from './cbz.js';
import { TxtBuilder } from './txt.js';
import { Notifier, showProgressModal } from './ui/index.js';
import { logger } from './logger.js';
import { getConfig, isConfigValid, SLEEP_MULTIPLIERS } from './config.js';
import { EventBus, EVT } from './EventBus.js';
import { startSilentAudio, stopSilentAudio } from './anti_sleep.js';
import { fetchHistory, refreshCacheAfterUpload, getBooksByCacheId, initUpdateUploadViaGASRelay, getMergeIndexFragment } from './gas.js';
import { fetchHistoryDirect, checkSingleHistoryDirect, getOAuthToken, getOrCreateFolder } from './network.js';
import { fetchNovelText, fetchComicImages, closeActiveWorker, initBatchWorkerController } from './worker-controller.js';
import { addEpisodesToQueue, initQueueScheduler, runSchedulerOnce, activeWorkers, WORKER_STAGE, updateQueueItem, getQueue, getQueueItemId, removeQueueItem, removeCompletedAndFailedItems, TAB_ID, getMaxWorkers, getOrphanItems, reclaimOrphanItems, isTabAlive } from './queue.js';
import { createMergeSession, resumeMergeSession, getMergeSessions } from './merge-session.js';

async function shouldSkipEpisode({
    numStr,
    destination,
    isSingleVolume,
    uploadedHistorySet,
    historyCheckTimeoutFlag,
    historyFolderId,
    logOnSkip = false,
    episodeTitle = ''
}) {
    if (isSingleVolume) return false;
    if (destination !== 'drive' && destination !== 'drive_kavita') return false;

    const numPlain = parseInt(numStr).toString();
    if (uploadedHistorySet.size > 0 && (uploadedHistorySet.has(numStr) || uploadedHistorySet.has(numPlain))) {
        if (logOnSkip) {
            logger.log(`⏭️ 건너뜀 (이미 업로드됨): ${episodeTitle}`);
        }
        return true;
    }
    
    if (historyCheckTimeoutFlag && historyFolderId) {
        if (logOnSkip) {
            logger.log(`🔍 [페일세이프] 타임아웃 2차 단일 로컬/원격 검사 중: ${episodeTitle}`);
        }
        const isUploaded = await checkSingleHistoryDirect(historyFolderId, numStr);
        if (isUploaded) {
            if (logOnSkip) {
                logger.log(`⏭️ [페일세이프 재검사] 건너뜀 (이미 업로드됨): ${episodeTitle}`);
            }
            return true;
        }
    }
    
    return false;
}

/**
 * 단건(현재 페이지) 회차 추출: main.js의 현재 회차 다운로드에서 사용합니다.
 */
export async function processItem(item, builder, siteInfo, iframe, parser, seriesTitle = "", targetDoc = null, rootFolder = "", destination = "local") {
    const { category } = siteInfo;
    const isNovel = (category === 'Novel' || category === 'novel');
    const viewerCfg = parser.rule.viewer || {};

    const config = getConfig();
    const multiplier = SLEEP_MULTIPLIERS[config.sleepMode] || SLEEP_MULTIPLIERS.cautious;

    const id = getQueueItemId(seriesTitle, item.num ? item.num.toString() : '');
    
    // [H1] Queue Write Monopoly: 상태 변경은 EventBus를 통해 queue.js로 위임
    // [H2] activeWorkers 등록으로 스케줄러 중복 기동 방지 가드 활성화
    EventBus.emit(EVT.QUEUE_ITEM_UPDATE, { id, updates: { status: 'processing', stage: WORKER_STAGE.INIT } });
    activeWorkers.set(id, { type: 'single-volume' });

    const finalRootFolder = rootFolder || seriesTitle || 'UnknownSeries';

    const currentNovelMode = config.novelMode;
    const isSingleVolume = isNovel && currentNovelMode === 'singleVolume';
    const buildingPolicy = config.buildingPolicy || 'individual';

    try {
        if (isNovel) {
            logger.log(`[소설] 추출 중: ${item.title}`, 'Downloader');

            const result = await fetchNovelText(item.src, {
                decryptApi: viewerCfg.decryptApi || null,
                viewerCfg: viewerCfg,
                seriesTitle: seriesTitle,
                rootFolder: finalRootFolder,
                queueId: id,
                episodeTitle: item.title,
                episodeNum: item.num,
                folderId: item.folderId || config.folderId || '',
                destination: destination,
                novelFormat: config.novelFormat || 'epub',
                matchedRule: parser.rule,
                protocolDomain: parser.protocolDomain,
                scanSpeedMultiplier: config.scanSpeed / 750,
                localNameTemplate: config.localNameTemplate,
                localEpisodePadding: config.localEpisodePadding
            });

            if (typeof result === 'string') {
                builder.addChapter(item.title, result.trim());
                logger.log(`✅ [부모 컨트롤러] 소설 추출 성공 (조립 적재 완료): ${item.title}`, 'Downloader');
                
                // [H1] 단일 합본용 큐 아이템 상태 갱신 — EventBus 경유
                EventBus.emit(EVT.QUEUE_ITEM_UPDATE, { id, updates: { status: 'completed', progressPercent: 100, stage: WORKER_STAGE.COMPLETED } });
                EventBus.emit(EVT.UPDATE_PROGRESS);
                
                await sleep(1500 * multiplier, 1000 * multiplier);
                return false; // 부모 측에서 일괄 빌드 및 최종 저장을 하도록 false 반환
            } else {
                throw new Error(`추출 실패 (소설 본문 응답 없음)`);
            }
        } 
        else {
            logger.log(`[만화] 추출 중: ${item.title}`, 'Downloader');

            const images = await fetchComicImages(item.src, {
                viewerCfg: viewerCfg,
                seriesTitle: seriesTitle,
                rootFolder: finalRootFolder,
                queueId: id,
                episodeTitle: item.title,
                episodeNum: item.num,
                folderId: item.folderId || config.folderId || '',
                destination: destination,
                matchedRule: parser.rule,
                protocolDomain: parser.protocolDomain,
                scanSpeedMultiplier: config.scanSpeed / 750,
                localNameTemplate: config.localNameTemplate,
                localEpisodePadding: config.localEpisodePadding
            });

            if (Array.isArray(images)) {
                // resolvedImages: [{ url, data: ArrayBuffer, ext, isMissing }, ...]
                const resolvedImages = images.map(img => {
                    const mimeType = img.ext?.includes('png') ? 'image/png' : (img.ext?.includes('webp') ? 'image/webp' : 'image/jpeg');
                    return {
                        url: img.url,
                        blob: img.data ? new Blob([img.data], { type: mimeType }) : new Blob([]),
                        ext: img.ext || '.jpg',
                        isMissing: !!img.isMissing
                    };
                });

                builder.addChapter(item.title, resolvedImages);
                logger.log(`✅ [부모 컨트롤러] 만화 이미지 추출 성공 (조립 적재 완료): ${item.title}`, 'Downloader');
                
                // [H1] 단일 합본용 큐 아이템 상태 갱신 — EventBus 경유
                EventBus.emit(EVT.QUEUE_ITEM_UPDATE, { id, updates: { status: 'completed', progressPercent: 100, stage: WORKER_STAGE.COMPLETED } });
                EventBus.emit(EVT.UPDATE_PROGRESS);

                await sleep(1500 * multiplier, 1000 * multiplier);
                return false; // 부모 측에서 일괄 저장하므로 false 반환
            } else {
                throw new Error(`추출 실패 (만화 팝업 수집 실패)`);
            }
        }
    } finally {
        // [H2] activeWorkers 정리 — 단일/배치 무관하게 항상 실행
        activeWorkers.delete(id);
        
        // 단일 합본 및 배치 모드가 아닐 때만 즉시 큐 청소 (UI 지속 노출 보장)
        if (!isSingleVolume && buildingPolicy !== 'zipOfCbzs') {
            removeQueueItem(id);
        }
    }
}


/**
 * "1,2,4-10,15" 형식 문자열을 에피소드 번호 Set으로 변환
 * @param {string} spec - 범위 문자열. 빈 값이면 null 반환 (전체 의미)
 * @returns {Set<number>|null}
 */
export function parseRangeSpec(spec) {
    if (!spec || !spec.trim()) return null; // 빈 입력 = 전체
    const nums = new Set();
    const parts = spec.split(',');
    for (const part of parts) {
        const trimmed = part.trim();
        const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
            const from = parseInt(rangeMatch[1]);
            const to   = parseInt(rangeMatch[2]);
            for (let n = Math.min(from, to); n <= Math.max(from, to); n++) nums.add(n);
        } else if (/^\d+$/.test(trimmed)) {
            nums.add(parseInt(trimmed));
        }
    }
    return nums.size > 0 ? nums : null;
}

export async function tokiDownload(rangeSpec, policy = 'zipOfCbzs', forceOverwrite = false) {
    const config = getConfig();
    let isAsyncDelegate = false;
    
    // --- 🚨 대기열 스마트 자동 정리 및 동시 작업(Multi-Series Queue) 지원 ---
    // [v1.27.0] 소유 탭이 사라진 고아 항목과 합본 세션 소속 항목은 자동 정리 대상에서 제외합니다.
    //           (고아 항목은 대시보드의 "중단된 작업" 패널에서 이어받기/비우기로 처리)
    const currentQueue = getQueue();
    if (currentQueue.length > 0) {
        const orphanIds = new Set(getOrphanItems().map(i => i.id));
        const hasPendingOrProcessing = currentQueue.some(item => (item.status === 'pending' || item.status === 'processing') && !orphanIds.has(item.id));
        if (!hasPendingOrProcessing) {
            // 진행 중인 작업이 없으면 이전 완료/실패 기록을 정리 (고아 항목·합본 세션 항목은 보존)
            console.log('[TokiSync] 활성 작업이 없으므로 이전 대기열 완료/실패 내역을 정리합니다.');
            removeCompletedAndFailedItems({ keepMergeItems: true });
        } else {
            // 다른 탭/작품이 수집 중인 경우: 완료·실패된 잔여 항목만 정리하고 새 작품을 대기열에 병합 추가 (동시 작업 허용)
            removeCompletedAndFailedItems({ keepMergeItems: true });
            console.log('[TokiSync] ➕ 진행 중인 작업 감지 -> 기존 작업을 중단하지 않고 대기열에 새 작업을 추가합니다.');
        }
    }
    // ------------------------------------------------

    logger.init();
    logger.show();
    logger.info(`다운로드 시작 (정책: ${policy}, 강제 덮어쓰기: ${forceOverwrite})...`);

    // Auto-start Anti-Sleep mode (실제 재생 성공 여부를 확인한 뒤 로그 출력)
    startSilentAudio().then(ok => {
        if (ok) logger.success('[Anti-Sleep] 백그라운드 유지 모드 활성화');
        else logger.warn('[Anti-Sleep] 브라우저가 자동재생을 막아 백그라운드 유지 모드가 꺼져 있습니다. 페이지를 한 번 클릭하면 자동으로 다시 시도합니다.', 'Anti-Sleep');
    });
    const siteInfo = await detectSite();
    if (!siteInfo) {
        EventBus.emit(EVT.NOTIFY_ERROR, { msg: "지원하지 않는 사이트이거나 다운로드 페이지가 아닙니다." });
        return;
    }

    const parser = await ParserFactory.getParser();
    if (!parser) {
        EventBus.emit(EVT.NOTIFY_ERROR, { msg: "파서를 초기화할 수 없습니다." });
        return;
    }

    const { category, matchedRule } = siteInfo;
    const siteName = matchedRule?.name || "TokiSync Parser";
    logger.info(`적용 중인 파서 규칙: [${siteName}] (${matchedRule?.id || 'unknown'})`);
    const isNovel = (category === 'Novel' || category === 'novel');

    try {
        // Prepare Strategy Variables
        let destination = 'local'; // 기본 저장 대상
        let buildingPolicy = 'individual'; // 기본 빌딩 정책
        
        // [v1.6.0] 4대 정책 라우팅
        if (policy === 'individual') {
            buildingPolicy = 'individual';
            destination = 'local';
        } else if (policy === 'zipOfCbzs') {
            buildingPolicy = 'zipOfCbzs';
            destination = 'local';
        } else if (policy === 'native') {
            buildingPolicy = 'individual'; // 빌딩은 개별 CBZ 단위로 동일
            destination = 'native';        // 저장 대상만 GM_download로 변경
        } else if (policy === 'drive' || policy === 'drive_kavita') {
            buildingPolicy = 'individual'; // 빌딩은 개별 CBZ 단위
            destination = policy;          // 저장 대상은 Google Drive (kavita 여부 유지)
        // 하위 호환: 구버전 정책 명칭 지원
        } else if (policy === 'gasUpload') {
            buildingPolicy = 'individual';
            destination = 'drive';
            logger.log('⚠️ gasUpload 정책은 drive로 대체되었습니다.', 'warn');
        } else if (policy === 'folderInCbz') {
            buildingPolicy = 'zipOfCbzs';
            destination = 'local';
            logger.log('⚠️ folderInCbz 정책이 폐기되어 zipOfCbzs(배치)로 전환되었습니다.', 'warn');
        }

        // [v1.8.2] Graceful Fallback for missing Drive configuration
        if ((destination === 'drive' || destination === 'drive_kavita') && !isConfigValid()) {
            EventBus.emit(EVT.NOTIFY_ERROR, { msg: '구글 드라이브 설정(Folder ID 등)이 누락되었습니다. 임시로 개별 로컬 다운로드 정책으로 전환합니다.' });
            logger.warn('⚠️ 구글 드라이브 설정 누락 감지. 정책을 개별 로컬 다운로드로 자동 전환합니다.', 'System');
            buildingPolicy = 'individual';
            destination = 'local';
        }

        const configNovelFormat = getConfig().novelFormat || 'epub';
        const EXTENSION_MAP = {
            'Novel': configNovelFormat,
            'novel': configNovelFormat,
            'Webtoon': 'cbz',
            'webtoon': 'cbz',
            'Manga': 'cbz',
            'manga': 'cbz'
        };

        // Get List
        // [v1.27.0] 대시보드에서 "전체 회차 불러오기"로 최근(10분 이내) 스캔한 목록이 있으면 재사용하여
        //           다운로드마다 전체 페이지를 다시 요청하지 않습니다.
        const hasFreshScan = typeof parser.hasFreshAllPageCache === 'function' && parser.hasFreshAllPageCache(10 * 60 * 1000);
        logger.info(hasFreshScan ? '📄 최근 불러온 전체 회차 목록을 재사용합니다.' : '📄 전체 페이지 회차 목록을 스캔 중입니다...', 'Downloader');
        let list = await parser.getListItems({ allPages: true, forceRefresh: !hasFreshScan });

        // [v1.26.7] 회차 번호가 모두 0이거나 누락된 경우 역순(최신순->1화순) 인덱스 기반 고유 번호 부여
        const rawMapped = list.map((li, idx) => {
            const rawEl = li.element || li;
            const item = parser.parseListItem(rawEl);
            const parsedNum = parseInt(item.num, 10);
            return { li: rawEl, item, parsedNum: isNaN(parsedNum) ? 0 : parsedNum, idx };
        });
        const nonZeroCount = rawMapped.filter(x => x.parsedNum > 0).length;
        if (nonZeroCount === 0 && rawMapped.length > 0) {
            rawMapped.forEach((x, idx) => {
                const fallbackNum = rawMapped.length - idx;
                x.parsedNum = fallbackNum;
                if (x.li && typeof x.li === 'object') x.li._tokiEffectiveNum = String(fallbackNum);
            });
        }

        // [v1.9.1] 정렬 로직 통합: 범위 필터 여부와 상관없이 항상 오름차순(1화~N화)으로 정렬
        const rangeSet = parseRangeSpec(rangeSpec);
        if (rangeSet) {
            list = rawMapped.filter(x => rangeSet.has(x.parsedNum))
                            .sort((a, b) => (a.parsedNum - b.parsedNum) || (b.idx - a.idx))
                            .map(x => x.li);
            logger.log(`범위 필터 적용 및 오름차순 정렬 완료: ${rangeSpec} → ${list.length}개 항목`);
        } else {
            list = rawMapped.sort((a, b) => (a.parsedNum - b.parsedNum) || (b.idx - a.idx))
                            .map(x => x.li);
            logger.log(`전체 항목 오름차순 정렬 완료: ${list.length}개 항목`);
        }

        // 정렬 후 동일 번호(예: 분할 회차 225화 1~4부 또는 0번 공지/외전) 충돌 방지를 위해 고유 _tokiEffectiveNum 보장
        const usedNums = new Map();
        list.forEach((li, idx) => {
            if (!li || typeof li !== 'object') return;
            const parsed = parser.parseListItem(li);
            let baseNum = (parsed.num && parsed.num !== '0') ? String(parsed.num) : String(idx + 1);
            if (!usedNums.has(baseNum)) {
                usedNums.set(baseNum, 1);
                li._tokiEffectiveNum = baseNum;
            } else {
                const count = usedNums.get(baseNum) + 1;
                usedNums.set(baseNum, count);
                li._tokiEffectiveNum = `${baseNum}_${count}`;
            }
        });
        
        // Log episode range
        if (list.length > 0) {
            const first = parser.parseListItem(list[list.length - 1]); // usually reversed order
            const last = parser.parseListItem(list[0]);
            logger.info(`총 ${list.length}개 항목 처리 예정. (${first.title} ~ ${last.title})`, 'Downloader');
        } else {
            logger.log(`총 0개 항목 처리 예정.`, 'Downloader');
        }

        if (list.length === 0) {
            logger.warn('에피소드 목록이 0개입니다. 사이트 구조가 달라졌거나 올바른 목록 페이지인지 확인하세요.', 'Downloader');
            alert("다운로드할 항목이 없습니다.");
            return;
        }

        // Folder Name (Title) & Common Title Extraction
        const first = parser.parseListItem(list[0]);
        const last = parser.parseListItem(list[list.length - 1]);
        
        // [v1.9.4] Extract Series ID via Parser rules with robust fallback
        const seriesId = parser.getSeriesId();

        // Determine Root Folder Name & Series Title
        const explicitSeriesTitle = (parser.getSeriesTitle() || '').trim();
        const rootFolder = parser.getFormattedTitle(seriesId, first.title, last.title, getCommonPrefix);
        const seriesTitle = (explicitSeriesTitle || rootFolder.replace(/^\[[a-zA-Z0-9_\-]+\]\s*/, ''))
            .replace(/^Unknown\s*Series$/i, '')
            .trim() || 'UnknownSeries';
        const listPrefixTitle = (list.length > 1) ? getCommonPrefix(first.title, last.title) : "";

        // [v1.24.0] 수집 시점의 각 챕터별 원본 상세 제목 매핑 객체 구축
        const episodeTitles = {};
        list.forEach(item => {
            try {
                const ep = parser.parseListItem(item);
                if (ep && ep.num) {
                    const numKey = parseInt(ep.num).toString();
                    episodeTitles[numKey] = ep.title || "";
                }
            } catch (e) {
                logger.warn(`[Downloader] Episode title parse failed: ${e.message}`, 'Downloader');
            }
        });

        // [v1.7.0] Collect detailed metadata for Phase 3 Persistence
        const seriesMetadata = {
            ...parser.getSeriesMetadata(),
            id: seriesId,
            sourceId: seriesId,
            vendorId: parser.rule?.id || parser.getSeriesMetadata().vendorId || (matchedRule?.name || "").toLowerCase().replace(/[^a-z0-9]/g, ''),
            title: seriesTitle || rootFolder,
            originalSeriesTitle: parser.getSeriesTitle() || "",
            episodeTitles: episodeTitles, // [추가] 클라이언트 획득 에피소드 제목 목록
            thumbnail: parser.getThumbnailUrl() || "",
            vendor: parser.getSeriesMetadata().vendor || (matchedRule?.name || "").toLowerCase().replace(/[^a-z0-9]/g, '')
        };

        // [Fix] Append Range [Start-End] for Local Merged Files (folderInCbz / zipOfCbzs)
        // GAS Upload uses individual files so no range needed in folder name
        // [v1.6.0 Update] Batch range is handled during saving, not in rootFolder variable

        // [v1.4.0] Upload Series Thumbnail (if uploading to Drive)
        let historyFolderId = null;
        if (destination === 'drive' || destination === 'drive_kavita') {
            try {
                const thumbnailUrl = parser.getThumbnailUrl();
                if (thumbnailUrl) {
                    logger.log('📷 시리즈 썸네일 업로드 중...');
                    const thumbBlob = await fetchBlobWithXHR(thumbnailUrl, document.URL);
                    
                    // Upload as 'cover.jpg' - network.js will auto-redirect to _Thumbnails/{ID}.jpg
                    // saveFile(data, filename, type, extension, metadata)
                    // → fullFileName = "cover.jpg"
                    const cleanSeries = seriesTitle.replace(/^\[[^\]]+\]\s*/, '');
                    const targetFolder = destination === 'drive_kavita' ? cleanSeries : rootFolder;
                    await saveFile(thumbBlob, 'cover', 'drive', 'jpg', { 
                        category,
                        folderName: targetFolder,
                        destination: destination,
                        folderId: historyFolderId || undefined
                    });
                    logger.success('✅ 썸네일 업로드 완료');
                } else {
                    logger.log('⚠️  썸네일을 찾을 수 없습니다 (건너뜀)', 'warn');
                }
            } catch (thumbError) {
                logger.warn(`썸네일 업로드 실패 (계속 진행): ${thumbError.message}`, 'Downloader');
            }
        }

        // [v1.5.0 Smart Skip] Pre-load history for Drive uploads to skip already-uploaded episodes
        let uploadedHistorySet = new Set();
        // [v1.6.0 Fast Path] Pre-load episode cache
        let episodeCacheMap = new Map(); // key: "0001 - Title", value: "fileId"

        let historyCheckTimeoutFlag = false;

        if (destination === 'drive' || destination === 'drive_kavita') {
            try {
                if (forceOverwrite) {
                    logger.log('⚠️ 강제 재다운로드 옵션 활성화: 기존 업로드 기록 무시 (전체 덮어쓰기)');
                } else {
                    logger.log('☁️ 드라이브 업로드 기록 및 용량 확인 중 (Smart Skip)...');
                    const cleanFolder = rootFolder.replace(/^\[[^\]]+\]\s*/, '');
                    const targetFolder = destination === 'drive_kavita' ? cleanFolder : rootFolder;
                    const histResult = await fetchHistoryDirect(targetFolder, category);
                    
                    if (histResult.success) {
                        historyFolderId = histResult.folderId;
                        // Normalize: accept padded ("0001") and plain ("1") forms
                        histResult.data.forEach(id => {
                            const plain = parseInt(id).toString();
                            uploadedHistorySet.add(id.toString());   // e.g. "0001"
                            uploadedHistorySet.add(plain);           // e.g. "1"
                        });
                        if (uploadedHistorySet.size > 0) {
                            logger.log(`⏭️ 조건 만족(기존 정상 업로드) 에피소드 ${histResult.data.length}개 감지 — 건너뜁니다.`);
                        }
                    } else {
                        historyCheckTimeoutFlag = true;
                        historyFolderId = histResult.folderId;
                        logger.log(`⚠️ 업로드 기록 조회 지연/타임아웃 감지. 개별 스킵(페일세이프) 모드로 전환합니다.`, 'warn');
                    }
                }
            } catch (histErr) {
                // Non-fatal: if history check fails unexpectedly
                logger.log(`⚠️ 업로드 기록 조회 실패: ${histErr.message}`, 'warn');
            }

            // [v1.6.0] Phase B-2: Load Master Index -> Cache File ID -> Episode List
            try {
                logger.log('⚡ 고속 업로드(Fast Path) 캐시 조회 중...');
                const config = getConfig();
                
                // 1. Fetch Complete Master Index
                const indexResponse = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: "POST", url: config.gasUrl,
                        data: JSON.stringify({ type: "get_library", folderId: config.folderId, apiKey: config.apiKey, protocolVersion: 3 }),
                        headers: { "Content-Type": "text/plain" },
                        onload: (r) => {
                            try { resolve(JSON.parse(r.responseText)); } 
                            catch(e) { reject(e); }
                        },
                        onerror: reject
                    });
                });

                if (indexResponse.status === 'success') {
                    // 2. Find Current Series in Index by ID or Title
                    // [Fix] Handle both indexResponse.body (cached) and indexResponse.list (rebuild) structures
                    const seriesList = indexResponse.body || indexResponse.list || [];
                    
                    // Match by sourceId or title
                    const matchedSeries = seriesList.find(s => 
                        (s.sourceId && s.sourceId === seriesId) || 
                        (s.name && s.name.includes(seriesTitle))
                    );

                    let targetCacheFileId = matchedSeries ? matchedSeries.cacheFileId : null;
                    
                    if (targetCacheFileId) {
                        logger.log(`[Fast Path] 마스터 카탈로그에서 신규 캐시 파일 발견: ${targetCacheFileId}`);
                    } else {
                        // [v1.6.1] 2nd Attempt: Fetch Merge Index Fragment directly (Fallback for newly uploaded series)
                        logger.log(`[Fast Path] 마스터 카탈로그에 캐시 부재. _MergeIndex 대기열 파편을 탐색합니다...`);
                        const fragRes = await getMergeIndexFragment(seriesId);
                        if (fragRes.found && fragRes.data && fragRes.data.cacheFileId) {
                            targetCacheFileId = fragRes.data.cacheFileId;
                            logger.log(`[Fast Path] 큐에서 비동기 병합 파편 발견 성공! (ID: ${targetCacheFileId})`);
                        }
                    }

                    if (targetCacheFileId) {
                        // 3. Directly load episode cache using the cacheFileId
                        const cachedEpisodes = await getBooksByCacheId(targetCacheFileId);
                        
                        if (cachedEpisodes && cachedEpisodes.length > 0) {
                             cachedEpisodes.forEach(ep => {
                                 // Map "name" (e.g. "0001 - Title.cbz") to its Drive File ID
                                 // We strip the extension to match our `fullFilename` variable later
                                 const nameWithoutExt = ep.name.replace(/\.[^/.]+$/, "");
                                 episodeCacheMap.set(nameWithoutExt, ep.id);
                             });
                             logger.success(`[Fast Path] 맵핑 테이블 완성: ${episodeCacheMap.size}개 에피소드 캐시 로드 성공!`);
                        }
                    } else {
                        logger.log('[Fast Path] 신규 작품이거나 캐시 파편이 아직 없습니다 (일반 업로드 분기로 진행)');
                    }
                }
            } catch (cacheErr) {
                logger.log(`⚠️ 고속 업로드 캐시 로드 실패 (일반 분기로 진행방향 전환): ${cacheErr.message}`, 'warn');
            }
        }

        // [v1.27.0] 합본 정책 판별
        // - 소설 + "범위 합본"            → novelVolume (EPUB/TXT 한 권)
        // - 챕터 묶음(zipOfCbzs) 정책      → zipOfFiles (회차 파일을 ZIP으로 묶음, 만화는 분할 단위 적용)
        // v1.26.4 이후 zipOfCbzs도 배치 큐로 넘어가면서 실제로는 회차별 개별 저장만 되던 문제를 함께 해결합니다.
        const currentNovelMode = getConfig().novelMode;
        const mergeKind = (isNovel && currentNovelMode === 'singleVolume')
            ? 'novelVolume'
            : (buildingPolicy === 'zipOfCbzs' ? 'zipOfFiles' : null);
        if (mergeKind && (destination === 'drive' || destination === 'drive_kavita')) {
            logger.warn('ℹ️ 합본 결과물은 로컬로 저장됩니다. (드라이브 업로드는 개별 회차 정책에서만 지원)', 'Merge');
        }

        const pendingEpisodes = [];
        for (let i = 0; i < list.length; i++) {
            const item = parser.parseListItem(list[i].element || list[i]);
            const numStr = item.num ? item.num.toString() : '';

            // 구글 드라이브 스킵 필터 (드라이브 개별 저장 전용)
            const isSkip = await shouldSkipEpisode({
                numStr,
                destination,
                isSingleVolume: !!mergeKind,
                uploadedHistorySet,
                historyCheckTimeoutFlag,
                historyFolderId
            });
            if (isSkip) continue;

            pendingEpisodes.push({
                title: item.title,
                url: item.src || item.url || (list[i].element || list[i]).href || location.href,
                episodeNum: numStr,
                category: category,
                viewerCfg: parser.rule.viewer || {},
                rootFolder: rootFolder,
                destination: mergeKind ? (destination === 'native' ? 'native' : 'local') : destination,
                novelFormat: configNovelFormat,
                matchedRule: parser.rule,
                protocolDomain: parser.protocolDomain || window.location.origin,
                seriesMetadata: seriesMetadata
            });
        }

        if (pendingEpisodes.length === 0) {
            if (destination === 'drive' || destination === 'drive_kavita') {
                logger.success('✅ 모든 에피소드가 이미 드라이브에 존재하여 수집을 조기 완료합니다.', 'Queue');
            } else {
                logger.warn('수집할 회차가 없습니다.', 'Downloader');
            }
            return;
        }

        // 동일 회차가 이미 다른 작업으로 대기/진행 중이면 중복 등록 차단 (합본 세션 결과 누락 방지)
        const pendingIds = new Set(pendingEpisodes.map(ep => getQueueItemId(seriesTitle, ep.episodeNum)));
        const conflicting = getQueue().filter(q => pendingIds.has(q.id) && (q.status === 'pending' || q.status === 'processing'));
        if (conflicting.length > 0) {
            logger.warn(`⚠️ 선택한 회차 중 ${conflicting.length}개가 이미 대기열에서 처리 중입니다. 기존 작업이 끝난 뒤 다시 시도하거나 대시보드에서 정리해 주세요.`, 'Queue');
            EventBus.emit(EVT.NOTIFY_ERROR, { msg: `선택한 회차 중 ${conflicting.length}개가 이미 대기열에서 처리 중입니다.\n기존 작업이 끝난 뒤 다시 시도하거나, 대시보드에서 중단된 작업을 정리해 주세요.` });
            return;
        }

        // [v1.21.4] 구글 드라이브 업로드 모드 시, 큐 등록 전 작품 폴더를 선제 생성/확정 (경쟁적 중복 폴더 생성 차단)
        let activeFolderId = historyFolderId;
        if (!mergeKind && (destination === 'drive' || destination === 'drive_kavita') && !activeFolderId) {
            const cleanSeries = seriesTitle.replace(/^\[[^\]]+\]\s*/, '');
            const targetFolder = destination === 'drive_kavita' ? cleanSeries : rootFolder;
            logger.log(`📁 [Drive] 신규 작품 폴더 선제 생성 중: ${targetFolder}`);
            try {
                const token = await getOAuthToken();
                const parentFolderId = await getOrCreateFolder(category || 'Webtoon', getConfig().folderId, token);
                activeFolderId = await getOrCreateFolder(targetFolder, parentFolderId, token);
                logger.success(`📁 [Drive] 신규 작품 폴더 선제 생성 완료 -> ID: ${activeFolderId}`);
            } catch (folderErr) {
                logger.error(`❌ [Drive] 폴더 선제 생성 중 에러 발생: ${folderErr.message}`);
            }
        }

        // 합본 세션 생성
        let mergeSessionId = '';
        if (mergeKind) {
            const template = {
                category,
                viewerCfg: parser.rule.viewer || {},
                rootFolder,
                destination: destination === 'native' ? 'native' : 'local',
                novelFormat: configNovelFormat,
                matchedRule: parser.rule,
                protocolDomain: parser.protocolDomain || window.location.origin,
                seriesMetadata,
                folderId: ''
            };
            const session = createMergeSession({
                kind: mergeKind,
                seriesTitle,
                displayTitle: (explicitSeriesTitle || seriesTitle || rootFolder),
                rootFolder,
                category,
                novelFormat: configNovelFormat,
                siteName,
                destination,
                partSize: isNovel ? 0 : getConfig().mergePartSize,
                origin: window.location.origin,
                items: pendingEpisodes.map(ep => ({
                    id: getQueueItemId(seriesTitle, ep.episodeNum),
                    num: ep.episodeNum,
                    title: ep.title,
                    url: ep.url
                })),
                template
            });
            mergeSessionId = session.id;
            const kindLabel = mergeKind === 'novelVolume' ? `소설 단행본(${configNovelFormat.toUpperCase()})` : '챕터 묶음(ZIP)';
            logger.info(`📚 [합본] ${kindLabel} 작업 생성: ${pendingEpisodes.length}화 수집 후 한 번에 저장합니다. (중간에 탭을 닫아도 이어받기 가능)`, 'Merge');
        }

        const mappedEpisodes = pendingEpisodes.map(ep => ({
            ...ep,
            folderId: activeFolderId || '',
            mergeSessionId
        }));
        const injected = addEpisodesToQueue(mappedEpisodes, seriesTitle, { ownerTabId: TAB_ID, isSingleVolume: false, mergeSessionId });
        logger.log(`🗂️ [공통 큐] 수집 대상 ${injected}개 에피소드를 대기열에 선등록 완료.`, 'Queue');

        // 배치 큐 파이프라인 기동
        isAsyncDelegate = startBatchPipeline(pendingEpisodes.map(ep => ({
            id: getQueueItemId(seriesTitle, ep.episodeNum),
            url: ep.url,
            title: ep.title
        })));
        if (!isAsyncDelegate && mergeSessionId) {
            logger.warn('⚠️ 수집 창을 열지 못해 합본 작업이 대기 상태로 남았습니다. 팝업 차단을 해제한 뒤 대시보드에서 "이어받기"를 눌러 주세요.', 'Merge');
        }
        return; // 큐 엔진에 스케줄 위임 후 early exit
    } catch (error) {
        console.error(error);
        logger.error(`전체 다운로드 루틴 오류 발생: ${error.message}`, 'System');
        alert(`다운로드 중 오류 발생:\n${error.message}`);
    } finally {
        if (!isAsyncDelegate) {
            EventBus.emit(EVT.UPDATE_PROGRESS);
            // 이 탭에서 진행 중인 배치 작업이 없을 때만 Anti-Sleep 종료
            const hasMyActive = getQueue().some(i => i.ownerTabId === TAB_ID && (i.status === 'pending' || i.status === 'processing'));
            if (!hasMyActive) stopSilentAudio();
        } else {
            console.log('[Anti-Sleep] 비동기 멀티큐 배치 위임으로 안티 슬립 상태를 지속 유지합니다.');
        }
        // (v1.27.0) 기존 finally의 document.querySelector('iframe').remove()는 사이트 자체 iframe까지 지울 수 있어 제거했습니다.
    }
}

/**
 * 배치 큐 파이프라인 기동: 팝업 차단 회피용 자식 창 사전 확보(Pre-open) + 배치 컨트롤러/스케줄러 초기화
 * @param {Array<{id:string,url:string,title:string}>} targets 사전 확보 후보 (대기열 순서)
 * @returns {boolean} 스케줄러 위임 성공 여부
 */
export function startBatchPipeline(targets = []) {
    logger.log(`🚦 [멀티큐] 배치 수집기 가동 준비...`, 'Queue');
    const maxWorkers = getMaxWorkers();
    const openCount = Math.max(0, Math.min(maxWorkers - activeWorkers.size, targets.length));
    if (openCount > 0) {
        logger.log(`🛡️ 팝업 차단 회피를 위한 자식 창 ${openCount}개 선제 확보(Pre-open) 중... (동시 수집 ${maxWorkers}개)`, 'Queue');
    }

    const width = 400;
    const height = 600;
    const leftBase = window.screen.width - width - 50;
    const topBase = 100;
    let opened = 0;

    for (let i = 0; i < openCount; i++) {
        const target = targets[i];
        const slot = activeWorkers.size;
        const workerName = `tokisync_novel_worker_${target.id}`.replace(/[^a-zA-Z0-9_]/g, '');
        logger.log(`🚀 [Pre-open #${i + 1}] 자식 팝업 창 생성: ${target.title}`);
        const popupRef = window.open(
            target.url,
            workerName,
            `width=${width},height=${height},left=${leftBase - slot * 60},top=${topBase + slot * 60},noopener=false,scrollbars=yes,resizable=yes`
        );
        if (popupRef) {
            activeWorkers.set(target.id, popupRef);
            updateQueueItem(target.id, { status: 'processing', stage: WORKER_STAGE.INIT, startedAt: Date.now() });
            opened++;
        } else {
            logger.error(`❌ [Pre-open #${i + 1}] 브라우저 팝업 차단으로 자식 창 확보에 실패했습니다. 이 사이트의 팝업을 허용해 주세요.`, 'Queue');
            EventBus.emit(EVT.NOTIFY_ERROR, { msg: '브라우저가 수집 창(팝업)을 차단했습니다.\n주소창 오른쪽의 팝업 차단 아이콘에서 이 사이트의 팝업을 "항상 허용"으로 바꾼 뒤 다시 시도해 주세요.' });
            break;
        }
    }

    if (opened > 0 || activeWorkers.size > 0 || openCount === 0) {
        initBatchWorkerController();
        initQueueScheduler();
        runSchedulerOnce();
        logger.success(`🚦 멀티큐 스케줄러 기동 완료.`, 'Queue');
        return true;
    }
    logger.error(`❌ 선제 확보된 자식 창이 없어 큐 수집을 시작하지 못했습니다.`, 'Queue');
    return false;
}

/**
 * [v1.27.0] 중단된 작업 이어받기 (고아 대기열 항목 + 합본 세션)
 * @param {{ sessionId?: string }} options sessionId가 있으면 해당 합본 세션만, 없으면 모든 고아 항목
 * @returns {Promise<number>} 다시 수집할 회차 수
 */
export async function resumeQueuedWork(options = {}) {
    const targetOrigin = window.location.origin;
    let count = 0;
    if (options.sessionId) {
        count = await resumeMergeSession(options.sessionId, { targetOrigin });
    } else {
        // 고아 합본 세션 먼저 이어받기 → 나머지 고아 항목
        for (const session of getMergeSessions()) {
            if (session.ownerTabId !== TAB_ID && !isTabAlive(session.ownerTabId)) {
                count += await resumeMergeSession(session.id, { targetOrigin });
            }
        }
        count += reclaimOrphanItems({ targetOrigin });
    }
    startSilentAudio();
    const targets = getQueue()
        .filter(q => q.status === 'pending' && q.ownerTabId === TAB_ID)
        .map(q => ({ id: q.id, url: q.episodeUrl, title: q.episodeTitle }));
    if (targets.length > 0) startBatchPipeline(targets);
    EventBus.emit(EVT.UPDATE_PROGRESS);
    return count;
}
