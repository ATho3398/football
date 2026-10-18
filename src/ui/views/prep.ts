// 경기 준비 (C.51, pending 82 3번) — 6차 디자인 156 `R6-PreMatch`.
// 상대 카드(전력 막대·전술·최근 5경기·영상 분석 힌트) → 전술 → 내 포지션(미니 피치·역할) → 덱 세트 → 내 상태 → 내 선수 결정 → 아래 고정 [나중에]·[경기 시작].
// 바꾼 값은 그대로 기본값으로 저장된다

import { Button, Crest, FormIndicator, FormationPitch, GameCard, HeroPanel, Icon, TacticChip, Tabs, esc } from '../components';
import { shortReason } from './deck';
import type { FormMark, PrepVM } from '../prepVM';

const MARK_KO: Record<FormMark, string> = { W: '승', D: '무', L: '패' };

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
  if (tr) chips.push({ label: tr.n >= tr.of ? '1군 테스트 마지막 경기' : `1군 테스트 ${tr.n}/${tr.of}경기째`, soft: true });
  const hero = HeroPanel({
    title: '경기 준비', back: { act: 'go', data: { to: 'home' } }, compact: true, pad: false, progress: false,
    eyebrow: `${vm.comp} · ${vm.home ? '홈' : '원정'} · ${vm.date}`, value: '오늘', chips,
  });

  const total = vm.my.rating + vm.opp.rating;
  const share = total > 0 ? Math.round((vm.my.rating / total) * 100) : 50;
  const opp = card(`${head('상대', { label: '팀 상세', act: 'team-open', v: vm.opp.id })}
    <div class="prep-vs"><span class="prep-vs__me">${Crest({ name: vm.my.name, size: 28 })}<b>${esc(vm.my.name)}</b></span><span class="prep-vs__x">vs</span><span class="prep-vs__opp"><b>${esc(vm.opp.name)}</b>${Crest({ name: vm.opp.name, size: 28, color: 'var(--away)' })}</span></div>
    <div class="prep-bar"><span>전력 <b class="po-num">${vm.my.rating}</b> <small>${vm.my.rank}위</small></span><span class="prep-bar__track"><i style="width:${share}%"></i><i></i></span><span><small>${vm.opp.rank ? `${vm.opp.rank}위` : '리그 밖'}</small> <b class="po-num is-away">${vm.opp.rating}</b></span></div>
    <div class="prep-row">${vm.opp.tactic ? TacticChip({ size: 'sm', away: true, ...vm.opp.tactic }) : '<span></span>'}${formDots(vm.opp.form)}</div>
    ${vm.derby ? `<span class="prep-note is-derby">${Icon({ name: 'star', size: 12, strokeWidth: 2.4 })}${esc(vm.derby.name)} · 더비 매치</span>` : ''}
    ${vm.hint ? `<span class="prep-note">영상 분석 힌트 · ${esc(vm.hint)}</span>` : ''}`);

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
    ${warn}${bad.length ? `<span class="prep-note">덱 ${bad.join('·')}는 규칙(장수·같은 카드)에 맞춰야 쓸 수 있어요.</span>` : ''}`);

  const c = vm.condition;
  const stamina = Math.max(0, Math.min(100, 100 - c.fatigue));
  const s = vm.start;
  const play = s.out ? `<span class="fail">${esc(s.out)} · 이번 경기 결장(관전)</span>` : tr ? `1군 테스트 ${tr.n}/${tr.of}경기째 · 출전 보장` : `선발 가능성 <b>${s.chance}%</b>`;
  const state = card(`${head('내 상태')}
    <div class="prep-stamina"><span>체력</span><span class="prep-stamina__track"><i class="${stamina <= 30 ? 'is-low' : stamina < 50 ? 'is-mid' : ''}" style="width:${stamina}%"></i></span><b class="po-num">${stamina}</b></div>
    <div class="prep-row">${FormIndicator({ level: c.form, showLabel: true })}<span class="prep-sub">경고 <b>${c.yellows}/${c.yellowEvery}</b> · ${play}</span></div>
    ${c.injury ? `<span class="prep-note fail">부상 · ${esc(c.injury)}</span>` : ''}
    ${c.yellows >= c.yellowEvery - 1 ? '<span class="prep-note warn">경고 1장 더 받으면 다음 경기 출장 정지예요.</span>' : ''}`);

  const ctl = vm.control;
  const mode = `<div class="prep-ctl">
    <div class="prep-head"><b>내 선수 결정</b><span class="prep-sub">${ctl.mode === 'direct' ? '결정 순간마다 멈춰요' : '엔진이 대신 결정하고 결과만 보여 줘요'}</span></div>
    ${Tabs({ items: [{ id: 'direct', label: '직접' }, { id: 'auto', label: '자동' }], value: ctl.mode, act: 'ctl-mode', fill: true, label: '내 선수 결정' })}
    ${ctl.mode === 'direct' ? Tabs({ items: [{ id: 'all', label: '모든 순간' }, { id: 'important', label: '중요한 순간만' }, { id: 'critical', label: '결정적 순간만' }], value: ctl.stop, act: 'ctl-stop', fill: true, label: '정지 빈도' }) : ''}
  </div>`;

  const bar = `<div class="prep-bottom">${Button({ variant: 'secondary', size: 'lg', block: true, act: 'go', data: { to: 'home' }, children: '나중에' })}${Button({ size: 'lg', block: true, icon: 'play', act: 'prep-start', children: s.out ? '경기 진행 (관전)' : '경기 시작' })}</div>`;
  return `${hero}<div class="body prep-body">${opp}${tactics}${pos}${deck}${state}${mode}</div>${bar}`;
}
