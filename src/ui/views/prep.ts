// 경기 준비 (C.51, pending 82 3번, 6.md 156 — 디자인 전이라 기존 토큰·컴포넌트로).
// 상대 한 줄 → 전술·내 자리 → 출전·상태 → 덱 → 플레이 방식 → [경기 시작]. 바꾼 값은 그대로 기본값으로 저장된다

import { BALANCE } from '../../config/balance';
import { Button, Crest, FatigueGauge, FormIndicator, HeroPanel, Icon, OptionRow, SectionTitle, StatChip, TacticChip, Tabs, esc } from '../components';
import type { FormMark, PrepTeamVM, PrepVM } from '../prepVM';
import { staminaNote } from './home';
import { panel } from './common';

const MARK_KO: Record<FormMark, string> = { W: '승', D: '무', L: '패' };

function formDots(f: FormMark[]): string {
  if (!f.length) return '<span class="muted small">이번 시즌 경기 전</span>';
  return `<span class="prep-form" aria-label="최근 ${f.length}경기">${f.map((m) => `<i class="prep-form__m is-${m}">${MARK_KO[m]}</i>`).join('')}</span>`;
}

function teamLine(t: PrepTeamVM, away: boolean): string {
  return `<div class="prep-team">
    <span class="prep-team__name">${Crest({ name: t.name, size: 22, ...(away ? { color: 'var(--away)' } : {}) })}<b>${esc(t.name)}</b></span>
    <span class="prep-team__meta small"><b class="po-num">${t.rank || '-'}</b>위 · 전력 <b class="po-num">${t.rating}</b></span>
    ${formDots(t.form)}
  </div>`;
}

