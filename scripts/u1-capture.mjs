// U단계 확인 캡처 (H.6 5번): 빌드한 앱을 390×844 다크로 열어 화면을 캡처해 docs/design/u1-check/ 에 저장한다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/u1-capture.mjs [playwright 모듈 경로]
// Chromium 은 /opt/pw-browsers 에 있다 (playwright install 금지)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = new URL('../docs/design/u1-check/', import.meta.url).pathname;
const URL_ = process.env.URL ?? 'http://localhost:4173/';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
const shot = async (name, full = true) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: full });
  console.log('saved', name);
};
const click = (sel) => page.locator(sel).first().click();
const act = (a, extra = '') => click(`[data-act="${a}"]${extra}`);
const waitFor = async (fn, ms = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await page.waitForTimeout(100);
  }
  return false;
};

await page.goto(URL_);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(400);
await shot('55_타이틀', false);

// 새 게임 (52·53)
await act('go', '[data-to="new"]');
await shot('52_새게임-가상유망주');
await act('form', '[data-k="mode"][data-v="real"]');
await act('form', '[data-k="realId"]');
await shot('53_새게임-실제선수');
await act('form', '[data-k="mode"][data-v="prospect"]');
await page.fill('#f-name', '김민준');
await page.fill('#f-seed', 'u1check');
await act('start');
await page.waitForTimeout(500);
await shot('22_홈-기본');

// 경기 화면 (15·48·49·18·17)
await act('tips-off'); // C.23 첫 방문 말풍선 끄기
await act('play');
await page.waitForSelector('#rp-canvas');
if (await page.locator('.fm-card [data-act="fm-close"]').count()) await page.locator('.fm-card [data-act="fm-close"]').click(); // C.23 첫 경기 오버레이
await page.waitForTimeout(1500);
await shot('15_경기화면-하이라이트', false);
await act('rp-speed', '[data-v="4×"]');
if (await waitFor(() => page.locator('.po-strip--transition').count().then((n) => n > 0), 60000)) {
  await page.waitForTimeout(350);
  await shot('48_경기화면-장면전환', false);
}
await waitFor(() => page.locator('.po-strip--highlight').count().then((n) => n > 0), 5000);
await act('rp-live');
await page.waitForTimeout(800);
await shot('49_경기화면-실시간시청', false);
await act('rp-speed', '[data-v="4×"]');
if (await waitFor(() => page.locator('#rp-note:not([hidden])').count().then((n) => n > 0), 60000)) await shot('18_경기화면-재개대기', false);
await act('rp-skip');
await shot('17_경기화면-건너뛰기확인', false);
await act('rp-skip-ok');
await page.waitForTimeout(500);
await shot('38_경기후-리포트');

// 선수·월드·세이브
await act('go', '[data-to="home"]');
if (await page.locator('[data-act="intro-ok"]').count()) await act('intro-ok'); // C.23 공개 소개
await act('go-tab', '[data-v="player"]');
await shot('44_선수상세-기본');
await act('go-tab', '[data-v="world"]');
await shot('54_순위표·리그스타');
await act('world-tab', '[data-v="stars"]');
await shot('54b_리그스타');
await act('go-tab', '[data-v="home"]');
await act('go', '[data-to="saves"]');
await act('save', '[data-slot="1"]');
await page.waitForTimeout(300);
await shot('43_세이브-슬롯', false);
await act('go', '[data-to="home"]');

// 포인트가 생길 때까지 경기 (50)
for (let i = 0; i < 38; i++) {
  if (await page.locator('[data-act="go"][data-to="allocate"]').count()) break;
  if (!(await page.locator('[data-act="play"]').count())) break;
  await act('play');
  await page.waitForSelector('[data-act="rp-skip"]');
  await act('rp-skip');
  await act('rp-skip-ok');
  await page.waitForTimeout(200);
  await act('go', '[data-to="home"]');
}
await shot('22b_홈-포인트배너');
await act('go', '[data-to="allocate"]');
await page.locator('[data-act="raise"]:not([disabled])').first().click();
await shot('50_포인트찍기');
await act('alloc-done');

// 시즌 종료 (51)
await act('sim-rest');
await act('sim-rest-ok');
await page.waitForSelector('.screen-season', { timeout: 120000 });
await shot('51_시즌종료-요약');

// 비시즌 홈: 주 포지션 변경 요청 (D.3)
await page.goto(URL_);
await act('continue');
await page.waitForTimeout(400);
await shot('22c_홈-비시즌');
await act('pos-open');
await act('pos-pick', '[data-v="CF"]');
await shot('D3_주포지션변경-시트', false);
await act('pos-change');
await page.waitForTimeout(300);
await act('go-tab', '[data-v="player"]');
await shot('44b_선수-숙련도·배지');

// 은퇴 (56): 30세 실제 선수로 한 시즌 뒤 은퇴
await page.goto(URL_);
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
await act('form', '[data-k="realId"][data-v="aguero"]');
await page.fill('#f-seed', 'u1retire');
await act('start');
await act('sim-rest');
await act('sim-rest-ok');
await page.waitForSelector('.screen-season', { timeout: 120000 });
await act('retire');
await act('retire-ok');
await page.waitForTimeout(400);
await shot('56_은퇴-요약');
await act('go', '[data-to="new"]');
await page.goto(URL_);
await page.waitForTimeout(300);
await shot('55b_타이틀-이어하기', false);

await browser.close();
