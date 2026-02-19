import { vState, currentBookList, currentBookIndex } from './state.js';
import { saveProgress, saveReadHistory, showToast, findVisibleAnchor } from './utils.js';
import { updateSliderUI } from './controls.js';
import { checkNextEpisodeTrigger, preloadNextEpisode } from './actions.js'; // Cyclic dep handling needed?

// Note: updateSliderUI imported from controls.js might create a cycle (controls -> renderer?)
// controls.js likely imports renderer for `navigateViewer` -> `renderCurrentSpread`.
// We will handle this by importing `preloadNextEpisode` and `checkNextEpisodeTrigger` from actions.js.

/**
 * 보기 모드(1쪽/2쪽)와 이미지 크기(가로/세로)에 따라 페이지(Spread)를 재구성합니다.
 * @param {boolean} [resetPage=false] - 현재 페이지 인덱스를 0으로 초기화할지 여부
 */
export function recalcSpreads(resetPage = false) {
    vState.spreads = [];
    const images = vState.images;
    
    if (vState.mode === '1page') {
        for(let i=0; i<images.length; i++) vState.spreads.push([i]);
    } else {
        // 2-page logic
        let i = 0;
        if (vState.coverPriority && images.length > 0) {
             vState.spreads.push([0]);
             i = 1;
        }
        while (i < images.length) {
            const current = images[i];
            // If landscape -> Single
            if (current.width > current.height) {
                vState.spreads.push([i]);
                i++;
                continue;
            }
            // Pair?
            if (i + 1 < images.length) {
                const next = images[i+1];
                if (next.width > next.height) { // Next is landscape -> break pair
                     vState.spreads.push([i]);
                     i++;
                } else {
                     vState.spreads.push([i, i+1]);
                     i += 2;
                }
            } else {
                vState.spreads.push([i]);
                i++;
            }
        }
    }
    
    if (resetPage) vState.currentSpreadIndex = 0;
    renderCurrentSpread();
}

/**
 * 모든 이미지의 실제 크기(naturalWidth/Height)를 비동기적으로 로드합니다.
 * 스마트 2쪽 보기(가로형 이미지 단독 표시 등)를 위해 필수적입니다.
 */
export function loadAllImageDimensions(images) {
    const promises = images.map(imgData => {
        return new Promise(resolve => {
             const img = new Image();
             img.onload = () => { imgData.width = img.naturalWidth; imgData.height = img.naturalHeight; imgData.loaded = true; resolve(); };
             img.onerror = resolve;
             img.src = imgData.src;
        });
    });
    return Promise.all(promises);
}

/**
 * 현재 Spread(vState.currentSpreadIndex)를 DOM에 그립니다.
 */
export function renderCurrentSpread() {
    if (!vState.spreads || vState.spreads.length === 0) return;
    
    const container = document.getElementById('viewerImageContainer');
    const counter = document.getElementById('pageCounter');
    const spreadIndices = vState.spreads[vState.currentSpreadIndex];
    if (!spreadIndices) {
        console.error(`Rendering Error: Invalid Spread Index ${vState.currentSpreadIndex} / ${vState.spreads.length}`);
        return;
    }
    
    // RTL
    const dirStyle = vState.rtlMode ? 'flex-direction:row-reverse;' : '';

    container.innerHTML = `<div class="viewer-spread ${vState.rtlMode ? 'is-rtl' : ''}" style="${dirStyle}">
        ${spreadIndices.map(idx => `
            <div class="${spreadIndices.length > 1 ? 'half' : ''}">
                <img src="${vState.images[idx].src}" class="viewer-page">
            </div>
        `).join('')}
    </div>`;
    
    // Counter
    const start = spreadIndices[0] + 1;
    const end = spreadIndices[spreadIndices.length-1] + 1;
    const total = vState.images.length;
    counter.innerText = (start === end) ? `${start} / ${total}` : `${start}-${end} / ${total}`;

    // Save Progress
    const currentImgIdx = spreadIndices[0]; // Use first image of spread as marker
    saveProgress(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id, currentImgIdx);

    // Check Finish (Mark Read if last page)
    if (vState.currentSpreadIndex === vState.spreads.length - 1) {
        saveReadHistory(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id);
        const modal = document.getElementById('episodeModal');
        if (modal && modal.style.display === 'flex') {
             // Refresh list if open behind
             // renderEpisodeList(currentBookList, currentBookList[currentBookIndex].seriesId); 
        }
    }

    // Preload Trigger
    if (vState.spreads.length - vState.currentSpreadIndex <= 4) {
         preloadNextEpisode();
    }
    
    // Update Slider
    updateSliderUI();
}


