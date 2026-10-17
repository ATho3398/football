// 도트 선수 아이콘 확인 하네스 (부록 C.45): 같은 경기 렌더러(drawFrame + 캐릭터 보기)로 두 팀(홈–원정) 킥오프 2분 뒤 한 장면을 그린다.
// 개발 서버에서만: npx vite --port 5175 → http://localhost:5175/scripts/c45-harness.html?h=liv&a=mun (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/style.css';
import { newGame } from '../src/game';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch } from '../src/engine/sim';
import { captureFrame, replayPlayers } from '../src/replay';
import { drawFrame, pixelRenderer, setPitchOrient, setPitchPixelResolver, setPitchTeams, setPitchView } from '../src/ui/pitch/renderer';
import { initFaces } from '../src/ui/faces';
import { homeKitOf, matchKitsOf, playerIcon } from '../src/ui/pixelIcons';

const q = new URLSearchParams(location.search);
const h = q.get('h') ?? 'liv';
const a = q.get('a') ?? 'mun';
const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c45-harness', difficulty: 'normal' });
const name = (id: string) => g.league.teams.find((t) => t.id === id)!.nameKo;
const rate = (id: string) => g.league.teams.find((t) => t.id === id)!.rating;
const hs = teamSetupFromRoster(g.rosters[h]!, rate(h), rate(a), g.worldSeed);
const as = teamSetupFromRoster(g.rosters[a]!, rate(a), rate(h), g.worldSeed);
const m = createMatch({ home: hs, away: as, mode: 'auto', difficulty: 'normal', seed: 4545, bigMatch: false });
while (m.state.t < Number(q.get('t') ?? 150)) m.step();
const frame = captureFrame(m.state);
const players = new Map(replayPlayers(hs, as).map((p) => [p.id, p]));
const teams: [string, string] = [name(h), name(a)];
setPitchView('character');
setPitchOrient((q.get('o') as 'portrait' | 'landscape') ?? 'portrait');
setPitchTeams(teams);
setPitchPixelResolver((mk, tm) => {
  if (!mk.id) return undefined;
  const kits = tm ? matchKitsOf(g, tm) : null;
  const kit = kits ? (mk.teamId === 0 ? (mk.gk ? kits.homeGk : kits.home) : (mk.gk ? kits.awayGk : kits.away)) : homeKitOf(g, mk.id, mk.isMe);
  return playerIcon(g, mk.id, mk.isMe, kit);
});
const app = document.getElementById('app')!;
const k = matchKitsOf(g, teams);
app.innerHTML = `<div class="m"><b>${teams[0]} (홈) – ${teams[1]}</b> · 유니폼 홈 ${k.home} / 원정 ${k.away} · GK ${k.homeGk} / ${k.awayGk}</div><canvas id="c"></canvas>`;
const c = document.getElementById('c') as HTMLCanvasElement;
const W = window.innerWidth;
const H = Math.round(window.innerHeight - 40);
const dpr = window.devicePixelRatio || 1;
c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`;
const ctx = c.getContext('2d')!;
ctx.scale(dpr, dpr);
const draw = () => drawFrame(ctx, W, H, frame, players, pixelRenderer, 0, 0);
void initFaces().then(() => {
  draw();
  // 레이어 이미지가 읽히면 다시 그린다
  setTimeout(draw, 400);
  setTimeout(() => { draw(); document.body.dataset.ready = '1'; }, 1200);
});
