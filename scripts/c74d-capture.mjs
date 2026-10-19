// C.74d 확인 캡처: 새 게임 시작 방식 2개 · 커스텀 [전체 랜덤] → 결과 3버튼 · [편집하기] → 커스텀 단계(포인트 넘침) · [이 단계 랜덤] · [포인트에 맞추기].
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c74d-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c74d-check/', import.meta.url).pathname;
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
const click = async (sel) => { await page.locator(`${sel}:visible`).first().click(); await page.waitForTimeout(250); };
const top = () => page.evaluate(() => window.scrollTo(0, 0));

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
if (process.env.SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
await page.reload();
await click('[data-act="go"][data-to="new"]');
console.log('tabs', await page.locator('[aria-label="시작 방식"] [role="tab"]').allTextContents());
await shot('1_커스텀_기본');
await click('[data-act="ng-random"]');
await shot('2_전체랜덤_결과');
await shot('3_결과_3버튼', '.ng-rollbtns');
await click('[data-act="ng-edit"]');
await top();
await shot('4_편집하기_1단계');
await click('[data-act="cu-step"][data-v="5"]');
await top();
await shot('5_능력치_넘침');
if (await has('[data-act="cu-fit"]')) { await click('[data-act="cu-fit"]'); await top(); await shot('6_포인트에맞춤'); }
await click('[data-act="cu-step"][data-v="2"]');
await click('[data-act="cu-rand"]');
await top();
await shot('7_몸_이단계랜덤');
console.log('errors', JSON.stringify(errors));
await browser.close();
