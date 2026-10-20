// 커스텀 생성 화면 뷰모델 (pending 47 2·49 1, 부록 C.45). 상태는 화면(ui.form.cu)이 들고, 시작할 때 newGame({ mode: 'custom' })

import type { Appearance } from '../appearance';
import { FACE_PHOTOS, isFacePhoto, isRace, PHOTO_KO, PHOTO_OF, RACE_KO, RACES, raceOf, type FacePhoto } from '../identity';
import { ATTRIBUTE_NAMES_KO, FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes } from '../attributes';
import { bmiOf, FOOT_KO, type MainFoot, type WeakFoot } from '../body';
import { BALANCE } from '../config/balance';
import {
  agePoints, baseAttributes, CUSTOM_HIDDEN_TAGS, customBudget, customCap, customRaise, spentPoints, stepCost, weakFootPoints,
} from '../custom';
import type { CustomSpec } from '../game';
import { initialTeams } from '../league';
import type { StartChoice, StartKind } from '../startClub';
import { allPositionOvrs, PLAYABLE_POSITIONS, POSITION_NAMES_KO, positionOvr, profileOf, type FieldPosition, type PlayablePosition } from '../positions';
import { canAddTag, canRemovable, CREATE_TAGS, TAGS, tagPoints, type TagId, type TagPick } from '../tags';
import { attrGroupsVM } from './viewModels';
import type { AttrGroupVM } from './views/attrGrid';

/** 외모군 → 도트 피부 (pixel-kits 3번, 라틴·중동계는 중간 톤) */
export const SKIN_OF: Readonly<Record<Appearance, string>> = {
  eastAsian: 'yellow', white: 'white', irish: 'white', black: 'black', latinMideast: 'mideast',
};
/** 피부별 고를 수 있는 도트 머리 (pixel-kits 1번 팩 구성) */
export const HAIRS_OF: Readonly<Record<string, readonly string[]>> = {
  black: ['black', 'blonde', 'bald'],
  yellow: ['black', 'blonde', 'brown', 'bald'],
  white: ['black', 'blonde', 'brown', 'bald'],
  mideast: ['black', 'brown', 'bald'],
};
export const HAIR_KO: Readonly<Record<string, string>> = { black: '검은 머리', blonde: '금발', brown: '갈색 머리', bald: '민머리' };

export interface CustomForm {
  age: number;
  position: PlayablePosition;
  attrs: FieldAttributes;
  height: number;
  weight: number;
  foot: MainFoot;
  weakFoot: WeakFoot;
  tags: TagPick[];
  nationality: string;
  appearance: Appearance;
  /** 기본 사진 (C.73c): 인종을 고르면 그 사진, 사진 줄에서 따로 바꿀 수 있다 */
  facePhoto: FacePhoto;
  /** '' = 자동(분포 추첨) */
  hair: string;
  sel: string | null;
  /** 시작 소속 (C.45 10번): 15~18 유스 구단(1군 테스트) / 19~23 소속팀 선택 / 소속팀 없음 */
  startKind: StartKind;
  startClub: string;
  /** 소속팀 없음일 때 서사용 유스 구단 ('random' = 랜덤) */
  youthClub: string;
}

export function initialCustomForm(): CustomForm {
  return {
    age: BALANCE.custom.refAge, position: 'ST', attrs: baseAttributes(), height: 180, weight: 75, foot: 'right', weakFoot: 3, tags: [],
    nationality: 'Korea Republic', appearance: 'eastAsian', facePhoto: 'asian', hair: '', sel: null, startKind: 'none', startClub: '', youthClub: 'random',
  };
}

export const NATIONALITIES: readonly string[] = Object.keys(BALANCE.appearance.byNationality);
export const NATIONALITY_KO: Readonly<Record<string, string>> = {
  England: '잉글랜드', Scotland: '스코틀랜드', 'Republic of Ireland': '아일랜드', 'Northern Ireland': '북아일랜드', Wales: '웨일스', France: '프랑스',
  Spain: '스페인', Portugal: '포르투갈', Germany: '독일', Netherlands: '네덜란드', Belgium: '벨기에', Brazil: '브라질', Argentina: '아르헨티나',
  Uruguay: '우루과이', Senegal: '세네갈', Nigeria: '나이지리아', Egypt: '이집트', Gabon: '가봉', Denmark: '덴마크', Norway: '노르웨이',
  'Korea Republic': '대한민국', Japan: '일본', China: '중국',
  Morocco: '모로코', 'Saudi Arabia': '사우디아라비아', "Côte d'Ivoire": '코트디부아르', Ghana: '가나', Cameroon: '카메룬',
};

