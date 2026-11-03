import { CFG_PARSER_RULES } from '../config.js';

/**
 * RuleManager
 * Manages parsing rules from built-in templates and user definitions.
 */
export class RuleManager {
    // Built-in sample rules as fallback/templates (Offline Seeding)
    static get _version() {
        return typeof __SCRIPT_VERSION__ !== 'undefined' ? __SCRIPT_VERSION__ : '1.26.5';
    }

    static #builtInRules = [
        {
                "id": "blacktoon_webtoon",
                "name": "신형 토끼/블랙툰/SBXH 웹툰 전용 룰",
                "_version": "1.26.5",
                "urlPattern": ".*/webtoon/.*",
                "idExtraction": {
                        "source": "url",
                        "regex": "\\/webtoon\\/([a-zA-Z0-9_\\-]+)"
                },
                "category": "Webtoon",
                "meta": {
                        "title": "h1.hero-v2-title",
                        "author": "div.hero-v2-author",
                        "thumb": {
                                "selector": "div.hero-v2-thumb > img",
                                "attr": "src"
                        },
                        "status": "span.pill-status",
                        "tags": "div.hero-v2-tags"
                },
                "list": {
                        "container": "ul.ep-list-v2",
                        "item": "li.ep-row-v2",
                        "num": "span.ep-row-v2-no",
                        "title": ".ep-row-v2-title strong",
                        "sub": {
                                "selector": "span.sub",
                                "regex": "\\[(.*?)\\]"
                        },
                        "link": {
                                "selector": "a.ep-row-v2-link",
                                "attr": "href"
                        },
                        "date": "span.ep-row-v2-date"
                },
                "viewer": {
                        "fetchMethod": "iframe",
                        "imageContainer": "div.vw-imgs, main.vw-main",
                        "imageItem": "img",
                        "lazyAttrOptions": [
                                "data-src",
                                "data-lazy",
                                "data-original",
                                "o-src",
                                "src"
                        ]
                }
        },
        {
                "id": "blacktoon_manhwa",
                "name": "신형 토끼/블랙툰/SBXH 만화 전용 룰",
                "_version": "1.26.5",
                "urlPattern": ".*/manhwa/.*",
                "idExtraction": {
                        "source": "url",
                        "regex": "\\/manhwa\\/([a-zA-Z0-9_\\-]+)"
                },
                "category": "Manga",
                "meta": {
                        "title": "h1.hero-v2-title",
                        "author": "div.hero-v2-author",
                        "thumb": {
                                "selector": "div.hero-v2-thumb > img",
                                "attr": "src"
                        },
                        "status": "span.pill-status",
                        "tags": "div.hero-v2-tags"
                },
                "list": {
                        "container": "ul.ep-list-v2",
                        "item": "li.ep-row-v2",
                        "num": "span.ep-row-v2-no",
                        "title": ".ep-row-v2-title strong",
                        "sub": {
                                "selector": "span.sub",
                                "regex": "\\[(.*?)\\]"
                        },
                        "link": {
                                "selector": "a.ep-row-v2-link",
                                "attr": "href"
                        },
                        "date": "span.ep-row-v2-date"
                },
                "viewer": {
                        "fetchMethod": "iframe",
                        "imageContainer": "div.vw-imgs, main.vw-main",
                        "imageItem": "img",
                        "lazyAttrOptions": [
                                "data-src",
                                "data-lazy",
                                "data-original",
                                "o-src",
                                "src"
                        ]
                }
        },
        {
                "id": "blacktoon_novel",
                "name": "신형 토끼/블랙툰/SBXH 소설 전용 룰",
                "_version": "1.26.5",
                "urlPattern": ".*/novel/.*",
                "idExtraction": {
                        "source": "url",
                        "regex": "\\/novel\\/([a-zA-Z0-9_\\-]+)"
                },
                "category": "Novel",
                "meta": {
                        "title": "div.nd-info > h1, h1.hero-v2-title",
                        "author": "div.nd-meta span:first-child, div.hero-v2-author",
                        "thumb": {
                                "selector": "div.nd-thumb img, div.hero-v2-thumb > img",
                                "attr": "src"
                        },
                        "tags": "div.hero-v2-tags"
                },
                "list": {
                        "container": "ul.novel-eps, ul.ep-list-v2",
                        "item": "li",
                        "num": [
                                "span.ne-num",
                                "span.ep-row-v2-no"
                        ],
                        "title": "span.ne-title, .ep-row-v2-title strong",
                        "sub": {
                                "selector": "span.sub",
                                "regex": "\\[(.*?)\\]"
                        },
                        "link": {
                                "selector": "a",
                                "attr": "href"
                        },
                        "date": "span.ne-date, span.ep-row-v2-date"
                },
                "viewer": {
                        "fetchMethod": "api",
                        "decryptApi": {
                                "endpoint": "/api/novel-content",
                                "cookieName": "nv",
                                "clientHeader": "shadow-v2"
                        },
                        "seriesTitle": "div.crumb a:last-of-type",
                        "episodeTitle": "h1.ne-h1",
                        "episodeNum": "div.crumb strong",
                        "novelContent": "article.novel-viewer",
                        "imageContainer": "article.novel-viewer",
                        "imageItem": "p",
                        "lazyAttrOptions": []
                }
        },
        {
                "id": "toki_common",
                "name": "구형 토끼 계열 (그누보드 뉴토끼/마나토끼/북토끼) 통합 규칙",
                "_version": "1.26.5",
                "urlPattern": "^(?!.*(newtoki[0-9]*\\.org|sbxh[0-9]*\\.|ntk[0-9]*\\.)).*(newtoki|manatoki|comic|booktoki).*",
                "category": "Webtoon",
                "meta": {
                        "title": {
                                "selector": "meta[name=\"subject\"]",
                                "attr": "content"
                        },
                        "author": ".view-content",
                        "thumb": {
                                "selector": "img[itemprop=\"image\"]",
                                "attr": "src"
                        }
                },
                "list": {
                        "container": ".list-body",
                        "item": "li",
                        "num": [
                                ".wr-num",
                                "span.no"
                        ],
                        "title": "a",
                        "link": {
                                "selector": "a",
                                "attr": "href"
                        }
                },
                "viewer": {
                        "fetchMethod": "iframe",
                        "keyDiscovery": {
                                "regex": "data_attribute\\s*:\\s*['\"]([^'\"]+)['\"]",
                                "prefix": "data-"
                        },
                        "imageContainer": "div.view-padding, div.viewer",
                        "imageItem": "img",
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

    /**
     * Get all merged rules: Custom > Built-in
     * @returns {Promise<Array>}
     */
    static async getRules() {
        // [v1.25.1] 레거시 커스텀 규칙(TOKI_CUSTOM_RULES) 자동 마이그레이션 감지
        if (typeof GM_getValue !== 'undefined' && typeof GM_deleteValue !== 'undefined') {
            const legacyRulesStr = GM_getValue('TOKI_CUSTOM_RULES');
            if (legacyRulesStr) {
                try {
                    const legacyRules = JSON.parse(legacyRulesStr);
                    if (Array.isArray(legacyRules) && legacyRules.length > 0) {
                        console.log("[RuleManager] 🚚 레거시 커스텀 규칙(TOKI_CUSTOM_RULES) 감지 -> TOKI_PARSER_RULES로 마이그레이션을 수행합니다.");
                        let currentRules = this.getParserRules();
                        
                        // 중복되지 않은 아이템들만 병합
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
                    // 중복 실행 방지를 위한 안전 소거
                    GM_deleteValue('TOKI_CUSTOM_RULES');
                }
            }
        }

        let parserRules = this.getParserRules();

        // 최초 구동 시 (파서 규칙이 완전히 비어있는 경우) 내장 샘플 규칙을 자동으로 스토리지에 주입(Seed)
        if (parserRules.length === 0) {
            console.log("[RuleManager] 🚀 초기 구동 감지 -> 정적 기본 샘플 규칙을 TOKI_PARSER_RULES에 이식(Seed)합니다.");
            parserRules = [...this.#builtInRules];
            this.saveParserRules(parserRules);
        } else {
            // [v1.26.5] 기존 스토리지에 구형 toki_common만 시드되어 있거나 v2 기본 규칙이 누락된 경우 자동 보강 및 우선순위 정렬
            let modified = false;
            const builtInIds = ['blacktoon_webtoon', 'blacktoon_manhwa', 'blacktoon_novel'];
            const missingBuiltIns = this.#builtInRules.filter(b => builtInIds.includes(b.id) && !parserRules.some(r => r.id === b.id));
            if (missingBuiltIns.length > 0) {
                parserRules = [...missingBuiltIns, ...parserRules];
                modified = true;
            }
            // 구형 toki_common의 urlPattern이 newtoki1.org를 가로채지 않도록 자동 패치 및 imageRegex 오작동 제거
            const tokiIdx = parserRules.findIndex(r => r.id === 'toki_common');
            if (tokiIdx !== -1 && parserRules[tokiIdx].urlPattern === '.*(newtoki|manatoki|comic|booktoki).*') {
                parserRules[tokiIdx] = {
                    ...this.#builtInRules.find(b => b.id === 'toki_common'),
                    _version: this._version
                };
                // toki_common이 v2 전용 규칙보다 앞에 있다면 뒤로 재배치
                const [tokiRule] = parserRules.splice(tokiIdx, 1);
                parserRules.push(tokiRule);
                modified = true;
            }
            for (const r of parserRules) {
                if ((r.id === 'blacktoon_webtoon' || r.id === 'blacktoon_manhwa') && r.viewer && r.viewer.imageRegex) {
                    delete r.viewer.imageRegex;
                    modified = true;
                }
            }
            if (modified) {
                console.log("[RuleManager] 🔄 신형 도메인(newtoki1.org / sbxh9.com) 호환 파서 규칙 자동 마이그레이션 완료.");
                this.saveParserRules(parserRules);
            }
        }

        return parserRules;
    }

    /**
     * Get only custom/parser rules from GM storage
     */
    static getParserRules() {
        if (typeof GM_getValue === 'undefined') return [];
        const str = GM_getValue(CFG_PARSER_RULES, '[]');
        try {
            return JSON.parse(str) || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Save parser rules to GM storage
     */
    static saveParserRules(rules) {
        if (typeof GM_setValue === 'undefined') return;
        const version = this._version;
        rules.forEach(rule => { if (rule && typeof rule === 'object' && !rule._version) rule._version = version; });
        GM_setValue(CFG_PARSER_RULES, JSON.stringify(rules, null, 2));
    }

    /**
     * Add a new rule
     */
    static addRule(rule) {
        const rules = this.getParserRules();
        if (rules.find(r => r.id === rule.id)) return false;
        rules.push(rule);
        this.saveParserRules(rules);
        return true;
    }

    /**
     * Update an existing rule
     */
    static updateRule(id, updatedRule) {
        const rules = this.getParserRules();
        const idx = rules.findIndex(r => r.id === id);
        if (idx === -1) return false;
        rules[idx] = updatedRule;
        this.saveParserRules(rules);
        return true;
    }

    /**
     * Delete a rule
     */
    static deleteRule(id) {
        const rules = this.getParserRules();
        const filtered = rules.filter(r => r.id !== id);
        this.saveParserRules(filtered);
        return true;
    }

    /**
     * Bulk import rules
     */
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

    /**
     * Find a matching rule for the current URL
     * @param {string} url 
     * @returns {Promise<Object|null>}
     */
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
