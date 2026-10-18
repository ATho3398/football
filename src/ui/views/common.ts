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
    tone: b.tone, title: b.title, ...(b.body ? { children: b.body } : {}),
    ...(b.action ? { action: b.action, onAction: { act: b.act!, data: b.to ? { to: b.to } : {} } } : {}),
  })).join('');
}

/** 버전 표시 (21.5.1, I.19 5번): 맨 아래 작은 보조 글씨 */
export function versionFooter(v: VersionVM): string {
  return `<p class="ver">${esc(v.label)}</p>`;
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
export type DockProg = 'continue' | 'busy' | 'match' | 'live' | 'answer' | 'season';
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
}

export type DockId = 'prog' | 'player' | 'home' | 'schedule' | 'world' | 'more' | 'deck' | 'tactics' | 'settings' | 'saves';
/** 폰 5칸 (C.66 사용자 지시: 홈 · 선수 · [다음] · 훈련·일정 · 더보기). 가로 폰은 위→아래 레일, 더보기는 레일 옆 펼침 줄(dockMoreRow) */
export const DOCK_PHONE: DockId[] = ['home', 'player', 'prog', 'schedule', 'more'];
/**
 * PC 9칸 (C.61 → C.66): 폰 독 순서에서 만든다. 홈(맨 왼쪽) 다음에 덱 · 전술, 더보기 자리에 폰 독에 없는 월드 · 설정 · 저장을 펼친다
 * (지금 = 홈 · 덱 · 전술 · 선수 · [다음] · 훈련·일정 · 월드 · 설정 · 저장 — [다음]이 가운데)
 */
export function dockPc(phone: readonly DockId[]): DockId[] {
  const lead: DockId[] = (['deck', 'tactics'] as DockId[]).filter((x) => !phone.includes(x));
  const more: DockId[] = (['world', 'settings', 'saves'] as DockId[]).filter((x) => !phone.includes(x));
  const rest = phone.flatMap((id) => (id === 'more' ? more : [id]));
  return rest[0] === 'home' ? ['home', ...lead, ...rest.slice(1)] : [...lead, ...rest];
}
export const DOCK_PC: DockId[] = dockPc(DOCK_PHONE);
/** 더보기 칸이 켜지는 화면 = 모바일 독에 없는 칸 */
const MORE_SCREENS: Record<string, DockId> = { deck: 'deck', tactics: 'tactics', world: 'world', settings: 'settings', saves: 'saves' };

type DockItem = { label: string; icon: IconName; act: string; data?: Record<string, string>; on?: boolean; badge?: number; lock?: boolean };

/** 열 너비 (가로 줄): [다음] 키 고정 폭, 다른 칸 같은 몫. 양쪽 합을 같게 맞춰 [다음]이 정확히 가운데 */
export function dockColumns(ids: DockId[], keyPx: number): string {
  const h = ids.indexOf('prog');
  const left = h || 1;
  const right = ids.length - h - 1 || 1;
  return ids.map((id, i) => (id === 'prog' ? `${keyPx}px` : `minmax(0, ${+((1 / (i < h ? left : right)) * 6).toFixed(3)}fr)`)).join(' ');
}

