// 화면 공통 조각: 패널, 하단 탭, 버전 표시, 배너 목록. 컴포넌트(src/ui/components)만 조합한다

import { Banner, Button, esc, SectionTitle, StatChip, Tabs, type TabItem } from '../components';
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

/** 하단 탭 (I.1): 구현된 탭만 (홈, 선수, 월드). 경기·커리어 탭은 숨긴다 */
export const NAV_ITEMS: TabItem[] = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'player', label: '선수', icon: 'player' },
  { id: 'world', label: '월드', icon: 'world' },
];

export function navBar(value: string): string {
  return `<nav class="nav">${Tabs({ items: NAV_ITEMS, value, variant: 'nav', act: 'go-tab' })}</nav>`;
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
