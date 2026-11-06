// C.75b 속도 측정 (44b E-1): 실제 앱 빌드로 한 시즌 자동 진행([시즌 요약으로 바로 이동] 반복) 시간을 잰다.
// 코어 수 흉내: CORES=2 면 navigator.hardwareConcurrency = 2 로 보이게 하고, 이 스크립트를 `taskset -c 0,1` 로 실행해 실제 코어도 2개로 묶는다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 CORES=2 taskset -c 0,1 node scripts/c75b-speed.mjs [playwright 모듈 경로] [결과 json]
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? 'c75b-speed.json';
const CORES = Number(process.env.CORES ?? 0);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
if (CORES) await ctx.addInitScript((n) => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => n }), CORES);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
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
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}`).first().click(); await page.waitForTimeout(250); };
const dockTab = async (v) => { await dismiss(); await page.locator(`.dock-bar [data-act="go-tab"][data-v="${v}"]`).first().click(); await page.waitForTimeout(250); };
const waitIdle = async (max = 3600000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { if (!(await has('.auto-layer'))) return; await page.waitForTimeout(300); } };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForTimeout(500);
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', process.env.SEED ?? 'c73b-check');
await act('start');
await dismiss();
// 게임 로드 뒤 사람이 화면을 보는 시간(워커 데우기 유휴 시간)
await page.waitForTimeout(Number(process.env.IDLE ?? 3000));
await act('ctl-mode', '[data-v="auto"]');
await dockTab('home');
await act('sim-rest');
const wall0 = Date.now();
await act('auto-end');
const stops = [];
for (let k = 0; k < 80; k++) {
  await waitIdle();
  await page.waitForTimeout(300);
  const screen = await page.evaluate(() => document.querySelector('main')?.className ?? '');
  stops.push(screen.replace(/.*screen-(\S+).*/, '$1'));
  if (/screen-season|screen-chapter/.test(screen)) break;
  if (/screen-offers/.test(screen) || (await has('[data-act="offers-decline"]'))) { await act('offers-decline'); await dockTab('home'); }
  else if (/screen-contract/.test(screen)) { await act('renew').catch(() => {}); await dockTab('home'); }
  else if (!/screen-home/.test(screen)) await dockTab('home');
  await act('sim-rest');
  await act('auto-end');
}
const wallMs = Date.now() - wall0;
const auto = await page.evaluate(() => globalThis.__auto);
const prog = await page.evaluate(() => globalThis.__progress);
const pool = await page.evaluate(() => globalThis.__pool?.() ?? null);
const saves = await page.evaluate(() => { const s = globalThis.__saveLog ?? []; return { n: s.length, ms: s.reduce((t, x) => t + x, 0) }; });
// 결과 지문: 시즌 순위표(승점·득실) + 모든 경기 스코어 + 내 선수 시즌 기록 — 속도만 바꿨으면 그대로여야 한다
const fp = await page.evaluate(() => {
  const g = globalThis.__game?.();
  if (!g) return null;
  const s = JSON.stringify([g.league.table, g.league.schedule.map((r) => r.map((f) => [f.homeGoals, f.awayGoals, f.g ?? null])), g.player.season, g.playerStats ?? null]);
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
});
const calcMs = auto.reduce((t, a) => t + a.ms, 0);
const played = auto.reduce((t, a) => t + a.played, 0);
const myDays = prog.filter((d) => d.my);
const firstDays = prog.filter((d) => d.matches > 0).slice(0, 3).map((d) => d.ms);
const res = { cores: CORES || 'native', errors, wallMs, calcMs, played, runs: auto.length, perMatch: Math.round(calcMs / Math.max(1, played)), firstMatchDays: firstDays, myDayAvg: Math.round(myDays.reduce((t, d) => t + d.ms, 0) / Math.max(1, myDays.length)), matches: prog.reduce((t, d) => t + d.matches, 0), stops, pool, saves, fp };
writeFileSync(OUT, JSON.stringify({ ...res, prog }, null, 1));
console.log(JSON.stringify(res));
await browser.close();
