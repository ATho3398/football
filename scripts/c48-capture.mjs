// 카드 그림·설정 → 카드 이미지·계약 중 이적 제안 확인 캡처 (부록 C.48, 명세 docs/ui-requests/card-art-batch03-apply.md 4절·2a절).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c48-capture.mjs [playwright 모듈 경로] [저장 폴더]. PC: W=1280 H=800 PREFIX=pc_
// 카드 보유·덱·카드 선택은 window.__game() 상태를 고쳐 강제한다 (하네스)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c48-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
const UPLOAD = new URL('../public/cards/art/regista.webp', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: Number(process.env.H ?? 844) }, colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
const shot = async (name, full = false, wait = 0) => { if (wait) await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { if (!['intro-ok', 'tip-close', 'tips-off'].includes(a)) await dismiss(); return page.locator(`[data-act="${a}"]${extra}`).first().click(); };
const scrollTo = async (sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(250); };
const waitImgs = () => page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); }))));
const report = { errors, broken };
const nav = async (to) => { await act('go-tab', '[data-v="home"]'); await page.waitForTimeout(300); await dismiss(); await act('go', `[data-to="${to}"]`); await page.waitForTimeout(400); await dismiss(); };

async function newGameReal(id, seed) {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
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
  if (await has('[data-act="opt-quick"][data-v="quick"]')) await act('opt-quick', '[data-v="quick"]');
}

// ── 1. 카드 그림 (4절 1~5) ──
await newGameReal('kane', 'c48-check');
await page.evaluate(() => {
  const g = window.__game();
  const own = ['sig-targetMan', 'sig-advancedForward', 'sig-poacher', 'sig-anchor', 'elastico', 'sig-classic10', 'sig-regista'];
  for (const id of own) g.cards.owned[id] = Math.max(1, g.cards.owned[id] ?? 0);
  const d = g.cards.decks[g.cards.active];
  g.cards.decks[g.cards.active] = [...own.slice(0, 5), ...d].slice(0, 14);
  g.cards.picks.push({ label: '시즌 종료 희귀 보상', options: ['sig-targetMan', 'elastico', 'sig-anchor'] });
});
await nav('deck');
await dismiss();
await waitImgs();
await scrollTo('.gc-pick');
await shot('4_카드획득-3택1-deck');
await scrollTo('.gc-grid');
await waitImgs();
await shot('2_덱편집-그림-섞인-mini');
await page.locator('[data-act="card-open"][data-v="sig-targetMan"]').first().click({ force: true });
await page.waitForTimeout(400);
await waitImgs();
await shot('1a_카드상세-등지고버티기-full');
await act('card-close', '.po-btn');
await page.locator('[data-act="card-open"][data-v="elastico"]').first().click({ force: true });
await page.waitForTimeout(400);
await waitImgs();
await shot('1b_카드상세-엘라스티코-full');
await act('card-close', '.po-btn');
// 역할 불일치 회색 (지금 역할과 다른 시그니처)
report.greyCards = await page.locator('.gc-grid .po-card.is-disabled').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
await page.locator('.gc-grid .po-card.is-disabled[data-v^="sig-"]').first().click({ force: true });
await page.waitForTimeout(400);
await waitImgs();
await shot('5_시그니처-역할불일치-회색');
await act('card-close', '.po-btn');

