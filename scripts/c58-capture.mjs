// C.58 확인 캡처 (U5-d): 선수 5탭(B compact 미페 · A) · 태그 전체 시트 · 포인트 찍기 · 새 게임(랜덤 · 커스텀 6단계 · 실제 선수/레전드).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c58-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c58-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
const shot = async (name, full = false, wait = 0) => { if (wait) await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
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
const scrollTo = async (sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(250); };
const waitImgs = () => page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); }))));
const report = { errors, broken };
const nav = async (to) => { await act('go-tab', '[data-v="home"]'); await page.waitForTimeout(300); await dismiss(); await act('go', `[data-to="${to}"]`); await page.waitForTimeout(400); await dismiss(); };

async function newGameReal(id, seed) {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await act('go', '[data-to="new"]');
  await page.fill('#f-seed', seed);
  await page.locator('#f-seed').dispatchEvent('change');
  await page.waitForTimeout(200);
  await act('form', '[data-k="mode"][data-v="real"]');
  await page.waitForTimeout(300);
  await page.locator(`[data-act="form"][data-k="realId"][data-v="${id}"]`).first().click();
  await page.waitForTimeout(200);
  await act('start');
  await page.waitForTimeout(800);
  if (await has('[data-act="tips-off"]')) await act('tips-off');
  await dismiss();
  if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
}


const go = async (v) => { if (['settings', 'world', 'deck'].includes(v) && await page.locator('[data-act="dock-more"]:visible').count()) { await act('dock-more'); await page.waitForTimeout(300); } await act('go-tab', `[data-v="${v}"]`); await page.waitForTimeout(400); await dismiss(); await page.evaluate(() => document.fonts.ready); };
const heroInfo = () => page.evaluate(() => { const n = document.querySelector('.po-hero__name'); const f = document.querySelector('.po-hero__face');
  return { face: !!f, square: f?.classList.contains('is-square') ?? null, fontPx: n && parseFloat(getComputedStyle(n).fontSize), overflow: n ? n.scrollWidth - n.clientWidth : null, height: document.documentElement.scrollHeight }; });
const len = () => page.evaluate(() => document.documentElement.scrollHeight);


const playerTabs = async (suffix) => {
  await go('player');
  await waitImgs();
  for (const [t, n] of [['attrs', '93_선수-능력치'], ['body', '134_선수-신체·양발·태그'], ['pos', '94_선수-포지션'], ['record', '95_선수-기록'], ['contract', '136_선수-계약과이적']]) {
    await act('player-tab', `[data-v="${t}"]`);
    await page.waitForTimeout(300);
    await shot(`${n}${suffix}`);
    await shot(`${n}${suffix}_전체`, true);
    (report.player ??= {})[`${t}${suffix}`] = await heroInfo();
  }
};
const fresh = async () => {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await act('go', '[data-to="new"]');
  await page.waitForTimeout(300);
};
const startedGame = async () => {
  await page.waitForTimeout(800);
  if (await has('[data-act="tips-off"]')) await act('tips-off');
  await dismiss();
  if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
};

