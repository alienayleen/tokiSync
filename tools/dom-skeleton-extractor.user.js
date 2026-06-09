// ==UserScript==
// @name         [Recon] Generic DOM Skeleton Extractor
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  페이지의 DOM 구조를 AI 학습용(규칙 생성용) 간소화된 JSON 트리로 추출 (반복 요소 자동 압축)
// @author       pray4skylark
// @match        *://*/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    // ── 설정 ───────────────────────────────────────────────────────────────
    
    // 무시할 태그 목록 (구조 파악에 불필요한 요소)
    const IGNORE_TAGS = new Set([
        'script', 'style', 'noscript', 'svg', 'path', 'iframe', 'canvas', 
        'meta', 'link', 'head', 'map', 'area', 'br', 'hr', 'base'
    ]);

    // 남길 속성 목록
    const KEEP_ATTRS = new Set(['id', 'class', 'href', 'src', 'data-type', 'role']);

    // 텍스트 최대 길이
    const MAX_TEXT_LEN = 30;

    // ── 핵심 로직: DOM -> JSON 변환 ──────────────────────────────────────────

    /**
     * 노드의 구조적 시그니처를 반환합니다. (반복 요소 판단 기준)
     */
    function getNodeSignature(el) {
        if (el.nodeType !== Node.ELEMENT_NODE) return null;
        const tag = el.tagName.toLowerCase();
        const cls = el.className && typeof el.className === 'string' ? el.className.trim() : '';
        return `${tag}.${cls}`;
    }

    /**
     * DOM 트리를 순회하며 간소화된 JSON 객체로 변환합니다.
     */
    function buildSkeleton(node, depth = 0) {
        // 최대 깊이 제한 (너무 깊은 무의미한 중첩 방지)
        if (depth > 20) return { _note: "Max depth reached" };

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\s+/g, ' ').trim();
            if (!text) return null;
            return text.length > MAX_TEXT_LEN ? text.substring(0, MAX_TEXT_LEN) + '...' : text;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            if (IGNORE_TAGS.has(tag)) return null;

            const obj = { tag };

            // 속성 추출
            const attrs = {};
            for (const attr of node.attributes) {
                if (KEEP_ATTRS.has(attr.name)) {
                    // 긴 URL이나 base64 데이터 등은 축약
                    let val = attr.value.trim();
                    if (val.length > 50 && (attr.name === 'src' || attr.name === 'href')) {
                        val = val.substring(0, 50) + '...';
                    }
                    attrs[attr.name] = val;
                }
            }
            if (Object.keys(attrs).length > 0) obj.attrs = attrs;

            // 자식 노드 순회 및 반복 요소 압축
            const children = [];
            let lastSig = null;
            let repeatCount = 0;

            for (const child of node.childNodes) {
                if (child.nodeType === Node.ELEMENT_NODE) {
                    const sig = getNodeSignature(child);
                    // 시그니처가 같으면 압축 카운트 증가
                    if (sig && sig === lastSig) {
                        repeatCount++;
                        continue;
                    } else {
                        // 이전 반복 요소 압축 결과 추가
                        if (repeatCount > 0) {
                            children.push({ _note: `... 앞과 동일한 구조의 요소 ${repeatCount}개 생략됨 ...` });
                        }
                        repeatCount = 0;
                        lastSig = sig;
                    }
                }

                const childObj = buildSkeleton(child, depth + 1);
                if (childObj) {
                    // 의미 없는 빈 div 제거 로직 (텍스트도 없고 자식도 없는 경우)
                    if (typeof childObj === 'object' && !childObj.text && (!childObj.children || childObj.children.length === 0)) {
                        // attributes가 id나 class를 가지고 있다면 구조적 의미가 있을 수 있으니 남김
                        if (!childObj.attrs) continue; 
                    }
                    children.push(childObj);
                }
            }

            // 마지막으로 남은 반복 카운트 처리
            if (repeatCount > 0) {
                children.push({ _note: `... 앞과 동일한 구조의 요소 ${repeatCount}개 생략됨 ...` });
            }

            // 자식이 텍스트 노드 하나뿐이면 깔끔하게 병합
            if (children.length === 1 && typeof children[0] === 'string') {
                obj.text = children[0];
            } else if (children.length > 0) {
                obj.children = children;
            }

            return obj;
        }

        return null;
    }

    // ── 실행 및 출력 포맷팅 ──────────────────────────────────────────────────

    function generatePayload() {
        const rootNode = document.body || document.documentElement;
        
        // 1. JSON 트리 생성
        const skeleton = buildSkeleton(rootNode);

        // 2. AI에게 전달할 프롬프트 조합
        const L = [];
        L.push('═══════════════════════════════════════════════════');
        L.push('[DOM Skeleton Extractor] AI 규칙 생성 프롬프트');
        L.push(`대상 URL: ${location.href}`);
        L.push('═══════════════════════════════════════════════════\n');
        L.push('아래는 현재 웹페이지의 DOM 구조에서 불필요한 태그와 스타일을 제거하고,');
        L.push('반복되는 리스트 요소를 압축한 간소화된 JSON 트리입니다.\n');
        
        L.push('=== [DOM Skeleton JSON] ===');
        L.push(JSON.stringify(skeleton, null, 2));
        L.push('\n===========================');
        
        L.push('\n이 JSON 구조를 분석하여, "tokiSync" 시스템의 파서 규칙(rules.json)을 작성해줘.');
        L.push('아래 항목들의 CSS 셀렉터를 유추해서 찾아내는 것이 목표야:');
        L.push('- meta 정보: 작품 제목, 작가, 썸네일(src), 장르 태그, 연재 상태 등');
        L.push('- list 정보: 에피소드 리스트 컨테이너, 아이템, 번호, 제목, 날짜, 링크(href)');
        L.push('- viewer 정보: 뷰어 영역, 이미지 컨테이너, 콘텐츠 텍스트 등 (페이지 내에 존재할 경우)');
        L.push('\n결과는 tokiSync rules.json 스키마 형식의 완전한 JSON 객체로 출력해줘.');

        return L.join('\n');
    }

    // ── UI 및 클립보드 ───────────────────────────────────────────────────────

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

    GM_registerMenuCommand('🤖 압축된 DOM Skeleton 복사 (AI 학습용)', () => {
        try {
            const payload = generatePayload();
            GM_setClipboard(payload, 'text');
            toast(`✅ 복사 완료! (약 ${Math.round(payload.length / 1024)}KB)`);
            console.log("DOM Skeleton Payload:", payload);
        } catch (error) {
            console.error("추출 중 오류 발생:", error);
            toast("❌ 추출 실패: 콘솔을 확인하세요.");
        }
    });

})();
