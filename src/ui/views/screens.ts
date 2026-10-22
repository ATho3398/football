// 디자인 2차 수정본 화면 (H.6 3번, I.19 갱신): 타이틀(55), 새 게임(52·53), 포인트 찍기(50), 순위표·리그 스타(54), 시즌 종료(51),
// 은퇴(56), 세이브(43). 화면 모듈은 뷰모델만 받아 그린다 (H.2). 아직 없는 기능(설정, 파일 내보내기, 검색·필터, 우승 기록 등)은 숨긴다

import { seasonGoalsPanel, seasonHighlightCards } from './season';
import { isIOS } from '../../pwa/register';
import { teamPickHtml } from './teamPick';
import { LEAGUE_GROUPS, type TeamPickVM } from '../teamPickVM';
import { DEFAULT_LEAGUES } from '../../../data/leagues';
import {
  Avatar, FootPair, Banner, BottomSheet, Button, Crest, esc, FIN_TIERS, FinChip, HeroPanel, Icon, IconButton, Meter, OptionRow, PlayerCard, SectionTitle, StatBar, StatChip, Tabs, TagChip, TextField, TierBadge, type DesignTier,
} from '../components';
import type { AllocateVM, ChapterReviewVM, CupsWorldVM, CupTieVM, RetiredVM, SavesVMOut, SeasonVM, StarGroup, StarVM, VersionVM, WorldVM, WorldRowVM, OtherLeagueVM } from '../viewModels';
import type { BoardKind } from '../../worldStats';
import { actionRow, banners, panel, pc2, seasonMatchesSection, statTiles, versionFooter } from './common';
import { isWide } from '../skin';
import { teamLink } from './detail';
import { historyTable } from './player';
import { attrGrid, type AttrGroupVM } from './attrGrid';
import { attrDisplay, displayDelta } from '../../attributes';
import { BALANCE } from '../../config/balance';
import { FUTURE_STARS, LEGENDS } from '../../legends';

/** 레전드 팩 인원 표기 기준 (C.52): 팩 전체 = LEGENDS 전체, 고를 수 있는 선수 = GK 제외 */
const LEGEND_TOTAL = LEGENDS.length;
const LEGEND_GK = LEGENDS.filter((l) => l.position === 'GK').length;
/** 도르트문트 레전드 (C.75x) · 미래 스타 수 */
const LEGEND_BVB = LEGENDS.filter((l) => l.group === 'bvb').length;
const FUTURE_TOTAL = FUTURE_STARS.length;
import type { CustomVM } from '../customVM';
import { customBody, photoRow } from './custom';
import type { FacePhoto, Race } from '../../identity';

// ── 타이틀 (55) ──

export interface TitleVM {
  cont: { name: string; team: string; meta: string } | null;
  version: VersionVM;
}

export function titleView(vm: TitleVM): string {
  return `
    <div class="title-screen">
      <div class="title-hero">
        <span class="title-tag">축구 커리어 · 1인용</span>
        <span class="title-logo po-num">PLAYER<br><span>ONE</span></span>
        <span class="title-copy">17세 유망주에서 은퇴까지.<br>한 선수의 커리어를 내 손으로 쌓아요.</span>
      </div>
      <div class="title-actions">
        ${vm.cont ? `<div class="continue-card">${Avatar({ size: 40, ring: true })}<div class="grow"><b>${esc(vm.cont.name)} · ${esc(vm.cont.team)}</b><span>${esc(vm.cont.meta)}</span></div></div>
        ${Button({ size: 'lg', block: true, icon: 'play', act: 'continue', children: '이어하기' })}` : ''}
        <div class="btn-row even">
          ${Button({ variant: vm.cont ? 'secondary' : 'primary', size: 'lg', block: true, icon: 'plus', act: 'go', data: { to: 'new' }, children: '새 게임' })}
          ${Button({ variant: 'secondary', size: 'lg', block: true, icon: 'disk', act: 'go', data: { to: 'saves' }, children: '불러오기' })}
        </div>
        ${Button({ variant: 'ghost', block: true, icon: 'settings', act: 'go', data: { to: 'settings' }, children: '설정 · 페이스온' })}
      </div>
      ${versionFooter(vm.version)}
    </div>`;
}

// ── 새 게임 (52·53) ──

export interface NewGameVM {
  /** 명예의 전당 보너스 (18.11, C.73b): 이 기기에서 은퇴한 커리어가 남긴 시작 카드 선택권 */
  bonus?: { rarity: string; from: string; legend: boolean } | null;
  mode: 'prospect' | 'real' | 'custom';
  name: string;
  position: string;
  positions: { id: string; ko: string; ovr?: number }[];
  /** 가상 유망주 시작 후보 4자리 (C.37): 상위 3 + 와일드카드, 코치 한 줄 평 */
  candidates: { id: string; ko: string; ovr: number; line: string; wild: boolean }[];
  /** "다른 포지션에서 고르기" 펼침 */
  others: boolean;
  /** 눈에 띄는 능력치 3개 */
  strengths: string;
  /** 능력치 전체 바둑판 (C.39) */
  attrs: AttrGroupVM[];
  /** 포지션별 OVR 표 (GK 제외, 후보 4자리 강조) */
  posTable: { id: string; ko: string; ovr: number; cand: boolean; on: boolean }[];
  selectedOvr: number | null;
  keyAttrs: string;
  ageRange: string;
  difficulty: string;
  difficulties: { id: string; label: string; desc: string }[];
  seed: string;
  reals: { id: string; name: string; club: string; age: number; position: string; ovr: number; tier: DesignTier }[];
  realId: string;
  /** 레전드 팩 (C.47) 켬, 켰을 때 고를 수 있는 레전드 (실제 선수 목록의 "레전드" 묶음) */
  legends: boolean;
  legendList: { id: string; name: string; club: string; age: number; position: string; ovr: number; peak: number; youthKo: string; bvb?: boolean }[];
  /** 미래 스타 팩 (C.75y, 레전드 팩과 따로) 켬 · 구현 리그 첫 시즌에 들어오는 선수 (고를 수 없음, 보기만). waiting = 그 리그가 아직 없음 */
  futureStars: boolean;
  futureList: { id: string; name: string; position: string; debut: string; age: number; club: string; realClub: string; start: number; peak: number; waiting: boolean }[];
  /** 리그 고르기 (C.75m): on = 고름, mine = 내 리그(필수), ready = 데이터 있음 (없으면 준비 중) */
  leagues: { id: string; name: string; sub: string; on: boolean; mine: boolean; ready: boolean; canMine?: boolean; group?: import('../teamPickVM').LeagueGroup }[];
  /** 시작 팀 고르기 (45b b, 유망주): 리그 탭 → 팀 목록. 고른 팀 이름 (없으면 랜덤) */
  teamPick?: import('../teamPickVM').TeamPickVM;
  startTeam?: string;
  selected: { id: string; name: string; ovr: number; club: string; age: number; position: string; legend?: boolean; peak?: number; youthKo?: string } | null;
  /** 능력치 접힘 줄 (디자인 130) */
  attrSummary: { count: number; avg: string; weak: string; top: string } | null;
  teamHint: string;
  /** 랜덤 인종·국적·이름·기본 사진 (C.73c) */
  identity: { race: Race; races: { id: Race; ko: string }[]; photo: FacePhoto; photos: { id: FacePhoto; ko: string }[]; nationalityKo: string; name: string; picked: boolean } | null;
  /** 랜덤 유망주 신체·장단점 (C.45) */
  extras: { height: number; weight: number; foot: string; side: 'left' | 'right'; weakFoot: number; traits: { ko: string; desc: string; kind: 'pro' | 'con'; release?: string }[] } | null;
}

/** 새 게임 화면 상태 (C.58 디자인 124~131): 실제 선수 묶음 탭 · 검색 · 정렬 · 포지션군 · 보이는 수, 랜덤 능력치 펼침, 커스텀 단계 */
export interface NewGameUI {
  realTab: 'real' | 'legend' | 'future'; rq: string; rsort: 'peak' | 'ovr' | 'age' | 'name'; rgroup: 'all' | 'fw' | 'mf' | 'df'; rshow: number;
  attrsOpen: boolean; cuStep: number;
  /** 정렬 펼침 (C.71b 디자인 175: 실제 선수 = 바로 아래 목록, 레전드 = 아래 시트) */
  sortOpen?: boolean;
  /** 커스텀 태그: "효과가 다음 업데이트에서 열리는" 묶음 펼침 (디자인 183) */
  cuHooks?: ('pro' | 'con')[];
  /** 리그 고르기 펼침 (C.75m) */
  leaguesOpen?: boolean;
  /** 리그 고르기 묶음 펼침 (디자인 239, 없으면 고른 리그가 있는 묶음만 펼침) */
  lgFold?: Record<string, boolean>;
  /** 레전드 팩 묶음 (디자인 234): 전체 · 기본 레전드 · 도르트문트 */
  lpack?: 'all' | 'base' | 'bvb';
}
export const NEW_GAME_UI: NewGameUI = { realTab: 'real', rq: '', rsort: 'peak', rgroup: 'all', rshow: 10, attrsOpen: false, cuStep: 1 };
const REAL_PAGE = 10;
const REAL_MORE = 20;
const POS_GROUP: Record<string, 'fw' | 'mf' | 'df'> = { ST: 'fw', CF: 'fw', LW: 'fw', RW: 'fw', LM: 'mf', RM: 'mf', CAM: 'mf', CM: 'mf', CDM: 'mf', LB: 'df', RB: 'df', CB: 'df' };

/** 이름(TextField) · 난이도(세그먼트 3) · 레전드 팩(켬/끔) · 시드 (디자인 130 "시작 옵션") */
/**
 * 리그 고르기 (C.75m, FM식 → 디자인 239 C.76l): 접힘 줄(고른 리그 수·이름) → 펼치면 안내 · 묶음 세그먼트 3칸 · 대륙·부 묶음별 체크 목록.
 * 고른 팀 리그(맨 앞)는 해제 불가 · 데이터 없는 리그는 준비 중(비활성). 묶음은 고른 리그가 있으면 처음부터 펼침, PC 는 접지 않고 2열.
 * 고른 리그만 시즌이 진행된다 (내 리그 = 경기 엔진, 다른 리그 = 설정에 따라 엔진 · 빠른 계산)
 */
