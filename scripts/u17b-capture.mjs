// U17-b 확인 캡처 (17차 S06 홈 3탭 · PC 3열). 세이브: npx vite-node scripts/u17b-save.ts -- <SAVES>
// 실행: npx vite --port 5173 & 그다음 SAVES=<폴더> W=390 H=844 PREFIX=after_ node scripts/u17b-capture.mjs [저장 폴더]
// 검사(적용 명세 4절): 가로 넘침 0 · 페이지 오류 0 · 홈 본문 12px 미만 글자 0 · 누르는 영역 44px 미만 0 · 폰 [오늘] 다음 경기 · 내 상태가 844 − 독 안
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW ?? 'playwright');
const OUT = process.argv[2] ?? new URL('../docs/captures/u17b/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const W = Number(process.env.W ?? 390), H = Number(process.env.H ?? 844), P = process.env.PREFIX ?? '';
const SAVES = process.env.SAVES;
const URL0 = process.env.URL ?? 'http://localhost:5173/';
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'u17b-')), { viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: W < 1024 });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const report = { W, H, errors, screens: {} };
async function putSave(slot, json) {
  await page.evaluate(async ([slot, json]) => {
    const raw = new TextEncoder().encode(json);
    const data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const s = JSON.parse(json);
    const meta = { slot, savedAt: new Date().toISOString(), name: s.player.name, season: s.league.season, round: s.league.round, age: s.player.age, startPatch: s.startPatch, date: s.calendar.date, size: data.length };
    await new Promise((ok, bad) => {
      const req = indexedDB.open('football-career', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('saves');
      req.onsuccess = () => { const tx = req.result.transaction('saves', 'readwrite'); tx.objectStore('saves').put({ meta, data, enc: 'gzip', raw: json.length }, `slot:${slot}`); tx.oncomplete = () => { req.result.close(); ok(); }; tx.onerror = () => bad(tx.error); };
      req.onerror = () => bad(req.error);
    });
  }, [slot, json]);
}
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    let hit = false;
    for (const s of ['[data-act="intro-ok"]', '.fm-card [data-act="fm-close"]', '[data-act="tip-close"]', '[data-act="modal-close"]']) {
      if (await has(`${s}:visible`)) { await page.locator(`${s}:visible`).first().click().catch(() => {}); hit = true; await page.waitForTimeout(150); }
    }
    if (!hit) break;
  }
}
const click = (act, data = {}) => page.evaluate(([act, data]) => {
  const b = document.createElement('button'); b.dataset.act = act; for (const [k, v] of Object.entries(data)) b.dataset[k] = v;
  b.hidden = true; document.getElementById('app').appendChild(b); b.click();
}, [act, data]);
const measure = () => page.evaluate(() => {
  const vw = innerWidth;
  const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
  const root = document.querySelector('main') ?? document.body;
  const small = [], tap = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || !el.offsetParent) continue;
    if (el.closest('.po-hero__kit, .po-hero__num, .po-hero__value, svg')) continue; // 머리말 큰 숫자 · 아이콘
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) small.push(`${t.slice(0, 16)} ${fs}px (${el.className})`);
  }
  for (const b of root.querySelectorAll('button, [role="button"], a[href]')) {
    const rc = b.getBoundingClientRect();
    if (!rc.width || !rc.height || !b.offsetParent) continue;
    if (rc.width < 44 || rc.height < 44) tap.push(`${(b.getAttribute('aria-label') ?? b.textContent).trim().slice(0, 16)} ${Math.round(rc.width)}×${Math.round(rc.height)} (${b.className})`);
  }
  // 첫 화면: 독 위끝(폰) 기준 다음 경기 · 내 상태 아래끝
  const dock = document.querySelector('.dock-bar');
  const limit = dock ? dock.getBoundingClientRect().top : innerHeight;
  const bottom = (sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().bottom) : null; };
  return { overflow, small: [...new Set(small)].slice(0, 12), tap: [...new Set(tap)].slice(0, 12), dockTop: Math.round(limit), nextBottom: bottom('.next-card'), condBottom: bottom('.hm-cond'), tilesBottom: bottom('.hm-ctiles'), heroH: Math.round(document.querySelector('.po-hero')?.getBoundingClientRect().height ?? 0) };
});
const shot = async (name, full = false) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${P}${W >= 1024 ? 'pc' : W}_${name}.png`, fullPage: full });
  report.screens[name] = await measure();
  console.log(name, JSON.stringify(report.screens[name]));
};
const open = async (file) => {
  await page.goto(URL0);
  await page.waitForSelector('[data-act="go"]');
  await page.evaluate(() => localStorage.clear());
  await putSave('auto', readFileSync(join(SAVES, file), 'utf8'));
  await page.reload();
  await page.waitForSelector('[data-act="continue"]');
  await page.click('[data-act="continue"]');
  await page.waitForTimeout(1500);
  await dismiss();
};
const wide = W >= 1024;
await open('mid.json');
await shot('S06-a_오늘탭');
if (!wide) {
  await shot('S06-a_오늘탭_전체', true);
  await click('home-tab', { v: 'season' }); await shot('S06-b_시즌탭', true);
  await click('home-tab', { v: 'comp' }); await shot('S06-c_경쟁탭', true);
  await click('home-tab', { v: 'today' });
} else await shot('S06-a_3열_전체', true);
await open('matchday.json'); await shot('S06-d_경기날');
await open('first.json'); await shot('S06-e_첫날가이드', !wide);
await open('injured.json'); await shot('S06-h_부상중');
await click('inj-return-open'); await shot('S06-l_부상복귀시트');
await open('offseason.json'); await shot('S06-i_비시즌');
if (await has('[data-act="pos-open"]')) { await click('pos-open'); await shot('S06-k_포지션변경시트'); }
writeFileSync(`${OUT}/${P}${W >= 1024 ? 'pc' : W}_check.json`, JSON.stringify(report, null, 2));
console.log('errors', errors.length);
await ctx.close();
