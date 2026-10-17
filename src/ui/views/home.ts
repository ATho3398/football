// 홈 (I.3, 디자인 22·25): 다음 경기, 선수 카드, 폼·피로, 시즌 기록, 부상·출장 정지 배너, 버전 표시.
// 캘린더·주전 경쟁·신뢰도·전술 버튼은 아직 없는 기능이라 숨긴다 (I.19)

import {
  BottomSheet, Button, Crest, Tabs, OptionRow, FatigueGauge, FormIndicator, HeroPanel, IconButton, Icon, PlayerCard, SectionTitle, StatChip, TacticChip, esc, staminaOf,
} from '../components';
import { BALANCE } from '../../config/balance';
import type { DayVM, HomeVM, PositionOptionVM } from '../viewModels';
import { actionRow, banners, panel, startNotice, statTiles, versionFooter } from './common';

export function homeView(vm: HomeVM, extra = '', notice = '', training = '', top = ''): string {
  const n = vm.next;
  // C.39: 머리말은 작게(날짜 한 줄), "다음 경기" 카드를 맨 위로. 남은 포인트는 머리말 칩으로도
  const hero = HeroPanel({
    title: '홈', back: false, compact: true, rightHtml: IconButton({ act: 'go', data: { to: 'saves' }, name: 'disk', label: '저장', variant: 'ghost' }) + IconButton({ act: 'go', data: { to: 'settings' }, name: 'settings', label: '설정', variant: 'ghost' }),
    eyebrow: vm.day ? `${vm.season} 시즌 · ${vm.day.year}년 ${vm.day.weekdayKo}` : `${vm.season} 시즌 · 비시즌`,
    value: vm.day ? vm.day.short : '비시즌', pad: false, progress: false,
    chips: [
      ...(n && vm.day
        ? [vm.day.matchDay ? (n.out ? '오늘 결장' : '오늘 경기') : `경기까지 ${vm.day.daysTo}일`, { label: `리그 ${vm.round}/${vm.rounds}R`, soft: true }]
        : [{ label: '시즌 종료', soft: true }]),
      ...(vm.points > 0 ? [`찍을 포인트 ${vm.points}P`] : []),
    ],
  });

  let next = '';
  if (n && vm.day) {
    const d = vm.day;
    // 하루 단위 진행 (부록 C.38): 경기 날이면 경기 시작, 아니면 [계속](다음 일정까지)·[하루 진행]. [남은 시즌 자동]은 작은 보조 버튼 (C.39)
    const buttons = d.matchDay
      ? Button({ variant: n.out ? 'secondary' : 'primary', size: 'lg', block: true, icon: n.out ? 'match' : 'play', act: 'play', children: n.out ? '결장(관전)' : '경기 시작' })
      : actionRow(
        Button({ variant: 'secondary', size: 'lg', block: true, icon: 'clock', act: 'day-one', children: '하루 진행' }),
        Button({ size: 'lg', block: true, icon: 'chevron-right', act: 'day-continue', children: '계속' }),
      );
    next = `
      ${SectionTitle({ title: '다음 경기', action: `리그 ${vm.round}R · ${n.home ? '홈' : '원정'}` })}
      ${panel(`${n.derby ? `<div class="derby-badge${n.derby.big ? ' is-big' : ''}">${Icon({ name: 'star', size: 14, strokeWidth: 2.4 })}<b>${esc(n.derby.name)}</b><span>더비 매치</span></div>` : ''}
        <div class="vs-row"><span class="vs-team">${Crest({ name: n.my, size: 24 })}${esc(n.my)}</span><span class="vs po-num">VS</span><span class="vs-team away">${esc(n.opp)}${Crest({ name: n.opp, size: 24, color: 'var(--away)' })}</span></div>
        <p class="line">${d.matchDay ? '오늘' : `다음 일정 · ${esc(d.nextLabel ?? '')}`} · <b>리그 ${vm.round}R ${esc(n.opp)}전 · ${n.home ? '홈' : '원정'}</b> · 전력 <b class="po-num">${n.myRating}</b> vs <b class="po-num">${n.oppRating}</b></p>
        ${buttons}
        <div class="sim-rest">${Button({ variant: 'ghost', size: 'sm', icon: 'ff', act: 'sim-rest', children: '자동 진행' })}</div>`, 'next-card')}
      ${panel(`
        <div class="sub-panel">
          <div class="kv"><span>우리 전술</span><span class="kv-r">${n.myTactic ? TacticChip({ size: 'sm', ...n.myTactic }) : ''}${
            n.tacticsOpen ? Button({ size: 'sm', variant: 'secondary', icon: 'tactic', act: 'tac-open', children: '전술' }) : ''}</span></div>
          <div class="divider"></div>
          <div class="kv"><span>상대 전술</span>${n.oppTactic ? TacticChip({ size: 'sm', team: n.opp, away: true, ...n.oppTactic }) : ''}</div>
        </div>
        <p class="small muted">플레이 방식(직접·자동)·덱·내 자리는 [경기 시작] 뒤 경기 준비에서 정해요.</p>`)}`;
  } else if (vm.phase === 'offseason') {
    next = `${SectionTitle({ title: '비시즌 휴가' })}${panel(`<p class="muted">${esc(vm.season)} 시즌이 끝났어요. 휴가 중에는 훈련 선택이 없고 체력이 회복돼요.</p>
      ${vm.camp ? `<p class="small"><b>${esc(vm.camp)} 소집</b> · 개막 7일 전부터 훈련 계획과 첫 경기를 준비해요. 시즌 요약에서 [새 시즌 시작]을 누르면 소집일로 넘어가요.</p>` : ''}
      ${Button({ size: 'lg', block: true, icon: 'chevron-right', act: 'go', data: { to: 'season' }, children: '시즌 종료 요약' })}`)}`;
  }

  const c = vm.condition;
  return `
    ${hero}
    <div class="body">
      ${top}
      ${next}
      ${banners(vm.banners)}
      ${startNotice(vm.version)}
      ${notice}
      ${training}
      ${vm.day ? `<div class="sched-link">${Button({ variant: 'ghost', size: 'sm', icon: 'calendar', act: 'go-tab', data: { v: 'schedule' }, children: '훈련·일정 전체 보기' })}</div>` : ''}
      ${extra}
      ${SectionTitle({ title: '내 상태' })}
      ${panel(`
        <div class="kv">${FatigueGauge({ value: c.fatigue })}${StatChip({ icon: 'card', label: '경고', value: `${c.yellows}/${c.yellowEvery}`, tone: c.yellows >= c.yellowEvery - 1 ? 'warning' : 'neutral' })}</div>
        ${staminaNote(c.fatigue)}
        <div class="kv">${FormIndicator({ level: c.form })}<span class="muted small">${esc(c.formLabel)}</span></div>`)}
      ${SectionTitle({ title: '선수 카드' })}
      ${PlayerCard({ player: vm.card })}
      ${SectionTitle({ title: '이번 시즌', action: `선발 ${vm.stats.starts}경기` })}
      ${statTiles([{ value: vm.stats.apps, label: '출전' }, { value: vm.stats.goals, label: '골', hi: true }, { value: vm.stats.assists, label: '도움' }, { value: vm.stats.avg, label: '평균 평점' }])}
      ${versionFooter(vm.version)}
    </div>`;
}

