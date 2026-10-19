// C.73a 하네스 (챕터 리뷰 · 시즌 요약 챕터 버튼 · 홈 챕터 칩 · 황혼 은퇴 챕터 리뷰): 브라우저에서 실제 게임 코드로 한 시즌을 돌려 그린다.
// 개발 서버에서만: npx vite --port 5177 → http://localhost:5177/scripts/c73-harness.html?view=chapter|season|home|retired&skin=b|a (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/design/skin-b.css';
import '../src/ui/style.css';
import { setSkin } from '../src/ui/skin';
import { dock, type DockVM } from '../src/ui/views/common';
import { chapterView, seasonView } from '../src/ui/views/screens';
import { homeView } from '../src/ui/views/home';
import { chapterReviewVM, homeVM, seasonVM } from '../src/ui/viewModels';
import { newGame, playRound, retire, startNextSeason } from '../src/game';

const q = new URLSearchParams(location.search);
const skin = q.get('skin') === 'a' ? 'a' : 'b';
setSkin(skin);
document.documentElement.dataset.skin = skin;
const view = q.get('view') ?? 'chapter';

const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c73-check', difficulty: 'normal' });
const play = () => { while (g.phase === 'season') playRound(g, { engine: 'quick' }); };
if (view === 'retired') {
  g.player.age = 32;
  play();
  startNextSeason(g);
  play();
  retire(g);
} else if (view !== 'home') {
  // 도약 챕터 두 시즌 (24 · 25세) → 25세 시즌 끝에 도약 챕터 닫힘
  g.player.age = 24;
  play();
  startNextSeason(g);
  play();
}
const app = document.getElementById('app')!;
const dockVM: DockVM = {
  screen: view === 'home' ? 'home' : 'season',
  prog: view === 'home' ? { label: '계속', icon: 'play', act: 'noop', kind: 'continue' } : { label: '시즌 요약', icon: 'trophy', act: 'noop', kind: 'season' },
  tacticsOpen: true, points: 0, more: false, inbox: 0,
};
const cvm = chapterReviewVM(g);
const body = view === 'home' ? homeView(homeVM(g))
  : view === 'season' ? seasonView(seasonVM(g)!)
  : cvm ? chapterView(cvm) : '<p>챕터 리뷰 없음</p>';
const nav = view === 'chapter' || view === 'retired' ? '' : dock(dockVM);
app.className = `${nav ? 'has-nav ' : ''}app-${view === 'home' ? 'home' : view === 'season' ? 'season' : 'chapter'}`;
app.innerHTML = `<main class="screen screen-${view === 'home' ? 'home' : view === 'season' ? 'season' : 'chapter'}">${body}</main>${nav}`;
document.body.dataset.ready = '1';
