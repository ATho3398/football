// 경기 준비 (C.51, pending 82 3번) — 6차 디자인 156 `R6-PreMatch`.
// 상대 카드(전력 막대·전술·최근 5경기·영상 분석 힌트) → 전술 → 내 포지션(미니 피치·역할) → 덱 세트 → 내 상태 → 내 선수 결정 → 아래 고정 [나중에]·[경기 시작].
// 바꾼 값은 그대로 기본값으로 저장된다

import { Button, Crest, FormIndicator, FormationPitch, GameCard, HeroPanel, Icon, TacticChip, Tabs, esc } from '../components';
import { shortReason } from './deck';
import { pc2 } from './common';
import { isWide } from '../skin';
import { BALANCE } from '../../config/balance';
import type { FormMark, PrepVM } from '../prepVM';

const MARK_KO: Record<FormMark, string> = { W: '승', D: '무', L: '패' };
const STOP_KO: Record<string, string> = { all: '모든 결정 순간에 멈춰요', important: '중요한 순간에만 멈춰요', critical: '결정적 순간에만 멈춰요' };

function formDots(f: FormMark[]): string {
  if (!f.length) return '<span class="muted small">이번 시즌 첫 경기</span>';
  return `<span class="prep-form" aria-label="상대 최근 ${f.length}경기">${f.map((m) => `<i class="prep-form__m is-${m}">${MARK_KO[m]}</i>`).join('')}</span>`;
}

/** 카드 머리: 제목 + 오른쪽 링크(act 가 있으면 버튼) */
function head(title: string, link?: { label: string; act: string; v?: string }): string {
  const a = link ? `<button type="button" class="prep-link" data-act="${link.act}"${link.v ? ` data-v="${esc(link.v)}"` : ''}>${esc(link.label)}${Icon({ name: 'chevron-right', size: 14 })}</button>` : '';
  return `<div class="prep-head"><b>${esc(title)}</b>${a}</div>`;
}

/** 고른 덱 세트의 카드 줄 (C.66c): mini 카드 가로 한 줄, 끌어 넘김(스냅)·처음·끝 흐림. 누르면 카드 상세(보기만) */
function deckStrip(cards: PrepVM['deck']['cards'], active: number): string {
  if (!cards.length) return '<span class="prep-note">이 덱에 카드가 없어요.</span>';
  const cells = cards.map((c) => `<div class="prep-deck__cell" role="listitem">${GameCard({ card: { ...c.card, count: 0 }, size: 'mini', act: 'card-open', data: { v: c.id, from: 'view' }, state: c.problem ? 'disabled' : 'normal', ...(c.problem ? { reason: shortReason(c.problem) } : {}) })}</div>`).join('');
  return `<div class="prep-deck" role="list" aria-label="덱 ${active + 1} 카드 ${cards.length}장" data-n="${cards.length}">${cells}</div>`;
}

const card = (inner: string) => `<section class="prep-card">${inner}</section>`;

