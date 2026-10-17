// 이적·계약 화면 (18.10, 부록 C.42): 홈 알림 카드, 이적 제안, 재계약, 선수 화면 계약·이적 요청, 월드 이적 소식.
// 인박스(5-2)가 아직 없어 제안은 홈 알림 카드로 알린다. 카드·박스는 C.39 바둑판(.ag-cell)·GameCard 톤

import { Avatar, Button, Crest, HeroPanel, OptionRow, SectionTitle, esc } from '../components';
import type { MarketVM, NewsVM, OfferVM } from '../transferVM';
import { actionRow, panel } from './common';

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

/** 홈 알림 카드: 응답이 필요한 제안·재계약, 또는 방금 바뀐 팀 알림 */
export function marketCard(vm: MarketVM): string {
  const out: string[] = [];
  if (vm.renewal) {
    out.push(`<div class="panel advice-card tr-card" role="status">
      <div class="advice-head"><span class="advice-eyebrow">계약 만료 · 응답 필요</span></div>
      <b class="advice-title">${esc(vm.contract.team)}와의 계약이 끝났어요</b>
      <p class="small">재계약(연장)하거나, FA로 다른 팀 제안 중 하나를 골라요. 답하기 전에는 다음 시즌으로 넘어가지 않아요.</p>
      ${actionRow(
        Button({ variant: 'secondary', size: 'sm', block: true, act: 'go', data: { to: 'offers' }, children: vm.offers ? `제안 ${vm.offers.length}개 보기` : '제안 없음', disabled: !vm.offers }),
        Button({ size: 'sm', block: true, act: 'go', data: { to: 'contract' }, children: '재계약' }),
      )}
    </div>`);
  } else if (vm.offers?.length || vm.refused.length) {
    const offers = vm.offers ?? [];
    const best = [...offers].sort((a, b) => b.rating - a.rating)[0];
    out.push(best
      ? `<div class="panel advice-card tr-card" role="status">
      <div class="advice-head"><span class="advice-eyebrow">${esc(vm.window)} · 응답 필요</span></div>
      <b class="advice-title">이적 제안 ${offers.length}개가 왔어요</b>
      <p class="small">가장 강한 팀 ${esc(best.team)} (전력 ${best.rating}). 수락하거나 거절해야 [계속]으로 넘어가요.</p>
      ${refusedLines(vm)}
      ${Button({ size: 'sm', block: true, act: 'go', data: { to: 'offers' }, children: '제안 보기' })}
    </div>`
      : `<div class="panel advice-card advice-news" role="status">
      <div class="advice-head"><span class="advice-eyebrow">${esc(vm.window)} · 이적 소식</span><button type="button" class="advice-x" data-act="market-refused-close" aria-label="닫기">×</button></div>
      <b class="advice-title">구단이 이적 제안을 거절했어요</b>
      ${refusedLines(vm)}
    </div>`);
  }
  if (vm.notice) {
    out.push(`<div class="panel advice-card advice-news" role="status">
      <div class="advice-head"><span class="advice-eyebrow">이적</span><button type="button" class="advice-x" data-act="market-notice-close" aria-label="닫기">×</button></div>
      <b class="advice-title">${esc(vm.notice)}</b>
      <p class="small muted">전술은 새 팀 기본값으로 바뀌었어요. 숙련도·적성·덱은 그대로예요.</p>
    </div>`);
  }
  return out.join('');
}

/** 소속 구단이 거절한 제안 뉴스 (C.48) */
function refusedLines(vm: MarketVM): string {
  return vm.refused.map((t) => `<p class="small tr-refused">📰 ${esc(t)}</p>`).join('');
}

function offerCard(o: OfferVM): string {
  const cells = [
    { k: '팀 전력', v: `${o.rating}`, s: `리그 ${o.rank}위 · ${signed(o.diff)}` },
    { k: '예상 출전', v: o.start, s: `선발 ${o.startPct}%` },
    { k: o.loan ? '임대' : '계약', v: o.loan ? '1시즌' : `${o.years}년`, s: o.loan ? '끝나면 복귀' : o.fee ? `이적료 ${o.fee}` : '자유계약' },
    { k: '주급', v: o.wage, s: `연 ${o.annual}` },
  ];
  return `<div class="panel tr-offer${o.loan ? ' is-loan' : ''}">
    <div class="tr-offer-head">${Crest({ name: o.team, team: o.teamId, size: 28 })}<b class="grow">${o.league ? `<button type="button" class="dt-link" data-act="team-open" data-v="${esc(o.teamId)}">${esc(o.team)} ›</button>` : esc(o.team)}</b><span class="po-chip fin-tier">${esc(o.tier)}</span>${o.loan ? '<span class="po-chip">임대</span>' : ''}${o.youth ? '<span class="po-chip">친정 · 유스 구단</span>' : ''}</div>
    <div class="ag-grid tr-grid">${cells.map((c) => `<div class="ag-cell"><span class="ag-name">${esc(c.k)}</span><b class="ag-v po-num">${esc(c.v)}</b><span class="ag-cost">${esc(c.s)}</span></div>`).join('')}</div>
    ${actionRow(
      Button({ variant: 'secondary', size: 'sm', block: true, act: 'offer-decline', data: { i: String(o.i) }, disabled: !!o.lastFree, children: '거절' }),
      Button({ size: 'sm', block: true, act: 'offer-accept', data: { i: String(o.i) }, children: o.loan ? '임대 수락' : '수락' }),
    )}
  </div>`;
}

