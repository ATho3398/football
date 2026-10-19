// 심판 성향 (부록 C.74a, pending 77-4): 리그 심판 명단(가상 이름)과 심판별 카드·어드밴티지 성향.
// 성향은 세계 시드로, 배정은 (세계 시드, 날짜, 홈팀) 으로 정해진다 (세이브 저장 없음, 결정적). 수치는 BALANCE.referee

import { BALANCE } from './config/balance';
import type { IsoDate } from './calendar';
import type { MatchEnv } from './engine/env';
import { createRng, hashSeed } from './rng';
import { environmentFixed } from './weather';

export interface Referee {
  id: number;
  nameKo: string;
  /** 경고·퇴장 확률 배율 */
  card: number;
  /** 어드밴티지 선언 배율 */
  advantage: number;
}

/** 가상 심판 이름 (실제 심판과 무관) */
const NAMES_KO = [
  '대니얼 후퍼', '로이 캘러핸', '스튜어트 펠', '이언 마셜', '마커스 레인', '그레그 톨런드', '애덤 브리스코', '닐 해처',
  '오언 플레처', '제임스 코빈', '토머스 웨일', '배리 녹스', '사이먼 엘드리지', '루크 페어번', '앤드루 스펜스', '케빈 롤런드',
  '폴 세지윅', '조너선 미어스', '피터 웨스턴', '리처드 하틀리',
];

/** 보통 심판 (측정 고정, 명단 밖) */
export const NEUTRAL_REFEREE: Referee = { id: -1, nameKo: '보통 심판', card: 1, advantage: 1 };

const cache = new Map<string, Referee[]>();

/** 이 세계의 심판 명단 (세계 시드로 성향이 정해진다) */
export function refereePool(worldSeed: string): Referee[] {
  let pool = cache.get(worldSeed);
  if (pool) return pool;
  const R = BALANCE.referee;
  const rng = createRng(hashSeed(`${worldSeed}:referees`));
  const names = [...NAMES_KO];
  pool = [];
  const n = Math.min(R.pool, names.length);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rng() * names.length);
    const nameKo = names.splice(k, 1)[0]!;
    // 대부분 1 근처, 양 끝은 드물게 (두 난수 평균)
    const u = (rng() + rng()) / 2;
    const v = (rng() + rng()) / 2;
    pool.push({ id: i, nameKo, card: round2(R.card[0] + (R.card[1] - R.card[0]) * u), advantage: round2(R.advantage[0] + (R.advantage[1] - R.advantage[0]) * v) });
  }
  cache.set(worldSeed, pool);
  return pool;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** 경기 심판 배정 (결정적) */
export function refereeFor(worldSeed: string, date: IsoDate, homeId: string): Referee {
  if (environmentFixed()) return NEUTRAL_REFEREE;
  const pool = refereePool(worldSeed);
  return pool[Math.floor(createRng(hashSeed(`${worldSeed}:referee:${date}:${homeId}`))() * pool.length)]!;
}

export function refereeEnv(r: Referee): Partial<MatchEnv> {
  return r.card === 1 && r.advantage === 1 ? {} : { card: r.card, advantage: r.advantage };
}

/** 성향 이름표: [카드, 어드밴티지] (보통이면 null) */
export function refereeTraits(r: Referee): { card: string | null; flow: string | null } {
  const R = BALANCE.referee;
  return {
    card: r.card >= R.strict ? '카드 엄격' : r.card <= R.lenient ? '카드 관대' : null,
    flow: r.advantage >= R.flow ? '흐름 중시' : r.advantage <= R.whistle ? '자주 끊음' : null,
  };
}

/** 다음 경기 카드 한 줄: "대니얼 후퍼 · 카드 엄격 · 흐름 중시" */
export function refereeLabel(r: Referee): string {
  const t = refereeTraits(r);
  return [r.nameKo, t.card ?? '카드 보통', t.flow].filter(Boolean).join(' · ');
}
