// 경기 후 화면의 엔진 경기 요약 (E3). 뷰모델(EngineSummary, game.ts)만 받아 그린다 (부록 H.2)

import type { EngineSummary } from '../../game';

export interface MatchSummaryVM {
  engine?: EngineSummary;
  cards?: { yellows: number; red: boolean };
  /** 다음 경기 출장 정지가 남았는지 */
  banned: boolean;
}

export function matchSummaryView(vm: MatchSummaryVM): string {
  const e = vm.engine;
  const parts: string[] = [];
  if (e) {
    parts.push(`<div class="small muted">점유율 ${e.possession}% · 슈팅 ${e.shots[0]}(${e.shotsOnTarget[0]}) : ${e.shots[1]}(${e.shotsOnTarget[1]})</div>`);
    if (e.my) {
      const m = e.my;
      parts.push(`<div class="small muted">내 기록: 패스 ${m.passesCompleted}/${m.passes} · 슈팅 ${m.shots} · 태클 ${m.tackles} · 인터셉트 ${m.interceptions} · 드리블 ${m.dribbles} · ${m.distance}km</div>`);
    }
  }
  if (vm.cards) {
    const c = vm.cards;
    parts.push(`<div class="small ${c.red ? 'down' : ''}">${c.red ? '🟥 퇴장' : `🟨 경고 ${c.yellows}장`}</div>`);
  }
  if (vm.banned) parts.push('<div class="notice">다음 경기 출장 정지입니다.</div>');
  return parts.join('');
}
