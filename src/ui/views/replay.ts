// 경기 화면 (E5-lite, 24번, 24.3 개정): 실제 속도 전개 하이라이트. 장면 6~8개(각 10~15초)를 1× 실제 속도로 보여 주고,
// 장면 사이에는 약 1초 동안 선수들이 다음 장면 위치로 미끄러지며 시계만 넘어간다. [여기서부터 실시간]은 그 뒤를 끊김 없이 재생한다.
// 결정 순간 정지와 선택 패널은 없다 (E4). 화면 모듈은 뷰모델만 받아 HTML 을 만들고(부록 H.2), 캔버스 갱신은 ReplayPlayer 가 한다.

import { HL, possessionSummary, selectScenes, type Scene } from '../../highlights';
import { clockLabel, eventsUntil, frameAt, interpolateFrame, scoreAt, SPEEDS, type Replay, type ReplayFrame } from '../../replay';
import { drawFrame, numberCircleRenderer, pitchSize, playerMap, TEAM_COLORS, type MarkerRenderer } from '../pitch/renderer';

export type ReplayMode = 'scene' | 'transition' | 'live' | 'ended';

export interface ReplayVM {
  teams: [string, string];
  side: 0 | 1;
  speed: number;
  paused: boolean;
  mode: ReplayMode;
  /** 지금 장면 번호 (1부터)와 장면 수 */
  scene: number;
  scenes: number;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function replayView(vm: ReplayVM): string {
  const dot = (i: 0 | 1) => `<i class="team-dot" style="background:${TEAM_COLORS[i]}"></i>`;
  const ended = vm.mode === 'ended';
  const status = ended ? '경기 종료'
    : vm.mode === 'live' ? '실시간'
    : `하이라이트 ${vm.scene}/${vm.scenes}`;
  // 배속은 장면(과 실시간) 안에서만 의미가 있다 (24.3)
  const speedOn = vm.mode === 'scene' || vm.mode === 'live';
  return `
    <div class="card replay">
      <div class="row between replay-head">
        <div class="grow">${dot(0)}<b>${esc(vm.teams[0])}</b>${vm.side === 0 ? ' <span class="small muted">(내 팀)</span>' : ''}</div>
        <div class="center"><div class="replay-score" id="rp-score">0 : 0</div><div class="small muted" id="rp-clock">0:00</div></div>
        <div class="grow" style="text-align:right">${vm.side === 1 ? '<span class="small muted">(내 팀)</span> ' : ''}<b>${esc(vm.teams[1])}</b>${dot(1)}</div>
      </div>
      <canvas id="rp-canvas" class="pitch"></canvas>
      <div class="row between small muted replay-status"><span id="rp-status">${status}</span><span id="rp-scene"></span></div>
      <div class="row wrap replay-ctl">
        <button class="mini" data-act="rp-toggle" ${ended ? 'disabled' : ''}>${vm.paused ? '▶' : '⏸'}</button>
        ${SPEEDS.map((s) => `<button class="chip ${vm.speed === s ? 'on' : ''}" data-act="rp-speed" data-v="${s}" ${speedOn ? '' : 'disabled'}>${s}×</button>`).join('')}
        <span class="grow"></span>
        ${vm.mode === 'scene' || vm.mode === 'transition' ? '<button class="mini" data-act="rp-live">여기서부터 실시간</button>' : ''}
        <button class="mini" data-act="rp-skip">${ended ? '결과 보기' : '건너뛰기 ⏭'}</button>
      </div>
    </div>
    <div class="card"><h2>이벤트</h2><div id="rp-feed" class="feed"></div></div>`;
}

interface FeedLine {
  e: number;
  minute: string;
  text: string;
  big: boolean;
  summary?: boolean;
}

export function feedHtml(lines: FeedLine[]): string {
  if (!lines.length) return '<div class="small muted">킥오프를 기다리는 중</div>';
  return lines.slice(0, 40).map((e) => `<div class="feed-item ${e.big ? 'big' : ''} ${e.summary ? 'summary' : ''}"><span class="min">${e.summary ? '⏩' : `${esc(e.minute)}'`}</span>${esc(e.text)}</div>`).join('');
}

/**
 * 재생 컨트롤러 (24.3 개정): 선수와 공은 엔진 좌표의 초속 그대로(1× = 실제 속도) 움직인다.
 * 장면이 끝나면 전환(약 1초)으로 다음 장면 시작 위치까지 보간하고 시계를 넘긴다
 */
export class ReplayPlayer {
  /** 지금 보여 주는 경기 시점 (흐른 시간 e, 초) */
  e = 0;
  speed = 1;
  paused = false;
  mode: ReplayMode = 'scene';
  idx = 0;
  readonly scenes: Scene[];
  private tr = 0;
  private trFrom: ReplayFrame | null = null;
  private trTo: ReplayFrame | null = null;
  private readonly summaries: FeedLine[] = [];
  private last = 0;
  private raf = 0;
  private shown = '';
  private readonly players;
  constructor(readonly replay: Replay, private readonly onChange: () => void, private readonly renderer: MarkerRenderer = numberCircleRenderer) {
    this.players = playerMap(replay);
    this.scenes = selectScenes(replay);
    if (this.scenes.length) {
      this.e = this.scenes[0]!.start;
      if (this.e > 1) this.summaries.push(this.summary(0, this.e));
    } else this.mode = 'live';
  }

  get ended(): boolean {
    return this.mode === 'ended';
  }

  attach(): void {
    cancelAnimationFrame(this.raf);
    this.shown = '';
    this.last = performance.now();
    this.draw();
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) this.advance(dt);
      if (!this.draw()) return;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  /** 건너뛰기: 즉시 최종 결과 (24.3) */
  skip(): void {
    this.e = this.replay.duration;
    this.mode = 'ended';
  }

  /** [여기서부터 실시간]: 지금 시점부터 끊김 없이 실제 속도로 */
  goLive(): void {
    if (this.mode === 'transition' && this.trTo) this.e = this.trTo.e;
    this.mode = 'live';
    this.paused = false;
  }

  /** 실제 시간 dt 초만큼 진행 */
  advance(dt: number): void {
    const r = this.replay;
    if (this.mode === 'scene') {
      const sc = this.scenes[this.idx]!;
      this.e = Math.min(sc.end, this.e + dt * this.speed);
      if (this.e >= sc.end) {
        const next = this.scenes[this.idx + 1];
        if (!next) {
          this.finish();
          return;
        }
        this.mode = 'transition';
        this.tr = 0;
        this.trFrom = frameAt(r, sc.end);
        this.trTo = frameAt(r, next.start);
        this.summaries.push(this.summary(sc.end, next.start));
        this.onChange();
      }
    } else if (this.mode === 'transition') {
      this.tr += dt / HL.transition;
      if (this.tr >= 1) {
        this.idx++;
        this.e = this.scenes[this.idx]!.start;
        this.mode = 'scene';
        this.onChange();
      }
    } else if (this.mode === 'live') {
      this.e = Math.min(r.duration, this.e + dt * this.speed);
      if (this.e >= r.duration) this.finish();
    }
  }

  private finish(): void {
    this.e = this.replay.duration;
    this.mode = 'ended';
    this.onChange();
  }

  private summary(from: number, to: number): FeedLine {
    return { e: to, minute: '', text: possessionSummary(this.replay, from, to), big: false, summary: true };
  }

  /** 지금 그릴 프레임 (전환 중이면 두 장면 사이 보간) */
  current(): ReplayFrame {
    if (this.mode === 'transition' && this.trFrom && this.trTo) return interpolateFrame(this.trFrom, this.trTo, this.tr);
    return frameAt(this.replay, this.e);
  }

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
    const f = this.current();
    drawFrame(ctx, w, h, f, this.players, this.renderer);
    const at = this.mode === 'transition' ? f.e : this.e;
    const score = scoreAt(this.replay, at);
    const sc = document.getElementById('rp-score');
    if (sc) sc.textContent = `${score[0]} : ${score[1]}`;
    const cl = document.getElementById('rp-clock');
    if (cl) cl.textContent = this.ended ? '경기 종료' : clockLabel(f, at > this.replay.halfE);
    const sl = document.getElementById('rp-scene');
    if (sl) sl.textContent = this.mode === 'scene' ? this.scenes[this.idx]!.label : this.mode === 'transition' ? '다음 장면으로' : '';
    const lines: FeedLine[] = [...eventsUntil(this.replay, at), ...this.summaries.filter((x) => x.e <= at + 0.01)].sort((a, b) => b.e - a.e);
    const key = `${lines.length}:${this.mode}`;
    if (key !== this.shown) {
      this.shown = key;
      const feed = document.getElementById('rp-feed');
      if (feed) feed.innerHTML = feedHtml(lines);
    }
    return true;
  }
}