/** 체력 안내 (C.44): 체력 = 100 − 피로. 피로 penaltyFrom(50) 초과 = 체력 50 미만이면 평점·선발에 불리 */
export function staminaNote(fatigue: number): string {
  const v = staminaOf(fatigue);
  const from = 100 - BALANCE.fatigue.penaltyFrom;
  if (v <= 30) return `<p class="small fail">체력 30 이하 · 평점과 선발 확률이 떨어지고 다칠 확률이 올라가요. 휴식·회복 훈련을 넣어요.</p>`;
  if (v < from) return `<p class="small warn">체력 ${from} 아래 · 평점과 선발 확률이 조금 떨어져요.</p>`;
  return '';
}

/** 포변 조언 홈 알림 카드 (pending 36 ⑥, 부록 C.37). 인박스(5-2)가 생기면 그쪽으로 옮긴다 */
export interface AdviceCardVM { kind: 'coach' | 'news'; eyebrow: string; title: string; body: string; window: string; pos: string }

export function adviceCard(vm: AdviceCardVM): string {
  return `<div class="panel advice-card advice-${vm.kind}" role="status">
    <div class="advice-head"><span class="advice-eyebrow">${esc(vm.eyebrow)}</span><button type="button" class="advice-x" data-act="advice-close" aria-label="닫기">×</button></div>
    <b class="advice-title">${esc(vm.title)}</b>
    <p class="small">${esc(vm.body)}</p>
    <p class="small muted">${esc(vm.window)}</p>
    ${actionRow(
      Button({ variant: 'secondary', size: 'sm', block: true, act: 'advice-close', children: '닫기' }),
      Button({ size: 'sm', block: true, act: 'pos-open', data: { v: vm.pos }, children: `${vm.pos} 포지션 보기` }),
    )}
  </div>`;
}

/** "주 포지션 변경 요청" (부록 D.3): 홈 섹션 + 바텀시트. 비시즌, 포변 조언 기간에는 시즌 중에도 (C.37) */
export function positionChangeSection(current: string, prof: number, advice = false): string {
  return `${SectionTitle({ title: '주 포지션 변경 요청', action: advice ? '조언 기간에는 시즌 중에도' : '비시즌에만' })}
    ${OptionRow({ icon: 'player', title: `지금 주 포지션 ${current}`, desc: `숙련도 ${prof}. 바꾸면 새 포지션 OVR로 선발과 평점을 따져요. 비용은 숙련도 페널티뿐이에요.`, right: Button({ variant: 'secondary', size: 'sm', act: 'pos-open', children: '요청' }) })}`;
}

