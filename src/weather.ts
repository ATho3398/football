// 날씨 (부록 C.74a, pending 75): 홈 구단 연고지의 월별 기후 확률로 경기 날씨를 정한다.
// (세계 시드, 경기 날짜, 홈팀) 만으로 정해지므로 세이브에 저장하지 않고 예보·경기·결과가 늘 같다 (결정성).
// 효과는 엔진 실행 배율만 (src/engine/env.ts). 수치는 BALANCE.weather

import { BALANCE } from './config/balance';
import type { IsoDate } from './calendar';
import type { MatchEnv } from './engine/env';
import { createRng, hashSeed } from './rng';

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'wind' | 'heat' | 'snow';
/** BALANCE.weather.month 가중 순서 */
export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'cloudy', 'rain', 'wind', 'heat', 'snow'];

export const WEATHER_KO: Readonly<Record<WeatherKind, string>> = {
  clear: '맑음', cloudy: '흐림', rain: '비', wind: '강풍', heat: '폭염', snow: '눈·한파',
};

/** 결과 화면 한 줄 (맑음·흐림은 없음) */
export const WEATHER_LINE: Readonly<Record<WeatherKind, string | null>> = {
  clear: null, cloudy: null, rain: '빗속 경기', wind: '강풍 속 경기', heat: '폭염 속 경기', snow: '눈·한파 속 경기',
};

/** 다음 경기 카드 예보 한 줄: 경기에 어떤 영향이 있는지 (전술 선택 이유) */
export const WEATHER_HINT: Readonly<Record<WeatherKind, string>> = {
  clear: '날씨 영향 없음',
  cloudy: '날씨 영향 없음',
  rain: '공이 빠르고 미끄러워요 · 퍼스트 터치·GK 실수↑ · 슬라이딩·중거리 슛 유리',
  wind: '롱패스·크로스·프리킥이 부정확해요 · 짧은 패스가 유리',
  heat: '체력이 빨리 떨어지고 회복이 느려요 · 강한 압박은 후반에 지쳐요',
  snow: '공이 느리고 드리블 실수↑ · 근육 부상 조금 늘어요',
};

/** 구단 연고지 (BALANCE.weather.region 키). 리그 밖 팀(컵 상대)은 europe */
const TEAM_REGION: Readonly<Record<string, string>> = {
  ars: 'london', che: 'london', tot: 'london', whu: 'london', cry: 'london', ful: 'london', wat: 'london',
  bha: 'south', sou: 'south', bou: 'south',
  wol: 'midlands', lei: 'midlands',
  mci: 'northwest', mun: 'northwest', liv: 'northwest', eve: 'northwest', bur: 'northwest',
  new: 'northeast', hud: 'yorkshire', car: 'wales',
};

export function regionOf(teamId: string): string {
  return TEAM_REGION[teamId] ?? 'europe';
}

/** 그 지역·월의 날씨 확률 (합 1) */
export function climate(teamId: string, month: number): Record<WeatherKind, number> {
  const W = BALANCE.weather;
  const base = W.month[Math.min(12, Math.max(1, month))]!;
  const [rain, wind, heat, snow] = W.region[regionOf(teamId)] ?? W.region.europe!;
  const w = [base[0]!, base[1]!, base[2]! * rain, base[3]! * wind, base[4]! * heat, base[5]! * snow];
  const total = w.reduce((t, x) => t + x, 0) || 1;
  return Object.fromEntries(WEATHER_KINDS.map((k, i) => [k, w[i]! / total])) as Record<WeatherKind, number>;
}

/** 경기 날씨 (결정적): 세계 시드 · 날짜 · 홈팀 */
export function weatherFor(worldSeed: string, date: IsoDate, homeId: string): WeatherKind {
  if (fixed) return 'clear';
  const p = climate(homeId, Number(date.slice(5, 7)));
  let x = createRng(hashSeed(`${worldSeed}:weather:${date}:${homeId}`))();
  for (const k of WEATHER_KINDS) {
    x -= p[k];
    if (x < 0) return k;
  }
  return 'clear';
}

/** 엔진 실행 배율 (맑음·흐림 = 빈 객체) */
export function weatherEnv(kind: WeatherKind): Partial<MatchEnv> {
  return { ...(BALANCE.weather.effects[kind] ?? {}) } as Partial<MatchEnv>;
}

/** 그 날씨 경기의 부상 확률 배수 */
export function weatherInjuryMul(kind: WeatherKind): number {
  return BALANCE.weather.injury[kind] ?? 1;
}

/** 예보를 보여 줄 수 있는가: 경기 forecastDays 일 전부터 */
export function forecastOpen(daysToMatch: number): boolean {
  return daysToMatch <= BALANCE.weather.forecastDays;
}

// ── 측정 고정 (부록 C.74a 검증): balance·엔진 점검은 맑음·보통 심판으로 ──
let fixed = false;

/** true 면 모든 경기가 맑음·보통 심판 (src/referees.ts 도 이 값을 본다) */
export function setEnvironmentFixed(on: boolean): void {
  fixed = on;
}

export function environmentFixed(): boolean {
  return fixed;
}
