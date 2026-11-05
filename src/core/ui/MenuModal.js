/**
 * MenuModal Module for TokiSync
 * Handles the main dashboard HTML and user interaction events.
 */

import { EventBus, EVT } from '../EventBus.js';
import { FormRuleEditor } from './FormRuleEditor.js';
import { stopAllWorkers, getQueuePaused, setQueuePaused, runSchedulerOnce, removeQueueItem } from '../queue.js';

export class MenuModal {
    static instance = null;

    constructor(handlers = {}) {
        if (MenuModal.instance) return MenuModal.instance;
        this.handlers = handlers;
        this.init();
        MenuModal.instance = this;
    }

    init() {
        // [임시] 대시보드 팝업 분리형으로, 대상 DOM 내 FAB 자동생성은 차단합니다.
    }

    getHTML() {
        return `
        <div id="toki-dashboard-popup">
            <div id="toki-dashboard-header">
                <span id="toki-dashboard-title">⚡ TokiSync 통합 대시보드</span>
                <div id="toki-dashboard-header-controls">
                    <button class="toki-btn-ghost" id="toki-btn-show-progress" title="수집 진행 상황 및 대기열">📊 진행 상황</button>
                    <button class="toki-btn-ghost" id="toki-btn-show-logs" title="실시간 수집 로그 모니터">📋 로그</button>
                    <button class="toki-btn-ghost" id="toki-btn-viewer-link" title="Open Viewer">🌐 Viewer</button>
                    <button class="toki-btn-ghost" id="toki-btn-menu-close" title="Close">❌ 닫기</button>
                </div>
            </div>
            
            <div class="toki-tabs">
                <button class="toki-tab-btn active" data-tab="download">📥 다운로드</button>
                <button class="toki-tab-btn" data-tab="settings">⚙️ 설정</button>
                <button class="toki-tab-btn" data-tab="history">📊 기록</button>
                <button class="toki-tab-btn" data-tab="tools">🛠️ 도구</button>
            </div>
            
            <div class="toki-modal-body">
                <!-- 1. Download Tab -->
                <div class="toki-tab-content active" id="toki-tab-download">
                    <div id="toki-work-panel" class="toki-work-panel"></div>
                    <div id="toki-download-actions">
                        <div class="toki-control-group">
                            <label class="toki-label">회차 목록</label>
                            <button class="toki-btn-action toki-btn-secondary toki-btn-sm" id="toki-btn-scan-episodes">
                                <span>📄 전체 회차 불러오기</span>
                            </button>
                            <div id="toki-scan-summary" class="toki-scan-summary">아직 불러오지 않았습니다. 목록이 여러 페이지(예: 한 페이지 100화)로 나뉜 작품은 먼저 불러오면 전체 회차 수와 누락 구간을 미리 확인할 수 있습니다.</div>
                        </div>
                        <div class="toki-control-group">
                            <label class="toki-label">에피소드 범위 지정</label>
                            <input type="text" id="toki-range-input" class="toki-input" placeholder="예: 1,2,4-10,15 (비우면 전체)">
                            <div class="toki-text-xs toki-mt-8 toki-ml-4">쉼표(,)로 개별 번호, 하이픈(-)으로 연속 범위 지정</div>
                            <div id="toki-range-preview" class="toki-range-preview"></div>
                            <div class="toki-quick-range">
                                <button class="toki-chip" data-quick-range="all" disabled>전체</button>
                                <button class="toki-chip" data-quick-range="10" disabled>최신 10화</button>
                                <button class="toki-chip" data-quick-range="50" disabled>최신 50화</button>
                                <button class="toki-chip" data-quick-range="100" disabled>최신 100화</button>
                            </div>
                        </div>
                        <div class="toki-control-group toki-mb-24">
                            <label class="toki-checkbox-wrapper">
                                <input type="checkbox" id="toki-chk-force-overwrite" class="toki-checkbox-input">
                                <span class="toki-checkbox"></span>
                                <span class="toki-checkbox-label">⚠️ 강제 재다운로드 (파일 덮어쓰기)</span>
                            </label>
                        </div>
                        <div class="toki-btn-group-row">
                            <button class="toki-btn-action toki-flex-1-4" id="toki-btn-down-range">
                                <span>선택 다운로드</span>
                            </button>
                            <button class="toki-btn-action toki-btn-secondary" id="toki-btn-down-all">
                                <span>전체 다운로드</span>
                            </button>
                        </div>
                    </div>
                    
                    <div id="toki-inline-progress" style="display: none; padding: 12px; background: rgba(0,0,0,0.04); border-radius: 8px; margin-top: 12px; border: 1px solid rgba(0,0,0,0.06);">
                        <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; display: flex; justify-content: space-between;" id="toki-inline-header">
                            <span id="toki-inline-text">수집 준비 중...</span>
                            <span id="toki-inline-percent" style="color: var(--toki-primary, #6366f1);">0%</span>
                        </div>
                        <div class="toki-progress-bar-container" style="background: rgba(0,0,0,0.08); border-radius: 4px; height: 8px; overflow: hidden; margin-bottom: 12px; position: relative;">
                            <div id="toki-inline-bar" class="toki-progress-overall-bar-fill" style="width: 0%; height: 100%; background: var(--toki-primary, #6366f1); transition: width 0.3s ease;"></div>
                        </div>
                        <div class="toki-btn-group-row" style="gap: 8px;">
                            <button class="toki-btn-action toki-btn-secondary toki-flex-1" id="toki-inline-pause" style="height: 36px; padding: 0;">
                                <span>⏸️ 일시 정지</span>
                            </button>
                            <button class="toki-btn-action toki-btn-danger toki-flex-1" id="toki-inline-stop" style="background: #ef4444; color: white; height: 36px; padding: 0; border: none;">
                                <span>⏹️ 수집 중단</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 2. Settings Tab -->
                <div class="toki-tab-content" id="toki-tab-settings">
                    <div class="toki-section-title toki-mt-0">Download Policies</div>
                    <div class="toki-control-group">
                        <label class="toki-label">저장 정책</label>
                        <select id="toki-sel-policy" class="toki-select">
                            <option value="individual">개별 파일 (Individual)</option>
                            <option value="zipOfCbzs">챕터 묶음 (ZIP of CBZs)</option>
                            <option value="native">자동 분류 (Native)</option>
                            <option value="drive">드라이브 업로드 (GoogleDrive 레거시)</option>
                            <option value="drive_kavita">드라이브 업로드 (Kavita 호환)</option>
                        </select>
                    </div>

                    <div id="toki-native-helper" class="toki-hidden toki-helper-box-blue">
                        <div class="toki-text-sm toki-text-primary toki-mb-10 toki-helper-desc">
                            ⚠️ Native 모드는 브라우저 설정 변경이 필요합니다.
                        </div>
                        <button class="toki-btn-action toki-btn-secondary toki-btn-sm" id="toki-btn-test-native">
                            📂 기능 동작 테스트 실행
                        </button>
                    </div>

                    <div class="toki-control-group">
                        <label class="toki-label">로컬 파일명 템플릿</label>
                        <input type="text" id="toki-sel-nametemplate" class="toki-input" placeholder="{number:4} - {title}" style="height: 36px; padding: 8px 14px; border-radius: 12px; font-size: 13px; width: 100%;">
                        <div class="toki-hint" style="font-size: 11px; color: #888; margin-top: 6px;">
                            로컬 저장 시 파일명 포맷입니다.<br>
                            치환자: <b>{number:X}</b>=X자리패딩(0~9), <b>{number}</b>=4자리패딩, <b>{rawNumber}</b>=원본번호, <b>{series}</b>=작품명, <b>{title}</b>=회차제목<br>
                            ※ 구글 드라이브(kavita 호환) 업로드 시에도 적용됩니다 (레거시 모드는 제외).
                        </div>
                    </div>

                    <div class="toki-control-group">
                        <label class="toki-label">다운로드 속도</label>
                        <select id="toki-sel-speed" class="toki-select">
                            <option value="cautious">신중 (3-6초)</option>
                            <option value="thorough">철저 (5-9초)</option>
                            <option value="slow">느림 (7-14초)</option>
                            <option value="very_slow">매우 느림 (10-20초)</option>
                        </select>
                    </div>

                    <div class="toki-control-group">
                        <label class="toki-label">이미지 스캔 속도
                            <span id="toki-scan-speed-val" style="font-weight: bold; color: var(--toki-primary, #6366f1);">1000ms</span>
                        </label>
                        <input type="range" id="toki-sel-scanspeed" min="100" max="5000" step="100" value="1000" class="toki-range" style="width: 100%;">
                        <div class="toki-hint" style="font-size: 11px; color: #888; margin-top: 4px;">
                            100ms(빠름/불안정) ─ 1000ms(기본/권장) ─ 3000ms(안정) ─ 5000ms(확실)
                        </div>
                    </div>

                    <div class="toki-section-title">Format & Rules</div>
                    <div class="toki-form-grid">
                        <div class="toki-control-group">
                            <label class="toki-label">소설 포맷</label>
                            <select id="toki-sel-novel-format" class="toki-select">
                                <option value="epub">EPUB</option>
                                <option value="txt">TXT</option>
                            </select>
                        </div>
                        <div class="toki-control-group">
                            <label class="toki-label">소설 패키징</label>
                            <select id="toki-sel-novel-mode" class="toki-select">
                                <option value="perChapter">개별 회차</option>
                                <option value="singleVolume">범위 합본</option>
                            </select>
                        </div>
                    </div>

                    <div class="toki-form-grid">
                        <div class="toki-control-group">
                            <label class="toki-label">동시 수집 창 수</label>
                            <select id="toki-sel-max-workers" class="toki-select">
                                <option value="1">1개 (안전, 기본)</option>
                                <option value="2">2개</option>
                                <option value="3">3개 (차단 위험 증가)</option>
                            </select>
                        </div>
                        <div class="toki-control-group">
                            <label class="toki-label">만화 합본 분할 단위</label>
                            <select id="toki-sel-merge-part" class="toki-select">
                                <option value="10">10화씩</option>
                                <option value="20">20화씩</option>
                                <option value="50">50화씩</option>
                                <option value="0">분할 없음 (한 파일)</option>
                            </select>
                        </div>
                    </div>
                    <div class="toki-text-xs toki-mb-10 toki-ml-4">합본: 소설은 "소설 패키징 = 범위 합본", 만화는 "저장 정책 = 챕터 묶음"을 선택하세요. 회차는 받는 즉시 보관되어 탭을 닫아도 이어받을 수 있습니다. 분할 없음은 회차가 많으면 메모리를 많이 사용합니다.</div>

                    <div class="toki-control-group">
                        <label class="toki-label">Smart Skip 민감도</label>
                        <select id="toki-sel-smartskip" class="toki-select">
                            <option value="90">90% (매우 민감)</option>
                            <option value="80">80% (민감)</option>
                            <option value="70">70% (보통)</option>
                            <option value="50">50% (기본)</option>
                        </select>
                    </div>

                    <div class="toki-control-group">
                        <label class="toki-label">로그 상세 수준</label>
                        <select id="toki-sel-loglevel" class="toki-select">
                            <option value="normal">디버그 (전체 로그)</option>
                            <option value="info">정보 (기본 정보)</option>
                            <option value="warn">경고 (경고 및 에러)</option>
                            <option value="error">오류 (오류만)</option>
                        </select>
                    </div>

                    <div class="toki-section-title">Cloud & Storage</div>
                    <div class="toki-control-group">
                        <label class="toki-label">GAS Script ID</label>
                        <input type="text" id="toki-sel-gas-id" class="toki-input" placeholder="AKfycb...">
                    </div>

                    <div class="toki-control-group">
                        <label class="toki-label">Google Drive Folder ID</label>
                        <input type="text" id="toki-sel-folder-id" class="toki-input" placeholder="Folder ID">
                    </div>

                    <div class="toki-control-group">
                        <label class="toki-label">API Key (보안)</label>
                        <input type="password" id="toki-sel-apikey" class="toki-input" placeholder="API Key">
                    </div>

                    <div class="toki-control-group toki-mt-24 toki-mb-24">
                        <button class="toki-btn-action toki-btn-gradient-green" id="toki-btn-save-settings" style="height: 48px;">
                            <span>💾 설정 저장하기</span>
                        </button>
                    </div>
                </div>

                <!-- 3. History Tab -->
                <div class="toki-tab-content" id="toki-tab-history">
                    <div class="toki-info-card">
                        <div class="toki-info-row">
                            <span class="toki-info-label">동기화 상태</span>
                            <span class="toki-info-val"><span class="toki-status-dot toki-status-online"></span>연결됨</span>
                        </div>
                        <div class="toki-info-row">
                            <span class="toki-info-label">마지막 동기화</span>
                            <span class="toki-info-val" id="toki-txt-last-sync">-</span>
                        </div>
                    </div>
                    <div class="toki-control-group">
                        <button class="toki-btn-action toki-btn-sync" id="toki-btn-sync-now">
                            <span>🔄 지금 즉시 동기화</span>
                        </button>
                    </div>
                    <p class="toki-text-xs toki-text-center toki-line-16">
                        구글 드라이브와의 연결을 확인하고 동기화 이력을 체크합니다.
                    </p>
                </div>

                <!-- 4. Tools Tab -->
                <div class="toki-tab-content" id="toki-tab-tools">
                    <div class="toki-control-group">
                        <label class="toki-label">파일 관리</label>
                        <div class="toki-btn-group-stack">
                            <button class="toki-btn-action toki-btn-secondary" id="toki-btn-migration">
                                📂 Kavita 구조 최적화
                            </button>
                            <button class="toki-btn-action toki-btn-secondary" id="toki-btn-thumb-optim">
                                🔄 썸네일 통합 및 캐시 최적화
                            </button>
                        </div>
                    </div>
                    <hr class="toki-divider">
                    <div class="toki-control-group">
                        <label class="toki-label">시스템 도구</label>
                        <div class="toki-btn-group-stack">
                            <button class="toki-btn-action toki-btn-secondary" id="toki-btn-test-extract">
                                🧪 현재 페이지 이미지/소설 추출 테스트
                            </button>
                            <button class="toki-btn-action toki-btn-lavender" id="toki-btn-form-editor">
                                📝 간편 규칙 편집기 (Form Editor)
                            </button>
                            <button class="toki-btn-action toki-btn-danger" id="toki-btn-hard-reset-queue">
                                🚨 대기열 긴급 강제 초기화
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 📊 수집 진행 상황 및 대기열 모달 -->
        <div id="toki-modal-progress" class="toki-dashboard-modal-overlay" style="display: none;">
            <div class="toki-dashboard-modal">
                <div class="toki-dashboard-modal-header">
                    <span class="toki-dashboard-modal-title">📊 수집 진행 상황 & 대기열</span>
                    <button class="toki-dashboard-modal-close" id="toki-btn-modal-progress-close" title="닫기">&times;</button>
                </div>
                <div class="toki-dashboard-modal-content">
                    <div id="toki-logbox-progress" style="display: block;">
                        <div id="toki-progress-header">
                            <span id="toki-progress-overall-text">진행률: 0% (0 / 0)</span>
                            <div id="toki-progress-overall-controls">
                                <span id="toki-btn-queue-expand" title="대기열 크게 보기" class="toki-cursor-pointer toki-progress-btn">↕️</span>
                                <span id="toki-btn-queue-reset" title="대기열 전체 비우기 (작업 중단)" class="toki-cursor-pointer toki-progress-btn">🗑️</span>
                                <span id="toki-btn-queue-pause" title="일시 정지" class="toki-cursor-pointer toki-progress-btn">⏸️</span>
                                <span id="toki-btn-queue-stop" title="수집 중단" class="toki-cursor-pointer toki-progress-btn">⏹️</span>
                            </div>
                        </div>
                        <div class="toki-progress-bar-container">
                            <div id="toki-progress-overall-bar" class="toki-progress-overall-bar-fill"></div>
                        </div>
                        <div id="toki-progress-workers-list">
                            <!-- 활성 팝업(Worker) 동적 렌더링 -->
                        </div>
                        <div id="toki-progress-queue-section" style="display: none;">
                            <div id="toki-queue-section-header">
                                <span>📋 수집 대기열 목록</span>
                            </div>
                            <div id="toki-progress-queue-list">
                                <!-- 대기열 목록 동적 렌더링 -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 📋 실시간 로그 모달 -->
        <div id="toki-modal-logs" class="toki-dashboard-modal-overlay" style="display: none;">
            <div class="toki-dashboard-modal">
                <div class="toki-dashboard-modal-header">
                    <span class="toki-dashboard-modal-title">📋 실시간 수집 로그 모니터</span>
                    <button class="toki-dashboard-modal-close" id="toki-btn-modal-logs-close" title="닫기">&times;</button>
                </div>
                <div class="toki-dashboard-modal-content">
                    <div id="toki-dashboard-log-section" style="display: flex;">
                        <div class="toki-log-tabs">
                            <button class="toki-log-tab-btn active" data-logtab="service">📋 서비스 로그</button>
                            <button class="toki-log-tab-btn" data-logtab="debug">🛠️ 디버그 콘솔</button>
                            <div class="toki-log-tabs-right">
                                <button id="toki-btn-log-clear" title="Clear Logs">🚫 비우기</button>
                            </div>
                        </div>
                        <ul id="toki-logbox-content" class="toki-log-panel active"></ul>
                        <div id="toki-debug-console" class="toki-log-panel">
                            <div id="toki-debug-console-header">
                                <button id="toki-btn-console-toggle" class="toki-console-toggle-btn on">■ 수집 중단</button>
                                <span class="toki-console-status">TokiSync 디버그 로그 수집 중</span>
                            </div>
                            <ul id="toki-debug-console-content"></ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    bindEventsToPopup(popupWindow) {
        const doc = popupWindow.document;

        // 1. Tab Switching Logic
        const tabBtns = doc.querySelectorAll('.toki-tab-btn');
        const tabContents = doc.querySelectorAll('.toki-tab-content');

        tabBtns.forEach(btn => {
            btn.onclick = () => {
                const target = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.toggle('active', b === btn));
                tabContents.forEach(c => {
                    c.classList.toggle('active', c.id === `toki-tab-${target}`);
                });
            };
        });

        // 2. Control Buttons
        const closeBtn = doc.getElementById('toki-btn-menu-close');
        if (closeBtn) {
            closeBtn.onclick = () => popupWindow.close();
        }

        const viewerLink = doc.getElementById('toki-btn-viewer-link');
        if (viewerLink) {
            viewerLink.onclick = () => {
                if (this.handlers.openViewer) this.handlers.openViewer();
            };
        }

        // 3. Download Tab Events
        const downAllBtn = doc.getElementById('toki-btn-down-all');
        if (downAllBtn) {
            downAllBtn.onclick = () => {
                const force = doc.getElementById('toki-chk-force-overwrite').checked;
                if (this.handlers.downloadAll) this.handlers.downloadAll(force);
            };
        }

        const downRangeBtn = doc.getElementById('toki-btn-down-range');
        if (downRangeBtn) {
            downRangeBtn.onclick = () => {
                const spec = doc.getElementById('toki-range-input').value.trim();
                const force = doc.getElementById('toki-chk-force-overwrite').checked;
                if (this.handlers.downloadRange) {
                    this.handlers.downloadRange(spec || undefined, force);
                }
            };
        }

        // [v1.27.0] 전체 회차 불러오기 / 범위 미리보기 / 빠른 선택
        this.bindEpisodeScan(doc);
        // [v1.27.0] 중단된 작업·합본 세션 패널
        this.bindWorkPanel(popupWindow);

        const inlinePause = doc.getElementById('toki-inline-pause');
        if (inlinePause) {
            inlinePause.onclick = () => {
                const p = getQueuePaused();
                setQueuePaused(!p);
                EventBus.emit(EVT.UPDATE_PROGRESS);
                if (p) runSchedulerOnce();
            };
        }

        const inlineStop = doc.getElementById('toki-inline-stop');
        if (inlineStop) {
            inlineStop.onclick = () => {
                if (popupWindow.confirm('⚠️ 모든 배치 작업을 중단하시겠습니까?')) {
                    stopAllWorkers(false);
                    EventBus.emit(EVT.UPDATE_PROGRESS);
                }
            };
        }

        const testExtractBtn = doc.getElementById('toki-btn-test-extract');
        if (testExtractBtn) {
            testExtractBtn.onclick = () => {
                if (this.handlers.testExtraction) this.handlers.testExtraction();
            };
        }

        // 4. Settings Tab Events
        const selGasId = doc.getElementById('toki-sel-gas-id');
        const selFolderId = doc.getElementById('toki-sel-folder-id');
        const selApiKey = doc.getElementById('toki-sel-apikey');
        const selPolicy = doc.getElementById('toki-sel-policy');
        const selNameTemplate = doc.getElementById('toki-sel-nametemplate');

        const selSpeed = doc.getElementById('toki-sel-speed');
        const selScanSpeed = doc.getElementById('toki-sel-scanspeed');
        const selNovelFormat = doc.getElementById('toki-sel-novel-format');
        const selNovelTerm = doc.getElementById('toki-sel-novel-mode');
        const selSmartSkip = doc.getElementById('toki-sel-smartskip');
        const selLogLevel = doc.getElementById('toki-sel-loglevel');

        if (this.handlers.getConfig) {
            const cfg = this.handlers.getConfig();
            if (selGasId) selGasId.value = cfg.gasId || '';
            if (selFolderId) selFolderId.value = cfg.folderId || '';
            if (selApiKey) selApiKey.value = cfg.apiKey || '';
            if (selPolicy) {
                selPolicy.value = cfg.policy || 'individual';
                this.updateNativeHelper(doc, selPolicy.value);
            }
            if (selNameTemplate) selNameTemplate.value = cfg.localNameTemplate || '';
            if (selSpeed) selSpeed.value = cfg.sleepMode || 'cautious';
            if (selScanSpeed) {
                selScanSpeed.value = cfg.scanSpeed !== undefined ? String(cfg.scanSpeed) : '1000';
                const valSpan = doc.getElementById('toki-scan-speed-val');
                if (valSpan) valSpan.innerText = `${selScanSpeed.value}ms`;
                
                selScanSpeed.oninput = (e) => {
                    if (valSpan) valSpan.innerText = `${e.target.value}ms`;
                };
            }
            if (selNovelFormat) selNovelFormat.value = cfg.novelFormat || 'epub';
            if (selNovelTerm) selNovelTerm.value = cfg.novelMode || 'perChapter';
            if (selSmartSkip) selSmartSkip.value = cfg.smartSkipRatio !== undefined ? String(cfg.smartSkipRatio) : '50';
            if (selLogLevel) selLogLevel.value = cfg.logLevel || 'info';
            const selMaxWorkersInit = doc.getElementById('toki-sel-max-workers');
            const selMergePartInit = doc.getElementById('toki-sel-merge-part');
            if (selMaxWorkersInit) selMaxWorkersInit.value = String(cfg.maxWorkers || 1);
            if (selMergePartInit) selMergePartInit.value = String(cfg.mergePartSize ?? 10);
        }

        if (selPolicy) {
            selPolicy.onchange = () => {
                if (this.handlers.setConfig) this.handlers.setConfig('TOKI_DOWNLOAD_POLICY', selPolicy.value);
                this.updateNativeHelper(doc, selPolicy.value);
            };
            this.updateNativeHelper(doc, selPolicy.value);
        }

        const testNativeBtn = doc.getElementById('toki-btn-test-native');
        if (testNativeBtn) {
            testNativeBtn.onclick = async () => {
                if (this.handlers.testNativeDownload) {
                    testNativeBtn.disabled = true;
                    testNativeBtn.textContent = '⏳ 테스트 중...';
                    const success = await this.handlers.testNativeDownload();
                    if (success) {
                        testNativeBtn.textContent = '✅ 테스트 성공 (폴더 확인)';
                        testNativeBtn.style.color = '#67c23a';
                    } else {
                        testNativeBtn.textContent = '❌ 테스트 실패 (설정 확인)';
                        testNativeBtn.style.color = '#f56c6c';
                    }
                    setTimeout(() => {
                        testNativeBtn.disabled = false;
                        testNativeBtn.textContent = '📂 자동 분류 기능 테스트';
                        testNativeBtn.style.color = '';
                    }, 3000);
                }
            };
        }

        // 9. Queue List Item & Modal Controls Event Delegation (우주 무결 안전 장치)
        const progressModalOverlay = doc.getElementById('toki-modal-progress');
        if (progressModalOverlay) {
            progressModalOverlay.addEventListener('click', (e) => {
                // 9-1. 개별 삭제 ❌
                const deleteBtn = e.target.closest('.toki-queue-item-delete');
                if (deleteBtn) {
                    const itemId = deleteBtn.getAttribute('data-id');
                    if (popupWindow.confirm('선택한 에피소드를 대기열에서 제거하시겠습니까?')) {
                        removeQueueItem(itemId);
                        runSchedulerOnce();
                        EventBus.emit(EVT.UPDATE_PROGRESS);
                    }
                    return;
                }

                // 9-2. 대기열 전체 비우기 (초기화) 🗑️
                const resetBtn = e.target.closest('#toki-btn-queue-reset');
                if (resetBtn) {
                    if (popupWindow.confirm('🗑️ 대기열의 모든 에피소드를 즉시 완전히 삭제하시겠습니까?\n(진행 중인 작업도 모두 강제 중단됩니다)')) {
                        stopAllWorkers(true);
                        EventBus.emit(EVT.UPDATE_PROGRESS);
                    }
                    return;
                }

                // 9-4. 일시 정지 ⏸️
                const pauseBtn = e.target.closest('#toki-btn-queue-pause');
                if (pauseBtn) {
                    const p = getQueuePaused();
                    setQueuePaused(!p);
                    EventBus.emit(EVT.UPDATE_PROGRESS);
                    if (p) runSchedulerOnce();
                    return;
                }

                // 9-5. 수집 중단 ⏹️
                const stopBtn = e.target.closest('#toki-btn-queue-stop');
                if (stopBtn) {
                    if (popupWindow.confirm('⚠️ 모든 배치 작업을 중단하시겠습니까?')) {
                        stopAllWorkers(false);
                        EventBus.emit(EVT.UPDATE_PROGRESS);
                    }
                    return;
                }

                // 9-6. 크게 보기 ↕️
                const expandBtn = e.target.closest('#toki-btn-queue-expand');
                if (expandBtn) {
                    const isMaximized = progressModalOverlay.classList.toggle('toki-queue-maximized');
                    expandBtn.textContent = isMaximized ? '🔽' : '↕️';
                    expandBtn.title = isMaximized ? '대기열 원래대로 보기' : '대기열 크게 보기';
                    return;
                }
            });
        }

        // 5. History Tab Events
        const syncBtn = doc.getElementById('toki-btn-sync-now');
        if (syncBtn) {
            syncBtn.onclick = async () => {
                if (this.handlers.syncHistory) {
                    syncBtn.disabled = true;
                    syncBtn.innerHTML = '<span>⏳ 동기화 중...</span>';
                    await this.handlers.syncHistory();
                    syncBtn.disabled = false;
                    syncBtn.innerHTML = '<span>🔄 지금 즉시 동기화</span>';
                    
                    const timeEl = doc.getElementById('toki-txt-last-sync');
                    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();
                }
            };
        }

        // 6. Tools Tab Events
        const migrationBtn = doc.getElementById('toki-btn-migration');
        if (migrationBtn) {
            migrationBtn.onclick = () => {
                if (this.handlers.migrateKavita) this.handlers.migrateKavita();
            };
        }

        const thumbBtn = doc.getElementById('toki-btn-thumb-optim');
        if (thumbBtn) {
            thumbBtn.onclick = () => {
                if (this.handlers.migrateThumbnails) this.handlers.migrateThumbnails();
            };
        }

        const formEditorBtn = doc.getElementById('toki-btn-form-editor');
        if (formEditorBtn) {
            formEditorBtn.onclick = () => {
                const editor = new FormRuleEditor();
                editor.show(doc);
            };
        }

        // 7. Dashboard Modal Toggle Events
        const showProgressBtn = doc.getElementById('toki-btn-show-progress');
        const progressModal = doc.getElementById('toki-modal-progress');
        const closeProgressBtn = doc.getElementById('toki-btn-modal-progress-close');
        
        if (showProgressBtn && progressModal) {
            showProgressBtn.onclick = () => {
                progressModal.style.display = 'flex';
            };
        }
        if (closeProgressBtn && progressModal) {
            closeProgressBtn.onclick = () => {
                progressModal.style.display = 'none';
            };
        }
        if (progressModal) {
            progressModal.onclick = (e) => {
                if (e.target === progressModal) {
                    progressModal.style.display = 'none';
                }
            };
        }

        const showLogsBtn = doc.getElementById('toki-btn-show-logs');
        const logsModal = doc.getElementById('toki-modal-logs');
        const closeLogsBtn = doc.getElementById('toki-btn-modal-logs-close');

        if (showLogsBtn && logsModal) {
            showLogsBtn.onclick = () => {
                logsModal.style.display = 'flex';
            };
        }
        if (closeLogsBtn && logsModal) {
            closeLogsBtn.onclick = () => {
                logsModal.style.display = 'none';
            };
        }
        if (logsModal) {
            logsModal.onclick = (e) => {
                if (e.target === logsModal) {
                    logsModal.style.display = 'none';
                }
            };
        }

        // 8. Settings Save Handler (통합 대시보드 전용 저장 연동)
        const saveSettingsBtn = doc.getElementById('toki-btn-save-settings');
        if (saveSettingsBtn) {
            saveSettingsBtn.onclick = () => {
                const newGasId = selGasId ? selGasId.value.trim() : '';
                const newFolder = selFolderId ? selFolderId.value.trim() : '';
                const newApiKey = selApiKey ? selApiKey.value.trim() : '';
                const newPolicy = selPolicy ? selPolicy.value : 'individual';
                const newNameTemplate = selNameTemplate ? selNameTemplate.value.trim() || "{number:4} - {title}" : "{number:4} - {title}";
                const newSleepMode = selSpeed ? selSpeed.value : 'agile';
                const newScanSpeed = selScanSpeed ? selScanSpeed.value : '1000';
                const newNovelFormat = selNovelFormat ? selNovelFormat.value : 'epub';
                const newNovelMode = selNovelTerm ? selNovelTerm.value : 'perChapter';
                const newSmartSkip = selSmartSkip ? selSmartSkip.value : '50';
                const newLogLevel = selLogLevel ? selLogLevel.value : 'info';
                // URL 입력 시 ID 추출 로직 병합
                let finalGasId = newGasId;
                const urlMatch = newGasId.match(/\/s\/([^\/]+)\/exec/);
                if (urlMatch) finalGasId = urlMatch[1];

                if (this.handlers.setConfig) {
                    this.handlers.setConfig('TOKI_GAS_ID', finalGasId);
                    this.handlers.setConfig('TOKI_FOLDER_ID', newFolder);
                    this.handlers.setConfig('TOKI_API_KEY', newApiKey);
                    this.handlers.setConfig('TOKI_DOWNLOAD_POLICY', newPolicy);
                    this.handlers.setConfig('TOKI_LOCAL_NAME_TEMPLATE', newNameTemplate);
                    this.handlers.setConfig('TOKI_SLEEP_MODE', newSleepMode);
                    this.handlers.setConfig('TOKI_SCAN_SPEED', newScanSpeed);
                    this.handlers.setConfig('TOKI_NOVEL_FORMAT', newNovelFormat);
                    this.handlers.setConfig('TOKI_NOVEL_MODE', newNovelMode);
                    this.handlers.setConfig('TOKI_SMART_SKIP_RATIO', newSmartSkip);
                    this.handlers.setConfig('TOKI_LOG_LEVEL', newLogLevel);
                    const selMaxWorkersSave = doc.getElementById('toki-sel-max-workers');
                    const selMergePartSave = doc.getElementById('toki-sel-merge-part');
                    if (selMaxWorkersSave) this.handlers.setConfig('TOKI_MAX_WORKERS', selMaxWorkersSave.value);
                    if (selMergePartSave) this.handlers.setConfig('TOKI_MERGE_PART_SIZE', selMergePartSave.value);
                }

                popupWindow.alert('설정이 저장되었습니다.');
            };
        }

        const hardResetBtn = doc.getElementById('toki-btn-hard-reset-queue');
        if (hardResetBtn) {
            hardResetBtn.onclick = () => {
                if (popupWindow.confirm('🚨 긴급 복원 경고 🚨\n\n대기열을 완전히 강제 초기화하고 돌고 있는 모든 팝업 워커 창을 강제 종료하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
                    try {
                        stopAllWorkers(true);
                        popupWindow.alert('대기열이 성공적으로 강제 초기화되었습니다.');
                        EventBus.emit(EVT.UPDATE_PROGRESS);
                    } catch (e) {
                        popupWindow.alert('초기화 실패: ' + e.message);
                    }
                }
            };
        }

    }

    // ── [v1.27.0] 전체 회차 불러오기 ─────────────────────────────
    bindEpisodeScan(doc) {
        const scanBtn = doc.getElementById('toki-btn-scan-episodes');
        const summary = doc.getElementById('toki-scan-summary');
        const rangeInput = doc.getElementById('toki-range-input');
        const preview = doc.getElementById('toki-range-preview');
        const chips = Array.from(doc.querySelectorAll('[data-quick-range]'));
        const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

        const updatePreview = () => {
            if (!preview || !rangeInput || !this.handlers.previewRange) return;
            const res = this.handlers.previewRange(rangeInput.value.trim());
            if (!res) { preview.textContent = ''; return; }
            if (res.all) preview.textContent = `→ 전체 ${res.total}화를 받습니다.`;
            else if (res.matched === 0) preview.textContent = `→ 일치하는 회차가 없습니다. (불러온 ${res.total}화 기준)`;
            else if (res.matched < res.requested) preview.textContent = `→ 요청 ${res.requested}개 중 ${res.matched}화만 목록에 있습니다.`;
            else preview.textContent = `→ ${res.matched}화를 받습니다.`;
        };
        if (rangeInput) rangeInput.addEventListener('input', updatePreview);

        chips.forEach(chip => {
            chip.onclick = () => {
                const v = chip.getAttribute('data-quick-range');
                if (!rangeInput) return;
                rangeInput.value = v === 'all' ? '' : (this.handlers.getLatestRangeSpec ? this.handlers.getLatestRangeSpec(parseInt(v, 10)) : '');
                updatePreview();
            };
        });

        if (!scanBtn || !this.handlers.scanEpisodes) return;
        scanBtn.onclick = async () => {
            scanBtn.disabled = true;
            scanBtn.innerHTML = '<span>⏳ 불러오는 중...</span>';
            if (summary) summary.textContent = '목록 페이지를 순서대로 불러오는 중입니다...';
            try {
                const res = await this.handlers.scanEpisodes((info) => {
                    if (!summary || !info) return;
                    if (info.phase === 'pages') {
                        summary.textContent = `목록 페이지 불러오는 중... ${info.fetched}/${info.total} 페이지${info.items ? ` (${info.items}화 확인)` : ''}`;
                    } else if (info.phase === 'buttons') {
                        summary.textContent = '페이지 버튼을 눌러 가며 목록을 모으는 중입니다...';
                    }
                });
                if (summary) {
                    const lines = [];
                    lines.push(`총 <b>${res.count}화</b> 감지${res.min !== null ? ` (<b>${res.min}~${res.max}화</b>)` : ''}`);
                    if (res.firstPageCount && res.count > res.firstPageCount) {
                        lines.push(`현재 페이지 ${res.firstPageCount}화 + 다른 페이지 ${res.count - res.firstPageCount}화를 합쳤습니다.`);
                    } else if (res.firstPageCount && res.count === res.firstPageCount && res.min > 1) {
                        lines.push(`<span class="toki-scan-warn">⚠️ 다른 페이지를 찾지 못했습니다. 1화부터 있는 작품이라면 목록이 일부만 수집되었을 수 있습니다.</span>`);
                    }
                    if (res.gaps.length > 0) {
                        const shown = res.gaps.slice(0, 8).map(esc).join(', ');
                        lines.push(`<span class="toki-scan-warn">⚠️ 번호가 비는 구간: ${shown}${res.gaps.length > 8 ? ` 외 ${res.gaps.length - 8}곳` : ''} (휴재·삭제 회차이거나 페이지 수집 실패일 수 있습니다)</span>`);
                    }
                    if (res.noNumberCount > 0) lines.push(`번호를 읽지 못한 항목 ${res.noNumberCount}개(공지·외전 등)는 순서대로 번호가 붙습니다.`);
                    lines.push('10분 안에 다운로드하면 이 목록을 다시 불러오지 않고 그대로 사용합니다.');
                    summary.innerHTML = lines.join('<br>');
                }
                chips.forEach(c => { c.disabled = false; });
                updatePreview();
            } catch (e) {
                if (summary) summary.textContent = `❌ 불러오기 실패: ${e.message}`;
            } finally {
                scanBtn.disabled = false;
                scanBtn.innerHTML = '<span>🔄 전체 회차 다시 불러오기</span>';
            }
        };
    }

    // ── [v1.27.0] 중단된 작업 / 합본 세션 패널 ─────────────────────
    bindWorkPanel(popupWindow) {
        const doc = popupWindow.document;
        const panel = doc.getElementById('toki-work-panel');
        if (!panel) return;

        const render = () => {
            if (popupWindow.closed || !this.handlers.getWorkState) return;
            let state;
            try { state = this.handlers.getWorkState(); } catch (e) { return; }
            const esc = (t) => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
            const cards = [];

            if (state.hasMyActive || state.antiSleep !== 'off') {
                if (state.antiSleep === 'running') {
                    cards.push(`<div class="toki-work-card is-ok">🔊 백그라운드 유지 모드 작동 중</div>`);
                } else if (state.antiSleep === 'blocked') {
                    cards.push(`<div class="toki-work-card is-warn">⚠️ 백그라운드 유지 모드가 꺼져 있습니다. 브라우저가 자동재생을 막았습니다. <b>작품 페이지(원래 탭)를 한 번 클릭</b>하면 다시 시도합니다. 꺼진 상태에서 탭을 오래 숨기면 수집이 느려질 수 있습니다.</div>`);
                }
            }

            if (state.orphanCount > 0) {
                cards.push(`<div class="toki-work-card is-warn">
                    <div class="toki-work-title">⏸️ 중단된 개별 작업 ${state.orphanCount}화</div>
                    <div class="toki-work-meta">${esc(state.orphanTitles.join(', '))} — 작업하던 탭이 닫히거나 새로고침되어 멈춰 있습니다.</div>
                    <div class="toki-work-actions">
                        <button class="toki-chip" data-work-action="resume-orphans">▶️ 이 탭에서 이어받기</button>
                        <button class="toki-chip" data-work-action="discard-orphans">🗑️ 비우기</button>
                    </div>
                </div>`);
            }

            state.sessions.forEach(sess => {
                let statusText = '';
                let cls = '';
                const actions = [];
                if (sess.status === 'saving') {
                    statusText = '💾 합본 파일 만드는 중...';
                } else if (sess.isOrphan) {
                    statusText = '⏸️ 중단됨 (작업하던 탭이 닫힘)';
                    cls = 'is-warn';
                    actions.push(`<button class="toki-chip" data-work-action="resume-session" data-id="${sess.id}">▶️ 이어받기</button>`);
                } else if (sess.isOtherTab) {
                    statusText = '🔄 다른 탭에서 수집 중';
                } else if (sess.status === 'attention') {
                    statusText = sess.stoppedByUser ? '⏹️ 사용자가 중단함' : `⚠️ ${sess.failed}화 실패`;
                    cls = 'is-warn';
                    actions.push(`<button class="toki-chip" data-work-action="resume-session" data-id="${sess.id}">🔁 ${sess.stoppedByUser ? '이어서 받기' : '실패 회차 재시도'}</button>`);
                } else {
                    statusText = `🔄 수집 중 (대기·진행 ${sess.active}화)`;
                }
                if (sess.stored > 0 && sess.status !== 'saving' && !sess.isOtherTab) {
                    actions.push(`<button class="toki-chip" data-work-action="save-session" data-id="${sess.id}">💾 지금 합본 저장${sess.stored < sess.total ? ` (${sess.stored}화만)` : ''}</button>`);
                }
                if (sess.status !== 'saving' && !sess.isOtherTab) {
                    actions.push(`<button class="toki-chip" data-work-action="discard-session" data-id="${sess.id}">🗑️ 폐기</button>`);
                }
                const originNote = (!sess.sameOrigin && sess.kind === 'zipOfFiles')
                    ? '<div class="toki-work-meta">ℹ️ 다른 도메인에서 시작한 작업입니다. 만화 회차 데이터는 도메인별로 보관되어, 이어받으면 이 도메인에서 일부 회차를 다시 받을 수 있습니다.</div>'
                    : '';
                cards.push(`<div class="toki-work-card ${cls}">
                    <div class="toki-work-title">📚 합본: ${esc(sess.title)} <span class="toki-work-meta">(${sess.format})</span></div>
                    <div class="toki-work-meta">${statusText} · 보관 ${sess.stored}/${sess.total}화</div>
                    <div class="toki-work-bar"><div style="width:${sess.percent}%"></div></div>
                    ${originNote}
                    ${actions.length ? `<div class="toki-work-actions">${actions.join('')}</div>` : ''}
                </div>`);
            });

            panel.innerHTML = cards.join('');
            panel.style.display = cards.length ? 'flex' : 'none';
        };

        panel.onclick = async (e) => {
            const btn = e.target.closest('[data-work-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-work-action');
            const id = btn.getAttribute('data-id');
            btn.disabled = true;
            try {
                if (action === 'resume-orphans' && this.handlers.resumeWork) {
                    await this.handlers.resumeWork();
                } else if (action === 'discard-orphans' && this.handlers.discardOrphans) {
                    if (popupWindow.confirm('중단된 개별 작업을 대기열에서 지우시겠습니까?')) this.handlers.discardOrphans();
                } else if (action === 'resume-session' && this.handlers.resumeWork) {
                    await this.handlers.resumeWork(id);
                } else if (action === 'save-session' && this.handlers.saveMergeNow) {
                    if (popupWindow.confirm('지금까지 보관된 회차만으로 합본 파일을 저장하시겠습니까?\n(빠진 회차는 별도 리포트로 저장되며, 저장 후 이 합본 작업은 정리됩니다)')) {
                        await this.handlers.saveMergeNow(id);
                    }
                } else if (action === 'discard-session' && this.handlers.discardMerge) {
                    if (popupWindow.confirm('이 합본 작업과 보관된 회차 데이터를 모두 삭제하시겠습니까?')) await this.handlers.discardMerge(id);
                }
            } catch (err) {
                popupWindow.alert('작업 실패: ' + err.message);
            } finally {
                render();
            }
        };

        if (this._workPanelUnsub) this._workPanelUnsub();
        let pending = null;
        this._workPanelUnsub = EventBus.on(EVT.UPDATE_PROGRESS, () => {
            if (pending) return;
            pending = setTimeout(() => { pending = null; render(); }, 300);
        });
        render();
    }

    show() {
        EventBus.emit(EVT.OPEN_DASHBOARD);
    }

    close() {
        EventBus.emit(EVT.CLOSE_DASHBOARD);
    }

    toggle() {
        EventBus.emit(EVT.TOGGLE_DASHBOARD);
    }

    updateNativeHelper(doc, policy) {
        const helper = doc.getElementById('toki-native-helper');
        if (helper) {
            if (policy === 'native') {
                helper.classList.remove('toki-hidden');
            } else {
                helper.classList.add('toki-hidden');
            }
        }
    }

    static getInstance() {
        if (!MenuModal.instance) {
            new MenuModal();
        }
        return MenuModal.instance;
    }
}
