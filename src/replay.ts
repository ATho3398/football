// 경기 재생 데이터 (E5-lite, 24번, 부록 E.13): 엔진이 매 틱 계산한 22명과 공의 위치를 샘플링한 프레임과 이벤트 로그.
// 연출을 따로 만들지 않고 엔진 위치를 그대로 그린다. 보간과 이벤트 문구는 순수 함수 (24.5). 세이브에 담지 않는다.

import type { EngineResult, MatchEvent, PlayerSpec, TeamSetup } from './engine/types';
import type { SimState } from './engine/state';

/** 재생용 위치 프레임. e = 경기 시작부터 흐른 시간(초, 추가시간 포함 단조 증가), t = 경기 시계(초) */
export interface ReplayFrame {
  e: number;
  t: number;
  ball: { x: number; y: number; z: number };
  carrier: string | null;
  players: { id: string; x: number; y: number }[];
}

export interface ReplayPlayer {
  id: string;
  name: string;
  team: 0 | 1;
  /** 마커 번호 (슬롯 순서 1~11, 교체 선수 12~) */
  number: number;
  position: string;
  isMe: boolean;
  gk: boolean;
  /** 24.4 선택 필드 (아이콘/사진 렌더러용) */
  avatarUrl?: string;
}

export interface ReplayEvent {
  e: number;
  /** 경기 시계 분 (전반 추가시간은 45+, 후반은 90+) */
  minute: string;
  type: MatchEvent['type'];
  team: 0 | 1;
  text: string;
  /** 골처럼 강조할 이벤트 */
  big: boolean;
  /** 골 이벤트: 그 뒤 스코어 */
  score?: [number, number];
}

export interface Replay {
  teams: [string, string];
  players: ReplayPlayer[];
  frames: ReplayFrame[];
  events: ReplayEvent[];
  /** 내 팀 쪽 (0 홈, 1 원정) */
  side: 0 | 1;
  duration: number;
  /** 전반이 끝난 흐른 시간 (후반 시계 표시용) */
  halfE: number;
  final: [number, number];
}

/** 샘플링 간격 (초). 엔진 time.frameInterval (E.13: 2~10Hz) */
export function captureFrame(s: SimState): ReplayFrame {
  const b = s.ball;
  return {
    e: Math.round(s.elapsed * 10) / 10,
    t: Math.round(s.t * 10) / 10,
    ball: { x: b.x, y: b.y, z: b.z },
    carrier: b.owner >= 0 ? s.agents[b.owner]!.id : null,
    players: s.agents.filter((a) => a.onPitch).map((a) => ({ id: a.id, x: Math.round(a.x * 100) / 100, y: Math.round(a.y * 100) / 100 })),
  };
}

/** 선수 목록 (마커 번호: 선발은 슬롯 순서 1~11, 벤치는 12부터) */
export function replayPlayers(home: TeamSetup, away: TeamSetup): ReplayPlayer[] {
  const out: ReplayPlayer[] = [];
  ([home, away] as const).forEach((setup, team) => {
    const starters = [...setup.lineup].sort((a, b) => a.slot - b.slot);
    const add = (p: PlayerSpec, number: number) => out.push({
      id: p.id, name: p.name ?? p.id, team: team as 0 | 1, number, position: p.position, isMe: p.isMe, gk: !!p.gk || p.position === 'GK',
    });
    starters.forEach((p, i) => add(p, i + 1));
    setup.bench.forEach((p, i) => add(p, 12 + i));
  });
  return out;
}

function minuteLabel(t: number, half: 1 | 2): string {
  const m = Math.floor(t / 60) + 1;
  if (half === 1 && m > 45) return `45+${m - 45}`;
  if (half === 2 && m > 90) return `90+${m - 90}`;
  return `${m}`;
}

/** 이벤트 피드 문구 (21.5 이벤트 피드). 이름을 모르면 id 그대로 */
export function replayEvents(events: MatchEvent[], players: ReplayPlayer[], teams: [string, string], elapsedOf: (t: number, idx: number) => number): ReplayEvent[] {
  const name = new Map(players.map((p) => [p.id, p.name]));
  const nm = (id: string | undefined) => (id ? name.get(id) ?? id : '');
  const out: ReplayEvent[] = [];
  let half: 1 | 2 = 1;
  let score: [number, number] = [0, 0];
  events.forEach((ev, idx) => {
    if (ev.type === 'halftime') half = 2;
    const team = teams[ev.team];
    let text = '';
    let big = false;
    switch (ev.type) {
      case 'kickoff': text = '경기 시작'; break;
      case 'halftime': text = `전반 종료 ${score[0]} : ${score[1]}`; break;
      case 'fulltime': text = `경기 종료 ${score[0]} : ${score[1]}`; break;
      case 'goal': {
        score = [Number(ev.params?.home ?? score[0]), Number(ev.params?.away ?? score[1])];
        text = `⚽ 골! ${nm(ev.players[0])} (${team})${ev.players[1] ? ` · 도움 ${nm(ev.players[1])}` : ''} — ${score[0]} : ${score[1]}`;
        big = true;
        break;
      }
      case 'shot': text = Number(ev.params?.onTarget) ? `슈팅 (유효) ${nm(ev.players[0])}` : `슈팅 ${nm(ev.players[0])} — 빗나감`; break;
      case 'save': text = `🧤 선방 ${nm(ev.players[0])}`; break;
      case 'block': text = `블록 — ${nm(ev.players[0])}의 슈팅`; break;
      case 'card': text = `${ev.params?.card === 'red' ? '🟥 퇴장' : '🟨 경고'} ${nm(ev.players[0])} (${team})`; big = ev.params?.card === 'red'; break;
      case 'sub': text = `🔁 교체 (${team}) ${nm(ev.players[1])} → ${nm(ev.players[0])}`; break;
      case 'injury': text = `🚑 부상 ${nm(ev.players[0])}`; break;
      case 'penalty': text = `페널티킥 — ${nm(ev.players[0])} (${team})`; big = true; break;
      case 'corner': text = `코너킥 (${team})`; break;
      case 'offside': text = `오프사이드 ${nm(ev.players[0])}`; break;
      case 'foul': text = `파울 (${team})`; break;
      case 'freeKick': text = Number(ev.params?.direct) ? `직접 프리킥 — ${nm(ev.players[0])}` : ''; break;
      default: text = '';
    }
    if (text) out.push({ e: elapsedOf(ev.t, idx), minute: minuteLabel(ev.t, half), type: ev.type, team: ev.team, text, big, ...(ev.type === 'goal' ? { score: [...score] as [number, number] } : {}) });
  });
  return out;
}

