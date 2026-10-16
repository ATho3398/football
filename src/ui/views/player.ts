// 선수 (I.8, 디자인 44): 경고와 출장, 위상·레벨, 능력치, 포지션별 OVR, 시즌 기록.
// 성향 슬라이더·역할(전술 화면 링크)은 아직 없는 기능이라 숨긴다 (I.19)

import { esc, FormIndicator, HeroPanel, Meter, OptionRow, SectionTitle, StatBar, TierBadge } from '../components';
import type { HistoryRowVM, PlayerVM } from '../viewModels';
import { panel, seasonMatchesSection } from './common';

export function historyTable(rows: HistoryRowVM[]): string {
  if (!rows.length) return '<p class="muted small">아직 끝난 시즌이 없어요.</p>';
  return `<div class="table-wrap"><table class="tbl">
    <tr><th>시즌</th><th>나이</th><th>OVR</th><th>경기</th><th>골</th><th>도움</th><th>평점</th><th>순위</th></tr>
    ${rows.map((r) => `<tr><td>${r.season}</td><td>${r.age}</td><td>${r.ovr}</td><td>${r.apps}</td><td>${r.goals}</td><td>${r.assists}</td><td>${r.avg}</td><td>${r.pos}</td></tr>`).join('')}
  </table></div>`;
}

/** 경고 누적 칸 (디자인 44): 쌓인 옐로는 노란 칸 */
function yellowPips(n: number, every: number): string {
  return Array.from({ length: every }, (_, i) => `<i class="pip${i < n ? ' on' : ''}"></i>`).join('');
}

export function playerView(vm: PlayerVM, extra = ''): string {
  const c = vm.condition;
  const hero = HeroPanel({
    title: '선수', right: vm.team, back: false, eyebrow: `${vm.name} · ${vm.position} · ${vm.age}세 · OVR`, value: vm.ovr, pad: false, progress: false,
    chips: [`위상 ${vm.tierName} · ${vm.reputation}점`, `폼 ${['최악', '나쁨', '보통', '좋음', '최고'][c.form - 1]}`, { label: `옐로 ${c.yellows}/${c.yellowEvery}`, soft: true }],
  });
  const ban = vm.suspended > 0
    ? `<div class="ban-row"><i class="redcard"></i><span class="grow"><b>출장 정지 ${vm.suspended}경기 남음</b></span>${vm.nextOpp ? `<span class="fail small">${esc(vm.nextOpp)}전 결장</span>` : ''}</div>`
    : '';
  const rep = vm.next
    ? Meter({ value: vm.reputation - vm.next.from, max: vm.next.cut - vm.next.from, label: `${vm.next.name}까지 ${vm.next.cut - vm.reputation}점`, showValue: true, tone: 'brand' })
    : `<p class="muted small">${vm.isLegendary ? '최고 위상 티어예요.' : '월드클래스예요. 레전더리는 점수가 아니라 아래 업적 조건으로 열려요.'}</p>`;
  const legend = `<div class="opts">${vm.legendary.map((l, i) => OptionRow({
    icon: l.met ? 'star' : 'lock', title: `${i === 0 ? '' : i === 1 ? '그리고 ' : '또는 '}${l.label}`,
    desc: l.locked ? '아직 열리지 않은 대회예요' : l.met ? '달성' : '진행 중',
    right: `<b class="po-num small${l.met ? ' hi' : ' muted'}">${l.met ? '달성' : l.locked ? '잠김' : '미달성'}</b>`, disabled: !l.met,
  })).join('')}</div>
    <span class="muted small">레전더리 = 위상 월드클래스 + 발롱도르 1회 이상 그리고 (트레블 또는 월드컵 우승 또는 발롱도르 3회 이상). 한 번 달면 영구예요.</span>`;
  return `
    ${hero}
    <div class="body">
      ${SectionTitle({ title: '경고와 출장' })}
      ${panel(`
        <div class="kv"><b>경고 누적</b><span class="pips">${yellowPips(c.yellows, c.yellowEvery)}<b class="po-num">${c.yellows}/${c.yellowEvery}</b></span></div>
        <span class="muted small">옐로카드 ${c.yellowEvery}장이 쌓이면 다음 1경기에 나올 수 없어요.</span>
        ${ban}`)}
      ${SectionTitle({ title: '위상과 레벨', action: `누적 XP ${vm.totalXp}` })}
      ${panel(`
        <div class="kv">${TierBadge({ tier: vm.tier, score: vm.reputation })}${FormIndicator({ level: c.form })}</div>
        ${rep}
        ${Meter({ value: vm.xp, max: vm.xpMax, label: `Lv ${vm.level} → ${vm.level + 1}`, showValue: true, tone: 'xp' })}`)}
      ${extra}
      ${SectionTitle({ title: '포지션별 OVR · 숙련도', action: `주 포지션 ${vm.position}` })}
      ${panel(`<div class="pos-grid">${vm.posOvrs.map((p) => `<div class="${p.main ? 'main' : ''}"><span>${p.pos}</span><b class="po-num">${p.ovr}</b><small class="prof"><i style="width:${p.prof}%"></i></small><em class="po-num">숙련 ${p.prof}</em></div>`).join('')}</div>
        <span class="muted small">숙련도가 100보다 낮으면 그 포지션 OVR이 (100 − 숙련도) × 0.25만큼 낮아져요. 그 포지션으로 뛰면 숙련도가 올라요.</span>`)}
      ${SectionTitle({ title: '레전더리 조건', action: vm.isLegendary ? '달성' : '잠김' })}
      ${legend}
      ${SectionTitle({ title: '레전드 배지', action: `${vm.badges.filter((b) => b.earned).length}/${vm.badges.length}` })}
      <div class="opts">${vm.badges.map((b) => OptionRow({ icon: b.earned ? 'star' : 'lock', title: b.name, desc: b.earned ? `${b.desc} · ${b.earned}` : b.desc, right: `<b class="po-num small${b.earned ? ' hi' : ' muted'}">${b.earned ? '획득' : esc(b.progress)}</b>`, disabled: !b.earned })).join('')}</div>
      ${SectionTitle({ title: '능력치', action: '★ 핵심 능력치' })}
      ${vm.groups.map((g) => panel(`<h3 class="grp">${esc(g.name)}</h3>${g.rows.map((r) => StatBar({ label: `${r.key ? '★ ' : ''}${r.label}`, value: r.value, highlight: r.key })).join('')}`)).join('')}
      ${seasonMatchesSection(vm.matches)}
      ${SectionTitle({ title: '시즌별 기록' })}
      ${panel(historyTable(vm.history))}
    </div>`;
}
