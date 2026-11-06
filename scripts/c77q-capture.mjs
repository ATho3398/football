// C.77q 메뉴 구조 정리 확인 캡처: 홈·독 · 상점 · 상점 카드 상세 · 카드팩 결과(줄 누르면 상세) · 훈련 코치·스태프 · 선수 계약 에이전트 · 더보기 · 재정.
// 폰 390×844 · PC 1280×800 (W H). 가로 넘침(scrollWidth - innerWidth)도 적는다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 W=390 H=844 node scripts/c77q-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c77q-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const phone = W < 1024;
const P = process.env.PREFIX ?? (phone ? '폰_' : 'PC_');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    if (await has('[data-act="tips-off"]:visible')) await page.locator('[data-act="tips-off"]:visible').first().click();
    else if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); await page.waitForTimeout(250); };
const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const report = { W, H, errors, shots: {} };
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${P}${name}.png` }); report.shots[name] = { wide: await wide() }; console.log('saved', name, JSON.stringify(report.shots[name])); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForTimeout(500);
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]:visible'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', process.env.SEED ?? 'c77q');
await act('start');
await page.waitForTimeout(800);
await dismiss();

// 1) 홈 + 독 (폰 = 홈 · 훈련 · [다음] · 선수 · 상점 · 더보기)
await shot('1_홈_독');
// 카드팩 살 돈 (캡처용: 하네스 __game 으로 잔고만 늘림)
// 2) 상점 (처음 열면 재정 상태가 생긴다 → 잔고를 늘리고 다시 그림)
await act('go', '[data-to="shop"]');
await page.evaluate(() => { const g = globalThis.__game(); g.money.cash += 1e9; });
await act('go', '[data-to="shop"]');
await dismiss();
await shot('2_상점');
// 3) 상점 카드 상세 (덱과 같은 카드 상세 시트)
await act('card-open');
await page.waitForTimeout(300);
await shot('3_상점_카드상세');
await page.locator('button.po-btn[data-act="card-close"]').click(); await page.waitForTimeout(250);
// 4) 카드팩 → 결과 줄 누르면 상세 (연출 짧게)
await page.evaluate(() => localStorage.setItem('po-pack-anim', 'short'));
if (await has('[data-act="fn-pack"]:visible:not([disabled])')) {
  await act('fn-pack');
  for (let k = 0; k < 40 && !(await has('.pk-res')); k++) { if (await has('.pk-skip')) await page.locator('.pk-skip').click().catch(() => {}); await page.waitForTimeout(250); }
  await page.waitForTimeout(400);
  await shot('4_카드팩_결과');
  await page.locator('.pk-res__row[data-card]').first().click();
  await page.waitForTimeout(500);
  await shot('5_카드팩_결과_상세');
  await page.locator('button.po-btn[data-act="card-close"]').click(); await page.waitForTimeout(250);
  await shot('6_상점_방금연팩');
}
// 7) 훈련 › 코치·스태프 탭
await act('go-tab', '[data-v="schedule"]');
await dismiss();
await act('train-tab', '[data-v="staff"]');
await shot('7_훈련_코치스태프');
// 8) 선수 › 계약 (에이전트)
await act('go-tab', '[data-v="player"]');
await dismiss();
await act('player-tab', '[data-v="contract"]');
await page.evaluate(() => document.querySelector('.fn-opt')?.scrollIntoView({ block: 'center' }));
await page.waitForTimeout(200);
await shot('8_선수_계약_에이전트');
// 9) 재정 (돈 · 생활·투자) + 더보기 줄
if (phone) { await act('dock-more'); await shot('9_더보기'); }
await act('go', '[data-to="finance"]');
await dismiss();
await shot('10_재정');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log('errors', errors.length, errors.slice(0, 3));
await browser.close();