/**
 * 경기 시계(t) → 흐른 시간(e). 후반 시계는 2700 초에서 다시 시작하므로, 하프타임 이벤트 이후는 전반 길이만큼 더한다
 */
export function elapsedMapper(events: MatchEvent[], halfSeconds: number): (t: number, idx: number) => number {
  const ht = events.findIndex((e) => e.type === 'halftime');
  const firstHalfEnd = ht >= 0 ? events[ht]!.t : halfSeconds;
  return (t, idx) => (ht >= 0 && idx > ht ? t - halfSeconds + firstHalfEnd : t);
}

export function buildReplay(home: TeamSetup, away: TeamSetup, teams: [string, string], frames: ReplayFrame[], r: EngineResult, side: 0 | 1, halfSeconds: number): Replay {
  const players = replayPlayers(home, away);
  const ht = r.events.find((e) => e.type === 'halftime');
  return {
    halfE: ht ? ht.t : halfSeconds,
    teams, players, frames, side,
    events: replayEvents(r.events, players, teams, elapsedMapper(r.events, halfSeconds)),
    duration: frames.at(-1)?.e ?? r.duration,
    final: [r.homeGoals, r.awayGoals],
  };
}

// ── 재생 (순수 함수, 24.5) ──

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** 두 프레임 사이 보간. 한쪽에만 있는 선수(교체·퇴장)는 있는 쪽 위치 */
export function interpolateFrame(prev: ReplayFrame, next: ReplayFrame, alpha: number): ReplayFrame {
  const k = Math.min(1, Math.max(0, alpha));
  const nextPos = new Map(next.players.map((p) => [p.id, p]));
  const players = prev.players.map((p) => {
    const q = nextPos.get(p.id);
    return q ? { id: p.id, x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k) } : p;
  });
  for (const q of next.players) if (!prev.players.some((p) => p.id === q.id)) players.push(q);
  return {
    e: lerp(prev.e, next.e, k),
    t: lerp(prev.t, next.t, k),
    ball: { x: lerp(prev.ball.x, next.ball.x, k), y: lerp(prev.ball.y, next.ball.y, k), z: lerp(prev.ball.z, next.ball.z, k) },
    carrier: k < 0.5 ? prev.carrier : next.carrier,
    players,
  };
}

/** 흐른 시간 e 의 위치 (이진 탐색 + 보간) */
export function frameAt(r: Replay, e: number): ReplayFrame {
  const f = r.frames;
  if (!f.length) throw new Error('프레임 없음');
  if (e <= f[0]!.e) return f[0]!;
  if (e >= f[f.length - 1]!.e) return f[f.length - 1]!;
  let lo = 0;
  let hi = f.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (f[mid]!.e <= e) lo = mid;
    else hi = mid;
  }
  const a = f[lo]!;
  const b = f[hi]!;
  return interpolateFrame(a, b, (e - a.e) / Math.max(1e-9, b.e - a.e));
}

/** e 까지 나온 이벤트 (최신이 앞) */
export function eventsUntil(r: Replay, e: number): ReplayEvent[] {
  return r.events.filter((x) => x.e <= e).reverse();
}

/** e 시점 스코어 */
export function scoreAt(r: Replay, e: number): [number, number] {
  let s: [number, number] = [0, 0];
  for (const x of r.events) {
    if (x.e > e) break;
    if (x.score) s = x.score;
  }
  return s;
}

/** 경기 시계 표시 (분:초, 추가시간 포함) */
export function clockLabel(f: ReplayFrame, secondHalf: boolean): string {
  const total = Math.floor(f.t);
  const m = Math.floor(total / 60);
  const sec = String(total % 60).padStart(2, '0');
  const cap = secondHalf ? 90 : 45;
  return m >= cap ? `${cap}+${m - cap + 1}'` : `${m}:${sec}`;
}

/** 1배속 = 게임 1분이 실제 1초 (24.3) */
export const GAME_SECONDS_PER_REAL_SECOND = 60;
export const SPEEDS = [1, 2, 4] as const;
