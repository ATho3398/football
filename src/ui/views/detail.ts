// 다른 팀·다른 선수 상세 (C.53, pending 82 4번) — 6차 디자인 157 `팀상세` · 158 `선수상세-다른선수`.
// 읽기 전용: 편집 버튼([찍기]·[꾸미기]·[이적 요청])이 없다. 팀 이름·선수 이름을 누르면 서로 오간다

import { Avatar, Button, Crest, esc, FinChip, FormationPitch, HeroPanel, Icon, SectionTitle, TacticChip, Tabs, TierBadge } from '../components';
import { TIER_KO, type FinanceTier } from '../../finance';
import type { LeftPersonVM, PersonDetailVM, PersonTab, SquadRowVM, TeamDetailVM, TeamMatchVM, TeamTab } from '../detailVM';
import type { FormMark } from '../prepVM';
import { attrGrid } from './attrGrid';
import { panel, statTiles } from './common';

const MARK_KO: Record<FormMark, string> = { W: '승', D: '무', L: '패' };
/** 재정 등급 4단 막대 + 글자 (디자인 136·146 막대 모양, C.54: 컴포넌트 FinChip) */
export function tierBars(tier: FinanceTier, label?: string): string {
  return FinChip(label ?? TIER_KO[tier]);
}

/** 팀 이름 링크 (리그 팀만) */
export function teamLink(id: string, name: string, cls = ''): string {
  return `<button type="button" class="dt-link ${cls}" data-act="team-open" data-v="${esc(id)}">${esc(name)}</button>`;
}

/** 선수 이름 링크 */
export function personLink(id: string, name: string, cls = ''): string {
  return `<button type="button" class="dt-link ${cls}" data-act="person-open" data-v="${esc(id)}">${esc(name)}</button>`;
}

function squadRow(r: SquadRowVM): string {
  return `<button type="button" class="dt-row${r.me ? ' is-me' : ''}" data-act="person-open" data-v="${esc(r.id)}">${Avatar({ size: 36, face: r.face, name: r.name, ring: r.me })}
    <span class="grow"><b>${esc(r.name)}${r.me ? ' <span class="rec">나</span>' : ''}${r.legend ? ' <span class="rec">레전드</span>' : ''}</b><small>${esc(r.pos)} · ${r.age}세${r.shirt ? ` · ${r.shirt}번` : ''}</small></span>
    <b class="po-num dt-ovr">${r.ovr}</b>${Icon({ name: 'chevron-right', size: 16 })}</button>`;
}

function matchRow(m: TeamMatchVM): string {
  const res = m.mark ? `<i class="prep-form__m is-${m.mark}">${MARK_KO[m.mark]}</i>` : '<i class="prep-form__m">—</i>';
  return `<button type="button" class="dt-match" data-act="team-open" data-v="${esc(m.oppId)}"><span class="po-num dt-match__r">${m.round}R</span>${Crest({ name: m.opp, team: m.oppId, size: 20 })}<span class="grow"><b>${esc(m.opp)}</b> <small>${m.home ? '홈' : '원정'}</small></span><b class="po-num">${m.score ?? '예정'}</b>${res}</button>`;
}

function formDots(f: FormMark[]): string {
  if (!f.length) return '<span class="muted small">아직 경기 없음</span>';
  return `<span class="prep-form">${f.map((m) => `<i class="prep-form__m is-${m}">${MARK_KO[m]}</i>`).join('')}</span>`;
}

