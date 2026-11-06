// 카드 데이터 76장 (부록 F.0·F.2·F.2.1·F.4, D.13): 공용 18 + 포지션군 24(공격/미드/수비 각 8) + 역할 시그니처 31 + 지시 3.
// 효과 엔진(src/engine/cards.ts, C.36)이 이 데이터만 읽어 결정 순간·자동 경기에 붙인다: 패·드로우·숙련도·자동 사용·4번째 선택지.
// 수치는 기획서 표 기준이며 C.36 밸런스(npm run balance:cards)로 맞춘다. 카드를 추가할 때는 이 파일에 데이터만 쓴다 (F.7 1번).

import type { FieldAttribute } from '../attributes';
import type { SceneId } from '../engine/moments';
import { SIGNATURE_CARDS } from '../signatureCards';
import { BALANCE } from './balance';

export type CardKind = 'play' | 'setPiece' | 'passive' | 'combo' | 'manage' | 'signature' | 'directive';
export type CardGroup = 'common' | 'attack' | 'midfield' | 'defense';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
/** 선택지 태그 (F.2.1) */
export type OptionTag = 'shoot' | 'pass' | 'dribble' | 'cross' | 'header' | 'tackle' | 'press' | 'clear' | 'block' | 'keyPass' | 'safe' | 'risky';
export type Duration = 'once' | 'rest' | { scenes: number };
/** 콤보 조건 (F.2.1 nextSceneBonus.if): 직전 돌파 성공 후 소유 유지 / 우리 팀이 내 태클·인터셉트로 공을 얻음 / 내 태클(압박) 성공 */
export type ComboTrigger = 'dribbleWon' | 'ballWon' | 'tackleWon';

/**
 * 효과 스키마 (F.2.1). addOption = 플레이 카드가 여는 4번째 선택지: 판정은 base 행동의 E.8 판정 + 보정(±15%p 이내),
 * judge 가 있으면 그 능력치 가중으로 판정한다 (E.15.1: 카드는 능력치를 올리지 않는다)
 */
export type OptionBase = OptionTag | 'longPass' | 'carry' | 'holdup' | 'foul' | 'lineCall' | 'race';

/** 선택지 추가 조건 (장면 안의 위치 조건, 표의 "조건" 열을 데이터로) */
export interface OptionWhen {
  /** 골까지 거리 (m) */
  minDist?: number;
  maxDist?: number;
  /** 이 거리(m) 안에 상대 수비수 */
  nearDef?: number;
  /** 상대 GK 가 골라인에서 이만큼(m) 이상 나와 있음 */
  gkOut?: number;
  /** 측면 깊은 위치 (골대 폭 바깥, 상대 박스 깊이) */
  wide?: boolean;
  /** 내 진영 (수비 지역) */
  ownHalf?: boolean;
}

export type CardEffect =
  | {
    type: 'addOption'; base: OptionBase; label: string;
    /** 성공 확률 보정 (슛은 유효 슈팅 확률) */
    probDelta?: number;
    /** 상대 선방 확률 보정 (슛) */
    saveDelta?: number;
    /** 판정 능력치 가중: 기본 판정 능력치 대신 이 가중으로 (BALANCE.cards.judgeK) */
    judge?: Partial<Record<FieldAttribute, number>>;
    /** 실패 확률 배수 (패스 레인 위험 × 0.5 등) */
    failMul?: number;
    /** 슛 블록 확률 배수 (벽 블록 × 0.5) */
    blockMul?: number;
    /** 태클 파울 확률 배수 (부작용) */
    foulMul?: number;
    /** 크로스: 받는 동료 공중볼 승리 확률 보정 */
    edge?: number;
    /** 몰고 가기 거리 (m) */
    carry?: number;
    ratingSuccess?: number; ratingFail?: number; when?: OptionWhen; note?: string;
  }
  | { type: 'probDelta'; option?: OptionTag; value: number; duration: Duration; box?: boolean; note?: string }
  | { type: 'nextSceneBonus'; if: string; on: ComboTrigger; option?: OptionTag; value: number }
  | { type: 'fatigueMult'; value: number }
  | { type: 'failureSoftener'; value: number }
  | { type: 'discardDraw'; n: number }
  | { type: 'oppProbDelta'; value: number; note?: string }
  | { type: 'roleOnly'; role: string; text: string }
  /** 지시 카드 (F.4, C.75i): follow = 엔진 1순위 선택지 그대로(경기 뒤 신뢰 +), solo = 개인 가치 최대 선택지(성공 평점·XP, 실패 신뢰 −), trust = 신뢰 높을 때만 */
  | { type: 'directive'; mode: 'follow' | 'solo' | 'trust'; text: string };

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  group: CardGroup;
  rarity: Rarity;
  /** 쓸 수 있는 장면 (비어 있으면 장면 무관: 패시브·관리) */
  scenes: SceneId[];
  /** 포지션 조건 (비어 있으면 무관). 'DEF' = 수비 포지션 전체 */
  positions: string[];
  /** 능력치 최소값 */
  requires: Partial<Record<FieldAttribute, number>>;
  /** 조건 문구 (표 그대로) */
  condition: string;
  effects: CardEffect[];
  /** 부작용 문구 */
  downside?: string;
  /** 확률 효과 카드만 숙련도 보너스 (F.3.2) */
  mastery: boolean;
  /** 시작 덱 포지션군 (F.0 11번) */
  starter?: Exclude<CardGroup, 'common'>[];
  /** 아직 닫힌 카드 (지금은 없음, C.75i 에서 지시 카드가 열림) */
  inactiveUntil?: '5단계';
}

