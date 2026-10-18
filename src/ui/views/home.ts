// 홈 (I.3, 디자인 22·25 → C.57 디자인 86~90·132·133, B 머리말): 미페 머리말, 1군 테스트 띠, 알림, 다음 경기, 오늘 훈련 한 줄, 내 상태, 선수 카드, 시즌 기록, 버전.
// 캘린더·주전 경쟁·신뢰도·전술 버튼은 아직 없는 기능이라 숨긴다 (I.19)

import {
  BottomSheet, Button, Crest, Tabs, OptionRow, FormIndicator, HeroPanel, IconButton, Icon, PlayerCard, SectionTitle, TacticChip, esc, staminaOf, type IconName,
} from '../components';
import { BALANCE } from '../../config/balance';
import { heroFaceOf } from '../faces';
import { isWide, skin } from '../skin';
import type { DayVM, HomeVM, PositionOptionVM, TrialVM } from '../viewModels';
import { actionRow, banners, panel, pc2, startNotice, statTiles, versionFooter } from './common';

/** 미페 머리말을 쓰는지 (C.57): B 테마 + 폰 폭 + 내 선수 사진(페이스온 > facepack)이 있을 때. A 테마·PC(디자인 120 = 일반 B 머리말)·사진 없음은 일반 머리말 */
export function homeFace(vm: HomeVM): { src: string; cutout: boolean } | null {
  if (skin() !== 'b' || isWide()) return null;
  return heroFaceOf(vm.card.face);
}

/** 머리말 칩: 경기까지 n일 · 리그 n/38R · 찍을 포인트 */
function heroChips(vm: HomeVM): (string | { label: string; soft?: boolean })[] {
  const n = vm.next;
  return [
    ...(n && vm.day
      ? [vm.day.matchDay ? (n.out ? '오늘 결장' : '오늘 경기') : `경기까지 ${vm.day.daysTo}일`, { label: `리그 ${vm.round}/${vm.rounds}R`, soft: true }]
      : [{ label: '시즌 종료', soft: true }]),
    ...(vm.points > 0 ? [`찍을 포인트 ${vm.points}P`] : []),
  ];
}

