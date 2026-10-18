// 피치 렌더러 (24번, E5-lite): Canvas 2D 로 코트와 22명 마커, 공을 그린다.
// 마커 그리기는 MarkerRenderer 로 분리한다 (24.4). 기본은 숫자 원. 아이콘/사진 렌더러로 바꿔도 엔진과 게임 로직은 바뀌지 않는다.
// 색은 디자인 토큰(--pitch, --team-home, --team-away, --mine)을 읽는다 (H.6 2번: 기존 렌더러 위에 스타일만, 우리 = 라임, 상대 = 주황 테두리)

// 세로 화면 (부록 C.44a): 폰 세로면 피치를 90도 돌려 내 팀이 아래 → 위로 공격하게 그린다. 좌표 변환은 여기서만 (엔진 좌표·결과 그대로)

import { autoShortKo } from '../../names';
import type { Replay, ReplayFrame, ReplayPlayer } from '../../replay';

const PITCH_L = 105;
const PITCH_W = 68;

/** 24.4 MarkerRenderer 입력 */
export interface MarkerInput {
  /** 선수 id (얼굴 보기용, 부록 C.43) */
  id?: string;
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
  /** 이름 라벨을 마커 중심에서 얼마나 아래(반지름 rr 배수)에 둘지. 없으면 기본 */
  labelBelow?(rr: number): number;
}

/** 디자인 토큰 색 (다크 기본값, 문서가 있으면 CSS 변수에서 읽는다) */
export const PALETTE = {
  pitch: '#1b1e24', home: '#d6ff3c', away: '#ff8a3d', awayFill: '#2c2f37', mine: '#5ee0ff', ink: '#121317', line: 'rgba(255,255,255,0.16)',
  font: 'Poppins, system-ui, sans-serif',
  /** 이름표 모서리 (B 테마 2px, A 는 알약 = undefined) */
  labelR: undefined as number | undefined,
};

export function readPalette(): void {
  if (typeof document === 'undefined') return;
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  PALETTE.pitch = v('--pitch', PALETTE.pitch);
  PALETTE.home = v('--team-home', PALETTE.home);
  PALETTE.away = v('--team-away', PALETTE.away);
  PALETTE.mine = v('--mine', PALETTE.mine);
  PALETTE.labelR = document.documentElement.dataset.skin === 'b' ? 2 : undefined;
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

/** 이름표 글자 크기 (마커 반지름 기준) */
const labelSize = (r: number, me: boolean): number => Math.max(9, Math.min(14, Math.round(r * (me ? 0.82 : 0.72))));

/**
 * 이름표 한 장 (C.56 디자인 74): 내 선수 = 시안 바탕 + 검은 글자, 공 가진 선수 = 흰 바탕 + 검은 글자,
 * 나머지 = 반투명 검은 바탕(#121317 78%) + 흰 글자. 글자 그림자 없음. B 테마는 모서리 2px
 */
function drawLabelBox(ctx: CanvasRenderingContext2D, b: LabelBox, r: number): void {
  const size = labelSize(r, b.kind === 'me');
  ctx.font = `${b.kind === 'other' ? 600 : 800} ${size}px ${PALETTE.font}`;
  ctx.fillStyle = b.kind === 'me' ? PALETTE.mine : b.kind === 'carrier' ? '#f3f4f6' : 'rgba(18,19,23,0.78)';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, PALETTE.labelR ?? b.h / 2);
  ctx.fill();
  ctx.fillStyle = b.kind === 'other' ? 'rgba(243,244,246,0.95)' : PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
}

/** 이름표 자리 잡기 입력 (C.56 디자인 74) */
export interface LabelItem {
  id: string;
  /** 마커 중심 (화면 좌표) */
  x: number;
  y: number;
  /** 마커 반지름 (내 선수는 배율 적용) */
  rr: number;
  /** 겹침 판정용 마커 반 크기 (얼굴·캐릭터는 원보다 크다). 없으면 rr */
  box?: number;
  /** 풀네임(통용 이름)과 짧은 이름 */
  full: string;
  short: string;
  me: boolean;
  carrier: boolean;
  /** 공까지 거리 (가까운 순서로 자리를 먼저 잡는다) */
  dist: number;
}

export interface LabelBox { id: string; text: string; x: number; y: number; w: number; h: number; kind: 'me' | 'carrier' | 'other' }

/**
 * 이름표 겹침 규칙 (C.56, 5차 디자인 74):
 * ① 내 선수 — 항상 풀네임 ② 공 가진 선수 — 항상(풀네임, 겹치면 짧은 이름) ③ 나머지는 공에 가까운 순서로 마커 아래 → 위 자리를 찾고
 * ④ 다른 이름표·다른 마커와 겹치면 짧은 이름으로 다시 ⑤ 그래도 겹치면 숨김(번호 원만). 순수 함수 — 겹침 판정 테스트용
 */