const R = (v: number) => v / 100;
/** 확률 카드(확률·패시브·콤보·관리의 +%p) 강화 배수 (C.75h, 16.3·F.5 개정): 표 수치 × probMul, 1%p 단위 반올림 */
const P = (v: number) => Math.round(v * BALANCE.cards.probMul) / 100;

/** 공용 18장 */
const COMMON: CardDef[] = [
  { id: 'curler', name: '감아차기', kind: 'play', group: 'common', rarity: 'common', scenes: ['shot'], positions: [], requires: { longShots: 60 },
    condition: '슛 장면, 골에서 16~25 m, 중거리 슛 65 (시작 덱 60)', starter: ['attack'], mastery: false,
    effects: [{ type: 'addOption', base: 'shoot', label: '감아차기', probDelta: R(-5), saveDelta: R(-10), judge: { longShots: 0.7, composure: 0.3 }, ratingSuccess: 0.3, when: { minDist: 16, maxDist: 28 }, note: '중거리 슛 판정' }] },
  { id: 'chip', name: '칩슛', kind: 'play', group: 'common', rarity: 'rare', scenes: ['shot'], positions: [], requires: { ballControl: 70 },
    condition: '슛 장면, GK가 골라인에서 6 m 이상 전진, 볼 컨트롤 70', mastery: false,
    effects: [{ type: 'addOption', base: 'shoot', label: '칩슛', probDelta: R(-10), saveDelta: R(-15), judge: { ballControl: 0.5, composure: 0.5 }, ratingSuccess: 0.3, ratingFail: -0.2, when: { gkOut: 6 }, note: 'GK 키를 넘겨 선방이 어렵다' }] },
  { id: 'noLook', name: '노룩 패스', kind: 'play', group: 'common', rarity: 'rare', scenes: ['keyPass', 'counter'], positions: [], requires: { vision: 75 },
    condition: '패스 장면, 시야 75', mastery: false,
    effects: [{ type: 'addOption', base: 'keyPass', label: '노룩 패스', probDelta: R(-5), failMul: 0.5, ratingSuccess: 0.15, note: '레인 인터셉트 위험 × 0.5' }] },
  { id: 'fakeShot', name: '페이크 슛', kind: 'play', group: 'common', rarity: 'common', scenes: ['shot'], positions: [], requires: { composure: 60 },
    condition: '슛 장면, 3 m 안 수비수, 침착성 60', starter: ['attack'], mastery: false, downside: '실패하면 소유 상실',
    effects: [{ type: 'addOption', base: 'dribble', label: '페이크 슛', probDelta: R(8), ratingSuccess: 0.2, ratingFail: -0.1, when: { nearDef: 3 }, note: '수비수가 블록 동작으로 태클이 늦다' }] },
  { id: 'fkSpecial', name: '프리킥 스페셜', kind: 'setPiece', group: 'common', rarity: 'rare', scenes: ['freeKick'], positions: [], requires: { freeKick: 70 },
    condition: '직접 프리킥, 프리킥 70', mastery: false,
    effects: [{ type: 'addOption', base: 'shoot', label: '벽 넘기기', judge: { freeKick: 1 }, blockMul: 0.5, ratingSuccess: 0.3, note: '벽 블록 확률 × 0.5' }] },
  { id: 'knuckle', name: '무회전 프리킥', kind: 'setPiece', group: 'common', rarity: 'rare', scenes: ['freeKick'], positions: [], requires: { shooting: 75 },
    condition: '직접 프리킥 25 m 이상, 슈팅 75', mastery: false,
    effects: [{ type: 'addOption', base: 'shoot', label: '무회전 프리킥', probDelta: R(-10), saveDelta: R(-15), ratingSuccess: 0.4, when: { minDist: 22 } }] },
  { id: 'penSpecial', name: '페널티 스페셜', kind: 'setPiece', group: 'common', rarity: 'rare', scenes: ['penalty'], positions: [], requires: { composure: 70 },
    condition: 'PK, 침착성 70', mastery: true, effects: [{ type: 'probDelta', option: 'shoot', value: P(10), duration: 'once' }] },
  { id: 'panenka', name: '파넨카', kind: 'setPiece', group: 'common', rarity: 'epic', scenes: ['penalty'], positions: [], requires: {},
    condition: 'PK', mastery: false, downside: '실패 시 평점 −0.8',
    effects: [{ type: 'addOption', base: 'shoot', label: '파넨카', probDelta: R(-10), ratingSuccess: 1.0, ratingFail: -0.8, note: 'GK가 먼저 움직이면(60%) 선방 불가, 위상 보너스' }] },
  { id: 'fkCross', name: '프리킥 크로스', kind: 'setPiece', group: 'common', rarity: 'common', scenes: ['freeKick'], positions: [], requires: { crossing: 65 },
    condition: '측면 프리킥, 크로스 65', mastery: true, effects: [{ type: 'probDelta', option: 'cross', value: P(10), duration: 'once' }] },
  { id: 'spDefense', name: '세트피스 수비', kind: 'setPiece', group: 'common', rarity: 'common', scenes: ['oppCorner', 'oppFreeKick'], positions: [], requires: {},
    condition: '상대 코너/프리킥', mastery: true, effects: [{ type: 'probDelta', option: 'header', value: P(10), duration: 'once' }] },
  { id: 'calmFinish', name: '침착한 마무리', kind: 'passive', group: 'common', rarity: 'common', scenes: [], positions: [], requires: { shooting: 60 },
    condition: '슈팅 65 (시작 덱 60)', starter: ['attack'], mastery: true, effects: [{ type: 'probDelta', option: 'shoot', value: P(5), duration: 'rest', box: true, note: '박스 안 유효 슈팅' }] },
  { id: 'aerialCommand', name: '공중 장악', kind: 'passive', group: 'common', rarity: 'common', scenes: [], positions: [], requires: { heading: 65 },
    condition: '헤더 65', mastery: true, effects: [{ type: 'probDelta', option: 'header', value: P(6), duration: 'rest' }] },
  { id: 'pacing', name: '체력 안배', kind: 'passive', group: 'common', rarity: 'common', scenes: [], positions: [], requires: {},
    condition: '-', mastery: true, downside: '드리블 −3%p',
    effects: [{ type: 'fatigueMult', value: 0.85 }, { type: 'probDelta', option: 'dribble', value: R(-3), duration: 'rest' }] },
  { id: 'momentum', name: '기세', kind: 'combo', group: 'common', rarity: 'rare', scenes: [], positions: [], requires: {},
    condition: '-', mastery: true, effects: [{ type: 'nextSceneBonus', if: '돌파 성공 후 소유 유지', on: 'dribbleWon', option: 'shoot', value: P(8) }] },
  { id: 'counterStart', name: '카운터 시작', kind: 'combo', group: 'common', rarity: 'common', scenes: [], positions: [], requires: {},
    condition: '-', starter: ['midfield'], mastery: true, effects: [{ type: 'nextSceneBonus', if: '태클/인터셉트 성공', on: 'ballWon', option: 'keyPass', value: P(8) }] },
  { id: 'focus', name: '집중', kind: 'manage', group: 'common', rarity: 'common', scenes: [], positions: [], requires: {},
    condition: '-', starter: ['attack', 'midfield', 'defense'], mastery: true, effects: [{ type: 'probDelta', value: P(8), duration: 'once', note: '이번 턴 선택지 하나' }] },
  { id: 'composed', name: '침착', kind: 'manage', group: 'common', rarity: 'common', scenes: [], positions: [], requires: {},
    condition: '-', starter: ['attack', 'midfield', 'defense'], mastery: false, effects: [{ type: 'failureSoftener', value: 0.5 }] },
  { id: 'reset', name: '리셋', kind: 'manage', group: 'common', rarity: 'common', scenes: [], positions: [], requires: {},
    condition: '-', starter: ['attack', 'midfield', 'defense'], mastery: false, effects: [{ type: 'discardDraw', n: 1 }] },
];