export const budgetOf = (f: CustomForm): number => customBudget(f.age, f.tags, f.weakFoot);

/** 키에 맞는 몸무게 범위 (BMI) */
export function weightRange(height: number): [number, number] {
  const C = BALANCE.custom;
  const m2 = (height / 100) ** 2;
  return [Math.ceil(C.bmiMin * m2), Math.floor(C.bmiMax * m2)];
}

export interface CustomVM {
  name: string;
  age: number;
  ageMin: number;
  ageMax: number;
  agePts: number;
  budget: number;
  spent: number;
  left: number;
  over: boolean;
  position: string;
  positionKo: string;
  ovr: number;
  positions: { id: string; ko: string; ovr: number; on: boolean }[];
  attrs: AttrGroupVM[];
  sel: string | null;
  body: { height: number; weight: number; bmi: string; foot: MainFoot; footKo: string; weakFoot: number; weakPts: number; wRange: [number, number];
    speedCap: number; aerialCap: number; hMin: number; hMax: number };
  weakOptions: { v: number; pts: number; on: boolean }[];
  /** 고를 수 있는 태그: 둘 다 태그는 영구/해제형 비용이 다르다 */
  traits: { id: TagId; ko: string; desc: string; kind: 'pro' | 'con'; pts: number; ptsRemovable: number | null; removeDesc?: string; on: boolean; perm: boolean; can: boolean; hook?: string }[];
  traitCount: { pro: number; con: number; maxPro: number; maxCon: number };
  nationality: string;
  nationalities: { id: string; ko: string }[];
  appearance: Appearance;
  /** 인종 4개 (C.73c 순서: 중동·동양인·백인·흑인) */
  appearances: { id: Appearance; ko: string }[];
  facePhoto: FacePhoto;
  photos: { id: FacePhoto; ko: string }[];
  hair: string;
  hairs: { id: string; ko: string }[];
  skin: string;
  start: {
    kind: StartKind;
    trialAge: boolean;
    club: string;
    youthClub: string;
    /** 고를 수 있는 팀 (15~18 유스 = PL 20개 전부, 19~23 소속팀 = 스탯에 맞는 팀) */
    teams: { id: string; ko: string; rating: number; fit?: boolean }[];
    allTeams: { id: string; ko: string }[];
    ready: boolean;
  };
}

