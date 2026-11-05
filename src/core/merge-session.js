/**
 * tokiSync v1.27.0 - Merge Session
 * 합본 작업(소설 범위 합본 / 챕터 묶음 ZIP)을 배치 큐 위에서 관리합니다.
 *
 * 흐름: 회차를 배치 큐로 수집 → 회차별 결과를 merge-store에 영속 보관 → 모든 회차가 끝나면 순서대로 합본 저장
 * - 탭이 닫히거나 새로고침되어도 이미 받은 회차는 보존되며, 남은 회차만 이어받아 수집합니다.
 * - 실패 회차가 있으면 자동으로 합본하지 않고 '확인 필요' 상태로 두어, 실패 회차 재시도 또는 부분 합본 저장을 고를 수 있게 합니다.
 *
 * 세션 kind
 * - 'novelVolume': 소설 본문을 모아 EPUB/TXT 한 권으로 저장
 * - 'zipOfFiles' : 회차별 CBZ(또는 EPUB/TXT) 파일을 ZIP으로 묶어 저장 (partSize 회차마다 분할, 0이면 분할 없음)
 */

import { EventBus, EVT } from './EventBus.js';
import { logger } from './logger.js';
import { getQueue, addEpisodesToQueue, removeQueueItem, TAB_ID, isTabAlive, reclaimOrphanItems, rewriteUrlOrigin } from './queue.js';
import { saveEpisodeData, loadEpisodeData, deleteEpisodeData, makeMergeKey } from './merge-store.js';
import { EpubBuilder } from './epub.js';
import { TxtBuilder } from './txt.js';
import { saveFile } from './utils.js';

const SESSIONS_KEY = 'TOKI_MERGE_SESSIONS';

export const MERGE_STATUS = {
    RUNNING: 'running',       // 수집 진행 중
    ATTENTION: 'attention',   // 실패/중단 회차 존재 → 사용자 선택 대기
    SAVING: 'saving',         // 합본 파일 생성 중
};

// ── 영속 저장 래퍼 ─────────────────────────────────────────────
const readAll = () => {
    try {
        if (typeof GM_getValue !== 'undefined') return GM_getValue(SESSIONS_KEY, {}) || {};
        if (typeof localStorage !== 'undefined') {
            const v = localStorage.getItem(SESSIONS_KEY);
            return v ? JSON.parse(v) : {};
        }
    } catch (e) {
        console.error('[MergeSession] 세션 조회 실패:', e);
    }
    return {};
};

const writeAll = (all) => {
    try {
        if (typeof GM_setValue !== 'undefined') GM_setValue(SESSIONS_KEY, all);
        else if (typeof localStorage !== 'undefined') localStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
    } catch (e) {
        console.error('[MergeSession] 세션 저장 실패:', e);
    }
    try { EventBus.emit(EVT.UPDATE_PROGRESS); } catch (e) {}
};

export const getMergeSessions = () => Object.values(readAll()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
export const getMergeSession = (id) => (id ? readAll()[id] || null : null);

const patchSession = (id, patch) => {
    const all = readAll();
    if (!all[id]) return null;
    all[id] = { ...all[id], ...(typeof patch === 'function' ? patch(all[id]) : patch), updatedAt: Date.now() };
    writeAll(all);
    return all[id];
};

const removeSession = (id) => {
    const all = readAll();
    if (!all[id]) return;
    delete all[id];
    writeAll(all);
};

const numValue = (num) => {
    const m = String(num ?? '').match(/^(\d+)(?:_(\d+))?/);
    if (!m) return Number.MAX_SAFE_INTEGER;
    return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 1000 : 0);
};

const cleanTitle = (session) => (session.seriesTitle || session.rootFolder || 'TokiSync')
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^Unknown\s*Series$/i, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .trim() || 'TokiSync';

const rangeLabelOf = (items) => {
    const nums = items.map(i => parseInt(i.num, 10)).filter(n => !isNaN(n));
    if (nums.length === 0) return '';
    const a = Math.min(...nums);
    const b = Math.max(...nums);
    return a === b ? `${a}화` : `${a}-${b}화`;
};

