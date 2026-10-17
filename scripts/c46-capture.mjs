// 구단 재정·로스터 인원 확인 캡처 (부록 C.46): 월드 순위표 재정 등급 → 선수 화면 계약·몸값 → 남은 시즌 자동 → 이적 제안(등급·몸값) → 월드 이적 소식(몸값)
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c46-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c46-check/', import.meta.url).pathname;
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
await page.fill('#f-seed', process.env.SEED ?? 'c46-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(300);
await act('start');
await page.waitForTimeout(500);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');

// 월드 순위표 (재정 등급)
await act('go-tab', '[data-v="world"]');
await page.waitForTimeout(300);
await dismiss();
await shot('1_월드-순위표-재정등급');
report.table = await text('.tbl.league');

// 선수 화면 계약·몸값
await act('go-tab', '[data-v="player"]');
await page.waitForTimeout(300);
await dismiss();
await scrollTo('[data-act="transfer-request"]');
await shot('2_선수화면-계약-몸값');
report.contract = await page.locator('[data-act="transfer-request"]').first().evaluate((b) => b.closest('.panel').innerText.replace(/\s+/g, ' '));

// 남은 시즌 자동 → 시즌 종료 → 이적 제안
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(200);
await act('sim-rest');
await act('auto-count', `[data-v]:last-child`);
await act('auto-run');
{ const t0 = Date.now(); await page.waitForTimeout(1000); while (Date.now() - t0 < 600000 && (await has('.auto-layer'))) await page.waitForTimeout(300); }
await page.waitForTimeout(500);
await dismiss();
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
await dismiss();
if (await has('[data-to="offers"]')) {
  await act('go', '[data-to="offers"]');
  await page.waitForTimeout(300);
  await shot('3_이적제안-재정등급-몸값');
  await shot('3b_이적제안-전체', true);
  report.offers = await page.locator('.tr-offer').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
  report.hero = await text('.po-hero');
}
// 월드 이적 소식 (몸값·재정 등급)
await act('go-tab', '[data-v="world"]');
await page.waitForTimeout(300);
await dismiss();
await act('world-tab', '[data-v="transfers"]');
await page.waitForTimeout(300);
await shot('4_월드-이적소식-몸값');
await shot('4b_월드-이적소식-전체', true);
report.news = await text('.po-section');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log('errors', errors.length);
await browser.close();
