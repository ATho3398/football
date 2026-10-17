// 태그 (pending 47 2·62.4·66, 부록 C.45): 생성 때 고르는 장단점과 플레이하며 붙고 떨어지는 커리어 태그를 하나로.
// 태그 하나 = 이름·설명·효과(BALANCE.tags.effects)·획득 경로(생성 / 플레이 / 둘 다)·지속(영구 / 해제형 + 해제 조건)·생성 비용(영구 ×1.5, 해제형 ×0.6).
// 효과는 이미 있는 시스템(부상·폼·피로·XP·연봉·경고·약발)에 걸고, 아직 없는 시스템(감독 신뢰도 5-1, 생활·인터뷰 5-2, 해외 이적 6단계)은 훅만.
// 플레이 중 자연 발생 태그와 "둘 다" 태그의 플레이 획득 판정·노익장 효과는 34c C.47

import { BALANCE } from './config/balance';
import type { Rng } from './rng';

export const TAG_IDS = [
  // 단점 (생성·둘 다)
  'glass', 'troublemaker', 'rollercoaster', 'slowRecovery', 'managerSensitive', 'poorNegotiator', 'homesick', 'mediaShy', 'weakFootOne',
  // 장점 (생성·둘 다)
  'ironMan', 'consistent', 'resilient', 'professional', 'starQuality', 'linguist', 'leader', 'twoFooted',
  // 플레이 전용
  'evergreen', 'lateBloomer', 'bigGame', 'academy', 'oneClubMan', 'eternal', 'homeChoice', 'loyalReturn', 'releasedPain',
  // 플레이 중 자연 발생 (pending 65, C.47)
  'starPlayer', 'wonderkid', 'wonderkidFormer', 'derbyHero', 'superSub', 'lateShow', 'goalMachine', 'assistKing', 'cleanSheet',
  'setPiece', 'everPresent', 'gentleman', 'exClubKiller', 'journeyman', 'cultHero', 'traitor',
] as const;
export type TagId = (typeof TAG_IDS)[number];

export interface TagDef {
  id: TagId;
  kind: 'pro' | 'con' | 'story';
  ko: string;
  desc: string;
  /** 획득 경로 */
  source: 'create' | 'both' | 'play';
  /** 해제형으로 붙으면 이 조건에 떨어진다 (시즌 끝 판정) */
  removeDesc?: string;
  /** 아직 없는 시스템이라 효과가 그 단계에서 붙는다 */
  hook?: string;
  excludes?: TagId[];
}

