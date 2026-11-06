// 선수 목록 캐시 (C.81e 계산 속도, 결과 불변): 틱마다 수백 번 도는 "s.agents 중 뛰는 우리/상대 (필드) 선수" 거르기를
// 미리 거른 배열로 바꾼다. 순서는 s.agents 순서 그대로라 같은 조건으로 거른 반복과 결과가 같다.
// onPitch·line 이 바뀌거나 선수가 들어오면 s.onVer 가 오르고(referee·subs), 그때 다시 만든다
import type { Agent, SimState } from './state';

interface Lists {
  ver: number;
  /** 뛰는 선수 (팀별) */
  on: [Agent[], Agent[]];
  /** 뛰는 필드 선수 (GK 줄 제외, 팀별) */
  field: [Agent[], Agent[]];
}

const cache = new WeakMap<SimState, Lists>();
let lastS: SimState | null = null;
let lastL: Lists | null = null;

function lists(s: SimState): Lists {
  let l = s === lastS ? lastL! : cache.get(s);
  if (!l) {
    l = { ver: -1, on: [[], []], field: [[], []] };
    cache.set(s, l);
  }
  lastS = s;
  lastL = l;
  if (l.ver !== s.onVer) {
    for (const t of [0, 1] as const) {
      l.on[t] = s.agents.filter((a) => a.onPitch && a.team === t);
      l.field[t] = s.agents.filter((a) => a.onPitch && a.team === t && a.line !== 0);
    }
    l.ver = s.onVer;
  }
  return l;
}

/** s.agents 중 onPitch && team === t (s.agents 순서) */
export function onOf(s: SimState, t: 0 | 1): readonly Agent[] {
  return lists(s).on[t];
}

/** s.agents 중 onPitch && team === t && line !== 0 (s.agents 순서) */
export function fieldOf(s: SimState, t: 0 | 1): readonly Agent[] {
  return lists(s).field[t];
}
