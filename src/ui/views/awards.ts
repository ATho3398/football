// 개인 시상 화면 (C.76n, 디자인 없음 — 부록 C 목록): 올해 시상 · 역대 수상자. 표는 리그 표(tbl league) class 를 쓴다
// C.76t (47b): 부문 탭(세계 · 리그별) · 올해의 팀(자리별) · 이달의 선수 탭 · 시상식(후보 → 최종 3인 → 발표)
import { Button, Crest, esc, HeroPanel, SectionTitle, Tabs } from '../components';
import { panel } from './common';
import type { AwardCardVM, AwardLineVM, AwardsVM, CeremonyVM } from '../awardsVM';

export type AwardsTab = 'year' | 'month' | 'history';

function lineRow(l: AwardLineVM, ranked: boolean): string {
  return `<tr class="${l.me ? 'me' : ''}${ranked && l.rank === 1 ? ' top' : ''}">${ranked ? `<td class="po-num">${l.rank}</td>` : ''}<td class="l">${Crest({ name: l.team, team: l.teamId, size: 16 })}${esc(l.name)}<small class="muted"> ${esc(l.team)}</small></td>${
    ranked ? `<td class="po-num">${esc(l.value)}</td><td class="muted small">${esc(l.first)}</td>` : ''}</tr>`;
}

function card(c: AwardCardVM): string {
  const head = `${SectionTitle({ title: c.name, action: [c.mine ? `나 ${c.mine}` : '', c.when].filter(Boolean).join(' · ') })}<p class="small muted aw-desc">${esc(c.desc)}</p>`;
  if (c.status === 'none') {
    const why = c.when === '월드컵이 열린 해에만' ? '월드컵이 열린 여름에만 시상해요.' : c.when === '대륙 대회가 열린 해에만' ? '내 나라 대륙 대회(유로 · 코파 · 아시안컵 등)가 열린 여름에만 시상해요.' : '이 시즌에는 시상하지 않았어요.';
    return `${head}<p class="small muted">${why}</p>`;
  }
  if (c.status === 'pending') return `${head}${panel(`<p class="small muted">아직 발표 전이에요 · ${esc(c.when)}</p>`)}`;
  if (c.status === 'nominees') {
    return `${head}${panel(`<p class="small">후보 ${c.lines.length}명 (가나다순) · 결과는 ${esc(c.when)}</p><table class="tbl league">${c.lines.map((l) => lineRow(l, false)).join('')}</table>`)}`;
  }
  const more = c.more.length ? `<details class="aw-more"><summary class="small">나머지 후보 ${c.more.length}명</summary><table class="tbl league">${c.more.map((l) => lineRow(l, true)).join('')}</table></details>` : '';
  if (c.xi) {
    return `${head}${panel(`<table class="tbl league"><tr><th>자리</th><th class="l">선수</th><th>득표</th></tr>${c.lines.map((l) => `<tr class="${l.me ? 'me' : ''}"><td class="small">${esc(l.pos ?? '')}</td><td class="l">${Crest({ name: l.team, team: l.teamId, size: 16 })}${esc(l.name)}<small class="muted"> ${esc(l.team)}</small></td><td class="po-num">${esc(l.value)}</td></tr>`).join('')}</table>`)}`;
  }
  const cer = c.cer ? `<div class="aw-cer-open">${Button({ act: 'aw-cer', data: { v: c.id }, children: '시상식 보기', variant: 'secondary', size: 'sm' })}</div>` : '';
  return `${head}${panel(`<table class="tbl league"><tr><th>순위</th><th class="l">선수</th><th>${c.record ? '기록' : '득표'}</th><th></th></tr>${c.lines.map((l) => lineRow(l, true)).join('')}</table>${more}${cer}`)}`;
}

/** 시상식 (C.76t): 후보 → 최종 3인 → 발표 */
function ceremony(c: CeremonyVM): string {
  const steps = ['후보', '최종 3인', '발표'].map((t, i) => `<span class="chip${i === c.step ? '' : ' soft'}">${i + 1}. ${t}</span>`).join(' ');
  const win = c.winner
    ? `<div class="aw-cer-win">${Crest({ name: c.winner.team, team: c.winner.teamId, size: 40 })}<div><b class="aw-cer-name">${esc(c.winner.name)}</b><p class="small muted">${esc(c.winner.team)} · ${esc(c.winner.value)}${c.winner.first ? ` · ${esc(c.winner.first)}` : ''}</p></div></div>`
    : '';
  const ranked = c.step === 2;
  const nav = [
    c.step < 2 ? Button({ act: 'aw-cer-step', data: { v: c.step + 1 }, children: c.step === 0 ? '최종 3인 보기' : '수상자 발표', variant: 'primary', size: 'sm' }) : '',
    Button({ act: 'aw-cer', data: { v: '' }, children: '닫기', variant: 'ghost', size: 'sm' }),
  ].join(' ');
  return `${SectionTitle({ title: `${c.name} 시상식` })}<p class="small">${steps}</p>${panel(`<p class="small"><b>${esc(c.head)}</b> <span class="muted">${esc(c.sub)}</span></p>${win}<table class="tbl league">${ranked ? '<tr><th>순위</th><th class="l">선수</th><th>득표</th><th></th></tr>' : ''}${c.lines.map((l) => lineRow(l, ranked)).join('')}</table><div class="aw-cer-nav">${nav}</div>`)}`;
}