export function prepView(vm: PrepVM): string {
  const hero = HeroPanel({
    title: '경기 준비', back: { act: 'go', data: { to: 'home' } }, compact: true, pad: false, progress: false,
    eyebrow: `${vm.date} · ${vm.comp}`, value: `${vm.opp.name}전`,
    chips: [vm.home ? '홈' : '원정', { label: vm.comp, soft: true }, ...(vm.derby ? [{ label: vm.derby.name, soft: true }] : [])],
  });

  const opp = `${SectionTitle({ title: '상대', action: `${vm.home ? '홈' : '원정'} · ${vm.comp}` })}
    ${panel(`${vm.derby ? `<div class="derby-badge${vm.derby.big ? ' is-big' : ''}">${Icon({ name: 'star', size: 14, strokeWidth: 2.4 })}<b>${esc(vm.derby.name)}</b><span>더비 매치</span></div>` : ''}
      ${teamLine(vm.my, false)}${teamLine(vm.opp, true)}
      <p class="small muted">순위 ${vm.teams}팀 중 · 최근 5경기 왼쪽이 오래된 경기</p>`)}`;

  const me = vm.me;
  const tactics = `${SectionTitle({ title: '전술 · 내 자리', action: '바꾸면 다음 경기에도 그대로' })}
    ${panel(`<div class="sub-panel">
        <div class="kv"><span>우리 전술</span><span class="kv-r">${vm.my.tactic ? TacticChip({ size: 'sm', ...vm.my.tactic }) : ''}</span></div>
        <div class="divider"></div>
        <div class="kv"><span>상대 전술</span>${vm.opp.tactic ? TacticChip({ size: 'sm', team: vm.opp.name, away: true, ...vm.opp.tactic }) : ''}</div>
      </div>
      <div class="kv"><span>내 자리</span><span class="kv-r"><b>${esc(me.pos)}</b>&nbsp;${esc(me.posKo)}${me.role ? ` · ${esc(me.role)}` : ''} · OVR <b class="po-num">${me.ovr}</b></span></div>
      ${me.off ? `<p class="small warn">주 포지션(${esc(me.mainPos)})이 아닌 자리라 숙련도만큼 OVR이 낮아요.</p>` : ''}
      ${vm.tacticsOpen
        ? Button({ variant: 'secondary', block: true, icon: 'tactic', act: 'tac-open', children: '전술·내 자리 바꾸기' })
        : '<p class="small muted">전술은 3경기를 치르면 열려요.</p>'}`)}`;

  const s = vm.start;
  const startLine = s.out
    ? `<p class="line fail"><b>${esc(s.out)}</b>으로 이번 경기에 나설 수 없어요. 경기는 관전으로 진행돼요.</p>`
    : s.trial
      ? '<p class="line">1군 테스트 중이라 <b>출전이 보장</b>돼요.</p>'
      : `<p class="line">선발 가능성 <b class="po-num">${s.chance}%</b> <span class="muted small">· OVR·팀 전력·체력으로 정해요. 선발이 아니면 교체로 들어갈 수 있어요.</span></p>`;
  const c = vm.condition;
  const state = `${SectionTitle({ title: '출전 · 내 상태' })}
    ${panel(`${startLine}
      <div class="kv">${FatigueGauge({ value: c.fatigue })}${StatChip({ icon: 'card', label: '경고', value: `${c.yellows}/${c.yellowEvery}`, tone: c.yellows >= c.yellowEvery - 1 ? 'warning' : 'neutral' })}</div>
      ${staminaNote(c.fatigue)}
      <div class="kv">${FormIndicator({ level: c.form })}<span class="muted small">${esc(c.formLabel)}</span></div>
      ${c.injury ? `<p class="small fail">부상 · ${esc(c.injury)}</p>` : ''}
      ${c.suspended ? `<p class="small warn">출장 정지 ${c.suspended}경기 남음</p>` : ''}
      ${c.yellows >= c.yellowEvery - 1 ? `<p class="small warn">경고 1장 더 받으면 다음 경기 출장 정지예요.</p>` : ''}`)}`;

  const d = vm.deck;
  const deck = `${SectionTitle({ title: '카드 덱', action: `경기에 쓰는 덱 ${d.active + 1}` })}
    ${panel(`${d.sets.map((x) => OptionRow({
      act: 'deck-use', data: { v: String(x.idx) }, radio: true, selected: x.idx === d.active, disabled: !x.ok,
      title: `덱 ${x.idx + 1} · ${x.count}장`,
      desc: !x.ok ? `규칙에 맞지 않아 쓸 수 없어요 (${BALANCE.cards.deckMin}~${BALANCE.cards.deckMax}장)` : x.unusable ? `지금 못 쓰는 카드 ${x.unusable}장 (포지션·능력치·역할)` : '모든 카드를 쓸 수 있어요',
    })).join('')}
      ${d.picks ? `<p class="small"><b>카드 선택 ${d.picks}개</b>를 받을 수 있어요.</p>` : ''}
      ${Button({ variant: 'ghost', size: 'sm', block: true, act: 'go', data: { to: 'deck' }, children: d.picks ? '카드 고르고 덱 편집' : '덱 편집' })}`)}`;

  const ctl = vm.control;
  const mode = `${SectionTitle({ title: '플레이 방식', action: '바꾸면 다음 경기에도 그대로' })}
    ${panel(`<div class="sub-panel ctl-panel">
        <div class="kv"><span>내 선수 결정</span><span class="muted small">${ctl.mode === 'direct' ? '결정 순간마다 멈춰요' : '엔진이 대신 결정하고 결과만 보여 줘요'}</span></div>
        ${Tabs({ items: [{ id: 'direct', label: '직접' }, { id: 'auto', label: '자동' }], value: ctl.mode, act: 'ctl-mode', fill: true, label: '직접/자동' })}
        ${ctl.mode === 'direct' ? Tabs({ items: [{ id: 'all', label: '모든 순간' }, { id: 'important', label: '중요한 순간만' }, { id: 'critical', label: '결정적 순간만' }], value: ctl.stop, act: 'ctl-stop', fill: true, label: '정지 빈도' }) : ''}
      </div>
      <div class="kv"><span class="small">다른 경기 계산</span>${Tabs({ items: [{ id: 'engine', label: '전체 엔진' }, { id: 'quick', label: '빠른 진행' }], value: vm.quick ? 'quick' : 'engine', act: 'opt-quick', label: '다른 경기 계산' })}</div>`)}`;

  const start = `<div class="prep-start">${Button({ size: 'lg', block: true, icon: s.out ? 'match' : 'play', act: 'prep-start', children: s.out ? '경기 진행 (관전)' : '경기 시작' })}</div>`;
  return `${hero}<div class="body">${opp}${tactics}${state}${deck}${mode}${start}</div>`;
}
