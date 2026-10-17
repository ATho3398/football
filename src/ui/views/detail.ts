// 다른 팀·다른 선수 상세 (C.53, pending 82 4번) — 6차 디자인 157 `팀상세` · 158 `선수상세-다른선수`.
// 읽기 전용: 편집 버튼([찍기]·[꾸미기]·[이적 요청])이 없다. 팀 이름·선수 이름을 누르면 서로 오간다

import { Avatar, Crest, esc, FinChip, FormationPitch, HeroPanel, Icon, SectionTitle, TacticChip, Tabs, TierBadge } from '../components';
import { TIER_KO, type FinanceTier } from '../../finance';
import type { PersonDetailVM, PersonTab, SquadRowVM, TeamDetailVM, TeamMatchVM, TeamTab } from '../detailVM';
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

const SQUAD_PREVIEW = 3;

export function teamDetailView(vm: TeamDetailVM, tab: TeamTab, back: boolean): string {
  const hero = HeroPanel({
    title: '팀', right: `${vm.round}R / ${vm.rounds}`, back: back ? { act: 'detail-back' } : false, compact: true, pad: false, progress: false,
    eyebrow: `${vm.name} · 전력`, value: vm.rating.toFixed(1),
    chips: [`리그 ${vm.rank}위`, { label: `재정 ${vm.tierKo}`, soft: true }, ...(vm.mine ? [{ label: '우리 팀', soft: true }] : vm.derby ? [{ label: vm.derby, soft: true }] : [])],
  });
  const tabs = Tabs({ items: [{ id: 'overview', label: '개요' }, { id: 'squad', label: '스쿼드' }, { id: 'tactics', label: '전술' }, { id: 'matches', label: '경기' }], value: tab, variant: 'underline', fill: true, act: 'team-tab' });
  const r = vm.record;
  const gd = r.gf - r.ga;
  const ident = `<div class="panel dt-ident">${Crest({ name: vm.name, team: vm.id, size: 44 })}<span class="grow"><b>${esc(vm.name)}</b><small>${tierBars(vm.tier, vm.tierKo)} · 감독·홈구장 정보 없음</small></span></div>`;
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
  // 개요는 포지션군마다 OVR 상위 3명 (디자인 157: GK 2 · DF·MF·FW 3), 나머지는 스쿼드 탭
  const shown = vm.squad.reduce((t, g) => t + Math.min(g.rows.length, SQUAD_PREVIEW), 0);
  const squadPreview = vm.squad.map((g) => `<h4 class="dt-group">${g.name} · ${g.rows.length}명</h4><div class="dt-list">${g.rows.slice(0, SQUAD_PREVIEW).map(squadRow).join('')}</div>`).join('');
  const more = vm.squadSize > shown
    ? `<button type="button" class="dt-more" data-act="team-tab" data-v="squad">${Icon({ name: 'chevron-right', size: 14, style: 'transform:rotate(90deg)' })}스쿼드 ${vm.squadSize - shown}명 더 보기</button>`
    : '';
  const key = vm.key.length
    ? `${SectionTitle({ title: '주요 선수' })}<div class="dt-list">${vm.key.map((k) => `<button type="button" class="dt-row" data-act="person-open" data-v="${esc(k.id)}">${Avatar({ size: 36, face: k.face, name: k.name })}<span class="grow"><b>${esc(k.name)}</b><small>${esc(k.pos)} · ${k.age}세 · ${esc(k.note)}</small></span>${Icon({ name: 'chevron-right', size: 16 })}</button>`).join('')}</div>`
    : '';
  const fin = `${SectionTitle({ title: '재정', action: 'NPC 구단 운영 값' })}${panel(`<div class="kv"><span>재정 등급</span>${tierBars(vm.tier, vm.tierKo)}</div><div class="kv"><span>남은 영입 예산</span><b class="po-num">${esc(vm.finance.budget)}</b></div><div class="kv"><span>연봉 총액</span><b class="po-num">${esc(vm.finance.wages)} / 년</b></div>`)}`;
  const vsMe = vm.vsMe.length ? `${SectionTitle({ title: '우리 팀과의 경기', action: '이번 시즌' })}<div class="dt-list">${vm.vsMe.map(matchRow).join('')}</div>` : '';
  let body = '';
  if (tab === 'overview') {
    body = `${ident}${tiles}${tactic}
      ${SectionTitle({ title: '스쿼드', action: `${vm.squadSize}명 · 누르면 선수 상세` })}${squadPreview}${more}
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
    body = `${SectionTitle({ title: '신체·양발' })}${panel(`<div class="kv"><span>키</span><b class="po-num">${esc(vm.body.height)}</b></div><div class="kv"><span>몸무게</span><b class="po-num">${esc(vm.body.weight)}</b></div><div class="kv"><span>주발</span><b>${esc(vm.body.foot)}</b></div><div class="kv"><span>약발</span><b class="po-num">${esc(vm.body.weakFoot)}</b></div><div class="kv"><span>국적</span><b>${esc(vm.nationality)}</b></div>`)}
      ${SectionTitle({ title: '태그', action: '효과 없는 이름표' })}${tags || '<p class="small muted">붙은 태그가 없어요.</p>'}
      ${SectionTitle({ title: '유스' })}${panel(`<div class="kv"><span>유스 출신</span><b>${esc(vm.youth)}</b></div>`)}`;
  } else if (tab === 'pos') {
    body = `${SectionTitle({ title: '포지션별 OVR', action: `주 포지션 ${vm.pos}` })}${panel(`<div class="pos-grid">${vm.posOvrs.map((p) => `<div class="${p.main ? 'main' : ''}"><span>${p.pos}</span><b class="po-num">${p.ovr}</b></div>`).join('')}</div><span class="muted small">다른 선수는 숙련도를 따로 기록하지 않아 능력치로만 계산한 OVR이에요.</span>`)}`;
  } else if (tab === 'record') {
    body = `${SectionTitle({ title: '이번 시즌', action: '리그 경기' })}${statTiles([{ value: s.apps, label: '출전' }, { value: s.goals, label: '골', hi: true }, { value: s.assists, label: '도움' }, { value: s.avg, label: '평균 평점' }])}
      ${SectionTitle({ title: '지난 시즌' })}${vm.history.length ? panel(`<div class="table-wrap"><table class="tbl"><tr><th>시즌</th><th>경기</th><th>골</th><th>도움</th><th>평점</th></tr>${vm.history.map((h) => `<tr><td>${h.season}</td><td>${h.apps}</td><td>${h.goals}</td><td>${h.assists}</td><td>${h.avg}</td></tr>`).join('')}</table></div>`) : '<p class="small muted">이 게임에서 끝난 시즌 기록이 아직 없어요.</p>'}
      <p class="small muted">다른 팀 경기를 빠른 진행(통계)으로 계산했으면 그 경기 기록은 빠져요.</p>`;
  } else {
    body = `${SectionTitle({ title: '계약' })}${panel(`<div class="kv"><span>소속</span>${vm.teamId ? teamLink(vm.teamId, vm.team) : `<b>${esc(vm.team)}</b>`}</div>${vm.clubTier ? `<div class="kv"><span>재정 등급</span>${tierBars(vm.clubTier, vm.clubTierKo)}</div>` : ''}<div class="kv"><span>주급(추정)</span><b class="po-num">${esc(vm.wage)}</b></div><div class="kv"><span>계약 마지막 시즌</span><b class="po-num">${esc(vm.until)}</b></div><div class="kv"><span>몸값</span><b class="po-num">${esc(vm.value)}</b></div><div class="kv"><span>바이아웃</span><b class="muted">—</b></div>`)}
      <p class="small muted">다른 선수의 바이아웃은 정하지 않아요(내 선수만 계약 탭에 있음).</p>`;
  }
  return `${hero}<div class="body dt-body">${profile}${tabs}${body}<p class="small muted dt-foot">다른 선수는 읽기 전용이에요. [찍기]·[꾸미기]·[이적 요청] 같은 버튼은 없어요.</p></div>`;
}