function leaguePicker(vm: NewGameVM, open: boolean, fold: Readonly<Record<string, boolean>> = {}): string {
  const on = vm.leagues.filter((l) => l.on);
  const mine = vm.leagues.find((l) => l.mine);
  const names = on.map((l) => l.name);
  const title = SectionTitle({ title: '리그', action: mine ? `고른 팀 리그 ${mine.name}` : '' });
  const sum = `<button type="button" class="ng-lg__sum" data-act="ng-lg-open" aria-expanded="${open}"><span class="grow"><b>리그 ${on.length}개 진행</b><small>${esc(names.slice(0, 4).join(' · '))}${names.length > 4 ? ` 외 ${names.length - 4}` : ''}</small></span><span class="ng-attrs__btn">${open ? '접기' : '고르기'} ${Icon({ name: open ? 'chevron-up' : 'chevron-down', size: 14 })}</span></button>`;
  if (!open) return `<div class="ng-lgsec">${title}<div class="panel ng-lg">${sum}</div></div>`;
  const ready = vm.leagues.filter((l) => l.ready);
  const ids = on.map((l) => l.id);
  const same = (xs: readonly string[]) => xs.length === ids.length && xs.every((x) => ids.includes(x));
  const preset = ids.length === 1 ? 'mine' : same(ready.map((l) => l.id)) ? 'all' : same([...new Set([mine?.id ?? '', ...DEFAULT_LEAGUES])].filter((x) => ready.some((l) => l.id === x))) ? 'default' : '';
  const presets = Tabs({ items: [{ id: 'default', label: '기본 묶음' }, { id: 'mine', label: '고른 팀 리그만' }, { id: 'all', label: '전부' }], value: preset, variant: 'segment', fill: true, act: 'ng-leagues', label: '리그 묶음' });
  const row = (l: NewGameVM['leagues'][number]) => {
    const chip = l.mine ? '<span class="ng-lg__chip is-mine">고른 팀 리그 · 필수</span>' : !l.ready ? '<span class="ng-lg__chip is-wait">준비 중</span>' : '';
    const dis = l.mine || !l.ready;
    return `<button type="button" class="ng-lg__row${l.on ? ' is-on' : ''}${l.mine ? ' is-mine' : ''}${l.ready ? '' : ' is-wait'}" data-act="ng-league" data-v="${esc(l.id)}" role="checkbox" aria-checked="${l.on}"${dis ? ' aria-disabled="true"' : ''}><span class="ng-lg__box">${l.on ? Icon({ name: 'check', size: 14, strokeWidth: 3 }) : ''}</span><span class="grow"><b>${esc(l.name)}</b><small>${esc(l.sub)}</small></span>${chip}</button>`;
  };
  const wide = isWide();
  // 고른 팀 리그가 든 묶음을 맨 앞, 그 안에서도 맨 앞 (해제 불가)
  const groups = LEAGUE_GROUPS.map((g) => {
    const ls = vm.leagues.filter((l) => (l.group ?? 'eu1') === g.id).sort((a, b) => Number(b.mine) - Number(a.mine));
    return { ...g, ls, mine: ls.some((l) => l.mine) };
  }).filter((g) => g.ls.length).sort((a, b) => Number(b.mine) - Number(a.mine));
  const grp = (g: (typeof groups)[number]) => {
    const n = g.ls.filter((l) => l.on).length;
    const wait = g.ls.filter((l) => !l.ready).length;
    const isOpen = wide || (fold[g.id] ?? n > 0);
    const head = `<button type="button" class="ng-lg__ghead" data-act="ng-lg-group" data-v="${g.id}" aria-expanded="${isOpen}"${wide ? ' disabled' : ''}>${Icon({ name: isOpen ? 'chevron-up' : 'chevron-down', size: 14 })}<b>${esc(g.ko)}</b><small class="po-num">${g.ls.length}개 중 ${n}개${wait ? ` · 준비 중 ${wait}` : ''}</small>${isOpen ? '' : `<span class="ng-lg__gnames">${esc(g.ls.map((l) => l.name).join(' · '))}</span>`}</button>`;
    return `<div class="ng-lg__grp" data-g="${g.id}">${head}${isOpen ? `<div class="ng-lg__list">${g.ls.map(row).join('')}</div>` : ''}</div>`;
  };
  const list = wide
    ? `<div class="ng-lg__cols"><div>${groups.slice(0, 1).map(grp).join('')}</div><div>${groups.slice(1).map(grp).join('')}</div></div>`
    : groups.map(grp).join('');
  return `<div class="ng-lgsec">${title}
    <div class="panel ng-lg is-open">${sum}
      <p class="small muted">고른 리그만 시즌이 진행돼요. 시작 팀 리그는 경기 엔진으로, 다른 리그는 순위·기록을 남겨요. 안 고른 리그 팀은 이름·전력만 남아요. 리그가 많을수록 하루 넘기기가 조금 느려져요.</p>
      ${presets}
      <p class="small muted ng-lg__note">기본 묶음 = 유럽 5대 리그 + 챔피언십 · 묶음을 고른 뒤 한 줄씩 더하거나 뺄 수 있어요. 시작 팀 리그는 늘 포함돼요.</p>
      ${list}
      <p class="small muted">${wide ? '' : '접힌 묶음은 누르면 펼쳐져요 · 고른 리그가 있는 묶음은 처음부터 펼쳐 둬요 · '}3월~12월 리그는 그 리그 2018 시즌 개막 소집(2월)부터 시작해요.</p>
    </div></div>`;
}

function startOptions(vm: NewGameVM, nameField: boolean, u: NewGameUI = NEW_GAME_UI): string {
  const name = nameField ? TextField({ label: '이름', value: vm.name, placeholder: vm.identity ? `비우면 ${vm.identity.name}` : '예: 김민준 · 비우면 랜덤', input: { id: 'f-name', maxLength: 12 }, clearable: false }) : '';
  const cur = vm.difficulties.find((d) => d.id === vm.difficulty);
  const diff = `${Tabs({ items: vm.difficulties.map((d) => ({ id: d.id, label: d.id === 'normal' ? `${d.label} · 추천` : d.label })), value: vm.difficulty, variant: 'segment', fill: true, act: 'form', data: { k: 'difficulty' }, label: '난이도' })}
    ${cur ? `<p class="small muted ng-diff">${esc(cur.desc)}</p>` : ''}`;
  const pack = `<div class="ng-pack"><span class="grow"><b>레전드 팩 · 은퇴 레전드 ${LEGEND_TOTAL}명</b><small>${vm.legends ? `켜면 실제 선수에 레전드 탭이 생기고, 펠레·지단·박지성 같은 레전드(도르트문트 레전드 ${LEGEND_BVB}명 포함)가 15~22세 유망주로 유스 구단에 들어와요. 한 팀에 ${BALANCE.legends.maxPerTeam}명이 넘으면 리그 밖에서 시작해 다음 시즌부터 이적으로 들어와요. 끄면 세계는 그대로예요.` : '켜면 1990년 이후 은퇴한 레전드(+ 도르트문트 레전드)가 2018-19 세계에 15~22세로 들어와요. 끄면 세계는 그대로예요.'}</small></span>${
    Tabs({ items: [{ id: 'off', label: '끔' }, { id: 'on', label: '켬' }], value: vm.legends ? 'on' : 'off', act: 'form', data: { k: 'legends' }, label: '레전드 팩' })}</div>
    <div class="ng-pack"><span class="grow"><b>미래 스타 팩 · ${FUTURE_TOTAL}명</b><small>켜면 야말·벨링엄·홀란 같은 2018-19 뒤 스타가 내 리그에서 처음 뛴 실제 시즌에 그 팀으로, 그때 나이로 나타나요. 고른 다른 리그에서 먼저 뛴 기록은 월드 "등장 예정"에 보여요. 끄면 세계는 그대로예요.</small></span>${
    Tabs({ items: [{ id: 'off', label: '끔' }, { id: 'on', label: '켬' }], value: vm.futureStars ? 'on' : 'off', act: 'form', data: { k: 'futureStars' }, label: '미래 스타 팩' })}</div>`;
  const seed = TextField({ label: '시드 (선택)', value: vm.seed, placeholder: '비우면 랜덤 · 같은 시드 + 같은 선택 = 같은 결과', input: { id: 'f-seed', maxLength: 40 }, clearable: false });
  const bonus = vm.bonus
    ? Banner({ tone: 'success', title: `명예의 전당 보너스 · ${vm.bonus.rarity} 카드 선택권 1장`, children: `${vm.bonus.from} 커리어${vm.bonus.legend ? '(레전드 배지)' : ''}가 남긴 보너스예요. 시작하면 덱에서 3장 중 1장을 골라요.` })
    : '';
  return `${leaguePicker(vm, !!u.leaguesOpen, u.lgFold)}${SectionTitle({ title: '시작 옵션' })}${bonus}${name}${diff}${pack}${seed}`;
}

export function newGameView(vm: NewGameVM, custom?: CustomVM, u: NewGameUI = NEW_GAME_UI): string {
  const real = vm.mode === 'real';
  const back = { act: 'go', data: { to: 'title' } } as const;
  const sel = vm.selected;
  // PC (C.61 디자인 151): 머리말은 compact(약 140px) — 아래 3열이 한 화면에 들어오게
  const cpt = isWide() ? { compact: true } : {};
  const hero = custom
    ? HeroPanel({ title: '새 게임', back, ...cpt, eyebrow: `커스텀 선수 · ${custom.position} OVR`, value: custom.ovr, pad: false, progress: false, chips: [custom.name || '이름 랜덤', { label: `${custom.age}세 · ${custom.body.height}cm · ${custom.body.footKo} · 약발 ${custom.body.weakFoot}`, soft: true }] })
    : real
    // 디자인 233·234: 고르기 전에는 숫자 없는 낮은 머리말 (전에는 '-' 가 라임 면처럼 보였다)
    ? HeroPanel({ title: '새 게임', back, ...(sel ? cpt : { compact: true }), eyebrow: sel ? `선택한 선수 · ${sel.name} · ${sel.position} OVR` : '실제 선수를 골라요', ...(sel ? { value: sel.ovr } : {}), pad: false, progress: false,
      chips: sel ? [`${sel.age}세 · ${sel.club}`, { label: sel.legend ? `레전드 · 전성기 ${sel.peak}` : '2018-19 시즌 그대로', soft: true }] : [`실제 선수 ${vm.reals.length}명`, { label: vm.legends ? `레전드 ${vm.legendList.length}명` : '2018-19 시즌 그대로', soft: true }] })
    : HeroPanel({ title: '새 게임', back, ...cpt, eyebrow: `전체 랜덤 결과 · ${vm.position} OVR`, value: vm.selectedOvr ?? '17세', pad: false, progress: false, chips: [vm.identity ? `17세 · ${vm.identity.nationalityKo}` : '17세 유망주', { label: `강점 ${vm.strengths}`, soft: true }] });
  // 시작 방식 2개 (C.74d): 커스텀 · 실제 선수. 랜덤은 커스텀의 [전체 랜덤] 결과 화면(mode 'prospect')
  const modeTabs = Tabs({ items: [{ id: 'custom', label: '커스텀' }, { id: 'real', label: '실제 선수' }], value: real ? 'real' : 'custom', variant: 'segment', fill: true, act: 'form', data: { k: 'mode' }, label: '시작 방식' });
  const randomAll = `<div class="panel ng-randall"><span class="grow"><b>전체 랜덤</b><small>랜덤 유망주 기준으로 모든 단계를 한 번에 채워요</small></span>${Button({ variant: 'secondary', size: 'sm', icon: 'swap', act: 'ng-random', children: '전체 랜덤' })}</div>`;
  if (custom) return `${hero}<div class="body ng-body">${customBody(custom, u.cuStep, u.cuStep === 1 || isWide() ? `${modeTabs}${randomAll}` : '', startOptions(vm, false, u), u.cuHooks ?? [])}</div>`;
  if (!real) return `${hero}<div class="body ng-body">${ngColumns(modeTabs, prospectBody(vm, u))}</div>`;
  return `${hero}<div class="body ng-body">${ngColumns(modeTabs, realBody(vm, u))}</div>`;
}

/** 전체 랜덤 결과 (디자인 130 → C.74d): 후보 4자리 2×2 · 코치 평 · 신체·태그 · 능력치 접힘 · 시작 옵션 · [이대로 시작][편집하기][다시 돌리기] */
function prospectBody(vm: NewGameVM, u: NewGameUI): { left: string; right: string } {
  const on = vm.candidates.find((c) => c.id === vm.position);
  const cands = `<div class="ng-cands">${vm.candidates.map((c) =>
    `<button type="button" class="ng-cand${c.id === vm.position ? ' is-on' : ''}" data-act="form" data-k="position" data-v="${c.id}" aria-pressed="${c.id === vm.position}"><span class="ng-cand__pos">${c.id}</span><b class="po-num">${c.ovr}</b><small>${esc(c.ko)}${c.wild ? ' · <em>와일드카드</em>' : ''}</small></button>`).join('')}</div>`;
  const coach = on ? `<div class="panel coach ng-coach">${Avatar({ size: 36 })}<div><small>코치 평 · ${esc(on.id)}</small><b>“${esc(on.line)}”</b></div></div>` : '';
  const others = vm.others ? othersPanel(vm) : '';
  const outside = !on && vm.selectedOvr !== null
    ? `<p class="ng-outside"><span class="ng-outside__chip">${esc(vm.position)} · 다른 포지션</span><small class="muted">추천 4자리 밖에서 골랐어요</small></p>` : '';
  const x = vm.extras;
  const extras = x ? `${SectionTitle({ title: '신체 · 태그', action: '랜덤 · 숨기지 않음' })}
    <div class="panel ng-extras"><div class="body-stats ng-stats">
      <div><small>키</small><b class="po-num">${x.height}<i>cm</i></b></div><div><small>몸무게</small><b class="po-num">${x.weight}<i>kg</i></b></div>
      <div class="bs-feet"><small>주발 · 약발</small>${FootPair({ foot: x.side, weakFoot: x.weakFoot })}<span>${esc(x.foot)} 주발 · 약발 ${x.weakFoot}${x.weakFoot >= 5 ? ' 양발' : ''}</span></div></div>
      ${x.traits.length ? `<div class="ng-traits">${x.traits.map((t) => `<span class="ng-trait">${TagChip({ name: t.ko, kind: 'gen', polarity: t.kind, ...(t.release ? { release: t.release } : {}), desc: t.desc })}<small>${esc(t.desc)}</small></span>`).join('')}</div>` : '<p class="small muted">태그 없음</p>'}
      <p class="small muted">랜덤은 태그 0~2개가 붙어요. 마음에 안 들면 [다시 돌리기].</p></div>` : '';
  // 인종 · 기본 사진 (C.73c): 국적·이름은 그 인종 안에서 시드 랜덤
  const id = vm.identity;
  const looks = id ? `${SectionTitle({ title: '인종 · 기본 사진', action: id.picked ? '직접 고름' : '랜덤' })}
    <div class="panel ng-looks">
      <div class="cu-chips">${id.races.map((r) => `<button type="button" class="cu-chip${r.id === id.race ? ' is-on' : ''}" data-act="form" data-k="race" data-v="${r.id}" aria-pressed="${r.id === id.race}">${esc(r.ko)}</button>`).join('')}</div>
      ${photoRow('form', 'photo', id.photos, id.photo)}
      <p class="small muted">국적 ${esc(id.nationalityKo)} · 이름을 비우면 ${esc(id.name)}. 인종을 고르면 기본 사진이 바뀌고, 국적·이름은 그 인종 안에서 정해져요. 시작한 뒤 페이스온에서 내 사진으로 바꿀 수 있어요.</p></div>` : '';
  const a = vm.attrSummary;
  const attrs = `${SectionTitle({ title: '능력치', action: a ? `강점 ${a.top}` : '' })}
    <button type="button" class="panel ng-attrs" data-act="ng-attrs" aria-expanded="${u.attrsOpen}"><span class="grow"><b>${a ? `${a.count}개 · 평균 ${a.avg}` : '능력치'}</b><small>${a ? `약점 ${esc(a.weak)}` : ''}</small></span><span class="ng-attrs__btn">${u.attrsOpen ? '접기' : '펼치기'} ${Icon({ name: 'chevron-right', size: 14, style: `transform:rotate(${u.attrsOpen ? -90 : 90}deg)` })}</span></button>
    ${u.attrsOpen ? attrGrid(vm.attrs, null, undefined, { cols: 4, keyLabel: `${vm.position} 핵심` }) : ''}`;
  const left = `${SectionTitle({ title: '시작 포지션', action: '코치 추천 4자리' })}
    ${cands}${outside}${coach}
    ${others}
    ${vm.others ? '' : '<p class="small ng-links"><button type="button" class="link-btn hi" data-act="form-others">다른 포지션에서 고르기</button></p>'}
    ${looks}
    ${vm.teamPick ? startTeamSection(vm.teamPick, vm.startTeam ? `${vm.startTeam} 유스` : '고르지 않으면 랜덤', '유망주는 리그 레이팅 상위 팀에서는 시작할 수 없어요.', 'form', 'startTeam') : ''}`;
  const right = `${extras}
    ${attrs}
    ${startOptions(vm, true, u)}
    <div class="btn-col ng-rollbtns">${Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'start', children: vm.startTeam ? `이대로 시작 · ${vm.startTeam} 유스` : `이대로 시작 · ${vm.teamHint} 유스` })}
      <div class="btn-row even">${Button({ variant: 'secondary', block: true, icon: 'edit', act: 'ng-edit', children: '편집하기' })}${Button({ variant: 'ghost', block: true, icon: 'swap', act: 'form-reroll', children: '다시 돌리기' })}</div>
      <p class="small muted">랜덤도 커스텀 배분 포인트 안에서 뽑아요. 편집하기 = 이 값으로 커스텀 단계에 들어가요. 숨은 재능·적성은 [이대로 시작]일 때만 이 결과 그대로예요.</p></div>`;
  return { left, right };
}

