import { BaseParser } from './BaseParser.js';

/**
 * GenericParser
 * A dynamic parser that uses JSON rules to extract data from the DOM.
 */
export class GenericParser extends BaseParser {
    /**
     * @param {string} protocolDomain 
     * @param {Object} rule - The matched JSON rule object
     * @param {Document} doc - Document context (defaults to global document)
     */
    constructor(protocolDomain, rule, doc = document) {
        super(protocolDomain);
        this.rule = rule;
        this._doc = doc;
    }

    /**
     * Helper to extract value from DOM based on rule config (String selector or { selector, attr })
     * @private
     */
    _extractValue(root, config) {
        if (!config || !root) return null;
        
        const selector = typeof config === 'string' ? config : config.selector;
        const attr = typeof config === 'object' ? config.attr : null;
        const regexStr = typeof config === 'object' ? config.regex : null;

        const el = selector
            ? (root.matches?.(selector) ? root : root.querySelector(selector))
            : root;
        if (!el) return null;

        let val = null;
        if (attr) {
            val = el.getAttribute(attr)?.trim() || null;
        } else {
            val = el.innerText?.trim() || el.textContent?.trim() || null;
        }

        if (val && regexStr) {
            try {
                const regex = new RegExp(regexStr, 'i');
                const match = val.match(regex);
                if (match) {
                    val = match[1] || match[0];
                } else {
                    val = null;
                }
            } catch (e) {
                console.warn(`[GenericParser] Invalid regex pattern: ${regexStr}`, e);
            }
        }

        return val;
    }

    /**
     * [v1.8.1] 동적 레이지 키 탐지 (Toki 등 보안 우회용)
     * @private
     */
    _detectDynamicKey(doc, config) {
        if (!config || !config.regex) return null;
        
        try {
            // 1. 스크립트 태그 우선 스캔 (성능 및 정확도 최적화)
            const scripts = doc.querySelectorAll('script');
            const regex = new RegExp(config.regex, 'i');
            
            for (const script of scripts) {
                const match = (script.textContent || "").match(regex);
                if (match) {
                    const key = match[1] || match[0];
                    console.log(`[GenericParser] 스크립트 내 동적 키 탐지 성공: ${key}`);
                    return key;
                }
            }
            
            // 2. 전체 HTML 스캔 (폴백)
            const html = doc.documentElement.innerHTML || "";
            const match = html.match(regex);
            if (match) {
                const key = match[1] || match[0];
                console.log(`[GenericParser] HTML 내 동적 키 탐지 성공: ${key}`);
                return key;
            }
        } catch (e) {
            console.warn('[GenericParser] 동적 키 탐지 중 오류 발생:', e);
        }
        return null;
    }

    /**
     * Extracts the Series ID based on JSON rule, with a robust fallback.
     */
    getSeriesId() {
        const ext = this.rule.idExtraction;
        if (ext) {
            if (ext.source === 'url' && ext.regex) {
                try {
                    const regex = new RegExp(ext.regex, 'i');
                    const match = this._doc.URL.match(regex);
                    if (match) return match[1] || match[0];
                } catch(e) {
                    console.warn('[GenericParser] Invalid idExtraction regex', e);
                }
            } else if (ext.source === 'query' && ext.param) {
                const win = this._doc.defaultView || window;
                const params = new URLSearchParams(win.location.search);
                const val = params.get(ext.param);
                if (val) return val;
            } else if (ext.source === 'dom' && ext.selector) {
                const el = this._doc.querySelector(ext.selector);
                if (el) {
                    return ext.attr ? el.getAttribute(ext.attr) : el.innerText?.trim();
                }
            }
        }
        
        // Fallback: Dynamic Category-Aware Extraction
        const category = (this.rule.category || 'webtoon').toLowerCase();
        const categorySynonyms = {
            manga: ['manga', 'manhwa', 'comic', 'toon'],
            webtoon: ['webtoon', 'toon', 'comic', 'manga', 'manhwa'],
            novel: ['novel', 'book']
        };
        const targetWords = categorySynonyms[category] || [category];
        const dynamicPattern = new RegExp(`\\/(${targetWords.join('|')})\\/([a-zA-Z0-9_\\-]+)`, 'i');
        const idMatch = this._doc.URL.match(dynamicPattern);
        let seriesId = idMatch ? idMatch[2] : null;
        if (!seriesId) {
            const win = this._doc.defaultView || window;
            const params = new URLSearchParams(win.location.search);
            seriesId = params.get('id') || params.get('no') || params.get('comic_id') || params.get('toon');
        }
        return seriesId || "0000";
    }