export function prepView(vm: PrepVM): string {
  const chips: (string | { label: string; soft?: boolean })[] = [`${vm.my.name} vs ${vm.opp.name}`];
  const tr = vm.start.trial;
  if (vm.derby) chips.push({ label: vm.derby.name, soft: true });
  if (vm.cupBadge) chips.push({ label: vm.cupBadge.split(' · ')[0]!, soft: true });
  if (tr) chips.push({ label: tr.n >= tr.of ? '1군 테스트 마지막 경기' : `1군 테스트 ${tr.n}/${tr.of}경기째`, soft: true });
  const hero = HeroPanel({
    title: '경기 준비', back: { act: 'go', data: { to: 'home' } }, compact: true, pad: false, progress: false,
    eyebrow: `${vm.comp} · ${vm.home ? '홈' : '원정'} · ${vm.date}`, value: '오늘', chips,
  });

  const total = vm.my.rating + vm.opp.rating;
  const share = total > 0 ? Math.round((vm.my.rating / total) * 100) : 50;
  // C.76j (디자인 212): 컵·챔스 경기면 상대 카드 맨 위 대회 배지(라임 꺾인 칩 · 트로피)
  const badge = vm.cupBadge ? `<div class="prep-cup"><span class="prep-cup__chip">${Icon({ name: 'trophy', size: 14, strokeWidth: 2.4 })}<b>${esc(vm.cupBadge)}</b></span><small class="prep-sub">${vm.home ? '홈' : '원정'}</small></div>` : '';
  const opp = card(`${badge}${head('상대', { label: '팀 상세', act: 'team-open', v: vm.opp.id })}
    <div class="prep-vs"><span class="prep-vs__me">${Crest({ name: vm.my.name, size: 28 })}<b>${esc(vm.my.name)}</b></span><span class="prep-vs__x">vs</span><span class="prep-vs__opp"><b>${esc(vm.opp.name)}</b>${Crest({ name: vm.opp.name, size: 28, color: 'var(--away)' })}</span></div>
    <div class="prep-bar"><span>전력 <b class="po-num">${vm.my.rating}</b> <small>${vm.my.rank ? `${vm.my.rank}위` : ''}</small></span><span class="prep-bar__track"><i style="width:${share}%"></i><i></i></span><span><small>${vm.opp.rank ? `${vm.opp.rank}위` : vm.opp.id.startsWith('n:') ? '대표팀' : '리그 밖'}</small> <b class="po-num is-away">${vm.opp.rating}</b></span></div>
    <div class="prep-row">${vm.opp.tactic ? TacticChip({ size: 'sm', away: true, ...vm.opp.tactic }) : '<span></span>'}${formDots(vm.opp.form)}</div>
    ${vm.derby ? `<div class="prep-derby">${Icon({ name: 'star', size: 14, strokeWidth: 2.4 })}<b class="grow">${esc(vm.derby.name)} · 더비 매치</b>${vm.opp.rank ? `<small>순위 ${vm.my.rank}위 vs ${vm.opp.rank}위</small>` : ''}</div>` : ''}
    ${vm.hint ? `<span class="prep-note">영상 분석 힌트 · ${esc(vm.hint)}</span>` : ''}`);

  // 상대 분석 리포트 (C.74c): 나를 맡을 수비수 · 약점 1~2개 · 결정 순간 "약점 공략"
  const sc = vm.scout;
  // C.76j (디자인 231): 나를 맡을 선수 카드 + 맞대결 포인트(약점 공략 칩) + 규칙 줄. 팀 약점·강점 2칸은 데이터가 없어 뺌
  const scout = sc ? card(`<div class="prep-head"><b>상대 분석</b><span class="prep-sub">영상 분석 · 경기 전날</span></div>
    <div class="prep-marker"><span class="prep-marker__face">${Icon({ name: 'player', size: 22 })}</span><span class="grow"><small class="prep-sub">나를 맡을 선수</small><b>${esc(sc.name)}</b><small class="prep-sub">${esc(sc.position)} · ${esc(vm.opp.name)} · 내 ${esc(vm.me.pos)} 맞상대</small></span><span class="prep-marker__r"><b class="prep-marker__pos">${esc(sc.position)}</b><small class="prep-sub">약점 ${sc.weak.length}</small></span></div>
    <small class="prep-sub prep-scout__h">맞대결 포인트 · 나 vs ${esc(sc.name)}</small>
    <ul class="prep-scout">${sc.weak.map((w) => `<li>${Icon({ name: 'target', size: 14 })}<b>${esc(w.name)}</b><span class="prep-sub grow">${esc(w.tip)}</span><span class="prep-exploit-chip">약점 공략</span></li>`).join('')}</ul>
    <p class="prep-scout__note">결정 순간 <b class="prep-exploit">약점 공략</b> 선택지(${esc(sc.actionsKo)})는 성공률 +${sc.bonus}% · 그 선수가 뛰는 동안</p>`) : '';

  const lock = '<span class="prep-note">전술은 3경기를 치르면 열려요.</span>';
  const tactics = card(`${head('전술', vm.tacticsOpen ? { label: '바꾸기', act: 'tac-open' } : undefined)}
    <div class="prep-row">${vm.my.tactic ? TacticChip({ size: 'sm', ...vm.my.tactic }) : ''}<span class="prep-sub">${esc(vm.tacticLine)}</span></div>
    ${vm.tacticsOpen ? '' : lock}`);

  const me = vm.me;
  const pos = card(`${head('내 포지션', vm.tacticsOpen ? { label: '포메이션', act: 'tac-open' } : undefined)}
    <div class="prep-pos">
      ${FormationPitch({ slots: vm.slots, compact: true, height: 190, label: `${vm.formation}, 내 위치 ${me.pos}` })}
      <span class="prep-pos__info"><b>${esc(me.pos)}${me.role ? ` · ${esc(me.role)}` : ''}</b>
        <span>숙련 ${me.prof} · OVR <b class="po-num">${me.ovr}</b>${me.roleDesc ? ` · ${esc(me.roleDesc)}` : ''}</span>
        ${me.off ? `<span class="warn">주 포지션(${esc(me.mainPos)})이 아니라 OVR이 낮아요.</span>` : ''}
        ${vm.tacticsOpen ? Button({ size: 'sm', variant: 'secondary', icon: 'tactic', act: 'tac-open', data: { v: 'role' }, children: '역할 바꾸기' }) : ''}</span>
    </div>`);

  const d = vm.deck;
  const cur = d.sets[d.active];
  const free = d.sets.find((x) => x.idx !== d.active && x.ok && !x.unusable);
  const warn = cur && cur.unusable
    ? `<span class="prep-warn">${Icon({ name: 'danger', size: 14 })}못 쓰는 카드 ${cur.unusable}장 (포지션·능력치·역할)${free ? ` · 덱 ${free.idx + 1}는 모두 써요` : ''}</span>`
    : '';
  const bad = d.sets.filter((x) => !x.ok).map((x) => x.idx + 1);
  const deck = card(`${head('덱', { label: d.picks ? `카드 선택 ${d.picks} · 덱 편집` : '덱 편집', act: 'go-tab', v: 'deck' })}
    ${Tabs({ items: d.sets.map((x) => ({ id: String(x.idx), label: `덱 ${x.idx + 1} · ${x.count}` })), value: String(d.active), act: 'deck-use', fill: true, label: '덱 세트' })}
    ${deckStrip(d.cards, d.active)}
    ${d.cards.length ? `<span class="prep-note">덱 ${d.active + 1} · ${d.cards.length}장 · 옆으로 넘겨 보기 · 누르면 카드 상세</span>` : ''}
    ${warn}${bad.length ? `<span class="prep-note">덱 ${bad.join('·')}는 규칙(장수·같은 카드)에 맞춰야 쓸 수 있어요.</span>` : ''}`);

  const c = vm.condition;
  const stamina = Math.max(0, Math.min(100, 100 - c.fatigue));
  const s = vm.start;
  // C.70 (디자인 166): 머리 오른쪽 경고 n/n, 폼 줄 오른쪽 평점 보정, 아래 판 = 선발 가능성 막대 % + 결장 사유
  const low = 100 - BALANCE.fatigue.penaltyFrom;
  const why = [
    ...(c.injury ? [`${Icon({ name: 'danger', size: 14 })}<span class="fail">부상 · ${esc(c.injury)}</span>`] : []),
    ...(c.suspended > 0 ? [`${Icon({ name: 'danger', size: 14 })}<span class="fail">출장 정지 · ${c.suspended}경기 남음</span>`] : []),
    ...(c.seasonFatigue ? [`${Icon({ name: 'clock', size: 14 })}<span>시즌 누적 피로 ${c.seasonFatigue} · 경기 체력에서 더 빠져요 (쉬는 경기에 풀려요)</span>`] : []),
    ...(!s.out && stamina < low ? [`${Icon({ name: 'clock', size: 14 })}<span>체력 ${stamina} · ${low} 아래면 벤치로 밀릴 수 있어요</span>`] : []),
    ...(!s.out && c.yellows >= c.yellowEvery - 1 ? [`<i class="prep-why__card" aria-hidden="true"></i><span>경고 ${c.yellows}/${c.yellowEvery} · 한 장 더 받으면 다음 경기는 정지예요</span>`] : []),
  ];
  // C.76j (디자인 223 · 166): 결장이면 막대 0% + 빨간 사유 줄, 90% 이상이면 사유 대신 초록 한 줄
  const chance = s.out
    ? `<div class="prep-chance__head"><span>선발 가능성</span><span class="prep-chance__track"><i style="width:0%"></i></span><b class="po-num fail">0%</b></div><p class="prep-chance__line is-out">${Icon({ name: 'close', size: 14 })}<b>결장 · ${esc(s.out)}</b><span>이번 경기는 관전만</span></p>`
    : tr
      ? `<div class="prep-chance__head"><span>선발 가능성</span><b>1군 테스트 ${tr.n}/${tr.of}경기째 · 출전 보장</b></div>`
      : `<div class="prep-chance__head"><span>선발 가능성</span><span class="prep-chance__track"><i class="${s.chance < 50 ? 'is-low' : s.chance < 80 ? 'is-mid' : ''}" style="width:${s.chance}%"></i></span><b class="po-num">${s.chance}%</b></div>`;
  const state = card(`<div class="prep-head"><b>내 상태</b><span class="prep-sub">경고 <b class="po-num${c.yellows >= c.yellowEvery - 1 ? ' warn' : ''}">${c.yellows}/${c.yellowEvery}</b></span></div>
    <div class="prep-stamina"><span>체력</span><span class="prep-stamina__track"><i class="${stamina <= 30 ? 'is-low' : stamina < 50 ? 'is-mid' : ''}" style="width:${stamina}%"></i></span><b class="po-num">${stamina}</b></div>
    <div class="prep-row">${FormIndicator({ level: c.form, showLabel: true })}<span class="prep-sub">${esc(c.formLabel)}</span></div>
    <div class="prep-chance">${chance}${!s.out && !tr && s.chance >= 90 && !why.length ? `<p class="prep-chance__line is-sure">${Icon({ name: 'check', size: 14 })}<b>선발 유력</b><span>지금 상태면 거의 선발이에요</span></p>` : ''}${why.length ? `<small class="prep-why__head">결장 사유</small><ul class="prep-why">${why.map((w) => `<li>${w}</li>`).join('')}</ul>` : ''}</div>`);

  const ctl = vm.control;
  const mode = `<div class="prep-ctl">
    <div class="prep-head"><b>내 선수 결정</b><span class="prep-sub">${ctl.mode === 'direct' ? '직접 = 멈추면 내가 골라요' : '자동 = 엔진이 대신 골라요'}</span></div>
    ${Tabs({ items: [{ id: 'direct', label: '직접' }, { id: 'auto', label: '자동' }], value: ctl.mode, act: 'ctl-mode', fill: true, label: '내 선수 결정' })}
    ${ctl.mode === 'direct' ? `<div class="prep-head prep-head--sub"><b>정지 빈도 · 직접일 때</b><span class="prep-sub">${STOP_KO[ctl.stop] ?? ''}</span></div>` : ''}
    ${ctl.mode === 'direct' ? Tabs({ items: [{ id: 'all', label: '모든 순간' }, { id: 'important', label: '중요한 순간만' }, { id: 'critical', label: '결정적 순간만' }], value: ctl.stop, act: 'ctl-stop', fill: true, label: '정지 빈도' }) : ''}
  </div>`;

  const bar = `<div class="prep-bottom">${Button({ variant: 'secondary', size: 'lg', block: true, act: 'go', data: { to: 'home' }, children: '나중에' })}${Button({ size: 'lg', block: true, icon: 'play', act: 'prep-start', children: s.out ? '경기 진행 (관전)' : '경기 시작' })}</div>`;
  // C.76j (디자인 231 PC): 2열 = 왼쪽 상대 · 전술 · 내 상태 · 내 선수 결정 / 오른쪽 상대 분석 · 내 포지션 · 덱
  if (isWide()) return `${hero}<div class="body prep-body">${pc2(`${opp}${tactics}${state}${mode}`, `${scout}${pos}${deck}`, 'prep-pc')}</div>${bar}`;
  return `${hero}<div class="body prep-body">${opp}${scout}${tactics}${pos}${deck}${state}${mode}</div>${bar}`;
}
