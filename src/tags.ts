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
  evergreen: { id: 'evergreen', kind: 'pro', ko: '노익장', desc: '30세 이후에만 붙음 · 노화 하락 소폭 완화', source: 'play', hook: '34c 판정·효과' },
  lateBloomer: { id: 'lateBloomer', kind: 'pro', ko: '늦게 핀 꽃', desc: '한 포지션에서 여러 해 뛴 뒤 포지션을 바꾸고 더 잘된 선수', source: 'play', hook: '34c 판정·효과' },
  bigGame: { id: 'bigGame', kind: 'pro', ko: '빅매치 체질', desc: '더비·큰 경기 폼 +0.1', source: 'play', hook: '34c 판정' },
  academy: { id: 'academy', kind: 'story', ko: '유스 출신', desc: '유스 구단과 첫 계약', source: 'play' },
  oneClubMan: { id: 'oneClubMan', kind: 'story', ko: '원클럽맨', desc: `첫 성인 구단에서 재계약 ${BALANCE.tags.oneClub.renewals}번 또는 ${BALANCE.tags.oneClub.seasons}시즌 (이적하면 떨어짐)`, source: 'play' },
  eternal: { id: 'eternal', kind: 'story', ko: '영원한', desc: '유스 출신 + 원클럽맨 조건 (이적하면 떨어짐)', source: 'play' },
  homeChoice: { id: 'homeChoice', kind: 'story', ko: '친정 선택', desc: '더 많은 연봉 제안을 두고 유스 구단과 계약', source: 'play' },
  loyalReturn: { id: 'loyalReturn', kind: 'story', ko: '무한한 충성심', desc: '유스 구단을 떠났다가 다시 돌아옴', source: 'play' },
  releasedPain: { id: 'releasedPain', kind: 'story', ko: '방출의 설움', desc: '1군 테스트·재계약에서 방출된 뒤 다른 팀에서 시작', source: 'play' },
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

export function injuryMul(p: Tagged): number {
  return (tagHas(p, 'glass') ? E().glassInjury : 1) * (tagHas(p, 'ironMan') ? E().ironManInjury : 1);
}
export function formMul(p: Tagged): number {
  return (tagHas(p, 'rollercoaster') ? E().rollercoasterForm : 1) * (tagHas(p, 'consistent') ? E().consistentForm : 1);
}
export function recoveryMul(p: Tagged): number {
  return (tagHas(p, 'slowRecovery') ? E().slowRecovery : 1) * (tagHas(p, 'resilient') ? E().resilient : 1);
}
/** XP 배율: 훈련이면 프로 정신 */
export function xpMul(p: Tagged, training: boolean): number {
  return training && tagHas(p, 'professional') ? E().professionalXp : 1;
}
export function wageMul(p: Tagged): number {
  return tagHas(p, 'starQuality') ? E().starWage : 1;
}
export function cardMul(p: Tagged): number {
  return tagHas(p, 'troublemaker') ? E().troublemakerCards : 1;
}
export function agingMul(p: Tagged): number {
  return tagHas(p, 'evergreen') ? E().evergreenAging : 1;
}
export function bigGameForm(p: Tagged, big: boolean): number {
  return big && tagHas(p, 'bigGame') ? E().bigGameForm : 0;
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
