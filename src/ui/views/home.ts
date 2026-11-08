// 홈 (I.3, 디자인 22·25 → C.57 디자인 86~90·132·133 → 17차 S06 U17-b): 미페 머리말 + 탭 [오늘][시즌][경쟁] (폰), PC 3열.
// [오늘] 1군 테스트 띠 · 배너 · 다음 경기 · 내 상태 · 가이드 · 알림 · 오늘 훈련 / [시즌] 대회 · 목표 · 시즌 기록 · 덱 · 기록 / [경쟁] 주전 경쟁 · 라이벌

import {
  BottomSheet, Button, Crest, EmptyState, OptionRow, FormIndicator, HeroPanel, Icon, ToolBar, SectionTitle, Tabs, TacticChip, esc, staminaOf, type IconName,
} from '../components';
import { BALANCE } from '../../config/balance';
import { heroFaceOf } from '../faces';
import { isLandPhone, isWide, skin } from '../skin';
import type { DayVM, EnvVM, HomeVM, InjuryReturnVM, PositionOptionVM, RecordTrackVM, TrialVM } from '../viewModels';
import type { WeatherKind } from '../../weather';
import { banners, careerLinks, panel, startNotice, statTiles, versionFooter } from './common';
import { PLAN_ICON } from './training';

/** 미페 머리말을 쓰는지 (C.57 → C.74e PC 도): B 테마 + 내 선수 사진(페이스온 > facepack > 기본 사진)이 있을 때. A 테마·사진 없음·가로 폰(한 줄 머리말, C.74e 범위 밖)은 일반 머리말 */
export function homeFace(vm: HomeVM): { src: string; cutout: boolean } | null {
  if (skin() !== 'b' || isLandPhone()) return null;
  return heroFaceOf(vm.card.face);
}

/** 머리말 칩 (C.70 디자인 161 → 17차 2절 S06 사소): 경기까지 n일 · 다음 nR · 찍을 포인트 nP(라임 칩) */
function heroChips(vm: HomeVM): (string | { label: string; soft?: boolean })[] {
  const n = vm.next;
  // 17차 2절: "11/38R"은 대회 칸(치른 라운드)과 섞여 보였다 → 머리말은 "다음 11R"(리그), 컵·대표팀이면 그 대회 이름
  const nextLabel = /^리그 \d+R$/.test(vm.comp) ? `다음 ${vm.round}R` : `다음 ${vm.comp}`;
  const chips: (string | { label: string; soft?: boolean })[] = [
    ...(n && vm.day
      ? [vm.day.matchDay ? (n.out ? '오늘 결장' : '오늘 경기') : `경기까지 ${vm.day.daysTo}일`, nextLabel]
      : [{ label: vm.summerWait ?? '시즌 종료', soft: true }]),
    // C.76g (디자인 228): 부상 중이면 남은 날 라임 칩
    ...(vm.injuryDays ? [{ label: `부상 · ${vm.injuryDays}일 남음`, soft: true }] : []),
    // 부상 칩이 있으면 포인트 칩은 빼서 3칸(디자인 228) — 포인트는 바로 아래 배너에도 있음.
    // 시즌 중 발롱도르 레이스(C.76t, 파워 랭킹 내 순위)가 있으면 포인트 칩 대신 레이스 칩
    ...(vm.race && !vm.injuryDays ? [{ label: `발롱도르 레이스 ${vm.race}위`, soft: true }] : vm.points > 0 && !vm.injuryDays ? [{ label: `찍을 포인트 ${vm.points}P`, soft: true }] : []),
  ];
  // 챕터 칩 (C.73a)은 칸이 남을 때만 — 한 줄 칩(C.75u)이 4개를 넘으면 모두 말줄임이 돼서 (디자인 211·228 = 3칸)
  return chips.length < 3 ? [...chips, { label: vm.chapter, soft: true }] : chips;
}

