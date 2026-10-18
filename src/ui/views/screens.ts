// 디자인 2차 수정본 화면 (H.6 3번, I.19 갱신): 타이틀(55), 새 게임(52·53), 포인트 찍기(50), 순위표·리그 스타(54), 시즌 종료(51),
// 은퇴(56), 세이브(43). 화면 모듈은 뷰모델만 받아 그린다 (H.2). 아직 없는 기능(설정, 파일 내보내기, 검색·필터, 우승 기록 등)은 숨긴다

import { goalsResultPanel } from './inbox';
import {
  Avatar, Banner, Button, Crest, esc, FIN_TIERS, FinChip, HeroPanel, Icon, IconButton, Meter, OptionRow, PlayerCard, SectionTitle, StatBar, Tabs, TagChip, TextField, TierBadge, type DesignTier,
} from '../components';
import type { AllocateVM, CupsWorldVM, CupTieVM, RetiredVM, SavesVMOut, SeasonVM, StarGroup, StarVM, VersionVM, WorldVM } from '../viewModels';
import type { BoardKind } from '../../worldStats';
import { actionRow, banners, panel, pc2, seasonMatchesSection, statTiles, versionFooter } from './common';
import { isWide } from '../skin';
import { teamLink } from './detail';
import { historyTable } from './player';
import { attrGrid, type AttrGroupVM } from './attrGrid';
import { attrDisplay, displayDelta } from '../../attributes';
import { BALANCE } from '../../config/balance';
import { LEGENDS } from '../../legends';

/** 레전드 팩 인원 표기 기준 (C.52): 팩 전체 = LEGENDS 전체, 고를 수 있는 선수 = GK 제외 */
const LEGEND_TOTAL = LEGENDS.length;
const LEGEND_GK = LEGENDS.filter((l) => l.position === 'GK').length;
import type { CustomVM } from '../customVM';
import { customBody } from './custom';

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
  legendList: { id: string; name: string; club: string; age: number; position: string; ovr: number; peak: number; youthKo: string }[];
  selected: { id: string; name: string; ovr: number; club: string; age: number; position: string; legend?: boolean; peak?: number; youthKo?: string } | null;
  /** 능력치 접힘 줄 (디자인 130) */
  attrSummary: { count: number; avg: string; weak: string; top: string } | null;
  teamHint: string;
  /** 랜덤 유망주 신체·장단점 (C.45) */
  extras: { height: number; weight: number; foot: string; weakFoot: number; traits: { ko: string; desc: string; kind: 'pro' | 'con'; release?: string }[] } | null;
}

/** 새 게임 화면 상태 (C.58 디자인 124~131): 실제 선수 묶음 탭 · 검색 · 정렬 · 포지션군 · 보이는 수, 랜덤 능력치 펼침, 커스텀 단계 */
export interface NewGameUI {
  realTab: 'real' | 'legend'; rq: string; rsort: 'peak' | 'ovr' | 'age' | 'name'; rgroup: 'all' | 'fw' | 'mf' | 'df'; rshow: number;
  attrsOpen: boolean; cuStep: number;
}
export const NEW_GAME_UI: NewGameUI = { realTab: 'real', rq: '', rsort: 'peak', rgroup: 'all', rshow: 10, attrsOpen: false, cuStep: 1 };
const REAL_PAGE = 10;
const REAL_MORE = 20;
const POS_GROUP: Record<string, 'fw' | 'mf' | 'df'> = { ST: 'fw', CF: 'fw', LW: 'fw', RW: 'fw', LM: 'mf', RM: 'mf', CAM: 'mf', CM: 'mf', CDM: 'mf', LB: 'df', RB: 'df', CB: 'df' };

