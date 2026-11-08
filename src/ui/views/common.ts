// 화면 공통 조각: 패널, 하단 탭, 버전 표시, 배너 목록. 컴포넌트(src/ui/components)만 조합한다

import { Banner, BottomSheet, Button, cx, esc, Icon, OptionRow, SectionTitle, StatChip, Tabs, type IconName } from '../components';
import {
  pitchNames, PITCH_NAMES_KO, pitchOrient, PITCH_ORIENT_KO, pitchSize, PITCH_SIZE_KO, pitchView, PITCH_VIEW_KO, type PitchView,
} from '../pitch/renderer';
import type { BannerVM, SeasonMatchesVM, VersionVM } from '../viewModels';

export function panel(inner: string, cls = ''): string {
  return `<div class="panel ${cls}">${inner}</div>`;
}

export function banners(list: BannerVM[]): string {
  return list.map((b) => Banner({
    tone: b.tone, title: b.title, ...(b.body ? { children: b.body } : {}), ...(b.icon ? { icon: b.icon, fill: true } : {}),
    ...(b.action ? { action: b.action, onAction: { act: b.act!, data: b.to ? { to: b.to } : {} } } : {}),
  })).join('');
}

/** 버전 표시 (21.5.1, I.19 5번): 맨 아래 작은 보조 글씨 */
export function versionFooter(v: VersionVM): string {
  return `<p class="ver">${esc(v.label)}</p>`;
}

/** 설정 맨 아래 (C.80x): "버전 C.80x · 53단계 · [업데이트 확인]" */
export function updateCheckRow(patch: string, stage: string): string {
  return `<div class="upd-row"><span>버전 ${esc(patch)} · ${esc(stage)}</span>${Button({ variant: 'secondary', size: 'sm', act: 'upd-check', children: '업데이트 확인' })}</div>`;
}

/** 세이브 시작 버전이 다르면 중립 배너 (디자인 22) */
export function startNotice(v: VersionVM): string {
  if (!v.notice) return '';
  const [title, ...rest] = v.notice.split('. ');
  return Banner({ tone: 'info', title: title!.replace(/\.$/, ''), ...(rest.length ? { children: rest.join('. ') } : {}) });
}

/**
 * 독 (C.44 → C.54 디자인 154 → C.66 사용자 지시): 가운데 강조 키 = [다음](진행) 키 — 계속·진행 중·경기·경기 중·답하기·시즌 요약 상태를
 * 이 키가 보여 준다(따로 있던 초록 진행 알약은 없앰). 홈은 맨 왼쪽 일반 칸(다른 칸과 같은 모양). 잠긴 칸 = 흐리게 + 작은 자물쇠.
 * 폰 가로(C.66)는 같은 칸을 왼쪽 세로 레일로 쓰고, PC 는 아래 가로 줄. 칸 배치는 DOCK_PHONE 배열 하나만 고치면 된다(PC 는 dockPc 로 만든다).
 */
/** [다음] 키 상태 (C.69 디자인 201 독 v3): 계속 · 진행 중(running) · 경기 · 경기 중 · 잠김(locked, 누를 수 없음) · 답하기 · 시즌 요약 */
export type DockProg = 'continue' | 'running' | 'match' | 'live' | 'locked' | 'answer' | 'season';
export interface DockVM {
  screen: string;
  /** 진행 칸: 지금 누르면 하는 일 */
  prog: { label: string; icon: IconName; act: string; data?: Record<string, string>; live?: boolean; kind?: DockProg; badge?: number };
  tacticsOpen: boolean;
  /** 남은 포인트 (선수 칸 배지) */
  points: number;
  more: boolean;
  /** 인박스 안 읽음 (C.63c 더보기 줄 배지) */
  inbox?: number;
  /** 코치 후보 수 (C.70 재정 칸 배지 → C.77q 코치·스태프가 훈련으로 옮겨 훈련 칸 배지) */
  coach?: number;
  /** 상점 새 카드 (17차 S03: 더보기 배지에 합산) — 지금 코드에 값이 없어 0 */
  shop?: number;
}