/** 시작 팀 (45b b → 디자인 239 모양 C.76l): 판 하나 = 리그 탭(국기 + 이름) + 그 리그 팀 목록. 고른 팀 리그가 내 리그 (전체 랜덤 · 커스텀 공통) */
export function startTeamSection(pick: TeamPickVM, action: string, rule: string, act: string, key: string, title = '시작 팀'): string {
  return `${SectionTitle({ title, action })}
    <div class="panel tp-panel"><p class="small muted">리그를 고르고 그 리그 팀을 골라요. 고른 팀의 리그가 내 리그예요. ${esc(rule)}</p>${teamPickHtml(pick, act, key)}</div>`;
}

/** PC 2열 (디자인 229 · 239 · 233 PC): 왼쪽 = 고르는 것, 오른쪽 = 시작 옵션 · 버튼 */
function ngColumns(top: string, b: { left: string; right: string }): string {
  return isWide()
    ? `<div class="ng-pc"><div class="ng-pc__l">${top}${b.left}</div><div class="ng-pc__r">${b.right}</div></div>`
    : `${top}${b.left}${b.right}`;
}

const GROUP_KO: [('fw' | 'mf' | 'df'), string][] = [['fw', '공격'], ['mf', '미드'], ['df', '수비']];

/** 다른 포지션에서 고르기 (C.71b 디자인 176): 공격·미드·수비 묶음 OVR 표 · 맨 위 추천 대비 차이 · 추천/와일드카드 칩 · 고른 줄 라임 테두리 */
function othersPanel(vm: NewGameVM): string {
  const base = vm.candidates[0];
  const wild = new Set(vm.candidates.filter((c) => c.wild).map((c) => c.id));
  const row = (p: NewGameVM['posTable'][number]) => {
    const d = base ? p.ovr - base.ovr : 0;
    const chip = wild.has(p.id) ? '<span class="ng-pt__chip is-wild">와일드카드</span>' : p.cand ? '<span class="ng-pt__chip">추천</span>' : '';
    return `<button type="button" class="ng-pt__row${p.on ? ' is-on' : ''}" data-act="form" data-k="position" data-v="${p.id}" aria-pressed="${p.on}"><b class="ng-pt__pos po-num">${p.id}</b><span class="ng-pt__ko">${esc(p.ko)}</span>${chip}<span class="ng-pt__d po-num${d < 0 ? ' is-minus' : ''}">${p.id === base?.id ? '기준' : d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0'}</span><b class="ng-pt__ovr po-num">${p.ovr}</b></button>`;
  };
  const groups = GROUP_KO.map(([g, ko]) => {
    const rows = vm.posTable.filter((p) => POS_GROUP[p.id] === g);
    return rows.length ? `<small class="ng-pt__group">${ko}</small>${rows.map(row).join('')}` : '';
  }).join('');
  return `<div class="panel ng-pt"><div class="ng-pt__head"><span class="grow"><b>다른 포지션에서 고르기</b><small class="muted">능력치는 그대로, 포지션마다 OVR만 달라져요</small></span><button type="button" class="link-btn hi ng-pt__fold" data-act="form-others">접기 ${Icon({ name: 'chevron-right', size: 14, style: 'transform:rotate(-90deg)' })}</button></div>
    <div class="ng-pt__cols"><span>포지션</span><span>${base ? `${esc(base.id)} 대비` : ''}</span><span>OVR</span></div>
    ${groups}
    <p class="small muted">GK는 랜덤 시작에서 고를 수 없어요. 줄을 누르면 그 포지션으로 시작해요.</p></div>`;
}

type SortId = NewGameUI['rsort'];
const SORTS: { id: SortId; label: string; sub: string; legend?: boolean }[] = [
  { id: 'peak', label: '전성기순', sub: '레전드 팩: 전성기 OVR 높은 순', legend: true }, { id: 'ovr', label: '지금 OVR순', sub: '2018-19 시즌 시작 OVR' },
  { id: 'age', label: '나이순', sub: '어린 선수부터' }, { id: 'name', label: '이름순', sub: '가나다순' },
];

/** 정렬 줄 4개 (디자인 175): 고른 줄 라임 글자 + 체크 */
function sortRows(legendTab: boolean, cur: SortId): string {
  return SORTS.filter((x) => legendTab || !x.legend).map((x) => `<button type="button" class="ng-sortrow${x.id === cur ? ' is-on' : ''}" data-act="ng-sort-pick" data-v="${x.id}" aria-pressed="${x.id === cur}"><span class="grow"><b>${x.label}</b><small>${esc(x.sub)}</small></span>${x.id === cur ? Icon({ name: 'check', size: 18 }) : ''}</button>`).join('');
}

/** 실제 선수 (디자인 131): [실제 선수 n | 레전드 n] 묶음 탭 → 고른 선수 카드 → 검색·정렬 → 포지션군 → 10명 + 더 보기 */
function realBody(vm: NewGameVM, u: NewGameUI): { left: string; right: string } {
  const legendTab = vm.legends && u.realTab === 'legend';
  const futureTab = vm.futureStars && u.realTab === 'future';
  const tabs = vm.legends || vm.futureStars
    ? Tabs({ items: [{ id: 'real', label: `실제 선수 ${vm.reals.length}` }, ...(vm.legends ? [{ id: 'legend', label: `레전드 ${vm.legendList.length}` }] : []), ...(vm.futureStars ? [{ id: 'future', label: `미래 스타 ${vm.futureList.length}` }] : [])], value: futureTab ? 'future' : legendTab ? 'legend' : 'real', variant: 'segment', fill: true, act: 'ng-real', data: { k: 'realTab' }, label: '실제 선수 묶음' })
    : '';
  const startBtn = `<div class="btn-col">${Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'start', disabled: !vm.selected, children: vm.selected ? `${vm.selected.name}으로 시작 · ${vm.selected.club}` : '선수를 골라요' })}</div>`;
  if (futureTab) return { left: `${tabs}${futureBody(vm)}`, right: `${startOptions(vm, false, u)}${startBtn}` };
  const sel = vm.selected;
  const card = sel ? `<div class="panel ng-sel">${Avatar({ size: 52, face: { id: sel.id, age: sel.age }, name: sel.name })}<span class="grow">${sel.legend ? '<span class="ng-legend">레전드</span> ' : ''}<small class="muted">고른 선수</small><b class="ng-sel__name">${esc(sel.name)}</b><small>${esc(sel.club)} · ${sel.age}세 · ${sel.position}${sel.youthKo ? ` · 유스 ${esc(sel.youthKo)}` : ''}</small></span><span class="ng-sel__ovr"><b class="po-num">${sel.ovr}</b>${sel.peak ? `<small class="ng-peak">전성기 ${sel.peak}</small>` : '<small>OVR</small>'}</span>
      <p class="small muted ng-sel__note">${sel.legend ? `2018-19 세계에 ${sel.age}세로 들어와 30세 무렵 전성기에 닿아요. 실제 유스 클럽은 기록으로만 남아요.` : '지금 소속팀·나이·능력치 그대로 시작해요. 이름은 바꿀 수 없어요. OVR은 시드에 따라 조금 달라져요.'}</p></div>` : '';
  type Row = { id: string; name: string; club: string; age: number; position: string; ovr: number; peak?: number; youthKo?: string; bvb?: boolean };
  // 레전드 팩 묶음 (디자인 234): 전체 · 기본 레전드 · 도르트문트 → 고른 묶음만 목록
  const lpack = legendTab ? u.lpack ?? 'all' : 'all';
  const bvbN = vm.legendList.filter((r) => r.bvb).length;
  const packs = legendTab && bvbN ? `<div class="ng-lpack__head"><small>레전드 팩 묶음</small><small class="muted">팩마다 켜고 끌 수 있어요</small></div><div class="ng-lpack" role="radiogroup" aria-label="레전드 팩 묶음">${
    ([['all', '전체', vm.legendList.length], ['base', '기본 레전드', vm.legendList.length - bvbN], ['bvb', '도르트문트', bvbN]] as const).map(([id, ko, n]) =>
      `<button type="button" class="ng-lpack__cell${lpack === id ? ' is-on' : ''}" data-act="ng-real" data-k="lpack" data-v="${id}" role="radio" aria-checked="${lpack === id}"><b>${ko}</b><small class="po-num">${n}명</small></button>`).join('')}</div>` : '';
  const all: Row[] = legendTab ? vm.legendList.filter((r) => lpack === 'all' || (lpack === 'bvb') === !!r.bvb) : vm.reals;
  const q = u.rq.trim().toLowerCase();
  const rows = all.filter((r) => (u.rgroup === 'all' || POS_GROUP[r.position] === u.rgroup) && (!q || [r.name, r.club, r.youthKo ?? ''].some((t) => t.toLowerCase().includes(q))))
    .sort((a, b) => (u.rsort === 'name' ? a.name.localeCompare(b.name) : u.rsort === 'age' ? a.age - b.age || b.ovr - a.ovr : u.rsort === 'peak' && legendTab ? (b.peak ?? 0) - (a.peak ?? 0) || b.ovr - a.ovr : b.ovr - a.ovr));
  const shown = rows.slice(0, u.rshow);
  const sortV: SortId = !legendTab && u.rsort === 'peak' ? 'ovr' : u.rsort;
  const sortLabel = SORTS.find((x) => x.id === sortV)!.label;
  const open = !!u.sortOpen;
  // 정렬 (C.71b 디자인 175): 버튼 → 실제 선수는 바로 아래 펼침 목록, 레전드는 아래 시트(PC는 오른쪽 패널)
  const menu = open && !legendTab ? `<div class="ng-sortmenu" role="menu"><small class="ng-sortmenu__head">정렬</small>${sortRows(false, sortV)}</div>` : '';
  const search = `<div class="ng-search">${TextField({ value: u.rq, placeholder: legendTab ? '이름 · 시작 구단 · 유스' : '이름 · 소속 구단', icon: 'search', input: { id: 'f-rq', type: 'search', maxLength: 20 }, clearable: !!u.rq, onClear: { act: 'ng-real', data: { k: 'rq', v: '' } } })}
    <button type="button" class="ng-sortbtn${open ? ' is-open' : ''}" data-act="ng-sort" aria-expanded="${open}" aria-label="정렬">${Icon({ name: 'sliders', size: 16 })}<span>${sortLabel}</span>${Icon({ name: 'chevron-down', size: 14 })}</button>${menu}</div>`;
  const sheet = open && legendTab ? BottomSheet({
    eyebrow: `레전드 ${vm.legendList.length}명`, title: '정렬', onClose: { act: 'ng-sort-close' },
    children: `<button type="button" class="ng-sheet-x" data-act="ng-sort-close">${Icon({ name: 'close', size: 16 })}닫기</button>${sortRows(true, sortV)}`,
  }) : '';
  const groups = Tabs({ items: [{ id: 'all', label: '전체' }, { id: 'fw', label: '공격' }, { id: 'mf', label: '미드' }, { id: 'df', label: '수비' }], value: u.rgroup, variant: 'segment', fill: true, act: 'ng-real', data: { k: 'rgroup' }, label: '포지션군' });
  const row = (p: Row) => `<button type="button" class="real-row ng-row${p.id === vm.realId ? ' is-on' : ''}" data-act="form" data-k="realId" data-v="${p.id}">${Avatar({ size: 40, face: { id: p.id, age: p.age }, name: p.name })}<span class="grow"><b class="ng-row__name">${esc(p.name)}</b><small class="ng-row__meta">${legendTab ? `<span class="ng-badge${p.bvb ? ' is-bvb' : ''}">${p.bvb ? '도르트문트' : '레전드'}</span>` : ''}${esc(p.club)} · ${p.age}세 · ${p.position}${p.youthKo ? ` · 유스 ${esc(p.youthKo)}` : ''}</small></span>${
    p.peak ? `<span class="ng-row__ovr"><span><b class="po-num muted">${p.ovr}</b> → <b class="po-num ng-peak">${p.peak}</b></span><small>지금 → 전성기</small></span>` : `<span class="ng-row__ovr"><b class="po-num">${p.ovr}</b><small>OVR</small></span>`}</button>`;
  const left = rows.length - shown.length;
  const more = left > 0 ? `<button type="button" class="dt-more ng-more" data-act="ng-real" data-k="rshow" data-v="${u.rshow + REAL_MORE}">${Icon({ name: 'chevron-right', size: 14, style: 'transform:rotate(90deg)' })}${Math.min(REAL_MORE, left)}명 더 보기 · ${left}명 남음</button>` : '';
  const head = `<div class="ng-listhead"><b class="small">${legendTab ? `${lpack === 'bvb' ? '도르트문트 레전드' : lpack === 'base' ? '기본 레전드' : '레전드'} ${rows.length}명 · GK 제외` : `실제 선수 ${rows.length}명`}</b><small class="muted">${legendTab ? (sortV === 'peak' ? '전성기 OVR 높은 순' : '') : ''}</small></div>`;
  return {
    left: `${tabs}${card}${packs}${search}${groups}${head}
    <div class="real-list">${shown.map(row).join('') || '<p class="small muted">맞는 선수가 없어요.</p>'}</div>${more}`,
    right: `${startOptions(vm, false, u)}${startBtn}${sheet}`,
  };
}

