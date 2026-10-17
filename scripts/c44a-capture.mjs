// 경기 화면 세로·선수 크기·이름 확인 캡처 (부록 C.44a): 실제 선수(손흥민)로 새 게임 → 선수 화면에서 별명 → 설정(방향·크기·이름, 선수 이름)
// → 경기 화면(기본 = 자동 방향·크게·이름 켬) → 크기 3단계 → 이름 내 선수만·끔.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 W=390 H=844 PREFIX=phone_ node scripts/c44a-capture.mjs [playwright 모듈 경로]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = new URL('../docs/design/c44a-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const NICK = process.env.NICK !== '0';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: Number(process.env.DPR ?? 2) });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
const shot = async (name, wait = 500) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png` }); console.log('saved', P + name); };
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 5; k++) {
    if (await has('[data-act="tips-off"]')) await page.locator('[data-act="tips-off"]').first().click();
    else if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}`).first().click(); await page.waitForTimeout(250); };
const scrollTo = async (sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForTimeout(500);
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', 'c44a-check');
await act('start');
await dismiss();
await act('opt-quick', '[data-v="quick"]');
await act('ctl-mode', '[data-v="auto"]');

if (NICK) {
  // 선수 화면: 내 선수 별명
  await act('go-tab', '[data-v="player"]');
  await dismiss();
  await page.fill('#nm-nick', '쏘니');
  await act('nm-save');
  await scrollTo('#nm-nick');
  await shot('1_선수화면-별명');
  // 설정: 방향·크기·이름, 선수 이름 목록
  await act('go-tab', '[data-v="home"]');
  await act('go', '[data-to="settings"]');
  await dismiss();
  await scrollTo('[data-act="po-orient"]');
  await shot('2_설정-방향크기이름');
  await page.fill('#nm-q', '살라');
  await page.waitForTimeout(500);
  await act('nm-pick');
  await page.fill('#nm-nick', '파라오');
  await act('nm-save');
  await page.fill('#nm-q', '');
  await page.waitForTimeout(500);
  await scrollTo('.nm-editor');
  await shot('3_설정-선수이름');
  await act('go', '[data-to="home"]').catch(() => act('go-tab', '[data-v="home"]'));
}

await act('go-tab', '[data-v="home"]');
for (let k = 0; k < 20 && !(await has('[data-act="play"]')); k++) { await act('day-continue'); await page.waitForTimeout(400); }
await act('play');
await page.waitForTimeout(6000);
await dismiss();
await shot('4_경기화면-기본(자동·크게·이름켬)');
await page.locator('#rp-canvas').screenshot({ path: `${OUT}/${P}4b_피치-확대.png` });
const setOpt = async (a, v) => { await act('pv-open'); await act(a, `[data-v="${v}"]`); await act('pv-close'); };
await setOpt('po-size', 'normal');
await page.locator('#rp-canvas').screenshot({ path: `${OUT}/${P}5a_크기-보통.png` });
await setOpt('po-size', 'xlarge');
await page.locator('#rp-canvas').screenshot({ path: `${OUT}/${P}5c_크기-아주크게.png` });
await setOpt('po-size', 'large');
await setOpt('po-names', 'mine');
await page.locator('#rp-canvas').screenshot({ path: `${OUT}/${P}6a_이름-내선수만.png` });
await setOpt('po-names', 'off');
await page.locator('#rp-canvas').screenshot({ path: `${OUT}/${P}6b_이름-끔.png` });
await setOpt('po-names', 'all');
await setOpt('po-orient', process.env.FORCE ?? 'portrait');
await shot(`7_방향-${process.env.FORCE ?? 'portrait'}`);
await setOpt('po-orient', 'auto');
await act('pv-open');
await shot('8_보기시트');
console.log(JSON.stringify({ errors }));
await browser.close();
