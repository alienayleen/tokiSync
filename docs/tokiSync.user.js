// ==UserScript==
// @name         TokiSync (Link to Drive)
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Toki series sites -> Google Drive syncing tool (Bundled)
// @author       pray4skylark
// @match        https://*.com/webtoon/*
// @match        https://*.com/novel/*
// @match        https://*.net/comic/*
// @match        https://script.google.com/*
// @match        https://*.github.io/tokiSync/*
// @match        https://pray4skylark.github.io/tokiSync/*
// @match        http://127.0.0.1:5500/*
// @match        http://localhost:*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      127.0.0.1
// @connect      localhost
// @connect      *
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip-utils/0.1.0/jszip-utils.js
// @run-at       document-end
// @license      MIT
// ==/UserScript==

/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 126
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   V: () => (/* binding */ parseListItem),
/* harmony export */   Y: () => (/* binding */ getSeriesInfo)
/* harmony export */ });
function getSeriesInfo(workId, detectedCategory) {
    const metaSubject = document.querySelector('meta[name="subject"]');
    const pageDesc = document.querySelector('.page-desc');
    const metaTitle = document.querySelector('meta[property="og:title"]');

    let fullTitle = "Unknown";
    if (metaSubject) fullTitle = metaSubject.content.trim();
    else if (pageDesc) fullTitle = pageDesc.innerText.trim();
    else if (metaTitle) fullTitle = metaTitle.content.split('>')[0].split('|')[0].trim();

    let cleanTitle = fullTitle.replace(/[\\/:*?"<>|]/g, "");
    if (cleanTitle.length > 15) cleanTitle = cleanTitle.substring(0, 15).trim();

    const details = getDetailInfo();
    return { fullTitle, cleanTitle, id: workId, ...details, category: detectedCategory };
}

function getDetailInfo() {
    let author = "", category = "", status = "", thumbnail = "";
    try {
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage) thumbnail = ogImage.content;

        const textNodes = document.body.innerText.split('\n');
        textNodes.forEach(line => {
            if (line.includes("작가 :")) author = line.replace("작가 :", "").trim();
            if (line.includes("분류 :")) category = line.replace("분류 :", "").trim();
            if (line.includes("발행구분 :")) status = line.replace("발행구분 :", "").trim();
        });
    } catch (e) { }
    return { author, category, status, thumbnail };
}

function parseListItem(li, siteInfo) {
    // 1. Extract Number
    const numEl = li.querySelector('.wr-num');
    let numText = "0";
    if (numEl) {
        const numClone = numEl.cloneNode(true);
        Array.from(numClone.querySelectorAll('.toki-down-btn')).forEach(el => el.remove());
        numText = numClone.innerText.trim();
    }

    // 2. Extract Title & URL
    const linkEl = li.querySelector('a');
    let epFullTitle = "Unknown";
    let url = "";
    if (linkEl) {
        url = linkEl.href;
        const linkClone = linkEl.cloneNode(true);
        Array.from(linkClone.querySelectorAll('.toki-down-btn, span, div')).forEach(el => el.remove());
        epFullTitle = linkClone.innerText.trim();
    }

    // Construct Task Object
    // siteInfo must contain { id, cleanTitle, site, detectedCategory }
    const folderName = `[${siteInfo.id}] ${siteInfo.cleanTitle}`;

    return {
        id: `${siteInfo.site}_${siteInfo.id}_${numText}`,
        title: epFullTitle,
        url: url,
        site: siteInfo.site,
        category: siteInfo.detectedCategory,
        folderName: folderName,
        seriesTitle: siteInfo.cleanTitle,
        wrNum: numText
    };
}


/***/ },

/***/ 292
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   j: () => (/* binding */ bus),
/* harmony export */   q: () => (/* binding */ EVENTS)
/* harmony export */ });
class EventBus {
    constructor() {
        this.listeners = {};
    }

    on(event, fn) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(fn);
    }

    off(event, fn) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }

    emit(event, data) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(fn => {
            try {
                fn(data);
            } catch (e) {
                console.error(`[EventBus] Error in listener for ${event}:`, e);
            }
        });
    }
}

const bus = new EventBus();

// Core Events
const EVENTS = {
    // Commands (Request Action)
    CMD_ENQUEUE_TASK: 'CMD_ENQUEUE_TASK',
    CMD_START_BATCH: 'CMD_START_BATCH',
    
    // Status Updates (Notification)
    UI_UPDATE_STATUS: 'UI_UPDATE_STATUS',
    TASK_COMPLETE: 'TASK_COMPLETE', // Replaces custom window event
};


/***/ },

/***/ 302
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   C$: () => (/* binding */ initQueue),
/* harmony export */   Rt: () => (/* binding */ completeTask),
/* harmony export */   UT: () => (/* binding */ enqueueTask),
/* harmony export */   wv: () => (/* binding */ getMyStats),
/* harmony export */   zq: () => (/* binding */ claimNextTask)
/* harmony export */ });
/* unused harmony exports getQueue, setQueue, releaseTask */
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(569);



let GM = null;
const QUEUE_KEY = "TOKI_QUEUE";
const LOCK_KEY = "TOKI_WORKER_LOCK"; // Task-level lock is managed inside queue items, this is for "Highlander" check if needed

function initQueue(gmContext) {
    GM = gmContext;
}

function getQueue() {
    return GM.getValue(QUEUE_KEY, []);
}

function setQueue(q) {
    GM.setValue(QUEUE_KEY, q);
}

function enqueueTask(task) {
    // task: { id, title, url, site }
    const q = getQueue();
    const existing = q.find(t => t.id === task.id);
    if (existing) {
        // If task is stuck in 'working' or failed, allow retry
        if (existing.status !== 'pending') {
            (0,_logger_js__WEBPACK_IMPORTED_MODULE_0__/* .log */ .Rm)(`🔄 Re-queueing stuck/completed task: ${task.title}`);
            existing.status = 'pending';
            existing.workerId = null;
            existing.updatedAt = Date.now();
            setQueue(q);
            return true;
        }
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_0__/* .log */ .Rm)(`Duplicate task ignored (Already Pending): ${task.title}`);
        return false;
    }
    const queueItem = {
        ...task,
        status: 'pending', // pending, working, completed, failed
        addedAt: Date.now(),
        workerId: null,
        updatedAt: Date.now()
    };
    q.push(queueItem);
    setQueue(q);
    (0,_logger_js__WEBPACK_IMPORTED_MODULE_0__/* .log */ .Rm)(`Enqueue: ${task.title}`);
    return true;
}

function claimNextTask(workerId) {
    const q = getQueue();
    // 1. Clean up stale tasks (working > 10 mins)
    const now = Date.now();
    let dirty = false;
    q.forEach(t => {
        if (t.status === 'working' && (now - t.updatedAt > 10 * 60 * 1000)) {
             (0,_logger_js__WEBPACK_IMPORTED_MODULE_0__/* .log */ .Rm)(`Hitman: Resetting stale task ${t.title}`);
             t.status = 'pending';
             t.workerId = null;
             dirty = true;
        }
    });

    // 2. Global Concurrency Check
    // If ANY task is currently working, we must wait.
    // This enforces 1 global download at a time across all tabs.
    const isAnyWorking = q.some(t => t.status === 'working');
    if (isAnyWorking) {
        return null; // Busy
    }

    // 3. Find pending
    const candidate = q.find(t => t.status === 'pending');
    if (candidate) {
        candidate.status = 'working';
        candidate.workerId = workerId;
        candidate.updatedAt = now;
        setQueue(q); // Save lock
        return candidate;
    }
    
    if (dirty) setQueue(q);
    return null;
}

