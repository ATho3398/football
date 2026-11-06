// 45b(b) 확인 캡처: 새 게임 시작 팀 고르기(전체 랜덤 · 커스텀) 리그 탭 → 팀 목록 · 고른 팀으로 시작 · 설정 다른 경기 계산 문구. 폰 390×844 기본 · PC 1280×800 (W H PREFIX)
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c76h-capture.mjs [playwright 모듈 경로] [저장 폴더]
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c76c-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c76h-check/', import.meta.url).pathname;
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
const fresh = async () => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await page.waitForTimeout(400);
};
const toPick = () => page.evaluate(() => document.querySelector('.tp')?.scrollIntoView({ block: 'start' }));
await fresh();
await act('go', '[data-to="new"]'); await page.waitForTimeout(300);
await act('ng-random'); await page.waitForTimeout(300);
await toPick();
await shot('01_전체랜덤-시작팀-PL');
await act('ng-pick-league', '[data-v="laliga"]'); await page.waitForTimeout(200); await toPick();
await shot('02_전체랜덤-라리가-팀목록');
await page.locator('.tp-row:not(.is-off):not(.tp-row--random)').nth(2).click(); await page.waitForTimeout(250); await toPick();
await shot('03_전체랜덤-팀고름');
await act('ng-pick-league', '[data-v="kleague1"]'); await page.waitForTimeout(200); await toPick();
await shot('04_전체랜덤-K리그-탭');
await act('start'); await page.waitForTimeout(1000);
for (const sel of ['[data-act="tips-off"]', '[data-act="opt-quick"][data-v="quick"]']) { await page.locator(`${sel}:visible`).first().click({ timeout: 1500 }).catch(() => null); await page.waitForTimeout(250); await dismiss(); }
await dismiss(); await top();
await shot('05_라리가팀-시작-홈');
// 커스텀 시작 단계: 19세 소속팀 선택 → 스탯에 맞는 팀만
await fresh();
await act('go', '[data-to="new"]'); await page.waitForTimeout(300);
await act('cu-step', '[data-v="6"]'); await page.waitForTimeout(300);
await act('cu', '[data-k="startKind"][data-v="youth"]').catch(() => null);
await page.waitForTimeout(200); await toPick();
await shot('06_커스텀-시작-리그탭');
await act('ng-pick-league', '[data-v="seriea"]'); await page.waitForTimeout(200); await toPick();
await shot('07_커스텀-세리에-팀목록');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors }, null, 1));
await browser.close();
