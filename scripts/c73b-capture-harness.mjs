// C.73b 하네스 캡처 (시즌 요약 하이라이트 3 · 커리어 요약 명예의 전당 · 자동 진행 시트): npx vite --port 5177 & 그다음 node scripts/c73b-capture-harness.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c73b-check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const report = { errors: [], screens: {} };
for (const [w, h, pre] of [[390, 844, ''], [1280, 800, 'PC_'], [844, 390, '가로폰_']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(`${pre}${e.message}`));
  for (const [view, name] of [['season', '하네스-시즌요약-하이라이트3'], ['retired', '하네스-커리어요약-명예의전당'], ['sheet', '하네스-자동진행시트']]) {
    for (const skin of pre ? ['b'] : ['b', 'a']) {
      await page.goto(`http://localhost:5177/scripts/c73b-harness.html?view=${view}&skin=${skin}`);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
      await page.waitForTimeout(500);
      const file = `${pre}${name}${skin === 'a' ? '_A테마' : ''}`;
      await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
      report.screens[file] = await page.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight }));
      console.log('saved', file, JSON.stringify(report.screens[file]));
    }
  }
  await ctx.close();
}
writeFileSync(`${OUT}/harness-report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report.errors));
await browser.close();
