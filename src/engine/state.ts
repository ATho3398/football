// 엔진 내부 상태. 시뮬 함수들이 공유한다 (전역 상태 없음)

import type { FieldAttributes, GkAttributes, GkType } from '../attributes';
import type { Position } from '../types';
import type { MomentState } from './moments';
import type { CardState } from './cards';
import type { Role } from './roles';
import type { BodyMods } from '../body';
import type { MatchEnv } from './env';
import type { Rapport } from './rapport';
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
  /** 목표의 속도 (C.77x 이동 제어기 앞먹임): 사람을 따라가는 목표(추적·마크·압박)면 그 사람의 인지된 속도, 그 밖에는 0. 목표 점도 이 속도로 움직인다 */
  tvx: number;
  tvy: number;
  /** 따라가는 사람 idx (−1 없음). 목표 속도는 그 사람의 속도를 feedLag 초 늦게 따라간다(인지 지연) */
  tvIdx: number;
  /** 목표 속도에 곱하는 x·y 비율 (존 마크는 섞는 몫만, 그 밖 1) */
  tvwx: number;
  tvwy: number;
  /** 몸 방향 단위 벡터 (C.77x 뒤돌기): 빠르게 움직이면 속도 방향, 느리면 마지막 방향 그대로 */
  hx: number;
  hy: number;
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
  /** 오차를 새로 뽑을 틱 / 마지막으로 뽑은 틱 (C.75l: 읽을 때만 계산, 같은 값) */
  errTick: number;
  errDone: number;
  /** 오차를 마지막으로 새로 뽑은 시각 (C.77x errHold 동안 유지) */
  errT: number;
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
  /** 신체·양발 실행 보정 (부록 C.45): 공중볼·몸싸움·가속/민첩·GK 리치·약발 */
  body: BodyMods;
  /** 듀얼 로짓 보정 (홈 이점, E.18 A7) */
  duelEdge: number;
  /** 평점 계산용 내부 기록 (E.12) */
  rt: {
    forward: number; lost: number; dangerLost: number; attackLost: number; conceded: number; card?: number; relief?: number;
    /** 위험 감수 실패 (C.77s A2): 마지막 선택이 전진·침투 패스·크로스·돌파인가, 그 뒤 상대 진영(마지막 1/3 앞)에서 잃은 횟수 */
    risky?: boolean; riskLost?: number;
    /** 소극적 백패스 (C.77s A1): 횟수, 허용을 넘긴 가중 합, 같은 소유 순번(passivePoss = 그 소유의 possStartT), 역습 허용을 쓴 소유 */
    passive?: number; passiveW?: number; passiveSeq?: number; passivePoss?: number; passiveCtr?: number;
  };
  /** 카드 패시브 보정 (C.36, 내 선수만): 태클 성공·공중볼 승리 확률 %p. 없으면 0 */
  cardBoost?: { tackle: number; air: number };
  /** 측정용 (E.22 0번 골 경로): 공을 얻은 방식과 마지막 몰고 가기·돌파 시각 */
  gotBy: 'receive' | 'gain';
  lastMoveT: number;
  /** 측정용 (C.29 골 경로): 공을 얻은 뒤 몰고 가기 횟수, 마지막 드리블 돌파 성공 시각 */
  carryN: number;
  dribbleT: number;
  /** 지금 슈팅의 경로 (골이 되면 골 경로로 센다) */
  shotPath: number;
  /** 수비 1대1 판단 (E.23): 다음 판단 시각, 패스길 막기 유지 시각 */
  duelNext: number;
  laneUntil: number;
  /** 2선 침투자 추적 (C.77b 44h-i): 따라붙는 상대 idx(−1 없음), 배정 유지 시각(trackHold), 침투자가 존 밖으로 나간 시각(−1 = 안) */
  trackIdx: number;
  trackUntil: number;
  trackOut: number;
  /** CB 따라나옴 판단 (C.77d 가설 2): 판단한 상대 idx(−1 없음), 따라 나가는가, 결정 유지 시각 */
  stepOutIdx: number;
  stepOutGo: boolean;
  stepOutUntil: number;
  /** 긴급하지 않을 때 이동 속도 상한 (m/s, 0 이면 없음). 골 뒤 세리머니·걸어서 복귀 (C.24) */
  paceCap: number;
  /**
   * 몰고 가다 슛 의도 (C.75k, 직접 모드 2단 행동): 몰고 가기 뒤 이 선수의 다음 결정에서 슛 후보가 있으면 슛을 고른다.
   * until 이 지나거나 팀 소유가 바뀌면(poss = 그때 possStartT) 버린다. 직접 모드 결정에서만 생긴다 (자동·맡기기 경로는 없음)
   */
  intent?: { type: 'shoot'; until: number; poss: number } | null;
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
  /** 끝났을 때: 'receive' 받는 선수 소유, 'intercept' 가로챔, 'loose' 루즈볼, 'shot' GK 깊이 도착(세이브 판정), 'goal' 골라인 도착(골), 'aerial' 착지점 공중볼 경합 */
  outcome: 'receive' | 'intercept' | 'loose' | 'shot' | 'goal' | 'aerial';
  /** 인터셉트 선수 */
  interceptor: number;
  /** 침투 패스 (측정용) */
  through?: boolean;
  /** 노린 패스 거리 m (측정용, C.31) */
  aimD?: number;
  /** 컷백/레이오프: 받는 선수가 반응 시간만에 다음 결정 (원터치, E.18 A2) */
  quick?: boolean;
  /** 크로스였으면 true (크로스 성공 집계) */
  fromCross?: boolean;
  /** 끝나면 이 속도로 튄다 (벽·GK, C.24) */
  after?: { vx: number; vy: number; team: 0 | 1; touch: number };
  /** 유효 슈팅 정보 */
  shot?: { speed: number; corner: number; d: number; header: boolean; penalty?: boolean;
    /** 2단계 비행 (C.24): 세이브 실패 시 골라인 도착점과 남은 비행 시간 */
    goalX?: number; goalY?: number; rest?: number;
    /** GK 도달 항 (C.77t): 슛 순간 GK 위치로 잰 cover, 선방 확률에 곱한다 */
    cover?: number;
    /** 카드 선방 보정 (C.36): 상대 GK 선방 확률에 더한다 */
    cardSave?: number };
  /** 카드 크로스 보정 (C.36): 착지 공중볼에서 공격 쪽 승리 확률에 더한다 */
  cardEdge?: number;
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
  /** 이 선수에게 굴러가는 공 (C.24): 받기·가로채기·공중볼 승자·GK 처리. 그 선수는 컨트롤 판정 없이 잡는다 */
  reserve: BallReserve | null;
  /** 마지막으로 공을 찬 비행 종류와 팀 (C.28 백패스 판정: 같은 팀 pass/long 이면 GK 가 손을 못 쓴다). 소유·루즈볼이 되면 null */
  kick: { kind: FlightKind; team: 0 | 1; receiver: number } | null;
  /** 이 GK 는 이 시각까지 손 처리 불가 (쳐낸 공·놓친 공, C.28) */
  handBlock: { idx: number; until: number } | null;
}

