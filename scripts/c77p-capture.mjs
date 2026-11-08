// C.77p 골 연출 확인 캡처: 자동 모드 내 경기 → 결과 → [하이라이트 다시보기] 4× 재생 중 우리 골 GOAL! 3프레임(140·700·1400ms, 애니메이션 시점 고정)
// + 실점 골(연출 없음) 1장 + 설정 '골 연출' 줄 1장. 폰 390×844 · PC 1280×800 (W H). 가로 넘침(scrollWidth - innerWidth)도 적는다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 W=390 H=844 node scripts/c77p-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c77p-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const phone = W < 1024;
const P = process.env.PREFIX ?? (phone ? '폰_' : 'PC_');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    if (await has('[data-act="tips-off"]:visible')) await page.locator('[data-act="tips-off"]:visible').first().click();
    else if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); await page.waitForTimeout(250); };
const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const report = { W, H, errors, shots: {} };
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${P}${name}.png` }); report.shots[name] = { wide: await wide() }; console.log('saved', name, JSON.stringify(report.shots[name])); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForTimeout(500);
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]:visible'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', process.env.SEED ?? 'c77p');
await act('start');
await page.waitForTimeout(800);
await dismiss();
if (!process.env.SET_ONLY) {
for (let k = 0; k < 8 && !(await has('[data-act="play"]:visible')); k++) {
  if (await has('[data-act="day-continue"]:visible')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
for (let k = 0; k < 120 && (await has('[data-act="sim-stop"]:visible')); k++) await page.waitForTimeout(500);
if (await has('[data-act="ctl-mode"][data-v="auto"]:visible')) await act('ctl-mode', '[data-v="auto"]');
await act('play');
for (let k = 0; k < 240 && !(await has('main.screen-match')); k++) {
  if (await has('[data-act="prep-start"]:visible')) await act('prep-start');
  await page.waitForTimeout(500);
}
await page.waitForSelector('main.screen-match', { timeout: 180_000 });
await page.waitForTimeout(800);
await dismiss();

// 골 감시: 연출 층이 붙는 순간 붙잡아 두고(자동 닫힘 뒤에도 다시 붙임), 점수가 바뀌었는데 층이 없으면 실점으로 기록
await page.evaluate(() => {
  const w = window;
  w.__gs = null; w.__concede = 0; w.__goals = 0;
  new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('gs-layer')) w.__goals++;
    for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('gs-layer') && !w.__gs && !w.__done) { w.__gs = n; document.querySelector('[data-act="rp-toggle"]')?.click(); }
  }).observe(document.body, { childList: true });
  let last = '';
  setInterval(() => {
    const s = `${document.getElementById('rp-h')?.textContent}:${document.getElementById('rp-a')?.textContent}`;
    if (last && s !== last && !document.querySelector('.gs-layer')) setTimeout(() => { if (!document.querySelector('.gs-layer')) w.__concede++; }, 80);
    last = s;
  }, 30);
});
await page.evaluate(() => document.querySelector('[data-act="hl-rewatch"]')?.click());
await page.waitForSelector('#rp-canvas', { timeout: 30_000 });
await page.waitForTimeout(800);
await dismiss();
for (let k = 0; k < 3; k++) if (!(await has('.po-speed__btn'))) break;
// 4× 로
for (let k = 0; k < 3 && !(await page.evaluate(() => document.body.textContent.includes('실제 속도 4×'))); k++) await page.evaluate(() => document.querySelector('[data-act="rp-speed"]')?.click());
let concShot = false;
for (let k = 0; k < 600; k++) {
  const st = await page.evaluate(() => ({ g: !!window.__gs, c: window.__concede, end: !document.getElementById('rp-canvas') }));
  if (st.c > 0 && !concShot) { await shot('실점_연출없음'); concShot = true; }
  if (st.g || st.end) break;
  await page.waitForTimeout(100);
}
if (await page.evaluate(() => !!window.__gs)) {
  for (const t of [140, 700, 1400]) {
    await page.evaluate((t) => {
      const el = window.__gs;
      if (!el.isConnected) document.body.append(el);
      for (const a of el.getAnimations({ subtree: true })) { a.pause(); a.currentTime = t; }
    }, t);
    await page.waitForTimeout(120);
    await shot(`골_${t}ms`);
  }
  await page.evaluate(() => { window.__gs.remove(); window.__gs = null; window.__done = true; window.__concede = 0; document.querySelector('[data-act="rp-toggle"]')?.click(); });
  // 실점 장면을 아직 못 찍었으면 이어서 기다린다
  for (let k = 0; k < 900 && !concShot; k++) {
    const st = await page.evaluate(() => ({ c: window.__concede, end: !document.getElementById('rp-canvas') }));
    if (st.c > 0) { await shot('실점_연출없음'); concShot = true; }
    if (st.end) break;
    await page.waitForTimeout(100);
  }
} else console.log('no goal splash seen');
report.goals = await page.evaluate(() => window.__goals);
}

// 설정 '골 연출' 줄
await page.evaluate(() => document.querySelector('[data-act="rp-skip"]')?.click());
await page.waitForTimeout(500);
await page.evaluate(() => { const b = document.querySelector('[data-act="go"][data-to="settings"], [data-act="go-tab"][data-v="settings"]'); if (b) b.click(); });
await page.waitForTimeout(500);
if (!(await has('[data-act="goal-splash-set"]:visible'))) await page.evaluate(() => document.querySelector('[data-act="set-nav"][data-v="look"], [data-act="set-toggle"][data-v="look"], [data-act="set-open"][data-v="look"]')?.click());
await page.waitForTimeout(400);
await page.evaluate(() => { const t = [...document.querySelectorAll('[data-act="goal-splash-set"]')].find((x) => x.offsetParent); t?.scrollIntoView({ block: 'center' }); });
await page.waitForTimeout(300);
await shot('설정_골연출');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report));
await browser.close();
