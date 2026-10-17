// 캘린더 확인 캡처 (부록 C.38): 새 게임 → 홈(날짜·[계속]·[하루 진행]·일정·달력) → [하루 진행] → [계속](경기 날까지, 다른 경기 워커 계산)
// → 경기 날 홈 → 내 경기(자동) → [계속] 진행 중 화면([중단]) → 득점 순위 → 남은 시즌 자동 + [중단] → 다시 남은 시즌 자동(시즌 끝까지, 시간 측정).
// 페이지 오류를 세고, 하루마다 걸린 시간(window.__progress)과 세이브 크기를 출력한다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c38-capture.mjs [playwright 모듈 경로] [저장 폴더]
// PC: W=1280 PREFIX=pc_ node scripts/c38-capture.mjs ...   시즌 끝까지 재지 않으려면 FULL=0
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c38-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
const FULL = process.env.FULL !== '0';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: W, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
const shot = async (name, full = false, wait = 0) => { if (wait) await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
const has = async (sel) => (await page.locator(sel).count()) > 0;
/** 새 기능 소개·첫 경기 안내·말풍선을 닫는다 */
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off', 'sim-rest-ok', 'rp-skip-ok'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}`).first().click(); };
/** 진행이 끝날 때까지 ([중단] 버튼이 1.5초 동안 계속 없으면) */
async function idle(timeout = 600_000) {
  const end = Date.now() + timeout;
  let quiet = 0;
  while (Date.now() < end && quiet < 15) {
    quiet = (await has('[data-act="sim-stop"]')) ? 0 : quiet + 1;
    await page.waitForTimeout(100);
  }
}
const heroDate = async () => (await page.locator('.po-hero, .hero').first().innerText()).replace(/\s+/g, ' ').slice(0, 80);
const saveKb = async () => page.evaluate(() => Math.round((localStorage.getItem('football-career:auto')?.length ?? 0) / 102.4) / 10);

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
console.log('hardwareConcurrency', await page.evaluate(() => navigator.hardwareConcurrency));
await act('go', '[data-to="new"]');
await page.fill('#f-seed', process.env.SEED ?? 'c38-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(200);
await act('start');
await page.waitForTimeout(500);
if (await has('[data-act="tips-off"]')) await act('tips-off');
if (await has('[data-act="intro-ok"]')) await act('intro-ok');
await shot('1_홈-날짜-계속-하루진행', false, 200);
await shot('2_홈-일정-달력', true, 100);
console.log('홈:', await heroDate());

// [하루 진행] (경기 날이 아니면)
if (await has('[data-act="day-one"]')) {
  await act('day-one');
  await idle();
  await shot('3_하루진행-뒤', false, 200);
  console.log('하루 뒤:', await heroDate());
}
// [계속] → 경기 날
if (await has('[data-act="day-continue"]')) {
  const t = Date.now();
  await act('day-continue');
  await idle();
  console.log('[계속] 응답', Date.now() - t, 'ms');
}
await shot('4_경기날-홈', false, 300);
console.log('경기 날:', await heroDate());

// 내 경기: 자동 모드로 바꾸고 시작 → 재생 → 결과
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');
const tp = Date.now();
await act('play');
await page.waitForSelector('[data-act="rp-skip"], [data-act="fm-close"], [data-act="rp-result"]', { timeout: 120_000 });
console.log('[경기 시작] → 재생 화면', Date.now() - tp, 'ms (그날 다른 경기 + 내 경기)');
await page.waitForTimeout(300);
if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
if (await has('[data-act="rp-skip"]')) { await act('rp-skip'); await act('rp-skip-ok'); }
await page.waitForTimeout(300);
await shot('5_내경기-결과', false, 200);
await page.locator('.po-hero__back').first().click();
await page.waitForTimeout(300);
if (await has('[data-act="tip-close"]')) await act('tip-close');

// [계속] 진행 중 화면 ([중단] 버튼)
const tc = Date.now();
await act('day-continue');
await page.waitForSelector('[data-act="sim-stop"]', { timeout: 10_000 }).catch(() => {});
await shot('6_진행중-중단버튼', false, 50);
await idle();
console.log('[계속] 응답 2', Date.now() - tc, 'ms', await heroDate());
await shot('7_다음경기날-홈', false, 200);

// 남은 시즌 자동 → 몇 날 뒤 [중단]
await act('sim-rest');
await act('sim-rest-ok');
await page.waitForTimeout(2500);
await shot('8_자동진행-중', false, 0);
await page.locator('[data-act="sim-stop"]').first().dispatchEvent('pointerdown').catch(() => {});
await shot('9_멈추는중', false, 50);
await idle();
await shot('10_중단-뒤-홈', false, 300);
console.log('중단 뒤:', await heroDate());

// 리그 득점 순위
await act('go-tab', '[data-v="world"]');
await page.waitForTimeout(200);
if (await has('[data-act="world-tab"][data-v="scorers"]')) await act('world-tab', '[data-v="scorers"]');
await shot('11_득점순위', true, 200);
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(200);

const report = { hardwareConcurrency: await page.evaluate(() => navigator.hardwareConcurrency), errors };
if (FULL) {
  await act('sim-rest');
  await act('sim-rest-ok');
  const t0 = Date.now();
  await idle(1_800_000);
  report.seasonRestSec = (Date.now() - t0) / 1000;
  await shot('12_시즌종료', false, 300);
  const log = await page.evaluate(() => globalThis.__progress);
  const matchDays = log.filter((d) => d.matches > 0);
  report.days = log.length;
  report.totalMs = log.reduce((t, d) => t + d.ms, 0);
  report.matches = log.reduce((t, d) => t + d.matches, 0);
  report.maxDayMs = Math.max(...log.map((d) => d.ms));
  report.avgMatchDayMs = Math.round(matchDays.reduce((t, d) => t + d.ms, 0) / Math.max(1, matchDays.length));
  report.saveKb = await saveKb();
  writeFileSync(`${OUT}/${P}measure.json`, JSON.stringify({ ...report, log }, null, 1));
}
report.saveKbNow = await saveKb();
console.log(JSON.stringify(report));
console.log('페이지 오류', errors.length);
await browser.close();
