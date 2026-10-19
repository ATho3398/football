// C.62 확인 캡처 (35단계 5-1 감독 신뢰도·면담): 홈 주전 경쟁 카드(22) · 감독 면담 보상(45)·낮은 신뢰·포지션 제안 · 팀 상세 감독·홈구장(157) · 경기 준비 선발 확률 · (SEASON=1) 시즌 요약 티어 배지.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c62-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b) SEASON=1
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c62-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
const shot = async (name, full = false) => { await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); };
const waitImgs = () => page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); }))));
const len = () => page.evaluate(() => document.documentElement.scrollHeight);
const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const report = { errors, broken, len: {}, wide: {} };
const measure = async (k) => { report.len[k] = await len(); report.wide[k] = await wide(); };
const SKIN = process.env.SKIN ?? 'b';
const skin = async () => { if (SKIN === 'a') await page.evaluate(() => { localStorage.setItem('po-skin', 'a'); document.documentElement.dataset.skin = 'a'; }); };
const home = async () => { await act('go-tab', '[data-v="home"]'); await page.waitForTimeout(400); await dismiss(); };
const scrollTo = (sel) => page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await skin();
await act('go', '[data-to="new"]');
await page.waitForTimeout(300);
await page.fill('#f-seed', 'c62-check');
await page.locator('#f-seed').dispatchEvent('change');
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
await page.waitForTimeout(200);
await act('start');
await page.waitForTimeout(800);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
// 3경기 자동 진행 → 신뢰도 변화가 쌓인다
await home();
await act('sim-rest');
await page.waitForTimeout(300);
await act('auto-count', '[data-v="3"]');
await act('auto-run');
{ const t0 = Date.now(); await page.waitForTimeout(1000); while (Date.now() - t0 < 600000 && (await has('.auto-layer'))) await page.waitForTimeout(500); }
await page.waitForTimeout(800);
await dismiss();
// 경기 다음 날이면 하루 넘겨 면담할 수 있는 날로
await home();
for (let k = 0; k < 3 && (await has('[data-act="play"]')); k++) { await act('sim-rest'); await page.waitForTimeout(300); await act('auto-count', '[data-v="1"]'); await act('auto-run'); await page.waitForTimeout(3000); while (await has('.auto-layer')) await page.waitForTimeout(500); await home(); }
await waitImgs();
await page.evaluate(() => document.fonts.ready);
await top();
await shot('22_홈-주전경쟁_전체', true);
await scrollTo('.mg-card');
await page.evaluate(() => window.scrollBy(0, -60));
await shot('22_홈-주전경쟁');
await measure('home');
// ── 보상 면담 (45) ──
await page.evaluate(() => { const g = window.__game(); g.manager.trust = 84; g.manager.meeting = 'reward'; });
await home();
await top();
await shot('22_홈-면담띠');
await act('go', '[data-to="meeting"]');
await page.waitForTimeout(400);
await top();
await shot('45_면담-보상');
await measure('meetReward');
await act('meet-pick', '[data-v="slot"]');
await page.waitForTimeout(200);
await act('meet-ok');
await page.waitForTimeout(600);
await top();
await shot('22_홈-면담결과');
// ── 낮은 신뢰 면담 ──
await page.evaluate(() => { const g = window.__game(); g.manager.trust = 22; g.manager.meeting = 'low'; });
await home();
await act('go', '[data-to="meeting"]');
await page.waitForTimeout(400);
await top();
await shot('45_면담-낮은신뢰');
await measure('meetLow');
// ── 포지션 제안 ──
await page.evaluate(() => { const g = window.__game(); g.manager.trust = 55; g.manager.meeting = 'position'; g.manager.posStreak = 3; window.__slot = g.tactics.mySlot; g.tactics = { ...g.tactics, mySlot: 1 }; });
await home();
await act('go', '[data-to="meeting"]');
await page.waitForTimeout(400);
await top();
await shot('45_면담-포지션제안');
await page.evaluate(() => { const g = window.__game(); g.manager.meeting = null; g.tactics = { ...g.tactics, mySlot: window.__slot }; });
// ── 팀 상세 감독·홈구장 (157) ──
await home();
await page.evaluate(() => { const b = document.querySelector('[data-act="team-open"]'); b?.click(); });
await page.waitForTimeout(600);
if (!(await has('.dt-ident'))) {
  await act('go-tab', '[data-v="world"]').catch(async () => { await act('dock-more'); await page.waitForTimeout(300); await act('go-tab', '[data-v="world"]'); });
  await page.waitForTimeout(500);
  await page.locator('[data-act="team-open"]').first().click();
  await page.waitForTimeout(600);
}
await top();
await shot('157_팀상세-감독');
await measure('team');
if (process.env.SEASON) {
  await page.evaluate(() => { const g = window.__game(); g.market.contract.until = g.league.season + 3; });
  await home();
  await act('sim-rest');
  await page.waitForTimeout(300);
  await act('auto-count', '[data-v]:last-child');
  await act('auto-run');
  { const t0 = Date.now(); await page.waitForTimeout(1000); while (Date.now() - t0 < 1500000 && (await has('.auto-layer'))) await page.waitForTimeout(500); }
  await page.waitForTimeout(800);
  await dismiss();
  await home();
  if (await has('[data-act="go"][data-to="season"]')) await act('go', '[data-to="season"]');
  await page.waitForTimeout(600);
  await dismiss();
  await top();
  await shot('106_시즌종료-티어배지');
  await measure('season');
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
