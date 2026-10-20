// 설정 (pending 49, 부록 C.43 → C.59 디자인 66~71·137~143): 접는 섹션(경기 진행 · 경기 화면 보기 · 꾸미기 · 저장과 안내 · 페이스팩)
// + 위 이동 칩. 꾸미기 = 화면 스타일 한 줄 + 하위 화면 4개(선수 이름 · 경기 아이콘 · 페이스온 · 카드 이미지, 뒤로 가기 · 위 이동 칩 4).
// 페이스온 이미지는 이 브라우저(IndexedDB)에만 남는다

import { A_GRADE_PLAYERS, REAL_PLAYER_BY_ID, ALL_REAL_PLAYERS } from '../../../data/players';
import { realAppearance } from '../../appearance';
import { BALANCE } from '../../config/balance';
import type { GameState } from '../../game';
import { clubKo, teamById } from '../../league';
import { PACK_ANIM_PREF_KO, RARITY_KO as PACK_RARITY_KO, loadPackAnimPref } from '../packAnim/model';
import { Avatar, Banner, Button, Crest, esc, HeroPanel, Icon, PixelTile, SectionTitle, Switch, Tabs, TextField, type IconName } from '../components';
import {
  AGE_SLOT_KO, AGE_SLOTS, ageSlot, ALL_CLUBS, clubOf, defaultFaceSrc, faceOnCutout, heroFaceOf, faceOnKeys, faceOnUrls, faceStats, repoCrest, squareLayout, type FaceRef, type FaceSlot,
} from '../faces';
import { myFace, type VersionVM } from '../viewModels';
import type { LookVM } from './body';
import { panel, pc2, versionFooter } from './common';
import {
  pitchNames, PITCH_NAMES_KO, pitchOrient, PITCH_ORIENT_KO, pitchSize, PITCH_SIZE_KO, pitchView, PITCH_VIEW_KO,
} from '../pitch/renderer';
import { autoShortNames, worldPlayers } from '../playerNames';
import { NATION_KITS } from '../../../data/kits';
import { PIXEL_KITS } from '../../../data/pixelPack';
import { ALL_KITS, allPeople, kitFor, personKey, tableKit, validPerson } from '../../pixel';
import { pixelLayerUrls } from '../faces';
import { homeKitOf, peopleTable, pixelIconHtml, playerAutoPerson, playerPerson } from '../pixelIcons';
import { CARD_ART_UI_DEFAULT, cardArtHero, cardArtOverlay, cardArtSection, rangeRow, type CardArtUI } from './cardArtSettings';
import { userArtCount } from '../cardArt';
import { CARDS } from '../../config/cards';

const CARDS_N = (): number => CARDS.length;
import { isWide, skin, SKIN_KO } from '../skin';
import { PATCH_LABEL } from '../../version';

/** 설정 → 선수 이름 (부록 C.44a): 검색어, 팀 거르기('' 전체, 'x' 리그 밖), 고른 선수 id */
export interface NameUI { q: string; team: string; sel: string | null }

/** 이름 고치기 칸 (설정·선수 화면 공용, 디자인 71): 풀네임 · 경기 화면 라벨, 별명·짧은 이름 TextField, [되돌리기][저장] */
export function nameEditor(g: GameState, id: string): string {
  const p = worldPlayers(g).find((x) => x.id === id);
  if (!p) return '';
  const auto = autoShortNames(g).get(id) ?? p.nameKo;
  const o = g.nameOverrides[id] ?? {};
  const label = o.nickname || o.shortName || auto;
  const own = !!(o.nickname || o.shortName);
  return `<div class="nm-edit">
    <div class="nm-edit__top"><span class="grow"><small>풀네임</small><b>${esc(p.nameKo)}</b></span><span class="nm-edit__label"><small>경기 화면 라벨</small><b class="pl-label">${esc(label)}</b></span></div>
    ${TextField({ label: '별명', value: o.nickname ?? '', placeholder: '없음 (직접 쓰기)', input: { id: 'nm-nick', maxLength: 16 }, clearable: false })}
    ${TextField({ label: '짧은 이름', value: o.shortName ?? '', placeholder: `${auto} (자동)`, hint: '비워 두면 자동 짧은 이름(유명한 이름, 같은 이름이 여럿이면 첫 글자)', input: { id: 'nm-short', maxLength: 16 }, clearable: false })}
    <p class="small muted">이름표 = 별명 > 짧은 이름. 이 세이브에 저장돼요.</p>
    <div class="btn-row even">${Button({ variant: 'secondary', block: true, icon: 'restore', act: 'nm-clear', data: { id }, disabled: !own, children: '되돌리기' })}${Button({ block: true, icon: 'check', act: 'nm-save', data: { id }, children: '저장' })}</div>
  </div>`;
}

/** 팀 거르기 select (선수 이름·경기 아이콘 공용) */
function teamSelect(g: GameState, id: string, value: string): string {
  return `<select id="${id}" class="nm-team" aria-label="팀 거르기"><option value="">전체</option>${g.league.teams.map((t) => `<option value="${esc(t.id)}"${value === t.id ? ' selected' : ''}>${esc(t.nameKo)}</option>`).join('')}<option value="x"${value === 'x' ? ' selected' : ''}>리그 밖</option></select>`;
}

const teamFilterName = (g: GameState, team: string): string => (team === 'x' ? '리그 밖' : team ? teamById(g.league, team)?.nameKo ?? team : '전체');

/** 선수 이름 (디자인 71): 검색 + 팀 거르기 → 편집 칸 → 목록(오른쪽 = 지금 이름표) */
function nameSection(g: GameState | null, nm: NameUI): string {
  if (!g) return panel('<p class="small muted">선수 이름은 게임을 시작하거나 불러오면 바꿀 수 있어요.</p>');
  const auto = autoShortNames(g);
  const qq = nm.q.trim().toLowerCase();
  const all = worldPlayers(g);
  const hit = all.filter((p) => {
    if (nm.team === 'x' ? p.teamId : nm.team && p.teamId !== nm.team) return false;
    if (!qq) return true;
    const o = g.nameOverrides[p.id];
    return [p.nameKo, p.name ?? '', auto.get(p.id) ?? '', o?.nickname ?? '', o?.shortName ?? ''].some((x) => has(x, qq));
  });
  const list = hit.sort((a, b) => Number(!!b.mine) - Number(!!a.mine) || Number(!!g.nameOverrides[b.id]) - Number(!!g.nameOverrides[a.id])).slice(0, 30);
  const teamName = (p: (typeof all)[number]) => (p.teamId ? teamById(g.league, p.teamId)?.nameKo ?? p.teamId : `${clubKo(p.club)} · 리그 밖`);
  const rows = list.map((p) => {
    const o = g.nameOverrides[p.id];
    const tag = o?.nickname || o?.shortName || auto.get(p.id) || p.nameKo;
    const sub = nm.team ? `${p.mine ? '내 선수 · ' : ''}${p.position ?? ''}${p.age ? ` · ${p.age}세` : ''}` : `${p.mine ? '내 선수 · ' : ''}${teamName(p)}`;
    return `<button type="button" class="real-row nm-row${p.id === nm.sel ? ' is-on' : ''}" data-act="nm-pick" data-id="${esc(p.id)}"><span class="grow"><b>${esc(p.nameKo)}</b><small>${esc(sub)}</small></span><span class="pl-label${p.mine ? ' is-mine' : ''}${o ? ' is-own' : ''}">${esc(tag)}</span></button>`;
  }).join('');
  const own = Object.values(g.nameOverrides).filter((o) => o.nickname || o.shortName).length;
  return `<div class="nm-filter">${TextField({ value: nm.q, placeholder: '선수 이름 (한글·영문·별명)', icon: 'search', input: { id: 'nm-q', type: 'search', maxLength: 20 }, clearable: false })}${teamSelect(g, 'nm-team', nm.team)}</div>
    ${nm.sel ? panel(nameEditor(g, nm.sel), 'nm-editor set-editor') : ''}
    <p class="set-count">${esc(teamFilterName(g, nm.team))} · ${hit.length}명${own ? ` · 바꾼 이름 ${own}명` : ''}</p>
    <div class="real-list set-list">${rows || '<p class="small muted">찾는 이름이 없어요.</p>'}</div>
    <p class="small muted">경기 화면에서 선수 아래 따라다니는 이름표만 바뀌어요. 다른 화면은 풀네임 그대로예요.</p>`;
}

