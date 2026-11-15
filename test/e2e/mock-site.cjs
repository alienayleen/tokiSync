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

function createMockSite(options = {}) {
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
            // 클라우드플레어 "Just a moment" 화면처럼 몇 초 뒤 자동 통과(새로고침)
            options._captchaSolved = true;
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

    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        hits.push(url.pathname);
        let m;
        if (url.pathname === '/webtoon/100' || url.pathname === '/webtoon/100/') {
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return res.end(listPage());
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
    });

    return new Promise(resolve => {
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ server, origin: `http://127.0.0.1:${port}`, hits, options });
        });
    });
}

module.exports = { createMockSite };
