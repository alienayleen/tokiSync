/**
 * [전략 B] 소설 API 기반 복호화 모듈
 * Closed Shadow DOM 및 XOR 암호화를 우회하여 API를 통해 직접 평문을 추출합니다.
 */

// 이스케이프 유무 모두 대응: "token":"eyJ..." 또는 \"token\":\"eyJ...\"
const RE_TOKEN = /\\?"token\\?":\\?"(eyJ[A-Za-z0-9_-]+[A-Za-z0-9_=.-]*)\\?"/;

/**
 * Base64URL 디코딩
 */
function b64urlDecode(str) {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - str.length % 4);
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

/**
 * Base64URL 인코딩
 */
function b64urlEncode(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * HMAC-SHA256 서명 (Proof 생성용)
 */
async function hmacSign(secret, message) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return b64urlEncode(new Uint8Array(sig));
}

/**
 * XOR 복호화
 */
function xorDecrypt(payloadB64, keyB64) {
    const payload = b64urlDecode(payloadB64);
    const key = b64urlDecode(keyB64);
    const result = new Uint8Array(payload.length);
    for (let i = 0; i < payload.length; i++) {
        result[i] = payload[i] ^ key[i % key.length];
    }
    return new TextDecoder('utf-8').decode(result);
}

/**
 * document.cookie에서 특정 쿠키 값 가져오기
 */
function getCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * nv 쿠키 삭제 후 새로 발급 (세션 차단 복구용)
 */
async function resetNvCookie(cookieName) {
    console.log(`[Decryptor] ${cookieName} 쿠키 리셋 중...`);
    // 모든 경로에 대해 쿠키 삭제
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    // 새 쿠키 발급
    await fetch('/api/nv-issue', { method: 'POST', credentials: 'same-origin' });
    console.log(`[Decryptor] ${cookieName} 쿠키 재발급 완료`);
}

/**
 * URL에서 novelId와 episodeId 추출
 */
function getIdsFromUrl(url) {
    const match = url.match(/\/novel\/(\d+)\/(\d+)/);
    if (!match) return null;
    return { novelId: match[1], episodeId: match[2] };
}

/**
 * [Main] 에피소드 URL로부터 평문 텍스트를 직접 추출하여 반환
 * @param {string} episodeUrl 에피소드 주소
 * @param {Object} config 규칙의 decryptApi 설정
 * @param {boolean} _isRetry 내부 재시도 여부 (외부에서 사용 금지)
 * @returns {Promise<string|null>} 복호화된 평문 (실패 시 null)
 */
export async function fetchNovelText(episodeUrl, config = {}, _isRetry = false) {
    const endpoint = config.endpoint || '/api/novel-content';
    const cookieName = config.cookieName || 'nv';
    const clientHeader = config.clientHeader || 'shadow-v2';

    try {
        const ids = getIdsFromUrl(episodeUrl);
        if (!ids) return null;

        // 1. Fresh Token 추출 (토큰은 에피소드별 + 짧은 TTL이므로 항상 새로 가져옴)
        const html = await fetch(episodeUrl, { credentials: 'same-origin' }).then(r => r.text());
        const tokenMatch = html.match(RE_TOKEN);
        if (!tokenMatch) {
            console.warn('[Decryptor] 토큰 추출 실패 (API 호출 중단)');
            return null;
        }
        const token = tokenMatch[1];

        // 2. 쿠키 확인 (XOR 키)
        let cookie = getCookie(cookieName);
        if (!cookie) {
            console.log('[Decryptor] 쿠키 없음 - nv-issue 시도');
            await fetch('/api/nv-issue', { method: 'POST', credentials: 'same-origin' });
            cookie = getCookie(cookieName);
        }
        if (!cookie) return null;
        const xorKey = cookie.split('.')[0];

        // 3. Proof 생성 (HMAC)
        const nonce = b64urlEncode(crypto.getRandomValues(new Uint8Array(24)));
        const proof = await hmacSign(cookie, `${token}.${nonce}.${navigator.userAgent}`);

        // 4. API 호출
        const resp = await fetch(endpoint, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'content-type': 'application/json',
                'x-novel-client': clientHeader
            },
            body: JSON.stringify({
                novelId: ids.novelId,
                episodeId: ids.episodeId,
                token, nonce, proof
            })
        });

        // 5. API 실패 시 — 세션 차단 감지 → 쿠키 리셋 후 1회 재시도
        if (!resp.ok) {
            if (!_isRetry) {
                console.warn(`[Decryptor] API 실패 (${resp.status}) → 세션 차단 의심, 쿠키 리셋 후 재시도`);
                await resetNvCookie(cookieName);
                return fetchNovelText(episodeUrl, config, true); // 재시도는 딱 1회
            }
            console.error(`[Decryptor] 재시도 후에도 실패 (${resp.status})`);
            return null;
        }

        const data = await resp.json();
        if (!data.ok || !data.payload) return null;

        // 6. XOR 복호화
        return xorDecrypt(data.payload, xorKey);

    } catch (e) {
        console.error('[Decryptor] 복호화 과정 중 예외 발생:', e);
        return null;
    }
}
