// 설정 (pending 49, 부록 C.43): 흩어져 있던 설정 모음(경기 진행·정지 빈도·다른 경기 계산·세이브·안내) + 페이스온
// (선수·구단 이미지를 올려 바꾸기, 나이대 칸, 원형 자르기, 페이스팩 zip). 페이스온 이미지는 이 브라우저(IndexedDB)에만 남는다

import { A_GRADE_PLAYERS } from '../../../data/players';
import { realAppearance } from '../../appearance';
import { BALANCE } from '../../config/balance';
import type { GameState } from '../../game';
import { clubKo, teamById } from '../../league';
import { Avatar, Button, Crest, esc, HeroPanel, SectionTitle, Tabs } from '../components';
import {
  AGE_SLOT_KO, AGE_SLOTS, ageSlot, ALL_CLUBS, clubOf, defaultFaceSrc, faceOnKeys, faceOnUrls, faceStats, repoCrest, squareLayout, type FaceRef, type FaceSlot,
} from '../faces';
import { myFace, type VersionVM } from '../viewModels';
import { panel, versionFooter } from './common';
import {
  pitchNames, PITCH_NAMES_KO, pitchOrient, PITCH_ORIENT_KO, pitchSize, PITCH_SIZE_KO, pitchView, PITCH_VIEW_KO,
} from '../pitch/renderer';
import { autoShortNames, worldPlayers } from '../playerNames';
import { NATION_KITS } from '../../../data/kits';
import { PIXEL_KITS } from '../../../data/pixelPack';
import { ALL_KITS, allPeople, kitFor, personKey, tableKit, validPerson } from '../../pixel';
import { pixelLayerUrls } from '../faces';
import { homeKitOf, peopleTable, pixelIconHtml, playerAutoPerson, playerPerson } from '../pixelIcons';
import { CARD_ART_UI_DEFAULT, cardArtOverlay, cardArtSection, type CardArtUI } from './cardArtSettings';
import { userArtCount } from '../cardArt';
import { skin, SKIN_KO } from '../skin';

/** 설정 → 선수 이름 (부록 C.44a): 검색어, 팀 거르기('' 전체, 'x' 리그 밖), 고른 선수 id */
export interface NameUI { q: string; team: string; sel: string | null }

/** 이름 고치기 칸 (설정·선수 화면 공용): 풀네임·자동 짧은 이름, 별명·짧은 이름 입력 */
export function nameEditor(g: GameState, id: string): string {
  const p = worldPlayers(g).find((x) => x.id === id);
  if (!p) return '';
  const auto = autoShortNames(g).get(id) ?? p.nameKo;
  const o = g.nameOverrides[id] ?? {};
  const label = o.nickname || o.shortName || auto;
  return `<div class="nm-edit">
    <div class="kv"><span>풀네임</span><b>${esc(p.nameKo)}</b></div>
    <div class="kv"><span>경기 화면 라벨</span><b class="hi">${esc(label)}</b></div>
    <label class="field nm-field"><span>별명</span><input type="text" id="nm-nick" maxlength="16" value="${esc(o.nickname ?? '')}" placeholder="없음 (직접 쓰기)" autocomplete="off"></label>
    <label class="field nm-field"><span>짧은 이름</span><input type="text" id="nm-short" maxlength="16" value="${esc(o.shortName ?? '')}" placeholder="${esc(auto)} (자동)" autocomplete="off"></label>
    <div class="btn-row even">${Button({ size: 'sm', block: true, icon: 'check', act: 'nm-save', data: { id }, children: '저장' })}${
      o.nickname || o.shortName ? Button({ variant: 'secondary', size: 'sm', block: true, icon: 'restore', act: 'nm-clear', data: { id }, children: '되돌리기' }) : ''}</div>
    <p class="small muted">경기 화면 이름표 = 별명 > 짧은 이름. 비워 두면 자동 짧은 이름(유명한 이름, 같은 이름이 여럿이면 첫 글자)을 써요. 이 세이브에 저장돼요.</p>
  </div>`;
}

