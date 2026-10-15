// 피치 렌더러 (24번, E5-lite): Canvas 2D 로 코트와 22명 마커, 공을 그린다.
// 마커 그리기는 MarkerRenderer 로 분리한다 (24.4). 기본은 숫자 원. 아이콘/사진 렌더러로 바꿔도 엔진과 게임 로직은 바뀌지 않는다.

import type { Replay, ReplayFrame, ReplayPlayer } from '../../replay';

const PITCH_L = 105;
const PITCH_W = 68;

/** 24.4 MarkerRenderer 입력 */
export interface MarkerInput {
  teamId: 0 | 1;
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

export const TEAM_COLORS: [string, string] = ['#d64545', '#2f6fd6'];
const GK_COLORS: [string, string] = ['#f2c14e', '#4ec9a8'];

/** 기본 렌더러: 숫자가 적힌 원 (팀 색 2종, GK 별색, 내 선수 강조 링) */
export const numberCircleRenderer: MarkerRenderer = {
  draw(ctx, m, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = m.gk ? GK_COLORS[m.teamId] : TEAM_COLORS[m.teamId];
    ctx.fill();
    ctx.lineWidth = m.state === 'carrier' ? 2 : 1;
    ctx.strokeStyle = m.state === 'carrier' ? '#ffffff' : 'rgba(0,0,0,0.45)';
    ctx.stroke();
    if (m.isMe) {
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffd34d';
      ctx.stroke();
    }
    ctx.fillStyle = m.gk ? '#1b1b1b' : '#ffffff';
    ctx.font = `bold ${Math.round(r * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(m.number), x, y + 0.5);
  },
};

/** 코트 (105 × 68 m, 24.2) */
export function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sx = w / PITCH_L;
  const sy = h / PITCH_W;
  ctx.fillStyle = '#2e7d3a';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i += 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fillRect((i * w) / 10, 0, w / 10, h);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.2;
  const rect = (x: number, y: number, rw: number, rh: number) => ctx.strokeRect(x * sx, y * sy, rw * sx, rh * sy);
  rect(0.3, 0.3, PITCH_L - 0.6, PITCH_W - 0.6);
  ctx.beginPath();
  ctx.moveTo((PITCH_L / 2) * sx, 0);
  ctx.lineTo((PITCH_L / 2) * sx, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse((PITCH_L / 2) * sx, (PITCH_W / 2) * sy, 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const left of [true, false]) {
    const x0 = left ? 0 : PITCH_L;
    const dir = left ? 1 : -1;
    const box = (depth: number, width: number) => rect(left ? x0 : x0 - depth, (PITCH_W - width) / 2, depth, width);
    box(16.5, 40.3);
    box(5.5, 18.3);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect((x0 + dir * 11) * sx - 1.5, (PITCH_W / 2) * sy - 1.5, 3, 3);
    // 골대
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(left ? 0 : w - 3, (PITCH_W / 2 - 3.66) * sy, 3, 7.32 * sy);
  }
}

/** 한 프레임 그리기: 코트 → 마커 → 공 */
export function drawFrame(
  ctx: CanvasRenderingContext2D, w: number, h: number, frame: ReplayFrame, players: Map<string, ReplayPlayer>,
  renderer: MarkerRenderer = numberCircleRenderer,
): void {
  drawPitch(ctx, w, h);
  const sx = w / PITCH_L;
  const sy = h / PITCH_W;
  const r = Math.max(6, Math.min(11, w / 70));
  for (const p of frame.players) {
    const info = players.get(p.id);
    if (!info) continue;
    renderer.draw(ctx, {
      teamId: info.team, number: info.number, role: info.position, isMe: info.isMe, gk: info.gk,
      state: frame.carrier === p.id ? 'carrier' : 'normal', ...(info.avatarUrl ? { avatarUrl: info.avatarUrl } : {}),
    }, p.x * sx, p.y * sy, r);
  }
  // 공: 높이(z)는 그림자 오프셋과 크기로
  const bx = frame.ball.x * sx;
  const by = frame.ball.y * sy;
  const lift = Math.min(8, frame.ball.z * 2);
  ctx.beginPath();
  ctx.arc(bx, by, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by - lift, 3.5 + lift * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#111';
  ctx.stroke();
}

export function playerMap(r: Replay): Map<string, ReplayPlayer> {
  return new Map(r.players.map((p) => [p.id, p]));
}

/** 캔버스 크기 (가로 기준, 105:68) */
export function pitchSize(width: number): [number, number] {
  return [width, Math.round((width * PITCH_W) / PITCH_L)];
}