export const TAGS: Readonly<Record<TagId, TagDef>> = {
  glass: { id: 'glass', kind: 'con', ko: '유리몸', desc: '부상 확률 ×1.5', source: 'both', removeDesc: '한 시즌 부상 없음', excludes: ['ironMan'] },
  troublemaker: { id: 'troublemaker', kind: 'con', ko: '문제아', desc: '경고·퇴장 ×1.4', source: 'both', removeDesc: '한 시즌 퇴장 0·경고 3장 이하' },
  rollercoaster: { id: 'rollercoaster', kind: 'con', ko: '롤러코스터', desc: '폼 변동 ×1.5', source: 'both', removeDesc: '20경기 이상 뛴 시즌에 부진 연속 감점 없음', excludes: ['consistent'] },
  slowRecovery: { id: 'slowRecovery', kind: 'con', ko: '회복 느림', desc: '피로 회복 −20%', source: 'both', removeDesc: '한 시즌 선발 30경기 이상', excludes: ['resilient'] },
  managerSensitive: { id: 'managerSensitive', kind: 'con', ko: '감독 불화 민감', desc: '감독 신뢰도가 떨어지면 컨디션이 크게 −', source: 'create', hook: '5-1 감독 신뢰도' },
  poorNegotiator: { id: 'poorNegotiator', kind: 'con', ko: '협상 서툼', desc: '연봉 협상 1회만', source: 'create', hook: '연봉 협상' },
  homesick: { id: 'homesick', kind: 'con', ko: '향수병', desc: '해외 적응 기간 ×2', source: 'create', hook: '5-2 생활·6단계 해외 이적', excludes: ['linguist'] },
  mediaShy: { id: 'mediaShy', kind: 'con', ko: '언론 울렁증', desc: '인터뷰 이벤트 부정 결과 ↑', source: 'create', hook: '5-2 이벤트·인터뷰' },
  weakFootOne: { id: 'weakFootOne', kind: 'con', ko: '약발 1', desc: '약발 1로 시작 (훈련·포인트로 올릴 수 있음)', source: 'create', excludes: ['twoFooted'] },
  ironMan: { id: 'ironMan', kind: 'pro', ko: '철강왕', desc: '부상 확률 ×0.6', source: 'both', removeDesc: '한 시즌 부상 2번 이상 또는 시즌 아웃', excludes: ['glass'] },
  consistent: { id: 'consistent', kind: 'pro', ko: '꾸준함', desc: '폼 변동 ×0.7', source: 'both', removeDesc: '부진 연속 감점을 받은 시즌', excludes: ['rollercoaster'] },
  resilient: { id: 'resilient', kind: 'pro', ko: '회복력', desc: '피로 회복 +20%', source: 'both', removeDesc: '31세가 넘은 시즌 끝', excludes: ['slowRecovery'] },
  professional: { id: 'professional', kind: 'pro', ko: '프로 정신', desc: '훈련 XP +10%', source: 'both', removeDesc: '시즌 훈련 XP 60 미만' },
  starQuality: { id: 'starQuality', kind: 'pro', ko: '스타 기질', desc: '연봉·몸값 +10%', source: 'create' },
  linguist: { id: 'linguist', kind: 'pro', ko: '언어 천재', desc: '해외 적응 기간 ×0.5', source: 'create', hook: '5-2 생활·6단계 해외 이적', excludes: ['homesick'] },
  leader: { id: 'leader', kind: 'pro', ko: '리더', desc: '팀 불화 이벤트 ↓', source: 'create', hook: '5-2 이벤트' },
  twoFooted: { id: 'twoFooted', kind: 'pro', ko: '양발잡이', desc: '약발 4로 시작', source: 'create', excludes: ['weakFootOne'] },
  evergreen: { id: 'evergreen', kind: 'pro', ko: '노익장', desc: '30세 이후 시즌 평점 7.0+ 또는 OVR 80+ 유지 · 조건을 채운 시즌 노화 하락 ×0.7', source: 'play', removeDesc: '2시즌 연속 시즌 평점 6.5 미만' },
  lateBloomer: { id: 'lateBloomer', kind: 'pro', ko: '늦게 핀 꽃', desc: '한 포지션 3시즌+ 뒤 포지션을 바꾸고 더 잘된 선수 · 신체·기술멘탈 첫 노화 1회 면제', source: 'play' },
  bigGame: { id: 'bigGame', kind: 'pro', ko: '빅매치 체질', desc: '더비·상위 6팀 상대 10경기+ 평균 평점이 평소보다 +0.4 · 그런 경기 폼 +0.1', source: 'play', removeDesc: '차이가 +0.2 아래로' },
  starPlayer: { id: 'starPlayer', kind: 'pro', ko: '스타 플레이어', desc: '위상 상위권 + 시즌 평점 7.3+ 2시즌 연속 · 제안 연봉 +10%', source: 'play', removeDesc: '2시즌 연속 시즌 평점 6.8 미만', hook: '빅클럽 관심·언론 이벤트 5-2' },
  wonderkid: { id: 'wonderkid', kind: 'pro', ko: '원더키드', desc: '20세 이하 시즌 평점 7.2+ 또는 10골·10도움 · 제안 연봉 +5%', source: 'play', removeDesc: '21세가 되면 원더키드 출신으로' },
  wonderkidFormer: { id: 'wonderkidFormer', kind: 'story', ko: '원더키드 출신', desc: '20세 이하에 원더키드였던 선수 (기록)', source: 'play' },
  derbyHero: { id: 'derbyHero', kind: 'story', ko: '더비 영웅', desc: '더비 통산 5골 · 더비 폼 +0.05', source: 'play' },
  superSub: { id: 'superSub', kind: 'pro', ko: '슈퍼 서브', desc: '교체 출전 시즌 5골+ · 교체로 들어간 경기 폼 +0.1', source: 'play', removeDesc: '교체 출전 골 2골 미만 시즌' },
  lateShow: { id: 'lateShow', kind: 'story', ko: '극장골 장인', desc: '80분 이후 결승골·동점골 통산 5회 (기록)', source: 'play', hook: '막판 폼(엔진 블록)' },
  goalMachine: { id: 'goalMachine', kind: 'story', ko: '득점 기계', desc: '시즌 득점 1위 · 받을 때 위상 +10', source: 'play' },
  assistKing: { id: 'assistKing', kind: 'story', ko: '도움 장인', desc: '시즌 도움 1위 · 받을 때 위상 +10', source: 'play' },
  cleanSheet: { id: 'cleanSheet', kind: 'story', ko: '클린시트 장인', desc: '수비수 시즌 클린시트 15경기+ (60분 이상 출전) · 받을 때 위상 +10', source: 'play' },
  setPiece: { id: 'setPiece', kind: 'pro', ko: '세트피스 스페셜리스트', desc: '시즌 프리킥·PK 골 4+', source: 'play', hook: '세트피스 키커 기록(엔진 블록)' },
  everPresent: { id: 'everPresent', kind: 'pro', ko: '철인', desc: '리그 전 경기 출전 또는 3000분+ 2시즌 연속 · 피로 회복 +5%', source: 'play', removeDesc: '2000분 미만 시즌' },
  gentleman: { id: 'gentleman', kind: 'pro', ko: '신사', desc: '3시즌 연속 경고 3장 이하·퇴장 0 · 경고 확률 ×0.8', source: 'play', removeDesc: '퇴장 또는 경고 6장 이상 시즌', excludes: ['troublemaker'] },
  exClubKiller: { id: 'exClubKiller', kind: 'story', ko: '친정 킬러', desc: '전 소속 구단 상대 통산 3골 · 그 경기 폼 +0.05', source: 'play' },
  journeyman: { id: 'journeyman', kind: 'story', ko: '저니맨', desc: '5개 구단 이상 · 이적 뒤 숙련도 적응기 ×0.7', source: 'play', hook: '재계약 확률 −(5-1)' },
  cultHero: { id: 'cultHero', kind: 'story', ko: '컬트 히어로', desc: '한 구단 3시즌+ & 더비 영웅·극장골 장인 · 그 구단 시즌 위상 +1%', source: 'play', hook: '감독 신뢰 5-1' },
  traitor: { id: 'traitor', kind: 'story', ko: '배신자', desc: '이적 요청 뒤 전 구단의 더비 라이벌로 이적 · 전 구단 상대 폼 −0.1', source: 'play' },
  academy: { id: 'academy', kind: 'story', ko: '유스 출신', desc: '유스 구단과 첫 계약 · 그 구단에서 숙련도 적응기 없음, 선발 경쟁 +1', source: 'play', hook: '엔진 판단(엔진 블록)' },
  oneClubMan: { id: 'oneClubMan', kind: 'story', ko: '원클럽맨', desc: `첫 성인 구단에서 재계약 ${BALANCE.tags.oneClub.renewals}번 또는 ${BALANCE.tags.oneClub.seasons}시즌 (이적하면 떨어짐) · 재계약 +15%p, 선발 경쟁 +2, 다른 포지션 숙련도 ×1.15`, source: 'play', hook: '감독 신뢰도·팀 관계 5-1·5-2' },
  eternal: { id: 'eternal', kind: 'story', ko: '영원한', desc: '유스 출신 + 원클럽맨 조건 (이적하면 떨어짐) · 원클럽맨 효과 ×1.5, 시즌 위상 +3%', source: 'play', hook: '주장 후보 5-1' },
  homeChoice: { id: 'homeChoice', kind: 'story', ko: '친정 선택', desc: '더 많은 연봉 제안을 두고 유스 구단과 계약 · 그 구단에서 시즌 위상 +1.5%', source: 'play', hook: '감독 신뢰도 5-1' },
  loyalReturn: { id: 'loyalReturn', kind: 'story', ko: '무한한 충성심', desc: '유스 구단을 떠났다가 다시 돌아옴 · 돌아온 첫 시즌 적응기 없음, 첫 10경기 폼 +', source: 'play', hook: '팀 관계 5-2' },
  releasedPain: { id: 'releasedPain', kind: 'story', ko: '방출의 설움', desc: '방출된 뒤 다른 팀에서 시작 · 방출한 구단 상대 폼 +, 첫 2시즌 경기 XP +5%', source: 'play' },
};