/** 이름(TextField) · 난이도(세그먼트 3) · 레전드 팩(켬/끔) · 시드 (디자인 130 "시작 옵션") */
function startOptions(vm: NewGameVM, nameField: boolean): string {
  const name = nameField ? TextField({ label: '이름', value: vm.name, placeholder: '예: 김민준 · 비우면 랜덤', input: { id: 'f-name', maxLength: 12 }, clearable: false }) : '';
  const cur = vm.difficulties.find((d) => d.id === vm.difficulty);
  const diff = `${Tabs({ items: vm.difficulties.map((d) => ({ id: d.id, label: d.id === 'normal' ? `${d.label} · 추천` : d.label })), value: vm.difficulty, variant: 'segment', fill: true, act: 'form', data: { k: 'difficulty' }, label: '난이도' })}
    ${cur ? `<p class="small muted ng-diff">${esc(cur.desc)}</p>` : ''}`;
  const pack = `<div class="ng-pack"><span class="grow"><b>레전드 팩 · 은퇴 레전드 ${LEGEND_TOTAL}명</b><small>${vm.legends ? '켜면 실제 선수에 레전드 탭이 생기고, 펠레·지단·박지성 같은 레전드가 15~22세 유망주로 유스 구단에 들어와요. 끄면 세계는 그대로예요.' : '켜면 2020년까지 은퇴한 레전드가 2018-19 세계에 15~22세로 들어와요. 끄면 세계는 그대로예요.'}</small></span>${
    Tabs({ items: [{ id: 'off', label: '끔' }, { id: 'on', label: '켬' }], value: vm.legends ? 'on' : 'off', act: 'form', data: { k: 'legends' }, label: '레전드 팩' })}</div>`;
  const seed = TextField({ label: '시드 (선택)', value: vm.seed, placeholder: '비우면 랜덤 · 같은 시드 + 같은 선택 = 같은 결과', input: { id: 'f-seed', maxLength: 40 }, clearable: false });
  return `${SectionTitle({ title: '시작 옵션' })}${name}${diff}${pack}${seed}`;
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
    ? HeroPanel({ title: '새 게임', back, ...cpt, eyebrow: sel ? `선택한 선수 · ${sel.name} · ${sel.position} OVR` : '실제 선수를 골라요', value: sel ? sel.ovr : '-', pad: false, progress: false,
      chips: sel ? [`${sel.age}세 · ${sel.club}`, { label: sel.legend ? `레전드 · 전성기 ${sel.peak}` : '2018-19 시즌 그대로', soft: true }] : [`실제 선수 ${vm.reals.length}명`, { label: vm.legends ? `레전드 ${vm.legendList.length}명` : '2018-19 시즌 그대로', soft: true }] })
    : HeroPanel({ title: '새 게임', back, ...cpt, eyebrow: `커리어를 시작할 선수 · ${vm.position} OVR`, value: vm.selectedOvr ?? '17세', pad: false, progress: false, chips: ['17세 유망주', { label: `강점 ${vm.strengths}`, soft: true }] });
  const modeTabs = Tabs({ items: [{ id: 'prospect', label: '랜덤' }, { id: 'custom', label: '커스텀' }, { id: 'real', label: '실제 선수' }], value: vm.mode, variant: 'segment', fill: true, act: 'form', data: { k: 'mode' }, label: '시작 방식' });
  if (custom) return `${hero}<div class="body ng-body">${customBody(custom, u.cuStep, u.cuStep === 1 || isWide() ? modeTabs : '', startOptions(vm, false))}</div>`;
  if (!real) return `${hero}<div class="body ng-body">${modeTabs}${prospectBody(vm, u)}</div>`;
  return `${hero}<div class="body ng-body">${modeTabs}${realBody(vm, u)}</div>`;
}

