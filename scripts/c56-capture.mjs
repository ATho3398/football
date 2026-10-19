// C.56 확인 캡처 (U5-b 경기 화면): 결정 순간 한 화면(77·78·79), 카드 장면 시트(80), 결정 결과 띠(81~84), 세로 하이라이트 다시보기(118),
// 캐릭터 보기(139), 보기 시트(72). 폰은 [맡기기][확정]이 스크롤 없이 독 위에 보이는지 잰다(report.json fold).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c56-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_, A 테마: SKIN=a
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c56-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
const SKIN = process.env.SKIN ?? 'b';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
const shot = async (name, full = false) => { await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
const has = async (sel) => (await page.locator(`${sel}:visible`).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); };
const report = { errors, broken, moments: [] };

async function newGameReal(id, seed) {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate((skin) => { localStorage.clear(); localStorage.setItem('po-skin', skin); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); }, SKIN);
  await page.reload();
  await act('go', '[data-to="new"]');
  await page.fill('#f-seed', seed);
  await page.locator('#f-seed').dispatchEvent('change');
  await page.waitForTimeout(200);
  await act('form', '[data-k="mode"][data-v="real"]');
  await page.waitForTimeout(300);
  await page.locator(`[data-act="form"][data-k="realId"][data-v="${id}"]`).first().click();
  await page.waitForTimeout(200);
  await act('start');
  await page.waitForTimeout(800);
  if (await has('[data-act="tips-off"]')) await act('tips-off');
  await dismiss();
}

/** 폰 한 화면 판정: 버튼 아래 끝이 (화면 높이 − 독 높이) 안에 있고 문서 스크롤이 0 */
const fold = () => page.evaluate(() => {
  const r = (s) => { const e = [...document.querySelectorAll(s)].find((x) => x.offsetParent); return e ? e.getBoundingClientRect() : null; };
  const dock = [...document.querySelectorAll('.dock-bar')].find((x) => x.offsetParent)?.getBoundingClientRect();
  const limit = dock ? dock.top : innerHeight;
  const del = r('[data-act="mo-delegate"]');
  const conf = r('[data-act="mo-confirm"]');
  const chips = r('.mo-chips');
  const opts = [...document.querySelectorAll('.mo-opt .po-choice, .mo-opts .po-choice')].map((e) => Math.round(e.getBoundingClientRect().bottom));
  return { scrollY: Math.round(scrollY), docH: document.documentElement.scrollHeight, limit: Math.round(limit), delegateBottom: del && Math.round(del.bottom), confirmBottom: conf && Math.round(conf.bottom),
    chipsBottom: chips && Math.round(chips.bottom), opts, ok: !!del && !!conf && del.bottom <= limit + 0.5 && conf.bottom <= limit + 0.5,
    confirmText: [...document.querySelectorAll('[data-act="mo-confirm"]')].find((x) => x.offsetParent)?.textContent?.trim() };
});

await newGameReal('son', 'c56-check');
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await act('play');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 });
await page.waitForTimeout(300);
await dismiss();
if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
await act('prep-start');

