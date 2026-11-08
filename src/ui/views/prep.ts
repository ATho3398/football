// 경기 준비 (C.51 → 17차 S08 C.83c): 머리말 = 선발 가능성 % · 선발 가능성 패널(접음) → 상대(예상 계획 · 상성) → 상대 분석(접음) →
// 전술 · 내 포지션(적합도 · 공격 인원 · 미니 피치) → 덱(2줄 × 4장) → 경기 변수(접음, 직접 모드면 펼침) → 내 선수 결정(정지 빈도 뜻) → 아래 고정 요약 줄 + [나중에]·[경기 시작].
// PC 3열: 왼쪽 선발 · 경기 변수 / 가운데 상대 · 상대 분석 · 전술 / 오른쪽 덱 · 결정. 바꾼 값은 그대로 기본값으로 저장된다

import { Button, Chip, Crest, cx, FormIndicator, FormationPitch, GameCard, HeroPanel, Icon, Panel, TacticChip, Tabs, esc } from '../components';
import { FIT_TONE_KO, fitCap } from '../prepNumbers';
import { shortReason } from './deck';
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

/** 접는 칸 열림 상태 (화면 상태, act `prep-fold`): 키가 없으면 기본값 */
export type PrepFold = Partial<Record<'start' | 'scout' | 'vars', boolean>>;