// ── 경기 아이콘 (부록 C.45, pixel-kits.md 5.1): 모든 선수의 인물(피부·머리)과 구단·대표팀 홈·원정 유니폼을 직접 바꾸기. 세이브 pixelOverrides ──

/** 설정 → 경기 아이콘: 탭, 검색어, 팀 거르기, 고른 선수 id, 고른 팀 id (대표팀 `n:<국가>`), 유니폼 편집 쪽 (C.59) */
export interface PixelUI { tab: 'players' | 'kits'; q: string; team: string; sel: string | null; kitSel: string | null; side?: 'home' | 'away' }

/** 유니폼 미리보기에 입히는 인물 */
const PREVIEW_PERSON = { skin: 'white', hair: 'brown' };
/** 유니폼 이름 (팩 키에서: C01_solid_red → red, S01_juventus → juventus) */
const kitLabel = (k: string): string => {
  const key = PIXEL_KITS[k]?.key ?? k;
  return `${k} ${key.replace(/^[CS]\d+_(solid_)?/, '').replace(/_/g, ' ')}`;
};

/** 선수 인물 고르기 (디자인 137): 지금 아이콘(구단 홈 유니폼) → 인물 14종 PixelTile 격자(고름 ✓ · 자동 = 기본 꼬리표) → 기본으로 */
export function pixelPersonEditor(g: GameState, id: string, name: string): string {
  const kit = homeKitOf(g, id);
  const cur = playerPerson(g, id);
  const auto = playerAutoPerson(g, id);
  const own = !!g.pixelOverrides?.players?.[id];
  const people = allPeople(peopleTable());
  const idx = people.findIndex((p) => personKey(p) === personKey(cur));
  const tiles = people.map((p, i) => {
    const isAuto = personKey(p) === personKey(auto);
    return PixelTile({ art: pixelIconHtml(pixelLayerUrls(p, kit), 3), scale: 3, label: isAuto && !own ? '자동' : String(i + 1).padStart(2, '0'), selected: i === idx, isDefault: isAuto, act: 'px-person', data: { id, key: personKey(p) }, title: `인물 ${i + 1}` });
  }).join('');
  return `<div class="px-edit">
    <div class="px-head"><span class="px-head__big">${pixelIconHtml(pixelLayerUrls(cur, kit), 5, name)}</span>
      <span class="grow"><b>${esc(name)}</b><small class="muted">${own ? `${String(idx + 1).padStart(2, '0')}번 인물로 바꿨어요.` : '자동으로 정한 인물이에요.'} 유니폼은 경기마다 홈·원정·GK로 자동이에요.</small></span></div>
    <div class="px-tiles px-tiles--people">${tiles}</div>
    ${Button({ variant: 'secondary', block: true, icon: 'restore', act: 'px-auto', data: { id }, disabled: !own, children: '기본으로 (자동)' })}
    <p class="small muted">누르면 바로 바뀌어요. 겉모습만 바뀌고 경기 결과에는 영향이 없어요. 이 세이브에 저장돼요.</p>
  </div>`;
}

/** 선수 화면 "몸·태그" 탭의 내 모습 줄 (C.58 디자인 134): 얼굴 · 경기 아이콘 → 설정의 같은 선택창, 이름표 = 펼치면 같은 이름 칸 */
export function myLookVM(g: GameState, nameOpen: boolean): LookVM {
  const face = myFace(g);
  const id = face.id;
  const o = g.nameOverrides[id] ?? {};
  const auto = autoShortNames(g).get(id) ?? g.player.name;
  const own = !!g.pixelOverrides?.players?.[id];
  return {
    faceKey: `p:${id}`,
    avatar: Avatar({ size: 44, face, name: g.player.name }),
    faceNote: faceOnKeys().some((k) => k.key === `p:${id}`) ? '직접 올린 사진 · 나이대 칸' : '기본 얼굴 · 나이대 3칸',
    pixel: `<span class="pl-px">${pixelIconHtml(pixelLayerUrls(playerPerson(g, id), homeKitOf(g, id)), 2, g.player.name)}</span>`,
    pixelNote: `${own ? '직접 고름' : '자동'} · ${teamById(g.league, g.player.teamId).nameKo} 홈 유니폼 · 캐릭터 보기에서 보여요`,
    label: o.nickname || o.shortName || auto,
    labelNote: o.nickname ? '별명' : o.shortName ? '짧은 이름' : '별명 없음 · 짧은 이름 자동',
    nameEditor: nameOpen ? nameEditor(g, id) : null,
  };
}

interface KitTeam { id: string; name: string; sub: string }

function kitTeams(g: GameState | null): KitTeam[] {
  const clubs: KitTeam[] = ALL_CLUBS.map((c) => ({ id: c.id, name: c.nameKo, sub: c.id.startsWith('x:') ? `${c.name} · 리그 밖` : c.name }));
  const nations: KitTeam[] = Object.keys(NATION_KITS).map((n) => ({ id: `n:${n}`, name: n, sub: '대표팀' }));
  const mine = g?.player.teamId;
  return [...clubs, ...nations].sort((a, b) => Number(b.id === mine) - Number(a.id === mine));
}

