import type { FieldAttribute, FieldAttributes, GkAttributes, GkType } from './attributes';

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
