import type { FieldAttribute, FieldAttributes, GkAttributes, GkType } from './attributes';
import type { FieldPosition } from './positions';

export type Foot = 'left' | 'right' | 'both';
export type Tier = 'legendary' | 'worldClass' | 'topClass' | 'special' | 'normal';
export type Position =
  | 'GK' | 'CB' | 'LB' | 'RB' | 'LWB' | 'RWB'
  | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'CF' | 'ST';

/** 능력치 하나를 [min, max] 범위로 직접 지정 (중심값 대신 이 범위에서 결정) */
export type RangeOverride = readonly [number, number];

export interface Variance {
  /** 변동 폭(±). 기본 5. 스타는 작게, 유망주는 크게 */
  spread?: number;
  /** 특정 능력치만 범위를 직접 지정 */
  overrides?: Partial<Record<FieldAttribute, RangeOverride>>;
}

interface PlayerBase {
  id: string;
  name: string;
  nameKo: string;
  birthYear: number;
  nationality: string;
  height: number; // cm
  weight: number; // kg
  foot: Foot;
  club: string;
  league: string;
  shirtNumber: number;
  position: Position;
  subPositions: Position[];
  traits: string[];
  potentialTier: Tier;
  /** 위상(명성 점수). 고정값 */
  reputation: number;
  legendBadge: boolean;
}

export interface FieldPlayerData extends PlayerBase {
  position: Exclude<Position, 'GK'>;
  /** 능력치 중심값. 실제 값은 새 게임 시작 시 생성 */
  attributes: FieldAttributes;
  variance?: Variance;
}

export interface GoalkeeperData extends PlayerBase {
  position: 'GK';
  gkType: GkType;
  gkAttributes: GkAttributes;
  variance?: Pick<Variance, 'spread'>;
}

export type PlayerData = FieldPlayerData | GoalkeeperData;

// ── 게임 진행 상태 (1단계) ──


/** 시즌 중 누적 기록 */
export interface SeasonStats {
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  ratingSum: number;
  matchXp: number;
  moms: number;
}

/** 시즌 종료 시 저장되는 기록 */
export interface SeasonRecord extends SeasonStats {
  /** 시즌 시작 연도 (2018 = 2018-19) */
  season: number;
  age: number;
  teamId: string;
  leaguePosition: number;
  achievementXp: number;
  ovr: number;
  reputation: number;
}

/** 내 선수 상태 */
export interface PlayerState {
  name: string;
  /** 실제 선수로 시작했으면 그 선수 id */
  realPlayerId?: string;
  position: FieldPosition;
  age: number;
  teamId: string;
  attributes: FieldAttributes;
  /** 숨김. 화면에 보여 주지 않는다 */
  potentialTier: Tier;
  /** 다음 레벨까지 쌓인 XP */
  xp: number;
  totalXp: number;
  level: number;
  unspentPoints: number;
  /** 포인트 찍기 제한 추적: 미사용 포인트가 0이 되면 초기화 */
  allocation: { levels: number; raised: Partial<Record<FieldAttribute, number>> };
  fatigue: number;
  reputation: number;
  /** 비용 2 구간 코치 코멘트를 이미 봤는지 (6.3) */
  coachWarned: boolean;
  season: SeasonStats;
  history: SeasonRecord[];
}