export type DockId = 'prog' | 'player' | 'home' | 'schedule' | 'world' | 'more' | 'deck' | 'tactics' | 'settings' | 'saves' | 'inbox' | 'finance' | 'shop'
  | 'national' | 'awards' | 'collection';
/**
 * 폰 독 v4 (17차 S03, 사용자 결정 D3): 홈 · 훈련 · [다음] · 선수 · 더보기 — [다음] 정가운데(열 1 · 1 · 1.9 · 1 · 1).
 * 상점은 더보기 첫 칸. 가로 폰은 위→아래 레일, 더보기는 레일 옆 펼침(dockMoreRow)
 */
export const DOCK_PHONE: DockId[] = ['home', 'schedule', 'prog', 'player', 'more'];
/**
 * 더보기 격자 (17차 S03 + 적용 명세 2절 28번 저장 칸): 독 위 2줄 6 · 5칸, 끌기 없음.
 * 상점 · 인박스 · 재정 · 월드 · 덱 · 전술 / 대표팀 · 시상 · 수집(도감·진열실) · 설정 · 저장
 */
export const DOCK_MORE: DockId[] = ['shop', 'inbox', 'finance', 'world', 'deck', 'tactics', 'national', 'awards', 'collection', 'settings', 'saves'];
/** 더보기 격자 한 줄 칸 수 (2줄 6 · 5) */
export const DOCK_MORE_COLS = 6;
/**
 * PC 12칸 (17차 S03-b): 홈 · 훈련 · 인박스 · 재정 · 월드 | [다음] 176px | 선수 · 상점 · 덱 · 전술 · 설정 · 저장 — 더보기 없음.
 * 대표팀 · 시상 · 수집은 홈 오른쪽 열 "커리어 바로가기"(careerLinks)
 */
export const DOCK_PC: DockId[] = ['home', 'schedule', 'inbox', 'finance', 'world', 'prog', 'player', 'shop', 'deck', 'tactics', 'settings', 'saves'];
/** PC 독 (옛 이름 유지): 17차부터 칸은 DOCK_PC 하나로 고정 — 폰 칸 배열과 상관없다 */
export function dockPc(_phone: readonly DockId[] = DOCK_PHONE): DockId[] {
  return [...DOCK_PC];
}
/** PC 독에 없는 커리어 칸 (홈 오른쪽 열 바로가기) */
export const CAREER_LINKS: DockId[] = ['national', 'awards', 'collection'];
/** 더보기 칸이 켜지는 화면 = 폰 독에 없는 칸 */
const MORE_SCREENS: Record<string, DockId> = {
  shop: 'shop', deck: 'deck', tactics: 'tactics', world: 'world', settings: 'settings', saves: 'saves', inbox: 'inbox', finance: 'finance',
  national: 'national', awards: 'awards', dex: 'collection', showroom: 'collection',
};

/** 이동 목적지 (C.77q 메뉴 정리): 화면 + 그 화면 탭 */
export interface Route { screen: string; trainTab?: 'pre' | 'cal' | 'g' | 'staff'; playerTab?: string }
const TRAIN_TABS = ['pre', 'cal', 'g', 'staff'] as const;
/**
 * 옛 진입점 → 새 위치 (C.77q). 'staff' = 훈련 화면 스태프 탭(인박스 후보·스태프 링크, 홈 코치 후보 배지),
 * 재정 + 'shop' 탭(옛 재정 › 카드 상점) = 상점 화면. tab = data-tab (훈련 탭 · 선수 탭)
 */
export function routeOf(to: string, tab?: string): Route {
  if (to === 'staff') return { screen: 'schedule', trainTab: 'staff' };
  if (to === 'finance' && tab === 'shop') return { screen: 'shop' };
  const t = TRAIN_TABS.find((x) => x === tab);
  if (to === 'schedule' && t) return { screen: 'schedule', trainTab: t };
  if (to === 'player' && tab) return { screen: 'player', playerTab: tab };
  return { screen: to };
}

type DockItem = { label: string; icon: IconName; act: string; data?: Record<string, string>; on?: boolean; badge?: number; lock?: boolean };

