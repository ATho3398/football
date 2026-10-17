// 결정 결과 보여 주기 (E5 최소, 부록 C.35, pending 33): [확정]·[맡기기] 뒤 멈춘 장면에서 이어서 결과가 날 때까지
// (공 소유가 바뀌거나 슈팅 결과·파울·오프사이드·아웃·골, 최대 outcome.maxSpan 초) 실제 속도로 재생할 구간과 결과 문구를 고른다.
// 엔진 결과(위치 프레임·이벤트)만 읽는 순수 함수라 자동 경로와 결정성에 영향이 없다.

import type { DecisionRecord } from './engine/moments';
import type { MatchEvent } from './engine/types';
import type { RestartType } from './engine/state';
import type { ReplayFrame, ReplayPlayer } from './replay';

export const OUTCOME = {
  /** 결과를 기다리는 최대 길이 (초) */
  maxSpan: 6,
  /** 골 뒤 더 보여 주는 시간 (초). 엔진은 골 직후 공을 킥오프 자리로 옮기므로 공이 골망에 있는 골 프레임에서 멈추고 결과 띠를 띄운다 */
  goalTail: 0,
  /** 결과(공 소유 변경·아웃 등) 뒤 더 보여 주는 시간 (초) */
  tail: 0.6,
  /** 결과 띠를 보여 주는 시간 (ms) */
  bandMs: 1500,
} as const;

const PASS_LIKE = new Set(['pass', 'through', 'cutback', 'layoff', 'cross', 'clear']);

const RESTART_KO: Record<RestartType, string> = {
  kickoff: '킥오프', throwIn: '스로인', goalKick: '골킥', corner: '코너킥', freeKick: '프리킥', penalty: '페널티킥',
};

export type OutcomeEnd = 'goal' | 'shot' | 'turnover' | 'dead' | 'timeout' | 'end';

export interface DecisionOutcome {
  /** 재생 구간 (흐른 시간 e, 초) */
  from: number;
  to: number;
  /** 결과 흐름 ("돌파 성공 → 슈팅 → 선방") */
  steps: string[];
  /** 골을 넣은 팀 (없으면 null) */
  goal: 0 | 1 | null;
  end: OutcomeEnd;
  /** 고른 행동 자체의 성공 여부 (화면에 보인 첫 결과). 판정이 없으면(따라붙기·맡기기 흐름) null */
  ok: boolean | null;
}

export interface OutcomeInput {
  frames: ReplayFrame[];
  /** 결정 순간 정지 프레임의 인덱스 */
  startIdx: number;
  /** 결정 뒤 이벤트 (경기 시계 t 순) */
  events: MatchEvent[];
  players: ReplayPlayer[];
  /** 결정 순간 종류와 고른 행동 (맡기기면 null) */
  type: 'onball' | 'duel';
  action: string | null;
  /** 내 팀 */
  side: 0 | 1;
}

