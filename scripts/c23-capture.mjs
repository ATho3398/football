// 13단계 확인 캡처 (부록 C.23): 390×844 모바일과 1440×900 PC 에서 홈·첫 경기 오버레이·경기 재생·공개 소개·선수 화면.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c23-capture.mjs [playwright 모듈 경로]
// 결과는 docs/design/u1-check/C23_*.png. Chromium 은 /opt/pw-browsers 에 있다 (playwright install 금지). u1-capture.mjs 의 도우미를 그대로 썼다
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = new URL('../docs/design/u1-check/', import.meta.url).pathname;
const URL_ = process.env.URL ?? 'http://localhost:4173/';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());

for (const [tag, viewport] of [['모바일', { width: 390, height: 844 }], ['PC', { width: 1440, height: 900 }]]) {
  const page = await browser.newPage({ viewport, colorScheme: 'dark', deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  const shot = async (name, full = false) => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}C23_${name}-${tag}.png`, fullPage: full });
    console.log('saved', name, tag);
  };
  const act = (a, extra = '') => page.locator(`[data-act="${a}"]${extra}`).first().click();

  await page.goto(URL_);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  await act('go', '[data-to="new"]');
  await page.fill('#f-name', '김민준');
  await page.fill('#f-seed', 'c23check');
  await act('start');
  await page.waitForTimeout(2600); // 시작 토스트가 사라질 때까지
  await shot('홈-말풍선·체크리스트', true);
  await act('tips-off');

  // 첫 경기: 첫 장면 시작에서 멈추고 3줄 오버레이
  await act('play');
  await page.waitForSelector('.fm-overlay');
  await page.waitForTimeout(600);
  await shot('첫경기-오버레이');
  await page.locator('.fm-card [data-act="fm-close"]').click();
  await page.waitForTimeout(3500);
  await shot('경기재생-하이라이트');
  await act('rp-skip');
  await act('rp-skip-ok');
  await page.waitForTimeout(400);
  await act('go', '[data-to="home"]');
  await page.waitForTimeout(400);
  // 첫 경기 뒤 성장 공개 소개
  if (await page.locator('[data-act="intro-ok"]').count()) {
    await shot('공개소개-성장');
    await act('intro-ok');
  }
  await act('go-tab', '[data-v="player"]');
  await page.waitForTimeout(300);
  await shot('선수-위상·레전더리조건', true);
  // 내 선수 표시 (실제 선수는 주전이라 첫 경기에 나온다)
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  await act('go', '[data-to="new"]');
  await act('form', '[data-k="mode"][data-v="real"]');
  await act('form', '[data-k="realId"][data-v="kane"]');
  await page.fill('#f-seed', 'c23check');
  await act('start');
  await page.waitForTimeout(2600);
  await act('tips-off');
  await act('play');
  await page.waitForSelector('.fm-overlay');
  await page.locator('.fm-card [data-act="fm-close"]').click();
  await page.waitForTimeout(4000);
  await shot('경기재생-내선수');
  await page.close();
}
await browser.close();
