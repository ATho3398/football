// 엔진 내부 상태. 시뮬 함수들이 공유한다 (전역 상태 없음)

import type { FieldAttributes, GkAttributes, GkType } from '../attributes';
import type { Position } from '../types';
import type { Role } from './roles';
import type { EngineInput, MatchEvent, PlayerSpec, PlayerStats, Tactics, TeamStats } from './types';

/** 0 GK, 1 수비, 2 중원, 3 공격 */
export type Line = 0 | 1 | 2 | 3;

export interface Agent {
  idx: number;
  id: string;
  team: 0 | 1;
  spec: PlayerSpec;
  attrs: FieldAttributes;
  gk: { attrs: GkAttributes; type: GkType } | null;
  pos: Position;
  line: Line;
  role: Role;
  /** 포메이션 슬롯 기본 위치 (정규화) */
  sx: number;
  sy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 이동 목표와 목표 속도 */
  tx: number;
  ty: number;
  urgent: boolean;
  maxSpeed: number;
  accel: number;
  turnKeep: number;
  stamina: number;
  /** 판단 품질 0~1 (E.7) */
  judgement: number;
  /** 다음 온더볼 결정까지 남은 시간 */
  cooldown: number;
  /** 다음 오프더볼 목표 갱신 시각 */
  nextOffball: number;
  /** 침투 종료 시각 */
  runUntil: number;
  /** 수비 위치 오차 (오프더볼 갱신마다 새로) */
  errX: number;
  errY: number;
  /** 제쳐진 뒤 이 시각까지 태클 불가 */
  beatenUntil: number;
  onPitch: boolean;
  sprinting: boolean;
  stats: PlayerStats;
  /** 경기 출전 시작/끝 시각 (초) */
  enteredAt: number;
  leftAt: number | null;
  /** 상대 골을 등지고 받았다 (포스트플레이 후보, E.18 A2). 다음 결정 후 해제 */
  backToGoal: boolean;
  /** 소유를 잃었을 때 긴급 복귀를 판단했는가 (확률 0.6 + 0.4 × 노력/100, 소유가 바뀔 때마다 새로, E.18 A3) */
  recoverUrgent: boolean;
  /** 복귀: 러닝 이상으로 달린다 (목표가 자기 골 쪽 10 m 이상) */
  minRun: boolean;
  /** 스태미나 소모 배율 (수적 열세 1.15, E.18 A6) */
  drainMul: number;
  /** 듀얼 로짓 보정 (홈 이점, E.18 A7) */
  duelEdge: number;
  /** 평점 계산용 내부 기록 (E.12) */
  rt: { forward: number; lost: number; dangerLost: number; conceded: number };
  /** 측정용 (E.22 0번 골 경로): 공을 얻은 방식과 마지막 몰고 가기·돌파 시각 */
  gotBy: 'receive' | 'gain';
  lastMoveT: number;
  /** 지금 슈팅의 경로 (골이 되면 골 경로로 센다) */
  shotPath: number;
}

export type FlightKind = 'pass' | 'long' | 'cross' | 'shot' | 'clear';

export interface Flight {
  kind: FlightKind;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  t0: number;
  dur: number;
  air: boolean;
  passer: number;
  /** 받을 선수 (성공 시) */
  receiver: number;
  /** 끝났을 때: 'receive' 받는 선수 소유, 'intercept' 가로챔, 'loose' 루즈볼, 'shot' 골문 도착(세이브 판정), 'aerial' 착지점 공중볼 경합 */
  outcome: 'receive' | 'intercept' | 'loose' | 'shot' | 'aerial';
  /** 인터셉트 선수 */
  interceptor: number;
  /** 침투 패스 (측정용) */
  through?: boolean;
  /** 컷백/레이오프: 받는 선수가 반응 시간만에 다음 결정 (원터치, E.18 A2) */
  quick?: boolean;
  /** 크로스였으면 true (크로스 성공 집계) */
  fromCross?: boolean;
  /** 유효 슈팅 정보 */
  shot?: { speed: number; corner: number; d: number; header: boolean };
}

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  owner: number;
  flight: Flight | null;
  lastTouch: number;
  lastTeam: 0 | 1;
}

export type RestartType = 'kickoff' | 'throwIn' | 'goalKick' | 'corner' | 'freeKick' | 'penalty';
export type CardType = 'yellow' | 'red';

export interface Restart {
  type: RestartType;
  team: 0 | 1;
  /** 간접 프리킥 (오프사이드 등): 직접 슛 불가 */
  indirect?: boolean;
  x: number;
  y: number;
  at: number;
  taker: number;
}