/** 공격 8장 (ST/CF/윙/CAM) */
const ATTACK_POS = ['ST', 'CF', 'LW', 'RW', 'LM', 'RM', 'CAM'];
const ATTACK: CardDef[] = [
  { id: 'nearPost', name: '니어 포스트 강슛', kind: 'play', group: 'attack', rarity: 'common', scenes: ['shot'], positions: ATTACK_POS, requires: { shooting: 65 },
    condition: '슛 장면, 측면 깊은 위치(각도 좁음), 슈팅 65', mastery: false,
    effects: [{ type: 'addOption', base: 'shoot', label: '니어 포스트 강슛', probDelta: R(8), saveDelta: R(5), ratingSuccess: 0.2, when: { wide: true }, note: '각도 감점 절반' }] },
  { id: 'turningTouch', name: '터닝 퍼스트 터치', kind: 'play', group: 'attack', rarity: 'common', scenes: ['holdUp'], positions: ATTACK_POS, requires: { ballControl: 60 },
    condition: '등지고 받은 장면, 볼 컨트롤 65 (시작 덱 60)', starter: ['attack'], mastery: false, downside: '실패하면 소유 상실',
    effects: [{ type: 'addOption', base: 'dribble', label: '터닝 퍼스트 터치', judge: { ballControl: 0.5, dribbling: 0.3, agility: 0.2 }, probDelta: R(4), ratingSuccess: 0.2 }] },
  { id: 'lineRunner', name: '오프사이드 라인 타기', kind: 'passive', group: 'attack', rarity: 'rare', scenes: [], positions: ATTACK_POS, requires: { offTheBall: 70 },
    condition: '공격 위치선정 70', mastery: false, effects: [{ type: 'probDelta', value: 0, duration: 'rest', note: '내가 받는 침투 패스의 오프사이드 확률 × 0.7' }] },
  { id: 'dribbleExpert', name: '돌파 전문', kind: 'passive', group: 'attack', rarity: 'common', scenes: [], positions: ATTACK_POS, requires: { dribbling: 60 },
    condition: '드리블 65 (시작 덱 60)', starter: ['attack'], mastery: true, effects: [{ type: 'probDelta', option: 'dribble', value: P(5), duration: 'rest' }] },
  { id: 'divingHeader', name: '다이빙 헤더', kind: 'play', group: 'attack', rarity: 'rare', scenes: ['aerial'], positions: ATTACK_POS, requires: { heading: 65 },
    condition: '낮은 크로스 공중볼, 박스 안, 헤더 65', mastery: false, downside: '착지 후 1.5초 행동 불가',
    effects: [{ type: 'addOption', base: 'header', label: '다이빙 헤더', probDelta: R(8), ratingSuccess: 0.2, ratingFail: -0.1 }] },
  { id: 'rabona', name: '라보나 크로스', kind: 'play', group: 'attack', rarity: 'epic', scenes: ['cross'], positions: ATTACK_POS, requires: { crossing: 75, ballControl: 70 },
    condition: '크로스 장면(약한 발 방향), 크로스 75 + 볼 컨트롤 70', mastery: false,
    effects: [{ type: 'addOption', base: 'cross', label: '라보나 크로스', probDelta: R(-5), edge: R(12), ratingSuccess: 0.3, ratingFail: -0.3, note: '방향을 읽히지 않아 수비 공중볼 불리' }] },
  { id: 'elastico', name: '엘라스티코', kind: 'play', group: 'attack', rarity: 'epic', scenes: ['dribble'], positions: ATTACK_POS, requires: { dribbling: 80 },
    condition: '드리블 1대1, 드리블 80', mastery: false,
    effects: [{ type: 'addOption', base: 'dribble', label: '엘라스티코', probDelta: R(10), ratingSuccess: 0.3, ratingFail: -0.3 }] },
  { id: 'bicycle', name: '바이시클 킥', kind: 'play', group: 'attack', rarity: 'legendary', scenes: ['aerial'], positions: ATTACK_POS, requires: { agility: 75 },
    condition: '박스 안 공중볼, 등지고, 민첩성 75', mastery: false,
    effects: [{ type: 'addOption', base: 'shoot', label: '바이시클 킥', probDelta: R(-15), saveDelta: R(-20), judge: { shooting: 0.5, agility: 0.5 }, ratingSuccess: 1.0, ratingFail: -0.2 }] },
];