export function teamDetailView(vm: TeamDetailVM, tab: TeamTab, back: boolean): string {
  const hero = HeroPanel({
    title: '팀', right: `${vm.round}R / ${vm.rounds}`, back: back ? { act: 'detail-back' } : false, compact: true, pad: false, progress: false,
    eyebrow: `${vm.name} · 전력`, value: vm.rating.toFixed(1),
    chips: [`리그 ${vm.rank}위`, { label: `재정 ${vm.tierKo}`, soft: true }, ...(vm.mine ? [{ label: '우리 팀', soft: true }] : vm.derby ? [{ label: vm.derby, soft: true }] : [])],
  });
  const tabs = Tabs({ items: [{ id: 'overview', label: '개요' }, { id: 'squad', label: '스쿼드' }, { id: 'tactics', label: '전술' }, { id: 'matches', label: '경기' }], value: tab, variant: 'underline', fill: true, act: 'team-tab' });
  const r = vm.record;
  const gd = r.gf - r.ga;
  // C.71a (디자인 168): 정체 = 가운데 큰 엠블럼 · 이름 · 재정 등급 + 감독 줄(C.62~63 그대로)
  const ident = `<div class="panel dt-ident">${Crest({ name: vm.name, team: vm.id, size: 56 })}<b>${esc(vm.name)}</b><small>${tierBars(vm.tier, vm.tierKo)} ${vm.manager ? `감독 ${esc(vm.manager.name)}(${esc(vm.manager.style)}) · ${esc(vm.manager.stadium)}` : '감독·홈구장 정보 없음'}</small></div>`;
  const tiles = `<div class="dt-tiles">
    <div class="dt-tile"><small>순위</small><b class="po-num">${vm.rank}위</b><span>승점 ${r.points}</span></div>
    <div class="dt-tile"><small>전력</small><b class="po-num">${vm.rating.toFixed(1)}</b><span>리그 ${vm.ratingRank}위</span></div>
    <div class="dt-tile"><small>득실</small><b class="po-num">${gd > 0 ? '+' : gd < 0 ? '−' : ''}${Math.abs(gd)}</b><span>${r.played}경기 ${r.won}승 ${r.drawn}무 ${r.lost}패</span></div>
    <div class="dt-tile"><small>평균 나이</small><b class="po-num">${vm.avgAge ?? '—'}</b><span>세</span></div>
  </div>`;
  const tactic = `${SectionTitle({ title: '주 전술', action: '감독 기본 전술' })}
    <div class="panel dt-tactic">${FormationPitch({ slots: vm.slots, compact: true, height: 200, label: `${vm.name} 베스트 11` })}
      <span class="dt-tactic__info">${vm.tactic ? TacticChip({ size: 'sm', away: !vm.mine, ...vm.tactic }) : ''}<span class="small">${esc(vm.tacticLine)}</span><span class="small muted">최근 5경기 ${formDots(vm.form)}</span></span></div>`;
  const played = vm.matches.filter((m) => m.score);
  const recent = played.slice(-3).reverse();
  const squadAll = vm.squad.map((g) => `<h4 class="dt-group">${g.name} · ${g.rows.length}명</h4><div class="dt-list">${g.rows.map(squadRow).join('')}</div>`).join('');
  // 개요의 스쿼드는 한 줄 링크로 접는다 (C.71a 디자인 168, 개요 1,860px 이하): 인원 · 포지션군별 수 → 스쿼드 탭
  const squadLink = `<button type="button" class="panel dt-squadlink" data-act="team-tab" data-v="squad">${Icon({ name: 'player', size: 18 })}<span class="grow"><b>스쿼드 ${vm.squadSize}명</b> · ${vm.squad.map((g) => `${g.name} ${g.rows.length}`).join(' · ')}</span><b class="hi">스쿼드 탭</b>${Icon({ name: 'chevron-right', size: 16 })}</button>`;
  const key = vm.key.length
    ? `${SectionTitle({ title: '주요 선수', action: `OVR 순 ${vm.key.length}명` })}<div class="dt-list">${vm.key.map((k) => `<button type="button" class="dt-row" data-act="person-open" data-v="${esc(k.id)}">${Avatar({ size: 36, face: k.face, name: k.name })}<span class="grow"><b>${esc(k.name)}</b><small>${esc(k.pos)} · ${k.age}세 · ${esc(k.note)}</small></span><b class="po-num dt-ovr">${k.ovr}</b>${Icon({ name: 'chevron-right', size: 16 })}</button>`).join('')}</div>`
    : '';
  const fin = `${SectionTitle({ title: '재정', action: 'NPC 구단 운영 값' })}${panel(`<div class="kv"><span>재정 등급</span>${tierBars(vm.tier, vm.tierKo)}</div><div class="kv"><span>남은 영입 예산</span><b class="po-num">${esc(vm.finance.budget)}</b></div><div class="kv"><span>연봉 총액</span><b class="po-num">${esc(vm.finance.wages)} / 년</b></div>`)}`;
  const vsMe = vm.vsMe.length ? `${SectionTitle({ title: '우리 팀과의 경기', action: '이번 시즌' })}<div class="dt-list">${vm.vsMe.map(matchRow).join('')}</div>` : '';
  let body = '';
  if (tab === 'overview') {
    body = `${ident}${tiles}${tactic}${squadLink}
      ${key}${vsMe}
      ${SectionTitle({ title: '최근 경기' })}${recent.length ? `<div class="dt-list">${recent.map(matchRow).join('')}</div>` : '<p class="small muted">아직 치른 경기가 없어요.</p>'}
      ${fin}`;
  } else if (tab === 'squad') {
    body = `${SectionTitle({ title: '스쿼드', action: `${vm.squadSize}명 · OVR 순` })}${squadAll}`;
  } else if (tab === 'tactics') {
    body = `${tactic}<p class="small muted">미니 피치는 지금 로스터로 고른 베스트 11이에요(부상·이적 반영). 숫자 = 그 자리 OVR, 누르면 선수 상세.</p>`;
  } else {
    body = `${statTiles([{ value: r.played, label: '경기' }, { value: `${r.won}-${r.drawn}-${r.lost}`, label: '승-무-패' }, { value: `${r.gf}:${r.ga}`, label: '득점:실점' }, { value: r.points, label: '승점', hi: true }])}
      ${vsMe}${SectionTitle({ title: '이번 시즌 경기', action: `${played.length}/${vm.matches.length}` })}<div class="dt-list">${vm.matches.map(matchRow).join('')}</div>`;
  }
  return `${hero}<div class="body dt-body">${tabs}${body}<p class="small muted dt-foot">순위표·경기 준비·일정·이적 제안·득점 순위에서 팀 이름을 누르면 이 화면이 열려요. 읽기 전용.</p></div>`;
}