/** 열 너비 (가로 줄): [다음] 키 고정 폭, 다른 칸 같은 몫. 양쪽 합을 같게 맞춰 [다음]이 정확히 가운데 */
export function dockColumns(ids: DockId[], keyPx: number): string {
  const h = ids.indexOf('prog');
  const left = h || 1;
  const right = ids.length - h - 1 || 1;
  return ids.map((id, i) => (id === 'prog' ? `${keyPx}px` : `minmax(0, ${+((1 / (i < h ? left : right)) * 6).toFixed(3)}fr)`)).join(' ');
}

const badgeText = (n: number): string => (n > 99 ? '99+' : String(n));
const dockAttrs = (act: string, data?: Record<string, string>) => ` data-act="${esc(act)}"${Object.entries(data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}`;

/** 독 칸 정의 (폰·PC·더보기 격자 공통) */
function dockItems(vm: DockVM): Record<Exclude<DockId, 'prog' | 'more'>, DockItem> {
  const s = vm.screen;
  return {
    inbox: { label: '인박스', icon: 'inbox', act: 'go', data: { to: 'inbox' }, on: s === 'inbox', ...(vm.inbox ? { badge: vm.inbox } : {}) },
    finance: { label: '재정', icon: 'coin', act: 'go', data: { to: 'finance' }, on: s === 'finance' },
    shop: { label: '상점', icon: 'card', act: 'go', data: { to: 'shop' }, on: s === 'shop', ...(vm.shop ? { badge: vm.shop } : {}) },
    home: { label: '홈', icon: 'home', act: 'go-tab', data: { v: 'home' }, on: s === 'home' },
    player: { label: '선수', icon: 'player', act: 'go-tab', data: { v: 'player' }, on: s === 'player' || s === 'allocate', ...(vm.points ? { badge: vm.points } : {}) },
    schedule: { label: '훈련', icon: 'train', act: 'go-tab', data: { v: 'schedule' }, on: s === 'schedule', ...(vm.coach ? { badge: vm.coach } : {}) },
    world: { label: '월드', icon: 'world', act: 'go-tab', data: { v: 'world' }, on: s === 'world' },
    deck: { label: '덱', icon: 'deck', act: 'go-tab', data: { v: 'deck' }, on: s === 'deck' },
    tactics: { label: '전술', icon: 'tactic', act: 'tac-open', on: s === 'tactics', lock: !vm.tacticsOpen },
    national: { label: '대표팀', icon: 'plane', act: 'go', data: { to: 'national' }, on: s === 'national' },
    awards: { label: '시상', icon: 'star', act: 'go', data: { to: 'awards' }, on: s === 'awards' },
    // 수집 (2절 28번): 도감 · 진열실 고르는 작은 시트(K5)
    collection: { label: '수집', icon: 'album', act: 'collect-open', on: s === 'dex' || s === 'showroom' },
    settings: { label: '설정', icon: 'settings', act: 'go-tab', data: { v: 'settings' }, on: s === 'settings' },
    saves: { label: '저장', icon: 'disk', act: 'go-tab', data: { v: 'saves' }, on: s === 'saves' },
  };
}

/** 더보기 칸 배지 = 격자 안 칸 배지 합 (2절 22번). 폰 독에 이미 있는 칸은 뺀다 */
export function moreBadge(vm: DockVM): number {
  const items = dockItems(vm);
  return DOCK_MORE.filter((id) => !DOCK_PHONE.includes(id)).reduce((a, id) => a + (id === 'prog' || id === 'more' ? 0 : items[id].badge ?? 0), 0);
}

/** [다음] 글자 4자 이상(시즌 요약)은 15px (S03 "칸 폭 120px에서 넘치지 않게") */
export const dockLabelLong = (label: string): boolean => Array.from(label.replace(/\s/g, '')).length >= 4;

