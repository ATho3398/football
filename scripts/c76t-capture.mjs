// C.76t 확인 캡처 (47b 리그 · 시즌 중 상): 손흥민 시즌 끝 → 시상 PL 부문(PFA · FWA · 영플레이어) → 올해의 팀 → 시상식 3단계 → 이달의 선수 탭 → 다음 시즌 홈 발롱도르 레이스 칩 → 역대 수상자. 폰 390×844 · PC 1280×800 (W H PREFIX).
// 실행: npx vite --port 5173 & 그다음 URL=http://localhost:5173/ node scripts/c76t-capture.mjs [playwright 모듈 경로] [저장 폴더] (개발 서버: 페이지 안에서 /src 모듈을 불러 상태를 진행)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c76t-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const has = async (sel) => (await page.locator(sel).count()) > 0;
// 가로 넘침 · 레일에 가려진 버튼 · 화면 밖 버튼(세로는 스크롤로 닿으면 됨) 검사
const check = () => page.evaluate(() => {
  const vw = innerWidth;
  const rail = [...document.querySelectorAll('.dock-bar')].find((x) => x.offsetParent || getComputedStyle(x).position === 'fixed');
  const rr = rail && getComputedStyle(rail).display !== 'none' ? rail.getBoundingClientRect() : null;
  const hidden = [];
  for (const b of document.querySelectorAll('main button, main [data-act], .po-overlay button')) {
    if (!b.offsetParent) continue;
    const r = b.getBoundingClientRect();
    if (r.width === 0) continue;
    const off = r.right > vw + 1 && !b.closest('[class*="scroll"], .mo-cards, .gc-pick, .po-tabs, .tabs, .chips, .px-tiles, .ca-row, [style*="overflow"]');
    let under = false;
    if (rr && rr.right > 0 && !b.closest('.dock-bar') && r.left < rr.right - 1 && r.right > rr.left) {
      const el = document.elementFromPoint(Math.max(r.left + 2, 0), r.top + r.height / 2);
      under = !!el && !!el.closest('.dock-bar');
    }
    if (off || under) hidden.push(`${off ? 'off' : 'rail'}:${(b.textContent || b.getAttribute('aria-label') || b.dataset.act || '').trim().slice(0, 20)}`);
  }
  return { wide: document.documentElement.scrollWidth - vw, hidden: hidden.slice(0, 8) };
});
const report = { W, H, errors, screens: {} };
const shot = async (name) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${P}${name}.png` });
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
const tab = async (v) => {
  if (!(await has(`[data-act="go-tab"][data-v="${v}"]:visible`)) && (await has('[data-act="dock-more"]:visible'))) { await act('dock-more'); await page.waitForTimeout(200); }
  if (!(await has(`[data-act="go-tab"][data-v="${v}"]:visible`))) { await page.evaluate((x) => document.querySelector(`[data-act="go-tab"][data-v="${x}"]`)?.click(), v); } else await act('go-tab', `[data-v="${v}"]`); await page.waitForTimeout(400); await dismiss(); await top(); };
const SKIN = process.env.SKIN ?? 'b';
const start = async (mode, id, seed, shotNew = false) => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  if (SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
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
  await page.waitForTimeout(200);
  if (shotNew) { await top(); await shot('새게임'); }
  await act('start');
  await page.waitForTimeout(800);
  for (const sel of ['[data-act="tips-off"]', '[data-act="opt-quick"][data-v="quick"]']) {
    await page.locator(`${sel}:visible`).first().click({ timeout: 1500 }).catch(() => null);
    await page.waitForTimeout(250);
    await dismiss();
  }
  await dismiss();
  return true;
};



const info = () => page.evaluate(() => ({
  opts: [...document.querySelectorAll('.mo-opts .po-choice')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50)),
  hand: [...document.querySelectorAll('.mo-cards [data-act="mo-card"]')].map((c) => ({ v: c.getAttribute('data-v'), t: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30), off: c.matches('.is-disabled, [aria-disabled="true"]') })),
}));
const toPrep = async () => {
  await tab('home');
  for (let k = 0; k < 10 && !(await has('[data-act="play"]')); k++) {
    if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); } else break;
  }
  await act('play');
  await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
  await page.waitForTimeout(300); await dismiss();
};
const waitEnd = async (direct) => {
  for (let loop = 0; loop < 120; loop++) {
    await page.waitForSelector('[data-act="mo-confirm"], [data-act="oc-skip"], main.screen-match', { timeout: 180_000 });
    if (await page.evaluate(() => !!document.querySelector('main.screen-match'))) return;
    await page.waitForTimeout(1200);
    await dismiss();
    if (!(await has('[data-act="mo-confirm"]'))) { if (await has('[data-act="oc-skip"]')) await act('oc-skip'); await page.waitForTimeout(300); continue; }
    if (await has('.mo-react')) { await act('mo-pick-confirm', '[data-v="0"]'); continue; }
    await direct();
  }
};

const go = async (to) => { await page.evaluate((t) => { const b = document.createElement('button'); b.dataset.act = 'go'; b.dataset.to = t; document.querySelector('main')?.appendChild(b); b.click(); }, to); await page.waitForTimeout(500); await dismiss(); await top(); };
const until = (date) => page.evaluate(async (d) => {
  const G = await import('/src/game.ts');
  const C = await import('/src/calendar.ts');
  const g = window.__game();
  let k = 0;
  while (k++ < 4000) {
    if (g.phase === 'offseason') { G.autoMarket(g, 'stay'); G.startNextSeason(g); continue; }
    if (g.phase !== 'season' || C.daysBetween(g.calendar.date, d) <= 0) break;
    g.player.injury = null;
    if (G.isMatchDay(g)) G.playRound(g, { engine: 'quick' }); else { G.playOthers(g, 'quick'); G.endDay(g); }
  }
}, date);
if (await start('real', 'son', process.env.SEED ?? 'c76t-check')) {
  await page.evaluate(async () => {
    const G = await import('/src/game.ts');
    const g = window.__game();
    let k = 0;
    while (g.phase === 'season' && k++ < 400) { g.player.injury = null; G.playRound(g, { engine: 'quick' }); }
  });
  await go('awards');
  await act('aw-group', '[data-v="pl"]'); await page.waitForTimeout(300); await top();
  if (want('01')) await shot('01_시상-PL부문');
  await page.evaluate(() => { const h = [...document.querySelectorAll('.aw-body .po-section__title')].find((x) => /올해의 팀/.test(x.textContent || '')); h?.scrollIntoView({ block: 'start' }); });
  if (want('02')) await shot('02_시상-PFA올해의팀');
  await act('aw-cer', '[data-v="pfa@pl"]'); await page.waitForTimeout(300); await top();
  if (want('03')) await shot('03_시상식-후보');
  await act('aw-cer-step'); await page.waitForTimeout(300); await top();
  if (want('04')) await shot('04_시상식-최종3인');
  await act('aw-cer-step'); await page.waitForTimeout(300); await top();
  if (want('05')) await shot('05_시상식-발표');
  await act('aw-tab', '[data-v="month"]'); await page.waitForTimeout(300); await top();
  if (want('06')) await shot('06_이달의선수');
  await until('2019-11-05');
  await go('home');
  if (want('07')) await shot('07_홈-발롱도르레이스칩');
  await until('2019-12-20');
  await go('awards');
  await page.evaluate(() => { const h = [...document.querySelectorAll('.aw-body .po-section__title')].find((x) => /FIFPRO/.test(x.textContent || '')); h?.scrollIntoView({ block: 'start' }); });
  if (want('08')) await shot('08_시상-FIFPRO월드11');
  await act('aw-tab', '[data-v="history"]'); await page.waitForTimeout(300);
  await act('aw-hist', '[data-v="pfa@pl"]'); await page.waitForTimeout(300); await top();
  if (want('09')) await shot('09_역대수상자-PFA');
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log('errors', errors);
await browser.close();
