// 성장 포인트 칸 단위 확인 캡처 (부록 C.49, pending 80): 포인트 찍기 화면·홈 배지·약발 강화 버튼.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c49-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
// 남은 포인트는 window.__game() 상태를 고쳐 강제한다 (하네스)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c49-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
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
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}`).first().click(); };
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

await newGameReal('kane', 'c49-check');
await page.evaluate(() => { const g = window.__game(); g.player.unspentPoints = 12; if (!g.guide.unlocked.includes('growth')) g.guide.unlocked.push('growth'); });
await act('go-tab', '[data-v="player"]');
await page.waitForTimeout(300);
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(400);
await dismiss();
await shot('1_홈-포인트-배지');
await act('go-tab', '[data-v="player"]');
await page.waitForTimeout(400);
await dismiss();
await scrollTo('[data-act="buy-weakfoot"]');
await shot('2_선수-약발강화-10P');
// 포인트 찍기 진입 (경기 결과·시즌 화면 버튼과 같은 동작)
await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'go'; b.dataset.to = 'allocate'; b.id = 'cap-alloc'; document.getElementById('app').append(b); b.click(); });
await page.waitForTimeout(400);
await dismiss();
await shot('3_포인트찍기-위');
const cell = page.locator('.ag-cell.is-key.is-edit').first();
await cell.click();
await page.waitForTimeout(200);
for (let k = 0; k < 2; k++) { await page.locator('.ag-cell.is-sel [data-act="raise"]').click(); await page.waitForTimeout(150); }
await scrollTo('.ag-cell.is-sel');
await shot('4_포인트찍기-한칸씩-2번');
// 비싼 칸 (3P) 고르기: 화면 18 이상 핵심 능력치
const hi = page.locator('.ag-cell.is-edit.ag-t5').first();
if (await hi.count()) { await hi.click(); await page.waitForTimeout(200); await scrollTo('.ag-cell.is-sel'); await shot('5_포인트찍기-높은칸-비용'); }
await act('alloc-done');
await page.waitForTimeout(300);
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
await browser.close();
