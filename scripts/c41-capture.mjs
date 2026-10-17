// 훈련·휴가·세이브 확인 캡처 (부록 C.41): 새 게임(개막 7일 전 소집) → 홈 오늘 훈련·주간 계획 → 날짜 눌러 하루 훈련 고르기 → 변경된 주간 계획
// → [하루 진행] 훈련 결과 → 기술 훈련 게이지 → (경기·[계속]으로) A매치 휴가 → [계속]으로 휴가 끝까지 → 남은 시즌 자동 → 다음 시즌 = 개막 7일 전 소집
// → 저장 화면(슬롯·크기·내보내기/가져오기) → 내보내기 파일 → 슬롯 불러오기 → 선수 화면 경기 기록(하이라이트·다시 보기).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c41-capture.mjs [playwright 모듈 경로] [저장 폴더]
// PC: W=1280 PREFIX=pc_ node scripts/c41-capture.mjs ...
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c41-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
const shot = async (name, full = false, wait = 0) => { if (wait) await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
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
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off', 'sim-rest-ok', 'rp-skip-ok'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}`).first().click(); };
async function idle(timeout = 900_000) {
  const end = Date.now() + timeout;
  let quiet = 0;
  while (Date.now() < end && quiet < 15) {
    quiet = (await has('[data-act="sim-stop"]')) ? 0 : quiet + 1;
    await page.waitForTimeout(100);
  }
}
const text = async (sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ');
const report = { errors };
const scrollTo = async (sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();

// 1. 새 게임 → 개막 7일 전 소집, 오늘 훈련·주간 계획
await act('go', '[data-to="new"]');
await page.fill('#f-seed', process.env.SEED ?? 'c41-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(300);
await act('start');
await page.waitForTimeout(500);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
// 경기 결정은 자동 (캡처 시간)
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');
report.campHero = await text('.po-hero');
await scrollTo('.tr-week');
await shot('1_주간훈련계획-소집');

// 2. 날짜 눌러 하루 훈련 고르기 (둘째 날)
await page.locator('.tr-week [data-act="train-day"]').nth(1).click();
await page.waitForTimeout(300);
await shot('2_하루훈련고르기');
await page.locator('.po-sheet [data-act="train-set"][data-v="intense"]').click();
await page.waitForTimeout(300);
await scrollTo('.tr-week');
await shot('3_주간계획-그날만변경');
report.week = await text('.tr-week');

// 3. [하루 진행] → 훈련 결과
await act('day-one');
await idle();
await page.waitForTimeout(200);
await shot('4_하루진행-훈련결과');
report.dayToast = (await has('.toast-wrap')) ? await text('.toast-wrap') : null;

// 4. 기술 훈련 게이지 (묶음 고르기: 패스)
await act('train-focus', '[data-v="passing"]');
await page.waitForTimeout(200);
await scrollTo('.tr-gauges');
await shot('5_훈련게이지');
report.gauges = await text('.tr-gauges');

// 5. A매치 휴가까지: [계속] → 경기 → 결과 → 홈 … 휴가 카드가 보이면
async function playOne() {
  await act('play');
  await page.waitForSelector('[data-act="rp-skip"], [data-act="rp-result"], .screen-match', { timeout: 180_000 });
  await dismiss();
  if (await has('[data-act="rp-skip"]')) {
    await act('rp-skip');
    await page.waitForTimeout(200);
    if (await has('[data-act="rp-skip-ok"]')) await act('rp-skip-ok');
  }
  await page.waitForTimeout(300);
  await dismiss();
  await act('go-tab', '[data-v="home"]');
  await page.waitForTimeout(300);
  await dismiss();
}
for (let k = 0; k < 20 && !(await has('.tr-today.tr-vacation')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await idle(); await page.waitForTimeout(300); }
  else await playOne();
}
await scrollTo('.tr-today.tr-vacation');
await shot('6_휴가');
report.vacation = await text('.tr-today.tr-vacation');
await act('day-continue');
await idle();
await page.waitForTimeout(300);
await shot('7_휴가넘기기-훈련재개');
report.afterVacationToast = (await has('.toast-wrap')) ? await text('.toast-wrap') : null;

// 6. 다음 경기 (다시 보기용 리플레이 저장) → 남은 시즌 자동 → 다음 시즌 = 개막 7일 전 소집
if (await has('[data-act="day-continue"]')) { await act('day-continue'); await idle(); }
await playOne();
// 경기 기록: 하이라이트 3줄·결정 수·[다시 보기] (최근 5경기 리플레이)
await act('go-tab', '[data-v="player"]');
await page.waitForTimeout(300);
await dismiss();
if (await has('.mlog-list')) await scrollTo('.mlog-list');
await shot('8a_경기기록-하이라이트-다시보기');
report.matchLog = (await has('.mlog-list')) ? await text('.mlog-list') : null;
if (await has('[data-act="replay-open"]')) {
  await act('replay-open');
  await page.waitForTimeout(800);
  await shot('8b_다시보기');
  await act('rp-result').catch(() => {});
  await page.waitForTimeout(300);
}
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
await act('sim-rest');
await act('sim-rest-ok');
await idle();
await page.waitForTimeout(500);
await dismiss();
if (!(await has('[data-act="next-season"]'))) await act('go', '[data-to="season"]');
await page.waitForTimeout(300);
await act('next-season');
await page.waitForTimeout(400);
await dismiss();
await shot('9_개막7일전소집');
report.campToast = (await has('.toast-wrap')) ? await text('.toast-wrap') : null;
report.campHero2 = await text('.po-hero');

// 7. 세이브 슬롯·내보내기
await act('go', '[data-to="saves"]');
await page.waitForTimeout(300);
await act('save', '[data-slot="1"]');
await page.waitForTimeout(800);
await shot('10_세이브슬롯-내보내기', true);
report.slots = await text('.screen-saves');
const [dl] = await Promise.all([page.waitForEvent('download'), act('export')]);
report.exportBytes = (await (await dl.createReadStream()).toArray()).reduce((t, b) => t + b.length, 0);
report.exportName = dl.suggestedFilename();
await page.waitForTimeout(400);
await shot('11_내보내기완료');
// 불러오기 시간
await act('load', '[data-slot="1"]');
await page.waitForTimeout(800);
await dismiss();
report.saveMs = await page.evaluate(() => globalThis.__saveLog);
report.loadMs = await page.evaluate(() => globalThis.__loadLog);

writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