/** 미드 8장 (CM/CDM/LM/RM) */
const MID_POS = ['CM', 'CDM', 'LM', 'RM'];
const MIDFIELD: CardDef[] = [
  { id: 'throughBall', name: '스루패스', kind: 'play', group: 'midfield', rarity: 'common', scenes: ['keyPass', 'counter'], positions: MID_POS, requires: { vision: 60 },
    condition: '패스 장면, 수비 사이 침투 동료, 시야 65 (시작 덱 60)', starter: ['midfield'], mastery: false,
    effects: [{ type: 'addOption', base: 'keyPass', label: '스루패스', failMul: 0.7, ratingSuccess: 0.15, note: '레인 위험 × 0.7' }] },
  { id: 'earlyCross', name: '얼리 크로스', kind: 'play', group: 'midfield', rarity: 'common', scenes: ['cross', 'keyPass', 'counter', 'dribble'], positions: MID_POS, requires: { crossing: 60 },
    condition: '측면 상대 진영(최종 3분의 1 이전), 크로스 65 (시작 덱 60)', starter: ['midfield'], mastery: false,
    effects: [{ type: 'addOption', base: 'cross', label: '얼리 크로스', probDelta: R(-5), edge: R(10), ratingSuccess: 0.15, note: '수비 정렬 전이라 공격수 공중볼 유리' }] },
  { id: 'driveForward', name: '전진 운반', kind: 'play', group: 'midfield', rarity: 'common', scenes: ['keyPass', 'counter', 'dribble'], positions: MID_POS, requires: { acceleration: 60 },
    condition: '앞 15 m 빈 공간, 가속 65 (시작 덱 60)', starter: ['midfield'], mastery: false, downside: '실패하면 소유 상실',
    effects: [{ type: 'addOption', base: 'carry', label: '전진 운반 20 m', judge: { acceleration: 0.5, dribbling: 0.5 }, carry: 20, ratingSuccess: 0.15, note: '압박 접근 시 중단' }] },
  { id: 'marseille', name: '마르세유 턴', kind: 'play', group: 'midfield', rarity: 'rare', scenes: ['dribble', 'keyPass'], positions: MID_POS, requires: { agility: 70 },
    condition: '압박받는 소유, 민첩성 70', mastery: false,
    effects: [{ type: 'addOption', base: 'dribble', label: '마르세유 턴', probDelta: R(6), judge: { agility: 0.6, ballControl: 0.4 }, ratingSuccess: 0.2, ratingFail: -0.2, note: '압박 수비수 1명 제침' }] },
  { id: 'secondBallVolley', name: '세컨드볼 발리', kind: 'play', group: 'midfield', rarity: 'rare', scenes: ['rebound', 'shot'], positions: MID_POS, requires: { longShots: 70 },
    condition: '박스 밖으로 흐른 공, 중거리 슛 70', mastery: false,
    effects: [{ type: 'addOption', base: 'shoot', label: '세컨드볼 발리', probDelta: R(-10), saveDelta: R(-10), ratingSuccess: 0.4 }] },
  { id: 'tempo', name: '템포 조절', kind: 'passive', group: 'midfield', rarity: 'common', scenes: [], positions: MID_POS, requires: { shortPassing: 60 },
    condition: '숏패스 60', starter: ['midfield'], mastery: true,
    effects: [{ type: 'probDelta', option: 'safe', value: P(5), duration: 'rest' }, { type: 'fatigueMult', value: 0.95 }] },
  { id: 'midControl', name: '중원 장악', kind: 'passive', group: 'midfield', rarity: 'common', scenes: [], positions: ['CM', 'CDM'], requires: {},
    condition: 'CM/CDM', mastery: true, effects: [{ type: 'probDelta', option: 'tackle', value: P(5), duration: 'rest', note: '중원 경합·탈취' }] },
  { id: 'chainPress', name: '연속 압박', kind: 'combo', group: 'midfield', rarity: 'common', scenes: [], positions: MID_POS, requires: { workRate: 60 },
    condition: '노력 60', mastery: true, effects: [{ type: 'nextSceneBonus', if: '압박 성공', on: 'tackleWon', option: 'tackle', value: P(8) }] },
];