function nameSection(g: GameState | null, nm: NameUI): string {
  if (!g) return panel('<p class="small muted">선수 이름은 게임을 시작하거나 불러오면 바꿀 수 있어요.</p>');
  const auto = autoShortNames(g);
  const qq = nm.q.trim().toLowerCase();
  const all = worldPlayers(g);
  const list = all.filter((p) => {
    if (nm.team === 'x' ? p.teamId : nm.team && p.teamId !== nm.team) return false;
    if (!qq) return true;
    const o = g.nameOverrides[p.id];
    return [p.nameKo, p.name ?? '', auto.get(p.id) ?? '', o?.nickname ?? '', o?.shortName ?? ''].some((x) => has(x, qq));
  }).sort((a, b) => Number(!!b.mine) - Number(!!a.mine) || Number(!!g.nameOverrides[b.id]) - Number(!!g.nameOverrides[a.id])).slice(0, 30);
  const teamName = (p: (typeof all)[number]) => (p.teamId ? teamById(g.league, p.teamId)?.nameKo ?? p.teamId : `${clubKo(p.club)} · 리그 밖`);
  const rows = list.map((p) => {
    const o = g.nameOverrides[p.id];
    const tag = o?.nickname ? `별명 ${o.nickname}` : o?.shortName ? `짧은 이름 ${o.shortName}` : auto.get(p.id) ?? '';
    return `<button type="button" class="real-row nm-row${p.id === nm.sel ? ' is-on' : ''}" data-act="nm-pick" data-id="${esc(p.id)}"><span class="grow"><b>${esc(p.nameKo)}${p.mine ? ' · 내 선수' : ''}</b><small>${esc(teamName(p))}</small></span><span class="po-chip${o ? ' po-chip--brand' : ''}">${esc(tag)}</span></button>`;
  }).join('');
  const teams = `<option value="">모든 팀</option>${g.league.teams.map((t) => `<option value="${esc(t.id)}"${nm.team === t.id ? ' selected' : ''}>${esc(t.nameKo)}</option>`).join('')}<option value="x"${nm.team === 'x' ? ' selected' : ''}>리그 밖</option>`;
  return `${panel(`<p class="small">경기 화면에서 선수 아래 따라다니는 이름표를 바꿔요. 모든 선수(실제·생성·내 선수)에 별명을 붙이거나 짧은 이름을 고칠 수 있어요. 다른 화면은 풀네임 그대로예요.</p>`)}
    ${nm.sel ? panel(nameEditor(g, nm.sel), 'nm-editor') : ''}
    <div class="nm-filter"><label class="field fo-search"><span aria-hidden="true">🔍</span><input type="search" id="nm-q" value="${esc(nm.q)}" placeholder="선수 이름 (한글·영문·별명)" autocomplete="off"></label>
    <select id="nm-team" class="nm-team" aria-label="팀 거르기">${teams}</select></div>
    <div class="real-list fo-list">${rows || '<p class="small muted">찾는 이름이 없어요.</p>'}</div>`;
}

// ── 경기 아이콘 (부록 C.45, pixel-kits.md 5.1): 모든 선수의 인물(피부·머리)과 구단·대표팀 홈·원정 유니폼을 직접 바꾸기. 세이브 pixelOverrides ──

/** 설정 → 경기 아이콘: 탭, 검색어, 팀 거르기, 고른 선수 id, 고른 팀 id (대표팀 `n:<국가>`) */
export interface PixelUI { tab: 'players' | 'kits'; q: string; team: string; sel: string | null; kitSel: string | null }

/** 유니폼 미리보기에 입히는 인물 */
const PREVIEW_PERSON = { skin: 'white', hair: 'brown' };
/** 유니폼 이름 (팩 키에서: C01_solid_red → red, S01_juventus → juventus) */
const kitLabel = (k: string): string => {
  const key = PIXEL_KITS[k]?.key ?? k;
  return `${k} ${key.replace(/^[CS]\d+_(solid_)?/, '').replace(/_/g, ' ')}`;
};