function completeTask(taskId) {
    let q = getQueue();
    // Remove completed task
    const initialLen = q.length;
    q = q.filter(t => t.id !== taskId);
    if (q.length !== initialLen) {
        setQueue(q);
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_0__/* .log */ .Rm)(`Task Completed & Removed: ${taskId}`);
        window.dispatchEvent(new CustomEvent('toki-task-complete', { detail: { id: taskId } }));
        return true;
    }
    return false;
}

function releaseTask(taskId) {
    const q = getQueue();
    const task = q.find(t => t.id === taskId);
    if (task) {
        task.status = 'pending';
        task.workerId = null;
        task.updatedAt = Date.now();
        setQueue(q);
        log(`Task Released (Retry): ${taskId}`);
    }
}

function getMyStats(workerId) {
    // For Dashboard UI
    const q = getQueue();
    const pending = q.filter(t => t.status === 'pending').length;
    const working = q.filter(t => t.status === 'working').length;
    const myTask = q.find(t => t.workerId === workerId && t.status === 'working');
    return { pending, working, total: q.length, myTask };
}


/***/ },

/***/ 391
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Gd: () => (/* binding */ saveInfoJson),
/* harmony export */   al: () => (/* binding */ fetchHistoryFromCloud),
/* harmony export */   t9: () => (/* binding */ initNetwork),
/* harmony export */   y4: () => (/* binding */ uploadResumable)
/* harmony export */ });
/* unused harmony export arrayBufferToBase64 */
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(899);
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(569);




// GM context injected via init
let GM = null; 
let JSZip = null;

function initNetwork(gmContext) {
    GM = gmContext;
    JSZip = gmContext.JSZip;
}

function checkAuthRequired(responseText) {
    if (responseText && responseText.trim().startsWith("<") && (responseText.includes("google.com") || responseText.includes("Google Accounts"))) {
        alert("⚠️ 구글 권한 승인이 필요합니다.\n확인을 누르면 새 창이 열립니다.\n권한을 승인(로그인 -> 허용)한 뒤, 다시 시도해주세요.");
        window.open((0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)().url, '_blank');
        return true;
    }
    return false;
}

    function fetchHistoryFromCloud(seriesInfo) {
    return new Promise((resolve, reject) => {
        const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
        if (!config.url || !config.folderId) { resolve([]); return; }
        
        const payload = { 
            folderId: config.folderId, 
            type: 'check_history', 
            protocolVersion: 3, 
            clientVersion: _config_js__WEBPACK_IMPORTED_MODULE_0__/* .CLIENT_VERSION */ .fZ, 
            category: seriesInfo.category,
            folderName: `[${seriesInfo.id}] ${seriesInfo.cleanTitle}` 
        };
        
        GM.xmlhttpRequest({
            method: "POST", url: config.url, data: JSON.stringify(payload), headers: { "Content-Type": "text/plain" },
            onload: (res) => {
                if (res.status === 200) {
                    if (checkAuthRequired(res.responseText)) { resolve([]); return; }
                    try {
                        const json = JSON.parse(res.responseText);
                        let cloudHistory = Array.isArray(json.body) ? json.body : [];
                        
                        // Filter System Files
                        const ignoreList = ['cover.jpg', 'info.json', 'checklist.json', 'temp', '.DS_Store'];
                        const originalCount = cloudHistory.length;
                        
                        cloudHistory = cloudHistory.filter(item => {
                            const name = (typeof item === 'string') ? item : (item.name || "");
                            return !ignoreList.some(ignore => name.toLowerCase().includes(ignore));
                        });

                        if (originalCount !== cloudHistory.length) {
                             console.log(`[TokiSync] History Filtered: ${originalCount} -> ${cloudHistory.length} (Removed system files)`);
                        }
                        // Debug Log
                        console.log(`[TokiSync] Cloud Files:`, cloudHistory);

                        resolve(cloudHistory);
                    } catch (e) { console.error(e); resolve([]); }
                } else resolve([]);
            },
            onerror: () => resolve([])
        });
    });
}

async function saveInfoJson(seriesInfo, fileCount, lastEpisode, forceThumbnailUpdate = false) {
    return new Promise(async (resolve) => {
        const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
        if (!config.url) { resolve(); return; }

        const payload = {
            folderId: config.folderId, 
            type: 'save_info', 
            protocolVersion: 3,
            clientVersion: _config_js__WEBPACK_IMPORTED_MODULE_0__/* .CLIENT_VERSION */ .fZ, 
            folderName: `[${seriesInfo.id}] ${seriesInfo.cleanTitle}`,
            id: seriesInfo.id, title: seriesInfo.fullTitle, url: document.URL, site: seriesInfo.site,
            author: seriesInfo.author, category: seriesInfo.category, status: seriesInfo.status, 
            thumbnail: seriesInfo.thumbnail, 
            thumbnail_file: true, 
            last_episode: lastEpisode,
            file_count: fileCount
        };
        
        GM.xmlhttpRequest({
            method: "POST", url: config.url, data: JSON.stringify(payload), headers: { "Content-Type": "text/plain" },
            onload: async (res) => {
                if (!checkAuthRequired(res.responseText)) {
                    if (forceThumbnailUpdate && seriesInfo.thumbnail) {
                        await ensureCoverUpload(seriesInfo.thumbnail, `[${seriesInfo.id}] ${seriesInfo.cleanTitle}`, seriesInfo.category);
                    }
                    resolve();
                }
                else resolve(); 
            },
            onerror: () => resolve()
        });
    });
}