/** 수비 8장 (CB/풀백) */
const DEF_POS = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
const DEFENSE: CardDef[] = [
  { id: 'slideTackle', name: '슬라이딩 태클', kind: 'play', group: 'defense', rarity: 'common', scenes: ['duel', 'press'], positions: DEF_POS, requires: { tackling: 60 },
    condition: '수비 1대1, 태클 60', starter: ['defense'], mastery: false, downside: '파울 확률 × 2, 경고 확률 × 1.5',
    effects: [{ type: 'addOption', base: 'tackle', label: '슬라이딩 태클', probDelta: R(10), foulMul: 2, ratingSuccess: 0.2 }] },
  { id: 'bodyBlock', name: '몸으로 막기', kind: 'play', group: 'defense', rarity: 'common', scenes: ['oppShot'], positions: DEF_POS, requires: {},
    condition: '상대 슈팅(내가 콘 안)', starter: ['defense'], mastery: false, downside: '부상 판정 +3%',
    effects: [{ type: 'addOption', base: 'block', label: '몸으로 막기', probDelta: R(15), ratingSuccess: 0.2 }] },
  { id: 'switchLong', name: '롱패스 전환', kind: 'play', group: 'defense', rarity: 'common', scenes: ['keyPass'], positions: DEF_POS, requires: { longPassing: 60 },
    condition: '수비 지역 소유, 반대편 빈 동료, 롱패스 65 (시작 덱 60)', starter: ['defense'], mastery: false, downside: '실패하면 소유 상실',
    effects: [{ type: 'addOption', base: 'longPass', label: '롱패스 전환', probDelta: R(5), ratingSuccess: 0.15, when: { ownHalf: true }, note: '키패스 아님, 위치 가치 증가' }] },
  { id: 'spHeader', name: '세트피스 가담 헤더', kind: 'play', group: 'defense', rarity: 'common', scenes: ['corner', 'aerial'], positions: DEF_POS, requires: { heading: 60 },
    condition: '공격 코너, 헤더 65 (시작 덱 60)', starter: ['defense'], mastery: false,
    effects: [{ type: 'addOption', base: 'header', label: '세트피스 가담 헤더', probDelta: R(5), ratingSuccess: 0.3 }] },
  { id: 'ironWall', name: '철벽 수비', kind: 'passive', group: 'defense', rarity: 'common', scenes: [], positions: DEF_POS, requires: {},
    condition: '수비 포지션', starter: ['defense'], mastery: true, effects: [{ type: 'probDelta', option: 'tackle', value: P(5), duration: 'rest', note: '수비 1대1·태클' }] },
  { id: 'offsideTrap', name: '오프사이드 트랩 지휘', kind: 'play', group: 'defense', rarity: 'rare', scenes: ['lineCall'], positions: ['CB'], requires: { defensivePositioning: 70 },
    condition: '상대 전진 패스 준비 장면(lineCall), CB, 수비 포지셔닝 70', mastery: false, downside: '라인이 어긋나면 뒷공간 허용',
    effects: [{ type: 'addOption', base: 'lineCall', label: '라인 2 m 올리기', judge: { defensivePositioning: 1 }, ratingSuccess: 0.2, ratingFail: -0.3 }] },
  { id: 'coverSprint', name: '커버링 질주', kind: 'play', group: 'defense', rarity: 'rare', scenes: ['lineCall', 'duel'], positions: DEF_POS, requires: { pace: 70 },
    condition: '상대가 뒷공간 침투, 속도 70', mastery: false, downside: '실패 시 결정적 기회 허용',
    effects: [{ type: 'addOption', base: 'race', label: '커버링 질주', judge: { pace: 0.6, acceleration: 0.4 }, ratingSuccess: 0.1, note: '따라잡아 태클 (속도·가속 판정)' }] },
  { id: 'tacticalFoul', name: '전술적 파울', kind: 'play', group: 'defense', rarity: 'rare', scenes: ['press', 'counter', 'duel'], positions: DEF_POS, requires: {},
    condition: '상대 역습 시작(하프라인 근처), 수비 포지션', mastery: false, downside: '경고 확률 70%, 경고 누적이면 퇴장 위험',
    effects: [{ type: 'addOption', base: 'foul', label: '파울로 끊기', probDelta: 0, ratingSuccess: 0.05, note: '성공 90%, 경고 70%' }] },
];