/** 이적 제안 화면 */
export function offersView(vm: MarketVM): string {
  const hero = HeroPanel({
    title: '이적 제안', back: { act: 'go', data: { to: 'home' } }, eyebrow: vm.window, value: vm.offers ? `${vm.offers.length}개` : '없음', pad: false, progress: false,
    chips: [`지금 ${vm.team} · 전력 ${vm.rating}`, { label: `내 OVR ${vm.ovr}`, soft: true }, { label: `내 몸값 ${vm.value}`, soft: true }],
  });
  const list = vm.offers?.length
    ? vm.offers.map(offerCard).join('')
    : `<p class="muted">남은 제안이 없어요.</p>`;
  const renew = vm.renewal
    ? panel(`<p class="small"><b>계약이 끝났어요.</b> 제안을 수락하면 FA 이적이에요. 모두 거절하면 재계약해야 해요.</p>
        ${Button({ variant: 'secondary', size: 'sm', block: true, act: 'go', data: { to: 'contract' }, children: '재계약 보기' })}`)
    : '';
  return `${hero}<div class="body">
    ${renew}
    ${SectionTitle({ title: '받은 제안', action: '전력 · 예상 출전 · 계약 · 주급' })}
    <p class="small muted">${esc(vm.tierNote)}</p>
    ${vm.refused.length ? panel(`${refusedLines(vm)}<p class="small muted">구단이 거절한 제안은 고를 수 없어요. 바이아웃(${esc(vm.contract.buyout)}) 이상 제안은 구단이 거절하지 못해요.</p>`) : ''}
    ${list}
    <p class="small muted">연봉은 위상과 OVR로 계산해 보여 주기만 해요. 제안은 내 몸값과 연봉을 감당할 수 있는 구단만 보내고, 연봉은 그 구단 연봉 여력 안이에요. 약팀(전력 3 이상 낮은 팀)으로 이적하면 위상이 조금 깎여요.</p>
    ${vm.free && vm.offers?.length ? '<p class="small"><b>자유계약 신분이에요.</b> 제안 하나를 골라야 시즌을 이어 갈 수 있어요.</p>' : ''}
    ${vm.offers?.length && !vm.free ? Button({ variant: 'ghost', block: true, act: 'offers-decline', children: '모두 거절' }) : Button({ block: true, act: 'go', data: { to: 'home' }, children: '홈으로' })}
  </div>`;
}

/** 재계약 화면 */
export function contractView(vm: MarketVM, years: number | null): string {
  const r = vm.renewal;
  const hero = HeroPanel({
    // 디자인 100 (C.54): 글자 머리말(48px 한 줄, 넘치면 말줄임) + eyebrow "팀 · 시즌까지" — 머리말이 제목·뒤로 가기와 겹치던 넘침 버그 해결
    title: '재계약', back: { act: 'go', data: { to: 'home' } }, eyebrow: `${vm.contract.team} · ${vm.contract.until}`, value: r ? '계약 만료' : '계약 중', pad: false, progress: false,
    chips: [`주급 ${vm.contract.wage}`],
  });
  if (!r) return `${hero}<div class="body">${panel(`<p class="muted">재계약할 계약이 없어요. ${esc(vm.contract.until)}.</p>`)}</div>`;
  const sel = years ?? r.years[Math.floor(r.years.length / 2)]!;
  return `${hero}<div class="body">
    ${SectionTitle({ title: '연장', action: `주급 ${r.wage} · 연 ${r.annual}` })}
    <div class="opts">${r.years.map((y) => OptionRow({ act: 'renew-years', data: { v: String(y) }, radio: true, selected: y === sel, title: `${y}년`, desc: `${esc(vm.contract.team)}에서 ${y}시즌 더` })).join('')}</div>
    ${Button({ size: 'lg', block: true, act: 'renew', data: { v: String(sel) }, children: `${sel}년 재계약` })}
    ${SectionTitle({ title: 'FA 이적' })}
    ${panel(`<p class="small">재계약하지 않고 다른 팀 제안 중 하나를 수락해요.</p>
      ${Button({ variant: 'secondary', block: true, act: 'go', data: { to: 'offers' }, disabled: !vm.offers, children: vm.offers ? `제안 ${vm.offers.length}개 보기` : '남은 제안 없음' })}`)}
  </div>`;
}

