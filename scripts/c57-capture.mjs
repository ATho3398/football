// C.57 확인 캡처 (U5-c): 홈(미페 facepack 네모) · 훈련·일정 DayCell · 하루 훈련 시트(약발) · 자동 진행 시트·레이어·멈추는 중·끝 요약 · 새 기능 안내 · 페이스온 "배경 없는 사진" → 투명 미페 · A 전환.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c57-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c57-check/', import.meta.url).pathname;
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

await newGameReal('son', 'c57-check');
await page.evaluate(() => document.fonts.ready);
await waitImgs();
await shot('86_홈-시즌중');
await shot('86_홈-시즌중_전체', true);
report.home = await heroInfo();
// 훈련·일정 (91): 일정 탭 = 오늘 훈련 카드 + DayCell 7칸 + 일정·달력
await go('schedule');
await act('train-tab', '[data-v="cal"]');
await page.waitForTimeout(300);
await shot('91_훈련일정-기본');
await shot('91_훈련일정-기본_전체', true);
report.schedule = { height: await len(), dayFont: await page.evaluate(() => Math.min(...[...document.querySelectorAll('.po-day__label')].map((e) => parseFloat(getComputedStyle(e).fontSize)))) };
await act('train-tab', '[data-v="g"]');
await page.waitForTimeout(300);
await shot('91_게이지');
await act('train-tab', '[data-v="cal"]');
await page.waitForTimeout(300);
// 하루 훈련 시트 (92) → 약발 훈련 고르기 (150)
const cell = page.locator('.tr-week button.po-day').first();
if (await cell.count()) {
  await cell.click();
  await page.waitForTimeout(300);
  await shot('92_하루훈련-시트');
  if (await has('[data-act="train-pick"][data-v="weakFoot"]')) { await act('train-pick', '[data-v="weakFoot"]'); await page.waitForTimeout(250); }
  await shot('150_하루훈련-약발');
  await page.evaluate(() => document.querySelector('.po-overlay')?.click());
  await page.waitForTimeout(300);
}
// 자동 진행 시트 (61)
await go('home');
await act('sim-rest');
await page.waitForTimeout(300);
await shot('61_자동진행-시트');
await act('auto-count', '[data-v="3"]');
await page.waitForTimeout(200);
await act('auto-run');
// 레이어 (62): 두 번째 경기 계산 중에
await page.waitForFunction(() => document.querySelector('.auto-layer__n')?.textContent === '1', null, { timeout: 120000 }).catch(() => null);
await page.waitForTimeout(150);
await shot('62_자동진행-레이어');
await page.waitForFunction(() => document.querySelector('.auto-layer__n')?.textContent === '2', null, { timeout: 120000 }).catch(() => null);
await page.locator('.auto-layer [data-act="sim-stop"]').dispatchEvent('pointerdown').catch(() => null);
await page.waitForTimeout(120);
await shot('63_자동진행-멈추는중');
await page.waitForSelector('.auto-layer', { state: 'detached', timeout: 120000 }).catch(() => null);
await page.waitForTimeout(200);
await shot('64_자동진행-끝요약');
report.autoToast = await page.evaluate(() => document.querySelector('.po-toast')?.textContent);
// 새 기능 안내 (65): 첫 경기 뒤 "성장" 소개가 자동 진행 끝 홈에 뜬다
if (await has('[data-act="intro-ok"]')) await shot('65_새기능-안내');
report.intro = await page.evaluate(() => document.querySelector('.po-modal')?.textContent ?? null);
await page.waitForTimeout(4500);
await dismiss();
// 페이스온 "배경 없는 사진" → 투명 미페 (B-apply 5절 ①)
await go('settings');
if (await has('#fo-q')) { await page.fill('#fo-q', '손흥민'); await page.locator('#fo-q').dispatchEvent('input'); await page.waitForTimeout(300); }
await page.locator('[data-act="faceon-pick"][data-key="p:son"]').first().click().catch(() => null);
await page.waitForTimeout(300);
const up = page.locator('[data-act="faceon-upload"][data-slot="prime"]').first();
if (await up.count()) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), up.click()]);
  await fc.setFiles(new URL('../docs/design/player-one-design-b/samples/face-cutout-sample.webp', import.meta.url).pathname);
  await page.waitForSelector('[data-act="faceon-crop-save"]', { timeout: 10000 }).catch(() => null);
  await act('faceon-crop-save');
  await page.waitForTimeout(800);
  await act('faceon-cutout', '[data-v="on"]');
  await page.waitForTimeout(400);
  await page.locator('.fo-cutout').first().evaluate((el) => el.scrollIntoView({ block: 'center' })).catch(() => null);
  await shot('페이스온-배경없는사진-켬');
}
await go('home');
await waitImgs();
await shot('86_홈-미페-투명(페이스온)');
report.cutout = await heroInfo();
// A 전환
await go('settings');
await act('skin-set', '[data-v="a"]');
await page.waitForTimeout(300);
await go('home');
await shot('86_홈-A');
report.homeA = await heroInfo();
await go('schedule');
await shot('91_훈련일정-A');
await go('settings');
await act('skin-set', '[data-v="b"]');
console.log(JSON.stringify(report, null, 1));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
await browser.close();
