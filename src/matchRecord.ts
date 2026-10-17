// 내 선수 경기 기록 (부록 C.30, E.12·D.22): 엔진이 센 선수 기록을 화면·세이브용으로 줄인다. 평점과는 관계없다

import type { PlayerStats } from './engine/types';
import type { Position } from './types';

/** 경기 하나의 기록 (세이브에 남는다). distance 는 km (소수 1자리) */
export interface MatchRecord {
  passes: number;
  passesCompleted: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  /** 결정적 기회 창출 (빅찬스 메이킹) */
  bigChances: number;
  /** 침투 패스 성공 (패서 쪽) */
  throughCompleted: number;
  /** 위험 지역(자기 박스·박스 앞) 걷어내기 */
  dangerClearances: number;
  interceptions: number;
  dribblesWon: number;
  /** 1대1 수비 성공 = 상대 드리블 맞음 − 뚫림 */
  duelsWon: number;
  tacklesWon: number;
  aerialsWon: number;
  blocks: number;
  saves: number;
  distance: number;
}

export type RecordKey = keyof MatchRecord;

/** 화면에 한 칸으로 보이는 항목. 패스·슈팅은 성공/시도를 한 칸에 */
export type RecordItem =
  | 'pass' | 'shot' | 'keyPasses' | 'bigChances' | 'throughCompleted' | 'dangerClearances' | 'interceptions'
  | 'dribblesWon' | 'duelsWon' | 'tacklesWon' | 'aerialsWon' | 'blocks' | 'saves' | 'distance';

export const RECORD_ITEM_LABELS: Record<RecordItem, string> = {
  pass: '패스', shot: '슈팅(유효)', keyPasses: '키패스', bigChances: '결정적 기회 창출', throughCompleted: '침투 패스 성공',
  dangerClearances: '위험 지역 걷어내기', interceptions: '인터셉트', dribblesWon: '드리블 돌파', duelsWon: '1대1 수비 성공',
  tacklesWon: '태클 성공', aerialsWon: '공중볼 승리', blocks: '슛 블록', saves: '선방', distance: '이동 거리',
};

/** 한 줄 요약에 쓰는 짧은 이름 */
const SHORT: Record<RecordItem, string> = {
  pass: '패스', shot: '슈팅', keyPasses: '키패스', bigChances: '빅찬스', throughCompleted: '침투 패스', dangerClearances: '걷어내기',
  interceptions: '인터셉트', dribblesWon: '돌파', duelsWon: '1대1', tacklesWon: '태클', aerialsWon: '공중볼', blocks: '블록', saves: '선방',
  distance: '거리',
};

/** 전체 보기 순서 */
export const ALL_ITEMS: readonly RecordItem[] = [
  'pass', 'shot', 'keyPasses', 'bigChances', 'throughCompleted', 'dribblesWon', 'aerialsWon',
  'tacklesWon', 'interceptions', 'duelsWon', 'dangerClearances', 'blocks', 'saves', 'distance',
];

/** 포지션별로 먼저 보이는 6개 (D.22 4번 ①). 한 줄 요약은 앞 3개 */
export function primaryItems(position: Position): RecordItem[] {
  switch (position) {
    case 'ST': case 'CF':
      return ['shot', 'keyPasses', 'bigChances', 'dribblesWon', 'aerialsWon', 'pass'];
    case 'LW': case 'RW': case 'LM': case 'RM':
      return ['keyPasses', 'bigChances', 'dribblesWon', 'shot', 'throughCompleted', 'pass'];
    case 'CAM':
      return ['keyPasses', 'bigChances', 'throughCompleted', 'dribblesWon', 'shot', 'pass'];
    case 'CM':
      return ['pass', 'keyPasses', 'throughCompleted', 'interceptions', 'tacklesWon', 'dribblesWon'];
    case 'CDM':
      return ['interceptions', 'tacklesWon', 'duelsWon', 'pass', 'dangerClearances', 'aerialsWon'];
    case 'LB': case 'RB': case 'LWB': case 'RWB':
      return ['tacklesWon', 'interceptions', 'duelsWon', 'dangerClearances', 'keyPasses', 'dribblesWon'];
    case 'CB':
      return ['dangerClearances', 'interceptions', 'tacklesWon', 'aerialsWon', 'blocks', 'duelsWon'];
    case 'GK':
      return ['saves', 'dangerClearances', 'pass', 'aerialsWon', 'interceptions', 'distance'];
  }
}

