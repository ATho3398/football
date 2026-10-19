// 경기 환경 (부록 C.74a): 날씨 + 심판 → 엔진 입력. 내 경기와 NPC 경기가 같은 함수를 쓴다

import type { IsoDate } from './calendar';
import type { MatchEnv } from './engine/env';
import { refereeEnv, refereeFor, type Referee } from './referees';
import { weatherEnv, weatherFor, type WeatherKind } from './weather';

export interface MatchConditions {
  weather: WeatherKind;
  referee: Referee;
  /** 엔진 실행 배율 (맑음·보통 심판이면 빈 객체) */
  env: Partial<MatchEnv>;
}

export function matchConditions(worldSeed: string, date: IsoDate, homeId: string): MatchConditions {
  const weather = weatherFor(worldSeed, date, homeId);
  const referee = refereeFor(worldSeed, date, homeId);
  return { weather, referee, env: { ...weatherEnv(weather), ...refereeEnv(referee) } };
}

/** 엔진 입력에 붙일 env (빈 객체면 붙이지 않는다 → 이전 엔진 입력과 같은 모양) */
export function envField(c: MatchConditions): { env?: Partial<MatchEnv> } {
  return Object.keys(c.env).length ? { env: c.env } : {};
}