/** 역할 시그니처 31장: src/signatureCards.ts 의 문구 데이터 + 장면 (E.6 표) */
const SIG_SCENES: Record<string, SceneId[]> = {
  classicWinger: ['dribble', 'cross'], wingForward: ['shot'], crackWinger: ['dribble'], raumdeuter: ['shot', 'rebound'], wideMid: ['duel'],
  poacher: ['shot'], targetMan: ['holdUp'], falseNine: ['holdUp', 'keyPass'], advancedForward: ['keyPass', 'shot'],
  classic10: ['keyPass'], shadowStriker: ['shot', 'keyPass'], freeRole: ['keyPass'], boxCrasher: ['rebound'], enganche: ['keyPass'],
  boxToBox: ['counter'], deepPlaymaker: ['keyPass'], mezzala: ['shot'], carrier: ['dribble'], holdingCM: ['lineCall'],
  anchor: ['lineCall'], ballWinner: ['duel', 'press'], regista: ['keyPass'], halfBack: ['keyPass'],
  attackingFullback: ['cross'], defensiveFullback: ['duel'], invertedFullback: ['keyPass'], completeWingback: ['cross'],
  stopper: ['duel', 'press'], ballPlayingCB: ['keyPass'], coverCB: ['duel'], libero: ['counter', 'dribble'],
};
// C.36: 커버 슬라이드·라인 사이 차단은 lineCall 정지가 아직 없어 수비 1대1·압박 장면에서 쓴다 (부록 C.36 남은 일)
SIG_SCENES.holdingCM = ['duel', 'press'];
SIG_SCENES.anchor = ['duel', 'press'];

