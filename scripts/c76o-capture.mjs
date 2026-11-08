// C.76o 확인 캡처: 팩 개봉 연출 (팩 등장 · 찢어짐 · 전설 빛 · 워크아웃 · 카드 공개 · 결과 · 선택권) + 폰 평균 fps + 녹화(VIDEO 폴더)
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c76o-capture.mjs [playwright 모듈 경로] [저장 폴더]  (W H PREFIX VIDEO)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c76o-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024,
  ...(process.env.VIDEO ? { recordVideo: { dir: process.env.VIDEO, size: { width: W, height: H } } } : {}),
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const shot = async (name) => { if (want(name)) { await page.screenshot({ path: `${OUT}/${P}${name}.png` }); console.log('saved', name); } };
const wait = (ms) => page.waitForTimeout(ms);
// data-act 단추를 잠깐 만들어 누른다 (전역 클릭 처리)
const fire = (act, data = {}) => page.evaluate(([a, d]) => {
  const b = document.createElement('button');
  b.dataset.act = a;
  for (const [k, v] of Object.entries(d)) b.dataset[k] = v;
  document.querySelector('#app').append(b);
  b.click();
  b.remove();
}, [act, data]);
// 프레임 측정: rAF 간격
const fpsStart = () => page.evaluate(() => {
  window.__f = { n: 0, t0: performance.now(), worst: 0, last: performance.now(), on: true };
  const tick = (t) => { const f = window.__f; if (!f.on) return; f.n++; f.worst = Math.max(f.worst, t - f.last); f.last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
const fpsStop = () => page.evaluate(() => { const f = window.__f; f.on = false; const s = (performance.now() - f.t0) / 1000; return { fps: +(f.n / s).toFixed(1), worstMs: +f.worst.toFixed(1), sec: +s.toFixed(1) }; });
const tapPack = () => page.mouse.click(W / 2, H * 0.45);

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await wait(800);
const report = { W, H, errors, fps: {} };

// 1) 전설 팩 (설정 미리보기 = 실제와 같은 연출, 고른 희귀도가 최고)
await fire('pack-anim-demo', { v: 'legendary' });
await wait(1300);
await shot('01-pack');
await fpsStart();
await tapPack();
await wait(1050);
await shot('02-tear');
await wait(350);
await shot('03-legend-beam');
await wait(700);
await shot('04-walkout');
await wait(1900);
await shot('05-cards-back');
await page.locator('.pk-card').nth(1).click();
await wait(380);
await shot('06-charge');
await page.locator('.pk-btn[data-k="all"]').click().catch(() => null);
await wait(2600);
report.fps.legendary = await fpsStop();
await shot('07-opened');
await page.locator('.pk-btn[data-k="next"]').click();
await wait(400);
await shot('08-results');
await page.locator('.pk-res .pk-btn').click();
await wait(300);

// 2) 일반 팩 fps + 건너뛰기
await fire('pack-anim-demo', { v: 'common' });
await wait(1200);
await fpsStart();
await tapPack();
await wait(2400);
report.fps.common = await fpsStop();
await page.locator('.pk-skip').click().catch(() => null);
await wait(300);
report.skipToResults = await page.locator('.pk-res').count();
await shot('09-skip-results');
await page.locator('.pk-res .pk-btn').click().catch(() => null);
await wait(300);

// 3) 업적 선택권(전설) 공개
await fire('pack-anim-demo', { v: 'legendary', k: 'pick' });
await wait(700);
await shot('10-pick-orb');
await wait(3600);
await page.locator('.pk-btn[data-k="all"]').click().catch(() => null);
await wait(2600);
await shot('11-pick-opened');
await page.locator('.pk-btn[data-k="next"]').click().catch(() => null);
await wait(300);
report.overlayLeft = await page.locator('.pk-ov').count();
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
await ctx.close();
await browser.close();
