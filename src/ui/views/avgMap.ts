// 경기 후 평균 위치 지도 (24.3 개정): 우리·상대 진형 한 장. 홈 팀이 오른쪽으로 공격하는 방향으로 맞춘다.
// 재생 데이터에서 계산하므로 방금 치른 경기에서만 보인다 (세이브에 담지 않는다). 자리는 matchResult 화면의 Pitch(avg-canvas)

import { averagePositions } from '../../highlights';
import type { Replay } from '../../replay';
import { drawAveragePositions, fitCanvas, playerMap, readPalette } from '../pitch/renderer';

export function drawAvgMap(r: Replay): void {
  const canvas = document.getElementById('avg-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  readPalette();
  const { ctx, w, h, portrait } = fitCanvas(canvas);
  // 세로 피치면 공격 방향 ↑ (디자인 117, C.60)
  const dir = document.getElementById('avg-dir');
  if (dir) dir.textContent = `우리 공격 방향 ${portrait ? '↑' : '→'}`;
  drawAveragePositions(ctx, w, h, averagePositions(r), playerMap(r), undefined, r.side);
}
