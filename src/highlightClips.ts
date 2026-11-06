// 경기 후 하이라이트 3개 (24.6, P단계 P1, 부록 C.77o): 골 · 결정적 장면 · 내 최고 평점 순간을 핵심 순간 앞뒤 8초 프레임으로 세이브에 남긴다.
// 재생 데이터(Replay)만 읽는 순수 함수다. 엔진·결과·밸런스 무영향. 보관 개수는 화면·저장 설정이라 balance.ts 가 아니라 여기 둔다

import type { Scene, SceneKind } from './highlights';
import type { Replay, ReplayEvent } from './replay';
import { packReplay, unpackReplay, type PackedReplay } from './replayCodec';

export const CLIP = {
  /** 핵심 순간 앞뒤 (초) */
  pad: 8,
  /** 세이브에 남기는 최근 경기 수 (경기당 약 8 KB(gzip 전 JSON 약 25 KB) — 부록 C.77o 측정) */
  keep: 10,
  /** 서로 다른 장면으로 치는 간격 (초): 앞뒤 8초 창이 겹치지 않게 */
  gap: 16,
  /** 결정적 장면 후보: 유효 슈팅이거나 xG 이 이 값 이상 */
  chanceXg: 0.12,
} as const;

export type ClipKind = 'goal' | 'chance' | 'best';
export const CLIP_KO: Readonly<Record<ClipKind, string>> = { goal: '골', chance: '결정적 장면', best: '내 최고 순간' };

export interface ClipInfo {
  kind: ClipKind;
  /** 핵심 순간 (흐른 시간 e, 초)과 재생 구간 */
  key: number;
  start: number;
  end: number;
  team: 0 | 1;
  /** 경기 시계 분 (예 "37") */
  minute: string;
  /** 한 줄 (이벤트 피드 문구) */
  text: string;
}

/** 세이브에 남는 한 경기 하이라이트 (GameState.clips, SAVE_FORMAT_VERSION 57) */
export interface MatchClips {
  season: number;
  round: number;
  label: string;
  clips: ClipInfo[];
  /** 클립 구간 프레임만 남긴 재생 데이터 (replayCodec) */
  data: PackedReplay;
}

interface Cand { key: number; team: 0 | 1; text: string; minute: string; w: number }

/** 골 직전 같은 팀 슈팅 (장면 핵심 = 슛 순간). 없으면 골 이벤트 시각 */
function shotBefore(evs: ReplayEvent[], goal: ReplayEvent): number {
  const s = evs.filter((x) => x.type === 'shot' && x.team === goal.team && x.e <= goal.e && goal.e - x.e < 6).at(-1);
  return s ? s.e : goal.e;
}

const byW = (a: Cand, b: Cand) => b.w - a.w || a.key - b.key;

/**
 * 하이라이트 3개 고르기 (24.6). 같은 재생 데이터면 늘 같은 결과 (결정적).
 * - 골: 내가 넣은 골 > 내가 도운 골 > 우리 골 > 실점, 같은 등급이면 늦은 골. 내 골·도움이 최고 순간 칸으로 가면 다른 골
 * - 결정적 장면: 골이 아닌 슈팅 중 xG 가 가장 큰 것(유효 슈팅 가산). 없으면 중요도가 가장 큰 결정 순간
 * - 내 최고 평점 순간: 내 골 > 도움 > 결정 순간(평점 변화) > 선방·블록·유효 슈팅 > 슈팅. 앞 두 장면과 겹치면 다음 후보
 * 후보가 없으면 그 칸은 빠진다 (0~3개)
 */
