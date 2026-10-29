// 이적·계약 화면 (18.10, 부록 C.42): 홈 알림 카드, 이적 제안, 재계약, 선수 화면 계약·이적 요청, 월드 이적 소식.
// 인박스(5-2)가 아직 없어 제안은 홈 알림 카드로 알린다. 카드·박스는 C.39 바둑판(.ag-cell)·GameCard 톤

import { ro } from '../../transfer';
import { Banner, Button, Crest, FinChip, HeroPanel, Icon, OfferCard, OptionRow, SectionTitle, TagChip, TransferRow, esc, type FinTierKo } from '../components';
import type { MarketVM, NewsVM, OfferVM } from '../transferVM';
import { actionRow, panel } from './common';
import { TAGS } from '../../tags';

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

/** OfferCard (디자인 97 · 145, C.60): 팀 이름 → 팀 상세(C.53), 재정 등급 · 이적료 · 친정 표시 · 지금과 비교 한 줄 */
function offerCard(o: OfferVM, selected: boolean, freeFee = false): string {
  const note = [o.prospect ? '유망주 계약 · 잠재력을 보고 낸 저연봉 장기 계약' : '', `전력 ${signed(o.diff)}`, o.wagePct ? `지금보다 주급 ${o.wagePct > 0 ? '+' : '−'}${Math.abs(o.wagePct)}%` : '주급 그대로', o.repLoss ? `약팀 이적 · 위상 약 −${o.repLoss}` : ''].filter(Boolean).join(' · ');
  return OfferCard({
    offer: {
      club: o.team, league: o.league ? '리그' : '리그 밖', ...(o.league ? { rank: o.rank } : {}), strength: o.rating, apps: o.start, starts: o.startPct,
      years: o.loan ? '1시즌' : `${o.years}년`, weekly: o.wage, yearly: o.annual, ...(o.loan ? { loan: true } : {}), ...(o.fee ? { fee: o.fee } : freeFee && !o.loan ? { fee: '자유계약' } : {}),
      ...(isTier(o.tier) ? { tier: o.tier } : {}), ...(o.youth ? { homeClub: '친정 · 유스 구단' } : {}), note,
    },
    selected,
    ...(o.league ? { clubAct: { act: 'team-open', data: { v: o.teamId } } } : {}),
    onReject: { act: 'offer-decline', data: { i: String(o.i) } }, onAccept: { act: 'offer-accept', data: { i: String(o.i) } },
    rejectDisabled: !!o.lastFree, acceptLabel: o.loan ? '임대 수락' : '수락',
  });
}

const isTier = (t: string): t is FinTierKo => ['빅클럽', '상위', '중위', '하위'].includes(t);

/** 접힌 제안 한 줄 (디자인 97): 누르면 그 제안만 OfferCard로 펼친다 */
function offerRow(o: OfferVM): string {
  return `<button type="button" class="panel tr-row" data-act="offer-sel" data-v="${o.i}">${Crest({ name: o.team, team: o.teamId, size: 28 })}
    <span class="grow"><b>${esc(o.team)}</b><small>${o.league ? `리그 ${o.rank}위 · ` : ''}전력 ${o.rating} <span class="${o.diff < 0 ? 'down' : 'up'}">${signed(o.diff)}</span></small></span>
    ${o.loan ? '<span class="po-chip tr-loan">임대</span>' : ''}<span class="tr-row__r"><b class="po-num">${o.startPct}%</b><small>선발 · ${o.loan ? '임대 1시즌' : `${o.years}년`}</small></span>${Icon({ name: 'chevron-down', size: 18 })}</button>`;
}

const STATE_HEAD = {
  remain: (vm: MarketVM) => `${vm.tierNote}. 이적료는 구단끼리 내요.`,
  expired: () => '계약이 끝났어요. 수락하면 FA 이적(이적료 없음), 모두 거절하면 재계약해요.',
  free: () => '소속팀이 없어요. 스탯에 맞는 팀들이 영입 제안을 보냈어요. 이적료 없이 바로 옮겨요(자유계약).',
} as const;