export function layoutLabels(
  items: readonly LabelItem[], measure: (text: string, me: boolean) => { w: number; h: number },
  place: { below: (rr: number) => number; gap: number; width: number; height: number },
): LabelBox[] {
  const order = [...items].sort((a, b) => (a.me !== b.me ? (a.me ? -1 : 1) : a.carrier !== b.carrier ? (a.carrier ? -1 : 1) : a.dist - b.dist));
  const boxes: LabelBox[] = [];
  const marks = items.map((p) => { const k = p.box ?? p.rr; return { id: p.id, x: p.x - k, y: p.y - k, w: k * 2, h: k * 2 }; });
  const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const p of order) {
    const kind: LabelBox['kind'] = p.me ? 'me' : p.carrier ? 'carrier' : 'other';
    const texts = p.me ? [p.full] : p.full === p.short ? [p.full] : [p.full, p.short];
    const spot = (text: string, up: boolean): LabelBox => {
      const m = measure(text, p.me);
      const x = Math.min(place.width - m.w - 1, Math.max(1, p.x - m.w / 2));
      const below = Math.min(place.height - m.h - 1, p.y + p.rr * place.below(p.rr) + place.gap);
      const above = Math.max(1, p.y - p.rr * place.below(p.rr) - place.gap - m.h);
      return { id: p.id, text, x, y: up ? above : below, w: m.w, h: m.h, kind };
    };
    const free = (b: LabelBox) => !boxes.some((o) => hit(o, b)) && !marks.some((o) => o.id !== p.id && hit(o, b));
    let got: LabelBox | null = null;
    for (const t of texts) {
      for (const up of [false, true]) {
        const b = spot(t, up);
        if (free(b)) {
          got = b;
          break;
        }
      }
      if (got) break;
    }
    // 내 선수·공 가진 선수는 겹쳐도 보인다 (마지막 후보 = 가장 짧은 이름, 아래)
    if (!got && kind !== 'other') got = spot(texts.at(-1)!, false);
    if (got) boxes.push(got);
  }
  return boxes;
}

/** 이름표 풀네임 = 통용 이름 (리플레이 이름). 없으면 짧은 이름 */
const fullNameOf = (_id: string, name: string, short: string): string => name.trim() || short;

/** 이름표용 짧은 이름 (names.ts 자동 규칙: 마지막 단어, 접두어는 붙여서) */
export function shortName(name: string): string {
  return autoShortKo(name);
}

/** 코트 (105 × 68 m, 24.2): 디자인 Pitch 와 같은 어두운 면, 옅은 줄무늬와 선. 캔버스가 세로(h > w)면 90도 돌려 그린다 (C.44a) */
export function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (h > w) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.rotate(Math.PI / 2);
    drawPitch(ctx, h, w);
    ctx.restore();
    return;
  }
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

/** 마커 반지름: 캔버스 폭 기준(세로면 짧은 쪽) 기본값 × 선수 크기 설정 (C.44a: 기본 크게 = 1.5배) */
export function markerRadius(w: number, k = SIZE_K[pitchSize()]): number {
  return Math.max(5.5, Math.min(10, w / 52)) * k;
}

/** 공 지름 배율 (24번 개정, 부록 C.23: 약 1.6배) */
export const BALL_R = 5.1;

/**
 * 엔진 좌표(105 × 68 m) → 캔버스 좌표. 가로는 그대로, 세로(h > w)는 90도 돌려 dir 쪽(1 = x 증가 방향)을 위로 둔다.
 * 회전만 하고 뒤집지 않는다 (왼발·오른쪽 측면이 화면에서 그대로 보이게)
 */
export interface PitchProjection {
  portrait: boolean;
  toScreen(x: number, y: number): [number, number];
}

export function pitchProjection(w: number, h: number, dir: 1 | -1 = 1): PitchProjection {
  if (h <= w) return { portrait: false, toScreen: (x, y) => [(x * w) / PITCH_L, (y * h) / PITCH_W] };
  return {
    portrait: true,
    toScreen: dir > 0
      ? (x, y) => [(y * w) / PITCH_W, ((PITCH_L - x) * h) / PITCH_L]
      : (x, y) => [((PITCH_W - y) * w) / PITCH_W, (x * h) / PITCH_L],
  };
}

/** 내 팀이 공격하는 방향 (프레임에서: 내 골키퍼가 있는 쪽의 반대, 없으면 두 팀 평균 x 비교). 후반에 진영이 바뀌어도 내 팀이 늘 위로 */
export function attackDirOf(frame: ReplayFrame, players: Map<string, ReplayPlayer>, mySide: 0 | 1): 1 | -1 {
  let gk: number | null = null;
  let mx = 0, mn = 0, ox = 0, on = 0;
  for (const p of frame.players) {
    const info = players.get(p.id);
    if (!info) continue;
    if (info.team === mySide) {
      if (info.gk) gk = p.x;
      mx += p.x;
      mn++;
    } else {
      ox += p.x;
      on++;
    }
  }
  if (gk !== null) return gk < PITCH_L / 2 ? 1 : -1;
  if (mn && on) return mx / mn <= ox / on ? 1 : -1;
  return mySide === 0 ? 1 : -1;
}

interface Placed { id: string; info: ReplayPlayer; x: number; y: number; carrier: boolean }

