// 리플레이 압축 (25.4 2번, 부록 C.41): 내 최근 5경기 위치 프레임을 세이브 저장소에 남길 때 쓴다.
// 위치·시간을 0.1 m·0.01 초로 맞추고 앞 프레임과의 차이만 정수 열로 담는다 (gzip 이 잘 줄인다). 화면 재생에는 0.1 m 오차가 보이지 않는다

import type { Replay, ReplayFrame } from './replay';

export interface PackedReplay {
  v: 1;
  /** 프레임을 뺀 나머지 (이벤트·선수·통계 등) */
  base: Omit<Replay, 'frames'>;
  /** 프레임에 나오는 선수 id */
  ids: string[];
  n: number;
  /** 프레임마다: Δe, Δt, Δ공x, Δ공y, Δ공z, 공 가진 선수(+1, 0 없음), 선수 수, (선수 번호, Δx, Δy) × 선수 수 */
  data: number[];
  /** 재개 대기 [프레임, 종류] */
  restarts: [number, string][];
}

const P = 10;
const T = 100;

export function packReplay(r: Replay): PackedReplay {
  const { frames, ...base } = r;
  const ids: string[] = [];
  const idx = new Map<string, number>();
  const id = (s: string) => {
    let k = idx.get(s);
    if (k === undefined) {
      k = ids.length;
      ids.push(s);
      idx.set(s, k);
    }
    return k;
  };
  const data: number[] = [];
  const restarts: [number, string][] = [];
  let pe = 0, pt = 0, bx = 0, by = 0, bz = 0;
  const px: number[] = [];
  const py: number[] = [];
  frames.forEach((f, i) => {
    const e = Math.round(f.e * T), t = Math.round(f.t * T);
    const x = Math.round(f.ball.x * P), y = Math.round(f.ball.y * P), z = Math.round(f.ball.z * P);
    data.push(e - pe, t - pt, x - bx, y - by, z - bz, f.carrier === null ? 0 : id(f.carrier) + 1, f.players.length);
    pe = e; pt = t; bx = x; by = y; bz = z;
    for (const p of f.players) {
      const k = id(p.id);
      const qx = Math.round(p.x * P), qy = Math.round(p.y * P);
      data.push(k, qx - (px[k] ?? 0), qy - (py[k] ?? 0));
      px[k] = qx;
      py[k] = qy;
    }
    if (f.restart) restarts.push([i, f.restart]);
  });
  return { v: 1, base, ids, n: frames.length, data, restarts };
}

export function unpackReplay(p: PackedReplay): Replay {
  const frames: ReplayFrame[] = [];
  const restart = new Map(p.restarts);
  const d = p.data;
  let i = 0, e = 0, t = 0, bx = 0, by = 0, bz = 0;
  const px: number[] = [];
  const py: number[] = [];
  for (let f = 0; f < p.n; f++) {
    e += d[i++]!; t += d[i++]!; bx += d[i++]!; by += d[i++]!; bz += d[i++]!;
    const c = d[i++]!;
    const n = d[i++]!;
    const players: ReplayFrame['players'] = [];
    for (let k = 0; k < n; k++) {
      const j = d[i++]!;
      px[j] = (px[j] ?? 0) + d[i++]!;
      py[j] = (py[j] ?? 0) + d[i++]!;
      players.push({ id: p.ids[j]!, x: px[j]! / P, y: py[j]! / P });
    }
    const fr: ReplayFrame = { e: e / T, t: t / T, ball: { x: bx / P, y: by / P, z: bz / P }, carrier: c ? p.ids[c - 1]! : null, players };
    const rs = restart.get(f);
    if (rs) fr.restart = rs as ReplayFrame['restart'];
    frames.push(fr);
  }
  return { ...p.base, frames };
}

/**
 * 워커 → 메인 전달용 무손실 재생 데이터 (C.81c): 프레임을 Float64Array 한 장에 담아 복사 없이 넘긴다(transfer).
 * packReplay 와 달리 반올림하지 않는다 — 풀어낸 프레임은 엔진이 만든 값과 비트 단위로 같다 (메인 스레드에서 직접 계산한 것과 같은 재생·하이라이트)
 * 프레임마다: e, t, 공x, 공y, 공z, 공 가진 선수(+1, 0 없음), 선수 수, (선수 번호, x, y) × 선수 수
 */
export interface WireReplay {
  base: Omit<Replay, 'frames'>;
  /** 원래 키 순서 (풀어낸 객체도 같은 순서) */
  order: string[];
  ids: string[];
  n: number;
  buf: Float64Array;
  restarts: [number, string][];
}

export function toWireReplay(r: Replay): WireReplay {
  const { frames, ...base } = r;
  const ids: string[] = [];
  const idx = new Map<string, number>();
  const id = (s: string) => {
    let k = idx.get(s);
    if (k === undefined) {
      k = ids.length;
      ids.push(s);
      idx.set(s, k);
    }
    return k;
  };
  let len = 0;
  for (const f of frames) len += 7 + 3 * f.players.length;
  const buf = new Float64Array(len);
  const restarts: [number, string][] = [];
  let i = 0;
  frames.forEach((f, fi) => {
    buf[i++] = f.e; buf[i++] = f.t; buf[i++] = f.ball.x; buf[i++] = f.ball.y; buf[i++] = f.ball.z;
    buf[i++] = f.carrier === null ? 0 : id(f.carrier) + 1;
    buf[i++] = f.players.length;
    for (const p of f.players) {
      buf[i++] = id(p.id); buf[i++] = p.x; buf[i++] = p.y;
    }
    if (f.restart !== undefined) restarts.push([fi, f.restart]);
  });
  return { base, order: Object.keys(r), ids, n: frames.length, buf, restarts };
}

export function fromWireReplay(w: WireReplay): Replay {
  const frames: ReplayFrame[] = new Array(w.n);
  const restart = new Map(w.restarts);
  const d = w.buf;
  const ids = w.ids;
  let i = 0;
  for (let f = 0; f < w.n; f++) {
    const e = d[i++]!, t = d[i++]!, x = d[i++]!, y = d[i++]!, z = d[i++]!;
    const c = d[i++]!;
    const n = d[i++]!;
    const players: ReplayFrame['players'] = new Array(n);
    for (let k = 0; k < n; k++) {
      const j = d[i++]!;
      const px = d[i++]!;
      players[k] = { id: ids[j]!, x: px, y: d[i++]! };
    }
    const fr: ReplayFrame = { e, t, ball: { x, y, z }, carrier: c ? ids[c - 1]! : null, players };
    const rs = restart.get(f);
    if (rs !== undefined) fr.restart = rs as ReplayFrame['restart'];
    frames[f] = fr;
  }
  const out: Record<string, unknown> = {};
  const base = w.base as unknown as Record<string, unknown>;
  for (const k of w.order) out[k] = k === 'frames' ? frames : base[k];
  return out as unknown as Replay;
}
