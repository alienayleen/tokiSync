/**
 * BaseParser (Abstract)
 * Provides common logic and defines interface for site-specific parsers.
 */
export class BaseParser {
    constructor(protocolDomain) {
        this.protocolDomain = protocolDomain;
    }

    /**
     * Common: Dummy image detection
     */
    isDummyUrl(url) {
        if (!url) return true;
        if (url.startsWith('data:image')) return true;
        const lower = url.toLowerCase();

        // 알려진 더미 파일명 패턴
        const dummyFilenames = [
            'blank.gif', 'loading.gif', 'loading-image.gif',
            'pixel.gif', 'spacer.gif', 'transparent.gif',
            '1x1.gif', 'dot.gif',
        ];
        if (dummyFilenames.some(p => lower.includes(p))) return true;

        // 경로 기반 패턴: /img/loading*, /img/placeholder*
        if (/\/img\/loading/.test(lower)) return true;
        if (/\/img\/placeholder/.test(lower)) return true;

        return false;
    }

    /**
     * Common: Ensure URL is absolute
     */
    getAbsoluteUrl(url) {
        if (!url) return "";
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return `https:${url}`;
        if (url.startsWith('/')) return `${this.protocolDomain}${url}`;
        try {
            const base = (this._doc && this._doc.URL) || this.protocolDomain || (typeof window !== 'undefined' && window.location ? window.location.href : '');
            if (base) return new URL(url, base).href;
        } catch (e) {}
        return url;
    }

    /**
     * Helper: Wait for a selector to appear in the DOM
     */
    async waitForSelector(selector, timeout = 5000) {
        return new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) {
                    observer.disconnect();
                    resolve(el);
                }
            });

            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }, timeout);
        });
    }

    /**
     * Interface: Extract list elements (li or similar)
     * @returns {HTMLElement[]}
     */
    getListItems() {
        throw new Error('getListItems() must be implemented');
    }

    /**
     * Interface: Parse single list item into normalized object
     * @param {HTMLElement} element 
     * @returns {Object} { num, title, src, element }
     */
    parseListItem(element) {
        throw new Error('parseListItem() must be implemented');
    }

    /**
     * Interface: Extract novel content from iframe
     */
    getNovelContent(iframeDocument) {
        throw new Error('getNovelContent() must be implemented');
    }

    /**
     * Interface: Extract image list for webtoon/manga
     */
    getImageList(iframeDocument) {
        throw new Error('getImageList() must be implemented');
    }

    /**
     * Interface: Extract thumbnail URL
     */
    getThumbnailUrl() {
        throw new Error('getThumbnailUrl() must be implemented');
    }

    /**
     * Interface: Extract series title
     */
    getSeriesTitle() {
        throw new Error('getSeriesTitle() must be implemented');
    }

    /**
     * Interface: Extract series metadata
     */
    getSeriesMetadata() {
        throw new Error('getSeriesMetadata() must be implemented');
    }
    /**
     * Common: Generate unified folder name / series title
     * @param {string} seriesId - Unique ID from URL
     * @param {string} firstTitle - Title of first episode in list
     * @param {string} lastTitle - Title of last episode in list
     * @param {function} getCommonPrefixFn - Callback to calculate prefix
     * @returns {string} "[ID] Title"
     */
    getFormattedTitle(seriesId, firstTitle, lastTitle, getCommonPrefixFn) {
        let seriesTitle = this.getSeriesTitle();
        let formatted = "";

        if (seriesTitle) {
            formatted = `[${seriesId}] ${seriesTitle}`;
        } else {
            // Fallback Logic
            let listPrefixTitle = "";
            if (firstTitle && lastTitle && getCommonPrefixFn) {
                listPrefixTitle = getCommonPrefixFn(firstTitle, lastTitle);
            }

            // 공통 접두사가 2글자 이상이고 단순 챕터 부제('은원 (', '제1장' 등)가 아닐 때만 채택
            const cleanPrefix = (listPrefixTitle || '').replace(/[(\[\-_:\s]+$/, '').trim();
            if (cleanPrefix && cleanPrefix.length >= 2 && firstTitle !== lastTitle) {
                formatted = `[${seriesId}] ${cleanPrefix}`;
            } else if (firstTitle && /\s+\d+\s*(?:화|회|편|권)/.test(firstTitle.trim())) {
                // '전설급 영웅은 아카데미 우등생 111화'처럼 앞에 작품명이 있고 뒤에 N화가 붙은 경우에만 작품명 추출
                const cleanTitle = firstTitle.replace(/\s*\d+\s*(?:화|회|편|권).*$/, '').trim();
                formatted = cleanTitle ? `[${seriesId}] ${cleanTitle}` : `[${seriesId}] UnknownSeries`;
            } else {
                formatted = `[${seriesId}] UnknownSeries`;
            }
        }

        // Final cleanup for filesystem compatibility
        return formatted.replace(/[<>:"/\\|?*]/g, '').trim();
    }
}
