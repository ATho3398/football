// C.81v 확인 캡처: ① 대표팀 경기 준비 전술 칸(조별 1차전 세이브) ② 탈락 뒤 [계속] → 남은 대회 경기 날짜대로·휴가·인박스 소식(탈락 세이브)
// ③ 결정 결과·결과 화면 결정 기록의 위험 등급 칩 + 리플레이 재생 중 득점 피드(새 게임 직접 모드 1경기) ④ 리그 우승 축하 오버레이 배경(우승 확정 최종 라운드 세이브).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 W=390 H=844 PREFIX=390_ ONLY=prep,out,moment,title node scripts/c81v-capture.mjs <세이브 폴더>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const SAVES = process.argv[2] ?? new URL('../docs/captures/c81v/', import.meta.url).pathname;
const OUT = process.argv[3] ?? new URL('../docs/captures/c81v/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
const URL0 = process.env.URL ?? 'http://localhost:4173/football/';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 2, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const report = { W, H, errors, screens: {}, notes: {} };
const has = async (sel) => (await page.locator(sel).count()) > 0;
const check = () => page.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth }));
const shot = async (name, full = false) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full });
  report.screens[name] = await check();
  console.log('saved', name, JSON.stringify(report.screens[name]));
};
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').first().click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); return page.locator(`[data-act="${a}"]${extra}:visible`).first().click(); };
const top = () => page.evaluate(() => window.scrollTo(0, 0));
const go = async (to) => {
  await page.evaluate((x) => {
    const b = document.querySelector(`[data-act="go"][data-to="${x}"]`);
    if (b) return b.click();
    const t = document.createElement('button');
    t.dataset.act = 'go'; t.dataset.to = x; t.style.display = 'none';
    document.querySelector('#app').appendChild(t); t.click(); t.remove();
  }, to);
  await page.waitForTimeout(500); await dismiss(); await top();
};
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
async function fresh() {
  await page.goto(URL0);
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await page.waitForSelector('[data-act="go"]');
}
async function load(file) {
  await fresh();
  await putSave('auto', readFileSync(`${SAVES}/${file}`, 'utf8').trim());
  await page.reload();
  await page.waitForSelector('[data-act="continue"]');
  await page.click('[data-act="continue"]');
  await page.waitForTimeout(2500);
  await dismiss();
  await page.evaluate(() => { const g = globalThis.__game(); g.control.mode = 'auto'; g.options = { others: 'quick' }; });
}
/** 경기 준비까지 */
async function toPrep() {
  for (let k = 0; k < 40; k++) {
    if (await page.evaluate(() => !!document.querySelector('main.screen-prep'))) return true;
    await dismiss();
    if (!(await page.evaluate(() => !!document.querySelector('[data-act="sim-stop"]')))) await page.evaluate(() => (document.querySelector('[data-act="play"]') ?? document.querySelector('[data-act="day-continue"]'))?.click());
    await page.waitForTimeout(700);
  }
  return false;
}
async function playPrep() {
  const n0 = await page.evaluate(() => globalThis.__matchPerf.length);
  await act('prep-start');
  await page.waitForFunction((k) => globalThis.__matchPerf.length > k, n0, { timeout: 180000, polling: 100 });
  await page.waitForTimeout(1500); await dismiss(); await top();
}

