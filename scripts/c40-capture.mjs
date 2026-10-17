// 결정 순간 개선 확인 캡처 (부록 C.40): 실제 선수(CB, 몸으로 막기·세트피스 가담 헤더가 시작 덱) 직접 모드 경기를 돌며
// 선택지 3개 정지 / 선택지 2개만 남은 정지 / 카드 장면(공중볼·상대 슈팅) 정지 → 카드 선택지 / 결과 띠를 캡처한다. 페이지 오류를 센다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c40-capture.mjs [playwright 모듈 경로] [저장 폴더]
// PC: W=1280 PREFIX=pc_ node scripts/c40-capture.mjs ...
// 선택지 2개 하네스: HARNESS=http://localhost:5174/scripts/c40-harness.html (npx vite --port 5174 를 같이 띄운다)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c40-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: W, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
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
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off', 'rp-skip-ok'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}`).first().click(); };
const text = async (sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ');
async function idle(timeout = 900_000) {
  const end = Date.now() + timeout;
  let quiet = 0;
  while (Date.now() < end && quiet < 15) {
    quiet = (await has('[data-act="sim-stop"]')) ? 0 : quiet + 1;
    await page.waitForTimeout(100);
  }
}
const report = { errors, stops: [] };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(200);
await page.locator(`.real-row[data-v="${process.env.REAL ?? 'van-dijk'}"]`).first().click({ timeout: 3000 }).catch(() => page.locator('.real-row').first().click());
await page.waitForTimeout(200);
await act('start');
await page.waitForTimeout(500);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');

const done = { three: false, two: false, react: false, band: false };
for (let match = 0; match < 8 && !(done.three && done.two && done.react && done.band); match++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await idle(); }
  await dismiss();
  await act('play');
  await page.waitForSelector('[data-act="mo-confirm"], [data-act="rp-skip"], [data-act="rp-result"]', { timeout: 180_000 });
  for (let k = 0; k < 20 && (await has('[data-act="mo-confirm"]')); k++) {
    await page.waitForTimeout(1500);
    const n = await page.locator('.mo-opt').count();
    const react = await has('.mo-sheet__head--react');
    report.stops.push({ match, n, react, scene: await text('.mo-scene b') });
    let confirm = false;
    if (react && !done.react) {
      await shot('3_카드장면-정지', false, 300);
      const slots = page.locator('.po-hand [data-act="mo-card"]:not([aria-disabled])');
      if (await slots.count()) {
        await slots.first().click();
        await page.waitForTimeout(400);
        await shot('4_카드장면-카드선택지', false, 200);
        confirm = true;
      }
      done.react = true;
    } else if (!react && n === 3 && !done.three) {
      await shot('1_선택지3개', false, 300);
      done.three = true;
    } else if (!react && n === 2 && !done.two) {
      await shot('2_선택지2개만', false, 300);
      done.two = true;
    }
    if (!confirm && !react && !done.band) {
      await act('mo-pick', '[data-v="0"]');
      confirm = true;
    }
    if (confirm) await act('mo-confirm');
    else await act('mo-delegate');
    await page.waitForSelector('.oc-band.is-shown', { timeout: 15_000 }).catch(() => {});
    if (confirm && !done.band) {
      await shot('5_결과띠', false, 100);
      report.band = await text('.oc-band').catch(() => '');
      done.band = true;
    }
    if (await has('[data-act="oc-skip"]')) await act('oc-skip');
    await page.waitForTimeout(300);
    await page.waitForSelector('[data-act="mo-confirm"], [data-act="rp-skip"], [data-act="rp-result"], .fm-card', { timeout: 120_000 }).catch(() => {});
  }
  if (await has('[data-act="mo-auto"]')) await act('mo-auto');
  await page.waitForSelector('[data-act="rp-skip"], [data-act="rp-result"], [data-act="fm-close"]', { timeout: 180_000 }).catch(() => {});
  await page.waitForTimeout(300);
  await dismiss();
  if (await has('[data-act="rp-skip"]')) { await act('rp-skip'); if (await has('[data-act="rp-skip-ok"]')) await act('rp-skip-ok'); }
  await page.waitForTimeout(300);
  await dismiss();
  await act('go-tab', '[data-v="home"]').catch(() => {});
  await page.waitForTimeout(400);
  await dismiss();
}
// 선택지 2개만 남은 정지는 실경기에서 드물어(경기당 0.05회 미만) 같은 화면 코드로 그린 하네스로 캡처한다 (개발 서버: npx vite --port 5174)
if (!done.two && process.env.HARNESS) {
  await page.goto(process.env.HARNESS);
  await shot('2_선택지2개만-하네스', false, 600);
  done.two = 'harness';
}
report.done = done;
console.log(JSON.stringify(report, null, 1));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log('errors', errors.length);
await browser.close();
process.exit(errors.length ? 1 : 0);
