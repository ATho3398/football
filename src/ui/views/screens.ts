// 디자인 2차 수정본 화면 (H.6 3번, I.19 갱신): 타이틀(55), 새 게임(52·53), 포인트 찍기(50), 순위표·리그 스타(54), 시즌 종료(51),
// 은퇴(56), 세이브(43). 화면 모듈은 뷰모델만 받아 그린다 (H.2). 아직 없는 기능(설정, 파일 내보내기, 검색·필터, 우승 기록 등)은 숨긴다

import {
  Avatar, Banner, Button, Crest, esc, HeroPanel, Icon, IconButton, Meter, PlayerCard, SectionTitle, StatBar, Tabs, TierBadge, type DesignTier,
} from '../components';
import type { AllocateVM, RetiredVM, SavesVMOut, SeasonVM, VersionVM, WorldVM } from '../viewModels';
import { actionRow, banners, panel, statTiles, versionFooter } from './common';
import { historyTable } from './player';

// ── 타이틀 (55) ──

export interface TitleVM {
  cont: { name: string; team: string; meta: string } | null;
  version: VersionVM;
}

export function titleView(vm: TitleVM): string {
  return `
    <div class="title-screen">
      <div class="title-hero">
        <span class="title-tag">축구 커리어 · 1인용</span>
        <span class="title-logo po-num">PLAYER<br><span>ONE</span></span>
        <span class="title-copy">17세 유망주에서 은퇴까지.<br>한 선수의 커리어를 내 손으로 쌓아요.</span>
      </div>
      <div class="title-actions">
        ${vm.cont ? `<div class="continue-card">${Avatar({ size: 40, ring: true })}<div class="grow"><b>${esc(vm.cont.name)} · ${esc(vm.cont.team)}</b><span>${esc(vm.cont.meta)}</span></div></div>
        ${Button({ size: 'lg', block: true, icon: 'play', act: 'continue', children: '이어하기' })}` : ''}
        <div class="btn-row even">
          ${Button({ variant: vm.cont ? 'secondary' : 'primary', size: 'lg', block: true, icon: 'plus', act: 'go', data: { to: 'new' }, children: '새 게임' })}
          ${Button({ variant: 'secondary', size: 'lg', block: true, icon: 'disk', act: 'go', data: { to: 'saves' }, children: '불러오기' })}
        </div>
      </div>
      ${versionFooter(vm.version)}
    </div>`;
}

// ── 새 게임 (52·53) ──

export interface NewGameVM {
  mode: 'prospect' | 'real';
  name: string;
  position: string;
  positions: { id: string; ko: string }[];
  keyAttrs: string;
  ageRange: string;
  difficulty: string;
  difficulties: { id: string; label: string; desc: string }[];
  seed: string;
  reals: { id: string; name: string; club: string; age: number; position: string; ovr: number; tier: DesignTier }[];
  realId: string;
  selected: { name: string; ovr: number } | null;
  teamHint: string;
}