/** 마커들을 겹침 순서(상대 → 우리 → 공 가진 선수 → 내 선수)로 그리고, 그 순서대로 이름 라벨 */
function drawMarkers(
  ctx: CanvasRenderingContext2D, w: number, h: number, list: Placed[], renderer: MarkerRenderer, mySide: 0 | 1, r: number, pulse: number,
  scope?: ReadonlyMap<string, ReplayPlayer>, ball?: [number, number],
): void {
  const rank = (p: Placed) => (p.info.isMe ? 3 : p.carrier ? 2 : p.info.team === mySide ? 1 : 0);
  const sorted = [...list].sort((a, b) => rank(a) - rank(b));
  for (const p of sorted) {
    renderer.draw(ctx, {
      id: p.id, teamId: p.info.team, ours: p.info.team === mySide, number: p.info.number, role: p.info.position, isMe: p.info.isMe, gk: p.info.gk,
      state: p.carrier ? 'carrier' : 'normal', ...(p.info.avatarUrl ? { avatarUrl: p.info.avatarUrl } : {}),
    }, p.x, p.y, r, p.info.isMe ? pulse : 0);
  }
  const mode = pitchNames();
  if (mode === 'off') return;
  const below = renderer === numberCircleRenderer ? 1.08 : 1.3;
  // 캔버스 밖(잘라 보기·확대로 안 보이는) 선수는 이름표도 없다 (가장자리에 이름표만 붙지 않게)
  const shown = sorted.filter((p) => (mode !== 'mine' || p.info.isMe) && p.x >= -r && p.x <= w + r && p.y >= -r && p.y <= h + r);
  const boxK = renderer === pixelRenderer ? 1.5 : renderer === faceRenderer ? 1.35 : 1;
  const items: LabelItem[] = shown.map((p) => {
    const short = nameOf(p.id, p.info.isMe, p.info.name, scope);
    return {
      id: p.id, x: p.x, y: p.y, rr: p.info.isMe ? r * ME_SCALE : r, box: (p.info.isMe ? r * ME_SCALE : r) * boxK, full: p.info.isMe ? p.info.name : fullNameOf(p.id, p.info.name, short), short,
      me: p.info.isMe, carrier: p.carrier, dist: ball ? Math.hypot(p.x - ball[0], p.y - ball[1]) : 0,
    };
  });
  const measure = (text: string, me: boolean) => {
    const size = labelSize(r, me);
    ctx.font = `${me ? 800 : 600} ${size}px ${PALETTE.font}`;
    return { w: Math.ceil(ctx.measureText(text).width + 8), h: size + 4 };
  };
  const boxes = layoutLabels(items, measure, { below: (rr) => renderer.labelBelow?.(rr) ?? below, gap: 2, width: w, height: h });
  for (const b of boxes) drawLabelBox(ctx, b, r);
}

/**
 * 세로 피치 보이는 범위 (C.56, 5차 Pitch crop): 캔버스가 피치 비율(105:68)보다 낮으면 공격 방향 일부만 그린다.
 * center = 보이는 칸 가운데의 공격 방향 비율(0 = 우리 골, 1 = 상대 골). 범위 길이는 캔버스 높이가 정한다
 */
export interface PitchFrameOpts {
  center?: number;
  /** 세로로 그린다 (잘라 보기 캔버스는 가로보다 낮을 수 있어 비율로 판단하지 않는다). 없으면 h > w */
  portrait?: boolean;
  /**
   * 가로 피치 확대 (C.69, 디자인 189 Pitch crop·cropY·aspect): 내 팀이 늘 왼쪽 → 오른쪽으로 공격하게 그리고(필요하면 180도 돌림),
   * 공격 방향 비율 [cx − len/2, cx + len/2] 만큼을 캔버스 폭 가득, 세로는 캔버스 비율대로 cy(공격 방향 기준 폭 좌표, m) 가운데로 자른다
   */
  view?: { cx: number; len: number; cy: number };
}

/** 엔진 y(m) → 공격 방향 기준 폭 좌표 (내 팀이 오른쪽으로 공격하게 돌렸을 때의 y) */
export function attackY(y: number, dir: 1 | -1): number {
  return dir > 0 ? y : PITCH_W - y;
}

/** 가로 확대 보기에서 보이는 폭 방향 길이(m): 캔버스 비율 (w × h) 과 공격 방향 길이 len 으로 */
export function viewHeightM(w: number, h: number, len: number): number {
  return Math.min(PITCH_W, (len * PITCH_L * h) / w);
}

/** 가로 확대 보기 세로 가운데를 피치 안으로 (터치라인 밖 4m 까지는 보여 줘 줄 근처 선수가 칸 끝에 붙지 않게) */
const VIEW_EDGE_M = 4;
export function clampViewY(cy: number, vh: number): number {
  return vh >= PITCH_W ? PITCH_W / 2 : Math.min(PITCH_W - vh / 2 + VIEW_EDGE_M, Math.max(vh / 2 - VIEW_EDGE_M, cy));
}

/** 엔진 x(m) → 공격 방향 비율 (0 = 우리 골, 1 = 상대 골) */
export function attackFrac(x: number, dir: 1 | -1): number {
  return dir > 0 ? x / PITCH_L : 1 - x / PITCH_L;
}

/** 세로 캔버스(w × h)가 보여 주는 피치 길이 비율 (1 = 전체) */
export function cropLength(w: number, h: number, portrait = h > w): number {
  if (!portrait) return 1;
  return Math.min(1, h / ((w * PITCH_L) / PITCH_W));
}

/** 보이는 칸 가운데를 범위 안으로 */
export function clampCenter(c: number, len: number): number {
  return len >= 0.999 ? 0.5 : Math.min(1 - len / 2, Math.max(len / 2, c));
}

