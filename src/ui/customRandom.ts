// 커스텀 랜덤 (C.74d, 사용자 요청 2026-10-20): 시작 방식 [랜덤]을 커스텀 안으로 합친다.
// [전체 랜덤] = 지금 랜덤 유망주 생성기(rollProspect · prospectExtras · rollIdentity)로 뽑은 결과 → [이대로 시작] / [편집하기] / [다시 돌리기].
// [편집하기]와 [이 단계 랜덤]은 같은 생성기 결과를 커스텀 폼 값으로 옮긴다. 같은 key 면 늘 같은 결과

import { FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes } from '../attributes';
import { rollProspect } from '../aptitude';
import { BALANCE } from '../config/balance';
import { CUSTOM_HIDDEN_TAGS, customCap, customRaise, spentPoints } from '../custom';
import { prospectExtras } from '../game';
import { PHOTO_OF, randomNameFor, rollIdentity, type FacePhoto, type Race } from '../identity';
import { initialTeams } from '../league';
import { attributeOvrWeight, type FieldPosition, type PlayablePosition } from '../positions';
import { createRng, hashSeed } from '../rng';
import { canAddTag, type TagPick } from '../tags';
import { budgetOf, NATIONALITIES, weightRange, type CustomForm } from './customVM';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 랜덤 능력치 → 커스텀 범위 (기본값 이상 · 키 상한 이하). 포인트는 넘칠 수 있다 */
export function attrsToCustom(attrs: FieldAttributes, height: number): FieldAttributes {
  const C = BALANCE.custom;
  return Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, clamp(Math.round(attrs[a]), C.base, Math.max(C.base, customCap(a, height)))])) as FieldAttributes;
}

/** 포인트에 맞추기: 넘친 만큼 그 포지션 OVR 에 덜 쓰이는(같으면 높은) 능력치부터 한 칸씩 내린다 */
export function fitToBudget(attrs: FieldAttributes, pos: FieldPosition, budget: number, height: number): FieldAttributes {
  let out = { ...attrs };
  for (let guard = 0; guard < 1000 && spentPoints(out) > budget; guard++) {
    let best: FieldAttribute | null = null;
    for (const a of FIELD_ATTRIBUTES) {
      if (out[a] <= BALANCE.custom.base) continue;
      if (!best) { best = a; continue; }
      const wa = attributeOvrWeight(pos, a);
      const wb = attributeOvrWeight(pos, best);
      if (wa < wb - 1e-12 || (Math.abs(wa - wb) <= 1e-12 && out[a] > out[best])) best = a;
    }
    if (!best) break;
    out = customRaise(out, best, -1, budget, height);
  }
  return out;
}

/** 생성 태그 → 커스텀에서 고를 수 있는 것만 (약발 태그는 약발 선택으로) */
function customTags(tags: readonly TagPick[]): TagPick[] {
  const out: TagPick[] = [];
  for (const t of tags) if (!CUSTOM_HIDDEN_TAGS.includes(t.id) && canAddTag(out, t.id)) out.push({ id: t.id, perm: t.perm });
  return out;
}

/** 신체 → 커스텀 범위 */
function bodyOf(key: string, pos: PlayablePosition): Pick<CustomForm, 'height' | 'weight' | 'foot' | 'weakFoot'> {
  const C = BALANCE.custom;
  const b = prospectExtras(key, pos).body;
  const height = clamp(b.height, C.heightMin, C.heightMax);
  const [lo, hi] = weightRange(height);
  return { height, weight: clamp(b.weight, lo, hi), foot: b.foot, weakFoot: b.weakFoot };
}

/** 인종 → 국적 · 외모 · 사진 (국적이 커스텀 목록 밖이면 그대로 두지 않고 목록 첫 국적) */
function looksOf(key: string, race?: Race, photo?: FacePhoto): Pick<CustomForm, 'nationality' | 'appearance' | 'facePhoto' | 'hair'> & { name: string } {
  const who = rollIdentity(key, race);
  return {
    nationality: NATIONALITIES.includes(who.nationality) ? who.nationality : NATIONALITIES[0]!, appearance: who.race,
    facePhoto: photo ?? PHOTO_OF[who.race], hair: '', name: who.name,
  };
}

/** 시작 소속: 15~18 = 반반 유스 구단(아무 PL 팀) / 소속팀 없음, 19~ = 소속팀 없음(영입 제안) */
function startOf(key: string, age: number): Pick<CustomForm, 'startKind' | 'startClub' | 'youthClub'> {
  const rng = createRng(hashSeed(`cu-start:${key}`));
  const teams = initialTeams();
  const club = teams[Math.floor(rng() * teams.length)]!.id;
  if (age <= BALANCE.startClub.trialMaxAge && rng() < 0.5) return { startKind: 'youth', startClub: club, youthClub: 'random' };
  return { startKind: 'none', startClub: '', youthClub: club };
}

/**
 * [편집하기]: 랜덤 결과(같은 key · 고른 포지션 · 고른 인종/사진)를 커스텀 폼으로. 능력치는 커스텀 범위로만 맞추고
 * 포인트는 그대로 둔다 (넘치면 능력치 단계에서 줄이거나 [포인트에 맞추기])
 */
export function prospectToCustom(key: string, position: PlayablePosition, race?: Race, photo?: FacePhoto): { form: CustomForm; name: string } {
  const p = rollProspect(key);
  const x = prospectExtras(key, position);
  const body = bodyOf(key, position);
  const { name, ...looks } = looksOf(key, race, photo);
  const age = BALANCE.custom.refAge;
  return {
    name,
    form: {
      age, position, attrs: attrsToCustom(p.attributes, body.height), ...body, tags: customTags(x.tags), ...looks, sel: null, ...startOf(key, age),
    },
  };
}

/**
 * [이 단계 랜덤]: 그 단계 값만 같은 생성기로 다시 뽑는다. 1 기본(이름·나이 17·포지션) · 2 몸 · 3 외모 · 4 태그 ·
 * 5 능력치(포인트에 맞춤) · 6 시작 소속. name 은 1단계에서만 바뀐다
 */
export function randomStep(f: CustomForm, name: string, step: number, key: string): { form: CustomForm; name: string } {
  const out: CustomForm = { ...f, sel: null };
  switch (step) {
    case 1: {
      out.age = BALANCE.custom.refAge;
      out.position = rollProspect(key).candidates[0]!.pos;
      Object.assign(out, startFit(out));
      return { form: out, name: randomNameFor(key, out.nationality, out.appearance) };
    }
    case 2: {
      Object.assign(out, bodyOf(key, f.position));
      out.attrs = attrsToCustom(f.attrs, out.height);
      break;
    }
    case 3: Object.assign(out, (({ name: _n, ...l }) => l)(looksOf(key))); break;
    case 4: out.tags = customTags(prospectExtras(key, f.position).tags); break;
    case 5: out.attrs = fitToBudget(attrsToCustom(rollProspect(key, f.position).attributes, f.height), f.position as FieldPosition, budgetOf(f), f.height); break;
    default: Object.assign(out, startOf(key, f.age));
  }
  return { form: out, name };
}

/** 나이가 테스트 나이를 넘나들면 시작 소속 종류를 맞춘다 (customAct 'age' 와 같은 규칙) */
function startFit(f: CustomForm): Partial<CustomForm> {
  const trial = f.age <= BALANCE.startClub.trialMaxAge;
  if (f.startKind === 'club' && trial) return { startKind: 'youth', startClub: '' };
  if (f.startKind === 'youth' && !trial) return { startKind: 'club', startClub: '' };
  return {};
}
