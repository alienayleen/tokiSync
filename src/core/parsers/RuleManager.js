import { CFG_PARSER_RULES } from '../config.js';

/**
 * RuleManager
 * Manages parsing rules from built-in templates and user definitions.
 */
export class RuleManager {
    static get _version() {
        return typeof __SCRIPT_VERSION__ !== 'undefined' ? __SCRIPT_VERSION__ : '1.26.7';
    }

    static #builtInRules = [
        {
                "id": "blacktoon_webtoon",
                "name": "통합 웹툰 규칙 (신형 v2 & 뉴토끼/마나토끼 호환)",
                "_version": "1.26.7",
                "urlPattern": ".*/(webtoon|toon)/.*",
                "idExtraction": {
                        "source": "url",
                        "regex": "\\/(?:webtoon|toon)\\/([a-zA-Z0-9_\\-]+)"
                },
                "category": "Webtoon",
                "meta": {
                        "title": [
                                ".view-title .view-content strong",
                                "h1.hero-v2-title",
                                "div.nd-info > h1",
                                {
                                        "selector": "meta[name=\"subject\"]",
                                        "attr": "content"
                                },
                                ".view-title h1",
                                {
                                        "selector": "meta[property=\"og:title\"]",
                                        "attr": "content"
                                }
                        ],
                        "author": [
                                "div.hero-v2-author",
                                "div.nd-meta span:first-child",
                                {
                                        "selector": ".view-content",
                                        "regex": "(?:작가|저자|글작가|글)\\s*:\\s*([^ \\n\\r,·/]+)"
                                },
                                ".view-content"
                        ],
                        "thumb": {
                                "selector": "div.hero-v2-thumb > img, div.nd-thumb img, img[itemprop=\"image\"]",
                                "attr": "src"
                        },
                        "status": "span.pill-status",
                        "tags": "div.hero-v2-tags"
                },
                "list": {
                        "container": "ul.ep-list-v2, .list-body, #toon_list",
                        "item": "li.ep-row-v2, li.list-item, li, #toon_list > div.card",
                        "num": [
                                "span.ep-row-v2-no",
                                ".wr-num",
                                "span.no",
                                "p",
                                ".num",
                                ".td_num"
                        ],
                        "title": [
                                ".ep-row-v2-title strong",
                                ".ep-row-v2-title",
                                ".wr-subject a",
                                "a.item-subject",
                                "a",
                                "p"
                        ],
                        "sub": {
                                "selector": "span.sub",
                                "regex": "\\[(.*?)\\]"
                        },
                        "link": {
                                "selector": "a.ep-row-v2-link, .wr-subject a, a.item-subject, a",
                                "attr": "href"
                        },
                        "date": "span.ep-row-v2-date, .wr-date"
                },
                "viewer": {
                        "fetchMethod": "iframe",
                        "keyDiscovery": {
                                "regex": "data_attribute\\s*:\\s*['\"]([^'\"]+)['\"]",
                                "prefix": "data-"
                        },
                        "imageContainer": "div.vw-imgs, div.view-padding, div#toon_content_imgs, div.viewer, main.vw-main",
                        "imageItem": "img",
                        "lazyAttrOptions": [
                                "data-src",
                                "data-lazy",
                                "data-original",
                                "o-src",
                                "data-url",
                                "data-img",
                                "src"
                        ],
                        "seriesTitle": "div.crumb a:last-of-type, meta[property=\"og:title\"]",
                        "episodeTitle": "h1, .view-title, .vw-head-title",
                        "episodeNum": "div.crumb strong"
                }
        },
        {
                "id": "blacktoon_manhwa",
                "name": "통합 만화 규칙 (신형 v2 & 마나토끼/뉴토끼 호환)",
                "_version": "1.26.7",
                "urlPattern": ".*/(manhwa|manga|comic)/.*",
                "idExtraction": {
                        "source": "url",
                        "regex": "\\/(?:manhwa|manga|comic)\\/([a-zA-Z0-9_\\-]+)"
                },
                "category": "Manga",
                "meta": {
                        "title": [
                                ".view-title .view-content strong",
                                "h1.hero-v2-title",
                                "div.nd-info > h1",
                                {
                                        "selector": "meta[name=\"subject\"]",
                                        "attr": "content"
                                },
                                ".view-title h1",
                                {
                                        "selector": "meta[property=\"og:title\"]",
                                        "attr": "content"
                                }
                        ],
                        "author": [
                                "div.hero-v2-author",
                                "div.nd-meta span:first-child",
                                {
                                        "selector": ".view-content",
                                        "regex": "(?:작가|저자|글작가|글)\\s*:\\s*([^ \\n\\r,·/]+)"
                                },
                                ".view-content"
                        ],
                        "thumb": {
                                "selector": "div.hero-v2-thumb > img, div.nd-thumb img, img[itemprop=\"image\"]",
                                "attr": "src"
                        },
                        "status": "span.pill-status",
                        "tags": "div.hero-v2-tags"
                },
                "list": {
                        "container": "ul.ep-list-v2, .list-body, #toon_list",
                        "item": "li.ep-row-v2, li.list-item, li, #toon_list > div.card",
                        "num": [
                                "span.ep-row-v2-no",
                                ".wr-num",
                                "span.no",
                                "p",
                                ".num",
                                ".td_num"
                        ],
                        "title": [
                                ".ep-row-v2-title strong",
                                ".ep-row-v2-title",
                                ".wr-subject a",
                                "a.item-subject",
                                "a",
                                "p"
                        ],
                        "sub": {
                                "selector": "span.sub",
                                "regex": "\\[(.*?)\\]"
                        },
                        "link": {
                                "selector": "a.ep-row-v2-link, .wr-subject a, a.item-subject, a",
                                "attr": "href"
                        },
                        "date": "span.ep-row-v2-date, .wr-date"
                },
                "viewer": {
                        "fetchMethod": "iframe",
                        "keyDiscovery": {
                                "regex": "data_attribute\\s*:\\s*['\"]([^'\"]+)['\"]",
                                "prefix": "data-"
                        },
                        "imageContainer": "div.vw-imgs, div.view-padding, div#toon_content_imgs, div.viewer, main.vw-main",
                        "imageItem": "img",
                        "lazyAttrOptions": [
                                "data-src",
                                "data-lazy",
                                "data-original",
                                "o-src",
                                "data-url",
                                "data-img",
                                "src"
                        ],
                        "seriesTitle": "div.crumb a:last-of-type, meta[property=\"og:title\"]",
                        "episodeTitle": "h1, .view-title, .vw-head-title",
                        "episodeNum": "div.crumb strong"
                }
        },
        {
                "id": "blacktoon_novel",
                "name": "통합 소설 규칙 (신형 v2 & 북토끼/뉴토끼 호환)",
                "_version": "1.26.7",
                "urlPattern": ".*/(novel|book)/.*",
                "idExtraction": {
                        "source": "url",
                        "regex": "\\/(?:novel|book)\\/([a-zA-Z0-9_\\-]+)"
                },
                "category": "Novel",
                "meta": {
                        "title": [
                                ".view-title .view-content strong",
                                "div.nd-info > h1",
                                "h1.hero-v2-title",
                                {
                                        "selector": "meta[name=\"subject\"]",
                                        "attr": "content"
                                },
                                ".view-title h1",
                                {
                                        "selector": "meta[property=\"og:title\"]",
                                        "attr": "content"
                                }
                        ],
                        "author": [
                                "div.nd-meta span:first-child",
                                "div.hero-v2-author",
                                {
                                        "selector": ".view-content",
                                        "regex": "(?:작가|저자|글작가|글)\\s*:\\s*([^ \\n\\r,·/]+)"
                                },
                                ".view-content"
                        ],
                        "thumb": {
                                "selector": "div.nd-thumb img, div.hero-v2-thumb > img, img[itemprop=\"image\"]",
                                "attr": "src"
                        },
                        "tags": "div.hero-v2-tags"
                },
                "list": {
                        "container": "ul.novel-eps, ul.ep-list-v2, .list-body",
                        "item": "li.ep-row-v2, li.list-item, li",
                        "num": [
                                "span.ne-num",
                                "span.ep-row-v2-no",
                                ".wr-num",
                                "span.no",
                                ".num",
                                ".td_num"
                        ],
                        "title": [
                                "span.ne-title",
                                ".ep-row-v2-title strong",
                                ".ep-row-v2-title",
                                ".wr-subject a",
                                "a.item-subject",
                                "a"
                        ],
                        "sub": {
                                "selector": "span.sub",
                                "regex": "\\[(.*?)\\]"
                        },
                        "link": {
                                "selector": "a.ep-row-v2-link, .wr-subject a, a.item-subject, a",
                                "attr": "href"
                        },
                        "date": "span.ne-date, span.ep-row-v2-date, .wr-date"
                },
                "viewer": {
                        "fetchMethod": "api",
                        "decryptApi": {
                                "endpoint": "/api/novel-content",
                                "cookieName": "nv",
                                "clientHeader": "shadow-v2"
                        },
                        "seriesTitle": "div.crumb a:last-of-type, meta[property=\"og:title\"]",
                        "episodeTitle": "h1.ne-h1, .view-title, h1",
                        "episodeNum": "div.crumb strong",
                        "novelContent": "article.novel-viewer, #novel_content, .novel-epub-rendered, .theme-novel-content",
                        "imageContainer": "article.novel-viewer, #novel_content",
                        "imageItem": "p",
                        "lazyAttrOptions": []
                }
        },
        {
                "id": "toki_common",
                "name": "구형 토끼 계열 (그누보드 뉴토끼/마나토끼/북토끼) 통합 규칙",
                "_version": "1.26.7",
                "urlPattern": "^(?!.*(newtoki[0-9]*\\.org|sbxh[0-9]*\\.|ntk[0-9]*\\.)).*(newtoki|manatoki|comic|booktoki).*",
                "category": "Webtoon",
                "meta": {
                        "title": [
                                ".view-title .view-content strong",
                                {
                                        "selector": "meta[name=\"subject\"]",
                                        "attr": "content"
                                },
                                "h1.hero-v2-title",
                                "div.nd-info > h1",
                                ".view-title h1",
                                {
                                        "selector": "meta[property=\"og:title\"]",
                                        "attr": "content"
                                }
                        ],
                        "author": ".view-content",
                        "thumb": {
                                "selector": "img[itemprop=\"image\"]",
                                "attr": "src"
                        }
                },
                "list": {
                        "container": ".list-body, ul.ep-list-v2, ul.novel-eps",
                        "item": "li.list-item, li.ep-row-v2, li",
                        "num": [
                                ".wr-num",
                                "span.no",
                                "span.ep-row-v2-no",
                                "span.ne-num",
                                ".num",
                                ".td_num"
                        ],
                        "title": [
                                ".wr-subject a",
                                "a.item-subject",
                                ".ep-row-v2-title strong",
                                ".ep-row-v2-title",
                                "span.ne-title",
                                "a"
                        ],
                        "link": {
                                "selector": ".wr-subject a, a.item-subject, a.ep-row-v2-link, a",
                                "attr": "href"
                        }
                },
                "viewer": {
                        "fetchMethod": "iframe",
                        "keyDiscovery": {
                                "regex": "data_attribute\\s*:\\s*['\"]([^'\"]+)['\"]",
                                "prefix": "data-"
                        },
                        "imageContainer": "div.view-padding, div.vw-imgs, div.viewer",
                        "imageItem": "img",
                        "novelContent": "#novel_content, article.novel-viewer",
                        "lazyAttrOptions": [
                                "data-src",
                                "data-original",
                                "data-lazy",
                                "data-url",
                                "data-img",
                                "src"
                        ]
                }
        }
];

    static async getRules() {
        if (typeof GM_getValue !== 'undefined' && typeof GM_deleteValue !== 'undefined') {
            const legacyRulesStr = GM_getValue('TOKI_CUSTOM_RULES');
            if (legacyRulesStr) {
                try {
                    const legacyRules = JSON.parse(legacyRulesStr);
                    if (Array.isArray(legacyRules) && legacyRules.length > 0) {
                        console.log("[RuleManager] 🚚 레거시 커스텀 규칙(TOKI_CUSTOM_RULES) 감지 -> TOKI_PARSER_RULES로 마이그레이션을 수행합니다.");
                        let currentRules = this.getParserRules();
                        legacyRules.forEach(legacyRule => {
                            if (!currentRules.some(r => r.id === legacyRule.id)) {
                                currentRules.push(legacyRule);
                            }
                        });
                        this.saveParserRules(currentRules);
                        console.log("[RuleManager] ✅ 커스텀 규칙 병합 완료.");
                    }
                } catch (e) {
                    console.error("[RuleManager] ❌ 레거시 규칙 파싱 실패:", e);
                } finally {
                    GM_deleteValue('TOKI_CUSTOM_RULES');
                }
            }
        }

        let parserRules = this.getParserRules();

        if (parserRules.length === 0) {
            console.log("[RuleManager] 🚀 초기 구동 감지 -> 정적 기본 샘플 규칙을 TOKI_PARSER_RULES에 이식(Seed)합니다.");
            parserRules = [...this.#builtInRules];
            this.saveParserRules(parserRules);
        } else {
            let modified = false;
            const builtInMap = new Map(this.#builtInRules.map(b => [b.id, b]));
            const builtInIds = ['blacktoon_webtoon', 'blacktoon_manhwa', 'blacktoon_novel'];

            // 1. 누락된 기본 규칙 추가
            const missingBuiltIns = this.#builtInRules.filter(b => builtInIds.includes(b.id) && !parserRules.some(r => r.id === b.id));
            if (missingBuiltIns.length > 0) {
                parserRules = [...missingBuiltIns, ...parserRules];
                modified = true;
            }

            // 2. 기존 내장 규칙(blacktoon_*, toki_common)을 최신 v1.26.7 통합 스펙으로 자동 업그레이드
            parserRules = parserRules.map(r => {
                if (builtInMap.has(r.id) && r._version !== '1.26.7') {
                    modified = true;
                    return { ...builtInMap.get(r.id), _version: '1.26.7' };
                }
                return r;
            });

            // 3. toki_common이 v2/통합 규칙보다 앞에 있다면 맨 뒤로 이동
            const tokiIdx = parserRules.findIndex(r => r.id === 'toki_common');
            if (tokiIdx !== -1 && tokiIdx < parserRules.length - 1) {
                const [tokiRule] = parserRules.splice(tokiIdx, 1);
                parserRules.push(tokiRule);
                modified = true;
            }

            if (modified) {
                console.log("[RuleManager] 🔄 v1.26.7 통합 파서 규칙(newtoki1.org & sbxh9.com 겸용) 자동 업그레이드 완료.");
                this.saveParserRules(parserRules);
            }
        }

        return parserRules;
    }

    static getParserRules() {
        if (typeof GM_getValue === 'undefined') return [];
        const str = GM_getValue(CFG_PARSER_RULES, '[]');
        try {
            return JSON.parse(str) || [];
        } catch (e) {
            return [];
        }
    }

    static saveParserRules(rules) {
        if (typeof GM_setValue === 'undefined') return;
        const version = this._version;
        rules.forEach(rule => { if (rule && typeof rule === 'object' && !rule._version) rule._version = version; });
        GM_setValue(CFG_PARSER_RULES, JSON.stringify(rules, null, 2));
    }

    static addRule(rule) {
        const rules = this.getParserRules();
        if (rules.find(r => r.id === rule.id)) return false;
        rules.push(rule);
        this.saveParserRules(rules);
        return true;
    }

    static updateRule(id, updatedRule) {
        const rules = this.getParserRules();
        const idx = rules.findIndex(r => r.id === id);
        if (idx === -1) return false;
        rules[idx] = updatedRule;
        this.saveParserRules(rules);
        return true;
    }

    static deleteRule(id) {
        const rules = this.getParserRules();
        const filtered = rules.filter(r => r.id !== id);
        this.saveParserRules(filtered);
        return true;
    }

    static bulkImport(newRules, mode = 'merge') {
        const current = this.getParserRules();
        const version = this._version;
        let imported = 0, updated = 0, skipped = 0;

        newRules.forEach(rule => {
            if (!rule.id) { skipped++; return; }
            if (!rule._version) rule._version = version;
            const idx = current.findIndex(r => r.id === rule.id);
            if (idx === -1) {
                current.push(rule);
                imported++;
            } else if (mode === 'overwrite') {
                current[idx] = rule;
                updated++;
            } else {
                skipped++;
            }
        });

        this.saveParserRules(current);
        return { imported, updated, skipped };
    }

    static async matchRule(url) {
        const rules = await this.getRules();
        for (const rule of rules) {
            if (!rule.urlPattern) continue;
            try {
                const regex = new RegExp(rule.urlPattern, 'i');
                if (regex.test(url)) {
                    console.log(`[RuleManager] Matched rule: ${rule.name || rule.id}`);
                    return rule;
                }
            } catch (e) {
                console.warn(`[RuleManager] Invalid regex pattern: ${rule.urlPattern}`, e);
            }
        }
        return null;
    }
}
