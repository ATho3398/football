// C.55 확인 캡처 (U-B1, B 테마 층): 기본 B 화면들, 독 B, 라이트 독, A/B 전환, 키보드 초점(꺾인 버튼 안쪽 테두리).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c55-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c55-check/', import.meta.url).pathname;
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

const screenOf = () => page.evaluate(() => document.querySelector('main')?.className ?? '');
const dockInfo = () => page.evaluate(() => {
  const bar = [...document.querySelectorAll('.dock-bar .po-dock')].find((e) => getComputedStyle(e).display !== 'none');
  const home = bar?.querySelector('.po-dock__homeicon')?.getBoundingClientRect();
  const r = bar?.getBoundingClientRect();
  return { labels: [...(bar?.querySelectorAll('.po-dock__label, .po-dock__golabel') ?? [])].map((e) => e.textContent), homeCenterX: home && Math.round(home.x + home.width / 2), rises: home && r && Math.round(r.y - home.y), height: r && Math.round(r.height),
    homeBg: bar && getComputedStyle(bar.querySelector('.po-dock__homeicon')).backgroundColor };
});

const look = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const cs = (s, p) => { const e = q(s); return e ? getComputedStyle(e)[p] : null; };
  const bar = [...document.querySelectorAll('.dock-bar .po-dock')].find((e) => getComputedStyle(e).display !== 'none');
  return { skin: document.documentElement.dataset.skin, theme: document.documentElement.dataset.theme,
    heroValueFont: cs('.po-hero__value', 'fontFamily'), heroTitleFont: cs('.po-hero__title', 'fontFamily'), btnClip: cs('.po-btn', 'clipPath'),
    dockBg: bar && getComputedStyle(bar).backgroundColor, dockLabel: bar && getComputedStyle(bar.querySelector('.po-dock__label')).color,
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).filter((v, i, a) => a.indexOf(v) === i) };
});
const go = async (v) => { if (v === 'settings') { if (await page.locator('[data-act="dock-more"]:visible').count()) { await act('dock-more'); await page.waitForTimeout(300); } } await act('go-tab', `[data-v="${v}"]`); await page.waitForTimeout(400); await dismiss(); await page.evaluate(() => document.fonts.ready); };

await newGameReal('son', 'c55-check');
await page.evaluate(() => document.fonts.ready);
await shot('86_홈-B');
report.home = await look();
await go('player');
await shot('93_선수-B');
await go('schedule');
await shot('91_훈련일정-B');
if (await page.locator('[data-act="dock-more"]:visible').count()) { await act('dock-more'); await page.waitForTimeout(300); } await act('go-tab', '[data-v="world"]'); await page.waitForTimeout(400); await dismiss();
await shot('101_월드-B');
if (await page.locator('[data-act="dock-more"]:visible').count()) { await act('dock-more'); await page.waitForTimeout(300); } await act('go-tab', '[data-v="deck"]'); await page.waitForTimeout(400); await dismiss();
await shot('116_덱-B');
await go('settings');
await shot('66_설정-B');
await go('home');
for (let k = 0; k < 8 && !(await has('.po-dock__go.is-match')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await shot('154_경기날-독-B');
await act('play');
await page.waitForTimeout(800);
await shot('156_경기준비-B');
// 라이트 테마 (설정 화면 토글은 없음, 토큰만 있음): 독 대비 확인
await go('home');
await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
await page.waitForTimeout(200);
await shot('라이트_홈-B');
report.light = await look();
await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
// 키보드 초점: 꺾인 버튼 안쪽 테두리
await page.locator('.body .po-btn:visible').first().focus();
await page.keyboard.press('Shift+Tab');
await page.keyboard.press('Tab');
await page.waitForTimeout(150);
await page.locator('.body .po-btn:visible').first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
await shot('초점_꺾인버튼-B');
report.focus = await page.evaluate(() => { const e = document.activeElement; return e && { cls: e.className, outline: getComputedStyle(e).outlineStyle, offset: getComputedStyle(e).outlineOffset }; });
// A 로 되돌리기 (설정 화면 스타일 → A)
await go('settings');
await act('skin-set', '[data-v="a"]');
await page.waitForTimeout(300);
await shot('66_설정-A전환');
await go('home');
await shot('86_홈-A');
report.a = await look();
await act('skin-set', '[data-v="b"]').catch(() => null);
await page.reload();
await page.waitForTimeout(800);
report.afterReload = await page.evaluate(() => document.documentElement.dataset.skin);
console.log(JSON.stringify(report, null, 1));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
await browser.close();
