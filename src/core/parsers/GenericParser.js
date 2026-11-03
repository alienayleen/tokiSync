import { BaseParser } from './BaseParser.js';

/**
 * GenericParser
 * A dynamic parser that uses JSON rules (and smart fallbacks) to extract data from the DOM.
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
     * Helper to extract value from DOM based on rule config (String, Object { selector, attr, regex }, or Array of configs)
     * @private
     */
    _extractValue(root, config, cleanBadges = false) {
        if (!config || !root) return null;

        if (Array.isArray(config)) {
            for (const subCfg of config) {
                const val = this._extractValue(root, subCfg, cleanBadges);
                if (val) return val;
            }
            return null;
        }

        const rawSelector = typeof config === 'string' ? config : config.selector;
        const attr = typeof config === 'object' ? config.attr : null;
        const regexStr = typeof config === 'object' ? config.regex : null;

        // 쉼표(,)로 구분된 복수 셀렉터의 경우 선언된 우선순위대로 탐색
        let el = null;
        if (rawSelector) {
            const selectors = rawSelector.split(',').map(s => s.trim()).filter(Boolean);
            for (const sel of selectors) {
                try {
                    const candidate = root.matches?.(sel) ? root : root.querySelector(sel);
                    if (candidate) {
                        if (attr && candidate.getAttribute?.(attr)) {
                            el = candidate;
                            break;
                        } else if (!attr && (candidate.innerText?.trim() || candidate.textContent?.trim())) {
                            el = candidate;
                            break;
                        }
                        if (!el) el = candidate;
                    }
                } catch (e) {}
            }
        } else {
            el = root;
        }

        if (!el) return null;

        let val = null;
        if (attr) {
            val = el.getAttribute?.(attr)?.trim() || null;
        } else {
            if (cleanBadges && typeof el.cloneNode === 'function') {
                try {
                    const clone = el.cloneNode(true);
                    if (typeof clone.querySelectorAll === 'function') {
                        clone.querySelectorAll('.count, .orangered, .wr-icon, .ep-badge-new, .ep-badge-ready, .sound_only, .sub').forEach(n => n.remove());
                    }
                    val = clone.innerText?.trim() || clone.textContent?.trim() || null;
                } catch (e) {
                    val = el.innerText?.trim() || el.textContent?.trim() || null;
                }
            } else {
                val = el.innerText?.trim() || el.textContent?.trim() || null;
            }
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

        return val ? val.replace(/\s+/g, ' ').trim() : null;
    }

    /**
     * [v1.8.1] 동적 레이지 키 탐지 (Toki 등 보안 우회용)
     * @private
     */
    _detectDynamicKey(doc, config) {
        if (!config || !config.regex) return null;
        
        try {
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
                    const match = (this._doc?.URL || '').match(regex);
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
        
        const category = (this.rule.category || 'webtoon').toLowerCase();
        const categorySynonyms = {
            manga: ['manga', 'manhwa', 'comic', 'toon'],
            webtoon: ['webtoon', 'toon', 'comic', 'manga', 'manhwa'],
            novel: ['novel', 'book']
        };
        const targetWords = categorySynonyms[category] || [category];
        const dynamicPattern = new RegExp(`\\/(${targetWords.join('|')})\\/([a-zA-Z0-9_\\-]+)`, 'i');
        const idMatch = (this._doc?.URL || '').match(dynamicPattern);
        let seriesId = idMatch ? idMatch[2] : null;
        if (!seriesId) {
            const win = this._doc.defaultView || window;
            const params = new URLSearchParams(win.location?.search || '');
            seriesId = params.get('id') || params.get('no') || params.get('comic_id') || params.get('toon');
        }
        return seriesId || "0000";
    }

    /**
     * 단일 Document 객체에서 회차 목록 아이템 추출 (복수 컨테이너/아이템 셀렉터 우선순위 지원)
     * @private
     */
    _extractItemsFromDoc(doc, listCfg) {
        if (!doc || typeof doc.querySelectorAll !== 'function' || !listCfg.container) return [];
        const containerSelectors = String(listCfg.container).split(',').map(s => s.trim()).filter(Boolean);
        const itemSelectors = String(listCfg.item || 'li').split(',').map(s => s.trim()).filter(Boolean);

        for (const cSel of containerSelectors) {
            let containers = [];
            try {
                containers = Array.from(doc.querySelectorAll(cSel));
            } catch (e) {}
            for (const cont of containers) {
                for (const iSel of itemSelectors) {
                    try {
                        const items = Array.from(cont.querySelectorAll(iSel));
                        if (items.length > 0) return items;
                    } catch (e) {}
                }
            }
        }
        return [];
    }

    /**
     * Base64 URL-safe 디코딩 헬퍼 (newtoki1.org /__q/<base64> 대응)
     * @private
     */
    _decodeBase64Query(b64Str) {
        try {
            const normalized = b64Str.replace(/-/g, '+').replace(/_/g, '/');
            const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
            return atob(normalized + pad);
        } catch (e) {
            return null;
        }
    }

    /**
     * Base64 인코딩 헬퍼 (원본 패딩 스타일 유지)
     * @private
     */
    _encodeBase64Query(queryStr, keepPadding = false) {
        try {
            const encoded = btoa(queryStr);
            return keepPadding ? encoded : encoded.replace(/=+$/, '');
        } catch (e) {
            return '';
        }
    }

    /**
     * 페이지 내 표시된 총 회차 수(예: "총 1,307회차")를 기반으로 예상 최대 페이지 수 추정
     * @private
     */
    _estimateMaxPagesFromTotalCount(doc, perPageCount) {
        if (!doc || typeof doc.querySelector !== 'function' || !perPageCount || perPageCount < 5) return 1;
        const countSelectors = ['.ep-section-count', '.stat-num', '.page-desc', '.view-content'];
        for (const sel of countSelectors) {
            try {
                const el = doc.querySelector(sel);
                const txt = el?.textContent || '';
                const m = txt.match(/총\s*([0-9,]+)\s*(?:회차|화|편)/) || (sel === '.ep-section-count' ? txt.match(/([0-9,]+)/) : null);
                if (m) {
                    const total = parseInt(m[1].replace(/,/g, ''), 10);
                    if (total > perPageCount && total <= 20000) {
                        return Math.ceil(total / perPageCount);
                    }
                }
            } catch (e) {}
        }
        return 1;
    }

    /**
     * 현재 문서에서 페이지네이션(1, 2, 3...) 정보를 탐지하여 페이지 번호 -> URL 생성기 반환
     * - ?spage=N, ?page=N, ?p=N
     * - /__q/<base64(page=N)> (newtoki1.org 방식)
     * - /page/N, /p/N
     * @private
     */
    _detectPaginationInfo(doc, baseUrlStr, currentItemCount = 0) {
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
            '.ep-section a[href]',
            '.pagination a[href]',
            '.pg_wrap a[href]',
            '.paging a[href]',
            '.page-box a[href]',
            '.ep-pagination a[href]',
            '.ep-page a[href]',
            'nav[aria-label*="page" i] a[href]',
            '[class*="pagin"] a[href]',
            '[class*="pager"] a[href]',
            'a[href*="__q/"]',
            'a[href*="spage="]',
            'a[href*="page="]'
        ];

        const anchors = [];
        const seenEl = new Set();
        for (const sel of pagSelectors) {
            try {
                for (const a of Array.from(doc.querySelectorAll(sel))) {
                    if (seenEl.has(a)) continue;
                    // 댓글(Comment) 페이지네이션 영역 내부의 링크는 철저히 배제
                    if (a.closest?.('#bo_vc, .view-comment, #comment, #comments, [class*="comment"], [id*="comment"]')) {
                        continue;
                    }
                    seenEl.add(a);
                    anchors.push(a);
                }
            } catch (e) {}
        }

        if (anchors.length === 0) return null;

        const cleanBasePath = baseUrl.pathname
            .replace(/\/__q\/[A-Za-z0-9+/=_-]+\/?$/, '')
            .replace(/\/(page|p)\/\d+\/?$/i, '')
            .replace(/\/+$/, '');

        const estimatedMax = this._estimateMaxPagesFromTotalCount(doc, currentItemCount);

        // 1. newtoki1.org 방식의 /__q/<base64> 경로 페이지네이션 탐지
        const b64Pages = new Set();
        let b64ParamKey = 'page';
        let b64TemplateQuery = 'page=1';
        let b64KeepPadding = false;

        for (const a of anchors) {
            const rawHref = a.getAttribute('href');
            if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript')) continue;
            try {
                const u = new URL(rawHref, baseUrl.href);
                const qMatch = u.pathname.match(/^(.*)\/__q\/([A-Za-z0-9+/=_-]+)\/?$/);
                if (!qMatch) continue;
                const linkBasePath = qMatch[1].replace(/\/+$/, '');
                if (linkBasePath !== cleanBasePath) continue;

                const rawB64 = qMatch[2];
                const decoded = this._decodeBase64Query(rawB64);
                if (!decoded) continue;

                const sp = new URLSearchParams(decoded);
                const key = sp.has('spage') ? 'spage' : (sp.has('page') ? 'page' : (sp.has('p') ? 'p' : null));
                if (key) {
                    const val = sp.get(key);
                    if (val && /^\d+$/.test(val)) {
                        const num = parseInt(val, 10);
                        if (num >= 1 && num <= 500) {
                            b64Pages.add(num);
                            b64ParamKey = key;
                            b64TemplateQuery = decoded;
                            b64KeepPadding = rawB64.endsWith('=');
                        }
                    }
                }
            } catch (e) {}
        }

        if (b64Pages.size > 0) {
            let currentPage = 1;
            const curQMatch = baseUrl.pathname.match(/\/__q\/([A-Za-z0-9+/=_-]+)\/?$/);
            if (curQMatch) {
                const curDecoded = this._decodeBase64Query(curQMatch[1]);
                const curSp = new URLSearchParams(curDecoded || '');
                const curVal = curSp.get(b64ParamKey);
                if (curVal && /^\d+$/.test(curVal)) currentPage = parseInt(curVal, 10);
            }
            b64Pages.add(currentPage);
            const maxPage = Math.max(...Array.from(b64Pages), estimatedMax);
            if (maxPage > 1) {
                return {
                    type: 'b64_query',
                    paramName: b64ParamKey,
                    currentPage,
                    maxPage,
                    buildUrl: (pageNum) => {
                        const u = new URL(baseUrl.href);
                        u.search = '';
                        if (pageNum === 1) {
                            u.pathname = cleanBasePath;
                            return u.href;
                        }
                        const sp = new URLSearchParams(b64TemplateQuery);
                        sp.set(b64ParamKey, String(pageNum));
                        const encoded = this._encodeBase64Query(sp.toString(), b64KeepPadding);
                        u.pathname = `${cleanBasePath}/__q/${encoded}`;
                        return u.href;
                    }
                };
            }
        }

        // 2. 일반 Query 파라미터 기반 페이지네이션 (?spage=2, ?ep_page=2, ?page=2, ?p=2) — 댓글용 cpage 제외!
        const paramCandidates = ['spage', 'ep_page', 'page', 'p'];
        for (const paramName of paramCandidates) {
            const pageNumbers = new Set();
            for (const a of anchors) {
                const rawHref = a.getAttribute('href');
                if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript')) continue;
                try {
                    const u = new URL(rawHref, baseUrl.href);
                    const uCleanPath = u.pathname.replace(/\/+$/, '');
                    if (uCleanPath !== cleanBasePath) continue;
                    // 댓글 앵커(#bo_vc 등)로 점프하는 링크 배제
                    if (u.hash && /vc|comment/i.test(u.hash)) continue;
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
                const maxPage = Math.max(...Array.from(pageNumbers), estimatedMax);
                if (maxPage > 1) {
                    return {
                        type: 'query',
                        paramName,
                        currentPage,
                        maxPage,
                        buildUrl: (pageNum) => {
                            const u = new URL(baseUrl.href);
                            u.pathname = cleanBasePath;
                            u.searchParams.set(paramName, String(pageNum));
                            return u.href;
                        }
                    };
                }
            }
        }

        // 3. 경로 기반 페이지네이션 확인 (예: /novel/20/page/2 또는 /novel/20/p/2)
        const pathRegex = new RegExp(`^${cleanBasePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\/(page|p)\/(\d+)\/?$`, 'i');
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
            const maxPage = Math.max(...Array.from(pathPages), estimatedMax);
            if (maxPage > 1) {
                return {
                    type: 'path',
                    currentPage,
                    maxPage,
                    buildUrl: (pageNum) => {
                        const u = new URL(baseUrl.href);
                        u.pathname = pageNum === 1 ? cleanBasePath : `${cleanBasePath}/${pathWord}/${pageNum}`;
                        return u.href;
                    }
                };
            }
        }

        return null;
    }

    /**
     * 회차 목록 섹션 내의 페이지네이션 바(컨테이너)를 클래스명에 구애받지 않고 탐색
     * @private
     */
    _findPaginationRoot(listCfg) {
        if (!this._doc || typeof this._doc.querySelectorAll !== 'function') return null;

        // 1. 에피소드 리스트 컨테이너의 부모 섹션(.ep-section 등) 내부를 최우선 탐색
        const containerSelectors = String(listCfg.container || '').split(',').map(s => s.trim()).filter(Boolean);
        let listEl = null;
        for (const sel of containerSelectors) {
            try {
                const found = this._doc.querySelector(sel);
                if (found) { listEl = found; break; }
            } catch (e) {}
        }

        const hasPageButtons = (el) => {
            if (!el || typeof el.querySelectorAll !== 'function') return false;
            if (el.closest?.('#bo_vc, .view-comment, #comment, #comments, [class*="comment"], [id*="comment"]')) return false;
            const clickables = Array.from(el.querySelectorAll('button, a, span[role="button"]'));
            let has1 = false, has2 = false;
            for (const c of clickables) {
                const t = (c.textContent || '').replace(/페이지|현재/g, '').trim();
                if (t === '1') has1 = true;
                if (t === '2') has2 = true;
            }
            return has1 && has2;
        };

        if (listEl && listEl.parentElement) {
            const siblings = Array.from(listEl.parentElement.children || []);
            for (const sib of siblings) {
                if (sib === listEl) continue;
                if (hasPageButtons(sib)) return sib;
            }
            if (hasPageButtons(listEl.parentElement)) return listEl.parentElement;
        }

        // 2. 문서 전체에서 알려진 페이지네이션 컨테이너 탐색 (댓글 영역 제외)
        const candidates = Array.from(this._doc.querySelectorAll(
            '.ep-pagination, .ep-page, .ep-pages, .pagination, .paging, .pg_wrap, .page-nav, [class*="pagin"], [class*="pager"], nav[aria-label*="page" i]'
        ));
        for (const cand of candidates) {
            if (hasPageButtons(cand)) return cand;
        }

        return null;
    }

    /**
     * SPA 버튼 클릭형 페이지네이션(« ‹ 1 2 ... 10 … › » 등) 자동 순회 수집
     * - 10페이지 이후(… 뒤의 11, 12, 13페이지)도 '›' (다음) 버튼을 눌러 끝까지 자동 추적
     * @private
     */
    async _collectViaButtonPagination(listCfg, currentPageItems) {
        const pagRoot = this._findPaginationRoot(listCfg);
        if (!pagRoot) return null;

        const getControls = () => {
            const els = Array.from(pagRoot.querySelectorAll('button, a, span[role="button"]'))
                .filter(el => !el.closest?.('ul.ep-list-v2, ul.novel-eps, .list-body, #toon_list'));
            const numMap = new Map();
            let nextBtn = null;
            let firstBtn = null;

            for (const el of els) {
                const rawTxt = (el.textContent || '').trim();
                const cleanNumTxt = rawTxt.replace(/현재|페이지/g, '').trim();
                const aria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '').toLowerCase();
                const isDisabled = el.disabled || el.getAttribute?.('aria-disabled') === 'true' ||
                                   /(disabled|inactive)/i.test(el.className || '');

                if (/^\d+$/.test(cleanNumTxt)) {
                    const num = parseInt(cleanNumTxt, 10);
                    if (num >= 1 && num <= 500 && !numMap.has(num)) {
                        numMap.set(num, { el, isDisabled });
                    }
                } else if (!isDisabled && (rawTxt === '›' || rawTxt === '>' || rawTxt === '다음' || /next|다음/.test(aria))) {
                    nextBtn = el;
                } else if (!isDisabled && (rawTxt === '«' || rawTxt === '<<' || rawTxt === '처음' || /first|처음/.test(aria))) {
                    firstBtn = el;
                }
            }
            return { numMap, nextBtn, firstBtn };
        };

        const initCtrl = getControls();
        if (initCtrl.numMap.size <= 1) return null;

        console.log(`[GenericParser] 🖱️ 페이지네이션 버튼 감지 (초기 버튼 ${initCtrl.numMap.size}개) -> 전체 페이지 순차 수집을 시작합니다.`);

        const cloneItems = (items) => items.map(el => (typeof el.cloneNode === 'function' ? el.cloneNode(true) : el));
        const allClonedPages = [];
        allClonedPages.push(cloneItems(currentPageItems));

        const getListSignature = () => {
            const items = this._extractItemsFromDoc(this._doc, listCfg);
            if (items.length === 0) return '';
            const first = this.parseListItem(items[0]);
            const last = this.parseListItem(items[items.length - 1]);
            return `${items.length}:${first.num}_${first.title}:${last.num}_${last.title}`;
        };

        const seenSignatures = new Set([getListSignature()]);
        let currentPageNum = 1;
        const MAX_SAFETY_PAGES = 100;

        for (let step = 0; step < MAX_SAFETY_PAGES; step++) {
            const targetPageNum = currentPageNum + 1;
            const { numMap, nextBtn } = getControls();
            const targetEntry = numMap.get(targetPageNum);

            let btnToClick = null;
            if (targetEntry && !targetEntry.isDisabled) {
                btnToClick = targetEntry.el;
            } else if (nextBtn) {
                // 1..10 다음의 11페이지처럼 번호가 '…' 뒤에 숨겨진 경우 '›'(다음) 버튼 클릭
                btnToClick = nextBtn;
            }

            if (!btnToClick || typeof btnToClick.click !== 'function') break;

            const prevSig = getListSignature();
            btnToClick.click();

            let changed = false;
            let waited = 0;
            while (waited < 2500) {
                await new Promise(r => setTimeout(r, 120));
                waited += 120;
                const newSig = getListSignature();
                if (newSig && newSig !== prevSig) {
                    changed = true;
                    break;
                }
            }

            if (!changed) break;

            const newSig = getListSignature();
            if (seenSignatures.has(newSig)) break;
            seenSignatures.add(newSig);

            const newItems = this._extractItemsFromDoc(this._doc, listCfg);
            if (newItems.length > 0) {
                allClonedPages.push(cloneItems(newItems));
            }
            currentPageNum = targetPageNum;
        }

        // 수집 완료 후 원래 1페이지로 화면 복구
        const finalCtrl = getControls();
        const restoreBtn = finalCtrl.firstBtn || finalCtrl.numMap.get(1)?.el;
        if (restoreBtn && typeof restoreBtn.click === 'function') {
            restoreBtn.click();
            await new Promise(r => setTimeout(r, 150));
        }

        const merged = [];
        const seenKeys = new Set();
        for (const pageItems of allClonedPages) {
            for (const el of pageItems) {
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

        let currentPageItems = this._extractItemsFromDoc(this._doc, listCfg);

        // 동적 로딩(Next.js Hydration 등) 대응: 컨테이너가 나타날 때까지 대기
        if (currentPageItems.length === 0 && listCfg.container) {
            const firstContSel = String(listCfg.container).split(',')[0].trim();
            console.log(`[GenericParser] 컨테이너(${firstContSel}) 대기 중...`);
            await this.waitForSelector(firstContSel, 5000);
            currentPageItems = this._extractItemsFromDoc(this._doc, listCfg);
        }

        if (currentPageItems.length === 0) {
            console.warn(`[GenericParser] Container/Items not found: ${listCfg.container}`);
            return [];
        }

        if (!allPages) {
            return currentPageItems;
        }

        const currentUrl = this._doc.URL || (typeof window !== 'undefined' && window.location ? window.location.href : '');
        if (!forceRefresh && this._cachedAllPageItems && this._cachedAllPageUrl === currentUrl) {
            return this._cachedAllPageItems;
        }

        // 1. URL 기반 페이지네이션 감지 (?page=2, ?spage=2, /__q/<base64>, /page/2 등)
        const pagInfo = this._detectPaginationInfo(this._doc, currentUrl, currentPageItems.length);
        if (pagInfo && pagInfo.maxPage > 1) {
            console.log(`[GenericParser] 📄 다중 페이지 감지 (유형: ${pagInfo.type}, 현재 ${pagInfo.currentPage}p / 최대 ${pagInfo.maxPage}p) -> 전체 페이지 자동 수집을 시작합니다.`);

            const pageItemsMap = new Map();
            pageItemsMap.set(pagInfo.currentPage, currentPageItems);

            const fetchedPages = new Set([pagInfo.currentPage]);
            let knownMaxPage = Math.min(pagInfo.maxPage, 100);
            const BATCH_CONCURRENCY = 4;

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
                    const subPag = this._detectPaginationInfo(pageDoc, pageUrl, currentPageItems.length);
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

            // URL Fetch 방식으로 2페이지 이상의 고유 회차가 정상 병합된 경우 반환
            if (mergedItems.length > currentPageItems.length) {
                console.log(`[GenericParser] ✅ 전체 ${sortedPageNums.length}개 페이지 병합 완료: 총 ${mergedItems.length}개 회차 추출됨.`);
                this._cachedAllPageUrl = currentUrl;
                this._cachedAllPageItems = mergedItems;
                return mergedItems;
            }
            console.warn('[GenericParser] ⚠️ URL 기반 페이지 요청에서 추가 회차가 감지되지 않아 실시간 버튼 클릭 모드로 전환합니다.');
        }

        // 2. SPA 버튼 클릭형 페이지네이션(« ‹ 1 2 ... 10 … › ») 폴백 수행
        const btnMerged = await this._collectViaButtonPagination(listCfg, currentPageItems);
        if (btnMerged && btnMerged.length > currentPageItems.length) {
            console.log(`[GenericParser] ✅ 버튼 순회 페이지 병합 완료: 총 ${btnMerged.length}개 회차 추출됨.`);
            this._cachedAllPageUrl = currentUrl;
            this._cachedAllPageItems = btnMerged;
            return btnMerged;
        }

        return currentPageItems;
    }

    parseListItem(el) {
        const listCfg = this.rule.list || {};
        const numRaw = this._extractValue(el, listCfg.num, true) || "0";
        const subRaw = this._extractValue(el, listCfg.sub, true) || "";
        let title = this._extractValue(el, listCfg.title, true) || "Unknown";
        const src = this._extractValue(el, listCfg.link, false) || "";

        // 앞쪽의 불필요한 UP / NEW 배지 텍스트 제거
        title = title.replace(/^(UP|NEW)\s+/i, '').trim();

        let num = numRaw;
        const match = numRaw.match(/(\d+)/);
        if (match) {
            num = match[1];
        } else {
            const titleNumMatch = title.match(/(\d+)\s*(?:화|회|편|권)/) || title.match(/^(\d+)/);
            if (titleNumMatch) num = titleNumMatch[1];
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
        const selector = viewerCfg.novelContent || 'article.novel-viewer, #novel_content, body';

        const candidateSelectors = [
            ...String(selector).split(',').map(s => s.trim()).filter(Boolean),
            'article.novel-viewer',
            '#novel_content',
            '.novel-epub-rendered',
            '.theme-novel-content'
        ];

        const el = this._deepQuerySelector(iframeDocument, candidateSelectors);
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
        const children = root.querySelectorAll ? root.querySelectorAll('*') : [];
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

        let dynamicLazyAttr = null;
        if (viewerCfg.keyDiscovery) {
            const key = this._detectDynamicKey(iframeDocument, viewerCfg.keyDiscovery);
            if (key) {
                dynamicLazyAttr = (viewerCfg.keyDiscovery.prefix || 'data-') + key;
            }
        }

        // 1. 헤드리스(Headless) 정규식 추출 지원
        if (viewerCfg.imageRegex) {
            const html = iframeDocument.documentElement.innerHTML || iframeDocument.body.innerHTML;
            const regex = new RegExp(viewerCfg.imageRegex, 'g');
            const urls = [];
            let match;
            
            while ((match = regex.exec(html)) !== null) {
                let url = match[1] || match[0];
                url = url.replace(/\\/g, '');
                if (!this.isDummyUrl(url)) {
                    urls.push(this.getAbsoluteUrl(url));
                }
            }
            
            const uniqueUrls = Array.from(new Set(urls));
            if (uniqueUrls.length > 0) {
                console.log(`[GenericParser] Regex 기반 이미지 추출 성공: ${uniqueUrls.length}개 발견`);
                return uniqueUrls.map(url => ({ url, isDummy: false }));
            }
        }

        // 2. DOM 기반 추출 — 쉼표 구분 컨테이너의 경우 선언 우선순위대로 탐색
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

        const excludeRule = viewerCfg.exclude || viewerCfg.remove;
        if (excludeRule) {
            const excludeSelectors = Array.isArray(excludeRule) ? excludeRule : [excludeRule];
            for (const selector of excludeSelectors) {
                try {
                    const targets = container.querySelectorAll(selector);
                    targets.forEach(el => el.remove());
                } catch (e) {}
            }
        }

        const imgs = Array.from(container.querySelectorAll(viewerCfg.imageItem || 'img'));

        return imgs.map(img => {
            let foundUrl = null;
            const lazyAttrs = [
                ...(dynamicLazyAttr ? [dynamicLazyAttr] : []),
                ...(viewerCfg.lazyAttrOptions || ['data-src', 'data-lazy', 'data-original', 'o-src', 'src'])
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

    /**
     * 문서 제목(작품명) 정제 헬퍼 — 사이트 접미사("- 북토끼 소설 - 뉴토끼", "| 뉴토끼" 등) 제거
     * @private
     */
    _cleanSeriesTitleText(raw) {
        if (!raw || typeof raw !== 'string') return null;
        let cleaned = raw
            .replace(/\s*\|\s*.*$/, '')
            .replace(/\s+-\s+(?:북토끼|마나토끼|뉴토끼|블랙툰|웹툰|일본만화|웹소설|소설|만화).*$/i, '')
            .replace(/^(?:북토끼|마나토끼|뉴토끼|블랙툰)\s*[-|:]\s*/i, '')
            .trim();
        if (!cleaned || /^(뉴토끼|북토끼|마나토끼|블랙툰|홈|웹툰|만화|소설)$/i.test(cleaned)) {
            return null;
        }
        return cleaned;
    }

    getSeriesTitle() {
        const meta = this.rule.meta || {};
        let val = this._cleanSeriesTitleText(this._extractValue(this._doc, meta.title));
        if (val) return val;

        // 범용 다중 폴백 체인 (v2 DOM, 그누보드 meta[name=subject], og:title, document.title)
        const fallbackConfigs = [
            'h1.hero-v2-title',
            'div.nd-info > h1',
            { selector: 'meta[name="subject"]', attr: 'content' },
            '.view-title h1',
            '.page-desc',
            { selector: 'meta[property="og:title"]', attr: 'content' }
        ];
        val = this._cleanSeriesTitleText(this._extractValue(this._doc, fallbackConfigs));
        if (val) return val;

        if (this._doc && this._doc.title) {
            val = this._cleanSeriesTitleText(this._doc.title);
            if (val) return val;
        }

        return null;
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
        
        let seriesTitle = this._cleanSeriesTitleText(
            this._extractValue(viewerDocument, viewerCfg.seriesTitle || [
                'div.crumb a:last-of-type',
                { selector: 'meta[name="subject"]', attr: 'content' },
                { selector: 'meta[property="og:title"]', attr: 'content' }
            ])
        ) || this.getSeriesTitle() || "UnknownSeries";

        let episodeTitle = this._extractValue(
            viewerDocument,
            viewerCfg.episodeTitle || ['h1.ne-h1', '.vw-head-title', '.view-title', 'main h1', 'h1'],
            true
        ) || (viewerDocument?.title ? this._cleanSeriesTitleText(viewerDocument.title) : null) || "UnknownEpisode";

        let episodeNum = this._extractValue(
            viewerDocument,
            viewerCfg.episodeNum || ['div.crumb strong', '.crumb strong', '[class*="ep-num"]']
        ) || "";

        const match = episodeNum.match(/(\d+)/) || episodeTitle.match(/(\d+)\s*(?:화|회|편)/) || episodeTitle.match(/(\d+)/);
        if (match) {
            episodeNum = match[1];
        } else {
            episodeNum = "0000";
        }

        return {
            seriesTitle,
            episodeTitle,
            episodeNum
        };
    }
}
