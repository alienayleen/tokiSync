import { vState, currentBookList, currentBookIndex } from './state.js';
import { loadViewer, checkNextEpisodeTrigger } from './actions.js'; // Circular dep check
import { renderCurrentSpread } from './renderer.js';
import { showToast } from './utils.js';

/**
 * 뷰어 페이지를 이동합니다.
 * @param {number} dir - 이동 방향 (1: 다음, -1: 이전)
 */
export function navigateViewer(dir) {
    if (window.isViewerLoading) return; // Block input during load
    
    if (vState.scrollMode) {
        navigateScrollMode(dir);
        return;
    }
    
    if (vState.epubMode && !vState.foliateView) {
        // Text Page Mode Navigation (Legacy Paged)
        navigateTextPage(dir);
        return;
    }

    const nextIdx = vState.currentSpreadIndex + dir;
    if (nextIdx >= vState.spreads.length) {
        if (currentBookIndex < currentBookList.length - 1) {
             if (confirm("다음 화로 이동하시겠습니까?")) loadViewer(currentBookIndex + 1, true);
        } else {
             showToast("마지막 화입니다.");
        }
        return;
    }
    if (nextIdx < 0) {
        showToast("첫 페이지입니다.");
        return;
    }
    vState.currentSpreadIndex = nextIdx;
    renderCurrentSpread();
}

/**
 * 스크롤 모드에서의 페이지 이동 (키보드/버튼)
 * 화면의 90%만큼 스크롤하고, 끝에 도달하면 다음 화로 이동합니다.
 */
export function navigateScrollMode(dir) {
    if (window.isViewerLoading) return;

    // 1. Identify Scroll Container
    let container = null;
    if (vState.epubMode) {
        container = document.querySelector('.epub-content.scroll-view');
        // Fallback or Image mode
        if (!container) container = document.getElementById('viewerScrollContainer'); 
    } else {
        container = document.getElementById('viewerScrollContainer');
    }
    
    if (!container) {
        console.warn("[ScrollNav] No Container Found!");
        return;
    }

    // 2. Calculate Scroll
    const clientHeight = container.clientHeight > 0 ? container.clientHeight : window.innerHeight;
    const scrollAmount = clientHeight * 0.9;
    const currentScroll = container.scrollTop;
    const maxScroll = container.scrollHeight - clientHeight;

    console.log(`[ScrollNav] Dir: ${dir}, Scroll: ${currentScroll} / ${maxScroll}`);
    
    if (dir === 1) { // Next (Down)
        if (Math.abs(currentScroll - maxScroll) < 10 || currentScroll >= maxScroll) {
             // Double-Tap Logic
             if (!window.scrollBottomTriggered) {
                 window.scrollBottomTriggered = true;
                 window.scrollBottomTimestamp = Date.now();
                 showToast("마지막입니다. 한번 더 내리면 다음 화로 이동합니다.");
                 return;
             }
             
             checkNextEpisodeTrigger();
             return;
        }
        // Reset trigger if scrolling normally
        window.scrollBottomTriggered = false;
        container.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    } else { // Prev (Up)
        window.scrollBottomTriggered = false; // Reset on up scroll
        if (currentScroll <= 10) {
            showToast("첫 부분입니다.");
            return;
        }
        container.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
    }
}

/**
 * 텍스트 뷰어(페이지 모드) 페이지 이동
 */
export function navigateTextPage(dir) {
    // Locate the unique text content container
    const content = document.querySelector('.epub-content.paged-view');
    if (!content) return;

    const container = content;
    
    // Dimensions
    const pageWidth = container.clientWidth;
    const scrollWidth = container.scrollWidth;
    let currentScroll = container.scrollLeft;

    // Direction Logic (RTL not used for scrollLeft usually, but logical direction needed?)
    // const isRtl = vState.rtlMode;
    
    // Boundary Detection
    // 1. Next Page
    if (dir === 1) { 
        if (Math.abs(currentScroll + pageWidth - scrollWidth) < 10 || currentScroll + pageWidth >= scrollWidth) {
             if (!window.isLoadingNext) checkNextEpisodeTrigger();
             return;
        }
        container.scrollBy({ left: pageWidth, behavior: 'smooth' });
    } 
    // 2. Prev Page
    else {
        if (currentScroll <= 10) { 
            showToast("첫 페이지입니다.");
            return;
        }
        container.scrollBy({ left: -pageWidth, behavior: 'smooth' });
    }
    
    // Update Progress
    setTimeout(() => {
        const page = Math.round(container.scrollLeft / pageWidth) + 1;
        const total = Math.ceil(container.scrollWidth / pageWidth);
        const safeTotal = total > 0 ? total : 1;
        const safePage = page > safeTotal ? safeTotal : (page < 1 ? 1 : page);
        
        const counter = document.getElementById('pageCounter');
        if(counter) counter.innerText = `${safePage} / ${safeTotal}`;
    }, 400); 
}
