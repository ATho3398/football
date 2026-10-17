// 전개 하이라이트 (24.3 개정, 2026-10-15): 경기당 장면 6~8개, 각 10~15초를 실제 속도로 재생한다.
// 장면은 공격이 시작되는 순간부터 보여 주고, 장면 사이에는 시계만 넘어간다. 엔진 결과(재생 데이터)만 읽는 순수 함수다.

import { L, W } from './engine/pitch';
import type { Replay, ReplayEvent, ReplayFrame } from './replay';
import { SCENE_LABEL } from './engine/moments';

export const HL = {
  /** 장면 수 */
  minScenes: 6,
  maxScenes: 8,
  /** 장면 길이 (초) */
  minLen: 10,
  maxLen: 15,
  /** 핵심 순간(슈팅) 뒤에 보여 주는 시간 (초) */
  after: 3,
  /** 핵심 순간 앞으로 최대 이만큼 (공격이 더 일찍 시작했어도). 장면 10~13초, 경기당 약 90초 */
  maxLead: 10,
  /** 공격 시작이 이보다 늦으면 이만큼 앞에서 시작 (빠른 역습도 앞 장면을 보여 준다) */
  minLead: 7,
  /** 공격 시작보다 이만큼 앞에서 시작 */
  preRoll: 1,
  /** 결정적 기회: 유효 슈팅이거나 xG 이 이 값 이상 */
  bigChanceXg: 0.12,
  /** 같은 시간대 중복을 피하는 간격 (초) */
  gap: 20,
  /** 결정 순간 장면 (E5 최소, 부록 C.35): 경기당 최대 수, 결정 앞·뒤 (초) */
  maxDecisions: 3,
  decisionLead: 6,
  decisionAfter: 7,
  /** 장면 사이 전환 (초) */
  transition: 1,
  /** 재개 대기 빨리 감기 (디자인 18, 부록 C.23): 모든 선수가 재개 위치 settleTol m 안에 오면 남은 대기를 deadBallFf 배속 */
  deadBallFf: 4,
  settleTol: 1,
} as const;

export type SceneKind = 'goal' | 'chance' | 'decision' | 'me' | 'opponent' | 'shot';

export interface Scene {
  /** 시작·끝 (흐른 시간 e, 초) */
  start: number;
  end: number;
  /** 핵심 순간 (슈팅) */
  key: number;
  kind: SceneKind;
  team: 0 | 1;
  label: string;
  /** 결정 순간 장면: 경기 분 */
  minute?: number;
}

/** 공을 가진 팀 (프레임의 carrier 로), 없으면 null */
function carrierTeam(f: ReplayFrame, team: Map<string, 0 | 1>): 0 | 1 | null {
  return f.carrier ? team.get(f.carrier) ?? null : null;
}

function frameIndexAt(frames: ReplayFrame[], e: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid]!.e <= e) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** 공격 시작: 핵심 순간에서 거슬러 올라가 상대가 공을 가진 마지막 프레임 다음 */
export function attackStart(r: Replay, key: number, team: 0 | 1): number {
  const teamOf = new Map(r.players.map((p) => [p.id, p.team]));
  const f = r.frames;
  let i = frameIndexAt(f, key);
  while (i > 0) {
    const c = carrierTeam(f[i - 1]!, teamOf);
    if (c !== null && c !== team) break;
    if (key - f[i - 1]!.e > 60) break;
    i--;
  }
  return f[i]!.e;
}

/** 장면 구간: 공격 시작 1초 전부터(핵심 순간 앞 7~10초), 핵심 순간 3초 뒤까지. 길이 10~13초 (스펙 10~15) */
export function sceneWindow(r: Replay, key: number, team: 0 | 1): [number, number] {
  const begin = attackStart(r, key, team) - HL.preRoll;
  let start = Math.max(key - Math.min(HL.maxLead, HL.maxLen - HL.after), Math.min(begin, key - HL.minLead));
  let end = key + HL.after;
  if (end - start < HL.minLen) start = end - HL.minLen;
  start = Math.max(0, start);
  end = Math.min(r.duration, Math.max(end, start + HL.minLen));
  return [Math.round(start * 10) / 10, Math.round(end * 10) / 10];
}

interface Cand {
  key: number;
  team: 0 | 1;
  kind: SceneKind;
  label: string;
  /** 같은 종류 안의 순서 (큰 것 먼저) */
  weight: number;
  minute?: number;
}

/** 골 이벤트에 앞선 같은 팀 슈팅 (장면 핵심 순간) */
function shotBefore(evs: ReplayEvent[], goal: ReplayEvent): number {
  const s = evs.filter((x) => x.type === 'shot' && x.team === goal.team && x.e <= goal.e && goal.e - x.e < 6).at(-1);
  return s ? s.e : goal.e;
}

/**
 * 장면 선택 (24.3): 골 → 결정적 기회 → 내 선수가 관여한 장면 → 상대 주요 공격 1~2개, 같은 시간대(20초 안) 중복 없이 최대 8개.
 * 6개가 안 되면 나머지 슈팅을 xG 순으로 채운다. 같은 재생 데이터면 늘 같은 장면이 나온다 (결정적)
 */
