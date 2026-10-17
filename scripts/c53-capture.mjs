// C.53 확인 캡처 (pending 82 4번): 경기 준비 [팀 상세 >] → 팀 상세(157) 개요·스쿼드 → 선수 상세(158) 탭 5개 → 뒤로, 순위표 팀 → 팀 상세.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c53-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c53-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
const shot = async (name, full = false) => { await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
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
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}`).first().click(); await page.waitForTimeout(350); };
const screenOf = () => page.evaluate(() => document.querySelector('main')?.className ?? '');
const height = () => page.evaluate(() => document.documentElement.scrollHeight);

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await act('go', '[data-to="new"]');
await page.fill('#f-seed', 'c53-check');
await page.locator('#f-seed').dispatchEvent('change');
await act('form', '[data-k="mode"][data-v="real"]');
await page.locator('[data-act="form"][data-k="realId"][data-v="kane"]').first().click();
await act('start');
await page.waitForTimeout(600);
if (await has('[data-act="tips-off"]')) await page.locator('[data-act="tips-off"]').first().click();
await dismiss();
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await dismiss();
await shot('1_경기준비-팀상세링크');
await act('team-open');
const report = { errors, team: await screenOf() };
await shot('2_팀상세-개요', true);
report.teamH = await height();
await act('team-tab', '[data-v="squad"]');
await shot('3_팀상세-스쿼드', true);
await act('team-tab', '[data-v="tactics"]');
await shot('4_팀상세-전술');
await act('team-tab', '[data-v="matches"]');
await shot('5_팀상세-경기', true);
await act('team-tab', '[data-v="overview"]');
await act('person-open', '.dt-row');
report.person = await screenOf();
await shot('6_선수상세-능력치', true);
report.personH = await height();
for (const [i, t] of [['7', 'body'], ['8', 'pos'], ['9', 'record'], ['10', 'contract']]) { await act('person-tab', `[data-v="${t}"]`); await shot(`${i}_선수상세-${t}`); }
await act('detail-back');
report.back1 = await screenOf();
await act('detail-back');
report.back2 = await screenOf();
if (W < 1024) await act('dock-more');
await page.locator('[data-act="go-tab"][data-v="world"]:visible').first().click(); await page.waitForTimeout(350);
await page.waitForTimeout(300);
await dismiss();
await page.locator('.tbl.league [data-act="team-open"]').nth(2).click();
await page.waitForTimeout(300);
report.fromWorld = await screenOf();
await shot('11_순위표에서-팀상세');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
await browser.close();
