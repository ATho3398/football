// 홈 (I.3, 디자인 22·25): 다음 경기, 선수 카드, 폼·피로, 시즌 기록, 부상·출장 정지 배너, 버전 표시.
// 캘린더·주전 경쟁·신뢰도·전술 버튼은 아직 없는 기능이라 숨긴다 (I.19)

import {
  BottomSheet, Button, Crest, OptionRow, FatigueGauge, FormIndicator, HeroPanel, IconButton, PlayerCard, SectionTitle, StatChip, TacticChip, esc,
} from '../components';
import type { HomeVM, PositionOptionVM } from '../viewModels';
import { actionRow, banners, panel, startNotice, statTiles, versionFooter } from './common';

export function homeView(vm: HomeVM, extra = ''): string {
  const n = vm.next;
  const hero = HeroPanel({
    title: '홈', back: false, rightHtml: IconButton({ act: 'go', data: { to: 'saves' }, name: 'disk', label: '저장', variant: 'ghost' }),
    eyebrow: vm.phase === 'season' ? `${vm.season} 시즌 · 라운드` : `${vm.season} 시즌 · 비시즌`,
    value: vm.phase === 'season' ? vm.round : '비시즌', pad: false, total: vm.phase === 'season' ? vm.rounds : undefined, progress: false,
    chips: n ? [n.out ? '이번 주 결장' : '이번 주 경기', { label: `리그 ${vm.round}R ${n.opp}전`, soft: true }] : [{ label: '시즌 종료', soft: true }],
  });

  let next = '';
  if (n) {
    next = `
      <p class="line">다음 일정 · <b>리그 ${vm.round}R ${esc(n.opp)}전 · ${n.home ? '홈' : '원정'}</b></p>
      ${actionRow(
        Button({ variant: 'secondary', size: 'lg', block: true, icon: 'ff', act: 'sim-rest', children: '남은 시즌 자동' }),
        Button({ variant: n.out ? 'secondary' : 'primary', size: 'lg', block: true, icon: n.out ? 'match' : 'play', act: 'play', children: n.out ? '결장(관전)' : '경기 시작' }),
      )}
      ${SectionTitle({ title: '다음 경기', action: `리그 ${vm.round}R · ${n.home ? '홈' : '원정'}` })}
      ${panel(`
        <div class="vs-row"><span class="vs-team">${Crest({ name: n.my, size: 24 })}${esc(n.my)}</span><span class="vs po-num">VS</span><span class="vs-team away">${esc(n.opp)}${Crest({ name: n.opp, size: 24, color: 'var(--away)' })}</span></div>
        <div class="sub-panel">
          <div class="kv"><span>우리 전술</span><span class="kv-r">${n.myTactic ? TacticChip({ size: 'sm', ...n.myTactic }) : ''}${
            n.tacticsOpen ? Button({ size: 'sm', variant: 'secondary', icon: 'tactic', act: 'tac-open', children: '전술' }) : ''}</span></div>
          <div class="divider"></div>
          <div class="kv"><span>상대 전술</span>${n.oppTactic ? TacticChip({ size: 'sm', team: n.opp, away: true, ...n.oppTactic }) : ''}</div>
          <div class="divider"></div>
          <div class="kv"><span>팀 전력</span><span class="po-num">${n.myRating} <span class="faint">vs</span> ${n.oppRating}</span></div>
        </div>`)}`;
  } else if (vm.phase === 'offseason') {
    next = `${SectionTitle({ title: '비시즌' })}${panel(`<p class="muted">${esc(vm.season)} 시즌이 끝났어요. 시즌 요약을 보고 다음 시즌을 시작해요.</p>
      ${Button({ size: 'lg', block: true, icon: 'chevron-right', act: 'go', data: { to: 'season' }, children: '시즌 종료 요약' })}`)}`;
  }

  const c = vm.condition;
  return `
    ${hero}
    <div class="body">
      ${banners(vm.banners)}
      ${startNotice(vm.version)}
      ${next}
      ${extra}
      ${SectionTitle({ title: '내 상태' })}
      ${panel(`
        <div class="kv">${FatigueGauge({ value: c.fatigue })}${StatChip({ icon: 'card', label: '경고', value: `${c.yellows}/${c.yellowEvery}`, tone: c.yellows >= c.yellowEvery - 1 ? 'warning' : 'neutral' })}</div>
        <div class="kv">${FormIndicator({ level: c.form })}<span class="muted small">${esc(c.formLabel)}</span></div>`)}
      ${SectionTitle({ title: '선수 카드' })}
      ${PlayerCard({ player: vm.card })}
      ${SectionTitle({ title: '이번 시즌', action: `선발 ${vm.stats.starts}경기` })}
      ${statTiles([{ value: vm.stats.apps, label: '출전' }, { value: vm.stats.goals, label: '골', hi: true }, { value: vm.stats.assists, label: '도움' }, { value: vm.stats.avg, label: '평균 평점' }])}
      ${versionFooter(vm.version)}
    </div>`;
}

/** 비시즌 "주 포지션 변경 요청" (부록 D.3): 홈 섹션 + 바텀시트 */
export function positionChangeSection(current: string, prof: number): string {
  return `${SectionTitle({ title: '주 포지션 변경 요청', action: '비시즌에만' })}
    ${OptionRow({ icon: 'player', title: `지금 주 포지션 ${current}`, desc: `숙련도 ${prof}. 바꾸면 새 포지션 OVR로 선발과 평점을 따져요. 비용은 숙련도 페널티뿐이에요.`, right: Button({ variant: 'secondary', size: 'sm', act: 'pos-open', children: '요청' }) })}`;
}

export function positionSheet(options: PositionOptionVM[], pick: string): string {
  const cur = options.find((o) => o.current)!;
  const sel = options.find((o) => o.pos === pick) ?? cur;
  return BottomSheet({
    eyebrow: '비시즌', title: '주 포지션 변경 요청', subtitle: '항상 허용돼요. 숙련도가 낮은 포지션은 OVR이 낮아지고, 그 포지션으로 뛸수록 숙련도가 올라요.',
    onClose: { act: 'sheet-close' },
    children: options.map((o) => OptionRow({
      act: 'pos-pick', data: { v: o.pos }, radio: true, selected: o.pos === sel.pos, title: `${o.pos} · ${o.ko}`,
      desc: `숙련도 ${o.prof}${o.penalty ? ` · OVR −${o.penalty}` : ''}`, ...(o.current ? { tag: '지금' } : {}), right: `<b class="po-num">${o.ovr}</b>`,
    })).join(''),
    footer: Button({ size: 'lg', block: true, act: 'pos-change', data: { v: sel.pos }, disabled: sel.current, children: sel.current ? '바꿀 포지션을 골라요' : `${sel.pos}로 변경 · OVR ${cur.ovr} → ${sel.ovr}` }),
  });
}
