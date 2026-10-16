// 커스텀 포메이션·새 역할 확인 캡처 (부록 C.33): 빌드한 앱을 390×844 다크로 열어 3경기를 치르고 전술 화면에서
// 커스텀 탭 → 선수 끌어다 놓기 → 역할 시트(새 역할 이름) → 저장 → 다음 경기까지 캡처한다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c33-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c33-check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.message); });
const shot = async (name, full = true) => { await page.waitForTimeout(250); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('saved', name); };
const act = (a, extra = '') => page.locator(`[data-act="${a}"]${extra}`).first().click();
const has = async (sel) => (await page.locator(sel).count()) > 0;

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await act('go', '[data-to="new"]');
await page.fill('#f-name', '김민준');
await page.fill('#f-seed', 'c33check');
await act('start');
await page.waitForTimeout(400);
await act('tips-off');
for (let i = 0; i < 3; i++) {
  await act('play');
  await page.waitForSelector('#rp-canvas');
  if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
  await act('rp-skip');
  await act('rp-skip-ok');
  await page.waitForTimeout(300);
  await act('go', '[data-to="home"]').catch(() => act('go-tab', '[data-v="home"]'));
  await page.waitForTimeout(300);
  if (await has('[data-act="intro-ok"]')) await act('intro-ok');
}
await act('tac-open');
await act('tac-detail');
await act('tac-form', '[data-v="4-3-1-2"]');
await shot('1_새포메이션-4-3-1-2');
await act('tac-form', '[data-v="custom"]');
await shot('2_커스텀-편집시작');
// 끌어다 놓기: 9번 슬롯(ST)을 피치 오른쪽 위(오른쪽 측면 공격형 미드 부근)로
const pitch = page.locator('.po-fpitch.is-edit');
await pitch.scrollIntoViewIfNeeded();
const box = await pitch.boundingBox();
const slot = page.locator('[data-drag="9"]');
const sb = await slot.boundingBox();
await page.mouse.move(sb.x + sb.width / 2, sb.y + 12);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.42, { steps: 8 });
await page.mouse.up();
await shot('3_커스텀-끌어다놓음');
// 눌러 고른 뒤 놓을 곳 누르기: 1번(LB)을 수비형 미드 왼쪽(LWB) 쪽으로
const box2 = await pitch.boundingBox();
const lb = await page.locator('[data-drag="1"]').boundingBox();
await page.mouse.click(lb.x + lb.width / 2, lb.y + 12);
await page.mouse.click(box2.x + box2.width * 0.12, box2.y + box2.height * 0.6);
await shot('4_커스텀-눌러서옮김');
await act('tac-edit');
await act('tac-role-open', '[data-v="9"]');
await shot('5_역할시트-새이름', false);
await act('tac-sheet-close', ':is(button)');
await act('tac-save');
await shot('6_저장후');
console.log(errors.length ? `오류 ${errors.length}개` : '페이지 오류 없음');
await browser.close();