/** 유니폼 고르기 (디자인 138): 팀 머리(홈·원정 미리보기) → [홈 | 원정] → 32종 PixelTile 4줄 × 8열(고름 ✓ · 기본 꼬리표). 실제 팩 그림 */
function kitEditor(g: GameState, t: KitTeam, side: 'home' | 'away'): string {
  const cur = kitFor(t.id, g.pixelOverrides);
  const base = tableKit(t.id);
  const own = g.pixelOverrides?.kits?.[t.id];
  const person = validPerson(PREVIEW_PERSON, peopleTable());
  const tiles = ALL_KITS.map((k) => PixelTile({
    art: pixelIconHtml(pixelLayerUrls(person, k), 2), scale: 2, label: k, title: kitLabel(k), selected: cur[side] === k, isDefault: base[side] === k,
    act: 'px-kit', data: { id: t.id, side, kit: k },
  })).join('');
  const sideTabs = Tabs({ items: [{ id: 'home', label: `홈 · ${cur.home}` }, { id: 'away', label: `원정 · ${cur.away}` }], value: side, act: 'px-side', fill: true, label: '홈/원정' });
  return `<div class="px-edit">
    <div class="px-head">${Crest({ name: t.name, team: t.id, size: 40 })}<span class="grow"><b>${esc(t.name)}</b><small class="muted">홈 ${esc(kitLabel(cur.home))} · 원정 ${esc(kitLabel(cur.away))} · GK는 자동${own ? ' · 직접 고름' : ''}</small></span>
      <span class="px-pair"><span>${pixelIconHtml(pixelLayerUrls(person, cur.home), 2, '홈')}<small>홈</small></span><span>${pixelIconHtml(pixelLayerUrls(person, cur.away), 2, '원정')}<small>원정</small></span></span></div>
    ${sideTabs}
    <div class="px-tiles px-tiles--kits">${tiles}</div>
    <p class="small muted">C = 단색 · S = 줄무늬·가로줄 등. 원정 팀은 홈 유니폼이 상대와 비슷할 때만 원정을 입고, GK는 두 팀과 겹치지 않는 단색을 입어요(바꾼 값으로 다시 계산).</p>
    ${Button({ variant: 'secondary', block: true, icon: 'restore', act: 'px-kit-auto', data: { id: t.id }, disabled: !own, children: '기본으로' })}
  </div>`;
}

/** 경기 아이콘 (디자인 137·138): [선수 · 인물 | 유니폼] → 편집 칸 → 검색 + 팀 거르기 → 목록(바꿈/자동) */
function pixelSection(g: GameState | null, px: PixelUI): string {
  if (!g) return panel('<p class="small muted">경기 아이콘은 게임을 시작하거나 불러오면 바꿀 수 있어요.</p>');
  const nPeople = allPeople(peopleTable()).length;
  const tabs = Tabs({ items: [{ id: 'players', label: `선수 · 인물 ${nPeople}종` }, { id: 'kits', label: `유니폼 · ${ALL_KITS.length}종` }], value: px.tab, act: 'px-tab', fill: true, label: '선수/유니폼' });
  const qq = px.q.trim().toLowerCase();
  if (px.tab === 'kits') {
    const all = kitTeams(g);
    const sel = px.kitSel ? all.find((t) => t.id === px.kitSel) : all[0];
    const hit = all.filter((t) => !qq || has(t.name, qq) || has(t.sub, qq) || has(t.id, qq));
    const person = validPerson(PREVIEW_PERSON, peopleTable());
    const rows = hit.slice(0, 60).map((t) => {
      const k = kitFor(t.id, g.pixelOverrides);
      const own = !!g.pixelOverrides?.kits?.[t.id];
      return `<button type="button" class="real-row px-row${t.id === sel?.id ? ' is-on' : ''}" data-act="px-team-pick" data-id="${esc(t.id)}">${Crest({ name: t.name, team: t.id, size: 28 })}<span class="grow"><b>${esc(t.name)}</b><small>홈 ${esc(k.home)} · 원정 ${esc(k.away)} · ${own ? '바꿈' : t.sub === '대표팀' ? '대표팀' : '기본'}</small></span>${
        pixelIconHtml(pixelLayerUrls(person, k.home), 2)}${pixelIconHtml(pixelLayerUrls(person, k.away), 2)}</button>`;
    }).join('');
    const nClubs = all.filter((t) => !t.id.startsWith('n:')).length;
    return `${tabs}${sel ? panel(kitEditor(g, sel, px.side ?? 'home'), 'px-editor set-editor') : ''}
      ${TextField({ value: px.q, placeholder: '구단 · 대표팀', icon: 'search', input: { id: 'px-q', type: 'search', maxLength: 20 }, clearable: false })}
      <p class="set-count">구단 ${nClubs} · 대표팀 ${all.length - nClubs} · 바꾼 팀 ${Object.keys(g.pixelOverrides?.kits ?? {}).length}</p>
      <div class="real-list set-list">${rows || '<p class="small muted">찾는 팀이 없어요.</p>'}</div>`;
  }
  const all = worldPlayers(g);
  const hit = all.filter((p) => {
    if (px.team === 'x' ? p.teamId : px.team && p.teamId !== px.team) return false;
    return !qq || [p.nameKo, p.name ?? ''].some((x) => has(x, qq));
  });
  const list = hit.sort((a, b) => Number(!!b.mine) - Number(!!a.mine) || Number(!!g.pixelOverrides?.players?.[b.id]) - Number(!!g.pixelOverrides?.players?.[a.id])).slice(0, 30);
  const teamName = (p: (typeof all)[number]) => (p.teamId ? teamById(g.league, p.teamId)?.nameKo ?? p.teamId : `${clubKo(p.club)} · 리그 밖`);
  const rows = list.map((p) => {
    const own = !!g.pixelOverrides?.players?.[p.id];
    return `<button type="button" class="real-row px-row${p.id === px.sel ? ' is-on' : ''}" data-act="px-pick" data-id="${esc(p.id)}">${
      pixelIconHtml(pixelLayerUrls(playerPerson(g, p.id), homeKitOf(g, p.id)), 2)}<span class="grow"><b>${esc(p.nameKo)}${p.mine ? ' · 내 선수' : ''}</b><small>${esc(teamName(p))}${p.position ? ` · ${esc(p.position)}` : ''}</small></span><span class="po-chip set-state${own ? ' is-own' : ''}">${own ? '바꿈' : '자동'}</span></button>`;
  }).join('');
  const sel = px.sel ? all.find((p) => p.id === px.sel) : undefined;
  return `${tabs}${sel ? panel(pixelPersonEditor(g, sel.id, sel.nameKo), 'px-editor set-editor') : ''}
    <div class="nm-filter">${TextField({ value: px.q, placeholder: '선수 이름 (한글·영문)', icon: 'search', input: { id: 'px-q', type: 'search', maxLength: 20 }, clearable: false })}${teamSelect(g, 'px-team', px.team)}</div>
    <p class="set-count">${esc(teamFilterName(g, px.team))} · ${hit.length}명 · 바꾼 선수 ${Object.keys(g.pixelOverrides?.players ?? {}).length}명</p>
    <div class="real-list set-list">${rows || '<p class="small muted">찾는 이름이 없어요.</p>'}</div>`;
}

export interface FaceOnUI {
  tab: 'players' | 'clubs';
  q: string;
  /** 고른 선수·구단 키 (`p:<id>` / `t:<팀 id>`) */
  sel: string | null;
  /** 자르기 중 */
  crop: null | { key: string; name: string; slot: FaceSlot; src: string; zoom: number; x: number; y: number; /** 원본 크기 */ w: number; h: number };
}

interface Entry { key: string; name: string; sub: string; face?: FaceRef; team?: string; mine?: boolean }