export function positionSheet(options: PositionOptionVM[], pick: string, inSeason = false): string {
  const cur = options.find((o) => o.current)!;
  const sel = options.find((o) => o.pos === pick) ?? cur;
  return BottomSheet({
    eyebrow: inSeason ? '포변 조언 기간' : '비시즌', title: '주 포지션 변경 요청', subtitle: '항상 허용돼요. 숙련도가 낮은 포지션은 OVR이 낮아지고, 그 포지션으로 뛸수록 숙련도가 올라요.',
    onClose: { act: 'sheet-close' },
    children: options.map((o) => OptionRow({
      act: 'pos-pick', data: { v: o.pos }, radio: true, selected: o.pos === sel.pos, title: `${o.pos} · ${o.ko}`,
      desc: `숙련도 ${o.prof}${o.penalty ? ` · OVR −${o.penalty}` : ''}`, ...(o.current ? { tag: '지금' } : {}), right: `<b class="po-num">${o.ovr}</b>`,
    })).join(''),
    footer: Button({ size: 'lg', block: true, act: 'pos-change', data: { v: sel.pos }, disabled: sel.current, children: sel.current ? '바꿀 포지션을 골라요' : `${sel.pos}로 변경 · OVR ${cur.ovr} → ${sel.ovr}` }),
  });
}

/** 일정 (부록 C.38): 다음 일정 목록, 이번 달 달력, 다른 경기 계산 방식 */
export function calendarSection(d: DayVM): string {
  const list = d.upcoming.map((u) => `<li class="cal-item cal-${u.kind}"><span class="cal-date">${esc(u.date)}</span><span class="grow">${esc(u.text)}</span>${u.sub ? `<span class="cal-tag">${esc(u.sub)}</span>` : ''}</li>`).join('');
  const blanks = Array.from({ length: d.month.lead }, () => '<span class="cal-cell blank"></span>').join('');
  const cells = d.month.days.map((c) => `<span class="cal-cell${c.kind ? ` k-${c.kind}` : ''}${c.today ? ' today' : ''}${c.past ? ' past' : ''}"${c.title ? ` title="${esc(c.title)}"` : ''}>${c.d}</span>`).join('');
  return `${SectionTitle({ title: '일정', action: d.month.title })}
    ${panel(`<ul class="cal-list">${list}</ul>
      <div class="cal-grid" role="grid" aria-label="${esc(d.month.title)} 달력">${['일', '월', '화', '수', '목', '금', '토'].map((w) => `<span class="cal-wd">${w}</span>`).join('')}${blanks}${cells}</div>
      <div class="legend small"><span><i class="k cal-home"></i>내 경기 (홈)</span><span><i class="k cal-away"></i>원정</span><span><i class="k cal-league"></i>다른 경기</span><span><i class="k cal-break"></i>휴식기</span></div>
      <div class="kv"><span class="small">다른 경기 계산</span>${Tabs({ items: [{ id: 'engine', label: '전체 엔진' }, { id: 'quick', label: '빠른 진행' }], value: d.quick ? 'quick' : 'engine', act: 'opt-quick', label: '다른 경기 계산' })}</div>
      <p class="small muted">${d.quick ? '느린 기기용: 다른 팀 경기를 통계로 바로 계산해요. 선수 기록(득점 순위)은 내 경기만 남아요.' : '다른 팀 경기도 22명 엔진으로 계산해요. 경기 날 [계속]이 몇 초 걸릴 수 있고, 진행 중 [중단]으로 멈출 수 있어요.'}</p>`)}`;
}

/** 훈련·일정 화면 (C.44 독): 오늘 훈련·주간 계획·게이지 + 일정·달력 */
export function scheduleView(vm: HomeVM, training: string): string {
  const hero = HeroPanel({
    title: '훈련·일정', back: false, compact: true,
    eyebrow: vm.day ? `${vm.season} 시즌 · ${vm.day.year}년 ${vm.day.weekdayKo}` : `${vm.season} 시즌 · 비시즌`,
    value: vm.day ? vm.day.short : '비시즌', pad: false, progress: false,
    chips: vm.day ? [vm.day.matchDay ? '오늘 경기' : `경기까지 ${vm.day.daysTo}일`, { label: `리그 ${vm.round}/${vm.rounds}R`, soft: true }] : [{ label: '시즌 종료', soft: true }],
  });
  const off = vm.phase === 'offseason'
    ? panel(`<p class="muted">비시즌 휴가 중이에요. 훈련 선택이 없고 체력이 회복돼요.${vm.camp ? ` ${esc(vm.camp)} 소집부터 훈련 계획이 다시 시작돼요.` : ''}</p>`)
    : '';
  return `${hero}<div class="body">${off}${training}${vm.day ? calendarSection(vm.day) : ''}${versionFooter(vm.version)}</div>`;
}