/* Scroll Mode Logic */
export function renderScrollMode() {
    const container = document.getElementById('viewerScrollContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Intersection Observer for Current Page
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                const index = parseInt(entry.target.getAttribute('data-index'));
                updateScrollProgress(index);
            }
        });
    }, { threshold: 0.5 }); // 50% visible

    vState.images.forEach((imgData, index) => {
        const img = document.createElement('img');
        img.src = imgData.src;
        // img.loading = 'lazy'; // Removed to ensure dimension calculation for scroll
        img.className = 'viewer-page';
        img.setAttribute('data-index', index);
        
        container.appendChild(img);
        observer.observe(img);
    });

    // Initial update
    updateSliderUI();
    
    // Add Infinite Scroll Trigger with Double-Tap Protection
    container.onscroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        
        if (scrollTop + clientHeight >= scrollHeight - 50) {
             // Double-Tap Logic
             if (!window.scrollBottomTriggered) {
                 window.scrollBottomTriggered = true;
                 window.scrollBottomTimestamp = Date.now();
                 showToast("마지막입니다. 계속 내리면 다음 화로 이동합니다.");
                 return;
             }
             
             // Time Latch (1s)
             if (Date.now() - window.scrollBottomTimestamp < 1000) {
                 return;
             }

             if (!window.isLoadingNext) checkNextEpisodeTrigger();
        } else {
            // Reset if user scrolls up
            if (scrollHeight - (scrollTop + clientHeight) > 100) {
                window.scrollBottomTriggered = false;
                window.scrollBottomTimestamp = 0;
            }
        }
    };
}

export function updateScrollProgress(index) {
    if (vState.currentSpreadIndex === index) return;
    vState.currentSpreadIndex = index;
    
    // Update Counter
    const counter = document.getElementById('pageCounter');
    const total = vState.images.length;
    if(counter) counter.innerText = `${index + 1} / ${total}`;
    
    // Save Progress
    if(currentBookList[currentBookIndex]) {
        saveProgress(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id, index);
    }
    
    // Slider
    const slider = document.getElementById('pageSlider');
    if(slider) slider.value = index + 1;
    const currentLabel = document.getElementById('sliderCurrent');
    if(currentLabel) currentLabel.innerText = index + 1;

    // Check Finish (Last Page)
    if (index === total - 1) {
        saveReadHistory(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id);
    }
    
    // Preload Trigger (Last 3 images)
    if (total - index <= 3) {
        preloadNextEpisode();
    }
}

export function scrollToPage(index) {
    const container = document.getElementById('viewerScrollContainer');
    if(!container) return;
    
    const target = container.children[index];
    if(target) {
        target.scrollIntoView({ block: 'start' });
    }
}