/** 플레이로 얻은 둘 다 태그의 설명 (C.47, pending 65 값) */
export const PLAY_DESC: Partial<Record<TagId, string>> = {
  glass: '2시즌 안 부상 3회 또는 결장 60일 · 부상 확률 ×1.1', consistent: '시즌 평점이 고름 · 폼 변동 ×0.8',
  rollercoaster: '시즌 평점 기복이 큼 · 폼 변동 ×1.2', troublemaker: '시즌 경고 10장 또는 퇴장 2번 · 경고·퇴장 ×1.15',
};

/** 선수에게 붙은 태그 */
export interface PlayerTag {
  id: TagId;
  /** 영구(true) / 해제형(false). 플레이 전용 커리어 태그는 조건으로 붙고 떨어지므로 false 도 있다 */
  perm: boolean;
  /** 얻은 시즌 (생성 태그는 시작 시즌) */
  season: number;
  date?: string;
  /** 화면 이름 (아카데미·영원한 <구단> 등). 없으면 TAGS[id].ko */
  name?: string;
  club?: string;
  /** 방출의 설움: 방출한 구단 (C.47, 복수전 폼) */
  from?: string;
  /** 플레이로 얻은 둘 다 태그 (C.47): 효과가 pending 65 값(유리몸 ×1.1·꾸준함 ×0.8·롤러코스터 ×1.2·문제아 ×1.15) */
  play?: true;
  /** 늦게 핀 꽃: 이미 면제받은 노화 묶음 (C.47 B안, 신체·기술멘탈 각 1회) */
  used?: ('phys' | 'other')[];
}