/** 한 프레임 그리기: 코트 → 마커 → 이름 라벨 → 공. time = 맥박용 시각(초). 쓴 좌표 변환을 돌려준다 (결정 화살표용) */
export function drawFrame(
  ctx: CanvasRenderingContext2D, w: number, h: number, frame: ReplayFrame, players: Map<string, ReplayPlayer>,
  renderer: MarkerRenderer = activeRenderer(), mySide: 0 | 1 = 0, time = 0, opts: PitchFrameOpts = {},
): PitchProjection {
  const portrait = opts.portrait ?? h > w;
  if (!portrait && opts.view && opts.view.len < 0.999) return drawZoomed(ctx, w, h, frame, players, renderer, mySide, time, opts.view);
  const len = cropLength(w, h, portrait);
  // 잘라 보기: 전체 세로 피치(높이 fullH)를 그린 뒤 위로 oy 만큼 민다 (캔버스 밖은 그려지지 않음)
  const fullH = portrait ? (w * PITCH_L) / PITCH_W : h;
  const oy = portrait && len < 0.999 ? (1 - (clampCenter(opts.center ?? 0.5, len) + len / 2)) * fullH : 0;
  ctx.fillStyle = PALETTE.pitch;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(0, -oy);
  drawPitch(ctx, w, fullH);
  ctx.restore();
  const full = pitchProjection(w, fullH, portrait ? attackDirOf(frame, players, mySide) : 1);
  const proj: PitchProjection = oy ? { portrait: full.portrait, toScreen: (x, y) => { const [sx, sy] = full.toScreen(x, y); return [sx, sy - oy]; } } : full;
  const r = markerRadius(Math.min(w, fullH * (PITCH_L / PITCH_W)));
  const pulse = (Math.sin(time * Math.PI * 1.6) + 1) / 2;
  drawPlayersAndBall(ctx, w, h, frame, players, renderer, mySide, r, pulse, proj);
  return proj;
}

/** 마커 · 이름표 · 공 (drawFrame · drawZoomed 공통) */
function drawPlayersAndBall(
  ctx: CanvasRenderingContext2D, w: number, h: number, frame: ReplayFrame, players: Map<string, ReplayPlayer>,
  renderer: MarkerRenderer, mySide: 0 | 1, r: number, pulse: number, proj: PitchProjection,
): void {
  const list: Placed[] = [];
  for (const p of frame.players) {
    const info = players.get(p.id);
    if (!info) continue;
    let [px, py] = proj.toScreen(p.x, p.y);
    if (info.isMe) {
      // 터치라인 밖에 있어도 고리가 보이게 가장자리 안으로
      const m = r * ME_SCALE + 4;
      px = Math.min(w - m, Math.max(m, px));
      py = Math.min(h - m, Math.max(m, py));
    }
    list.push({ id: p.id, info, x: px, y: py, carrier: frame.carrier === p.id });
  }
  const [bx, by] = proj.toScreen(frame.ball.x, frame.ball.y);
  // 짧은 이름 겹침 판정은 이 경기 두 팀 명단(교체 포함) 안에서 (C.45, pending 60)
  drawMarkers(ctx, w, h, list, renderer, mySide, r, pulse, players, [bx, by]);
  // 공: 땅의 그림자는 제자리, 공은 높이(z, m)만큼 위로 뜨고 조금 커진다. 그림자는 높을수록 옅고 넓다
  const z = Math.max(0, frame.ball.z);
  const lift = Math.min(14, z * 3);
  const br = BALL_R * (1 + (SIZE_K[pitchSize()] - 1) * 0.4);
  const shadowR = br * (1 + Math.min(0.6, z * 0.12));
  ctx.beginPath();
  ctx.ellipse(bx, by + 1, shadowR, shadowR * 0.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${(z > 0.3 ? 0.45 - Math.min(0.25, z * 0.05) : 0.45).toFixed(3)})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, by - lift, br * (1 + Math.min(0.3, lift * 0.025)), 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
}

/**
 * 가로 확대 (C.69, 189): 피치 전체를 확대 배율로 그린 뒤 보이는 칸만큼 민다. 내 팀 공격 방향이 왼쪽이면 180도 돌린다(코트는 대칭이라 선은 그대로).
 * 원·번호·이름표는 확대 전 크기 그대로 (디자인 "덜 커져요")
 */
function drawZoomed(
  ctx: CanvasRenderingContext2D, w: number, h: number, frame: ReplayFrame, players: Map<string, ReplayPlayer>,
  renderer: MarkerRenderer, mySide: 0 | 1, time: number, view: { cx: number; len: number; cy: number },
): PitchProjection {
  const dir = attackDirOf(frame, players, mySide);
  const len = Math.max(0.2, view.len);
  const s = w / (len * PITCH_L);
  const fullW = PITCH_L * s;
  const fullH = PITCH_W * s;
  const vh = viewHeightM(w, h, len);
  const ox = (clampCenter(view.cx, len) - len / 2) * fullW;
  const oy = vh >= PITCH_W ? -(h - fullH) / 2 : (clampViewY(view.cy, vh) - vh / 2) * s;
  ctx.fillStyle = PALETTE.pitch;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(-ox, -oy);
  drawPitch(ctx, fullW, fullH);
  ctx.restore();
  const proj: PitchProjection = {
    portrait: false,
    toScreen: (x, y) => [(dir > 0 ? x : PITCH_L - x) * s - ox, attackY(y, dir) * s - oy],
  };
  const r = markerRadius(w);
  const pulse = (Math.sin(time * Math.PI * 1.6) + 1) / 2;
  drawPlayersAndBall(ctx, w, h, frame, players, renderer, mySide, r, pulse, proj);
  return proj;
}

