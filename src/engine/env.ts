// 경기 환경 (부록 C.74a): 날씨·심판이 엔진에 주는 실행 배율. 판단(후보 효용·판단용 P)은 건드리지 않고
// 실행 판정(굴린 난수와 비교하는 확률)·공 감속·스태미나에만 곱한다 (C.45 약발 방식). 값은 게임 쪽(src/weather.ts·src/referees.ts)이
// BALANCE.weather·BALANCE.referee 에서 만들어 넘긴다. 없으면 모두 1 (맑음·보통 심판 = 이전 엔진과 같은 경기)

export interface MatchEnv {
  /** 루즈볼 땅 감속 배율 (비 < 1 = 공이 더 굴러감, 눈 > 1 = 덜 굴러감) */
  ballDecel: number;
  /** 땅볼 패스 속도 배율 */
  passSpeed: number;
  /** 받기(퍼스트 터치) 실행 성공 배율: 패스 성공 판정·루즈볼 컨트롤 확률에 곱한다 */
  touch: number;
  /** 공중 패스(롱패스) 실행 성공 배율 */
  airPass: number;
  /** 크로스·롱볼·걷어내기 오차 배율 (> 1 = 부정확) */
  longError: number;
  /** 크로스 공중볼 경합에서 공격 쪽 승리 확률 배율 (강풍 = 크로스가 정확히 떨어지지 않음) */
  crossWin: number;
  /** 직접 프리킥 유효 슈팅 배율 */
  freeKick: number;
  /** GK 선방 뒤 캐치 확률 배율 (< 1 = 공을 더 놓침) */
  gkCatch: number;
  /** 수비 태클(슬라이딩) 실행 성공 배율 */
  tackle: number;
  /** 드리블 돌파 실행 성공 배율 */
  dribble: number;
  /** 중거리 슛(longShotFrom m 이상) 선방 확률 배율 (< 1 = 위력↑) */
  longShotSave: number;
  /** 스태미나 소모 배율 */
  drain: number;
  /** 스태미나 회복 배율 (걷기 회복·하프타임) */
  recover: number;
  /** 심판: 경고·퇴장 확률 배율 */
  card: number;
  /** 심판: 어드밴티지 선언 확률 배율 */
  advantage: number;
}

export const NEUTRAL_ENV: Readonly<MatchEnv> = {
  ballDecel: 1, passSpeed: 1, touch: 1, airPass: 1, longError: 1, crossWin: 1, freeKick: 1, gkCatch: 1, tackle: 1, dribble: 1,
  longShotSave: 1, drain: 1, recover: 1, card: 1, advantage: 1,
};

/** 중거리 슛 기준 거리 (m) */
export const LONG_SHOT_FROM = 18;

export function resolveEnv(env: Partial<MatchEnv> | undefined): MatchEnv {
  return env ? { ...NEUTRAL_ENV, ...env } : { ...NEUTRAL_ENV };
}