export function prepView(vm: PrepVM, open: PrepFold = {}): string {
  const wide = isWide();
  const s = vm.start;
  const tr = s.trial;
  const c = vm.condition;
  // 머리말 (S08): 숫자 = 선발 가능성 % (결장이면 "결장", 1군 테스트면 "보장")
  const chips: (string | { label: string; soft?: boolean })[] = [`vs ${vm.opp.name}`];
  if (vm.derby) chips.push({ label: vm.derby.name, soft: true });
  if (vm.cupBadge) chips.push({ label: vm.cupBadge.split(' · ')[0]!, soft: true });
  if (tr) chips.push({ label: tr.n >= tr.of ? '1군 테스트 마지막 경기' : `1군 테스트 ${tr.n}/${tr.of}경기째`, soft: true });
  const venue = vm.neutral ? '중립' : vm.home ? '홈' : '원정';
  const hero = HeroPanel({
    title: '경기 준비', back: { act: 'go', data: { to: 'home' } }, compact: true, pad: false, progress: false,
    eyebrow: `선발 가능성 · ${vm.comp} · ${venue} · ${vm.date}`,
    value: s.out ? '결장' : tr ? '보장' : s.chance, ...(s.out || tr ? {} : { unit: '%' }), chips,
  });

  // ── 선발 가능성 (S08-a·b): 접은 한 줄 = "벤치 n% · 벤치면 결과로 · 체력" / 펼침 = 체력 · 폼 · 막대 · 결장 사유 (옛 "내 상태" 칸) ──
  const stamina = Math.max(0, Math.min(100, 100 - c.fatigue));
  const low = 100 - BALANCE.fatigue.penaltyFrom;
  const why = [
    ...(c.injury ? [`${Icon({ name: 'danger', size: 14 })}<span class="fail">부상 · ${esc(c.injury)}</span>`] : []),
    ...(c.suspended > 0 ? [`${Icon({ name: 'danger', size: 14 })}<span class="fail">출장 정지 · ${c.suspended}경기 남음</span>`] : []),
    ...(c.seasonFatigue ? [`${Icon({ name: 'clock', size: 14 })}<span>시즌 누적 피로 ${c.seasonFatigue} · 경기 체력에서 더 빠져요 (쉬는 경기에 풀려요)</span>`] : []),
    ...(!s.out && stamina < low ? [`${Icon({ name: 'clock', size: 14 })}<span>체력 ${stamina} · ${low} 아래면 벤치로 밀릴 수 있어요</span>`] : []),
    ...(!s.out && c.yellowEvery > 0 && c.yellows >= c.yellowEvery - 1 ? [`<i class="prep-why__card" aria-hidden="true"></i><span>경고 ${c.yellows}/${c.yellowEvery} · 한 장 더 받으면 다음 경기는 정지예요</span>`] : []),
  ];
  const chanceBar = s.out
    ? `<div class="prep-chance__head"><span>선발 가능성</span><span class="prep-chance__track"><i style="width:0%"></i></span><b class="po-num fail">0%</b></div><p class="prep-chance__line is-out">${Icon({ name: 'close', size: 14 })}<b>결장 · ${esc(s.out)}</b><span>이번 경기는 관전만</span></p>`
    : tr
      ? `<div class="prep-chance__head"><span>선발 가능성</span><b>1군 테스트 ${tr.n}/${tr.of}경기째 · 출전 보장</b></div>`
      : `<div class="prep-chance__head"><span>선발 가능성</span><span class="prep-chance__track"><i class="${s.chance < 50 ? 'is-low' : s.chance < 80 ? 'is-mid' : ''}" style="width:${s.chance}%"></i></span><b class="po-num">${s.chance}%</b></div>`;
  const startBody = `<div class="prep-stamina"><span>체력</span><span class="prep-stamina__track"><i class="${stamina <= 30 ? 'is-low' : stamina < 50 ? 'is-mid' : ''}" style="width:${stamina}%"></i></span><b class="po-num">${stamina}</b></div>
    <div class="prep-row">${FormIndicator({ level: c.form, showLabel: true })}<span class="prep-sub">${esc(c.formLabel)}</span><span class="prep-sub">경고 <b class="po-num${c.yellowEvery > 0 && c.yellows >= c.yellowEvery - 1 ? ' warn' : ''}">${c.yellowEvery ? `${c.yellows}/${c.yellowEvery}` : c.yellows}</b></span></div>
    <div class="prep-chance">${chanceBar}${!s.out && !tr && s.chance >= 90 && !why.length ? `<p class="prep-chance__line is-sure">${Icon({ name: 'check', size: 14 })}<b>선발 유력</b><span>지금 상태면 거의 선발이에요</span></p>` : ''}${why.length ? `<small class="prep-why__head">결장 사유</small><ul class="prep-why">${why.map((w) => `<li>${w}</li>`).join('')}</ul>` : ''}</div>
    ${!s.out && !tr ? '<p class="prep-note">벤치면 경기를 건너뛰고 결과로 가요.</p>' : ''}`;
  const bench = s.out || tr ? 0 : 100 - s.chance;
  const lowStart = !!s.out || (!tr && s.chance < 50);
  const startOpen = open.start ?? (wide || lowStart);
  const startSummary = s.out ? `결장 · ${s.out} · 이번 경기는 관전만` : tr ? `1군 테스트 ${tr.n}/${tr.of}경기째 · 출전 보장 · 체력 ${stamina}`
    : `벤치 ${bench}% · 벤치면 경기를 건너뛰고 결과로 가요 · 체력 ${stamina}${why.length ? ` · 사유 ${why.length}가지` : ''}`;
  const startPanel = Panel({
    kind: lowStart ? 'alert' : 'info', className: 'prep-start',
    title: s.out ? '이번 경기 결장' : tr ? '선발 · 출전 보장' : lowStart ? `벤치일 수 있어요 · 선발 ${s.chance}%` : `선발 가능성 ${s.chance}%`,
    right: s.out ? '관전' : tr ? '' : '벤치면 결과로', ...(lowStart ? { icon: 'danger' as const } : {}),
    foldable: true, folded: !startOpen, onFold: { act: 'prep-fold', data: { v: 'start' } }, summary: startSummary, children: startBody,
  });

  // ── 상대 (S08-b): 전력 막대 · 성향 · 최근 5경기 + 예상 계획 · 상성 ──
  const total = vm.my.rating + vm.opp.rating;
  const share = total > 0 ? Math.round((vm.my.rating / total) * 100) : 50;
  const badge = vm.cupBadge ? `<div class="prep-cup"><span class="prep-cup__chip">${Icon({ name: 'trophy', size: 14, strokeWidth: 2.4 })}<b>${esc(vm.cupBadge)}</b></span><small class="prep-sub">${venue}</small></div>` : '';
  const plan = vm.oppPlan;
  const mu = vm.matchup;
  const planRows = plan ? `<div class="prep-rows">
      <div class="prep-irow"><span class="prep-irow__ic">${Icon({ name: 'target', size: 16 })}</span><span class="prep-irow__t"><b>예상 계획 · ${esc(plan.line)}</b><small>${esc(plan.name)} · ${esc(plan.basis)}</small></span>${Chip({ kind: 'status', tone: plan.adapted ? 'warning' : 'neutral', label: plan.adapted ? '약팀 대응' : '평소' })}</div>
      ${mu ? `<div class="prep-irow"><span class="prep-irow__ic">${Icon({ name: 'swap', size: 16 })}</span><span class="prep-irow__t"><b>상성 · 우리 ${esc(mu.mineName)} vs 상대 ${esc(mu.oppName)}</b><small>${mu.mine ? `우리 ${esc(mu.mine)}` : '우리 보정 없음'} · ${mu.theirs ? `상대 ${esc(mu.theirs)}` : '상대 보정 없음'} (능력치 점수)</small></span>${Chip({ kind: 'status', tone: mu.tone === 'up' ? 'success' : mu.tone === 'down' ? 'fail' : 'neutral', label: mu.tone === 'up' ? '유리' : mu.tone === 'down' ? '불리' : '차이 없음' })}</div>` : ''}
    </div>` : '';
  const opp = card(`${badge}${head('상대', { label: '팀 상세', act: 'team-open', v: vm.opp.id })}
    <div class="prep-vs"><span class="prep-vs__me">${Crest({ name: vm.my.name, size: 28 })}<b>${esc(vm.my.name)}</b></span><span class="prep-vs__x">vs</span><span class="prep-vs__opp"><b>${esc(vm.opp.name)}</b>${Crest({ name: vm.opp.name, size: 28, color: 'var(--away)' })}</span></div>
    <div class="prep-bar"><span>전력 <b class="po-num">${vm.my.rating}</b> <small>${vm.my.rank ? `${vm.my.rank}위` : ''}</small></span><span class="prep-bar__track"><i style="width:${share}%"></i><i></i></span><span><small>${vm.opp.rank ? `${vm.opp.rank}위` : vm.opp.id.startsWith('n:') ? '대표팀' : '리그 밖'}</small> <b class="po-num is-away">${vm.opp.rating}</b></span></div>
    <div class="prep-row">${vm.opp.tactic ? TacticChip({ size: 'sm', away: true, ...vm.opp.tactic }) : '<span></span>'}${formDots(vm.opp.form)}</div>
    ${vm.derby ? `<div class="prep-derby">${Icon({ name: 'star', size: 14, strokeWidth: 2.4 })}<b class="grow">${esc(vm.derby.name)} · 더비 매치</b>${vm.opp.rank ? `<small>순위 ${vm.my.rank}위 vs ${vm.opp.rank}위</small>` : ''}</div>` : ''}
    ${planRows}
    ${vm.oppBans.length ? `<span class="prep-note">출장 정지 · ${esc(vm.oppBans.join(', '))}</span>` : ''}
    ${vm.hint ? `<span class="prep-note">영상 분석 힌트 · ${esc(vm.hint)}</span>` : ''}`);

  // ── 상대 분석 (C.74c, 접음): 나를 맡을 선수 · 약점 · 약점 공략 ──
  const sc = vm.scout;
  const scoutBody = sc ? `<div class="prep-marker"><span class="prep-marker__face">${Icon({ name: 'player', size: 22 })}</span><span class="grow"><small class="prep-sub">나를 맡을 선수</small><b>${esc(sc.name)}</b><small class="prep-sub">${esc(sc.position)} · ${esc(vm.opp.name)} · 내 ${esc(vm.me.pos)} 맞상대</small></span><span class="prep-marker__r"><b class="prep-marker__pos">${esc(sc.position)}</b><small class="prep-sub">약점 ${sc.weak.length}</small></span></div>
    <small class="prep-sub prep-scout__h">맞대결 포인트 · 나 vs ${esc(sc.name)}</small>
    <ul class="prep-scout">${sc.weak.map((w) => `<li>${Icon({ name: 'target', size: 14 })}<b>${esc(w.name)}</b><span class="prep-sub grow">${esc(w.tip)}</span><span class="prep-exploit-chip">약점 공략</span></li>`).join('')}</ul>
    <p class="prep-scout__note">결정 순간 <b class="prep-exploit">약점 공략</b> 선택지(${esc(sc.actionsKo)})는 성공률 +${sc.bonus}%p · 그 선수가 뛰는 동안</p>` : '';
  const scout = sc ? Panel({
    title: '상대 분석', right: '영상 분석 · 경기 전날', className: 'prep-scoutp', foldable: true, folded: !(open.scout ?? wide), onFold: { act: 'prep-fold', data: { v: 'scout' } },
    summary: `${sc.name} · 약점 ${sc.weak.length} · 약점 공략 +${sc.bonus}%p`, children: scoutBody,
  }) : '';

  // ── 전술 · 내 포지션 (S08-b): 성향 줄 · 적합도 · 공격 인원 · 미니 피치 + 역할 ──
  const fit = vm.fit;
  const atk = vm.attack;
  const fitRow = fit ? `<div class="prep-irow"><span class="prep-irow__ic">${Icon({ name: 'tactic', size: 16 })}</span><span class="prep-irow__t"><b>적합도 · ${esc(fit.text)}</b><small>${fit.pts === null ? '균형 · 수비 블록은 선수단 적합도 보정이 없어요' : `우리 선발 능력치가 이 성향 핵심에서 리그 보통과 얼마나 다른지 · 엔진 보정 최대 ±${fitCap()}점`}</small></span>${Chip({ kind: 'status', tone: fit.tone === 'good' ? 'success' : fit.tone === 'bad' ? 'fail' : 'neutral', label: FIT_TONE_KO[fit.tone] })}</div>` : '';
  const atkRow = atk ? `<div class="prep-irow"><span class="prep-irow__ic">${Icon({ name: 'chevron-up', size: 16 })}</span><span class="prep-irow__t"><b>공격 인원 · ${atk.n}명</b><small>${esc(atk.text)}</small></span>${Chip({ kind: 'status', tone: atk.warn ? 'warning' : 'success', label: atk.warn ? '많아요' : '괜찮아요' })}</div>` : '';
  const lock = '<span class="prep-note">전술은 3경기를 치르면 열려요.</span>';
  const tactics = vm.natFixed
    ? card(`${head('전술 · 내 포지션')}
    <div class="prep-row prep-nat-tactic">${Icon({ name: 'tactic', size: 16 })}<b>대표팀 전술</b><span class="prep-sub">감독 고정 · 클럽 전술은 쓰지 않아요</span></div>
    ${posBlock(vm)}`)
    : card(`${head('전술 · 내 포지션', vm.tacticsOpen ? { label: '바꾸기', act: 'tac-open' } : undefined)}
    <div class="prep-row">${vm.my.tactic ? TacticChip({ size: 'sm', ...vm.my.tactic }) : ''}<span class="prep-sub">${esc(vm.tacticLine)}</span></div>
    ${vm.tacticsOpen ? '' : lock}
    <div class="prep-rows">${fitRow}${atkRow}</div>
    ${posBlock(vm)}`);

  // ── 덱 (S08-b): 세트 탭 + 2줄 × 4장 ──
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
    ${d.cards.length ? `<span class="prep-note">${cur && cur.unusable ? `${d.cards.length}장 중 ${d.cards.length - cur.unusable}장 써요` : `${d.cards.length}장 모두 써요`} · 누르면 카드 상세</span>` : ''}
    ${warn}${bad.length ? `<span class="prep-note">덱 ${bad.join('·')}는 규칙(장수·같은 카드)에 맞춰야 쓸 수 있어요.</span>` : ''}`);

  // ── 경기 변수 (A5~A9, 접음 · 직접 모드면 펼침): 장소 · 날씨 · 심판 · 부상 위험 · 더비 · 상대 출장 정지 ──
  const env = vm.env;
  const vars: [string, string, string][] = [
    ['장소', venue, vm.neutral ? '중립 경기장' : vm.home ? '우리 경기장' : '상대 경기장'],
    ...(env.open ? [['날씨', env.weatherKo ?? '', env.hint ?? ''] as [string, string, string], ['심판', env.referee ?? '', (env.refTraits ?? []).join(' · ')] as [string, string, string]]
      : [['날씨 · 심판', `${env.opensIn}일 뒤 공개`, '경기 며칠 전에 예보가 나와요'] as [string, string, string]]),
    ...(vm.injuryRisk ? [['부상 위험', `${vm.injuryRisk.pct}%`, `${vm.injuryRisk.mul >= 1.3 ? `보통의 ${vm.injuryRisk.mul}배 · ` : ''}${vm.injuryRisk.why}`] as [string, string, string]] : []),
    ...(vm.derby ? [['더비', vm.derby.name, vm.derby.big ? '큰 더비' : '더비 매치'] as [string, string, string]] : []),
    ...(vm.oppBans.length ? [['상대 출장 정지', `${vm.oppBans.length}명`, vm.oppBans.join(', ')] as [string, string, string]] : []),
  ];
  const varsSummary = vars.filter(([k]) => k !== '장소').map(([k, v]) => `${k} ${v}`).join(' · ');
  const varsPanel = Panel({
    title: '경기 변수', right: `${vars.length}개`, className: 'prep-vars', foldable: true,
    folded: !(open.vars ?? (wide || vm.control.mode === 'direct')), onFold: { act: 'prep-fold', data: { v: 'vars' } },
    summary: `${venue} · ${varsSummary}`,
    children: `<dl class="prep-vars__list">${vars.map(([k, v, t]) => `<div><dt>${esc(k)}</dt><dd><b>${esc(v)}</b>${t ? `<small>${esc(t)}</small>` : ''}</dd></div>`).join('')}</dl>`,
  });

  // ── 내 선수 결정 (S08-b·d): 직접/자동 + 정지 빈도 3단계 뜻 (고른 줄 강조, 자동이면 흐림) ──
  const ctl = vm.control;
  const direct = ctl.mode === 'direct';
  const stopRows = vm.stops.map((x) => `<button type="button" class="${cx('prep-stop', x.id === ctl.stop && 'is-on')}" data-act="ctl-stop" data-v="${x.id}" aria-pressed="${x.id === ctl.stop}"${direct ? '' : ' aria-disabled="true"'}><b>${esc(x.label)}</b><small>${esc(STOP_KO[x.id] ?? '')} · 이번 순간 중요도 ${x.th.toFixed(2)} 이상</small></button>`).join('');
  const mode = card(`<div class="prep-head"><b>내 선수 결정</b><span class="prep-sub">경기 직전까지 바꿀 수 있어요</span></div>
    ${Tabs({ items: [{ id: 'direct', label: '직접' }, { id: 'auto', label: '자동' }], value: ctl.mode, act: 'ctl-mode', fill: true, label: '내 선수 결정' })}
    <div class="${cx('prep-stops', !direct && 'is-dim')}"><div class="prep-head prep-head--sub"><b>정지 빈도</b><span class="prep-sub">직접일 때만</span></div>${stopRows}</div>
    <p class="prep-note">${direct ? '직접 · 멈추면 내가 골라요 · 경기 중 [자동으로 전환]으로 남은 경기를 맡길 수 있어요' : '자동 · 멈추지 않고 엔진이 골라요'}</p>`);

  const summary = `${direct ? `직접 · ${vm.stops.find((x) => x.id === ctl.stop)?.label ?? ''}` : '자동'}`;
  const tail = s.out ? '결장 · 관전' : tr ? '출전 보장' : `선발 ${s.chance}% · 벤치면 결과로 바로`;
  const bar = `<div class="prep-bottom prep-bottom--v17"><p class="prep-bottom__sum">${Icon({ name: direct ? 'player' : 'auto', size: 14 })}<b>${esc(summary)}</b><span>${esc(tail)}</span></p><div class="prep-bottom__btns">${
    Button({ variant: 'secondary', size: 'lg', block: true, act: 'go', data: { to: 'home' }, children: '나중에' })}${Button({ size: 'lg', block: true, icon: 'play', act: 'prep-start', children: s.out ? '경기 진행 (관전)' : '경기 시작' })}</div></div>`;
  if (wide) {
    return `${hero}<div class="body prep-body prep-v17"><div class="prep-pc3"><div class="prep-col">${startPanel}${varsPanel}</div><div class="prep-col">${opp}${scout}${tactics}</div><div class="prep-col">${deck}${mode}</div></div></div>${bar}`;
  }
  return `${hero}<div class="body prep-body prep-v17">${startPanel}${opp}${scout}${tactics}${deck}${varsPanel}${mode}</div>${bar}`;
}

/** 내 포지션 블록: 미니 피치 + 포지션 · 역할 · 숙련 · OVR */
function posBlock(vm: PrepVM): string {
  const me = vm.me;
  return `<div class="prep-pos">
      ${FormationPitch({ slots: vm.slots, compact: true, height: 170, label: `${vm.formation}, 내 위치 ${me.pos}` })}
      <span class="prep-pos__info"><b>${esc(me.pos)}${me.role ? ` · ${esc(me.role)}` : ''}</b>
        <span>숙련 ${me.prof} · OVR <b class="po-num">${me.ovr}</b>${me.roleDesc ? ` · ${esc(me.roleDesc)}` : ''}</span>
        ${me.off ? `<span class="warn">주 포지션(${esc(me.mainPos)})이 아니라 OVR이 낮아요.</span>` : ''}
        ${vm.tacticsOpen ? Button({ size: 'sm', variant: 'link', iconRight: 'chevron-right', act: 'tac-open', data: { v: 'role' }, children: '역할 바꾸기' }) : ''}</span>
    </div>`;
}