/** 홈 탭 (17차 S06, D4): [오늘] 머리말 + 다음 경기 + 내 상태 · [시즌] 대회 · 목표 · 시즌 기록 · [경쟁] 주전 경쟁 · 라이벌 */
export type HomeTab = 'today' | 'season' | 'comp';
export const HOME_TABS: readonly { id: HomeTab; label: string }[] = [{ id: 'today', label: '오늘' }, { id: 'season', label: '시즌' }, { id: 'comp', label: '경쟁' }];

/** 홈에 붙는 조각 (main 이 만든다). 어느 탭(PC 는 어느 열)에 들어갈지는 homeView 가 정한다 */
export interface HomeParts {
  /** [오늘] 첫 시즌 가이드 · 주 포지션 변경 요청 */
  guide?: string;
  /** [오늘] 알림(인박스 최신) · 이적 시장 카드 — PC 는 오른쪽 열 (17차 2절 S06 사소) */
  alerts?: string;
  /** [오늘] 오늘 훈련 한 줄 */
  training?: string;
  /** [오늘] 다음 경기 바로 아래 할 일(카드 고르기) */
  todo?: string;
  /** [시즌] 이번 시즌 대회 3칸 */
  comps?: string;
  /** [시즌] 시즌 목표 */
  goals?: string;
  /** [시즌] 카드 덱 줄 · 기록 도전 줄 */
  links?: string;
  /** [경쟁] 주전 경쟁 · 라이벌 */
  compete?: string;
  /** 맨 아래(모든 탭): 안내 다시 보기 */
  foot?: string;
}

export interface HomeOpts {
  tab?: HomeTab;
  /** 배너가 붙어 접힌 다음 경기 카드를 폈는지 (17차 2절 29번) */
  nextOpen?: boolean;
}

/** 다음 경기 카드 (C.38 → 17차 S06-a): 진행 단추는 독 [다음] 하나로 — 카드에는 안내 한 줄 + [하루 진행] · [전술] · [자동 진행] */
function nextCard(vm: HomeVM): string {
  const n = vm.next!;
  const d = vm.day!;
  const where = isLandPhone() ? '왼쪽' : '아래';
  // 경기 날만 안내 한 줄(독 [다음]=경기). 다른 날은 [하루 진행] · [전술] · [자동 진행]이 한 줄을 채운다 — 독 [계속] = 경기 날까지
  const hint = d.matchDay ? (n.out ? `결장 · ${where} [경기]로 관전해요` : `경기는 ${where} [경기]로 준비해요`) : '';
  const btns = [
    ...(d.matchDay ? [] : [Button({ size: 'sm', variant: 'ghost', icon: 'clock', act: 'day-one', children: '하루 진행' })]),
    ...(n.tacticsOpen ? [Button({ size: 'sm', variant: 'ghost', icon: 'tactic', act: 'tac-open', children: '전술' })] : []),
    Button({ size: 'sm', variant: 'ghost', icon: 'ff', act: 'sim-rest', className: 'hm-go__auto', children: '자동 진행' }),
  ].join('');
  const pct = Math.round((n.myRating / Math.max(1, n.myRating + n.oppRating)) * 1000) / 10;
  return panel(`
        <div class="hm-head"><span class="hm-title">다음 경기 <span>· ${esc(vm.comp)} · ${n.neutral ? '중립' : n.home ? '홈' : '원정'}</span></span>${d.matchDay ? `<span class="hm-today">${n.out ? '오늘 결장' : '오늘 경기'}</span>` : `<span class="hm-sub">${esc(vm.nextDate ?? d.nextLabel ?? '')}</span>`}</div>
        ${n.cup ? `<div class="comp-badge${n.cup.comp === 'fa' ? ' is-fa' : n.cup.comp === 'nat' ? ' is-nat' : ''}">${Icon({ name: n.cup.comp === 'nat' ? 'world' : 'trophy', size: 14, strokeWidth: 2.4 })}<b>${esc(n.cup.label)}</b></div>` : ''}
        ${n.derby ? `<div class="derby-badge${n.derby.big ? ' is-big' : ''}">${Icon({ name: 'star', size: 14, strokeWidth: 2.4 })}<b>${esc(n.derby.name)}</b><span>더비 매치</span></div>` : ''}
        <div class="vs-row"><span class="vs-team">${Crest({ name: n.my, size: 24 })}<span class="vs-name">${esc(n.my)}</span></span><span class="vs">vs</span><span class="vs-team away"><span class="vs-name">${esc(n.opp)}</span>${Crest({ name: n.opp, size: 24, color: 'var(--away)' })}</span></div>
        <div class="hm-power"><span>전력 <b class="po-num">${n.myRating}</b></span><span class="hm-power__bar" aria-hidden="true"><i style="width:${pct}%"></i><i></i></span><b class="po-num away">${n.oppRating}</b></div>
        <div class="hm-envbox">${envRow(n.env)}
        <div class="hm-tac">${n.myTactic ? TacticChip({ size: 'sm', ...n.myTactic }) : ''}<span class="vs">vs</span>${n.oppTactic ? TacticChip({ size: 'sm', team: n.opp, away: true, ...n.oppTactic }) : ''}</div></div>
        <div class="hm-go">${hint ? `<span class="hm-go__hint">${esc(hint)}</span>` : ''}<span class="hm-go__btns">${btns}</span></div>`, 'next-card');
}