export interface Tagged { tags?: readonly PlayerTag[] }

export const tagName = (t: PlayerTag): string => t.name ?? TAGS[t.id].ko;

export function tagHas(p: Tagged | null | undefined, id: TagId): boolean {
  return !!p?.tags?.some((t) => t.id === id);
}

/** 생성 화면에서 고를 수 있는 태그 (생성 전용 + 둘 다) */
export const CREATE_TAGS: readonly TagId[] = TAG_IDS.filter((id) => TAGS[id].source !== 'play');

/** 고를 때 영구/해제형을 고를 수 있는지 (둘 다 태그만) */
export const canRemovable = (id: TagId): boolean => TAGS[id].source === 'both';

/** 생성 포인트: 장점 −, 단점 +. 영구 × permMul, 해제형 × removableMul */
export function tagPoints(id: TagId, perm = true): number {
  const T = BALANCE.tags;
  const base = T.cost[id] ?? 0;
  const v = Math.round(base * (perm || !canRemovable(id) ? T.permMul : T.removableMul));
  return TAGS[id].kind === 'pro' ? -v : v;
}

export interface TagPick { id: TagId; perm: boolean }

/** 고를 수 있는지 (최대 장점 2·단점 3, 서로 배타, 생성 태그만) */
export function canAddTag(cur: readonly TagPick[], id: TagId): boolean {
  if (cur.some((t) => t.id === id) || TAGS[id].source === 'play') return false;
  const def = TAGS[id];
  const T = BALANCE.tags;
  if (cur.filter((t) => TAGS[t.id].kind === def.kind).length >= (def.kind === 'pro' ? T.maxPro : T.maxCon)) return false;
  return !cur.some((t) => TAGS[t.id].excludes?.includes(id) || def.excludes?.includes(t.id));
}

/** 랜덤 생성 태그 0~2개 (숨기지 않는다). 둘 다 태그는 randomRemovable 확률로 해제형 */
export function rollTags(rng: Rng): TagPick[] {
  const T = BALANCE.tags;
  const r = rng();
  let n = 0;
  for (let acc = 0; n < T.randomCountOdds.length; n++) {
    acc += T.randomCountOdds[n]!;
    if (r < acc) break;
  }
  const out: TagPick[] = [];
  for (let guard = 0; out.length < n && guard < 50; guard++) {
    const id = CREATE_TAGS[Math.floor(rng() * CREATE_TAGS.length)]!;
    const perm = !canRemovable(id) || rng() >= T.randomRemovable;
    if (canAddTag(out, id)) out.push({ id, perm });
  }
  return out;
}