export interface TeamState {
  setup: { teamId: string; tactics: Tactics; rating: number };
  tactics: Tactics;
  stats: TeamStats;
  /** 팀 phase −1(수비) ~ +1(공격) */
  phase: number;
  subsLeft: number;
  /** 역압박 (E.18 A3): 이 시각까지, 가담 선수 idx (공에 가까운 순) */
  counterUntil: number;
  counterPressers: number[];
  /** 마지막으로 오픈 플레이에서 공을 빼앗은 시각 (게겐프레싱·역습 고유 행동, E.19) */
  wonAt: number;
  /** 돌파 후 커버 (E.22 A): 이 시각까지 이 선수가 돌파한 상대의 진행 방향을 막는다 */
  coverUntil: number;
  coverAgent: number;
}

export interface SimState {
  input: EngineInput;
  seed: number;
  t: number;
  /** 킥오프부터 실제 경과 시간 (초, 추가시간 포함). 출전 시간 계산용 */
  elapsed: number;
  tick: number;
  half: 1 | 2;
  /** 이번 하프 종료 시각 (추가시간 포함) */
  halfEnd: number;
  agents: Agent[];
  bench: [Agent[], Agent[]];
  ball: Ball;
  /** 대형 쏠림용으로 부드럽게 따라가는 공 위치 */
  bsx: number;
  bsy: number;
  teams: [TeamState, TeamState];
  /** 마지막으로 공을 소유한 팀과 그 시각 */
  possTeam: 0 | 1;
  possSince: number;
  restart: Restart | null;
  /** 어드밴티지 보류 중인 파울 (E.10) */
  advantage: { t: number; team: 0 | 1; x: number; y: number; card: CardType | null; fouler: number; value: number } | null;
  /** 다음 경기 중단 때 줄 카드 */
  pendingCards: { agent: number; card: CardType }[];
  /** 스로인/골킥/코너 직후 첫 패스 (오프사이드 면제) */
  exemptPass: boolean;
  /** 마지막으로 공을 소유한 선수 (소유 상실 기록) */
  lastOwner: number;
  /** 마지막 소유 종료가 슈팅이었는가 (소유 상실로 치지 않음) */
  lastWasShot: boolean;
  /** 다음 교체 판단 시각 */
  nextSubCheck: number;
  /** 마지막 성공 패스 (어시스트, 키패스) */
  lastPass: { passer: number; receiver: number; t: number } | null;
  events: MatchEvent[];
  done: boolean;
  /** 현재 소유가 시작된 방식과 시각 (측정용: 역습 슈팅, 골킥 직후 슈팅) */
  possOrigin: 'open' | RestartType;
  possStartT: number;
  /** 75분 이동 거리 기록 여부 */
  snap75: boolean;
  elapsed75: number;
  /** 마지막 오프사이드 라인 계산값 캐시 (팀별 상대 수비 라인 x) */
  offsideX: [number, number];
  /** 팀별 마지막 슈팅 시각 (측정용: 리바운드 경로) */
  lastShotT: [number, number];
}

export function emptyTeamStats(): TeamStats {
  return {
    goals: 0, possessionTicks: 0, passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, corners: 0,
    fouls: 0, yellows: 0, reds: 0, offsides: 0, advantages: 0, tackles: 0, tacklesWon: 0, interceptions: 0,
    dribbles: 0, dribblesWon: 0, crosses: 0, crossesCompleted: 0, aerials: 0, saves: 0,
    throwIns: 0, goalKicks: 0, longPasses: 0, longCompleted: 0, longPSum: 0, throughPasses: 0, throughReceived: 0, counterShots: 0, goalKickShots: 0,
    centralShots: 0, oppHalfWins: 0, keyPasses: 0, cutbacks: 0, layoffs: 0, holdups: 0, holdupsWon: 0,
    shotPaths: [0, 0, 0, 0, 0, 0, 0], goalPaths: [0, 0, 0, 0, 0, 0, 0], decisions: [0, 0, 0, 0, 0, 0, 0, 0, 0], boxAtCross: 0, boxCrossN: 0,
  };
}

export function emptyPlayerStats(id: string, team: 0 | 1, position: Position): PlayerStats {
  return {
    id, team, position, minutes: 0, distance: 0, sprints: 0, passes: 0, passesCompleted: 0, keyPasses: 0, shots: 0,
    shotsOnTarget: 0, goals: 0, assists: 0, tackles: 0, tacklesWon: 0, interceptions: 0, dribbles: 0, dribblesWon: 0,
    aerialsWon: 0, fouls: 0, yellows: 0, red: false, offsides: 0, rating: 6,
    received: 0, throughReceived: 0, aerialDuels: 0, crosses: 0, crossesCompleted: 0, dribblesFaced: 0, dribbledPast: 0,
    distance75: 0, offMinute: null, slot: -1,
  };
}
