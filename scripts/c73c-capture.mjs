// C.73c 확인 캡처: 새 게임 랜덤 인종 4개 · 인종 고르면 기본 사진 자동 · 랜덤 3회 결과 · 커스텀 외모 단계 · 홈/선수 사진.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c73c-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c73c-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const shot = async (name, sel) => {
  await page.waitForTimeout(400);
  if (sel && (await has(sel))) { await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(150); }
  await page.screenshot({ path: `${OUT}/${P}${name}.png` });
  console.log('saved', name, 'wide', await wide());
};
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const click = async (sel) => { await dismiss(); await page.locator(`${sel}:visible`).first().click(); await page.waitForTimeout(250); };
const looksText = () => page.locator('.ng-looks p').first().textContent();

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
if (process.env.SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
await page.reload();
await click('[data-act="go"][data-to="new"]');
// 랜덤 3회
for (let i = 1; i <= 3; i++) {
  if (i > 1) await click('[data-act="form-reroll"]');
  console.log('random', i, (await looksText())?.slice(0, 40));
  await shot(`랜덤${i}`, '.ng-looks');
}
// 인종 4개 고르기 → 사진 자동
for (const [v, ko] of [['latinMideast', '중동'], ['eastAsian', '동양인'], ['white', '백인'], ['black', '흑인']]) {
  await click(`[data-act="form"][data-k="race"][data-v="${v}"]`);
  console.log('race', ko, await page.locator('.ng-photo.is-on small').textContent(), (await looksText())?.slice(0, 30));
}
await shot('랜덤_흑인선택', '.ng-looks');
await click('[data-act="form"][data-k="photo"][data-v="white"]');
await shot('랜덤_사진따로', '.ng-looks');
// 커스텀 외모 단계
await page.evaluate(() => window.scrollTo(0, 0));
await click('[data-act="form"][data-k="mode"][data-v="custom"]');
await click('[data-act="cu-step"][data-v="3"]');
await page.waitForTimeout(300);
if (await has('[data-act="cu"][data-k="app"][data-v="latinMideast"]')) {
  await click('[data-act="cu"][data-k="app"][data-v="latinMideast"]');
  await shot('커스텀_중동', '.ng-photos');
} else console.log('custom step 3 not reached');
// 랜덤으로 시작 (중동 고르고) → 홈 · 선수
await page.evaluate(() => window.scrollTo(0, 0));
await click('[data-act="cu-step"][data-v="1"]');
await click('[data-act="form"][data-k="mode"][data-v="prospect"]');
await click('[data-act="form"][data-k="race"][data-v="latinMideast"]');
await click('[data-act="start"]');
await page.waitForTimeout(900);
await page.evaluate(() => document.querySelector('[data-act="tips-off"]')?.click()); await page.waitForTimeout(300);
await dismiss();
await page.evaluate(() => window.scrollTo(0, 0));
await shot('홈');
await page.evaluate(() => document.querySelector('[data-act="go-tab"][data-v="player"]')?.click());
await page.waitForTimeout(500); await dismiss(); await page.evaluate(() => window.scrollTo(0, 0));
await shot('선수');
console.log('errors', JSON.stringify(errors));
await browser.close();