/** 미래 스타 묶음 (C.75y, 디자인 없음): 등장 시즌 순 + 리그 추가 후 등장. 고를 수 없고 구현 리그 첫 시즌이 되면 세계에 나타난다 */
function futureBody(vm: NewGameVM): string {
  // 디자인 233: 등장 줄 = 등장 시즌 · 나이 · 포지션 · 팀 / 오른쪽 등장 → 전성기, 내 리그 밖 줄 = "다른 리그" 칩 · 실제 첫 시즌 팀 / 전성기
  const row = (p: NewGameVM['futureList'][number]) => `<div class="real-row ng-row ng-future${p.waiting ? ' is-waiting' : ''}">${Avatar({ size: 40, face: { id: p.id, age: p.age }, name: p.name })}<span class="grow"><b class="ng-row__name">${esc(p.name)}</b><small class="ng-row__meta">${p.waiting ? `<span class="ng-badge is-wait">다른 리그</span>${p.position}${p.realClub ? ` · 실제 ${esc(p.realClub)}` : ''}` : `${esc(p.debut)} 등장 · ${p.age}세 · ${p.position} · ${esc(p.club)}`}</small></span><span class="ng-row__ovr">${p.waiting ? `<span><b class="po-num ng-peak">${p.peak}</b></span><small>전성기</small>` : `<span><b class="po-num muted">${p.start}</b> → <b class="po-num ng-peak">${p.peak}</b></span><small>등장 → 전성기</small>`}</span></div>`;
  const now = vm.futureList.filter((p) => !p.waiting);
  const later = vm.futureList.filter((p) => p.waiting);
  return `<div class="ng-listhead"><b class="small">미래 스타 ${vm.futureList.length}명 · 등장 ${now.length} · 다른 리그 ${later.length}</b><small class="muted ng-lock">${Icon({ name: 'lock', size: 12 })}고를 수 없어요</small></div>
    <p class="small muted">2018-19 세계엔 아직 없는 선수예요. 내 리그에서 처음 뛴 실제 시즌에 그 팀으로, 그때 나이로 나타나요. 그 전 실제 경력은 선수 화면에 남아요.</p>
    <div class="real-list">${now.map(row).join('')}</div>
    ${later.length ? `<div class="ng-listhead"><b class="small">내 리그에서 뛴 적 없음 ${later.length}명</b><small class="muted">그 리그를 내 리그로 고르면 첫 시즌에</small></div><div class="real-list">${later.map(row).join('')}</div>` : ''}`;
}

// ── 포인트 찍기 (50) ──

export function allocateView(vm: AllocateVM, sel: string | null, pending: number, rule = false): string {
  // 디자인 113 (C.58): compact 머리말 + OVR 한 줄 + 비용 칩 + AttrGrid 4열 편집 + 아래 고정 [초기화][확정]
  const hero = HeroPanel({
    title: '능력치 포인트', right: `Lv ${vm.level}`, back: { act: 'alloc-cancel' }, compact: true, eyebrow: '남은 포인트', value: vm.points, pad: false, progress: false,
    chips: [`보유 ${vm.points + pending}P`, { label: `이번 배분 ${pending}P`, soft: true }],
  });
  const ovr = `<div class="panel al-ovr"><div><small>지금 OVR</small><b class="po-num">${vm.startOvr}</b></div>${Icon({ name: 'chevron-right', size: 18 })}<div><small>확정하면</small><b class="po-num hi">${vm.exact.toFixed(1)}</b></div><span class="al-ovr__base"><small>${esc(vm.position)} 기준</small><b class="po-num">${vm.startExact.toFixed(1)} → ${vm.exact.toFixed(1)}</b></span></div>`;
  const coach = vm.coachComment
    ? `<div class="coach">${Avatar({ size: 36 })}<div><small>코치 · 비용 구간</small><b>"여기서부터는 성장이 더뎌져. 실력이 한 단계 더 올라서면 다시 길이 열릴 거야."</b></div></div>`
    : '';
  // 찍기 한 번 = 화면 +1칸 (C.49): 비용은 지금 칸 기준 1·2·3P
  // C.70 (디자인 163): 구간 칩 "~n 1칸 1P", [규칙] 펼침 = 라임 왼쪽 막대 안내 상자
  const ppl = BALANCE.growth.pointsPerLevel;
  const bands = `<div class="al-bands"><span class="al-band">~${vm.cost1Max} 1칸 <b>1P</b></span><span class="al-band warn">${vm.cost1Max + 1}~${vm.cost2Max} 1칸 <b>2P</b></span><span class="al-band fail">${vm.cost2Max + 1}~ 1칸 <b>3P</b></span><button type="button" class="link-btn al-rule" data-act="alloc-rule" aria-expanded="${rule}">${Icon({ name: 'info', size: 14 })} 규칙${Icon({ name: rule ? 'chevron-up' : 'chevron-down', size: 14 })}</button></div>
    <div class="al-rule-text"${rule ? '' : ' hidden'}><b>포인트 찍는 규칙</b><ul>
      <li>레벨이 오를 때마다 <b>${ppl}P</b>를 받아요. 능력치는 1~20으로 보여요.</li>
      <li>박스를 누르면 [+]/[−]가 나와요. [+] 한 번 = 한 칸(+1), [−]는 한 칸씩 되돌려요.</li>
      <li>칸이 높을수록 비싸요: ${vm.cost1Max}까지 1칸 1P · ${vm.cost1Max + 1}~${vm.cost2Max}은 2P · ${vm.cost2Max + 1}부터 3P. 구간은 실력 ${esc(vm.tierName)}(OVR) 기준이에요.</li>
      <li>남은 포인트로 못 올리는 박스는 회색으로 "nP 부족"이 떠요.</li>
      <li>테두리 = ${esc(vm.position)} 핵심 능력치. 막대(칸 안 진행)는 그대로 따라가요.</li></ul></div>`;
  return `${hero}<div class="body al-body">${ovr}${coach}${bands}
    ${attrGrid(vm.attrs, sel, undefined, { cols: 4, keyLabel: `${vm.position} 핵심`, shortLegend: true })}
    ${Button({ variant: 'ghost', block: true, icon: 'target', act: 'auto-alloc', disabled: vm.points === 0, children: '자동 배분 (포지션 OVR 우선)' })}</div>
    <div class="dock al-dock">${actionRow(
      Button({ variant: 'secondary', size: 'lg', block: true, icon: 'restore', act: 'alloc-reset', disabled: pending === 0, children: '초기화' }),
      Button({ size: 'lg', block: true, icon: 'check', act: 'alloc-done', children: pending ? `확정 · ${pending}P 사용` : '확정' }),
    )}</div>`;
}

// ── 순위표·리그 스타 (54) ──

/** "n명 더 보기" 펼침 단추 (C.60, 디자인 147 · 148): 누르면 ui.more[key] 토글 */
export function moreButton(key: string, open: boolean, label: string): string {
  return Button({ variant: 'ghost', block: true, icon: open ? 'chevron-up' : 'chevron-down', act: 'more', data: { v: key }, className: 'more-btn', children: open ? '접기' : label });
}

const STAR_PAGE = 5;
const LEGEND_PAGE = 6;

