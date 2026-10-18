// C.73b 하네스 (시즌 요약 하이라이트 3 · 커리어 요약 명예의 전당 · 자동 진행 시트): 브라우저에서 실제 게임 코드로 시즌을 돌려 그린다.
// 개발 서버에서만: npx vite --port 5177 → http://localhost:5177/scripts/c73b-harness.html?view=season|retired|sheet&skin=b|a (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/design/skin-b.css';
import '../src/ui/style.css';
import { setSkin } from '../src/ui/skin';
import { dock, type DockVM } from '../src/ui/views/common';
import { retiredView, seasonView } from '../src/ui/views/screens';
import { homeView } from '../src/ui/views/home';
import { autoSheet } from '../src/ui/views/progress';
import { autoSheetVM, homeVM, retiredVM, seasonVM } from '../src/ui/viewModels';
import { newGame, playRound, retire } from '../src/game';
import { recordRetirement, saveLegacy, type HallEntry } from '../src/legacy';

const q = new URLSearchParams(location.search);
const skin = q.get('skin') === 'a' ? 'a' : 'b';
setSkin(skin);
document.documentElement.dataset.skin = skin;
const view = q.get('view') ?? 'season';

const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c73b-check', difficulty: 'normal' });
const play = () => { while (g.phase === 'season') playRound(g, { engine: 'quick' }); };
let body = '';
if (view === 'sheet') {
  body = `${homeView(homeVM(g))}${autoSheet(autoSheetVM(g), 5, { alloc: true, event: true, injury: true })}`;
} else if (view === 'retired') {
  // 명예의 전당에 지난 커리어 2개를 미리 넣어 3줄을 보인다
  const old = (key: string, name: string, score: number, badges: number): HallEntry => ({
    key, name, position: 'CM', age: 36, lastSeason: 2034, seasons: 18, apps: 610, goals: 140, assists: 190, peakOvr: 88, reputation: 820, tier: 'worldClass', asset: 70, badges, trophies: 6, score,
  });
  saveLegacy({ hall: [old('x1', '이전 커리어 A', 1500, 2), old('x2', '이전 커리어 B', 600, 0)], bonus: null, done: ['x1', 'x2'] });
  g.player.age = 34;
  play();
  retire(g);
  body = retiredView(retiredVM(g, recordRetirement(g)));
} else {
  g.player.age = 24;
  play();
  body = seasonView(seasonVM(g)!);
}
const app = document.getElementById('app')!;
const dockVM: DockVM = {
  screen: view === 'season' ? 'season' : 'home',
  prog: view === 'season' ? { label: '시즌 요약', icon: 'trophy', act: 'noop', kind: 'season' } : { label: '계속', icon: 'play', act: 'noop', kind: 'continue' },
  tacticsOpen: true, points: 0, more: false, inbox: 0,
};
const nav = view === 'retired' ? '' : dock(dockVM);
const cls = view === 'season' ? 'season' : view === 'retired' ? 'retired' : 'home';
app.className = `${nav ? 'has-nav ' : ''}app-${cls}`;
app.innerHTML = `<main class="screen screen-${cls}">${body}</main>${nav}`;
document.body.dataset.ready = '1';
