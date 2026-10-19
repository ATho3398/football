// C.51 확인 캡처 (pending 82 3번): [경기 시작] → 경기 준비 → [경기 시작], 결과 [다음 경기] → 경기 준비.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c51-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c51-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
const shot = async (name, full = false, wait = 0) => { if (wait) await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
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
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}`).first().click(); };
const scrollTo = async (sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(250); };
const waitImgs = () => page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); }))));
const report = { errors, broken };
const nav = async (to) => { await act('go-tab', '[data-v="home"]'); await page.waitForTimeout(300); await dismiss(); await act('go', `[data-to="${to}"]`); await page.waitForTimeout(400); await dismiss(); };

async function newGameReal(id, seed) {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await act('go', '[data-to="new"]');
  await page.fill('#f-seed', seed);
  await page.locator('#f-seed').dispatchEvent('change');
  await page.waitForTimeout(200);
  await act('form', '[data-k="mode"][data-v="real"]');
  await page.waitForTimeout(300);
  await page.locator(`[data-act="form"][data-k="realId"][data-v="${id}"]`).first().click();
  await page.waitForTimeout(200);
  await act('start');
  await page.waitForTimeout(800);
  if (await has('[data-act="tips-off"]')) await act('tips-off');
  await dismiss();
  if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
}

const screenOf = () => page.evaluate(() => document.querySelector('main')?.className ?? '');
await newGameReal('kane', 'c51-check');
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await shot('1_홈-경기날');
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await page.waitForTimeout(400);
await dismiss();
report.prep = await screenOf();
await shot('2_경기준비');
await shot('3_경기준비-전체', true);
await act('ctl-mode', '[data-v="auto"]');
await page.waitForTimeout(300);
report.modeAuto = await has('[data-act="ctl-mode"][data-v="auto"][aria-selected="true"]');
await act('ctl-mode', '[data-v="direct"]');
await page.waitForTimeout(300);
await act('prep-start');
await page.waitForSelector('[data-act="mo-auto"]', { timeout: 180_000 });
await page.waitForTimeout(500);
report.started = await screenOf();
await shot('4_경기시작-결정순간');
await act('mo-auto');
await page.waitForSelector('main.screen-match', { timeout: 180_000 });
await page.waitForTimeout(600);
await dismiss();
await shot('5_결과');
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 120_000 });
await page.waitForTimeout(600);
await dismiss();
report.nextPrep = await screenOf();
await shot('6_다음경기-경기준비');
report.form = await page.locator('.prep-form__m').allTextContents();
console.log(JSON.stringify(report, null, 1));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
await browser.close();
