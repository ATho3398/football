// 경기 화면 (E5-lite, 24번, 21.5 일부): 엔진 위치 프레임을 재생한다. 결정 순간 정지와 선택 패널은 없다 (E4).
// 화면 모듈은 뷰모델만 받아 HTML 을 만들고(부록 H.2), 캔버스 갱신은 ReplayPlayer 가 한다.

import { clockLabel, eventsUntil, frameAt, GAME_SECONDS_PER_REAL_SECOND, scoreAt, SPEEDS, type Replay, type ReplayEvent } from '../../replay';
import { drawFrame, numberCircleRenderer, pitchSize, playerMap, TEAM_COLORS, type MarkerRenderer } from '../pitch/renderer';

export interface ReplayVM {
  teams: [string, string];
  side: 0 | 1;
  speed: number;
  paused: boolean;
  ended: boolean;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function replayView(vm: ReplayVM): string {
  const dot = (i: 0 | 1) => `<i class="team-dot" style="background:${TEAM_COLORS[i]}"></i>`;
  return `
    <div class="card replay">
      <div class="row between replay-head">
        <div class="grow">${dot(0)}<b>${esc(vm.teams[0])}</b>${vm.side === 0 ? ' <span class="small muted">(내 팀)</span>' : ''}</div>
        <div class="center"><div class="replay-score" id="rp-score">0 : 0</div><div class="small muted" id="rp-clock">0:00</div></div>
        <div class="grow" style="text-align:right">${vm.side === 1 ? '<span class="small muted">(내 팀)</span> ' : ''}<b>${esc(vm.teams[1])}</b>${dot(1)}</div>
      </div>
      <canvas id="rp-canvas" class="pitch"></canvas>
      <div class="row wrap replay-ctl">
        <button class="mini" data-act="rp-toggle">${vm.paused || vm.ended ? '▶' : '⏸'}</button>
        ${SPEEDS.map((s) => `<button class="chip ${vm.speed === s ? 'on' : ''}" data-act="rp-speed" data-v="${s}">${s}×</button>`).join('')}
        <span class="grow"></span>
        <button class="mini" data-act="rp-skip">${vm.ended ? '결과 보기' : '건너뛰기 ⏭'}</button>
      </div>
    </div>
    <div class="card"><h2>이벤트</h2><div id="rp-feed" class="feed"></div></div>`;
}

export function feedHtml(events: ReplayEvent[]): string {
  if (!events.length) return '<div class="small muted">킥오프를 기다리는 중</div>';
  return events.slice(0, 40).map((e) => `<div class="feed-item ${e.big ? 'big' : ''}"><span class="min">${esc(e.minute)}'</span>${esc(e.text)}</div>`).join('');
}

/**
 * 재생 컨트롤러: requestAnimationFrame 으로 경기 시간을 진행해 캔버스, 시계, 스코어, 피드를 갱신한다.
 * 1배속 = 게임 1분이 실제 1초 (24.3). 배속은 재생 속도만 바꾼다 (결과 무영향)
 */
export class ReplayPlayer {
  e = 0;
  speed = 1;
  paused = false;
  private last = 0;
  private raf = 0;
  private shownEvents = -1;
  private readonly players;
  constructor(readonly replay: Replay, private readonly onEnd: () => void, private readonly renderer: MarkerRenderer = numberCircleRenderer) {
    this.players = playerMap(replay);
  }

  get ended(): boolean {
    return this.e >= this.replay.duration;
  }

  /** 화면이 다시 그려진 뒤 캔버스를 붙이고 재생을 이어간다 */
  attach(): void {
    cancelAnimationFrame(this.raf);
    this.shownEvents = -1;
    this.last = performance.now();
    this.draw();
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused && !this.ended) {
        this.e = Math.min(this.replay.duration, this.e + dt * this.speed * GAME_SECONDS_PER_REAL_SECOND);
        if (this.ended) this.onEnd();
      }
      if (!this.draw()) return;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  skip(): void {
    this.e = this.replay.duration;
  }

  /** 지금 시점 그리기. 캔버스가 화면에서 사라졌으면 false */
  private draw(): boolean {
    const canvas = document.getElementById('rp-canvas') as HTMLCanvasElement | null;
    if (!canvas) return false;
    const dpr = window.devicePixelRatio || 1;
    const [w, h] = pitchSize(canvas.clientWidth || 340);
    if (canvas.width !== Math.round(w * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const f = frameAt(this.replay, this.e);
    drawFrame(ctx, w, h, f, this.players, this.renderer);
    const score = scoreAt(this.replay, this.e);
    const sc = document.getElementById('rp-score');
    if (sc) sc.textContent = `${score[0]} : ${score[1]}`;
    const cl = document.getElementById('rp-clock');
    if (cl) cl.textContent = this.ended ? '경기 종료' : clockLabel(f, this.e > this.replay.halfE);
    const evs = eventsUntil(this.replay, this.e);
    if (evs.length !== this.shownEvents) {
      this.shownEvents = evs.length;
      const feed = document.getElementById('rp-feed');
      if (feed) feed.innerHTML = feedHtml(evs);
    }
    return true;
  }
}