export function newGameView(vm: NewGameVM): string {
  const real = vm.mode === 'real';
  const hero = real
    ? HeroPanel({ title: '새 게임', back: { act: 'go', data: { to: 'title' } }, eyebrow: vm.selected ? `선택한 선수 · ${vm.selected.name} OVR` : '실제 선수를 골라요', value: vm.selected ? vm.selected.ovr : '-', pad: false, progress: false, chips: [`고를 수 있는 선수 ${vm.reals.length}명`, { label: '2018-19 시즌 그대로', soft: true }] })
    : HeroPanel({ title: '새 게임', back: { act: 'go', data: { to: 'title' } }, eyebrow: '커리어를 시작할 선수', value: '17세', pad: false, progress: false, chips: [vm.ageRange, { label: '능력치는 포지션별 기본값', soft: true }] });
  const modeTabs = `<span class="label">시작 방식</span>${Tabs({ items: [{ id: 'prospect', label: '가상 유망주' }, { id: 'real', label: '실제 선수' }], value: vm.mode, variant: 'segment', fill: true, act: 'form', data: { k: 'mode' } })}`;
  const diff = `${SectionTitle({ title: '난이도' })}<div class="opts">${vm.difficulties.map((d) =>
    `<button type="button" class="po-option opt${d.id === vm.difficulty ? ' is-on' : ''}" data-act="form" data-k="difficulty" data-v="${d.id}"><span class="grow"><b>${esc(d.label)}</b><small>${esc(d.desc)}</small></span>${
      d.id === 'normal' ? '<span class="rec">추천</span>' : ''}<i class="radio${d.id === vm.difficulty ? ' on' : ''}"></i></button>`).join('')}</div>`;
  const seed = `${SectionTitle({ title: '시드', action: '선택' })}<label class="field"><input type="text" id="f-seed" maxlength="40" value="${esc(vm.seed)}" placeholder="비우면 랜덤 · 같은 시드 + 같은 선택 = 같은 결과"></label>`;
  let body: string;
  if (!real) {
    body = `
      ${SectionTitle({ title: '포지션', action: `${vm.positions.length}개 중 1개` })}
      <div class="pos-pick">${vm.positions.map((p) => `<button type="button" class="pos-btn${p.id === vm.position ? ' is-on' : ''}" data-act="form" data-k="position" data-v="${p.id}"><b>${p.id}</b><small>${esc(p.ko)}</small></button>`).join('')}</div>
      <p class="small muted"><b class="ink">${esc(vm.position)}</b> · 핵심 능력치 ${esc(vm.keyAttrs)}.</p>
      ${SectionTitle({ title: '이름', action: '비우면 랜덤' })}
      <label class="field"><input type="text" id="f-name" maxlength="12" value="${esc(vm.name)}" placeholder="예: 김민준"></label>
      ${diff}
      ${seed}
      <div class="btn-col">${Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'start', children: `${vm.teamHint} 유스로 시작` })}</div>`;
  } else {
    body = `
      <div class="real-list">${vm.reals.map((p) => `<button type="button" class="real-row${p.id === vm.realId ? ' is-on' : ''}" data-act="form" data-k="realId" data-v="${p.id}">${Avatar({ size: 44 })}<span class="grow"><b>${esc(p.name)}</b><small>${Crest({ name: p.club, size: 12 })} ${esc(p.club)} · ${p.age}세 · ${p.position}</small></span>${
        TierBadge({ tier: p.tier, size: 'sm' })}<span class="ovr"><b class="po-num">${p.ovr}</b><small>OVR</small></span></button>`).join('')}</div>
      <p class="small muted">실제 선수는 지금 소속팀·나이·능력치 그대로 시작해요. 이름은 바꿀 수 없어요. OVR 은 시드에 따라 조금 달라져요.</p>
      ${diff}
      ${seed}
      <div class="btn-col">${Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'start', disabled: !vm.selected, children: vm.selected ? `${vm.selected.name}으로 시작` : '선수를 골라요' })}</div>`;
  }
  return `${hero}<div class="body">${modeTabs}${body}</div>`;
}

// ── 포인트 찍기 (50) ──

export function allocateView(vm: AllocateVM, open: Set<string>, pending: number): string {
  const hero = HeroPanel({
    title: '능력치 포인트', right: `Lv ${vm.levels}`, back: { act: 'alloc-cancel' }, eyebrow: '남은 포인트', value: vm.points, progress: false,
    chips: [`보유 ${vm.points + pending}P`, { label: `이번 배분 ${pending}P`, soft: true }],
  });
  const ovr = `<div class="panel ovr-cmp"><div><small>지금 OVR</small><b class="po-num">${vm.startOvr}</b><span>${esc(vm.position)} 기준 계산</span></div>${Icon({ name: 'chevron-right', size: 22 })}<div class="r"><small>확정하면</small><b class="po-num hi">${vm.ovr}</b><span>${vm.startExact.toFixed(1)} → ${vm.exact.toFixed(1)}</span></div></div>`;
  const coach = vm.coachComment
    ? `<div class="coach">${Avatar({ size: 36 })}<div><small>코치 · 비용 구간</small><b>"여기서부터는 성장이 더뎌져. 실력이 한 단계 더 올라서면 다시 길이 열릴 거야."</b></div></div>`
    : '';
  const bands = `<div class="bands"><span>~${vm.cost1Max} <b>1P</b></span><span class="warn">${vm.cost1Max + 1}~${vm.cost2Max} <b>2P</b></span><span class="fail">${vm.cost2Max + 1}~ <b>3P</b></span><span class="muted">실력 ${esc(vm.tierName)}(OVR) 기준 · 한 능력치 최대 +${vm.cap}</span></div>`;
  const groups = vm.groups.map((g) => {
    const isOpen = open.has(g.name);
    const keyN = g.rows.filter((r) => r.key).length;
    const raised = g.rows.reduce((t, r) => t + r.raised, 0);
    const avg = Math.round(g.rows.reduce((t, r) => t + r.value, 0) / g.rows.length);
    const head = `<button type="button" class="grp-head" data-act="alloc-open" data-v="${esc(g.name)}"><span class="grow"><b>${esc(g.name)}</b>${keyN ? `<span class="key-chip">${esc(vm.position)} 핵심</span>` : ''}${
      isOpen ? '' : `<small>${g.rows.map((r) => esc(r.label)).join(' · ')}</small>`}</span>${isOpen ? `<span class="small muted">${g.rows.length}개${raised ? ` · <b class="brand">+${raised}</b>` : ''}</span>` : `<span class="avg"><b class="po-num">${avg}</b><small>평균</small></span>`}${Icon({ name: 'chevron-down', size: 18, style: isOpen ? 'transform:rotate(180deg)' : '' })}</button>`;
    const rows = isOpen ? g.rows.map((r) => StatBar({
      label: r.label, value: r.value - r.raised, add: r.raised, editable: true, ...(r.cost !== null ? { cost: r.cost } : {}),
      ...(r.ovrDelta !== null ? { ovrDelta: r.ovrDelta } : {}), maxed: r.maxed, locked: r.blocked, highlight: r.key,
      plus: { act: 'raise', data: { attr: r.attr } }, minus: { act: 'lower', data: { attr: r.attr } },
    })).join('') : '';
    return `<div class="panel grp${isOpen ? ' open' : ''}${keyN && isOpen ? ' key' : ''}">${head}${rows}</div>`;
  }).join('');
  return `${hero}<div class="body">${ovr}${coach}${bands}${groups}
    ${Button({ variant: 'ghost', block: true, icon: 'target', act: 'auto-alloc', disabled: vm.points === 0, children: '자동 배분 (포지션 OVR 우선)' })}</div>
    <div class="dock">${actionRow(
      Button({ variant: 'secondary', size: 'lg', block: true, icon: 'restore', act: 'alloc-reset', disabled: pending === 0, children: '초기화' }),
      Button({ size: 'lg', block: true, icon: 'check', act: 'alloc-done', children: pending ? `확정 · ${pending}P 사용` : '확정' }),
    )}</div>`;
}