function dockCell(id: DockId, vm: DockVM, items: ReturnType<typeof dockItems>, extraCls = ''): string {
  if (id === 'prog') {
    const p = vm.prog;
    const kind: DockProg = p.kind ?? (p.live ? 'live' : 'continue');
    const busy = kind === 'running';
    return `<button type="button" class="${cx('po-dock__go po-dock__next', `is-${kind}`, dockLabelLong(p.label) && 'is-long')}"${dockAttrs(p.act, p.data)}${busy ? ' aria-disabled="true"' : ''}${kind === 'locked' ? ' disabled' : ''} aria-label="다음 · ${esc(p.label)}${p.badge ? ` · ${p.badge}` : ''}"><span class="po-dock__goicon">${
      kind === 'live' ? '<i class="po-dock__live"></i>' : ''}${Icon({ name: p.icon, size: 22, strokeWidth: 2.4 })}<span class="po-dock__golabel">${esc(p.label)}</span>${p.badge ? `<b class="po-dock__badge po-num">${badgeText(p.badge)}</b>` : ''}</span></button>`;
  }
  const it: DockItem = id === 'more'
    ? { label: '더보기', icon: 'menu', act: 'dock-more', on: vm.more || (!!MORE_SCREENS[vm.screen] && !DOCK_PHONE.includes(MORE_SCREENS[vm.screen]!)), ...(!vm.more && moreBadge(vm) ? { badge: moreBadge(vm) } : {}) }
    : items[id];
  return `<button type="button" class="${cx('po-dock__item', extraCls, it.on && 'is-on', it.lock && 'is-locked')}"${dockAttrs(it.act, it.data)}${it.lock ? ' disabled' : ''}${it.on && id !== 'more' ? ' aria-current="page"' : ''}${
    id === 'more' ? ` aria-expanded="${vm.more}"` : ''}${it.badge ? ` aria-label="${esc(`${it.label} ${it.badge}`)}"` : ''}><span class="po-dock__icon">${
    Icon({ name: it.icon, size: 22, strokeWidth: it.on ? 2.4 : 2 })}${it.lock ? `<span class="po-dock__lock">${Icon({ name: 'lock', size: 10, strokeWidth: 2.6 })}</span>` : it.badge ? `<b class="po-dock__badge po-num">${badgeText(it.badge)}</b>` : ''}</span><span class="po-dock__label">${esc(it.label)}</span></button>`;
}

export function dock(vm: DockVM): string {
  const items = dockItems(vm);
  // 열 너비: 폰 1 · 1 · 1.9 · 1 · 1 ([다음] 정가운데), PC 양쪽 같은 몫 + [다음] 176px
  const cols = (ids: DockId[], pc: boolean) => (pc ? dockColumns(ids, 176) : ids.map((id) => `minmax(0, ${id === 'prog' ? 1.9 : 1}fr)`).join(' '));
  const bar = (ids: DockId[], pc: boolean) => `<div class="${cx('po-dock po-dock--v3 po-dock--v4', pc ? 'po-dock--pc dock-wide' : 'dock-phone')}" style="grid-template-columns: ${cols(ids, pc)}">${ids.map((id) => dockCell(id, vm, items)).join('')}</div>`;
  // 더보기 (17차 S03): 독 위 2줄 격자(가로 폰 = 레일 옆 세로 줄), 배경을 막지 않음
  const row = vm.more ? dockMoreRow(vm, items) : '';
  return `<nav class="nav dock-bar" aria-label="주요 메뉴">${row}${bar(DOCK_PHONE, false)}${bar(DOCK_PC, true)}</nav>`;
}

/**
 * 은퇴한 세이브 독 (C.81p, 17차 1단계 수정 요청 31번): 쓸 수 있는 칸만 — 커리어 요약 · 선수(기록 보기) · [새 게임] · 저장 · 설정.
 * 은퇴하면 진행 화면(홈·훈련·상점·덱·전술…)이 모두 커리어 요약으로 돌아가므로 그 칸은 없다. 모양은 독 v3 그대로(새 디자인 전 최소 구현)
 */
