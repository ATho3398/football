// C.59 확인 캡처 (U5-e): 설정 접기·이동 칩(66) · 경기 중 잠금(67) · 꾸미기 하위 화면 4개(선수 이름 71 · 경기 아이콘 137/138 · 페이스온 68~70 · 카드 이미지 140~143), B 기본 + A 전환.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c59-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c59-check/', import.meta.url).pathname;
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
  if (!(await has(`[data-act="form"][data-k="realId"][data-v="${id}"]`))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
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


const SAMPLE = new URL('../docs/design/player-one-design-b/samples/face-cutout-sample.webp', import.meta.url).pathname;
const CARD_SAMPLE = new URL('../public/cards/art/', import.meta.url).pathname;
const upload = async (a, extra, file) => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), act(a, extra)]); await fc.setFiles(file); await page.waitForTimeout(900); };
const setPage = async (v) => { await act('set-page', `[data-v="${v}"]`); await page.waitForTimeout(400); await waitImgs(); };

await newGameReal('son', 'c59-check');
await page.evaluate(() => document.fonts.ready);
await go('settings');
await shot('66_설정-기본');
await shot('66_설정-기본_전체', true);
report.mainLen = await len();
report.sections = await page.locator('.set-sec').count();
await act('set-open', '[data-v="view"]');
await page.waitForTimeout(500);
await shot('66_설정-화면보기펼침');
await act('set-open', '[data-v="look"]');
await page.waitForTimeout(500);
await shot('66_설정-꾸미기펼침');
await shot('66_설정-꾸미기펼침_전체', true);
report.lookLen = await len();
// 선수 이름 (71)
await setPage('names');
await shot('71_선수이름-목록');
await page.locator('.nm-row').first().click();
await page.waitForTimeout(400);
await page.fill('#nm-nick', '쏘니');
await act('nm-save');
await page.waitForTimeout(400);
await shot('71_선수이름-편집');
await shot('71_선수이름-편집_전체', true);
// 경기 아이콘 (137 · 138)
await setPage('pixel');
await page.locator('.px-row').nth(1).click();
await page.waitForTimeout(400);
await page.locator('.px-tiles--people .po-pixel').nth(3).click();
await page.waitForTimeout(500);
await waitImgs();
await page.evaluate(() => window.scrollTo(0, 0));
await shot('137_설정-경기아이콘-선수');
await shot('137_설정-경기아이콘-선수_전체', true);
await act('px-tab', '[data-v="kits"]');
await page.waitForTimeout(500);
await waitImgs();
await shot('138_설정-경기아이콘-유니폼');
await shot('138_설정-경기아이콘-유니폼_전체', true);
await act('px-side', '[data-v="away"]');
await page.waitForTimeout(400);
await waitImgs();
await shot('138_설정-경기아이콘-유니폼-원정');
report.kitTiles = await page.locator('.px-tiles--kits .po-pixel').count();
report.kitOverflow = await page.evaluate(() => { const g = document.querySelector('.px-tiles--kits'); return g ? g.scrollWidth - g.clientWidth : null; });
// 페이스온 (68 · 69 · 70)
await setPage('faceon');
await shot('68_페이스온-목록');
await page.locator('.fo-row').first().click();
await page.waitForTimeout(400);
await waitImgs();
await shot('69_페이스온-나이대칸');
await upload('faceon-upload', '[data-slot="prime"]', SAMPLE);
await shot('70_페이스온-위치맞추기');
await page.locator('#fo-zoom').fill('130');
await page.waitForTimeout(200);
report.foZoomText = await page.locator('#fo-zoom-v').textContent();
await act('faceon-crop-save');
await page.waitForTimeout(800);
await waitImgs();
await shot('69_페이스온-나이대칸-올림');
await shot('69_페이스온-나이대칸-올림_전체', true);
// 카드 이미지 (140 · 141 · 143)
await setPage('cardart');
await waitImgs();
await shot('140_설정-카드이미지-목록');
await shot('140_설정-카드이미지-목록_전체', true);
report.caRows = await page.locator('.ca-row').count();
await page.locator('.ca-row').first().click();
await page.waitForTimeout(500);
await waitImgs();
await shot('141_설정-카드이미지-편집-기본');
const art = (await import('node:fs')).readdirSync(CARD_SAMPLE).find((f) => /\.(webp|png|jpg)$/.test(f));
await upload('ca-upload', '', CARD_SAMPLE + art);
await waitImgs();
await page.locator('#ca-zoom').fill('140');
await page.waitForTimeout(300);
await shot('143_카드그림-위치확대-시트');
report.caZoomText = await page.locator('#ca-zoom-v').textContent();
await act('ca-crop-save');
await page.waitForTimeout(900);
await waitImgs();
await shot('141_설정-카드이미지-편집');
await shot('141_설정-카드이미지-편집_전체', true);
// A 전환
await act('set-back');
await act('set-back');
await page.waitForTimeout(300);
await act('set-open', '[data-v="look"]');
await page.waitForTimeout(300);
await act('skin-set', '[data-v="a"]');
await page.waitForTimeout(400);
await shot('66_설정-꾸미기-A');
await setPage('pixel');
await shot('137_설정-경기아이콘-선수-A');
await setPage('cardart');
await shot('140_설정-카드이미지-목록-A');
await page.evaluate(() => window.scrollTo(0, 0));
await act('set-back');
await page.waitForTimeout(300);
await act('set-open', '[data-v="look"]');
await page.waitForTimeout(300);
await act('skin-set', '[data-v="b"]');
await page.waitForTimeout(300);
// 경기 중 잠금 (67 · 142): 직접 모드 경기를 결정 순간에 멈춘 채 설정으로
await go('home');
for (let k = 0; k < 10 && !(await has('.po-dock__go.is-match')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await act('play');
await page.waitForTimeout(800);
await dismiss();
if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
await act('prep-start');
await page.waitForSelector('[data-act="mo-auto"]', { timeout: 180_000 });
await page.waitForTimeout(500);
if (await page.locator('[data-act="dock-more"]:visible').count()) { await act('dock-more'); await page.waitForTimeout(300); }
await act('go-tab', '[data-v="settings"]');
await page.waitForTimeout(500);
await act('set-open', '[data-v="view"]');
await page.waitForTimeout(400);
await page.evaluate(() => window.scrollTo(0, 0));
await shot('67_설정-경기중잠금');
report.lockedPlay = await page.locator('#set-play.is-locked').count();
await act('set-open', '[data-v="look"]');
await page.waitForTimeout(300);
await setPage('cardart');
await page.locator('.ca-row').first().click();
await page.waitForTimeout(500);
await waitImgs();
await shot('142_설정-카드이미지-경기중잠금');
report.lockedBtns = await page.locator('[data-act="ca-upload"]:disabled').count();
console.log(JSON.stringify(report, null, 1));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
await browser.close();
