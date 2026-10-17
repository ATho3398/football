// 홈 하네스 (부록 C.57): 실게임에서 만들기 번거로운 홈 상태(미페 3종 · 최장 이름 · 1군 테스트 · 알림 쌓임 · 비시즌)를 같은 화면 코드(homeView)로 그려 캡처한다.
// 개발 서버에서만: npx vite --port 5177 → http://localhost:5177/scripts/c57-harness.html?who=son|cutout|none|long|arnold|trial|alerts|off&skin=b|a (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/design/skin-b.css';
import '../src/ui/style.css';
import { newGame, playRound, type GameState } from '../src/game';
import { autoCustom, customBudget } from '../src/custom';
import { initFaces, setFaceOn, setFaceOnCutout } from '../src/ui/faces';
import { setSkin } from '../src/ui/skin';
import { homeVM } from '../src/ui/viewModels';
import { alertCard, alertsHead, homeView } from '../src/ui/views/home';
import { todayRow } from '../src/ui/views/training';
import { dock } from '../src/ui/views/common';
import { HERO_NAME } from '../src/ui/components';

const q = new URLSearchParams(location.search);
const who = q.get('who') ?? 'son';
setSkin(q.get('skin') === 'a' ? 'a' : 'b');
document.documentElement.dataset.skin = q.get('skin') === 'a' ? 'a' : 'b';

function game(): GameState {
  if (who === 'none') return newGame({ mode: 'prospect', position: 'LW', seed: 'c57-h', difficulty: 'normal' });
  if (who === 'long') return newGame({ mode: 'real', playerId: 'lg-schweinsteiger', seed: 'c57-h', difficulty: 'normal' });
  if (who === 'arnold') return newGame({ mode: 'real', playerId: 'alexander-arnold', seed: 'c57-h', difficulty: 'normal' });
  if (who === 'trial') {
    const g = newGame({ mode: 'custom', seed: 'c57-trial', difficulty: 'normal', custom: { position: 'ST', age: 17, attributes: autoCustom('ST', customBudget(17, []), 180), body: { height: 180, weight: 75, foot: 'right', weakFoot: 3 }, tags: [], nationality: 'England', appearance: 'white', start: { kind: 'youth', club: 'liv' } } });
    playRound(g, { engine: 'quick' });
    playRound(g, { engine: 'quick' });
    return g;
  }
  return newGame({ mode: 'real', playerId: 'son', seed: 'c57-h', difficulty: 'normal' });
}

await initFaces();
const g = game();
if (who === 'cutout') {
  const blob = await (await fetch('/docs/design/player-one-design-b/samples/face-cutout-sample.webp')).blob();
  await setFaceOn('p:son', '손흥민', 'prime', blob);
  await setFaceOnCutout('p:son', true);
}
if (who === 'alerts' || who === 'off') {
  g.phase = 'offseason';
  g.player.unspentPoints = 30;
}
const vm = homeVM(g);
let top = '';
if (who === 'alerts') {
  const a = [
    alertCard({ icon: 'star', eyebrow: '태그 · 2018-19 시즌 끝', title: '노익장을 얻고, 유리몸(해제형)이 풀렸어요', body: '선수 → 몸·태그에서 전체를 봐요.', close: 'tag-notice-close' }),
    alertCard({ icon: 'swap', eyebrow: '이적 소식', title: '구단이 이적 제안을 거절했어요', body: '토트넘 홋스퍼가 맨체스터 유나이티드의 제안(이적료 134억 원)을 거절했어요.', close: 'market-refused-close', tone: 'news' }),
  ];
  top = alertsHead(a.length) + a.join('');
}
const app = document.getElementById('app')!;
app.className = 'has-nav app-home';
app.innerHTML = `<main class="screen screen-home">${homeView(vm, '', '', vm.training ? todayRow(vm.training) : '', top)}</main>${dock({ screen: 'home', prog: g.phase === 'season' ? { label: '계속', icon: 'chevron-right', act: 'day-continue', kind: 'continue' } : { label: '시즌 요약', icon: 'trophy', act: 'go-tab', kind: 'season' }, tacticsOpen: false, points: g.player.unspentPoints, more: false })}`;
await document.fonts.ready;
for (const el of app.querySelectorAll<HTMLElement>('.po-hero__name[data-fit]')) {
  let size = Number(el.dataset.fit) || HERO_NAME.full;
  const set = () => { el.style.fontSize = `${size}px`; };
  set();
  while (size > HERO_NAME.min && el.scrollWidth > el.clientWidth + 0.5) { size--; set(); }
}
await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); })));
document.body.dataset.ready = '1';