/** 접은 다음 경기 한 줄 (17차 2절 29번): 위 배너가 붙은 폰 [오늘] — 누르면 펼침 */
function nextFolded(vm: HomeVM): string {
  const n = vm.next!;
  const d = vm.day!;
  return `<button type="button" class="panel next-card next-card--folded" data-act="home-next" aria-expanded="false">
      <span class="hm-fold__main"><small>다음 경기 · ${esc(vm.comp)} · ${n.neutral ? '중립' : n.home ? '홈' : '원정'}</small><b>${Crest({ name: n.opp, size: 18, color: 'var(--away)' })}<span>vs ${esc(n.opp)}</span></b></span>
      <span class="hm-fold__when">${d.matchDay ? (n.out ? '오늘 결장' : '오늘') : esc(vm.nextDate ?? d.nextLabel ?? '')}</span>${Icon({ name: 'chevron-down', size: 18 })}</button>`;
}

/** 내 상태 (17차 S06-a): 체력 · 폼 · 부상 위험 3칸 + 경고 문구 + 부상 위험 근거 한 줄. 값은 모두 코드 값(엔진 식) */
function conditionCard(vm: HomeVM): string {
  const c = vm.condition;
  const stamina = staminaOf(c.fatigue);
  const lvl = stamina <= 30 ? 'is-low' : stamina < 100 - BALANCE.fatigue.penaltyFrom ? 'is-mid' : '';
  const risk = c.injured != null
    ? `<b class="hm-ct__v fail">부상 중</b><small>${c.injured}일 남음</small>`
    : c.risk ? `<b class="hm-ct__v po-num${c.risk.mul >= 2 ? ' fail' : c.risk.mul >= 1.3 ? ' warn' : ''}">${c.risk.pct}%<small>/경기</small></b><small>${c.risk.mul >= 1.3 ? `보통의 ${c.risk.mul}배` : '보통 수준'}</small>` : '<b class="hm-ct__v">-</b>';
  return panel(`
        <div class="hm-head"><span class="hm-title">내 상태</span><span class="hm-sub">경고 <b class="po-num">${c.yellowEvery ? `${c.yellows}/${c.yellowEvery}` : c.yellows}</b></span></div>
        <div class="hm-ctiles">
          <div class="hm-ct"><span class="hm-ct__k">체력</span><b class="hm-ct__v po-num ${lvl}">${stamina}<small>/ 100</small></b><span class="hm-stamina__bar" aria-hidden="true"><i class="${lvl}" style="width:${stamina}%"></i></span></div>
          <div class="hm-ct"><span class="hm-ct__k">폼</span>${FormIndicator({ level: c.form, showLabel: true, size: 16 })}<small>${esc(c.formLabel)}</small></div>
          <div class="hm-ct"><span class="hm-ct__k">부상 위험</span>${risk}</div>
        </div>
        ${staminaNote(c.fatigue)}
        ${c.seasonFatigue ? `<p class="small warn">시즌 누적 피로 ${c.seasonFatigue} · 경기 체력 −${c.seasonFatigue} (게겐 경기마다 쌓이고 쉬는 경기에 풀려요)</p>` : ''}
        ${(c.life?.length ?? 0) > 1 ? `<div class="lf-hints">${c.life!.slice(1).map((h) => `<p class="small warn">${Icon({ name: 'face', size: 14 })} ${esc(h)}</p>`).join('')}</div>` : ''}
        ${c.risk ? `<p class="small muted hm-why">부상 위험 근거 · ${esc(c.risk.why)}</p>` : ''}`, 'hm-cond');
}

