import { CFG_CUSTOM_RULES } from '../config.js';

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

        // 1. Load Custom Rules from GM storage
        if (typeof GM_getValue !== 'undefined') {
            const customStr = GM_getValue(CFG_CUSTOM_RULES, '[]');
            try {
                const customRules = JSON.parse(customStr);
                if (Array.isArray(customRules)) {
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
}