    /**
     * 단일 Document 객체에서 회차 목록 아이템 추출
     * @private
     */
    _extractItemsFromDoc(doc, listCfg) {
        if (!doc || typeof doc.querySelectorAll !== 'function' || !listCfg.container) return [];
        const containers = Array.from(doc.querySelectorAll(listCfg.container));
        if (containers.length === 0) return [];
        const container = containers.find(c => c.querySelectorAll(listCfg.item).length > 0) || containers[0];
        return container ? Array.from(container.querySelectorAll(listCfg.item)) : [];
    }

    /**
     * 현재 문서에서 페이지네이션(1, 2, 3...) 정보를 탐지하여 페이지 번호 -> URL 매핑 및 패턴 반환
     * @private
     */
    _detectPaginationInfo(doc, baseUrlStr) {
        if (!doc || typeof doc.querySelectorAll !== 'function' || !baseUrlStr) return null;
        let baseUrl;
        try {
            baseUrl = new URL(baseUrlStr, this.protocolDomain || 'http://localhost');
        } catch (e) {
            return null;
        }

        const listCfg = this.rule.list || {};
        const pagSelectors = [
            ...(listCfg.pagination ? [listCfg.pagination] : []),
            '.pagination a[href]',
            '.pg_wrap a[href]',
            '.paging a[href]',
            '.page-box a[href]',
            '.ep-pagination a[href]',
            'nav[aria-label*="page" i] a[href]',
            '[class*="pagin"] a[href]',
            '[class*="pager"] a[href]',
            'a[href*="spage="]',
            'a[href*="page="]'
        ];

        const anchors = [];
        const seenEl = new Set();
        for (const sel of pagSelectors) {
            try {
                for (const a of Array.from(doc.querySelectorAll(sel))) {
                    if (!seenEl.has(a)) {
                        seenEl.add(a);
                        anchors.push(a);
                    }
                }
            } catch (e) {}
        }

        if (anchors.length === 0) return null;

        // 1. spage 파라미터 우선 확인 (그누보드 토끼 계열의 회차 목록 전용 페이지 파라미터)
        const paramCandidates = ['spage', 'ep_page', 'cpage', 'page', 'p'];
        for (const paramName of paramCandidates) {
            const pageNumbers = new Set();
            for (const a of anchors) {
                const rawHref = a.getAttribute('href');
                if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript')) continue;
                try {
                    const u = new URL(rawHref, baseUrl.href);
                    if (u.pathname !== baseUrl.pathname) continue;
                    const val = u.searchParams.get(paramName);
                    if (val && /^\d+$/.test(val)) {
                        const num = parseInt(val, 10);
                        if (num >= 1 && num <= 500) pageNumbers.add(num);
                    }
                } catch (e) {}
            }

            if (pageNumbers.size > 0) {
                const currentVal = baseUrl.searchParams.get(paramName);
                const currentPage = (currentVal && /^\d+$/.test(currentVal)) ? parseInt(currentVal, 10) : 1;
                pageNumbers.add(currentPage);
                const maxPage = Math.max(...Array.from(pageNumbers));
                if (maxPage > 1) {
                    return {
                        type: 'query',
                        paramName,
                        currentPage,
                        maxPage,
                        buildUrl: (pageNum) => {
                            const u = new URL(baseUrl.href);
                            u.searchParams.set(paramName, String(pageNum));
                            return u.href;
                        }
                    };
                }
            }
        }

        // 2. 경로 기반 페이지네이션 확인 (예: /novel/20/page/2)
        const basePathClean = baseUrl.pathname.replace(/\/(page|p)\/\d+\/?$/i, '').replace(/\/+$/, '');
        const pathRegex = new RegExp(`^${basePathClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\/(page|p)\/(\d+)\/?$`, 'i');
        let pathWord = 'page';
        const pathPages = new Set();
        for (const a of anchors) {
            const rawHref = a.getAttribute('href');
            if (!rawHref) continue;
            try {
                const u = new URL(rawHref, baseUrl.href);
                const m = u.pathname.match(pathRegex);
                if (m) {
                    pathWord = m[1];
                    const num = parseInt(m[2], 10);
                    if (num >= 1 && num <= 500) pathPages.add(num);
                }
            } catch (e) {}
        }
        if (pathPages.size > 0) {
            const curMatch = baseUrl.pathname.match(pathRegex);
            const currentPage = curMatch ? parseInt(curMatch[2], 10) : 1;
            pathPages.add(currentPage);
            const maxPage = Math.max(...Array.from(pathPages));
            if (maxPage > 1) {
                return {
                    type: 'path',
                    currentPage,
                    maxPage,
                    buildUrl: (pageNum) => {
                        const u = new URL(baseUrl.href);
                        u.pathname = pageNum === 1 ? basePathClean : `${basePathClean}/${pathWord}/${pageNum}`;
                        return u.href;
                    }
                };
            }
        }

        return null;
    }