export const RETIRED_DOCK = ['summary', 'player', 'prog', 'saves', 'settings'] as const;
export function retiredDock(screen: string): string {
  const items: Record<Exclude<(typeof RETIRED_DOCK)[number], 'prog'>, DockItem> = {
    summary: { label: '커리어', icon: 'trophy', act: 'go', data: { to: 'retired' }, on: screen === 'retired' || screen === 'season' },
    player: { label: '선수', icon: 'player', act: 'go-tab', data: { v: 'player' }, on: screen === 'player' },
    saves: { label: '저장', icon: 'disk', act: 'go-tab', data: { v: 'saves' }, on: screen === 'saves' },
    settings: { label: '설정', icon: 'settings', act: 'go-tab', data: { v: 'settings' }, on: screen === 'settings' },
  };
  const attrs = (act: string, data?: Record<string, string>) => ` data-act="${act}"${Object.entries(data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}`;
  const cell = (id: (typeof RETIRED_DOCK)[number]): string => {
    if (id === 'prog') {
      return `<button type="button" class="po-dock__go po-dock__next is-continue" data-act="go" data-to="new" aria-label="다음 · 새 게임"><span class="po-dock__goicon">${Icon({ name: 'plus', size: 22, strokeWidth: 2.4 })}<span class="po-dock__golabel">새 게임</span></span></button>`;
    }
    const it = items[id];
    return `<button type="button" class="${cx('po-dock__item', it.on && 'is-on')}"${attrs(it.act, it.data)}${it.on ? ' aria-current="page"' : ''}><span class="po-dock__icon">${
      Icon({ name: it.icon, size: 22, strokeWidth: it.on ? 2.4 : 2 })}</span><span class="po-dock__label">${esc(it.label)}</span></button>`;
  };
  const ids = [...RETIRED_DOCK];
  const phone = ids.map((id) => `minmax(0, ${id === 'prog' ? 1.9 : 1}fr)`).join(' ');
  const bar = (pc: boolean) => `<div class="${cx('po-dock po-dock--v3 po-dock--retired', pc ? 'po-dock--pc dock-wide' : 'dock-phone')}" style="grid-template-columns: ${pc ? dockColumns(ids as DockId[], 176) : phone}">${ids.map(cell).join('')}</div>`;
  return `<nav class="nav dock-bar" aria-label="주요 메뉴 · 은퇴">${bar(false)}${bar(true)}</nav>`;
}

/** 더보기 격자 (17차 S03): 폰 독에 없는 칸 11개, 2줄 6 · 5. 칸을 고르거나 [더보기]·바깥을 누르면 접힘 */
function dockMoreRow(vm: DockVM, items: ReturnType<typeof dockItems>): string {
  const ids = DOCK_MORE.filter((id) => !DOCK_PHONE.includes(id));
  return `<div class="dock-more dock-more--grid" role="menu" aria-label="더보기"><div class="dock-more__scroll dock-more__grid" style="--more-cols:${DOCK_MORE_COLS}">${
    ids.map((id) => dockCell(id, vm, items, 'dock-more__item')).join('')}</div></div>`;
}

/** 수집 고르기 시트 (2절 28번, K5): 포토카드 도감 · 진열실 */
export function collectSheet(): string {
  return BottomSheet({
    eyebrow: '수집', title: '무엇을 볼까요', onClose: { act: 'sheet-close' }, className: 'collect-sheet',
    children: OptionRow({ act: 'go', data: { to: 'dex' }, icon: 'album', title: '포토카드 도감', desc: '모은 선수 포토카드' })
      + OptionRow({ act: 'go', data: { to: 'showroom' }, icon: 'trophy', title: '진열실', desc: '트로피 · 교환한 유니폼' }),
  });
}

/** 커리어 바로가기 (17차 S03-b, PC): PC 독에 없는 대표팀 · 시상 · 수집을 홈 오른쪽 열에서 */
export function careerLinks(): string {
  const it = (act: string, data: Record<string, string>, icon: IconName, label: string) =>
    `<button type="button" class="career-link"${dockAttrs(act, data)}>${Icon({ name: icon, size: 18 })}<span>${esc(label)}</span></button>`;
  return `<section class="po-panel po-panel--info career-links"><header class="po-panel__head"><span class="po-panel__titles"><b class="po-panel__title">커리어 바로가기</b></span></header><div class="career-links__row">${
    it('go', { to: 'national' }, 'plane', '대표팀') + it('go', { to: 'awards' }, 'star', '시상') + it('go', { to: 'dex' }, 'album', '도감') + it('go', { to: 'showroom' }, 'trophy', '진열실')}</div></section>`;
}

