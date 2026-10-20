// 경기 후 (I.6, 디자인 38): 스코어·평점, 하이라이트, 전술 리포트(21.5.2: 판정 카드 최대 2장 + 숫자 줄), 평균 위치 지도, XP.
// 내 결정 기록 (E.11, I.17 10번, 직접 모드로 멈춘 순간). 카드·신뢰도는 아직 없는 기능이라 숨긴다

import { Button, Crest, esc, HeroPanel, Icon, Meter, Pitch, PossessionBar, SectionTitle, StatChip, TacticChip } from '../components';
import type { MatchResultVM } from '../viewModels';
import { actionRow, banners, moreRecords, panel, pc2 } from './common';
import { isWide } from '../skin';
import { personLink } from './detail';
import { jerseyPanel } from './showroom';
import type { JerseyPanelVM } from '../jerseyVM';

function cmpRow(label: string, own: string, opp: string): string {
  const a = parseFloat(own) || 0;
  const b = parseFloat(opp) || 0;
  const m = Math.max(a, b, 1e-9);
  return `<div class="cmp"><div class="cmp__head"><b class="po-num">${esc(own)}</b><span>${esc(label)}</span><b class="po-num away">${esc(opp)}</b></div>
    <div class="cmp__bars"><span class="l"><i style="width:${(a / m) * 100}%"></i></span><span class="r"><i style="width:${(b / m) * 100}%"></i></span></div></div>`;
}

/** 득점 줄 (C.70 디자인 170): 분 · 공 · 골!/실점 이름 (도움) · 그때 점수, 내 골이면 "나" 칩 */
function goalRows(goals: MatchResultVM['goals']): string {
  let m = 0, o = 0;
  return goals.map((x) => {
    if (x.mine) m++; else o++;
    return `<div class="mr-goal${x.mine ? ' is-mine' : ' is-opp'}"><span class="po-num mr-goal__min">${esc(x.minute)}</span>${Icon({ name: 'ball', size: 16 })}<span class="grow">${x.mine ? '골! ' : '실점 · '}${x.id ? personLink(x.id, x.name) : `<b>${esc(x.name)}</b>`}${x.assist ? ` <small>(도움 ${esc(x.assist)})</small>` : ''} <b class="po-num mr-goal__score">${m}-${o}</b></span>${x.id === 'me' ? '<span class="mr-goal__me">나</span>' : x.assistMe ? '<span class="mr-goal__me">나</span>' : ''}</div>`;
  }).join('');
}

const ENV_ICON = { clear: 'sun', cloudy: 'cloud', rain: 'rain', wind: 'wind', heat: 'heat', snow: 'snow' } as const;

