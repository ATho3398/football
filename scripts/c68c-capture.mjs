// C.68c 확인 캡처: 카드 그림 61장 + 기본 위치표(full·mini, flip·rotate, 1:1 원본). 카드 상세 큰 카드 · 덱 작은 카드 · 경기 준비 덱 줄 · 경기 중 패 · 그림 없는 카드(기본 장면).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c68c-capture.mjs <playwright 경로> <저장 폴더>. 환경: W H PREFIX
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c68c-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
const shot = async (name, full = false) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); };
const scrollTo = async (sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(250); };
const nav = async (to) => { await act('go-tab', '[data-v="home"]'); await page.waitForTimeout(300); await dismiss(); await act('go', `[data-to="${to}"]`); await page.waitForTimeout(400); await dismiss(); };
const report = { W, H, errors, broken };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await act('go', '[data-to="new"]');
await page.fill('#f-seed', 'c68c-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(200);
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
await page.locator('[data-act="form"][data-k="realId"][data-v="kane"]').first().click();
await act('start');
await page.waitForTimeout(800);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');

// 감아차기(기본)·프리킥 크로스(flip)·롱패스 전환(간략 rotate −16)·파넨카(4:3)·리셋(x0 y0) + 그림 없는 카드(오프사이드 트랩·감독의 신뢰·시그니처 리베로)
const OWN = ['curler', 'fkCross', 'switchLong', 'panenka', 'reset', 'offsideTrap', 'dirTrust', 'sig-libero', 'sig-targetMan', 'noLook', 'chip'];
report.deck = await page.evaluate((own) => {
  const g = window.__game();
  for (const id of own) g.cards.owned[id] = Math.max(1, g.cards.owned[id] ?? 0);
  const d = g.cards.decks[g.cards.active];
  g.cards.decks[g.cards.active] = [...own.slice(0, 8), ...d.filter((x) => !own.includes(x))].slice(0, 14);
  return g.cards.decks[g.cards.active];
}, OWN);
await nav('deck');
await scrollTo('.gc-grid');
await shot('2_덱-작은카드-mini');
await shot('2b_덱-전체', true);
for (const [id, name] of [['curler', '감아차기-기본'], ['fkCross', '프리킥크로스-flip'], ['switchLong', '롱패스전환'], ['panenka', '파넨카-4대3'], ['reset', '리셋-x0y0'], ['offsideTrap', '오프사이드트랩-그림없음']]) {
  await page.locator(`[data-act="card-open"][data-v="${id}"]`).first().click({ force: true });
  await page.waitForTimeout(500);
  await shot(`1_상세-${name}`);
  await act('card-close', '.po-btn');
  await page.waitForTimeout(200);
}
report.images = await page.evaluate(() => [...document.querySelectorAll('.po-art-g image')].length);

// 경기 준비 덱 줄 → 경기 중 패
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await page.waitForTimeout(400);
await dismiss();
if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
await page.evaluate(() => window.scrollTo(0, 0));
await shot('3_경기준비');
if (await has('.prep-deck, .pp-deck, [class*="deck"] .po-card--mini')) { await scrollTo('.po-card--mini'); await shot('3b_경기준비-덱줄'); }
if (W < 600) await page.setViewportSize({ width: H, height: W }); // 경기장만 가로 (C.66b)
await act('prep-start');
for (let n = 0; n < 40; n++) {
  await page.waitForSelector('[data-act="mo-confirm"], [data-act="oc-skip"], main.screen-match', { timeout: 180_000 });
  if (await page.evaluate(() => !!document.querySelector('main.screen-match'))) break;
  await page.waitForTimeout(1600);
  await dismiss();
  if (!(await has('[data-act="mo-confirm"]'))) { if (await has('[data-act="oc-skip"]')) await act('oc-skip'); await page.waitForTimeout(300); continue; }
  if (await has('.po-card--hand')) {
    await shot('4_경기중-패-hand');
    report.hand = await page.locator('.po-card--hand').evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label')}${e.querySelector('.po-art-g') ? ' [그림]' : ''}`));
    break;
  }
  await shot('4_경기중-결정순간'); break;
}
report.wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
await browser.close();
