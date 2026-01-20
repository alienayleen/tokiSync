
import { initConfig, migrateConfig, toggleDebug, CFG_DEBUG_KEY } from './config.js';
import { initNetwork } from './network.js';
import { initUI, initStatusUI, openDashboard, openSettings, injectDownloadButtons } from './ui.js';
import { getSeriesInfo } from './parser.js';
import { initDownloader, tokiDownload, addTasksToQueue } from './downloader.js';
import { initQueue } from './queue.js';
import { CLIENT_VERSION } from './config.js';
import { bus, EVENTS } from './events.js';
import { setState } from './state.js';

// Entry Point
function main(GM) {
    'use strict';
    
    // 0. Init Modules
    initConfig(GM);
    initNetwork(GM);
    initUI(GM);
    initDownloader(GM);
    initQueue(GM);

    console.log(`🚀 TokiSync ${CLIENT_VERSION} Loaded (Modular Single Script)`);

    // 1. Migration
    migrateConfig();

    // 2. Site Detection
    const currentURL = document.URL;
    let site = 'Unknown';
    let detectedCategory = 'Webtoon';
    let workId = '00000';

    if (currentURL.match(/booktoki/)) { site = "북토끼"; detectedCategory = "Novel"; }
    else if (currentURL.match(/newtoki/)) { site = "뉴토끼"; detectedCategory = "Webtoon"; }
    else if (currentURL.match(/manatoki/)) { site = "마나토끼"; detectedCategory = "Manga"; }

    // Try to extract Work/Series ID
    const idMatch = currentURL.match(/\/(?:webtoon|comic|novel)\/([0-9]+)/);
    if (idMatch) workId = idMatch[1];
    
    // Parse Full Series Info
    const parsedSeries = getSeriesInfo(workId, detectedCategory);

    // Merge info
    const siteInfo = { 
        site, 
        workId, 
        detectedCategory,
        ...parsedSeries 
    };

    // [New] Save Info to Central State
    setState({ siteInfo, gmContext: GM });

    if(site !== 'Unknown') {
        console.log(`[TokiSync] Info: ${siteInfo.cleanTitle} (ID: ${siteInfo.workId})`);
    }

    // 3. Define Managers (Glue Logic) & Event Wiring
    
    // [New] Event Wiring
    bus.on(EVENTS.CMD_ENQUEUE_TASK, (data) => {
        // data: { tasks: [{task, li}], siteInfo }
        addTasksToQueue(data.tasks, data.siteInfo);
    });

    const autoSyncDownloadManager = () => {
        if(confirm(`[${siteInfo.site}] 전체 다운로드를 시작하시겠습니까?\n(이미 다운로드된 항목은 건너뛰거나 덮어쓸 수 있습니다)`)) {
            tokiDownload(null, null, null, siteInfo);
        }
    };

    const batchDownloadManager = () => {
        const input = prompt("다운로드할 범위를 입력하세요 (예: 1-10 또는 5,7,9):");
        if (!input) return;
        
        if (input.includes('-')) {
            const [start, end] = input.split('-').map(Number);
            tokiDownload(start, end, null, siteInfo);
        } else if (input.includes(',')) {
            const targets = input.split(',').map(Number);
            tokiDownload(null, null, targets, siteInfo);
        } else {
            const num = parseInt(input);
            if(num) tokiDownload(null, null, [num], siteInfo);
        }
    };

    const manualDownloadManager = () => {
        const url = prompt("다운로드할 에피소드 URL을 입력하세요:");
        if (url) {
            import('./downloader.js').then(m => m.tokiDownloadSingle({
                url, title: "Manual Download", id: "manual", category: siteInfo.detectedCategory, site: siteInfo.site
            }));
        }
    };

    // 4. Register Menus (Directly)
    if (GM.GM_registerMenuCommand) {
        GM.GM_registerMenuCommand('☁️ 자동 동기화', autoSyncDownloadManager);
        GM.GM_registerMenuCommand('📊 서재 열기', openDashboard);
        GM.GM_registerMenuCommand('🔢 범위 다운로드', batchDownloadManager);
        GM.GM_registerMenuCommand('⚙️ 설정 (URL/FolderID)', openSettings);
        GM.GM_registerMenuCommand('🐞 디버그 모드', toggleDebug);

        if (GM.GM_getValue(CFG_DEBUG_KEY, false)) {
            GM.GM_registerMenuCommand('🧪 1회성 다운로드', manualDownloadManager);
        }
    }

    // 5. Auto Start Logic
    initStatusUI();
    
    // Check Content
    if (site !== 'Unknown') {
         console.log(`[TokiSync] Site detected: ${site}. Checking for list...`);
         injectDownloadButtons(siteInfo);
    }

    // Check if I am a Dedicated Worker (Popup)
    if (window.name === 'TOKI_WORKER' || window.location.hash === '#toki_worker') {
        import(/* webpackMode: "eager" */ './worker.js').then(module => {
            module.initWorker(GM);
            module.startWorker(true); // Dedicated mode
            setState({ workerMode: 'dedicated' });
        });
    } else if (site !== 'Unknown') {
        // [New] Start Shared/Background Worker on Main Page to process Queue
        import(/* webpackMode: "eager" */ './worker.js').then(module => {
            module.initWorker(GM);
            module.startWorker(false); // Non-dedicated mode
            setState({ workerMode: 'shared' });
        });
    }
}

export default main;
