/**
 * Tampermonkey GM_* API 흉내 (E2E 전용)
 * - GM 저장소는 시험 서버(/__gm/*)에 두어 실제 Tampermonkey처럼 도메인과 무관하게 모든 창이 공유
 *   (GM_getValue는 동기 API이므로 동기 XHR 사용)
 * - GM_addValueChangeListener: 같은 창의 변경은 즉시(remote=false), 다른 창의 변경은 250ms 폴링(remote=true)
 */
(function () {
    if (window.__gmShimInstalled) return;
    window.__gmShimInstalled = true;
    const listeners = new Map();
    const writerId = Math.random().toString(36).slice(2);
    let seq = 0;
    let lastChangeSeq = 0;

    const syncReq = (method, path, body) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, path, false);
        if (body !== undefined) xhr.setRequestHeader('content-type', 'application/json');
        xhr.send(body === undefined ? null : JSON.stringify(body));
        return JSON.parse(xhr.responseText || '{}');
    };
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    const notify = (k, oldV, newV, remote) => {
        for (const [, l] of listeners) {
            if (l.key === k) {
                try { l.cb(k, oldV, newV, remote); } catch (e) { console.error('[gm-shim] listener error', e); }
            }
        }
    };

    try { lastChangeSeq = syncReq('GET', '/__gm/changes?since=999999999').seq || 0; } catch (e) {}

    window.GM_getValue = (k, d) => {
        const r = syncReq('GET', `/__gm/get?k=${encodeURIComponent(k)}`);
        return r.has ? r.v : d;
    };
    window.GM_setValue = (k, v) => {
        const oldV = window.GM_getValue(k, undefined);
        const val = clone(v);
        syncReq('POST', '/__gm/set', { k, v: val, writer: writerId });
        setTimeout(() => notify(k, oldV, val, false), 0);
    };
    window.GM_deleteValue = (k) => { syncReq('POST', '/__gm/del', { k, writer: writerId }); };
    window.GM_addValueChangeListener = (k, cb) => { const id = ++seq; listeners.set(id, { key: k, cb }); return id; };
    window.GM_removeValueChangeListener = (id) => { listeners.delete(id); };

    setInterval(() => {
        if (listeners.size === 0) return;
        fetch(`/__gm/changes?since=${lastChangeSeq}`).then(r => r.json()).then(({ seq: s, changes }) => {
            lastChangeSeq = s;
            for (const c of changes) {
                if (c.writer !== writerId) notify(c.k, c.old, c.nv, true);
            }
        }).catch(() => {});
    }, 250);

    window.__gmMenu = {};
    window.GM_registerMenuCommand = (name, fn) => { window.__gmMenu[name] = fn; };
    window.GM_download = (opts) => { if (opts && opts.onload) setTimeout(opts.onload, 0); };
    window.GM_xmlhttpRequest = (d) => {
        const xhr = new XMLHttpRequest();
        xhr.open(d.method || 'GET', d.url);
        if (d.responseType) xhr.responseType = d.responseType;
        if (d.timeout) xhr.timeout = d.timeout;
        xhr.onload = () => d.onload && d.onload({
            status: xhr.status,
            response: xhr.response,
            responseText: xhr.responseType && xhr.responseType !== 'text' ? '' : xhr.responseText,
            responseHeaders: xhr.getAllResponseHeaders()
        });
        xhr.onerror = (e) => d.onerror && d.onerror(e);
        xhr.ontimeout = (e) => d.ontimeout && d.ontimeout(e);
        try { xhr.send(d.data || null); } catch (e) { d.onerror && d.onerror(e); }
        return { abort: () => xhr.abort() };
    };
    window.unsafeWindow = window;
    // 헤드리스 Chromium은 한글 다운로드 파일명을 "download"로 보고하므로, 스크립트가 지정한 파일명을 직접 기록
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        if (this.download) {
            const list = window.GM_getValue('__E2E_SAVED_FILES', []);
            list.push(this.download);
            window.GM_setValue('__E2E_SAVED_FILES', list);
        }
        return origClick.apply(this, arguments);
    };
})();