/** 이적 제안 화면 (디자인 97 · 99 · 145, C.60): 상태 줄 → 구단 거절 소식 → 받은 제안(골라 펼침) → 모두 거절 */
export function offersView(vm: MarketVM, sel = 0): string {
  const offers = vm.offers ?? [];
  const hero = HeroPanel({
    title: '이적 제안', back: { act: 'go', data: { to: 'home' } }, eyebrow: `${vm.window} · 받은 제안`, value: offers.length ? `${offers.length}개` : '없음', pad: false, progress: false,
    // 디자인 179 (C.72): 소속팀 없음 = "소속팀 없음 · 자유계약" 칩 + 내 OVR
    chips: vm.free ? ['소속팀 없음 · 자유계약', { label: `내 OVR ${vm.ovr}`, soft: true }] : [`지금 ${vm.team} · 전력 ${vm.rating}`, { label: `내 OVR ${vm.ovr}`, soft: true }, { label: `내 몸값 ${vm.value}`, soft: true }],
  });
  // 소속팀 없음·계약 만료 = 이적료 자리에 "자유계약" (디자인 179)
  const freeFee = vm.state !== 'remain';
  const head = vm.winter && offers.length
    ? Banner({ tone: 'warning', title: '진행을 멈췄어요.', children: '답하기 전에는 [계속]·자동 진행이 안 돼요. 거절하면 시즌을 그대로 이어 가요.' })
    : Banner({ tone: 'info', title: STATE_HEAD[vm.state](vm) });
  const refused = vm.refused.length
    ? `<div class="panel tr-refused-box">${Icon({ name: 'lock', size: 16 })}<span class="grow">${vm.refusedOffers.map((r) => `<span class="tr-refused-line"><s>${esc(r.team)} · 이적료 ${esc(r.fee)}</s>${isTier(r.tier) ? FinChip(r.tier, true) : ''}</span>`).join('')}
      ${refusedLines(vm)}<small class="muted">구단이 거절한 제안은 고를 수 없어요. 바이아웃(${esc(vm.contract.buyout)}) 이상 제안은 구단이 거절하지 못해요.</small></span></div>`
    : '';
  // 주급이 모두 같으면 목록 위 한 줄 (디자인 97)
  const sameWage = offers.length > 1 && offers.every((o) => o.wage === offers[0]!.wage);
  const pick = offers.some((o) => o.i === sel) ? sel : offers[0]?.i ?? 0;
  // 제안이 둘 이하면 모두 펼친다 (디자인 145), 셋 이상이면 고른 것만 (97)
  const list = offers.length
    ? offers.map((o) => (offers.length <= 2 || o.i === pick ? offerCard(o, o.i === pick && offers.length > 1, freeFee) : offerRow(o))).join('')
    : `<p class="muted">남은 제안이 없어요.</p>`;
  const bottom = vm.renewal
    ? actionRow(Button({ variant: 'ghost', block: true, act: 'offers-decline', disabled: !offers.length, children: '모두 거절' }), Button({ variant: 'secondary', block: true, act: 'go', data: { to: 'contract' }, children: '재계약 보기' }))
    : offers.length && !vm.free
      ? Button({ variant: 'secondary', block: true, act: 'offers-decline', children: `모두 거절하고 ${vm.team}에 남기` })
      : !offers.length ? Button({ block: true, act: 'go', data: { to: 'home' }, children: '홈으로' }) : '';
  return `${hero}<div class="body">
    ${head}
    ${refused}
    ${SectionTitle({ title: `받은 제안 ${offers.length}개`, action: freeFee && offers.length && offers.every((o) => !o.fee) ? '모두 이적료 없음' : sameWage ? `주급은 모두 ${offers[0]!.wage} · 연 ${offers[0]!.annual}` : '등급 막대 = 구단 재정' })}
    <div class="tr-offers">${list}</div>
    ${bottom}
    <p class="small muted">제안은 내 몸값과 연봉을 감당할 수 있는 구단만 보내요. 약팀(전력 3 이상 낮은 팀)으로 가면 위상이 조금 깎여요. 연봉은 보여 주기만 해요.</p>
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
    ${r.prospect ? '<p class="small muted">유망주 계약 · 잠재력을 보고 낸 저연봉 장기 계약</p>' : ''}
    <div class="opts">${r.years.map((y) => OptionRow({ act: 'renew-years', data: { v: String(y) }, radio: true, selected: y === sel, title: `${y}년`, desc: `${esc(vm.contract.team)}에서 ${y}시즌 더` })).join('')}</div>
    ${Button({ size: 'lg', block: true, act: 'renew', data: { v: String(sel) }, children: `${sel}년 재계약` })}
    ${SectionTitle({ title: 'FA 이적' })}
    ${panel(`<p class="small">재계약하지 않고 다른 팀 제안 중 하나를 수락해요.</p>
      ${Button({ variant: 'secondary', block: true, act: 'go', data: { to: 'offers' }, disabled: !vm.offers, children: vm.offers ? `제안 ${vm.offers.length}개 보기` : '남은 제안 없음' })}`)}
  </div>`;
}

const NEWS_PAGE = 5;