/** 선수 인물 고르기 (설정·선수 화면 공용): 지금 아이콘(구단 홈 유니폼) → 인물 14종 격자 → 자동으로 되돌리기 */
export function pixelPersonEditor(g: GameState, id: string, name: string): string {
  const kit = homeKitOf(g, id);
  const cur = playerPerson(g, id);
  const auto = playerAutoPerson(g, id);
  const own = !!g.pixelOverrides?.players?.[id];
  const cells = allPeople(peopleTable()).map((p) => {
    const on = personKey(p) === personKey(cur);
    return `<button type="button" class="px-cell${on ? ' is-on' : ''}" data-act="px-person" data-id="${esc(id)}" data-key="${esc(personKey(p))}" aria-pressed="${on}">${pixelIconHtml(pixelLayerUrls(p, kit), 3)}${
      personKey(p) === personKey(auto) ? '<small>자동</small>' : '<small>&nbsp;</small>'}</button>`;
  }).join('');
  return `<div class="px-edit">
    <div class="fo-edit"><div class="fo-big px-big">${pixelIconHtml(pixelLayerUrls(cur, kit), 4, name)}</div>
      <div class="grow"><b>${esc(name)}</b><small class="muted">${own ? '직접 고른 아이콘이에요.' : '자동으로 정한 아이콘이에요.'} 소속 구단 홈 유니폼으로 보여요.</small></div></div>
    <div class="px-grid">${cells}</div>
    ${own ? Button({ variant: 'secondary', size: 'sm', block: true, icon: 'restore', act: 'px-auto', data: { id }, children: '자동으로 되돌리기' }) : ''}
    <p class="small muted">경기 화면 [보기] → 캐릭터에서 쓰여요. 유니폼은 경기마다 자동으로 입혀요(원정·GK 포함). 겉모습만 바뀌고 경기 결과에는 영향이 없어요. 이 세이브에 저장돼요.</p>
  </div>`;
}

/** 선수 화면: 내 선수 경기 아이콘 → 설정의 같은 선택창 */
export function myPixelCard(g: GameState): string {
  const id = myFace(g).id;
  const kit = homeKitOf(g, id);
  return panel(`<div class="fo-edit"><div class="fo-big px-big">${pixelIconHtml(pixelLayerUrls(playerPerson(g, id), kit), 3, g.player.name)}</div>
    <div class="grow"><small class="muted">경기 화면 캐릭터 보기에서 보이는 내 선수 모습이에요.</small></div>
    ${Button({ variant: 'secondary', size: 'sm', icon: 'player', act: 'px-open-me', children: '바꾸기' })}</div>`);
}

interface KitTeam { id: string; name: string; sub: string }

function kitTeams(g: GameState | null): KitTeam[] {
  const clubs: KitTeam[] = ALL_CLUBS.map((c) => ({ id: c.id, name: c.nameKo, sub: c.id.startsWith('x:') ? `${c.name} · 리그 밖` : c.name }));
  const nations: KitTeam[] = Object.keys(NATION_KITS).map((n) => ({ id: `n:${n}`, name: n, sub: '대표팀' }));
  const mine = g?.player.teamId;
  return [...clubs, ...nations].sort((a, b) => Number(b.id === mine) - Number(a.id === mine));
}

function kitEditor(g: GameState, t: KitTeam): string {
  const cur = kitFor(t.id, g.pixelOverrides);
  const base = tableKit(t.id);
  const own = g.pixelOverrides?.kits?.[t.id];
  const person = validPerson(PREVIEW_PERSON, peopleTable());
  const grid = (side: 'home' | 'away') => ALL_KITS.map((k) => {
    const on = cur[side] === k;
    return `<button type="button" class="px-cell px-cell--kit${on ? ' is-on' : ''}" data-act="px-kit" data-id="${esc(t.id)}" data-side="${side}" data-kit="${esc(k)}" aria-pressed="${on}" title="${esc(kitLabel(k))}">${
      pixelIconHtml(pixelLayerUrls(person, k), 2)}<small>${esc(k)}${base[side] === k ? '·기본' : ''}</small></button>`;
  }).join('');
  return `<div class="px-edit">
    <div class="fo-edit"><div class="px-pair">${pixelIconHtml(pixelLayerUrls(person, cur.home), 4, '홈')}${pixelIconHtml(pixelLayerUrls(person, cur.away), 4, '원정')}</div>
      <div class="grow"><b>${esc(t.name)}</b><small>${esc(t.sub)}</small><small class="muted">홈 ${esc(kitLabel(cur.home))} · 원정 ${esc(kitLabel(cur.away))}${own ? ' (직접 고름)' : ''}</small></div></div>
    <div class="kv"><span>홈</span></div><div class="px-grid px-grid--kits">${grid('home')}</div>
    <div class="kv"><span>원정</span></div><div class="px-grid px-grid--kits">${grid('away')}</div>
    ${own ? Button({ variant: 'secondary', size: 'sm', block: true, icon: 'restore', act: 'px-kit-auto', data: { id: t.id }, children: '자동으로 되돌리기' }) : ''}
    <p class="small muted">원정 팀은 홈 유니폼이 상대와 비슷할 때만 원정 유니폼을 입고, GK는 양 팀과 겹치지 않는 단색을 입어요(바꾼 값으로 다시 계산).</p>
  </div>`;
}