/** 키로 선수·구단 찾기: 지금 게임(내 선수·로스터) → 실제 선수 데이터 → 구단 */
export function lookupEntry(g: GameState | null, key: string): Entry | null {
  const id = key.slice(2);
  if (key.startsWith('t:')) {
    const c = clubOf(id);
    return c ? { key, name: c.nameKo, sub: c.name, team: c.id } : null;
  }
  if (g) {
    const me = myFace(g);
    if (me.id === id) return { key, name: g.player.name, sub: `내 선수 · ${teamById(g.league, g.player.teamId).nameKo}`, face: me, mine: true };
    for (const [teamId, r] of Object.entries(g.rosters ?? {})) {
      const p = r.players.find((x) => x.id === id);
      if (p) return { key, name: p.nameKo, sub: `${teamById(g.league, teamId)?.nameKo ?? teamId} · ${p.position} · ${p.age}세`, face: { id, age: p.age, appearance: p.appearance } };
    }
    const n = g.npcs.find((x) => x.id === id);
    if (n) return { key, name: n.nameKo, sub: `${clubKo(n.club)} · ${n.position} · ${n.age}세`, face: { id, age: n.age, appearance: realAppearance(id, '') } };
  }
  const d = REAL_PLAYER_BY_ID.get(id);
  if (d) {
    const age = BALANCE.newGame.startYear - d.birthYear;
    return { key, name: d.nameKo, sub: `${clubKo(d.club)} · ${d.position} · ${age}세`, face: { id, age, appearance: realAppearance(id, d.nationality) } };
  }
  const saved = faceOnKeys().find((k) => k.key === key);
  return saved ? { key, name: saved.name, sub: '다른 게임의 선수', face: { id } } : null;
}

const has = (s: string, q: string): boolean => s.toLowerCase().includes(q);

function playerEntries(g: GameState | null, q: string): Entry[] {
  const out: Entry[] = [];
  const seen = new Set<string>();
  const push = (e: Entry | null): void => {
    if (e && !seen.has(e.key)) {
      seen.add(e.key);
      out.push(e);
    }
  };
  if (g) push(lookupEntry(g, `p:${myFace(g).id}`));
  const qq = q.trim().toLowerCase();
  if (!qq) {
    for (const k of faceOnKeys()) if (k.key.startsWith('p:')) push(lookupEntry(g, k.key));
    for (const p of A_GRADE_PLAYERS) push(lookupEntry(g, `p:${p.id}`));
    return out.slice(0, 40);
  }
  if (g) {
    for (const r of Object.values(g.rosters ?? {})) {
      for (const p of r.players) if (has(p.nameKo, qq) || has(p.name, qq)) push(lookupEntry(g, `p:${p.id}`));
    }
    if (has(g.player.name, qq)) push(lookupEntry(g, `p:${myFace(g).id}`));
  }
  for (const p of ALL_REAL_PLAYERS) if (has(p.nameKo, qq) || has(p.name, qq)) push(lookupEntry(g, `p:${p.id}`));
  return out.filter((e) => !e.mine || has(e.name, qq)).slice(0, 40);
}

function clubEntries(q: string): Entry[] {
  const qq = q.trim().toLowerCase();
  return ALL_CLUBS.filter((c) => !qq || has(c.nameKo, qq) || has(c.name, qq)).map((c) => ({ key: `t:${c.id}`, name: c.nameKo, sub: c.id.startsWith('x:') ? `${c.name} · 리그 밖` : c.name, team: c.id }));
}

/** 목록 오른쪽 칩 (디자인 68): 내 이미지 / 위키 사진·로고 / 기본·자동 */
function sourceChip(e: Entry): string {
  if (faceOnKeys().some((k) => k.key === e.key)) return '<span class="po-chip set-state is-own">내 이미지</span>';
  if (e.team) return `<span class="po-chip set-state">${repoCrest(e.team) ? '위키 로고' : '자동'}</span>`;
  return defaultFaceSrc(e.face!)?.startsWith('facepack/') ? '<span class="po-chip set-state">위키 사진</span>' : '<span class="set-state is-plain">기본</span>';
}

function row(e: Entry, sel: string | null): string {
  const pic = e.team ? Crest({ name: e.name, team: e.team, size: 32 }) : Avatar({ size: 40, face: e.face!, name: e.name });
  return `<button type="button" class="real-row fo-row${e.key === sel || e.mine ? ' is-on' : ''}" data-act="faceon-pick" data-key="${esc(e.key)}">${pic}<span class="grow"><b>${esc(e.name)}</b><small>${esc(e.sub)}</small></span>${sourceChip(e)}</button>`;
}

/** 페이스온 편집 (디자인 69): 프로필 줄 → 나이대 3칸 → 어디에 나와요 → 배경 없는 사진 → 세 칸 모두 지우기. 구단 = 엠블럼 한 칸 */
function editor(g: GameState | null, e: Entry): string {
  if (e.team) {
    const url = faceOnUrls(e.key).crest;
    const repo = repoCrest(e.team);
    return `${panel(`<div class="fo-edit"><div class="fo-big">${Crest({ name: e.name, team: e.team, size: 96 })}</div>
      <div class="grow"><b>${esc(e.name)}</b><small>${esc(e.sub)}</small><small class="hi">${url ? '내가 올린 엠블럼을 쓰고 있어요.' : repo ? '위키백과 로고를 쓰고 있어요.' : '자동 엠블럼(모양·팀 색·이니셜)을 쓰고 있어요.'}</small></div></div>`, 'fo-editor')}
      <div class="btn-row even">${Button({ block: true, icon: 'upload', act: 'faceon-upload', data: { key: e.key, slot: 'crest' }, children: url ? '다시 올리기' : '이미지 올리기' })}${
        url ? Button({ variant: 'secondary', block: true, icon: 'restore', act: 'faceon-clear', data: { key: e.key, slot: 'crest' }, children: '되돌리기' }) : ''}</div>
      <p class="small muted">순위표·경기 결과·이적 소식·팀 상세에 나와요. 이 브라우저에만 저장돼요.</p>`;
  }
  const urls = faceOnUrls(e.key);
  const face = e.face!;
  const age = face.age ?? 25;
  const cur = ageSlot(age);
  const fallback = defaultFaceSrc(face);
  const cells = AGE_SLOTS.map((sl) => {
    const u = urls[sl];
    return `<div class="fo-slot${sl === cur ? ' is-cur' : ''}"><span class="fo-slot__pic${u ? ' has-img' : ' is-empty'}">${u ? `<img src="${esc(u)}" alt="">` : '<i>비어 있음</i>'}</span><b>${AGE_SLOT_KO[sl]}</b>${sl === cur ? '<small class="hi">지금 나이</small>' : `<small>${sl === 'young' ? '어린 시절' : sl === 'veteran' ? '베테랑' : '전성기'}</small>`}
      <span class="fo-slot__btns">${Button({ size: 'sm', variant: 'ghost', icon: u ? undefined : 'upload', act: 'faceon-upload', data: { key: e.key, slot: sl }, children: u ? '바꾸기' : '올리기' })}${
        u ? Button({ size: 'sm', variant: 'ghost', act: 'faceon-clear', data: { key: e.key, slot: sl }, children: '지우기' }) : ''}</span></div>`;
  }).join('');
  const where = Object.keys(urls).length
    ? `지금 ${urls[cur] ? `${AGE_SLOT_KO[cur]} 칸` : '가까운 칸'} 이미지를 써요`
    : fallback ? (fallback.startsWith('facepack/') ? '위키백과 사진을 쓰고 있어요' : '기본 얼굴 이미지를 쓰고 있어요') : '기본 아바타를 쓰고 있어요';
  const n = Object.keys(urls).length;
  const club = e.mine && g ? g.player.teamId : e.team;
  return `${panel(`<div class="fo-edit">${Avatar({ size: 64, face, name: e.name, ring: true })}
    <div class="grow"><b>${esc(e.name)}</b><small>${esc(e.sub)}</small><small class="hi">${esc(where)}</small></div></div>`, 'fo-editor')}
    ${SectionTitle({ title: '나이대 칸' })}<p class="small muted fo-lead">나이에 맞는 칸을 쓰고, 비었으면 가까운 칸을 써요. 모두 지우면 ${fallback?.startsWith('facepack/') ? '위키백과 사진' : '원래 얼굴'}으로 돌아가요.</p>
    <div class="fo-slots">${cells}</div>
    ${panel(cutoutSwitch(e.key, face), 'fo-cutout')}
    ${panel(`<b class="small">어디에 나와요</b><div class="fo-where">${Avatar({ size: 48, face, name: e.name })}${Avatar({ size: 40, face, name: e.name, ring: true })}${Avatar({ size: 24, face, name: e.name })}<small class="muted">홈 카드 · 선수 화면 · 경기 결과 · 순위표 · 이적 소식 · 경기 얼굴 마커</small></div>`, 'fo-where-panel')}
    ${n ? `<button type="button" class="fo-clear-all" data-act="faceon-clear" data-key="${esc(e.key)}">${Icon({ name: 'restore', size: 16 })}세 칸 모두 지우기</button>` : ''}
    ${club ? clubSlot(club) : ''}`;
}

