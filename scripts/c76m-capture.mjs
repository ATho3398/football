// C.76m 확인 캡처: 바쁜 날 진행 표시(미리 계산) · 설정 전체 엔진/빠른 진행 · 월드 K리그1(8~5월) · 새 게임 리그 8월~5월.
// 세로 폰 390×844 기본 · PC 1280×800 (W H PREFIX). 세이브는 scripts/diag/c76m-saves.ts (SAVES 폴더)
// 실행: npm run build && npx vite preview --port 4173 & 그다음 SAVES=<폴더> node scripts/c76m-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c76m-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
page.setDefaultTimeout(10000);
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
const SAVES = process.env.SAVES;
const fresh = async () => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await page.waitForTimeout(400);
};
const load = async (file) => {
  await fresh();
  await act('go', '[data-to="saves"]');
  await page.waitForTimeout(300);
  await page.setInputFiles('#import-file', `${SAVES}/${file}`);
  await page.waitForTimeout(1500);
  await page.locator('[data-act="tips-off"]:visible').first().click({ timeout: 1500 }).catch(() => null);
  await dismiss(); await top();
};
const settingsPlay = async () => {
  await tab('settings');
  if (await has('[data-act="set-open"][data-v="play"]:visible')) await act('set-open', '[data-v="play"]');
  await page.waitForTimeout(300);
  await page.evaluate(() => { const el = [...document.querySelectorAll('main .kv')].find((e) => /다른 경기 계산/.test(e.textContent || '')); el?.scrollIntoView({ block: 'start' }); });
};

// 1. 바쁜 날 (14개 리그 93경기): 홈에서 몇 초 미리 계산 → [하루 진행] 진행 표시 "다른 경기 n/93 (미리 계산 k)"
if (want('progress')) {
  await load('c76m-14.fcsave.gz');
  await page.waitForTimeout(Number(process.env.IDLE ?? 6000));
  await act('day-one');
  await page.waitForFunction(() => /미리 계산/.test(document.body.textContent || ''), null, { timeout: 20000, polling: 50 }).catch(() => null);
  await shot('01_진행-다른경기-미리계산');
  await page.waitForFunction(() => (globalThis.__progress ?? []).length >= 1, null, { timeout: 300000 });
}
// 2·3. 설정: 전체 엔진(미리 계산 상태) · 빠른 진행
if (want('settings')) {
  await load('c76m-6.fcsave.gz');
  await page.waitForFunction(() => { const p = globalThis.__pool?.()?.planned; return p && p.total > 0 && p.ready >= p.total; }, null, { timeout: 120000, polling: 500 }).catch(() => null);
  await settingsPlay();
  await shot('02_설정-전체엔진-미리계산');
  await act('opt-quick', '[data-v="quick"]'); await page.waitForTimeout(300);
  await settingsPlay();
  await shot('03_설정-빠른진행');
}
// 4. 월드 K리그1 = 8월~5월, 같은 시즌
if (want('world')) {
  await load('c76m-14.fcsave.gz');
  await tab('world');
  await act('world-tab', '[data-v="table"]').catch(() => null); await page.waitForTimeout(300);
  await act('world-league', '[data-v="kleague1"]'); await page.waitForTimeout(300); await top();
  await shot('04_월드-K리그1-8월5월');
}
// 5. 새 게임 리그 고르기: 모든 리그 8월~5월
if (want('new')) {
  await fresh();
  await act('go', '[data-to="new"]'); await page.waitForTimeout(300);
  await act('ng-random'); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[data-act="ng-lg-open"]')?.click()); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[data-act="ng-leagues"][data-v="all"]')?.click()); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('[data-act="ng-league"][data-v="kleague1"]')?.scrollIntoView({ block: 'center' }));
  await shot('05_새게임-리그-8월5월');
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors }, null, 1));
await browser.close();