async function ensureCoverUpload(thumbnailUrl, folderName, category) {
    if (!thumbnailUrl.startsWith('http')) return;
    try {
        const blob = await new Promise((resolve) => {
            GM.xmlhttpRequest({
                method: "GET", url: thumbnailUrl, responseType: "blob", headers: { "Referer": document.URL },
                onload: (res) => resolve(res.status === 200 ? res.response : null),
                onerror: () => resolve(null)
            });
        });
        
        if (blob) {
            await uploadResumable(blob, folderName, "cover.jpg", category); 
        }
    } catch(e) { console.warn("Cover Upload Failed", e); }
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

const CHUNK_SIZE = 20 * 1024 * 1024;

async function uploadResumable(blob, folderName, fileName, category, onProgress) {
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
    if (!config.url) throw new Error("URL 미설정");
    const totalSize = blob.size;
    let uploadUrl = "";
    
    // Init
    await new Promise((resolve, reject) => {
        GM.xmlhttpRequest({
            method: "POST", url: config.url,
            data: JSON.stringify({ 
                folderId: config.folderId, 
                type: "init", 
                protocolVersion: 3, 
                clientVersion: _config_js__WEBPACK_IMPORTED_MODULE_0__/* .CLIENT_VERSION */ .fZ, 
                folderName: folderName, 
                fileName: fileName,
                category: category
            }),
            headers: { "Content-Type": "text/plain" },
            onload: (res) => {
                if (checkAuthRequired(res.responseText)) { reject(new Error("권한 승인 필요")); return; }
                try {
                    const json = JSON.parse(res.responseText);
                    if (json.status === 'success') { 
                        if (typeof json.body === 'object') { uploadUrl = json.body.uploadUrl; } 
                        else { uploadUrl = json.body; }
                        resolve(); 
                    }
                    else reject(new Error(json.body));
                } catch (e) { reject(new Error("GAS 응답 오류")); }
            },
            onerror: (e) => reject(e)
        });
    });

    // Chunk Upload
    let start = 0;
    const buffer = await blob.arrayBuffer();
    while (start < totalSize) {
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunkBuffer = buffer.slice(start, end);
        const chunkBase64 = arrayBufferToBase64(chunkBuffer);
        const percentage = Math.floor((end / totalSize) * 100);
        
        if(onProgress) onProgress(percentage);

        await new Promise((resolve, reject) => {
            GM.xmlhttpRequest({
                method: "POST", url: config.url,
                data: JSON.stringify({ 
                    folderId: config.folderId, 
                    type: "upload", 
                    clientVersion: _config_js__WEBPACK_IMPORTED_MODULE_0__/* .CLIENT_VERSION */ .fZ, 
                    uploadUrl: uploadUrl, 
                    chunkData: chunkBase64, 
                    start: start, end: end, total: totalSize 
                }),
                headers: { "Content-Type": "text/plain" },
                onload: (res) => {
                    if (checkAuthRequired(res.responseText)) { reject(new Error("권한 승인 필요")); return; }
                    try { const json = JSON.parse(res.responseText); if (json.status === 'success') resolve(); else reject(new Error(json.body)); } catch (e) { reject(e); }
                },
                onerror: (e) => reject(e)
            });
        });
        start = end;
    }
}


/***/ },

/***/ 414
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   _3: () => (/* binding */ addTasksToQueue),
/* harmony export */   aM: () => (/* binding */ initDownloader),
/* harmony export */   qc: () => (/* binding */ tokiDownload),
/* harmony export */   tokiDownloadSingle: () => (/* binding */ tokiDownloadSingle)
/* harmony export */ });
/* unused harmony export createEpub */
/* harmony import */ var _network_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(391);
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(569);
/* harmony import */ var _parser_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(126);
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(899);
/* harmony import */ var _queue_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(302);
/* harmony import */ var _state_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(892);







let GM = null; 
let JSZip = null;

function initDownloader(gmContext) {
    GM = gmContext;
    JSZip = gmContext.JSZip;
    (0,_state_js__WEBPACK_IMPORTED_MODULE_5__/* .setState */ .wb)({ gmContext }); // Sync to State
}

