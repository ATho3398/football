// 포지션 적성 확인 캡처 (부록 C.37): 새 게임 시작 후보 4자리(코치 한 줄 평·와일드카드) → "다른 포지션에서 고르기" →
// 시작 → 홈 포변 조언 카드(감독 한마디, 세이브에 조언을 넣어 다시 불러온다) → [그 포지션 보기] 시즌 중 변경 시트 → 뉴스 카드. 페이지 오류를 센다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c37-capture.mjs [playwright 모듈 경로] [저장 폴더]
// PC: W=1280 PREFIX=pc_ node scripts/c37-capture.mjs ...
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c37-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: W, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
const shot = async (name, full = false, wait = 0) => { if (wait) await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${P}${name}.png`, fullPage: full }); console.log('saved', name); };
const act = (a, extra = '') => page.locator(`[data-act="${a}"]${extra}`).first().click();
const has = async (sel) => (await page.locator(sel).count()) > 0;

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await act('go', '[data-to="new"]');
await page.fill('#f-seed', process.env.SEED ?? 'c37-check');
await page.locator('#f-seed').dispatchEvent('change');
await page.waitForTimeout(200);
await shot('1_새게임-후보4자리', true, 200);
console.log('후보:', (await page.locator('.cand').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim()).join(' | '));
await act('form-others');
await shot('2_다른포지션', true, 200);
await act('form-others');
await page.locator('.cand').last().click();
await page.waitForTimeout(200);
await act('start');
await page.waitForTimeout(500);
if (await has('[data-act="tips-off"]')) await act('tips-off');

// 세이브에 포변 조언을 넣고 다시 불러온다 (2시즌 부진을 기다리지 않고 카드 모양만 확인)
async function injectAdvice(kind) {
  await page.evaluate((kind) => {
    const k = 'football-career:auto';
    const f = JSON.parse(localStorage.getItem(k));
    const s = f.state;
    const pos = s.player.position === 'CB' ? 'CDM' : 'CB';
    s.player.advice = { kind, group: pos === 'CB' ? 'CB' : 'CDM', pos, from: s.player.position, season: s.league.season - 1, untilSeason: s.league.season, untilRound: 4 };
    s.player.adviceLog = kind === 'coach' ? [] : [{ season: s.league.season - 2, from: s.player.position }];
    localStorage.setItem(k, JSON.stringify(f));
  }, kind);
  await page.reload();
  await act('continue');
  await page.waitForTimeout(400);
  if (await has('[data-act="tips-off"]')) await act('tips-off');
}
await injectAdvice('coach');
await shot('3_조언카드-감독', false, 200);
await act('pos-open', '[data-v]');
await shot('4_조언-포지션시트', false, 300);
await act('sheet-close').catch(() => {});
await injectAdvice('news');
await shot('5_조언카드-뉴스', false, 200);
await act('advice-close');
await shot('6_조언카드-닫음', false, 200);
console.log('페이지 오류', errors.length);
await browser.close();
