import { sleep, waitIframeLoad } from './utils.js';
import { getListItems, parseListItem, getNovelContent, getImageList } from './parser.js';
import { detectSite } from './detector.js';

export async function tokiDownload(startIndex, lastIndex) {
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
