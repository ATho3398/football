// 경기 후 (I.6, 디자인 38): 스코어·평점, 하이라이트, 전술 리포트(21.5.2: 판정 카드 최대 2장 + 숫자 줄), 평균 위치 지도, XP.
// 내 결정 기록 (E.11, I.17 10번, 직접 모드로 멈춘 순간). 카드·신뢰도는 아직 없는 기능이라 숨긴다

import { Button, esc, FeedItem, HeroPanel, Meter, Pitch, PossessionBar, SectionTitle, StatChip, TacticChip } from '../components';
import type { MatchResultVM } from '../viewModels';
import { banners, moreRecords, panel } from './common';

function cmpRow(label: string, own: string, opp: string): string {
  const a = parseFloat(own) || 0;
  const b = parseFloat(opp) || 0;
  const m = Math.max(a, b, 1e-9);
  return `<div class="cmp"><div class="cmp__head"><b class="po-num">${esc(own)}</b><span>${esc(label)}</span><b class="po-num away">${esc(opp)}</b></div>
    <div class="cmp__bars"><span class="l"><i style="width:${(a / m) * 100}%"></i></span><span class="r"><i style="width:${(b / m) * 100}%"></i></span></div></div>`;
}

export function matchResultView(vm: MatchResultVM): string {
  const hero = HeroPanel({
    title: '경기 결과', right: `리그 ${vm.round}R`, back: { act: 'go', data: { to: 'home' } },
    eyebrow: `${vm.opp}전 ${vm.scoreLine} ${vm.outcomeKo} · 내 평점`,
    value: vm.rating === null ? '-' : vm.rating.toFixed(1), pad: false, progress: false,
    chips: vm.chips.map((c, i) => (i === vm.chips.length - 1 ? { label: c, soft: true } : c)),
  });
  const hl = vm.highlights.length
    ? `${SectionTitle({ title: '하이라이트', action: `${vm.highlights.length}장면` })}<div class="feed">${vm.highlights.map((f) => FeedItem(f)).join('')}</div>`
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
        ${vm.hasAvgMap ? `<div class="divider"></div><div class="kv"><b class="small">평균 위치</b><span class="muted small">우리 공격 방향 →</span></div>${Pitch({ canvasId: 'avg-canvas', label: '양 팀 평균 위치' })}` : ''}
      `, 'report')}`;
  }
  const my = vm.my.length
    ? `${SectionTitle({ title: '내 기록', action: vm.appearance })}<div class="chips">${vm.my.map((m) => StatChip({ label: m.label, value: m.value })).join('')}${
      vm.formBonus ? StatChip({ label: '폼 보정', value: `${vm.formBonus > 0 ? '+' : '−'}${Math.abs(vm.formBonus).toFixed(2)}`, tone: vm.formBonus > 0 ? 'success' : 'fail' }) : ''}</div>${moreRecords(vm.myMore)}`
    : '';
  const RES = { success: '성공', fail: '실패', neutral: '보통' } as const;
  // 줄을 누르면 그 장면 리플레이 (E5 최소, 부록 C.35)
  const tag = vm.decisionReplay ? 'button' : 'div';
  const decisions = vm.decisions.length
    ? `${SectionTitle({ title: '내 결정 기록', action: `${vm.decisions.length}번 멈춤` })}${panel(`<div class="dec-list">${vm.decisions.map((d, i) => `
        <${tag} ${vm.decisionReplay ? `type="button" data-act="dec-replay" data-v="${i}" aria-label="${esc(d.minute)} ${esc(d.scene)} 장면 다시 보기" ` : ''}class="dec-row dec-${d.result}"><span class="po-num dec-min">${esc(d.minute)}</span><span class="dec-main"><b>${esc(d.scene)}</b> · ${esc(d.choice)} · ${esc(d.label)}${d.flow ? `<small class="dec-flow">${esc(d.flow)}</small>` : ''}</span>
        <span class="dec-res"><span class="po-num">${esc(d.p)}</span> ${RES[d.result]} <b class="po-num">${esc(d.delta)}</b>${vm.decisionReplay ? ' <span class="dec-play">▶</span>' : ''}</span></${tag}>`).join('')}</div>${vm.decisionReplay ? '<p class="small muted dec-hint">줄을 누르면 그 장면을 다시 봐요.</p>' : ''}`)}`
    : '';
  const cardUses = vm.cardUses.length
    ? `${SectionTitle({ title: '쓴 카드', action: `${vm.cardUses.length}장` })}${panel(`<div class="dec-list">${vm.cardUses.map((c) => `<div class="cu-row dec-${c.result}"><span>${esc(c.text)}</span><b>${RES[c.result]}</b></div>`).join('')}</div>`)}`
    : '';
  const x = vm.xp;
  const next = vm.seasonOver
    ? Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'go', data: { to: 'season' }, children: '시즌 종료 요약' })
    : Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'play', children: '다음 경기' });
  return `
    ${hero}
    <div class="body">
      ${banners(vm.banners)}
      ${hl}
      ${decisions}
      ${cardUses}
      ${report}
      ${my}
      ${SectionTitle({ title: '보상' })}
      ${panel(Meter({ value: x.value, gain: x.levelsGained ? 0 : x.gained, max: x.max, label: `XP +${x.gained} · Lv ${x.level}${x.levelsGained ? ' 레벨 업!' : ''}`, showValue: true, tone: 'xp' }))}
      <div class="btn-col">
        ${vm.points > 0 ? Button({ variant: 'secondary', size: 'lg', block: true, icon: 'levelup', act: 'go', data: { to: 'allocate' }, children: `포인트 찍기 (${vm.points})` }) : ''}
        ${next}
      </div>
    </div>`;
}