    /**
     * SPA 버튼 클릭형 페이지네이션(href 없이 클릭으로 목록이 교체되는 구조) 자동 순회 수집
     * @private
     */
    async _collectViaButtonPagination(listCfg, currentPageItems) {
        if (!this._doc || typeof this._doc.querySelectorAll !== 'function') return null;

        const pagContainers = Array.from(this._doc.querySelectorAll(
            '.pagination, .ep-pagination, .paging, .pg_wrap, [class*="pagin"], [class*="pager"], nav[aria-label*="page" i]'
        ));
        if (pagContainers.length === 0) return null;

        const pagRoot = pagContainers[0];
        const getNumberButtons = () => {
            const btns = Array.from(pagRoot.querySelectorAll('button, a:not([href]), a[href="#"], a[href^="javascript"], span[role="button"], li'));
            const map = new Map();
            for (const b of btns) {
                const txt = (b.textContent || '').trim();
                if (/^\d+$/.test(txt)) {
                    const num = parseInt(txt, 10);
                    if (num >= 1 && num <= 500 && !map.has(num)) {
                        map.set(num, b);
                    }
                }
            }
            return map;
        };

        const initialBtnMap = getNumberButtons();
        if (initialBtnMap.size <= 1) return null;

        console.log(`[GenericParser] 🖱️ SPA 버튼형 페이지네이션 감지 (${initialBtnMap.size}개 페이지 버튼) -> 순차 클릭 수집을 시작합니다.`);

        const cloneItems = (items) => items.map(el => (typeof el.cloneNode === 'function' ? el.cloneNode(true) : el));
        const allClonedPages = new Map();
        allClonedPages.set(1, cloneItems(currentPageItems));

        const getFirstSignature = () => {
            const items = this._extractItemsFromDoc(this._doc, listCfg);
            if (items.length === 0) return '';
            const p = this.parseListItem(items[0]);
            return `${p.num}_${p.title}_${p.src}`;
        };

        const visitedPages = new Set([1]);
        let maxDiscovered = Math.max(...Array.from(initialBtnMap.keys()));

        for (let pNum = 2; pNum <= Math.min(maxDiscovered, 100); pNum++) {
            const btnMap = getNumberButtons();
            const targetBtn = btnMap.get(pNum);
            if (!targetBtn || typeof targetBtn.click !== 'function') continue;

            const prevSig = getFirstSignature();
            targetBtn.click();
            visitedPages.add(pNum);

            // DOM 목록 교체 대기 (최대 2.5초 폴링)
            let waited = 0;
            while (waited < 2500) {
                await new Promise(r => setTimeout(r, 150));
                waited += 150;
                const newSig = getFirstSignature();
                if (newSig && newSig !== prevSig) break;
            }

            const newItems = this._extractItemsFromDoc(this._doc, listCfg);
            if (newItems.length > 0) {
                allClonedPages.set(pNum, cloneItems(newItems));
            }

            const updatedBtnMap = getNumberButtons();
            const newMax = Math.max(...Array.from(updatedBtnMap.keys()));
            if (newMax > maxDiscovered) maxDiscovered = newMax;
        }

        // 원래 1페이지로 화면 복구
        const finalBtnMap = getNumberButtons();
        const page1Btn = finalBtnMap.get(1);
        if (page1Btn && typeof page1Btn.click === 'function') {
            page1Btn.click();
            await new Promise(r => setTimeout(r, 150));
        }

        const merged = [];
        const seenKeys = new Set();
        const sortedPages = Array.from(allClonedPages.keys()).sort((a, b) => a - b);
        for (const pNum of sortedPages) {
            for (const el of (allClonedPages.get(pNum) || [])) {
                const parsed = this.parseListItem(el);
                const key = parsed.src || `${parsed.num}_${parsed.title}`;
                if (key && seenKeys.has(key)) continue;
                if (key) seenKeys.add(key);
                merged.push(el);
            }
        }
        return merged;
    }

