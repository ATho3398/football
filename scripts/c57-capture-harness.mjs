// C.57 하네스 캡처: 미페 3종(투명 · facepack 네모 · 사진 없음) · 최장 이름 · 1군 테스트 · 알림 · 비시즌 · A 전환.
// 실행: npx vite --port 5177 & 그다음 node scripts/c57-capture-harness.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c57-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const report = { errors: [], broken: [], names: {} };
const cases = [
  ['son', 'b', '86_홈-미페-facepack네모'], ['cutout', 'b', '86_홈-미페-투명'], ['none', 'b', '86_홈-사진없음-일반B'], ['long', 'b', '86_홈-최장이름'],
  ['arnold', 'b', '86_홈-긴이름-알렉산더아놀드'], ['trial', 'b', '132_홈-1군테스트'], ['alerts', 'b', '133_홈-알림들'], ['son', 'a', '86_홈-A'],
];
for (const [who, skin, name] of cases) {
  const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { report.errors.push(`${name}: ${e.message}`); console.error('pageerror', e.stack); });
  page.on('response', (r) => { if (r.status() >= 400) report.broken.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${process.env.URL ?? 'http://localhost:5177'}/scripts/c57-harness.html?who=${who}&skin=${skin}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
  await page.waitForTimeout(300);
  report.names[name] = await page.evaluate(() => {
    const n = document.querySelector('.po-hero__name');
    const f = document.querySelector('.po-hero__face');
    return { face: !!f, square: f?.classList.contains('is-square') ?? null, name: n?.textContent, fontPx: n && parseFloat(getComputedStyle(n).fontSize), overflow: n ? n.scrollWidth - n.clientWidth : null,
      fullHeight: document.documentElement.scrollHeight };
  });
  await page.screenshot({ path: `${OUT}/${P}${name}.png` });
  await page.screenshot({ path: `${OUT}/${P}${name}_전체.png`, fullPage: true });
  console.log('saved', name, JSON.stringify(report.names[name]));
  await ctx.close();
}
writeFileSync(`${OUT}/${P}report-harness.json`, JSON.stringify(report, null, 1));
await browser.close();
