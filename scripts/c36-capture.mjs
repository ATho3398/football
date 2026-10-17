// 카드 확인 캡처 (부록 C.36): 빌드한 앱을 다크로 열어 새 게임 → 홈 "카드 덱" → 덱 편집(덱 세트·요건 미달·시그니처 잠김) →
// 경기 시작(직접) → 결정 순간 패 카드 줄 → 확률 카드(확률 변화) / 플레이 카드(4번째 선택지) → 확정 → 결과 띠(카드 이름) →
// 하이라이트 → 경기 결과(쓴 카드)까지 캡처한다. 페이지 오류를 센다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c36-capture.mjs [playwright 모듈 경로] [저장 폴더]
// PC: W=1280 PREFIX=pc_ node scripts/c36-capture.mjs ...
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c36-check/', import.meta.url).pathname;
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
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(200);
await page.locator('.real-row').filter({ hasText: process.env.REAL ?? '살라' }).first().click().catch(() => page.locator('.real-row').first().click());
await page.waitForTimeout(200);
await act('start');
await page.waitForTimeout(400);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await page.locator('[data-act="go"][data-to="deck"]').first().scrollIntoViewIfNeeded();
await shot('1_홈-카드덱', false, 200);
await act('go', '[data-to="deck"]');
await shot('2_덱편집', true, 300);
await act('deck-set', '[data-v="1"]');
await shot('3_덱세트2', false, 200);
await act('go', '[data-to="home"]');
await page.waitForTimeout(200);

let found = false;
for (let round = 0; round < 6 && !found; round++) {
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
await shot('4_결정순간-패', false, 4500);
// 쓸 수 있는 카드를 차례로: 플레이 카드(4번째 선택지)와 확률 카드(확률 변화)를 하나씩 찾는다
const bands = [];
let playShot = false;
let boostShot = false;
for (let k = 0; k < 14 && (await has('.mo-sheet')); k++) {
  await page.waitForTimeout(300);
  const cards = page.locator('.mo-hcard:not(.is-off)');
  const n = await cards.count();
  let used = false;
  for (let i = 0; i < n; i++) {
    const c = cards.nth(i);
    const role = (await c.locator('.mo-hcard__role').textContent())?.trim();
    if (role === '선택지' && !playShot) {
      await c.click();
      await shot('5_플레이카드-4번째선택지', false, 600);
      playShot = true;
      used = true;
      break;
    }
    if ((role === '확률' || role === '패시브') && !boostShot) {
      await c.click();
      if (!(await has('.mo-dp'))) { await c.click(); continue; }
      if (!(await has('.mo-opt.is-on'))) await act('mo-pick', '[data-v="0"]');
      await shot('6_확률카드-확률변화', false, 600);
      boostShot = true;
      used = true;
      break;
    }
  }
  if (used) {
    if (!(await has('.mo-opt.is-on'))) await act('mo-pick', '[data-v="0"]');
    await act('mo-confirm');
  } else await act('mo-delegate');
  await page.waitForSelector('.mo-outcome');
  await page.waitForSelector('.oc-band.is-shown', { timeout: 10000 });
  const t = `${await text('.oc-choice')} | ${await text('.oc-band')}`;
  bands.push(t);
  if (used && /🃏/.test(t)) await shot(`7_카드결과띠-${k}`);
  await act('oc-skip');
  await page.waitForTimeout(200);
  if (playShot && boostShot && k > 3) break;
}
console.log('bands', JSON.stringify(bands, null, 1));
if (await has('.mo-sheet')) await act('mo-auto');
await page.waitForSelector('#rp-canvas');
if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
console.log('scene tiles', await text('.scene-tiles'));
await shot('8_하이라이트', false, 800);
await act('rp-skip');
if (await has('[data-act="rp-skip-ok"]')) await act('rp-skip-ok');
await page.waitForTimeout(400);
if (await has('[data-act="rp-result"]')) await act('rp-result');
await page.waitForTimeout(400);
await shot('9_경기결과-쓴카드', true, 300);
console.log('errors', errors.length);
await browser.close();
process.exit(errors.length ? 1 : 0);
