// 이적·계약 확인 캡처 (부록 C.42): 새 게임(계약 만료로 설정) → 남은 시즌 자동 → 시즌 종료 제안 카드 → 홈 제안 카드 → 이적 제안 화면
// → 재계약 화면 → 월드 이적 소식(여름) → 제안 수락 → 이적 후 홈 → 다음 시즌 → 선수 화면 이적 요청(출전 부족으로 설정) → 확인 → 결과
// → 남은 시즌 자동이 겨울 제안에서 멈춤 → 제안 화면.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c42-capture.mjs [playwright 모듈 경로] [저장 폴더]
// PC: W=1280 PREFIX=pc_ node scripts/c42-capture.mjs ...
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c42-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
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

// 새 게임: 다른 경기 빠른 진행, 경기 결정 자동. 계약을 이번 시즌 만료로 (재계약 화면을 보려고)
await act('go', '[data-to="new"]');
await page.fill('#f-seed', process.env.SEED ?? 'c42-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(300);
await act('start');
await page.waitForTimeout(500);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');
await page.evaluate(() => { globalThis.__game().market.contract.until = globalThis.__game().league.season; });

// 남은 시즌 자동 → 시즌 종료 (제안 카드)
await act('sim-rest');
await act('sim-rest-ok');
await idle();
await page.waitForTimeout(500);
await dismiss();
if (!(await has('[data-act="next-season"]'))) await act('go', '[data-to="season"]');
await page.waitForTimeout(300);
await shot('0_시즌종료-제안카드');
report.seasonCard = (await has('.tr-card')) ? await text('.tr-card') : null;

// 홈 알림 카드
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
await dismiss();
await shot('1_홈-제안카드');

// 이적 제안 화면
await act('go', '[data-to="offers"]');
await page.waitForTimeout(300);
await shot('2_이적제안');
await shot('2b_이적제안-전체', true);
report.offers = await page.locator('.tr-offer').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));

// 재계약 화면
await act('go', '[data-to="contract"]');
await page.waitForTimeout(300);
await shot('3_재계약');
report.contract = await text('.po-hero');

// 월드 이적 소식 (여름 이적시장)
await act('go-tab', '[data-v="world"]');
await page.waitForTimeout(300);
await dismiss();
await act('world-tab', '[data-v="transfers"]');
await page.waitForTimeout(300);
await shot('5_월드-이적소식');
await shot('5b_월드-이적소식-전체', true);
report.news = await text('.po-section');

// 제안 수락 (전력이 가장 높은 이적 제안)
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(200);
await act('go', '[data-to="offers"]');
await page.waitForTimeout(300);
const idx = await page.locator('.tr-offer').evaluateAll((els) => {
  let best = -1;
  let bestR = -1;
  els.forEach((e, i) => {
    if (e.classList.contains('is-loan')) return;
    const r = Number(e.querySelector('.ag-v')?.textContent ?? 0);
    if (r > bestR) { bestR = r; best = i; }
  });
  return best;
});
await page.locator('.tr-offer').nth(Math.max(0, idx)).locator('[data-act="offer-accept"]').click();
await page.waitForTimeout(300);
await shot('6a_수락확인');
await act('offer-accept-ok');
await page.waitForTimeout(400);
await shot('6_이적후홈');
report.afterMove = await text('.po-hero');
report.toast = (await has('.toast-wrap')) ? await text('.toast-wrap') : null;

// 다음 시즌 → 선수 화면 이적 요청 (지난 시즌 출전 부족으로 설정)
await act('go', '[data-to="season"]');
await page.waitForTimeout(300);
await act('next-season');
await page.waitForTimeout(400);
await dismiss();
await page.evaluate(() => { const g = globalThis.__game(); g.player.history.at(-1).minutes = 0; });
await act('go-tab', '[data-v="player"]');
await page.waitForTimeout(300);
await dismiss();
await scrollTo('[data-act="transfer-request"]');
await shot('4_이적요청-선수화면');
report.requestSection = await page.locator('[data-act="transfer-request"]').first().evaluate((b) => b.closest('.panel').innerText.replace(/\s+/g, ' '));
await act('transfer-request');
await page.waitForTimeout(300);
await shot('4b_이적요청-확인');
await act('transfer-request-ok');
await page.waitForTimeout(400);
await shot('4c_이적요청-결과');
report.requestToast = (await has('.toast-wrap')) ? await text('.toast-wrap') : null;

// 남은 시즌 자동 → 겨울 이적시장 제안에서 멈춤 (이적 명단에 올랐을 때)
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
await act('sim-rest');
await act('sim-rest-ok');
await idle();
await page.waitForTimeout(500);
await dismiss();
await shot('7_겨울제안-진행멈춤');
report.halt = { hero: await text('.po-hero'), card: (await has('.tr-card')) ? await text('.tr-card') : null };
if (await has('.tr-card')) {
  await act('go', '[data-to="offers"]');
  await page.waitForTimeout(300);
  await shot('7b_겨울제안');
  await act('offers-decline');
  await page.waitForTimeout(300);
}

writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