/** 월드 (디자인 101~105 · 146 · 147, C.60): compact 머리말 + 탭 4 (순위표 · 득점 · 리그 스타 · 이적 소식) */
export function worldView(vm: WorldVM, tab: 'table' | 'stars' | 'scorers' | 'transfers' | 'cups', transfers = '', more: Record<string, boolean> = {}, group: StarGroup = 'league', board: BoardKind = 'goals', cups = ''): string {
  const me = vm.table.find((r) => r.me)!;
  const leader = vm.table[0]!;
  const hero = HeroPanel({
    title: '월드', right: `${vm.round}R / ${vm.rounds}`, back: false, compact: true, eyebrow: `리그 · ${me.team} 순위`, value: `${vm.myPos}위`, pad: false, progress: false,
    chips: [`승점 ${me.points}`, me.pos === 1 ? '선두' : `1위와 ${leader.points - me.points}점`, { label: `${vm.season} 시즌`, soft: true }],
  });
  const tabs = Tabs({ items: [{ id: 'table', label: '순위표' }, { id: 'cups', label: '컵·챔스' }, { id: 'scorers', label: '득점' }, { id: 'stars', label: '리그 스타' }, { id: 'transfers', label: '이적 소식' }], value: tab, variant: 'underline', fill: true, act: 'world-tab' });
  // 리그 기록 (C.64): 득점 · 도움 · 평점 거르기 (147 의 segment 탭 재사용), 강조 열 = 고른 기록
  const boardTabs = Tabs({ items: [{ id: 'goals', label: '득점' }, { id: 'assists', label: '도움' }, { id: 'rating', label: '평점' }], value: board, variant: 'segment', act: 'world-board', label: '리그 기록 거르기' });
  const rowsB = vm.boards[board];
  const hi = (k: BoardKind, v: string | number) => (k === board ? `<b class="po-num">${v}</b>` : `${v}`);
  // 209: 평점 자격 안내는 표 위 안내 줄, 소속은 이름 아래 둘째 줄, 기준 칸 머리 라임
  const th = (k: BoardKind, t: string) => `<th${k === board ? ' class="hi"' : ''}>${t}</th>`;
  const scorers = `${boardTabs}${board === 'rating' ? `<div class="wl-note">${Icon({ name: 'info', size: 16 })}<span>평점은 <b>${vm.ratingMin}경기 이상 출전</b>한 선수만 순위에 올라요. 다른 팀 경기도 엔진으로 계산한 기록이에요(빠른 진행으로 계산한 경기는 빠져요).</span></div>` : ''}${rowsB.length
    ? `<div class="panel tbl-panel"><table class="tbl league wl-board">
      <tr><th>#</th><th class="l">선수</th><th>출전</th>${th('goals', '골')}${th('assists', '도움')}${th('rating', '평점')}</tr>
      ${rowsB.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td class="po-num">${r.rank ?? i + 1}</td><td class="l"><span class="wl-who">${Avatar({ size: 28, face: r.face, name: r.name })}<span class="wl-who__t"><button type="button" class="dt-link" data-act="person-open" data-v="${esc(r.id)}">${esc(r.name)}</button>${r.teamId ? teamLink(r.teamId, r.team, 'small muted') : ''}</span></span></td><td class="po-num">${r.apps}</td><td class="po-num">${hi('goals', r.goals)}</td><td class="po-num">${hi('assists', r.assists)}</td><td class="po-num">${hi('rating', r.avg)}</td></tr>`).join('')}
    </table></div><p class="small muted">[득점]·[도움]·[평점]을 누르면 그 기준으로 다시 줄 세워요. 기준 칸만 라임 글자 · 굵게.${board === 'rating' ? '' : ' 다른 팀 경기도 엔진으로 계산한 기록이에요(빠른 진행으로 계산한 경기는 빠져요).'}</p>`
    : `<p class="small muted">${board === 'rating' ? `아직 ${vm.ratingMin}경기 이상 뛴 선수가 없어요.` : '아직 기록이 없어요. 경기가 진행되면 순위가 쌓여요.'}</p>`}`;
  // 디자인 146: 팀 옆 "재" 열 = 재정 등급 4단 막대(색 없음) + 아래 범례 (팀 수)
  const tierCount = FIN_TIERS.map((t) => ({ t, n: vm.table.filter((r) => r.tier === t).length }));
  // 리그 고르기 (C.76c, 45b): 내 리그 + 고른 다른 리그 (순위표·득점 탭)
  const leagueBar = vm.leagueTabs.length && (tab === 'table' || tab === 'scorers')
    ? Tabs({ items: vm.leagueTabs, value: vm.leagueSel, variant: 'segment', scroll: true, act: 'world-league', label: '리그 고르기' }) : '';
  const o = vm.other;
  const table = o ? otherTable(o) : `${vm.groups ? vm.groups.map((g) => `${SectionTitle({ title: g.title })}${leagueTableHtml(g.rows, g.rows.length, true)}`).join('') : leagueTableHtml(vm.table, vm.teams, true)}
    ${SectionTitle({ title: '재정 등급', action: '재 열 막대 = 구단 재정' })}
    ${panel(`<div class="fin-legend">${tierCount.map((x) => `<div class="fin-legend__cell">${FinChip(x.t, true)}<small class="po-num">${x.n}팀</small></div>`).join('')}</div>
      <p class="small muted">이적료·연봉을 낼 수 있는 크기예요. 표에서는 막대만, 글자는 이 범례와 팀 상세에서. 색은 쓰지 않아요(순위 색과 겹치지 않게).</p>`)}`;
  const starRow = (s: StarVM, i: number) => `<button type="button" class="star-row" data-act="person-open" data-v="${esc(s.id)}"><span class="rank po-num${i === 0 ? ' hi' : ''}">${i + 1}</span>${Avatar({ size: 40, face: s.face, name: s.name })}<span class="grow"><b class="star-name">${esc(s.name)}</b><small class="star-club">${esc(s.club)}</small><small>${s.age}세 · ${s.position}${s.ga ? ` · <b class="star-ga">${esc(s.ga)}</b>` : ''}</small></span><span class="ovr"><b class="po-num">${s.ovr}</b><small class="${(s.change ?? 0) > 0 ? 'up' : (s.change ?? 0) < 0 ? 'down' : ''}">${s.change ? (s.change > 0 ? `▲${s.change}` : `▼${-s.change}`) : '–'}</small></span></button>`;
  const legRow = (s: WorldVM['legends'][number], i: number) => `<button type="button" class="star-row" data-act="person-open" data-v="${esc(s.id)}"><span class="rank po-num">${i + 1}</span>${Avatar({ size: 40, face: s.face, name: s.name })}<span class="grow"><b class="star-name">${esc(s.name)}</b><small><span class="ng-badge${s.kind === '도르트문트' ? ' is-bvb' : ''}">${esc(s.kind)}</span>${esc(s.club)} · ${s.age}세 · ${s.position}</small></span><span class="ovr"><b class="po-num">${s.ovr}</b><small class="peak">전성기 ${s.peak}</small></span></button>`;
  // 리그 스타 묶음 (C.64, 디자인 147 segment 탭): 리그 안(위상 순) · 세계(리그 밖 실제 선수) · 21세 이하
  const groupTabs = Tabs({ items: [{ id: 'league', label: '리그 안' }, { id: 'world', label: '세계' }, { id: 'young', label: '21세 이하' }], value: group, variant: 'segment', act: 'world-stars', label: '리그 스타 거르기' });
  const list = group === 'world' ? vm.starsWorld : group === 'young' ? vm.starsYoung : vm.stars;
  const starsShown = more.stars ? list : list.slice(0, STAR_PAGE);
  const legShown = more.legends ? vm.legends : vm.legends.slice(0, LEGEND_PAGE);
  const groupNote = group === 'world' ? '리그 밖 클럽의 실제 선수들이에요(OVR 순). 오른쪽 아래 = 지난 시즌 대비 OVR 변화.'
    : group === 'young' ? '리그 팀의 21세 이하 선수들이에요(OVR 순). 이번 시즌 기록이 있으면 메타 줄 끝에.'
      : '리그 팀 선수를 위상(OVR + 시즌 기록 + 수상) 순으로 보여 줘요. 오른쪽 = OVR, 아래 = 지난 시즌 대비 변화.';
  const stars = `${groupTabs}<p class="small muted">${groupNote}</p>
    ${list.length ? `<div class="star-list">${starsShown.map(starRow).join('')}</div>` : '<p class="small muted">해당하는 선수가 없어요.</p>'}
    ${list.length > STAR_PAGE ? moreButton('stars', !!more.stars, `${group === 'world' ? '세계 스타' : group === 'young' ? '21세 이하' : '리그 스타'} ${list.length - STAR_PAGE}명 더 보기`) : ''}
    ${group === 'league' && vm.legends.length ? `${SectionTitle({ title: '레전드', action: `레전드 팩 · ${LEGEND_TOTAL}명` })}
    <p class="small muted">레전드 팩으로 들어온 선수 중 리그에서 뛰는 ${vm.legends.length}명이에요. 지금 OVR과 전성기 예상을 같이 보여 줘요(지금 OVR 순).</p>
    <div class="star-list">${legShown.map(legRow).join('')}</div>
    ${vm.legends.length > LEGEND_PAGE ? moreButton('legends', !!more.legends, `레전드 ${vm.legends.length - LEGEND_PAGE}명 더 보기`) : ''}` : ''}
    ${group === 'league' && (vm.upcoming.length || vm.waiting) ? `<p class="small muted wl-upcoming">${Icon({ name: 'calendar', size: 14 })}<span><b>미래 스타 · 등장 예정</b>${vm.upcoming.map((u) => ` · ${esc(u.name)} ${u.debut}`).join('')}${vm.waiting ? ` · 고른 리그 밖 ${vm.waiting}명` : ''}</span></p>` : ''}
    ${group === 'league' && vm.abroad.length ? `<p class="small muted wl-upcoming">${Icon({ name: 'plane', size: 14 })}<span><b>리그 밖 레전드 · 이적 유입 예정</b>${vm.abroad.map((u) => ` · ${esc(u.name)}(${esc(u.club)}) ${u.season}`).join('')}</span></p>` : ''}
    ${vm.retired.length ? `<p class="small muted">은퇴: ${vm.retired.map(esc).join(', ')}</p>` : ''}`;
  return `${hero}<div class="body">${tabs}${leagueBar}${tab === 'table' ? table : tab === 'cups' ? cups : tab === 'scorers' ? (o ? otherScorersHtml(o) : scorers) : tab === 'transfers' ? transfers : stars}</div>`;
}

/** 순위표 (내 리그는 팀 상세로 이어지고 재정 막대·범례, 다른 리그는 이름만, C.76c) */
function leagueTableHtml(rows: WorldRowVM[], teams: number, mine: boolean): string {
  const team = (r: WorldRowVM) => mine
    ? `<button type="button" class="dt-link team" data-act="team-open" data-v="${esc(r.teamId)}">${Crest({ name: r.team, team: r.teamId, size: 16 })}${esc(r.team)}</button>`
    : `<span class="dt-link team">${Crest({ name: r.team, team: r.teamId, size: 16 })}${esc(r.team)}</span>`;
  return `<div class="panel tbl-panel"><table class="tbl league">
      <tr><th>#</th><th class="l">팀</th><th class="fin-col" title="재정 등급">재</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
      ${rows.map((r) => `<tr class="${r.me ? 'me' : ''}${r.pos <= 4 ? ' top' : ''}${r.pos > teams - 3 ? ' low' : ''}"><td class="po-num">${r.pos}</td><td class="l">${team(r)}</td><td class="fin-col">${FinChip(r.tier, true, true)}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gd}</td><td><b class="po-num">${r.points}</b></td></tr>`).join('')}
    </table><div class="legend small"><span><i class="k top"></i>상위 4팀</span><span><i class="k low"></i>하위 3팀</span><span class="grow r">${mine ? '팀 전력 = 라인업 평균' : '다른 리그 · 팀 전력 = 데이터 레이팅'}</span></div></div>`;
}

/** 다른 리그 순위 (C.76c): 상태 줄 · (컨퍼런스별) 순위표 · 지난 시즌 */
function otherTable(o: OtherLeagueVM): string {
  const head = `<p class="small muted wl-other"><b>${esc(o.name)}</b> · ${esc(o.sub)} · ${esc(o.season)} · ${esc(o.status)}</p>`;
  const body = o.groups ? o.groups.map((g) => `${SectionTitle({ title: g.title })}${leagueTableHtml(g.rows, g.rows.length, false)}`).join('') : leagueTableHtml(o.table, o.table.length, false);
  const last = o.last ? `<p class="small muted">지난 시즌(${esc(o.last.season)}) 우승 ${esc(o.last.champion)}${o.last.scorer ? ` · 득점왕 ${esc(o.last.scorer)}` : ''}</p>` : '';
  return `${head}${body}${last}<p class="small muted">다른 리그도 설정의 '다른 경기 계산'대로 진행돼요(전체 엔진 · 빠른 진행, 승강 없음).</p>`;
}

/** 다른 리그 득점 순위 (C.76c) */
function otherScorersHtml(o: OtherLeagueVM): string {
  if (!o.scorers.length) return `<p class="small muted">${esc(o.name)} · ${esc(o.status)} · 아직 기록이 없어요.</p>`;
  return `<p class="small muted wl-other"><b>${esc(o.name)}</b> · ${esc(o.season)} · ${esc(o.status)}</p><div class="panel tbl-panel"><table class="tbl league">
    <tr><th>#</th><th class="l">선수</th>${o.engine ? '<th>출전</th>' : ''}<th>골</th><th>도움</th>${o.engine ? '<th>평점</th>' : ''}</tr>
    ${o.scorers.map((r, i) => `<tr><td class="po-num">${i + 1}</td><td class="l"><b>${esc(r.name)}</b> <span class="small muted">${esc(r.team)}</span></td>${o.engine ? `<td>${r.apps ?? '-'}</td>` : ''}<td><b class="po-num">${r.goals}</b></td><td>${r.assists}</td>${o.engine ? `<td>${r.avg}</td>` : ''}</tr>`).join('')}
  </table><div class="legend small"><span class="grow r">${o.engine ? '22명 엔진으로 계산한 경기 기록 (빠른 계산 경기는 득점·도움만)' : '빠른 계산 경기의 득점·도움'}</span></div></div>`;
}

const chipList = (xs: { label: string; value: number }[]) => (xs.length
  ? `<div class="chips">${xs.map((d) => `<span class="po-chip"><span class="po-chip__label">${esc(d.label)}</span><b class="po-num ${d.value > 0 ? 'up' : 'down'}">${displayDelta(d.value)}</b></span>`).join('')}</div>`
  : '<div class="chips"><span class="po-chip">변화 없음</span></div>');
const sum = (xs: { value: number }[]) => xs.reduce((t, x) => t + x.value, 0);
/** 1~20 칸 단위 합 (C.44, 한 칸 = 내부 5) */
const signedSum = (n: number) => (n ? displayDelta(n) : '0');

export type SeasonTab = 'matches' | 'months' | 'positions' | 'awards' | 'transfers' | 'growth';

/** 월별·포지션별 표 */
function splitTable(rows: SeasonVM['months'], head: string): string {
  if (!rows.length) return '<p class="muted small">아직 기록이 없어요.</p>';
  return `<div class="table-wrap"><table class="tbl"><tr><th class="l">${esc(head)}</th><th>출전</th><th>골</th><th>도움</th><th>평점</th><th>승</th><th>무</th><th>패</th></tr>
    ${rows.map((r) => `<tr><td class="l"><b>${esc(r.label)}</b></td><td>${r.apps}</td><td>${r.goals}</td><td>${r.assists}</td><td>${r.avg}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td></tr>`).join('')}</table></div>`;
}

/**
 * 시즌 종료 (51, C.44 pending 52 3번): 요약 카드 한 장 + [상세 보기](경기별·월별·포지션별·리그 시상·이적 소식·성장) + 큰 [새 시즌 시작].
 * 비시즌 이적 제안이 있으면 맨 위 카드와 [이적 제안·계약에 답하기]로 이어진다 (C.42)
 */
/** 시즌 요약 "다음 할 일" 줄 (디자인 106): 이적 제안·계약 응답, 포인트 찍기 */
export interface SeasonTodo { title: string; sub: string; act: string; data?: Record<string, string>; cta?: string; warn?: boolean; icon: 'chat' | 'plus' | 'card' | 'star'; num?: string; hi?: boolean }

function todoRow(t: SeasonTodo): string {
  return `<button type="button" class="panel season-todo${t.warn ? ' is-warn' : ''}${t.hi ? ' is-hi' : ''}" data-act="${esc(t.act)}"${Object.entries(t.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}><span class="season-todo__icon">${Icon({ name: t.icon, size: 20 })}</span><span class="grow"><b>${esc(t.title)}${t.num ? ` <em class="season-todo__num po-num">${esc(t.num)}</em>` : ''}</b><small>${esc(t.sub)}</small></span>${
    t.cta ? `<span class="season-todo__cta">${esc(t.cta)}</span>` : Icon({ name: 'chevron-right', size: 18 })}</button>`;
}

const SEASON_TABS: { id: SeasonTab; label: string }[] = [{ id: 'matches', label: '경기별' }, { id: 'months', label: '월별' }, { id: 'positions', label: '포지션별' }, { id: 'awards', label: '리그 시상' }, { id: 'transfers', label: '이적 소식' }, { id: 'growth', label: '성장·위상' }];

/**
 * 시즌 종료 (디자인 106~112, C.60): 요약 = 큰 머리말(순위) + 요약 카드 한 장 + "다음 할 일" + [시즌 상세 보기] + [시즌 시작].
 * 상세 = 별도 화면처럼(뒤로 = 요약) compact 머리말(골) + Tabs segment cols 3 (6탭, 폰 3×2)
 */
export function seasonView(vm: SeasonVM, market = '', marketPending = false, tab: SeasonTab | null = null, transfers = '', todo: SeasonTodo | null = null): string {
  const wide = isWide();
  if (tab && !wide) return seasonDetail(vm, tab, transfers);
  const hero = HeroPanel({
    title: '시즌 요약', right: '', back: false, eyebrow: `${vm.season} 시즌 종료 · ${vm.team}`, value: `${vm.pos}위`, pad: false, progress: false,
    chips: [`${vm.apps}경기 출전`, `나이 ${vm.ageFrom} → ${vm.ageTo}세`, { label: vm.tierName, soft: true }],
  });
  const ovrD = vm.ovrAfter - vm.ovrBefore;
  const repD = vm.repAfter - vm.repBefore;
  const card = `<div class="panel season-card">
      ${statTiles([{ value: vm.goals, label: '골', hi: true }, { value: vm.assists, label: '도움' }, { value: vm.avg, label: '평균 평점' }, { value: vm.moms, label: 'MOM' }])}
      <div class="sc-rows">
        <div class="kv"><span>레벨</span><b class="po-num">${vm.levelFrom !== null && vm.levelFrom !== vm.levelTo ? `Lv ${vm.levelFrom} → ` : ''}Lv ${vm.levelTo}</b></div>
        <div class="kv"><span>OVR</span><b class="po-num">${vm.ovrBefore} → ${vm.ovrAfter} <small class="${ovrD > 0 ? 'up' : ovrD < 0 ? 'down' : 'muted'}">${ovrD > 0 ? `+${ovrD}` : ovrD < 0 ? `−${-ovrD}` : '±0'}</small></b></div>
        <div class="kv"><span>위상</span><b class="po-num">${vm.repBefore} → ${esc(vm.tierName)} ${vm.repAfter} <small class="${repD > 0 ? 'up' : repD < 0 ? 'down' : 'muted'}">${repD > 0 ? `+${repD}` : repD < 0 ? `−${-repD}` : '±0'}</small></b></div>
        ${vm.injuries ? `<div class="kv"><span>부상</span><b class="po-num">${vm.injuries}회 (${vm.injuredWeeks}주)</b></div>` : ''}
      </div>
    </div>`;
  const todos = [
    todo ? todoRow(todo) : '',
    !vm.retired && vm.cardPicks > 0 ? todoRow({ title: `카드 고르기 · 선택권 ${vm.cardPicks}장`, sub: '시즌 목표·업적 보상 3택 1', act: 'go', data: { to: 'deck' }, icon: 'card' }) : '',
    vm.awardsLine ? todoRow({ title: '개인 시상', sub: vm.awardsLine, act: 'go', data: { to: 'awards' }, icon: 'star' }) : '',
    !vm.retired && vm.points > 0 ? todoRow({ title: '포인트 찍기', num: `${vm.points}P`, hi: true, sub: '새 시즌 전에 찍어 두면 좋아요 · 선수 → 능력치', act: 'go', data: { to: 'allocate' }, icon: 'plus' }) : '',
  ].filter(Boolean);
  // 챕터 리뷰 (C.73a): 챕터가 바뀐 시즌이면 [다음 시즌] 자리에 챕터 리뷰 버튼 (본 뒤 원래 버튼)
  const next = vm.chapter
    ? Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'go', data: { to: 'chapter' }, className: 'season-start', children: `챕터 리뷰 · ${vm.chapter} 챕터 끝` })
    : vm.retired
    ? Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'go', data: { to: 'retired' }, children: '커리어 요약' })
    : marketPending ? '' : Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'next-season', className: 'season-start', children: `${vm.nextSeason} 시즌 시작` });
  const left = `${vm.forcedRetire ? Banner({ tone: 'warning', title: `${vm.ageTo}세 · 더 이상 뛸 수 없어요`, children: '커리어를 마무리하고 은퇴해요.' }) : ''}
    ${vm.tierReached ? `<div class="panel season-tier">${TierBadge({ tier: vm.tier, score: vm.repAfter })}<span><b>${esc(vm.tierReached)} 달성 · 이 티어는 내려가지 않아요</b><small class="muted">감점은 다음 티어까지의 진행도만 깎아요.</small></span></div>` : ''}
    ${vm.badges.map((b) => Banner({ tone: 'success', title: `레전드 배지 · ${b.name}`, children: `${b.desc} 위상이 ${vm.badgeRep}점 올랐어요.` })).join('')}
    ${vm.injury ? banners([vm.injury]) : ''}
    ${card}
    ${seasonHighlightCards(vm.highlights)}
    ${vm.seasonGoals ? seasonGoalsPanel(vm.seasonGoals, vm.season) : ''}
    ${market}
    ${todos.length ? `${SectionTitle({ title: '다음 할 일', action: `${todos.length}개` })}${todos.join('')}` : ''}
    <div class="btn-col season-next">
      ${wide ? '' : Button({ variant: 'secondary', block: true, icon: 'grid', act: 'season-tab', data: { v: 'matches' }, children: '시즌 상세 보기' })}
      ${next}
      ${!vm.retired && vm.canRetire ? Button({ variant: 'ghost', block: true, act: 'retire', children: '은퇴하기' }) : ''}
    </div>`;
  // PC 2열 (C.61 디자인 123): 왼쪽 = 요약 · 다음 할 일 · 버튼, 오른쪽 = 상세 6탭(한 줄) + 본문
  if (wide) {
    const t = tab ?? 'matches';
    const tabs = Tabs({ items: SEASON_TABS, value: t, variant: 'segment', act: 'season-tab', label: '시즌 상세' });
    return `${hero}<div class="body">${pc2(left, `<div class="season-detail">${tabs}${seasonDetailBody(vm, t, transfers)}</div>`, 'season-pc')}</div>`;
  }
  return `${hero}<div class="body">
    ${left}
  </div>`;
}

function seasonDetail(vm: SeasonVM, tab: SeasonTab, transfers: string): string {
  const hero = HeroPanel({
    title: '시즌 상세', back: { act: 'season-tab', data: { v: 'close' } }, compact: true, eyebrow: `${vm.season} 시즌 · ${vm.team} · ${vm.pos}위`, value: `${vm.goals}골`, pad: false, progress: false,
    chips: [`${vm.assists}도움`, `평점 ${vm.avg}`, { label: `${vm.moms} MOM`, soft: true }],
  });
  const tabs = Tabs({ items: SEASON_TABS, value: tab, variant: 'segment', cols: 3, act: 'season-tab', label: '시즌 상세' });
  return `${hero}<div class="body season-detail">${tabs}${seasonDetailBody(vm, tab, transfers)}</div>`;
}

function seasonDetailBody(vm: SeasonVM, tab: SeasonTab, transfers: string): string {
  let body = '';
  if (tab === 'matches') body = seasonMatchesSection(vm.matches);
  else if (tab === 'months') body = panel(splitTable(vm.months, '월'));
  else if (tab === 'positions') body = panel(splitTable(vm.positions, '포지션'));
  else if (tab === 'awards') {
    // 디자인 110: 트로피 카드, 내 것은 시안 테두리
    body = vm.awards.length
      ? `<div class="award-list">${vm.awards.map((a) => `<div class="panel award${a.me ? ' is-mine' : ''}"><span class="award__icon">${Icon({ name: 'trophy', size: 22 })}</span><span class="grow"><b>${esc(a.title)}</b><small>${esc(a.name)}${a.me ? ' (나)' : ''} · ${esc(a.team)}</small></span>${a.value ? `<b class="po-num award__v">${esc(a.value)}</b>` : ''}</div>`).join('')}</div>
        <p class="small muted">득점·도움·평점은 다른 팀 경기도 엔진으로 계산한 기록이에요 (빠른 진행으로 계산한 경기는 빠져요). 발롱도르·올해의 선수는 커리어 단계가 오면 생겨요.</p>`
      : '<p class="muted small">시상 기록이 없어요.</p>';
  } else if (tab === 'transfers') body = transfers || '<p class="muted small">이적 소식이 없어요.</p>';
  else body = growthDetail(vm);
  return body;
}

function growthDetail(vm: SeasonVM): string {
  const auto = sum(vm.autoGrowth);
  const vet = sum(vm.veteran);
  const age = sum(vm.aging);
  const rep = vm.next
    ? `${Meter({ value: vm.repAfter - vm.next.from, max: vm.next.cut - vm.next.from, label: `${vm.next.name}까지 ${vm.next.cut - vm.repAfter}점`, showValue: true })}`
    : `<p class="muted small">${vm.tier === 'legend' ? '최고 위상 티어예요.' : '월드클래스예요. 레전더리는 점수가 아니라 업적 조건으로 열려요.'}</p>`;
  const repLines = vm.repLines
    .map((l) => `<div class="kv small"><span>${esc(l.label)}</span><b class="po-num down">−${l.points}${l.note ? ` <small class="muted">${esc(l.note)}</small>` : ''}</b></div>`)
    .join('');
  return `${SectionTitle({ title: '업적 XP', action: `+${vm.achievementXp}` })}
    ${panel(`${vm.achievements.length ? vm.achievements.map((a) => `<div class="ach"><span class="ach__icon">${Icon({ name: 'star', size: 16 })}</span><span class="grow">${esc(a.label)}</span><b class="po-num up">+${a.xp}</b></div>`).join('') : '<p class="muted small">이번 시즌 업적이 없어요.</p>'}
      <p class="small muted">지급 XP는 난이도를 반영해요.${vm.levelsGained ? ` 레벨 업 ${vm.levelsGained}회!` : ''}</p>`)}
    ${SectionTitle({ title: '능력치 변화', action: `OVR ${vm.ovrBefore} → ${vm.ovrAfter} · 1칸 = 내부 5` })}
    ${panel(`
      <div class="kv"><b>자동 성장 <small class="muted">${esc(vm.growthAges)}</small></b><b class="po-num up">${signedSum(auto)}</b></div>${chipList(vm.autoGrowth)}
      <div class="kv"><b>노련함 <small class="muted">경험으로 오르는 능력치</small></b><b class="po-num up">${signedSum(vet)}</b></div>${chipList(vm.veteran)}
      <div class="kv"><b>노화</b><b class="po-num ${age < 0 ? 'down' : ''}">${signedSum(age)}</b></div>${chipList(vm.aging)}`)}
    ${SectionTitle({ title: '위상 진행도' })}
    ${panel(`<div class="kv">${TierBadge({ tier: vm.tier, score: vm.repAfter })}<span class="small muted">시즌 시작 ${vm.repBefore}점 → <b class="ink">${vm.repAfter}점</b></span></div>${repLines}${rep}`)}`;
}

// ── 은퇴 (56) ──

export function retiredView(vm: RetiredVM): string {
  const hero = HeroPanel({
    title: '은퇴', back: false, eyebrow: `${vm.card.name} · 커리어 평균 평점`, value: vm.avg, pad: false, progress: false,
    chips: [`${vm.seasons}시즌 · ${vm.card.age}세 은퇴`, { label: `최고 순위 ${vm.best}`, soft: true }],
  });
  return `${hero}<div class="body">
    ${statTiles([{ value: vm.apps, label: '경기' }, { value: vm.goals, label: '골', hi: true }, { value: vm.assists, label: '도움' }, { value: vm.seasons, label: '시즌' }])}
    <div class="panel kv peak"><div><small>최종 위상</small>${TierBadge({ tier: vm.card.tier, score: vm.reputation })}</div><div class="r"><small>최고 OVR</small><b class="po-num hi">${vm.peakOvr}</b></div></div>
    ${PlayerCard({ player: vm.card })}
    ${SectionTitle({ title: '재정 · 엔딩 점수', action: `자산 점수 ${vm.ending.asset}` })}
    ${panel(`<div class="kv"><span>순자산</span><b class="po-num">${esc(vm.ending.worth)}</b></div><div class="kv"><span>커리어 순수입</span><b class="po-num">${esc(vm.ending.career)}</b></div><div class="kv"><span>누적 기부</span><b class="po-num">${esc(vm.ending.charity)}${vm.ending.philanthropist ? ' · 자선가' : ''}</b></div>`)}
    ${vm.honors.length ? `${SectionTitle({ title: '업적 · 배지', action: `${vm.honors.length}개` })}<div class="chapter-honors">${vm.honors.map((h) => StatChip({ icon: h.badge ? 'star' : 'trophy', label: h.label, tone: h.badge ? 'success' : 'brand' })).join('')}</div>` : ''}
    ${SectionTitle({ title: '커리어 흐름' })}
    ${panel(historyTable(vm.history))}
    ${hallSection(vm)}
    ${Banner({ tone: 'info', title: '은퇴한 세이브는 기록 보기만 할 수 있어요', children: '다른 슬롯의 진행에는 영향이 없어요.' })}
    <div class="btn-col">${Button({ size: 'lg', block: true, icon: 'plus', act: 'go', data: { to: 'new' }, children: '새 커리어' })}</div>
  </div>`;
}

/** 명예의 전당 (18.11, C.73b, 디자인 없음 — 리그 시상 award 카드 재사용): 이 기기 상위 커리어 3개 + 새 게임 보너스 */
function hallSection(vm: RetiredVM): string {
  if (!vm.hall) return '';
  const h = vm.hall;
  // C.76j (디자인 225): 순위 · 이름 · 한 줄 기록 · 위상·배지·트로피 칩 · 오른쪽 커리어 점수, 이번 커리어 시안 테두리
  const rows = h.list.map((e, i) => `<div class="panel award hall-row${e.me ? ' is-mine' : ''}"><b class="po-num hall-row__rank">${i + 1}</b><span class="grow"><b>${esc(e.name)}${e.me ? ' <em class="hall-row__me">(이번 커리어)</em>' : ''}</b><small>${esc(e.chips ? e.line.split(' · ').slice(0, 3).join(' · ') : e.line)}</small>${
    e.chips ? `<span class="hall-row__chips">${e.chips.map((c, k) => `<span class="hall-chip${k === 0 ? ' is-tier' : c.startsWith('레전드') ? ' is-badge' : ''}">${esc(c)}</span>`).join('')}</span>` : ''}</span><span class="hall-row__score"><b class="po-num award__v">${e.score}</b><small>커리어 점수</small></span></div>`).join('');
  return `${SectionTitle({ title: '명예의 전당', action: h.rank ? `이번 커리어 ${h.rank}위` : '이 기기 상위 3' })}
    <div class="award-list hall-list">${rows || '<p class="muted small">아직 기록이 없어요.</p>'}</div>
    <p class="small muted">커리어 점수 = 최종 위상 + 자산 점수 × 2 + 레전드 배지 × 100 + 트로피 × 30 + (골 + 도움) × 0.5. 이 브라우저에만 남아요 (세이브 파일 밖).</p>
    ${h.bonus ? `<div class="ch-pick"><span class="ch-pick__check">${Icon({ name: 'check', size: 18 })}</span><span class="grow"><b>새 게임 보너스 · ${esc(h.bonus)} 카드 선택권 1장</b><small>다음 새 커리어를 시작하면 덱에서 3장 중 1장을 골라요.</small></span></div>` : ''}`;
}

// ── 챕터 리뷰 (22.1 · I.13, C.73a, 디자인 없음 — 시즌 요약 머리말·요약 카드·배너 재사용) ──

/** 챕터가 바뀌는 시즌 종료 요약 다음(또는 은퇴 직후)에 한 번: 그 챕터 기록 · 성장 · 하이라이트 3 · 배지 · 트로피 + [다음 챕터] */
export function chapterView(vm: ChapterReviewVM): string {
  const hero = HeroPanel({
    title: '챕터 리뷰', right: '', back: false, eyebrow: `${vm.name} 챕터 · ${vm.years}`, value: vm.name, pad: false, progress: false,
    chips: [`${vm.ages} · ${vm.seasons}시즌`, { label: vm.theme, soft: true }],
  });
  const ovrD = vm.ovrTo - vm.ovrFrom;
  const repD = vm.repTo - vm.repFrom;
  const sign = (d: number) => `<small class="${d > 0 ? 'up' : d < 0 ? 'down' : 'muted'}">${d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0'}</small>`;
  const card = `<div class="panel season-card chapter-card">
      ${statTiles([{ value: vm.apps, label: '경기' }, { value: vm.goals, label: '골', hi: true }, { value: vm.assists, label: '도움' }, { value: vm.avg, label: '평균 평점' }])}
      <div class="sc-rows">
        <div class="kv"><span>OVR</span><b class="po-num">${vm.ovrFrom} → ${vm.ovrTo} ${sign(ovrD)}</b></div>
        <div class="kv"><span>위상</span><b class="po-num">${esc(vm.tierFrom)} ${vm.repFrom} → ${esc(vm.tierTo)} ${vm.repTo} ${sign(repD)}</b></div>
        ${vm.moms ? `<div class="kv"><span>MOM</span><b class="po-num">${vm.moms}회</b></div>` : ''}
      </div>
    </div>`;
  const hl = vm.highlights.length
    ? panel(vm.highlights.map((h) => `<div class="kv"><span>${esc(h.season)}</span><b>${esc(h.text)}</b></div>`).join(''), 'chapter-hl')
    : `<p class="muted small">이 챕터에는 남은 하이라이트가 없어요.</p>`;
  // C.76j (디자인 221): 트로피 = 2열 칸(아이콘 · 이름), 배지 = 꺾인 칩, 완주 보상 = 라임 체크 줄, PC 2열(왼쪽 위상·기록 / 오른쪽 하이라이트·트로피·보상·버튼)
  const nHon = vm.trophies.length + vm.badges.length;
  const honors = nHon ? `${SectionTitle({ title: '트로피 · 배지', action: `${nHon}개` })}<div class="panel ch-honors">
      ${vm.trophies.length ? `<small class="muted">트로피 ${vm.trophies.length}</small><div class="ch-trophies">${vm.trophies.map((t) => `<div class="ch-trophy"><span class="ch-trophy__icon">${Icon({ name: 'trophy', size: 16 })}</span><b>${esc(t)}</b></div>`).join('')}</div>` : ''}
      ${vm.badges.length ? `<small class="muted">배지 ${vm.badges.length}</small><div class="ch-badges">${vm.badges.map((b) => `<span class="ch-badge">${Icon({ name: 'star', size: 12 })}${esc(b)}</span>`).join('')}</div>` : ''}
    </div>` : '';
  const pick = vm.pick ? `<div class="ch-pick"><span class="ch-pick__check">${Icon({ name: 'check', size: 18 })}</span><span class="grow"><b>카드 선택권 · ${esc(vm.pick)}</b><small>덱에서 3장 중 1장을 골라요.</small></span></div>` : '';
  const next = vm.retired
    ? Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'chapter-done', children: '커리어 요약' })
    : Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'chapter-done', children: vm.next ? `다음 챕터 · ${vm.next}` : '다음 챕터' });
  const tierRow = `<div class="panel season-tier">${TierBadge({ tier: vm.tier, score: vm.repTo })}<span><b>${esc(vm.name)} 챕터 ${vm.retired ? '· 커리어 마지막 챕터' : '완주'}</b><small class="muted">${esc(vm.theme)}</small></span></div>`;
  const right = `${SectionTitle({ title: '하이라이트', action: `${vm.highlights.length}개` })}
    ${hl}
    ${honors}
    ${pick}
    <div class="btn-col season-next">${next}</div>`;
  if (isWide()) return `${hero}<div class="body chapter-review">${pc2(`${tierRow}${card}`, right, 'ch-pc')}</div>`;
  return `${hero}<div class="body chapter-review">
    ${tierRow}
    ${card}
    ${right}
  </div>`;
}