export interface BallReserve {
  idx: number;
  until: number;
  kind: 'receive' | 'intercept' | 'claim' | 'win' | 'gain';
  /** 공을 잃은 선수 (빼앗기·캐치): 굴러가는 동안 다시 잡지 못한다 */
  from: number;
  /** 'receive' 의 원래 패스 (집계는 실제로 잡는 순간) */
  fl?: Flight;
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
  /** 원래 실행 시각 (키커가 늦으면 at 을 최대 restart.lateMax 초까지 미룬다, C.24) */
  at0?: number;
  /** 골 뒤 킥오프 (C.24): 득점자, 골 시각, 세리머니 끝 시각, 세리머니 지점, 함께하는 동료 */
  goal?: { scorer: number; t: number; until: number; cx: number; cy: number; joiners: number[] };
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
  /** GK 가 루즈볼을 쫓는 중 (C.28): 필드 추격자를 1명 줄인다 */
  gkChase: boolean;
  /** 깊은 블록 비행 중 가로채기 (C.76p): 이 비행(cutFlight)의 패스 선에 들어간 선수 idx. 판정은 한 비행에 1회(판정 뒤 cutIdx −1, cutFlight 는 유지) */
  cutFlight: Flight | null;
  cutIdx: number;
  /** 수비 상황 판정 (C.75c): 지금 상황과 그 시작 시각, 바뀌려는 후보와 그 시작 시각. '-' = 우리 공 */
  sit: DefSit;
  sitSince: number;
  sitCand: DefSit;
  sitCandSince: number;
}

