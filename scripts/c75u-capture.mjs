// C.75u 확인 캡처 (홈 머리말 긴 이름): 새 게임 이름 칸에 긴 이름을 넣고 홈 얼굴 머리말을 찍는다. 세로 폰 390×844 기본 · PC 1280×800 (W H PREFIX NAMES).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c75u-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c75u-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const NAMES = (process.env.NAMES ?? '율리안 린트너,로베르트 레반도프스키,바스티안 슈바인슈타이거').split(',');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const report = { W, H, errors, names: {} };
// 이름 칸 실폭·잘림, 칩 줄 수, 제목 받침, 눈썹·이름·칩이 사선(slab 윗변·line)보다 아래(가려지지 않음)인지
function measure() {
  const hero = document.querySelector('.po-hero--face');
  const el = hero?.querySelector('.po-hero__name[data-fit]');
  if (!hero || !el) return null;
  const r = document.createRange(); r.selectNodeContents(el);
  const textW = r.getBoundingClientRect().width, boxW = el.getBoundingClientRect().width;
  const chips = [...hero.querySelectorAll('.po-hero__chip')].map((c) => c.getBoundingClientRect());
  const chipRows = new Set(chips.map((c) => Math.round(c.top))).size;
  const chipCut = [...hero.querySelectorAll('.po-hero__chip')].some((c) => c.scrollWidth > c.clientWidth);
  const hr = hero.getBoundingClientRect();
  const slab = hero.querySelector('.po-hero__slab')?.getBoundingClientRect();
  const slabTop = (x) => slab.top + slab.height * (0.22 + 0.28 * (x - hr.left) / hr.width);
  const line = hero.querySelector('.po-hero__line');
  const lr = line.getBoundingClientRect();
  const tan = Math.tan(6.4 * Math.PI / 180), lh = line.offsetHeight, lw = line.offsetWidth;
  const lineBottom = (x) => (x - hr.left) <= lw ? lr.top + lh + tan * (x - hr.left) : -1e9;  // 선 아래쪽 경계(선이 없는 곳은 -inf)
  const parts = {};
  for (const k of ['eyebrow', 'name']) {
    const e = hero.querySelector(`.po-hero__${k}`); if (!e) continue;
    const rr = k === 'name' ? r.getBoundingClientRect() : (() => { const q = document.createRange(); q.selectNodeContents(e); return q.getBoundingClientRect(); })();
    const xs = [rr.left + 1, rr.right - 1];
    parts[k] = { underSlab: xs.every((x) => rr.top >= slabTop(x) - 0.5), clearLine: xs.every((x) => rr.top >= lineBottom(x) - 0.5) };
  }
  const title = hero.querySelector('.po-hero__title');
  return { text: el.textContent, font: el.style.fontSize, textW: +textW.toFixed(2), boxW: +boxW.toFixed(2), cut: textW > boxW, chipRows, chipCut, titleBg: getComputedStyle(title).backgroundColor, parts };
}
for (const name of NAMES) {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await page.locator('[data-act="go"][data-to="new"]:visible').first().click();
  await page.waitForTimeout(300);
  await page.locator('[data-act="ng-random"]:visible').first().click();
  await page.waitForTimeout(300);
  await page.fill('#f-name', name);
  await page.locator('#f-name').dispatchEvent('change');
  await page.waitForTimeout(200);
  await dismiss();
  await page.locator('[data-act="start"]:visible').first().click();
  await page.waitForTimeout(800);
  await page.locator('[data-act="tips-off"]:visible').first().click({ timeout: 1500 }).catch(() => null);
  await dismiss();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  for (const scr of ['홈', '선수']) {
    if (scr === '선수') {
      await page.evaluate(() => document.querySelector('[data-act="go-tab"][data-v="player"]')?.click());
      await page.waitForTimeout(600);
      await dismiss();
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const m = await page.evaluate(measure);
    report.names[`${scr}:${name}`] = m;
    const box = await page.locator('.po-hero').first().boundingBox();
    await page.screenshot({ path: `${OUT}/${P}${scr}-${name.replace(/ /g, '')}.png`, clip: box && W < 1024 ? { x: 0, y: 0, width: W, height: Math.min(H, box.y + box.height + 24) } : undefined });
    console.log(scr, name, JSON.stringify(m));
  }
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
await browser.close();