/** 배경 없는 사진 켬끔 (디자인 174): 내가 올린 이미지에만 켤 수 있다. 올린 게 없으면 지금 머리말 상태를 끈 채로 보여 준다 */
function cutoutSwitch(key: string, face: FaceRef): string {
  const own = Object.keys(faceOnUrls(key)).length > 0;
  const on = own ? faceOnCutout(key) : !!heroFaceOf(face)?.cutout;
  return Switch({
    label: '배경 없는 사진', on, act: 'faceon-cutout', data: { key }, disabled: !own,
    desc: own ? '켜면 홈·선수 머리말에 사진을 오려 낸 그대로 세워요. 끄면 네모 사진으로 보여요.' : '켜면 홈·선수 머리말에 사진을 오려 낸 그대로 세워요. 내 이미지를 올리면 켜고 끌 수 있어요.',
  });
}

/** 구단 편집은 한 칸 (디자인 174): 선수 편집 아래 그 선수 구단 엠블럼 한 칸(나이대 없음) */
function clubSlot(teamId: string): string {
  const c = clubOf(teamId);
  if (!c) return '';
  const key = `t:${c.id}`;
  const url = faceOnUrls(key).crest;
  const note = url ? '내가 올린 엠블럼을 쓰고 있어요.' : repoCrest(c.id) ? '구단은 나이대가 없어 한 칸만 써요. 지금 위키백과 로고.' : '구단은 나이대가 없어 한 칸만 써요. 지금 자동 엠블럼.';
  return `${SectionTitle({ title: '구단 편집은 한 칸' })}
    ${panel(`<div class="fo-edit"><span class="fo-crest">${Crest({ name: c.nameKo, team: c.id, size: 56 })}</span><div class="grow"><b>${esc(c.nameKo)} · 엠블럼</b><small>${esc(note)}</small></div></div>
      <div class="btn-row even fo-club-btns">${Button({ variant: 'secondary', block: true, icon: 'upload', act: 'faceon-upload', data: { key, slot: 'crest' }, children: url ? '바꾸기' : '올리기' })}${
        Button({ variant: 'ghost', block: true, act: 'faceon-clear', data: { key, slot: 'crest' }, disabled: !url, children: '지우기' })}</div>`, 'fo-club')}`;
}

/** 페이스온 목록 (디자인 68): [선수 | 구단] → 검색 → 우선순위 안내 → 목록 */
function faceOnList(g: GameState | null, fo: FaceOnUI): string {
  const st = faceStats();
  const tabs = Tabs({ items: [{ id: 'players', label: '선수' }, { id: 'clubs', label: '구단' }], value: fo.tab, act: 'faceon-tab', fill: true, label: '선수/구단' });
  const list = fo.tab === 'players' ? playerEntries(g, fo.q) : clubEntries(fo.q);
  return `${tabs}
    ${TextField({ value: fo.q, placeholder: fo.tab === 'players' ? '선수 이름 (한글·영문)' : '구단 이름', icon: 'search', input: { id: 'fo-q', type: 'search', maxLength: 20 }, clearable: false })}
    ${panel(`<b class="small">이미지 우선순위</b><p class="small muted">내가 올린 이미지 → 위키백과 사진·로고(선수 ${st.photos}명, 구단 ${st.clubs}개) → 기본 얼굴(${st.base}개) → 기본 아바타·자동 엠블럼. 도트 얼굴(캐릭터 보기) ${st.pixel}개.</p>`, 'fo-prio')}
    ${g && fo.tab === 'players' ? panel(cutoutSwitch(`p:${myFace(g).id}`, myFace(g)), 'fo-cutout') : ''}
    <div class="real-list set-list">${list.map((e) => row(e, fo.sel)).join('') || '<p class="small muted">찾는 이름이 없어요.</p>'}</div>`;
}

const foRangeText = (id: 'fo-zoom' | 'fo-x' | 'fo-y', n: number): string => {
  if (id === 'fo-zoom') return `${(n / 100).toFixed(1)}배`;
  if (!n) return '가운데';
  return id === 'fo-x' ? `${n > 0 ? '오른쪽' : '왼쪽'} ${Math.abs(n)}%` : `${n > 0 ? '아래로' : '위로'} ${Math.abs(n)}%`;
};
export { foRangeText };

/** 위치 맞추기 (디자인 70): 정사각형 미리보기(체크무늬 = 투명) + 얼굴 마커 원 안내 + 슬라이더 3(값 글) */
function cropSheet(c: NonNullable<FaceOnUI['crop']>): string {
  const club = c.slot === 'crest';
  const z = Math.round(c.zoom * 100);
  const x = Math.round(c.x * 100);
  const y = Math.round(c.y * 100);
  return `<div class="po-overlay po-overlay--sheet"><div class="po-sheet fo-crop" role="dialog" aria-modal="true" aria-label="이미지 위치 맞추기"><span class="po-sheet__grip" aria-hidden="true"></span>
    <div class="po-sheet__head"><span class="po-sheet__eyebrow">${club ? '엠블럼' : `얼굴 · ${AGE_SLOT_KO[c.slot as keyof typeof AGE_SLOT_KO]} 칸`}</span><b>${esc(c.name)} · 위치 맞추기</b></div>
    <div class="po-sheet__body">
      <div class="fo-crop__stage"><div class="fo-crop__prev"><img id="fo-prev" src="${esc(c.src)}" alt="" style="${cropStyle(c)}">${club ? '' : '<i class="fo-crop__ring" aria-hidden="true"></i><span class="fo-crop__tag">원 = 얼굴 마커로 잘리는 곳</span>'}</div></div>
      <p class="small muted fo-crop__note">체크무늬 = 투명한 곳. 정사각형 그대로 카드·목록에 쓰고${club ? '' : ', 원은 경기 화면 얼굴 마커예요'}. 배경이 투명한 PNG면 얼굴만, JPG면 사각 이미지 그대로 보여요.</p>
      ${rangeRow('fo-zoom', '확대', 100, 300, z, foRangeText('fo-zoom', z), ['1배', '3배'])}
      ${rangeRow('fo-y', '위아래', -100, 100, y, foRangeText('fo-y', y), ['위', '아래'])}
      ${rangeRow('fo-x', '좌우', -100, 100, x, foRangeText('fo-x', x), ['왼쪽', '오른쪽'])}
    </div>
    <div class="po-sheet__foot"><div class="btn-row even">${Button({ variant: 'secondary', size: 'lg', block: true, act: 'faceon-crop-cancel', children: '취소' })}${Button({ size: 'lg', block: true, icon: 'check', act: 'faceon-crop-save', children: '저장' })}</div></div>
  </div></div>`;
}