export function personDetailView(vm: PersonDetailVM, tab: PersonTab, back: boolean): string {
  const hero = HeroPanel({
    title: '선수', rightHtml: vm.teamId ? teamLink(vm.teamId, vm.team, 'dt-link--hero') : esc(vm.team), back: back ? { act: 'detail-back' } : false, compact: true, pad: false, progress: false,
    eyebrow: `${vm.name} · ${vm.pos} · ${vm.age}세 · OVR`, value: vm.ovr,
    chips: [`위상 ${vm.tierName} · ${vm.repScore}점`, { label: vm.nationality, soft: true }],
  });
  const profile = `<div class="panel profile-row">${Avatar({ size: 56, face: vm.face, name: vm.name })}<div class="grow"><span class="dt-badges">${TierBadge({ tier: vm.tier, score: vm.repScore, size: 'sm' })}${vm.clubTier ? tierBars(vm.clubTier, vm.clubTierKo) : ''}</span><small>${esc(vm.team)} · ${esc(vm.pos)} · ${vm.age}세${vm.shirt ? ` · ${vm.shirt}번` : ''}</small></div><span class="po-chip dt-ro">${Icon({ name: 'search', size: 12 })}읽기 전용</span></div>`;
  const tabs = Tabs({ items: [{ id: 'attrs', label: '능력치' }, { id: 'body', label: '몸·태그' }, { id: 'pos', label: '포지션' }, { id: 'record', label: '기록' }, { id: 'contract', label: '계약' }], value: tab, variant: 'underline', fill: true, act: 'person-tab' });
  const s = vm.season;
  const tags = vm.tags.length ? `<div class="chips">${vm.tags.map((t) => `<span class="po-chip dt-tag is-${t.kind}">${t.kind === 'legend' ? Icon({ name: 'star', size: 11 }) : ''}${esc(t.label)}</span>`).join('')}</div>` : '';
  let body = '';
  if (tab === 'attrs') {
    body = `<div class="dt-tiles dt-tiles--3">
        <div class="dt-tile"><small>몸값</small><b class="po-num">${esc(vm.value)}</b><span>남은 ${vm.yearsLeft}시즌 기준</span></div>
        <div class="dt-tile"><small>계약</small><b class="po-num">${esc(vm.until)}</b><span>시즌까지</span></div>
        <div class="dt-tile"><small>이번 시즌</small><b class="po-num">${s.apps}경기 ${s.goals}골</b><span>평균 평점 ${s.avg}</span></div>
      </div>${tags}
      ${SectionTitle({ title: '능력치 1~20', action: vm.keyNote })}${panel(attrGrid(vm.attrs))}`;
  } else if (tab === 'body') {
    // C.71a (디자인 169): 신체 5칸(내 선수 134와 같은 칸, 약발 올리기·내 모습 없음) · 국적 · 태그 · 유스
    const n = vm.bodyN;
    const stats = n
      ? `<div class="body-stats pl-stats">
        <div><small>등번호</small><b class="po-num">${vm.shirt ?? '—'}</b></div>
        <div><small>키</small><b class="po-num">${n.height}<i>cm</i></b></div>
        <div><small>몸무게</small><b class="po-num">${n.weight}<i>kg</i></b><span>BMI ${n.bmi}</span></div>
        <div><small>주발</small><b>${esc(vm.body.foot)}</b></div>
        <div><small>약발</small><b class="po-num">${n.weakFoot}</b><span>${'●'.repeat(n.weakFoot)}${'○'.repeat(5 - n.weakFoot)}</span></div>
      </div>`
      : panel('<p class="small muted">몸 정보가 없는 선수예요.</p>');
    const youth = vm.youthId && vm.youth !== '—'
      ? (vm.youthLeague ? `<button type="button" class="dt-link" data-act="team-open" data-v="${esc(vm.youthId)}">${Crest({ name: vm.youth, team: vm.youthId, size: 16 })} ${esc(vm.youth)}</button>` : `<b>${esc(vm.youth)}</b>`)
      : '<b class="muted">—</b>';
    body = `${SectionTitle({ title: '신체 · 양발', action: '오른쪽 끝 = 약발' })}${stats}
      <div class="panel pl-youth"><span class="grow small muted">국적</span><b>${esc(vm.nationality)}</b></div>
      ${SectionTitle({ title: `태그 ${vm.tags.length}`, action: '효과 없는 이름표' })}${tags || '<p class="small muted">붙은 태그가 없어요.</p>'}
      ${SectionTitle({ title: '유스' })}<div class="panel pl-youth"><span class="grow small muted">유스 출신</span>${youth}<small class="muted">기록</small></div>`;
  } else if (tab === 'pos') {
    body = `${SectionTitle({ title: '포지션별 OVR', action: `주 포지션 ${vm.pos}` })}${panel(`<div class="pl-pos dt-pos">${vm.posOvrs.map((p) => `<div class="pl-pos__cell${p.main ? ' is-main' : ''}"><span>${p.pos}</span><b class="po-num">${p.ovr}</b>${p.main ? '<em>주 포지션</em>' : ''}</div>`).join('')}</div><p class="muted small">다른 선수는 숙련도를 따로 기록하지 않아 능력치로만 계산한 OVR이에요.</p>`)}`;
  } else if (tab === 'record') {
    body = `${SectionTitle({ title: '이번 시즌', action: '리그 경기' })}${statTiles([{ value: s.apps, label: '출전' }, { value: s.goals, label: '골', hi: true }, { value: s.assists, label: '도움' }, { value: s.avg, label: '평균 평점' }])}
      ${SectionTitle({ title: '지난 시즌' })}${vm.history.length ? panel(`<div class="table-wrap"><table class="tbl"><tr><th>시즌</th><th>경기</th><th>골</th><th>도움</th><th>평점</th></tr>${vm.history.map((h) => `<tr><td>${h.season}</td><td>${h.apps}</td><td>${h.goals}</td><td>${h.assists}</td><td>${h.avg}</td></tr>`).join('')}</table></div>`) : '<p class="small muted">이 게임에서 끝난 시즌 기록이 아직 없어요.</p>'}
      <p class="small muted">다른 팀 경기를 빠른 진행(통계)으로 계산했으면 그 경기 기록은 빠져요.</p>`;
  } else {
    body = `${SectionTitle({ title: '계약' })}${panel(`<div class="kv"><span>소속</span>${vm.teamId ? teamLink(vm.teamId, vm.team) : `<b>${esc(vm.team)}</b>`}</div>${vm.clubTier ? `<div class="kv"><span>재정 등급</span>${tierBars(vm.clubTier, vm.clubTierKo)}</div>` : ''}<div class="kv"><span>주급(추정)</span><b class="po-num">${esc(vm.wage)}</b></div><div class="kv"><span>계약 마지막 시즌</span><b class="po-num">${esc(vm.until)}</b></div><div class="kv"><span>몸값</span><b class="po-num">${esc(vm.value)}</b></div><div class="kv"><span>바이아웃</span><b class="muted">—</b></div>`)}
      <p class="small muted">다른 선수의 바이아웃은 정하지 않아요(내 선수만 계약 탭에 있음).</p>`;
  }
  return `${hero}<div class="body dt-body">${profile}${tabs}${body}${RO_NOTE}</div>`;
}

