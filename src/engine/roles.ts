// 역할 31개 (부록 E.6 표, D.13, E3.7). dx, dy 는 정규화 오프셋, run/drop/press 는 0~1, pref 는 온더볼 효용 배수(층 3, E.1.1),
// modules 는 공용 움직임 모듈 ①~④. 역할은 "어디로 가고 무엇을 선호하나"만 바꾸고 성공 확률은 바꾸지 않는다 (E.1.1 덮어쓰기 금지)

import type { FieldAttributes } from '../attributes';
import type { Position } from '../types';

export interface RolePrefs {
  shoot: number;
  pass: number;
  dribble: number;
  cross: number;
  /** 안전 패스(뒤/옆) */
  safe: number;
  /** 전진 패스 */
  forward: number;
  clear: number;
  /** 크로스 수신/헤더 */
  header: number;
  /** 유지·버티기 (E3.7) */
  hold: number;
  /** 몰고 가기 (수비수가 없는 운반, E3.7) */
  carry: number;
  /** 롱패스 (E3.7) */
  long: number;
  /** 중거리 슛 (박스 밖, E3.7) */
  longShot: number;
}

/**
 * 공용 움직임 모듈 (E.6 D.13): ① 빈 공간 찾기 ② 줄 사이 이동 ③ 공 요구·소유 성향 ④ 수비 의무 면제와 커버 재배분
 */
export type RoleModule = 'space' | 'between' | 'demand' | 'exempt';

export interface Role {
  id: string;
  dx: number;
  dy: number;
  run: number;
  drop: number;
  press: number;
  pref: RolePrefs;
  modules: readonly RoleModule[];
}

const p = (o: Partial<RolePrefs> = {}): RolePrefs => ({
  shoot: 1, pass: 1, dribble: 1, cross: 1, safe: 1, forward: 1, clear: 1, header: 1, hold: 1, carry: 1, long: 1, longShot: 1, ...o,
});
const r = (id: string, dx: number, dy: number, run: number, drop: number, press: number, pref: RolePrefs, modules: RoleModule[] = []): Role => ({
  id, dx, dy, run, drop, press, pref, modules,
});

