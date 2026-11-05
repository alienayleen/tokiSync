import { BaseParser } from './BaseParser.js';
import { extractDeepNovelText } from '../utils.js';

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
                        clone.querySelectorAll('.count, .orangered, .wr-icon, .ep-badge-new, .ep-badge-ready, .sound_only, .pg_only, .sub, .item-details, .ep-row-v2-no, .ep-row-v2-date, .ep-row-v2-meta, .ep-row-v2-arrow, .ne-num, .ne-date').forEach(n => n.remove());
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
     * 페이지 내 표시된 총 회차 수(예: "총 1,307회차", "최신화 934화") 및 현재 페이지 회차 번호를 기반으로 예상 최대 페이지 수 추정
     * @private
     */
    _estimateMaxPagesFromTotalCount(doc, perPageCount, currentPageItems = []) {
        if (!doc || typeof doc.querySelector !== 'function' || !perPageCount || perPageCount < 5) return 1;
        let maxTotal = 0;
        const countSelectors = ['.ep-section-count', '.stat-num', '.page-desc', '.view-content', '.view-info', 'main', 'body'];
        for (const sel of countSelectors) {
            try {
                const el = doc.querySelector(sel);
                const txt = el?.textContent || '';
                const m = txt.match(/총\s*([0-9,]+)\s*(?:회차|화|편)/) ||
                          txt.match(/최신화\s*:?\s*([0-9,]+)\s*(?:회차|화|편)/) ||
                          (sel === '.ep-section-count' ? txt.match(/([0-9,]+)/) : null);
                if (m) {
                    const parsed = parseInt(m[1].replace(/,/g, ''), 10);
                    if (parsed > maxTotal && parsed <= 20000) maxTotal = parsed;
                    if (maxTotal > perPageCount) break;
                }
            } catch (e) {}
        }

        // 현재 페이지 첫/끝 에피소드 번호 기반 역산 (예: 1페이지가 934~834화이면 최소 ceil(934/100)=10페이지)
        if (Array.isArray(currentPageItems) && currentPageItems.length >= 10) {
            try {
                const firstParsed = this.parseListItem(currentPageItems[0]);
                const lastParsed = this.parseListItem(currentPageItems[currentPageItems.length - 1]);
                const n1 = parseInt(firstParsed.num, 10) || 0;
                const n2 = parseInt(lastParsed.num, 10) || 0;
                const highestNum = Math.max(n1, n2);
                const lowestNum = Math.min(n1, n2);
                if (highestNum > perPageCount && lowestNum > 1 && highestNum <= 20000) {
                    if (highestNum > maxTotal) maxTotal = highestNum;
                }
            } catch (e) {}
        }

        if (maxTotal > perPageCount && maxTotal <= 20000) {
            return Math.ceil(maxTotal / perPageCount);
        }
        return 1;
    }

    /**
     * 페이지네이션 컨테이너 내부의 말단(leaf) 컨트롤 요소들을 태그에 구애받지 않고 추출
     * - button, a, strong, span, em, b, li, div 등 모든 태그 지원 (현재1페이지 strong/span 및 sbxh9의 듀얼 페이지네이션 대응)
     * @private
     */
    _getLeafPaginationControls(root, listEl = null) {
        if (!root || typeof root.querySelectorAll !== 'function') return [];
        const rawEls = Array.from(root.querySelectorAll('button, a, [role="button"], strong, span, em, b, li, div'));
        return rawEls.filter(el => {
            if (listEl && (el === listEl || (typeof listEl.contains === 'function' && listEl.contains(el)) || (typeof el.contains === 'function' && el.contains(listEl)))) {
                return false;
            }
            if (el.closest?.('ul.ep-list-v2, ul.novel-eps, .list-body, #toon_list, li.ep-row-v2, li.list-item')) return false;
            if (el.closest?.('#bo_vc, #bo_v_cmt, .view-comment, #comment, #comments, [class*="comment" i], [id*="comment" i], [class*="cmt" i], [id*="cmt" i]')) return false;

            const tag = (el.tagName || '').toUpperCase();
            // <button>이나 <a> 내부의 자식 <span>/<strong> 등은 부모 <button>/<a>가 컨트롤이므로 건너뜀
            const parentBtnOrLink = el.closest?.('button, a');
            if (parentBtnOrLink && parentBtnOrLink !== el) return false;

            const rawTxt = (el.textContent || '').trim();
            if (!rawTxt || rawTxt.length > 24) return false;

            // <button> 또는 <a> 태그는 내부에 다른 <button>/<a>만 없으면 자식 <span> 개수와 무관하게 단일 컨트롤로 인정
            if (tag === 'BUTTON' || tag === 'A' || el.getAttribute?.('role') === 'button') {
                if (typeof el.querySelector === 'function' && el.querySelector('button, a')) return false;
                return true;
            }

            const cleanTxt = rawTxt.replace(/현재|열린|페이지|쪽|\s+/g, '').replace(/^\[|\]$/g, '').trim();
            const isPageToken = /^\d{1,3}$/.test(cleanTxt) || /^(?:›|>|다음|«|<<|처음|»|>>|맨끝|끝)$/.test(cleanTxt);

            const children = Array.from(el.children || []).filter(ch => !/pg_only|sound_only|sr-only|blind/i.test(ch.className || ''));
            if (children.length > 0) {
                if (typeof el.querySelector === 'function' && el.querySelector('button, a')) return false;
                if (children.some(ch => (ch.textContent || '').trim() === rawTxt)) return false;
                // <strong class="pg_current"><span>현재</span>1<span>페이지</span></strong> 형태 허용
                if (!isPageToken || children.length > 3) return false;
            }
            return true;
        });
    }

    /**
     * 회차 목록 섹션 내의 페이지네이션 바(컨테이너)를 클래스명/태그에 구애받지 않고 탐색
     * @private
     */
    _findPaginationRoot(listCfg, doc = this._doc) {
        if (!doc || typeof doc.querySelectorAll !== 'function') return null;

        const containerSelectors = String(listCfg?.container || '').split(',').map(s => s.trim()).filter(Boolean);
        let listEl = null;
        for (const sel of containerSelectors) {
            try {
                const found = doc.querySelector(sel);
                if (found) { listEl = found; break; }
            } catch (e) {}
        }

        const hasPageControls = (el) => {
            if (!el || typeof el.querySelectorAll !== 'function') return false;
            if (el.closest?.('#bo_vc, #bo_v_cmt, .view-comment, #comment, #comments, [class*="comment" i], [id*="comment" i], [class*="cmt" i], [id*="cmt" i]')) return false;
            const controls = this._getLeafPaginationControls(el, listEl);
            const nums = new Set();
            let hasInteractive = false;
            for (const c of controls) {
                const t = (c.textContent || '').replace(/현재|열린|페이지|쪽|\s+/g, '').replace(/^\[|\]$/g, '').trim();
                if (/^\d+$/.test(t)) {
                    const n = parseInt(t, 10);
                    if (n >= 1 && n <= 500) {
                        nums.add(n);
                        const tag = (c.tagName || '').toUpperCase();
                        if (tag === 'A' || tag === 'BUTTON' || c.getAttribute?.('role') === 'button' || typeof c.onclick === 'function' || c.style?.cursor === 'pointer' || n >= 2) {
                            hasInteractive = true;
                        }
                    }
                }
            }
            if (!hasInteractive || nums.size < 2) return false;
            for (const n of nums) {
                if (nums.has(n + 1)) return true;
            }
            return nums.has(1) && nums.size >= 2;
        };

        // 1. 에피소드 리스트 컨테이너로부터 최대 4단계 상위 조상까지 올라가며 가장 가까운 섹션 탐색
        // (단, pc/mobile 듀얼 페이지네이션 바가 형제로 공존하는 경우를 모두 포괄하기 위해 조상 섹션 자체를 우선 반환)
        let anc = listEl ? listEl.parentElement : null;
        for (let depth = 0; depth < 4 && anc && anc !== doc.body && anc !== doc.documentElement; depth++, anc = anc.parentElement) {
            if (hasPageControls(anc)) {
                return anc;
            }
            const siblings = Array.from(anc.children || []);
            for (const sib of siblings) {
                if (sib === listEl || (listEl && typeof sib.contains === 'function' && sib.contains(listEl))) continue;
                if (hasPageControls(sib)) return anc;
            }
        }

        // 2. 문서 전체에서 알려진 페이지네이션 컨테이너 탐색 (댓글 영역 제외)
        const candidates = Array.from(doc.querySelectorAll(
            '.ep-pagination, .ep-page, .ep-pages, .pagination, .paging, .pg_wrap, .page-box, .list-page, .write-pages, .page-nav, [class*="pagin" i], [class*="pager" i], nav[aria-label*="page" i]'
        ));
        for (const cand of candidates) {
            if (hasPageControls(cand)) return cand.parentElement && hasPageControls(cand.parentElement) ? cand.parentElement : cand;
        }

        // 3. '2페이지', '3페이지' 텍스트를 가진 앵커/버튼 역추적 (newtoki1.org 등 클래스명이 달라도 100% 포착)
        try {
            const allLinks = Array.from(doc.querySelectorAll('a, button, span, strong'));
            for (const node of allLinks) {
                if (node.closest?.('#bo_vc, #bo_v_cmt, .view-comment, #comment, #comments, [class*="comment" i], [id*="comment" i]')) continue;
                const txt = (node.textContent || '').trim();
                if (/^(?:현재|열린)?\s*2\s*페이지$/.test(txt) && node.parentElement) {
                    const p = node.parentElement.parentElement && hasPageControls(node.parentElement.parentElement)
                        ? node.parentElement.parentElement
                        : node.parentElement;
                    if (hasPageControls(p)) return p;
                }
            }
        } catch (e) {}

        // 4. DOM 순서 기반 폴백: 에피소드 리스트 이후 ~ 댓글 영역 이전에 페이지 컨트롤이 존재하면 상위 컨테이너 반환
        if (listEl && doc.body && hasPageControls(doc.body)) {
            return doc.body;
        }

        return null;
    }

    /**
     * 단일 URL 문자열에서 페이지 번호와 템플릿 유형을 추출하는 헬퍼
     * @private
     */
    _extractPageNumFromUrl(u, cleanBasePath) {
        // 1) /__q/<base64>
        const qMatch = u.pathname.match(/^(.*)\/__q\/([A-Za-z0-9+/=_-]+)\/?$/);
        if (qMatch) {
            const rawB64 = qMatch[2];
            const decoded = this._decodeBase64Query(rawB64);
            if (decoded) {
                const sp = new URLSearchParams(decoded);
                for (const key of ['spage', 'ep_page', 'page', 'p', 'pg']) {
                    const val = sp.get(key);
                    if (val && /^\d+$/.test(val)) {
                        return {
                            num: parseInt(val, 10),
                            type: 'b64_query',
                            paramName: key,
                            b64PrefixPath: qMatch[1].replace(/\/+$/, ''),
                            b64TemplateQuery: decoded,
                            b64KeepPadding: rawB64.endsWith('=')
                        };
                    }
                }
            }
        }
        // 2) Query parameter (?spage=2, ?ep_page=2, ?page=2, ?p=2, ?pg=2)
        for (const paramName of ['spage', 'ep_page', 'page', 'p', 'pg']) {
            const val = u.searchParams.get(paramName);
            if (val && /^\d+$/.test(val)) {
                return {
                    num: parseInt(val, 10),
                    type: 'query',
                    paramName,
                    templateUrl: u.href
                };
            }
        }
        // 3) Path segment (/page/2, /p/2, /p2)
        const pathMatch = u.pathname.match(/^(.*)\/(page|p)\/(\d+)\/?$/i);
        if (pathMatch) {
            return {
                num: parseInt(pathMatch[3], 10),
                type: 'path',
                pathPrefix: pathMatch[1].replace(/\/+$/, ''),
                pathWord: pathMatch[2]
            };
        }
        return null;
    }

    /**
     * 현재 문서에서 페이지네이션(1, 2, 3...) 정보를 탐지하여 페이지 번호 -> URL 생성기 반환
     * - 페이지네이션 바 내부 <a> 태그의 실제 href(directUrlMap)를 최우선 보존
     * - ?spage=N, ?page=N, ?p=N
     * - /__q/<base64(page=N)> (newtoki1.org 방식)
     * - /page/N, /p/N
     * @private
     */
    _detectPaginationInfo(doc, baseUrlStr, currentItemCount = 0, currentPageItems = []) {
        if (!doc || typeof doc.querySelectorAll !== 'function' || !baseUrlStr) return null;
        let baseUrl;
        try {
            baseUrl = new URL(baseUrlStr, this.protocolDomain || 'http://localhost');
        } catch (e) {
            return null;
        }

        const listCfg = this.rule.list || {};
        const pagRoot = this._findPaginationRoot(listCfg, doc);

        const pagSelectors = [
            ...(listCfg.pagination ? [listCfg.pagination] : []),
            'a.pg_page[href]',
            '.ep-section a[href]',
            '.pagination a[href]',
            '.pg_wrap a[href]',
            '.paging a[href]',
            '.page-box a[href]',
            '.list-page a[href]',
            '.write-pages a[href]',
            '.ep-pagination a[href]',
            '.ep-page a[href]',
            'nav[aria-label*="page" i] a[href]',
            '[class*="pagin" i] a[href]',
            '[class*="pager" i] a[href]',
            'a[href*="__q/"]',
            'a[href*="spage="]',
            'a[href*="ep_page="]',
            'a[href*="page="]'
        ];

        const anchors = [];
        const seenEl = new Set();

        // 1순위: 에피소드 페이지네이션 루트 내부의 <a> 태그
        if (pagRoot && typeof pagRoot.querySelectorAll === 'function') {
            try {
                for (const a of Array.from(pagRoot.querySelectorAll('a[href]'))) {
                    if (a.closest?.('ul.ep-list-v2, ul.novel-eps, .list-body, #toon_list, li.ep-row-v2, li.list-item')) continue;
                    if (a.closest?.('#bo_vc, #bo_v_cmt, .view-comment, #comment, #comments, [class*="comment" i], [id*="comment" i], [class*="cmt" i], [id*="cmt" i]')) continue;
                    seenEl.add(a);
                    anchors.push(a);
                }
            } catch (e) {}
        }

        // 2순위: 알려진 페이지네이션 셀렉터
        for (const sel of pagSelectors) {
            try {
                for (const a of Array.from(doc.querySelectorAll(sel))) {
                    if (seenEl.has(a)) continue;
                    if (a.closest?.('ul.ep-list-v2, ul.novel-eps, .list-body, #toon_list, li.ep-row-v2, li.list-item')) continue;
                    if (a.closest?.('#bo_vc, #bo_v_cmt, .view-comment, #comment, #comments, [class*="comment" i], [id*="comment" i], [class*="cmt" i], [id*="cmt" i]')) continue;
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

        const seriesId = this.getSeriesId();
        const isSameSeriesPath = (uPath) => {
            const norm = uPath.replace(/\/__q\/[A-Za-z0-9+/=_-]+\/?$/, '').replace(/\/(page|p)\/\d+\/?$/i, '').replace(/\/+$/, '');
            if (norm === cleanBasePath) return true;
            if (seriesId && seriesId !== '0000' && new RegExp(`\\/${seriesId}(\\/|$)`).test(norm)) return true;
            return false;
        };

        const estimatedMax = this._estimateMaxPagesFromTotalCount(doc, currentItemCount, currentPageItems);
        const directUrlMap = new Map();
        let detectedInfo = null;

        for (const a of anchors) {
            const rawHref = a.getAttribute?.('href');
            if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript')) continue;
            try {
                const u = new URL(rawHref, baseUrl.href);
                if (u.hash && /vc|comment|cmt/i.test(u.hash)) continue;
                if (!isSameSeriesPath(u.pathname)) continue;

                const parsed = this._extractPageNumFromUrl(u, cleanBasePath);
                const cleanTxt = (a.textContent || '').replace(/현재|열린|페이지|쪽|\s+/g, '').replace(/^\[|\]$/g, '').trim();
                const txtNum = /^\d+$/.test(cleanTxt) ? parseInt(cleanTxt, 10) : null;

                const pageNum = parsed ? parsed.num : txtNum;
                if (pageNum && pageNum >= 1 && pageNum <= 500) {
                    if (!directUrlMap.has(pageNum)) {
                        directUrlMap.set(pageNum, u.href);
                    }
                    if (parsed && (!detectedInfo || (detectedInfo.type !== 'b64_query' && parsed.type === 'b64_query') || (parsed.paramName === 'spage'))) {
                        detectedInfo = parsed;
                    }
                }
            } catch (e) {}
        }

        if (directUrlMap.size === 0 && !detectedInfo) return null;

        let currentPage = 1;
        const curParsed = this._extractPageNumFromUrl(baseUrl, cleanBasePath);
        if (curParsed && curParsed.num >= 1) {
            currentPage = curParsed.num;
        }
        directUrlMap.set(currentPage, baseUrl.href);

        const maxDiscovered = Math.max(...Array.from(directUrlMap.keys()), currentPage);
        const maxPage = Math.max(maxDiscovered, estimatedMax);
        if (maxPage <= 1) return null;

        const buildUrl = (pageNum) => {
            if (directUrlMap.has(pageNum)) {
                return directUrlMap.get(pageNum);
            }
            if (detectedInfo) {
                if (detectedInfo.type === 'b64_query') {
                    const u = new URL(baseUrl.href);
                    u.search = '';
                    const prefix = detectedInfo.b64PrefixPath || cleanBasePath;
                    if (pageNum === 1) {
                        u.pathname = prefix;
                        return u.href;
                    }
                    const sp = new URLSearchParams(detectedInfo.b64TemplateQuery);
                    sp.set(detectedInfo.paramName, String(pageNum));
                    const encoded = this._encodeBase64Query(sp.toString(), detectedInfo.b64KeepPadding);
                    u.pathname = `${prefix}/__q/${encoded}`;
                    return u.href;
                }
                if (detectedInfo.type === 'query') {
                    const u = new URL(detectedInfo.templateUrl || baseUrl.href);
                    u.searchParams.set(detectedInfo.paramName, String(pageNum));
                    return u.href;
                }
                if (detectedInfo.type === 'path') {
                    const u = new URL(baseUrl.href);
                    const prefix = detectedInfo.pathPrefix || cleanBasePath;
                    u.pathname = pageNum === 1 ? prefix : `${prefix}/${detectedInfo.pathWord}/${pageNum}`;
                    return u.href;
                }
            }
            const u = new URL(baseUrl.href);
            u.searchParams.set('page', String(pageNum));
            return u.href;
        };

        return {
            type: detectedInfo ? detectedInfo.type : 'direct',
            paramName: detectedInfo ? detectedInfo.paramName : 'page',
            currentPage,
            maxPage,
            directUrlMap,
            buildUrl
        };
    }

    /**
     * SPA 버튼 클릭형 페이지네이션(« ‹ 1 2 ... 10 … › » 등) 자동 순회 수집
     * - 매 스텝마다 실시간 DOM에서 페이지네이션 루트를 재탐색하여 React/Next.js 리렌더링 시에도 끊김 없이 추적
     * - sbxh9.com 등의 PC/모바일 듀얼 페이지네이션 바(«‹12345678910…›» «‹12345…›») 동시 지원
     * - 10페이지 이후(… 뒤의 11, 12, 13페이지)도 '›' (다음) 버튼을 눌러 끝까지 자동 추적
     * @private
     */
    async _collectViaButtonPagination(listCfg, currentPageItems) {
        const containerSelectors = String(listCfg?.container || '').split(',').map(s => s.trim()).filter(Boolean);
        const getListEl = () => {
            for (const sel of containerSelectors) {
                try {
                    const found = this._doc.querySelector(sel);
                    if (found) return found;
                } catch (e) {}
            }
            return null;
        };

        const isVisibleEl = (el) => {
            if (!el || typeof el.getBoundingClientRect !== 'function') return true;
            try {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            } catch (e) {
                return true;
            }
        };

        const getControls = () => {
            const pagRoot = this._findPaginationRoot(listCfg, this._doc);
            if (!pagRoot) return null;
            const listEl = getListEl();
            const els = this._getLeafPaginationControls(pagRoot, listEl);

            const numMap = new Map(); // pageNum -> Array<{ el, isDisabled, isVisible }>
            const nextBtns = [];
            const firstBtns = [];

            for (const el of els) {
                const rawTxt = (el.textContent || '').trim();
                const cleanNumTxt = rawTxt.replace(/현재|열린|페이지|쪽|\s+/g, '').replace(/^\[|\]$/g, '').trim();
                const aria = (el.getAttribute?.('aria-label') || el.getAttribute?.('title') || '').toLowerCase();
                const isDisabled = Boolean(
                    el.disabled ||
                    el.getAttribute?.('aria-disabled') === 'true' ||
                    /\b(disabled|inactive)\b/i.test(el.className || '') ||
                    (el.parentElement && /\b(disabled|inactive)\b/i.test(el.parentElement.className || ''))
                );
                const isVisible = isVisibleEl(el);

                if (/^\d+$/.test(cleanNumTxt)) {
                    const num = parseInt(cleanNumTxt, 10);
                    if (num >= 1 && num <= 500) {
                        if (!numMap.has(num)) numMap.set(num, []);
                        numMap.get(num).push({ el, isDisabled, isVisible });
                    }
                } else if (!isDisabled && (rawTxt === '›' || rawTxt === '>' || rawTxt === '다음' || /next|다음/.test(aria))) {
                    nextBtns.push({ el, isVisible });
                } else if (!isDisabled && (rawTxt === '«' || rawTxt === '<<' || rawTxt === '처음' || /first|처음/.test(aria))) {
                    firstBtns.push({ el, isVisible });
                }
            }

            // 화면에 보이는(visible) 버튼을 앞쪽으로 정렬하고, button/a 태그를 우선 배치
            const sortCandidates = (arr) => arr.sort((a, b) => {
                if (a.isVisible !== b.isVisible) return a.isVisible ? -1 : 1;
                const aInteractive = /^(BUTTON|A)$/i.test(a.el.tagName || '');
                const bInteractive = /^(BUTTON|A)$/i.test(b.el.tagName || '');
                if (aInteractive !== bInteractive) return aInteractive ? -1 : 1;
                return 0;
            });

            for (const arr of numMap.values()) sortCandidates(arr);
            sortCandidates(nextBtns);
            sortCandidates(firstBtns);

            return { numMap, nextBtns, firstBtns };
        };

        const initCtrl = getControls();
        if (!initCtrl || initCtrl.numMap.size <= 1) return null;

        console.log(`[GenericParser] 🖱️ 페이지네이션 버튼 감지 (초기 페이지 수: ${initCtrl.numMap.size}개) -> 전체 페이지 순차 수집을 시작합니다.`);

        const cloneItems = (items) => items.map(el => (typeof el.cloneNode === 'function' ? el.cloneNode(true) : el));
        const allClonedPages = [cloneItems(currentPageItems)];

        const getListSignature = () => {
            const items = this._extractItemsFromDoc(this._doc, listCfg);
            if (items.length === 0) return '';
            const first = this.parseListItem(items[0]);
            const last = this.parseListItem(items[items.length - 1]);
            return `${items.length}:${first.num}_${first.title}_${first.src}:${last.num}_${last.title}_${last.src}`;
        };

        const triggerClick = (el) => {
            if (!el) return false;
            let clicked = false;
            try {
                // 1) 페이지 Main World 컨텍스트에서 직접 클릭 실행 (Tampermonkey 샌드박스 우회로 React/Next.js 합성 이벤트 100% 작동 보장)
                if (this._doc && typeof this._doc.createElement === 'function' && (this._doc.head || this._doc.documentElement) && typeof el.setAttribute === 'function') {
                    const token = 'toki_clk_' + Math.random().toString(36).slice(2, 9);
                    el.setAttribute('data-toki-click-id', token);
                    try {
                        const s = this._doc.createElement('script');
                        s.textContent = `(function(){var e=document.querySelector('[data-toki-click-id="${token}"]');if(e){['pointerdown','mousedown','mouseup'].forEach(function(t){e.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}));});if(typeof e.click==='function')e.click();}})();`;
                        (this._doc.head || this._doc.documentElement).appendChild(s);
                        s.remove();
                        clicked = true;
                    } catch (_) {}
                    try { el.removeAttribute('data-toki-click-id'); } catch (_) {}
                }
            } catch (_) {}

            // 2) 샌드박스 직접 클릭 병행 (단위 테스트 및 CSP 환경 호환)
            if (typeof el.click === 'function') {
                try { el.click(); clicked = true; } catch (_) {}
            } else if (el.parentElement && typeof el.parentElement.click === 'function') {
                try { el.parentElement.click(); clicked = true; } catch (_) {}
            }
            return clicked;
        };

        // <a> 태그 클릭 시 SPA 라우터(#__next, document)는 통과하되 브라우저 전체 페이지 새로고침만 최상단(window)에서 방어
        const win = (this._doc && this._doc.defaultView) || (typeof window !== 'undefined' ? window : null);
        const preventFullPageNav = (e) => {
            try {
                const a = e.target?.closest?.('a[href]');
                if (a) e.preventDefault();
            } catch (_) {}
        };
        if (win && typeof win.addEventListener === 'function') {
            win.addEventListener('click', preventFullPageNav, false);
        }

        try {
            const seenSignatures = new Set([getListSignature()]);
            let currentPageNum = 1;
            const MAX_SAFETY_PAGES = 100;

            for (let step = 0; step < MAX_SAFETY_PAGES; step++) {
                const targetPageNum = currentPageNum + 1;
                const ctrl = getControls();
                if (!ctrl) break;

                const { numMap, nextBtns } = ctrl;
                const targetEntries = (numMap.get(targetPageNum) || []).filter(c => !c.isDisabled);

                const candidateButtons = [];
                for (const entry of targetEntries) candidateButtons.push(entry.el);
                for (const nb of nextBtns) {
                    if (!candidateButtons.includes(nb.el)) candidateButtons.push(nb.el);
                }

                if (candidateButtons.length === 0) break;

                const prevSig = getListSignature();
                triggerClick(candidateButtons[0]);

                let changed = false;
                let waited = 0;
                let triedFallbacks = false;

                while (waited < 2500) {
                    await new Promise(r => setTimeout(r, 120));
                    waited += 120;
                    const newSig = getListSignature();
                    if (newSig && newSig !== prevSig) {
                        changed = true;
                        break;
                    }
                    // PC/모바일 듀얼 페이지네이션 바 중 첫 번째가 비활성일 경우 600ms 시점에 나머지 후보 버튼도 클릭
                    if (!triedFallbacks && waited >= 600 && candidateButtons.length > 1) {
                        triedFallbacks = true;
                        for (let k = 1; k < candidateButtons.length; k++) {
                            triggerClick(candidateButtons[k]);
                        }
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
            if (finalCtrl) {
                const restoreEl = finalCtrl.firstBtns[0]?.el || finalCtrl.numMap.get(1)?.[0]?.el;
                if (restoreEl) {
                    triggerClick(restoreEl);
                    await new Promise(r => setTimeout(r, 150));
                }
            }
        } finally {
            if (win && typeof win.removeEventListener === 'function') {
                win.removeEventListener('click', preventFullPageNav, false);
            }
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
     * 원격 페이지 HTML을 가져와 Document로 파싱 (fetch 우선 시도 후 GM_xmlhttpRequest 폴백)
     * @private
     */
    async _fetchPageDocument(pageUrl) {
        if (typeof fetch === 'function') {
            try {
                const resp = await fetch(pageUrl, {
                    credentials: 'include',
                    headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
                });
                if (resp && resp.ok) {
                    const html = await resp.text();
                    if (html && typeof DOMParser !== 'undefined') {
                        return new DOMParser().parseFromString(html, 'text/html');
                    }
                }
            } catch (e) {
                console.warn(`[GenericParser] fetch 페이지 로드 실패 (${pageUrl}):`, e);
            }
        }
        if (typeof GM_xmlhttpRequest === 'function' && typeof DOMParser !== 'undefined') {
            try {
                const html = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: pageUrl,
                        timeout: 15000,
                        onload: (res) => (res.status >= 200 && res.status < 300) ? resolve(res.responseText) : reject(new Error(`HTTP ${res.status}`)),
                        onerror: reject,
                        ontimeout: reject
                    });
                });
                if (html) {
                    return new DOMParser().parseFromString(html, 'text/html');
                }
            } catch (e) {
                console.warn(`[GenericParser] GM_xmlhttpRequest 페이지 로드 실패 (${pageUrl}):`, e);
            }
        }
        return null;
    }

    /**
     * Tier 3 폴백: CSR 전용 다중 페이지 URL을 숨김 iframe에서 렌더링하여 회차 추출
     * @private
     */
    async _collectViaIframePagination(pagInfo, listCfg, currentPageItems) {
        if (!this._doc || typeof this._doc.createElement !== 'function' || !this._doc.body) return null;
        const firstContSel = String(listCfg.container || '').split(',')[0].trim();
        if (!firstContSel) return null;

        const cloneItems = (items) => items.map(el => (typeof el.cloneNode === 'function' ? el.cloneNode(true) : el));
        const pageItemsMap = new Map([[pagInfo.currentPage, cloneItems(currentPageItems)]]);
        let knownMaxPage = Math.min(pagInfo.maxPage, 50);

        const iframe = this._doc.createElement('iframe');
        if (iframe.style) {
            iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:360px;height:480px;opacity:0.01;pointer-events:none;z-index:-9999;';
        }
        this._doc.body.appendChild(iframe);

        try {
            for (let pNum = 1; pNum <= knownMaxPage; pNum++) {
                if (pNum === pagInfo.currentPage) continue;
                const pageUrl = pagInfo.buildUrl(pNum);
                const loaded = await new Promise((resolve) => {
                    const timer = setTimeout(() => resolve(false), 6000);
                    iframe.onload = () => { clearTimeout(timer); resolve(true); };
                    iframe.onerror = () => { clearTimeout(timer); resolve(false); };
                    iframe.src = pageUrl;
                });
                if (!loaded || !iframe.contentDocument) continue;

                let waited = 0;
                let items = [];
                while (waited < 3500) {
                    items = this._extractItemsFromDoc(iframe.contentDocument, listCfg);
                    if (items.length > 0) break;
                    await new Promise(r => setTimeout(r, 150));
                    waited += 150;
                }
                if (items.length > 0) {
                    pageItemsMap.set(pNum, cloneItems(items));
                    const subPag = this._detectPaginationInfo(iframe.contentDocument, pageUrl, currentPageItems.length, items);
                    if (subPag) {
                        if (subPag.directUrlMap) {
                            for (const [k, v] of subPag.directUrlMap.entries()) {
                                if (!pagInfo.directUrlMap.has(k)) pagInfo.directUrlMap.set(k, v);
                            }
                        }
                        if (subPag.maxPage > knownMaxPage && subPag.maxPage <= 50) {
                            knownMaxPage = subPag.maxPage;
                        }
                    }
                }
            }
        } finally {
            try { iframe.remove(); } catch (_) {}
        }

        const sortedPageNums = Array.from(pageItemsMap.keys()).sort((a, b) => a - b);
        const merged = [];
        const seenKeys = new Set();
        for (const pNum of sortedPageNums) {
            for (const el of (pageItemsMap.get(pNum) || [])) {
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
     * 회차 목록 아이템 반환 (다중 페이지 1, 2, 3... 자동 순회 수집 포함)
     * @param {Object} [options]
     * @param {boolean} [options.allPages=true] 모든 페이지네이션을 순회하여 전체 회차를 가져올지 여부
     * @param {boolean} [options.forceRefresh=false] 캐시 무시 여부
     */
    /**
     * [v1.27.0] 최근 전체 회차 스캔 결과가 현재 URL 기준으로 유효한지 확인
     * @param {number} maxAgeMs
     */
    hasFreshAllPageCache(maxAgeMs = 10 * 60 * 1000) {
        const currentUrl = this._doc?.URL || (typeof window !== 'undefined' && window.location ? window.location.href : '');
        return !!(this._cachedAllPageItems && this._cachedAllPageUrl === currentUrl && this._cachedAllPageAt && (Date.now() - this._cachedAllPageAt) < maxAgeMs);
    }

    async getListItems(options = {}) {
        const { allPages = true, forceRefresh = false, onProgress = null } = options;
        const report = (info) => {
            if (typeof onProgress === 'function') {
                try { onProgress(info); } catch (e) {}
            }
        };
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

        // Tier 1. URL 기반 페이지네이션 감지 (?page=2, ?spage=2, /__q/<base64>, /page/2, 직접 href 등)
        const pagInfo = this._detectPaginationInfo(this._doc, currentUrl, currentPageItems.length, currentPageItems);
        if (pagInfo && pagInfo.maxPage > 1) {
            console.log(`[GenericParser] 📄 다중 페이지 감지 (유형: ${pagInfo.type}, 현재 ${pagInfo.currentPage}p / 예상 최대 ${pagInfo.maxPage}p) -> 전체 페이지 자동 수집을 시작합니다.`);

            const pageItemsMap = new Map();
            pageItemsMap.set(pagInfo.currentPage, currentPageItems);

            const fetchedPages = new Set([pagInfo.currentPage]);
            let knownMaxPage = Math.min(pagInfo.maxPage, 100);
            // [v1.27.0] 사이트 차단(WAF) 위험을 줄이기 위해 동시 요청 4 → 2, 배치 사이 간격 추가
            const BATCH_CONCURRENCY = 2;
            const BATCH_GAP_MS = 350;
            report({ phase: 'pages', fetched: 1, total: knownMaxPage });

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
                if (fetchedPages.size > batchPages.length + 1) {
                    await new Promise(r => setTimeout(r, BATCH_GAP_MS));
                }

                const results = await Promise.all(batchPages.map(async (pNum) => {
                    const pageUrl = pagInfo.buildUrl(pNum);
                    const pageDoc = await this._fetchPageDocument(pageUrl);
                    if (!pageDoc) return { pNum, items: [], subPag: null };

                    const items = this._extractItemsFromDoc(pageDoc, listCfg);
                    const subPag = this._detectPaginationInfo(pageDoc, pageUrl, currentPageItems.length, items);
                    return { pNum, items, subPag };
                }));

                for (const { pNum, items, subPag } of results) {
                    if (items && items.length > 0) {
                        pageItemsMap.set(pNum, items);
                    }
                    if (subPag) {
                        if (subPag.directUrlMap && pagInfo.directUrlMap) {
                            for (const [k, v] of subPag.directUrlMap.entries()) {
                                if (!pagInfo.directUrlMap.has(k)) pagInfo.directUrlMap.set(k, v);
                            }
                        }
                        if (subPag.maxPage > knownMaxPage && subPag.maxPage <= 100) {
                            knownMaxPage = subPag.maxPage;
                        }
                    }
                }
                const itemCount = Array.from(pageItemsMap.values()).reduce((acc, arr) => acc + arr.length, 0);
                report({ phase: 'pages', fetched: Math.min(fetchedPages.size, knownMaxPage), total: knownMaxPage, items: itemCount });
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

            // Tier 1(URL Fetch)으로 2페이지 이상의 고유 회차가 정상 병합된 경우 반환
            if (mergedItems.length > currentPageItems.length) {
                console.log(`[GenericParser] ✅ 전체 ${sortedPageNums.length}개 페이지 병합 완료: 총 ${mergedItems.length}개 회차 추출됨.`);
                this._cachedAllPageUrl = currentUrl;
                this._cachedAllPageItems = mergedItems;
                this._cachedAllPageAt = Date.now();
                return mergedItems;
            }
            console.warn('[GenericParser] ⚠️ 정적 URL 요청에서 추가 회차가 감지되지 않아 실시간 DOM 버튼 클릭 모드로 전환합니다.');
        }

        report({ phase: 'buttons' });
        // Tier 2. SPA/실시간 버튼 클릭형 페이지네이션(« ‹ 1 2 ... 10 … › » 또는 JS 페이지네이션) 수행
        const btnMerged = await this._collectViaButtonPagination(listCfg, currentPageItems);
        if (btnMerged && btnMerged.length > currentPageItems.length) {
            console.log(`[GenericParser] ✅ 버튼 순회 페이지 병합 완료: 총 ${btnMerged.length}개 회차 추출됨.`);
            this._cachedAllPageUrl = currentUrl;
            this._cachedAllPageItems = btnMerged;
            this._cachedAllPageAt = Date.now();
            return btnMerged;
        }

        // Tier 3. URL 페이지네이션은 존재하나 CSR 렌더링이 필요한 경우 숨김 iframe 폴백 수행
        if (pagInfo && pagInfo.maxPage > 1) {
            console.log('[GenericParser] 🔄 CSR 다중 페이지 렌더링을 위해 숨김 iframe 수집 폴백을 가동합니다.');
            const iframeMerged = await this._collectViaIframePagination(pagInfo, listCfg, currentPageItems);
            if (iframeMerged && iframeMerged.length > currentPageItems.length) {
                console.log(`[GenericParser] ✅ 숨김 iframe 페이지 병합 완료: 총 ${iframeMerged.length}개 회차 추출됨.`);
                this._cachedAllPageUrl = currentUrl;
                this._cachedAllPageItems = iframeMerged;
                this._cachedAllPageAt = Date.now();
                return iframeMerged;
            }
        }

        // Tier 4. 뷰어 내부 <select> 전체 회차 드롭다운 폴백
        const dropdownMerged = await this._collectViaViewerDropdown(currentPageItems);
        if (dropdownMerged && dropdownMerged.length > currentPageItems.length) {
            this._cachedAllPageUrl = currentUrl;
            this._cachedAllPageItems = dropdownMerged;
            this._cachedAllPageAt = Date.now();
            return dropdownMerged;
        }

        return currentPageItems;
    }

    /**
     * Tier 4 폴백: 현재 페이지의 최소 회차 번호가 1보다 큰데(예: 1페이지가 934~834화) 목록 페이지네이션이 실패한 경우,
     * 첫 번째 회차의 뷰어 페이지 HTML 내부에 있는 전체 회차 이동 <select> 드롭다운에서 전 회차 목록을 일괄 추출
     * @private
     */
    async _collectViaViewerDropdown(currentPageItems) {
        if (!Array.isArray(currentPageItems) || currentPageItems.length < 5) return null;
        try {
            const firstParsed = this.parseListItem(currentPageItems[0]);
            const lastParsed = this.parseListItem(currentPageItems[currentPageItems.length - 1]);
            const minNum = Math.min(parseInt(firstParsed.num, 10) || 0, parseInt(lastParsed.num, 10) || 0);
            if (minNum <= 1) return null; // 이미 1화까지 포함되어 있으면 불필요

            const sampleEpUrl = firstParsed.src || lastParsed.src;
            if (!sampleEpUrl) return null;

            const viewerDoc = await this._fetchPageDocument(sampleEpUrl);
            if (!viewerDoc || typeof viewerDoc.querySelectorAll !== 'function') return null;

            const selects = Array.from(viewerDoc.querySelectorAll('select'));
            let bestOptions = [];
            for (const sel of selects) {
                const opts = Array.from(sel.querySelectorAll('option')).filter(o => o.getAttribute('value'));
                if (opts.length > currentPageItems.length && opts.length > bestOptions.length) {
                    bestOptions = opts;
                }
            }
            if (bestOptions.length <= currentPageItems.length) return null;

            console.log(`[GenericParser] 🎯 뷰어 내 전체 회차 <select> 드롭다운 감지 (${bestOptions.length}개 회차) -> 전 회차 일괄 추출!`);
            const base = new URL(sampleEpUrl, this.protocolDomain || 'http://localhost');
            const seriesBaseMatch = base.pathname.match(/^(\/(?:novel|webtoon|manhwa|manga|comic|toon|book)\/[^\/]+)/i);
            const seriesBasePath = seriesBaseMatch ? seriesBaseMatch[1] : base.pathname.replace(/\/[^\/]+$/, '');

            const syntheticItems = bestOptions.map((opt, idx) => {
                const rawVal = (opt.getAttribute('value') || '').trim();
                const titleTxt = (opt.textContent || '').trim() || `${bestOptions.length - idx}화`;
                let epHref = rawVal;
                if (!rawVal.startsWith('http') && !rawVal.startsWith('/')) {
                    epHref = `${seriesBasePath}/${rawVal}`;
                }
                const numMatch = titleTxt.match(/(\d+)\s*(?:화|회|편|권)/) || titleTxt.match(/^(\d+)/);
                const inferredNum = numMatch ? numMatch[1] : String(bestOptions.length - idx);
                const fakeLi = {
                    _tokiEffectiveNum: inferredNum,
                    tagName: 'LI',
                    textContent: titleTxt,
                    innerText: titleTxt,
                    querySelector: (s) => {
                        if (s.includes('a')) return { getAttribute: (a) => a === 'href' ? epHref : null, textContent: titleTxt, innerText: titleTxt };
                        return { textContent: titleTxt, innerText: titleTxt };
                    },
                    querySelectorAll: () => []
                };
                return fakeLi;
            });

            return syntheticItems;
        } catch (e) {
            return null;
        }
    }

    parseListItem(el) {
        const listCfg = this.rule.list || {};
        let numRaw = this._extractValue(el, listCfg.num, true) || "";
        const subRaw = this._extractValue(el, listCfg.sub, true) || "";
        let title = this._extractValue(el, listCfg.title, true) || "Unknown";
        const src = this._extractValue(el, listCfg.link, false) || "";

        // 앞쪽의 불필요한 UP / NEW 배지 텍스트 제거
        title = title.replace(/^(UP|NEW)\s+/i, '').trim();

        // 번호 셀렉터 매칭 실패 시 행 내부의 순수 숫자 배지(.wr-num, span, td 등) 자동 탐색
        if (!numRaw && el && typeof el.querySelectorAll === 'function') {
            try {
                const numNodes = Array.from(el.querySelectorAll('.wr-num, .ep-row-v2-no, .ne-num, .no, .num, .td_num, span, td, div'));
                for (const node of numNodes) {
                    if (node.children && node.children.length > 0) continue;
                    const t = (node.textContent || '').trim();
                    if (/^\d{1,5}$/.test(t)) {
                        numRaw = t;
                        break;
                    }
                }
            } catch (e) {}
        }

        let num = numRaw || "0";
        const match = numRaw.match(/(\d+)/);
        if (match) {
            num = match[1];
        } else {
            const titleNumMatch = title.match(/(\d+)\s*(?:화|회|편|권)/) || title.match(/^(\d+)/) || title.match(/\((\d+)\)/);
            if (titleNumMatch) num = titleNumMatch[1];
        }

        if (subRaw) {
            num = `${num}_${subRaw}`;
        }

        if (el && el._tokiEffectiveNum) {
            num = el._tokiEffectiveNum;
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
            '.theme-novel-content',
            '.novel-epub-rendered',
            ...String(selector).split(',').map(s => s.trim()).filter(Boolean),
            'article.novel-viewer',
            '#novel_content'
        ];

        const deepText = extractDeepNovelText(iframeDocument, candidateSelectors);
        if (deepText && deepText.length >= 40) return deepText;

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
     * 문서 제목(작품명) 정제 헬퍼 — 사이트 접미사("- 북토끼 소설 - 뉴토끼", "| 뉴토끼"), 작가 접미사 및 카테고리 배지("웹소설", "일본만화") 완벽 필터링
     * @private
     */
    _cleanSeriesTitleText(raw) {
        if (!raw || typeof raw !== 'string') return null;
        const hadPipe = raw.includes('|');
        let cleaned = raw
            .replace(/\s*\|\s*.*$/, '')
            .replace(/\s+-\s+(?:북토끼|마나토끼|뉴토끼|블랙툰|웹툰|일본만화|웹소설|소설|만화|무료).*$/i, '')
            .replace(/^(?:북토끼|마나토끼|뉴토끼|블랙툰)\s*[-|:]\s*/i, '')
            .trim();

        // "전설급 영웅은 아카데미 우등생 - 만성이(...) | 뉴토끼" 형태에서 파이프(|) 앞의 "- 작가명" 제거
        if (hadPipe && /\s+-\s+[^-]+$/.test(cleaned)) {
            const strippedAuthor = cleaned.replace(/\s+-\s+[^-]+$/, '').trim();
            if (strippedAuthor.length >= 2) {
                cleaned = strippedAuthor;
            }
        }

        if (!cleaned || cleaned.length < 1) return null;

        // 사이트명, 반복된 사이트명("북토끼 북토끼"), 카테고리 단독 명칭("웹소설", "일본만화", "일반웹툰" 등) 배제
        if (/^(?:뉴토끼|북토끼|마나토끼|블랙툰|홈|메인|웹툰|일반웹툰|성인웹툰|완결웹툰|BL\/GL|만화|일본만화|완결만화|소설|웹소설|완결소설|애니|업데이트|로그인|회원가입|검색|공지사항|자유게시판|소설목록|만화목록|웹툰목록|전체\s*회차|작품\s*정보|unknown\s*series|unknownseries)(?:\s+(?:뉴토끼|북토끼|마나토끼|블랙툰|웹툰|만화|소설|미리보기))*$/i.test(cleaned)) {
            return null;
        }
        if (/웹툰\s*미리보기|최신\s*웹툰|무료\s*웹툰|팝업레이어|로그인\s*하러/i.test(cleaned)) {
            return null;
        }
        return cleaned;
    }

    getSeriesTitle() {
        const meta = this.rule.meta || {};
        const rawCandidates = Array.isArray(meta.title) ? meta.title : (meta.title ? [meta.title] : []);
        const fallbackConfigs = [
            'h1.hero-v2-title',
            'div.nd-info > h1',
            '.nd-title',
            { selector: 'meta[name="subject"]', attr: 'content' },
            '.view-title .view-content strong',
            '.view-title h1',
            { selector: 'meta[property="og:title"]', attr: 'content' }
        ];

        for (const cfg of [...rawCandidates, ...fallbackConfigs]) {
            if (cfg === '.page-desc') continue; // .page-desc는 카테고리명("웹소설", "일본만화")이므로 타이틀에서 배제
            const rawVal = this._extractValue(this._doc, cfg);
            const cleaned = this._cleanSeriesTitleText(rawVal);
            if (cleaned) return cleaned;
        }

        if (this._doc && this._doc.title) {
            const cleanedDocTitle = this._cleanSeriesTitleText(this._doc.title);
            if (cleanedDocTitle) return cleanedDocTitle;
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