// ── 순위표·리그 스타 (54) ──

export function worldView(vm: WorldVM, tab: 'table' | 'stars'): string {
  const me = vm.table.find((r) => r.me)!;
  const leader = vm.table[0]!;
  const hero = HeroPanel({
    title: '리그', right: `${vm.round}R / ${vm.rounds}`, back: false, eyebrow: `${me.team} 순위`, value: `${vm.myPos}위`, pad: false, progress: false,
    chips: [`승점 ${me.points}`, me.pos === 1 ? '선두' : `1위와 ${leader.points - me.points}점`, { label: `${vm.season} 시즌`, soft: true }],
  });
  const tabs = Tabs({ items: [{ id: 'table', label: '순위표' }, { id: 'stars', label: '리그 스타' }], value: tab, variant: 'underline', act: 'world-tab' });
  const table = `<div class="panel tbl-panel"><table class="tbl league">
      <tr><th>#</th><th class="l">팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
      ${vm.table.map((r) => `<tr class="${r.me ? 'me' : ''}${r.pos <= 4 ? ' top' : ''}${r.pos > vm.teams - 3 ? ' low' : ''}"><td class="po-num">${r.pos}</td><td class="l"><span class="team">${Crest({ name: r.team, size: 16 })}${esc(r.team)}</span></td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gd}</td><td><b class="po-num">${r.points}</b></td></tr>`).join('')}
    </table><div class="legend small"><span><i class="k top"></i>상위 4팀</span><span><i class="k low"></i>하위 3팀</span><span class="grow r">팀 전력은 시즌 시작 때 정해져요</span></div></div>`;
  const stars = `<p class="small muted">유명 선수들도 시즌마다 성장하고 늙어요. 오른쪽 숫자는 지난 시즌 대비 OVR 변화.</p>
    <div class="star-list">${vm.stars.map((s, i) => `<div class="star-row"><span class="rank po-num${i === 0 ? ' hi' : ''}">${i + 1}</span>${Avatar({ size: 40 })}<span class="grow"><b>${esc(s.name)}</b><small>${esc(s.club)} · ${s.age}세 · ${s.position}</small></span><span class="ovr"><b class="po-num">${s.ovr}</b><small class="${s.change > 0 ? 'up' : s.change < 0 ? 'down' : ''}">${s.change ? (s.change > 0 ? `+${s.change}` : `−${-s.change}`) : 'OVR'}</small></span></div>`).join('')}</div>
    ${vm.retired.length ? `<p class="small muted">은퇴: ${vm.retired.map(esc).join(', ')}</p>` : ''}`;
  return `${hero}<div class="body">${tabs}${tab === 'table' ? table : stars}</div>`;
}

// ── 시즌 종료 (51) ──