/** 선수 화면: 계약과 이적 요청 */
export function contractSection(vm: MarketVM): string {
  const c = vm.contract;
  const req = vm.request;
  return `${SectionTitle({ title: '계약과 이적', action: c.until })}
    ${panel(`
      <div class="ag-grid tr-grid">
        <div class="ag-cell"><span class="ag-name">소속</span><b class="ag-v">${esc(c.team)}</b><span class="ag-cost">남은 ${c.yearsLeft}시즌</span></div>
        <div class="ag-cell"><span class="ag-name">주급</span><b class="ag-v po-num">${esc(c.wage)}</b><span class="ag-cost">연 ${esc(c.annual)}</span></div>
        <div class="ag-cell"><span class="ag-name">팀 전력</span><b class="ag-v po-num">${vm.rating}</b><span class="ag-cost">재정 ${esc(vm.tier)} · 내 OVR ${vm.ovr}</span></div>
        <div class="ag-cell"><span class="ag-name">몸값</span><b class="ag-v po-num">${esc(vm.value)}</b><span class="ag-cost">남은 ${c.yearsLeft}시즌 기준 · 바이아웃 ${esc(c.buyout)}</span></div>
      </div>
      ${c.loan ? `<p class="small">${esc(c.loan)}</p>` : ''}
      ${req.status ? `<p class="small"><b>${esc(req.status)}</b></p>` : ''}
      <div class="kv"><span class="small ${req.ok ? '' : 'muted'}">${esc(req.reason)}${req.chance !== null ? ` · 구단이 놓아줄 확률 ${req.chance}%` : ''}</span>
        ${Button({ size: 'sm', variant: req.ok ? 'primary' : 'secondary', act: 'transfer-request', disabled: !req.ok, children: '이적 요청' })}</div>
      ${vm.moves.length ? `<p class="small muted">커리어 이적: ${vm.moves.map((m) => `${esc(m.season)} ${esc(m.text)}`).join(' · ')}</p>` : ''}
      <span class="muted small">연봉은 계산해 보여 주기만 해요(돈은 재정 단계). 이적 요청은 선발·출전 시간이 부족하거나 위상이 팀 수준을 넘을 때 할 수 있어요(감독 신뢰도가 생기면 바뀌어요).</span>`)}`;
}

/** 월드 "이적 소식" */
export function newsSection(vm: NewsVM | null): string {
  if (!vm) return '<p class="small muted">아직 이적시장이 열리지 않았어요. 겨울(1월)과 여름(비시즌)에 선수들이 움직여요.</p>';
  const row = (r: NewsVM['rows'][number]) => `<${r.open ? `button type="button" data-act="person-open" data-v="${esc(r.open)}"` : 'div'} class="star-row tr-news${r.mine ? ' is-mine' : ''}">${Avatar({ size: 36, face: { id: r.id, age: r.age }, name: r.name })}
    <span class="grow"><b>${esc(r.name)}</b>${r.real ? ' <span class="po-chip">실제</span>' : ''}<small>${esc(r.pos)} · ${r.age}세 · OVR ${r.ovr} · ${esc(r.why)}</small>
    <small>${esc(r.from)} → <b>${esc(r.to)}</b> <span class="muted">(${esc(r.toTier)})</span> · 몸값 ${esc(r.fee)}${r.fill ? ` · 빈자리 ${esc(r.fill)}` : ''}</small></span></${r.open ? 'button' : 'div'}>`;
  return `${SectionTitle({ title: vm.title, action: `${vm.count}명 · 리그 안 ${vm.inLeague}` })}
    <div class="star-list">${vm.rows.map(row).join('')}</div>
    <p class="small muted">팀 전력은 로스터 라인업 평균이라 이적이 바로 반영돼요. 겨울 이적은 시즌 중 전력에도 반영돼요. 구단은 남은 영입 예산·연봉 여력 안에서만 영입해요(괄호 = 재정 등급, 계약이 끝난 선수는 몸값 0).</p>`;
}
