// ==UserScript==
// @name         tokiDownloader
// @namespace    https://github.com/crossSiteKikyo/tokiDownloader
// @version      0.0.3
// @description  북토끼, 뉴토끼, 마나토끼 다운로더
// @author       hehaho
// @match        https://*.com/webtoon/*
// @match        https://*.com/novel/*
// @match        https://*.net/comic/*
// @icon         https://github.com/user-attachments/assets/99f5bb36-4ef8-40cc-8ae5-e3bf1c7952ad
// @grant        GM_registerMenuCommand
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip-utils/0.1.0/jszip-utils.js
// @run-at       document-end
// @license      MIT
// ==/UserScript==

/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ./src/new_core/utils.js
function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), ms);
    });
}

function waitIframeLoad(iframe, url) {
    return new Promise((resolve) => {
        const handler = () => {
            iframe.removeEventListener('load', handler);
            resolve();
        };
        iframe.addEventListener('load', handler);
        iframe.src = url;
    });
}

;// ./src/new_core/parser.js
function getListItems() {
    return Array.from(document.querySelector('.list-body').querySelectorAll('li')).reverse();
}

function parseListItem(li) {
    // Extract Number
    const numEl = li.querySelector('.wr-num');
    const num = numEl ? numEl.innerText.trim().padStart(4, '0') : "0000";

    // Extract Title & Link
    const linkEl = li.querySelector('a');
    let title = "Unknown";
    let src = "";
    
    if (linkEl) {
        // Clean title: Remove spans (often used for badges/icons)
        title = linkEl.innerHTML.replace(/<span[\s\S]*?\/span>/g, '').trim();
        src = linkEl.href;
    }

    return { num, title, src, element: li };
}

function getNovelContent(iframeDocument) {
    const contentEl = iframeDocument.querySelector('#novel_content');
    return contentEl ? contentEl.innerText : "";
}

