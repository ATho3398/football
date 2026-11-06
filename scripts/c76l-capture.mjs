// C.76l (U8-c) 확인 캡처: 239 리그 고르기·시작 팀 · 229 커스텀 · 233 미래 스타 · 234 레전드 팩 묶음·월드 레전드 · 238 도감 · 240B 도감 배너.
// 폰 390×844 기본 · PC 1280×800 (W H PREFIX). 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c76l-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c76l-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const FULL = !!process.env.FULL;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const has = async (sel) => (await page.locator(sel).count()) > 0;
const check = () => page.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth }));
const report = { W, H, errors, screens: {} };
const shot = async (name, full = FULL) => {
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
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); await page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); await page.waitForTimeout(250); };
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const into = (sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), sel);
const tab = async (v) => {
  if (!(await has(`[data-act="go-tab"][data-v="${v}"]:visible`)) && (await has('[data-act="dock-more"]:visible'))) { await act('dock-more'); }
  if (!(await has(`[data-act="go-tab"][data-v="${v}"]:visible`))) await page.evaluate((x) => document.querySelector(`[data-act="go-tab"][data-v="${x}"]`)?.click(), v);
  else await act('go-tab', `[data-v="${v}"]`);
  await page.waitForTimeout(400); await dismiss(); await top();
};
const fresh = async () => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await page.waitForTimeout(400);
  await act('go', '[data-to="new"]');
};
const setSeed = async (s) => { if (await has('#f-seed')) { await page.fill('#f-seed', s); await page.locator('#f-seed').dispatchEvent('change'); await page.waitForTimeout(200); } };

// 239 · 229 전체 랜덤 결과
if (want('random')) {
  await fresh();
  await act('ng-random');
  await top(); await shot('01_전체랜덤-결과');
  await into('.ng-lgsec'); await shot('02_리그-접힘');
  await act('ng-lg-open'); await into('.ng-lgsec'); await shot('03_리그-펼침');
  await act('ng-lg-group', '[data-v="asia"]').catch(() => null); await into('.ng-lg__grp[data-g="asia"]'); await shot('04_리그-아시아펼침');
  await act('ng-leagues', '[data-v="mine"]'); await into('.ng-lgsec'); await shot('05_리그-내리그만');
  await act('ng-leagues', '[data-v="all"]');
  await into('.tp'); await shot('06_시작팀-PL');
  await act('ng-pick-league', '[data-v="laliga"]'); await into('.tp'); await shot('07_시작팀-라리가');
}
// 229 커스텀
if (want('custom')) {
  await fresh();
  await top(); await shot('08_커스텀-기본');
  await act('cu-step', '[data-v="5"]'); await top(); await shot('09_커스텀-능력치');
}
// 233 · 234 실제 선수 묶음
if (want('real')) {
  await fresh();
  await act('form', '[data-k="mode"][data-v="real"]');
  await act('form', '[data-k="futureStars"][data-v="on"]').catch(() => null);
  await act('form', '[data-k="legends"][data-v="on"]').catch(() => null);
  await act('ng-real', '[data-k="realTab"][data-v="future"]'); await top(); await shot('10_미래스타');
  await act('ng-real', '[data-k="realTab"][data-v="legend"]');
  await act('ng-real', '[data-k="lpack"][data-v="bvb"]'); await top(); await shot('11_레전드팩-도르트문트');
}
// 238 도감 · 234 월드 레전드
if (want('dex')) {
  await fresh();
  await act('form', '[data-k="mode"][data-v="real"]');
  await act('form', '[data-k="futureStars"][data-v="on"]').catch(() => null);
  await act('form', '[data-k="legends"][data-v="on"]').catch(() => null);
  await page.locator('[data-act="form"][data-k="realId"]').first().click();
  await act('start'); await page.waitForTimeout(800);
  for (const sel of ['[data-act="tips-off"]', '[data-act="opt-quick"][data-v="quick"]']) { await page.locator(`${sel}:visible`).first().click({ timeout: 1500 }).catch(() => null); await page.waitForTimeout(250); await dismiss(); }
  await dismiss();
  // 도감에 카드 넣기 (화면 확인용 — 실제 경기에서 모으는 것과 같은 모양)
  await page.evaluate(() => {
    const g = globalThis.__game();
    const ids = ['kante', 'hazard', 'eriksen', 'son', 'kane', 'salah', 'de-bruyne'];
    g.photos = { cards: ids.map((id, i) => ({ id, d: `2018-08-${String(11 + i).padStart(2, '0')}`, s: 2018, vs: 'chelsea', jersey: false, first: { t: 'chelsea', o: 80 + i } })) };
  });
  await tab('home');
  await page.evaluate(() => document.querySelector('[data-act="go"][data-to="dex"]')?.click());
  await page.waitForTimeout(400); await top();
  await shot('12_도감-번호순');
  if (W < 1024) { await act('pc-sort-open'); await page.locator('[data-act="pc-sort"][data-v="ovr"]').first().click(); await page.waitForTimeout(200); await act('pc-sort-open'); await shot('13_도감-정렬메뉴'); await act('pc-sort-open'); }
  else { await act('pc-sort', '[data-v="ovr"]'); }
  await act('pc-dir');
  await page.locator('[data-act="pc-flip"]').first().click(); await page.waitForTimeout(200); await top();
  await shot('14_도감-능력치-뒷면');
  if (W < 1024) await act('pc-sort-open');
  await act('pc-sort', '[data-v="pos"]');
  await top(); await shot('15_도감-포지션');
  await tab('world');
  await act('world-tab', '[data-v="stars"]'); await into('.wl-legends, .star-list'); await shot('16_월드-리그스타-레전드');
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors }, null, 1));
await browser.close();
