// 피치 렌더러 (24번, E5-lite): Canvas 2D 로 코트와 22명 마커, 공을 그린다.
// 마커 그리기는 MarkerRenderer 로 분리한다 (24.4). 기본은 숫자 원. 아이콘/사진 렌더러로 바꿔도 엔진과 게임 로직은 바뀌지 않는다.
// 색은 디자인 토큰(--pitch, --team-home, --team-away, --mine)을 읽는다 (H.6 2번: 기존 렌더러 위에 스타일만, 우리 = 라임, 상대 = 주황 테두리)

import type { Replay, ReplayFrame, ReplayPlayer } from '../../replay';

const PITCH_L = 105;
const PITCH_W = 68;

/** 24.4 MarkerRenderer 입력 */
export interface MarkerInput {
  teamId: 0 | 1;
  /** 내 팀 마커 (디자인: 우리 = 라임 면, 상대 = 어두운 면 + 주황 테두리) */
  ours: boolean;
  number: number;
  role: string;
  isMe: boolean;
  /** 'carrier' = 공을 가진 선수 */
  state: 'normal' | 'carrier';
  gk: boolean;
  avatarUrl?: string;
}

export interface MarkerRenderer {
  /** (x, y) 화면 좌표에 반지름 r 마커를 그린다 */
  draw(ctx: CanvasRenderingContext2D, m: MarkerInput, x: number, y: number, r: number): void;
}

/** 디자인 토큰 색 (다크 기본값, 문서가 있으면 CSS 변수에서 읽는다) */
export const PALETTE = {
  pitch: '#1b1e24', home: '#d6ff3c', away: '#ff8a3d', awayFill: '#2c2f37', mine: '#5ee0ff', ink: '#121317', line: 'rgba(255,255,255,0.16)',
  font: 'Poppins, system-ui, sans-serif',
};

export function readPalette(): void {
  if (typeof document === 'undefined') return;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  PALETTE.pitch = v('--pitch', PALETTE.pitch);
  PALETTE.home = v('--team-home', PALETTE.home);
  PALETTE.away = v('--team-away', PALETTE.away);
  PALETTE.mine = v('--mine', PALETTE.mine);
}

/** 기본 렌더러: 숫자가 적힌 원 (우리/상대 2종, 내 선수 시안 링) */
export const numberCircleRenderer: MarkerRenderer = {
  draw(ctx, m, x, y, r) {
    const rr = m.isMe ? r * 1.25 : r;
    if (m.isMe) {
      ctx.beginPath();
      ctx.arc(x, y, rr + 3, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = PALETTE.mine;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fillStyle = m.ours ? PALETTE.home : PALETTE.awayFill;
    ctx.fill();
    ctx.lineWidth = m.state === 'carrier' || m.isMe ? 2 : 1.5;
    ctx.strokeStyle = m.state === 'carrier' || m.isMe ? '#f3f4f6' : m.ours ? PALETTE.ink : PALETTE.away;
    ctx.stroke();
    ctx.fillStyle = m.ours ? PALETTE.ink : PALETTE.away;
    ctx.font = `700 ${Math.round(rr * 1.0)}px ${PALETTE.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(m.number), x, y + 0.5);
  },
};

/** 코트 (105 × 68 m, 24.2): 디자인 Pitch 와 같은 어두운 면, 옅은 줄무늬와 선 */
export function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sx = w / PITCH_L;
  const sy = h / PITCH_W;
  ctx.fillStyle = PALETTE.pitch;
  ctx.fillRect(0, 0, w, h);
  for (let i = 1; i < 10; i += 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fillRect((i * w) / 10, 0, w / 10, h);
  }
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 1;
  const rect = (x: number, y: number, rw: number, rh: number) => ctx.strokeRect(x * sx, y * sy, rw * sx, rh * sy);
  rect(1, 1, PITCH_L - 2, PITCH_W - 2);
  ctx.beginPath();
  ctx.moveTo((PITCH_L / 2) * sx, sy);
  ctx.lineTo((PITCH_L / 2) * sx, h - sy);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse((PITCH_L / 2) * sx, (PITCH_W / 2) * sy, 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const left of [true, false]) {
    const x0 = left ? 1 : PITCH_L - 1;
    const box = (depth: number, width: number) => rect(left ? x0 : x0 - depth, (PITCH_W - width) / 2, depth, width);
    box(16.5, 40.3);
    box(5.5, 18.3);
    ctx.fillStyle = PALETTE.line;
    ctx.beginPath();
    ctx.arc((left ? 12 : PITCH_L - 12) * sx, (PITCH_W / 2) * sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function markerRadius(w: number): number {
  return Math.max(5.5, Math.min(10, w / 52));
}

/** 한 프레임 그리기: 코트 → 마커 → 공 */
export function drawFrame(
  ctx: CanvasRenderingContext2D, w: number, h: number, frame: ReplayFrame, players: Map<string, ReplayPlayer>,
  renderer: MarkerRenderer = numberCircleRenderer, mySide: 0 | 1 = 0,
): void {
  drawPitch(ctx, w, h);
  const sx = w / PITCH_L;
  const sy = h / PITCH_W;
  const r = markerRadius(w);
  // 내 선수는 맨 위에 그린다
  const list = [...frame.players].sort((a, b) => Number(players.get(a.id)?.isMe ?? false) - Number(players.get(b.id)?.isMe ?? false));
  for (const p of list) {
    const info = players.get(p.id);
    if (!info) continue;
    renderer.draw(ctx, {
      teamId: info.team, ours: info.team === mySide, number: info.number, role: info.position, isMe: info.isMe, gk: info.gk,
      state: frame.carrier === p.id ? 'carrier' : 'normal', ...(info.avatarUrl ? { avatarUrl: info.avatarUrl } : {}),
    }, p.x * sx, p.y * sy, r);
  }
  // 공: 높이(z)는 그림자 오프셋과 크기로
  const bx = frame.ball.x * sx;
  const by = frame.ball.y * sy;
  const lift = Math.min(8, frame.ball.z * 2);
  ctx.beginPath();
  ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by - lift, 3.2 + lift * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
}

/** 평균 위치 지도 (24.3): 홈 팀이 오른쪽으로 공격하는 방향으로 맞춘 선수별 평균 위치 */
export function drawAveragePositions(
  ctx: CanvasRenderingContext2D, w: number, h: number, avg: { id: string; x: number; y: number }[], players: Map<string, ReplayPlayer>,
  renderer: MarkerRenderer = numberCircleRenderer, mySide: 0 | 1 = 0,
): void {
  drawPitch(ctx, w, h);
  const r = markerRadius(w);
  for (const a of avg) {
    const info = players.get(a.id);
    if (!info) continue;
    renderer.draw(ctx, { teamId: info.team, ours: info.team === mySide, number: info.number, role: info.position, isMe: info.isMe, gk: info.gk, state: 'normal' }, (a.x / PITCH_L) * w, (a.y / PITCH_W) * h, r);
  }
}

export function playerMap(r: Replay): Map<string, ReplayPlayer> {
  return new Map(r.players.map((p) => [p.id, p]));
}

/** 캔버스 크기 (가로 기준, 105:68) */
export function pitchSize(width: number): [number, number] {
  return [width, Math.round((width * PITCH_W) / PITCH_L)];
}

/** 캔버스를 화면 너비·기기 배율에 맞춘다. 2D 컨텍스트와 그릴 크기를 돌려준다 */
export function fitCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = window.devicePixelRatio || 1;
  const [w, h] = pitchSize(canvas.clientWidth || 358);
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = `${h}px`;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