/* Legacy EPUB Rendering (Simple HTML) */
export function renderLegacyMode(htmlContent) {
    // 1. Use Unified Container
    const container = document.getElementById('viewerImageContainer');
    const scrollContainer = document.getElementById('viewerScrollContainer'); 

    // Hide old container if it exists
    if (scrollContainer) scrollContainer.style.display = 'none';
    
    // Show Unified Container
    container.style.display = 'flex';
    container.innerHTML = '';
    container.classList.add('epub-mode');
    
    // 2. Render inside .viewer-spread
    const viewClass = vState.scrollMode ? 'scroll-view' : 'paged-view';
    
    container.innerHTML = `
        <div class="viewer-spread ${vState.rtlMode ? 'is-rtl' : ''}">
            <div class="viewer-page-wrapper text-mode">
                 <div class="epub-content ${viewClass}" style="font-size:${vState.textSettings.fontSize}px; line-height:${vState.textSettings.lineHeight}; color: inherit;">
                    ${htmlContent}
                 </div>
            </div>
        </div>
    `;
    
    // 3. Apply Settings
    applyTextSettings();
    
    // 4. Restore Scroll Listener for Scroll Mode (Legacy Infinite Scroll support)
    if (vState.scrollMode) {
        const content = container.querySelector('.epub-content');
        if (content) {
            content.onscroll = () => {
                const { scrollTop, scrollHeight, clientHeight } = content;
                
                // 1. Check Infinite Scroll (Next Episode)
                // Block trigger if restoring position
                if (window.isRestoring) return;
                
                if (scrollTop + clientHeight >= scrollHeight - 50) {
                     // Double-Tap Logic for Infinite Scroll
                     if (!window.scrollBottomTriggered) {
                         window.scrollBottomTriggered = true;
                         window.scrollBottomTimestamp = Date.now(); // Latch time
                         showToast("마지막입니다. 계속 내리면 다음 화로 이동합니다.");
                         return;
                     }
                     
                     // Time Latch: Prevent immediate trigger within 1 second
                     if (Date.now() - window.scrollBottomTimestamp < 1000) {
                         return;
                     }

                     if (!window.isLoadingNext) checkNextEpisodeTrigger();
                } else {
                    // Reset if user scrolls up away from bottom
                    if (scrollHeight - (scrollTop + clientHeight) > 100) {
                        window.scrollBottomTriggered = false;
                        window.scrollBottomTimestamp = 0;
                    }
                }

                // 3. Update Page Counter (Approximate)
                const percent = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100) || 0;
                
                const counter = document.getElementById('pageCounter');
                if (counter) {
                    counter.innerText = `${percent}%`;
                }

                // 2. Save Anchor (Throttled)
                if (!window.saveAnchorTimer) {
                    window.saveAnchorTimer = setTimeout(() => {
                        window.saveAnchorTimer = null;
                        const anchor = findVisibleAnchor(content);
                        if (anchor && currentBookList[currentBookIndex]) {
                             saveProgress(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id, anchor);
                        }
                    }, 500);
                }
            };

            // 3. Restore Progress (Anchor)
            if (currentBookList[currentBookIndex]) {
                 const progress = getProgress(currentBookList[currentBookIndex].seriesId, currentBookList[currentBookIndex].id);
                 if (progress && typeof progress === 'object' && progress.index !== undefined) {
                      // It's an anchor object
                      window.isRestoring = true;
                      
                      setTimeout(() => {
                           const candidates = content.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6');
                           if (candidates[progress.index]) {
                                candidates[progress.index].scrollIntoView({ block: 'start' });
                                showToast(`🔖 저장된 위치(${progress.index}번째 문단)로 이동했습니다.`);
                           }
                           setTimeout(() => { window.isRestoring = false; }, 1000);
                      }, 100);
                 }
            }
        }
    }
}

export function applyTextSettings() {
    // 1. Legacy Mode Support - Unified Structure
    if (vState.epubMode && !vState.foliateView) {
        const el = document.querySelector('.epub-content');
        if(el) {
            el.style.fontSize = `${vState.textSettings.fontSize}px`;
            el.style.lineHeight = vState.textSettings.lineHeight;

            // Apply 2-Page / 1-Page Column Logic
            if (vState.scrollMode) {
                 el.style.columnCount = 'auto';
                 el.style.width = '100%';
                 el.style.height = '100%'; 
                 el.style.overflowY = 'auto'; 
                 el.style.overflowX = 'hidden';
            } else {
                // Paged Mode
                el.style.height = 'calc(100vh - 120px)'; 
                el.style.width = 'auto';
                el.style.overflowX = 'hidden'; 
                el.style.overflowY = 'hidden';
                
                if (vState.mode === '2page') {
                    el.style.columnCount = 2;
                    el.style.columnWidth = 'auto'; 
                    el.style.columnGap = '40px'; 
                } else {
                    el.style.columnCount = 1; 
                    el.style.columnWidth = 'auto';
                    el.style.columnGap = '0px';
                }
            }
        }
        return;
    }

    // 2. Foliate Mode
    if (!vState.foliateView || !vState.foliateView.renderer) return;
    
    // Foliate manages content in iframes (renderer.getContents())
    const contents = vState.foliateView.renderer.getContents();
    for (const content of contents) {
        if (content.doc) {
            content.doc.body.style.fontSize = `${vState.textSettings.fontSize}px`;
            content.doc.body.style.lineHeight = vState.textSettings.lineHeight;
            content.doc.body.style.color = '#333';
            content.doc.body.style.backgroundColor = '#fff';
        }
    }
}