export function pickClips(r: Replay): ClipInfo[] {
  const evs = r.events;
  const me = r.players.find((p) => p.isMe)?.id;
  const goals = evs.filter((x) => x.type === 'goal');
  const goalShots = new Set(goals.map((g) => shotBefore(evs, g)));
  const out: ClipInfo[] = [];
  const free = (key: number) => out.every((c) => Math.abs(c.key - key) >= CLIP.gap);
  const push = (kind: ClipKind, c: Cand) => {
    out.push({ kind, key: c.key, start: Math.max(0, c.key - CLIP.pad), end: Math.min(r.duration, c.key + CLIP.pad), team: c.team, minute: c.minute, text: c.text });
  };

  const goalC: Cand[] = goals.map((g) => ({
    key: shotBefore(evs, g), team: g.team, text: g.text, minute: g.minute,
    w: (me && g.players[0] === me ? 3 : me && g.players[1] === me ? 2 : g.team === r.side ? 1 : 0) * 1e4 + g.e,
  })).sort(byW);
  const decisions = (r.decisions ?? []).filter((d) => d.scene !== 'halftime');
  const decMinute = (m: number) => String(m);
  const mine: Cand[] = [];
  if (me) {
    for (const x of evs) {
      if (!x.players.includes(me)) continue;
      const base = { key: x.type === 'goal' ? shotBefore(evs, x) : x.e, team: x.team, text: x.text, minute: x.minute };
      if (x.type === 'goal') mine.push({ ...base, w: x.players[0] === me ? 5 : x.players[1] === me ? 4 : 0 });
      else if (x.type === 'save' || x.type === 'block') mine.push({ ...base, w: 2 });
      else if (x.type === 'shot') mine.push({ ...base, w: (x.onTarget ? 2 : 1) + (x.xg ?? 0) });
    }
    // 결정 순간: 그 뒤 실제 평점 변화가 클수록 (양수만)
    for (const d of decisions) if (d.delta > 0) mine.push({ key: d.e, team: r.side, text: d.label, minute: decMinute(d.minute), w: 3 + d.delta });
  }
  const mineSorted = mine.filter((c) => c.w > 0).sort(byW);

  // 내 골·도움이 최고 순간이고 다른 골이 있으면: 최고 순간 = 내 골, 골 칸 = 다른 골 (같은 장면을 두 번 쓰지 않게)
  const top = mineSorted[0];
  if (top && top.w >= 4 && goalC.some((g) => Math.abs(g.key - top.key) >= CLIP.gap)) push('best', top);
  const g0 = goalC.find((g) => free(g.key));
  if (g0) push('goal', g0);

  const chanceC: Cand[] = evs.filter((x) => x.type === 'shot' && !goalShots.has(x.e) && (x.onTarget || (x.xg ?? 0) >= CLIP.chanceXg))
    .map((x) => ({ key: x.e, team: x.team, text: x.text, minute: x.minute, w: (x.xg ?? 0) + (x.onTarget ? 0.1 : 0) }));
  const decC: Cand[] = decisions.map((d) => ({ key: d.e, team: r.side, text: d.label, minute: decMinute(d.minute), w: d.stake }));
  const ch = chanceC.sort(byW).find((c) => free(c.key)) ?? decC.sort(byW).find((c) => free(c.key));
  if (ch) push('chance', ch);

  if (!out.some((c) => c.kind === 'best')) {
    const best = mineSorted.find((c) => free(c.key));
    if (best) push('best', best);
  }
  return out.sort((a, b) => a.key - b.key);
}

/** 클립 구간 프레임만 남긴 재생 데이터. 스코어 표시용 골 이벤트는 모두, 나머지 이벤트는 구간 안만 */
export function clipReplay(r: Replay, clips: ClipInfo[]): Replay {
  const inClip = (e: number) => clips.some((c) => e >= c.start - 0.01 && e <= c.end + 0.01);
  return {
    ...r,
    frames: r.frames.filter((f) => inClip(f.e)),
    events: r.events.filter((x) => x.type === 'goal' || inClip(x.e)),
    ...(r.decisions ? { decisions: r.decisions.filter((d) => inClip(d.e)) } : {}),
  };
}

/** 방금 경기 하이라이트 묶음 (클립이 없으면 null) */
export function makeMatchClips(r: Replay, meta: { season: number; round: number; label: string }): MatchClips | null {
  const clips = pickClips(r);
  if (!clips.length) return null;
  return { ...meta, clips, data: packReplay(clipReplay(r, clips)) };
}

/** 목록에 넣고 최근 keep 경기만 (같은 시즌·라운드는 바꿔 넣는다) */
export function withClips(list: readonly MatchClips[] | undefined, m: MatchClips, keep: number = CLIP.keep): MatchClips[] {
  return [...(list ?? []).filter((x) => !(x.season === m.season && x.round === m.round)), m].slice(-keep);
}

export function findClips(list: readonly MatchClips[] | undefined, season: number, round: number): MatchClips | undefined {
  return list?.find((x) => x.season === season && x.round === round);
}

export function unpackClips(m: MatchClips): Replay {
  return unpackReplay(m.data);
}

const SCENE_OF: Readonly<Record<ClipKind, SceneKind>> = { goal: 'goal', chance: 'chance', best: 'me' };

/** 재생기 장면으로 (ReplayPlayer scenes): 클립마다 한 장면, 사이는 전환 */
export function clipScenes(clips: readonly ClipInfo[]): Scene[] {
  return clips.map((c) => ({ start: c.start, end: c.end, key: c.key, kind: SCENE_OF[c.kind], team: c.team, label: `${CLIP_KO[c.kind]} · ${c.text}` }));
}
