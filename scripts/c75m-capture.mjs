// C.75m 확인 캡처 (새 게임 리그 고르기): 커스텀 1단계 리그 접힘 · 펼침 · 기본 묶음/내 리그만 · 실제 선수 탭 · 시작 후 홈. 세로 폰 390×844 기본 · PC 1280×800 (W H PREFIX).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c75m-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c75m-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const shot = async (name, full = false) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}${P}${name}.png`, fullPage: full });
  console.log('saved', P + name, (await overflow()) ? '가로 넘침!' : '');
};
const act = (a, extra = '') => page.locator(`[data-act="${a}"]${extra}`).first().click();
const toLeagues = async () => {
  await page.locator('.ng-lg__sum').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('.ng-lg__sum')?.scrollIntoView({ block: 'start' }));
};

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(400);
await act('go', '[data-to="new"]');
await page.waitForTimeout(300);
await toLeagues();
await shot('01_새게임-리그-접힘');
await act('ng-lg-open');
await toLeagues();
await shot('02_새게임-리그-펼침');
await page.evaluate(() => document.querySelector('.ng-lg__list')?.lastElementChild?.scrollIntoView({ block: 'end' }));
await shot('03_새게임-리그-목록-아래');
await act('ng-leagues', '[data-v="mine"]');
await toLeagues();
await shot('04_새게임-리그-내리그만');
await act('ng-leagues', '[data-v="default"]');
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
await toLeagues();
await shot('05_실제선수-리그');
// 시작 → 홈
await act('form', '[data-k="mode"][data-v="custom"]');
await act('ng-random');
await page.waitForTimeout(300);
await act('start');
await page.waitForTimeout(800);
await shot('06_시작-홈');
console.log(errors.length ? `오류 ${errors.length}` : '오류 없음');
await browser.close();