/** 조사 "으로/로": 받침이 있고 ㄹ이 아니면 "으로" */
function euro(word: string): string {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return c >= 0 && c < 11172 && c % 28 !== 0 && c % 28 !== 8 ? '으로' : '로';
}

const RO_NOTE = `<p class="small muted dt-foot dt-ronote">${Icon({ name: 'eye', size: 14 })}<span>다른 선수는 <b class="ink">읽기 전용</b>이에요. [찍기]·[꾸미기]·[이적 요청] 같은 버튼은 없어요.</span></p>`;

/** 리그 밖으로 떠난 선수 (C.71a 디자인 169 리그밖빈화면): 탭 없이 빈 화면 + 떠나기 전 마지막 정보 + [이적 소식으로 돌아가기] */
export function leftPersonView(vm: LeftPersonVM, back: boolean): string {
  const hero = HeroPanel({
    title: '선수', back: back ? { act: 'detail-back' } : false, compact: true, pad: false, progress: false,
    eyebrow: `${vm.name} · ${vm.pos} · ${vm.age}세 · 마지막 OVR`, value: vm.ovr,
    chips: ['리그 밖', { label: `${vm.from} → ${vm.to}`, soft: true }],
  });
  const empty = `<div class="panel empty-state dt-left">${Icon({ name: 'world', size: 28 })}<b>리그 밖 선수예요</b><p class="small muted">${esc(vm.to)}${euro(vm.to)} 옮겨 리그를 떠났어요. 이 게임은 리그 20팀 선수만 능력치·기록·계약을 따라가서, 떠난 뒤 정보는 보여 줄 수 없어요.</p></div>`;
  const kv = (k: string, v: string) => `<div class="kv"><span>${k}</span>${v}</div>`;
  const info = panel([
    kv('마지막 소속', vm.fromId ? teamLink(vm.fromId, vm.from) : `<b>${esc(vm.from)}</b>`),
    kv('포지션 · 나이', `<b>${esc(vm.pos)} · ${vm.age}세</b>`),
    kv('마지막 OVR', `<b class="po-num">${vm.ovr}</b>`),
    kv('이적 사유', `<b>${esc(vm.why)}</b>`),
    kv('새 팀', `<span class="dt-badges"><b>${esc(vm.to)}</b>${vm.toTier ? FinChip(vm.toTier) : ''}</span>`),
    kv('몸값', `<b class="po-num">${esc(vm.fee)}</b>`),
  ].join(''));
  return `${hero}<div class="body dt-body">${empty}
    ${SectionTitle({ title: '떠나기 전 마지막 정보', action: vm.when })}${info}
    ${Button({ variant: 'secondary', size: 'lg', block: true, icon: 'restore', act: back ? 'detail-back' : 'go-tab', data: back ? {} : { v: 'world' }, children: '이적 소식으로 돌아가기' })}
    <p class="small muted dt-foot">이적 소식·득점 순위에서 리그 밖 선수 이름을 누르면 이 화면이 열려요. 탭은 보이지 않아요.</p></div>`;
}
