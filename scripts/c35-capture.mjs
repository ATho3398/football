// 결정 결과 확인 캡처 (부록 C.35): 빌드한 앱을 390×844 다크로 열어 새 게임 → 경기 시작(직접 모드) → 결정 순간(바텀시트) →
// 선택 → 확정 → 결과 구간 재생 → 결과 띠 → 다음 순간 → 맡기기 결과 → 자동 전환 → 하이라이트(내 결정 장면) → 경기 결과 → 결정 기록 리플레이까지 캡처한다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c35-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c35-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: W, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
const shot = async (name, full = false, wait = 0) => { if (wait) await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
const act = (a, extra = '') => page.locator(`[data-act="${a}"]${extra}`).first().click();
const has = async (sel) => (await page.locator(sel).count()) > 0;
const text = async (sel) => (await page.locator(sel).first().textContent())?.replace(/\s+/g, ' ').trim();

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await act('go', '[data-to="new"]');
// 결정 순간이 자주 나오도록 실제 선수(강팀 주전)로
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(200);
await page.locator('.real-row').filter({ hasText: process.env.REAL ?? '살라' }).first().click().catch(() => page.locator('.real-row').first().click());
await page.waitForTimeout(200);
await act('start');
await page.waitForTimeout(400);
if (await has('[data-act="tips-off"]')) await act('tips-off');
let found = false;
for (let round = 0; round < 5 && !found; round++) {
  await act('play');
  await page.waitForTimeout(500);
  if (await has('.mo-sheet')) { found = true; break; }
  if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
  if (await has('[data-act="rp-skip"]')) { await act('rp-skip'); await act('rp-skip-ok'); }
  await page.waitForTimeout(300);
  await act('go', '[data-to="home"]').catch(() => {});
  await page.waitForTimeout(300);
  if (await has('[data-act="intro-ok"]')) await act('intro-ok');
}
if (!found) throw new Error('결정 순간 없음');
await shot('1_결정순간-바텀시트', false, 4500);
await act('mo-pick', '[data-v="1"]');
await shot('2_선택', false, 300);
await act('mo-confirm');
await page.waitForSelector('.mo-outcome');
await shot('3_확정뒤-결과재생중', false, 250);
await page.waitForSelector('.oc-band.is-shown', { timeout: 10000 });
console.log('band1', await text('.oc-band'));
await shot('4_결과띠', false, 400);
// 결과 띠 1.5초 뒤 다음 장면으로 넘어간다
await page.waitForSelector('.mo-outcome', { state: 'detached', timeout: 5000 });
const results = [];
let k = 0;
while ((await has('.mo-sheet')) && k < 12) {
  if (k === 0) await shot('5_다음순간', false, 4500);
  else await page.waitForTimeout(300);
  if (k % 2 === 0) await act('mo-delegate');
  else { await act('mo-pick', '[data-v="2"]'); await act('mo-confirm'); }
  await page.waitForSelector('.mo-outcome');
  await page.waitForSelector('.oc-band.is-shown', { timeout: 10000 });
  const t = await text('.oc-band');
  results.push(t);
  if (k === 0) await shot('6_맡기기-결과띠');
  if (/골!|실점/.test(t ?? '')) await shot(`7_골-결과띠-${k}`);
  // 건너뛰기 버튼으로 바로 다음 장면
  await act('oc-skip');
  await page.waitForTimeout(200);
  k++;
}
console.log('bands', JSON.stringify(results, null, 1));
if (await has('.mo-sheet')) await act('mo-auto');
await page.waitForSelector('#rp-canvas');
if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
console.log('scene tiles', await text('.scene-tiles'));
await shot('8_하이라이트-내결정장면', false, 600);
await act('rp-skip');
await act('rp-skip-ok');
await page.waitForTimeout(400);
await page.locator('.dec-list').scrollIntoViewIfNeeded();
await shot('9_경기결과-결정기록', false, 300);
await act('dec-replay', '[data-v="0"]');
await page.waitForSelector('#rp-canvas');
await shot('10_결정기록-장면리플레이', false, 2500);
console.log('errors', errors.length);
await browser.close();