/** 월드 "이적 소식" (디자인 104 · 105 · 148, C.60): TransferRow, 리그 안 / 리그 밖 두 묶음(각 5명 + 더 보기), 빈자리 보충 줄. 줄을 누르면 선수 상세 */
export function newsSection(vm: NewsVM | null, more: Record<string, boolean> = {}): string {
  if (!vm) {
    // 디자인 180 (C.72): 아이콘 칸 + 제목 + 설명 + 다음 이적시장 칩 + [일정에서 보기]. 이적 기록이 하나도 없으면 첫 시즌 겨울 전이라 다음 = 1월 1일
    return `<div class="panel empty-state tr-empty"><span class="tr-empty__icon">${Icon({ name: 'swap', size: 22 })}</span><b>아직 이적시장이 열리지 않았어요</b><p class="small muted">겨울(1월)과 여름(비시즌)에 선수들이 움직여요. 이적시장이 열리면 여기에 소식이 쌓여요.</p>
      <span class="po-chip tr-empty__next">다음 이적시장 · 1월 1일</span>${Button({ variant: 'ghost', size: 'sm', icon: 'calendar', act: 'news-cal', children: '일정에서 보기' })}</div>`;
  }
  const row = (r: NewsVM['rows'][number]) => TransferRow({
    name: r.name, pos: r.pos, age: r.age, ovr: r.ovr, from: r.from, to: r.to, status: r.why, fee: r.fee, mine: r.mine,
    ...(isTier(r.toTier) ? { toTier: r.toTier } : {}), ...(r.open ? { act: { act: 'person-open', data: { v: r.open } } } : {}),
  }) + (r.fill ? TransferRow({ fill: true, name: r.fill.name, pos: r.fill.pos, age: r.fill.age, ovr: r.fill.ovr, from: r.fill.club }) : '');
  const group = (key: string, title: string, rows: NewsVM['rows']) => {
    if (!rows.length) return '';
    const shown = more[key] ? rows : rows.slice(0, NEWS_PAGE);
    return `<div class="tr-news-head"><b>${esc(title)}</b><small class="muted">${rows.length}명 · OVR 순</small></div>
      <div class="tr-news-list">${shown.map(row).join('')}</div>
      ${rows.length > NEWS_PAGE ? moreBtn(key, !!more[key], `${title.split(' · ')[0]} ${rows.length - NEWS_PAGE}명 더 보기`) : ''}`;
  };
  return `${SectionTitle({ title: vm.title, action: `${vm.count}명` })}
    ${group('xin', `리그 안 · ${vm.league ?? '프리미어리그'}${ro(vm.league ?? '프리미어리그')}`, vm.rows.filter((r) => r.into))}
    ${group('xout', vm.toOther ? '리그 밖 · 다른 리그·해외·하부 리그로' : '리그 밖 · 해외·하부 리그로', vm.rows.filter((r) => !r.into))}
    <p class="small muted">막대 = 도착 팀 재정 등급 · 몸값은 이적 때 값(계약이 끝난 선수는 자유계약). 시안 테두리 = 내 팀 관련. 팀 전력은 로스터 라인업 평균이라 이적이 바로 반영돼요.</p>`;
}

/** "n명 더 보기" 단추 (screens.ts moreButton 과 같은 모양 — 순환 import 를 피해 여기 둔다) */
function moreBtn(key: string, open: boolean, label: string): string {
  return Button({ variant: 'ghost', block: true, icon: open ? 'chevron-up' : 'chevron-down', act: 'more', data: { v: key }, className: 'more-btn', children: open ? '접기' : label });
}

const TAG_PAGE = 7;

/** 태그 소식 (디자인 148, C.60): 종류 칩(커리어 = 핀 · 플레이 = 별 · 스토리 = 말풍선)으로. 종류는 코드의 실제 태그 종류 */
export function tagNewsSection(rows: { season: string; name: string; team: string; tag: string }[], more: Record<string, boolean> = {}): string {
  if (!rows.length) return '';
  const shown = more.tags ? rows : rows.slice(0, TAG_PAGE);
  return `${SectionTitle({ title: '태그 소식', action: `${rows.length}건` })}
    <p class="small muted tag-news-legend">핀 = 커리어(그 구단에서만) · 별 = 플레이 · 말풍선 = 스토리(효과 없음)</p>
    ${panel(`<div class="tag-news">${shown.map((r) => `<div class="tag-news__row"><span class="grow"><b>${esc(r.name)}</b><small class="muted">${esc(r.team)} · ${esc(r.season)}</small></span>${TagChip({ name: r.tag, size: 'sm', ...tagKindOf(r.tag) })}</div>`).join('')}</div>`)}
    ${rows.length > TAG_PAGE ? moreBtn('tags', !!more.tags, `${rows.length - TAG_PAGE}건 더 보기`) : ''}`;
}

/** 태그 이름 → TagChip 종류: 원클럽맨 · 영원한 <구단> = 커리어, 그 밖은 TAGS 의 종류(스토리 / 플레이 장점·단점) */
export function tagKindOf(name: string): { kind: 'career' | 'play' | 'story'; polarity?: 'pro' | 'con' } {
  if (name === '원클럽맨' || name.startsWith('영원한 ')) return { kind: 'career' };
  const def = Object.values(TAGS).find((t) => t.ko === name);
  if (def?.kind === 'story') return { kind: 'story' };
  return { kind: 'play', polarity: def?.kind === 'con' ? 'con' : 'pro' };
}