// Helper: Fetch Blob (using GM)
function fetchBlob(url, listener) {
    return new Promise((resolve) => {
        GM.xmlhttpRequest({
            method: "GET",
            url: url,
            responseType: "arraybuffer", // Use arraybuffer for robustness
            timeout: 20000,
            headers: { "Referer": document.URL },
            onload: (res) => {
                if (res.status === 200) resolve(res.response);
                else resolve(null);
            },
            onprogress: (e) => {
                 // Optional: listener(e.loaded, e.total);
            },
            onerror: () => resolve(null),
            ontimeout: () => resolve(null)
        });
    });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getDynamicWait(base) { return Math.floor(Math.random() * (base * 0.2 + 1)) + base; }

const WAIT_WEBTOON_MS = 3000; 
const WAIT_NOVEL_MS = 8000;   

async function createEpub(zip, title, author, textContent) {
    // Basic EPUB Creation Logic
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
    
    const escapedText = textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const htmlBody = escapedText.split('\n').map(line => `<p>${line}</p>`).join('');
    
    zip.file("OEBPS/Text/chapter.xhtml", `<?xml version="1.0" encoding="utf-8"?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${title}</title></head><body><h1>${title}</h1>${htmlBody}</body></html>`);
    
    const opf = `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf"><dc:title>${title}</dc:title><dc:creator opf:role="aut">${author}</dc:creator><dc:language>ko</dc:language></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="chapter" href="Text/chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="chapter"/></spine></package>`;
    zip.file("OEBPS/content.opf", opf);
    
    const ncx = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd"><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:12345"/></head><docTitle><text>${title}</text></docTitle><navMap><navPoint id="navPoint-1" playOrder="1"><navLabel><text>${title}</text></navLabel><content src="Text/chapter.xhtml"/></navPoint></navMap></ncx>`;
    zip.file("OEBPS/toc.ncx", ncx);
}

// ...

async function addTasksToQueue(taskItems, seriesInfo) {
    if (!taskItems || taskItems.length === 0) return 0;

    // 1. Ensure Series Info is saved (Once per batch/single)
    // This fixes the missing info.json issue for single downloads
    await (0,_network_js__WEBPACK_IMPORTED_MODULE_0__/* .saveInfoJson */ .Gd)(seriesInfo, 0, 0, true); 

    let addedCount = 0;
    taskItems.forEach(({ task, li }) => {
        if((0,_queue_js__WEBPACK_IMPORTED_MODULE_4__/* .enqueueTask */ .UT)(task)) {
            addedCount++;
            if(li) (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .setListItemStatus */ .OF)(li, "⏳ 대기 중", "#fff9c4", "#fbc02d");
        } else {
            if(li) (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .setListItemStatus */ .OF)(li, "⚠️ 중복/대기", "#eeeeee", "#9e9e9e");
        }
    });
    return addedCount;
}

// [Unified Logic] tokiDownload now behaves as a Batch Enqueuer
async function tokiDownload(startIndex, lastIndex, targetNumbers, siteInfo) {
    const { site, workId, detectedCategory } = siteInfo;
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__/* .getConfig */ .zj)();

    try {
        let list = Array.from(document.querySelector('.list-body').querySelectorAll('li')).reverse();
        if (targetNumbers) list = list.filter(li => targetNumbers.includes(parseInt(li.querySelector('.wr-num').innerText)));
        else {
            if (startIndex) { while (list.length > 0 && parseInt(list[0].querySelector('.wr-num').innerText) < startIndex) list.shift(); }
            if (lastIndex) { while (list.length > 0 && parseInt(list.at(-1).querySelector('.wr-num').innerText) > lastIndex) list.pop(); }
        }
        if (list.length === 0) {
            (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)("⚠️ 다운로드할 항목이 없습니다.");
            return;
        }

        // Get Series Info
        const info = (0,_parser_js__WEBPACK_IMPORTED_MODULE_2__/* .getSeriesInfo */ .Y)(workId, detectedCategory);
        
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`🚀 ${list.length}개 항목을 대기열에 추가합니다...`);

        // Prepare Task Items
        const taskItems = list.map(li => {
            const task = (0,_parser_js__WEBPACK_IMPORTED_MODULE_2__/* .parseListItem */ .V)(li, info);
            return { task, li };
        });

        // Add to Queue (Centralized)
        const addedCount = await addTasksToQueue(taskItems, info);
        
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`✅ 총 ${addedCount}개 작업이 대기열에 추가되었습니다. (백그라운드에서 진행됨)`);

    } catch (error) {
        console.error(error);
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`❌ 일괄 추가 실패: ${error.message}`);
    }
}


async function tokiDownloadSingle(task) {
    // Task object is well-formed by parser.js and contains { site, category, ... }
    const { url, title, id, category, folderName, seriesTitle, site } = task; 
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_3__/* .getConfig */ .zj)();
    
    // No redundant site detection here. We trust the task.
    // However, if we need 'site' for logic switches (like image selectors):
    // const effectiveSite = site || '뉴토끼'; // Fallback if missing
    
    // Pass seriesTitle if available for better cleaning
    // If category is missing, derive it from site (fallback)
    const effectiveCategory = category || (site === '북토끼' ? 'Novel' : 'Webtoon');
    
    const info = { id, cleanTitle: title, fullTitle: seriesTitle, category: effectiveCategory };
    const targetFolderName = folderName || `[${id}] ${title}`;

    (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`🚀 작업 시작: ${title}`);

    // Create or Reuse Iframe (Hidden)
    let iframe = document.getElementById('tokiDownloaderIframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'tokiDownloaderIframe';
        iframe.style.cssText = "position:absolute; top:-9999px; left:-9999px; width:600px; height:600px;";
        document.querySelector('.content').prepend(iframe);
    }

    const waitIframeLoad = (u) => new Promise(r => { iframe.src = u; iframe.onload = () => r(); });
    const pauseForCaptcha = (iframe) => {
        return new Promise(resolve => {
            (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)("<strong>🤖 캡차/차단 감지!</strong><br>해결 후 버튼 클릭");
            iframe.style.cssText = "position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:80vw; height:80vh; background:white; z-index:99998;";
            const btn = document.getElementById('tokiResumeButton');
            if (btn) {
                btn.style.display = 'block';
                btn.onclick = () => {
                    iframe.style.cssText = "position:absolute; top:-9999px; left:-9999px; width:600px; height:600px;";
                    btn.style.display = 'none';
                    resolve();
                };
            } else resolve();
        });
    };

    try {
        await waitIframeLoad(url);
        
        // Dynamic Wait based on Category
        const delayBase = (site === "북토끼" || category === "Novel") ? WAIT_NOVEL_MS : WAIT_WEBTOON_MS;
        await sleep(getDynamicWait(delayBase));

        let iframeDocument = iframe.contentWindow.document;

        // Captcha / Cloudflare / Error Checks
        const checkObstacles = async () => {
             const isCaptcha = iframeDocument.querySelector('iframe[src*="hcaptcha"]') || iframeDocument.querySelector('.g-recaptcha') || iframeDocument.querySelector('#kcaptcha_image');
             const isCloudflare = iframeDocument.title.includes('Just a moment') || iframeDocument.getElementById('cf-challenge-running');
             const noContent = (site === "북토끼") ? !iframeDocument.querySelector('#novel_content') : false;
             const pageTitle = iframeDocument.title.toLowerCase();
             const bodyText = iframeDocument.body ? iframeDocument.body.innerText.toLowerCase() : "";
             const isError = pageTitle.includes("403") || pageTitle.includes("forbidden") || bodyText.includes("access denied");

             if (isCaptcha || isCloudflare || noContent || isError) {
                 await pauseForCaptcha(iframe);
                 await sleep(3000);
                 iframeDocument = iframe.contentWindow.document; // Refresh ref
                 return true; // Retried
             }
             return false;
        };
        await checkObstacles();

        // [Logic] Novel vs Images
        const zip = new JSZip();
        let zipFileName = `${(task.wrNum || "0000").toString().padStart(4,'0')} - ${title.replace(/[\\/:*?"<>|]/g, '')}`;
        let finalFileName = "";

        if (site === '북토끼' || category === 'Novel') {
            const contentEl = iframeDocument.querySelector('#novel_content');
            if (!contentEl) throw new Error("Novel Content Not Found");
            const textContent = contentEl.innerText;
            
            await createEpub(zip, title, "Unknown", textContent);
            finalFileName = `${zipFileName}.epub`;

        } else {
            // Image Logic
            let imgLists = Array.from(iframeDocument.querySelectorAll('.view-padding div img'));
            // Visibility Filter
            for (let j = 0; j < imgLists.length;) { 
                if (imgLists[j].checkVisibility() === false) imgLists.splice(j, 1); 
                else j++; 
            }

            if (imgLists.length === 0) {
                 // Retry once
                 await sleep(2000);
                 imgLists = Array.from(iframeDocument.querySelectorAll('.view-padding div img'));
                 // Re-filter
                 for (let j = 0; j < imgLists.length;) { 
                    if (imgLists[j].checkVisibility() === false) imgLists.splice(j, 1); 
                    else j++; 
                }
                 if (imgLists.length === 0) throw new Error("이미지 0개 발견 (Skip)");
            }

            (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`[${targetFolderName}]<br><strong>${title}</strong><br>이미지 ${imgLists.length}장 수집 중...`);

            // Download Images
            let downloaded = 0;
            // Parallel Download (Batch of 3)
            let p = 0;
            while(p < imgLists.length) {
                const batch = imgLists.slice(p, p+3); 
                await Promise.all(batch.map(async (img, idx) => {
                     const src = img.getAttribute('data-original') || img.src;
                     if(!src) return;
                     
                     // Retry 3 times
                     let blob = null;
                     for(let r=0; r<3; r++) {
                         blob = await fetchBlob(src);
                         if(blob) break;
                         await sleep(1000);
                     }

                     if (blob) {
                         const ext = src.match(/\.(jpg|jpeg|png|webp|gif)/i)?.[1] || 'jpg';
                         zip.file(`${String(p + idx + 1).padStart(3, '0')}.${ext}`, blob);
                         downloaded++;
                     } else {
                         console.warn(`[Image Fail] ${src}`);
                     }
                }));
                p += 3;
            }

            if (downloaded === 0) throw new Error("All images failed to download");
            
            finalFileName = `${zipFileName}.cbz`;
        }

        // Upload Logic
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`📦 압축 & 업로드 준비...`);
        const zipBlob = await zip.generateAsync({type:"blob"});
        
        await (0,_network_js__WEBPACK_IMPORTED_MODULE_0__/* .uploadResumable */ .y4)(zipBlob, targetFolderName, finalFileName, category, (pct) => {
             (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .updateStatus */ .yB)(`☁️ 업로드: ${pct}%`);
        });

        // Cleanup
        iframe.remove();
        return true;

    } catch (e) {
        console.error(`[Download Error] ${title}:`, e);
        if(iframe) iframe.remove();
        throw e;
    }
}


/***/ },

/***/ 569
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OF: () => (/* binding */ setListItemStatus),
/* harmony export */   Rm: () => (/* binding */ log),
/* harmony export */   yB: () => (/* binding */ updateStatus)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(899);
/* harmony import */ var _events_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(292);



function log(msg, type = 'info') {
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
    if (config.debug || type === 'error') {
        console.log(`[TokiSync][${type.toUpperCase()}] ${msg}`);
    }
}

function updateStatus(msg) {
    // [Changed] Emit event instead of direct DOM manipulation
    _events_js__WEBPACK_IMPORTED_MODULE_1__/* .bus */ .j.emit(_events_js__WEBPACK_IMPORTED_MODULE_1__/* .EVENTS */ .q.UI_UPDATE_STATUS, msg);
    
    // Check for "Resume Button" trigger logic inside msg?
    // The previous logic for resume button was inside downloader's UI manipulation or logger?
    // Actually the resume button check was inside tokiDownloaderSingle's pause logic, 
    // but ui.js's renderStatus creates the button hidden.
    
    // Strip HTML tags for console log
    log(msg.replace(/<[^>]*>/g, ''));
}

function setListItemStatus(li, message, bgColor = '#fff9c4', textColor = '#d32f2f') {
    if (!li) return;
    if (!li.classList.contains('toki-downloaded')) li.style.backgroundColor = bgColor;
    const link = li.querySelector('a');
    if (!link) return;
    let s = link.querySelector('.toki-status-msg');
    if (!s) {
        s = document.createElement('span');
        s.className = 'toki-status-msg';
        s.style.fontSize = '12px'; s.style.fontWeight = 'bold'; s.style.marginLeft = '10px';
        link.appendChild(s);
    }
    s.innerText = message; s.style.color = textColor;
}


/***/ },

