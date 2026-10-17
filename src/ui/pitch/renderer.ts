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

/** 이름 라벨 (부록 C.44a): 마커 아래 작은 글씨 + 반투명 띠. 내 선수는 라임 강조 */
function drawLabel(ctx: CanvasRenderingContext2D, name: string, x: number, top: number, r: number, w: number, me: boolean): void {
  const size = Math.max(9, Math.min(14, Math.round(r * (me ? 0.82 : 0.72))));
  ctx.font = `${me ? 800 : 600} ${size}px ${PALETTE.font}`;
  const tw = ctx.measureText(name).width + 8;
  const th = size + 4;
  const bx = Math.min(w - tw - 1, Math.max(1, x - tw / 2));
  ctx.fillStyle = me ? 'rgba(18,19,23,0.88)' : 'rgba(18,19,23,0.55)';
  ctx.beginPath();
  ctx.roundRect(bx, top, tw, th, th / 2);
  ctx.fill();
  if (me) {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = PALETTE.home;
    ctx.stroke();
  }
  ctx.fillStyle = me ? PALETTE.home : 'rgba(243,244,246,0.92)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, bx + tw / 2, top + th / 2 + 0.5);
}

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
  for (const p of sorted) {
    if (mode === 'mine' && !p.info.isMe) continue;
    const rr = p.info.isMe ? r * ME_SCALE : r;
    const top = Math.min(h - 2 - Math.max(9, r * 0.8) - 4, p.y + rr * below + (p.info.isMe ? 5 : 2));
    drawLabel(ctx, nameOf(p.id, p.info.isMe, p.info.name), p.x, top, r, w, p.info.isMe);
  }
}

/** 한 프레임 그리기: 코트 → 마커 → 이름 라벨 → 공. time = 맥박용 시각(초). 쓴 좌표 변환을 돌려준다 (결정 화살표용) */
export function drawFrame(
  ctx: CanvasRenderingContext2D, w: number, h: number, frame: ReplayFrame, players: Map<string, ReplayPlayer>,
  renderer: MarkerRenderer = activeRenderer(), mySide: 0 | 1 = 0, time = 0,
): PitchProjection {
  drawPitch(ctx, w, h);
  const proj = pitchProjection(w, h, h > w ? attackDirOf(frame, players, mySide) : 1);
  const r = markerRadius(Math.min(w, h * (PITCH_L / PITCH_W)));
  const pulse = (Math.sin(time * Math.PI * 1.6) + 1) / 2;
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
  drawMarkers(ctx, w, h, list, renderer, mySide, r, pulse);
  // 공: 땅의 그림자는 제자리, 공은 높이(z, m)만큼 위로 뜨고 조금 커진다. 그림자는 높을수록 옅고 넓다
  const [bx, by] = proj.toScreen(frame.ball.x, frame.ball.y);
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

/**
 * 캔버스를 화면 너비·기기 배율에 맞춘다. 2D 컨텍스트와 그릴 크기를 돌려준다.
 * 세로 방향(C.44a)이면 높이를 화면 높이의 일정 비율로 막고, 넘치면 폭을 줄여 가운데 둔다
 */
export function fitCanvas(canvas: HTMLCanvasElement, maxHRatio = PORTRAIT_MAX_H): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = window.devicePixelRatio || 1;
  const portrait = isPortraitPitch();
  const avail = canvas.parentElement?.clientWidth || canvas.clientWidth || 358;
  let [w, h] = pitchCanvasSize(avail, portrait);
  if (portrait) {
    const maxH = Math.max(300, Math.round((window.innerHeight || 800) * maxHRatio));
    if (h > maxH) [w, h] = [Math.round((maxH * PITCH_W) / PITCH_L), maxH];
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
  return { ctx, w, h };
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

const orientPref = pref<PitchOrient>('po-pitch-orient', ['auto', 'landscape', 'portrait'], 'auto');
const sizePref = pref<PitchSizeOpt>('po-pitch-size', ['normal', 'large', 'xlarge'], 'large');
const namesPref = pref<PitchNames>('po-pitch-names', ['all', 'mine', 'off'], 'all');
export const pitchOrient = (): PitchOrient => orientPref.get();
export const setPitchOrient = (v: PitchOrient): void => orientPref.set(v);
export const pitchSize = (): PitchSizeOpt => sizePref.get();
export const setPitchSize = (v: PitchSizeOpt): void => sizePref.set(v);
export const pitchNames = (): PitchNames => namesPref.get();
export const setPitchNames = (v: PitchNames): void => namesPref.set(v);

/** 지금 피치를 세로로 그리나: 항상 세로, 또는 자동이면서 화면이 세로(가로 < 세로)거나 폭 600px 이하 */
export function isPortraitPitch(): boolean {
  const o = orientPref.get();
  if (o !== 'auto') return o === 'portrait';
  if (typeof window === 'undefined') return false;
  return window.innerWidth < window.innerHeight || window.innerWidth <= 600;
}

/** 선수 id → 라벨 이름 (화면이 정한다: 별명 > 짧은 이름). 기본은 리플레이 이름의 짧은 이름 */
let nameOf: (id: string, isMe: boolean, fallback: string) => string = (_id, _me, fallback) => autoShortKo(fallback);
export function setPitchNameResolver(f: (id: string, isMe: boolean, fallback: string) => string): void {
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
    ctx.fillStyle = m.isMe ? PALETTE.mine : m.ours ? PALETTE.home : PALETTE.away;
    ctx.fill();
    if (m.state === 'carrier') {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#f3f4f6';
      ctx.stroke();
    }
  },
};

/** 캐릭터 보기: 도트(픽셀아트) 얼굴, 확대해도 선명하게(보간 끔). 도트 이미지가 없는 선수는 등번호 원 */
export const pixelRenderer: MarkerRenderer = {
  draw(ctx, m, x, y, r, pulse = 0) {
    const url = m.id ? faceUrl(m.id, m.isMe, 'pixel') : undefined;
    const img = url ? imageFor(url) : null;
    if (!img) {
      numberCircleRenderer.draw(ctx, m, x, y, r, pulse);
      return;
    }
    const rr = m.isMe ? r * ME_SCALE : r;
    const s = rr * 2.7;
    meRings(ctx, m, x, y, rr * 1.15, pulse);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    drawSquare(ctx, img, x - s / 2, y - s / 2 - s * 0.08, s, true);
    ctx.imageSmoothingEnabled = smooth;
    const bw = s * 0.82;
    const bh = Math.max(3, rr * 0.42);
    ctx.beginPath();
    ctx.roundRect(x - bw / 2, y + s / 2 - s * 0.08 - bh * 0.4, bw, bh, bh / 2);
    ctx.fillStyle = m.isMe ? PALETTE.mine : m.ours ? PALETTE.home : PALETTE.away;
    ctx.fill();
  },
};

export function activeRenderer(): MarkerRenderer {
  return view === 'face' ? faceRenderer : view === 'character' ? pixelRenderer : numberCircleRenderer;
}
