// ==UserScript==
// @name         [PoC] Novel Decryptor Test
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  전략 B 벌크 복호화 파이프라인 검증용
// @author       pray4skylark
// @match        https://*.com/novel/*
// @run-at       document-idle
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    // ═══════════════════════════════════════════════
    // 설정 및 정규식
    // ═══════════════════════════════════════════════
    // 전략 B: fetch로 항상 fresh token 추출 — MutationObserver 불필요
    const RE_TOKEN = /\\?"token\\?":\\?"(eyJ[A-Za-z0-9_-]+[A-Za-z0-9_=.-]*)\\?"/;
    const EPISODE_LINK_SELECTOR = 'li[data-ep] > a'; // 변경된 DOM: <li data-ep="N"><a href="/novel/...">

    // ═══════════════════════════════════════════════
    // 유틸리티
    // ═══════════════════════════════════════════════
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    function b64urlDecode(str) {
        const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - str.length % 4);
        const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    function b64urlEncode(bytes) {
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    async function hmacSign(secret, message) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', enc.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
        return b64urlEncode(new Uint8Array(sig));
    }

    function xorDecrypt(payloadB64, token) {
        const payload = b64urlDecode(payloadB64);
        const xorKey = token.split('.')[0];
        const key = new TextEncoder().encode(xorKey);
        const result = new Uint8Array(payload.length);
        for (let i = 0; i < payload.length; i++) {
            result[i] = payload[i] ^ key[i % key.length];
        }
        return new TextDecoder('utf-8').decode(result);
    }

    function getNvCookie() {
        const match = document.cookie.match(/(?:^|;\s*)nv=([^;]*)/);
        return match ? decodeURIComponent(match[1]) : null;
    }

    function getValidNonce(token) {
        try {
            const base64UrlPayload = token.split('.')[0];
            const base64Payload = base64UrlPayload.replace(/-/g, '+').replace(/_/g, '/');
            const binStr = atob(base64Payload);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) {
                bytes[i] = binStr.charCodeAt(i);
            }
            const decodedString = new TextDecoder('utf-8').decode(bytes);
            const tokenData = JSON.parse(decodedString);

            if (tokenData && tokenData.nonce) {
                console.log("[Decryptor] 신형 토큰 감지 - 내장된 Nonce 추출 완료:", tokenData.nonce);
                return tokenData.nonce;
            }
        } catch (e) {
            console.warn("[Decryptor] 토큰 디코딩 중 오류 발생, 기존 폴백 적용:", e);
        }
        console.log("[Decryptor] 구형 토큰 감지 - 랜덤 Nonce를 생성합니다.");
        return b64urlEncode(crypto.getRandomValues(new Uint8Array(24)));
    }

    function getIdsFromUrl(url) {
        const path = new URL(url, location.origin).pathname;
        const match = path.match(/\/novel\/(\d+)\/(\d+)/);
        if (!match) return null;
        return { novelId: match[1], episodeId: match[2] };
    }

    // ═══════════════════════════════════════════════
    // 메인: 단일 에피소드 복호화
    // ═══════════════════════════════════════════════
    async function runDecryptTest(targetUrl = location.href) {
        const log = [];
        const L = (msg) => { console.log(msg); log.push(msg); };

        try {
            L(`\n[Decrypting] ${targetUrl}`);
            const ids = getIdsFromUrl(targetUrl);
            if (!ids) { L('❌ 올바른 에피소드 URL이 아닙니다.'); return { ok: false, log: log.join('\n') }; }

            // 1. Fresh Token 추출 (가장 중요)
            L('🔎 fetching HTML to extract token...');
            const html = await fetch(targetUrl, { credentials: 'same-origin' }).then(r => r.text());
            const m = html.match(RE_TOKEN);
            const token = m ? m[1] : null; // 항상 fetch 기반 — 캐시 폴백 없음
            
            if (!token) { L('❌ token 미발견. 중단.'); return { ok: false, log: log.join('\n') }; }
            L(`✅ token: ${token.substring(0, 20)}...`);

            // 2. 쿠키
            let cookie = getNvCookie();
            if (!cookie) {
                L('⚠️ nv 쿠키 없음 → 발급 시도');
                await fetch('/api/nv-issue', { method: 'POST', credentials: 'same-origin' });
                cookie = getNvCookie();
                if (!cookie) { L('❌ 쿠키 발급 실패.'); return { ok: false, log: log.join('\n') }; }
            }

            // 3. HMAC
            const nonce = getValidNonce(token);
            const proof = await hmacSign(cookie, `${token}.${nonce}.${navigator.userAgent}`);

            // 4. API
            const resp = await fetch('/api/novel-content', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'content-type': 'application/json', 'x-novel-client': 'shadow-v2' },
                body: JSON.stringify({
                    novelId: ids.novelId,
                    episodeId: ids.episodeId,
                    token, nonce, proof
                })
            });

            if (!resp.ok) { 
                const err = await resp.json().catch(() => ({}));
                L(`❌ API 에러: ${resp.status} ${JSON.stringify(err)}`); 
                return { ok: false, log: log.join('\n') }; 
            }

            const json = await resp.json();
            if (!json.ok || !json.payload) { L('❌ API 성공했으나 payload 없음'); return { ok: false, log: log.join('\n') }; }

            // 5. XOR 복호화 및 URI 디코딩 정제
            let text = xorDecrypt(json.payload, token);
            if (text.startsWith('%')) {
                text = decodeURIComponent(text);
            }
            const preview = text.substring(0, 50).replace(/\n/g, ' ') + '...';
            L(`✅ 성공! (${text.length}자) - "${preview}"`);

            return { ok: true, log: log.join('\n'), text };

        } catch (e) {
            L(`❌ 예외: ${e.message}`);
            return { ok: false, log: log.join('\n') };
        }
    }

    // ═══════════════════════════════════════════════
    // 벌크 테스트: 목록 페이지에서 3개 순회
    // ═══════════════════════════════════════════════
    async function runBulkTest() {
        const links = Array.from(document.querySelectorAll(EPISODE_LINK_SELECTOR))
            .map(a => a.href)
            .filter(href => href.includes('/novel/'))
            .slice(0, 3); // 상위 3개만 테스트

        if (links.length === 0) {
            alert('❌ 목록 페이지가 아니거나 에피소드 링크를 찾을 수 없습니다.');
            return;
        }

        console.log(`🚀 벌크 테스트 시작 (대상: ${links.length}개)`);
        const results = [];
        
        for (let i = 0; i < links.length; i++) {
            console.log(`\n--- [${i + 1}/${links.length}] 진행 중 ---`);
            const res = await runDecryptTest(links[i]);
            results.push({ url: links[i], ok: res.ok });
            
            if (i < links.length - 1) {
                console.log('💤 2초 대기...');
                await sleep(2000);
            }
        }

        const summary = results.map((r, i) => `[${i+1}] ${r.ok ? '✅' : '❌'} ${r.url.split('/').pop()}`).join('\n');
        console.log('\n══ 벌크 테스트 결과 요약 ══\n' + summary);
        alert('══ 벌크 테스트 완료 ══\n\n' + summary + '\n\n(상세 로그는 콘솔 확인)');
    }

    // ═══════════════════════════════════════════════
    // 메뉴
    // ═══════════════════════════════════════════════
    GM_registerMenuCommand('🚀 현재 에피소드 1개 복호화', async () => {
        const res = await runDecryptTest();
        if (res.ok) {
            GM_setClipboard(res.text);
            alert(`✅ 성공! (${res.text.length}자) 결과가 클립보드에 복사되었습니다.`);
        } else {
            alert('❌ 실패! 콘솔 로그를 확인하세요.');
        }
    });

    GM_registerMenuCommand('📦 벌크 테스트 (목록 상위 3개)', runBulkTest);

})();