export function emptyRecord(): MatchRecord {
  return {
    passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, keyPasses: 0, bigChances: 0, throughCompleted: 0, dangerClearances: 0,
    interceptions: 0, dribblesWon: 0, duelsWon: 0, tacklesWon: 0, aerialsWon: 0, blocks: 0, saves: 0, distance: 0,
  };
}

/** 엔진 선수 기록 → 경기 기록 */
export function recordFromStats(p: PlayerStats): MatchRecord {
  return {
    passes: p.passes, passesCompleted: p.passesCompleted, shots: p.shots, shotsOnTarget: p.shotsOnTarget, keyPasses: p.keyPasses,
    bigChances: p.bigChances, throughCompleted: p.throughCompleted, dangerClearances: p.dangerClearances,
    interceptions: p.interceptions, dribblesWon: p.dribblesWon, duelsWon: Math.max(0, p.dribblesFaced - p.dribbledPast),
    tacklesWon: p.tacklesWon, aerialsWon: p.aerialsWon, blocks: p.blocks, saves: p.saves,
    distance: Math.round(p.distance / 100) / 10,
  };
}

/** 합계 (시즌 합계). a 를 바꾼다 */
export function addRecord(a: MatchRecord, b: MatchRecord): MatchRecord {
  for (const k of Object.keys(a) as RecordKey[]) a[k] = k === 'distance' ? Math.round((a[k] + b[k]) * 10) / 10 : a[k] + b[k];
  return a;
}

export function formatItem(r: MatchRecord, item: RecordItem): string {
  switch (item) {
    case 'pass': return `${r.passesCompleted}/${r.passes}`;
    case 'shot': return `${r.shots}(${r.shotsOnTarget})`;
    case 'distance': return `${r.distance}km`;
    default: return `${r[item]}`;
  }
}

export interface RecordRowVM { item: RecordItem; label: string; value: string }

export function recordRows(r: MatchRecord, items: readonly RecordItem[]): RecordRowVM[] {
  return items.map((item) => ({ item, label: RECORD_ITEM_LABELS[item], value: formatItem(r, item) }));
}

/** 시즌 경기 목록 한 줄 요약: 포지션 대표 항목 앞 3개 */
export function recordLine(r: MatchRecord, position: Position): string {
  return primaryItems(position).slice(0, 3).map((i) => `${SHORT[i]} ${formatItem(r, i)}`).join(' · ');
}

/** 시즌 경기 목록 한 줄 (세이브에 남는다, 이번 시즌만) */
export interface MatchLogEntry {
  round: number;
  opponentId: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  /** 출전 분 (0 이면 결장) */
  minutes: number;
  started: boolean;
  goals: number;
  assists: number;
  rating: number | null;
  mom: boolean;
  /** 결장 이유 */
  absent?: 'injured' | 'suspended' | 'bench';
  /** 그 경기의 포지션 */
  position: Position;
  /** 엔진 경기 기록. 빠른 경기(B.4)는 골·도움·평점만 산출하므로 null = "기록 없음" */
  rec: MatchRecord | null;
  /** 하이라이트 3줄 (25.4 기록 보존, 부록 C.41). C.41 이전 경기에는 없다 */
  hl?: string[];
  /** 내 결정 기록 요약 (직접 모드로 멈춘 순간). C.41 이전 경기에는 없다 */
  dec?: LoggedDecision[];
}

/** 결정 하나 요약 (세이브용): 분, 장면 이름, 고른 선택지, 결과, 평점 변화, 쓴 카드 */
export interface LoggedDecision { m: number; scene: string; label: string; r: 'success' | 'fail' | 'neutral'; d: number; card?: string }
