// C.73b 실제 앱 확인 (22.2 · 22.3 · 18.11): 새 게임 보너스 배너 → 자동 진행 시트(설정 · [시즌 요약으로 바로 이동]) → 진행 레이어
// → 멈춤(선택 이벤트 · 부상 · 이적 제안)마다 다시 [시즌 요약으로 바로 이동] → 시즌 요약 하이라이트 3. 자동 진행 계산 시간(__auto)을 잰다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c73b-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c73b-check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
const shot = async (name, full = false, wait = 400) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('saved', name); };
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    if (await has('[data-act="tips-off"]')) await page.locator('[data-act="tips-off"]').first().click();
    else if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}`).first().click(); await page.waitForTimeout(250); };
const dockTab = async (v) => { await dismiss(); await page.locator(`.dock-bar [data-act="go-tab"][data-v="${v}"]`).first().click(); await page.waitForTimeout(250); };
const waitIdle = async (max = 1800000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (!(await has('.auto-layer'))) return; await page.waitForTimeout(500); } };
const report = { errors, stops: [] };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
// 명예의 전당 보너스가 예약된 상태 (이전 커리어가 레전드 배지로 은퇴)
await page.evaluate(() => localStorage.setItem('po-legacy', JSON.stringify({ hall: [], bonus: { key: 'x', rarity: 'rare', from: '이전 커리어', legend: true }, done: ['x'] })));
await page.reload();
await page.waitForTimeout(500);

await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
await page.locator('.ng-pack').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await shot('1_새게임-보너스배너');
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', 'c73b-check');
await act('start');
await page.waitForTimeout(300);
report.startToast = await page.locator('.po-toast').first().textContent().catch(() => null);
report.picks = await page.evaluate(() => null);
await dismiss();
await act('ctl-mode', '[data-v="auto"]');
await dockTab('home');
await act('sim-rest');
await shot('2_자동진행-시트', true);
await page.locator('.auto-prefs').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await shot('3_자동진행-시트-설정');
const wall0 = Date.now();
await act('auto-end');
await page.waitForTimeout(4000);
await shot('4_자동진행-레이어');
let screen = '';
for (let k = 0; k < 60; k++) {
  await waitIdle();
  await page.waitForTimeout(400);
  const toast = await page.locator('.po-toast b').first().textContent().catch(() => '');
  screen = await page.evaluate(() => document.querySelector('main')?.className ?? '');
  report.stops.push({ toast, screen });
  console.log('stop', toast, screen);
  if (/screen-season|screen-chapter/.test(screen)) break;
  if (k < 3 && /멈췄어요/.test(toast ?? '')) await shot(`5_멈춤-${k + 1}`);
  // 이적 제안·재계약: 모두 거절하고 남기
  if (/screen-offers/.test(screen) || (await has('[data-act="offers-decline"]'))) { await act('offers-decline'); await dockTab('home'); }
  else if (/screen-contract/.test(screen)) { await act('renew').catch(() => {}); await dockTab('home'); }
  else if (!/screen-home/.test(screen)) await dockTab('home');
  await act('sim-rest');
  await act('auto-end');
}
report.wallMs = Date.now() - wall0;
report.auto = await page.evaluate(() => globalThis.__auto);
await shot('6_시즌요약', true);
if (await has('.season-hls')) {
  await page.locator('.season-hls').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await shot('7_시즌요약-하이라이트3');
}
report.hl = await page.locator('.season-hl').allTextContents();
report.wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
writeFileSync(`${OUT}/app-report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors, wallMs: report.wallMs, stops: report.stops.length, hl: report.hl }));
await browser.close();
