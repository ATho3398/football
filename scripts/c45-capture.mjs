// C.45 화면 확인 캡처: 커스텀 생성 흐름(기본·신체·외모·장단점·능력치·시작 소속) → 1군 테스트 홈 → 선수 화면(신체·약발·장단점)
// → 훈련(약발 훈련) → 설정 → 경기 아이콘(선수·유니폼). 경기 화면 캐릭터 보기는 scripts/c45-harness.html (개발 서버)로 따로.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 W=390 H=844 PREFIX=phone_ node scripts/c45-capture.mjs [playwright 모듈 경로]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = new URL('../docs/design/c45-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: Number(process.env.DPR ?? 2) });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
const shot = async (name, wait = 400) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png` }); console.log('saved', P + name); };
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    if (await has('[data-act="tips-off"]')) await page.locator('[data-act="tips-off"]').first().click();
    else if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}`).first().click(); await page.waitForTimeout(200); };
const scrollTo = async (sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'start' })); await page.waitForTimeout(150); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForTimeout(500);
await act('go', '[data-to="new"]');
await shot('01_새게임-랜덤(신체·장단점)');
await act('form', '[data-k="mode"][data-v="custom"]');
await page.fill('#f-name', '이도윤');
await shot('02_커스텀-기본');
await act('cu', '[data-k="age"][data-v="1"]');
await act('cu', '[data-k="pos"][data-v="CB"]');
for (let k = 0; k < 10; k++) await act('cu', '[data-k="height"][data-v="1"]');
for (let k = 0; k < 6; k++) await act('cu', '[data-k="weight"][data-v="1"]');
await act('cu', '[data-k="foot"][data-v="left"]');
await act('cu', '[data-k="wf"][data-v="4"]');
await scrollTo('.cu-row2');
await shot('03_커스텀-신체·약발');
await act('cu', '[data-k="app"][data-v="black"]');
await act('cu', '[data-k="hair"][data-v="bald"]');
await scrollTo('#cu-nat');
await shot('04_커스텀-국적·외모');
await act('cu', '[data-k="trait"][data-v="ironMan"]');
await act('cu', '[data-k="trait"][data-v="professional"]');
await act('cu', '[data-k="trait"][data-v="hotHead"]');
await act('cu', '[data-k="trait"][data-v="mediaShy"]');
await scrollTo('.cu-trait');
await shot('05_커스텀-장단점');
await act('cu-auto');
await act('cu-sel', '[data-v="tackling"]');
await scrollTo('.ag');
await shot('06_커스텀-능력치배분');
await act('cu', '[data-k="startKind"][data-v="youth"]');
await act('cu', '[data-k="startClub"][data-v="liv"]');
await scrollTo('[data-k="startKind"]');
await shot('07_커스텀-시작소속(유스·1군테스트)');
await act('start');
await dismiss();
await shot('08_홈-1군테스트');
await act('go', '[data-to="settings"]');
await act('opt-quick', '[data-v="quick"]');
await act('ctl-mode', '[data-v="auto"]');
await act('go-tab', '[data-v="player"]');
await dismiss();
await scrollTo('.body-stats');
await shot('09_선수화면-신체·약발·장단점');
await act('go-tab', '[data-v="schedule"]').catch(async () => act('go', '[data-to="schedule"]'));
await dismiss();
if (await has('[data-act="train-day"]')) {
  await act('train-day');
  await shot('10_훈련-약발훈련 선택');
  if (await has('[data-act="train-set"][data-v="weakFoot"]')) await act('train-set', '[data-v="weakFoot"]');
  await shot('11_훈련-약발훈련 지정');
}
await act('go-tab', '[data-v="home"]').catch(() => {});
await act('go', '[data-to="settings"]').catch(() => {});
await dismiss();
if (await has('[data-act="px-tab"]')) {
  await scrollTo('[data-act="px-tab"]');
  await shot('12_설정-경기아이콘-선수');
  if (await has('[data-act="px-pick"]')) { await act('px-pick'); await scrollTo('.px-editor'); await shot('13_설정-경기아이콘-선수 고르기'); }
  await act('px-tab', '[data-v="kits"]');
  if (await has('[data-act="px-team-pick"]')) { await act('px-team-pick'); }
  await scrollTo('[data-act="px-tab"]');
  await shot('14_설정-경기아이콘-유니폼');
}
console.log(JSON.stringify({ errors }));
await browser.close();
