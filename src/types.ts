import type { FieldAttribute, FieldAttributes, GkAttributes, GkType } from './attributes';
import type { FieldPosition } from './positions';
import type { Proficiency } from './proficiency';

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


export type InjuryGrade = 'minor' | 'major' | 'seasonEnding';

/** 부상 (7.3) */
export interface Injury {
  grade: InjuryGrade;
  weeksTotal: number;
  /** 남은 결장 주. 0 이 되면 회복 */
  weeksLeft: number;
  /** 다친 시즌과 라운드(1부터) */
  season: number;
  round: number;
  /** 영구 하락한 신체 능력치 */
  permanent: Partial<Record<FieldAttribute, number>>;
}

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
  /** 부상 횟수와 부상으로 결장한 주 */
  injuries: number;
  injuredWeeks: number;
  /** 카드 (E.10). 이전 세이브는 0 */
  yellows: number;
  reds: number;
  /** 부진 연속 감점으로 이번 시즌 잃은 위상 (8.1, 부록 C.25). 이전 세이브의 기록에는 없다 */
  slumpPenalty?: number;
  /** 부진 감점 중 티어 하한에 막혀 사라진 위상 (부록 C.27). 이전 세이브에는 없다 */
  slumpBlocked?: number;
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
  /** 실제 선수의 정점 목표 OVR (부록 D.7 #1). 가상 유망주는 없음 */
  peakTarget?: number;
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
  /** 현재 부상. 없으면 null */
  injury: Injury | null;
  /** 최근 출전 경기 평점 (폼 계산용, 최근 BALANCE.form.games 경기) */
  recentRatings: number[];
  /** 기준 평점 미만 출전이 이어진 횟수 (부진 연속, 8.1·부록 C.25). 기준 이상이면 0 */
  slumpStreak: number;
  /** 남은 출장 정지 경기 수 (E.10) */
  suspended: number;
  /** 비용 2 구간 코치 코멘트를 이미 봤는지 (6.3) */
  coachWarned: boolean;
  season: SeasonStats;
  history: SeasonRecord[];
  /** 포지션별 숙련도 0~100 (부록 D.3) */
  proficiency: Proficiency;
  /** 주 포지션 변경 요청 전 포지션 (숙련도 상승 거리 기준) */
  formerPosition?: FieldPosition;
  /** 지금까지의 이전 주 포지션 전부 (시즌 감소 대상, 부록 C.23) */
  formerPositions: FieldPosition[];
  /** 레전드 배지 (부록 D.4, 영구) */
  badges: Badge[];
  /** 레전더리 조건용 수상 기록 (8.1, 부록 C.23). 발롱도르·챔스·월드컵(5단계)이 생기기 전까지 0 */
  honors: Honors;
}

export interface Honors {
  ballonDor: number;
  trebles: number;
  worldCups: number;
}

export type BadgeId = 'goals500' | 'titles5' | 'oneClub10';

export interface Badge {
  id: BadgeId;
  /** 받은 시즌 */
  season: number;
}