/** 시그니처 효과 (E.6 표 문구 → 효과 스키마). 모두 4번째 선택지(행동 변형)이고 보정은 ±15%p 안 */
type Sig = Omit<Extract<CardEffect, { type: 'addOption' }>, 'type' | 'label'>;
const SIG_FX: Record<string, Sig> = {
  classicWinger: { base: 'cross', probDelta: R(8), edge: R(6), ratingSuccess: 0.1 },
  wingForward: { base: 'shoot', probDelta: R(5), judge: { longShots: 0.5, shooting: 0.5 }, ratingSuccess: 0.15 },
  crackWinger: { base: 'dribble', probDelta: R(5), ratingSuccess: 0.1 },
  raumdeuter: { base: 'shoot', probDelta: R(6), ratingSuccess: 0.1 },
  wideMid: { base: 'tackle', probDelta: R(10), ratingSuccess: 0.05 },
  poacher: { base: 'shoot', probDelta: R(5), judge: { composure: 0.5, bigMatch: 0.5 }, ratingSuccess: 0.1 },
  targetMan: { base: 'holdup', probDelta: R(10), ratingSuccess: 0.05 },
  falseNine: { base: 'pass', probDelta: R(10), ratingSuccess: 0.05 },
  advancedForward: { base: 'shoot', probDelta: R(5), saveDelta: R(-5), ratingSuccess: 0.1 },
  classic10: { base: 'keyPass', failMul: 0.6, ratingSuccess: 0.1 },
  shadowStriker: { base: 'shoot', probDelta: R(6), ratingSuccess: 0.1 },
  freeRole: { base: 'pass', probDelta: R(8), ratingSuccess: 0.05 },
  boxCrasher: { base: 'shoot', probDelta: R(10), ratingSuccess: 0.1 },
  enganche: { base: 'pass', probDelta: R(10), failMul: 0.7, ratingSuccess: 0.05 },
  boxToBox: { base: 'carry', probDelta: R(8), carry: 30, ratingSuccess: 0.05 },
  deepPlaymaker: { base: 'longPass', probDelta: R(10), ratingSuccess: 0.05 },
  mezzala: { base: 'shoot', probDelta: R(8), ratingSuccess: 0.1 },
  carrier: { base: 'dribble', probDelta: R(8), ratingSuccess: 0.05 },
  holdingCM: { base: 'tackle', probDelta: R(8), ratingSuccess: 0.05 },
  anchor: { base: 'tackle', probDelta: R(10), ratingSuccess: 0.05 },
  ballWinner: { base: 'tackle', probDelta: R(10), foulMul: 1.3, ratingSuccess: 0.05 },
  regista: { base: 'keyPass', probDelta: R(10), ratingSuccess: 0.05 },
  halfBack: { base: 'pass', probDelta: R(8), ratingSuccess: 0.05 },
  attackingFullback: { base: 'cross', probDelta: R(8), ratingSuccess: 0.05 },
  defensiveFullback: { base: 'tackle', probDelta: R(10), ratingSuccess: 0.05 },
  invertedFullback: { base: 'keyPass', probDelta: R(8), ratingSuccess: 0.05 },
  completeWingback: { base: 'cross', probDelta: R(6), edge: R(5), ratingSuccess: 0.05 },
  stopper: { base: 'tackle', probDelta: R(10), foulMul: 1.2, ratingSuccess: 0.05 },
  ballPlayingCB: { base: 'keyPass', probDelta: R(10), ratingSuccess: 0.05 },
  coverCB: { base: 'tackle', probDelta: R(10), foulMul: 1.5, ratingSuccess: 0.05 },
  libero: { base: 'carry', probDelta: R(8), carry: 25, ratingSuccess: 0.05 },
};
const SIGNATURE: CardDef[] = SIGNATURE_CARDS.map((c) => ({
  id: c.id, name: c.name, kind: 'signature' as const, group: 'common' as const, rarity: 'rare' as const, scenes: SIG_SCENES[c.role] ?? [], positions: [],
  requires: {}, condition: `${c.condition} (역할 ${c.unlockMatches}경기 출전으로 해금)`, mastery: true,
  effects: [{ type: 'roleOnly' as const, role: c.role, text: c.effect }, { type: 'addOption' as const, label: c.name, ...SIG_FX[c.role]!, note: c.effect }],
}));