/** 정사각형 미리보기 안 이미지 자리 (squareToBlob 과 같은 식) */
export function cropStyle(c: { zoom: number; x: number; y: number; slot: FaceSlot; w: number; h: number }): string {
  const l = squareLayout(c.w, c.h, c, c.slot === 'crest' ? 'center' : 'bottom');
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  return `left:${pct(l.x)};top:${pct(l.y)};width:${pct(l.w)};height:${pct(l.h)}`;
}

// ── 설정 화면 틀 (C.59): 첫 화면 = 접는 섹션 + 이동 칩, 꾸미기 하위 화면 4개 ──

export type SetPage = 'main' | 'names' | 'pixel' | 'faceon' | 'cardart';
export type SetSec = 'play' | 'view' | 'look' | 'saves' | 'pack';
/** 설정 화면 상태: 보고 있는 화면, 펼친 섹션 (하나만, null = 모두 접힘) */
export interface SetUI { page: SetPage; open: SetSec | null }
export const SET_UI_DEFAULT: SetUI = { page: 'main', open: 'play' };

const SECTIONS: { id: SetSec; label: string; title: string }[] = [
  { id: 'play', label: '경기 진행', title: '경기 진행' }, { id: 'view', label: '화면 보기', title: '경기 화면 보기' }, { id: 'look', label: '꾸미기', title: '꾸미기' },
  { id: 'saves', label: '저장·안내', title: '저장과 안내' }, { id: 'pack', label: '페이스팩', title: '페이스팩 (zip)' },
];
export const SET_PAGES: { id: Exclude<SetPage, 'main'>; label: string; icon: IconName }[] = [
  { id: 'names', label: '선수 이름', icon: 'edit' }, { id: 'pixel', label: '경기 아이콘', icon: 'grid' }, { id: 'faceon', label: '페이스온', icon: 'face' }, { id: 'cardart', label: '카드 이미지', icon: 'card' },
];

/** 접는 섹션 (디자인 66·67): 머리(제목 · 요약 · 편집 표시 · 펼침 단추). 잠기면 "경기 중 잠김" + 자물쇠, 펼치지 않음 */
function section(id: SetSec, sub: string, open: boolean, body: string, locked = false): string {
  const t = SECTIONS.find((x) => x.id === id)!;
  const on = open && !locked;
  return `<section class="set-sec${on ? ' is-open' : ''}${locked ? ' is-locked' : ''}" id="set-${id}">
    <button type="button" class="set-sec__head" data-act="set-toggle" data-v="${id}" aria-expanded="${on}"${locked ? ' disabled' : ''}>
      <span class="grow"><b>${t.title}</b><small>${esc(sub)}</small></span>${
      locked ? `<span class="po-chip set-lock">경기 중 잠김</span><span class="set-sec__chev">${Icon({ name: 'lock', size: 16 })}</span>` : `<span class="set-sec__chev">${Icon({ name: 'chevron-down', size: 18 })}</span>`}</button>
    <div class="set-sec__body"${on ? '' : ' hidden'}>${locked ? '' : body}</div></section>`;
}

const DIFF_KO: Record<string, string> = { easy: '쉬움', normal: '보통', hard: '어려움' };

/** 다른 경기 미리 계산 보관 상태 (C.76m): 화면이 렌더 직전에 넣는다. null = 워커 없음(메인 스레드) */
let precompute: { ready: number; total: number } | null = null;
export function setPrecomputeStatus(s: { ready: number; total: number } | null): void {
  precompute = s;
}
const STOP_KO: Record<string, string> = { all: '모든 순간', important: '중요한 순간만', critical: '결정적 순간만' };

