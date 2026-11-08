// C.81f 확인 캡처 (미페 머리 잘림): 가상 선수(기본 사진) · 손흥민(페이스팩) 홈 머리말 + 선수 화면, 그리고 사진 없음(SQUARE=1: 네모 사진 강제).
// 머리 윗부분(사진의 첫 불투명 줄)이 도구 줄 아래로 내려왔는지, 다음 경기 카드가 첫 화면에 보이는지 잰다.
// 실행: npx vite --port 5173 & 그다음 W=390 H=844 PREFIX=after_390_ node scripts/c81f-capture.mjs [playwright] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/captures/c81f/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
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
const act = async (a, extra = '') => { await dismiss(); return page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); };
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const tab = async (v) => {
  await page.evaluate((x) => document.querySelector(`[data-act="go-tab"][data-v="${x}"]`)?.click(), v);
  await page.waitForTimeout(600); await dismiss(); await top();
};
const start = async (mode, id, seed) => {
  await page.goto(process.env.URL ?? 'http://localhost:5173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await act('go', '[data-to="new"]');
  await page.waitForTimeout(300);
  if (await has('#f-seed')) { await page.fill('#f-seed', seed); await page.locator('#f-seed').dispatchEvent('change'); }
  if (mode === 'real') {
    await act('form', '[data-k="mode"][data-v="real"]');
    await page.waitForTimeout(300);
    if (!(await has(`[data-act="form"][data-k="realId"][data-v="${id}"]`))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
    await page.locator(`[data-act="form"][data-k="realId"][data-v="${id}"]`).first().click();
  }
  else { await act('ng-random'); await page.waitForTimeout(400); }
  await page.waitForTimeout(200);
  await act('start');
  await page.waitForTimeout(800);
  for (const sel of ['[data-act="tips-off"]', '[data-act="opt-quick"][data-v="quick"]']) {
    await page.locator(`${sel}:visible`).first().click({ timeout: 1500 }).catch(() => null);
    await page.waitForTimeout(250);
    await dismiss();
  }
  await dismiss();
};
// 사진 첫 불투명 줄(머리 끝) 화면 y · 도구 줄 아래 y · 머리말 아래 y · 첫 화면 아래(독 위) y
const measure = () => page.evaluate(() => {
  const hero = document.querySelector('.po-hero--face');
  if (!hero) return { face: false };
  const img = hero.querySelector('.po-hero__face');
  const bar = hero.querySelector('.po-hero__bar');
  const ir = img.getBoundingClientRect(); const br = bar.getBoundingClientRect(); const hr = hero.getBoundingClientRect();
  const cs = getComputedStyle(img);
  let headY = null;
  try {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let row = -1;
    for (let y = 0; y < c.height && row < 0; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 40) { row = y; break; }
    // object-fit contain/cover 를 콘텐츠 상자 안에서 계산
    const pt = parseFloat(cs.paddingTop), pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), pb = parseFloat(cs.paddingBottom);
    const cw = ir.width - pl - pr, ch = ir.height - pt - pb;
    const fit = cs.objectFit;
    const s = fit === 'cover' ? Math.max(cw / c.width, ch / c.height) : Math.min(cw / c.width, ch / c.height);
    const dh = c.height * s;
    const posY = cs.objectPosition.split(' ')[1] ?? '50%';
    const frac = posY === 'bottom' || posY === '100%' ? 1 : posY === 'top' || posY === '0%' || posY === '0px' ? 0 : parseFloat(posY) / 100;
    const oy = ir.top + pt + (ch - dh) * frac;
    headY = Math.round(Math.max(oy + row * s, ir.top + pt));
    if (fit === 'cover' && row * s + oy < ir.top + pt) headY = Math.round(ir.top + pt); // cover 로 잘리면 상자 위
  } catch (e) { headY = 'err:' + e.message; }
  const dock = [...document.querySelectorAll('.dock-bar, nav')].map((n) => n.getBoundingClientRect()).filter((r) => r.height > 0 && r.top > innerHeight / 2)[0];
  const fold = dock ? dock.top : innerHeight;
  const next = document.querySelector('.hm-next, .po-match, [class*="next"]');
  const nr = next ? next.getBoundingClientRect() : null;
  return { cutout: !img.classList.contains('is-square'), barBottom: Math.round(br.bottom), imgTop: Math.round(ir.top), headY, headGap: typeof headY === 'number' ? Math.round(headY - br.bottom) : null, heroH: Math.round(hr.height), fold: Math.round(fold), next: nr ? { cls: next.className, top: Math.round(nr.top), visiblePx: Math.round(Math.max(0, fold - nr.top)) } : null };
});
const report = { W, H, errors, screens: {} };
const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${P}${name}.png` });
  report.screens[name] = await measure();
  console.log(name, JSON.stringify(report.screens[name]));
};
await start('custom', '', 'c81f');
await tab('home'); await shot('01_가상-홈');
await tab('player'); await shot('02_가상-선수');
await start('real', 'son', 'c81f-son');
await tab('home'); await shot('03_손흥민-홈');
await tab('player'); await shot('04_손흥민-선수');
// 네모 사진(배경 있는 사진) 경우: 손흥민 사진을 네모로 강제
await page.evaluate(() => { for (const i of document.querySelectorAll('.po-hero--face .po-hero__face')) i.classList.add('is-square'); document.querySelector('.po-hero--face')?.classList.add('is-square', 'po-hero--photo'); });
await shot('05_네모사진-선수');
await tab('home');
await page.evaluate(() => { for (const i of document.querySelectorAll('.po-hero--face .po-hero__face')) i.classList.add('is-square'); document.querySelector('.po-hero--face')?.classList.add('is-square', 'po-hero--photo'); });
await shot('06_네모사진-홈');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log('errors', errors.length, errors.slice(0, 3));
await browser.close();
