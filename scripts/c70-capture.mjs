// C.70 확인 캡처 (U7-b: 161 홈-시즌중-v3 · 162 레벨업 · 163 포인트찍기-v2 · 166 경기준비-v2 · 170 경기결과-폰-v2 · 160 PC 경기결과 2열).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c70-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c70-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const PC = W >= 1024;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const has = async (sel) => (await page.locator(sel).count()) > 0;
const check = () => page.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight }));
const report = { W, H, errors, screens: {} };
const shot = async (name, full = false) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full });
  report.screens[name] = await check();
  console.log('saved', name, JSON.stringify(report.screens[name]));
};
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
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const goTab = async (v) => { await page.evaluate((x) => document.querySelector(`[data-act="go-tab"][data-v="${x}"]`)?.click(), v); await page.waitForTimeout(400); await dismiss(); await top(); };
const SKIN = process.env.SKIN ?? 'b';

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
if (SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
await page.reload();
await act('go', '[data-to="new"]');
await page.waitForTimeout(300);
await page.fill('#f-seed', 'c70-check');
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
// 포인트 12P · 성장·전술 열림 (디자인 161 샘플과 같은 상태)
await page.evaluate(() => { const g = window.__game(); g.player.unspentPoints = 12; for (const f of ['growth', 'tactics', 'deck']) if (!g.guide.unlocked.includes(f)) g.guide.unlocked.push(f); });
await goTab('player'); await goTab('home');
await shot('161_홈-시즌중-v3'); await shot('161_홈-시즌중-v3_전체', true);
// 163 포인트 찍기
await page.evaluate(() => document.querySelector('[data-act="go"][data-to="allocate"]')?.click());
await page.waitForTimeout(500); await dismiss(); await top();
if (await has('[data-act="alloc-rule"]')) { await act('alloc-rule'); await page.waitForTimeout(200); }
await top(); await shot('163_포인트찍기-v2'); await shot('163_포인트찍기-v2_전체', true);
// 포인트 1P 만 남은 상태: 2P·3P 칸 = 회색 "nP 부족"
await act('alloc-cancel'); await page.waitForTimeout(300);
await page.evaluate(() => { window.__game().player.unspentPoints = 1; });
await page.evaluate(() => document.querySelector('[data-act="go"][data-to="allocate"]')?.click()); await page.waitForTimeout(400); await dismiss();
await top(); await shot('163_포인트찍기-v2-포인트부족');
await page.evaluate(() => { window.__game().player.unspentPoints = 12; });
if (await has('[data-act="alloc-cancel"]')) await act('alloc-cancel');
await page.waitForTimeout(300);
await goTab('home');
// 경기 날까지
for (let k = 0; k < 10 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); await dismiss(); }
}
await goTab('player');
const need = await page.evaluate(() => Number((document.querySelector('.pl-lv .po-num')?.textContent ?? '').split('/')[1]) || 0);
await page.evaluate((n) => { const g = window.__game(); if (n) g.player.xp = n - 1; }, need);
await goTab('home');
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await page.waitForTimeout(400); await dismiss();
if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
await page.waitForTimeout(200); await top();
await shot('166_경기준비-v2'); await shot('166_경기준비-v2_전체', true);
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');
await act('prep-start');
for (let k = 0; k < 600; k++) {
  if (await has('main.screen-match .mr-head')) break;
  if (await has('[data-act="mo-auto"]')) await act('mo-auto').catch(() => {});
  if (await has('[data-act="oc-skip"]')) await act('oc-skip').catch(() => {});
  await page.waitForTimeout(300);
}
await page.waitForTimeout(400);
if (await has('.po-toast')) await shot('162_레벨업-토스트');
await page.waitForTimeout(2400); await dismiss(); await top();
const name = PC ? '160_PC-경기결과-2열' : '170_경기결과-폰-v2';
await shot(name); await shot(`${name}_전체`, true);
await goTab('home');
await shot('162_레벨업-배너');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors }, null, 1));
await browser.close();
