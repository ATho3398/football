// 대표팀 화면 (C.76d, 디자인 없음 — 부록 C 목록): 머리말(국가 · 소집 확률) · 통산 기록 · 일정/결과 · 대회(조 순위 · 녹아웃 대진).
// 표와 줄은 컵 화면(cupsSection)과 같은 class 를 쓴다
import { Crest, esc, HeroPanel, SectionTitle, Tabs } from '../components';
import { panel } from './common';
import type { NatFixtureVM, NationalVM } from '../nationalVM';

export type NationalTab = 'fixtures' | 'cups';

const OUT_KO = { win: '승', draw: '무', loss: '패' } as const;

function fixtureRow(f: NatFixtureVM): string {
  return `<div class="cup-tie"><span class="cup-tie__teams"><span class="dt-link team">${Crest({ name: f.opp, team: f.oppId, size: 16 })}${esc(f.opp)}</span>
    <b class="po-num cup-tie__score">${esc(f.score ?? 'vs')}</b>${f.outcome ? `<small class="nat-out is-${f.outcome}">${OUT_KO[f.outcome]}</small>` : ''}</span>
    <small class="muted">${esc([f.date, f.label, f.venue, f.line].filter(Boolean).join(' · '))}</small></div>`;
}

export function nationalView(vm: NationalVM, tab: NationalTab): string {
  const hero = HeroPanel({
    title: '대표팀', back: { act: 'go', data: { to: 'home' } }, eyebrow: `${vm.confed} · 대표팀 레이팅 ${vm.rating}`, value: vm.nation, pad: false, progress: false, compact: true,
    chips: [`소집 확률 ${vm.callPct}%`, { label: `위상 ${vm.tier} · OVR ${vm.ovr}`, soft: true }],
  });
  const c = vm.career;
  const career = panel(`<div class="nat-career">${[['A매치', c.apps], ['선발', c.starts], ['골', c.goals], ['도움', c.assists], ['평균 평점', c.avg], ['MOM', c.moms]]
    .map(([k, v]) => `<div><small class="muted">${k}</small><b class="po-num">${v}</b></div>`).join('')}</div>`);
  const tabs = Tabs({ items: [{ id: 'fixtures', label: '일정 · 결과' }, { id: 'cups', label: '대회' }], value: tab, act: 'nat-tab', label: '대표팀' });
  let body: string;
  if (tab === 'fixtures') {
    body = `${SectionTitle({ title: '다가오는 경기' })}${vm.upcoming.length ? panel(vm.upcoming.map(fixtureRow).join('')) : `<p class="small muted">잡힌 대표팀 경기가 없어요. ${esc(vm.status)}</p>`}
      ${SectionTitle({ title: '최근 결과', action: '지난 시즌부터' })}${vm.results.length ? panel(vm.results.map(fixtureRow).join('')) : '<p class="small muted">아직 대표팀 경기 기록이 없어요.</p>'}`;
  } else {
    const t = vm.tournament;
    const pick = vm.tournaments.length > 1 ? Tabs({ items: vm.tournaments.map((x) => ({ id: x.id, label: x.label })), value: t?.id ?? '', act: 'nat-cup', scroll: true, label: '대회' }) : '';
    const honors = vm.honors.length
      ? panel(`<table class="tbl league"><tr><th class="l">대회</th><th>성적</th><th>XP</th></tr>${vm.honors.map((h) => `<tr><td class="l">${h.year} ${esc(h.label)}</td><td>${esc(h.reach)}</td><td class="po-num">${h.xp || '-'}</td></tr>`).join('')}</table>`)
      : '<p class="small muted">아직 나간 대회가 없어요.</p>';
    const detail = t ? `${SectionTitle({ title: t.title, action: `우승 ${t.champion}` })}
      <p class="small"><b>${esc(vm.nation)}</b> ${esc(t.reach)}${t.called ? ' · 나도 뛰었어요' : ' · 나는 명단 밖'}</p>
      ${t.ko.map((st) => `<h4 class="ag-head">${esc(st.name)}</h4>${panel(st.ties.map((x) => `<div class="cup-tie${x.me ? ' me' : ''}"><span class="cup-tie__teams"><span class="dt-link team">${Crest({ name: x.a, team: x.aId, size: 16 })}${esc(x.a)}</span>
        <b class="po-num cup-tie__score">${esc(x.score)}</b><span class="dt-link team">${Crest({ name: x.b, team: x.bId, size: 16 })}${esc(x.b)}</span></span><small class="muted">${esc(x.w)} 진출</small></div>`).join(''))}`).join('')}
      <h4 class="ag-head">조별리그</h4><div class="cup-groups">${t.groups.map((gr) => `<div class="panel tbl-panel${gr.mine ? ' is-mine' : ''}"><table class="tbl league">
        <tr><th class="l">${esc(gr.name)}</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
        ${gr.rows.map((r) => `<tr class="${r.me ? 'me' : ''}${r.through ? ' top' : ''}"><td class="l">${Crest({ name: r.team, team: r.teamId, size: 16 })}${esc(r.team)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gd}</td><td><b class="po-num">${r.pts}</b></td></tr>`).join('')}
      </table></div>`).join('')}</div>
      <p class="small muted">${esc(t.note)}</p>` : '<p class="small muted">지난 대회 기록이 없어요. 월드컵·대륙컵은 시즌이 끝난 여름에 열려요.</p>';
    body = `${SectionTitle({ title: '대회 성적' })}${honors}${pick}${detail}`;
  }
  return `${hero}<div class="body nat-body">${SectionTitle({ title: '대표팀 기록', action: vm.next })}${career}<p class="small muted">${esc(vm.status)}</p>${tabs}${body}</div>`;
}
