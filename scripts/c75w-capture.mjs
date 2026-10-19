// C.75w 확인 캡처: 레전드 팩 3판(추가 53명) 레전드 탭 · 리그 밖 레전드(이적 유입 예정) · 월드 레전드 목록.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 W=390 H=844 PREFIX=M_ node scripts/c75w-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c75w-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 1280);
const H = Number(process.env.H ?? 800);
const P = process.env.PREFIX ?? '';
const ONLY = (process.env.ONLY ?? 'real,custom,none,a').split(',');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const URL0 = process.env.URL ?? 'http://localhost:4173/';
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 5; k++) {
    if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); await page.waitForTimeout(300); };
const waitImgs = () => page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); }))));
const shot = async (name) => { await page.evaluate(() => document.fonts.ready); await waitImgs(); await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${P}${name}.png` }); console.log('saved', P + name); };
// 머리말 확인: 사진 · 이름 · OVR · 칩이 서로 겹치는지, 이름 넘침
const heroInfo = () => page.evaluate(() => {
  const q = (s) => document.querySelector(`.po-hero ${s}`);
  const r = (el) => el && el.getBoundingClientRect();
  const hit = (a, b) => !!(a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1);
  const f = q('.po-hero__face'), n = q('.po-hero__name'), v = q('.po-hero__num'), c = q('.po-hero__chips'), e = q('.po-hero__eyebrow');
  const hero = r(document.querySelector('.po-hero'));
  return {
    face: !!f, square: f?.classList.contains('is-square') ?? null, hero: hero && [Math.round(hero.width), Math.round(hero.height)],
    faceBox: f && [Math.round(r(f).left), Math.round(r(f).top), Math.round(r(f).width), Math.round(r(f).height)],
    namePx: n && parseFloat(getComputedStyle(n).fontSize), nameOverflow: n ? n.scrollWidth - n.clientWidth : null,
    overlap: { nameNum: hit(r(n), r(v)), chipsNum: hit(r(c), r(v)), eyebrowNum: hit(r(e), r(v)), squareName: !!f?.classList.contains('is-square') && (hit(r(f), r(n)) || hit(r(f), r(c)) || hit(r(f), r(e))) },
    hscroll: document.documentElement.scrollWidth > innerWidth,
  };
});
const go = async (v) => { if (await page.locator(`[data-act="go-tab"][data-v="${v}"]:visible`).count() === 0 && await page.locator('[data-act="dock-more"]:visible').count()) await act('dock-more'); await act('go-tab', `[data-v="${v}"]`); await dismiss(); };
async function fresh() {
  await page.goto(URL0);
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await page.waitForTimeout(300);
  await act('go', '[data-to="new"]');
}
async function started() {
  await page.waitForTimeout(800);
  for (const sel of ['[data-act="tips-off"]', '[data-act="opt-quick"][data-v="quick"]']) {
    await page.locator(`${sel}:visible`).first().click({ timeout: 1500 }).catch(() => null);
    await page.waitForTimeout(250);
    await dismiss();
  }
  await dismiss();
}
async function real(id) {
  await fresh();
  await act('form', '[data-k="mode"][data-v="real"]');
  await page.locator(`[data-act="form"][data-k="realId"][data-v="${id}"]`).first().click();
  await page.waitForTimeout(200);
  await act('start');
  await started();
}
async function custom() {
  await fresh();
  // C.74d: [전체 랜덤] → 결과에서 [이대로 시작] (내 가상 선수 = 기본 사진)
  await act('ng-random');
  await act('start');
  await started();
}
const report = { W, H, errors };
await fresh();
await page.locator('#f-seed').fill('m2');
await page.locator('#f-seed').dispatchEvent('change');
await act('form', '[data-k="mode"][data-v="real"]');
await act('form', '[data-k="legends"][data-v="on"]');
await act('ng-real', '[data-k="realTab"][data-v="legend"]');
if (process.env.SHOT_TOP) await shot('1_legend_top');
await page.locator('#f-rq').fill('이적');
await page.locator('#f-rq').dispatchEvent('change');
await page.waitForTimeout(400);
await shot('2_legend_abroad');
await page.locator('#f-rq').fill('안정환');
await page.locator('#f-rq').dispatchEvent('change');
await page.waitForTimeout(400);
await page.locator('[data-act="form"][data-k="realId"][data-v="lg-ahnjunghwan"]').first().click();
await page.waitForTimeout(300);
await page.evaluate(() => window.scrollTo(0, 0));
await shot('3_pick_ahn');
await act('start');
await started();
await go('world');
await act('world-tab', '[data-v="stars"]');
await page.evaluate(() => { const el = [...document.querySelectorAll('.wl-upcoming')].at(-1); if (el) el.scrollIntoView({ block: 'end' }); });
await shot('4_world_abroad');
report.abroadLine = await page.evaluate(() => [...document.querySelectorAll('.wl-upcoming')].map((e) => e.textContent));
report.hscroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
await browser.close();