/** 평균 위치 지도 (24.3): 홈 팀이 오른쪽으로 공격하는 방향으로 맞춘 선수별 평균 위치. 세로면 내 팀이 위로 */
export function drawAveragePositions(
  ctx: CanvasRenderingContext2D, w: number, h: number, avg: { id: string; x: number; y: number }[], players: Map<string, ReplayPlayer>,
  renderer: MarkerRenderer = numberCircleRenderer, mySide: 0 | 1 = 0,
): void {
  drawPitch(ctx, w, h);
  const proj = pitchProjection(w, h, mySide === 0 ? 1 : -1);
  const r = markerRadius(Math.min(w, h * (PITCH_L / PITCH_W)));
  const list: Placed[] = [];
  for (const a of avg) {
    const info = players.get(a.id);
    if (!info) continue;
    const [x, y] = proj.toScreen(a.x, a.y);
    list.push({ id: a.id, info, x, y, carrier: false });
  }
  drawMarkers(ctx, w, h, list, renderer, mySide, r, 0);
}

export function playerMap(r: Replay): Map<string, ReplayPlayer> {
  return new Map(r.players.map((p) => [p.id, p]));
}

/** 캔버스 크기: 가로 = 폭 × 68/105, 세로 = 폭 × 105/68 (C.44a) */
export function pitchCanvasSize(width: number, portrait = false): [number, number] {
  return [width, Math.round((width * (portrait ? PITCH_L : PITCH_W)) / (portrait ? PITCH_W : PITCH_L))];
}

/** fitCanvas 선택 (C.56): heightPx = 이 높이 안에 맞춘다(세로면 폭은 그대로 두고 피치를 잘라 보기), cropLen = 세로 피치를 이 길이 비율만 */
export interface FitOpts { heightPx?: number; cropLen?: number; /** 가로 확대 보기 (C.69): 폭 가득 × heightPx (피치 비율 무시, drawFrame view 로 자른다) */ fill?: boolean }

/**
 * 캔버스를 화면 너비·기기 배율에 맞춘다. 2D 컨텍스트와 그릴 크기를 돌려준다.
 * 세로 방향(C.44a)이면 높이를 화면 높이의 일정 비율로 막고, 넘치면 폭을 줄여 가운데 둔다.
 * C.56: heightPx 를 주면 세로 피치는 폭을 그대로 두고 높이만 줄여 공격 방향 일부를 보여 준다(drawFrame center)
 */
export function fitCanvas(canvas: HTMLCanvasElement, maxHRatio = PORTRAIT_MAX_H, opts: FitOpts = {}): { ctx: CanvasRenderingContext2D; w: number; h: number; portrait: boolean } {
  const dpr = window.devicePixelRatio || 1;
  const portrait = isPortraitPitch();
  const avail = canvas.parentElement?.clientWidth || canvas.clientWidth || 358;
  let [w, h] = pitchCanvasSize(avail, portrait);
  if (portrait && opts.heightPx !== undefined) {
    h = Math.max(Math.round(h * MIN_CROP), Math.min(h, Math.round(opts.heightPx)));
  } else if (portrait) {
    const want = opts.cropLen ? Math.round(h * opts.cropLen) : h;
    const maxH = Math.max(300, Math.round((window.innerHeight || 800) * maxHRatio));
    if (want > maxH) [w, h] = [Math.round((avail * maxH) / want), maxH];
    else h = want;
  } else if (opts.fill && opts.heightPx !== undefined) {
    h = Math.max(120, Math.round(opts.heightPx));
  } else if (opts.heightPx !== undefined && h > opts.heightPx) {
    [w, h] = [Math.round((Math.max(160, opts.heightPx) * PITCH_L) / PITCH_W), Math.max(160, Math.round(opts.heightPx))];
  }
  canvas.classList.toggle('is-portrait', portrait);
  const cssW = w < avail ? `${w}px` : '';
  if (canvas.style.width !== cssW) {
    canvas.style.width = cssW;
    canvas.style.marginInline = cssW ? 'auto' : '';
  }
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = `${h}px`;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, portrait };
}

/** 잘라 보기 최소 길이 (피치의 25%, 아주 낮은 화면) */
const MIN_CROP = 0.25;
/** 하이라이트 세로 피치 보이는 길이 (5차 Pitch crop [34,100] = 66%) */
export const REPLAY_CROP = 0.66;

/**
 * 잘라 보기 카메라 (C.56): 공이 보이는 칸 가장자리(여유 20%)에 닿으면 부드럽게 따라간다. 화면 표시만 (엔진·결과 무관)
 */
