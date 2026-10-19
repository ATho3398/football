// C.72 하네스 캡처 (179 이적제안-소속팀없음 · 181 시즌요약-포인트줄): npx vite --port 5177 & 그다음 node scripts/c72-capture-harness.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c72-check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const report = { errors: [], screens: {} };
for (const [w, h, pre] of [[390, 844, ''], [1280, 800, 'PC_'], [844, 390, '가로폰_']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(`${pre}${e.message}`));
  for (const [view, name] of [['offers', '179_이적제안-소속팀없음'], ['season', '181_시즌요약-포인트줄']]) {
    for (const skin of pre ? ['b'] : ['b', 'a']) {
      await page.goto(`http://localhost:5177/scripts/c72-harness.html?view=${view}&skin=${skin}`);
      await page.waitForSelector('body[data-ready="1"]');
      await page.waitForTimeout(500);
      const file = `${pre}${name}${skin === 'a' ? '_A테마' : ''}`;
      await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: !pre });
      report.screens[file] = await page.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight }));
      console.log('saved', file, JSON.stringify(report.screens[file]));
    }
  }
  await ctx.close();
}
writeFileSync(`${OUT}/harness-report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.errors));
await browser.close();
