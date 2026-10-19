// C.61 확인 캡처 (U5-g PC 2열 + B PC 홈·독): PC 1280×800 위주 + 폰 390 비교. 홈 · 선수 5탭 · 설정 · 카드 이미지 · 새 게임 커스텀 · 결정 순간 · 경기 결과 · (SEASON=1) 시즌 종료.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c61-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b) SEASON=1
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c61-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 1280);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 800) }, colorScheme: 'dark', deviceScaleFactor: 1 });
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
const go = async (v) => { if (['settings', 'world', 'deck', 'saves'].includes(v) && await page.locator('[data-act="dock-more"]:visible').count()) { await act('dock-more'); await page.waitForTimeout(300); } await act('go-tab', `[data-v="${v}"]`); await page.waitForTimeout(400); await dismiss(); await page.evaluate(() => document.fonts.ready); };
const fresh = async () => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await skin();
  await act('go', '[data-to="new"]');
  await page.waitForTimeout(300);
};
const started = async () => {
  await page.waitForTimeout(800);
  if (await has('[data-act="tips-off"]')) await act('tips-off');
  await dismiss();
  if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
};

// ── 새 게임 커스텀 (151): 태그 단계 ──
await fresh();
await page.fill('#f-seed', 'c61-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(200);
await act('form', '[data-k="mode"][data-v="custom"]');
await page.waitForTimeout(300);
await page.fill('#f-name', '이도윤');
await page.locator('#f-name').dispatchEvent('change');
await shot('151_새게임-커스텀-기본');
await measure('custom1');
for (let k = 2; k <= 4; k++) { await act('cu-step', `[data-v="${k}"]`); await page.waitForTimeout(250); }
await top();
await shot('151_새게임-커스텀-태그');
await shot('151_새게임-커스텀-태그_전체', true);
await measure('custom4');
await act('cu-step', '[data-v="1"]');
await page.waitForTimeout(250);
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
await shot('115_새게임-실제선수');
await measure('newReal');
// ── 손흥민 새 게임 ──
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
await page.waitForTimeout(200);
await act('start');
await started();
await page.evaluate(() => document.fonts.ready);
await waitImgs();
await top();
await shot('120_PC-홈');
await shot('120_PC-홈_전체', true);
await measure('home');
// ── 선수 5탭 (121 · 153) ──
await go('player');
await waitImgs();
for (const [t, n] of [['attrs', '121_선수-능력치'], ['body', '153_선수-몸태그'], ['pos', '121_선수-포지션'], ['record', '121_선수-기록'], ['contract', '121_선수-계약']]) {
  if (W < 1024 || t !== 'attrs') await act('player-tab', `[data-v="${t}"]`);
  await page.waitForTimeout(300);
  await top();
  await shot(n);
  if (t === 'pos' || t === 'attrs') await shot(`${n}_전체`, true);
  await measure(`player_${t}`);
}
// ── 설정 (152) ──
await go('settings');
await top();
await shot('152_설정');
await measure('settings');
await page.locator('[data-act="set-page"][data-v="cardart"]').first().evaluate((b) => b.click());
await page.waitForTimeout(400);
await waitImgs();
await top();
await shot('152_설정-카드이미지');
await measure('settingsCards');
if (await has('.ca-row, [data-act="ca-open"]')) { await page.locator('[data-act="ca-open"]').first().click().catch(() => {}); await page.waitForTimeout(400); await top(); await shot('152_설정-카드이미지-편집'); }
// ── 경기: 결정 순간 (122) → 결과 ──
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
await dismiss();
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await page.waitForTimeout(400);
await top();
await shot('156_경기준비');
await measure('prep');
await act('prep-start');
let momentShot = false;
for (let k = 0; k < 400; k++) {
  if (await has('main.screen-match .mr-head')) break;
  if (await has('[data-act="mo-auto"]')) {
    if (!momentShot) { await page.waitForTimeout(600); await shot('122_PC-결정순간'); momentShot = true; await measure('moment'); }
    await act('mo-auto');
  }
  await page.waitForTimeout(500);
}
await page.waitForTimeout(800);
await dismiss();
if (await has('[data-act="more"][data-v="dec"]')) { await act('more', '[data-v="dec"]'); await page.waitForTimeout(300); }
await top();
await shot('117_경기결과');
await shot('117_경기결과_전체', true);
await measure('result');
if (process.env.SEASON) {
  await page.evaluate(() => { const g = window.__game(); g.market.contract.until = g.league.season; });
  await act('go-tab', '[data-v="home"]');
  await page.waitForTimeout(300);
  await dismiss();
  await act('sim-rest');
  await page.waitForTimeout(300);
  await act('auto-count', '[data-v]:last-child');
  await act('auto-run');
  { const t0 = Date.now(); await page.waitForTimeout(1000); while (Date.now() - t0 < 1500000 && (await has('.auto-layer'))) await page.waitForTimeout(500); }
  await page.waitForTimeout(800);
  await dismiss();
  await act('go-tab', '[data-v="home"]');
  await page.waitForTimeout(500);
  await dismiss();
  if (await has('[data-act="go"][data-to="season"]')) await act('go', '[data-to="season"]');
  await page.waitForTimeout(600);
  await dismiss();
  await top();
  await shot('123_PC-시즌종료');
  await shot('123_PC-시즌종료_전체', true);
  await measure('season');
  if (await has('[data-act="season-tab"][data-v="months"]')) { await act('season-tab', '[data-v="months"]'); await page.waitForTimeout(400); await top(); await shot('123_PC-시즌상세-월별'); await measure('seasonDetail'); }
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