const chipList = (xs: { label: string; value: number }[]) => (xs.length
  ? `<div class="chips">${xs.map((d) => `<span class="po-chip"><span class="po-chip__label">${esc(d.label)}</span><b class="po-num ${d.value > 0 ? 'up' : 'down'}">${d.value > 0 ? '+' : '−'}${Math.abs(d.value)}</b></span>`).join('')}</div>`
  : '<div class="chips"><span class="po-chip">변화 없음</span></div>');
const sum = (xs: { value: number }[]) => xs.reduce((t, x) => t + x.value, 0);
const signedSum = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export function seasonView(vm: SeasonVM): string {
  const hero = HeroPanel({
    title: `${vm.season} 시즌 종료`, right: vm.team, back: false, eyebrow: '리그 최종 순위', value: `${vm.pos}위`, pad: false, progress: false,
    chips: [`${vm.apps}경기 출전`, `나이 ${vm.ageFrom} → ${vm.ageTo}세`],
  });
  const actions = vm.retired
    ? Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'go', data: { to: 'retired' }, children: '커리어 요약' })
    : `${vm.points > 0 ? Button({ variant: 'secondary', size: 'lg', block: true, icon: 'levelup', act: 'go', data: { to: 'allocate' }, children: `포인트 찍기 (${vm.points})` }) : ''}
       ${vm.canRetire ? Button({ variant: 'ghost', block: true, act: 'retire', children: '은퇴하기' }) : ''}
       ${Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'next-season', children: `${vm.nextSeason} 시즌 시작` })}`;
  const auto = sum(vm.autoGrowth);
  const vet = sum(vm.veteran);
  const age = sum(vm.aging);
  const rep = vm.next
    ? `${Meter({ value: vm.repAfter - vm.next.from, max: vm.next.cut - vm.next.from, label: `${vm.next.name}까지 ${vm.next.cut - vm.repAfter}점`, showValue: true })}`
    : `<p class="muted small">${vm.tier === 'legend' ? '최고 위상 티어예요.' : '월드클래스예요. 레전더리는 점수가 아니라 업적 조건으로 열려요.'}</p>`;
  const repLines = vm.repLines
    .map((l) => `<div class="kv small"><span>${esc(l.label)}</span><b class="po-num down">−${l.points}${l.note ? ` <small class="muted">${esc(l.note)}</small>` : ''}</b></div>`)
    .join('');
  return `${hero}<div class="body">
    ${vm.forcedRetire ? Banner({ tone: 'warning', title: `${vm.ageTo}세 · 더 이상 뛸 수 없어요`, children: '커리어를 마무리하고 은퇴해요.' }) : ''}
    ${vm.tierReached ? Banner({ tone: 'success', title: `${vm.tierReached} 달성 · 이 티어는 내려가지 않아요`, children: '감점은 다음 티어까지의 진행도만 깎아요.' }) : ''}
    ${vm.badges.map((b) => Banner({ tone: 'success', title: `레전드 배지 · ${b.name}`, children: `${b.desc} 위상이 ${vm.badgeRep}점 올랐어요.` })).join('')}
    ${vm.injury ? banners([vm.injury]) : ''}
    ${SectionTitle({ title: '내 시즌', action: `${vm.apps}경기` })}
    ${statTiles([{ value: vm.goals, label: '골', hi: true }, { value: vm.assists, label: '도움' }, { value: vm.avg, label: '평균 평점' }, { value: vm.injuries, label: `부상 (${vm.injuredWeeks}주)` }])}
    ${SectionTitle({ title: '업적 XP', action: `+${vm.achievementXp}` })}
    ${panel(`${vm.achievements.length ? vm.achievements.map((a) => `<div class="ach"><span class="ach__icon">${Icon({ name: 'star', size: 16 })}</span><span class="grow">${esc(a.label)}</span><b class="po-num up">+${a.xp}</b></div>`).join('') : '<p class="muted small">이번 시즌 업적이 없어요.</p>'}
      <p class="small muted">지급 XP는 난이도를 반영해요.${vm.levelsGained ? ` 레벨 업 ${vm.levelsGained}회!` : ''}</p>`)}
    ${SectionTitle({ title: '능력치 변화', action: `OVR ${vm.ovrBefore} → ${vm.ovrAfter}` })}
    ${panel(`
      <div class="kv"><b>자동 성장 <small class="muted">${esc(vm.growthAges)}</small></b><b class="po-num up">${signedSum(auto)}</b></div>${chipList(vm.autoGrowth)}
      <div class="kv"><b>노련함 <small class="muted">경험으로 오르는 능력치</small></b><b class="po-num up">${signedSum(vet)}</b></div>${chipList(vm.veteran)}
      <div class="kv"><b>노화</b><b class="po-num ${age < 0 ? 'down' : ''}">${signedSum(age)}</b></div>${chipList(vm.aging)}`)}
    ${SectionTitle({ title: '위상 진행도' })}
    ${panel(`<div class="kv">${TierBadge({ tier: vm.tier, score: vm.repAfter })}<span class="small muted">시즌 시작 ${vm.repBefore}점 → <b class="ink">${vm.repAfter}점</b></span></div>${repLines}${rep}`)}
    <div class="btn-col">${actions}</div>
  </div>`;
}

