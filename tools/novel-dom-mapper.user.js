// ==UserScript==
// @name         [Recon] Novel DOM Mapper → Rules Generator
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  소설 목록/뷰어 DOM 구조 분석 → rules.json 초안 + AI 프롬프트 자동 생성
// @author       pray4skylark
// @match        https://*.com/novel/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    const SITE_HOST = location.hostname.replace(/^www\./, '');
    const SITE_ID   = SITE_HOST.replace(/\./g, '_').replace(/_com$/, '');

    // ── 유틸 ─────────────────────────────────────────────────────────────────

    /** 요소의 짧은 CSS 셀렉터 (tag.class 최대 2개) */
    function shortSel(el) {
        if (!el) return null;
        const tag = el.tagName.toLowerCase();
        const cls = typeof el.className === 'string' && el.className.trim()
            ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
            : '';
        return `${tag}${cls}`;
    }

    /** 부모를 타고 올라가며 간소화된 경로 생성 (최대 depth 단계) */
    function pathSel(el, depth = 4) {
        const parts = [];
        let cur = el;
        for (let i = 0; i < depth && cur && cur !== document.body; i++, cur = cur.parentElement) {
            const tag = cur.tagName.toLowerCase();
            const cls = typeof cur.className === 'string' && cur.className.trim()
                ? '.' + cur.className.trim().split(/\s+/).slice(0, 2).join('.')
                : '';
            parts.unshift(`${tag}${cls}`);
        }
        return parts.join(' > ');
    }

    /** 셀렉터 → { el, text } | null */
    function q(sel) {
        try {
            const el = document.querySelector(sel);
            return el ? { el, text: el.textContent.trim().substring(0, 100) } : null;
        } catch { return null; }
    }

    /** 셀렉터 → Element[] */
    function qAll(sel) {
        try { return Array.from(document.querySelectorAll(sel)); }
        catch { return []; }
    }

    // ── 페이지 타입 감지 ──────────────────────────────────────────────────────

    function detectPageType() {
        const viewerSels = ['article.novel-viewer', '.novel-viewer', '[class*="novel-viewer"]',
                            '.vw-imgs', '[class*="viewer-wrap"]'];
        const listSels   = ['ul.novel-eps', '[class*="ep-list"]', '[class*="episode-list"]',
                            '.nd-info', '[class*="nd-info"]'];

        for (const s of viewerSels) if (document.querySelector(s)) return 'viewer';
        for (const s of listSels)   if (document.querySelector(s)) return 'list';

        const parts = location.pathname.split('/').filter(Boolean);
        return parts.length >= 3 ? 'viewer' : 'list';
    }

    // ── 메타 정보 탐색 ────────────────────────────────────────────────────────

    function analyzeMeta() {
        const R = {};

        // 제목
        const titleCands = ['div.nd-info > h1', '.nd-title', 'h1.title', 'h1.series-title', '.hero h1', 'main h1'];
        for (const s of titleCands) {
            const hit = q(s);
            if (hit && hit.text.length > 1) { R.title = { selector: s, value: hit.text, confidence: 'high' }; break; }
        }
        if (!R.title) {
            const best = qAll('h1').reduce((a, b) => a.textContent.length > b.textContent.length ? a : b, { textContent: '' });
            if (best.tagName) R.title = { selector: pathSel(best), value: best.textContent.trim().substring(0, 80), confidence: 'medium' };
        }

        // 작가
        const authorCands = ['div.nd-meta span:first-child', '.nd-author', '.author-name', '[class*="author"]', '.creator'];
        for (const s of authorCands) {
            const hit = q(s);
            if (hit && hit.text.length > 0 && hit.text.length < 50) { R.author = { selector: s, value: hit.text, confidence: 'high' }; break; }
        }

        // 썸네일
        const thumbCands = [
            { s: 'div.nd-thumb img', a: 'src' }, { s: '.series-thumb img', a: 'src' },
            { s: '.cover img', a: 'src' },        { s: 'img[class*="thumb"]', a: 'src' }
        ];
        for (const { s, a } of thumbCands) {
            const el = document.querySelector(s);
            if (el && el.getAttribute(a)) { R.thumb = { selector: s, attr: a, value: el.getAttribute(a).substring(0, 60), confidence: 'high' }; break; }
        }

        // 상태
        const statusCands = ['span.pill-status', '[class*="status"]', '[class*="badge"]'];
        for (const s of statusCands) {
            const hit = q(s);
            if (hit && hit.text.length > 0 && hit.text.length < 20) { R.status = { selector: s, value: hit.text, confidence: 'high' }; break; }
        }

        // 태그
        const tagCands = ['div.hero-v2-tags', '.tags-wrap', '[class*="tag-list"]', '.genre-list'];
        for (const s of tagCands) {
            const el = document.querySelector(s);
            if (el) {
                const tags = qAll(`${s} span, ${s} a`)
                    .map(t => t.textContent.trim()).filter(t => t.length > 0 && t.length < 20);
                if (tags.length > 0) { R.tags = { selector: s, value: tags, confidence: 'high' }; break; }
            }
        }

        return R;
    }

    // ── 에피소드 목록 탐색 ────────────────────────────────────────────────────

    function analyzeList() {
        const R = {};

        // 컨테이너: 알려진 패턴 → 없으면 li 가장 많은 ul
        const contCands = ['ul.novel-eps', 'ul[class*="ep-list"]', 'ul[class*="episode"]',
                           'ol[class*="ep"]', 'div[class*="ep-list"]'];
        let bestEl = null, bestSel = null, bestCount = 0;

        for (const s of contCands) {
            const el = document.querySelector(s);
            if (el) {
                const n = el.querySelectorAll(':scope > li, :scope > div').length;
                if (n > bestCount) { bestCount = n; bestEl = el; bestSel = s; }
            }
        }
        if (!bestEl) {
            for (const ul of qAll('ul, ol')) {
                const n = ul.querySelectorAll(':scope > li').length;
                if (n > bestCount) { bestCount = n; bestEl = ul; bestSel = pathSel(ul); }
            }
        }
        if (!bestEl || bestCount < 2) return R;

        R.container = { selector: bestSel, itemCount: bestCount, confidence: bestCount > 5 ? 'high' : 'medium' };

        // 아이템 태그
        const firstItem = bestEl.querySelector(':scope > li') || bestEl.querySelector(':scope > div');
        if (!firstItem) return R;
        R.item = { selector: firstItem.tagName.toLowerCase(), confidence: 'high' };

        // 아이템 내부 분석 (샘플 3개 합산)
        const items = Array.from(bestEl.querySelectorAll(':scope > li, :scope > div')).slice(0, 3);
        items.forEach(item => {
            const spans = Array.from(item.querySelectorAll('span'));
            const anchors = Array.from(item.querySelectorAll('a'));

            // 번호
            if (!R.num) {
                const numEl = spans.find(s => /^\d+화?$/.test(s.textContent.trim()) ||
                    /num|no\b/i.test(s.className));
                if (numEl) R.num = { selector: shortSel(numEl), value: numEl.textContent.trim(), confidence: 'high' };
            }

            // 제목 (가장 긴 텍스트 span)
            if (!R.title) {
                const titleEl = spans.reduce((a, b) => (a?.textContent?.length || 0) > (b?.textContent?.length || 0) ? a : b, null);
                if (titleEl && titleEl.textContent.trim().length > 2) {
                    R.title = { selector: shortSel(titleEl), value: titleEl.textContent.trim().substring(0, 60), confidence: 'high' };
                }
            }

            // 링크
            if (!R.link) {
                const linkEl = anchors.find(a => a.href.includes('/novel/'));
                if (linkEl) R.link = { selector: 'a', attr: 'href', value: linkEl.getAttribute('href'), confidence: 'high' };
            }

            // 날짜
            if (!R.date) {
                const dateEl = spans.find(s => /\d{4}[.\-]\d{2}[.\-]\d{2}/.test(s.textContent.trim()) ||
                    /date/i.test(s.className));
                if (dateEl) R.date = { selector: shortSel(dateEl), value: dateEl.textContent.trim(), confidence: 'high' };
            }

            // 부제
            if (!R.sub) {
                const subEl = spans.find(s => /sub/i.test(s.className));
                if (subEl) R.sub = { selector: shortSel(subEl), value: subEl.textContent.trim().substring(0, 40), confidence: 'medium' };
            }

            // 잠금/유료
            if (!R.lockClass) {
                const lockEl = item.querySelector('[class*="lock"],[class*="paid"],[class*="coin"],[class*="free"]');
                if (lockEl) R.lockClass = { selector: shortSel(lockEl), classes: lockEl.className, confidence: 'high' };
            }
        });

        // 샘플 데이터 (처음 5개)
        R.sample = Array.from(bestEl.querySelectorAll(':scope > li, :scope > div')).slice(0, 5).map((item, idx) => {
            const a = item.querySelector('a[href*="/novel/"]');
            return {
                idx,
                link: a?.getAttribute('href') || null,
                texts: Array.from(item.querySelectorAll('span')).map(s => s.textContent.trim()).filter(t => t.length > 0).slice(0, 4)
            };
        });

        return R;
    }

    // ── 뷰어 구조 탐색 ───────────────────────────────────────────────────────

    function analyzeViewer() {
        const R = {};

        // 소설 vs 웹툰
        const novelSigs   = ['article.novel-viewer', '.novel-viewer', '[class*="novel-viewer"]'];
        const webtoonSigs = ['.vw-imgs', 'div[class*="vw-img"]', '.viewer-images'];
        R.contentType = novelSigs.some(s => document.querySelector(s)) ? 'novel'
                      : webtoonSigs.some(s => document.querySelector(s)) ? 'webtoon' : 'unknown';

        // 시리즈 제목 (breadcrumb)
        const seriesCands = ['div.crumb a:last-of-type', 'nav.breadcrumb a:last-child', '.breadcrumb a:last-child'];
        for (const s of seriesCands) {
            const hit = q(s);
            if (hit && hit.text) { R.seriesTitle = { selector: s, value: hit.text, confidence: 'high' }; break; }
        }

        // 에피소드 제목
        const epTitleCands = ['h1.ne-h1', 'h1.episode-title', '.ep-title h1', '.viewer-head h1', 'main h1'];
        for (const s of epTitleCands) {
            const hit = q(s);
            if (hit && hit.text) { R.episodeTitle = { selector: s, value: hit.text, confidence: 'high' }; break; }
        }

        // 에피소드 번호
        const epNumCands = ['div.crumb strong', '.crumb strong', '.breadcrumb strong', '[class*="ep-num"]'];
        for (const s of epNumCands) {
            const hit = q(s);
            if (hit) { R.episodeNum = { selector: s, value: hit.text, confidence: 'high' }; break; }
        }

        if (R.contentType === 'novel') {
            // 소설 콘텐츠 컨테이너
            const novCands = ['article.novel-viewer', '.novel-viewer', '[class*="novel-viewer"]', 'main article'];
            for (const s of novCands) {
                const el = document.querySelector(s);
                if (el && el.querySelectorAll('p').length > 0) {
                    R.novelContent = { selector: s, paragraphCount: el.querySelectorAll('p').length, confidence: 'high' };
                    R.fetchMethod = 'api';
                    break;
                }
            }
            // 쿠키 후보
            R.cookieCandidates = document.cookie.split(';')
                .map(c => c.trim().split('=')[0].trim())
                .filter(n => n.length < 20 && !n.startsWith('_'));
        }

        if (R.contentType === 'webtoon') {
            const imgCands = ['div.vw-imgs', 'main.vw-main', '.viewer-images'];
            for (const s of imgCands) {
                const el = document.querySelector(s);
                if (el && el.querySelectorAll('img').length > 0) {
                    const imgs = el.querySelectorAll('img');
                    const lazyAttrs = ['data-src', 'data-lazy', 'data-original'].filter(a => imgs[0].hasAttribute(a));
                    R.imageContainer  = { selector: s, imageCount: imgs.length, confidence: 'high' };
                    R.lazyAttrOptions = lazyAttrs.length > 0 ? lazyAttrs : ['src'];
                    R.fetchMethod = 'iframe';
                    break;
                }
            }
        }

        return R;
    }

    // ── Rules JSON 초안 조합 ─────────────────────────────────────────────────

    function buildRulesDraft(pageType, meta, list, viewer) {
        const metaRule = {};
        if (meta.title)  metaRule.title  = meta.title.selector;
        if (meta.author) metaRule.author = meta.author.selector;
        if (meta.thumb)  metaRule.thumb  = { selector: meta.thumb.selector, attr: meta.thumb.attr };
        if (meta.status) metaRule.status = meta.status.selector;
        if (meta.tags)   metaRule.tags   = meta.tags.selector;

        const listRule = {};
        if (list.container) listRule.container = list.container.selector;
        if (list.item)      listRule.item      = list.item.selector;
        if (list.num)       listRule.num       = list.num.selector;
        if (list.title)     listRule.title     = list.title.selector;
        if (list.sub)       listRule.sub       = { selector: list.sub.selector, regex: '\\[(.*?)\\]' };
        if (list.link)      listRule.link      = { selector: list.link.selector, attr: list.link.attr };
        if (list.date)      listRule.date      = list.date.selector;

        const viewerRule = {};
        if (viewer.fetchMethod)    viewerRule.fetchMethod    = viewer.fetchMethod;
        if (viewer.seriesTitle)    viewerRule.seriesTitle    = viewer.seriesTitle.selector;
        if (viewer.episodeTitle)   viewerRule.episodeTitle   = viewer.episodeTitle.selector;
        if (viewer.episodeNum)     viewerRule.episodeNum     = viewer.episodeNum.selector;
        if (viewer.novelContent)   viewerRule.novelContent   = viewer.novelContent.selector;
        if (viewer.imageContainer) {
            viewerRule.imageContainer  = viewer.imageContainer.selector;
            viewerRule.imageItem       = 'img';
            viewerRule.lazyAttrOptions = viewer.lazyAttrOptions || ['src'];
        }
        if (viewer.fetchMethod === 'api') {
            viewerRule.decryptApi = {
                endpoint:     '/api/novel-content',
                cookieName:   viewer.cookieCandidates?.[0] || '?',
                clientHeader: '? (뷰어 페이지에서 확인 필요)'
            };
        }

        return {
            _generated: { timestamp: new Date().toISOString(), url: location.href, pageType, tool: 'novel-dom-mapper v1.0' },
            id:          `auto_${SITE_ID}_novel`,
            name:        `[자동생성] ${SITE_HOST} 소설`,
            urlPattern:  '.*/novel/.*',
            category:    'Novel',
            meta:        metaRule,
            list:        listRule,
            viewer:      viewerRule
        };
    }

    // ── AI 프롬프트 페이로드 생성 ─────────────────────────────────────────────

    function buildAiPayload(pageType, meta, list, viewer, draft) {
        const L = [];
        L.push('═══════════════════════════════════════════════════');
        L.push('[Novel DOM Mapper] AI 학습 페이로드');
        L.push(`사이트: ${SITE_HOST}  |  페이지: ${pageType === 'list' ? '작품 목록' : '뷰어'}`);
        L.push(`URL: ${location.href}`);
        L.push('═══════════════════════════════════════════════════\n');

        if (pageType === 'list') {
            L.push('=== 메타 영역 탐지 결과 ===');
            for (const [k, v] of Object.entries(meta)) {
                if (v?.selector) L.push(`  ${k}: "${v.selector}"  →  "${v.value}"  [${v.confidence}]`);
            }
            L.push('');
            L.push('=== 에피소드 리스트 탐지 결과 ===');
            if (list.container) L.push(`  container: "${list.container.selector}"  (${list.container.itemCount}개 아이템)`);
            for (const k of ['item', 'num', 'title', 'link', 'date', 'sub']) {
                if (list[k]) L.push(`  ${k}: "${list[k].selector || list[k].value}"  →  "${list[k].value || ''}"  [${list[k].confidence}]`);
            }
            if (list.lockClass) L.push(`  lockClass: "${list.lockClass.selector}"  classes: "${list.lockClass.classes}"`);
            L.push('\n  [샘플 아이템 (첫 5개)]');
            (list.sample || []).forEach(s => {
                L.push(`  [${s.idx}] link="${s.link}"  texts=[${s.texts.map(t => `"${t}"`).join(', ')}]`);
            });
        } else {
            L.push('=== 뷰어 탐지 결과 ===');
            L.push(`  콘텐츠 타입: ${viewer.contentType}`);
            for (const k of ['seriesTitle', 'episodeTitle', 'episodeNum', 'novelContent', 'imageContainer']) {
                if (viewer[k]) L.push(`  ${k}: "${viewer[k].selector}"  →  "${viewer[k].value || ''}"  [${viewer[k].confidence}]`);
            }
            if (viewer.fetchMethod) L.push(`  fetchMethod: "${viewer.fetchMethod}"`);
            if (viewer.cookieCandidates) L.push(`  쿠키 후보: [${viewer.cookieCandidates.join(', ')}]`);
        }

        L.push('\n=== 자동 생성된 Rules 초안 ===');
        L.push(JSON.stringify(draft, null, 2));
        L.push('\n─────────────────────────────────────────────────────');
        L.push('아래는 tokiSync의 rules.json 스키마입니다.');
        L.push('위 탐지 결과와 Rules 초안을 참고하여, 누락된 셀렉터를 보완하고');
        L.push('신뢰도가 medium/low인 항목을 올바른 CSS 셀렉터로 수정해주세요.');
        L.push('목록 페이지와 뷰어 페이지 모두 분석한 결과를 합쳐서 완성된');
        L.push('단일 rules.json 오브젝트를 만들어주세요.');

        return L.join('\n');
    }

    // ── 실행 & 토스트 알림 ──────────────────────────────────────────────────

    function toast(msg) {
        const d = document.createElement('div');
        d.textContent = msg;
        d.style.cssText = [
            'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
            'z-index:999999', 'background:#1a1a2e', 'color:#e2e8f0',
            'padding:10px 20px', 'border-radius:8px',
            'font:14px -apple-system,BlinkMacSystemFont,sans-serif',
            'box-shadow:0 4px 16px rgba(0,0,0,0.4)', 'opacity:0.97',
            'border:1px solid rgba(255,255,255,0.1)'
        ].join(';');
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 2000);
    }

    function clip(text, label) {
        GM_setClipboard(text, 'text');
        toast(`✅ ${label} 복사 완료 (${text.length.toLocaleString()}자)`);
    }

    function runAnalysis() {
        const pageType = detectPageType();
        const meta     = analyzeMeta();
        const list     = pageType === 'list'   ? analyzeList()   : {};
        const viewer   = pageType === 'viewer' ? analyzeViewer() : {};
        const draft    = buildRulesDraft(pageType, meta, list, viewer);
        const payload  = buildAiPayload(pageType, meta, list, viewer, draft);
        return { pageType, meta, list, viewer, draft, payload };
    }

    // ── Tampermonkey 메뉴 등록 ───────────────────────────────────────────────

    GM_registerMenuCommand('🤖 AI 학습 페이로드 복사', () => {
        const { payload, pageType } = runAnalysis();
        clip(payload, `AI 페이로드 (${pageType})`);
    });

    GM_registerMenuCommand('📐 Rules 초안 JSON 복사', () => {
        const { draft } = runAnalysis();
        clip(JSON.stringify(draft, null, 2), 'Rules 초안 JSON');
    });

    GM_registerMenuCommand('📋 에피소드 목록 복사 (링크)', () => {
        const { list, pageType } = runAnalysis();
        if (pageType !== 'list') { toast('❌ 목록 페이지에서만 사용 가능합니다'); return; }
        const links = (list.sample || []).map(s => s.link).filter(Boolean);
        clip(links.join('\n'), `에피소드 링크 ${links.length}건`);
    });

    GM_registerMenuCommand('🔍 DOM 전체 분석 덤프', () => {
        const { pageType, meta, list, viewer, draft } = runAnalysis();
        const dump = JSON.stringify({ pageType, meta, list, viewer, draft }, null, 2);
        clip(dump, 'DOM 분석 전체 덤프');
    });

    // 자동 실행: 페이지 로드 후 콘솔에 요약 출력
    window.addEventListener('load', () => {
        setTimeout(() => {
            const { pageType, meta, list, viewer } = runAnalysis();
            const summary = [
                `[novel-dom-mapper] 분석 완료`,
                `  페이지 타입: ${pageType}`,
                `  메타: ${Object.keys(meta).length}개 항목 감지`,
                pageType === 'list'   ? `  에피소드: ${list.container?.itemCount || 0}개 아이템` : '',
                pageType === 'viewer' ? `  콘텐츠: ${viewer.contentType}` : '',
                `  Tampermonkey 메뉴에서 "🤖 AI 학습 페이로드 복사" 실행`
            ].filter(Boolean).join('\n');
            console.info('%c' + summary, 'color:#7c3aed;font-weight:bold');
        }, 2500);
    });

})();