function getImageList(iframeDocument, protocolDomain) {
    // Select images in viewer
    let imgLists = Array.from(iframeDocument.querySelectorAll('.view-padding div img'));

    // Filter visible images
    imgLists = imgLists.filter(img => img.checkVisibility());

    // Extract valid Sources
    // data-l44925d0f9f="src" style lazy loading
    // Regex fallback to find data-path
    
    return imgLists.map(img => {
        let src = img.outerHTML; // Fallback strategy from original code
        try {
            // Find data attribute containing path
            const match = src.match(/\/data[^"]+/);
            if (match) {
                // Prepend domain for CORS / absolute path
                return `${protocolDomain}${match[0]}`;
            }
        } catch (e) {
            console.warn("Image src parse failed:", e);
        }
        return null;
    }).filter(src => src !== null); // Remove nulls
}

;// ./src/new_core/detector.js
function detectSite() {
    const currentURL = document.URL;
    let site = '뉴토끼'; // Default
    let protocolDomain = 'https://newtoki350.com'; // Default fallback

    if (currentURL.match(/^https:\/\/booktoki[0-9]+.com\/novel\/[0-9]+/)) {
        site = "북토끼"; 
        protocolDomain = currentURL.match(/^https:\/\/booktoki[0-9]+.com/)[0];
    }
    else if (currentURL.match(/^https:\/\/newtoki[0-9]+.com\/webtoon\/[0-9]+/)) {
        site = "뉴토끼"; 
        protocolDomain = currentURL.match(/^https:\/\/newtoki[0-9]+.com/)[0];
    }
    else if (currentURL.match(/^https:\/\/manatoki[0-9]+.net\/comic\/[0-9]+/)) {
        site = "마나토끼"; 
        protocolDomain = currentURL.match(/^https:\/\/manatoki[0-9]+.net/)[0];
    }
    else {
        return null; // Not a valid target page
    }

    return { site, protocolDomain };
}

;// ./src/new_core/downloader.js




async function tokiDownload(startIndex, lastIndex) {
    const siteInfo = detectSite();
    if (!siteInfo) {
        alert("지원하지 않는 사이트이거나 다운로드 페이지가 아닙니다.");
        return;
    }
    const { site, protocolDomain } = siteInfo;

    try {
        // JSZip must be loaded globally via @require in UserScript
        const zip = new JSZip();

        // Get List
        let list = getListItems();

        // Filter Logic
        if (startIndex) {
            // Filter out items BEFORE startIndex
            // Note: list is already reversed (Order 1 to N), assuming parser.js returns it reversed.
            // Original code: list[0] is first episode.
            list = list.filter(li => {
                const num = parseInt(li.querySelector('.wr-num').innerText);
                return num >= startIndex;
            });
        }
        if (lastIndex) {
            list = list.filter(li => {
                const num = parseInt(li.querySelector('.wr-num').innerText);
                return num <= lastIndex;
            });
        }

        if (list.length === 0) {
            alert("다운로드할 항목이 없습니다.");
            return;
        }

        // Folder Name
        const first = parseListItem(list[0]);
        const last = parseListItem(list[list.length - 1]);
        const rootFolder = `${site} ${first.title} ~ ${last.title}`;

        // Create IFrame
        const iframe = document.createElement('iframe');
        iframe.width = 600; iframe.height = 600;
        iframe.style.position = 'fixed'; iframe.style.top = '-9999px'; // Hide it
        document.body.appendChild(iframe);

        // --- Processing Loop ---
        for (let i = 0; i < list.length; i++) {
            const item = parseListItem(list[i].element || list[i]); // handle if list contains LI elements directly
            console.clear();
            console.log(`${i + 1}/${list.length} [${item.num}] ${item.title} 진행중...`);

            await waitIframeLoad(iframe, item.src);
            await sleep(1000);
            
            const iframeDoc = iframe.contentWindow.document;

            if (site === "북토끼") {
                const text = getNovelContent(iframeDoc);
                zip.file(`${item.num} ${item.title}.txt`, text);
            } 
            else {
                // Webtoon / Manga
                const imageUrls = getImageList(iframeDoc, protocolDomain);
                const folderName = `${item.num} ${item.title}`;
                console.log(`이미지 ${imageUrls.length}개 감지`);

                // Fetch Images Parallel
                const promises = imageUrls.map(async (src, idx) => {
                    try {
                        // Skip if extension unknown
                        const extMatch = src.match(/\.[a-zA-Z]+$/);
                        const ext = extMatch ? extMatch[0] : '.jpg';
                        
                        const response = await fetch(src);
                        const blob = await response.blob();
                        
                        zip.folder(folderName).file(`${item.title} image${String(idx).padStart(4,'0')}${ext}`, blob);
                    } catch (e) {
                         console.error(`이미지 다운로드 실패: ${src}`, e);
                    }
                });

                await Promise.all(promises);
            }
        }

        // Cleanup
        iframe.remove();

        // Download Zip
        console.log(`압축 및 다운로드 중...`);
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = rootFolder + ".zip";
        link.click();
        URL.revokeObjectURL(link.href);
        link.remove();
        console.log(`완료`);

    } catch (error) {
        alert(`오류 발생: ${error}`);
        console.error(error);
    }
}

;// ./src/new_core/main.js



function main() {
    console.log("🚀 TokiDownloader Loaded (New Core)");
    
    const siteInfo = detectSite();
    if(!siteInfo) return; // Not a target page

    // Register Menu Commands
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('전체 다운로드', () => tokiDownload());
        
        GM_registerMenuCommand('N번째 회차부터', () => {
             const start = prompt('몇번째 회차부터 저장할까요?', 1);
             if(start) tokiDownload(parseInt(start));
        });

        GM_registerMenuCommand('N번째 회차부터 N번째 까지', () => {
             const start = prompt('몇번째 회차부터 저장할까요?', 1);
             const end = prompt('몇번째 회차까지 저장할까요?', 2);
             if(start && end) tokiDownload(parseInt(start), parseInt(end));
        });
    }
}

// Auto-run main if imported? Or let index.js call it.
// Since we are refactoring, likely index.js will just import and call main().

;// ./src/new_core/index.js



(function () {
    'use strict';
    main();
})();
/******/ })()
;