function mainPage(g: GameState | null, set: SetUI, version: VersionVM, locked: boolean, ca: CardArtUI): string {
  const hero = HeroPanel({
    title: '설정', back: { act: 'go', data: { to: g ? 'home' : 'title' } }, eyebrow: '게임 설정 · 꾸미기', compact: true,
    chips: [g ? `${g.player.name}` : '게임 밖', { label: locked ? '경기 중 · 일부 잠김' : '이 브라우저에 저장', soft: true }],
  });
  const open = (id: SetSec) => set.open === id;
  const jump = Tabs({ items: SECTIONS.map((x) => ({ id: x.id, label: x.label })), value: set.open ?? '', act: 'set-open', scroll: true, label: '설정 섹션 이동' });
  const play = g
    ? `<div class="kv"><span>내 선수 결정</span><span class="muted small">${g.control.mode === 'direct' ? '결정 순간마다 멈춰요' : '엔진이 대신 결정해요'}</span></div>
      ${Tabs({ items: [{ id: 'direct', label: '직접' }, { id: 'auto', label: '자동' }], value: g.control.mode, act: 'ctl-mode', fill: true, label: '직접/자동' })}
      ${g.control.mode === 'direct' ? `<div class="kv"><span>정지 빈도</span></div>${Tabs({ items: [{ id: 'all', label: '모든 순간' }, { id: 'important', label: '중요한 순간만' }, { id: 'critical', label: '결정적 순간만' }], value: g.control.stop, act: 'ctl-stop', fill: true, label: '정지 빈도' })}` : ''}
      <div class="kv"><span>다른 경기 계산</span></div>${Tabs({ items: [{ id: 'engine', label: '전체 엔진' }, { id: 'quick', label: '빠른 진행' }], value: g.options.quickOthers ? 'quick' : 'engine', act: 'opt-quick', fill: true, label: '다른 경기 계산' })}
      <p class="small muted">${g.options.quickOthers ? '느린 기기용: 다른 팀 경기와 고른 다른 리그 경기를 통계로 바로 계산해요. 득점 순위는 내 경기와 득점자 추첨만 남아요.' : `다른 팀 경기${(g.otherLeagues?.length ?? 0) ? `와 고른 다른 리그 ${g.otherLeagues!.length}개 경기` : ''}도 22명 엔진으로 계산해요(워커 병렬). 홈·다른 화면에 있거나 내 경기를 보는 동안 앞으로 3일치를 미리 계산해 두어 날짜 넘김이 빨라져요(같은 결과).${precompute ? ` 지금 미리 계산 ${precompute.ready}/${precompute.total}경기.` : ' 이 기기는 워커가 없어 미리 계산하지 않아요.'}`}</p>
      <div class="kv set-kv"><span>난이도</span><span><b>${DIFF_KO[g.difficulty] ?? g.difficulty}</b><small class="muted"> · 새 게임에서 정해요</small></span></div>`
    : '<p class="small muted">경기 진행 설정은 게임을 시작하거나 불러오면 보여요.</p>';
  const playSub = g ? [g.control.mode === 'direct' ? '직접' : '자동', ...(g.control.mode === 'direct' ? [STOP_KO[g.control.stop] ?? ''] : []), g.options.quickOthers ? '빠른 진행' : '전체 엔진', DIFF_KO[g.difficulty] ?? ''].join(' · ') : '게임 밖';
  const pv = `<div class="kv"><span>선수 표시</span></div>${Tabs({ items: (['number', 'face', 'character'] as const).map((k) => ({ id: k, label: PITCH_VIEW_KO[k] })), value: pitchView(), act: 'pv-set', fill: true, label: '선수 표시' })}
    <div class="set-orient"><div class="kv"><b>경기 화면 방향</b><small class="muted">결정 순간 · 하이라이트</small></div>${Tabs({ items: (['landscape', 'portrait'] as const).map((k) => ({ id: k, label: PITCH_ORIENT_KO[k] })), value: pitchOrient(), act: 'po-orient', fill: true, label: '경기 화면 방향' })}
      <p class="small muted">${PITCH_ORIENT_KO.landscape} = 폰을 세로로 들어도 피치는 가로(왼쪽 → 오른쪽 공격). ${PITCH_ORIENT_KO.portrait} = 세로 피치(내 팀이 아래 → 위).</p></div>
    <div class="kv"><span>선수 크기</span></div>${Tabs({ items: (['normal', 'large', 'xlarge'] as const).map((k) => ({ id: k, label: PITCH_SIZE_KO[k] })), value: pitchSize(), act: 'po-size', fill: true, label: '선수 크기' })}
    <div class="kv"><span>이름 표시</span></div>${Tabs({ items: (['all', 'mine', 'off'] as const).map((k) => ({ id: k, label: PITCH_NAMES_KO[k] })), value: pitchNames(), act: 'po-names', fill: true, label: '이름 표시' })}
    <p class="small muted">이 기기에 저장돼요. 경기 결과에는 영향이 없어요. 경기 화면의 [보기]로도 바꿔요.</p>`;
  const pvSub = `${PITCH_VIEW_KO[pitchView()]} · 방향 ${PITCH_ORIENT_KO[pitchOrient()]} · ${PITCH_SIZE_KO[pitchSize()]} · 이름 ${PITCH_NAMES_KO[pitchNames()]}`;
  const counts = lookCounts(g);
  const links = SET_PAGES.map((pg) => `<button type="button" class="set-link" data-act="set-page" data-v="${pg.id}"><span class="set-link__icon">${Icon({ name: pg.icon, size: 18 })}</span><span class="grow"><b>${pg.label}</b><small>${esc(counts[pg.id])}</small></span><span class="set-link__go">편집${Icon({ name: 'chevron-right', size: 16 })}</span></button>`).join('');
  const look = `<div class="kv"><span>화면 스타일</span></div>${Tabs({ items: (['b', 'a'] as const).map((k) => ({ id: k, label: SKIN_KO[k] })), value: skin(), act: 'skin-set', fill: true, label: '화면 스타일' })}
    <p class="small muted">B = 꺾인 모서리·이탤릭 숫자(기본) · A = 둥근 알약 모양. 색과 화면 내용은 같아요. 이 기기에 저장돼요.</p>
    <div class="kv"><span>팩 개봉 연출</span></div>${Tabs({ items: (['full', 'short', 'off'] as const).map((k) => ({ id: k, label: PACK_ANIM_PREF_KO[k] })), value: loadPackAnimPref(), act: 'pack-anim-set', fill: true, label: '팩 개봉 연출' })}
    <p class="small muted">카드팩·카드 선택권을 열 때 연출이에요. 움직임 줄이기를 켠 기기는 '전체'도 짧게 보여요. 결과·확률과는 무관해요.</p>
    <div class="kv"><span>연출 미리보기</span><small class="muted">카드·세이브는 그대로예요</small></div><div class="btn-row even">${(['common', 'rare', 'epic', 'legendary'] as const).map((r) => Button({ variant: 'secondary', size: 'sm', act: 'pack-anim-demo', data: { v: r }, children: PACK_RARITY_KO[r] })).join('')}${Button({ variant: 'secondary', size: 'sm', act: 'pack-anim-demo', data: { v: 'legendary', k: 'pick' }, children: '선택권' })}</div>
    <small class="set-links__label">하위 화면</small><div class="set-links">${links}</div>`;
  const lookSub = `스타일 ${SKIN_KO[skin()]} · 팩 연출 ${PACK_ANIM_PREF_KO[loadPackAnimPref()]} · 선수 이름 · 경기 아이콘 · 페이스온 · 카드 이미지`;
  const saves = `<div class="kv"><span>세이브 관리</span>${Button({ variant: 'secondary', size: 'sm', icon: 'disk', act: 'go', data: { to: 'saves' }, children: '저장·불러오기·파일' })}</div>
    <div class="kv"><span>첫 플레이 안내</span>${Button({ variant: 'ghost', size: 'sm', act: 'tips-reset', children: '안내 다시 보기' })}</div>${
    // C.73d: 초기화면(타이틀)으로. 자동 저장 뒤 나간다. 경기 중에는 숨긴다
    g && !locked ? `<div class="kv"><span>초기화면</span>${Button({ variant: 'secondary', size: 'sm', icon: 'home', act: 'to-title', children: '초기화면으로' })}</div>` : ''}`;
  const st = faceStats();
  const pack = `<p class="small">내가 올린 이미지(카드 이미지 포함, <b>cards/</b> 폴더)를 zip 하나로 내보내 다른 기기에서 가져올 수 있어요. 직접 만든 zip도 돼요: <b>players/선수이름.png</b>(나이대 칸은 <b>선수이름@young</b>·<b>@prime</b>·<b>@veteran</b>), <b>clubs/구단이름.png</b>. 이름은 한글·영문 모두 돼요.</p>
    <div class="btn-row even">${Button({ variant: 'secondary', size: 'sm', block: true, icon: 'download', act: 'facepack-export', disabled: st.faceOn === 0 && userArtCount() === 0, children: 'zip 내보내기' })}${Button({ variant: 'secondary', size: 'sm', block: true, icon: 'upload', act: 'facepack-import', children: 'zip 가져오기' })}</div>`;
  // PC (C.61 디자인 152): 왼쪽 섹션 목록 | 오른쪽 고른 섹션 하나(펼친 채). 꾸미기 하위 4개는 목록에 바로
  if (isWide()) {
    const cur: SetSec = set.open ?? 'play';
    const bodies: Record<SetSec, [string, string, boolean?]> = {
      play: [playSub, play, locked && !!g], view: [pvSub, pv], look: [lookSub, look],
      saves: [`세이브 관리 · 첫 플레이 안내 다시 보기${g && !locked ? ' · 초기화면으로' : ''}`, saves], pack: [`이미지 묶음 내보내기 · 가져오기 · 내 이미지 ${st.faceOn}건 · 내 그림 ${userArtCount()}장`, pack],
    };
    const [sub, body, lk] = bodies[cur];
    return `${hero}<div class="body set-body">${pc2(setNav('main', cur), `${locked ? Banner({ tone: 'warning', title: '경기 중이에요', children: '경기 진행 설정은 경기가 끝나면 바꿀 수 있어요. 화면 보기·꾸미기는 지금도 돼요.' }) : ''}${
      section(cur, sub, true, body, lk ?? false)}<input type="file" id="fp-file" accept=".zip,application/zip" hidden>${versionFooter(version)}`, 'set-pc')}</div>${cardArtOverlay(ca)}`;
  }
  return `${hero}<div class="body set-body">
    ${jump}
    ${locked ? Banner({ tone: 'warning', title: '경기 중이에요', children: '경기 진행 설정은 경기가 끝나면 바꿀 수 있어요. 화면 보기·꾸미기는 지금도 돼요.' }) : ''}
    ${section('play', playSub, open('play'), play, locked && !!g)}
    ${section('view', pvSub, open('view'), pv)}
    ${section('look', lookSub, open('look'), look)}
    ${section('saves', '세이브 관리 · 첫 플레이 안내 다시 보기', open('saves'), saves)}
    ${section('pack', `이미지 묶음 내보내기 · 가져오기 · 내 이미지 ${st.faceOn}건 · 내 그림 ${userArtCount()}장`, open('pack'), pack)}
    <input type="file" id="fp-file" accept=".zip,application/zip" hidden>
    ${versionFooter(version)}
  </div>${cardArtOverlay(ca)}`;
}