function pixelSection(g: GameState | null, px: PixelUI): string {
  if (!g) return panel('<p class="small muted">경기 아이콘은 게임을 시작하거나 불러오면 바꿀 수 있어요.</p>');
  const tabs = Tabs({ items: [{ id: 'players', label: '선수' }, { id: 'kits', label: '유니폼' }], value: px.tab, act: 'px-tab', fill: true, label: '선수/유니폼' });
  const qq = px.q.trim().toLowerCase();
  if (px.tab === 'kits') {
    const all = kitTeams(g);
    const sel = px.kitSel ? all.find((t) => t.id === px.kitSel) : undefined;
    const list = all.filter((t) => !qq || has(t.name, qq) || has(t.sub, qq) || has(t.id, qq)).slice(0, 60);
    const rows = list.map((t) => {
      const k = kitFor(t.id, g.pixelOverrides);
      const person = validPerson(PREVIEW_PERSON, peopleTable());
      return `<button type="button" class="real-row px-row${t.id === px.kitSel ? ' is-on' : ''}" data-act="px-team-pick" data-id="${esc(t.id)}">${pixelIconHtml(pixelLayerUrls(person, k.home), 2)}${pixelIconHtml(pixelLayerUrls(person, k.away), 2)}<span class="grow"><b>${esc(t.name)}</b><small>${esc(t.sub)}</small></span>${
        g.pixelOverrides?.kits?.[t.id] ? '<span class="po-chip po-chip--brand">직접</span>' : ''}</button>`;
    }).join('');
    return `${tabs}${sel ? panel(kitEditor(g, sel), 'px-editor') : ''}
      <label class="field fo-search"><span aria-hidden="true">🔍</span><input type="search" id="px-q" value="${esc(px.q)}" placeholder="구단·국가 이름" autocomplete="off"></label>
      <div class="real-list fo-list">${rows || '<p class="small muted">찾는 팀이 없어요.</p>'}</div>`;
  }
  const all = worldPlayers(g);
  const list = all.filter((p) => {
    if (px.team === 'x' ? p.teamId : px.team && p.teamId !== px.team) return false;
    return !qq || [p.nameKo, p.name ?? ''].some((x) => has(x, qq));
  }).sort((a, b) => Number(!!b.mine) - Number(!!a.mine) || Number(!!g.pixelOverrides?.players?.[b.id]) - Number(!!g.pixelOverrides?.players?.[a.id])).slice(0, 30);
  const teamName = (p: (typeof all)[number]) => (p.teamId ? teamById(g.league, p.teamId)?.nameKo ?? p.teamId : `${clubKo(p.club)} · 리그 밖`);
  const rows = list.map((p) => `<button type="button" class="real-row px-row${p.id === px.sel ? ' is-on' : ''}" data-act="px-pick" data-id="${esc(p.id)}">${
    pixelIconHtml(pixelLayerUrls(playerPerson(g, p.id), homeKitOf(g, p.id)), 2)}<span class="grow"><b>${esc(p.nameKo)}${p.mine ? ' · 내 선수' : ''}</b><small>${esc(teamName(p))}</small></span>${
    g.pixelOverrides?.players?.[p.id] ? '<span class="po-chip po-chip--brand">직접</span>' : ''}</button>`).join('');
  const sel = px.sel ? all.find((p) => p.id === px.sel) : undefined;
  const teams = `<option value="">모든 팀</option>${g.league.teams.map((t) => `<option value="${esc(t.id)}"${px.team === t.id ? ' selected' : ''}>${esc(t.nameKo)}</option>`).join('')}<option value="x"${px.team === 'x' ? ' selected' : ''}>리그 밖</option>`;
  return `${tabs}${sel ? panel(pixelPersonEditor(g, sel.id, sel.nameKo), 'px-editor') : ''}
    <div class="nm-filter"><label class="field fo-search"><span aria-hidden="true">🔍</span><input type="search" id="px-q" value="${esc(px.q)}" placeholder="선수 이름 (한글·영문)" autocomplete="off"></label>
    <select id="px-team" class="nm-team" aria-label="팀 거르기">${teams}</select></div>
    <div class="real-list fo-list">${rows || '<p class="small muted">찾는 이름이 없어요.</p>'}</div>`;
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
  const d = A_GRADE_PLAYERS.find((p) => p.id === id);
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
  for (const p of A_GRADE_PLAYERS) if (has(p.nameKo, qq) || has(p.name, qq)) push(lookupEntry(g, `p:${p.id}`));
  return out.filter((e) => !e.mine || has(e.name, qq)).slice(0, 40);
}