/** 랜덤 (디자인 130): 후보 4자리 2×2 · 코치 평 · 신체·태그 · 능력치 접힘 · 시작 옵션 */
function prospectBody(vm: NewGameVM, u: NewGameUI): string {
  const on = vm.candidates.find((c) => c.id === vm.position);
  const cands = `<div class="ng-cands">${vm.candidates.map((c) =>
    `<button type="button" class="ng-cand${c.id === vm.position ? ' is-on' : ''}" data-act="form" data-k="position" data-v="${c.id}" aria-pressed="${c.id === vm.position}"><span class="ng-cand__pos">${c.id}</span><b class="po-num">${c.ovr}</b><small>${esc(c.ko)}${c.wild ? ' · <em>와일드카드</em>' : ''}</small></button>`).join('')}</div>`;
  const coach = on ? `<div class="panel coach ng-coach">${Avatar({ size: 36 })}<div><small>코치 평 · ${esc(on.id)}</small><b>“${esc(on.line)}”</b></div></div>` : '';
  const others = vm.others
    ? `${SectionTitle({ title: '포지션별 OVR', action: '굵은 칸 = 코치 추천 4자리' })}
      <div class="pos-table">${vm.posTable.map((p) => `<button type="button" class="pt-cell${p.cand ? ' is-cand' : ''}${p.on ? ' is-on' : ''}" data-act="form" data-k="position" data-v="${p.id}"><span>${p.id}</span><b class="po-num">${p.ovr}</b></button>`).join('')}</div>`
    : '';
  const x = vm.extras;
  const extras = x ? `${SectionTitle({ title: '신체 · 태그', action: '랜덤 · 숨기지 않음' })}
    <div class="panel ng-extras"><div class="body-stats ng-stats">
      <div><small>키</small><b class="po-num">${x.height}<i>cm</i></b></div><div><small>몸무게</small><b class="po-num">${x.weight}<i>kg</i></b></div>
      <div><small>주발</small><b>${esc(x.foot)}</b></div><div><small>약발</small><b class="po-num">${x.weakFoot}${x.weakFoot >= 5 ? '<i>양발</i>' : ''}</b></div></div>
      ${x.traits.length ? `<div class="ng-traits">${x.traits.map((t) => `<span class="ng-trait">${TagChip({ name: t.ko, kind: 'gen', polarity: t.kind, ...(t.release ? { release: t.release } : {}), desc: t.desc })}<small>${esc(t.desc)}</small></span>`).join('')}</div>` : '<p class="small muted">태그 없음</p>'}
      <p class="small muted">랜덤은 태그 0~2개가 붙어요. 마음에 안 들면 [다른 유망주 보기].</p></div>` : '';
  const a = vm.attrSummary;
  const attrs = `${SectionTitle({ title: '능력치', action: a ? `강점 ${a.top}` : '' })}
    <button type="button" class="panel ng-attrs" data-act="ng-attrs" aria-expanded="${u.attrsOpen}"><span class="grow"><b>${a ? `${a.count}개 · 평균 ${a.avg}` : '능력치'}</b><small>${a ? `약점 ${esc(a.weak)}` : ''}</small></span><span class="ng-attrs__btn">${u.attrsOpen ? '접기' : '펼치기'} ${Icon({ name: 'chevron-right', size: 14, style: `transform:rotate(${u.attrsOpen ? -90 : 90}deg)` })}</span></button>
    ${u.attrsOpen ? attrGrid(vm.attrs, null, undefined, { cols: 4, keyLabel: `${vm.position} 핵심` }) : ''}`;
  return `${SectionTitle({ title: '시작 포지션', action: '코치 추천 4자리' })}
    ${cands}${coach}
    ${extras}
    <p class="small ng-links"><button type="button" class="link-btn hi" data-act="form-others">${vm.others ? '다른 포지션 접기' : '다른 포지션에서 고르기'}</button> <button type="button" class="link-btn" data-act="form-reroll">다른 유망주 보기</button></p>
    ${others}
    ${attrs}
    ${startOptions(vm, true)}
    <div class="btn-col">${Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'start', children: `${vm.teamHint} 유스로 시작` })}</div>`;
}

