// C.60 확인 캡처 (U5-f): 카드 획득 85 · 덱 116/144 · 경기 결과 117/155 · 월드 101~105/146~148 · 세이브 119/149 · 시즌 종료 106~112 · 이적 제안 97/98/145. B 기본, SKIN=a 면 A
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c60-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c60-check/', import.meta.url).pathname;
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
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off', 'offer-accept-ok', 'modal-close'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); };
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
  if (!(await has(`[data-act="form"][data-k="realId"][data-v="${id}"]`))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
  await page.locator(`[data-act="form"][data-k="realId"][data-v="${id}"]`).first().click();
  await page.waitForTimeout(200);
  await act('start');
  await page.waitForTimeout(800);
  if (await has('[data-act="tips-off"]')) await act('tips-off');
  await dismiss();
  if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
}


const go = async (v) => { if (['settings', 'world', 'deck', 'saves'].includes(v) && await page.locator('[data-act="dock-more"]:visible').count()) { await act('dock-more'); await page.waitForTimeout(300); } await act('go-tab', `[data-v="${v}"]`); await page.waitForTimeout(400); await dismiss(); await page.evaluate(() => document.fonts.ready); };
const heroInfo = () => page.evaluate(() => { const n = document.querySelector('.po-hero__name'); const f = document.querySelector('.po-hero__face');
  return { face: !!f, square: f?.classList.contains('is-square') ?? null, fontPx: n && parseFloat(getComputedStyle(n).fontSize), overflow: n ? n.scrollWidth - n.clientWidth : null, height: document.documentElement.scrollHeight }; });
const len = () => page.evaluate(() => document.documentElement.scrollHeight);



const SKIN = process.env.SKIN ?? 'b';
const skin = async () => { if (SKIN === 'a') await page.evaluate(() => { localStorage.setItem('po-skin', 'a'); document.documentElement.dataset.skin = 'a'; }); };
const top = () => page.evaluate(() => window.scrollTo(0, 0));