export const picksToTags = (picks: readonly TagPick[], season: number): PlayerTag[] => picks.map((p) => ({ id: p.id, perm: p.perm, season }));

// ── 이미 있는 시스템에 거는 배율 ──

const E = () => BALANCE.tags.effects;

/** 그 태그 배율: 생성 태그는 C.45 값, 플레이로 얻었으면 pending 65 값 (C.47) */
function tagMul(p: Tagged, id: TagId, made: number, played: number): number {
  const t = p.tags?.find((x) => x.id === id);
  return t ? (t.play ? played : made) : 1;
}

export function injuryMul(p: Tagged): number {
  return tagMul(p, 'glass', E().glassInjury, BALANCE.tags.natural.playGlass) * (tagHas(p, 'ironMan') ? E().ironManInjury : 1);
}
export function formMul(p: Tagged): number {
  const N = BALANCE.tags.natural;
  return tagMul(p, 'rollercoaster', E().rollercoasterForm, N.playRoller) * tagMul(p, 'consistent', E().consistentForm, N.playConsistent);
}
export function recoveryMul(p: Tagged): number {
  return (tagHas(p, 'slowRecovery') ? E().slowRecovery : 1) * (tagHas(p, 'resilient') ? E().resilient : 1) * (tagHas(p, 'everPresent') ? N().everPresentRecovery : 1);
}
/** XP 배율: 훈련이면 프로 정신 */
export function xpMul(p: Tagged, training: boolean): number {
  return training && tagHas(p, 'professional') ? E().professionalXp : 1;
}
export function wageMul(p: Tagged): number {
  return (tagHas(p, 'starQuality') ? E().starWage : 1) * (tagHas(p, 'starPlayer') ? N().starPlayerWage : 1) * (tagHas(p, 'wonderkid') ? N().wonderkidWage : 1);
}
export function cardMul(p: Tagged): number {
  return tagMul(p, 'troublemaker', E().troublemakerCards, N().playTrouble) * (tagHas(p, 'gentleman') ? N().gentlemanCards : 1);
}
export function agingMul(p: Tagged): number {
  return tagHas(p, 'evergreen') ? E().evergreenAging : 1;
}
export function bigGameForm(p: Tagged, big: boolean): number {
  return big && tagHas(p, 'bigGame') ? E().bigGameForm : 0;
}

// ── 커리어 태그 효과 (pending 64, C.47): 그 구단에 있을 때만. 이적하면 태그가 떨어지거나(원클럽맨 계열) 구단이 달라 꺼진다 ──

const S = () => BALANCE.tags.story;
const N = () => BALANCE.tags.natural;

/** 자연 발생 태그 경기 폼 (C.47): 더비 영웅(더비), 친정 킬러(전 소속 구단), 배신자(전 구단 −) */
export function naturalForm(p: Tagged, derby: boolean, exClub: boolean, betrayed: boolean): number {
  return (derby && tagHas(p, 'derbyHero') ? N().derbyHeroForm : 0) + (exClub && tagHas(p, 'exClubKiller') ? N().exClubForm : 0) - (betrayed && tagHas(p, 'traitor') ? N().traitorForm : 0);
}

/** 지금 구단(teamId)에서 켜진 그 태그 */
export function tagAt(p: Tagged, id: TagId, teamId: string): PlayerTag | undefined {
  return p.tags?.find((t) => t.id === id && t.club === teamId);
}

/** 원클럽맨 효과 배율: 영원한 <구단> eternalMul, 원클럽맨 1, 없으면 0 */
export function oneClubLevel(p: Tagged, teamId: string): number {
  if (tagAt(p, 'eternal', teamId)) return S().eternalMul;
  return tagAt(p, 'oneClubMan', teamId) ? 1 : 0;
}

/** 선발 경쟁 보정 (OVR 단위): 원클럽맨 +2(영원한 +3), 아카데미 출신 +1 */
export function startBonus(p: Tagged, teamId: string): number {
  return S().oneClubStart * oneClubLevel(p, teamId) + (tagAt(p, 'academy', teamId) ? S().academyStart : 0);
}