/** 실제 선수 (디자인 131): [실제 선수 n | 레전드 n] 묶음 탭 → 고른 선수 카드 → 검색·정렬 → 포지션군 → 10명 + 더 보기 */
function realBody(vm: NewGameVM, u: NewGameUI): string {
  const legendTab = vm.legends && u.realTab === 'legend';
  const tabs = vm.legends
    ? Tabs({ items: [{ id: 'real', label: `실제 선수 ${vm.reals.length}` }, { id: 'legend', label: `레전드 ${vm.legendList.length}` }], value: legendTab ? 'legend' : 'real', variant: 'segment', fill: true, act: 'ng-real', data: { k: 'realTab' }, label: '실제 선수 묶음' })
    : '';
  const sel = vm.selected;
  const card = sel ? `<div class="panel ng-sel">${Avatar({ size: 52, face: { id: sel.id, age: sel.age }, name: sel.name })}<span class="grow">${sel.legend ? '<span class="ng-legend">레전드</span> ' : ''}<small class="muted">고른 선수</small><b class="ng-sel__name">${esc(sel.name)}</b><small>${esc(sel.club)} · ${sel.age}세 · ${sel.position}${sel.youthKo ? ` · 유스 ${esc(sel.youthKo)}` : ''}</small></span><span class="ng-sel__ovr"><b class="po-num">${sel.ovr}</b>${sel.peak ? `<small class="ng-peak">전성기 ${sel.peak}</small>` : '<small>OVR</small>'}</span>
      <p class="small muted ng-sel__note">${sel.legend ? `2018-19 세계에 ${sel.age}세로 들어와 30세 무렵 전성기에 닿아요. 실제 유스 클럽은 기록으로만 남아요.` : '지금 소속팀·나이·능력치 그대로 시작해요. 이름은 바꿀 수 없어요. OVR은 시드에 따라 조금 달라져요.'}</p></div>` : '';
  type Row = { id: string; name: string; club: string; age: number; position: string; ovr: number; peak?: number; youthKo?: string };
  const all: Row[] = legendTab ? vm.legendList : vm.reals;
  const q = u.rq.trim().toLowerCase();
  const rows = all.filter((r) => (u.rgroup === 'all' || POS_GROUP[r.position] === u.rgroup) && (!q || [r.name, r.club, r.youthKo ?? ''].some((t) => t.toLowerCase().includes(q))))
    .sort((a, b) => (u.rsort === 'name' ? a.name.localeCompare(b.name) : u.rsort === 'age' ? a.age - b.age || b.ovr - a.ovr : u.rsort === 'peak' && legendTab ? (b.peak ?? 0) - (a.peak ?? 0) || b.ovr - a.ovr : b.ovr - a.ovr));
  const shown = rows.slice(0, u.rshow);
  const sorts = legendTab ? [['peak', '전성기순'], ['ovr', '지금 OVR순'], ['age', '나이순'], ['name', '이름순']] : [['ovr', 'OVR순'], ['age', '나이순'], ['name', '이름순']];
  const sortV = !legendTab && u.rsort === 'peak' ? 'ovr' : u.rsort;
  const search = `<div class="ng-search">${TextField({ value: u.rq, placeholder: legendTab ? '이름 · 시작 구단 · 유스' : '이름 · 소속 구단', icon: 'search', input: { id: 'f-rq', type: 'search', maxLength: 20 }, clearable: !!u.rq, onClear: { act: 'ng-real', data: { k: 'rq', v: '' } } })}
    <label class="ng-sort">${Icon({ name: 'sliders', size: 16 })}<select id="f-rsort" aria-label="정렬">${sorts.map(([id, l]) => `<option value="${id}"${id === sortV ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>`;
  const groups = Tabs({ items: [{ id: 'all', label: '전체' }, { id: 'fw', label: '공격' }, { id: 'mf', label: '미드' }, { id: 'df', label: '수비' }], value: u.rgroup, variant: 'segment', fill: true, act: 'ng-real', data: { k: 'rgroup' }, label: '포지션군' });
  const row = (p: Row) => `<button type="button" class="real-row ng-row${p.id === vm.realId ? ' is-on' : ''}" data-act="form" data-k="realId" data-v="${p.id}">${Avatar({ size: 40, face: { id: p.id, age: p.age }, name: p.name })}<span class="grow"><b class="ng-row__name">${esc(p.name)}</b><small class="ng-row__meta">${esc(p.club)} · ${p.age}세 · ${p.position}${p.youthKo ? ` · 유스 ${esc(p.youthKo)}` : ''}</small></span>${
    p.peak ? `<span class="ng-row__ovr"><span><b class="po-num muted">${p.ovr}</b> → <b class="po-num ng-peak">${p.peak}</b></span><small>지금 → 전성기</small></span>` : `<span class="ng-row__ovr"><b class="po-num">${p.ovr}</b><small>OVR</small></span>`}</button>`;
  const left = rows.length - shown.length;
  const more = left > 0 ? `<button type="button" class="dt-more ng-more" data-act="ng-real" data-k="rshow" data-v="${u.rshow + REAL_MORE}">${Icon({ name: 'chevron-right', size: 14, style: 'transform:rotate(90deg)' })}${Math.min(REAL_MORE, left)}명 더 보기 · ${left}명 남음</button>` : '';
  const head = `<div class="ng-listhead"><b class="small">${legendTab ? `레전드 ${rows.length}명 · GK 제외` : `실제 선수 ${rows.length}명`}</b><small class="muted">${legendTab ? (sortV === 'peak' ? '전성기 OVR 높은 순' : '') : ''}</small></div>`;
  return `${tabs}${card}${search}${groups}${head}
    <div class="real-list">${shown.map(row).join('') || '<p class="small muted">맞는 선수가 없어요.</p>'}</div>${more}
    ${startOptions(vm, false)}
    <div class="btn-col">${Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'start', disabled: !sel, children: sel ? `${sel.name}으로 시작 · ${sel.club}` : '선수를 골라요' })}</div>`;
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
  const bands = `<div class="al-bands"><span class="al-band">~${vm.cost1Max} 칸당 <b>1P</b></span><span class="al-band warn">${vm.cost1Max + 1}~${vm.cost2Max} <b>2P</b></span><span class="al-band fail">${vm.cost2Max + 1}~ <b>3P</b></span><button type="button" class="link-btn al-rule" data-act="alloc-rule" aria-expanded="${rule}">${Icon({ name: 'info', size: 14 })} 규칙</button></div>
    <p class="small muted al-rule-text"${rule ? '' : ' hidden'}>능력치는 1~20으로 보여요. 박스를 누르면 [−]/[+]가 나와요. [+] 한 번 = 한 칸(+1), [−]는 한 칸씩 되돌려요. 막대(칸 안 진행)는 그대로 따라가요. 비용 구간은 실력 ${esc(vm.tierName)}(OVR) 기준, 레벨업마다 ${BALANCE.growth.pointsPerLevel}P. 테두리 = ${esc(vm.position)} 핵심 능력치.</p>`;
  return `${hero}<div class="body al-body">${ovr}${coach}${bands}
    ${attrGrid(vm.attrs, sel, undefined, { cols: 4, keyLabel: `${vm.position} 핵심` })}
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
  const scorers = `${boardTabs}${rowsB.length
    ? `<div class="panel tbl-panel"><table class="tbl league">
      <tr><th>#</th><th class="l">선수</th><th>출전</th><th>골</th><th>도움</th><th>평점</th></tr>
      ${rowsB.map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td class="po-num">${r.rank ?? i + 1}</td><td class="l"><button type="button" class="dt-link team" data-act="person-open" data-v="${esc(r.id)}">${Avatar({ size: 22, face: r.face, name: r.name })}${esc(r.name)}</button>${r.teamId ? teamLink(r.teamId, r.team, 'small muted') : ''}</td><td>${r.apps}</td><td>${hi('goals', r.goals)}</td><td>${hi('assists', r.assists)}</td><td>${hi('rating', r.avg)}</td></tr>`).join('')}
    </table><div class="legend small"><span class="grow r">${board === 'rating' ? `평점은 ${vm.ratingMin}경기 이상 출전한 선수만. ` : ''}다른 팀 경기도 엔진으로 계산한 기록이에요 (빠른 진행으로 계산한 경기는 빠져요)</span></div></div>`
    : `<p class="small muted">${board === 'rating' ? `아직 ${vm.ratingMin}경기 이상 뛴 선수가 없어요.` : '아직 기록이 없어요. 경기가 진행되면 순위가 쌓여요.'}</p>`}`;
  // 디자인 146: 팀 옆 "재" 열 = 재정 등급 4단 막대(색 없음) + 아래 범례 (팀 수)
  const tierCount = FIN_TIERS.map((t) => ({ t, n: vm.table.filter((r) => r.tier === t).length }));
  const table = `<div class="panel tbl-panel"><table class="tbl league">
      <tr><th>#</th><th class="l">팀</th><th class="fin-col" title="재정 등급">재</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
      ${vm.table.map((r) => `<tr class="${r.me ? 'me' : ''}${r.pos <= 4 ? ' top' : ''}${r.pos > vm.teams - 3 ? ' low' : ''}"><td class="po-num">${r.pos}</td><td class="l"><button type="button" class="dt-link team" data-act="team-open" data-v="${esc(r.teamId)}">${Crest({ name: r.team, team: r.teamId, size: 16 })}${esc(r.team)}</button></td><td class="fin-col">${FinChip(r.tier, true, true)}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gd}</td><td><b class="po-num">${r.points}</b></td></tr>`).join('')}
    </table><div class="legend small"><span><i class="k top"></i>상위 4팀</span><span><i class="k low"></i>하위 3팀</span><span class="grow r">팀 전력 = 라인업 평균</span></div></div>
    ${SectionTitle({ title: '재정 등급', action: '재 열 막대 = 구단 재정' })}
    ${panel(`<div class="fin-legend">${tierCount.map((x) => `<div class="fin-legend__cell">${FinChip(x.t, true)}<small class="po-num">${x.n}팀</small></div>`).join('')}</div>
      <p class="small muted">이적료·연봉을 낼 수 있는 크기예요. 표에서는 막대만, 글자는 이 범례와 팀 상세에서. 색은 쓰지 않아요(순위 색과 겹치지 않게).</p>`)}`;
  const starRow = (s: StarVM, i: number) => `<button type="button" class="star-row" data-act="person-open" data-v="${esc(s.id)}"><span class="rank po-num${i === 0 ? ' hi' : ''}">${i + 1}</span>${Avatar({ size: 40, face: s.face, name: s.name })}<span class="grow"><b class="star-name">${esc(s.name)}</b><small>${esc(s.club)} · ${s.age}세 · ${s.position}${s.ga ? ` · ${s.ga}` : ''}</small></span><span class="ovr"><b class="po-num">${s.ovr}</b><small class="${(s.change ?? 0) > 0 ? 'up' : (s.change ?? 0) < 0 ? 'down' : ''}">${s.change ? (s.change > 0 ? `▲${s.change}` : `▼${-s.change}`) : '–'}</small></span></button>`;
  const legRow = (s: WorldVM['legends'][number], i: number) => `<button type="button" class="star-row" data-act="person-open" data-v="${esc(s.id)}"><span class="rank po-num">${i + 1}</span>${Avatar({ size: 40, face: s.face, name: s.name })}<span class="grow"><b class="star-name">${esc(s.name)}</b><small><span class="rec">레전드</span>${esc(s.club)} · ${s.age}세 · ${s.position}</small></span><span class="ovr"><b class="po-num">${s.ovr}</b><small class="peak">전성기 ${s.peak}</small></span></button>`;
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
    ${vm.retired.length ? `<p class="small muted">은퇴: ${vm.retired.map(esc).join(', ')}</p>` : ''}`;
  return `${hero}<div class="body">${tabs}${tab === 'table' ? table : tab === 'cups' ? cups : tab === 'scorers' ? scorers : tab === 'transfers' ? transfers : stars}</div>`;
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
export interface SeasonTodo { title: string; sub: string; act: string; data?: Record<string, string>; cta?: string; warn?: boolean; icon: 'chat' | 'plus' | 'card' }

