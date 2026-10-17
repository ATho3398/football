// 얼굴·엠블럼·설정·페이스온 확인 캡처 (부록 C.43): 실제 선수(손흥민)로 새 게임 → 홈(사진·로고) → 선수 화면 → 순위표(엠블럼)·리그 스타·득점 순위
// → 경기 결과 → 설정(페이스온: 업로드·자르기·나이대 칸) → 가상 유망주 새 게임 홈(기본 아바타) → 가상 선수 페이스온.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c43-capture.mjs [playwright 모듈 경로] [저장 폴더] [올릴 이미지]
// PC: W=1280 PREFIX=pc_ node scripts/c43-capture.mjs ...
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c43-check/', import.meta.url).pathname;
const UPLOAD = process.argv[4];
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, colorScheme: 'dark', deviceScaleFactor: Number(process.env.DPR ?? 1) });
const page = await ctx.newPage();
const errors = [];
const broken = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
page.on('response', (r) => { if (r.status() >= 400) broken.push(`${r.status()} ${r.url()}`); });
const shot = async (name, full = false, wait = 400) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 5; k++) {
    if (await has('[data-act="tips-off"]')) await page.locator('[data-act="tips-off"]').first().click();
    else if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}`).first().click(); await page.waitForTimeout(250); };
const scrollTo = async (sel) => { await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'start' })); await page.waitForTimeout(150); };
const report = { errors, broken };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForTimeout(500);
await shot('0_타이틀');

// 새 게임: 실제 선수 목록(사진)
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
await shot('1_새게임-실제선수');
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', 'c43-check');
await act('start');
await dismiss();
await act('opt-quick', '[data-v="quick"]');
await act('ctl-mode', '[data-v="auto"]');
await page.evaluate(() => window.scrollTo(0, 0));
await scrollTo('.po-pcard');
await shot('2_홈-선수카드');
report.homeImgs = await page.locator('.po-pcard img').evaluateAll((els) => els.map((e) => [e.getAttribute('src'), e.naturalWidth]));

// 선수 화면
await act('go-tab', '[data-v="player"]');
await dismiss();
await page.evaluate(() => window.scrollTo(0, 0));
await shot('3_선수화면');

// 경기: 다음 경기 날까지 → 경기 → 결과
await act('go-tab', '[data-v="home"]');
for (let k = 0; k < 20 && !(await has('[data-act="play"]')); k++) { await act('day-continue'); await page.waitForTimeout(400); }
await act('play');
await page.waitForTimeout(2500);
// 경기 화면 보기 (얼굴 / 등번호 / 캐릭터)
await dismiss();
await shot('4a_경기화면-캐릭터');
await act('pv-open');
await shot('4b_보기-시트');
await act('pv-set', '[data-v="face"]');
await shot('4c_경기화면-얼굴', false, 900);
await page.locator('#rp-canvas').screenshot({ path: `${OUT}/${P}4c2_피치-얼굴-확대.png` });
await act('pv-open');
await act('pv-set', '[data-v="number"]');
await shot('4d_경기화면-등번호', false, 600);
await act('pv-open');
await act('pv-set', '[data-v="face"]');
if (await has('[data-act="rp-skip"]')) { await act('rp-skip'); await act('rp-skip-ok'); }
await page.waitForTimeout(800);
if (await has('[data-act="rp-result"]')) await act('rp-result');
await dismiss();
await page.evaluate(() => window.scrollTo(0, 0));
await shot('4_경기결과');

// 순위표(엠블럼)·리그 스타·득점 순위
await act('go-tab', '[data-v="world"]');
await dismiss();
await shot('5_순위표-엠블럼', true);
await act('world-tab', '[data-v="stars"]');
await shot('5b_리그스타');
await act('world-tab', '[data-v="scorers"]');
await shot('5c_득점순위');

// 설정 → 페이스온
await act('go-tab', '[data-v="home"]');
await act('go', '[data-to="settings"]');
await dismiss();
await shot('6_설정', true);
// 내 선수(손흥민) 고르고 나이대 칸에 올리기
await act('faceon-pick', '[data-key="p:son"]');
await page.evaluate(() => window.scrollTo(0, 0));
await scrollTo('.fo-editor');
await shot('7_페이스온-나이대칸');
if (UPLOAD) {
  await page.locator('#fo-file').setInputFiles(UPLOAD).catch(() => {});
  // 버튼을 눌러 키·칸을 정한 뒤 파일 넣기
  await page.evaluate(() => { const i = document.getElementById('fo-file'); i.dataset.key = 'p:son'; i.dataset.slot = 'young'; });
  await page.locator('#fo-file').setInputFiles(UPLOAD);
  await page.waitForTimeout(600);
  await page.locator('#fo-zoom').fill('160');
  await page.locator('#fo-y').fill('-40');
  await shot('8_위치맞추기-정사각형미리보기');
  await act('faceon-crop-save');
  await page.waitForTimeout(800);
  await scrollTo('.fo-editor');
  await shot('9_페이스온-올린뒤');
  // 구단 엠블럼
  await act('faceon-tab', '[data-v="clubs"]');
  await shot('10_페이스온-구단', true);
  await act('go-tab', '[data-v="home"]');
  await scrollTo('.po-pcard');
  await shot('11_홈-페이스온반영');
}
// 가상 유망주 새 게임 (기본 아바타)
await page.evaluate(() => window.scrollTo(0, 0));
await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.waitForTimeout(500);
await act('go', '[data-to="new"]');
await page.fill('#f-seed', 'c43-prospect');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(300);
await act('start');
await dismiss();
await scrollTo('.po-pcard');
await shot('12_가상유망주-홈');
await act('go-tab', '[data-v="home"]');
await act('go', '[data-to="settings"]');
await page.fill('#fo-q', '잭');
await page.waitForTimeout(600);
await scrollTo('.fo-list');
await shot('13_페이스온-가상선수검색');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 1));
console.log('errors', errors.length, 'broken', broken.length);
await browser.close();
