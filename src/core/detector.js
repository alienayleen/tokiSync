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

    // URL 및 DOM 기반 실제 카테고리 추론 (웹툰/만화 = 이미지 CBZ, 소설 = 텍스트 EPUB/TXT 자동 판별 보장)
    const inferredCategory = AutoDomDiscoverer.inferCategory(doc, url);

    // 1. Dynamic Rule Matching
    const matchedRule = await RuleManager.matchRule(url);
    if (matchedRule) {
        if (!doc || AutoDomDiscoverer.isRuleCompatibleWithDom(matchedRule, doc)) {
            const effectiveCategory = /\/(novel|book|webtoon|toon|manhwa|manga|comic)(\/|\?|$)/i.test(url)
                ? inferredCategory
                : (matchedRule.category || inferredCategory || 'Webtoon');
            return { 
                site: 'generic', 
                protocolDomain, 
                matchedRule: { ...matchedRule, category: effectiveCategory },
                category: effectiveCategory
            };
        }
        console.warn(`[TokiSync Detector] ⚠️ 규칙(${matchedRule.id})이 URL과 매칭되었으나 실제 DOM 구조와 불일치합니다. 자율 DOM 구조 추론 엔진을 가동합니다.`);
    }

    // 2. Heuristic DOM Auto-Discovery Fallback
    if (doc) {
        const autoRule = AutoDomDiscoverer.discover(doc, url);
        if (autoRule) {
            console.log(`[TokiSync Detector] 🤖 자율 DOM 분석 성공: ${autoRule.name} (신뢰도: ${autoRule._confidence})`);
            return {
                site: 'generic',
                protocolDomain,
                matchedRule: autoRule,
                category: autoRule.category || inferredCategory || 'Webtoon'
            };
        }
    }

    return null;
}