/** 역할 표 (E.6). 값은 초안이고 역할 반응 점검으로 보정한다 */
export const ROLES: Record<string, Role> = {
  // 윙 (LW, RW, LM, RM)
  classicWinger: r('classicWinger', 0, 0.35, 0.5, 0.1, 0.4, p({ cross: 1.4, dribble: 1.1 })),
  wingForward: r('wingForward', 0.05, -0.1, 0.8, 0.1, 0.4, p({ shoot: 1.3 })),
  crackWinger: r('crackWinger', 0.02, 0.15, 0.3, 0.4, 0.2, p({ dribble: 1.5 }), ['demand', 'exempt']),
  raumdeuter: r('raumdeuter', 0.05, -0.2, 0.7, 0.1, 0.5, p({ shoot: 1.2, dribble: 0.6 }), ['space']),
  wideMid: r('wideMid', -0.03, 0.25, 0.3, 0.3, 0.8, p({ cross: 1.1 })),
  // ST (ST, CF)
  poacher: r('poacher', 0.04, 0, 0.7, 0, 0.3, p({ shoot: 1.4, dribble: 0.8 })),
  targetMan: r('targetMan', 0, 0, 0.45, 0.3, 0.4, p({ header: 1.4, hold: 1.2 })),
  falseNine: r('falseNine', -0.1, 0, 0.35, 0.5, 0.5, p({ pass: 1.3, shoot: 0.9 }), ['between']),
  advancedForward: r('advancedForward', 0.05, 0, 0.9, 0, 0.4, p({ shoot: 1.2 })),
  // CAM
  classic10: r('classic10', 0, 0, 0.3, 0.6, 0.3, p({ pass: 1.4, forward: 1.1 })),
  shadowStriker: r('shadowStriker', 0.06, 0, 0.8, 0.1, 0.4, p({ shoot: 1.3 }), ['space']),
  freeRole: r('freeRole', 0, 0, 0.5, 0.5, 0.2, p({ dribble: 1.2, pass: 1.2 }), ['space', 'exempt']),
  boxCrasher: r('boxCrasher', 0.04, 0, 0.7, 0.2, 0.5, p({ shoot: 1.1, longShot: 1.1 })),
  enganche: r('enganche', -0.02, 0, 0.1, 0.4, 0.1, p({ hold: 1.3, pass: 1.3 }), ['demand', 'exempt']),
  // CM
  boxToBox: r('boxToBox', 0, 0, 0.6, 0.4, 0.8, p()),
  deepPlaymaker: r('deepPlaymaker', -0.06, 0, 0.25, 0.6, 0.4, p({ pass: 1.4, long: 1.2 })),
  mezzala: r('mezzala', 0.06, 0.15, 0.6, 0.2, 0.5, p({ shoot: 1.1, dribble: 1.1 })),
  carrier: r('carrier', 0, 0, 0.3, 0.4, 0.5, p({ carry: 1.4 })),
  holdingCM: r('holdingCM', -0.06, 0, 0.1, 0.3, 0.7, p({ safe: 1.2 })),
  // CDM
  anchor: r('anchor', -0.04, 0, 0.1, 0.4, 0.6, p({ safe: 1.2 })),
  ballWinner: r('ballWinner', 0, 0, 0.2, 0.2, 0.9, p()),
  regista: r('regista', -0.06, 0, 0, 0.9, 0.1, p({ pass: 1.4, long: 1.3 }), ['demand', 'exempt']),
  halfBack: r('halfBack', -0.1, 0, 0, 0.6, 0.4, p({ safe: 1.2 }), ['between']),
  // 풀백 (LB, RB, LWB, RWB)
  attackingFullback: r('attackingFullback', 0.1, 0.2, 0.7, 0.1, 0.5, p({ cross: 1.4 })),
  defensiveFullback: r('defensiveFullback', -0.04, 0, 0.2, 0.2, 0.7, p({ safe: 1.2 })),
  invertedFullback: r('invertedFullback', 0.02, -0.3, 0.3, 0.6, 0.5, p({ pass: 1.2 }), ['between']),
  completeWingback: r('completeWingback', 0.14, 0.25, 0.8, 0.1, 0.6, p({ cross: 1.3, dribble: 1.1 })),
  // CB
  stopper: r('stopper', 0.02, 0, 0, 0, 0.7, p({ clear: 1.2 })),
  ballPlayingCB: r('ballPlayingCB', -0.02, 0, 0.1, 0.2, 0.5, p({ forward: 1.3 })),
  coverCB: r('coverCB', -0.06, 0, 0, 0, 0.4, p({ safe: 1.2 })),
  libero: r('libero', 0, 0, 0.2, 0.3, 0.4, p({ carry: 1.2, pass: 1.2 }), ['between']),
  goalkeeper: r('goalkeeper', 0, 0, 0, 0, 0, p()),
};

/** 포지션군별로 고를 수 있는 역할 (E.6 표 순서) */
export const ROLE_OPTIONS: Record<string, string[]> = {
  GK: ['goalkeeper'],
  WING: ['classicWinger', 'wingForward', 'crackWinger', 'raumdeuter', 'wideMid'],
  ST: ['poacher', 'targetMan', 'falseNine', 'advancedForward'],
  CAM: ['classic10', 'shadowStriker', 'freeRole', 'boxCrasher', 'enganche'],
  CM: ['boxToBox', 'deepPlaymaker', 'mezzala', 'carrier', 'holdingCM'],
  CDM: ['anchor', 'ballWinner', 'regista', 'halfBack'],
  FB: ['attackingFullback', 'defensiveFullback', 'invertedFullback', 'completeWingback'],
  CB: ['stopper', 'ballPlayingCB', 'coverCB', 'libero'],
};