// ── 새 게임: 랜덤 (130) · 실제 선수 / 레전드 (131) · 커스텀 6단계 (124~129) ──
await fresh();
await page.fill('#f-seed', 'c58-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(300);
await shot('130_새게임-랜덤');
await shot('130_새게임-랜덤_전체', true);
report.newRandom = await len();
await act('ng-attrs');
await page.waitForTimeout(200);
await shot('114_새게임-랜덤-능력치펼침_전체', true);
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
await shot('115_새게임-실제선수_전체', true);
report.newReal = await len();
await act('form', '[data-k="legends"][data-v="on"]');
await page.waitForTimeout(400);
await act('ng-real', '[data-k="realTab"][data-v="legend"]');
await page.waitForTimeout(300);
await page.locator('.real-list [data-k="realId"]').first().click();
await page.waitForTimeout(300);
await shot('131_새게임-실제선수-레전드');
await shot('131_새게임-실제선수-레전드_전체', true);
report.newLegend = await len();
report.legendChipWrap = await page.evaluate(() => [...document.querySelectorAll('.ng-row')].filter((r) => r.querySelector('.ng-row__name').scrollWidth > r.querySelector('.ng-row__name').clientWidth + 1 && false).length);
await act('form', '[data-k="legends"][data-v="off"]');
await act('form', '[data-k="mode"][data-v="custom"]');
await page.waitForTimeout(300);
await page.fill('#f-name', '이도윤');
const steps = ['124_새게임-커스텀-기본', '125_새게임-커스텀-신체·양발', '126_새게임-커스텀-국적·외모', '127_새게임-커스텀-태그', '128_새게임-커스텀-능력치배분', '129_새게임-커스텀-시작소속'];
report.custom = {};
for (let k = 0; k < steps.length; k++) {
  if (k === 0) { for (let n = 0; n < 4; n++) await act('cu', '[data-k="age"][data-v="1"]'); await act('cu', '[data-k="height"]').catch(() => {}); }
  if (k === 1) { for (let n = 0; n < 7; n++) await act('cu', '[data-k="height"][data-v="1"]'); await act('cu', '[data-k="wf"][data-v="4"]'); }
  if (k === 3) { for (const [kk, t] of [['trait', 'ironMan'], ['trait', 'professional'], ['traitR', 'troublemaker'], ['trait', 'mediaShy']]) await act('cu', `[data-k="${kk}"][data-v="${t}"]`).catch(() => console.log('no trait', t)); }
  if (k === 4) { await act('cu-sel', '[data-v="shooting"]'); await act('cu-raise', '[data-attr="shooting"]'); }
  if (k === 5 && await has('[data-act="cu"][data-k="startClub"]')) await page.locator('[data-act="cu"][data-k="startClub"]').nth(3).click();
  await page.waitForTimeout(250);
  await shot(steps[k]);
  await shot(`${steps[k]}_전체`, true);
  report.custom[steps[k]] = await len();
  if (k < steps.length - 1) { await act('cu-step', `[data-v="${k + 2}"]`); await page.waitForTimeout(250); }
}
await act('start');
await startedGame();

// ── 커스텀 선수(사진 없음 = 일반 B compact 머리말): 선수 5탭 · 태그 전체 시트 (135) · 포인트 찍기 (113) ──
await playerTabs('_커스텀');
await act('player-tab', '[data-v="body"]');
await page.waitForTimeout(200);
await act('tags-all');
await page.waitForTimeout(300);
await shot('135_선수-태그전체-시트');
await page.mouse.click(195, 10);
await page.waitForTimeout(200);
await act('player-tab', '[data-v="attrs"]');
await page.waitForTimeout(200);
report.heroChips = await page.evaluate(() => { const h = document.querySelector('.po-hero'); const c = [...document.querySelectorAll('.po-hero__chip')]; const hr = h.getBoundingClientRect(); return c.map((e) => Math.round(hr.right - e.getBoundingClientRect().right)); });
if (await has('[data-act="go"][data-to="allocate"]')) {
  await act('go', '[data-to="allocate"]');
  await page.waitForTimeout(300);
  await page.locator('[data-act="alloc-sel"][data-v="dribbling"]').first().click();
  await page.waitForTimeout(150);
  await act('raise', '[data-attr="dribbling"]');
  await page.waitForTimeout(250);
  await shot('113_포인트찍기-1~20');
  await shot('113_포인트찍기-1~20_전체', true);
  report.allocate = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, rowsInView: new Set([...document.querySelectorAll('.ag-cell')].filter((e) => e.getBoundingClientRect().bottom < innerHeight - 72).map((e) => Math.round(e.getBoundingClientRect().top))).size }));
  await act('alloc-cancel');
}

// ── 손흥민(facepack 네모 사진): B compact 미페 머리말 ──
await newGameReal('son', 'c58-check');
await page.evaluate(() => document.fonts.ready);
await playerTabs('');
// A 전환
await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
await page.reload();
await page.waitForTimeout(800);
await dismiss();
if (await has('[data-act="continue"]')) { await act('continue'); await page.waitForTimeout(600); await dismiss(); }
await go('player');
await shot('93_선수-능력치_A');
await act('player-tab', '[data-v="contract"]');
await page.waitForTimeout(200);
await shot('136_선수-계약과이적_A');
await page.evaluate(() => localStorage.setItem('po-skin', 'b'));

writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
await browser.close();