// ── 세션 생성 ───────────────────────────────────────────────────
/**
 * 합본 세션 생성
 * @param {object} opts
 * @param {'novelVolume'|'zipOfFiles'} opts.kind
 * @param {string} opts.seriesTitle 큐 아이템 title(= getQueueItemId 키)로 사용된 작품명
 * @param {Array<{id:string,num:string,title:string,url:string}>} opts.items 오름차순 정렬된 회차 목록
 * @param {object} opts.template 큐 재등록에 필요한 공통 필드 (category, viewerCfg, matchedRule, protocolDomain, novelFormat, destination, rootFolder, seriesMetadata, folderId)
 */
export const createMergeSession = (opts) => {
    const id = `merge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const session = {
        id,
        kind: opts.kind,
        seriesTitle: opts.seriesTitle,
        displayTitle: opts.displayTitle || opts.seriesTitle,
        rootFolder: opts.rootFolder || '',
        category: opts.category || 'Webtoon',
        novelFormat: opts.novelFormat || 'epub',
        siteName: opts.siteName || 'TokiSync',
        destination: opts.destination === 'native' ? 'native' : 'local',
        partSize: opts.kind === 'zipOfFiles' ? Math.max(0, parseInt(opts.partSize, 10) || 0) : 0,
        origin: opts.origin || (typeof location !== 'undefined' ? location.origin : ''),
        ownerTabId: TAB_ID,
        status: MERGE_STATUS.RUNNING,
        items: opts.items || [],
        template: opts.template || {},
        storedIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    const all = readAll();
    all[id] = session;
    writeAll(all);
    return session;
};

// ── 회차 결과 보관 ───────────────────────────────────────────────
/**
 * 배치 워커가 수집한 회차 결과를 합본 저장소에 보관합니다.
 * @param {object} queueItem 큐 아이템 (mergeSessionId 필수)
 * @param {object} record merge-store 레코드
 */
export const storeMergeEpisode = async (queueItem, record) => {
    const sessionId = queueItem.mergeSessionId;
    if (!getMergeSession(sessionId)) throw new Error('합본 세션을 찾을 수 없습니다 (폐기되었을 수 있음).');
    await saveEpisodeData(makeMergeKey(sessionId, queueItem.id), record);
    patchSession(sessionId, (s) => ({
        storedIds: s.storedIds.includes(queueItem.id) ? s.storedIds : [...s.storedIds, queueItem.id]
    }));
};

// ── 진행 상황 ───────────────────────────────────────────────────
/**
 * 세션 진행 상황 요약 (UI 표시용)
 */
export const getMergeSessionProgress = (session, queue = getQueue()) => {
    const stored = new Set(session.storedIds || []);
    const sessionQueue = queue.filter(q => q.mergeSessionId === session.id);
    const active = sessionQueue.filter(q => q.status === 'pending' || q.status === 'processing');
    const activeIds = new Set(active.map(q => q.id));
    const total = session.items.length;
    const storedCount = session.items.filter(i => stored.has(i.id)).length;
    const missingItems = session.items.filter(i => !stored.has(i.id) && !activeIds.has(i.id));
    const ownerAlive = isTabAlive(session.ownerTabId);
    const stoppedByUser = sessionQueue.some(q => q.status === 'failed' && (q.errorMsg || '').includes('중단'));
    return {
        total,
        stored: storedCount,
        active: active.length,
        failed: missingItems.length,
        missingItems,
        ownerAlive,
        isMine: session.ownerTabId === TAB_ID,
        stoppedByUser,
        percent: total > 0 ? Math.round((storedCount / total) * 100) : 0
    };
};

// ── 완료 감시 ───────────────────────────────────────────────────
const finalizing = new Set();
let checkTimer = null;

/**
 * 현재 탭 소유의 진행 중 세션 중 수집이 끝난 세션을 찾아 합본하거나 '확인 필요'로 전환합니다.
 */
export const checkMergeSessions = async () => {
    const queue = getQueue();
    for (const session of getMergeSessions()) {
        if (session.ownerTabId !== TAB_ID || session.status !== MERGE_STATUS.RUNNING) continue;
        if (finalizing.has(session.id)) continue;
        const prog = getMergeSessionProgress(session, queue);
        if (prog.active > 0) continue;

        if (prog.failed === 0 && prog.stored === prog.total) {
            await finalizeMergeSession(session.id);
        } else {
            patchSession(session.id, { status: MERGE_STATUS.ATTENTION });
            logger.warn(`⚠️ [합본] ${session.displayTitle}: ${prog.stored}/${prog.total}화 보관, ${prog.failed}화 실패/중단. 대시보드에서 "실패 회차 재시도" 또는 "지금 합본 저장"을 선택하세요.`, 'Merge');
            if (!prog.stoppedByUser) try {
                EventBus.emit(EVT.NOTIFY_ERROR, { msg: `[합본] ${session.displayTitle}: ${prog.failed}화가 실패/중단되어 합본을 보류했습니다.\n대시보드 다운로드 탭에서 재시도하거나 부분 합본을 저장할 수 있습니다.` });
            } catch (e) {}
        }
    }
};

/**
 * 큐 변화 시 디바운스하여 완료 감시를 실행합니다.
 */
export const scheduleMergeCheck = (delay = 1200) => {
    if (checkTimer) clearTimeout(checkTimer);
    checkTimer = setTimeout(() => {
        checkTimer = null;
        checkMergeSessions().catch(e => console.error('[MergeSession] 완료 감시 오류:', e));
    }, delay);
};

let watcherInstalled = false;
export const installMergeWatcher = () => {
    if (watcherInstalled) return;
    watcherInstalled = true;
    EventBus.on(EVT.UPDATE_PROGRESS, () => {
        // 진행 중인 세션이 있을 때만 감시 (불필요한 타이머 생성 방지)
        if (getMergeSessions().some(s => s.ownerTabId === TAB_ID && s.status === MERGE_STATUS.RUNNING)) {
            scheduleMergeCheck();
        }
    });
};

// ── 합본 생성 ───────────────────────────────────────────────────
const saveReport = async (session, missingItems) => {
    if (!missingItems.length) return;
    const lines = [
        `[TokiSync 합본 리포트]`,
        `작품명: ${session.displayTitle}`,
        `일시: ${new Date().toLocaleString()}`,
        `총 ${session.items.length}화 중 ${missingItems.length}화가 합본에서 빠졌습니다.`,
        ``,
        ...missingItems.map(i => `- [${i.num}] ${i.title}`)
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    try {
        await saveFile(blob, `${cleanTitle(session)}_합본_누락_리포트`, 'local', 'txt');
    } catch (e) {
        console.warn('[MergeSession] 리포트 저장 실패:', e);
    }
};

/**
 * 합본 파일 생성 및 저장
 * @param {string} sessionId
 * @param {{ allowPartial?: boolean }} options allowPartial=true면 누락 회차를 제외하고 저장
 * @returns {Promise<boolean>}
 */
export const finalizeMergeSession = async (sessionId, options = {}) => {
    const session = getMergeSession(sessionId);
    if (!session || finalizing.has(sessionId)) return false;
    finalizing.add(sessionId);
    patchSession(sessionId, { status: MERGE_STATUS.SAVING });

    try {
        const sorted = [...session.items].sort((a, b) => numValue(a.num) - numValue(b.num));
        const records = [];
        const missing = [];
        for (const it of sorted) {
            const rec = (session.storedIds || []).includes(it.id)
                ? await loadEpisodeData(makeMergeKey(sessionId, it.id))
                : null;
            if (rec) records.push({ item: it, rec });
            else missing.push(it);
        }

        if (records.length === 0) {
            throw new Error('보관된 회차가 없어 합본할 수 없습니다.');
        }
        if (missing.length > 0 && !options.allowPartial) {
            // 보관 기록은 있으나 저장소에서 사라진 경우(도메인 변경 등) → 확인 필요로 전환
            patchSession(sessionId, (s) => ({
                status: MERGE_STATUS.ATTENTION,
                storedIds: s.storedIds.filter(id => !missing.some(m => m.id === id))
            }));
            logger.warn(`⚠️ [합본] ${session.displayTitle}: ${missing.length}화 데이터를 찾지 못해 합본을 보류합니다.`, 'Merge');
            return false;
        }

        const baseName = cleanTitle(session);
        const range = rangeLabelOf(records.map(r => r.item));
        const partialMark = missing.length > 0 ? ` [누락 ${missing.length}화]` : '';
        const saveType = session.destination === 'native' ? 'native' : 'local';
        const meta = { folderName: session.rootFolder || baseName, category: session.category };

        if (session.kind === 'novelVolume') {
            const isTxt = session.novelFormat === 'txt';
            const builder = isTxt ? new TxtBuilder() : new EpubBuilder();
            records.forEach(({ item, rec }) => builder.addChapter(rec.title || item.title, (rec.text || '').trim()));
            logger.info(`📚 [합본] ${session.displayTitle} 단행본 조립 중... (${records.length}화)`, 'Merge');
            const built = await builder.build({ series: session.seriesTitle, title: session.displayTitle, writer: session.siteName });
            const blob = built && typeof built.generateAsync === 'function' ? await built.generateAsync({ type: 'blob' }) : built;
            const fileName = `${baseName}${range ? ` (${range})` : ''}${partialMark}`;
            await saveFile(blob, fileName, saveType, isTxt ? 'txt' : 'epub', meta);
            logger.success(`✅ [합본] 저장 완료: ${fileName}.${isTxt ? 'txt' : 'epub'}`, 'Merge');
        } else {
            if (typeof JSZip === 'undefined') throw new Error('JSZip을 사용할 수 없습니다.');
            const partSize = session.partSize > 0 ? session.partSize : records.length;
            const partCount = Math.ceil(records.length / partSize);
            for (let p = 0; p < partCount; p++) {
                const chunk = records.slice(p * partSize, (p + 1) * partSize);
                const zip = new JSZip();
                const usedNames = new Set();
                for (const { item, rec } of chunk) {
                    let name = rec.filename || `${item.num} - ${item.title}.cbz`;
                    if (usedNames.has(name)) name = name.replace(/(\.[^.]+)$/, `_${item.id}$1`);
                    usedNames.add(name);
                    const data = (rec.blob && typeof rec.blob.arrayBuffer === 'function') ? await rec.blob.arrayBuffer() : rec.blob;
                    zip.file(name, data);
                }
                const chunkRange = rangeLabelOf(chunk.map(c => c.item));
                const partLabel = partCount > 1 ? ` Part${p + 1}` : '';
                const fileName = `${baseName}${chunkRange ? ` (${chunkRange})` : ''}${partLabel}${partialMark}`;
                logger.info(`📦 [합본] 묶음 저장 중... (${fileName}, ${chunk.length}화)`, 'Merge');
                // 회차 파일(CBZ/EPUB)은 이미 압축되어 있으므로 STORE로 묶어 속도/메모리를 아낍니다.
                const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE', mimeType: 'application/zip' });
                await saveFile(blob, fileName, saveType, 'zip', meta);
            }
            logger.success(`✅ [합본] ${session.displayTitle} 묶음 저장 완료 (${records.length}화, ${partCount}개 파일)`, 'Merge');
        }

        await saveReport(session, missing);

        // 정리: 보관 데이터·대기열 잔여 항목·세션 삭제
        await deleteEpisodeData(session.items.map(i => makeMergeKey(sessionId, i.id)));
        getQueue().filter(q => q.mergeSessionId === sessionId).forEach(q => removeQueueItem(q.id));
        removeSession(sessionId);
        return true;
    } catch (e) {
        logger.error(`❌ [합본] ${session.displayTitle} 저장 실패: ${e.message}`, 'Merge');
        patchSession(sessionId, { status: MERGE_STATUS.ATTENTION });
        return false;
    } finally {
        finalizing.delete(sessionId);
    }
};

// ── 사용자 조작 ─────────────────────────────────────────────────
/**
 * 세션 이어받기 / 실패 회차 재시도
 * - 세션을 현재 탭 소유로 전환
 * - 보관 기록이 있으나 저장소에서 사라진 회차(도메인 변경 등)는 다시 수집 대상으로 되돌림
 * - 대기열에 남아 있는 회차는 이어받고, 대기열에서 빠진 미보관 회차는 다시 등록
 * @param {string} sessionId
 * @param {{ targetOrigin?: string }} options targetOrigin이 원래 도메인과 다르면 회차 URL 도메인을 교체
 * @returns {Promise<number>} 다시 수집할 회차 수
 */
export const resumeMergeSession = async (sessionId, options = {}) => {
    const session = getMergeSession(sessionId);
    if (!session) return 0;
    const targetOrigin = options.targetOrigin || null;

    // 1. 보관 데이터 실재 여부 검증 (IndexedDB는 origin별이므로 도메인이 바뀌면 조회되지 않음)
    const verifiedStored = [];
    for (const id of session.storedIds || []) {
        const rec = await loadEpisodeData(makeMergeKey(sessionId, id));
        if (rec) verifiedStored.push(id);
    }
    const lost = (session.storedIds || []).length - verifiedStored.length;
    if (lost > 0) {
        logger.warn(`⚠️ [합본] 이전 도메인에 보관된 ${lost}화는 현재 도메인에서 읽을 수 없어 다시 수집합니다.`, 'Merge');
    }
    const storedSet = new Set(verifiedStored);

    // 2. 대기열에 남은 세션 항목 이어받기 (실패 항목 포함 → pending 전환)
    const queue = getQueue();
    const sessionQueue = queue.filter(q => q.mergeSessionId === sessionId && !storedSet.has(q.id));
    const inQueueIds = new Set(sessionQueue.map(q => q.id));
    if (sessionQueue.length > 0) {
        // 실패 항목은 소유 탭과 무관하게 이어받을 수 있도록 ids로 직접 지정
        reclaimOrphanItems({ ids: sessionQueue.map(q => q.id), targetOrigin, includeFailed: true });
    }

    // 3. 대기열에서 빠진 미보관 회차 재등록
    const toAdd = session.items
        .filter(it => !storedSet.has(it.id) && !inQueueIds.has(it.id))
        .map(it => ({
            ...session.template,
            title: it.title,
            url: targetOrigin ? rewriteUrlOrigin(it.url, targetOrigin) : it.url,
            episodeNum: it.num,
            protocolDomain: targetOrigin || session.template.protocolDomain,
            mergeSessionId: sessionId
        }));
    if (toAdd.length > 0) {
        addEpisodesToQueue(toAdd, session.seriesTitle, { ownerTabId: TAB_ID, mergeSessionId: sessionId });
    }

    patchSession(sessionId, {
        ownerTabId: TAB_ID,
        status: MERGE_STATUS.RUNNING,
        storedIds: verifiedStored,
        origin: targetOrigin || session.origin
    });
    const pendingCount = session.items.length - verifiedStored.length;
    logger.info(`▶️ [합본] ${session.displayTitle} 이어받기: ${verifiedStored.length}화 보관됨, ${pendingCount}화 수집 예정`, 'Merge');
    if (pendingCount === 0) scheduleMergeCheck(200);
    return pendingCount;
};

/**
 * 세션 폐기 (보관 데이터와 대기열 항목 삭제)
 */
export const discardMergeSession = async (sessionId) => {
    const session = getMergeSession(sessionId);
    if (!session) return;
    getQueue().filter(q => q.mergeSessionId === sessionId).forEach(q => removeQueueItem(q.id));
    await deleteEpisodeData(session.items.map(i => makeMergeKey(sessionId, i.id)));
    removeSession(sessionId);
    logger.info(`🗑️ [합본] ${session.displayTitle} 작업을 폐기했습니다.`, 'Merge');
};
