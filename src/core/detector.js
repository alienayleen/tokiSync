import { RuleManager } from './parsers/RuleManager.js';

/**
 * detectSite
 * Detects the current site and returns site info.
 * Now supports both dynamic rules and legacy hardcoded patterns.
 * @returns {Promise<Object|null>}
 */
export async function detectSite() {
    const url = window.location.href;
    const domain = window.location.hostname;
    const protocolDomain = `${window.location.protocol}//${domain}`;

    // Dynamic Rule Matching
    const matchedRule = await RuleManager.matchRule(url);
    if (matchedRule) {
        return { 
            site: 'generic', 
            protocolDomain, 
            matchedRule,
            category: matchedRule.category || 'Webtoon'
        };
    }

    return null;
}