export function homeView(vm: HomeVM, extra = '', notice = '', training = '', top = '', unread: number | null = null): string {
  const n = vm.next;
  // 인박스 (C.63): 홈 상단 알림 아이콘 (20.4)
  const bell = unread !== null ? IconButton({ act: 'go', data: { to: 'inbox' }, name: 'bell', label: `인박스${unread ? ` 안 읽음 ${unread}` : ''}`, variant: 'ghost', badge: unread }) : '';
  const tools = bell + IconButton({ act: 'go', data: { to: 'saves' }, name: 'disk', label: '저장', variant: 'ghost' }) + IconButton({ act: 'go', data: { to: 'settings' }, name: 'settings', label: '설정', variant: 'ghost' });
  const face = homeFace(vm);
  // C.57 (디자인 B 86·132): 사진이 있으면 미페 머리말(등번호 · 사진 · 이름 · OVR), 없으면 C.39 작은 머리말(날짜 한 줄)
  const hero = face
    ? HeroPanel({
      title: '홈', back: false, face: face.src, cutout: face.cutout, kit: vm.kit, name: vm.card.name,
      eyebrow: vm.trial ? `${vm.team} · 1군 테스트 ${vm.trial.games}/${vm.trial.need}` : `${vm.team} · ${vm.card.position}`,
      rightHtml: `<span class="hm-date">${esc(vm.day ? vm.day.short : '비시즌')}${vm.day ? ` (${esc(vm.day.weekdayKo.slice(0, 1))})` : ''}</span>${tools}`,
      value: vm.card.ovr, unit: `OVR · ${vm.card.position}`, chips: heroChips(vm),
    })
    : HeroPanel({
      title: '홈', back: false, compact: true, rightHtml: tools,
      eyebrow: vm.day ? `${vm.season} 시즌 · ${vm.day.full}` : `${vm.season} 시즌 · 비시즌`,
      value: vm.day ? vm.day.short : '비시즌', pad: false, progress: false, chips: heroChips(vm),
    });

  let next = '';
  if (n && vm.day) {
    const d = vm.day;
    // 하루 단위 진행 (C.38) · 디자인 86: [계속 · 계획대로 진행] 큰 버튼 + [하루 진행][자동 진행]. 경기 날은 [경기 시작] → 경기 준비 (C.51)
    const main = d.matchDay
      ? Button({ variant: n.out ? 'secondary' : 'primary', size: 'lg', block: true, icon: n.out ? 'match' : 'play', act: 'play', children: n.out ? '결장(관전)' : '경기 시작' })
      : Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'day-continue', children: '계속 · 계획대로 진행' });
    const subs = d.matchDay
      ? Button({ variant: 'secondary', block: true, icon: 'ff', act: 'sim-rest', children: '자동 진행' })
      : Button({ variant: 'secondary', block: true, icon: 'clock', act: 'day-one', children: '하루 진행' }) + Button({ variant: 'secondary', block: true, icon: 'ff', act: 'sim-rest', children: '자동 진행' });
    const pct = Math.round((n.myRating / Math.max(1, n.myRating + n.oppRating)) * 1000) / 10;
    next = panel(`
        <div class="hm-head"><span class="hm-title">다음 경기 <span>· 리그 ${vm.round}R · ${n.home ? '홈' : '원정'}</span></span><span class="hm-sub">${d.matchDay ? '오늘' : esc(vm.nextDate ?? d.nextLabel ?? '')}</span></div>
        ${n.derby ? `<div class="derby-badge${n.derby.big ? ' is-big' : ''}">${Icon({ name: 'star', size: 14, strokeWidth: 2.4 })}<b>${esc(n.derby.name)}</b><span>더비 매치</span></div>` : ''}
        <div class="vs-row"><span class="vs-team">${Crest({ name: n.my, size: 24 })}<span class="vs-name">${esc(n.my)}</span></span><span class="vs">vs</span><span class="vs-team away"><span class="vs-name">${esc(n.opp)}</span>${Crest({ name: n.opp, size: 24, color: 'var(--away)' })}</span></div>
        <div class="hm-power"><span>전력 <b class="po-num">${n.myRating}</b></span><span class="hm-power__bar" aria-hidden="true"><i style="width:${pct}%"></i><i></i></span><b class="po-num away">${n.oppRating}</b></div>
        <div class="hm-tac">${n.myTactic ? TacticChip({ size: 'sm', ...n.myTactic }) : ''}<span class="vs">vs</span>${n.oppTactic ? TacticChip({ size: 'sm', team: n.opp, away: true, ...n.oppTactic }) : ''}<span class="grow"></span>${
          n.tacticsOpen ? Button({ size: 'sm', variant: 'ghost', icon: 'tactic', act: 'tac-open', children: '전술' }) : ''}</div>
        <p class="small muted hm-note">플레이 방식(직접·자동)·덱·내 자리는 [경기 시작] 뒤 경기 준비에서 정해요.</p>
        <div class="hm-btns">${main}<div class="hm-btns__row">${subs}</div></div>`, 'next-card');
  } else if (vm.phase === 'offseason') {
    next = `${SectionTitle({ title: '비시즌 휴가' })}${panel(`<p class="muted">${esc(vm.season)} 시즌이 끝났어요. 휴가 중에는 훈련 선택이 없고 체력이 회복돼요.</p>
      ${vm.camp ? `<p class="small"><b>${esc(vm.camp)} 소집</b> · 개막 7일 전부터 훈련 계획과 첫 경기를 준비해요. 시즌 요약에서 [새 시즌 시작]을 누르면 소집일로 넘어가요.</p>` : ''}
      ${Button({ size: 'lg', block: true, icon: 'trophy', act: 'go', data: { to: 'season' }, children: '시즌 종료 요약' })}`)}`;
  }

  const c = vm.condition;
  const stamina = staminaOf(c.fatigue);
  const cond = panel(`
        <div class="hm-head"><span class="hm-title">내 상태</span><span class="hm-sub">경고 <b class="po-num">${c.yellows}/${c.yellowEvery}</b></span></div>
        <div class="hm-stamina"><span>체력</span><span class="hm-stamina__bar" aria-hidden="true"><i class="${stamina <= 30 ? 'is-low' : stamina < 100 - BALANCE.fatigue.penaltyFrom ? 'is-mid' : ''}" style="width:${stamina}%"></i></span><b class="po-num">${stamina}</b></div>
        <div class="hm-stamina__scale"><span>100 · 가득</span><span>50</span><span>0 · 못 뜀</span></div>
        ${staminaNote(c.fatigue)}
        ${c.life?.length ? `<div class="lf-hints">${c.life.map((h) => `<p class="small warn">${Icon({ name: 'face', size: 14 })} ${esc(h)}</p>`).join('')}</div>` : ''}
        <div class="kv">${FormIndicator({ level: c.form, showLabel: true })}<span class="muted small">${esc(c.formLabel)}</span></div>`, 'hm-cond');
  const card = PlayerCard({ player: vm.card, variant: 'compact' });
  const tiles = statTiles([{ value: vm.stats.apps, label: '출전' }, { value: vm.stats.goals, label: '골', hi: true }, { value: vm.stats.assists, label: '도움' }, { value: vm.stats.avg, label: '평균 평점' }]);
  const main = `${vm.trial ? trialStrip(vm.trial) : ''}${top}${banners(vm.banners)}${startNotice(vm.version)}${next}${notice}${training}${extra}`;
  // PC 2열 (C.61 디자인 120): 왼쪽 = 다음 경기 · 오늘 훈련 · 알림, 오른쪽 = 선수 카드 · 이번 시즌 4칸 · 내 상태 · 버전
  if (isWide()) return `${hero}<div class="body home-body">${pc2(main, `${card}${tiles}${cond}${versionFooter(vm.version)}`, 'hm-pc')}</div>`;
  return `
    ${hero}
    <div class="body home-body">
      ${main}
      ${cond}
      ${card}
      ${tiles}
      ${versionFooter(vm.version)}
    </div>`;
}

