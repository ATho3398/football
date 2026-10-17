// 레전드 팩·커리어 태그 확인 캡처 (부록 C.47): 새 게임 레전드 팩 스위치 → 실제 선수 목록 "레전드" 묶음 → 레전드로 시작 → 선수 화면 태그 줄 → 남은 시즌 자동 → 홈 태그 알림 → 월드 리그 스타 레전드·커리어 태그 소식
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c47-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c47-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
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
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off', 'sim-rest-ok', 'offer-accept-ok', 'transfer-request-ok'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}`).first().click(); };
async function idle(timeout = 900_000) {
  const end = Date.now() + timeout;
  let quiet = 0;
  while (Date.now() < end && quiet < 15) {
    quiet = (await has('[data-act="sim-stop"]')) ? 0 : quiet + 1;
    await page.waitForTimeout(100);
  }
}
const text = async (sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ');
const report = { errors };
const scrollTo = async (sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();

await act('go', '[data-to="new"]');
await page.fill('#f-seed', process.env.SEED ?? 'c47-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(300);
await act('form', '[data-k="legends"][data-v="on"]');
await page.waitForTimeout(300);
await scrollTo('[data-k="legends"]');
await shot('1_새게임-레전드팩-켬');
await act('form', '[data-k="mode"][data-v="real"]');
await page.waitForTimeout(500);
await scrollTo('.legend-list');
await shot('2_실제선수-레전드-묶음');
report.legendRows = await page.locator('.legend-list .real-row').count();
await act('form', '[data-k="realId"][data-v="lg-zidane"]');
await page.waitForTimeout(300);
await act('start');
await page.waitForTimeout(800);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');

// 선수 화면 태그 줄
await act('go-tab', '[data-v="player"]');
await page.waitForTimeout(300);
await dismiss();
await scrollTo('.body-chips');
await shot('3_선수화면-태그줄');
report.tags = await text('.body-chips');

// 남은 시즌 자동 → 홈 태그 알림
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(200);
await act('sim-rest');
await act('auto-count', `[data-v]:last-child`);
await act('auto-run');
{ const t0 = Date.now(); await page.waitForTimeout(1000); while (Date.now() - t0 < 900000 && (await has('.auto-layer'))) await page.waitForTimeout(300); }
await page.waitForTimeout(500);
await dismiss();
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
await dismiss();
await shot('4_홈-태그알림');
report.home = await text('.body');

// 월드 리그 스타 레전드, 커리어 태그 소식
await act('go-tab', '[data-v="world"]');
await page.waitForTimeout(300);
await dismiss();
await act('world-tab', '[data-v="stars"]');
await page.waitForTimeout(300);
await scrollTo('.po-section');
await shot('5_월드-레전드');
await act('world-tab', '[data-v="transfers"]');
await page.waitForTimeout(300);
await shot('6_월드-커리어태그소식', true);
report.news = await page.locator('.po-section').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log('errors', errors.length);
await browser.close();
