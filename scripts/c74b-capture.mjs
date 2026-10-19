// C.74b 확인 캡처: 원정 전날 이동일(주간 칸 · 시트) · 부상 복귀 선택(배너 · 시트 · 조기 복귀 뒤 재부상 위험) · 기록 도전(홈 · 선수 기록 탭) · 기록 달성 토스트.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c74b-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c74b-check/', import.meta.url).pathname;
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
const home = async () => { await page.evaluate(() => document.querySelector('[data-act="go-tab"][data-v="home"]')?.click()); await page.waitForTimeout(400); await dismiss(); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
if (process.env.SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
await page.reload();
await click('[data-act="go"][data-to="new"]');
await page.fill('#f-seed', 'c74b-check'); await page.locator('#f-seed').dispatchEvent('change');
await click('[data-act="start"]');
await page.waitForTimeout(900);
await page.evaluate(() => document.querySelector('[data-act="tips-off"]')?.click()); await page.waitForTimeout(300);
await dismiss();

// 1. 원정 전날 이동일: 다음 7일 안 이동일이 보일 때까지 하루씩
const res = { travel: null, sheet: null };
for (let k = 0; k < 40 && !res.travel; k++) {
  await page.evaluate(() => document.querySelector('[data-act="go-tab"][data-v="schedule"]')?.click());
  await page.waitForTimeout(350); await dismiss();
  res.travel = await page.evaluate(() => document.querySelector('.tr-week .is-travel')?.getAttribute('data-v') ?? (document.querySelector('.tr-week .is-travel') ? 'locked' : null));
  if (res.travel) break;
  await home();
  if (await has('[data-act="play"]')) { await click('[data-act="ctl-mode"][data-v="auto"]').catch(() => {}); await click('[data-act="play"]'); await page.waitForSelector('main.screen-prep', { timeout: 60_000 }); await dismiss(); await click('[data-act="prep-start"]'); await page.waitForTimeout(2500); await home(); }
  else { await click('[data-act="day-one"]'); await page.waitForTimeout(700); }
}
console.log('travel cell', res.travel);
await shot('1_훈련_주간_이동일', '.tr-week');
if (await has('.tr-week .is-travel[data-act="train-day"]')) {
  await page.locator('.tr-week .is-travel[data-act="train-day"]').first().click(); await page.waitForTimeout(400);
  await shot('2_이동일_훈련시트');
  await page.evaluate(() => document.querySelector('[data-act="sheet-close"]')?.click()); await page.waitForTimeout(300);
}

// 2. 기록 도전: 지난 시즌 기록(구단·리그)을 넣고 홈
await page.evaluate(() => {
  const g = globalThis.__game();
  g.archive = [{ season: 2017, teamId: g.player.teamId, my: [], results: [], table: [], players: { npc1: [38, 24, 3, 2600], npc2: [36, 31, 1, 2400] }, names: { npc1: ['해리 케인', g.player.teamId], npc2: ['모하메드 살라', 'liv'] } }];
});
await home(); await top();
await shot('3_홈_기록도전', '.rc-card');
await page.evaluate(() => document.querySelector('[data-act="go-tab"][data-v="player"]')?.click()); await page.waitForTimeout(400); await dismiss();
await page.evaluate(() => document.querySelector('[data-act="player-tab"][data-v="record"]')?.click()); await page.waitForTimeout(400);
await shot('4_선수_기록탭_기록도전', '.rc-card');

// 3. 부상 복귀 선택
await page.evaluate(() => {
  const g = globalThis.__game();
  g.player.injury = { grade: 'major', weeksTotal: 9, daysTotal: 60, daysLeft: 8, season: g.league.season, round: 1, permanent: {}, ret: 'ask' };
});
await home(); await top();
await shot('5_홈_복귀선택배너');
await click('[data-act="inj-return-open"]');
await shot('6_복귀선택시트');
await click('[data-act="inj-return"][data-v="early"]');
await page.waitForTimeout(300);
await shot('7_조기복귀_토스트');
await page.waitForTimeout(2600); await top();
await shot('8_홈_재부상위험배너');

// 4. 기록 달성 토스트: 리그 통산 10골 직전으로 맞추고 경기 1번 (자동 결정)
await page.evaluate(() => { const g = globalThis.__game(); g.records = { done: [], fresh: [] }; g.player.season.goals = Math.max(g.player.season.goals, 10); });
for (let k = 0; k < 10 && !(await has('[data-act="play"]')); k++) { await click('[data-act="day-one"]'); await page.waitForTimeout(700); }
if (await has('[data-act="play"]')) {
  await click('[data-act="play"]'); await page.waitForSelector('main.screen-prep', { timeout: 60_000 }); await dismiss();
  if (await has('[data-act="ctl-mode"][data-v="auto"]')) await click('[data-act="ctl-mode"][data-v="auto"]');
  await click('[data-act="prep-start"]');
  await page.waitForTimeout(700);
  await shot('9_기록달성_토스트');
}
console.log('errors', JSON.stringify(errors));
await browser.close();
