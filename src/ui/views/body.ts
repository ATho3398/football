// 선수 화면 "신체·양발·장단점" 칸 (부록 C.45) — 디자인 없는 새 패널. 약발 +1 포인트 구매 버튼

import { bmiOf, FOOT_KO } from '../../body';
import { BALANCE } from '../../config/balance';
import type { PlayerState } from '../../types';
import { TRAITS } from '../../traits';
import { Button, esc } from '../components';
import { panel } from './common';

export function bodySection(p: PlayerState, canBuy: boolean, shirt: number): string {
  const b = p.body;
  const W = BALANCE.weakFoot;
  const wt = p.weakFootTrain;
  const stars = '●'.repeat(b.weakFoot) + '○'.repeat(5 - b.weakFoot);
  const traits = p.traits.length
    ? `<div class="body-chips">${p.traits.map((t) => `<span class="cu-chip${TRAITS[t].kind === 'pro' ? ' is-on' : ''}" title="${esc(TRAITS[t].desc)}">${TRAITS[t].kind === 'pro' ? '장점' : '단점'} · ${esc(TRAITS[t].ko)}<small>${esc(TRAITS[t].desc)}${TRAITS[t].hook ? ` · ${esc(TRAITS[t].hook)} 단계에서` : ''}</small></span>`).join('')}</div>`
    : '<p class="small muted">장단점 없음</p>';
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
    ${traits}`);
}
