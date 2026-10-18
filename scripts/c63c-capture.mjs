// C.63c 확인 캡처 (폰): 독 순서(진행·선수·홈) · 더보기 펼침 줄(접힘·펼침·끝까지 끔) · 진행 중 띠 · 선수 머리말(소속·OVR 단위) · 결정 순간 피치 40%+ (844·700 두 높이).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c63c-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: PREFIX SKIN(a|b)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c63c-check/', import.meta.url).pathname;
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
const scrollTo = (sel) => page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));

const start = async (mode, id, seed) => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await skin();
  await act('go', '[data-to="new"]');
  await page.waitForTimeout(300);
  await page.fill('#f-seed', seed);
  await page.locator('#f-seed').dispatchEvent('change');
  if (mode === 'real') {
    await act('form', '[data-k="mode"][data-v="real"]');
    await page.waitForTimeout(300);
    await page.locator(`[data-act="form"][data-k="realId"][data-v="${id}"]`).first().click();
  }
  await page.waitForTimeout(200);
  await act('start');
  await page.waitForTimeout(800);
  if (await has('[data-act="tips-off"]')) await act('tips-off');
  await dismiss();
};
// ── 1. 가상 유망주(사진 없음): 독 · 더보기 줄 · 진행 중 띠 · 선수 머리말 ──
await start('prospect', '', 'c63c-check');
await home();
await top();
await shot('dock_접힘');
await act('dock-more');
await page.waitForTimeout(300);
await shot('dock_더보기-펼침');
report.moreItems = await page.locator('.dock-more__item').count();
await page.locator('.dock-more__scroll').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
await page.waitForTimeout(300);
await shot('dock_더보기-끝까지');
report.moreEnd = await page.locator('.dock-more__scroll').evaluate((el) => el.className);
// 바깥(화면)을 누르면 접힘
await page.mouse.click(W / 2, 300);
await page.waitForTimeout(300);
report.closedByOutside = !(await has('.dock-more'));
// 진행 중 띠 (하루 진행 중 화면을 찍는다)
if (await has('[data-act="day-continue"]')) {
  await page.locator('[data-act="day-continue"]').first().click();
  await page.waitForTimeout(120);
  await shot('home_진행중-띠');
  for (let k = 0; k < 60 && (await has('[data-act="sim-stop"]')); k++) await page.waitForTimeout(500);
}
await page.locator('[data-act="go-tab"][data-v="player"]').first().click();
await page.waitForTimeout(400);
await dismiss();
await page.waitForTimeout(2800); // 토스트가 사라진 뒤
await top();
await shot('player_머리말');
await measure('player');
// ── 2. 결정 순간 (손흥민, 직접) ──
await start('real', 'son', 'c56-check');
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await page.waitForTimeout(300);
await dismiss();
if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
await act('prep-start');
const pitchShare = () => page.evaluate(() => {
  const st = document.querySelector('.mo-stage')?.getBoundingClientRect();
  const conf = [...document.querySelectorAll('[data-act="mo-confirm"]')].find((x) => x.offsetParent)?.getBoundingClientRect();
  return { h: innerHeight, stage: st ? Math.round(st.height) : 0, share: st ? Math.round((st.height / innerHeight) * 100) : 0, confirmBottom: conf ? Math.round(conf.bottom) : null, dockVisible: [...document.querySelectorAll('.dock-bar')].some((x) => x.offsetParent) };
});
for (let n = 0; n < 30; n++) {
  await page.waitForSelector('[data-act="mo-confirm"], [data-act="oc-skip"], main.screen-match', { timeout: 180_000 });
  if (await page.evaluate(() => !!document.querySelector('main.screen-match'))) break;
  await page.waitForTimeout(1600);
  await dismiss();
  if (!(await has('[data-act="mo-confirm"]'))) { if (await has('[data-act="oc-skip"]')) await act('oc-skip'); await page.waitForTimeout(300); continue; }
  if (await has('.mo-react')) { await act('mo-pick-confirm', '[data-v="0"]'); continue; }
  await top();
  await shot('mo_결정순간-844');
  report.mo844 = await pitchShare();
  await act('mo-pick', '[data-v="0"]');
  await page.waitForTimeout(250);
  await shot('mo_결정순간-고름-844');
  await page.setViewportSize({ width: W, height: 700 });
  await page.waitForTimeout(400);
  await top();
  await shot('mo_결정순간-700');
  report.mo700 = await pitchShare();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  await shot('mo_결정순간-700-아래');
  await page.setViewportSize({ width: W, height: Number(process.env.H ?? 844) });
  await act('mo-confirm');
  // 결정 결과 (81~84)
  await page.waitForTimeout(900);
  await shot('mo_결정결과');
  report.outcome = await pitchShare();
  break;
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