export function selectScenes(r: Replay): Scene[] {
  const evs = r.events;
  const me = r.players.find((p) => p.isMe)?.id;
  const my = r.side;
  const opp = (1 - my) as 0 | 1;
  const goals: Cand[] = evs.filter((x) => x.type === 'goal').map((g) => ({ key: shotBefore(evs, g), team: g.team, kind: 'goal', label: g.text, weight: 0 }));
  const shots = evs.filter((x) => x.type === 'shot');
  const goalKeys = new Set(goals.map((g) => g.key));
  const big: Cand[] = shots.filter((x) => !goalKeys.has(x.e) && (x.onTarget || (x.xg ?? 0) >= HL.bigChanceXg))
    .map((x) => ({ key: x.e, team: x.team, kind: 'chance', label: x.text, weight: x.xg ?? 0 }));
  const mine: Cand[] = me ? evs.filter((x) => x.players.includes(me) && ['shot', 'save', 'block', 'card', 'penalty', 'offside'].includes(x.type))
    .map((x) => ({ key: x.e, team: x.team, kind: 'me', label: x.text, weight: x.xg ?? 0 })) : [];
  const oppAttacks: Cand[] = shots.filter((x) => x.team === opp).map((x) => ({ key: x.e, team: x.team, kind: 'opponent', label: x.text, weight: x.xg ?? 0 }));
  // 직접 모드 결정 순간 (I.4: 결정 순간도 장면이 된다): 카드를 쓴 결정 먼저(pending 34 ④, C.36), 그다음 중요도 큰 순으로 최대 maxDecisions 개
  const decisions: Cand[] = (r.decisions ?? []).map((d) => ({
    key: d.e, team: my, kind: 'decision', label: `${SCENE_LABEL[d.scene]} · ${d.card ? `🃏 ${d.card} · ` : ''}${d.label}`, weight: d.stake + (d.card ? 100 : 0), minute: d.minute,
  }));
  const rest: Cand[] = shots.map((x) => ({ key: x.e, team: x.team, kind: 'shot', label: x.text, weight: x.xg ?? 0 }));
  const byWeight = (a: Cand, b: Cand) => b.weight - a.weight || a.key - b.key;

  const chosen: Cand[] = [];
  const free = (c: Cand) => chosen.every((x) => Math.abs(x.key - c.key) >= HL.gap);
  const take = (list: Cand[], limit = Infinity) => {
    let n = 0;
    for (const c of list) {
      if (chosen.length >= HL.maxScenes || n >= limit) return;
      if (free(c)) {
        chosen.push(c);
        n++;
      }
    }
  };
  take(goals.sort((a, b) => a.key - b.key));
  take(decisions.sort(byWeight), HL.maxDecisions);
  // 상대 주요 공격 1~2개 자리를 남긴다 (상대 전술 확인용)
  const oppSlots = Math.min(2, oppAttacks.length);
  const reserve = Math.max(0, HL.maxScenes - oppSlots);
  for (const list of [big.sort(byWeight), mine.sort(byWeight)]) {
    for (const c of list) {
      if (chosen.length >= reserve) break;
      if (free(c)) chosen.push(c);
    }
  }
  if (!chosen.some((c) => c.team === opp)) take(oppAttacks.sort(byWeight), 2);
  else take(oppAttacks.sort(byWeight), 1);
  if (chosen.length < HL.minScenes) take(rest.sort(byWeight));
  return chosen
    .sort((a, b) => a.key - b.key)
    .map((c) => {
      const [start, end] = c.kind === 'decision'
        ? [Math.max(0, c.key - HL.decisionLead), Math.min(r.duration, c.key + HL.decisionAfter)]
        : sceneWindow(r, c.key, c.team);
      return { start, end, key: c.key, kind: c.kind, team: c.team, label: c.label, ...(c.minute !== undefined ? { minute: c.minute } : {}) };
    });
}

/** 장면 사이 점유 요약 (24.3: "8분간 우리 점유 62%") */
export function possessionSummary(r: Replay, from: number, to: number): string {
  const teamOf = new Map(r.players.map((p) => [p.id, p.team]));
  let mine = 0;
  let total = 0;
  for (const f of r.frames) {
    if (f.e < from || f.e > to) continue;
    const c = carrierTeam(f, teamOf);
    if (c === null) continue;
    total++;
    if (c === r.side) mine++;
  }
  const minutes = Math.max(1, Math.round((to - from) / 60));
  return total ? `${minutes}분간 우리 점유 ${Math.round((mine / total) * 100)}%` : `${minutes}분 경과`;
}

export interface AvgPos {
  id: string;
  team: 0 | 1;
  /** 홈 팀이 오른쪽으로 공격하는 방향으로 맞춘 평균 위치 (m) */
  x: number;
  y: number;
  /** 뛴 프레임 수 */
  n: number;
}

/**
 * 평균 위치 지도 (24.3): 선수별 평균 위치. 후반은 진영이 바뀌므로 좌표를 뒤집어 홈 팀이 늘 오른쪽으로 공격하게 맞춘다.
 * 출전 프레임이 전체의 1/4 미만인 선수(짧은 교체)는 뺀다
 */
export function averagePositions(r: Replay): AvgPos[] {
  const acc = new Map<string, { x: number; y: number; n: number }>();
  for (const f of r.frames) {
    const second = f.e > r.halfE;
    for (const p of f.players) {
      const a = acc.get(p.id) ?? { x: 0, y: 0, n: 0 };
      a.x += second ? L - p.x : p.x;
      a.y += second ? W - p.y : p.y;
      a.n++;
      acc.set(p.id, a);
    }
  }
  const teamOf = new Map(r.players.map((p) => [p.id, p.team]));
  const min = r.frames.length / 4;
  return [...acc.entries()]
    .filter(([, a]) => a.n >= min)
    .map(([id, a]) => ({ id, team: teamOf.get(id) ?? 0, x: a.x / a.n, y: a.y / a.n, n: a.n }));
}