/** 그 구단 다른 포지션 숙련도 상승 배율 (원클럽맨 ×1.15, 영원한 ×1.225) */
export function storyProfMul(p: Tagged, teamId: string): number {
  return 1 + (S().oneClubProf - 1) * oneClubLevel(p, teamId);
}

/** 숙련도 적응기 없음: 그 구단 아카데미 출신, 무한한 충성심(돌아온 첫 시즌) */
export function noAdaptation(p: Tagged & { clubRun?: { club: string; since: number } }, teamId: string, season: number): boolean {
  if (tagAt(p, 'academy', teamId)) return true;
  return !!tagAt(p, 'loyalReturn', teamId) && p.clubRun?.club === teamId && p.clubRun.since === season;
}

/** 시즌 위상 증가 배율 (팬 인기 = 위상): 영원한 <구단> ×1.03, 친정 선택 ×1.015 */
export function storyRepMul(p: Tagged, teamId: string): number {
  return (tagAt(p, 'eternal', teamId) ? S().eternalRep : 1) * (tagAt(p, 'homeChoice', teamId) ? S().homeChoiceRep : 1) * (tagAt(p, 'cultHero', teamId) ? N().cultHeroRep : 1);
}

/** 경기 폼 보정: 무한한 충성심 돌아온 첫 시즌 첫 10경기, 방출의 설움 방출 구단 상대 */
export function storyForm(p: Tagged & { clubRun?: { club: string; since: number } }, teamId: string, oppId: string, season: number, apps: number): number {
  let f = 0;
  if (tagAt(p, 'loyalReturn', teamId) && p.clubRun?.club === teamId && p.clubRun.since === season && apps < S().loyalGames) f += S().loyalForm;
  const r = tagAt(p, 'releasedPain', teamId);
  if (r?.from && r.from === oppId) f += S().releasedForm;
  return f;
}

/** 경기 XP 배율: 방출의 설움 (그 구단 계약 뒤 첫 2시즌) */
export function storyXpMul(p: Tagged & { clubRun?: { club: string; since: number } }, teamId: string, season: number): number {
  if (!tagAt(p, 'releasedPain', teamId)) return 1;
  const since = p.clubRun?.club === teamId ? p.clubRun.since : season;
  return season < since + S().releasedSeasons ? S().releasedXp : 1;
}

/** 재계약: 실패 판정을 뒤집을 확률 (원클럽맨 +15%p), 연봉 여력이 모자라도 받아 주는 비율 (+5%) */
export function renewKeep(p: Tagged, teamId: string): { chance: number; wage: number } {
  const k = oneClubLevel(p, teamId);
  return { chance: S().oneClubRenew * k, wage: S().oneClubWage * k };
}

/** 시즌 끝 해제형 태그 판정 (C.45: 생성 때 해제형으로 고른 태그만, 플레이 획득은 34c). 떨어진 태그를 돌려준다 */
export function seasonRemovals(p: { tags: PlayerTag[]; age: number; season: { apps: number; starts: number; injuries: number; reds: number; yellows: number; slumpPenalty?: number; trainingXp?: number } }, seasonEnding: boolean): PlayerTag[] {
  const s = p.season;
  const off = (t: PlayerTag): boolean => {
    if (t.perm || TAGS[t.id].source !== 'both') return false;
    switch (t.id) {
      case 'glass': return s.injuries === 0;
      case 'ironMan': return s.injuries >= 2 || seasonEnding;
      case 'troublemaker': return s.reds === 0 && s.yellows <= 3;
      case 'rollercoaster': return s.apps >= 20 && (s.slumpPenalty ?? 0) === 0;
      case 'consistent': return (s.slumpPenalty ?? 0) > 0;
      case 'slowRecovery': return s.starts >= 30;
      case 'resilient': return p.age >= 31;
      case 'professional': return (s.trainingXp ?? 0) < 60;
      default: return false;
    }
  };
  const gone = p.tags.filter(off);
  if (gone.length) p.tags = p.tags.filter((t) => !gone.includes(t));
  return gone;
}
