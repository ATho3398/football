// U17-c 확인 캡처 (17차 S08 경기 준비 · S09 결정 순간 · 하프타임). 세이브: npx vite-node scripts/u17c-save.ts -- <SAVES>
// 실행: npx vite --port 5173 & 그다음 SAVES=<폴더> W=390 H=844 PREFIX=after_ node scripts/u17c-capture.mjs [저장 폴더]
// 검사(적용 명세 4절): 가로 넘침 0 · 페이지 오류 0 · 본문 12px 미만 글자 0 · 누르는 영역 44px 미만 0
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW ?? 'playwright');
const OUT = process.argv[2] ?? new URL('../docs/captures/u17c/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const W = Number(process.env.W ?? 390), H = Number(process.env.H ?? 844), P = process.env.PREFIX ?? '';
const SAVES = process.env.SAVES;
const URL0 = process.env.URL ?? 'http://localhost:5173/';
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'u17c-')), { viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, serviceWorkers: 'block', hasTouch: W < 1024 });
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
  const root = document.querySelector('main') ?? document.body; // 경기 준비 아래 고정 줄도 main 안
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
  const stage = document.querySelector('.mo-stage');
  return { overflow, small: [...new Set(small)].slice(0, 14), tap: [...new Set(tap)].slice(0, 14), stageH: stage ? Math.round(stage.getBoundingClientRect().height) : null };
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
const toPrep = async () => { await click('play'); await page.waitForSelector('main.screen-prep', { timeout: 30000 }); await page.waitForTimeout(500); await dismiss(); };
await open('first.json'); await toPrep(); await shot('S08-a_첫경기', !wide);
await open('mid.json'); await toPrep(); await shot('S08-b_시즌중'); if (!wide) await shot('S08-b_시즌중_전체', true);
await open('direct.json'); await toPrep(); await shot('S08-d_직접모드', !wide);
// 결정 순간
if (process.env.ONLY === 'prep') { writeFileSync(`${OUT}/${P}${W >= 1024 ? 'pc' : W}_check.json`, JSON.stringify(report, null, 2)); console.log('errors', errors.length, errors.slice(0, 3)); await ctx.close(); process.exit(0); }
await click('prep-start');
const waitMoment = async () => { for (let i = 0; i < 60 && !(await has('.mo-panel, .ht-sheet, .mo-rsheet')); i++) { await dismiss(); await page.waitForTimeout(2000); if (i === 3) await page.screenshot({ path: `${OUT}/debug_${W}.png` }); }
  await page.waitForSelector('.mo-panel, .ht-sheet, .mo-rsheet', { timeout: 120000 }); await page.waitForTimeout(1600); };
await waitMoment();
for (let k = 0; k < 12 && !(await has('.mo-panel .mo-opts .po-choice')); k++) { // 카드 장면 · 하프타임이면 넘김
  if (await has('[data-act="ht-keep"]')) await click('ht-keep'); else if (await has('[data-act="mo-pick-confirm"]')) await click('mo-pick-confirm', { v: '0' });
  await page.waitForTimeout(400); if (await has('[data-act="oc-skip"]')) await click('oc-skip'); await waitMoment();
}
await shot('S09-a_고르기전'); if (!wide) await shot('S09-a_고르기전_전체', true);
await page.locator('.mo-opts .po-choice').last().click(); await page.waitForTimeout(500); await shot('S09-b_고름', !wide);
const usable = page.locator('.mo-cards [data-act="mo-card"]:not([disabled]):not(.is-disabled)');
for (let i = 0; i < await usable.count(); i++) { // 리셋 카드(확인 모달)는 건너뜀
  await usable.nth(i).click(); await page.waitForTimeout(400);
  if (await has('.po-modal:visible, [role="dialog"].po-modal')) { await page.keyboard.press('Escape'); await dismiss(); const c = page.locator('.po-modal button:has-text("취소")'); if (await c.count()) await c.first().click(); await page.waitForTimeout(300); continue; }
  break;
}
await page.evaluate(() => document.querySelector('.mo-hand')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/${P}${W >= 1024 ? 'pc' : W}_S09-c_카드-패.png` });
await shot('S09-c_카드', !wide);
await click('mo-confirm'); await page.waitForTimeout(1200); await shot('S09-d_결과재생');
await page.waitForSelector('[data-act="oc-skip"]', { timeout: 30000 }); await page.waitForTimeout(6000); await shot('S09-e_결과');
// 하프타임까지 맡기기
for (let k = 0; k < 60 && !(await has('.ht-sheet')); k++) {
  if (await has('[data-act="oc-skip"]')) { await click('oc-skip'); await page.waitForTimeout(300); }
  if (await has('[data-act="mo-delegate"]')) { await click('mo-delegate'); await page.waitForTimeout(300); }
  else if (await has('[data-act="mo-pick-confirm"]')) { await click('mo-pick-confirm', { v: '0' }); await page.waitForTimeout(300); }
  await page.waitForSelector('.mo-panel, .ht-sheet, .mo-rsheet, [data-act="oc-skip"]', { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(300);
}
if (await has('.ht-sheet')) { await page.waitForTimeout(800); await shot('S09-g_하프타임', !wide); }
writeFileSync(`${OUT}/${P}${W >= 1024 ? 'pc' : W}_check.json`, JSON.stringify(report, null, 2));
console.log('errors', errors.length, errors.slice(0, 3));
await ctx.close();