/** 지시 3장 (D.11 6번, C.75i): 직접 모드 소유 결정 순간에만. 신뢰도·평점·XP 보상은 경기 뒤 (BALANCE.cards.directive) */
const DIRECTIVE: CardDef[] = [
  { id: 'dirFollow', name: '지시 이행', kind: 'directive', group: 'common', rarity: 'common', scenes: [], positions: [], requires: {},
    condition: '엔진이 고를 1순위 선택지대로', mastery: false, effects: [{ type: 'directive', mode: 'follow', text: '4번째 선택지 "지시 이행" · 경기 뒤 신뢰도 +1 (경기당 +3까지)' }] },
  { id: 'dirSolo', name: '독단', kind: 'directive', group: 'common', rarity: 'common', scenes: [], positions: [], requires: {},
    condition: '1순위가 아닌 개인 플레이(슛·돌파)', mastery: false, effects: [{ type: 'directive', mode: 'solo', text: '4번째 선택지 "독단" · 성공 시 평점 +0.8, XP × 1.3 / 실패 시 신뢰도 −5' }] },
  { id: 'dirTrust', name: '감독의 신뢰', kind: 'directive', group: 'common', rarity: 'common', scenes: [], positions: [], requires: {},
    condition: '감독 신뢰도 70 이상일 때만', mastery: false,
    effects: [{ type: 'directive', mode: 'trust', text: '' }, { type: 'probDelta', value: R(5), duration: 'once' }] },
];

export const CARDS: readonly CardDef[] = [...COMMON, ...ATTACK, ...MIDFIELD, ...DEFENSE, ...SIGNATURE, ...DIRECTIVE];

export function cardById(id: string): CardDef | undefined {
  return CARDS.find((c) => c.id === id);
}

/** 시작 덱 8장 (F.0 11번): 포지션군의 일반 카드 */
export function starterDeck(group: Exclude<CardGroup, 'common'>): CardDef[] {
  return CARDS.filter((c) => c.starter?.includes(group));
}