function clubEntries(q: string): Entry[] {
  const qq = q.trim().toLowerCase();
  return ALL_CLUBS.filter((c) => !qq || has(c.nameKo, qq) || has(c.name, qq)).map((c) => ({ key: `t:${c.id}`, name: c.nameKo, sub: c.id.startsWith('x:') ? `${c.name} · 리그 밖` : c.name, team: c.id }));
}

function row(e: Entry, sel: string | null): string {
  const on = faceOnKeys().some((k) => k.key === e.key);
  const pic = e.team ? Crest({ name: e.name, team: e.team, size: 32 }) : Avatar({ size: 40, face: e.face!, name: e.name });
  return `<button type="button" class="real-row fo-row${e.key === sel ? ' is-on' : ''}" data-act="faceon-pick" data-key="${esc(e.key)}">${pic}<span class="grow"><b>${esc(e.name)}</b><small>${esc(e.sub)}</small></span>${
    on ? '<span class="po-chip po-chip--brand">페이스온</span>' : ''}</button>`;
}

function editor(g: GameState | null, e: Entry): string {
  if (e.team) {
    const url = faceOnUrls(e.key).crest;
    const repo = repoCrest(e.team);
    return panel(`<div class="fo-edit"><div class="fo-big">${Crest({ name: e.name, team: e.team, size: 96 })}</div>
      <div class="grow"><b>${esc(e.name)}</b><small>${esc(e.sub)}</small><small class="muted">${url ? '내가 올린 엠블럼을 쓰고 있어요.' : repo ? '위키백과 로고를 쓰고 있어요.' : '자동 엠블럼(모양·팀 색·이니셜)을 쓰고 있어요.'}</small></div></div>
      <div class="fo-actions">${Button({ size: 'sm', icon: 'upload', act: 'faceon-upload', data: { key: e.key, slot: 'crest' }, children: url ? '다시 올리기' : '이미지 올리기' })}${
        url ? Button({ variant: 'secondary', size: 'sm', icon: 'restore', act: 'faceon-clear', data: { key: e.key, slot: 'crest' }, children: '되돌리기' }) : ''}</div>`, 'fo-editor');
  }
  const urls = faceOnUrls(e.key);
  const face = e.face!;
  const age = face.age ?? 25;
  const cur = ageSlot(age);
  const fallback = defaultFaceSrc(face);
  const cells = AGE_SLOTS.map((s) => {
    const u = urls[s];
    return `<div class="fo-slot${s === cur ? ' is-cur' : ''}"><span class="fo-slot__pic${u ? ' has-img' : ''}">${u ? `<img src="${esc(u)}" alt="">` : '<i>비어 있음</i>'}</span><b>${AGE_SLOT_KO[s]}</b>${s === cur ? '<small class="hi">지금 나이</small>' : '<small>&nbsp;</small>'}
      <span class="fo-slot__btns">${Button({ size: 'sm', variant: u ? 'secondary' : 'primary', act: 'faceon-upload', data: { key: e.key, slot: s }, children: u ? '바꾸기' : '올리기' })}${
        u ? Button({ size: 'sm', variant: 'ghost', act: 'faceon-clear', data: { key: e.key, slot: s }, children: '지우기' }) : ''}</span></div>`;
  }).join('');
  const where = Object.keys(urls).length
    ? `${age}세 → ${urls[cur] ? `${AGE_SLOT_KO[cur]} 칸` : '가까운 칸'} 사진을 써요.`
    : fallback ? (fallback.startsWith('facepack/') ? '위키백과 사진을 쓰고 있어요.' : '기본 얼굴 이미지를 쓰고 있어요.') : '기본 아바타를 쓰고 있어요.';
  return panel(`<div class="fo-edit"><div class="fo-big">${Avatar({ size: 96, face, name: e.name, ring: true })}</div>
    <div class="grow"><b>${esc(e.name)}</b><small>${esc(e.sub)}</small><small class="muted">${esc(where)}</small></div></div>
    <div class="fo-slots">${cells}</div>
    <p class="small muted">나이에 맞는 칸의 사진을 쓰고, 그 칸이 비었으면 가까운 칸을 써요. 칸을 모두 지우면 원래 얼굴로 돌아가요.</p>
    ${Object.keys(urls).length ? Button({ variant: 'ghost', size: 'sm', block: true, icon: 'restore', act: 'faceon-clear', data: { key: e.key }, children: '모두 되돌리기' }) : ''}`, 'fo-editor');
}

