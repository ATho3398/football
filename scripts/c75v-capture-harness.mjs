// C.75v 하네스 캡처 (B 발동 장면): npx vite --port 5175 & 그다음 node scripts/c75v-capture-harness.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c75v-check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const shots = [
  { name: 'B발동', w: 390, h: 844, q: "" },
  { name: 'B발동-선택', w: 390, h: 844, q: "sel=0" },
  { name: 'pc-B발동', w: 1280, h: 800, q: "" },
];
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, colorScheme: 'dark', hasTouch: s.w < 1024 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`http://localhost:5175/scripts/c75v-harness.html?${s.q}`);
  await page.waitForSelector('body[data-ready="1"], #app:not(:empty)', { timeout: 600_000 });
  await page.waitForTimeout(3000);
  const info = await page.evaluate(() => ({ text: document.getElementById('app').textContent.slice(0, 80), note: document.querySelector('.mo-note')?.textContent, n: document.querySelectorAll('.mo-opts .po-choice').length }));
  await page.screenshot({ path: `${OUT}/결정순간-${s.name}.png` });
  console.log(s.name, JSON.stringify(info));
  await ctx.close();
}
await browser.close();
