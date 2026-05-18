import { CFG_CUSTOM_RULES, CFG_REMOTE_RULE_URL } from '../config.js';

/**
 * RuleManager
 * Manages parsing rules from built-in templates and user custom definitions.
 */
export class RuleManager {
    // Built-in rules as fallback/templates
    static #builtInRules = [];

    /**
     * Get all merged rules: Custom > Built-in
     * @returns {Promise<Array>}
     */
    static async getRules() {
        let rules = [...this.#builtInRules];

        // 1. Fetch Remote Rules (Background cache update & retrieval)
        let remoteRules = [];
        const cacheStr = typeof GM_getValue !== 'undefined' ? GM_getValue("TOKI_REMOTE_RULES_CACHE", "") : "";
        let hasCache = false;

        if (cacheStr) {
            try {
                remoteRules = JSON.parse(cacheStr);
                hasCache = true;
            } catch (e) {}
        }

        const configUrl = typeof GM_getValue !== 'undefined' ? GM_getValue(CFG_REMOTE_RULE_URL, "") : "";
        const targetUrl = configUrl.trim() || "https://pray4skylark.github.io/tokiSync/rules.json";

        const updatePromise = this.fetchRemoteRules(targetUrl).then(fetched => {
            if (fetched) return fetched;
            return null;
        });

        if (!hasCache) {
            const fetched = await updatePromise;
            if (fetched) remoteRules = fetched;
        } else {
            // Background update
            updatePromise.catch(() => {});
        }

        if (remoteRules.length > 0) {
            rules = [...remoteRules, ...rules];
        }

        // 2. Load Custom Rules from GM storage
        if (typeof GM_getValue !== 'undefined') {
            const customStr = GM_getValue(CFG_CUSTOM_RULES, '[]');
            try {
                const customRules = JSON.parse(customStr);
                if (Array.isArray(customRules) && customRules.length > 0) {
                    // Custom rules at the beginning to take precedence during matching
                    rules = [...customRules, ...rules];
                }
            } catch (e) {
                console.error('[RuleManager] Failed to parse custom rules:', e);
            }
        }

        return rules;
    }

    /**
     * Get only custom rules
     */
    static getCustomRules() {
        if (typeof GM_getValue === 'undefined') return [];
        const str = GM_getValue(CFG_CUSTOM_RULES, '[]');
        try {
            return JSON.parse(str) || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Save custom rules
     */
    static saveCustomRules(rules) {
        if (typeof GM_setValue === 'undefined') return;
        GM_setValue(CFG_CUSTOM_RULES, JSON.stringify(rules, null, 2));
    }

    /**
     * Add a new rule
     */
    static addRule(rule) {
        const rules = this.getCustomRules();
        if (rules.find(r => r.id === rule.id)) return false;
        rules.push(rule);
        this.saveCustomRules(rules);
        return true;
    }

    /**
     * Update an existing rule
     */
    static updateRule(id, updatedRule) {
        const rules = this.getCustomRules();
        const idx = rules.findIndex(r => r.id === id);
        if (idx === -1) return false;
        rules[idx] = updatedRule;
        this.saveCustomRules(rules);
        return true;
    }

    /**
     * Delete a rule
     */
    static deleteRule(id) {
        const rules = this.getCustomRules();
        const filtered = rules.filter(r => r.id !== id);
        this.saveCustomRules(filtered);
        return true;
    }

    /**
     * Bulk import rules
     */
    static bulkImport(newRules, mode = 'merge') {
        const current = this.getCustomRules();
        let imported = 0, updated = 0, skipped = 0;

        newRules.forEach(rule => {
            if (!rule.id) { skipped++; return; }
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

        this.saveCustomRules(current);
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

    /**
     * Fetch rules from remote URL
     */
    static async fetchRemoteRules(url) {
        return new Promise((resolve) => {
            if (typeof GM_xmlhttpRequest === 'undefined') {
                resolve(null);
                return;
            }
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        let rules = data.rules || data;
                        if (Array.isArray(rules)) {
                            if (typeof GM_setValue !== 'undefined') {
                                GM_setValue("TOKI_REMOTE_RULES_CACHE", JSON.stringify(rules));
                            }
                            resolve(rules);
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        console.error('[RuleManager] Parse remote rules failed:', e);
                        resolve(null);
                    }
                },
                onerror: () => resolve(null),
                ontimeout: () => resolve(null)
            });
        });
    }
}
