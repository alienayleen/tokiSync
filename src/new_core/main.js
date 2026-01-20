import { tokiDownload } from './downloader.js';
import { detectSite } from './detector.js';

export function main() {
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
