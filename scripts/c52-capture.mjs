// C.52 확인 캡처 (pending 82 6번, 디자인 159): 훈련·일정 [훈련 프리셋] 탭 · 프리셋 고르기 · 커스텀 만들기 · 홈 날짜 · 실제 선수 클럽 한글.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c52-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c52-check/', import.meta.url).pathname;
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


await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
await shot('1_실제선수-클럽한글');
report.clubs = (await page.locator('.real-row small').allTextContents()).slice(0, 3);
await newGameReal('kane', 'c52-check');
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await page.waitForSelector('[data-act="play"]', { timeout: 120_000 });
await page.waitForTimeout(1500);
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(400);
await dismiss();
report.homeEyebrow = await page.locator('.po-hero__eyebrow, .po-hero small').first().textContent().catch(() => null);
await shot('2_홈-날짜-프리셋줄');
await nav('schedule');
await shot('3_훈련프리셋');
await shot('4_훈련프리셋-전체', true);
await act('preset-pick', '[data-v="recovery"]');
await page.waitForTimeout(300);
report.picked = await page.locator('.pr-row.is-on b').first().textContent();
await act('preset-edit', '[data-v=""]');
await page.waitForTimeout(300);
await page.fill('#f-preset-name', '약발 집중');
for (const i of [0, 1, 2]) await page.selectOption(`[data-preset-slot="${i}"]`, 'weakFoot');
await shot('5_새프리셋-시트');
await act('preset-save');
await page.waitForTimeout(400);
report.custom = await page.locator('.pr-row .pr-edit').count();
await shot('6_내프리셋-추가', true);
await act('train-tab', '[data-v="cal"]');
await page.waitForTimeout(300);
await shot('7_일정탭');
await act('train-tab', '[data-v="g"]');
await page.waitForTimeout(300);
await shot('8_게이지탭');
console.log(JSON.stringify(report, null, 1));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
await browser.close();