/***/ 835
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initWorker: () => (/* binding */ initWorker),
/* harmony export */   startWorker: () => (/* binding */ startWorker)
/* harmony export */ });
/* unused harmony export isWorkerAlive */
/* harmony import */ var _queue_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(302);
/* harmony import */ var _downloader_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(414);
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(569);
/* harmony import */ var _ui_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(963);





let GM = null;
let isWorkerRunning = false;
const WORKER_ID = `worker_${Date.now()}`;

// Heartbeat Logic
const HEARTBEAT_KEY = "TOKI_WORKER_HEARTBEAT";

function initWorker(gmContext) {
    GM = gmContext;
}

function updateHeartbeat() {
    if(GM) GM.setValue(HEARTBEAT_KEY, Date.now());
}

async function isWorkerAlive() {
    if(!GM) return false;
    const lastBeat = await GM.getValue(HEARTBEAT_KEY, 0);
    return (Date.now() - lastBeat) < 5000; // Alive if beat within 5 sec
}

async function startWorker(isDedicated = false) {
    if (isWorkerRunning) return;
    isWorkerRunning = true;

    (0,_logger_js__WEBPACK_IMPORTED_MODULE_2__/* .log */ .Rm)(`👷 Worker Started (ID: ${WORKER_ID}, Dedicated: ${isDedicated})`);
    if (isDedicated) (0,_ui_js__WEBPACK_IMPORTED_MODULE_3__/* .injectDashboard */ .cj)(); // Disguise only if dedicated worker window

    while (true) {
        try {
            updateHeartbeat();
            updateDashboardStats(); // Update UI
            
            const task = (0,_queue_js__WEBPACK_IMPORTED_MODULE_0__/* .claimNextTask */ .zq)(WORKER_ID);
            if (task) {
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_2__/* .updateStatus */ .yB)(`🔨 작업 중: ${task.title}`);
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_2__/* .log */ .Rm)(`Processing task: ${task.title}`);
                await (0,_downloader_js__WEBPACK_IMPORTED_MODULE_1__.tokiDownloadSingle)(task);
                (0,_queue_js__WEBPACK_IMPORTED_MODULE_0__/* .completeTask */ .Rt)(task.id);
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_2__/* .updateStatus */ .yB)(`✅ 완료: ${task.title}`);
            } else {
                (0,_logger_js__WEBPACK_IMPORTED_MODULE_2__/* .updateStatus */ .yB)("💤 대기 중... (큐 비어있음)");
                await sleep(2000); // Faster polling for responsiveness
            }
        } catch (e) {
             // ...
             await sleep(5000);
        }
    }
}

function updateDashboardStats() {
    const stats = (0,_queue_js__WEBPACK_IMPORTED_MODULE_0__/* .getMyStats */ .wv)(WORKER_ID);
    // UI Update Logic (Hooks into ui.js)
    // For now, implicit update via status text
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }


/***/ },

/***/ 892
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   wb: () => (/* binding */ setState)
/* harmony export */ });
/* unused harmony exports getState, getSiteInfo, getGM */
let state = {
    siteInfo: null, // { site, workId, detectedCategory, fullTitle, ... }
    gmContext: null,
    workerMode: 'idle', // idle, shared, dedicated
};

const getState = () => state;

const setState = (newState) => {
    state = { ...state, ...newState };
};

// Shortcuts
const getSiteInfo = () => state.siteInfo;
const getGM = () => state.gmContext;


/***/ },

/***/ 899
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   C5: () => (/* binding */ CFG_DASH_KEY),
/* harmony export */   CY: () => (/* binding */ migrateConfig),
/* harmony export */   Up: () => (/* binding */ toggleDebug),
/* harmony export */   V$: () => (/* binding */ CFG_URL_KEY),
/* harmony export */   ZE: () => (/* binding */ CFG_DEBUG_KEY),
/* harmony export */   fZ: () => (/* binding */ CLIENT_VERSION),
/* harmony export */   mt: () => (/* binding */ CFG_FOLDER_ID),
/* harmony export */   pw: () => (/* binding */ initConfig),
/* harmony export */   ql: () => (/* binding */ saveConfig),
/* harmony export */   zj: () => (/* binding */ getConfig)
/* harmony export */ });
/* unused harmony exports SCRIPT_NAME, MIN_LOADER_VERSION, PROTOCOL_VERSION, CFG_AUTO_SYNC_KEY, CFG_CONFIG_VER */
const SCRIPT_NAME = "TokiSync Core";
const CLIENT_VERSION = "v1.1.3"; // Imp: Version Check & Whitelist
const MIN_LOADER_VERSION = "v1.1.3";
const PROTOCOL_VERSION = 3;

// Config Keys
const CFG_URL_KEY = "TOKI_GAS_URL";
const CFG_DASH_KEY = "TOKI_DASH_URL";
const CFG_FOLDER_ID = "TOKI_FOLDER_ID";
const CFG_DEBUG_KEY = "TOKI_DEBUG_MODE";
const CFG_AUTO_SYNC_KEY = "TOKI_AUTO_SYNC";
const CFG_CONFIG_VER = "TOKI_CONFIG_VER";
const CURRENT_CONFIG_VER = 1;

const DEFAULT_API_URL = ""; 
const DEFAULT_DASH_URL = "https://pray4skylark.github.io/tokiSync/";

// GM Context (Injected via init)
let GM = null;

function initConfig(gmContext) {
    GM = gmContext;
}

function getConfig() {
    if (!GM) throw new Error("Config not initialized with GM context");
    return {
        url: GM.getValue(CFG_URL_KEY, DEFAULT_API_URL),
        dashUrl: GM.getValue(CFG_DASH_KEY, DEFAULT_DASH_URL),
        folderId: GM.getValue(CFG_FOLDER_ID, ""),
        debug: GM.getValue(CFG_DEBUG_KEY, false)
    };
}

