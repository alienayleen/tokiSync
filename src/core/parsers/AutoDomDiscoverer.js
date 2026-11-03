/**
 * AutoDomDiscoverer
 * 정규식이나 수동 JSON 규칙 작성 없이 현재 페이지의 DOM 구조를 휴리스틱으로 분석하여
 * 즉석에서 GenericParser 호환 규칙(Rule)을 추론 및 생성하는 자율형 파서 엔진.
 */

export class AutoDomDiscoverer {
    /**
     * 짧은 CSS 셀렉터 생성 (tag.class1.class2)
     */
    static shortSelector(el) {
        if (!el || !el.tagName) return null;
        const tag = el.tagName.toLowerCase();
        if (el.id && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(el.id)) {
            return `${tag}#${el.id}`;
        }
        const cls = (typeof el.className === 'string' && el.className.trim())
            ? '.' + el.className.trim().split(/\s+/).filter(c => !/^(active|selected|hover|open|ready|on|off|--)/.test(c) && !c.includes('--')).slice(0, 2).join('.')
            : '';
        return `${tag}${cls === '.' ? '' : cls}`;
    }

    /**
     * URL 및 DOM 시그니처를 기반으로 카테고리(Webtoon / Manga / Novel) 자동 판별
     */
    static inferCategory(doc, url = '') {
        const lowerUrl = (url || doc?.URL || '').toLowerCase();
        if (/\/(novel|book|fiction|webnovel)(\/|\?|$)/.test(lowerUrl)) return 'Novel';
        if (/\/(manhwa|manga|comic)(\/|\?|$)/.test(lowerUrl)) return 'Manga';
        if (/\/(webtoon|toon)(\/|\?|$)/.test(lowerUrl)) return 'Webtoon';

        if (doc && typeof doc.querySelector === 'function') {
            if (doc.querySelector('article.novel-viewer, #novel_content, .novel-viewer, ul.novel-eps, .nd-info')) {
                return 'Novel';
            }
            const crumbText = doc.querySelector('.crumb, .breadcrumb, nav')?.textContent || '';
            if (crumbText.includes('소설')) return 'Novel';
            if (crumbText.includes('만화') || crumbText.includes('코믹')) return 'Manga';
        }
        return 'Webtoon';
    }

    /**
     * 매칭된 규칙이 실제 현재 문서의 DOM 구조와 호환되는지 검증
     * (예: newtoki1.org가 이름 때문에 구형 toki_common에 매칭되었으나 실제 DOM은 v2 구조인 경우 감지)
     */
    static isRuleCompatibleWithDom(rule, doc) {
        if (!rule || !doc || typeof doc.querySelector !== 'function') return true;

        const listContSel = rule.list?.container;
        const viewerImgSel = rule.viewer?.imageContainer;
        const viewerNovelSel = rule.viewer?.novelContent;
        const metaTitleSel = typeof rule.meta?.title === 'string' ? rule.meta.title : rule.meta?.title?.selector;

        // 현재 페이지가 알려진 다른 아키텍처(예: v2 엔진 vs 구형 그누보드)의 명확한 시그니처를 갖고 있는지 확인
        const hasV2Signature = Boolean(
            doc.querySelector('ul.ep-list-v2, h1.hero-v2-title, div.vw-imgs, article.novel-viewer, ul.novel-eps, div.nd-info')
        );
        const hasLegacyGnuboardSignature = Boolean(
            doc.querySelector('.list-body, .view-padding, #novel_content, .view-title')
        );

        // 구형 규칙(toki_common 등)이 매칭되었는데 실제 DOM은 신형 v2 시그니처만 존재하는 경우 -> 비호환(false)
        if (listContSel === '.list-body' && hasV2Signature && !hasLegacyGnuboardSignature) {
            return false;
        }
        // 반대로 v2 규칙이 매칭되었는데 실제 DOM은 구형 그누보드 시그니처만 존재하는 경우 -> 비호환(false)
        if ((listContSel === 'ul.ep-list-v2' || listContSel === 'ul.novel-eps') && hasLegacyGnuboardSignature && !hasV2Signature) {
            return false;
        }

        // 목록 컨테이너, 뷰어 컨테이너, 메타 타이틀 중 하나라도 현재 DOM에 존재하면 호환으로 판정
        try {
            if (listContSel && doc.querySelector(listContSel)) return true;
            if (viewerImgSel && doc.querySelector(viewerImgSel)) return true;
            if (viewerNovelSel && doc.querySelector(viewerNovelSel)) return true;
            if (metaTitleSel && doc.querySelector(metaTitleSel)) return true;
        } catch (e) {}

        // 만약 현재 규칙의 셀렉터가 아무것도 매칭되지 않는데, 휴리스틱 탐색기가 유효한 목록/뷰어를 찾을 수 있다면 비호환(false) 반환
        const discovered = this.discover(doc, doc.URL || '');
        if (discovered && discovered._confidence >= 0.6) {
            return false;
        }

        return true;
    }

