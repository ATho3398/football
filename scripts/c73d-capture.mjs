// C.73d 확인 캡처: 홈 왼쪽 위 ‹ → 확인 시트 → 초기화면(이어하기) → 이어하기로 복귀 · 설정 "초기화면으로" · 경기 중 숨김.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c73d-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c73d-check/', import.meta.url).pathname;
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
const top = () => page.evaluate(() => window.scrollTo(0, 0));

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
if (process.env.SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
await page.reload();
await click('[data-act="go"][data-to="new"]');
await click('[data-act="start"]');
await page.waitForTimeout(900);
await page.evaluate(() => document.querySelector('[data-act="tips-off"]')?.click()); await page.waitForTimeout(300);
await dismiss();
// 하루 진행 1번 (진행이 저장되는지 보려고)
await click('[data-act="day-one"]'); await page.waitForTimeout(600); await dismiss(); await top();
const day1 = await page.evaluate(() => globalThis.__game()?.calendar?.date);
console.log('home back key', await has('.po-hero__back[data-act="to-title"]'));
await page.waitForTimeout(2600); await shot('1_홈_왼쪽위키');
await click('.po-hero__back[data-act="to-title"]');
await shot('2_확인시트');
await click('[data-act="to-title-ok"]');
await page.waitForTimeout(800);
console.log('title', await has('.title-screen'), 'continue', await has('[data-act="continue"]'), 'dock', await has('.po-dock, nav.dock'));
await shot('3_초기화면도착');
await click('[data-act="continue"]');
await page.waitForTimeout(900); await dismiss(); await top();
const day2 = await page.evaluate(() => globalThis.__game()?.calendar?.date);
console.log('restored home', await has('.screen-home'), 'same day', day1, day2);
// 설정 → 세이브 섹션
await click('[data-act="go"][data-to="settings"]');
if (await has('[data-act="set-nav"][data-v="saves"]')) await click('[data-act="set-nav"][data-v="saves"]');
else if (await has('[data-act="set-open"][data-v="saves"]')) await click('[data-act="set-open"][data-v="saves"]');
console.log('settings item', await has('[data-act="to-title"]'));
await shot('4_설정_초기화면으로', '[data-act="to-title"]');
await click('[data-act="to-title"]');
await shot('5_설정_확인시트');
await click(".po-modal [data-act=\"modal-close\"]");
// 경기 중(라이브): 손흥민으로 새로 시작 → 직접 모드 경기 재생 중 홈으로 → 머리말에 키가 없어야
await page.goto(process.env.URL ?? 'http://localhost:4173/');
await click('[data-act="go"][data-to="new"]');
await page.fill('#f-seed', 'c66b-check'); await page.locator('#f-seed').dispatchEvent('change');
await click('[data-act="form"][data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
await click('[data-act="start"]'); await page.waitForTimeout(800); await dismiss();
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) { if (await has('[data-act="day-continue"]')) { await click('[data-act="day-continue"]'); await page.waitForTimeout(1500); } }
await click('[data-act="play"]');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 }); await dismiss();
if (await has('[data-act="ctl-mode"][data-v="direct"]')) await click('[data-act="ctl-mode"][data-v="direct"]');
await click('[data-act="prep-start"]');
await page.waitForSelector('#rp-canvas', { timeout: 15_000 }).catch(() => {});
await page.waitForTimeout(600); await dismiss();
console.log('mode', await page.evaluate(() => globalThis.__game()?.control?.mode));
console.log('screen after kickoff', await page.evaluate(() => document.querySelector('main.screen')?.className));
await page.evaluate(() => document.querySelector('[data-act="go-tab"][data-v="home"]')?.click());
await page.waitForTimeout(500); await top();
console.log('live band', await has('.live-band'), 'home key in live', await has('[data-act="to-title"]'));
await shot('6_경기중_홈_키없음');
await page.evaluate(() => document.querySelector('[data-act="go"][data-to="settings"]')?.click());
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('[data-act="set-nav"][data-v="saves"], [data-act="set-open"][data-v="saves"]')?.click());
await page.waitForTimeout(300);
console.log('settings item in live', await has('[data-act="to-title"]'));
console.log('errors', JSON.stringify(errors));
await browser.close();