    /**
     * 원격 페이지 HTML을 가져와 Document로 파싱
     * @private
     */
    async _fetchPageDocument(pageUrl) {
        if (typeof fetch !== 'function') return null;
        try {
            const resp = await fetch(pageUrl, { credentials: 'same-origin' });
            if (!resp.ok) return null;
            const html = await resp.text();
            if (typeof DOMParser !== 'undefined') {
                return new DOMParser().parseFromString(html, 'text/html');
            }
        } catch (e) {
            console.warn(`[GenericParser] 페이지 로드 실패 (${pageUrl}):`, e);
        }
        return null;
    }

    /**
     * 회차 목록 아이템 반환 (다중 페이지 1, 2, 3... 자동 순회 수집 포함)
     * @param {Object} [options]
     * @param {boolean} [options.allPages=true] 모든 페이지네이션을 순회하여 전체 회차를 가져올지 여부
     * @param {boolean} [options.forceRefresh=false] 캐시 무시 여부
     */
    async getListItems(options = {}) {
        const { allPages = true, forceRefresh = false } = options;
        const listCfg = this.rule.list || {};
        
        // [v1.25.1] 스마트 컨테이너 검출: 동일한 셀렉터의 컨테이너가 여러 개 있을 때
        // 실제 회차 아이템(listCfg.item)을 하나 이상 가지고 있는 첫 번째 유효 컨테이너를 탐색합니다.
        let container = null;
        const containers = Array.from(this._doc.querySelectorAll(listCfg.container));
        if (containers.length > 0) {
            container = containers.find(c => c.querySelectorAll(listCfg.item).length > 0) || containers[0];
        }
        
        // [v1.8.1] 동적 로딩(Next.js 등) 대응: 컨테이너가 나타날 때까지 대기
        if (!container) {
            console.log(`[GenericParser] 컨테이너(${listCfg.container}) 대기 중...`);
            container = await this.waitForSelector(listCfg.container, 5000);
        }

        if (!container) {
            console.warn(`[GenericParser] Container not found: ${listCfg.container}`);
            return [];
        }

        const currentPageItems = Array.from(container.querySelectorAll(listCfg.item));
        if (!allPages || currentPageItems.length === 0) {
            return currentPageItems;
        }

        const currentUrl = this._doc.URL || (typeof window !== 'undefined' && window.location ? window.location.href : '');
        if (!forceRefresh && this._cachedAllPageItems && this._cachedAllPageUrl === currentUrl) {
            return this._cachedAllPageItems;
        }

        // 1. URL 기반 페이지네이션 감지 (?page=2, ?spage=2, /page/2 등)
        const pagInfo = this._detectPaginationInfo(this._doc, currentUrl);
        if (!pagInfo || pagInfo.maxPage <= 1) {
            // 2. URL 링크가 없는 경우: SPA 버튼 클릭형 페이지네이션(1, 2, 3 버튼) 폴백 시도
            const btnMerged = await this._collectViaButtonPagination(listCfg, currentPageItems);
            if (btnMerged && btnMerged.length > currentPageItems.length) {
                this._cachedAllPageUrl = currentUrl;
                this._cachedAllPageItems = btnMerged;
                return btnMerged;
            }
            return currentPageItems;
        }

        console.log(`[GenericParser] 📄 다중 페이지 감지 (현재 ${pagInfo.currentPage}p / 확인된 최대 ${pagInfo.maxPage}p) -> 전체 페이지 자동 수집을 시작합니다.`);

        const pageItemsMap = new Map();
        pageItemsMap.set(pagInfo.currentPage, currentPageItems);

        const fetchedPages = new Set([pagInfo.currentPage]);
        let knownMaxPage = Math.min(pagInfo.maxPage, 100);
        const BATCH_CONCURRENCY = 4;

        // 1..knownMaxPage 순회 (10페이지 단위 블록 페이지네이션에서 다음 블록이 발견되면 knownMaxPage 자동 확장)
        let nextPageToFetch = 1;
        while (nextPageToFetch <= knownMaxPage) {
            const batchPages = [];
            while (batchPages.length < BATCH_CONCURRENCY && nextPageToFetch <= knownMaxPage) {
                if (!fetchedPages.has(nextPageToFetch)) {
                    batchPages.push(nextPageToFetch);
                    fetchedPages.add(nextPageToFetch);
                }
                nextPageToFetch++;
            }

            if (batchPages.length === 0) break;

            const results = await Promise.all(batchPages.map(async (pNum) => {
                const pageUrl = pagInfo.buildUrl(pNum);
                const pageDoc = await this._fetchPageDocument(pageUrl);
                if (!pageDoc) return { pNum, items: [], nextMax: pNum };

                const items = this._extractItemsFromDoc(pageDoc, listCfg);
                const subPag = this._detectPaginationInfo(pageDoc, pageUrl);
                const nextMax = subPag ? subPag.maxPage : pNum;
                return { pNum, items, nextMax };
            }));

            for (const { pNum, items, nextMax } of results) {
                if (items && items.length > 0) {
                    pageItemsMap.set(pNum, items);
                }
                if (nextMax > knownMaxPage && nextMax <= 100) {
                    knownMaxPage = nextMax;
                }
            }
        }

        // 페이지 순서(1p, 2p, 3p...)대로 병합 및 중복 회차(공지 등) 제거
        const sortedPageNums = Array.from(pageItemsMap.keys()).sort((a, b) => a - b);
        const mergedItems = [];
        const seenKeys = new Set();

        for (const pNum of sortedPageNums) {
            const items = pageItemsMap.get(pNum) || [];
            for (const el of items) {
                try {
                    const parsed = this.parseListItem(el);
                    const dedupKey = parsed.src || `${parsed.num}_${parsed.title}`;
                    if (dedupKey && seenKeys.has(dedupKey)) continue;
                    if (dedupKey) seenKeys.add(dedupKey);
                    mergedItems.push(el);
                } catch (e) {
                    mergedItems.push(el);
                }
            }
        }

        console.log(`[GenericParser] ✅ 전체 ${sortedPageNums.length}개 페이지 병합 완료: 총 ${mergedItems.length}개 회차 추출됨.`);
        this._cachedAllPageUrl = currentUrl;
        this._cachedAllPageItems = mergedItems;
        return mergedItems;
    }

