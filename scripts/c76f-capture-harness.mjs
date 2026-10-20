// C.76f 하네스 캡처 (결정 순간·결과·하프타임): npx vite --port 5175 & 그다음 node scripts/c76f-capture-harness.mjs [playwright 모듈 경로] [저장 폴더] [이름 거르기]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c76f-check/', import.meta.url).pathname;
const only = process.argv[4] ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const shots = [
  { name: 'pc-결정순간-기본', w: 1280, h: 800, q: '' },
  { name: 'pc-결정순간-고름', w: 1280, h: 800, q: 'sel=0' },
  { name: 'pc1024-결정순간-기본', w: 1024, h: 768, q: '' },
  { name: '폰-결정순간-기본', w: 390, h: 844, q: '' },
  { name: '폰-결정순간-몰고가다슛-고름-비', w: 390, h: 844, q: 'sel=3&wx=rain&shot=1' },
  { name: 'pc-결정순간-강풍', w: 1280, h: 800, q: 'wx=wind' },
  { name: 'pc-결정순간-눈', w: 1280, h: 800, q: 'wx=snow' },
  { name: 'pc-결정결과-재생중', w: 1280, h: 800, q: 'view=outcome' },
  { name: 'pc-결정결과-성공', w: 1280, h: 800, q: 'view=outcome&shown=success' },
  { name: 'pc-결정결과-실패', w: 1280, h: 800, q: 'view=outcome&shown=fail' },
  { name: '폰-하프타임-기본', w: 390, h: 844, q: 'view=half' },
  { name: '폰-하프타임-총공세', w: 390, h: 844, q: 'view=half&set=allout' },
  { name: 'pc-하프타임-총공세', w: 1280, h: 800, q: 'view=half&set=allout' },
].filter((s) => s.name.includes(only));
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, colorScheme: 'dark', hasTouch: s.w < 1024 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`http://localhost:5175/scripts/c76f-harness.html?${s.q}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 600_000 });
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > innerWidth,
    scrollY: document.scrollingElement.scrollHeight > innerHeight,
    panelScroll: (() => { const p = document.querySelector('.mo-panel, .ht-sheet'); return p ? p.scrollHeight > p.clientHeight + 1 : null; })(),
  }));
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  console.log(s.name, JSON.stringify(info));
  await ctx.close();
}
await browser.close();
