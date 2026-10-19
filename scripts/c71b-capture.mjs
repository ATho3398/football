// C.71b 확인 캡처 (U7-c2: 173 설정-꾸미기-v2 · 174 페이스온-v2 · 175 새게임 정렬 · 176 랜덤 다른 포지션 · 183 커스텀 태그 접기 · 184 PC 설정 v2 · 185 PC 커스텀 v2).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c71b-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c71b-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const PC = W >= 1024;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const has = async (sel) => (await page.locator(sel).count()) > 0;
const check = () => page.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight }));
const report = { W, H, errors, screens: {} };
const shot = async (name, full = false) => {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full });
  report.screens[name] = await check();
  console.log('saved', name, JSON.stringify(report.screens[name]));
};
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); await page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); await page.waitForTimeout(250); };
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const SKIN = process.env.SKIN ?? 'b';

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
if (SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
await page.reload();
await act('go', '[data-to="new"]');
await page.fill('#f-seed', 'c71b-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(300);

if (!PC) {
  // 176 랜덤 · 다른 포지션에서 고르기 펼침 → LW
  await act('form-others');
  if (await has('[data-act="form"][data-k="position"][data-v="LW"]')) await act('form', '[data-k="position"][data-v="LW"]');
  await top(); await shot('176_새게임-랜덤-다른포지션'); await shot('176_새게임-랜덤-다른포지션_전체', true);
  // 175 실제 선수 · 정렬 펼침
  await act('form', '[data-k="mode"][data-v="real"]');
  await top();
  if (await has('[data-act="ng-sort"]')) await act('ng-sort');
  await shot('175_새게임-실제선수-정렬-펼침');
  if (await has('[data-act="ng-sort-close"]')) await act('ng-sort-close');
  // 175 레전드 · 정렬 아래 시트
  await act('form', '[data-k="legends"][data-v="on"]');
  await act('ng-real', '[data-k="realTab"][data-v="legend"]');
  await top();
  if (await has('[data-act="ng-sort"]')) await act('ng-sort');
  await shot('175_새게임-실제선수-정렬-레전드시트');
  if (await has('[data-act="ng-sort-close"]')) await act('ng-sort-close');
  await act('form', '[data-k="legends"][data-v="off"]');
}

// 커스텀: 태그 단계 (183 폰 · 185 PC)
await act('form', '[data-k="mode"][data-v="custom"]');
await top();
if (PC) await shot('185_PC-새게임-커스텀-v2-기본');
await act('cu-step', '[data-v="4"]');
// 태그 고르기: 안 고른 줄(.cu-tagrow)을 누르면 영구, 해제형은 큰 카드의 해제형 칸
const trait = async (k, ko) => {
  const ok = await page.evaluate(([kk, name]) => {
    const row = [...document.querySelectorAll('.cu-tagrow')].find((x) => x.textContent.includes(name));
    if (row && !row.disabled) row.click();
    else if (!row && kk === 'trait') return false;
    return true;
  }, [k, ko]);
  await page.waitForTimeout(200);
  if (k === 'traitR') await page.evaluate((name) => [...document.querySelectorAll('.cu-tagcard')].find((x) => x.textContent.includes(name))?.querySelector('[data-k="traitR"]')?.click(), ko);
  await page.waitForTimeout(200);
  return ok;
};
await trait('trait', '철강왕');
if (!PC) await trait('trait', '프로 정신');
await trait('traitR', '문제아');
if (!PC) { await page.evaluate(() => document.querySelector('[data-act="ng-hooks"][data-v="con"]')?.click()); await page.waitForTimeout(200); await trait('trait', '언론 울렁증'); }
await top();
if (PC) await shot('185_PC-새게임-커스텀-v2-태그');
else { await shot('183_새게임-커스텀-태그-접기'); await shot('183_새게임-커스텀-태그-접기_전체', true); }

// 게임 시작 (실제 선수 손흥민) → 설정 (폰은 1단계에만 시작 방식 탭)
if (!PC) await act('cu-step', '[data-v="1"]');
await act('form', '[data-k="mode"][data-v="real"]');
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
await page.waitForTimeout(200);
await act('start');
await page.waitForTimeout(800);
if (await has('[data-act="tips-off"]')) await act('tips-off');
await dismiss();
await page.evaluate(() => document.querySelector('[data-act="go"][data-to="settings"]')?.click());
await page.waitForTimeout(400); await dismiss();
if (!(await has('main.screen-settings, .set-body'))) { await page.evaluate(() => document.querySelector('[data-act="set-page"]')?.click()); await page.waitForTimeout(300); }
await act(PC ? 'set-nav' : 'set-toggle', '[data-v="look"]');
await top();
if (!PC) { await shot('173_설정-꾸미기-v2'); await shot('173_설정-꾸미기-v2_전체', true); }
await act('set-page', '[data-v="faceon"]');
await top();
await shot('174_페이스온-v2-목록');
await page.locator('[data-act="faceon-pick"]').first().click();
await page.waitForTimeout(300); await top();
await shot('174_페이스온-v2-나이대칸'); await shot('174_페이스온-v2-나이대칸_전체', true);
await act('set-back');
if (PC) {
  await act('set-page', '[data-v="cardart"]');
  await top();
  await shot('184_PC-설정-v2-카드이미지');
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors: report.errors }, null, 1));
await browser.close();
