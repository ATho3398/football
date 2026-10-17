// 선수 (I.8, 디자인 44 → C.58 디자인 93~96·134~136, B 미페 머리말 compact): 머리말 · 프로필 줄 · 탭 5개(능력치 · 몸·태그 · 포지션 · 기록 · 계약).
// 성향 슬라이더·역할(전술 화면 링크)은 아직 없는 기능이라 숨긴다 (I.19)

import { Avatar, Button, Crest, esc, FinChip, HeroPanel, Meter, OptionRow, SectionTitle, Tabs, TierBadge } from '../components';
import { heroFaceOf } from '../faces';
import { skin } from '../skin';
import type { MarketVM } from '../transferVM';
import { attrGrid } from './attrGrid';
import type { HistoryRowVM, PlayerVM } from '../viewModels';
import { panel, seasonMatchesSection } from './common';

export type PlayerTab = 'attrs' | 'body' | 'pos' | 'record' | 'contract';
export const PLAYER_TABS: { id: PlayerTab; label: string }[] = [
  { id: 'attrs', label: '능력치' }, { id: 'body', label: '몸·태그' }, { id: 'pos', label: '포지션' }, { id: 'record', label: '기록' }, { id: 'contract', label: '계약' },
];

export function historyTable(rows: HistoryRowVM[]): string {
  if (!rows.length) return '<p class="muted small">아직 끝난 시즌이 없어요. 시즌이 끝나면 여기에 한 줄씩 쌓여요.</p>';
  return `<div class="table-wrap"><table class="tbl">
    <tr><th>시즌</th><th>나이</th><th>OVR</th><th>경기</th><th>골</th><th>도움</th><th>평점</th><th>순위</th></tr>
    ${rows.map((r) => `<tr><td>${r.season}</td><td>${r.age}</td><td>${r.ovr}</td><td>${r.apps}</td><td>${r.goals}</td><td>${r.assists}</td><td>${r.avg}</td><td>${r.pos}</td></tr>`).join('')}
  </table></div>`;
}

/** 경고 누적 칸 (디자인 44): 쌓인 옐로는 노란 칸 */
function yellowPips(n: number, every: number): string {
  return Array.from({ length: every }, (_, i) => `<i class="pip${i < n ? ' on' : ''}"></i>`).join('');
}

/** 미페 머리말을 쓰는지 (C.58, 홈 C.57과 같은 규칙): B 테마 + 폰 폭 + 내 선수 사진이 있을 때 */
export function playerFace(vm: PlayerVM): { src: string; cutout: boolean } | null {
  if (skin() !== 'b' || globalThis.matchMedia?.('(min-width: 1024px)').matches) return null;
  return heroFaceOf(vm.face);
}

export interface PlayerParts {
  tab: PlayerTab;
  /** 몸·태그 탭 본문 (body.ts bodySection) */
  body: string;
  /** 계약 탭 본문 (은퇴하면 null) */
  market: MarketVM | null;
  /** 찍을 포인트 (능력치 탭 [nP 찍기]) */
  points: number;
  retired: boolean;
}

export function playerView(vm: PlayerVM, parts: PlayerParts): string {
  const c = vm.condition;
  const chips = [`위상 ${vm.tierName} · ${vm.reputation}점`, `폼 ${['최악', '나쁨', '보통', '좋음', '최고'][c.form - 1]}`, { label: `옐로 ${c.yellows}/${c.yellowEvery}`, soft: true }];
  const face = playerFace(vm);
  // 디자인 B 93·134·136: 사진이 있으면 compact 미페 머리말(290px), 없으면 compact 머리말(디자인 A 93)
  const hero = face
    ? HeroPanel({ title: '선수', back: false, compact: true, face: face.src, cutout: face.cutout, kit: vm.kit, name: vm.name, eyebrow: `${vm.team} · ${vm.position} · ${vm.age}세`, value: vm.ovr, unit: 'OVR', chips })
    : HeroPanel({ title: '선수', right: vm.team, back: false, compact: true, eyebrow: `${vm.name} · ${vm.position} · ${vm.age}세 · OVR`, value: vm.ovr, pad: false, progress: false, chips });
  // 프로필 줄 (디자인 93): 얼굴 · 위상 배지 + 다음 티어까지 · 레벨 막대 · [꾸미기](몸·태그 탭의 "내 모습")
  const repNote = vm.next ? `${vm.next.name}까지 ${vm.next.cut - vm.reputation}점` : vm.isLegendary ? '최고 위상' : '레전더리는 업적 조건';
  const profile = `<div class="panel profile-row pl-profile">${Avatar({ size: 56, face: vm.face, name: vm.name, ring: true })}<div class="grow">
      <span class="pl-tier">${TierBadge({ tier: vm.tier, score: vm.reputation, size: 'sm' })}<small>${esc(repNote)}</small></span>
      <span class="pl-lv"><small>Lv ${vm.level}</small><span class="pl-lv__bar" aria-hidden="true"><i style="width:${Math.round((vm.xp / Math.max(1, vm.xpMax)) * 100)}%"></i></span><small class="po-num">${vm.xp}/${vm.xpMax}</small></span>
    </div>${Button({ variant: 'secondary', size: 'sm', icon: 'edit', act: 'player-tab', data: { v: 'body', look: '1' }, children: '꾸미기' })}</div>`;
  const tabs = Tabs({ items: PLAYER_TABS, value: parts.tab, variant: 'underline', fill: true, act: 'player-tab', label: '선수' });
  let body: string;
  if (parts.tab === 'attrs') body = attrsTab(vm, parts);
  else if (parts.tab === 'body') body = parts.body;
  else if (parts.tab === 'pos') body = posTab(vm);
  else if (parts.tab === 'record') body = recordTab(vm);
  else body = parts.market ? contractSection(parts.market) : '<p class="small muted">은퇴한 선수는 계약이 없어요.</p>';
  return `${hero}<div class="body pl-body">${profile}${tabs}${body}</div>`;
}