export class PitchCamera {
  center = 0.5;
  /** 가로 확대 보기 세로 가운데 (공격 방향 기준 폭 좌표 m, C.69) */
  cy = PITCH_W / 2;
  private last = 0;
  private lastY = 0;
  /** 가로 확대 보기 세로: 공이 보이는 칸 위아래 여유(20%)에 닿으면 따라간다 */
  followY(frame: ReplayFrame, players: Map<string, ReplayPlayer>, side: 0 | 1, vh: number, now: number, snap = false): number {
    if (vh >= PITCH_W) return (this.cy = PITCH_W / 2);
    const b = attackY(frame.ball.y, attackDirOf(frame, players, side));
    const m = vh * 0.2;
    const lo = this.cy - vh / 2 + m;
    const hi = this.cy + vh / 2 - m;
    const target = snap ? b : b < lo ? b + vh / 2 - m : b > hi ? b - vh / 2 + m : this.cy;
    const dt = this.lastY ? Math.min(0.25, Math.max(0, (now - this.lastY) / 1000)) : 0;
    this.lastY = now;
    this.cy = clampViewY(snap ? target : this.cy + (target - this.cy) * Math.min(1, dt * 3), vh);
    return this.cy;
  }
  /** 공 위치로 가운데를 갱신하고 돌려준다. snap = 바로 맞춤 (장면 시작) */
  follow(frame: ReplayFrame, players: Map<string, ReplayPlayer>, side: 0 | 1, len: number, now: number, snap = false): number {
    if (len >= 0.999) return (this.center = 0.5);
    const a = attackFrac(frame.ball.x, attackDirOf(frame, players, side));
    const m = len * 0.2;
    const lo = this.center - len / 2 + m;
    const hi = this.center + len / 2 - m;
    const target = snap ? a : a < lo ? a + len / 2 - m : a > hi ? a - len / 2 + m : this.center;
    const dt = this.last ? Math.min(0.25, Math.max(0, (now - this.last) / 1000)) : 0;
    this.last = now;
    this.center = clampCenter(snap ? target : this.center + (target - this.center) * Math.min(1, dt * 3), len);
    return this.center;
  }
}

/** 세로 피치 높이 상한 (화면 높이 비율). 결정 순간 화면은 아래 선택 시트가 있어 더 낮게 (PORTRAIT_MOMENT_MAX_H) */
const PORTRAIT_MAX_H = 0.68;
export const PORTRAIT_MOMENT_MAX_H = 0.5;

// ── 경기 화면 방향·선수 크기·이름 표시 (부록 C.44a): 기기 설정(세이브 아님), C.43 보기와 같은 저장 방식 ──

export type PitchOrient = 'auto' | 'landscape' | 'portrait';
export type PitchSizeOpt = 'normal' | 'large' | 'xlarge';
export type PitchNames = 'all' | 'mine' | 'off';
export const PITCH_ORIENT_KO: Readonly<Record<PitchOrient, string>> = { auto: '자동', landscape: '항상 가로', portrait: '항상 세로' };
export const PITCH_SIZE_KO: Readonly<Record<PitchSizeOpt, string>> = { normal: '보통', large: '크게', xlarge: '아주 크게' };
export const PITCH_NAMES_KO: Readonly<Record<PitchNames, string>> = { all: '켬', mine: '내 선수만', off: '끔' };
const SIZE_K: Readonly<Record<PitchSizeOpt, number>> = { normal: 1, large: 1.5, xlarge: 1.9 };

function pref<T extends string>(key: string, values: readonly T[], def: T): { get(): T; set(v: T): void } {
  let cur: T = def;
  try {
    const v = globalThis.localStorage?.getItem(key);
    if (v && (values as readonly string[]).includes(v)) cur = v as T;
  } catch {
    // 기본값
  }
  return {
    get: () => cur,
    set(v) {
      cur = v;
      try {
        globalThis.localStorage?.setItem(key, v);
      } catch {
        // 저장 못 해도 이번 실행에는 적용
      }
    },
  };
}

// C.66b: 기본 = 항상 가로 (C.44a 의 '자동 = 좁으면 세로'는 롤백). 예전에 저장된 'auto' 도 가로로 읽는다
const orientPref = pref<PitchOrient>('po-pitch-orient', ['auto', 'landscape', 'portrait'], 'landscape');
const sizePref = pref<PitchSizeOpt>('po-pitch-size', ['normal', 'large', 'xlarge'], 'large');
const namesPref = pref<PitchNames>('po-pitch-names', ['all', 'mine', 'off'], 'all');
export const pitchOrient = (): PitchOrient => (orientPref.get() === 'portrait' ? 'portrait' : 'landscape');
export const setPitchOrient = (v: PitchOrient): void => orientPref.set(v);
/** 결정 순간·결정 결과 가로 피치 [확대]/[전체] (C.69, 189): 기기 설정 */
export type MomentZoom = 'zoom' | 'full';
const zoomPref = pref<MomentZoom>('po-mo-zoom', ['zoom', 'full'], 'zoom');
export const momentZoom = (): MomentZoom => zoomPref.get();
export const setMomentZoom = (v: MomentZoom): void => zoomPref.set(v);
/** 결정 순간 확대 길이 (디자인 crop [44, 100] = 공격 방향 56%, 약 1.8배) */
export const MOMENT_ZOOM_LEN = 0.56;
export const pitchSize = (): PitchSizeOpt => sizePref.get();
export const setPitchSize = (v: PitchSizeOpt): void => sizePref.set(v);
export const pitchNames = (): PitchNames => namesPref.get();
export const setPitchNames = (v: PitchNames): void => namesPref.set(v);

/** 지금 피치를 세로로 그리나: 설정에서 '항상 세로'를 고른 때만 (C.66b: 'auto'·기본은 가로) */
export function isPortraitPitch(): boolean {
  return orientPref.get() === 'portrait';
}

/** 선수 id → 라벨 이름 (화면이 정한다: 별명 > 짧은 이름). 기본은 리플레이 이름의 짧은 이름 */
let nameOf: (id: string, isMe: boolean, fallback: string, scope?: ReadonlyMap<string, ReplayPlayer>) => string = (_id, _me, fallback) => autoShortKo(fallback);
export function setPitchNameResolver(f: (id: string, isMe: boolean, fallback: string, scope?: ReadonlyMap<string, ReplayPlayer>) => string): void {
  nameOf = f;
}