// ── 2. 설정 → 카드 이미지 (2a절 ⑦~⑪) ──
await nav('settings');
await act('ca-kind', '[data-v="signature"]');
await page.waitForTimeout(300);
await scrollTo('.ca-chips');
await waitImgs();
await shot('7_설정-카드이미지-목록-시그니처');
report.sigRows = await page.locator('.ca-row').count();
await act('ca-none');
await page.waitForTimeout(300);
report.noneRows = await page.locator('.ca-row').count();
await act('ca-none');
await page.waitForTimeout(200);
await act('ca-pick', '[data-key="sig-targetMan"]');
await page.waitForTimeout(500);
await scrollTo('.ca-editor');
await waitImgs();
await shot('8_편집칸-기본그림');
await page.locator('#ca-file').evaluate((el) => { el.dataset.key = 'sig-targetMan'; });
await page.setInputFiles('#ca-file', UPLOAD);
await page.waitForSelector('.ca-crop', { timeout: 5000 });
await page.locator('#ca-zoom').fill('130');
await page.locator('#ca-y').fill('8');
await page.waitForTimeout(300);
await waitImgs();
await shot('9_위치확대-맞추기');
await act('ca-crop-save');
await page.waitForTimeout(800);
await nav('deck');
await scrollTo('.gc-grid');
await waitImgs();
await shot('10_저장뒤-덱화면-반영');
await page.locator('[data-act="card-open"][data-v="sig-targetMan"]').first().click({ force: true });
await page.waitForTimeout(400);
await waitImgs();
await shot('10b_저장뒤-카드상세');
await act('card-close', '.po-btn');
await nav('settings');
await act('ca-kind', '[data-v="signature"]');
await act('ca-pick', '[data-key="sig-targetMan"]');
await page.waitForTimeout(300);
await act('ca-clear', '[data-key="sig-targetMan"]');
await page.waitForTimeout(600);
await scrollTo('.ca-editor');
await waitImgs();
await shot('11_기본으로-뒤');

// ── 3. 세이브 내보내기 "카드 이미지 포함" (⑬) ──
await nav('saves');
await act('ex-cards');
await page.waitForTimeout(200);
await scrollTo('.ex-cards');
await shot('13_내보내기-카드이미지-포함');
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), act('export')]);
report.exportName = dl ? dl.suggestedFilename() : null;

// ── 4. 경기 패(hand) + 경기 중 잠금 (4절 3, ⑫) ──
await act('go', '[data-to="home"]');
await page.waitForTimeout(300);
if (await has('[data-act="ctl-mode"][data-v="direct"]')) await act('ctl-mode', '[data-v="direct"]');
for (let k = 0; k < 6 && !(await has('[data-act="play"]')); k++) {
  if (await has('[data-act="day-continue"]')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
await act('play');
await page.waitForSelector('[data-act="mo-confirm"]', { timeout: 180_000 });
await page.waitForTimeout(1500);
await waitImgs();
await scrollTo('.po-hand');
await shot('3_결정순간-패-hand');
report.hand = await page.locator('.po-hand .po-card').evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label')}${e.querySelector('.po-art') ? ' [그림]' : ''}`));
await page.locator('[data-act="go-tab"][data-v="home"]').first().click();
await page.waitForTimeout(400);
await page.locator('[data-act="go"][data-to="settings"]').first().click();
await page.waitForTimeout(400);
await act('ca-kind', '[data-v="all"]');
await page.waitForTimeout(200);
await act('ca-pick', '[data-key="elastico"]');
await page.waitForTimeout(400);
await scrollTo('.ca-editor');
await shot('12_경기중-잠금');
report.lockedButtons = await page.locator('.ca-editor [data-act="ca-upload"]').evaluateAll((els) => els.map((e) => e.disabled));

// ── 5. 계약 2시즌 남은 비시즌 제안 (pending 78) ──
await newGameReal('kane', 'c48-offers');
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await act('ctl-mode', '[data-v="auto"]');
report.contractSet = await page.evaluate(() => { const g = window.__game(); g.market.contract.until = g.league.season + 2; return g.market.contract; });
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(200);
await act('sim-rest');
await act('auto-count', '[data-v]:last-child');
await act('auto-run');
{ const t0 = Date.now(); await page.waitForTimeout(1000); while (Date.now() - t0 < 900000 && (await has('.auto-layer'))) await page.waitForTimeout(300); }
await page.waitForTimeout(500);
await dismiss();
await act('go-tab', '[data-v="home"]');
await page.waitForTimeout(300);
await dismiss();
report.market = await page.evaluate(() => { const m = window.__game().market; return { offers: m.offers?.map((o) => [o.teamId, o.kind, o.fee]), refused: m.refused, contract: m.contract }; });
await shot('14a_홈-제안카드');
if (await has('[data-to="offers"]')) {
  await act('go', '[data-to="offers"]');
  await page.waitForTimeout(300);
  await shot('14_계약2시즌남음-비시즌-제안');
  await shot('14b_제안-전체', true);
  report.offers = await page.locator('.tr-offer').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
  report.tierNote = await page.locator('.body > p.small.muted').first().innerText().catch(() => '');
}
report.broken404 = broken.filter((b) => b.startsWith('404'));
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await browser.close();