/** 능력치 탭 (디자인 93): 안내 줄 + [nP 찍기] · 범례 · 묶음 7개 4열 */
function attrsTab(vm: PlayerVM, parts: PlayerParts): string {
  const alloc = !parts.retired && parts.points > 0
    ? Button({ size: 'sm', icon: 'plus', act: 'go', data: { to: 'allocate' }, children: `${parts.points}P 찍기` })
    : '';
  return `<div class="pl-head"><span class="small"><b>1~20</b> · 이번 시즌 변화 표시</span>${alloc}</div>
    ${attrGrid(vm.attrs, null, undefined, { cols: 4, legendTop: true, keyLabel: `${vm.position} 핵심` })}`;
}

/** 포지션 탭 (디자인 94): 포지션별 OVR · 숙련도 4열 → 레전더리 조건 → 레전드 배지 */
function posTab(vm: PlayerVM): string {
  const legend = `<div class="opts">${vm.legendary.map((l, i) => OptionRow({
    icon: l.met ? 'star' : 'lock', title: `${i === 0 ? '' : i === 1 ? '그리고 ' : '또는 '}${l.label}`,
    desc: l.locked ? '아직 열리지 않은 대회예요' : l.met ? '달성' : '진행 중',
    right: `<b class="po-num small${l.met ? ' hi' : ' muted'}">${l.met ? '달성' : l.locked ? '잠김' : '미달성'}</b>`, disabled: !l.met,
  })).join('')}</div>`;
  return `${SectionTitle({ title: '포지션별 OVR · 숙련도', action: `주 포지션 ${vm.position}` })}
    <div class="pl-pos">${vm.posOvrs.map((p) => `<div class="pl-pos__cell${p.main ? ' is-main' : ''}"><span>${p.pos}</span><b class="po-num">${p.ovr}</b><small class="prof" aria-hidden="true"><i style="width:${p.prof}%"></i></small><em class="po-num">숙련 ${p.prof}</em></div>`).join('')}</div>
    <p class="muted small">숙련도가 100보다 낮으면 그 포지션 OVR이 낮아져요 (가까우면 최대 −6, 두 칸 −10, 더 멀면 −14). 처음 20경기는 천천히, 그 뒤로는 경기마다 올라요. 5경기 넘게 안 뛰면 조금씩 떨어지고(100을 찍었으면 10경기), 주 포지션은 떨어지지 않아요.</p>
    ${SectionTitle({ title: '레전더리 조건', action: vm.isLegendary ? '달성' : '잠김 · 한 번 달면 영구' })}
    ${legend}
    <span class="muted small">레전더리 = 위상 월드클래스 + 발롱도르 1회 이상 그리고 (트레블 또는 월드컵 우승 또는 발롱도르 3회 이상).</span>
    ${SectionTitle({ title: '레전드 배지', action: `${vm.badges.filter((b) => b.earned).length}/${vm.badges.length}` })}
    <div class="opts">${vm.badges.map((b) => OptionRow({ icon: b.earned ? 'star' : 'lock', title: b.name, desc: b.earned ? `${b.desc} · ${b.earned}` : b.desc, right: `<b class="po-num small${b.earned ? ' hi' : ' muted'}">${b.earned ? '획득' : esc(b.progress)}</b>`, disabled: !b.earned })).join('')}</div>`;
}

