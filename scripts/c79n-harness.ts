// C.79n 하네스 (폼 효과 문구 · 주전 경쟁 피로 칸): 홈 주전 경쟁 카드 · 경기 준비 내 상태 · 결과 폼 칩을 피로 30/60/80 으로 그린다.
// 개발 서버에서만: npx vite --port 5179 → http://localhost:5179/scripts/c79n-harness.html?f=30|60|80 (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/design/skin-b.css';
import '../src/ui/style.css';
import { setSkin } from '../src/ui/skin';
import { endDay, isMatchDay, newGame, playOthers, playRound, type GameState } from '../src/game';
import { homeVM, matchResultVM } from '../src/ui/viewModels';
import { homeView } from '../src/ui/views/home';
import { competitionVM } from '../src/ui/managerVM';
import { competitionSection } from '../src/ui/views/manager';
import { prepVM } from '../src/ui/prepVM';
import { prepView } from '../src/ui/views/prep';
import { matchResultView } from '../src/ui/views/matchResult';

const q = new URLSearchParams(location.search);
const f = Number(q.get('f') ?? 60);
setSkin('b');
document.documentElement.dataset.skin = 'b';
const toMatchDay = (g: GameState) => { for (let i = 0; i < 40 && !isMatchDay(g); i++) { playOthers(g, 'quick'); endDay(g); } };
const g = newGame({ mode: 'real', playerId: 'son', seed: 'c79n-check', difficulty: 'normal' });
for (let i = 0; i < 12 && g.player.recentRatings.length < 5; i++) { toMatchDay(g); playRound(g, { engine: 'quick' }); }
// 폼 줄·칩이 보이게 최근 평점 5경기를 채운다 (화면 확인용)
g.player.recentRatings = [7.4, 7.2, 7.6, 7.0, 7.3];
for (let i = 0; i < 4; i++) { toMatchDay(g); playRound(g); if ((g.matchLog.at(-1)?.minutes ?? 0) > 0) break; }
const result = matchResultView(matchResultVM(g, null)!);
toMatchDay(g);
g.player.fatigue = f;
g.player.seasonFatigue = 0;
const comp = competitionVM(g);
const body = `<h3 style="padding:8px">피로 ${f}</h3>${homeView(homeVM(g), '', comp ? competitionSection(comp) : '')}<hr>${prepView(prepVM(g)!)}<hr>${result}`;
const app = document.getElementById('app')!;
app.className = 'app-home';
app.innerHTML = `<main class="screen screen-home">${body}</main>`;
document.body.dataset.ready = '1';