function migrateConfig() {
    const savedVer = GM.getValue(CFG_CONFIG_VER, 0);
    if (savedVer < CURRENT_CONFIG_VER) {
        console.log(`♻️ Migrating config from v${savedVer} to v${CURRENT_CONFIG_VER}`);
        GM.deleteValue(CFG_URL_KEY);
        GM.deleteValue(CFG_FOLDER_ID);
        GM.setValue(CFG_CONFIG_VER, CURRENT_CONFIG_VER);
        alert(`TokiSync ${CLIENT_VERSION} 업데이트: 설정을 초기화했습니다.\n새로운 서버 연결을 위해 설정을 다시 진행해주세요.`);
        location.reload();
    }
}

function saveConfig(key, value) {
    GM.setValue(key, value);
}

function toggleDebug() {
    const current = GM.getValue(CFG_DEBUG_KEY, false);
    const next = !current;
    GM.setValue(CFG_DEBUG_KEY, next);
    return next;
}


/***/ },

/***/ 963
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Dr: () => (/* binding */ injectDownloadButtons),
/* harmony export */   Nb: () => (/* binding */ openDashboard),
/* harmony export */   Ow: () => (/* binding */ openSettings),
/* harmony export */   Vt: () => (/* binding */ initStatusUI),
/* harmony export */   cj: () => (/* binding */ injectDashboard),
/* harmony export */   xY: () => (/* binding */ initUI)
/* harmony export */ });
/* unused harmony export updateStatusUI */
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(899);
/* harmony import */ var _logger_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(569);
/* harmony import */ var _parser_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(126);
/* harmony import */ var _network_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(391);
/* harmony import */ var _events_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(292);






let GM = null;
function initUI(gmContext) {
    GM = gmContext;
    // Register Event Listeners
    _events_js__WEBPACK_IMPORTED_MODULE_4__/* .bus */ .j.on(_events_js__WEBPACK_IMPORTED_MODULE_4__/* .EVENTS */ .q.UI_UPDATE_STATUS, (msg) => updateStatusUI(msg));
    
    // Listen for task completion to update button
    _events_js__WEBPACK_IMPORTED_MODULE_4__/* .bus */ .j.on(_events_js__WEBPACK_IMPORTED_MODULE_4__/* .EVENTS */ .q.TASK_COMPLETE, (taskId) => {
        // ... (Existing logic for button update)
        // Extract wrNum from taskId
        const parts = taskId.split('_');
        const targetNum = parts[parts.length - 1]; 
        
        if (!targetNum) return;
        
        const lis = document.querySelectorAll('.list-body > li, .list-item');
        lis.forEach(li => {
            const numEl = li.querySelector('.wr-num');
            if (numEl && numEl.innerText.trim() === targetNum) {
                const btn = li.querySelector('.toki-down-btn');
                if (btn) {
                    btn.innerText = '✅';
                    btn.title = "방금 완료됨";
                    btn.style.cssText = "display: inline-block; vertical-align: middle; margin-left: 5px; padding: 1px 5px; font-size: 11px; cursor: default; border: 1px solid #4CAF50; background: #E8F5E9; color: #2E7D32; border-radius: 3px;";
                    btn.onclick = null;
                }
            }
        });
    });
}

function initStatusUI() {
    const oldUI = document.getElementById('tokiStatusDisplay');
    if (oldUI) oldUI.remove();
    const statusUI = document.createElement('div');
    statusUI.id = 'tokiStatusDisplay';
    statusUI.style.cssText = "position:fixed; bottom:20px; right:20px; background:rgba(0,0,0,0.8); color:white; padding:15px; border-radius:10px; z-index:99999; font-family:sans-serif; font-size:14px; max-width:300px;";
    
    // Initial Render
    renderStatus(statusUI, "준비 중...");

    document.body.appendChild(statusUI);
}

function renderStatus(el, msg) {
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
    const debugBadge = config.debug ? '<span style="color:yellow; font-weight:bold;">[DEBUG]</span> ' : '';
    el.innerHTML = `
        <button id="tokiCloseBtn" style="position:absolute; top:5px; right:5px; background:none; border:none; color:white; font-weight:bold; cursor:pointer;">X</button>
        <p id="tokiStatusText" style="margin:0 0 10px 0;">${debugBadge}${msg}</p>
        <button id="tokiAudioBtn" style="display:none; width:100%; margin-bottom:5px; padding:8px; background:#ff5252; color:white; border:none; border-radius:5px; cursor:pointer;">🔊 백그라운드 켜기 (필수)</button>
        <button id="tokiResumeButton" style="display:none; width:100%; padding:8px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">캡차 해결 완료</button>
    `;
    const closeBtn = el.querySelector('#tokiCloseBtn');
    if(closeBtn) closeBtn.onclick = () => el.remove();
}

function updateStatusUI(msg) {
    const el = document.getElementById('tokiStatusText');
    if (el) {
        // Preserve debug badge if exists or re-render
        // Simplest: just update text if structure allows, or check config again
        const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
        const debugBadge = config.debug ? '<span style="color:yellow; font-weight:bold;">[DEBUG]</span> ' : '';
        el.innerHTML = debugBadge + msg;
    }
}

// ... (openSettings, openDashboard, injectDashboard remain mostly the same, strict UI logic)

async function openSettings() {
    const currentConfig = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
    const folderIdInput = prompt("1. 구글 드라이브 폴더 ID 입력 (필수):", currentConfig.folderId);
    if (folderIdInput === null) return;
    const folderId = folderIdInput.trim();

    if (!folderId) { alert("폴더 ID는 필수입니다."); return; }

    (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .saveConfig */ .ql)(_config_js__WEBPACK_IMPORTED_MODULE_0__/* .CFG_FOLDER_ID */ .mt, folderId);
    alert(`✅ 설정 완료!\nFolder ID: ${folderId}`);

    if (confirm("API 서버 URL 설정을 진행하시겠습니까?\n(뷰어 자동 연결을 위해선 필수입니다)")) {
        const apiUrlInput = prompt("API 서버 URL:", currentConfig.url);
        if (apiUrlInput) (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .saveConfig */ .ql)(_config_js__WEBPACK_IMPORTED_MODULE_0__/* .CFG_URL_KEY */ .V$, apiUrlInput.trim());

        const dashUrlInput = prompt("대시보드 URL:", currentConfig.dashUrl);
        if (dashUrlInput) (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .saveConfig */ .ql)(_config_js__WEBPACK_IMPORTED_MODULE_0__/* .CFG_DASH_KEY */ .C5, dashUrlInput.trim());
    }
}

async function openDashboard() {
    let config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
    
    if (!config.dashUrl) { alert("⚠️ 대시보드 URL이 설정되지 않았습니다."); return; }
    if (!config.url) {
        if(confirm("⚠️ API URL이 설정되지 않았습니다. 지금 설정하시겠습니까?")) {
            await openSettings();
            config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)(); 
            if(!config.url && !confirm("여전히 API URL이 없습니다. 그래도 여시겠습니까?")) return;
        }
    }
    
    const newWindow = window.open(config.dashUrl, '_blank');
    
    if (newWindow && config.url && config.folderId) {
        let deployId = "";
        const match = config.url.match(/\/s\/([^\/]+)\/exec/);
        if (match) deployId = match[1];

        let tries = 0;
        const timer = setInterval(() => {
            newWindow.postMessage({
                type: 'TOKI_CONFIG',
                url: config.url,
                folderId: config.folderId,
                deployId: deployId
            }, "*");
            tries++;
            if(tries > 5) clearInterval(timer);
        }, 1000);
    }
}

