// 경기 후 평균 위치 지도 (24.3 개정): 우리·상대 진형 한 장. 홈 팀이 오른쪽으로 공격하는 방향으로 맞춘다.
// 재생 데이터에서 계산하므로 방금 치른 경기에서만 보인다 (세이브에 담지 않는다)

import { averagePositions } from '../../highlights';
import type { Replay } from '../../replay';
import { drawAveragePositions, pitchSize, playerMap, TEAM_COLORS } from '../pitch/renderer';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function avgMapView(teams: [string, string]): string {
  return `
    <div class="avg-map">
      <h3>평균 위치</h3>
      <canvas id="avg-canvas" class="pitch"></canvas>
      <div class="small muted"><i class="team-dot" style="background:${TEAM_COLORS[0]}"></i>${esc(teams[0])} → 공격 방향
        <i class="team-dot" style="background:${TEAM_COLORS[1]}"></i>${esc(teams[1])} ← 공격 방향</div>
    </div>`;
}

export function drawAvgMap(r: Replay): void {
  const canvas = document.getElementById('avg-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const [w, h] = pitchSize(canvas.clientWidth || 340);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawAveragePositions(ctx, w, h, averagePositions(r), playerMap(r));
}