export function customVM(f: CustomForm, name: string, league = 'pl'): CustomVM {
  const C = BALANCE.custom;
  const budget = budgetOf(f);
  const spent = spentPoints(f.attrs);
  const left = budget - spent;
  const pos = f.position as FieldPosition;
  const keys = profileOf(pos).keys;
  const ovrs = allPositionOvrs(f.attrs);
  const groups = attrGroupsVM(f.attrs, keys, baseAttributes()).map((g) => ({
    ...g,
    cells: g.cells.map((c) => {
      const a = c.attr as FieldAttribute;
      const cap = customCap(a, f.height);
      const maxed = f.attrs[a] >= cap;
      const cost = maxed ? null : stepCost(f.attrs[a]);
      const after = maxed ? f.attrs : customRaise(f.attrs, a, 1, budget, f.height);
      const reach = after[a] > f.attrs[a] ? 1 : 0;
      const d = reach ? Math.round((positionOvr(after, pos) - positionOvr(f.attrs, pos)) * 10) / 10 : 0;
      return { ...c, edit: { cost, steps: 1, reach, ovrDelta: d > 0 ? d : null, maxed, blocked: !maxed && reach === 0, short: !maxed && reach === 0, canLower: f.attrs[a] > C.base } };
    }),
  }));
  const skin = SKIN_OF[f.appearance];
  const cur = f.tags;
  return {
    name, age: f.age, ageMin: C.minAge, ageMax: C.maxAge, agePts: agePoints(f.age),
    budget, spent, left, over: left < 0,
    position: f.position, positionKo: POSITION_NAMES_KO[f.position], ovr: ovrs[f.position],
    positions: PLAYABLE_POSITIONS.map((p) => ({ id: p, ko: POSITION_NAMES_KO[p], ovr: ovrs[p], on: p === f.position })),
    attrs: groups, sel: f.sel,
    body: {
      height: f.height, weight: f.weight, bmi: bmiOf(f).toFixed(1), foot: f.foot, footKo: FOOT_KO[f.foot], weakFoot: f.weakFoot, weakPts: weakFootPoints(f.weakFoot),
      wRange: weightRange(f.height), speedCap: customCap('pace', f.height), aerialCap: customCap('heading', f.height), hMin: C.heightMin, hMax: C.heightMax,
    },
    weakOptions: [1, 2, 3, 4, 5].map((v) => ({ v, pts: weakFootPoints(v), on: v === f.weakFoot })),
    traits: CREATE_TAGS.filter((id) => !CUSTOM_HIDDEN_TAGS.includes(id)).map((id) => {
      const t = TAGS[id];
      const pick = cur.find((x) => x.id === id);
      return {
        id, ko: t.ko, desc: t.desc, kind: t.kind as 'pro' | 'con', pts: tagPoints(id, true), ptsRemovable: canRemovable(id) ? tagPoints(id, false) : null,
        ...(t.removeDesc ? { removeDesc: t.removeDesc } : {}), on: !!pick, perm: pick?.perm ?? true, can: !!pick || canAddTag(cur, id), ...(t.hook ? { hook: t.hook } : {}),
      };
    }),
    traitCount: {
      pro: cur.filter((t) => TAGS[t.id].kind === 'pro').length, con: cur.filter((t) => TAGS[t.id].kind === 'con').length,
      maxPro: BALANCE.tags.maxPro, maxCon: BALANCE.tags.maxCon,
    },
    nationality: f.nationality,
    nationalities: NATIONALITIES.map((id) => ({ id, ko: NATIONALITY_KO[id] ?? id })),
    appearance: f.appearance,
    appearances: RACES.map((id) => ({ id, ko: RACE_KO[id] })),
    facePhoto: f.facePhoto,
    photos: FACE_PHOTOS.map((id) => ({ id, ko: PHOTO_KO[id] })),
    hair: f.hair,
    hairs: (HAIRS_OF[skin] ?? []).map((id) => ({ id, ko: HAIR_KO[id] ?? id })),
    skin,
    start: startVM(f, ovrs[f.position], league),
  };
}

/** 19세 이상 소속팀 목록: 유효 OVR(어리면 잠재력만큼 +)과 기본 레이팅 차가 작은 순 (게임 안 fitTeams 와 같은 식, 시작 전이라 기본 레이팅) */
function startVM(f: CustomForm, ovr: number, league = 'pl'): CustomVM['start'] {
  const S = BALANCE.startClub;
  const O = BALANCE.transfer.offers;
  const trialAge = f.age <= S.trialMaxAge;
  // 내 리그 팀 (C.75y)
  const teams = initialTeams(league);
  const allTeams = [...teams].sort((a, b) => b.rating - a.rating).map((t) => ({ id: t.id, ko: t.nameKo }));
  const eff = ovr + Math.max(0, O.youthAge - f.age) * O.youthPerYear;
  const fit = [...teams].sort((a, b) => Math.abs(eff - a.rating - O.fitOffset) - Math.abs(eff - b.rating - O.fitOffset) || a.id.localeCompare(b.id)).slice(0, S.fitTeams);
  const list = f.startKind === 'youth' ? [...teams].sort((a, b) => b.rating - a.rating) : fit;
  const valid = new Set(list.map((t) => t.id));
  return {
    kind: f.startKind, trialAge, club: valid.has(f.startClub) ? f.startClub : '', youthClub: f.youthClub,
    teams: list.map((t) => ({ id: t.id, ko: t.nameKo, rating: t.rating, ...(fit.includes(t) ? { fit: true } : {}) })),
    allTeams,
    ready: f.startKind === 'none' || valid.has(f.startClub),
  };
}

/** 시작 소속 입력 → newGame StartChoice */
export function startChoice(f: CustomForm): StartChoice {
  if (f.startKind === 'none') return { kind: 'none', youthClub: f.youthClub };
  return { kind: f.startKind, club: f.startClub };
}

