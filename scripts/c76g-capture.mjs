// C.76g 확인 캡처 (U8-b 컴포넌트·홈, 적용 명세 docs/ui-requests/7-13-part2-apply.md): 홈 v4·알림·라이벌·주전 경쟁·시즌 목표·기록 도전·부상 복귀·안내띠·머리말 사진.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c76g-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX FULL(1 = 전체 높이) ONLY(쉼표 목록)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c76g-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const FULL = process.env.FULL === '1';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const report = { W, H, shots: {} };
const shot = async (name, sel, full = FULL) => {
  if (ONLY && !ONLY.some((o) => name.startsWith(o))) return;
  await page.waitForTimeout(400);
  if (sel && (await has(sel))) { await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(150); }
  await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full });
  report.shots[name] = { wide: await wide() };
  console.log('saved', name, 'wide', report.shots[name].wide);
};
async function dismiss() {
  for (let k = 0; k < 5; k++) {
    if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const click = async (sel) => { await dismiss(); await page.locator(`${sel}:visible`).first().click(); await page.waitForTimeout(250); };
const top = () => page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.body')?.scrollTo?.(0, 0); });
const tab = async (v) => { await page.evaluate((x) => document.querySelector(`[data-act="go-tab"][data-v="${x}"]`)?.click(), v); await page.waitForTimeout(450); await dismiss(); };
const playMatch = async () => {
  await click('[data-act="play"]'); await page.waitForSelector('main.screen-prep', { timeout: 60_000 }); await dismiss();
  if (await has('[data-act="ctl-mode"][data-v="auto"]:visible')) await click('[data-act="ctl-mode"][data-v="auto"]');
  await click('[data-act="prep-start"]');
  for (let k = 0; k < 60 && !(await has('main.screen-home, [data-act="go-tab"][data-v="home"]')); k++) await page.waitForTimeout(500);
  await page.waitForTimeout(2500);
  await tab('home');
};

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await click('[data-act="go"][data-to="new"]');
await page.waitForTimeout(300);
if (process.env.PHOTO === '1') {
  // 네모 사진 머리말(HeroPanel photo): 실제 선수로 시작(레포 사진 = 배경 있는 사진) → 홈 · 선수 머리말만 찍고 끝
  await click('[data-act="form"][data-k="mode"][data-v="real"]');
  await page.waitForTimeout(300);
  if (await has('.real-list [data-act="form"]:visible')) await click('.real-list [data-act="form"]');
  await click('[data-act="start"]');
  await page.waitForTimeout(1200); await dismiss();
  await page.evaluate(() => document.querySelector('[data-act="tips-off"]')?.click()); await page.waitForTimeout(300); await dismiss();
  await page.evaluate(() => document.fonts.ready);
  await shot('10_머리말_네모사진_홈');
  await tab('player');
  await shot('11_머리말_네모사진_선수');
  console.log('photo', await page.evaluate(() => document.querySelector('.po-hero--photo') ? 'square' : 'cutout/none'));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
  process.exit(0);
}
if (await has('[data-act="ng-random"]:visible')) await click('[data-act="ng-random"]');
await page.fill('#f-seed', 'c76g-check'); await page.locator('#f-seed').dispatchEvent('change');
await click('[data-act="start"]');
await page.waitForTimeout(900);
await dismiss();
// 새 기능 안내띠(203)는 켠 채로 첫 장
await top();
await shot('01_홈_개막');
// 새 기능 안내띠(203)는 dismiss 가 닫으므로 탭만 바꾸고 바로 찍는다
await page.evaluate(() => document.querySelector('[data-act="go-tab"][data-v="player"]')?.click()); await page.waitForTimeout(500);
if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
await shot('09_선수_안내띠');
await tab('home');
await page.evaluate(() => document.querySelector('[data-act="tips-off"]')?.click()); await page.waitForTimeout(300);
await dismiss();

// 경기 몇 번(자동 결정)으로 시즌 기록·목표 진행·라이벌 비교가 생기게
const games = Number(process.env.GAMES ?? 3);
for (let g = 0, k = 0; g < games && k < 80; k++) {
  if (await has('[data-act="play"]:visible')) { await playMatch(); g++; }
  else { await click('[data-act="day-one"]'); await page.waitForTimeout(600); }
}
await tab('home'); await top();
await shot('02_홈_시즌중');
await shot('03_홈_전체', null, true);

// 기록 도전(227): 지난 시즌 기록을 넣는다
await page.evaluate(() => {
  const g = globalThis.__game();
  g.archive = [{ season: g.league.season - 1, teamId: g.player.teamId, my: [], results: [], table: [], players: { npc1: [38, 24, 3, 2600], npc2: [36, 31, 1, 2400] }, names: { npc1: ['해리 케인', g.player.teamId], npc2: ['모하메드 살라', 'liv'] } }];
});
await tab('player'); await tab('home');
await shot('04_홈_기록도전', '.rc-card');
await tab('player');
await page.evaluate(() => document.querySelector('[data-act="player-tab"][data-v="record"]')?.click()); await page.waitForTimeout(400);
await shot('05_선수_기록도전', '.rc-card');

// 부상 복귀(228)
await page.evaluate(() => {
  const g = globalThis.__game();
  g.player.injury = { grade: 'major', weeksTotal: 9, daysTotal: 60, daysLeft: 8, season: g.league.season, round: 1, permanent: {}, ret: 'ask' };
});
await tab('home'); await top();
await shot('06_홈_복귀시점카드');
if (await has('[data-act="inj-return-open"]:visible')) {
  await click('[data-act="inj-return-open"]');
  await shot('07_복귀선택시트');
  await click('[data-act="inj-return"][data-v="early"]');
  await page.waitForTimeout(2800); await top();
  await shot('08_홈_재부상위험배너');
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify({ ...report, errors }, null, 1));
console.log('errors', JSON.stringify(errors));
await browser.close();
