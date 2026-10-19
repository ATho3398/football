// C.65 확인 캡처: 실게임(손흥민) 시즌 목표 — 홈 목표 카드(개막 · 10경기 뒤) · 인박스 목표 알림 · 시즌 요약 목표 결과 · 카드 3택 1(목표 보상).
// 빠르게 돌리려고 다른 경기는 빠른 진행(통계). 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c65-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c65-check/', import.meta.url).pathname;
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
await page.fill('#f-seed', 'c65-check');
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
const autoRun = async (v) => {
  await home();
  await act('sim-rest');
  await page.waitForTimeout(300);
  if (v === 'end') await page.locator('.auto-chip:visible').last().click(); else await act('auto-count', `[data-v="${v}"]`);
  await act('auto-run');
  const t0 = Date.now(); await page.waitForTimeout(1000); while (Date.now() - t0 < 1500000 && (await has('.auto-layer'))) await page.waitForTimeout(500);
  await page.waitForTimeout(800);
  await dismiss();
};
const goalCard = async (name) => {
  await home();
  if (!(await has('.gl-card'))) return;
  await page.locator('.gl-card').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(250);
  await shot(name);
};
await page.evaluate(() => { const g = window.__game(); if (g) g.options.quickOthers = true; });
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');
await goalCard('홈_시즌목표-개막');
report.goals = await page.evaluate(() => window.__game()?.goals?.list ?? null);
await autoRun(10);
await goalCard('홈_시즌목표-10경기');
await measure('home');
// ── 인박스 시즌 목표 알림 ──
if (await has('[data-act="go"][data-to="inbox"]')) {
  await act('go', '[data-to="inbox"]');
  await page.waitForTimeout(400);
  await top();
  await shot('인박스_시즌목표');
  const it = page.locator('.ib-list [data-act]').filter({ hasText: '시즌 목표' }).first();
  if (await it.count()) { await it.click(); await page.waitForTimeout(400); await top(); await shot('인박스_시즌목표-상세'); }
}
// ── 시즌 끝까지 → 시즌 요약 목표 결과 ──
for (let k = 0; k < 4 && (await page.evaluate(() => window.__game()?.phase)) === 'season'; k++) await autoRun('end');
report.phase = await page.evaluate(() => window.__game()?.phase);
report.results = await page.evaluate(() => window.__game()?.lastSeasonSummary?.goals ?? null);
if (await has('[data-act="go"][data-to="season"]')) await act('go', '[data-to="season"]');
await page.waitForTimeout(500);
await dismiss();
await top();
await shot('시즌요약_목표결과');
if (await has('.gl-result')) { await page.locator('.gl-result').first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200); await shot('시즌요약_목표결과-패널'); }
await measure('season');
// ── 카드 3택 1 (목표 보상) ──
await go('deck');
await top();
await waitImgs();
for (let k = 0; k < 3 && (await page.evaluate(() => window.__game()?.cards.picks[0]?.source)) === 'level'; k++) { await act('pick-take'); await page.waitForTimeout(400); await dismiss(); }
await top();
await waitImgs();
await shot('85_카드획득-목표보상');
await measure('pick');
report.picks = await page.evaluate(() => window.__game()?.cards.picks.map((p) => [p.source, p.label]));
report.wideMax = Math.max(...Object.values(report.wide));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ errors: errors.length, broken: broken.length, phase: report.phase, wideMax: report.wideMax, picks: report.picks, met: report.results?.results?.map((r) => r.met) }));
await browser.close();
