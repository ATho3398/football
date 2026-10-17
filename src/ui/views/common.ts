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
 * 하단 독 (C.44 pending 47 5번, C.50 pending 82 5번): 모든 화면 아래 고정. 홈은 모바일·PC 모두 가운데 칸, 강조색 원형으로 크게.
 * 좌우 대칭: 바로 옆 = 진행 · 훈련·일정(하루 일), 그다음 = 선수 · 월드(정보), 바깥 = 전술 · 설정, 덱 · 저장.
 * 모바일 = 5칸(선수·진행·홈·훈련·일정·더보기 — 월드 자리에 더보기), PC = 9칸 전부
 */
export interface DockVM {
  screen: string;
  /** 진행 칸: 지금 누르면 하는 일 */
  prog: { label: string; icon: IconName; act: string; data?: Record<string, string>; live?: boolean };
  tacticsOpen: boolean;
  /** 남은 포인트 (선수 칸 배지) */
  points: number;
  more: boolean;
}

type DockItem = { id: string; label: string; icon: IconName; act: string; data?: Record<string, string>; on?: boolean; cls?: string; badge?: number; lock?: boolean };

export function dock(vm: DockVM): string {
  const s = vm.screen;
  const items: DockItem[] = [
    { id: 'deck', label: '덱', icon: 'combo', act: 'go-tab', data: { v: 'deck' }, on: s === 'deck', cls: 'dock-pc' },
    { id: 'tactics', label: '전술', icon: 'tactic', act: 'tac-open', on: s === 'tactics', cls: 'dock-pc', lock: !vm.tacticsOpen },
    { id: 'player', label: '선수', icon: 'player', act: 'go-tab', data: { v: 'player' }, on: s === 'player' || s === 'allocate', ...(vm.points ? { badge: vm.points } : {}) },
    { id: 'prog', label: vm.prog.label, icon: vm.prog.icon, act: vm.prog.act, ...(vm.prog.data ? { data: vm.prog.data } : {}), cls: `dock-prog${vm.prog.live ? ' is-live' : ''}` },
    { id: 'home', label: '홈', icon: 'home', act: 'go-tab', data: { v: 'home' }, on: s === 'home', cls: 'dock-home' },
    { id: 'schedule', label: '훈련·일정', icon: 'calendar', act: 'go-tab', data: { v: 'schedule' }, on: s === 'schedule' },
    { id: 'world', label: '월드', icon: 'world', act: 'go-tab', data: { v: 'world' }, on: s === 'world', cls: 'dock-pc' },
    { id: 'more', label: '더보기', icon: 'filter', act: 'dock-more', on: vm.more || ['deck', 'tactics', 'world', 'settings', 'saves'].includes(s), cls: 'dock-m' },
    { id: 'settings', label: '설정', icon: 'settings', act: 'go-tab', data: { v: 'settings' }, on: s === 'settings', cls: 'dock-pc' },
    { id: 'saves', label: '저장', icon: 'disk', act: 'go-tab', data: { v: 'saves' }, on: s === 'saves', cls: 'dock-pc' },
  ];
  const btn = (it: DockItem) => `<button type="button" class="${cx('dock-btn', it.on && 'is-on', it.cls, it.lock && 'is-lock')}" data-act="${it.act}"${
    Object.entries(it.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}${it.on ? ' aria-current="page"' : ''}>${Icon({ name: it.lock ? 'lock' : it.icon, size: 22, strokeWidth: it.on ? 2.4 : 2 })}<span>${esc(it.label)}</span>${
    it.badge ? `<span class="po-dotbadge po-num">${it.badge}</span>` : ''}</button>`;
  return `<nav class="nav dock-bar" aria-label="주요 메뉴">${items.map(btn).join('')}</nav>`;
}

/** 모바일 더보기 시트: 독에 없는 칸 (C.50: 월드 추가) */
export function dockMoreSheet(tacticsOpen: boolean): string {
  return BottomSheet({
    eyebrow: '더보기', title: '메뉴', onClose: { act: 'sheet-close' },
    children: [
      OptionRow({ act: 'go-tab', data: { v: 'world' }, icon: 'world', title: '월드', desc: '순위표·득점 순위·이적 소식' }),
      OptionRow({ act: 'go-tab', data: { v: 'deck' }, icon: 'combo', title: '덱', desc: '카드 덱 편집·선택권' }),
      OptionRow({ act: 'tac-open', icon: tacticsOpen ? 'tactic' : 'lock', title: '전술', desc: tacticsOpen ? '포메이션·성향·내 위치' : '3경기 뒤에 열려요', disabled: !tacticsOpen }),
      OptionRow({ act: 'go-tab', data: { v: 'settings' }, icon: 'settings', title: '설정', desc: '경기 진행·보기·페이스온' }),
      OptionRow({ act: 'go-tab', data: { v: 'saves' }, icon: 'disk', title: '저장', desc: '수동 저장·불러오기·파일' }),
    ].join(''),
  });
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

/** 경기 화면 [보기] 버튼 (부록 C.43): 누르면 얼굴/등번호/캐릭터 시트 */
export function pitchViewButton(): string {
  return `<button type="button" class="pv-btn" data-act="pv-open" aria-label="선수 표시 바꾸기">보기 · ${PITCH_VIEW_KO[pitchView()]}</button>`;
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
      <div class="kv"><span>방향</span></div>${Tabs({ items: (['auto', 'landscape', 'portrait'] as const).map((k) => ({ id: k, label: PITCH_ORIENT_KO[k] })), value: pitchOrient(), act: 'po-orient', fill: true, label: '경기 화면 방향' })}
      <div class="kv"><span>선수 크기</span></div>${Tabs({ items: (['normal', 'large', 'xlarge'] as const).map((k) => ({ id: k, label: PITCH_SIZE_KO[k] })), value: pitchSize(), act: 'po-size', fill: true, label: '선수 크기' })}
      <div class="kv"><span>이름 표시</span></div>${Tabs({ items: (['all', 'mine', 'off'] as const).map((k) => ({ id: k, label: PITCH_NAMES_KO[k] })), value: pitchNames(), act: 'po-names', fill: true, label: '이름 표시' })}`,
  });
}