/** 수비 상황 (C.75c, pending 41): A 정돈 / B 역습 복귀 / C 수적 열세 / D 측면 트랩 / E 박스 1대1 / F 크로스 / G 루즈볼 / H 역압박 */
export type DefSit = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | '-';

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
  /** 내 선수 결정 순간 (E.11, E4): 진행 상태와 기록. 자동 모드면 쓰지 않는다 */
  moments: MomentState;
  /** 결정 순간에서 고른 1대1 행동 (다음 defendDuels 한 번에만) */
  forcedDuel: { idx: number; pick: number; pDelta?: number; foulMul?: number } | null;
  /** 내 선수 카드 (C.36). 덱이 없으면 null (카드가 없는 경기는 C.35 와 같다) */
  cards: CardState | null;
  /** 경기 환경 실행 배율 (C.74a). 맑음·보통 심판이면 모두 1 */
  env: MatchEnv;
  /** 동료 호흡·상대 분석·패스 받는 빈도 (C.74c). 없으면 null (호흡 0·관계 보통·리포트 없음 = 이전 엔진) */
  rapport: Rapport | null;
}

export function emptyTeamStats(): TeamStats {
  return {
    goals: 0, possessionTicks: 0, passes: 0, passesCompleted: 0, shots: 0, shotsOnTarget: 0, corners: 0,
    fouls: 0, yellows: 0, reds: 0, offsides: 0, advantages: 0, tackles: 0, tacklesWon: 0, interceptions: 0,
    dribbles: 0, dribblesWon: 0, crosses: 0, crossesCompleted: 0, aerials: 0, saves: 0,
    throwIns: 0, goalKicks: 0, longPasses: 0, longCompleted: 0, longPSum: 0, throughPasses: 0, throughReceived: 0, counterShots: 0, goalKickShots: 0,
    centralShots: 0, oppHalfWins: 0, keyPasses: 0, cutbacks: 0, layoffs: 0, holdups: 0, holdupsWon: 0,
    shotPaths: [0, 0, 0, 0, 0, 0, 0], goalPaths: [0, 0, 0, 0, 0, 0, 0], decisions: [0, 0, 0, 0, 0, 0, 0, 0, 0], boxAtCross: 0, boxCrossN: 0, tackleAttempts: 0, dispossessed: 0, farOnTarget: 0, farSaves: 0,
  };
}

export function emptyPlayerStats(id: string, team: 0 | 1, position: Position): PlayerStats {
  return {
    id, team, position, minutes: 0, distance: 0, sprints: 0, passes: 0, passesCompleted: 0, keyPasses: 0, shots: 0,
    shotsOnTarget: 0, goals: 0, assists: 0, tackles: 0, tacklesWon: 0, interceptions: 0, dribbles: 0, dribblesWon: 0,
    aerialsWon: 0, fouls: 0, yellows: 0, red: false, offsides: 0, rating: 6,
    received: 0, throughReceived: 0, aerialDuels: 0, crosses: 0, crossesCompleted: 0, dribblesFaced: 0, dribbledPast: 0,
    bigChances: 0, throughPasses: 0, throughCompleted: 0, clearances: 0, dangerClearances: 0, blocks: 0, saves: 0,
    distance75: 0, offMinute: null, slot: -1,
  };
}
