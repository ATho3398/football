// C.77o 피치 재생 fps 측정 (24.8 P1) + 하이라이트 클립 확인 캡처: 세로 폰 390×844(기본, W·H 로 바꿈), CPU 저속 흉내 RATE 배(CDP, 기본 1).
// 자동 모드 내 경기 → 결과 화면(하이라이트 클립 패널 캡처) → ① [하이라이트 다시보기] 전개 재생 ② [클립 n개 이어 보기] 재생 각각 SEC 초 동안
// requestAnimationFrame 간격과 drawFrame 이 쓰는 한 프레임 그리기 시간(캔버스 그리기 호출 시간, 메인 스레드)을 잰다. 30fps 미만이면 원인을 적는다 (최적화는 P2).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 RATE=4 node scripts/c77o-fps.mjs [playwright 모듈 경로] [결과 json] [캡처 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? 'c77o-fps.json';
const SHOTS = process.argv[4] ?? null;
const RATE = Number(process.env.RATE ?? 1);
const SEC = Number(process.env.SEC ?? 8);
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? (W < 1024 ? '폰_' : 'PC_');
const phone = W < 1024;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: Number(process.env.DPR ?? (phone ? 2 : 1)), hasTouch: phone, isMobile: phone });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    if (await has('[data-act="tips-off"]:visible')) await page.locator('[data-act="tips-off"]:visible').first().click();
    else if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); await page.waitForTimeout(250); };
const shot = async (name, full = false) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${P}${name}.png`, fullPage: full }); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForTimeout(500);
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]:visible'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', process.env.SEED ?? 'c77o-fps');
await act('start');
await page.waitForTimeout(800);
await dismiss();
for (let k = 0; k < 8 && !(await has('[data-act="play"]:visible')); k++) {
  if (await has('[data-act="day-continue"]:visible')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
// 홈: 다른 경기 계산(진행 중)이 끝나기를 기다린 뒤 자동 모드로 [경기 시작]. 경기 준비 화면이 나오면 [시작]
for (let k = 0; k < 120 && (await has('[data-act="sim-stop"]:visible')); k++) await page.waitForTimeout(500);
if (await has('[data-act="ctl-mode"][data-v="auto"]:visible')) await act('ctl-mode', '[data-v="auto"]');
await act('play');
for (let k = 0; k < 240 && !(await has('main.screen-match')); k++) {
  if (await has('[data-act="prep-start"]:visible')) await act('prep-start');
  await page.waitForTimeout(500);
}
await page.waitForSelector('main.screen-match', { timeout: 180_000 });
await page.waitForTimeout(800);
await dismiss();
const clipCount = await page.locator('[data-act="clip-play"]:not([data-v="all"])').count();
if (SHOTS) {
  await page.locator('.mr-clips').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.evaluate(() => window.scrollBy(0, -120));
  await page.waitForTimeout(300);
  await shot('경기후_하이라이트클립');
}

const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });

/** rAF 간격 + 캔버스 그리기 호출 시간 (CanvasRenderingContext2D 메서드를 감싸 rAF 한 번 안에서 쓴 시간을 더한다) */
const measure = () => page.evaluate((sec) => new Promise((res) => {
  const proto = CanvasRenderingContext2D.prototype;
  const names = Object.getOwnPropertyNames(proto).filter((k) => { try { return typeof proto[k] === 'function' && k !== 'constructor'; } catch { return false; } });
  let acc = 0, depth = 0;
  const orig = {};
  for (const k of names) {
    orig[k] = proto[k];
    proto[k] = function (...a) { if (depth) return orig[k].apply(this, a); depth++; const t = performance.now(); try { return orig[k].apply(this, a); } finally { acc += performance.now() - t; depth--; } };
  }
  const ts = [], draw = [];
  const t0 = performance.now();
  const f = (t) => {
    ts.push(t); draw.push(acc); acc = 0;
    if (t - t0 < sec * 1000) requestAnimationFrame(f);
    else { for (const k of names) proto[k] = orig[k]; res({ ts, draw }); }
  };
  requestAnimationFrame(f);
}), SEC);
const summarize = (m) => {
  const gaps = m.ts.slice(1).map((t, i) => t - m.ts[i]).sort((a, b) => a - b);
  const q = (arr, p) => Math.round(arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] * 10) / 10;
  const draw = m.draw.slice(1).sort((a, b) => a - b);
  return {
    frames: m.ts.length, fps: Math.round(((m.ts.length - 1) / ((m.ts.at(-1) - m.ts[0]) / 1000)) * 10) / 10,
    p50: q(gaps, 0.5), p95: q(gaps, 0.95), over34: gaps.filter((g) => g > 34).length,
    canvasMsP50: q(draw, 0.5), canvasMsP95: q(draw, 0.95),
  };
};

// ① 전개 하이라이트 다시보기
await page.evaluate(() => document.querySelector('[data-act="hl-rewatch"]')?.click());
await page.waitForSelector('#rp-canvas', { timeout: 30_000 });
await page.waitForTimeout(1500);
await dismiss();
const full = summarize(await measure());
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await page.evaluate(() => document.querySelector('[data-act="rp-skip"]')?.click());
await page.waitForSelector('main.screen-match', { timeout: 30_000 });
await page.waitForTimeout(500);

// ② 하이라이트 클립 이어 보기 (24.6)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
await page.evaluate(() => (document.querySelector('[data-act="clip-play"][data-v="all"]') ?? document.querySelector('[data-act="clip-play"]'))?.click());
await page.waitForSelector('#rp-canvas', { timeout: 30_000 });
await page.waitForTimeout(1200);
await dismiss();
await shot('클립_재생');
const clip = summarize(await measure());
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
// 클립이 끝나면 결과 화면으로 돌아오는지 (건너뛰기 = 다시 보기 끝)
await page.evaluate(() => document.querySelector('[data-act="rp-skip"]')?.click());
await page.waitForSelector('main.screen-match', { timeout: 30_000 });
const backToResult = await has('[data-act="clip-play"]');

const res = { W, H, rate: RATE, dpr: Number(process.env.DPR ?? (phone ? 2 : 1)), sec: SEC, errors, clipCount, backToResult, full, clip };
writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
await browser.close();
