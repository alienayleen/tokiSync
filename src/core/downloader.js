import { saveInfoJson, uploadResumable } from './network.js';
import { updateStatus, setListItemStatus, log } from './logger.js';
import { getSeriesInfo, parseListItem } from './parser.js';
import { getConfig } from './config.js';
import { enqueueTask } from './queue.js';
import { setState, getGM } from './state.js';

let GM = null; 
let JSZip = null;

export function initDownloader(gmContext) {
    GM = gmContext;
    JSZip = gmContext.JSZip;
    setState({ gmContext }); // Sync to State
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

export async function createEpub(zip, title, author, textContent) {
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

export async function addTasksToQueue(taskItems, seriesInfo) {
    if (!taskItems || taskItems.length === 0) return 0;

    // 1. Ensure Series Info is saved (Once per batch/single)
    // This fixes the missing info.json issue for single downloads
    await saveInfoJson(seriesInfo, 0, 0, true); 

    let addedCount = 0;
    taskItems.forEach(({ task, li }) => {
        if(enqueueTask(task)) {
            addedCount++;
            if(li) setListItemStatus(li, "⏳ 대기 중", "#fff9c4", "#fbc02d");
        } else {
            if(li) setListItemStatus(li, "⚠️ 중복/대기", "#eeeeee", "#9e9e9e");
        }
    });
    return addedCount;
}

// [Unified Logic] tokiDownload now behaves as a Batch Enqueuer
export async function tokiDownload(startIndex, lastIndex, targetNumbers, siteInfo) {
    const { site, workId, detectedCategory } = siteInfo;
    const config = getConfig();

    try {
        let list = Array.from(document.querySelector('.list-body').querySelectorAll('li')).reverse();
        if (targetNumbers) list = list.filter(li => targetNumbers.includes(parseInt(li.querySelector('.wr-num').innerText)));
        else {
            if (startIndex) { while (list.length > 0 && parseInt(list[0].querySelector('.wr-num').innerText) < startIndex) list.shift(); }
            if (lastIndex) { while (list.length > 0 && parseInt(list.at(-1).querySelector('.wr-num').innerText) > lastIndex) list.pop(); }
        }
        if (list.length === 0) {
            updateStatus("⚠️ 다운로드할 항목이 없습니다.");
            return;
        }

        // Get Series Info
        const info = getSeriesInfo(workId, detectedCategory);
        
        updateStatus(`🚀 ${list.length}개 항목을 대기열에 추가합니다...`);

        // Prepare Task Items
        const taskItems = list.map(li => {
            const task = parseListItem(li, info);
            return { task, li };
        });

        // Add to Queue (Centralized)
        const addedCount = await addTasksToQueue(taskItems, info);
        
        updateStatus(`✅ 총 ${addedCount}개 작업이 대기열에 추가되었습니다. (백그라운드에서 진행됨)`);

    } catch (error) {
        console.error(error);
        updateStatus(`❌ 일괄 추가 실패: ${error.message}`);
    }
}


export async function tokiDownloadSingle(task) {
    // Task object is well-formed by parser.js and contains { site, category, ... }
    const { url, title, id, category, folderName, seriesTitle, site } = task; 
    const config = getConfig();
    
    // No redundant site detection here. We trust the task.
    // However, if we need 'site' for logic switches (like image selectors):
    // const effectiveSite = site || '뉴토끼'; // Fallback if missing
    
    // Pass seriesTitle if available for better cleaning
    // If category is missing, derive it from site (fallback)
    const effectiveCategory = category || (site === '북토끼' ? 'Novel' : 'Webtoon');
    
    const info = { id, cleanTitle: title, fullTitle: seriesTitle, category: effectiveCategory };
    const targetFolderName = folderName || `[${id}] ${title}`;

    updateStatus(`🚀 작업 시작: ${title}`);

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
            updateStatus("<strong>🤖 캡차/차단 감지!</strong><br>해결 후 버튼 클릭");
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

            updateStatus(`[${targetFolderName}]<br><strong>${title}</strong><br>이미지 ${imgLists.length}장 수집 중...`);

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
        updateStatus(`📦 압축 & 업로드 준비...`);
        const zipBlob = await zip.generateAsync({type:"blob"});
        
        await uploadResumable(zipBlob, targetFolderName, finalFileName, category, (pct) => {
             updateStatus(`☁️ 업로드: ${pct}%`);
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
