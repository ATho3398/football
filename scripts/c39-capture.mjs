// 체감 패치 A 확인 캡처 (부록 C.39): 새 게임(능력치 바둑판·포지션별 OVR 표) → 홈(작은 머리말·다음 경기 카드·보조 [남은 시즌 자동])
// → 직접 모드 경기 결정 순간(GameCard 패) → 아래 바로 홈(경기 중 띠·행동 잠금) → 띠로 복귀 → 경기 결과 [홈으로]/[다음 경기]
// → 선수 화면 바둑판 → 덱 편집(GameCard mini)·카드 상세(full) → 남은 시즌 자동(포인트 자동 분배 없음 확인) → 획득 3택1 → 포인트 찍기 바둑판.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c39-capture.mjs [playwright 모듈 경로] [저장 폴더]
// PC: W=1280 PREFIX=pc_ node scripts/c39-capture.mjs ...
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c39-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: W, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
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

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();

// 1. 새 게임: 바둑판 + 포지션별 OVR 표, "다른 유망주 보기" 때 같이 바뀐다
await act('go', '[data-to="new"]');
await page.fill('#f-seed', process.env.SEED ?? 'c39-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(300);
await shot('1_새게임-바둑판-포지션OVR', true);
const before = await text('.pos-table');
await act('form-reroll');
await page.waitForTimeout(200);
report.rerollChangesTable = before !== await text('.pos-table');
await page.fill('#f-seed', process.env.SEED ?? 'c39-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(300);
await act('start');
await page.waitForTimeout(500);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
// 다른 경기는 빠른 진행 (캡처 시간)
if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
if (await has('[data-act="day-continue"]')) { await act('day-continue'); await idle(); }
await page.waitForTimeout(300);
await shot('2_홈-경기날', false);

// 2. 직접 모드 경기 → 결정 순간 (GameCard 패)
await act('play');
await page.waitForSelector('[data-act="mo-confirm"], [data-act="rp-skip"]', { timeout: 120_000 });
await page.waitForTimeout(1500);
if (await has('.po-hand [data-act="mo-card"]')) {
  const usable = page.locator('.po-hand [data-act="mo-card"]:not([aria-disabled])');
  if (await usable.count()) await usable.first().click();
}
await shot('3_결정순간-패', false, 300);

// 3. 경기 중 아래 바로 홈 → 띠·잠금
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
report.bandOnHome = await has('.live-band');
await shot('4_경기중-홈-띠', false);
await page.locator('[data-act="play"]').first().click();
await page.waitForTimeout(200);
report.lockToast = await has('.toast-wrap') ? await text('.toast-wrap') : null;
await shot('5_경기중-잠금', false);
await act('go-tab', '[data-v="player"]');
await page.waitForTimeout(300);
await shot('6_경기중-선수-바둑판', false);
await act('live-return');
await page.waitForTimeout(800);
report.backToMoment = await has('[data-act="mo-confirm"]');
// 남은 경기는 자동 → 재생 → 결과
await act('mo-auto');
await page.waitForSelector('[data-act="rp-skip"], [data-act="rp-result"], [data-act="fm-close"]', { timeout: 120_000 });
await page.waitForTimeout(300);
await dismiss();
if (await has('[data-act="rp-skip"]')) { await act('rp-skip'); await act('rp-skip-ok'); }
await page.waitForTimeout(400);
await dismiss();
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot('7_경기결과-두버튼', false, 300);
report.resultButtons = await page.locator('.btn-row [data-act]').evaluateAll((els) => els.map((e) => e.textContent.trim()));
await act('go', '[data-to="home"]');
await page.waitForTimeout(300);

// 4. 선수 화면 바둑판
await act('go-tab', '[data-v="player"]');
await page.waitForTimeout(300);
await dismiss();
await shot('8_선수-바둑판', false);

// 5. 덱 편집 GameCard + 카드 상세
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(200);
await act('go', '[data-to="deck"]');
await page.waitForTimeout(300);
await dismiss();
await shot('9_덱편집-GameCard', true);
await act('card-open');
await page.waitForTimeout(300);
await shot('10_카드상세', false);
await page.locator('.po-sheet [data-act="card-close"]').click();
await page.waitForTimeout(200);
await act('go', '[data-to="home"]');
await page.waitForTimeout(300);

// 6. 남은 시즌 자동: 포인트는 찍지 않고 쌓인다
await act('sim-rest');
await act('sim-rest-ok');
await idle();
await page.waitForTimeout(500);
await dismiss();
report.seasonScreen = await text('.po-hero');
report.pointsAfterSeason = await has('[data-act="go"][data-to="allocate"]') ? await text('[data-act="go"][data-to="allocate"]') : '포인트 버튼 없음';
await shot('11_시즌요약-포인트', false);

// 7. 획득 3택1 (시즌 끝 카드 선택)
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
await dismiss();
await shot('12_홈-비시즌-포인트배지', false);
if (await has('[data-act="go"][data-to="deck"]')) {
  await act('go', '[data-to="deck"]');
  await page.waitForTimeout(300);
  await shot('13_획득-3택1', false);
  await act('go', '[data-to="home"]');
  await page.waitForTimeout(200);
}

// 8. 포인트 찍기 바둑판
if (await has('[data-act="go"][data-to="allocate"]')) {
  await act('go', '[data-to="allocate"]');
  await page.waitForTimeout(300);
  await dismiss();
  await shot('14_포인트찍기-바둑판', false);
  await page.locator('.ag-cell.is-key').first().click();
  await page.waitForTimeout(150);
  await page.locator('.ag-cell.is-sel [data-act="raise"]').first().click();
  await page.waitForTimeout(150);
  await shot('15_포인트찍기-선택-플러스', false);
  await shot('16_포인트찍기-전체', true);
}
console.log(JSON.stringify(report, null, 1));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log('페이지 오류', errors.length);
await browser.close();
