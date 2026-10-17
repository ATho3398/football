// 선수 화면 "신체·양발·장단점" 칸 (부록 C.45) — 디자인 없는 새 패널. 약발 +1 포인트 구매 버튼

import { bmiOf, FOOT_KO } from '../../body';
import { BALANCE } from '../../config/balance';
import type { PlayerState } from '../../types';
import { TAGS, tagName } from '../../tags';
import { Button, esc } from '../components';
import { panel } from './common';

export function bodySection(p: PlayerState, canBuy: boolean, shirt: number, youthName = ''): string {
  const b = p.body;
  const W = BALANCE.weakFoot;
  const wt = p.weakFootTrain;
  const stars = '●'.repeat(b.weakFoot) + '○'.repeat(5 - b.weakFoot);
  // 태그 (C.45 pending 66): 생성 때 고른 장단점과 플레이로 얻은 커리어 태그를 한 줄로. 해제형은 조건을 채우면 사라진다
  const season = (t: { season: number }) => `${t.season}-${String((t.season + 1) % 100).padStart(2, '0')}`;
  const traits = p.tags.length
    ? `<div class="body-chips">${p.tags.map((t) => {
      const d = TAGS[t.id];
      const label = d.kind === 'pro' ? '장점' : d.kind === 'con' ? '단점' : '커리어';
      const desc = `${d.desc}${t.perm ? '' : d.removeDesc ? ` · 해제형: ${d.removeDesc}이면 사라짐` : ''}${d.hook ? ` · ${d.hook} 단계에서` : ''} · ${season(t)}`;
      return `<span class="cu-chip${d.kind !== 'con' ? ' is-on' : ''}" title="${esc(desc)}">${label} · ${esc(tagName(t))}${t.perm ? '' : ' (해제형)'}<small>${esc(desc)}</small></span>`;
    }).join('')}</div>`
    : '<p class="small muted">태그 없음</p>';
  return panel(`
    <div class="body-stats">
      <div><small>등번호</small><b class="po-num">${shirt}</b></div>
      <div><small>키</small><b class="po-num">${b.height}</b><span>cm</span></div>
      <div><small>몸무게</small><b class="po-num">${b.weight}</b><span>kg · BMI ${bmiOf(b).toFixed(1)}</span></div>
      <div><small>주발</small><b>${FOOT_KO[b.foot]}</b></div>
      <div><small>약발</small><b class="po-num">${b.weakFoot}</b><span>${stars}${b.weakFoot >= 5 ? ' 양발' : ''}</span></div>
    </div>
    <p class="small muted">약발 쪽으로 차야 하는 슛·크로스·긴 패스 정확도 ×${BALANCE.body.weakFootMul[b.weakFoot - 1]}. 약발 훈련 게이지 ${Math.floor(wt?.gauge ?? 0)}/${W.trainingGauge} · 이번 시즌 +${wt?.gained ?? 0}/${W.seasonMax}</p>
    ${b.weakFoot < 5 ? Button({ variant: 'secondary', block: true, act: 'buy-weakfoot', disabled: !canBuy, children: `약발 ${b.weakFoot} → ${b.weakFoot + 1} · 포인트 ${W.pointCost}P (보유 ${p.unspentPoints}P)` }) : ''}
    ${traits}
    ${p.youth ? `<p class="small">유스: <b>${esc(youthName)}</b>${p.youth.random ? ' (랜덤)' : ''}</p>` : ''}
`);
}

/** 월드 → 이적 소식 아래 "커리어 태그 소식" (C.45 14번, NPC 태그는 뉴스에만) — 디자인 없는 새 패널 */
export function tagNewsSection(rows: { season: string; name: string; team: string; tag: string }[]): string {
  if (!rows.length) return '';
  return `<div class="po-section"><span class="po-section__bar" aria-hidden="true"></span><h2 class="po-section__title">커리어 태그 소식</h2><span class="po-section__action">원클럽맨 · 영원한 &lt;구단&gt;</span></div>
    ${panel(`<div class="opts">${rows.map((r) => `<div class="kv"><span><b>${esc(r.name)}</b> <small class="muted">${esc(r.team)} · ${esc(r.season)}</small></span><span class="cu-chip is-on">${esc(r.tag)}</span></div>`).join('')}</div>`)}`;
}
