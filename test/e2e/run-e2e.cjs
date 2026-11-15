/**
 * TokiSync E2E 시험 (실제 Chromium + 빌드 번들 + 가짜 사이트)
 * 사용: node test/e2e/run-e2e.cjs [scenario]
 *   scenario: range (기본) | captcha | chain | resume
 * 사전 조건: npm run build:core (dist/tokiSync.user.js)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createMockSite } = require('./mock-site.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE = fs.readFileSync(path.join(ROOT, 'dist', 'tokiSync.user.js'), 'utf8');
const SHIM = fs.readFileSync(path.join(__dirname, 'gm-shim.js'), 'utf8');
// 실제 스크립트 머리말의 @require(jszip 3.x)와 같은 역할
const JSZIP = fs.readFileSync(require.resolve('jszip/dist/jszip.min.js'), 'utf8');
const scenario = process.argv[2] || 'range';
const LOG_FILE = path.join(process.env.E2E_LOG_DIR || __dirname, `e2e-${scenario}.log`);

const logs = [];
const log = (line) => { logs.push(line); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitFor(fn, timeoutMs, label) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const v = await fn();
        if (v) return v;
        await sleep(300);
    }
    throw new Error(`시간 초과: ${label}`);
}

(async () => {
    const site = await createMockSite({ total: 3, ...(scenario === 'captcha' ? { captchaEp: 1 } : {}) });
    const browser = await chromium.launch();
    const context = await browser.newContext({ acceptDownloads: true });
    // Tampermonkey처럼 http(s) 문서마다 1회 주입 (about:blank 대시보드 창에는 주입하지 않음)
    // Chromium은 팝업이 초기 about:blank에서 같은 origin 주소로 넘어갈 때 window 객체를 재사용하므로
    // addInitScript가 다시 실행되지 않는다 → domcontentloaded에서 미주입 문서에 직접 주입해 보완
    const INJECT = `if (/^https?:/.test(location.protocol) && !window.__tokiInjected) { window.__tokiInjected = true;\n${SHIM}\n${JSZIP}\n${BUNDLE}\n}`;
    await context.addInitScript({ content: INJECT });
    const ensureInjected = (p) => p.on('domcontentloaded', () => { p.evaluate(INJECT).catch(() => {}); });

    const downloads = [];
    let page;
    const savedFiles = async () => (page ? await page.evaluate(() => GM_getValue('__E2E_SAVED_FILES', [])).catch(() => []) : []);
    const attach = (p, label) => {
        p.on('console', m => log(`[${label}] ${m.type()}: ${m.text()}`));
        p.on('pageerror', e => log(`[${label}] PAGEERROR: ${e.message}`));
        p.on('dialog', d => { log(`[${label}] DIALOG(${d.type()}): ${d.message()}`); d.accept().catch(() => {}); });
        p.on('download', d => { downloads.push(d.suggestedFilename()); log(`[${label}] DOWNLOAD: ${d.suggestedFilename()} (${d.url().slice(0, 60)})`); });
    };
    let popupCount = 0;
    page = await context.newPage();
    attach(page, 'main');
    context.on('page', p => { attach(p, `popup${++popupCount}`); ensureInjected(p); });
    await page.goto(`${site.origin}/webtoon/100`);
    // 설정: 개별 저장, 빠른 속도 (테스트 시간 단축)
    await page.evaluate(() => {
        GM_setValue('TOKI_DOWNLOAD_POLICY', scenarioPolicy());
        function scenarioPolicy() { return window.__e2ePolicy || 'individual'; }
        GM_setValue('TOKI_PACING_STATE', { level: 0, okStreak: 0, softFailStreak: 0, backoffCount: 0, cooldownUntil: 0, cooldownReason: '', lastSignalAt: 0, sinceRest: 0, restUntil: 0 });
        GM_setValue('TOKI_SLEEP_MODE', 'cautious');
    });
    await page.reload();
    await sleep(1500);

    const openDashboard = async () => {
        const [dash] = await Promise.all([
            context.waitForEvent('page', { timeout: 10000 }),
            page.evaluate(() => window.__gmMenu['⚙️ 설정 (Settings)']())
        ]);
        await dash.waitForLoadState();
        await sleep(800);
        // 메뉴의 "설정"으로 열면 설정 탭이 기본이므로 다운로드 탭으로 전환
        await dash.click('[data-tab="download"]').catch(() => {});
        await sleep(300);
        return dash;
    };

    let result = { scenario, ok: false };
    try {
        if (scenario === 'range' || scenario === 'captcha') {
            const dash = await openDashboard();
            await dash.click('[data-tab="download"]').catch(() => {});
            await dash.fill('#toki-range-input', '1-2');
            await dash.click('#toki-btn-down-range');
            await waitFor(async () => (await savedFiles()).length >= 2, 120000, '회차 2개 저장');
            result.ok = true;
        } else if (scenario === 'chain') {
            await page.evaluate(() => GM_setValue('TOKI_DOWNLOAD_POLICY', 'zipOfCbzs'));
            const dash = await openDashboard();
            await dash.click('#toki-btn-chain-start');
            await waitFor(async () => (await savedFiles()).some(n => n.endsWith('.zip')), 150000, '합본 ZIP 저장');
            result.ok = true;
        } else if (scenario === 'resume') {
            await page.evaluate(() => GM_setValue('TOKI_DOWNLOAD_POLICY', 'zipOfCbzs'));
            let dash = await openDashboard();
            await dash.click('#toki-btn-down-all');
            // 첫 회차가 보관되면 원래 탭을 새로고침 (작업 중단 상황 재현)
            await waitFor(() => page.evaluate(() => Object.values(GM_getValue('TOKI_MERGE_SESSIONS', {})).some(s => (s.storedIds || []).length >= 1)), 90000, '첫 회차 보관');
            await dash.close().catch(() => {});
            await page.reload();
            await sleep(2500);
            dash = await openDashboard();
            await waitFor(() => dash.$('[data-work-action="resume-session"]'), 10000, '이어받기 버튼 표시');
            await dash.click('[data-work-action="resume-session"]');
            await waitFor(async () => (await savedFiles()).some(n => n.endsWith('.zip')), 150000, '이어받은 뒤 합본 ZIP 저장');
            result.ok = true;
        }
    } catch (e) {
        result.error = e.message;
    }
    result.downloads = await savedFiles();
    result.pages = await Promise.all(context.pages().map(async p => `${p.url()} name=${await p.evaluate(() => window.name).catch(() => '?')} worker=${await p.evaluate(() => !!window.tokisync_worker_extractor_initialized).catch(() => '?')} shim=${await p.evaluate(() => !!window.__gmShimInstalled).catch(() => '?')}`));
    result.queue = await page.evaluate(() => GM_getValue('TOKI_DOWNLOAD_QUEUE', [])).catch(() => 'n/a');
    result.paused = await page.evaluate(() => GM_getValue('TOKI_QUEUE_PAUSED', false)).catch(() => 'n/a');
    fs.writeFileSync(LOG_FILE, logs.join('\n'), 'utf8');
    console.log(JSON.stringify({ pages: result.pages, ...result, queue: Array.isArray(result.queue) ? result.queue.map(q => `${q.episodeTitle}:${q.status}:${q.stage}:${q.errorMsg || ''}`) : result.queue, log: LOG_FILE }, null, 2));
    await browser.close();
    site.server.close();
    process.exit(result.ok ? 0 : 1);
})();