if (want('prep')) {
  await load('save-group1.json');
  await toPrep();
  await page.waitForTimeout(500); await dismiss(); await top();
  await shot('1_대표팀-준비-전술칸');
  // 전술 칸을 화면 가운데로 (아래 고정 버튼 줄에 가리지 않게) — 가림 여부도 잰다
  if (await has('.prep-nat-tactic')) {
    await page.evaluate(() => document.querySelector('.prep-nat-tactic')?.closest('.panel, section, div')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    report.notes.prepCover = await page.evaluate(() => {
      const r = document.querySelector('.prep-nat-tactic').getBoundingClientRect();
      const bars = [...document.querySelectorAll('.prep-actions, .prep-foot, .dock-bar, [class*="sticky"]')].filter((x) => getComputedStyle(x).position === 'fixed' || getComputedStyle(x).position === 'sticky').map((x) => x.getBoundingClientRect().top).filter((t) => t > 0);
      const barTop = bars.length ? Math.min(...bars) : innerHeight;
      return { rowBottom: Math.round(r.bottom), barTop: Math.round(barTop), covered: r.bottom > barTop };
    });
    await shot('1b_대표팀-준비-전술칸-위치');
  }
  report.notes.prep = await page.evaluate(() => ({ natLine: document.querySelector('.prep-nat-tactic')?.textContent?.trim() ?? null, tacOpen: !!document.querySelector('main.screen-prep [data-act="tac-open"]') }));
}

if (want('out')) {
  await load('save-out.json');
  const st0 = await page.evaluate(() => { const g = globalThis.__game(); return { date: g.calendar.date, phase: g.phase, live: g.national.live?.id ?? null }; });
  await top();
  await shot('2_탈락다음날-홈');
  await go('national');
  await page.evaluate(() => document.querySelector('[data-act="nat-tab"][data-v="cups"]')?.click());
  await page.waitForTimeout(400); await top();
  await shot('2b_탈락다음날-대회-진행중', true);
  await go('home');
  // [계속] 한 번 → 시즌 끝까지 (휴가 동안 남은 대회 경기 날짜대로)
  const days = [];
  for (let k = 0; k < 6; k++) {
    const ph = await page.evaluate(() => globalThis.__game().phase);
    if (ph !== 'season') break;
    await dismiss();
    await page.evaluate(() => document.querySelector('[data-act="day-continue"]')?.click());
    await page.waitForFunction(() => !document.querySelector('[data-act="sim-stop"]') && !globalThis.__game()?.busy, null, { timeout: 120000 }).catch(() => null);
    await page.waitForTimeout(1500);
    days.push(await page.evaluate(() => globalThis.__game().calendar.date));
  }
  const st1 = await page.evaluate(() => { const g = globalThis.__game(); return { date: g.calendar.date, phase: g.phase, news: g.inbox.items.filter((x) => (x.key || '').startsWith('natnews:')).map((x) => `${x.date} ${x.title}`) }; });
  report.notes.out = { before: st0, after: st1, stops: days };
  await page.waitForTimeout(800); await dismiss(); await top();
  await shot('2c_시즌끝');
  await go('inbox');
  await shot('2d_인박스-대회소식');
}

if (want('moment')) {
  await fresh();
  await act('go', '[data-to="new"]');
  await page.waitForTimeout(300);
  if (await has('#f-seed')) { await page.fill('#f-seed', 'c81v-m'); await page.locator('#f-seed').dispatchEvent('change'); }
  await act('form', '[data-k="mode"][data-v="real"]');
  await page.waitForTimeout(300);
  if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
  await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
  await act('start');
  await page.waitForTimeout(800);
  for (const sel of ['[data-act="tips-off"]', '[data-act="opt-quick"][data-v="quick"]']) { await page.locator(`${sel}:visible`).first().click({ timeout: 1500 }).catch(() => null); await page.waitForTimeout(250); await dismiss(); }
  await toPrep();
  await page.waitForTimeout(300); await dismiss();
  if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
  if (await has('[data-act="ctl-stop"][data-v="all"]')) await act('ctl-stop', '[data-v="all"]');
  const n0 = await page.evaluate(() => globalThis.__matchPerf.length);
  await act('prep-start');
  let picked = 0;
  const chips = [];
  for (let loop = 0; loop < 300; loop++) {
    const done = await page.evaluate((k) => globalThis.__matchPerf.length > k || !!document.querySelector('main.screen-match'), n0);
    if (done) break;
    await page.waitForSelector('[data-act="mo-confirm"], [data-act="oc-skip"], [data-act="ht-keep"], main.screen-match', { timeout: 180_000 }).catch(() => null);
    await page.waitForTimeout(400);
    await dismiss();
    if (loop % 10 === 0) console.log('moment loop', loop, picked, await page.evaluate(() => [document.querySelector('main')?.className, [...document.querySelectorAll('[data-act]')].filter((b) => b.offsetParent).map((b) => b.dataset.act).slice(0, 12).join(',')]));
    if (await has('[data-act="ht-keep"]')) { await act('ht-keep'); continue; }
    if (await has('[data-act="oc-skip"]')) {
      if (picked && picked <= 2 && !report.screens[`3_결정결과-${picked}`]) {
        const c = await page.evaluate(() => ({ choice: document.querySelector('.oc-choice__t')?.textContent?.trim(), risk: document.querySelector('.oc-choice .po-risk')?.textContent?.trim() ?? null }));
        chips.push(c);
        await shot(`3_결정결과-${picked}`);
      }
      await act('oc-skip').catch(() => {}); await page.waitForTimeout(300); continue;
    }
    if (!(await has('[data-act="mo-confirm"]'))) { await page.waitForTimeout(300); continue; }
    if (await has('.mo-react')) { await act('mo-pick-confirm', '[data-v="0"]').catch(() => act('mo-confirm')); continue; }
    // 2번 고른 뒤로는 맡기기 + 자동(나머지 결정 순간에 멈추지 않음 — 캡처 시간 줄이기)
    if (picked >= 3) { await page.evaluate(() => { const g = globalThis.__game(); g.control.mode = 'auto'; }); await act('mo-delegate').catch(() => null); continue; }
    // 판정 있는 선택지(위험 칩이 붙은 줄)를 골라 확정
    const idx = await page.evaluate(() => { const rows = [...document.querySelectorAll('.mo-opts .po-choice')]; const i = rows.findIndex((b) => b.querySelector('.po-risk')); return i < 0 ? 0 : i; });
    await page.locator('.mo-opts [data-act="mo-pick"]').nth(idx).click().catch(() => null);
    await page.waitForTimeout(250);
    await act('mo-confirm').catch(() => null);
    picked++;
    // 결과 재생 중(실제 속도)과 결과 판 모두 위험 칩이 보인다 — 재생 중 한 장
    if (picked === 1) { await page.waitForTimeout(600); await shot('3_결정결과-재생중'); }
  }
  await page.waitForFunction((k) => globalThis.__matchPerf.length > k, n0, { timeout: 180000 }).catch(() => null);
  await page.waitForTimeout(1500); await dismiss(); await top();
  await shot('3c_결과화면');
  const dec = page.locator('.dec-row:not(.mr-clip)').first();
  if (await dec.count()) { await page.evaluate(() => { const el = document.querySelector('.dec-row:not(.mr-clip)'); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight / 3); }); await page.waitForTimeout(300); await shot('3d_결과-결정기록-위험칩'); }
  report.notes.moment = { picked, chips, decRows: await page.evaluate(() => [...document.querySelectorAll('.dec-row:not(.mr-clip) .dec-main b')].map((b) => b.textContent.trim())) };
  // 리플레이 재생 중 득점 피드 (방금 경기 리플레이 저장소)
  if (await has('[data-act="hl-rewatch"]')) {
    // 첫 경기 안내 오버레이는 이미 본 것으로 (재생을 멈춰 두므로)
    await page.evaluate(() => { globalThis.__game().guide.firstMatchSeen = true; });
    await act('hl-rewatch');
    await page.waitForTimeout(800);
    // 최고 배속 (배속 칩 마지막)
    await page.locator('[data-act="rp-speed"]').last().click().catch(() => null);
    // 장면을 넘기지 않고 실제 재생(최고 배속)으로 — 득점 줄이 피드에 뜨는 순간 캡처 (넘기면 피드가 그리기 전에 다음 장면으로 가 버린다)
    let ok = false;
    for (let k = 0; k < 60 && !ok; k++) {
      await dismiss();
      ok = await page.waitForFunction(() => !!document.querySelector('#rp-feed .po-feed--goal'), null, { timeout: 5000, polling: 100 }).then(() => true, () => false);
      if (!(await has('#rp-feed'))) break;
    }
    await dismiss();
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('#rp-feed')?.scrollIntoView({ block: 'center' }));
    await shot('4b_리플레이-재생중-득점피드');
    report.notes.replay = { goalFeed: ok, feed: await page.evaluate(() => [...document.querySelectorAll('#rp-feed .po-feed')].slice(0, 4).map((x) => x.textContent.trim())) };
  }
}

