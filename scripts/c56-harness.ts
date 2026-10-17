// 결정 순간 한 화면 하네스 (부록 C.56): 실경기에서 드문 "선택지 2개"(78)와 "카드 장면 시트"(80)를 같은 화면 코드(momentView + drawFrame 잘라 보기)로 그려 캡처한다.
// 개발 서버에서만: npx vite --port 5176 → http://localhost:5176/scripts/c56-harness.html?v=two|react&skin=b|a (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/design/skin-b.css';
import '../src/ui/style.css';
import type { Moment } from '../src/engine/moments';
import { newGame } from '../src/game';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch } from '../src/engine/sim';
import { captureFrame, replayPlayers } from '../src/replay';
import { cropLength, drawFrame, fitCanvas, readPalette, setPitchOrient } from '../src/ui/pitch/renderer';
import { momentCenter, momentView } from '../src/ui/views/moment';

const q = new URLSearchParams(location.search);
document.documentElement.dataset.skin = q.get('skin') === 'a' ? 'a' : 'b';
const g = newGame({ mode: 'real', playerId: 'son', seed: 'c56-harness', difficulty: 'normal' });
const rate = (id: string) => g.league.teams.find((t) => t.id === id)!.rating;
const hs = teamSetupFromRoster(g.rosters.tot!, rate('tot'), rate('lei'), g.worldSeed);
const as = teamSetupFromRoster(g.rosters.lei!, rate('lei'), rate('tot'), g.worldSeed);
const m = createMatch({ home: hs, away: as, mode: 'auto', difficulty: 'normal', seed: 5656, bigMatch: false });
while (m.state.t < Number(q.get('t') ?? 300)) m.step();
const frame = captureFrame(m.state);
const players = new Map(replayPlayers(hs, as).map((p, i) => [p.id, i === 9 ? { ...p, isMe: true } : p]));
const me = [...players.values()].find((p) => p.isMe)!;
const mp = frame.players.find((p) => p.id === me.id)!;
const base = { id: 3, t: 960, minute: 16, stake: 0.7, score: [2, 0] as [number, number], side: 0 as const, passives: [], me: me.id };
const opt = (kind: 'safe' | 'balanced' | 'gamble' | 'card', label: string, p: number, x: number, y: number, extra = {}) =>
  ({ kind, action: 'pass', label, p, success: '패스 연결', fail: '공을 뺏김', up: 0.02, down: -0.02, value: 0.02, to: { x, y }, ref: 0, ...extra });
const two: Moment = { ...base, type: 'onball', scene: 'keyPass', sure: true, cards: [],
  options: [opt('safe', '잭 라이트에게 전진 패스', 0.84, mp.x + 8, mp.y + 6), opt('gamble', '해리 케인에게 침투 패스', 0.41, mp.x + 20, mp.y - 8, { offside: 'mid' })] } as unknown as Moment;
const react: Moment = { ...base, type: 'react', scene: 'oppShot',
  options: [opt('safe', '카드 없이', 0.35, mp.x, mp.y)],
  cards: [
    { hand: 0, id: 'bodyBlock', name: '몸으로 막기', text: '상대 슈팅을 몸으로 막는 선택지 · 성공 +15%p', usable: true, role: 'play', option: opt('card', '몸으로 막기', 0.5, mp.x - 4, mp.y, { baseP: 0.35 }) },
    { hand: 1, id: 'spDefense', name: '세트피스 수비', text: '헤더 경합 +10%p', usable: true, role: 'prob', option: opt('card', '세트피스 수비', 0.45, mp.x - 4, mp.y, { baseP: 0.35 }) },
  ] } as unknown as Moment;
const v = q.get('v') === 'react' ? react : two;
setPitchOrient('portrait');
const app = document.getElementById('app')!;
app.className = 'has-nav app-moment';
app.innerHTML = `<main class="screen screen-moment">${momentView({ moment: v, teams: ['토트넘 홋스퍼', '레스터 시티'], selected: v.type === 'react' ? 1 : null, card: v.type === 'react' ? 0 : null, stop: 'important', last: null, count: 2 })}</main>
  <div style="position:fixed;left:0;right:0;bottom:0;height:72px;background:#0f1013;border-top:2px solid var(--brand);display:grid;place-items:center;color:var(--ink-muted);font-size:12px">독 자리 (72px)</div>`;
readPalette();
const c = document.getElementById('mo-canvas') as HTMLCanvasElement;
const { ctx, w, h, portrait } = fitCanvas(c, 0.5, { heightPx: c.parentElement!.clientHeight });
const center = momentCenter(frame, players, 0, me.id, v.options.map((o) => o.to), cropLength(w, h, portrait));
drawFrame(ctx, w, h, frame, players, undefined, 0, 0, { center, portrait });
document.body.dataset.ready = '1';