    /**
     * 현재 DOM을 분석하여 메타데이터 셀렉터 추론
     */
    static inferMeta(doc) {
        const meta = {};
        if (!doc || typeof doc.querySelector !== 'function') return meta;

        const isJunkTitle = (txt) => {
            if (!txt) return true;
            const c = txt.replace(/\s*\|\s*.*$/, '').replace(/\s+-\s+(?:북토끼|마나토끼|뉴토끼|블랙툰|웹툰|일본만화|웹소설|소설|만화).*$/i, '').trim();
            if (!c || c.length < 2) return true;
            if (/^(?:뉴토끼|북토끼|마나토끼|블랙툰|홈|메인|웹툰|일반웹툰|성인웹툰|완결웹툰|만화|일본만화|완결만화|소설|웹소설|완결소설|로그인|회원가입|검색|공지사항)(\s+.*)?$/i.test(c)) return true;
            if (/미리보기|팝업레이어|로그인/.test(c)) return true;
            return false;
        };

        const titleCandidates = [
            'h1.hero-v2-title',
            'div.nd-info > h1',
            '.nd-title',
            'h1.title',
            'h1.series-title',
            '.view-title .view-content strong',
            '.view-title h1',
            '.hero h1',
            'main h1'
        ];
        for (const sel of titleCandidates) {
            try {
                const el = doc.querySelector(sel);
                if (el && !el.closest?.('header, nav, #hd, #header, .header, .navbar, .modal') && !isJunkTitle(el.textContent)) {
                    meta.title = sel;
                    break;
                }
            } catch (e) {}
        }
        if (!meta.title) {
            const metaSubj = doc.querySelector('meta[name="subject"]');
            if (metaSubj && !isJunkTitle(metaSubj.getAttribute('content'))) {
                meta.title = { selector: 'meta[name="subject"]', attr: 'content' };
            } else if (doc.querySelector('meta[property="og:title"]') && !isJunkTitle(doc.querySelector('meta[property="og:title"]').getAttribute('content'))) {
                meta.title = { selector: 'meta[property="og:title"]', attr: 'content' };
            } else {
                const h1s = Array.from(doc.querySelectorAll('h1, h2'));
                for (const h of h1s) {
                    if (!h.closest?.('header, nav, #hd, #header, .header, .navbar, .modal') && !isJunkTitle(h.textContent)) {
                        meta.title = this.shortSelector(h) || 'h1';
                        break;
                    }
                }
            }
        }

        const authorCandidates = [
            'div.hero-v2-author',
            'div.nd-meta span:first-child',
            '.nd-author',
            '.author-name',
            '[class*="author"]',
            '.view-content'
        ];
        for (const sel of authorCandidates) {
            try {
                const el = doc.querySelector(sel);
                if (el && el.textContent && el.textContent.trim().length > 0 && el.textContent.trim().length < 100) {
                    meta.author = sel;
                    break;
                }
            } catch (e) {}
        }

        const thumbCandidates = [
            { selector: 'div.hero-v2-thumb > img', attr: 'src' },
            { selector: 'div.nd-thumb img', attr: 'src' },
            { selector: 'img[itemprop="image"]', attr: 'src' },
            { selector: '.series-thumb img, .cover img, img[class*="thumb"]', attr: 'src' },
            { selector: 'meta[property="og:image"]', attr: 'content' }
        ];
        for (const cand of thumbCandidates) {
            try {
                const el = doc.querySelector(cand.selector);
                if (el && el.getAttribute(cand.attr)) {
                    meta.thumb = cand;
                    break;
                }
            } catch (e) {}
        }

        if (doc.querySelector('span.pill-status')) {
            meta.status = 'span.pill-status';
        }
        if (doc.querySelector('div.hero-v2-tags')) {
            meta.tags = 'div.hero-v2-tags';
        }

        return meta;
    }