if (want('title')) {
  await load('save-title.json');
  console.log('title: prep', await toPrep());
  await playPrep();
  console.log('title: played', await page.evaluate(() => ({ d: globalThis.__game().calendar.date, ph: globalThis.__game().phase })));
  // 리그 최종전 뒤 남은 컵 경기(내 경기면 치르고)·날짜를 [계속]으로 넘겨 시즌 끝까지 → 축하 오버레이
  for (let k = 0; k < 30; k++) {
    if (await has('[data-act="celebrate-close"]')) break;
    if (await page.evaluate(() => !!document.querySelector('main.screen-prep'))) { await playPrep(); continue; }
    const ph = await page.evaluate(() => globalThis.__game().phase);
    if (ph !== 'season') { await go('home'); await page.waitForTimeout(800); if (await has('[data-act="celebrate-close"]')) break; await page.evaluate(() => document.querySelector('[data-act="go-tab"][data-v="season"]')?.click()); await page.waitForTimeout(1000); break; }
    await dismiss();
    await page.evaluate(() => (document.querySelector('[data-act="play"]') ?? document.querySelector('[data-act="day-continue"]'))?.click());
    await page.waitForFunction(() => !document.querySelector('[data-act="sim-stop"]'), null, { timeout: 120000 }).catch(() => null);
    await page.waitForTimeout(1500);
    console.log('title: step', k, await page.evaluate(() => ({ d: globalThis.__game().calendar.date, ph: globalThis.__game().phase, sc: document.querySelector('main')?.className })));
  }
  report.notes.title = { overlay: await has('[data-act="celebrate-close"]'), phase: await page.evaluate(() => globalThis.__game().phase), screen: await page.evaluate(() => document.querySelector('main')?.className) };
  await shot('4a_우승축하-오버레이');
}

writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ errors, notes: report.notes }, null, 1));
await browser.close();
