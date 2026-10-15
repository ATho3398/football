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
  draw(ctx: CanvasRenderingContext2D, m: MarkerInput, x: number, y: number, r: number, pulse?: number): void;
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

/** 내 선수 마커 배율 (24번 개정, 부록 C.23: 약 1.3배) */
export const ME_SCALE = 1.3;

/**
 * 기본 렌더러: 숫자가 적힌 원 (우리/상대 2종). 내 선수는 디자인 Pitch README 대로 흰 테두리 + mine 고리,
 * 크기 1.3배와 은은한 맥박(pulse 0~1). 공을 가지면 고리가 더 밝고 굵다 (부록 C.23)
 */
export const numberCircleRenderer: MarkerRenderer = {
  draw(ctx, m, x, y, r, pulse = 0) {
    const rr = m.isMe ? r * ME_SCALE : r;
    if (m.isMe) {
      const carrier = m.state === 'carrier';
      // 바깥 맥박 고리 (옅게 커졌다 줄어든다)
      ctx.beginPath();
      ctx.arc(x, y, rr + 4 + pulse * 4, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = withAlpha(PALETTE.mine, (carrier ? 0.55 : 0.35) * (1 - pulse));
      ctx.stroke();
      // 안쪽 고리
      ctx.beginPath();
      ctx.arc(x, y, rr + 3, 0, Math.PI * 2);
      ctx.lineWidth = carrier ? 3.5 : 2.5;
      ctx.strokeStyle = carrier ? PALETTE.mine : withAlpha(PALETTE.mine, 0.8);
      if (carrier) {
        ctx.shadowColor = PALETTE.mine;
        ctx.shadowBlur = 8;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
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

/** '#rrggbb' 또는 'rgb(...)' 에 투명도 */
function withAlpha(color: string, a: number): string {
  const c = color.trim();
  if (c.startsWith('#') && c.length === 7) {
    const n = parseInt(c.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
  }
  return c;
}

/** 내 선수 이름표 (마커 위 상시, 부록 C.23) */
function drawNameTag(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, r: number, w: number): void {
  const size = Math.max(10, Math.round(r * 1.05));
  ctx.font = `700 ${size}px ${PALETTE.font}`;
  const tw = ctx.measureText(name).width + 10;
  const th = size + 6;
  const bx = Math.min(w - tw - 2, Math.max(2, x - tw / 2));
  const by = Math.max(2, y - r * ME_SCALE - 6 - th);
  ctx.fillStyle = 'rgba(18,19,23,0.82)';
  ctx.beginPath();
  ctx.roundRect(bx, by, tw, th, th / 2);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE.mine;
  ctx.stroke();
  ctx.fillStyle = PALETTE.mine;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, bx + tw / 2, by + th / 2 + 0.5);
}

/** 이름표용 짧은 이름 (성 빼고 마지막 단어, 한 단어면 그대로) */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name.trim();
}

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

/** 공 지름 배율 (24번 개정, 부록 C.23: 약 1.6배) */
export const BALL_R = 5.1;

/** 한 프레임 그리기: 코트 → 마커 → 공 → 내 선수 이름표. time = 맥박용 시각(초) */
export function drawFrame(
  ctx: CanvasRenderingContext2D, w: number, h: number, frame: ReplayFrame, players: Map<string, ReplayPlayer>,
  renderer: MarkerRenderer = numberCircleRenderer, mySide: 0 | 1 = 0, time = 0,
): void {
  drawPitch(ctx, w, h);
  const sx = w / PITCH_L;
  const sy = h / PITCH_W;
  const r = markerRadius(w);
  const pulse = (Math.sin(time * Math.PI * 1.6) + 1) / 2;
  // 내 선수는 맨 위에 그린다
  const list = [...frame.players].sort((a, b) => Number(players.get(a.id)?.isMe ?? false) - Number(players.get(b.id)?.isMe ?? false));
  let me: { name: string; x: number; y: number } | null = null;
  for (const p of list) {
    const info = players.get(p.id);
    if (!info) continue;
    let px = p.x * sx;
    let py = p.y * sy;
    if (info.isMe) {
      // 터치라인 밖에 있어도 고리가 보이게 가장자리 안으로
      const m = r * ME_SCALE + 4;
      px = Math.min(w - m, Math.max(m, px));
      py = Math.min(h - m, Math.max(m, py));
      me = { name: shortName(info.name), x: px, y: py };
    }
    renderer.draw(ctx, {
      teamId: info.team, ours: info.team === mySide, number: info.number, role: info.position, isMe: info.isMe, gk: info.gk,
      state: frame.carrier === p.id ? 'carrier' : 'normal', ...(info.avatarUrl ? { avatarUrl: info.avatarUrl } : {}),
    }, px, py, r, info.isMe ? pulse : 0);
  }
  // 공: 땅의 그림자는 제자리, 공은 높이(z, m)만큼 위로 뜨고 조금 커진다. 그림자는 높을수록 옅고 넓다
  const bx = frame.ball.x * sx;
  const by = frame.ball.y * sy;
  const z = Math.max(0, frame.ball.z);
  const lift = Math.min(14, z * 3);
  const shadowR = BALL_R * (1 + Math.min(0.6, z * 0.12));
  ctx.beginPath();
  ctx.ellipse(bx, by + 1, shadowR, shadowR * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${(z > 0.3 ? 0.45 - Math.min(0.25, z * 0.05) : 0.45).toFixed(3)})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by - lift, BALL_R * (1 + Math.min(0.3, lift * 0.025)), 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  if (me) drawNameTag(ctx, me.name, me.x, me.y, r, w);
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
