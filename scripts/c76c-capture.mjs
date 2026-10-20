// C.76c 확인 캡처 (45b 타리그 연결): 새 게임 내 리그로 · 실제 선수 리그 표시 · K리그1 시작 홈 · 라리가(메시) 시작 홈 · 월드 리그 탭(MLS 컨퍼런스·라리가 득점) · 이적 소식 다른 리그 선수 · 도감 새 번호.
// 세로 폰 390×844 기본 · PC 1280×800 (W H PREFIX). 세이브는 scripts/diag/c76c-saves.ts 로 만든다 (SAVES 폴더)
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c76c-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c76c-check/', import.meta.url).pathname;
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
const SAVES = process.env.SAVES;
const fresh = async () => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await page.waitForTimeout(400);
};
const afterStart = async () => {
  await page.waitForTimeout(800);
  for (const sel of ['[data-act="tips-off"]', '[data-act="opt-quick"][data-v="quick"]']) {
    await page.locator(`${sel}:visible`).first().click({ timeout: 1500 }).catch(() => null);
    await page.waitForTimeout(250);
    await dismiss();
  }
  await dismiss(); await top();
};
const load = async (file) => {
  await fresh();
  await act('go', '[data-to="saves"]');
  await page.waitForTimeout(300);
  await page.setInputFiles('#import-file', `${SAVES}/${file}`);
  await page.waitForTimeout(1500);
  await afterStart();
};
const toLeagues = () => page.evaluate(() => document.querySelector('.ng-lg__sum')?.scrollIntoView({ block: 'start' }));

// 1. 새 게임: 리그 펼침 → 전부 → 라리가 내 리그로
await fresh();
await act('go', '[data-to="new"]');
await page.waitForTimeout(300);
await act('ng-random').catch(() => null);
await page.waitForTimeout(300);
await act('ng-lg-open'); await act('ng-leagues', '[data-v="all"]'); await act('ng-league-mine', '[data-v="kleague1"]');
await page.waitForTimeout(200); await toLeagues();
await shot('01_새게임-내리그로-K리그');
// 2. K리그1 에서 시작 → 홈
await act('start');
await afterStart();
await shot('02_K리그1-시작-홈');
// 3. 실제 선수 목록 (리그 표시)
await fresh();
await act('go', '[data-to="new"]'); await page.waitForTimeout(300);
await act('form', '[data-k="mode"][data-v="real"]'); await page.waitForTimeout(400);
await act('ng-lg-open'); await act('ng-leagues', '[data-v="all"]'); await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('.real-list')?.scrollIntoView({ block: 'start' }));
await shot('03_실제선수-리그표시');
// 4. 메시(라리가) 시작 홈
await load('c76c-b.fcsave.gz');
await shot('04_라리가-메시-시작-홈');
// 5~8. PL + 다른 리그 4개, 2월
await load('c76c-a.fcsave.gz');
await tab('world');
await act('world-tab', '[data-v="table"]'); await page.waitForTimeout(300); await top();
await shot('05_월드-순위-리그탭');
await act('world-league', '[data-v="mls"]'); await page.waitForTimeout(300); await top();
await shot('06_월드-MLS-컨퍼런스');
await act('world-tab', '[data-v="scorers"]'); await act('world-league', '[data-v="laliga"]'); await page.waitForTimeout(300); await top();
await shot('07_월드-라리가-득점');
await act('world-tab', '[data-v="transfers"]'); await page.waitForTimeout(300);
await page.evaluate(() => { const el = [...document.querySelectorAll('main *')].find((e) => /실제 선수\)/.test(e.textContent || '') && e.children.length < 6); el?.scrollIntoView({ block: 'center' }); });
await shot('08_이적소식-다른리그-실제선수');
await tab('home');
await page.evaluate(() => document.querySelector('main [data-act="go"][data-to="dex"]')?.click());
await page.waitForTimeout(600);
await page.evaluate(() => { const el = [...document.querySelectorAll('main *')].find((e) => /No\.239\b/.test(e.textContent || '') && e.children.length < 4); el?.scrollIntoView({ block: 'center' }); });
await shot('09_도감-새번호');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors }, null, 1));
await browser.close();