    /**
     * 현재 DOM을 분석하여 에피소드 목록(List) 셀렉터 추론
     */
    static inferList(doc) {
        if (!doc || typeof doc.querySelectorAll !== 'function') return null;

        // 1. 알려진 표준 아키텍처 프리셋 우선 검사
        const presets = [
            {
                container: 'ul.ep-list-v2',
                item: 'li.ep-row-v2',
                num: 'span.ep-row-v2-no',
                title: '.ep-row-v2-title strong',
                sub: { selector: 'span.sub', regex: '\\[(.*?)\\]' },
                link: { selector: 'a.ep-row-v2-link', attr: 'href' },
                date: 'span.ep-row-v2-date'
            },
            {
                container: 'ul.novel-eps',
                item: 'li',
                num: 'span.ne-num',
                title: 'span.ne-title',
                sub: { selector: 'span.sub', regex: '\\[(.*?)\\]' },
                link: { selector: 'a', attr: 'href' },
                date: 'span.ne-date'
            },
            {
                container: '.list-body',
                item: 'li',
                num: ['.wr-num', 'span.no'],
                title: 'a',
                link: { selector: 'a', attr: 'href' }
            },
            {
                container: '#toon_list',
                item: '#toon_list > div.card',
                num: 'p',
                title: 'p',
                link: { selector: 'a', attr: 'href' }
            }
        ];

        for (const preset of presets) {
            try {
                const cont = doc.querySelector(preset.container);
                if (cont && cont.querySelectorAll(preset.item).length > 0) {
                    return { ...preset, _presetMatched: true };
                }
            } catch (e) {}
        }

        // 2. 범용 휴리스틱 컨테이너 스캔 (반복되는 자식 + 링크 + 회차 번호 패턴 점수화)
        const candidates = Array.from(doc.querySelectorAll('ul, ol, tbody, div[class*="list"], div[class*="ep"], section[class*="ep"]'));
        let bestContainer = null;
        let bestItemTag = 'li';
        let bestScore = 0;

        for (const cand of candidates) {
            const children = Array.from(cand.children || []);
            if (children.length < 2) continue;

            // 자식 중 가장 빈도가 높은 태그 확인
            const tagCounts = {};
            for (const ch of children) {
                const t = ch.tagName ? ch.tagName.toLowerCase() : '';
                if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
            }
            const topEntry = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
            if (!topEntry || topEntry[1] < 2) continue;

            const itemTag = topEntry[0];
            const items = children.filter(c => c.tagName.toLowerCase() === itemTag);
            const sample = items.slice(0, Math.min(5, items.length));

            let withLink = 0;
            let withNum = 0;
            for (const item of sample) {
                const a = item.tagName === 'A' ? item : item.querySelector('a[href]');
                if (a && a.getAttribute('href') && !a.getAttribute('href').startsWith('#') && !a.getAttribute('href').startsWith('javascript')) {
                    withLink++;
                }
                const text = item.textContent || '';
                if (/\d+/.test(text)) {
                    withNum++;
                }
            }

            if (withLink === 0) continue;
            const linkRatio = withLink / sample.length;
            const numRatio = withNum / sample.length;
            if (linkRatio < 0.6) continue;

            const clsBonus = /(ep|episode|chapter|list|toon|novel|row)/i.test(`${cand.className || ''} ${cand.id || ''}`) ? 15 : 0;
            const score = (items.length * linkRatio * (0.5 + 0.5 * numRatio)) + clsBonus;

            if (score > bestScore) {
                bestScore = score;
                bestContainer = cand;
                bestItemTag = itemTag;
            }
        }

        if (!bestContainer || bestScore < 3) return null;

        const containerSelector = this.shortSelector(bestContainer) || 'ul';
        const sampleItem = bestContainer.querySelector(bestItemTag);
        if (!sampleItem) return null;

        const itemSelector = this.shortSelector(sampleItem) || bestItemTag;

        // 내부 필드(num, title, link, date) 추론
        let numSelector = itemSelector;
        let titleSelector = 'a';
        let linkSelector = 'a';
        let dateSelector = '';

        const subEls = Array.from(sampleItem.querySelectorAll('span, div, strong, b, p, td, a'));
        const numCand = subEls.find(el => {
            const cls = `${el.className || ''}`;
            const txt = (el.textContent || '').trim();
            return (/(num|no|idx|order)/i.test(cls) && /\d+/.test(txt)) || /^\d+\s*(화|회|편)?$/.test(txt);
        });
        if (numCand) {
            numSelector = this.shortSelector(numCand) || 'span';
        }

        const titleCand = subEls.find(el => {
            const cls = `${el.className || ''}`;
            return /(title|subject|name|tit)/i.test(cls) && (el.textContent || '').trim().length > 1;
        }) || sampleItem.querySelector('strong, b, a');
        if (titleCand) {
            titleSelector = this.shortSelector(titleCand) || 'a';
        }

        const anchorCand = sampleItem.tagName === 'A' ? sampleItem : sampleItem.querySelector('a[href]');
        if (anchorCand) {
            linkSelector = sampleItem.tagName === 'A' ? '' : (this.shortSelector(anchorCand) || 'a');
        }

        const dateCand = subEls.find(el => /(date|time|reg)/i.test(`${el.className || ''}`) || /\d{2,4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test((el.textContent || '').trim()));
        if (dateCand) {
            dateSelector = this.shortSelector(dateCand) || '';
        }

        return {
            container: containerSelector,
            item: itemSelector,
            num: numSelector,
            title: titleSelector,
            link: { selector: linkSelector || 'a', attr: 'href' },
            ...(dateSelector ? { date: dateSelector } : {})
        };
    }

    /**
     * 현재 DOM을 분석하여 뷰어(Viewer) 셀렉터 추론
     */
    static inferViewer(doc, category = 'Webtoon') {
        const isNovel = (category === 'Novel' || category === 'novel');
        if (isNovel) {
            const novelSelectors = [
                'article.novel-viewer',
                '#novel_content',
                '.novel-viewer',
                '.novel-epub-rendered',
                '.theme-novel-content',
                'div.view-content',
                'main article'
            ];
            let chosenNovelSel = 'article.novel-viewer, #novel_content';
            if (doc && typeof doc.querySelector === 'function') {
                for (const sel of novelSelectors) {
                    try {
                        if (doc.querySelector(sel)) {
                            chosenNovelSel = sel;
                            break;
                        }
                    } catch (e) {}
                }
            }
            return {
                fetchMethod: 'api',
                decryptApi: {
                    endpoint: '/api/novel-content',
                    cookieName: 'nv',
                    clientHeader: 'shadow-v2'
                },
                seriesTitle: 'div.crumb a:last-of-type, meta[property="og:title"]',
                episodeTitle: 'h1.ne-h1, h1, .view-title',
                episodeNum: 'div.crumb strong',
                novelContent: chosenNovelSel,
                imageContainer: chosenNovelSel,
                imageItem: 'p',
                lazyAttrOptions: []
            };
        }

        // 웹툰/만화 뷰어 컨테이너 탐지
        const knownImageContainers = [
            'div.vw-imgs',
            'div#toon_content_imgs',
            'div.view-padding',
            'div.viewer',
            'main.vw-main',
            '.viewer-images',
            '#v_content'
        ];
        let chosenContainer = 'div.vw-imgs, div#toon_content_imgs, div.view-padding, div.viewer, main.vw-main';

        if (doc && typeof doc.querySelectorAll === 'function') {
            for (const sel of knownImageContainers) {
                try {
                    const el = doc.querySelector(sel);
                    if (el && el.querySelectorAll('img').length >= 2) {
                        chosenContainer = sel;
                        break;
                    }
                } catch (e) {}
            }

            // 알려진 컨테이너가 없으면 이미지 밀도가 가장 높은 부모 요소를 자동 탐색
            if (chosenContainer.includes(',')) {
                const allImgs = Array.from(doc.querySelectorAll('img'));
                const parentCounts = new Map();
                for (const img of allImgs) {
                    const parent = img.parentElement;
                    if (!parent || parent.tagName === 'BODY') continue;
                    parentCounts.set(parent, (parentCounts.get(parent) || 0) + 1);
                }
                let bestParent = null;
                let maxImgs = 3; // 최소 4장 이상
                for (const [parent, count] of parentCounts.entries()) {
                    if (count > maxImgs) {
                        maxImgs = count;
                        bestParent = parent;
                    }
                }
                if (bestParent) {
                    const autoSel = this.shortSelector(bestParent);
                    if (autoSel && autoSel !== 'div') {
                        chosenContainer = `${autoSel}, ${chosenContainer}`;
                    }
                }
            }
        }

        return {
            fetchMethod: 'iframe',
            keyDiscovery: {
                regex: "data_attribute\\s*:\\s*['\"]([^'\"]+)['\"]",
                prefix: 'data-'
            },
            imageContainer: chosenContainer,
            imageItem: 'img',
            lazyAttrOptions: [
                'data-src',
                'data-lazy',
                'data-original',
                'o-src',
                'data-url',
                'data-img',
                'src'
            ],
            seriesTitle: 'div.crumb a:last-of-type, meta[property="og:title"]',
            episodeTitle: 'h1, .view-title, .vw-head-title',
            episodeNum: 'div.crumb strong'
        };
    }

    /**
     * 현재 문서(doc)와 URL을 종합 분석하여 즉시 실행 가능한 완전한 파서 규칙 객체를 반환
     */
    static discover(doc, url = '') {
        const targetUrl = url || doc?.URL || (typeof location !== 'undefined' ? location.href : '');
        let hostname = 'unknown';
        let pathname = '/';
        try {
            const parsed = new URL(targetUrl);
            hostname = parsed.hostname.replace(/^www\./, '');
            pathname = parsed.pathname;
        } catch (e) {}

        const category = this.inferCategory(doc, targetUrl);
        const meta = this.inferMeta(doc);
        const list = this.inferList(doc);
        const viewer = this.inferViewer(doc, category);

        // 신뢰도(confidence) 산출: 목록이나 뷰어 시그니처, 또는 URL 카테고리 경로가 명확한지 판단
        let confidence = 0;
        if (list) confidence += list._presetMatched ? 0.7 : 0.5;
        if (meta.title) confidence += 0.2;
        if (/\/(webtoon|manhwa|manga|comic|toon|novel)(\/|$)/i.test(pathname)) confidence += 0.3;
        if (doc && typeof doc.querySelector === 'function' && doc.querySelector('div.vw-imgs, div.view-padding, article.novel-viewer, #novel_content, div#toon_content_imgs')) {
            confidence += 0.6;
        }

        if (confidence < 0.4) {
            return null;
        }

        if (list && list._presetMatched) {
            delete list._presetMatched;
        }

        const catSlug = category.toLowerCase();
        const hostSlug = hostname.replace(/[^a-zA-Z0-9]/g, '_');
        const pathSegMatch = pathname.match(/^\/(webtoon|manhwa|manga|comic|toon|novel)/i);
        const pathPattern = pathSegMatch ? `\/${pathSegMatch[1].toLowerCase()}\/.*` : '.*';
        const escapedHost = hostname.replace(/\./g, '\\.');

        return {
            id: `auto_${hostSlug}_${catSlug}`,
            name: `[자동 추론] ${hostname} (${category})`,
            _autoDiscovered: true,
            _confidence: Number(confidence.toFixed(2)),
            urlPattern: `.*${escapedHost}${pathPattern}`,
            category,
            meta: Object.keys(meta).length > 0 ? meta : {
                title: 'h1.hero-v2-title, div.nd-info > h1, h1',
                author: 'div.hero-v2-author, div.nd-meta span:first-child, .view-content',
                thumb: { selector: 'div.hero-v2-thumb > img, div.nd-thumb img, img[itemprop="image"]', attr: 'src' }
            },
            list: list || {
                container: 'ul.ep-list-v2, ul.novel-eps, .list-body',
                item: 'li',
                num: ['span.ep-row-v2-no', 'span.ne-num', '.wr-num', 'span.no'],
                title: '.ep-row-v2-title strong, span.ne-title, a',
                link: { selector: 'a', attr: 'href' }
            },
            viewer
        };
    }
}
