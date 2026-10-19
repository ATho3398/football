// C.67 확인 캡처: 세이브(챔스 1차전 날 · 3월 녹아웃 진행 중)를 넣어 홈 배지 · 경기 준비 · 경기 결과 · 월드 컵·챔스 탭 · 자동 진행 시트를 찍는다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c67-capture.mjs <playwright 경로> <저장 폴더> <save1.json> <save2.json>. 환경: W H PREFIX
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c67-check/', import.meta.url).pathname;
const saves = [readFileSync(process.argv[4], 'utf8'), readFileSync(process.argv[5], 'utf8')];
const W = Number(process.env.W ?? 844);
const H = Number(process.env.H ?? 340);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const has = async (sel) => (await page.locator(sel).count()) > 0;
const report = { W, H, errors, screens: {} };
const shot = async (name) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${P}${name}.png` });
  report.screens[name] = await page.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth }));
  console.log('saved', name, JSON.stringify(report.screens[name]));
};
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); return page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); };
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const tab = async (v) => { await page.evaluate((x) => document.querySelector(`[data-act="go-tab"][data-v="${x}"]`)?.click(), v); await page.waitForTimeout(400); await dismiss(); await top(); };
const load = async (slot) => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(({ s1, s2 }) => {
    localStorage.clear();
    localStorage.setItem('football-career:1', s1);
    localStorage.setItem('football-career:2', s2);
    localStorage.setItem('po-tips-off', '1');
    return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); });
  }, { s1: saves[0], s2: saves[1] });
  await page.reload();
  await page.waitForTimeout(600);
  if (!(await has(`[data-act="load"][data-slot="${slot}"]`))) await page.evaluate(() => document.querySelector('[data-act="go"][data-to="saves"]')?.click());
  await page.waitForSelector(`[data-act="load"][data-slot="${slot}"]`, { state: 'attached', timeout: 10_000 });
  await page.evaluate((s) => document.querySelector(`[data-act="load"][data-slot="${s}"]`)?.click(), slot);
  await page.waitForTimeout(1200);
  await dismiss();
};

await load('1');
await tab('home');
await page.evaluate(() => document.querySelector('.next-card')?.scrollIntoView({ block: 'start' })); await shot('홈-챔스배지');
await page.evaluate(() => document.querySelector('[data-act="sim-rest"]')?.click()); await page.waitForTimeout(500); await shot('자동진행-시트');
await page.evaluate(() => document.querySelector('[data-act="sheet-close"]')?.click()); await page.waitForTimeout(300);
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await dismiss();
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');
await top(); await shot('경기준비-챔스');
await act('prep-start');
await page.waitForSelector('main.screen-match', { timeout: 240_000 });
await page.waitForTimeout(600); await dismiss(); await top(); await shot('경기결과-챔스');
await page.evaluate(() => document.querySelector('.po-banner, .banner')?.scrollIntoView({ block: 'start' })); await shot('경기결과-챔스-배너');
await tab('world');
await page.evaluate(() => document.querySelector('[data-act="world-tab"][data-v="cups"]')?.click()); await page.waitForTimeout(400); await shot('월드-컵챔스-조별');
await load('2');
await tab('world');
await page.evaluate(() => document.querySelector('[data-act="world-tab"][data-v="cups"]')?.click()); await page.waitForTimeout(400); await shot('월드-컵챔스-녹아웃');
await page.evaluate(() => window.scrollTo(0, 99999)); await shot('월드-컵챔스-FA');
await tab('schedule'); await shot('훈련일정-컵');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log('errors', errors.length);
await browser.close();
