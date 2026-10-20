// 개인 시상 화면 (C.76n, 디자인 없음 — 부록 C 목록): 올해 시상 · 역대 수상자. 표는 리그 표(tbl league) class 를 쓴다
import { Crest, esc, HeroPanel, SectionTitle, Tabs } from '../components';
import { panel } from './common';
import type { AwardCardVM, AwardLineVM, AwardsVM } from '../awardsVM';

export type AwardsTab = 'year' | 'history';

function lineRow(l: AwardLineVM, ranked: boolean): string {
  return `<tr class="${l.me ? 'me' : ''}${ranked && l.rank === 1 ? ' top' : ''}">${ranked ? `<td class="po-num">${l.rank}</td>` : ''}<td class="l">${Crest({ name: l.team, team: l.teamId, size: 16 })}${esc(l.name)}<small class="muted"> ${esc(l.team)}</small></td>${
    ranked ? `<td class="po-num">${esc(l.value)}</td><td class="muted small">${esc(l.first)}</td>` : ''}</tr>`;
}

function card(c: AwardCardVM): string {
  const head = `${SectionTitle({ title: c.name, action: [c.mine ? `나 ${c.mine}` : '', c.when].filter(Boolean).join(' · ') })}<p class="small muted aw-desc">${esc(c.desc)}</p>`;
  if (c.status === 'none') return `${head}<p class="small muted">${c.when === '월드컵이 열린 해에만' ? '월드컵이 열린 여름에만 시상해요.' : '이 시즌에는 시상하지 않았어요.'}</p>`;
  if (c.status === 'pending') return `${head}${panel(`<p class="small muted">아직 발표 전이에요 · ${esc(c.when)}</p>`)}`;
  if (c.status === 'nominees') {
    return `${head}${panel(`<p class="small">후보 ${c.lines.length}명 (가나다순) · 결과는 ${esc(c.when)}</p><table class="tbl league">${c.lines.map((l) => lineRow(l, false)).join('')}</table>`)}`;
  }
  const more = c.more.length ? `<details class="aw-more"><summary class="small">나머지 후보 ${c.more.length}명</summary><table class="tbl league">${c.more.map((l) => lineRow(l, true)).join('')}</table></details>` : '';
  return `${head}${panel(`<table class="tbl league"><tr><th>순위</th><th class="l">선수</th><th>${c.id === 'goldenBoot' || c.id === 'muller' ? '기록' : '득표'}</th><th></th></tr>${c.lines.map((l) => lineRow(l, true)).join('')}</table>${more}`)}`;
}

export function awardsView(vm: AwardsVM, tab: AwardsTab): string {
  const hero = HeroPanel({
    title: '개인 시상', back: { act: 'go', data: { to: 'home' } }, eyebrow: '발롱도르 · 더 베스트 · 코파 · 야신 · 골든보이 · 골든부츠 · 뮐러', value: vm.title, pad: false, progress: false, compact: true,
    chips: vm.counts.length ? vm.counts.map((c) => `${c.name} ${c.n}회`) : [{ label: '아직 받은 개인상 없음', soft: true }],
  });
  const tabs = Tabs({ items: [{ id: 'year', label: '시상' }, { id: 'history', label: '역대 수상자' }], value: tab, act: 'aw-tab', label: '개인 시상' });
  let body: string;
  if (tab === 'year') {
    const pick = vm.years.length > 1 ? Tabs({ items: [...vm.years].reverse(), value: String(vm.season ?? ''), act: 'aw-season', scroll: true, label: '시상 연도' }) : '';
    body = vm.season === null
      ? '<p class="small muted">아직 시상 기록이 없어요. 시즌이 끝나면 이력서(기록 · 트로피 · 결정적 순간 · 서사 · 인기)를 바탕으로 투표단이 뽑아요. 골든부츠는 시즌 끝, 발롱도르 후보는 8월 · 시상은 10월, 골든보이 11월, 더 베스트 12월에 발표돼요.</p>'
      : `${pick}${vm.myTags.length ? `<p class="small">내 시즌 서사: ${vm.myTags.map((t) => `<span class="chip soft">${esc(t)}</span>`).join(' ')}</p>` : ''}${vm.est ? '<p class="small muted">다른 경기를 빠른 진행으로 돌려 일부 선수 기록은 추정했어요.</p>' : ''}${vm.cards.map(card).join('')}`;
  } else {
    const pick = Tabs({ items: vm.hist, value: vm.histId, act: 'aw-hist', scroll: true, label: '상' });
    body = `${pick}${vm.histRows.length
      ? panel(`<table class="tbl league"><tr><th>연도</th><th class="l">수상자</th><th>기록</th></tr>${vm.histRows.map((r) => `<tr class="${r.me ? 'me' : ''}"><td class="po-num">${esc(r.year)}</td><td class="l">${Crest({ name: r.team, team: r.teamId, size: 16 })}${esc(r.name)}<small class="muted"> ${esc(r.team)}</small></td><td class="po-num">${esc(r.value)}</td></tr>`).join('')}</table>`)
      : '<p class="small muted">아직 발표된 수상자가 없어요.</p>'}`;
  }
  return `${hero}<div class="body aw-body">${tabs}${body}</div>`;
}