// ── 세이브 (43) ──

/** 세이브 (디자인 119 · 149, C.60): 자동 저장 → 수동 3칸(채운 칸은 아래 [불러오기][덮어쓰기][지우기]) → 파일(카드 이미지 포함 스위치 + 내보내기·가져오기) */
export function savesView(vm: SavesVMOut, canSave: boolean, version: VersionVM, exportCards = false): string {
  const a = vm.auto;
  const hero = HeroPanel({
    title: '저장', back: { act: 'go', data: { to: canSave ? 'home' : 'title' } }, value: `${vm.used}/${vm.manual.length}`, pad: false, progress: false,
    eyebrow: a.empty ? '자동 저장 없음' : `자동 저장 · ${a.meta.split(' · ').at(-1)}`, chips: [`수동 ${vm.used}/${vm.manual.length}`, { label: exportCards ? '카드 이미지 포함 켬' : '자동 저장 켜짐', soft: true }],
  });
  const slot = (s: SavesVMOut['manual'][number]) => {
    if (s.empty) {
      return `<div class="slot empty"><span class="slot__n po-num">${esc(s.label)}</span><span class="grow"><b>비어 있음</b><small>${canSave ? '지금 진행 상황을 여기에 저장해요' : '저장한 게임이 없어요'}</small></span><span class="slot__btns">${
        canSave ? Button({ size: 'sm', icon: 'disk', act: 'save', data: { slot: s.slot }, children: '여기에 저장' }) : ''}</span></div>`;
    }
    const btns = [Button({ variant: 'ghost', size: 'sm', icon: 'upload', act: 'load', data: { slot: s.slot }, children: '불러오기' }),
      canSave ? Button({ variant: 'ghost', size: 'sm', icon: 'disk', act: 'save', data: { slot: s.slot }, children: '덮어쓰기' }) : '',
      Button({ variant: 'ghost', size: 'sm', icon: 'close', act: 'delete', data: { slot: s.slot }, children: '지우기' })].filter(Boolean);
    return `<div class="slot slot--full"><div class="slot__top"><span class="slot__n po-num">${esc(s.label)}</span><span class="grow"><b>${esc(s.title)}</b><small>${esc(s.meta)}${s.size ? ` · ${esc(s.size)}` : ''}</small>${s.start ? `<small class="slot__start">${esc(s.start)}</small>` : ''}</span></div><div class="slot__acts">${btns.join('')}</div></div>`;
  };
  return `${hero}<div class="body">
    ${SectionTitle({ title: '자동 저장' })}
    <div class="slot"><span class="slot__n po-num">A</span><span class="grow"><b>${esc(a.empty ? '비어 있음' : a.title)}</b><small>${esc(a.empty ? '하루를 진행할 때마다 자동으로 저장돼요' : `${a.meta}${a.size ? ` · ${a.size}` : ''}`)}</small>${a.start ? `<small class="slot__start">${esc(a.start)}</small>` : ''}</span><span class="slot__btns">${
      a.empty ? '' : Button({ variant: 'secondary', size: 'sm', icon: 'upload', act: 'load', data: { slot: 'auto' }, children: '불러오기' })}</span></div>
    <p class="small muted">경기 전·하루 진행 뒤마다 자동으로 저장돼요</p>
    ${SectionTitle({ title: '수동 저장', action: `${vm.manual.length}칸` })}
    ${vm.manual.map(slot).join('')}
    ${SectionTitle({ title: '파일', action: canSave ? '켬 = .zip · 끔 = 압축 JSON' : '압축 JSON · zip' })}
    ${panel(`${canSave ? `<div class="sv-cards"><span class="grow"><b>카드 이미지 포함</b><small class="muted">켜면 내가 올린 카드 그림을 세이브와 함께 .zip 하나로 내보내요.</small></span><button type="button" class="set-switch${exportCards ? ' is-on' : ''}" data-act="ex-cards" role="switch" aria-checked="${exportCards}" aria-label="카드 이미지 포함"><i aria-hidden="true"></i></button></div>` : ''}
      <div class="btn-row">${canSave ? Button({ variant: 'secondary', block: true, icon: 'download', act: 'export', children: '내보내기' }) : ''}${Button({ variant: 'secondary', block: true, icon: 'upload', act: 'import', children: '가져오기' })}</div>
      <p class="small muted">${canSave ? (exportCards ? '세이브와 카드 그림을 .zip 하나로 내보내요. ' : '세이브만 압축 JSON(.json)으로 내보내요. ') : ''}가져오기는 .zip·.json 모두 돼요. 가져오면 자동 저장 칸에 들어가요.</p>`, 'sv-file')}
    <input type="file" id="import-file" accept=".gz,.json,.zip,application/gzip,application/json,application/zip" hidden>
    <p class="small muted">저장은 이 브라우저(IndexedDB, 압축)에 남아요. 지난 시즌은 경기 요약·하이라이트·결정 기록과 다른 경기 스코어·득점자, 선수 시즌 합계만 남기고, 경기 재생 화면은 내 최근 5경기만 남아요.</p>
    <p class="small muted">홈 화면에 추가(앱 설치)하면 인터넷 없이도 플레이돼요.${isIOS() ? ' <b>iPhone·iPad 사파리는 오래 쓰지 않으면 저장 공간을 지울 수 있어요 — 위 [내보내기]로 파일 백업을 해 두세요.</b>' : ''}</p>
    ${versionFooter(version)}
  </div>`;
}