/** 모바일 더보기 시트: 독에 없는 칸 (C.50: 월드 추가, C.54: DOCK_PHONE 에 있는 칸은 뺀다) */
export function dockMoreSheet(tacticsOpen: boolean): string {
  return BottomSheet({
    eyebrow: '더보기', title: '메뉴', onClose: { act: 'sheet-close' },
    children: [
      DOCK_PHONE.includes('world') ? '' : OptionRow({ act: 'go-tab', data: { v: 'world' }, icon: 'world', title: '월드', desc: '순위표·득점 순위·이적 소식' }),
      OptionRow({ act: 'go-tab', data: { v: 'finance' }, icon: 'coin', title: '재정', desc: '수입·지출·생활·투자' }),
      OptionRow({ act: 'go-tab', data: { v: 'deck' }, icon: 'deck', title: '덱', desc: '카드 덱 편집·선택권' }),
      OptionRow({ act: 'tac-open', icon: tacticsOpen ? 'tactic' : 'lock', title: '전술', desc: tacticsOpen ? '포메이션·성향·내 위치' : '3경기 뒤에 열려요', disabled: !tacticsOpen }),
      OptionRow({ act: 'go-tab', data: { v: 'settings' }, icon: 'settings', title: '설정', desc: '경기 진행·보기·페이스온' }),
      OptionRow({ act: 'go-tab', data: { v: 'saves' }, icon: 'disk', title: '저장', desc: '수동 저장·불러오기·파일' }),
    ].join(''),
  });
}

/** PC 2열 (C.61, 디자인 120~123): 왼쪽 주 카드 · 오른쪽 보조. 폰에서는 쓰지 않는다(isWide 일 때만 부른다) */
export function pc2(left: string, right: string, cls = ''): string {
  return `<div class="pc2${cls ? ` ${cls}` : ''}"><div class="pc2__l">${left}</div><div class="pc2__r">${right}</div></div>`;
}

/** 4칸 숫자 타일 (디자인 51·56) */
export function statTiles(items: { value: string | number; label: string; hi?: boolean }[]): string {
  return `<div class="tiles">${items.map((t) => `<div class="tile"><b class="po-num${t.hi ? ' hi' : ''}">${esc(t.value)}</b><span>${esc(t.label)}</span></div>`).join('')}</div>`;
}

/** 버튼 두 개 하단 줄 (보조 1 : 주 1.6) */
export function actionRow(secondary: string, primary: string): string {
  return `<div class="btn-row">${secondary}${primary}</div>`;
}

/** 기록 칩 (부록 C.30) */
export function recordChips(rows: { label: string; value: string }[]): string {
  return rows.map((m) => StatChip({ label: m.label, value: m.value })).join('');
}

/** 나머지 기록 "전체 보기" (부록 C.30): 펼침 상태는 저장하지 않는다 */
export function moreRecords(rows: { label: string; value: string }[]): string {
  if (!rows.length) return '';
  return `<details class="rec-more"><summary>전체 보기</summary><div class="chips">${recordChips(rows)}</div></details>`;
}