/** 결과 구간과 문구. 프레임이 결정 뒤에 없으면 빈 구간 */
export function decisionOutcome(inp: OutcomeInput): DecisionOutcome {
  const { frames, startIdx, players, type, action, side } = inp;
  const teamOf = new Map(players.map((p) => [p.id, p.team]));
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const me = players.find((p) => p.isMe)?.id;
  const start = frames[startIdx]!;
  const from = start.e;
  const opp = (1 - side) as 0 | 1;
  // 결정 순간에 공을 가진 팀 (1대1 수비면 상대)
  const att: 0 | 1 = type === 'duel' ? opp : side;
  const steps: string[] = [];
  const nm = (id: string | undefined) => (id === me ? '내' : id ? nameOf.get(id) ?? id : '');
  let goal: 0 | 1 | null = null;
  let end: OutcomeEnd = 'timeout';
  let endE = Math.min(frames.at(-1)!.e, from + OUTCOME.maxSpan);
  // 첫 행동 결과를 아직 적지 않았다 (패스·돌파는 다음 소유자나 결과로 판정)
  let firstOpen = type === 'onball' && action !== null && action !== 'shoot';
  let ok: boolean | null = null;
  const first = (good: boolean, okText: string, badText: string) => {
    if (!firstOpen) return;
    firstOpen = false;
    ok = good;
    steps.push(good ? okText : badText);
  };
  /** 내 슈팅 결정(직접 슈팅이나 맡겨서 내가 찬 슈팅)이 골이 안 되면 실패 */
  let myShot = false;
  const shotFail = () => {
    if (type === 'onball' && (action === 'shoot' || (action === null && myShot))) ok = false;
  };
  const shooter = (id: string | undefined, ours: boolean) => {
    if (id === me) myShot = true;
    if (id === me) return '슈팅';
    // 바로 앞 단계가 그 선수가 받은 것이면 이름을 반복하지 않는다 ("패스 연결 → 마네 → 슈팅")
    const prev = steps.at(-1) ?? '';
    if (prev.endsWith(`→ ${nm(id)}`) || prev === `${nm(id)} 받음`) return '슈팅';
    return `${ours ? '' : '상대 '}${nm(id)} 슈팅`;
  };
  /** 같은 팀 안에서 공이 돌면 마지막 받은 선수만 남긴다 */
  const received = (id: string) => {
    const t = `${nm(id)} 받음`;
    if (steps.at(-1)?.endsWith(`→ ${nm(id)}`)) return;
    if (steps.at(-1)?.endsWith(' 받음')) steps[steps.length - 1] = t;
    else steps.push(t);
  };
  const actKo = action && PASS_LIKE.has(action) ? (action === 'cross' ? '크로스' : action === 'clear' ? '걷어내기' : '패스') : '돌파';
  const okText = action === 'hold' || action === 'holdup' ? '공 지킴' : `${actKo} 성공`;
  let lastCarrier = start.carrier;
  let ev = 0;
  const evs = inp.events;
  let done = false;
  let shotOpen = false;
  const finish = (e: number, kind: OutcomeEnd, tail: number = OUTCOME.tail) => {
    endE = Math.min(frames.at(-1)!.e, e + tail);
    end = kind;
    done = true;
  };
  for (let i = startIdx + 1; i < frames.length && !done; i++) {
    const f = frames[i]!;
    if (f.e > from + OUTCOME.maxSpan) break;
    // 이 프레임까지 일어난 이벤트
    while (ev < evs.length && evs[ev]!.t <= f.t + 1e-6 && !done) {
      const x = evs[ev++]!;
      const ours = x.team === side;
      switch (x.type) {
        case 'shot': {
          first(true, okText, '');
          steps.push(shooter(x.players[0], ours));
          shotOpen = true;
          if (!Number(x.params?.onTarget)) {
            steps.push('빗나감');
            shotFail();
            finish(f.e, 'shot');
          }
          break;
        }
        case 'goal':
          if (!shotOpen) steps.push(shooter(x.players[0], ours));
          steps.push(ours ? '골!' : '실점');
          goal = x.team;
          ok = x.team === side;
          finish(f.e, 'goal', OUTCOME.goalTail);
          break;
        case 'save':
          // save: [GK, 슈터], team = 막은 팀. block: [슈터, 막은 선수], team = 슈팅 팀
          first(true, okText, '');
          if (!shotOpen) steps.push(shooter(x.players[1], !ours));
          steps.push('선방');
          shotFail();
          finish(f.e, 'shot');
          break;
        case 'block':
          first(true, okText, '');
          if (!shotOpen) steps.push(shooter(x.players[0], ours));
          steps.push('막힘');
          if (type === 'duel' && x.players[1] === me) ok = true;
          else shotFail();
          finish(f.e, 'shot');
          break;
        case 'foul':
          // 파울 이벤트의 team·players[0] 은 파울을 범한 쪽. 어드밴티지면 경기가 이어지고, 아니면 프리킥 리스타트에서 끝난다
          if (firstOpen) ok = !ours;
          firstOpen = false;
          if (type === 'duel' && x.players[0] === me) ok = false;
          steps.push(ours ? (x.players[0] === me ? '내 파울' : '파울') : '파울 얻음');
          break;
        case 'advantage':
          steps.push('어드밴티지');
          break;
        case 'offside':
          if (firstOpen || type === 'onball') ok = false;
          firstOpen = false;
          steps.push(x.players[0] === me ? '내 오프사이드' : `${actKo} → 오프사이드`);
          finish(f.e, 'dead');
          break;
        case 'card':
          steps.push(x.params?.card === 'red' ? `퇴장 ${nm(x.players[0])}` : `경고 ${nm(x.players[0])}`);
          break;
        case 'penalty':
          steps.push('페널티킥!');
          finish(f.e, 'dead', 1);
          break;
        case 'halftime':
        case 'fulltime':
          finish(f.e, 'end', 0);
          break;
        default:
          break;
      }
    }
    if (done) break;
    // 공 소유 변경
    if (f.carrier && f.carrier !== lastCarrier) {
      const tm = teamOf.get(f.carrier);
      if (tm === att) {
        if (firstOpen && action && PASS_LIKE.has(action)) first(true, `${actKo} 연결 → ${nm(f.carrier)}`, '');
        else if (f.carrier !== me && att === side) {
          first(true, okText, '');
          received(f.carrier);
        }
      } else if (tm !== undefined) {
        if (type === 'duel') {
          steps.push(f.carrier === me ? (action === 'tackle' ? '태클 성공' : '공 뺏음') : `${nm(f.carrier)} 공 뺏음`);
          ok = true;
        } else {
          if (firstOpen) first(false, '', action && PASS_LIKE.has(action) ? `${actKo} 차단` : '돌파 실패 (뺏김)');
          else {
            steps.push(lastCarrier === me ? '공 뺏김' : '소유 넘어감');
            if (action === null) ok = false;
          }
        }
        finish(f.e, 'turnover');
        break;
      }
      lastCarrier = f.carrier;
    }
    // 공이 죽음 (아웃·리스타트)
    if (f.restart && !start.restart) {
      const r = f.restart;
      const label = r === 'corner' ? (att === side ? '코너킥 얻음' : '코너킥 내줌') : RESTART_KO[r];
      if (firstOpen && r !== 'freeKick' && r !== 'penalty') first(r === 'corner', `${actKo} → ${label}`, `${actKo} → ${label}`);
      else if (!steps.includes(label)) steps.push(label);
      finish(f.e, 'dead');
      break;
    }
  }
  if (!done) {
    // 창이 끝날 때까지 결과가 없었다
    first(true, okText, '');
    if (type === 'duel') steps.push(action === 'jockey' ? '따라붙어 지연' : action === 'lane' ? '패스길 막음' : '상대 공격 계속');
    if (!steps.length) steps.push('공격 계속');
    if (endE >= frames.at(-1)!.e && frames.at(-1)!.e < from + OUTCOME.maxSpan) end = 'end';
  }
  return { from, to: Math.max(from, Math.round(endE * 10) / 10), steps: steps.filter(Boolean), goal, end, ok };
}

/** 결과 띠 한 줄: "성공 · 돌파 성공 → 슈팅 → 선방 · 평점 +0.12" */
export function outcomeBand(o: DecisionOutcome, rec: DecisionRecord | undefined, side: 0 | 1): { tone: 'success' | 'fail' | 'neutral' | 'goal' | 'conceded'; title: string; flow: string; delta: string } {
  const d = rec?.delta ?? 0;
  const delta = `평점 ${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(2)}`;
  const flow = o.steps.join(' → ');
  if (o.goal !== null) return o.goal === side ? { tone: 'goal', title: '골!', flow, delta } : { tone: 'conceded', title: '실점', flow, delta };
  // 화면에 보인 결과를 먼저 따르고, 판정이 없으면(따라붙기·맡기기 흐름) 결정 기록의 평점 판정
  const r = o.ok === true ? 'success' : o.ok === false ? 'fail' : rec?.result ?? 'neutral';
  return { tone: r, title: r === 'success' ? '성공' : r === 'fail' ? '실패' : '보통', flow, delta };
}
