// C.81c 자동 경기 대기 측정: 새 게임(손흥민) → 자동 모드 → [경기 시작]/[다음 경기] → 경기 준비 → [경기 시작] → 결과 화면.
// 구간: play = [다음 경기]·[경기 시작] 누름 → 경기 준비 화면 · start = 준비 [경기 시작] 누름 → 결과 화면이 그려짐 (__matchPerf 구간별)
// 실행: npm run build && npx vite preview --port 4173 & 그다음 THROTTLE=4 N=5 node scripts/c81c-wait.mjs [playwright 모듈 경로]
// THROTTLE = CDP Emulation.setCPUThrottlingRate (폰 흉내 4), PREP_MS = 준비 화면에서 머무는 시간(사용자가 보는 시간, 기본 1500)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const N = Number(process.env.N ?? 5);
const RATE = Number(process.env.THROTTLE ?? 1);
const PREP_MS = Number(process.env.PREP_MS ?? 1500);
const HOME_MS = Number(process.env.HOME_MS ?? 1500);
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (s) => (await page.locator(s).count()) > 0;
const dismiss = async () => {
  for (let k = 0; k < 6; k++) {
    let hit = false;
    for (const s of ['[data-act="tips-off"]', '[data-act="intro-ok"]', '[data-act="tip-close"]', '.fm-card [data-act="fm-close"]', '[data-act="modal-close"]', '[data-act="celebrate-close"]']) {
      if (await has(`${s}:visible`)) { await page.locator(`${s}:visible`).first().click({ timeout: 1000 }).catch(() => null); hit = true; await page.waitForTimeout(100); }
    }
    if (!hit) break;
  }
};
const t00 = Date.now();
const log = (...a) => console.log(((Date.now() - t00) / 1000).toFixed(1), ...a);
await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
if (RATE > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE }); }
await page.locator('[data-act="go"][data-to="new"]:visible').first().click();
await page.waitForTimeout(300);
if (await has('#f-seed')) { await page.fill('#f-seed', process.env.SEED ?? 'c81c-wait'); await page.locator('#f-seed').dispatchEvent('change'); }
await page.locator('[data-act="form"][data-k="mode"][data-v="real"]:visible').first().click().catch(() => null);
await page.waitForTimeout(300);
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
await page.waitForTimeout(200);
// 시드는 선수를 고른 뒤 넣는다 (고르면 폼이 다시 그려진다)
if (await has('#f-seed')) { await page.fill('#f-seed', process.env.SEED ?? 'c81c-wait'); await page.locator('#f-seed').dispatchEvent('change'); await page.waitForTimeout(200); }
await page.locator('[data-act="start"]:visible').first().click();
await page.waitForTimeout(800);
await dismiss();
await page.evaluate((q) => { const g = globalThis.__game(); g.control.mode = 'auto'; if (q) g.options = { quickOthers: true }; }, !!process.env.QUICK);
log('started', await page.evaluate(() => document.querySelector('#app')?.className), await page.evaluate(() => { const g = globalThis.__game(); return [g.worldSeed, g.calendar.date, g.player.name, g.player.teamId]; }));
const rows = [];
for (let i = 0; i < N; i++) {
  await dismiss();
  await page.waitForTimeout(HOME_MS);
  const n0 = await page.evaluate(() => globalThis.__matchPerf.length);
  const g0 = await page.evaluate(() => ({ prog: globalThis.__progress.length, busy: globalThis.__pool?.()?.busyMs ?? 0, jobs: globalThis.__pool?.()?.jobs ?? 0, hits: globalThis.__pool?.()?.hits ?? 0 }));
  log('play');
  const tp = Date.now();
  // [경기 시작]/[다음 경기]: 경기 날이 아니면 [계속]으로 일정까지 가고 멈출 수 있다(휴가·소집 등) → 준비 화면이 나올 때까지 다시 누른다
  let clicks = 0;
  let lastClick = tp;
  for (;;) {
    if (await page.evaluate(() => document.querySelector('#app')?.className.includes('app-prep'))) break;
    const busy = await page.evaluate(() => !!document.querySelector('[data-act="sim-stop"]') || !!document.querySelector('.toast-wrap'));
    if (!busy) {
      await dismiss();
      if (clicks > 12) break;
      lastClick = Date.now();
      await page.evaluate(() => (document.querySelector('[data-act="play"]') ?? document.querySelector('[data-act="day-continue"]'))?.click());
      clicks++;
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(50);
    if (Date.now() - tp > 240000) break;
  }
  const ok = await page.evaluate(() => document.querySelector('#app')?.className.includes('app-prep'));
  if (!ok) { await page.screenshot({ path: `${process.env.OUT ?? '/tmp'}/c81c-stall-${i}.png` }); console.log('stall', await page.evaluate(() => document.querySelector('#app')?.className)); break; }
  const play = Date.now() - lastClick;
  const days = await page.evaluate((k) => globalThis.__progress.slice(k), g0.prog);
  const p1 = await page.evaluate(() => globalThis.__pool?.());
  const dayInfo = { days: days.length, dayMs: days.reduce((t, d) => t + d.ms, 0), matches: days.reduce((t, d) => t + d.matches, 0), workerBusyMs: (p1?.busyMs ?? 0) - g0.busy, jobs: (p1?.jobs ?? 0) - g0.jobs, hits: (p1?.hits ?? 0) - g0.hits };
  const playAll = Date.now() - tp;
  await page.waitForTimeout(PREP_MS);
  const pool0 = await page.evaluate(() => globalThis.__pool?.());
  const ts = Date.now();
  await page.evaluate(() => document.querySelector('[data-act="prep-start"]')?.click());
  const ok2 = await page.waitForFunction((n) => globalThis.__matchPerf.length > n, n0, { timeout: 120000, polling: 20 }).then(() => true, () => false);
  if (!ok2) { await page.screenshot({ path: `${process.env.OUT ?? '/tmp'}/c81c-stall2-${i}.png` }); console.log('stall2', await page.evaluate(() => document.querySelector('#app')?.className)); break; }
  const start = Date.now() - ts;
  const perf = await page.evaluate(() => globalThis.__matchPerf.at(-1));
  const after = await page.evaluate(() => { const g = globalThis.__game(); const f = g.league.schedule.flat(); return { date: g.calendar.date, round: g.league.round, done: f.filter((x) => x.homeGoals !== undefined).length, goals: f.reduce((t, x) => t + (x.homeGoals ?? 0) * 3 + (x.awayGoals ?? 0), 0), me: [g.player.season.goals, g.player.season.assists, g.player.level] }; });
  const pool = await page.evaluate(() => globalThis.__pool?.());
  rows.push({ i, after, clicks, play, playAll, dayInfo, start, perf, hits: (pool?.hits ?? 0) - (pool0?.hits ?? 0) });
  console.log(JSON.stringify(rows.at(-1)));
  await page.waitForTimeout(500);
  await page.waitForFunction(() => (globalThis.__saveLog ?? []).length >= 0);
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
// 게임 진행 지문 (전후 같은 시드면 같아야 한다): 내 리그·다른 리그 결과 · 내 시즌 기록 · 레벨
const fp = await page.evaluate(() => {
  const g = globalThis.__game();
  const s = JSON.stringify([g.calendar.date, g.league.schedule.map((r) => r.map((f) => [f.homeGoals, f.awayGoals])), (g.otherLeagues ?? []).map((l) => l.schedule.map((r) => r.map((f) => [f.homeGoals, f.awayGoals]))), g.player.season, g.player.level, g.player.xp]);
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${g.calendar.date}:${(h >>> 0).toString(16)}:${s.length}`;
});
console.log(JSON.stringify({ rate: RATE, fp, n: N, firstStart: rows[0]?.start, medStart: med(rows.slice(1).map((r) => r.start)), medPlay: med(rows.slice(1).map((r) => r.play)), medCycle: med(rows.slice(1).map((r) => r.play + r.start)), medOthers: med(rows.slice(1).map((r) => r.perf.others ?? 0)), medEngine: med(rows.slice(1).map((r) => r.perf.engine ?? 0)), medPaint: med(rows.slice(1).map((r) => (r.perf.render ?? 0) + (r.perf.paint ?? 0))), saveLog: await page.evaluate(() => globalThis.__saveLog.slice(-5)), errors, totalS: Math.round((Date.now() - t00) / 1000) }));
await browser.close();