/** 월드 "컵·챔스" 탭 묶음 (C.76j, 디자인 205): 챔스 조별 · 챔스 녹아웃 · 국내 컵 */
export type CupSub = 'groups' | 'ko' | 'fa';

/** 지금 볼 묶음: 챔스가 없으면 국내 컵, 조별이 끝났으면 녹아웃 */
export function cupSubDefault(vm: CupsWorldVM): CupSub {
  if (!vm.ucl) return 'fa';
  return vm.ucl.groups.some((g) => g.rows.some((r) => r.through)) ? 'ko' : 'groups';
}

/** 월드 "컵·챔스" 탭 (C.67b → C.76j 디자인 205): 묶음 전환 [챔스 조별 / 챔스 녹아웃 / 국내 컵] · 조 표 · 녹아웃 1·2차전 · 컵 라운드 칩 */
export function cupsSection(vm: CupsWorldVM, sub: CupSub = cupSubDefault(vm), faRound: number | null = null, more = false): string {
  const cup = vm.cupName ?? 'FA컵';
  const subs = Tabs({ items: [{ id: 'groups', label: '챔스 조별' }, { id: 'ko', label: '챔스 녹아웃' }, { id: 'fa', label: cup }], value: sub, variant: 'segment', act: 'cup-sub', label: '대회 고르기' });
  const team = (id: string, nm: string, strong = false) => `<button type="button" class="dt-link team${strong ? ' is-win' : ''}" data-act="team-open" data-v="${esc(id)}">${Crest({ name: nm, team: id, size: 18 })}<span class="cup-name">${esc(nm)}</span></button>`;
  const head = (title: string, right: string, sub2: string) => `<div class="cup-head"><h3 class="cup-head__t">${esc(title)}</h3><span class="cup-head__r">${esc(right)}</span></div>${sub2 ? `<p class="small muted cup-head__s">${esc(sub2)}</p>` : ''}`;
  const u = vm.ucl;
  const none = (t: string) => `${head(t, '', '')}<p class="small muted">${t === '챔피언스리그' ? '이번 시즌 챔스 대진이 없어요(지난 시즌 리그 4위 안 팀이 나가요. 유럽 밖 리그는 챔스가 없어요).' : `이번 시즌 ${esc(t)} 대진이 없어요.`}</p>`;
  let body = '';
  if (sub === 'groups') {
    if (!u) body = none('챔피언스리그');
    else {
      const played = u.groups[0]?.rows.reduce((t, r) => Math.max(t, r.p), 0) ?? 0;
      const mine = u.groups.find((g) => g.mine);
      const myRow = mine?.rows.findIndex((r) => r.me) ?? -1;
      body = `${head('챔피언스리그', u.winner ? `우승 ${u.winner}` : mine ? `우리 팀 · 조별리그 ${mine.name} ${myRow + 1}위` : `우리 팀 · ${u.my}`, `${vm.season} 시즌 · 조별리그 · 6경기 중 ${played}경기`)}
      <div class="cup-groups">${u.groups.map((gr) => `<div class="panel tbl-panel cup-group${gr.mine ? ' is-mine' : ''}"><table class="tbl league">
        <tr><th class="l" colspan="2">${esc(gr.name)}${gr.mine ? ' · 우리 조' : ''}</th><th class="wide-x">경기</th><th class="wide-x">승</th><th class="wide-x">무</th><th class="wide-x">패</th><th class="wide-o">승-무-패</th><th>득실</th><th>승점</th></tr>
        ${gr.rows.map((r, i) => `<tr class="${r.me ? 'me' : ''}${i < 2 ? ' top' : ''}"><td class="po-num cup-rank">${i + 1}</td><td class="l">${team(r.teamId, r.team)}</td><td class="wide-x">${r.p}</td><td class="wide-x">${r.w}</td><td class="wide-x">${r.d}</td><td class="wide-x">${r.l}</td><td class="wide-o po-num">${r.w}-${r.d}-${r.l}</td><td>${r.gd}</td><td><b class="po-num">${r.pts}</b></td></tr>`).join('')}
      </table></div>`).join('')}</div>
      <div class="legend small"><span><i class="k top"></i>16강 진출권 (조 1·2위)</span><span><i class="k me"></i>우리 팀</span></div>
      <p class="small muted">조 2위까지 16강 · 16강~4강은 홈·원정 합계(동률이면 승부차기) · 결승은 단판. 팀 이름을 누르면 팀 상세. 내 팀이 없는 경기는 팀 전력으로 간이 계산해요.</p>`;
    }
  } else if (sub === 'ko') {
    if (!u) body = none('챔피언스리그');
    else if (!u.ko.length) body = `${head('챔피언스리그', `우리 팀 · ${u.my}`, '')}<p class="small muted">조별리그가 끝나면 16강 대진이 나와요.</p>`;
    else {
      const two = (t: CupTieVM) => {
        const lg = t.legs;
        const won = (side: 'h' | 'a') => !!t.w && t.w === (side === 'h' ? t.h : t.a);
        const lost = (side: 'h' | 'a') => !!t.w && !won(side);
        const row = (side: 'h' | 'a') => {
          const k = side === 'h' ? 0 : 1;
          const c = (x: [number, number] | null | undefined) => `<span class="po-num">${x ? x[k] : '–'}</span>`;
          return `<div class="ko-row${won(side) ? ' is-win' : ''}${lost(side) ? ' is-out' : ''}">${team(side === 'h' ? t.hId : t.aId, side === 'h' ? t.h : t.a, won(side))}${lg ? `${c(lg.l1)}${c(lg.l2)}<b class="ko-agg">${c(lg.agg)}</b>` : `<b class="ko-agg">${c(t.score ? (t.score.split('-').map(Number) as [number, number]) : null)}</b>`}</div>`;
        };
        const pens = lg?.pens ?? t.pens;
        const foot = t.w ? `${pens ? `승부차기 ${pens[0]}-${pens[1]} · ` : ''}${t.w} 진출${t.me && t.w !== vm.myTeam ? ' · 우리 팀 탈락' : ''}` : t.note || t.date;
        return `<div class="panel ko-tie${t.me ? ' is-me' : ''}">${lg ? '<div class="ko-tie__cols" aria-hidden="true"><span></span><span>1차</span><span>2차</span><span>합계</span></div>' : ''}${row('h')}${row('a')}<small class="muted ko-foot">${esc(foot)}</small></div>`;
      };
      const stages = u.ko.map((st) => ({ ...st, done: st.ties.every((t) => !!t.w) }));
      const cur = stages.filter((st) => !st.done);
      const done = stages.filter((st) => st.done).reverse();
      const KO = ['16강', '8강', '4강', '결승'];
      const later = KO.slice(stages.length);
      const stageHead = (st: { stage: string; done: boolean; ties: CupTieVM[] }) => {
        const leg = st.stage !== '결승';
        return `<div class="ko-head"><b>${esc(st.stage)}</b><small class="muted">${st.done ? '끝' : st.ties.some((t) => t.score) ? '진행 중' : '지금'}${leg ? ' · 합계 = 1·2차전 더한 점수' : ' · 단판'}</small>${leg ? '<span class="ko-cols"><small>1차</small><small>2차</small><small>합계</small></span>' : ''}</div>`;
      };
      const mineFirst = (ts: CupTieVM[]) => [...ts.filter((t) => t.me), ...ts.filter((t) => !t.me)];
      body = `${head('챔피언스리그', u.winner ? `우승 ${u.winner}` : `우리 팀 · ${u.my}`, `${vm.season} 시즌 · 녹아웃`)}
        ${[...cur, ...done].map((st) => `${stageHead(st)}<div class="ko-grid">${mineFirst(st.ties).map(two).join('')}</div>`).join('')}
        ${later.map((k) => `<div class="panel ko-later">${Icon({ name: k === '결승' ? 'trophy' : 'calendar', size: 18 })}<span class="grow"><b>${k}${k === '결승' ? ' · 단판' : ''}</b><small class="muted">${k === '결승' ? '비기면 연장 뒤 승부차기' : '앞 라운드 승자끼리 · 홈·원정 두 경기'}</small></span></div>`).join('')}
        <div class="legend small"><span><i class="k me"></i>우리 팀 대진</span><span><b>굵은 글자</b> = 진출 팀</span></div>
        <p class="small muted">합계가 같으면 승부차기로 정하고, 결과 줄에 승부차기 점수를 함께 적어요.</p>`;
    }
  } else {
    const f = vm.fa;
    if (!f) body = none(cup);
    else {
      const rounds = f.rounds.slice().reverse();
      const auto = (() => { let k = 0; rounds.forEach((r, i) => { if (r.ties.some((t) => t.score)) k = i; }); const myNext = rounds.findIndex((r) => r.ties.some((t) => t.me && !t.score)); return myNext >= 0 ? myNext : k; })();
      const sel = Math.max(0, Math.min(rounds.length - 1, faRound ?? auto));
      const r = rounds[sel]!;
      const ties = [...r.ties.filter((t) => t.me), ...r.ties.filter((t) => !t.me)];
      const PAGE = 6;
      const shown = more ? ties : ties.slice(0, PAGE);
      const chips = Tabs({ items: rounds.map((x, i) => ({ id: String(i), label: x.stage })), value: String(sel), variant: 'segment', scroll: true, act: 'cup-round', label: '라운드 고르기' });
      const one = (t: CupTieVM) => {
        const hw = !!t.w && t.w === t.h; const aw = !!t.w && t.w === t.a;
        return `<div class="panel fa-tie${t.me ? ' is-me' : ''}"><div class="fa-tie__row"><span class="fa-tie__h">${team(t.hId, t.h, hw)}</span><b class="po-num fa-tie__score">${esc(t.score ?? 'vs')}</b><span class="fa-tie__a">${team(t.aId, t.a, aw)}</span></div>
          <small class="muted">${esc(t.w ? `${t.pens ? `승부차기 ${t.pens[0]}-${t.pens[1]} · ` : ''}${t.w} 진출` : t.date)}</small></div>`;
      };
      body = `${head(cup, f.winner ? `우승 ${f.winner}` : `우리 팀 · ${f.my}`, '')}${chips}
        <p class="small muted cup-head__s">${esc(r.stage)} · ${esc(r.date)} · 단판 · 비기면 승부차기</p>
        <div class="ko-grid">${shown.map(one).join('')}</div>
        ${ties.length > PAGE ? moreButton('cupTies', more, `${r.stage} ${ties.length - PAGE}경기 더 보기`) : ''}
        <p class="small muted">우리 팀 경기가 맨 위에 와요. 라운드를 누르면 그 라운드 대진으로 바뀌어요.</p>`;
    }
  }
  return `${subs}${body}`;
}