    parseListItem(el) {
        const listCfg = this.rule.list || {};
        let numRaw = "0";
        const numCfg = listCfg.num;
        if (Array.isArray(numCfg)) {
            for (const cfg of numCfg) {
                const val = this._extractValue(el, cfg);
                if (val) {
                    numRaw = val;
                    break;
                }
            }
        } else {
            numRaw = this._extractValue(el, numCfg) || "0";
        }
        const subRaw = this._extractValue(el, listCfg.sub) || "";
        const title = this._extractValue(el, listCfg.title) || "Unknown";
        const src = this._extractValue(el, listCfg.link) || "";

        // Extract numbers only for zero padding, if possible
        let num = numRaw;
        const match = numRaw.match(/(\d+)/);
        if (match) {
            num = match[1];
        }

        if (subRaw) {
            num = `${num}_${subRaw}`;
        }

        return {
            num: num,
            title: title,
            src: this.getAbsoluteUrl(src),
            element: el
        };
    }

    getNovelContent(iframeDocument) {
        const viewerCfg = this.rule.viewer || {};
        const selector = viewerCfg.novelContent || 'body';

        // 일반 querySelector는 Shadow DOM 경계를 관통하지 못하므로,
        // 익명(anonymous) Shadow Host 내부에만 존재하는 본문 컨테이너 대응
        const el = iframeDocument.querySelector(selector)
                || this._deepQuerySelector(iframeDocument, [selector, '.novel-epub-rendered', '.theme-novel-content']);

        if (!el) return "";
        const searchRoot = el.shadowRoot || el;
        return searchRoot.innerText || searchRoot.textContent || "";
    }

