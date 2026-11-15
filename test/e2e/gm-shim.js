/**
 * Tampermonkey GM_* API 흉내 (E2E 전용)
 * - 같은 origin의 모든 창(부모 탭, 대시보드, 수집 팝업)이 localStorage를 공유하므로 GM 스토리지로 사용
 * - GM_addValueChangeListener: 같은 창은 직접 호출(remote=false), 다른 창은 storage 이벤트(remote=true)
 */
(function () {
    if (window.__gmShimInstalled) return;
    window.__gmShimInstalled = true;
    const PREFIX = '__gm__';
    const listeners = new Map();
    let seq = 0;

    const read = (k, d) => {
        const v = localStorage.getItem(PREFIX + k);
        if (v === null) return d;
        try { return JSON.parse(v); } catch (e) { return d; }
    };
    const notify = (k, oldV, newV, remote) => {
        for (const [, l] of listeners) {
            if (l.key === k) {
                try { l.cb(k, oldV, newV, remote); } catch (e) { console.error('[gm-shim] listener error', e); }
            }
        }
    };

    window.GM_getValue = (k, d) => read(k, d);
    window.GM_setValue = (k, v) => {
        const oldV = read(k, undefined);
        localStorage.setItem(PREFIX + k, JSON.stringify(v));
        setTimeout(() => notify(k, oldV, v, false), 0);
    };
    window.GM_deleteValue = (k) => { localStorage.removeItem(PREFIX + k); };
    window.GM_listValues = () => Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length));
    window.GM_addValueChangeListener = (k, cb) => { const id = ++seq; listeners.set(id, { key: k, cb }); return id; };
    window.GM_removeValueChangeListener = (id) => { listeners.delete(id); };
    window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith(PREFIX)) return;
        const k = e.key.slice(PREFIX.length);
        let o, n;
        try { o = e.oldValue === null ? undefined : JSON.parse(e.oldValue); } catch (x) {}
        try { n = e.newValue === null ? undefined : JSON.parse(e.newValue); } catch (x) {}
        notify(k, o, n, true);
    });
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