/** 1군 테스트 띠 (C.45 10번 · 디자인 132): 경기별 평점 칸 n/3, 방출·합격 선 위 지금 평균 */
export function trialStrip(t: TrialVM): string {
  const lo = 5, hi = 8;
  const at = (v: number) => Math.round(((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 1000) / 10;
  const cells = t.cells.map((c) => `<div class="ft-cell${c.next ? ' is-next' : ''}"><span>${esc(c.label)}</span><b class="po-num">${c.rating != null ? c.rating.toFixed(1) : '—'}</b></div>`).join('');
  return `<section class="panel ft-strip" role="status">
    <div class="ft-head">${Icon({ name: 'target', size: 18 })}<b class="grow">${esc(t.team)} 1군 테스트 · <span class="po-num">${t.games}/${t.need}</span>경기${t.extended ? ' · 연장' : ''}</b><span class="small muted">평균 평점 <b class="po-num">${t.avg != null ? t.avg.toFixed(1) : '-'}</b></span></div>
    <div class="ft-cells" style="grid-template-columns:repeat(${Math.min(t.cells.length, 5)},minmax(0,1fr))">${cells}</div>
    <div class="ft-bar" aria-hidden="true"><span class="ft-bar__track"><i class="cut" style="width:${at(t.cut)}%"></i><i class="pass" style="left:${at(t.pass)}%"></i></span>${
      t.avg != null ? `<span class="ft-bar__mark" style="left:${at(t.avg)}%"></span><span class="ft-bar__val po-num" style="left:${at(t.avg)}%">${t.avg.toFixed(1)}</span>` : ''}<span class="ft-bar__lbl fail" style="left:${at(t.cut)}%">${t.cut.toFixed(1)} 방출</span><span class="ft-bar__lbl ok" style="left:${at(t.pass)}%">${t.pass.toFixed(1)} 합격</span></div>
    <p class="ft-rule">테스트 중에는 출전이 보장돼요. 평균 ${t.pass.toFixed(1)} 이상 합격, ${t.cut.toFixed(1)} 미만·공격포인트 0이면 방출, 그 사이면 연장(최대 ${t.maxGames}경기). ${t.goals}골 ${t.assists}도움.</p>
  </section>`;
}

/** 홈 알림 카드 (디자인 133): 아이콘 · 머리 · 제목 · 내용 · 닫기. 쌓이면 위에 "알림 n · 모두 닫기" */
export function alertCard(p: { icon: IconName; eyebrow: string; title: string; body: string; chips?: string; close: string; tone?: 'info' | 'news' }): string {
  return `<div class="panel hm-alert hm-alert--${p.tone ?? 'info'}" role="status"><span class="hm-alert__icon">${Icon({ name: p.icon, size: 18 })}</span>
    <div class="hm-alert__body"><span class="hm-alert__eyebrow">${esc(p.eyebrow)}</span>${p.chips ?? ''}<b>${esc(p.title)}</b><p>${esc(p.body)}</p></div>
    <button type="button" class="hm-alert__x" data-act="${esc(p.close)}" aria-label="닫기">${Icon({ name: 'close', size: 16 })}</button></div>`;
}

export function alertsHead(count: number): string {
  return count >= 2 ? `<div class="hm-alerts-head"><b>알림 <span class="po-num">${count}</span></b><button type="button" class="link-btn" data-act="alerts-close">모두 닫기</button></div>` : '';
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
  const list = d.upcoming.map((u) => `<li class="cal-item cal-${u.kind}"><span class="cal-date">${esc(u.date)}</span>${u.team ? `<button type="button" class="dt-link grow" data-act="team-open" data-v="${esc(u.team)}">${esc(u.text)}</button>` : `<span class="grow">${esc(u.text)}</span>`}${u.sub ? `<span class="cal-tag">${esc(u.sub)}</span>` : ''}</li>`).join('');
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
export function scheduleView(vm: HomeVM, training: string, calendar = true): string {
  const hero = HeroPanel({
    title: '훈련·일정', back: false, compact: true,
    eyebrow: vm.day ? `${vm.season} 시즌 · ${vm.day.full}` : `${vm.season} 시즌 · 비시즌`,
    value: vm.day ? vm.day.short : '비시즌', pad: false, progress: false,
    chips: vm.day ? [vm.day.matchDay ? '오늘 경기' : `경기까지 ${vm.day.daysTo}일`, { label: `리그 ${vm.round}/${vm.rounds}R`, soft: true }] : [{ label: '시즌 종료', soft: true }],
  });
  const off = vm.phase === 'offseason'
    ? panel(`<p class="muted">비시즌 휴가 중이에요. 훈련 선택이 없고 체력이 회복돼요.${vm.camp ? ` ${esc(vm.camp)} 소집부터 훈련 계획이 다시 시작돼요.` : ''}</p>`)
    : '';
  return `${hero}<div class="body">${off}${training}${vm.day && calendar ? calendarSection(vm.day) : ''}${versionFooter(vm.version)}</div>`;
}