/** 시즌 경기 목록 한 줄 요약과 시즌 합계 (부록 C.30, D.22 4번 ②) */
export function seasonMatchesSection(vm: SeasonMatchesVM, title = '시즌 경기 기록'): string {
  const total = vm.total
    ? `<div class="chips">${recordChips(vm.total.primary)}</div>${moreRecords(vm.total.more)}
       <p class="small muted">합계는 기록이 남은 ${vm.recApps}경기 기준이에요.</p>`
    : '<p class="muted small">아직 경기 기록이 없어요. 첫 경기를 뛰면 여기에 쌓여요.</p>';
  const rows = vm.rows.map((r) => `<div class="mlog">
      <div class="kv"><b class="small">${r.round}R ${esc(r.opp)} <small class="muted">${r.venue}</small></b>
        <span class="small score-cell"><b class="po-num ${r.outcome === 'win' ? 'up' : r.outcome === 'loss' ? 'down' : ''}">${esc(r.score)}</b> · 평점 <b class="po-num">${esc(r.rating)}</b></span></div>
      <div class="small muted">${esc(r.head)}${r.line ? ` · ${esc(r.line)}` : ''}</div>
      ${r.hl.length || r.decisions ? `<ul class="mlog-hl small">${r.hl.map((h) => `<li>${esc(h)}</li>`).join('')}${r.decisions ? `<li class="muted">내 결정 ${r.decisions}번</li>` : ''}</ul>` : ''}
      ${r.replay ? Button({ variant: 'ghost', size: 'sm', icon: 'play', act: 'replay-open', data: { v: r.replay }, children: '다시 보기' }) : ''}
    </div>`).join('');
  return `${SectionTitle({ title, action: `${vm.rows.length}경기` })}
    ${panel(`<b class="small">시즌 합계</b>${total}`)}
    ${vm.rows.length ? panel(rows, 'mlog-list') : ''}`;
}

/** "(으)로": 마지막 한글에 받침이 있으면(ㄹ 제외) "으로" (자동으로, 타겟맨으로, 골잡이로, 역습으로). 괄호 속 글자는 건너뛴다 */
export function roJosa(word: string): string {
  const last = word.replace(/\([^)]*\)/g, '').replace(/[^가-힣]+$/, '').slice(-1);
  const code = last ? last.charCodeAt(0) - 0xac00 : -1;
  return code >= 0 && code % 28 !== 0 && code % 28 !== 8 ? '으로' : '로';
}

/** 경기 화면 [보기] 버튼 (부록 C.43): 누르면 얼굴/등번호/캐릭터 시트. inline = 결정 순간 스코어 줄 안 (C.56, 5차 77) */
export function pitchViewButton(inline = false): string {
  return `<button type="button" class="pv-btn${inline ? ' pv-btn--inline' : ''}" data-act="pv-open" aria-label="선수 표시 바꾸기">${inline ? `${Icon({ name: 'eye', size: 14 })}보기` : `보기 · ${PITCH_VIEW_KO[pitchView()]}`}</button>`;
}

/** 보기 바꾸기 시트 */
export function pitchViewSheet(): string {
  const v = pitchView();
  const DESC: Record<PitchView, string> = {
    face: '선수 얼굴(미니페이스) + 팀 색 밑줄. 이미지가 없는 선수는 기본 아바타',
    number: '번호가 적힌 원 (기본, 선발 1~11 · 교체 12~)',
    character: '도트(픽셀아트) 선수 얼굴. 도트 이미지가 없는 선수는 등번호',
  };
  return BottomSheet({
    eyebrow: '경기 화면', title: '선수 표시', subtitle: '설정 화면에서도 바꿀 수 있어요. 이 기기에 저장돼요.', onClose: { act: 'pv-close' },
    children: `${(['number', 'face', 'character'] as const).map((k) => OptionRow({ act: 'pv-set', data: { v: k }, radio: true, selected: v === k, title: PITCH_VIEW_KO[k], desc: DESC[k] })).join('')}
      <div class="kv"><span>방향</span></div>${Tabs({ items: (['landscape', 'portrait'] as const).map((k) => ({ id: k, label: PITCH_ORIENT_KO[k] })), value: pitchOrient(), act: 'po-orient', fill: true, label: '경기 화면 방향' })}
      <div class="kv"><span>선수 크기</span></div>${Tabs({ items: (['normal', 'large', 'xlarge'] as const).map((k) => ({ id: k, label: PITCH_SIZE_KO[k] })), value: pitchSize(), act: 'po-size', fill: true, label: '선수 크기' })}
      <div class="kv"><span>이름 표시</span></div>${Tabs({ items: (['all', 'mine', 'off'] as const).map((k) => ({ id: k, label: PITCH_NAMES_KO[k] })), value: pitchNames(), act: 'po-names', fill: true, label: '이름 표시' })}`,
  });
}