function injectDashboard() {
    // 1. Hide Body Content
    const style = document.createElement('style');
    style.innerHTML = `
        body > *:not(#tokiDashboardOverlay) { display: none !important; }
        html, body { background: #1a1a1a; color: white; margin: 0; padding: 0; height: 100%; overflow: hidden; }
    `;
    document.head.appendChild(style);

    // 2. Create Overlay
    const overlay = document.createElement('div');
    overlay.id = 'tokiDashboardOverlay';
    overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:#1a1a1a; z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center;";
    overlay.innerHTML = `
        <h1>🚀 TokiSync Worker</h1>
        <div id="tokiStatusText" style="font-size:24px; margin:20px; text-align:center;">준비 중...</div>
        <div id="tokiQueueList" style="width:80%; height:300px; background:#333; overflow-y:auto; padding:20px; border-radius:10px;"></div>
        <button id="tokiResumeButton" style="display:none; margin-top:20px; padding:15px 30px; font-size:18px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">캡차 해결 완료</button>
    `;
    document.body.appendChild(overlay);
}

function injectDownloadButtons(siteInfo) {
    const listItems = document.querySelectorAll('.list-body > li, .list-item'); 
    
    if (listItems.length === 0) {
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .log */ .Rm)(`[UI] No list items found. Selectors: .list-body > li, .list-item`);
        _events_js__WEBPACK_IMPORTED_MODULE_4__/* .bus */ .j.emit(_events_js__WEBPACK_IMPORTED_MODULE_4__/* .EVENTS */ .q.UI_UPDATE_STATUS, "⚠️ 목록을 찾을 수 없습니다 (뷰어 페이지일 수 있음)");
        return;
    }

    _events_js__WEBPACK_IMPORTED_MODULE_4__/* .bus */ .j.emit(_events_js__WEBPACK_IMPORTED_MODULE_4__/* .EVENTS */ .q.UI_UPDATE_STATUS, `⏳ 히스토리 확인 중... (${listItems.length}개 항목)`);

    // Fetch History
    (0,_network_js__WEBPACK_IMPORTED_MODULE_3__/* .fetchHistoryFromCloud */ .al)(siteInfo).then(history => {
        (0,_logger_js__WEBPACK_IMPORTED_MODULE_1__/* .log */ .Rm)(`[UI] Cloud History Loaded: ${history.length} items`);
        
        let downloadedCount = 0;
        
        listItems.forEach((li, index) => {
            const taskData = (0,_parser_js__WEBPACK_IMPORTED_MODULE_2__/* .parseListItem */ .V)(li, siteInfo);
            const { title, wrNum, url } = taskData;
            
            if (!url) return;
            
            // History Checking (Logic preserved)
            let isDownloaded = false;
            let matchedName = "";
            const numText = wrNum;

            if (numText && /^\d+$/.test(numText)) {
                const num = parseInt(numText); 
                isDownloaded = history.some(h => {
                    const hName = String((typeof h === 'object' && h.name) ? h.name : h).trim();
                    const hMatch = hName.match(/^(\d+)/);
                    if (hMatch) {
                        return parseInt(hMatch[1]) === num;
                    }
                    return false;
                });
                if (isDownloaded) matchedName = `No.${num}`;
            } else {
                const cleanTitle = title.replace(/\s/g, '');
                isDownloaded = history.some(h => {
                    const hName = String((typeof h === 'object' && h.name) ? h.name : h).trim();
                    const cleanH = hName.replace(/\s/g, '');
                    return cleanTitle.includes(cleanH) || cleanH.includes(cleanTitle);
                });
            }

            if (li.querySelector('.toki-down-btn')) return;

            const btn = document.createElement('button');
            btn.className = 'toki-down-btn';
            
            if (isDownloaded) {
                btn.innerText = '✅';
                btn.style.cssText = "display: inline-block; vertical-align: middle; margin-left: 5px; padding: 1px 5px; font-size: 11px; cursor: default; border: 1px solid #4CAF50; background: #E8F5E9; color: #2E7D32; border-radius: 3px;";
                btn.title = `이미 다운로드됨 (${matchedName || numText || "Found"})`;
                downloadedCount++;
            } else {
                btn.innerText = '⬇️';
                btn.style.cssText = "display: inline-block; vertical-align: middle; margin-left: 5px; padding: 1px 5px; font-size: 11px; cursor: pointer; border: 1px solid #ccc; background: #fff; border-radius: 3px;";
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if(confirm(`[${title}] 다운로드 대기열에 추가하시겠습니까?`)) {
                        // [CHANGED] Use EventBus instead of direct import
                        _events_js__WEBPACK_IMPORTED_MODULE_4__/* .bus */ .j.emit(_events_js__WEBPACK_IMPORTED_MODULE_4__/* .EVENTS */ .q.CMD_ENQUEUE_TASK, { 
                            tasks: [{ task: taskData, li: li }], 
                            siteInfo: siteInfo 
                        });
                        
                        const btnEl = e.target;
                        btnEl.innerText = "⏳";
                        btnEl.disabled = true;
                    }
                };
            }

            // Inject Button
            const wrNumEl = li.querySelector('.wr-num');
            if (wrNumEl) {
                 wrNumEl.appendChild(btn);
            } else {
                 const targetContainer = li.querySelector('.wr-subject') || li;
                 targetContainer.appendChild(btn);
            }
        });

        _events_js__WEBPACK_IMPORTED_MODULE_4__/* .bus */ .j.emit(_events_js__WEBPACK_IMPORTED_MODULE_4__/* .EVENTS */ .q.UI_UPDATE_STATUS, `✅ 준비 완료: ${siteInfo.site} (총 ${listItems.length}개, 다운로드됨 ${downloadedCount}개)`);
    });
}







/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};

// EXTERNAL MODULE: ./src/core/config.js
var config = __webpack_require__(899);
// EXTERNAL MODULE: ./src/core/network.js
var network = __webpack_require__(391);
// EXTERNAL MODULE: ./src/core/ui.js
var ui = __webpack_require__(963);
// EXTERNAL MODULE: ./src/core/parser.js
var parser = __webpack_require__(126);
// EXTERNAL MODULE: ./src/core/downloader.js
var downloader = __webpack_require__(414);
// EXTERNAL MODULE: ./src/core/queue.js
var queue = __webpack_require__(302);
// EXTERNAL MODULE: ./src/core/events.js
var events = __webpack_require__(292);
// EXTERNAL MODULE: ./src/core/state.js
var state = __webpack_require__(892);
;// ./src/core/main.js