/** 꾸미기 줄 요약 (몇 개 바꿨는지) */
function lookCounts(g: GameState | null): Record<Exclude<SetPage, 'main'>, string> {
  const st = faceStats();
  const nick = g ? Object.values(g.nameOverrides).filter((o) => o.nickname || o.shortName).length : 0;
  const pxP = Object.keys(g?.pixelOverrides?.players ?? {}).length;
  const pxK = Object.keys(g?.pixelOverrides?.kits ?? {}).length;
  return {
    names: g ? `경기 화면 이름표 · 별명·짧은 이름 ${nick}명` : '게임을 시작하면 바꿀 수 있어요',
    pixel: g ? `캐릭터 보기 인물·유니폼 · 바꾼 선수 ${pxP} · 바꾼 팀 ${pxK}` : '게임을 시작하면 바꿀 수 있어요',
    faceon: `내 이미지 ${st.faceOn}건 · 위키백과 사진 ${st.photos}명 · 로고 ${st.clubs}개`,
    cardart: `내 그림 ${userArtCount()}장 · 카드 ${CARDS_N()}장`,
  };
}

/** PC 설정 왼쪽 목록 (C.61 디자인 152): 섹션 5개, 꾸미기 아래에 하위 화면 4개. 지금 자리 = 라임 */
function setNav(page: SetPage, open: SetSec | null): string {
  const item = (on: boolean, act: string, v: string, label: string, sub = false) =>
    `<button type="button" class="set-nav__item${sub ? ' is-sub' : ''}${on ? ' is-on' : ''}" data-act="${act}" data-v="${v}"${on ? ' aria-current="page"' : ''}>${esc(label)}</button>`;
  return `<nav class="panel set-nav" aria-label="설정 목록">${SECTIONS.map((x) => item(page === 'main' && open === x.id, 'set-nav', x.id, x.title)
    + (x.id === 'look' ? `<small class="set-nav__group">꾸미기 · 하위 화면 4개</small>${SET_PAGES.map((pg) => item(page === pg.id, 'set-page', pg.id, pg.label, true)).join('')}` : '')).join('')}
    <div class="set-nav__ver"><span>버전</span><b class="po-num">${esc(PATCH_LABEL)}</b></div></nav>`;
}

/** 하위 화면 머리말 + 꾸미기 이동 칩 4 (디자인 71·137·140). PC(C.61)는 이동 칩 대신 왼쪽 설정 목록 */
function subPage(page: Exclude<SetPage, 'main'>, eyebrow: string, chips: (string | { label: string; soft?: boolean })[], body: string, title?: string): string {
  const t = title ?? SET_PAGES.find((x) => x.id === page)!.label;
  const hero = HeroPanel({ title: t, back: { act: 'set-back' }, eyebrow, compact: true, chips });
  if (isWide()) return `${hero}<div class="body set-body set-sub set-sub--${page}">${pc2(setNav(page, null), body, 'set-pc')}</div>`;
  const nav = Tabs({ items: SET_PAGES.map((x) => ({ id: x.id, label: x.label })), value: page, act: 'set-page', scroll: true, label: '꾸미기 이동' });
  return `${hero}<div class="body set-body set-sub set-sub--${page}">${nav}${body}</div>`;
}

export function settingsView(
  g: GameState | null, fo: FaceOnUI, version: VersionVM, nm: NameUI = { q: '', team: '', sel: null },
  px: PixelUI = { tab: 'players', q: '', team: '', sel: null, kitSel: null },
  ca: CardArtUI = CARD_ART_UI_DEFAULT, locked = false, set: SetUI = SET_UI_DEFAULT,
): string {
  const page = set.page;
  if (page === 'names') {
    const nick = g ? Object.values(g.nameOverrides).filter((o) => o.nickname || o.shortName).length : 0;
    return subPage('names', '경기 화면 이름표 · 별명 · 짧은 이름', [`별명 ${nick}명`, { label: '이 세이브에 저장', soft: true }], nameSection(g, nm));
  }
  if (page === 'pixel') {
    const n = px.tab === 'kits' ? `바꾼 팀 ${Object.keys(g?.pixelOverrides?.kits ?? {}).length}` : `바꾼 선수 ${Object.keys(g?.pixelOverrides?.players ?? {}).length}명`;
    return subPage('pixel', '설정 · 꾸미기 · 캐릭터 보기 인물·유니폼', [n, { label: '이 세이브에 저장', soft: true }], pixelSection(g, px));
  }
  if (page === 'faceon') {
    const sel = fo.sel ? lookupEntry(g, fo.sel) : null;
    const st = faceStats();
    const body = sel ? editor(g, sel) : faceOnList(g, fo);
    return `${subPage('faceon', sel ? `${sel.team ? '구단' : '선수'} · ${sel.name}` : '얼굴 · 엠블럼 바꾸기', [`내 이미지 ${st.faceOn}건`, { label: '이 브라우저에만 저장', soft: true }], body)}<input type="file" id="fo-file" accept="image/*" hidden>${fo.crop ? cropSheet(fo.crop) : ''}`;
  }
  if (page === 'cardart') {
    const h = cardArtHero(ca, locked);
    return `${subPage('cardart', h.eyebrow, h.chips, cardArtSection(ca, locked))}${cardArtOverlay(ca)}`;
  }
  return mainPage(g, set, version, locked, ca);
}