/** 역할 이름 (E.6, E3.7 새 이름) */
export const ROLE_NAMES_KO: Record<string, string> = {
  classicWinger: '정통 윙어', wingForward: '윙포워드', crackWinger: '크랙형 윙어', raumdeuter: '라움도이터', wideMid: '와이드 미드필더',
  poacher: '포처', targetMan: '타겟맨', falseNine: '펄스 나인', advancedForward: '침투형 스트라이커',
  classic10: '클래식 10번', shadowStriker: '섀도 스트라이커', freeRole: '프리롤', boxCrasher: '박스 침투형', enganche: '엔간체',
  boxToBox: '박스투박스', deepPlaymaker: '딥라잉 플레이메이커', mezzala: '메짤라', carrier: '캐리어', holdingCM: '홀딩 CM',
  anchor: '앵커', ballWinner: '볼 위너', regista: '레지스타', halfBack: '하프백',
  attackingFullback: '공격적 풀백', defensiveFullback: '수비형 풀백', invertedFullback: '인버티드 풀백', completeWingback: '컴플리트 윙백',
  stopper: '스토퍼', ballPlayingCB: '볼 플레잉 CB', coverCB: '커버 CB', libero: '리베로', goalkeeper: '골키퍼',
};

/** 역할 설명 (역할 고르기 바텀시트) */
export const ROLE_DESC_KO: Record<string, string> = {
  classicWinger: '터치라인을 타고 올라가 크로스를 올려요.', wingForward: '안쪽으로 파고들며 뒷공간 침투와 슈팅을 노려요.',
  crackWinger: '공을 달라고 하고 1대1로 계속 제쳐요. 수비 복귀는 덜 해요.', raumdeuter: '수비 사이 빈 공간을 찾아 박스 안으로 스며들어요.',
  wideMid: '측면을 오르내리며 압박과 복귀를 성실히 해요.',
  poacher: '박스 안에 머물며 마무리에 집중해요.', targetMan: '앞에서 버티며 공중볼과 롱볼을 받아 줘요.',
  falseNine: '상대 수비와 미드 사이로 내려와 받아 연결해요.', advancedForward: '수비 라인을 계속 깨고 뒷공간으로 달려요.',
  classic10: '공을 받아 킬패스로 기회를 만들어요.', shadowStriker: '공격수 뒤 빈 공간에서 박스로 뛰어들어요.',
  freeRole: '자리에 얽매이지 않고 빈 공간을 찾아 다녀요. 수비 부담이 적어요.', boxCrasher: '늦게 박스로 침투하고 중거리도 노려요.',
  enganche: '라인 사이에 서서 공을 요구하고 지켜요. 수비 부담이 적어요.',
  boxToBox: '공수 양쪽을 오가며 많이 뛰어요.', deepPlaymaker: '뒤에서 공을 받아 패스로 경기를 조율해요.',
  mezzala: '하프스페이스로 올라가 드리블과 슈팅을 노려요.', carrier: '공을 몰고 중원을 전진해요.',
  holdingCM: '뒤에 남아 안전하게 연결하고 길목을 막아요.',
  anchor: '수비 라인 앞을 지키며 자리를 비우지 않아요.', ballWinner: '적극적으로 압박해 공을 뺏어요.',
  regista: '깊은 곳에서 공을 요구해 긴 패스로 전개해요. 압박 의무는 적어요.', halfBack: '빌드업 때 센터백 사이로 내려가 3백을 만들어요.',
  attackingFullback: '측면을 높이 올라가 크로스를 올려요.', defensiveFullback: '뒤에 남아 측면 수비에 집중해요.',
  invertedFullback: '빌드업 때 안쪽 미드 줄로 좁혀 들어와요.', completeWingback: '측면 끝까지 오르내리며 공격에 가담해요.',
  stopper: '앞으로 나가 상대 공격수와 맞붙어요.', ballPlayingCB: '뒤에서 전진 패스로 빌드업을 시작해요.',
  coverCB: '뒤에 처져 뒷공간을 덮어요.', libero: '공을 몰고 중원 줄까지 올라가 빌드업에 가담해요.', goalkeeper: '골문을 지켜요.',
};

