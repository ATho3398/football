// C.66 확인 캡처: 가로 폰(기본 844×340 = 844×390 에서 브라우저 막대 뺀 높이) 주요 화면 · 세로 안내 · PC 회귀.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c66-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b) ONLY(home,moment …)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c66-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 844);
const H = Number(process.env.H ?? 340);
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
  if (await has('#rotate-gate:visible')) { await shot('세로-안내'); return false; }
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
  if (shotNew) { await top(); await shot('새게임'); }
  await act('start');
  await page.waitForTimeout(800);
  if (await has('[data-act="tips-off"]')) await act('tips-off');
  await dismiss();
  return true;
};

if (await start('real', 'son', 'c66-check', want('new'))) {
  if (want('home')) {
    await tab('home'); await shot('홈');
    if (await has('[data-act="dock-more"]:visible')) {
      await act('dock-more'); await page.waitForTimeout(300); await shot('더보기-펼침');
      await page.mouse.click(W - 40, H - 40); await page.waitForTimeout(300);
    }
    await tab('player'); await page.waitForTimeout(2600); await shot('선수');
    await tab('schedule'); await shot('훈련일정');
    await tab('world'); await shot('월드');
    await tab('settings'); await shot('설정');
  }
  if (want('moment')) {
    await tab('home');
    for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
      if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
    }
    await act('play');
    await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
    await page.waitForTimeout(300);
    await dismiss();
    if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
    await top(); await shot('경기준비');
    await act('prep-start');
    let shots = 0;
    for (let n = 0; n < 40; n++) {
      await page.waitForSelector('[data-act="mo-confirm"], [data-act="oc-skip"], main.screen-match', { timeout: 180_000 });
      if (await page.evaluate(() => !!document.querySelector('main.screen-match'))) break;
      await page.waitForTimeout(1600);
      await dismiss();
      if (!(await has('[data-act="mo-confirm"]'))) { if (await has('[data-act="oc-skip"]')) await act('oc-skip'); await page.waitForTimeout(300); continue; }
      if (await has('.mo-react')) { if (!shots) await shot('카드장면'); await act('mo-pick-confirm', '[data-v="0"]'); continue; }
      if (shots === 0) {
        await top(); await shot('결정순간');
        report.moment = await page.evaluate(() => {
          const st = document.querySelector('.mo-stage')?.getBoundingClientRect();
          const cv = document.querySelector('#mo-canvas')?.getBoundingClientRect();
          const conf = document.querySelector('[data-act="mo-confirm"]')?.getBoundingClientRect();
          return { stage: st && [Math.round(st.width), Math.round(st.height)], canvas: cv && [Math.round(cv.width), Math.round(cv.height)], gapBelow: st && cv ? Math.round(st.bottom - cv.bottom) : null, confirmBottom: conf && Math.round(conf.bottom), vh: innerHeight, cards: document.querySelectorAll('.mo-cards .po-card').length };
        });
        if (await has('.mo-cards .po-card:not(.is-disabled)')) { await page.locator('.mo-cards .po-card:not(.is-disabled)').first().click(); await page.waitForTimeout(250); }
        await act('mo-pick', '[data-v="0"]'); await page.waitForTimeout(250); await shot('결정순간-고름');
        await act('mo-confirm'); await page.waitForTimeout(900); await shot('결정결과');
        if (process.env.QUICK) break;
        await act('mo-auto').catch(() => {});
        shots++;
        continue;
      }
      await act('mo-delegate');
    }
    await page.waitForSelector('main.screen-match', { timeout: 240_000 }).catch(() => {});
    await page.waitForTimeout(500); await dismiss(); await top(); await shot('경기결과');
    await act('pv-open').catch(() => {});
    if (await has('.po-sheet')) await shot('시트');
  }
  if (process.env.SEASON) {
    // 시즌 요약: 남은 시즌을 자동 진행으로 끝까지 (오래 걸림)
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => { const g = window.__game(); g.market.contract.until = g.league.season; });
    await tab('home');
    await act('sim-rest'); await page.waitForTimeout(300);
    await act('auto-count', '[data-v]:last-child');
    await act('auto-run');
    { const t0 = Date.now(); await page.waitForTimeout(1000); while (Date.now() - t0 < 1500000 && (await has('.auto-layer'))) await page.waitForTimeout(500); }
    await page.waitForTimeout(800); await dismiss();
    await tab('home');
    if (await has('[data-act="go"][data-to="season"]')) await act('go', '[data-to="season"]');
    else if (await has('[data-act="go-tab"][data-v="season"]')) await act('go-tab', '[data-v="season"]');
    await page.waitForTimeout(600); await dismiss(); await top(); await shot('시즌요약');
  }
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