/** 기록 탭 (디자인 95): 시즌 합계 · 경기별 · 경고와 출장 · 위상과 레벨 · 시즌별 */
function recordTab(vm: PlayerVM): string {
  const c = vm.condition;
  const ban = vm.suspended > 0
    ? `<div class="ban-row"><i class="redcard"></i><span class="grow"><b>출장 정지 ${vm.suspended}경기 남음</b></span>${vm.nextOpp ? `<span class="fail small">${esc(vm.nextOpp)}전 결장</span>` : ''}</div>`
    : '';
  const rep = vm.next
    ? Meter({ value: vm.reputation - vm.next.from, max: vm.next.cut - vm.next.from, label: `${vm.next.name}까지 ${vm.next.cut - vm.reputation}점`, showValue: true, tone: 'brand' })
    : `<p class="muted small">${vm.isLegendary ? '최고 위상 티어예요.' : '월드클래스예요. 레전더리는 점수가 아니라 포지션 탭의 업적 조건으로 열려요.'}</p>`;
  return `${seasonMatchesSection(vm.matches)}
    ${SectionTitle({ title: '경고와 출장' })}
    ${panel(`
      <div class="kv"><b>경고 누적</b><span class="pips">${yellowPips(c.yellows, c.yellowEvery)}<b class="po-num">${c.yellows}/${c.yellowEvery}</b></span></div>
      <span class="muted small">옐로카드 ${c.yellowEvery}장이 쌓이면 다음 1경기에 나올 수 없어요.</span>
      ${ban}`)}
    ${SectionTitle({ title: '위상과 레벨', action: `누적 XP ${vm.totalXp}` })}
    ${panel(`${rep}${Meter({ value: vm.xp, max: vm.xpMax, label: `Lv ${vm.level} → ${vm.level + 1}`, showValue: true, tone: 'xp' })}`)}
    ${SectionTitle({ title: '시즌별' })}
    ${panel(historyTable(vm.history))}`;
}

/** 계약 탭 (디자인 136): 소속·주급·몸값·바이아웃 4칸 → 재정 등급 → 이적 요청(조건 미달 = 이유 줄 + 잠긴 버튼) */
export function contractSection(vm: MarketVM): string {
  const c = vm.contract;
  const req = vm.request;
  const reasons = req.ok ? [] : req.reason.split(' · ').filter(Boolean);
  const reqBox = req.status
    ? `<div class="panel pl-req"><b>${esc(req.status)}</b></div>`
    : req.ok
      ? `<div class="panel pl-req"><b>지금 요청할 수 있어요</b><span class="small">${esc(req.reason)}${req.chance !== null ? ` · 구단이 놓아줄 확률 ${req.chance}%` : ''}</span></div>`
      : `<div class="panel pl-req"><b>지금은 요청할 수 없어요</b>${reasons.map((r) => `<span class="small fail">✕ <span class="ink">${esc(r)}</span></span>`).join('')}</div>`;
  return `${SectionTitle({ title: '계약', action: `${c.until} · 남은 ${c.yearsLeft}시즌` })}
    <div class="pl-contract">
      <div class="pl-cc"><small>소속</small><b>${Crest({ name: c.team, size: 18 })} ${esc(c.team)}</b><span>${FinChip(vm.tier, true)} 팀 전력 ${vm.rating}</span></div>
      <div class="pl-cc"><small>주급</small><b class="po-num">${esc(c.wage)}</b><span>연 ${esc(c.annual)} · 보여 주기만 해요</span></div>
      <div class="pl-cc"><small>몸값</small><b class="po-num">${esc(vm.value)}</b><span>남은 ${c.yearsLeft}시즌 기준 · OVR·나이·위상으로 계산</span></div>
      <div class="pl-cc is-line"><small>바이아웃</small><b class="po-num">${esc(c.buyout)}</b><span>이 금액 이상 제안은 구단이 거절하지 못해요</span></div>
    </div>
    ${c.loan ? `<p class="small">${esc(c.loan)}</p>` : ''}
    ${panel(`<b class="small">재정 등급</b><span class="pl-fins">${['빅클럽', '상위', '중위', '하위'].map((t) => FinChip(t, true)).join('')}</span>
      <span class="small muted">구단이 낼 수 있는 이적료·연봉 크기예요. 막대 4칸 = 빅클럽. 몸값이 구단 여력보다 크면 그 구단은 제안하지 않아요.</span>`)}
    ${SectionTitle({ title: '이적 요청' })}
    ${reqBox}
    ${Button({ size: 'lg', block: true, variant: req.ok ? 'primary' : 'secondary', icon: req.ok ? 'swap' : 'lock', act: 'transfer-request', disabled: !req.ok, children: '이적 요청' })}
    ${vm.moves.length ? `<p class="small muted">커리어 이적: ${vm.moves.map((m) => `${esc(m.season)} ${esc(m.text)}`).join(' · ')}</p>` : ''}
    <span class="muted small">선발·출전 시간이 부족하거나 위상이 팀 수준을 넘으면 요청할 수 있어요. 연봉은 보여 주기만 해요(돈은 재정 단계).</span>`;
}

