// C.73a 하네스 캡처 (챕터 리뷰 · 시즌 요약 챕터 버튼 · 홈 챕터 칩 · 황혼 은퇴): npx vite --port 5177 & 그다음 node scripts/c72-capture-harness.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c73a-check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const report = { errors: [], screens: {} };
for (const [w, h, pre] of [[390, 844, ''], [1280, 800, 'PC_'], [844, 390, '가로폰_']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'dark', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(`${pre}${e.message}`));
  for (const [view, name] of [['chapter', '챕터리뷰-도약'], ['season', '시즌요약-챕터리뷰버튼'], ['home', '홈-챕터칩'], ['retired', '챕터리뷰-황혼은퇴']]) {
    for (const skin of pre ? ['b'] : ['b', 'a']) {
      await page.goto(`http://localhost:5177/scripts/c73-harness.html?view=${view}&skin=${skin}`);
      await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
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