// ── 경기 화면 보기 (부록 C.43): 얼굴(미니페이스) / 등번호(기존 숫자 원, 기본) / 캐릭터(도트 얼굴). 고른 값은 이 기기에 남긴다 ──

export type PitchView = 'face' | 'number' | 'character';
export const PITCH_VIEW_KO: Readonly<Record<PitchView, string>> = { face: '얼굴', number: '등번호', character: '캐릭터' };
const VIEW_KEY = 'po-pitch-view2';

let view: PitchView = (() => {
  try {
    const v = globalThis.localStorage?.getItem(VIEW_KEY);
    return v === 'face' || v === 'number' || v === 'character' ? v : 'number';
  } catch {
    return 'number';
  }
})();

export function pitchView(): PitchView {
  return view;
}

export function setPitchView(v: PitchView): void {
  view = v;
  try {
    globalThis.localStorage?.setItem(VIEW_KEY, v);
  } catch {
    // 저장 못 해도 이번 실행에는 적용
  }
}

/** 선수 id → 이미지 주소 (화면이 정한다). kind 'face' = 미니페이스(없으면 기본 아바타), 'pixel' = 도트 얼굴(없으면 등번호) */
export type FaceKind = 'face' | 'pixel';
let faceUrl: (id: string, isMe: boolean, kind: FaceKind) => string | undefined = () => undefined;
export function setPitchFaceResolver(f: (id: string, isMe: boolean, kind: FaceKind) => string | undefined): void {
  faceUrl = f;
}

const images = new Map<string, HTMLImageElement | null>();
function imageFor(url: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const hit = images.get(url);
  if (hit !== undefined) return hit && hit.complete && hit.naturalWidth > 0 ? hit : null;
  const img = new Image();
  img.decoding = 'async';
  img.onerror = () => images.set(url, null);
  img.src = url;
  images.set(url, img);
  return null;
}

/** 기본 아바타 (지금 아바타와 같은 그림, CSS 변수 대신 고정 색) */
const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><path d="M22 160c4-30 26-44 58-44s54 14 58 44z" fill="#6b7280"/><rect x="68" y="92" width="24" height="26" rx="8" fill="#d9a77f"/><ellipse cx="80" cy="70" rx="28" ry="32" fill="#e8b98f"/><path d="M51 66c-2-24 12-38 30-38 17 0 31 11 29 34-6-9-16-14-28-14-12 0-23 6-31 18z" fill="#1d1a19"/><ellipse cx="70" cy="74" rx="3" ry="4" fill="#1d1a19"/><ellipse cx="90" cy="74" rx="3" ry="4" fill="#1d1a19"/></svg>`;
const FALLBACK_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FALLBACK_SVG)}`;

