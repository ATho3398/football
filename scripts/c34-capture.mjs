// 결정 순간 확인 캡처 (부록 C.34): 빌드한 앱을 390×844 다크로 열어 새 게임 → 경기 시작(직접 모드 기본) →
// 결정 순간 화면 → 선택지 고르기 → 확정 → 다음 순간 맡기기 → 자동으로 전환 → 재생 건너뛰기 → 경기 결과(내 결정 기록)까지 캡처한다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c34-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c34-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: W, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
const shot = async (name, full = true, wait = 250) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('saved', name); };
const act = (a, extra = '') => page.locator(`[data-act="${a}"]${extra}`).first().click();
const has = async (sel) => (await page.locator(sel).count()) > 0;

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await act('go', '[data-to="new"]');
await page.fill('#f-name', '김민준');
await page.fill('#f-seed', 'c34check');
await act('start');
await page.waitForTimeout(400);
await act('tips-off');
await shot('1_홈-직접자동토글');
let moments = 0;
for (let round = 0; round < 4 && moments === 0; round++) {
  await act('play');
  await page.waitForTimeout(500);
  if (await has('.moment')) { moments++; break; }
  // 결장·교체 등으로 결정 순간이 없으면 재생을 건너뛰고 다음 경기
  if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
  if (await has('[data-act="rp-skip"]')) { await act('rp-skip'); await act('rp-skip-ok'); }
  await page.waitForTimeout(300);
  await act('go', '[data-to="home"]').catch(() => {});
  await page.waitForTimeout(300);
  if (await has('[data-act="intro-ok"]')) await act('intro-ok');
}
await shot('2_결정순간-정지', true, 4500);
await act('mo-pick', '[data-v="2"]');
await shot('3_도박-선택', true, 400);
await act('mo-confirm');
await page.waitForTimeout(300);
if (await has('.moment')) {
  await shot('4_다음순간-직전결과', true, 4500);
  await act('mo-delegate');
  await page.waitForTimeout(300);
}
let n = 0;
while ((await has('.moment')) && n < 3) { await act('mo-pick', '[data-v="1"]'); await act('mo-confirm'); await page.waitForTimeout(200); n++; }
if (await has('.moment')) { await shot('5_전환전'); await act('mo-auto'); }
await page.waitForSelector('#rp-canvas');
if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
await act('rp-skip');
await act('rp-skip-ok');
await page.waitForTimeout(400);
await shot('6_경기결과-내결정기록');
await act('go', '[data-to="home"]').catch(() => {});
await shot('7_홈-자동으로바뀜');
console.log('errors', errors.length);
await browser.close();
