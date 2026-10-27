// 경기 엔진 입출력과 내부 상태 (부록 E.2, E.13)

import type { FieldAttributes, GkAttributes, GkType } from '../attributes';
import type { Difficulty } from '../config/balance';
import type { Formation, FormationSlot } from '../formations';
import type { Position } from '../types';
import type { DecisionRecord, MomentControl } from './moments';
import type { CardInput, CardReport } from './cards';
import type { Body } from '../body';
import type { MatchEnv } from './env';
import type { RapportInput } from './rapport';

/** 전술 성향 7종 (E.19 ①, C.76k 버스 세우기) */
export type Tendency = 'balanced' | 'tikitaka' | 'gegenpress' | 'counter' | 'direct' | 'block' | 'bus';

export interface Tactics {
  /** 전술 성향: 세부 전술 기본값과 고유 행동 (E.19) */
  tendency: Tendency;
  /** 수비 라인 0~1 (0.2 매우 낮음 / 0.35 / 0.5 / 0.65, C.76k) */
  lineHeight: number;
  /** 0~1 */
  pressing: number;
  /** 빌드업 성향 0 직선형 ~ 1 점유형 (E.18 A5). 템포는 이 값에서 파생한다 */
  style: number;
  /** 공격 폭: 공격 시 슬롯 y 의 중앙 기준 간격 배수 (0.85 / 1.0 / 1.15) */
  width: number;
}

export interface PlayerSpec {
  id: string;
  name?: string;
  /** 포메이션 슬롯 인덱스 (벤치는 -1) */
  slot: number;
  position: Position;
  role?: string;
  attrs: FieldAttributes;
  /** GK 만 */
  gk?: { attrs: GkAttributes; type: GkType };
  /** 경기 시작 스태미나 0~100 */
  stamina: number;
  /** 폼 보정 (E.16, 결정 순간 성공 확률 %p 는 E4) */
  form: number;
  isMe: boolean;
  /** 신체·양발 (부록 C.45): 실행 배율에만 쓴다. 없으면 보정 없음 */
  body?: Body;
  /** 경고·퇴장 확률 배율 (C.45 다혈질, 내 선수만). 없으면 1 */
  cardMul?: number;
  /** 등번호 (표시용, 부록 C.45). 엔진 판정에는 쓰지 않는다 */
  shirt?: number;
}

export interface TeamSetup {
  teamId: string;
  formation: Formation;
  /** 커스텀 포메이션의 슬롯 (E.5.1, 내 팀만). 있으면 formation 대신 쓴다 */
  customSlots?: readonly FormationSlot[];
  /** 표시용 포메이션 이름 (커스텀이면 "3-4-3 커스텀") */
  formationName?: string;
  lineup: PlayerSpec[];
  bench: PlayerSpec[];
  tactics: Tactics;
  /** 팀 레이팅 (압박 초기값 계산, 기록용) */
  rating: number;
}

export interface EngineInput {
  home: TeamSetup;
  away: TeamSetup;
  mode: 'auto' | 'live';
  myPlayerId?: string;
  myRole?: string;
  /** 내 팀 쪽 (직접 모드에서 AI 전술 조정을 하지 않는다, E.19) */
  myTeam?: 0 | 1;
  difficulty: Difficulty;
  seed: number;
  bigMatch: boolean;
  /** 중립 경기면 홈 보정 없음 (캘리브레이션용) */
  neutral?: boolean;
  /** 내 선수 출전 구간(분). 선발이 아니면 교체 투입 */
  myMinutes?: { start: number; end: number };
  /** 내 선수 결정 순간 (E.11): 직접/자동, 정지 빈도, 정책. 없으면 자동 */
  control?: MomentControl;
  /** 내 선수 카드 (부록 F, C.36): 덱과 숙련도. 없거나 빈 덱이면 카드 없이 (C.35 와 같은 경기) */
  cards?: CardInput;
  /** 경기 환경 (C.74a): 날씨·심판 실행 배율. 없으면 맑음·보통 심판 (모두 1) */
  env?: Partial<MatchEnv>;
  /** 동료 호흡·상대 분석·패스 받는 빈도 (C.74c): 실행 배율. 없으면 호흡 0·관계 보통·리포트 없음 */
  rapport?: RapportInput;
  /** 캘리브레이션/테스트용: 그 분에 해당 팀 미드필더 1명 퇴장 (E.15 퇴장 후 득점 차) */
  forceRed?: { team: 0 | 1; minute: number };
}

export type EventType =
  | 'kickoff' | 'halftime' | 'fulltime' | 'pass' | 'shot' | 'goal' | 'save' | 'block' | 'miss'
  | 'foul' | 'advantage' | 'card' | 'corner' | 'freeKick' | 'penalty' | 'throwIn' | 'goalKick'
  | 'offside' | 'sub' | 'injury' | 'decision';

export interface MatchEvent {
  t: number;
  type: EventType;
  team: 0 | 1;
  players: string[];
  params?: Record<string, number | string>;
}