function todoRow(t: SeasonTodo): string {
  return `<button type="button" class="panel season-todo${t.warn ? ' is-warn' : ''}" data-act="${esc(t.act)}"${Object.entries(t.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}><span class="season-todo__icon">${Icon({ name: t.icon, size: 20 })}</span><span class="grow"><b>${esc(t.title)}</b><small>${esc(t.sub)}</small></span>${
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
    !vm.retired && vm.points > 0 ? todoRow({ title: `포인트 찍기 · ${vm.points}P`, sub: '새 시즌 전에 찍어 두면 좋아요', act: 'go', data: { to: 'allocate' }, icon: 'plus' }) : '',
  ].filter(Boolean);
  const next = vm.retired
    ? Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'go', data: { to: 'retired' }, children: '커리어 요약' })
    : marketPending ? '' : Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'next-season', className: 'season-start', children: `${vm.nextSeason} 시즌 시작` });
  const left = `${vm.forcedRetire ? Banner({ tone: 'warning', title: `${vm.ageTo}세 · 더 이상 뛸 수 없어요`, children: '커리어를 마무리하고 은퇴해요.' }) : ''}
    ${vm.tierReached ? `<div class="panel season-tier">${TierBadge({ tier: vm.tier, score: vm.repAfter })}<span><b>${esc(vm.tierReached)} 달성 · 이 티어는 내려가지 않아요</b><small class="muted">감점은 다음 티어까지의 진행도만 깎아요.</small></span></div>` : ''}
    ${vm.badges.map((b) => Banner({ tone: 'success', title: `레전드 배지 · ${b.name}`, children: `${b.desc} 위상이 ${vm.badgeRep}점 올랐어요.` })).join('')}
    ${vm.injury ? banners([vm.injury]) : ''}
    ${card}
    ${vm.seasonGoals ? goalsResultPanel(vm.seasonGoals) : ''}
    ${market}
    ${todos.length ? `<p class="season-todo-head">다음 할 일</p>${todos.join('')}` : ''}
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
    ${SectionTitle({ title: '커리어 흐름' })}
    ${panel(historyTable(vm.history))}
    ${Banner({ tone: 'info', title: '은퇴한 세이브는 기록 보기만 할 수 있어요', children: '다른 슬롯의 진행에는 영향이 없어요.' })}
    <div class="btn-col">${Button({ size: 'lg', block: true, icon: 'plus', act: 'go', data: { to: 'new' }, children: '새 커리어' })}</div>
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
    ${versionFooter(version)}
  </div>`;
}

/** 월드 "컵·챔스" 탭 (C.67b, 디자인 없음 — 순위표 표 · 패널 재사용): 챔스 조 8개 · 녹아웃 대진 · FA컵 대진 */
export function cupsSection(vm: CupsWorldVM): string {
  const tieRow = (t: CupTieVM) => `<div class="cup-tie${t.me ? ' me' : ''}"><span class="cup-tie__teams"><button type="button" class="dt-link team" data-act="team-open" data-v="${esc(t.hId)}">${Crest({ name: t.h, team: t.hId, size: 16 })}${esc(t.h)}</button>
    <b class="po-num cup-tie__score">${esc(t.score ?? 'vs')}</b>
    <button type="button" class="dt-link team" data-act="team-open" data-v="${esc(t.aId)}">${Crest({ name: t.a, team: t.aId, size: 16 })}${esc(t.a)}</button></span>
    <small class="muted">${esc([t.score === null && !t.note.includes('차전') ? t.date : '', t.note, t.w ? `${t.w} 진출` : ''].filter(Boolean).join(' · '))}</small></div>`;
  const u = vm.ucl;
  const ucl = u ? `${SectionTitle({ title: '챔피언스리그', action: u.winner ? `우승 ${u.winner}` : `우리 팀 · ${u.my}` })}
    ${u.ko.slice().reverse().map((st) => `<h4 class="ag-head">${esc(st.stage)}</h4>${panel(st.ties.map(tieRow).join(''))}`).join('')}
    <h4 class="ag-head">조별리그</h4><div class="cup-groups">${u.groups.map((gr) => `<div class="panel tbl-panel${gr.mine ? ' is-mine' : ''}"><table class="tbl league">
      <tr><th class="l">${esc(gr.name)}</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
      ${gr.rows.map((r) => `<tr class="${r.me ? 'me' : ''}${r.through ? ' top' : ''}"><td class="l"><button type="button" class="dt-link team" data-act="team-open" data-v="${esc(r.teamId)}">${Crest({ name: r.team, team: r.teamId, size: 16 })}${esc(r.team)}</button></td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gd}</td><td><b class="po-num">${r.pts}</b></td></tr>`).join('')}
    </table></div>`).join('')}</div>
    <p class="small muted">조 2위까지 16강 · 16강~4강은 홈·원정 합계(동률이면 승부차기) · 결승은 단판. 내 팀이 없는 경기는 팀 전력으로 간이 계산해요.</p>`
    : `${SectionTitle({ title: '챔피언스리그' })}<p class="small muted">이번 시즌 챔스 대진이 없어요(지난 시즌 리그 4위 안 팀이 나가요).</p>`;
  const f = vm.fa;
  const fa = f ? `${SectionTitle({ title: 'FA컵', action: f.winner ? `우승 ${f.winner}` : `우리 팀 · ${f.my}` })}
    ${f.rounds.map((r) => `<h4 class="ag-head">${esc(r.stage)} · ${esc(r.date)}</h4>${panel(r.ties.map(tieRow).join(''))}`).join('')}`
    : `${SectionTitle({ title: 'FA컵' })}<p class="small muted">이번 시즌 FA컵이 없어요.</p>`;
  return `<p class="small muted">${esc(vm.season)} 시즌</p>${ucl}${fa}`;
}