/** delta = 방금 경기 앞뒤 신뢰도·위상 변화 (C.72, 화면이 잰 값). 없거나 둘 다 0이면 줄을 숨긴다 */
/** jersey = 유니폼 교환 패널 (C.76b, 요청할 수 있는 경기만) */
export function matchResultView(vm: MatchResultVM, more: Record<string, boolean> = {}, delta: { trust: number | null; rep: number } | null = null, jersey: JerseyPanelVM | null = null): string {
  const hero = HeroPanel({
    title: '경기 결과', right: vm.comp, back: { act: 'go', data: { to: 'home' } }, ...(isWide() ? { compact: true } : {}),
    eyebrow: `${vm.opp}전 ${vm.scoreLine} ${vm.outcomeKo} · 내 평점`,
    value: vm.rating === null ? '-' : vm.rating.toFixed(1), pad: false, progress: false,
    chips: vm.chips.map((c, i) => (i === vm.chips.length - 1 ? { label: c, soft: true } : c)),
  });
  // C.70 (디자인 170·160): 한 줄 = 엠블럼 · 우리 팀 | 점수 | 상대 · 엠블럼 (내 얼굴은 머리말 평점과 겹쳐 뺌)
  const head = `<div class="panel mr-head mr-head--row"><button type="button" class="mr-team dt-link" data-act="team-open" data-v="${esc(vm.myTeamId)}">${Crest({ name: vm.myTeam, team: vm.myTeamId, size: 28 })}<small>${esc(vm.myTeam)}</small></button><b class="po-num mr-score">${esc(vm.scoreLine.replace('-', ' - '))}</b><button type="button" class="mr-team mr-team--opp dt-link" data-act="team-open" data-v="${esc(vm.oppId)}"><small>${esc(vm.opp)}</small>${Crest({ name: vm.opp, team: vm.oppId, size: 28, color: 'var(--away)' })}</button></div>${
    vm.env ? `<div class="mr-env-line"><span class="mr-env is-${vm.env.weather}">${Icon({ name: ENV_ICON[vm.env.weather], size: 16 })}<b>${esc(vm.env.line)}</b><span>· 심판 ${esc(vm.env.referee)}</span></span></div>` : ''}`;
  // 경기가 끝나면 이 화면으로 바로 온다 (C.50 pending 82 2번). 하이라이트는 이 버튼으로만 — 디자인 155 (C.60): 머리 아래 패널
  const rewatch = vm.hasAvgMap ? `<div class="panel mr-rewatch"><div class="mr-rewatch__head"><span class="mr-rewatch__icon">${Icon({ name: 'restore', size: 20 })}</span><span class="grow"><b>하이라이트 ${vm.highlights.length}장면</b><small>골 ${vm.goals.length} · 내 결정 ${vm.decisions.length}</small></span></div>
    ${Button({ block: true, icon: 'play', act: 'hl-rewatch', children: '하이라이트 다시보기' })}
    <small class="muted">경기가 끝나면 이 화면으로 바로 와요. 다시보기가 끝나면 여기로 돌아와요.</small></div>` : '';
  // 득점 (디자인 117 · 155): 우리 골 = 라임 면, 실점 = 주황 테두리. 이름을 누르면 선수 상세 (C.53)
  const goals = vm.goals.length
    ? `${SectionTitle({ title: '득점', action: '누르면 선수 상세' })}<div class="mr-goals">${goalRows(vm.goals)}</div>`
    : '';
  let report = '';
  const r = vm.report;
  if (r) {
    const verdicts = r.verdicts.map((v) => `<div class="verdict ${v.ok ? 'ok' : 'bad'}"><b>${v.ok ? '✓' : '✕'} ${esc(v.title)}</b><span>${esc(v.detail)}</span></div>`).join('');
    const [, ...rows] = r.rows; // 점유율은 점유율 바로 보여 준다
    report = `
      ${SectionTitle({ title: '전술 리포트 · 평균 위치' })}
      ${panel(`
        <div class="kv">${TacticChip({ size: 'sm', ...r.my })}${TacticChip({ size: 'sm', away: true, ...r.opp })}</div>
        ${PossessionBar({ home: r.possession })}
        ${verdicts}
        ${rows.map((x) => cmpRow(x.label, x.own, x.opp)).join('')}
        ${vm.hasAvgMap ? `<div class="divider"></div><div class="kv"><b class="small">평균 위치</b><span class="muted small" id="avg-dir">우리 공격 방향 →</span></div>${Pitch({ canvasId: 'avg-canvas', label: '양 팀 평균 위치' })}` : ''}
      `, 'report')}`;
  }
  const my = vm.my.length
    ? `${SectionTitle({ title: '내 기록', action: vm.appearance })}<div class="chips">${vm.my.map((m) => StatChip({ label: m.label, value: m.value })).join('')}${
      vm.formBonus ? StatChip({ label: '폼 보정', value: `${vm.formBonus > 0 ? '+' : '−'}${Math.abs(vm.formBonus).toFixed(2)}`, tone: vm.formBonus > 0 ? 'success' : 'fail' }) : ''}</div>${moreRecords(vm.myMore)}`
    : '';
  const RES = { success: '성공', fail: '실패', neutral: '보통' } as const;
  // 줄을 누르면 그 장면 리플레이 (E5 최소, 부록 C.35). 디자인 117: 3줄 + 더 보기
  const tag = vm.decisionReplay ? 'button' : 'div';
  const DEC_PAGE = 3;
  const decShown = more.dec ? vm.decisions : vm.decisions.slice(0, DEC_PAGE);
  const decisions = vm.decisions.length
    ? `${SectionTitle({ title: '내 결정 기록', action: `${vm.decisions.length}번 멈춤` })}<div class="dec-list">${decShown.map((d, i) => `
        <${tag} ${vm.decisionReplay ? `type="button" data-act="dec-replay" data-v="${i}" aria-label="${esc(d.minute)} ${esc(d.scene)} 장면 다시 보기" ` : ''}class="panel dec-row dec-${d.result}"><span class="po-num dec-min">${esc(d.minute)}</span><span class="dec-main"><small>${esc(d.scene)} · ${esc(d.p)}</small><b>${esc(d.choice)} · ${esc(d.label)}</b>${d.flow ? `<small class="dec-flow">${esc(d.flow)}</small>` : ''}</span>
        <span class="dec-res"><span class="dec-res__k">${RES[d.result]}</span><b class="po-num">${esc(d.delta)}</b></span>${vm.decisionReplay ? `<span class="dec-play">${Icon({ name: 'restore', size: 16 })}</span>` : ''}</${tag}>`).join('')}</div>
        <p class="small muted dec-hint">${vm.decisionReplay ? '줄을 누르면 그 장면을 다시 봐요.' : ''}</p>${vm.decisions.length > DEC_PAGE ? Button({ variant: 'ghost', block: true, icon: more.dec ? 'chevron-up' : 'chevron-down', act: 'more', data: { v: 'dec' }, className: 'more-btn', children: more.dec ? '접기' : `${vm.decisions.length - DEC_PAGE}개 더 보기` }) : ''}`
    : '';
  // 쓴 카드도 3줄 + 더 보기 (C.60, 디자인 117 결정 기록과 같은 규칙)
  const cuShown = more.cu ? vm.cardUses : vm.cardUses.slice(0, DEC_PAGE);
  const cardUses = vm.cardUses.length
    // C.70 (디자인 170·160): 분 칸 · 카드 이름 (자동) · 결과, [n장 더 보기]는 판 안 맨 아래
    ? `${SectionTitle({ title: '쓴 카드', action: `${vm.cardUses.length}장` })}${panel(`<div class="dec-list">${cuShown.map((c) => `<div class="cu-row dec-${c.result}">${
      c.minute ? `<span class="po-num cu-min">${esc(c.minute)}</span><span class="grow">${esc(c.name ?? '')}${c.auto ? ' <small>(자동)</small>' : ''}</span>` : `<span>${esc(c.text)}</span>`}<b>${RES[c.result]}</b></div>`).join('')}</div>${
      vm.cardUses.length > DEC_PAGE ? `<button type="button" class="cu-more" data-act="more" data-v="cu">${more.cu ? '접기' : `${vm.cardUses.length - DEC_PAGE}장 더 보기`}${Icon({ name: more.cu ? 'chevron-up' : 'chevron-down', size: 14 })}</button>` : ''}`, 'cu-panel')}`
    : '';
  const jx = jersey ? jerseyPanel(jersey) : '';
  const x = vm.xp;
  // 맨 아래 두 버튼 (C.39): [홈으로] + [다음 경기](주), 시즌 마지막 경기면 [홈으로] + [시즌 요약]
  const home = Button({ variant: 'secondary', size: 'lg', block: true, icon: 'home', act: 'go', data: { to: 'home' }, children: '홈으로' });
  const next = vm.seasonOver
    ? Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'go', data: { to: 'season' }, children: '시즌 요약' })
    : Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'play', children: '다음 경기' });
  const reward = `${SectionTitle({ title: '보상' })}
      ${panel(Meter({ value: x.value, gain: x.levelsGained ? 0 : x.gained, max: x.max, label: `XP +${x.gained} · Lv ${x.level}${x.levelsGained ? ' 레벨 업!' : ''}`, showValue: true, tone: 'xp' }) + deltaLine(delta))}`;
  const btns = `<div class="btn-col">
        ${vm.points > 0 && !vm.banners.some((b) => b.to === 'allocate') ? Button({ variant: 'ghost', block: true, icon: 'levelup', act: 'go', data: { to: 'allocate' }, children: `포인트 찍기 (${vm.points})` }) : ''}
        ${actionRow(home, next)}
      </div>`;
  // PC 2열 (C.61, 폰 2,600px대 → 한 화면): 왼쪽 = 점수 · 하이라이트 · 득점 · 결정 · 쓴 카드, 오른쪽 = 내 기록 · 보상 · 버튼 · 전술 리포트·평균 위치
  if (isWide()) {
    return `${hero}<div class="body mr-body">${pc2(`${head}${rewatch}${banners(vm.banners)}${jx}${goals}${decisions}${cardUses}`, `${my}${reward}${btns}${report}`, 'mr-pc')}</div>`;
  }
  return `
    ${hero}
    <div class="body">
      ${head}
      ${rewatch}
      ${banners(vm.banners)}
      ${jx}
      ${goals}
      ${decisions}
      ${cardUses}
      ${report}
      ${my}
      ${reward}
      ${btns}
    </div>`;
}

const sgn = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

/** 보상 "신뢰도 +n · 위상 +n" 줄 (디자인 170, C.72) */
function deltaLine(d: { trust: number | null; rep: number } | null): string {
  if (!d) return '';
  const parts = [d.trust ? `신뢰도 ${sgn(d.trust)}` : '', d.rep ? `위상 ${sgn(d.rep)}` : ''].filter(Boolean);
  return parts.length ? `<p class="small muted mr-delta">${parts.join(' · ')}</p>` : '';
}