await newGameReal('son', 'c60-check');
await skin();
await page.evaluate(() => document.fonts.ready);
// ── 카드 획득 85 · 덱 116/144: 보상 2개, 그림 있는 카드·없는 카드·못 쓰는 카드(포지션) 섞기 ──
await page.evaluate(() => {
  const g = window.__game();
  const own = ['sig-targetMan', 'elastico', 'sig-anchor', 'sig-classic10'];
  for (const id of own) g.cards.owned[id] = Math.max(1, g.cards.owned[id] ?? 0);
  const d = g.cards.decks[g.cards.active];
  g.cards.decks[g.cards.active] = [...own, ...d].slice(0, 13);
  g.cards.picks.push({ label: '레벨 5 보상', options: ['elastico', 'sig-targetMan', 'sig-anchor'] });
});
await go('deck');
await waitImgs();
await shot('85_카드획득-3택1');
await act('pick-sel', '[data-v="0"]');
await page.waitForTimeout(300);
await shot('85_카드획득-고름');
report.pickCards = await page.locator('.gc-pick .po-card').count();
await act('more', '[data-v="pickLater"]');
await page.waitForTimeout(400);
await waitImgs();
await top();
await shot('116_덱편집');
await shot('144_덱편집-그림섞임_전체', true);
report.deckReasons = await page.locator('.gc-grid .po-card__reason').allInnerTexts();
report.deckLen = await len();
// ── 경기 한 판 → 결과 155 · 117 ──
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
await dismiss();
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await page.waitForTimeout(400);
await act('prep-start');
for (let k = 0; k < 400; k++) {
  if (await has('main.screen-match .mr-head')) break;
  if (await has('[data-act="mo-auto"]')) await act('mo-auto');
  await page.waitForTimeout(500);
}
await page.waitForTimeout(800);
await dismiss();
await top();
await shot('155_경기결과-하이라이트버튼');
if (await has('[data-act="more"][data-v="dec"]')) { await act('more', '[data-v="dec"]'); await page.waitForTimeout(300); }
await page.waitForTimeout(500);
await shot('117_경기결과_전체', true);
report.resultLen = await len();
report.avgDir = await page.locator('#avg-dir').innerText().catch(() => null);
// ── 세이브 119 · 149 ──
await go('saves');
await act('save', '[data-slot="1"]');
await page.waitForTimeout(1200);
await top();
await shot('119_세이브-슬롯');
await act('ex-cards');
await page.waitForTimeout(300);
await shot('149_세이브-카드이미지포함', true);
// ── 월드 101 · 102 · 103 · 105 (시즌 초) ──
await go('world');
await top();
await shot('101_146_월드-순위표');
await shot('146_월드-순위표_전체', true);
await act('world-tab', '[data-v="scorers"]');
await page.waitForTimeout(300);
await shot('102_월드-득점');
await act('world-tab', '[data-v="stars"]');
await page.waitForTimeout(300);
await waitImgs();
await shot('103_147_월드-리그스타_전체', true);
await act('world-tab', '[data-v="transfers"]');
await page.waitForTimeout(300);
await shot('105_월드-이적소식-빈상태');
if (process.env.NOSEASON) { writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1)); console.log(JSON.stringify(report, null, 1)); await browser.close(); process.exit(0); }
// ── 시즌 끝까지 자동 진행 (계약 마지막 해 → 비시즌 제안) ──
await page.evaluate(() => { const g = window.__game(); g.market.contract.until = g.league.season; });
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');
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
await shot('홈-시즌끝');
report.phase = await page.evaluate(() => window.__game()?.phase ?? null);
// 시즌 요약 (106)
if (await has('[data-act="go"][data-to="season"]')) await act('go', '[data-to="season"]');
else await page.evaluate(() => { document.querySelector('[data-act="go-tab"][data-v="prog"], .dock-prog')?.click(); });
await page.waitForTimeout(600);
await dismiss();
report.seasonScreen = await page.evaluate(() => document.querySelector('main')?.className);
await top();
await shot('106_시즌종료-요약');
await shot('106_시즌종료-요약_전체', true);
report.seasonLen = await len();
if (await has('[data-act="season-tab"][data-v="matches"]')) {
  await act('season-tab', '[data-v="matches"]');
  await page.waitForTimeout(400);
  const tabs = [['matches', '107_시즌상세-경기별'], ['months', '108_시즌상세-월별'], ['positions', '109_시즌상세-포지션별'], ['awards', '110_시즌상세-리그시상'], ['transfers', '111_시즌상세-이적소식'], ['growth', '112_시즌상세-성장위상']];
  for (const [v, name] of tabs) { await act('season-tab', `[data-v="${v}"]`); await page.waitForTimeout(300); await top(); await shot(name); }
  report.tabClip = await page.evaluate(() => [...document.querySelectorAll('.po-tabs--grid .po-tab span')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
  await act('season-tab', '[data-v="close"]');
  await page.waitForTimeout(300);
}
// 이적 제안 97 · 145 · 98
if (await has('.season-todo[data-to="offers"]')) {
  await page.locator('.season-todo').first().click();
  await page.waitForTimeout(500);
  await dismiss();
  await top();
  await shot('145_이적제안-목록');
  await shot('145_이적제안-목록_전체', true);
  report.offers = await page.locator('.po-offer, .tr-row').count();
  if (await has('.tr-row')) { await page.locator('.tr-row').first().click(); await page.waitForTimeout(300); await shot('97_이적제안-다른제안펼침', true); }
  await page.locator('.po-offer [data-act="offer-accept"]').first().click();
  await page.waitForTimeout(400);
  await shot('98_이적제안-수락확인');
  await page.locator('.po-modal__actions [data-act="modal-close"]').click();
  await page.waitForTimeout(300);
}
// 월드 이적 소식 (여름 이적시장 뒤) 104 · 148
await go('world');
await act('world-tab', '[data-v="transfers"]');
await page.waitForTimeout(400);
await waitImgs();
await top();
await shot('104_148_월드-이적소식');
await shot('148_월드-이적소식_전체', true);
report.news = await page.locator('.po-xfer').count();
report.tagNews = await page.locator('.tag-news__row').count();
report.wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
report.broken404 = broken.filter((b) => b.startsWith('404'));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