export function awardsView(vm: AwardsVM, tab: AwardsTab): string {
  const chips: (string | { label: string; soft?: boolean })[] = [...vm.counts.map((c) => `${c.name} ${c.n}회`), ...vm.badges.map((b) => ({ label: `배지 · ${b.name} ${b.n}회`, soft: true }))];
  const hero = HeroPanel({
    title: '개인 시상', back: { act: 'go', data: { to: 'home' } }, eyebrow: '발롱도르 · 더 베스트 · 리그 올해의 선수 · 올해의 팀 · 이달의 선수', value: vm.title, pad: false, progress: false, compact: true,
    chips: chips.length ? chips : [{ label: '아직 받은 개인상 없음', soft: true }],
  });
  const tabs = Tabs({ items: [{ id: 'year', label: '시상' }, { id: 'month', label: '이달의 선수' }, { id: 'history', label: '역대 수상자' }], value: tab, act: 'aw-tab', label: '개인 시상' });
  let body: string;
  if (tab === 'year' && vm.ceremony) {
    body = ceremony(vm.ceremony);
  } else if (tab === 'year') {
    const pick = vm.years.length > 1 ? Tabs({ items: [...vm.years].reverse(), value: String(vm.season ?? ''), act: 'aw-season', scroll: true, label: '시상 연도' }) : '';
    const grp = vm.groups.length > 1 ? Tabs({ items: vm.groups, value: vm.group, act: 'aw-group', scroll: true, label: '부문' }) : '';
    body = vm.season === null
      ? '<p class="small muted">아직 시상 기록이 없어요. 시즌이 끝나면 이력서(기록 · 트로피 · 결정적 순간 · 서사 · 인기)를 바탕으로 투표단이 뽑아요. 골든부츠 · 리그 올해의 선수 · 올해의 팀 · 챔스 최우수 선수는 시즌 끝, 발롱도르 후보는 8월 · 시상은 10월, 골든보이 11월, 더 베스트 · FIFPRO 월드 11은 12월에 발표돼요. 이달의 선수는 매달 1일.</p>'
      : `${pick}${grp}${vm.myTags.length ? `<p class="small">내 시즌 서사: ${vm.myTags.map((t) => `<span class="chip soft">${esc(t)}</span>`).join(' ')}</p>` : ''}${vm.est ? '<p class="small muted">다른 경기를 빠른 진행으로 돌려 일부 선수 기록은 추정했어요.</p>' : ''}${vm.cards.map(card).join('')}`;
  } else if (tab === 'month') {
    const grp = vm.groups.length > 1 ? Tabs({ items: vm.groups.filter((x) => x.id !== vm.myLeague).map((x) => (x.id === 'world' ? { ...x, label: '내 리그' } : x)), value: vm.group === vm.myLeague ? 'world' : vm.group, act: 'aw-group', scroll: true, label: '리그' }) : '';
    body = `${grp}<p class="small muted">${esc(vm.potmLeague)} 이달의 선수 — 매달 1일에 지난달 경기(골 · 도움 · 결정적 순간 · 팀 승점)로 기자단 · 팬이 투표해요. 받으면 XP.</p>${vm.potm.length
      ? vm.potm.map((s) => `${SectionTitle({ title: `${s.season} 시즌` })}${panel(`<table class="tbl league"><tr><th>달</th><th class="l">선수</th><th>그달</th><th>득표</th></tr>${s.rows.map((r) => `<tr class="${r.me ? 'me' : ''}"><td class="po-num">${esc(r.month)}</td><td class="l">${Crest({ name: r.team, team: r.teamId, size: 16 })}${esc(r.name)}<small class="muted"> ${esc(r.team)}</small></td><td class="po-num">${esc(r.goals)}</td><td class="po-num">${esc(r.votes)}</td></tr>`).join('')}</table>`)}`).join('')
      : '<p class="small muted">아직 이달의 선수 기록이 없어요.</p>'}`;
  } else {
    const pick = Tabs({ items: vm.hist, value: vm.histId, act: 'aw-hist', scroll: true, label: '상' });
    body = `${pick}${vm.histRows.length
      ? panel(`<table class="tbl league"><tr><th>연도</th><th class="l">수상자</th><th>기록</th></tr>${vm.histRows.map((r) => `<tr class="${r.me ? 'me' : ''}"><td class="po-num">${esc(r.year)}</td><td class="l">${Crest({ name: r.team, team: r.teamId, size: 16 })}${esc(r.name)}<small class="muted"> ${esc(r.team)}</small></td><td class="po-num">${esc(r.value)}</td></tr>`).join('')}</table>`)
      : '<p class="small muted">아직 발표된 수상자가 없어요.</p>'}`;
  }
  return `${hero}<div class="body aw-body">${tabs}${body}</div>`;
}