/** 화면 상태 → newGame 입력 */
export function customSpec(f: CustomForm, name: string): CustomSpec {
  return {
    name, position: f.position, age: f.age, attributes: { ...f.attrs },
    body: { height: f.height, weight: f.weight, foot: f.foot, weakFoot: f.weakFoot },
    tags: [...f.tags], nationality: f.nationality, appearance: f.appearance, facePhoto: f.facePhoto, ...(f.hair ? { pixelHair: f.hair } : {}),
    start: startChoice(f),
  };
}

/** 동작 하나 적용 (k, v). 바뀐 폼을 돌려준다 */
export function customAct(f: CustomForm, k: string, v: string | undefined): CustomForm {
  const C = BALANCE.custom;
  const n = Number(v);
  const out: CustomForm = { ...f };
  switch (k) {
    case 'age': {
      out.age = Math.min(C.maxAge, Math.max(C.minAge, f.age + n));
      // 나이가 테스트 나이(≤18)를 넘나들면 시작 소속 종류를 맞춘다
      const trial = out.age <= BALANCE.startClub.trialMaxAge;
      if (out.startKind === 'youth' && !trial) { out.startKind = 'club'; out.startClub = ''; }
      if (out.startKind === 'club' && trial) { out.startKind = 'youth'; out.startClub = ''; }
      break;
    }
    case 'pos': out.position = v as PlayablePosition; break;
    case 'height': {
      out.height = Math.min(C.heightMax, Math.max(C.heightMin, f.height + n));
      const [lo, hi] = weightRange(out.height);
      out.weight = Math.min(hi, Math.max(lo, f.weight));
      // 키가 바뀌면 상한을 넘은 능력치는 상한으로 (돌려받은 포인트는 남은 포인트로)
      const a = { ...f.attrs };
      for (const x of FIELD_ATTRIBUTES) a[x] = Math.min(a[x], Math.max(C.base, customCap(x, out.height)));
      out.attrs = a;
      break;
    }
    case 'weight': {
      const [lo, hi] = weightRange(f.height);
      out.weight = Math.min(hi, Math.max(lo, f.weight + n));
      break;
    }
    case 'foot': out.foot = v === 'left' ? 'left' : 'right'; break;
    case 'wf': out.weakFoot = Math.min(5, Math.max(1, Math.round(n))) as WeakFoot; break;
    case 'nat': out.nationality = v ?? f.nationality; break;
    case 'app': {
      // 인종을 고르면 그 기본 사진이 자동으로 (C.73c)
      out.appearance = isRace(v) ? v : raceOf(f.appearance);
      out.facePhoto = PHOTO_OF[out.appearance];
      if (out.hair && !(HAIRS_OF[SKIN_OF[out.appearance]] ?? []).includes(out.hair)) out.hair = '';
      break;
    }
    case 'hair': out.hair = v ?? ''; break;
    case 'photo': if (isFacePhoto(v)) out.facePhoto = v; break;
    case 'trait':
    case 'traitR': {
      // trait = 영구로 고르기/빼기, traitR = 해제형으로 고르기 (이미 고른 태그면 영구/해제형만 바꾼다)
      const id = v as TagId;
      const perm = k === 'trait';
      const cur = f.tags.find((t) => t.id === id);
      if (cur && cur.perm === perm) out.tags = f.tags.filter((t) => t.id !== id);
      else if (cur) out.tags = f.tags.map((t) => (t.id === id ? { id, perm } : t));
      else if (canAddTag(f.tags, id)) out.tags = [...f.tags, { id, perm: perm || !canRemovable(id) }];
      break;
    }
    case 'sel': out.sel = f.sel === v ? null : v ?? null; break;
    case 'raise': out.attrs = customRaise(f.attrs, v as FieldAttribute, 1, budgetOf(f), f.height); break;
    case 'lower': out.attrs = customRaise(f.attrs, v as FieldAttribute, -1, budgetOf(f), f.height); break;
    case 'reset': out.attrs = baseAttributes(); break;
    case 'startKind': out.startKind = (v as StartKind) ?? 'none'; out.startClub = ''; break;
    case 'startClub': out.startClub = v ?? ''; break;
    case 'youthClub': out.youthClub = v ?? 'random'; break;
  }
  return out;
}

export { ATTRIBUTE_NAMES_KO };