    /**
     * @private
     */
    _deepQuerySelector(root, selectors) {
        for (const sel of selectors) {
            try {
                const found = root.querySelector(sel);
                if (found) return found;
            } catch (e) {}
        }
        const children = root.querySelectorAll('*');
        for (const child of children) {
            if (child.shadowRoot) {
                const found = this._deepQuerySelector(child.shadowRoot, selectors);
                if (found) return found;
            }
        }
        return null;
    }

    getImageList(iframeDocument) {
        const viewerCfg = this.rule.viewer || {};

        // [v1.8.1] 동적 키 탐지 수행
        let dynamicLazyAttr = null;
        if (viewerCfg.keyDiscovery) {
            const key = this._detectDynamicKey(iframeDocument, viewerCfg.keyDiscovery);
            if (key) {
                dynamicLazyAttr = (viewerCfg.keyDiscovery.prefix || 'data-') + key;
            }
        }

        // 1. 헤드리스(Headless) 정규식 추출 지원 (Next.js 페이로드 등 DOM 미렌더링 대응)
        if (viewerCfg.imageRegex) {
            const html = iframeDocument.documentElement.innerHTML || iframeDocument.body.innerHTML;
            const regex = new RegExp(viewerCfg.imageRegex, 'g');
            const urls = [];
            let match;
            
            while ((match = regex.exec(html)) !== null) {
                // 캡처 그룹이 있으면 그것을, 없으면 전체 매치(match[0])를 사용
                let url = match[1] || match[0];
                url = url.replace(/\\/g, ''); // 불필요한 이스케이프 백슬래시(\) 제거
                
                if (!this.isDummyUrl(url)) {
                    urls.push(this.getAbsoluteUrl(url));
                }
            }
            
            // 중복 제거 후 리턴 (정규식 특성상 중복 캡처 가능성 높음)
            const uniqueUrls = Array.from(new Set(urls));
            if (uniqueUrls.length > 0) {
                console.log(`[GenericParser] Regex 기반 이미지 추출 성공: ${uniqueUrls.length}개 발견`);
                return uniqueUrls.map(url => ({ url, isDummy: false }));
            } else {
                console.warn(`[GenericParser] Regex 설정이 있으나 매칭되는 이미지를 찾지 못했습니다.`);
            }
        }

        // 2. DOM 기반 추출 (기본) — 쉼표 구분 컨테이너의 경우 선언 우선순위대로 탐색
        let container = iframeDocument;
        if (viewerCfg.imageContainer) {
            const candidateSelectors = viewerCfg.imageContainer.split(',').map(s => s.trim()).filter(Boolean);
            container = null;
            for (const sel of candidateSelectors) {
                const found = iframeDocument.querySelector(sel);
                if (found && found.querySelectorAll(viewerCfg.imageItem || 'img').length > 0) {
                    container = found;
                    break;
                }
            }
            if (!container) {
                container = iframeDocument.querySelector(viewerCfg.imageContainer);
            }
            if (!container) {
                console.warn(`[GenericParser] 지정된 imageContainer(${viewerCfg.imageContainer})를 DOM에서 찾지 못했습니다.`);
                return [];
            }
        }

        // [v1.9.5] 광고 및 불필요 요소 제거 (exclude / remove)
        const excludeRule = viewerCfg.exclude || viewerCfg.remove;
        if (excludeRule) {
            const excludeSelectors = Array.isArray(excludeRule) ? excludeRule : [excludeRule];
            for (const selector of excludeSelectors) {
                try {
                    const targets = container.querySelectorAll(selector);
                    targets.forEach(el => el.remove());
                } catch (e) {
                    console.warn(`[GenericParser] 요소 제거 실패 (셀렉터: ${selector}):`, e);
                }
            }
        }

        const imgs = Array.from(container.querySelectorAll(viewerCfg.imageItem || 'img'));

        return imgs.map(img => {
            let foundUrl = null;
            // [v1.8.1] 동적 키가 발견되면 최우선 순위로 설정하여 탐지 성공률 극대화
            const lazyAttrs = [
                ...(dynamicLazyAttr ? [dynamicLazyAttr] : []),
                ...(viewerCfg.lazyAttrOptions || ['data-src', 'data-lazy', 'src'])
            ];

            for (const attr of lazyAttrs) {
                const val = img.getAttribute(attr);
                if (val) {
                    const absoluteUrl = this.getAbsoluteUrl(val);
                    if (absoluteUrl && !this.isDummyUrl(absoluteUrl)) {
                        foundUrl = absoluteUrl;
                        break;
                    }
                }
            }

            const finalUrl = foundUrl || this.getAbsoluteUrl(img.src) || "";
            return {
                url: finalUrl,
                isDummy: this.isDummyUrl(finalUrl)
            };
        });
    }