export function homeView(vm: HomeVM, parts: HomeParts = {}, opts: HomeOpts = {}): string {
  const n = vm.next;
  const tab = opts.tab ?? 'today';
  const wide = isWide();
  // 도구 줄 (17차 S03-c, K13 ToolBar): < · 날짜 글자 · 알림 · 코치 후보 · 저장 · 설정 — 아이콘 10개 → 4개.
  // 도감 · 진열실 · 대표팀 · 시상은 더보기 격자(폰)와 홈 오른쪽 열 "커리어 바로가기"(PC)로 옮겼다
  const tools = ToolBar({
    back: vm.exit ? { act: 'to-title' } : false,
    date: vm.day ? `${vm.day.short} (${vm.day.weekdayKo.slice(0, 1)})` : '비시즌',
    items: [
      { icon: 'bell', label: '알림', act: 'go', data: { to: 'inbox' }, ...(vm.inbox ? { badge: vm.inbox } : {}) },
      { icon: 'whistle', label: '코치 후보', act: 'go', data: { to: 'staff' }, ...(vm.money ? { badge: vm.money } : {}) },
      { icon: 'disk', label: '저장', act: 'go', data: { to: 'saves' } },
      { icon: 'settings', label: '설정', act: 'go', data: { to: 'settings' } },
    ],
  });
  const face = homeFace(vm);
  // C.73d: 왼쪽 위 ‹ = 초기화면으로(확인 시트 → 자동 저장). 경기 중·결정 순간에는 없음 (17차: 도구 줄 맨 왼쪽)
  // C.57 (디자인 B 86·132): 사진이 있으면 미페 머리말(등번호 · 사진 · 이름 · OVR), 없으면 C.39 작은 머리말(날짜 한 줄)
  const hero = face
    ? HeroPanel({
      title: '홈', toolbar: tools, face: face.src, cutout: face.cutout, kit: vm.kit, name: vm.card.name,
      eyebrow: vm.trial ? `${vm.team} · 1군 테스트 ${vm.trial.games}/${vm.trial.need}` : `${vm.team} · ${vm.card.position}`,
      value: vm.card.ovr, unit: `OVR · ${vm.card.position}`, chips: heroChips(vm),
    })
    : HeroPanel({
      title: '홈', compact: true, toolbar: tools,
      eyebrow: vm.day ? `${vm.season} 시즌 · ${vm.day.full}` : `${vm.season} 시즌 · 비시즌`,
      value: vm.day ? vm.day.short : '비시즌', pad: false, progress: false, chips: heroChips(vm),
    });

  // 위 배너(1군 테스트 · 부상 · 출장 정지 · 슬럼프 · 포인트)가 붙으면 폰 [오늘]은 다음 경기를 접은 한 줄로 → 다음 경기 · 내 상태가 첫 화면 안 (17차 2절 29번)
  const crowded = !!vm.trial || vm.banners.length > 0;
  let next = '';
  if (n && vm.day) next = crowded && !wide && !opts.nextOpen ? nextFolded(vm) : nextCard(vm);
  else if (vm.phase === 'offseason') {
    next = `${SectionTitle({ title: '비시즌 휴가' })}${panel(`<p class="muted">${esc(vm.season)} 시즌이 끝났어요. 휴가 중에는 훈련 선택이 없고 체력이 회복돼요.</p>
      ${vm.camp ? `<p class="small"><b>${esc(vm.camp)} 소집</b> · 개막 7일 전부터 훈련 계획과 첫 경기를 준비해요. ${isLandPhone() ? '왼쪽' : '아래'} [시즌 요약]에서 [새 시즌 시작]을 누르면 소집일로 넘어가요.</p>` : ''}`)}`;
  }

  const c = vm.condition;
  // C.76g (디자인 197 ④): 생활 힌트는 다음 경기 위 한 줄(누르면 훈련·일정)
  const life = c.life?.length ? `<div class="hm-life">${Icon({ name: 'sun', size: 18 })}<p class="grow"><b>생활</b> · ${esc(c.life[0]!)}</p>${Button({ size: 'sm', variant: 'ghost', act: 'go-tab', data: { v: 'schedule' }, children: '고르기' })}</div>` : '';
  const record = `<section class="panel hm-record"><div class="hm-head"><span class="hm-title">시즌 기록</span><span class="hm-sub">${esc(vm.team)} · ${esc(vm.card.position)} · ${vm.card.age}세</span></div>${
    statTiles([{ value: vm.stats.apps, label: '출전' }, { value: vm.stats.goals, label: '골', hi: true }, { value: vm.stats.assists, label: '도움' }, { value: vm.stats.avg, label: '평균 평점' }])}</section>`;

  const today = `${vm.trial ? trialStrip(vm.trial) : ''}${banners(vm.banners)}${life}${next}${parts.todo ?? ''}${conditionCard(vm)}${startNotice(vm.version)}${parts.guide ?? ''}`;
  const season = `${parts.comps ?? ''}${parts.goals ?? ''}${record}${parts.links ?? ''}`;
  const compete = parts.compete || EmptyState({ icon: 'player', title: '아직 경쟁 상대가 없어요', text: '시즌이 시작되면 주전 경쟁(선발 점수)과 라이벌이 여기 보여요.' });
  const foot = `${versionFooter(vm.version)}${parts.foot ?? ''}`;

  // PC 3열 (17차 S06-a PC): 왼쪽 = 머리말 · 오늘 · 오늘 훈련 / 가운데 = 시즌 / 오른쪽 = 경쟁 · 알림(2절 사소: PC 알림은 오른쪽 열) · 커리어 바로가기
  if (wide) {
    return `<div class="hm3">
      <div class="hm3__col hm3__today"><div class="hm-hero">${hero}</div><div class="hm3__in">${today}${parts.training ?? ''}</div></div>
      <div class="hm3__col"><h2 class="hm3__h">시즌</h2>${season}</div>
      <div class="hm3__col"><h2 class="hm3__h">경쟁</h2>${compete}${parts.alerts ?? ''}${careerLinks()}${foot}</div>
    </div>`;
  }
  const tabs = Tabs({ items: [...HOME_TABS], value: tab, variant: 'underline', fill: true, act: 'home-tab', label: '홈' });
  const body = tab === 'season' ? season : tab === 'comp' ? compete : `${today}${parts.alerts ?? ''}${parts.training ?? ''}`;
  return `
    <div class="hm-hero">${hero}</div>
    <div class="hm-tabs">${tabs}</div>
    <div class="body home-body hm-tab-${tab}">
      ${body}
      ${foot}
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

/** "주 포지션 변경 요청" (부록 D.3): 홈 섹션 + 바텀시트. 비시즌, 포변 조언 기간에는 시즌 중에도 (C.37) */
export function positionChangeSection(current: string, prof: number, advice = false): string {
  return `${SectionTitle({ title: '주 포지션 변경 요청', action: advice ? '조언 기간에는 시즌 중에도' : '비시즌에만' })}
    ${OptionRow({ icon: 'player', title: `지금 주 포지션 ${current}`, desc: `숙련도 ${prof}. 바꾸면 새 포지션 OVR로 선발과 평점을 따져요. 비용은 숙련도 페널티뿐이에요.`, right: Button({ variant: 'secondary', size: 'sm', act: 'pos-open', children: '요청' }) })}`;
}

const signedOvr = (d: number) => (d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0');

export function positionSheet(options: PositionOptionVM[], pick: string, inSeason = false): string {
  const cur = options.find((o) => o.current)!;
  const sel = options.find((o) => o.pos === pick) ?? cur;
  return BottomSheet({
    eyebrow: inSeason ? '포변 조언 기간' : '비시즌', title: '주 포지션 변경 요청', subtitle: `${inSeason ? '포변 조언 기간이라 시즌 중에도 바꿀 수 있어요.' : '비시즌에는 언제든 바꿀 수 있어요(시즌 중에는 포변 조언 기간에만).'} 감독 허락은 필요 없고, 숙련도가 낮은 포지션은 OVR이 낮아져요. 그 포지션으로 뛸수록 숙련도가 올라요.`,
    onClose: { act: 'sheet-close' },
    // 17차 2절 14번: PC 는 12자리가 한 화면에 다 보이게 2열 격자(pos-grid)
    children: `<div class="pos-grid">${options.map((o) => OptionRow({
      act: 'pos-pick', data: { v: o.pos }, radio: true, selected: o.pos === sel.pos, title: `${o.pos} · ${o.ko}`,
      // C.81o: "OVR −6"(숙련 감점만)인데 88→80 처럼 실제 차이가 달라 보였다 → 지금과의 OVR 차이(포지션 능력치 차이 포함)를 보이고, 숙련 감점은 그 안의 몫으로
      desc: o.current ? `숙련도 ${o.prof}` : `숙련도 ${o.prof} · 지금보다 OVR ${signedOvr(o.ovr - cur.ovr)}${o.penalty ? ` (숙련 감점 −${Math.round(o.penalty)} 포함)` : ''}`, ...(o.current ? { tag: '지금' } : {}), right: `<b class="po-num">${o.ovr}</b>`,
    })).join('')}</div>`,
    footer: Button({ size: 'lg', block: true, act: 'pos-change', data: { v: sel.pos }, disabled: sel.current, children: sel.current ? '바꿀 포지션을 골라요' : `${sel.pos}로 변경 · OVR ${cur.ovr} → ${sel.ovr}` }),
  });
}

/** 일정 (부록 C.38): 다음 일정 목록, 이번 달 달력 (다른 경기 계산 방식 고르기는 C.77q 에 설정 · 경기 준비만 남김) */
export function calendarSection(d: DayVM): string {
  const list = d.upcoming.map((u) => `<li class="cal-item cal-${u.kind}${u.cup ? ' is-cup' : ''}"><span class="cal-date">${esc(u.date)}</span>${u.cup ? `<span class="cal-cup">${Icon({ name: 'trophy', size: 12 })}${esc(u.cup)}</span>` : ''}${u.team ? `<button type="button" class="dt-link grow" data-act="team-open" data-v="${esc(u.team)}">${esc(u.text)}</button>` : `<span class="grow">${esc(u.text)}</span>`}${u.sub ? `<span class="cal-tag">${esc(u.sub)}</span>` : ''}</li>`).join('');
  // 17차 S12-c: 달력은 월요일 시작(훈련 주 = 월~일과 같게)
  const blanks = Array.from({ length: (d.month.lead + 6) % 7 }, () => '<span class="cal-cell blank"></span>').join('');
  const cells = d.month.days.map((c) => `<span class="cal-cell${c.kind ? ` k-${c.kind}` : ''}${c.today ? ' today' : ''}${c.past ? ' past' : ''}"${c.title ? ` title="${esc(c.title)}"` : ''}>${c.d}${c.cup ? `<i class="cal-trophy">${Icon({ name: 'trophy', size: 10 })}</i>` : ''}${c.life ? `<small class="cal-life">${Icon({ name: PLAN_ICON[c.life], size: 10 })}${esc(c.lifeShort ?? '')}</small>` : ''}</span>`).join('');
  return `${SectionTitle({ title: '일정', action: d.month.title })}
    ${panel(`<ul class="cal-list">${list}</ul>
      <div class="cal-grid" role="grid" aria-label="${esc(d.month.title)} 달력">${['월', '화', '수', '목', '금', '토', '일'].map((w) => `<span class="cal-wd">${w}</span>`).join('')}${blanks}${cells}</div>
      <div class="legend small"><span><i class="k cal-home"></i>내 경기 (홈)</span><span><i class="k cal-away"></i>원정</span><span><i class="k cal-league"></i>다른 경기</span><span><i class="k cal-break"></i>휴식기</span>${d.month.days.some((c) => c.cup) ? `<span>${Icon({ name: 'trophy', size: 10 })} 컵·챔스</span>` : ''}${d.month.days.some((c) => c.life) ? '<span class="cal-life-key">생활(아이콘 + 두 글자)</span>' : ''}</div>
      <p class="small muted">다른 경기 계산(${d.othersKo})은 설정 › 경기 진행에서 바꿔요.</p>`)}`;
}

/** 훈련·일정 화면 (C.44 독): 오늘 훈련·주간 계획·게이지 + 일정·달력 */
export function scheduleView(vm: HomeVM, training: string, calendar = true): string {
  const hero = HeroPanel({
    title: '훈련', back: false, compact: true,
    eyebrow: vm.day ? `${vm.season} 시즌 · ${vm.day.full}` : `${vm.season} 시즌 · 비시즌`,
    value: vm.day ? vm.day.short : '비시즌', pad: false, progress: false,
    chips: vm.day ? [vm.day.matchDay ? '오늘 경기' : `경기까지 ${vm.day.daysTo}일`, { label: `리그 ${vm.round}/${vm.rounds}R`, soft: true }] : [{ label: '시즌 종료', soft: true }],
  });
  const off = vm.phase === 'offseason'
    ? panel(`<p class="muted">비시즌 휴가 중이에요. 훈련 선택이 없고 체력이 회복돼요.${vm.camp ? ` ${esc(vm.camp)} 소집부터 훈련 계획이 다시 시작돼요.` : ''}</p>`)
    : '';
  return `${hero}<div class="body">${off}${training}${vm.day && calendar ? calendarSection(vm.day) : ''}${versionFooter(vm.version)}</div>`;
}

/** 홈 기록 도전 한 줄 (C.77q): 기록 섹션은 선수 › 기록에만, 홈은 링크 한 줄 */
export function recordsLinkRow(n: number): string {
  if (!n) return '';
  return `<button type="button" class="panel hm-deck" data-act="go" data-to="player" data-tab="record"><span class="hm-train__icon">${Icon({ name: 'target', size: 18 })}</span>
      <small>기록 도전</small><b class="grow"><span class="po-num">${n}</span>개 진행 중</b><span class="hm-deck__link">선수 › 기록${Icon({ name: 'chevron-right', size: 16 })}</span></button>`;
}

/** 기록 추적 (C.74b, pending 77-10, 디자인 없음 · 시즌 목표 줄 모양): 남은 기록 1~3줄 */
export function recordsSection(rows: RecordTrackVM[]): string {
  if (!rows.length) return '';
  const list = rows.map((r) => `<div class="mg-row rc-row">
      <div class="mg-row__head"><span class="mg-row__name">${esc(r.label)}${r.holder ? ` <small class="muted">· ${esc(r.holder)}</small>` : ''}</span><b class="po-num">${esc(r.left)}</b></div>
      <div class="mg-bar" aria-hidden="true"><i class="t" style="width:${Math.round(r.ratio * 100)}%"></i></div>
      <div class="gl-meta small"><span class="muted po-num">${esc(r.value)}</span></div>
    </div>`).join('');
  return `${SectionTitle({ title: '기록 도전', action: '깨면 XP·위상 소량' })}${panel(`<div class="mg-rows">${list}</div>`, 'mg-card rc-card')}`;
}

/** 부상 복귀 선택 시트 (C.74b, pending 77-5 → C.76g 디자인 228 → 17차 S06-l): 조기 복귀 vs 완전 회복(추천). 막바지 전(wait)이면 단추 잠금 + 언제 고르는지 */
export function injuryReturnSheet(vm: InjuryReturnVM): string {
  const off = vm.wait != null;
  return BottomSheet({
    eyebrow: `부상 (${vm.grade}) · ${vm.daysLeft}일 남음`, title: '복귀 시점 고르기',
    subtitle: off ? `회복 막바지(남은 날 ${vm.wait}일 이하)가 되면 골라요. 그때 홈에 이 시트가 다시 떠요.` : '회복 막바지예요. 조금 일찍 돌아갈지, 끝까지 회복할지 골라요.',
    onClose: { act: 'sheet-close' },
    children: `<div class="po-options ir-opts">${
      OptionRow({ act: 'inj-return', data: { v: 'full' }, icon: 'recover', title: '완전 회복', tag: '추천', desc: `복귀 예정 ${vm.back} · 재부상 위험 보통`, disabled: off })}${
      OptionRow({ act: 'inj-return', data: { v: 'early' }, icon: 'risk', title: '조기 복귀', desc: `${off ? `남은 ${vm.wait}일을 건너뛰고 바로 복귀` : `오늘부터 뛸 수 있어요 (${vm.daysLeft}일 빨리)`} · ${vm.riskDays}일 동안 부상 확률 ×${vm.risk}`, disabled: off })}</div>
      <p class="ir-auto small muted">${Icon({ name: 'ff', size: 16 })}자동 진행 중에는 완전 회복으로 정해요.</p>`,
  });
}

/** 날씨 예보·심판 한 줄 (C.74a): 공개 전이면 며칠 뒤 공개인지 */
const WEATHER_ICON: Readonly<Record<WeatherKind, IconName>> = { clear: 'sun', cloudy: 'cloud', rain: 'rain', wind: 'wind', heat: 'heat', snow: 'snow' };
export function envRow(e: EnvVM): string {
  if (!e.open) return `<div class="hm-env is-closed">${Icon({ name: 'cloud', size: 16 })}<span>날씨 예보·심판 배정은 ${e.opensIn > 0 ? `${e.opensIn}일 뒤` : '곧'} 공개돼요</span></div>`;
  const w = e.weather!;
  return `<div class="hm-env is-${w}">
          <span class="hm-env__w">${Icon({ name: WEATHER_ICON[w], size: 18 })}<b>${esc(e.weatherKo!)}</b><span class="hm-env__hint">${esc(e.hint!)}</span></span>
          <span class="hm-env__ref">${Icon({ name: 'whistle', size: 16 })}<b>${esc(e.referee!)}</b>${(e.refTraits ?? []).map((t) => `<i>${esc(t)}</i>`).join('')}</span>
        </div>`;
}
