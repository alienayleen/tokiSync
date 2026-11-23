/**
 * TokiSync E2E용 가짜 웹툰/소설 사이트
 * - /webtoon/100            : 작품 목록 (blacktoon_webtoon 규칙 구조)
 * - /webtoon/100/ep{N}      : 회차 뷰어 (이미지 3장, #goNextBtn 다음화 링크)
 * - /img/{N}-{k}.png        : 1x1 PNG
 * 옵션: block429Ep (해당 회차의 이미지 요청에 429 응답), captchaEp (해당 회차를 캡차 화면으로)
 */
const http = require('http');

const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

async function createMockSite(options = {}) {
    const total = options.total || 3;
    const seriesTitle = options.seriesTitle || '테스트웹툰';
    const hits = [];

    const listPage = () => `<!doctype html><html><head><meta charset="utf-8"><title>${seriesTitle}</title>
<meta name="subject" content="${seriesTitle}"></head><body>
<h1 class="hero-v2-title">${seriesTitle}</h1>
<ul class="ep-list-v2">
${Array.from({ length: total }, (_, i) => total - i).map(n => `  <li class="ep-row-v2"><a class="ep-row-v2-link" href="/webtoon/100/ep${n}"><span class="ep-row-v2-no">${n}</span><span class="ep-row-v2-title"><strong>${seriesTitle} ${n}화</strong></span></a></li>`).join('\n')}
</ul></body></html>`;

    const viewerPage = (n) => {
        if (options.captchaEp === n && !options._captchaSolved) {
            // 클라우드플레어 "Just a moment" 화면처럼 몇 초 뒤 자동 통과(새로고침). captchaStuck이면 계속 확인 화면
            if (!options.captchaStuck) options._captchaSolved = true;
            return `<!doctype html><html><head><meta charset="utf-8"><title>Just a moment...</title><meta http-equiv="refresh" content="${options.captchaRefreshSec || 8}"></head><body><div id="challenge-running">checking</div></body></html>`;
        }
        const next = n < total ? `<a id="goNextBtn" href="/webtoon/100/ep${n + 1}">다음화 ▶</a>` : `<a id="goNextBtn" href="#" class="disabled">다음화</a>`;
        return `<!doctype html><html><head><meta charset="utf-8"><title>${seriesTitle} ${n}화</title>
<meta property="og:title" content="${seriesTitle}"></head><body>
<div class="crumb"><a href="/webtoon/100">${seriesTitle}</a> <strong>${n}화</strong></div>
<h1>${seriesTitle} ${n}화</h1>
<div class="vw-imgs">${[1, 2, 3].map(k => `<img src="/img/${n}-${k}.png" width="300" height="400">`).join('')}</div>
${next}
</body></html>`;
    };

    const novelTitle = options.novelTitle || '테스트소설';
    const novelListPage = () => `<!doctype html><html><head><meta charset="utf-8"><title>${novelTitle}</title>
<meta name="subject" content="${novelTitle}"></head><body>
<h1 class="hero-v2-title">${novelTitle}</h1>
<ul class="novel-eps">
${Array.from({ length: total }, (_, i) => total - i).map(n => `  <li class="ep-row-v2"><a href="/novel/200/${n}"><span class="ne-num">${n}</span><span class="ne-title">${novelTitle} ${n}화</span></a></li>`).join('\n')}
</ul></body></html>`;
    const novelViewerPage = (n) => {
        if (options.captchaEp === n && !options._captchaSolved) {
            if (!options.captchaStuck) options._captchaSolved = true;
            return `<!doctype html><html><head><meta charset="utf-8"><title>Just a moment...</title><meta http-equiv="refresh" content="${options.captchaRefreshSec || 8}"></head><body><div id="challenge-running">checking</div></body></html>`;
        }
        const next = n < total ? `<a id="goNextBtn" href="/novel/200/${n + 1}">다음화 ▶</a>` : `<a id="goNextBtn" href="#" class="disabled">다음화</a>`;
        const paras = [1, 2, 3, 4].map(k => `<p>${novelTitle} ${n}화의 ${k}번째 문단입니다. 본문이 충분히 길어야 추출 조건(50자 이상)을 만족합니다.</p>`).join('');
        return `<!doctype html><html><head><meta charset="utf-8"><title>${novelTitle} ${n}화</title>
<meta property="og:title" content="${novelTitle}"></head><body>
<div class="crumb"><a href="/novel/200">${novelTitle}</a> <strong>${n}화</strong></div>
<h1 class="ne-h1">${novelTitle} ${n}화</h1>
<article class="novel-viewer">${paras}</article>
${next}
</body></html>`;
    };

    // 실제 Tampermonkey처럼 도메인과 무관하게 하나로 공유되는 GM 저장소 (모든 포트/호스트가 같은 메모리 사용)
    const gmStore = new Map();
    const gmChanges = [];
    let gmSeq = 0;
    const readBody = (req) => new Promise(r => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => r(b)); });
    const json = (res, obj) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

    const handler = async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        let m;
        if (url.pathname === '/__gm/get') {
            const k = url.searchParams.get('k');
            return json(res, gmStore.has(k) ? { has: true, v: gmStore.get(k) } : { has: false });
        }
        if (url.pathname === '/__gm/set' || url.pathname === '/__gm/del') {
            const body = JSON.parse(await readBody(req) || '{}');
            const old = gmStore.has(body.k) ? gmStore.get(body.k) : undefined;
            if (url.pathname === '/__gm/set') gmStore.set(body.k, body.v); else gmStore.delete(body.k);
            gmChanges.push({ seq: ++gmSeq, k: body.k, old, nv: url.pathname === '/__gm/set' ? body.v : undefined, writer: body.writer });
            if (gmChanges.length > 5000) gmChanges.splice(0, gmChanges.length - 5000);
            return json(res, { seq: gmSeq });
        }
        if (url.pathname === '/__gm/changes') {
            const since = parseInt(url.searchParams.get('since') || '0', 10);
            return json(res, { seq: gmSeq, changes: gmChanges.filter(c => c.seq > since) });
        }
        hits.push(`${req.headers.host}${url.pathname}`);
        if (url.pathname === '/webtoon/100' || url.pathname === '/webtoon/100/') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end(listPage());
        }
        // 소설 (blacktoon_novel 규칙 구조): 목록 /novel/200, 회차 /novel/200/{n}
        if (url.pathname === '/novel/200' || url.pathname === '/novel/200/') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end(novelListPage());
        }
        if ((m = url.pathname.match(/^\/novel\/200\/(\d+)$/))) {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end(novelViewerPage(parseInt(m[1], 10)));
        }
        if ((m = url.pathname.match(/^\/webtoon\/100\/ep(\d+)$/))) {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end(viewerPage(parseInt(m[1], 10)));
        }
        if ((m = url.pathname.match(/^\/img\/(\d+)-(\d+)\.png$/))) {
            if (options.block429Ep === parseInt(m[1], 10)) {
                res.writeHead(429, { 'retry-after': '1' });
                return res.end('too many');
            }
            res.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*' });
            return res.end(PNG);
        }
        res.writeHead(404);
        res.end('not found');
    };

    // 서로 다른 호스트명(127.0.0.1 / localhost)으로 같은 사이트를 두 도메인에서 제공 → 미러 도메인 전환 시험용
    const listen = (host) => new Promise(resolve => {
        const srv = http.createServer((req, res) => { handler(req, res).catch(e => { res.writeHead(500); res.end(String(e)); }); });
        srv.listen(0, host, () => resolve(srv));
    });
    const serverA = await listen('127.0.0.1');
    const serverB = await listen('localhost');
    const server = { close: () => { serverA.close(); serverB.close(); } };
    return {
        server,
        origin: `http://127.0.0.1:${serverA.address().port}`,
        originB: `http://localhost:${serverB.address().port}`,
        hits,
        options
    };
}

module.exports = { createMockSite };
