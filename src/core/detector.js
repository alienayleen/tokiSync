import { RuleManager } from './parsers/RuleManager.js';
import { AutoDomDiscoverer } from './parsers/AutoDomDiscoverer.js';

/**
 * detectSite
 * Detects the current site and returns site info.
 * Supports dynamic JSON rules AND automatic DOM structure heuristic inference.
 * @returns {Promise<Object|null>}
 */
export async function detectSite(doc = (typeof document !== 'undefined' ? document : null)) {
    const url = (doc && doc.URL) || (typeof window !== 'undefined' ? window.location.href : '');
    let protocolDomain = '';
    try {
        const parsed = new URL(url);
        protocolDomain = parsed.origin;
    } catch (e) {
        if (typeof window !== 'undefined' && window.location) {
            protocolDomain = `${window.location.protocol}//${window.location.hostname}`;
        }
    }

    // 1. Dynamic Rule Matching
    const matchedRule = await RuleManager.matchRule(url);
    if (matchedRule) {
        // 매칭된 규칙이 현재 페이지의 실제 DOM 구조와 호환되는지 검증
        if (!doc || AutoDomDiscoverer.isRuleCompatibleWithDom(matchedRule, doc)) {
            return { 
                site: 'generic', 
                protocolDomain, 
                matchedRule,
                category: matchedRule.category || 'Webtoon'
            };
        }
        console.warn(`[TokiSync Detector] ⚠️ 규칙(${matchedRule.id})이 URL과 매칭되었으나 실제 DOM 구조와 불일치합니다. 자율 DOM 구조 추론 엔진을 가동합니다.`);
    }

    // 2. Heuristic DOM Auto-Discovery Fallback (정규식/수동 규칙 없이도 사이트 구조 자동 해석)
    if (doc) {
        const autoRule = AutoDomDiscoverer.discover(doc, url);
        if (autoRule) {
            console.log(`[TokiSync Detector] 🤖 자율 DOM 분석 성공: ${autoRule.name} (신뢰도: ${autoRule._confidence})`);
            return {
                site: 'generic',
                protocolDomain,
                matchedRule: autoRule,
                category: autoRule.category || 'Webtoon'
            };
        }
    }

    return null;
}