function cropSheet(c: NonNullable<FaceOnUI['crop']>): string {
  const club = c.slot === 'crest';
  return `<div class="po-overlay po-overlay--sheet"><div class="po-sheet fo-crop" role="dialog" aria-modal="true" aria-label="이미지 위치 맞추기"><span class="po-sheet__grip" aria-hidden="true"></span>
    <div class="po-sheet__head"><span class="po-sheet__eyebrow">${club ? '엠블럼' : `얼굴 · ${AGE_SLOT_KO[c.slot as keyof typeof AGE_SLOT_KO]}`}</span><b>${esc(c.name)}</b><p>정사각형으로 저장해요. 모자란 쪽은 투명으로 채워요(체크무늬 = 투명). 배경이 투명한 PNG면 얼굴만, JPG면 사각 이미지 그대로 보여요.</p></div>
    <div class="po-sheet__body">
      <div class="fo-crop__stage"><div class="fo-crop__prev"><img id="fo-prev" src="${esc(c.src)}" alt="" style="${cropStyle(c)}"></div></div>
      <label class="fo-range"><span>확대</span><input type="range" id="fo-zoom" min="100" max="300" value="${Math.round(c.zoom * 100)}"></label>
      <label class="fo-range"><span>좌우</span><input type="range" id="fo-x" min="-100" max="100" value="${Math.round(c.x * 100)}"></label>
      <label class="fo-range"><span>위아래</span><input type="range" id="fo-y" min="-100" max="100" value="${Math.round(c.y * 100)}"></label>
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

export function settingsView(
  g: GameState | null, fo: FaceOnUI, version: VersionVM, nm: NameUI = { q: '', team: '', sel: null },
  px: PixelUI = { tab: 'players', q: '', team: '', sel: null, kitSel: null },
  ca: CardArtUI = CARD_ART_UI_DEFAULT, locked = false,
): string {
  const hero = HeroPanel({
    title: '설정', back: { act: 'go', data: { to: g ? 'home' : 'title' } }, eyebrow: '게임 설정 · 페이스온', pad: false, progress: false, value: '설정',
    chips: [g ? `${g.player.name}` : '게임 밖', { label: '이 브라우저에 저장', soft: true }],
  });
  const play = g
    ? panel(`
      <div class="kv"><span>내 선수 결정</span><span class="muted small">${g.control.mode === 'direct' ? '결정 순간마다 멈춰요' : '엔진이 대신 결정해요'}</span></div>
      ${Tabs({ items: [{ id: 'direct', label: '직접' }, { id: 'auto', label: '자동' }], value: g.control.mode, act: 'ctl-mode', fill: true, label: '직접/자동' })}
      ${g.control.mode === 'direct' ? `<div class="kv"><span>정지 빈도</span></div>${Tabs({ items: [{ id: 'all', label: '모든 순간' }, { id: 'important', label: '중요한 순간만' }, { id: 'critical', label: '결정적 순간만' }], value: g.control.stop, act: 'ctl-stop', fill: true, label: '정지 빈도' })}` : ''}
      <div class="divider"></div>
      <div class="kv"><span>다른 경기 계산</span>${Tabs({ items: [{ id: 'engine', label: '전체 엔진' }, { id: 'quick', label: '빠른 진행' }], value: g.options.quickOthers ? 'quick' : 'engine', act: 'opt-quick', label: '다른 경기 계산' })}</div>
      <p class="small muted">${g.options.quickOthers ? '느린 기기용: 다른 팀 경기를 통계로 바로 계산해요. 득점 순위는 내 경기만 남아요.' : '다른 팀 경기도 22명 엔진으로 계산해요. 경기 날 [계속]이 몇 초 걸릴 수 있어요.'}</p>
      <div class="kv"><span>난이도</span><b>${{ easy: '쉬움', normal: '보통', hard: '어려움' }[g.difficulty] ?? g.difficulty}</b></div>
      <p class="small muted">난이도는 새 게임에서 정해요.</p>`)
    : panel('<p class="small muted">경기 진행 설정은 게임을 시작하거나 불러오면 보여요.</p>');
  const pv = panel(`<div class="kv"><span>경기 화면 선수 표시</span></div>${Tabs({ items: (['number', 'face', 'character'] as const).map((k) => ({ id: k, label: PITCH_VIEW_KO[k] })), value: pitchView(), act: 'pv-set', fill: true, label: '선수 표시' })}
    <p class="small muted">등번호 = 번호 원(기본) · 얼굴 = 미니페이스 + 팀 색 밑줄 · 캐릭터 = 도트 선수(경기마다 홈·원정·GK 유니폼, 아래 작은 등번호. 바꾸기는 아래 경기 아이콘). 경기 화면의 [보기] 버튼으로도 바꿔요.</p>
    <div class="divider"></div>
    <div class="kv"><span>경기 화면 방향</span></div>${Tabs({ items: (['auto', 'landscape', 'portrait'] as const).map((k) => ({ id: k, label: PITCH_ORIENT_KO[k] })), value: pitchOrient(), act: 'po-orient', fill: true, label: '경기 화면 방향' })}
    <p class="small muted">자동 = 폰을 세로로 들면 피치도 세로(내 팀이 아래에서 위로 공격). 시험 기능이에요.</p>
    <div class="kv"><span>선수 크기</span></div>${Tabs({ items: (['normal', 'large', 'xlarge'] as const).map((k) => ({ id: k, label: PITCH_SIZE_KO[k] })), value: pitchSize(), act: 'po-size', fill: true, label: '선수 크기' })}
    <div class="kv"><span>이름 표시</span></div>${Tabs({ items: (['all', 'mine', 'off'] as const).map((k) => ({ id: k, label: PITCH_NAMES_KO[k] })), value: pitchNames(), act: 'po-names', fill: true, label: '이름 표시' })}
    <p class="small muted">방향·크기·이름 표시는 이 기기에 저장돼요(세이브와 따로). 경기 결과에는 영향이 없어요.</p>`);
  const look = panel(`<div class="kv"><span>화면 스타일</span></div>${Tabs({ items: (['b', 'a'] as const).map((k) => ({ id: k, label: SKIN_KO[k] })), value: skin(), act: 'skin-set', fill: true, label: '화면 스타일' })}
    <p class="small muted">B = 꺾인 모서리·이탤릭 숫자(기본) · A = 둥근 알약 모양. 색과 화면 내용은 같아요. 이 기기에 저장돼요.</p>`);
  const saves = panel(`<div class="kv"><span>세이브 관리</span>${Button({ variant: 'secondary', size: 'sm', icon: 'disk', act: 'go', data: { to: 'saves' }, children: '저장·불러오기·파일' })}</div>
    <div class="kv"><span>첫 플레이 안내</span>${Button({ variant: 'ghost', size: 'sm', act: 'tips-reset', children: '안내 다시 보기' })}</div>`);

  const st = faceStats();
  const tabs = Tabs({ items: [{ id: 'players', label: '선수' }, { id: 'clubs', label: '구단' }], value: fo.tab, act: 'faceon-tab', fill: true, label: '선수/구단' });
  const list = fo.tab === 'players' ? playerEntries(g, fo.q) : clubEntries(fo.q);
  const sel = fo.sel ? lookupEntry(g, fo.sel) : null;
  const faceon = `
    ${panel(`<p class="small">선수나 구단을 골라 이미지를 올리면 게임 곳곳(홈 카드·선수 화면·경기 결과·순위표·이적 소식)에 그 이미지가 나와요. 언제든 바꾸거나 되돌릴 수 있고, 이미지는 이 브라우저에만 저장돼요.</p>
      <p class="small muted">우선순위: 내가 올린 이미지 > 위키백과 사진·로고(선수 ${st.photos}명, 구단 ${st.clubs}개) > 기본 얼굴(${st.base}개) > 기본 아바타·자동 엠블럼 · 도트 얼굴(캐릭터 보기) ${st.pixel}개 · 내 페이스온 ${st.faceOn}건</p>`)}
    ${sel ? editor(g, sel) : ''}
    ${tabs}
    <label class="field fo-search">${'<span aria-hidden="true">🔍</span>'}<input type="search" id="fo-q" value="${esc(fo.q)}" placeholder="${fo.tab === 'players' ? '선수 이름 (한글·영문)' : '구단 이름'}" autocomplete="off"></label>
    <div class="real-list fo-list">${list.map((e) => row(e, fo.sel)).join('') || '<p class="small muted">찾는 이름이 없어요.</p>'}</div>
    ${SectionTitle({ title: '페이스팩 (zip)', action: '이름 → 이미지' })}
    ${panel(`<p class="small">내가 올린 이미지(카드 이미지 포함, <b>cards/</b> 폴더)를 zip 하나로 내보내 다른 기기에서 가져올 수 있어요. 직접 만든 zip도 돼요: <b>players/선수이름.png</b>(나이대 칸은 <b>선수이름@young</b>·<b>@prime</b>·<b>@veteran</b>), <b>clubs/구단이름.png</b>. 이름은 한글·영문 모두 돼요.</p>
      <div class="btn-row even">${Button({ variant: 'secondary', size: 'sm', block: true, icon: 'download', act: 'facepack-export', disabled: st.faceOn === 0 && userArtCount() === 0, children: 'zip 내보내기' })}${Button({ variant: 'secondary', size: 'sm', block: true, icon: 'upload', act: 'facepack-import', children: 'zip 가져오기' })}</div>`)}
    <input type="file" id="fo-file" accept="image/*" hidden>
    <input type="file" id="fp-file" accept=".zip,application/zip" hidden>`;
  return `${hero}<div class="body">
    ${SectionTitle({ title: '화면 스타일' })}${look}
    ${SectionTitle({ title: '경기 진행' })}${play}
    ${SectionTitle({ title: '경기 화면 보기' })}${pv}
    ${SectionTitle({ title: '선수 이름', action: '별명·짧은 이름' })}${nameSection(g, nm)}
    ${SectionTitle({ title: '경기 아이콘', action: '캐릭터 보기 인물·유니폼' })}${pixelSection(g, px)}
    ${SectionTitle({ title: '저장과 안내' })}${saves}
    ${SectionTitle({ title: '페이스온', action: '얼굴·엠블럼 바꾸기' })}${faceon}
    ${SectionTitle({ title: '카드 이미지', action: '카드 그림 바꾸기' })}${cardArtSection(ca, locked)}
    ${versionFooter(version)}
  </div>${fo.crop ? cropSheet(fo.crop) : ''}${cardArtOverlay(ca)}`;
}
