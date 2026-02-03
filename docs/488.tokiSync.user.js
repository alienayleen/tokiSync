"use strict";
(self["webpackChunktokisync"] = self["webpackChunktokisync"] || []).push([[488],{

/***/ 488
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   uploadToGAS: () => (/* binding */ uploadToGAS)
/* harmony export */ });
/* harmony import */ var _config_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(899);


function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

/**
 * Uploads a Blob to Google Drive via GAS
 * @param {Blob} blob File content
 * @param {string} folderName Target folder name (e.g. "[123] Title")
 * @param {string} fileName Target file name (e.g. "[123] Title.zip")
 * @param {object} options Additional options (category, etc)
 */
async function uploadToGAS(blob, folderName, fileName, options = {}) {
    const config = (0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .getConfig */ .zj)();
    if (!(0,_config_js__WEBPACK_IMPORTED_MODULE_0__/* .isConfigValid */ .Jb)()) throw new Error("GAS 설정이 누락되었습니다. 메뉴에서 설정을 완료해주세요.");
    
    // Constants
    const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
    const CLIENT_VERSION = "0.0.3-new_core";
    const totalSize = blob.size;
    let uploadUrl = "";

    console.log(`[GAS] 업로드 초기화 중... (${fileName})`);
    
    // Determine Category
    // Default to Webtoon if not provided
    const category = options.category || (fileName.endsWith('.epub') ? 'Novel' : 'Webtoon');

    // Helper for cross-compatibility (GM_ vs GM.)
    const xhr = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest : (GM && GM.xmlHttpRequest ? GM.xmlHttpRequest : null);
    if(!xhr) throw new Error("GM_xmlhttpRequest not found");

    // 1. Init Session
    await new Promise((resolve, reject) => {
        xhr({
            method: "POST", 
            url: config.url, // Changed back to config.url (core style) or config.gasUrl (new_core style)? 
                             // src/core/config.js uses 'config.url'. new_core/gas.js used 'config.gasUrl'. 
                             // I must MUST match src/core/config.js which uses 'url'.
            data: JSON.stringify({ 
                folderId: config.folderId, 
                type: "init", 
                protocolVersion: 3, 
                clientVersion: CLIENT_VERSION, 
                folderName: folderName, 
                fileName: fileName,
                category: category 
            }),
            headers: { "Content-Type": "text/plain" },
            onload: (res) => {
                try {
                    const json = JSON.parse(res.responseText);
                    if (json.status === 'success') { 
                        // uploadUrl can be string or object depending on server version, handling both
                        uploadUrl = (typeof json.body === 'object') ? json.body.uploadUrl : json.body;
                        resolve(); 
                    } else {
                        reject(new Error(json.body || "Init failed"));
                    }
                } catch (e) { reject(new Error("GAS 응답 오류(Init): " + res.responseText)); }
            },
            onerror: (e) => reject(new Error("네트워크 오류(Init)"))
        });
    });

    console.log(`[GAS] 세션 생성 완료. 업로드 시작...`);

    // 2. Chunk Upload Loop
    let start = 0;
    const buffer = await blob.arrayBuffer();
    
    while (start < totalSize) {
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunkBuffer = buffer.slice(start, end);
        const chunkBase64 = arrayBufferToBase64(chunkBuffer);
        const percentage = Math.floor((end / totalSize) * 100);
        
        console.log(`[GAS] 전송 중... ${percentage}% (${start} ~ ${end} / ${totalSize})`);

        await new Promise((resolve, reject) => {
            xhr({
                method: "POST", 
                url: config.url, // Corrected to config.url
                data: JSON.stringify({ 
                    folderId: config.folderId, 
                    type: "upload", 
                    clientVersion: CLIENT_VERSION, 
                    uploadUrl: uploadUrl, 
                    chunkData: chunkBase64, 
                    start: start, end: end, total: totalSize 
                }),
                headers: { "Content-Type": "text/plain" },
                onload: (res) => {
                    try { 
                        const json = JSON.parse(res.responseText); 
                        if (json.status === 'success') resolve(); 
                        else reject(new Error(json.body || "Upload failed")); 
                    } catch (e) { reject(new Error("GAS 응답 오류(Upload): " + res.responseText)); }
                },
                onerror: (e) => reject(new Error("네트워크 오류(Upload)"))
            });
        });
        
        start = end;
    }

    console.log(`[GAS] 업로드 완료!`);
}



/***/ }

}]);