/** 역할 적합도 능력치 (E.6 표, 18.1): 전술 화면 기본 역할 추천과 평점/XP 보너스 */
export const ROLE_KEYS: Record<string, (keyof FieldAttributes)[]> = {
  classicWinger: ['crossing', 'pace', 'dribbling'], wingForward: ['offTheBall', 'acceleration', 'shooting'],
  crackWinger: ['dribbling', 'agility', 'ballControl'], raumdeuter: ['offTheBall', 'composure', 'vision'],
  wideMid: ['stamina', 'workRate', 'crossing'],
  poacher: ['shooting', 'offTheBall', 'composure'], targetMan: ['heading', 'strength', 'jumping'],
  falseNine: ['shortPassing', 'vision', 'ballControl'], advancedForward: ['pace', 'acceleration', 'offTheBall'],
  classic10: ['vision', 'shortPassing', 'composure'], shadowStriker: ['offTheBall', 'shooting', 'acceleration'],
  freeRole: ['dribbling', 'vision', 'ballControl'], boxCrasher: ['offTheBall', 'stamina', 'shooting'],
  enganche: ['ballControl', 'vision', 'composure'],
  boxToBox: ['stamina', 'workRate', 'tackling'], deepPlaymaker: ['vision', 'longPassing', 'shortPassing'],
  mezzala: ['dribbling', 'offTheBall', 'longShots'], carrier: ['dribbling', 'acceleration', 'strength'],
  holdingCM: ['defensivePositioning', 'interception', 'tackling'],
  anchor: ['defensivePositioning', 'interception', 'marking'], ballWinner: ['tackling', 'workRate', 'stamina'],
  regista: ['vision', 'longPassing', 'composure'], halfBack: ['shortPassing', 'defensivePositioning', 'composure'],
  attackingFullback: ['crossing', 'stamina', 'pace'], defensiveFullback: ['marking', 'tackling', 'defensivePositioning'],
  invertedFullback: ['shortPassing', 'vision', 'defensivePositioning'], completeWingback: ['stamina', 'crossing', 'pace'],
  stopper: ['tackling', 'strength', 'heading'], ballPlayingCB: ['shortPassing', 'longPassing', 'composure'],
  coverCB: ['pace', 'defensivePositioning', 'tackling'], libero: ['ballControl', 'vision', 'defensivePositioning'],
};

/** E3.6 까지의 역할 id → 새 id (E.21 1번, 세이브 변환). 나머지 id 는 그대로 */
export const LEGACY_ROLE_IDS: Record<string, string> = {
  winger: 'classicWinger', insideForward: 'wingForward', linkUp: 'falseNine', playmaker: 'classic10', advanced8: 'mezzala', dlpDm: 'regista',
};

export function migrateRoleId(id: string | null): string | null {
  return id === null ? null : LEGACY_ROLE_IDS[id] ?? id;
}

export function hasModule(role: Role, m: RoleModule): boolean {
  return role.modules.includes(m);
}

/** 역할을 주지 않으면 포지션과 능력치로 고른다 */
export function defaultRole(pos: Position, a: FieldAttributes): Role {
  switch (pos) {
    case 'GK': return ROLES.goalkeeper!;
    case 'ST': return a.heading + a.strength > a.shooting + a.acceleration + 5 ? ROLES.targetMan! : ROLES.poacher!;
    case 'CF': return ROLES.falseNine!;
    case 'LW': case 'RW': return a.shooting >= a.crossing ? ROLES.wingForward! : ROLES.classicWinger!;
    case 'LM': case 'RM': return ROLES.classicWinger!;
    case 'CAM': return a.shooting > a.vision ? ROLES.shadowStriker! : ROLES.classic10!;
    case 'CM': return a.shortPassing + a.vision >= 160 ? ROLES.deepPlaymaker! : ROLES.boxToBox!;
    case 'CDM': return a.tackling + a.interception >= 160 ? ROLES.ballWinner! : ROLES.anchor!;
    case 'LB': case 'RB': case 'LWB': case 'RWB': return ROLES.attackingFullback!;
    case 'CB': return a.longPassing >= 70 ? ROLES.ballPlayingCB! : ROLES.stopper!;
  }
}

export function roleById(id: string | undefined): Role | undefined {
  return id ? ROLES[LEGACY_ROLE_IDS[id] ?? id] : undefined;
}