export function dock(vm: DockVM): string {
  const s = vm.screen;
  const phone = new Set(DOCK_PHONE);
  const items: Record<Exclude<DockId, 'prog'>, DockItem> = {
    home: { label: '홈', icon: 'home', act: 'go-tab', data: { v: 'home' }, on: s === 'home' },
    player: { label: '선수', icon: 'player', act: 'go-tab', data: { v: 'player' }, on: s === 'player' || s === 'allocate', ...(vm.points ? { badge: vm.points } : {}) },
    schedule: { label: '훈련·일정', icon: 'calendar', act: 'go-tab', data: { v: 'schedule' }, on: s === 'schedule' },
    world: { label: '월드', icon: 'world', act: 'go-tab', data: { v: 'world' }, on: s === 'world' },
    more: { label: '더보기', icon: 'menu', act: 'dock-more', on: vm.more || (!!MORE_SCREENS[s] && !phone.has(MORE_SCREENS[s]!)) },
    deck: { label: '덱', icon: 'deck', act: 'go-tab', data: { v: 'deck' }, on: s === 'deck' },
    tactics: { label: '전술', icon: 'tactic', act: 'tac-open', on: s === 'tactics', lock: !vm.tacticsOpen },
    settings: { label: '설정', icon: 'settings', act: 'go-tab', data: { v: 'settings' }, on: s === 'settings' },
    saves: { label: '저장', icon: 'disk', act: 'go-tab', data: { v: 'saves' }, on: s === 'saves' },
  };
  const attrs = (act: string, data?: Record<string, string>) => ` data-act="${act}"${Object.entries(data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}`;
  const badge = (n?: number) => (n ? `<b class="po-dock__badge po-num">${n}</b>` : '');
  const p = vm.prog;
  const kind: DockProg = p.kind ?? (p.live ? 'live' : 'continue');
  const cell = (id: DockId): string => {
    if (id === 'prog') {
      const busy = kind === 'busy';
      return `<button type="button" class="po-dock__go po-dock__next is-${kind}"${attrs(p.act, p.data)}${busy ? ' aria-disabled="true"' : ''} aria-label="다음 · ${esc(p.label)}"><span class="po-dock__goicon">${
        kind === 'live' ? '<i class="po-dock__live"></i>' : ''}${Icon({ name: p.icon, size: 22, strokeWidth: 2.4 })}<span class="po-dock__golabel">${esc(p.label)}</span>${badge(p.badge)}</span></button>`;
    }
    const it = items[id];
    return `<button type="button" class="${cx('po-dock__item', it.on && 'is-on', it.lock && 'is-locked')}"${attrs(it.act, it.data)}${it.lock ? ' disabled' : ''}${it.on ? ' aria-current="page"' : ''}><span class="po-dock__icon">${
      Icon({ name: it.icon, size: 22, strokeWidth: it.on ? 2.4 : 2 })}${it.lock ? `<span class="po-dock__lock">${Icon({ name: 'lock', size: 10, strokeWidth: 2.6 })}</span>` : badge(it.badge)}</span><span class="po-dock__label">${esc(it.label)}</span></button>`;
  };
  const bar = (ids: DockId[], pc: boolean) => `<div class="${cx('po-dock', pc ? 'po-dock--pc dock-wide' : 'dock-phone')}" style="grid-template-columns: ${dockColumns(ids, pc ? 148 : 96)}">${ids.map((id) => cell(id)).join('')}</div>`;
  // 더보기 (C.63c → C.66): 시트 대신 독 옆(가로 폰 = 레일 오른쪽 세로 줄, 세로 태블릿 = 독 위 한 줄)으로 펼침, 배경을 막지 않음
  const row = vm.more ? dockMoreRow(vm, items) : '';
  return `<nav class="nav dock-bar" aria-label="주요 메뉴">${row}${bar(DOCK_PHONE, false)}${bar(DOCK_PC, true)}</nav>`;
}

/** 더보기 펼침 줄 (C.63c): 폰 독에 없는 칸 + 인박스, 가로 스크롤 · 스냅 · 처음/끝 흐림. 칸을 고르거나 [더보기]·바깥을 누르면 접힘 */
function dockMoreRow(vm: DockVM, items: Record<string, DockItem>): string {
  const ids = (['inbox', 'world', 'deck', 'tactics', 'settings', 'saves'] as const).filter((id) => id === 'inbox' || !DOCK_PHONE.includes(id));
  const all: Record<string, DockItem> = { ...items, inbox: { label: '인박스', icon: 'bell', act: 'go', data: { to: 'inbox' }, on: vm.screen === 'inbox', ...(vm.inbox ? { badge: vm.inbox } : {}) } };
  const cells = ids.map((id) => {
    const it = all[id]!;
    return `<button type="button" class="${cx('po-dock__item', 'dock-more__item', it.on && 'is-on', it.lock && 'is-locked')}" data-act="${esc(it.act)}"${Object.entries(it.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}${it.lock ? ' disabled' : ''}><span class="po-dock__icon">${
      Icon({ name: it.icon, size: 22, strokeWidth: it.on ? 2.4 : 2 })}${it.lock ? `<span class="po-dock__lock">${Icon({ name: 'lock', size: 10, strokeWidth: 2.6 })}</span>` : it.badge ? `<b class="po-dock__badge po-num">${it.badge}</b>` : ''}</span><span class="po-dock__label">${esc(it.label)}</span></button>`;
  }).join('');
  return `<div class="dock-more" role="menu" aria-label="더보기"><div class="dock-more__scroll at-start">${cells}</div></div>`;
}

/** 모바일 더보기 시트: 독에 없는 칸 (C.50: 월드 추가, C.54: DOCK_PHONE 에 있는 칸은 뺀다) */
export function dockMoreSheet(tacticsOpen: boolean): string {
  return BottomSheet({
    eyebrow: '더보기', title: '메뉴', onClose: { act: 'sheet-close' },
    children: [
      DOCK_PHONE.includes('world') ? '' : OptionRow({ act: 'go-tab', data: { v: 'world' }, icon: 'world', title: '월드', desc: '순위표·득점 순위·이적 소식' }),
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
    : '<p class="muted small">아직 남은 경기 기록이 없어요.</p>';
  const rows = vm.rows.map((r) => `<div class="mlog">
      <div class="kv"><b class="small">${r.round}R ${esc(r.opp)} <small class="muted">${r.venue}</small></b>
        <span class="small"><b class="po-num ${r.outcome === 'win' ? 'up' : r.outcome === 'loss' ? 'down' : ''}">${esc(r.score)}</b> · 평점 <b class="po-num">${esc(r.rating)}</b></span></div>
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