/** 정사각형 칸(한 변 s, 왼쪽 위 l·t)에 비율 그대로: 짧은 쪽은 비우고(투명) 아래쪽 맞춤 — 미니페이스 규칙과 같다 */
function drawSquare(ctx: CanvasRenderingContext2D, img: HTMLImageElement, l: number, t: number, s: number, snap = false): void {
  const k = s / Math.max(img.naturalWidth, img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  const r = (v: number) => (snap ? Math.round(v) : v);
  ctx.drawImage(img, r(l + (s - w) / 2), r(t + s - h), r(w), r(h));
}

function meRings(ctx: CanvasRenderingContext2D, m: MarkerInput, x: number, y: number, rr: number, pulse: number): void {
  if (!m.isMe) return;
  const carrier = m.state === 'carrier';
  ctx.beginPath();
  ctx.arc(x, y, rr + 4 + pulse * 4, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = withAlpha(PALETTE.mine, (carrier ? 0.55 : 0.35) * (1 - pulse));
  ctx.stroke();
}

/** 얼굴 보기: 정사각형 미니페이스 그대로(틀 없음) + 아래 팀 색 밑줄. 내 선수는 맥박 고리와 mine 밑줄, 공 가진 선수는 흰 밑줄 */
export const faceRenderer: MarkerRenderer = {
  draw(ctx, m, x, y, r, pulse = 0) {
    const rr = m.isMe ? r * ME_SCALE : r;
    const s = rr * 2.7;
    meRings(ctx, m, x, y, rr * 1.15, pulse);
    const url = (m.id && faceUrl(m.id, m.isMe, 'face')) || undefined;
    const img = (url && imageFor(url)) || imageFor(FALLBACK_URL);
    if (img) drawSquare(ctx, img, x - s / 2, y - s / 2 - s * 0.08, s);
    else {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fillStyle = m.ours ? PALETTE.home : PALETTE.awayFill;
      ctx.fill();
    }
    const bw = s * 0.82;
    const bh = Math.max(3, rr * 0.42);
    const by = y + s / 2 - s * 0.08 - bh * 0.4;
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, by, bw, bh, bh / 2);
    ctx.fillStyle = m.ours ? PALETTE.home : PALETTE.away;
    ctx.fill();
    if (m.state === 'carrier') {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#f3f4f6';
      ctx.stroke();
    }
  },
};

// ── 캐릭터 보기 (부록 C.45): 16px 인물 레이어 + 유니폼 레이어를 겹친 도트 아이콘, 정수 배(×2·×3)로 보간 없이. 아래에 작은 등번호 ──

/** 이 경기의 팀 [홈, 원정] (팀 id 또는 화면 이름). 재생·결정 화면이 그리기 전에 넣는다 → 경기 유니폼 고르기 */
let matchTeams: readonly [string, string] | null = null;
export function setPitchTeams(teams: readonly [string, string] | null): void {
  matchTeams = teams;
}
export function pitchTeams(): readonly [string, string] | null {
  return matchTeams;
}

/** 마커 → 겹쳐 그릴 16px 이미지 주소들(아래 → 위). 화면이 정한다 (선수 인물 + 경기 유니폼). 없으면 등번호 */
let pixelLayers: (m: MarkerInput, teams: readonly [string, string] | null) => string[] | undefined = (m) => {
  const u = m.id ? faceUrl(m.id, m.isMe, 'pixel') : undefined;
  return u ? [u] : undefined;
};
export function setPitchPixelResolver(f: (m: MarkerInput, teams: readonly [string, string] | null) => string[] | undefined): void {
  pixelLayers = f;
}

/** 이 경기 두 팀 몸통 밝기가 비슷한가 (C.54 디자인 139 kitClash). 화면이 정한다 */
let kitClashOf: (teams: readonly [string, string] | null) => boolean = () => false;
export function setPitchKitClashResolver(f: (teams: readonly [string, string] | null) => boolean): void {
  kitClashOf = f;
}

/** 겹친 아이콘 캐시 (레이어 주소 묶음 → 캔버스). 레이어가 모두 읽혀야 만든다 */
const composites = new Map<string, HTMLCanvasElement>();
function compositeFor(layers: string[]): HTMLCanvasElement | HTMLImageElement | null {
  if (layers.length === 1) return imageFor(layers[0]!);
  const key = layers.join('|');
  const hit = composites.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const imgs = layers.map(imageFor);
  if (imgs.some((i) => !i)) return null;
  const w = Math.max(...imgs.map((i) => i!.naturalWidth));
  const h = Math.max(...imgs.map((i) => i!.naturalHeight));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d');
  if (!cx) return null;
  cx.imageSmoothingEnabled = false;
  for (const i of imgs) cx.drawImage(i!, Math.round((w - i!.naturalWidth) / 2), h - i!.naturalHeight);
  composites.set(key, c);
  return c;
}

/** 아이콘 배율: 16px 원본의 정수 배 (마커가 작으면 ×2, 크면 ×3) */
export function pixelScale(rr: number): 2 | 3 {
  return rr * 2.7 >= 44 ? 3 : 2;
}

/** 아이콘 아래 등번호 띠 높이 */
const numberBarH = (rr: number): number => Math.max(9, Math.round(rr * 0.75));

export const pixelRenderer: MarkerRenderer = {
  draw(ctx, m, x, y, r, pulse = 0) {
    const layers = pixelLayers(m, matchTeams);
    const img = layers?.length ? compositeFor(layers) : null;
    const nw = img ? ('naturalWidth' in img ? img.naturalWidth : img.width) : 0;
    if (!img || !nw) {
      numberCircleRenderer.draw(ctx, m, x, y, r, pulse);
      return;
    }
    const rr = m.isMe ? r * ME_SCALE : r;
    const k = pixelScale(rr) * (16 / Math.max(16, nw));
    const nh = 'naturalHeight' in img ? img.naturalHeight : img.height;
    const iw = Math.round(nw * k);
    const ih = Math.round(nh * k);
    meRings(ctx, m, x, y, rr * 1.15, pulse);
    const left = Math.round(x - iw / 2);
    const top = Math.round(y - ih * 0.58);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, left, top, iw, ih);
    ctx.imageSmoothingEnabled = smooth;
    // kitClash: 원정 몸통(16px 중 아래 9~15줄)에 주황 테두리
    if (m.teamId === 1 && kitClashOf(matchTeams)) {
      const px = iw / 16;
      ctx.lineWidth = Math.max(1, Math.round(px * 0.75));
      ctx.strokeStyle = PALETTE.away;
      ctx.strokeRect(left + px * 2, top + px * 9, px * 12, px * 6.5);
    }
    // 등번호 띠 (디자인 139, 항상): 우리 = 라임, 상대 = 주황, 글자 검정. 공 가진 선수는 흰 테두리
    const bh = numberBarH(rr);
    const label = String(m.number);
    ctx.font = `800 ${bh - 2}px ${PALETTE.font}`;
    const bw = Math.max(bh * 1.5, ctx.measureText(label).width + 6);
    const by = top + ih - Math.round(bh * 0.35);
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, by, bw, bh, bh / 2);
    ctx.fillStyle = m.ours ? PALETTE.home : PALETTE.away;
    ctx.fill();
    if (m.state === 'carrier') {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#f3f4f6';
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, by + bh / 2 + 0.5);
  },
  labelBelow(rr) {
    // 아이콘 아래 끝 + 등번호 띠 아래까지 (draw 와 같은 식)
    const ih = 16 * pixelScale(rr);
    const bh = numberBarH(rr);
    return (ih * 0.42 + bh * 0.65) / rr;
  },
};

export function activeRenderer(): MarkerRenderer {
  return view === 'face' ? faceRenderer : view === 'character' ? pixelRenderer : numberCircleRenderer;
}