// ── 은퇴 (56) ──

export function retiredView(vm: RetiredVM): string {
  const hero = HeroPanel({
    title: '은퇴', back: false, eyebrow: `${vm.card.name} · 커리어 평균 평점`, value: vm.avg, pad: false, progress: false,
    chips: [`${vm.seasons}시즌 · ${vm.card.age}세 은퇴`, { label: `최고 순위 ${vm.best}`, soft: true }],
  });
  return `${hero}<div class="body">
    ${statTiles([{ value: vm.apps, label: '경기' }, { value: vm.goals, label: '골', hi: true }, { value: vm.assists, label: '도움' }, { value: vm.seasons, label: '시즌' }])}
    <div class="panel kv peak"><div><small>최종 위상</small>${TierBadge({ tier: vm.card.tier, score: vm.reputation })}</div><div class="r"><small>최고 OVR</small><b class="po-num hi">${vm.peakOvr}</b></div></div>
    ${PlayerCard({ player: vm.card })}
    ${SectionTitle({ title: '커리어 흐름' })}
    ${panel(historyTable(vm.history))}
    ${Banner({ tone: 'info', title: '은퇴한 세이브는 기록 보기만 할 수 있어요', children: '다른 슬롯의 진행에는 영향이 없어요.' })}
    <div class="btn-col">${Button({ size: 'lg', block: true, icon: 'plus', act: 'go', data: { to: 'new' }, children: '새 커리어' })}</div>
  </div>`;
}

// ── 세이브 (43) ──

export function savesView(vm: SavesVMOut, canSave: boolean, version: VersionVM): string {
  const a = vm.auto;
  const hero = HeroPanel({
    title: '저장', back: { act: 'go', data: { to: canSave ? 'home' : 'title' } },
    eyebrow: a.empty ? '자동 저장 없음' : `자동 저장 · ${a.meta.split(' · ').at(-1)}`, chips: [`수동 ${vm.used}/${vm.manual.length}`, { label: '자동 저장 켜짐', soft: true }],
  });
  const slot = (s: SavesVMOut['manual'][number]) => {
    const btns = s.empty
      ? (canSave ? Button({ size: 'sm', icon: 'disk', act: 'save', data: { slot: s.slot }, children: '여기에 저장' }) : '')
      : `${canSave ? IconButton({ act: 'save', data: { slot: s.slot }, name: 'disk', label: '덮어쓰기' }) : ''}${Button({ variant: 'secondary', size: 'sm', icon: 'upload', act: 'load', data: { slot: s.slot }, children: '불러오기' })}${
        IconButton({ act: 'delete', data: { slot: s.slot }, name: 'close', label: '삭제' })}`;
    return `<div class="slot${s.empty ? ' empty' : ''}"><span class="slot__n po-num">${esc(s.label)}</span><span class="grow"><b>${esc(s.title)}</b><small>${esc(s.meta)}</small>${s.start ? `<small>${esc(s.start)}</small>` : ''}</span><span class="slot__btns">${btns}</span></div>`;
  };
  return `${hero}<div class="body">
    ${SectionTitle({ title: '수동 저장', action: `${vm.manual.length}칸` })}
    ${vm.manual.map(slot).join('')}
    ${SectionTitle({ title: '자동 저장' })}
    <div class="slot"><span class="slot__n">${Icon({ name: 'restore', size: 18 })}</span><span class="grow"><b>${esc(a.empty ? '비어 있음' : a.title)}</b><small>${esc(a.empty ? '매 라운드가 끝날 때마다 자동으로 저장돼요' : a.meta)}</small>${a.start ? `<small>${esc(a.start)}</small>` : ''}</span><span class="slot__btns">${
      a.empty ? '' : Button({ variant: 'secondary', size: 'sm', act: 'load', data: { slot: 'auto' }, children: '불러오기' })}</span></div>
    <p class="small muted">저장은 이 브라우저(localStorage)에만 남아요.</p>
    ${versionFooter(version)}
  </div>`;
}
