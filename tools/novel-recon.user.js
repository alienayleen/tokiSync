// ==UserScript==
// @name         [Recon] Novel Shadow DOM Analyzer
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  전략 B 수립을 위한 소설 페이지 정보 수집 도구 (Tampermonkey 메뉴 전용)
// @author       pray4skylark
// @match        https://*.com/novel/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    const results = {};
    const logBuffer = [];
    let collected = false;

    function log(msg, data) {
        const entry = data !== undefined ? `${msg} ${JSON.stringify(data, null, 2)}` : msg;
        logBuffer.push(`[${new Date().toISOString().slice(11,23)}] ${entry}`);
    }

    // ═══════════════════════════════════════════════
    // Phase 0: attachShadow 후킹 (document-start 즉시)
    // ═══════════════════════════════════════════════
    const _origAttach = Element.prototype.attachShadow;
    const _capturedRoots = [];

    Element.prototype.attachShadow = function (init) {
        const root = _origAttach.call(this, init);
        if (init && init.mode === 'closed') {
            _capturedRoots.push({ host: this, root, mode: 'closed' });
            log(`🎯 Closed ShadowRoot 캡처: ${this.tagName}.${this.className}`);
        } else {
            _capturedRoots.push({ host: this, root, mode: init?.mode || 'open' });
        }
        return root;
    };
    Element.prototype.attachShadow.toString = () => 'function attachShadow() { [native code] }';

    // ═══════════════════════════════════════════════
    // Phase 0: fetch 인터셉트
    // ═══════════════════════════════════════════════
    const _origFetch = window.fetch;
    const apiCalls = [];

    window.fetch = function (...args) {
        const [url, options] = args;
        const urlStr = typeof url === 'string' ? url : url?.url || '';

        if (urlStr.includes('/api/novel-content') ||
            urlStr.includes('/api/nv-issue') ||
            urlStr.includes('/api/bookmark')) {

            const entry = { url: urlStr, method: options?.method || 'GET', headers: {}, timestamp: new Date().toISOString() };

            if (options?.headers) {
                if (options.headers instanceof Headers) {
                    options.headers.forEach((v, k) => { entry.headers[k] = v; });
                } else {
                    entry.headers = { ...options.headers };
                }
            }
            if (options?.body) {
                try { entry.body = JSON.parse(options.body); }
                catch { entry.body = String(options.body).substring(0, 200); }
            }

            apiCalls.push(entry);
            log(`📡 API: ${entry.method} ${urlStr}`, entry.body);

            return _origFetch.apply(this, args).then(async (response) => {
                const cloned = response.clone();
                try {
                    const json = await cloned.json();
                    entry.response = {
                        status: response.status, ok: response.ok,
                        payload_preview: json.payload ? json.payload.substring(0, 100) + '...' : undefined,
                        has_payload: !!json.payload, payload_length: json.payload ? json.payload.length : 0,
                        ok_flag: json.ok, empty: json.empty, keys: Object.keys(json)
                    };
                } catch { entry.response = { status: response.status, parseError: true }; }
                log(`📡 응답: ${urlStr}`, entry.response);
                return response;
            });
        }
        return _origFetch.apply(this, args);
    };

    // ═══════════════════════════════════════════════
    // Phase 1: DOM 로드 후 수집
    // ═══════════════════════════════════════════════
    window.addEventListener('load', () => {
        setTimeout(() => {
            collectAll();
            collected = true;
        }, 3000);
    });

    function collectAll() {
        collectPageInfo();
        collectShadowContent();
        log('✅ 수집 완료');
    }

    function collectPageInfo() {
        // 쿠키
        const cookies = document.cookie.split(';').map(c => {
            const [name, ...rest] = c.trim().split('=');
            const value = decodeURIComponent(rest.join('='));
            return { name: name.trim(), value, length: value.length };
        });
        results.cookies = cookies;
        results.dotCookies = cookies.filter(c => c.value.includes('.'));
        log(`🍪 쿠키: ${cookies.length}개, dot: ${results.dotCookies.length}개`);
        results.dotCookies.forEach(c => {
            const parts = c.value.split('.');
            log(`  🔑 ${c.name}: seg=${parts.length}, [0]len=${parts[0].length}, total=${c.value.length}`);
        });

        // __NEXT_DATA__
        const nextDataScript = document.getElementById('__NEXT_DATA__');
        if (nextDataScript) {
            try {
                const nd = JSON.parse(nextDataScript.textContent);
                results.nextData = { exists: true, buildId: nd.buildId, page: nd.page, propsKeys: Object.keys(nd.props?.pageProps || {}), pageProps: nd.props?.pageProps || {} };

                const interesting = {};
                const keys = ['novelId', 'episodeId', 'token', 'cookieName', 'episodeNo', 'episodeNumber', 'empty'];
                function search(obj, prefix) {
                    if (!obj || typeof obj !== 'object') return;
                    for (const [k, v] of Object.entries(obj)) {
                        const full = prefix ? `${prefix}.${k}` : k;
                        if (keys.includes(k)) interesting[full] = v;
                        if (typeof v === 'object' && v !== null && !Array.isArray(v) && full.split('.').length < 4) search(v, full);
                    }
                }
                search(nd.props?.pageProps || {}, '');
                results.interestingProps = interesting;
                if (Object.keys(interesting).length > 0) log('🎯 Props 발견!', interesting);
            } catch (e) { results.nextData = { exists: true, parseError: e.message }; }
        } else {
            results.nextData = { exists: false };
        }

        // RSC Payload
        if (window.self.__next_f) {
            const chunks = window.self.__next_f;
            results.rscPayload = { exists: true, chunkCount: chunks.length, hits: [] };
            const kws = ['cookieName', 'novelId', 'episodeId', 'token', 'novel-content', 'nv-issue'];
            for (let i = 0; i < chunks.length; i++) {
                const s = typeof chunks[i] === 'string' ? chunks[i] : Array.isArray(chunks[i]) ? chunks[i].join('') : JSON.stringify(chunks[i]);
                for (const kw of kws) {
                    if (s.includes(kw)) {
                        const pos = s.indexOf(kw);
                        results.rscPayload.hits.push({ chunk: i, keyword: kw, context: s.substring(Math.max(0, pos - 50), pos + kw.length + 80) });
                    }
                }
            }
        } else { results.rscPayload = { exists: false }; }

        // URL
        const m = location.pathname.match(/\/novel\/(\d+)/);
        results.urlInfo = { novelId: m ? m[1] : null, fullPath: location.pathname, search: location.search };

        // 인라인 스크립트
        results.scriptHits = [];
        document.querySelectorAll('script:not([src])').forEach((sc, idx) => {
            const t = sc.textContent || '';
            for (const kw of ['cookieName', 'token', 'episodeId', 'shadow', 'novel_content']) {
                if (t.includes(kw)) {
                    const p = t.indexOf(kw);
                    results.scriptHits.push({ idx, keyword: kw, context: t.substring(Math.max(0, p - 40), p + kw.length + 60) });
                }
            }
        });
    }

    function collectShadowContent() {
        log(`👻 Shadow DOM: ${_capturedRoots.length}개`);
        _capturedRoots.forEach((e, i) => {
            if (!e.root) return;
            const ps = e.root.querySelectorAll('p');
            if (ps.length > 0) {
                const total = Array.from(ps).reduce((s, p) => s + p.textContent.length, 0);
                results.shadowText = {
                    paragraphCount: ps.length, totalLength: total,
                    preview: Array.from(ps).slice(0, 3).map(p => p.textContent.substring(0, 80)).join(' | ')
                };
                log(`📖 텍스트: ${ps.length}문단, ${total}자`);
            }
        });
    }

    // ═══════════════════════════════════════════════
    // 리포트 생성
    // ═══════════════════════════════════════════════
    function buildReport() {
        if (!collected) collectAll();
        const L = [];
        L.push('══════════════════════════════════════');
        L.push('📋 Novel Recon Report');
        L.push(`📅 ${new Date().toLocaleString('ko-KR')}`);
        L.push(`🔗 ${location.href}`);
        L.push('══════════════════════════════════════\n');

        L.push('── URL ──');
        L.push(`  novelId: ${results.urlInfo?.novelId || 'N/A'}`);
        L.push(`  path: ${results.urlInfo?.fullPath}\n`);

        L.push('── 쿠키 (XOR 키 후보) ──');
        results.dotCookies?.forEach(c => {
            const p = c.value.split('.');
            L.push(`  🔑 name="${c.name}" seg=${p.length} key[0]_len=${p[0].length}`);
            L.push(`     key[0]: ${p[0].substring(0, 30)}...`);
            L.push(`     full: ${c.value.substring(0, 80)}...`);
        });
        L.push('');

        L.push('── __NEXT_DATA__ ──');
        if (results.nextData?.exists && !results.nextData?.parseError) {
            L.push(`  page: ${results.nextData.page}`);
            L.push(`  propsKeys: [${results.nextData.propsKeys?.join(', ')}]`);
        } else { L.push(`  ${results.nextData?.parseError || '없음'}`); }
        L.push('');

        L.push('── 흥미로운 Props ──');
        if (results.interestingProps && Object.keys(results.interestingProps).length > 0) {
            for (const [k, v] of Object.entries(results.interestingProps)) {
                const val = typeof v === 'string' && v.length > 80 ? v.substring(0, 80) + '...' : v;
                L.push(`  ${k}: ${JSON.stringify(val)}`);
            }
        } else { L.push('  없음'); }
        L.push('');

        L.push('── RSC Payload ──');
        if (results.rscPayload?.exists) {
            L.push(`  청크: ${results.rscPayload.chunkCount}개, 히트: ${results.rscPayload.hits?.length || 0}건`);
            results.rscPayload.hits?.forEach(h => L.push(`  [${h.chunk}] "${h.keyword}": ${h.context}`));
        } else { L.push('  없음'); }
        L.push('');

        L.push('── Shadow DOM ──');
        L.push(`  캡처: ${_capturedRoots.length}개`);
        if (results.shadowText) {
            L.push(`  문단: ${results.shadowText.paragraphCount}, 길이: ${results.shadowText.totalLength}자`);
            L.push(`  프리뷰: ${results.shadowText.preview}`);
        }
        L.push('');

        L.push('── API 호출 ──');
        apiCalls.forEach((c, i) => {
            L.push(`  [${i}] ${c.method} ${c.url}`);
            if (c.body) L.push(`      body: ${JSON.stringify(c.body)}`);
            if (c.response) L.push(`      resp: ${JSON.stringify(c.response)}`);
        });
        L.push('');

        L.push('── 인라인 스크립트 히트 ──');
        results.scriptHits?.forEach(h => L.push(`  [${h.idx}] "${h.keyword}": ${h.context}`));
        L.push('\n── 원시 로그 ──');
        logBuffer.forEach(l => L.push(`  ${l}`));

        return L.join('\n');
    }

    function clip(text, toast) {
        GM_setClipboard(text, 'text');
        // alert 대신 간단 알림 (DevTools 감지 회피)
        const d = document.createElement('div');
        d.textContent = toast;
        d.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:999999;background:#333;color:#fff;padding:8px 16px;border-radius:6px;font:13px -apple-system,sans-serif;opacity:0.95;';
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 1500);
    }

    // ═══════════════════════════════════════════════
    // Tampermonkey 메뉴 등록
    // ═══════════════════════════════════════════════
    GM_registerMenuCommand('📋 전체 리포트 복사', () => {
        clip(buildReport(), '📋 전체 리포트 복사 완료');
    });

    GM_registerMenuCommand('📡 API 호출 복사', () => {
        if (!collected) collectAll();
        clip(JSON.stringify(apiCalls, null, 2), `📡 API ${apiCalls.length}건 복사`);
    });

    GM_registerMenuCommand('🍪 쿠키 정보 복사', () => {
        if (!collected) collectAll();
        clip(JSON.stringify(results.dotCookies, null, 2), `🍪 쿠키 ${results.dotCookies?.length || 0}개 복사`);
    });

    GM_registerMenuCommand('📖 Shadow 텍스트 전체 복사', () => {
        if (!collected) collectAll();
        let text = '';
        _capturedRoots.forEach(e => {
            if (e.root) text += Array.from(e.root.querySelectorAll('p')).map(p => p.textContent).join('\n\n');
        });
        clip(text || '(Shadow DOM 텍스트 없음)', `📖 ${text.length}자 복사`);
    });

    GM_registerMenuCommand('🎯 Props/RSC 복사', () => {
        if (!collected) collectAll();
        clip(JSON.stringify({
            urlInfo: results.urlInfo,
            interestingProps: results.interestingProps,
            nextData: results.nextData ? { exists: results.nextData.exists, page: results.nextData.page, propsKeys: results.nextData.propsKeys } : null,
            rscHits: results.rscPayload?.hits,
            scriptHits: results.scriptHits
        }, null, 2), '🎯 Props 복사 완료');
    });

})();