export interface TeamStats {
  goals: number;
  possessionTicks: number;
  passes: number;
  passesCompleted: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
  offsides: number;
  advantages: number;
  tackles: number;
  tacklesWon: number;
  interceptions: number;
  dribbles: number;
  dribblesWon: number;
  crosses: number;
  crossesCompleted: number;
  aerials: number;
  saves: number;
  // ── 측정용 (E.15, E3.5) ──
  throwIns: number;
  goalKicks: number;
  /** 30 m 이상 패스 시도 / 성공, 판단 시점 성공 확률 합 */
  longPasses: number;
  longCompleted: number;
  longPSum: number;
  throughPasses: number;
  throughReceived: number;
  /** 오픈 플레이 소유 시작 10초 안 슈팅 (역습) */
  counterShots: number;
  /** 골킥 소유 시작 15초 안 슈팅 */
  goalKickShots: number;
  /** 골대 폭 안(중앙)에서 쏜 슈팅 */
  centralShots: number;
  /** 상대 진영에서 소유를 빼앗은 횟수 */
  oppHalfWins: number;
  keyPasses: number;
  cutbacks: number;
  layoffs: number;
  holdups: number;
  holdupsWon: number;
  // ── 측정용 (E.22 0번) ──
  /** 슈팅 / 골 경로: 0 패스 받고, 1 몰고 가기·돌파 후, 2 코너, 3 프리킥, 4 PK, 5 리바운드, 6 그 밖(세컨드 볼) */
  shotPaths: number[];
  goalPaths: number[];
  /** 공격 진영(상대 진영) 결정의 선택 순위: 판단 품질 구간 [55, 70, 85] × [최선, 차선, 나머지] */
  decisions: number[];
  /** 크로스·컷백 순간 상대 박스 안 우리 선수 수 합 / 횟수 */
  boxAtCross: number;
  boxCrossN: number;
  /** (E.23) 수비수가 판단해서 시도한 태클 (1대1 경합 제외), 몰고 가기·유지 실패로 잃은 소유 */
  tackleAttempts: number;
  dispossessed: number;
  /** (C.76q) 12 m 밖(PK 제외) 유효 슈팅 도착 / 그중 선방 — 미해결 6 선방률 지표 */
  farOnTarget: number;
  farSaves: number;
  /**
   * (C.78r) 12 m 밖 유효 슈팅을 슛 상황 구간으로 나눈 도착 / 선방 — 선택 효과를 뺀 선방률 가드(구간별 선방률 × 고정 가중).
   * 구간 = 거리(12~16.5 · 16.5~25 · 25 m+) × GK 자리(슛 순간 덮는 정도 ≥ 0.9 자리 잡음 · 미만), 순서 [거리 * 2 + (자리 잡음 ? 0 : 1)]
   */
  farBinOn: number[];
  farBinSaves: number[];
}

export interface PlayerStats {
  id: string;
  team: 0 | 1;
  position: Position;
  minutes: number;
  distance: number;
  sprints: number;
  passes: number;
  passesCompleted: number;
  keyPasses: number;
  shots: number;
  shotsOnTarget: number;
  goals: number;
  assists: number;
  tackles: number;
  tacklesWon: number;
  interceptions: number;
  dribbles: number;
  dribblesWon: number;
  aerialsWon: number;
  fouls: number;
  yellows: number;
  red: boolean;
  offsides: number;
  rating: number;
  // ── 측정용 (E.15.1 스탯 반응) ──
  received: number;
  throughReceived: number;
  aerialDuels: number;
  crosses: number;
  crossesCompleted: number;
  /** 이 선수를 상대로 한 드리블 돌파 시도 / 성공 */
  dribblesFaced: number;
  dribbledPast: number;
  // ── 경기 기록 확장 (C.30, E.12·D.22): 집계만, 엔진 판정에는 쓰지 않는다 ──
  /** 결정적 기회 창출: 판단용 xG ≥ bigChanceXg 인 슈팅으로 이어진 마지막 패스 (키패스의 부분집합) */
  bigChances: number;
  /** 침투 패스 시도 / 성공 (패서 쪽) */
  throughPasses: number;
  throughCompleted: number;
  /** 걷어내기 전체 / 위험 지역(자기 박스·박스 앞)에서 */
  clearances: number;
  dangerClearances: number;
  /** 슛 블록 (막은 수비수) */
  blocks: number;
  /** GK 선방 */
  saves: number;
  /** 75분까지 이동 거리 (m) */
  distance75: number;
  /** 교체/퇴장으로 나간 분 (끝까지 뛰면 null) */
  offMinute: number | null;
  /** 슬롯 인덱스 (벤치에서 들어오면 들어간 슬롯) */
  slot: number;
}

export interface Frame {
  t: number;
  ball: { x: number; y: number; z: number; carrier: string | null };
  players: { id: string; x: number; y: number }[];
}

export interface EngineResult {
  homeGoals: number;
  awayGoals: number;
  teamStats: [TeamStats, TeamStats];
  players: PlayerStats[];
  myStats: PlayerStats | null;
  events: MatchEvent[];
  /** 내 결정 기록 (E.11, I.17 10번) */
  decisions: DecisionRecord[];
  /** 카드 사용 기록 (C.36). 카드가 없는 경기는 없다 */
  cards?: CardReport;
  /** 내 선수가 이 경기에서 맡은 역할 id (시그니처 해금, C.36) */
  myRole?: string;
  /** 실제 경기 시간 (초, 추가시간 포함) */
  duration: number;
  /** 공이 살아 있던 시간 (초) */
  liveSeconds: number;
  /** 75분 시점의 실제 경과 시간 (초, 전반 추가시간 포함) */
  elapsed75: number;
}