// Entry Point
function main(GM) {
    'use strict';
    
    // 0. Init Modules
    (0,config/* initConfig */.pw)(GM);
    (0,network/* initNetwork */.t9)(GM);
    (0,ui/* initUI */.xY)(GM);
    (0,downloader/* initDownloader */.aM)(GM);
    (0,queue/* initQueue */.C$)(GM);

    console.log(`🚀 TokiSync ${config/* CLIENT_VERSION */.fZ} Loaded (Modular Single Script)`);

    // 1. Migration
    (0,config/* migrateConfig */.CY)();

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
    const parsedSeries = (0,parser/* getSeriesInfo */.Y)(workId, detectedCategory);

    // Merge info
    const siteInfo = { 
        site, 
        workId, 
        detectedCategory,
        ...parsedSeries 
    };

    // [New] Save Info to Central State
    (0,state/* setState */.wb)({ siteInfo, gmContext: GM });

    if(site !== 'Unknown') {
        console.log(`[TokiSync] Info: ${siteInfo.cleanTitle} (ID: ${siteInfo.workId})`);
    }

    // 3. Define Managers (Glue Logic) & Event Wiring
    
    // [New] Event Wiring
    events/* bus */.j.on(events/* EVENTS */.q.CMD_ENQUEUE_TASK, (data) => {
        // data: { tasks: [{task, li}], siteInfo }
        (0,downloader/* addTasksToQueue */._3)(data.tasks, data.siteInfo);
    });

    const autoSyncDownloadManager = () => {
        if(confirm(`[${siteInfo.site}] 전체 다운로드를 시작하시겠습니까?\n(이미 다운로드된 항목은 건너뛰거나 덮어쓸 수 있습니다)`)) {
            (0,downloader/* tokiDownload */.qc)(null, null, null, siteInfo);
        }
    };

    const batchDownloadManager = () => {
        const input = prompt("다운로드할 범위를 입력하세요 (예: 1-10 또는 5,7,9):");
        if (!input) return;
        
        if (input.includes('-')) {
            const [start, end] = input.split('-').map(Number);
            (0,downloader/* tokiDownload */.qc)(start, end, null, siteInfo);
        } else if (input.includes(',')) {
            const targets = input.split(',').map(Number);
            (0,downloader/* tokiDownload */.qc)(null, null, targets, siteInfo);
        } else {
            const num = parseInt(input);
            if(num) (0,downloader/* tokiDownload */.qc)(null, null, [num], siteInfo);
        }
    };

    const manualDownloadManager = () => {
        const url = prompt("다운로드할 에피소드 URL을 입력하세요:");
        if (url) {
            Promise.resolve(/* import() */).then(__webpack_require__.bind(__webpack_require__, 414)).then(m => m.tokiDownloadSingle({
                url, title: "Manual Download", id: "manual", category: siteInfo.detectedCategory, site: siteInfo.site
            }));
        }
    };

    // 4. Register Menus (Directly)
    if (GM.GM_registerMenuCommand) {
        GM.GM_registerMenuCommand('☁️ 자동 동기화', autoSyncDownloadManager);
        GM.GM_registerMenuCommand('📊 서재 열기', ui/* openDashboard */.Nb);
        GM.GM_registerMenuCommand('🔢 범위 다운로드', batchDownloadManager);
        GM.GM_registerMenuCommand('⚙️ 설정 (URL/FolderID)', ui/* openSettings */.Ow);
        GM.GM_registerMenuCommand('🐞 디버그 모드', config/* toggleDebug */.Up);

        if (GM.GM_getValue(config/* CFG_DEBUG_KEY */.ZE, false)) {
            GM.GM_registerMenuCommand('🧪 1회성 다운로드', manualDownloadManager);
        }
    }

    // 5. Auto Start Logic
    (0,ui/* initStatusUI */.Vt)();
    
    // Check Content
    if (site !== 'Unknown') {
         console.log(`[TokiSync] Site detected: ${site}. Checking for list...`);
         (0,ui/* injectDownloadButtons */.Dr)(siteInfo);
    }

    // Check if I am a Dedicated Worker (Popup)
    if (window.name === 'TOKI_WORKER' || window.location.hash === '#toki_worker') {
        Promise.resolve(/* import() eager */).then(__webpack_require__.bind(__webpack_require__, 835)).then(module => {
            module.initWorker(GM);
            module.startWorker(true); // Dedicated mode
            (0,state/* setState */.wb)({ workerMode: 'dedicated' });
        });
    } else if (site !== 'Unknown') {
        // [New] Start Shared/Background Worker on Main Page to process Queue
        Promise.resolve(/* import() eager */).then(__webpack_require__.bind(__webpack_require__, 835)).then(module => {
            module.initWorker(GM);
            module.startWorker(false); // Non-dedicated mode
            (0,state/* setState */.wb)({ workerMode: 'shared' });
        });
    }
}

/* harmony default export */ const core_main = (main);

;// ./src/index.js



// Metadata handled by Webpack BannerPlugin

(function () {
    'use strict';
    
    console.log("🚀 TokiSync Initialized (Bundled Single Script)");

    // 1. GM Context Setup (Adapter)
    // 1. GM Context Setup (Adapter)
    const GM = {
        // Core Interface
        getValue: GM_getValue,
        setValue: GM_setValue,
        deleteValue: GM_deleteValue,
        xmlhttpRequest: GM_xmlhttpRequest,
        registerMenuCommand: GM_registerMenuCommand,
        
        // Native Interface (for direct access if needed)
        GM_getValue,
        GM_setValue,
        GM_deleteValue,
        GM_xmlhttpRequest,
        GM_registerMenuCommand,

        // Optional safe check for event listener
        GM_addValueChangeListener: typeof GM_addValueChangeListener !== 'undefined' ? GM_addValueChangeListener : undefined,
        
        // Libraries
        JSZip: window.JSZip,
        
        loaderVersion: "1.2.0" // Self-reference
    };

    // 2. GitHub Pages / Frontend Bridge (Config Injection)
    const CFG_FOLDER_ID = 'TOKI_FOLDER_ID';
    if (location.hostname.includes('github.io') || location.hostname.includes('localhost') || location.hostname.includes('127.0.0.1')) {
        console.log("📂 TokiView (Frontend) detected. Injecting Config...");

        const folderId = GM.GM_getValue(CFG_FOLDER_ID);
        const customDeployId = GM.GM_getValue("TOKI_DEPLOY_ID", ""); 
        
        let derivedId = "";
        const savedGasUrl = GM.GM_getValue("TOKI_GAS_URL", "");
        if (!customDeployId && savedGasUrl) {
            const match = savedGasUrl.match(/\/s\/([^\/]+)\/exec/);
            if (match) derivedId = match[1];
        }

        const DEFAULT_ID = ""; 
        const targetId = customDeployId || derivedId || DEFAULT_ID;
        const apiUrl = `https://script.google.com/macros/s/${targetId}/exec`;

        if (folderId) {
            setTimeout(() => {
                window.postMessage({ 
                    type: 'TOKI_CONFIG', 
                    url: apiUrl, 
                    folderId: folderId,
                    deployId: targetId
                }, '*');
                console.log("✅ Config Injected to Frontend:", targetId);
            }, 500);
        }
    }

    // 3. Run Core
    core_main(GM);

})();

/******/ })()
;