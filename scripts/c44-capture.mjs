// 독·자동 진행·능력치 1~20·체력·시즌 종료 화면 확인 캡처 (부록 C.44): 실제 선수(손흥민, 토트넘 = 북런던·런던 더비)로 새 게임 →
// 홈(독·체력) → 선수(1~20 바둑판) → 훈련·일정(경기 다음 날 휴식 고정) → 자동 진행 시트(더비 목록) → 레이어 → 요약 → 포인트 찍기(1~20)
// → 더비 직전까지 자동 → 홈 더비 배지 → 시즌 끝까지 자동 → 시즌 종료 요약·상세 → 더보기.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c44-capture.mjs [playwright 모듈 경로] [저장 폴더]
// PC: W=1280 PREFIX=pc_ node scripts/c44-capture.mjs ...
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c44-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
const PC = W >= 1024;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, colorScheme: 'dark' });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
const shot = async (name, full = false, wait = 400) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
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
const scrollTo = async (sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'start' })); await page.waitForTimeout(150); };
const waitIdle = async (max = 240000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (!(await has('.auto-layer'))) return; await page.waitForTimeout(300); } };
const report = { errors, broken };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForTimeout(500);

await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', 'c44-check');
await act('start');
await dismiss();
await act('ctl-mode', '[data-v="auto"]');
await dockTab('schedule');
await act('opt-quick', '[data-v="quick"]');
await dockTab('home');
await page.evaluate(() => window.scrollTo(0, 0));
await shot('1_홈-독');
report.dock = await page.locator('.dock-bar .dock-btn').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent.trim()));
await scrollTo('.po-fatigue');
await page.evaluate(() => window.scrollBy(0, -120));
await shot('2_체력');

await dockTab('player');
await dismiss();
await page.evaluate(() => window.scrollTo(0, 0));
await scrollTo('.ag');
await page.evaluate(() => window.scrollBy(0, -60));
await shot('3_선수-능력치1-20');

await dockTab('schedule');
await dismiss();
await page.evaluate(() => window.scrollTo(0, 0));
await shot('4_훈련일정-휴식고정');
report.week = await page.locator('.tr-week .ag-cell').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));

// 자동 진행 시트
await dockTab('home');
await act('sim-rest');
await shot('5_자동진행-시트');
report.autoTargets = await page.locator('.po-sheet .po-option').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
await act('auto-count', '[data-v="3"]');
await act('auto-run');
await page.waitForSelector('.auto-layer', { timeout: 5000 });
await page.waitForTimeout(900);
await shot('6_자동진행-레이어', false, 0);
await waitIdle();
await shot('7_자동진행-끝요약', false, 200);
report.auto = await page.evaluate(() => globalThis.__auto);
// 경기 뒤 체력
await dismiss();
await scrollTo('.po-fatigue');
await page.evaluate(() => window.scrollBy(0, -120));
await shot('2b_체력-경기뒤');
report.stamina = await page.locator('.po-fatigue').first().getAttribute('aria-valuenow');
// 경기 다음 날 = 휴식 고정 (주간 계획)
await dismiss();
await dockTab('schedule');
await dismiss();
await page.evaluate(() => window.scrollTo(0, 0));
await shot('4b_훈련일정-경기다음날휴식');
report.weekAfter = await page.locator('.tr-week .ag-cell').evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));

// 다음 더비 직전까지
await dockTab('home');
await act('sim-rest');
if (await has('[data-act="auto-until"]')) {
  await act('auto-until');
  await waitIdle();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('9_더비직전-홈배지');
  report.derbyBadge = await page.locator('.derby-badge').allTextContents();
} else {
  await act('sheet-close');
}

// 더보기 (모바일) / PC 는 독에 전부
if (!PC) {
  await act('dock-more');
  await shot('10_더보기');
  await act('sheet-close');
}

// 시즌 끝까지
await dockTab('home');
await act('sim-rest');
await act('auto-count', `[data-v]:last-child`);
await act('auto-run');
await waitIdle(600000);
await page.waitForTimeout(800);
await dismiss();
// 이적 제안이 오면 거절하고 진행
for (let k = 0; k < 3 && (await has('.screen-offers, .screen-contract')); k++) {
  if (await has('[data-act="offers-decline"]')) await act('offers-decline');
  if (await has('[data-act="renew"]')) await act('renew');
  await dockTab('home');
  await act('sim-rest');
  await act('auto-count', `[data-v]:last-child`);
  await act('auto-run');
  await waitIdle(600000);
}
await page.evaluate(() => window.scrollTo(0, 0));
await shot('11_시즌종료-요약');
if (await has('[data-act="season-tab"][data-v="matches"]')) {
  await act('season-tab', '[data-v="matches"]');
  await scrollTo('.season-detail');
  await shot('12_상세-경기별');
  for (const [t, n] of [['months', '13_상세-월별'], ['positions', '14_상세-포지션별'], ['awards', '15_상세-리그시상'], ['transfers', '16_상세-이적소식'], ['growth', '17_상세-성장위상']]) {
    await page.locator(`.season-detail [data-act="season-tab"][data-v="${t}"]`).first().click();
    await page.waitForTimeout(250);
    await scrollTo('.season-detail');
    await shot(n);
  }
}
// 포인트 찍기 (1~20)
await dismiss();
await page.evaluate(() => window.scrollTo(0, 0));
if (await has('[data-act="go"][data-to="allocate"]')) {
  await act('go', '[data-to="allocate"]');
  await dismiss();
  const cell = page.locator('.ag-cell.is-key.is-edit').first();
  await cell.click();
  await page.waitForTimeout(200);
  await page.locator('.ag-cell.is-sel [data-act="raise"]').click();
  await page.waitForTimeout(200);
  await scrollTo('.ag');
  await page.evaluate(() => window.scrollBy(0, -160));
  await shot('8_포인트찍기-1-20');
  await act('alloc-done');
  await page.waitForTimeout(300);
} else report.noPoints = true;

report.final = await page.evaluate(() => { const g = globalThis.__game(); return g && { phase: g.phase, round: g.league.round, level: g.player.level }; });
report.autoAll = await page.evaluate(() => globalThis.__auto);
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
