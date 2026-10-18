// C.64 확인 캡처: 실게임(손흥민) 10경기 자동 진행(다른 경기 = 엔진) 뒤 월드 득점 탭(득점·도움·평점) · 리그 스타 묶음(리그 안·세계·21세 이하) ·
// 홈 라이벌 카드(위상) · NPC 선수 상세(위상) · 인박스 득점 경쟁 기사.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c64-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c64-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
const shot = async (name, full = false) => { await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); };
const waitImgs = () => page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); }))));
const len = () => page.evaluate(() => document.documentElement.scrollHeight);
const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const report = { errors, broken, len: {}, wide: {} };
const measure = async (k) => { report.len[k] = await len(); report.wide[k] = await wide(); };
const SKIN = process.env.SKIN ?? 'b';
const skin = async () => { if (SKIN === 'a') await page.evaluate(() => { localStorage.setItem('po-skin', 'a'); document.documentElement.dataset.skin = 'a'; }); };
const home = async () => { await act('go-tab', '[data-v="home"]'); await page.waitForTimeout(400); await dismiss(); };
const go = async (v) => { if (['settings', 'world', 'deck', 'saves'].includes(v) && await page.locator('[data-act="dock-more"]:visible').count()) { await act('dock-more'); await page.waitForTimeout(300); } await act('go-tab', `[data-v="${v}"]`); await page.waitForTimeout(400); await dismiss(); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await skin();
await act('go', '[data-to="new"]');
await page.waitForTimeout(300);
await page.fill('#f-seed', 'c64-check');
await page.locator('#f-seed').dispatchEvent('change');
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
await page.waitForTimeout(200);
await act('start');
await page.waitForTimeout(800);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
// ── 10경기 자동 진행 (다른 경기 = 엔진 → 선수 시즌 기록) ──
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');
await home();
await act('sim-rest');
await page.waitForTimeout(300);
await act('auto-count', '[data-v="10"]');
await act('auto-run');
{ const t0 = Date.now(); await page.waitForTimeout(1000); while (Date.now() - t0 < 1500000 && (await has('.auto-layer'))) await page.waitForTimeout(500); }
await page.waitForTimeout(800);
await dismiss();
report.round = await page.evaluate(() => window.__game()?.league.round ?? null);
report.statPlayers = await page.evaluate(() => Object.keys(window.__game()?.playerStats ?? {}).length);
// ── 홈 라이벌 카드 (위상) ──
await home();
if (await has('.rv-card')) {
  await page.locator('.rv-card').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(250);
  await shot('홈_라이벌카드-위상');
  report.rivalLine = await page.locator('.rv-card .mg-mgr').first().innerText();
}
// ── 인박스 득점 경쟁 기사 ──
if (await has('[data-act="go"][data-to="inbox"]')) {
  await act('go', '[data-to="inbox"]');
  await page.waitForTimeout(400);
  await top();
  await shot('인박스_득점경쟁기사');
  report.raceNews = await page.evaluate(() => (window.__game()?.inbox?.items ?? []).filter((x) => x.key?.startsWith('race:')).map((x) => x.title));
}
// ── 월드 득점 탭: 득점 · 도움 · 평점 ──
await go('world');
await act('world-tab', '[data-v="scorers"]');
await page.waitForTimeout(300);
await waitImgs();
await top();
await shot('102_월드-리그기록-득점');
await measure('scorers');
await act('world-board', '[data-v="assists"]');
await page.waitForTimeout(300);
await shot('102_월드-리그기록-도움');
await act('world-board', '[data-v="rating"]');
await page.waitForTimeout(300);
await shot('102_월드-리그기록-평점');
await shot('102_월드-리그기록-평점_전체', true);
// ── 리그 스타 묶음 147 ──
await act('world-tab', '[data-v="stars"]');
await page.waitForTimeout(300);
await waitImgs();
await top();
await shot('147_리그스타-리그안');
await measure('starsLeague');
await act('world-stars', '[data-v="world"]');
await page.waitForTimeout(300);
await waitImgs();
await shot('147_리그스타-세계');
await act('world-stars', '[data-v="young"]');
await page.waitForTimeout(300);
await waitImgs();
await shot('147_리그스타-21세이하');
await measure('starsYoung');
report.starRows = await page.locator('.star-row').count();
report.nameClip = await page.evaluate(() => [...document.querySelectorAll('.star-row small')].filter((e) => e.scrollWidth > e.clientWidth + 1).length);
// ── NPC 선수 상세 (위상) ──
await act('world-stars', '[data-v="league"]');
await page.waitForTimeout(300);
await page.locator('.star-row').first().click();
await page.waitForTimeout(500);
await waitImgs();
await top();
await shot('선수상세_NPC위상');
await measure('person');
report.wideMax = Math.max(...Object.values(report.wide));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ errors: errors.length, broken: broken.length, round: report.round, statPlayers: report.statPlayers, wideMax: report.wideMax, rival: report.rivalLine, race: report.raceNews }));
await browser.close();