const got = { base: false, two: false, play: false, prob: false, react: false, success: false, fail: false, card: false, character: false };
for (let n = 0; n < 40; n++) {
  const sel = await page.waitForSelector('[data-act="mo-confirm"], [data-act="oc-skip"], main.screen-match', { timeout: 180_000 }).catch(() => null);
  if (!sel || (await page.evaluate(() => !!document.querySelector('main.screen-match')))) break;
  await page.waitForTimeout(1600); // 앞 장면 + 슬로모션 끝까지
  await dismiss();
  if (!(await has('[data-act="mo-confirm"]'))) { await act('oc-skip'); await page.waitForTimeout(300); continue; }
  const info = await page.evaluate(() => ({ react: !!document.querySelector('.mo-react'), opts: document.querySelectorAll('.po-choice').length,
    cards: [...document.querySelectorAll('[data-act="mo-card"]')].map((e) => ({ v: e.dataset.v, off: e.matches('[disabled], .is-disabled, [aria-disabled="true"]'), play: e.dataset.role === 'play' })) }));
  report.moments.push(info);
  let pick = 0;
  let useCard = null;
  if (info.react) {
    if (!got.react) { got.react = true; await shot('80_카드장면시트'); report.react = await fold(); }
    const usable = info.cards.find((c) => !c.off);
    if (usable) useCard = usable;
  } else {
    if (!got.base && info.opts >= 3) { got.base = true; await shot('77_결정순간-기본'); report.fold77 = await fold(); }
    if (!got.two && info.opts === 2) { got.two = true; await shot('78_결정순간-선택지2개'); report.fold78 = await fold(); }
    if (!got.character && got.base) {
      got.character = true;
      await act('pv-open'); await page.waitForTimeout(250);
      await act('pv-set', '[data-v="character"]'); await page.waitForTimeout(250);
      await shot('72_보기시트-캐릭터');
      if (await has('[data-act="pv-close"]')) await act('pv-close'); await page.waitForTimeout(600);
      await shot('139_결정순간-캐릭터');
      await act('pv-open'); await page.waitForTimeout(200);
      await act('pv-set', '[data-v="number"]'); await page.waitForTimeout(200);
      if (await has('[data-act="pv-close"]')) await act('pv-close'); await page.waitForTimeout(300);
    }
    const usable = info.cards.filter((c) => !c.off);
    if (usable.length && (!got.play || !got.prob)) {
      for (const c of usable) {
        await act('mo-card', `[data-v="${c.v}"]`); await page.waitForTimeout(250);
        const nOpts = await page.locator('.mo-opts .po-choice:visible').count();
        if (nOpts > info.opts && !got.play) { got.play = true; await shot('79_결정순간-플레이카드'); report.fold79 = await fold(); useCard = c; pick = nOpts - 1; break; }
        if (nOpts === info.opts && !got.prob) { got.prob = true; await act('mo-pick', '[data-v="0"]'); await page.waitForTimeout(200); await shot('79p_결정순간-확률카드'); report.fold79p = await fold(); useCard = c; break; }
        await act('mo-card', `[data-v="${c.v}"]`); await page.waitForTimeout(150);
      }
    }
  }
  if (!info.react) {
    if (await page.locator(`[data-act="mo-pick"][data-v="${pick}"].is-selected`).count() === 0) await act('mo-pick', `[data-v="${pick}"]`);
    await page.waitForTimeout(250);
    if (n === 0) await shot('77s_결정순간-고름');
  }
  if (info.react) await act('mo-pick-confirm', useCard ? ':not([data-v="0"])' : '[data-v="0"]');
  else await act('mo-confirm');
  await page.waitForTimeout(200);
  if (n === 0) await shot('81_결정결과-재생중');
  await page.waitForSelector('.po-splash', { timeout: 20_000 }).catch(() => null);
  await page.waitForTimeout(450);
  const tone = await page.evaluate(() => { const c = document.querySelector('.po-splash')?.className ?? ''; return /--ok/.test(c) ? 'success' : /--bad/.test(c) ? 'fail' : c; });
  if (useCard && !got.card) { got.card = true; await shot('84_결정결과-카드사용'); }
  else if (/success|goal/.test(tone) && !got.success) { got.success = true; await shot('82_결정결과-성공'); }
  else if (/fail|conceded/.test(tone) && !got.fail) { got.fail = true; await shot('83_결정결과-실패'); }
  if (n === 0) report.foldOutcome = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-act="oc-skip"]')].find((x) => x.offsetParent)?.getBoundingClientRect(); return b && Math.round(b.bottom); });
  if (await has('[data-act="oc-skip"]')) await act('oc-skip');
  if (Object.values(got).every(Boolean) || n >= 24) break;
}
report.got = got;
if (await has('[data-act="mo-auto"]')) await act('mo-auto');
await page.waitForSelector('main.screen-match', { timeout: 180_000 });
await page.waitForTimeout(600);
await dismiss();
await shot('155_경기결과');
if (await has('[data-act="hl-rewatch"]')) {
  await act('hl-rewatch');
  await page.waitForTimeout(600);
  await dismiss();
  await page.waitForTimeout(2500);
  await shot('118_다시보기-세로');
  report.replay = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, wide: [...document.querySelectorAll('.match *')].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map((e) => `${e.tagName}.${e.className}`),
    canvasH: document.getElementById('rp-canvas')?.getBoundingClientRect().height }));
}
console.log(JSON.stringify(report, null, 1));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
await browser.close();
