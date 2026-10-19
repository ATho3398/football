// C.74c 확인 캡처: 경기 준비 "상대 분석" 칸 → 결정 순간 "약점 공략" 칩 → 선수 기록 탭 "호흡 좋은 동료".
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c74c-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c74c-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const shot = async (name, sel) => {
  await page.waitForTimeout(400);
  if (sel && (await has(sel))) { await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(150); }
  await page.screenshot({ path: `${OUT}/${P}${name}.png` });
  console.log('saved', name, 'wide', await wide());
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
const click = async (sel) => { await dismiss(); await page.locator(`${sel}:visible`).first().click(); await page.waitForTimeout(250); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
if (process.env.SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
await page.reload();
await click('[data-act="go"][data-to="new"]');
await page.fill('#f-seed', process.env.SEED ?? 'c74c-1'); await page.locator('#f-seed').dispatchEvent('change');
await click('[data-act="form"][data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
await click('[data-act="start"]'); await page.waitForTimeout(900);
await page.evaluate(() => document.querySelector('[data-act="tips-off"]')?.click()); await page.waitForTimeout(300);
await dismiss();
for (let k = 0; k < 10 && !(await has('[data-act="play"]')); k++) { if (await has('[data-act="day-continue"]')) { await click('[data-act="day-continue"]'); await page.waitForTimeout(1500); await dismiss(); } else break; }
await click('[data-act="play"]');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 }).catch(() => {}); await dismiss();
console.log('scout', await page.evaluate(() => document.querySelector('.prep-scout')?.closest('section')?.textContent?.replace(/\s+/g, ' ').trim()));
await shot('1_경기준비_상대분석', '.prep-scout');
// 직접 모드: 결정 순간에서 "약점 공략" 칩을 찾는다 (없으면 맡기기로 넘김)
if (await has('[data-act="ctl-mode"][data-v="direct"]')) await click('[data-act="ctl-mode"][data-v="direct"]');
if (await has('[data-act="ctl-stop"][data-v="all"]')) await click('[data-act="ctl-stop"][data-v="all"]');
await click('[data-act="prep-start"]');
let found = false;
for (let k = 0; k < 40; k++) {
  await page.waitForSelector('.mo-panel, .mr-env-line', { timeout: 90_000 }).catch(() => {});
  await dismiss();
  if (!(await has('.mo-panel'))) break;
  if (await has('[data-act="oc-skip"]') && !(await has('[data-act="mo-delegate"]'))) { await click('[data-act="oc-skip"]'); await page.waitForTimeout(500); continue; }
  if (await has('.po-exploit')) { found = true; await shot('2_결정순간_약점공략', '.po-exploit'); break; }
  await click('[data-act="mo-delegate"]');
  await page.waitForTimeout(600);
}
console.log('exploit chip', found);
if (found) {
  if (await has('[data-act="mo-auto"]')) await click('[data-act="mo-auto"]');
  else await click('[data-act="mo-delegate"]');
}
for (let k = 0; k < 80 && (await has('.mo-panel')); k++) {
  if (await has('[data-act="mo-delegate"]:visible')) await click('[data-act="mo-delegate"]');
  else if (await has('[data-act="oc-skip"]:visible')) await click('[data-act="oc-skip"]');
  await page.waitForTimeout(500);
}
await page.waitForSelector('.mr-env-line', { timeout: 120_000 }).catch(() => {});
await page.waitForTimeout(800); await dismiss();
await click('[data-act="go-tab"][data-v="player"]');
await page.waitForTimeout(500); await dismiss();
if (await has('[data-act="player-tab"][data-v="record"]')) await click('[data-act="player-tab"][data-v="record"]');
await page.waitForTimeout(400);
console.log('chem', await page.evaluate(() => document.querySelector('.chem-list')?.textContent?.replace(/\s+/g, ' ').trim()));
await shot('3_선수_호흡좋은동료', '.chem-list');
console.log('errors', errors.length, errors.slice(0, 3));
await browser.close();
