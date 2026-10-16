// 전술 화면 확인 캡처 (부록 C.32): 빌드한 앱을 390×844 다크로 열어 3경기를 치르고 전술 화면을 캡처한다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c32-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c32-check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror', e.message));
const shot = async (name, full = true) => { await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('saved', name); };
const act = (a, extra = '') => page.locator(`[data-act="${a}"]${extra}`).first().click();
const has = async (sel) => (await page.locator(sel).count()) > 0;

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await act('go', '[data-to="new"]');
await page.fill('#f-name', '김민준');
await page.fill('#f-seed', 'c32check');
await act('start');
await page.waitForTimeout(400);
await act('tips-off');
for (let i = 0; i < 3; i++) {
  await act('play');
  await page.waitForSelector('#rp-canvas');
  if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
  await act('rp-skip');
  await act('rp-skip-ok');
  await page.waitForTimeout(300);
  await act('go', '[data-to="home"]').catch(() => act('go-tab', '[data-v="home"]'));
  await page.waitForTimeout(300);
  if (await has('[data-act="intro-ok"]')) { await shot(`intro-${i}`, false); await act('intro-ok'); }
}
await shot('홈-전술버튼');
await act('tac-open');
await shot('26_전술-기본(접힘)');
await act('tac-detail');
await shot('26_전술-자세히');
await act('tac-level', '[data-k="width"][data-v="0"]');
await act('tac-tend', '[data-v="block"]');
await shot('28_전술-성향변경확인', false);
await act('tac-tend-ok', '[data-reset="1"]');
await act('tac-role-open', '[data-v="9"]');
await shot('27_전술-역할선택', false);
await act('tac-role-pick', '[data-v="targetMan"]');
await act('tac-role-ok');
await act('tac-pick-me');
await act('tac-me-slot', '[data-v="2"]');
await shot('29_전술-주포지션밖경고', false);
await act('tac-me-ok');
await act('tac-save');
await shot('전술-저장후');
await browser.close();