    getThumbnailUrl() {
        const meta = this.rule.meta || {};
        const thumb = this._extractValue(this._doc, meta.thumb);
        return thumb ? this.getAbsoluteUrl(thumb) : null;
    }

    getSeriesTitle() {
        const meta = this.rule.meta || {};
        return this._extractValue(this._doc, meta.title);
    }

    getSeriesMetadata() {
        const meta = this.rule.meta || {};
        const vendorSlug = (this.rule.name || "").toLowerCase().replace(/[^a-z0-9]/g, '');
        return {
            author: this._extractValue(this._doc, meta.author) || "",
            status: this._extractValue(this._doc, meta.status) || "연재중",
            summary: this._extractValue(this._doc, meta.summary) || "",
            vendor: vendorSlug,
            vendorId: this.rule.id || vendorSlug
        };
    }

    getViewerMetadata(viewerDocument) {
        const viewerCfg = this.rule.viewer || {};
        
        let seriesTitle = this._extractValue(viewerDocument, viewerCfg.seriesTitle) || "UnknownSeries";
        let episodeTitle = this._extractValue(viewerDocument, viewerCfg.episodeTitle) || "UnknownEpisode";
        let episodeNum = this._extractValue(viewerDocument, viewerCfg.episodeNum) || "0000";

        // Clean up episodeNum
        const match = episodeNum.match(/(\d+)/);
        if (match) {
            episodeNum = match[1];
        }

        return {
            seriesTitle,
            episodeTitle,
            episodeNum
        };
    }
}
