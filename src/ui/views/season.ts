// C.76j U8-e 화면 조각: 선수 기록 대회별(208). 뷰모델은 seasonVM
import { esc, Icon } from '../components';
import type { CompRecordVM } from '../seasonVM';

/** 208 대회별 표 (대회 · 경기 · 골 · 도움 · 평점 + 합계 줄) · 우승 횟수 3칸(우승한 대회만 라임 테두리) */
export function compRecordSection(vm: CompRecordVM): string {
  const row = (r: CompRecordVM['rows'][number]) => `<tr class="${r.total ? 'is-total' : ''}"><td class="l">${r.total ? `<b>${esc(r.name)}</b>` : `<span class="cr-comp"><span class="cr-comp__icon">${Icon({ name: r.icon, size: 16 })}</span><span class="cr-comp__t"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></span></span>`}</td><td class="po-num">${r.apps}</td><td class="po-num hi">${r.goals}</td><td class="po-num">${r.assists}</td><td class="po-num">${r.avg}</td></tr>`;
  return `<div class="cup-head"><h3 class="cup-head__t">${esc(vm.season)} 시즌 · 대회별</h3><span class="cup-head__r">${esc(vm.team)}</span></div>
    <div class="panel tbl-panel cr-panel"><table class="tbl cr-tbl"><tr><th class="l">대회</th><th>경기</th><th>골</th><th>도움</th><th>평점</th></tr>${vm.rows.map(row).join('')}</table></div>
    <div class="panel cr-wins"><div class="kv"><b class="small">${Icon({ name: 'trophy', size: 14 })} 우승 횟수</b><small class="muted">커리어 합계 ${vm.winsTotal}회</small></div>
      <div class="cr-wins__grid">${vm.wins.map((w) => `<div class="cr-win${w.n ? ' is-won' : ''}"><b class="po-num">${w.n}</b><small>${esc(w.label)}</small></div>`).join('')}</div>
      <small class="muted">우승한 대회만 라임 테두리예요. 컵 기록은 ${esc(vm.wins[1]!.label)}·챔스를 합쳐 쌓여요.</small></div>`;
}

/** 224 시즌 하이라이트 3장: 왼쪽 큰 숫자 칸 + 종류·라운드 줄 + 제목 + 한 줄 (막대 색 = 최고 라임 · 골 초록 · 위기 주황) */
export function seasonHighlightCards(list: { kind: string; label: string; text: string; card?: { big: string; unit: string; round: string; title: string; line: string } }[]): string {
  if (!list.length) return '';
  const one = (h: (typeof list)[number]) => (h.card
    ? `<div class="panel shl is-${h.kind}"><span class="shl__big"><b class="po-num">${esc(h.card.big)}</b><small>${esc(h.card.unit)}</small></span><span class="shl__body"><small class="shl__k">${esc(h.label)} <i class="po-num">${esc(h.card.round)}</i></small><b>${esc(h.card.title)}</b><span>${esc(h.card.line)}</span></span></div>`
    : `<div class="panel shl is-${h.kind}"><span class="shl__body"><small class="shl__k">${esc(h.label)}</small><b>${esc(h.text)}</b></span></div>`);
  return `<div class="cup-head"><h3 class="cup-head__t">시즌 하이라이트</h3><span class="cup-head__r">${list.length}장</span></div>
    <p class="small muted cup-head__s">최고 평점 경기 · 골 장면 · 위기 장면을 한 장씩 골라 보여 줘요.</p>${list.map(one).join('')}`;
}

/** 210 시즌 목표 결과: 머리 칩(달성 수 · XP · 카드 선택권) + 목표 줄(✓ · 현재값 · +XP · 신뢰 · 카드 +1) + 업적 줄(트로피 · 카드 +1) */
export function seasonGoalsPanel(r: { rows: { ok: boolean; source: string; tierKo: string; label: string; value: string; xp: number; trust: number }[]; awards: string[]; xp: number; picks: number }, season: string): string {
  const met = r.rows.filter((x) => x.ok).length;
  const card = '<span class="sg-card">카드 +1</span>';
  const rows = r.rows.map((x) => `<div class="sg-row${x.ok ? ' is-ok' : ''}"><span class="sg-row__icon">${Icon({ name: x.ok ? 'check' : 'close', size: 16 })}</span><span class="grow">${esc(x.source)}(${esc(x.tierKo)}) · ${esc(x.label)} <i class="po-num muted">${esc(x.value)}</i></span>${
    x.ok ? `<b class="po-num up">+${x.xp}</b>` : '<span class="small muted">실패</span>'}${x.trust ? `<small class="po-num ${x.trust > 0 ? 'up' : 'down'}">신뢰 ${x.trust > 0 ? '+' : ''}${x.trust}</small>` : ''}${x.ok && r.picks ? card : ''}</div>`).join('');
  const aw = r.awards.map((a) => `<div class="sg-row is-award"><span class="sg-row__icon">${Icon({ name: 'trophy', size: 16 })}</span><span class="grow">업적 · ${esc(a)}</span>${card}</div>`).join('');
  return `<div class="cup-head"><h3 class="cup-head__t">시즌 목표 결과</h3><span class="cup-head__r">${esc(season)} 시즌</span></div>
    <div class="panel sg-panel"><div class="sg-chips"><span class="po-chip">${met}/${r.rows.length} 달성</span>${r.xp ? `<span class="po-chip sg-xp">XP +${r.xp}</span>` : ''}${r.picks ? `<span class="sg-card sg-card--lg">카드 선택권 ${r.picks}장</span>` : ''}</div>
    ${rows}${aw}<p class="small muted">${r.rows.length ? `목표 ${met}개${r.awards.length ? ` + 업적 ${r.awards.length}개` : ''}${r.picks ? ` = 카드 선택권 ${r.picks}장` : ''}. ` : ''}감독·구단 목표 달성은 감독 신뢰도에도 더해졌어요.</p></div>`;
}

/** 211 홈 할 일 줄: 카드 선택권이 있으면 다음 경기 아래 "할 일 · 카드 고르기 · 선택권 n장 [고르기]" */
export function homeTodoRow(picks: number): string {
  if (!picks) return '';
  return `<button type="button" class="panel hm-todo" data-act="go" data-to="deck"><span class="hm-todo__icon">${Icon({ name: 'card', size: 18 })}</span><span class="grow"><small>할 일</small><b>카드 고르기 · 선택권 <em class="po-num">${picks}</em>장</b></span><span class="hm-todo__cta">고르기</span></button>`;
}

/** 211 홈 "이번 시즌 대회" 3칸: 리그 · 챔스 · 국내 컵 */
export function seasonCompsSection(list: { kind: string; name: string; value: string; sub: string; out?: boolean }[]): string {
  if (list.length < 2) return '';
  const icon = (k: string) => (k === 'league' ? 'grid' : 'trophy') as 'grid' | 'trophy';
  return `<div class="cup-head"><h3 class="cup-head__t">이번 시즌 대회</h3><span class="cup-head__r">${list.length}개</span></div>
    <div class="hm-comps" style="grid-template-columns:repeat(${list.length},minmax(0,1fr))">${list.map((c) => `<button type="button" class="hm-comp is-${c.kind}${c.out ? ' is-out' : ''}" data-act="${c.kind === 'league' ? 'go-tab' : 'world-tab'}" data-v="${c.kind === 'league' ? 'world' : 'cups'}"><small>${Icon({ name: icon(c.kind), size: 12 })}${esc(c.name)}</small><b>${esc(c.value)}</b><span>${esc(c.sub)}</span></button>`).join('')}</div>`;
}
