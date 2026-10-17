// 경기 화면 (E5-lite, 24번, 24.3 개정, 디자인 15·48·49·18): 실제 속도 전개 하이라이트. 장면 6~8개(각 10~15초)를 1× 실제 속도로 보여 주고,
// 장면 사이에는 약 1초 동안 선수들이 다음 장면 위치로 미끄러지며 시계만 넘어간다. [여기서부터 실시간]은 그 뒤를 끊김 없이 재생한다.
// 결정 순간 정지와 선택 패널, 패, 직접/자동 토글은 없다 (E4). 설정 항목이 없어 톱니도 숨긴다.
// 화면 모듈은 뷰모델만 받아 HTML 을 만들고(부록 H.2), 캔버스와 자주 바뀌는 값은 ReplayPlayer 가 갱신한다.

import { HL, possessionSummary, selectScenes, type Scene } from '../../highlights';
import { clockLabel, frameAt, frameIndex, interpolateFrame, scoreAt, settledFrames, SPEEDS, type Replay, type ReplayFrame } from '../../replay';
import {
  Avatar, Button, esc, FeedItem, Icon, Pitch, PitchLegend, PossessionBar, ScoreBar, StatChip, type ScoreView,
} from '../components';
import { replayLiveVM, sceneName, type FeedVM, type ReplayStaticVM } from '../viewModels';
import { pitchViewButton } from './common';
import { activeRenderer, drawFrame, fitCanvas, playerMap, readPalette, type MarkerRenderer } from '../pitch/renderer';

export type ReplayMode = 'scene' | 'transition' | 'live' | 'ended';

export interface ReplayVM extends ReplayStaticVM {
  speed: number;
  paused: boolean;
  mode: ReplayMode;
  /** 지금 장면 번호 (1부터)와 장면 수 */
  scene: number;
  scenes: { minute: string; label: string }[];
  sceneLabel: string;
  /** 장면 전환 중: 넘어가는 시계와 요약 */
  transition: { from: string; to: string; summary: string } | null;
}

const SCENE_SHORT: Record<Scene['kind'], string> = { goal: '골', chance: '기회', decision: '내 결정', me: '내 장면', opponent: '상대', shot: '슈팅' };

export function sceneTiles(r: Replay, scenes: Scene[]): { minute: string; label: string }[] {
  return scenes.map((sc) => {
    if (sc.kind === 'decision') return { minute: `${sc.minute ?? ''}'`, label: SCENE_SHORT.decision };
    const ev = r.events.find((x) => x.e >= sc.key - 0.01 && (x.type === 'shot' || x.type === 'goal'));
    return { minute: ev ? `${ev.minute}'` : '', label: sc.kind === 'goal' && sc.team !== r.side ? '실점' : SCENE_SHORT[sc.kind] };
  });
}

export function replayView(vm: ReplayVM): string {
  const ended = vm.mode === 'ended';
  const view: ScoreView | undefined = ended ? undefined : vm.mode === 'live' ? 'live' : vm.mode === 'transition' ? 'transition' : 'highlight';
  const total = vm.scenes.length;
  const score = ScoreBar({
    idPrefix: 'rp', home: vm.home, away: vm.away, homeScore: 0, awayScore: 0, minute: '0',
    ...(vm.homeTactic ? { homeTactic: vm.homeTactic } : {}), ...(vm.awayTactic ? { awayTactic: vm.awayTactic } : {}),
    ...(view ? { view } : {}),
    scene: { index: vm.mode === 'transition' ? vm.scene : vm.scene, total, ...(vm.mode === 'scene' ? { label: vm.sceneLabel } : {}) },
    ...(vm.transition ? { minuteTo: vm.transition.to } : {}),
    speed: ended ? false : `${vm.speed}×`, speeds: SPEEDS.map((s) => `${s}×`), paused: vm.paused,
    onSpeed: { act: 'rp-speed' }, onPause: { act: 'rp-toggle' }, onSkip: { act: 'rp-skip' },
    onLive: { act: 'rp-live' }, onHighlight: { act: 'rp-highlight' },
  });
  const overlay = vm.transition ? `<div class="tr-clock po-num">${esc(vm.transition.from)}' ${Icon({ name: 'arrow-flat', size: 22 })} ${esc(vm.transition.to)}'</div>` : '';
  const legendLeft = vm.mode === 'transition' ? '<i class="dot faint"></i>다음 장면으로 넘어가는 중 · 약 1초'
    : vm.mode === 'live' ? `<i class="dot"></i>실시간 · 실제 속도 ${vm.speed}×`
    : ended ? '<i class="dot faint"></i>경기 종료'
    : `<i class="dot"></i>장면 ${vm.scene} · 실제 속도 ${vm.speed}×`;
  const tiles = total
    ? `<div class="panel hl-panel"><div class="kv small"><b>오늘의 하이라이트</b><span class="muted">${total}장면 · 약 ${Math.round(total * 13)}초 · 장면당 10~15초</span></div>
      <div class="scene-tiles" style="grid-template-columns:repeat(${total},minmax(0,1fr))">${vm.scenes.map((s, i) => {
        const n = i + 1;
        const cls = vm.mode === 'live' || ended ? 'done' : n < vm.scene ? 'done' : n === vm.scene ? (vm.mode === 'transition' ? 'done' : 'on') : vm.mode === 'transition' && n === vm.scene + 1 ? 'next' : '';
        return `<div class="scene-tile ${cls}"><span class="po-num">${n <= vm.scene || cls === 'done' ? esc(s.minute) : '·'}</span><span>${n <= vm.scene || cls === 'done' ? esc(s.label) : n}</span></div>`;
      }).join('')}</div></div>`
    : '';
  const trCard = vm.transition
    ? `<div class="tr-card"><span class="tr-card__icon">${Icon({ name: 'ff', size: 18 })}</span><span><small>${esc(vm.transition.from)}' ~ ${esc(vm.transition.to)}' 요약</small><b>${esc(vm.transition.summary)}</b></span></div>`
    : '';
  const me = vm.me
    ? `<div class="me-row">${Avatar({ size: 44, ring: true })}<div class="grow"><span class="me-row__name">${esc(vm.me.name)} <span class="slot-chip">${esc(vm.me.position)}</span></span><span id="rp-my" class="chips"></span></div></div>`
    : '';
  // 1024px 이상은 2단(왼쪽 피치, 오른쪽 점수·피드·기록), 모바일은 한 줄로 기존 순서 그대로 (부록 C.23, style.css)
  return `
    <div class="match">
      <div class="match-main">
        <div class="pitch-wrap">${Pitch({ canvasId: 'rp-canvas', label: '경기장', children: overlay })}${pitchViewButton()}</div>
        ${PitchLegend(`<span id="rp-legend">${legendLeft}</span>`)}
        ${tiles}
      </div>
      <div class="match-side">
        <div class="m-score">${score}</div>
        ${trCard}
        <div id="rp-feed" class="feed"></div>
        ${me}
        <div class="poss-wrap" id="rp-poss">${PossessionBar({ home: 50 })}</div>
        ${ended ? `<div class="btn-col">${Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'rp-result', children: '결과 보기' })}</div>` : ''}
      </div>
    </div>`;
}

interface Extra extends FeedVM {
  e: number;
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
  private readonly summaries: Extra[] = [];
  private last = 0;
  private raf = 0;
  private shown = '';
  private readonly players;
  private readonly settled: boolean[];
  /** 첫 경기 오버레이 등으로 화면이 재생을 붙잡고 있는 동안 true (21.4, 부록 C.23) */
  hold = false;
  constructor(readonly replay: Replay, private readonly onChange: () => void, private readonly renderer?: MarkerRenderer) {
    this.players = playerMap(replay);
    this.settled = settledFrames(replay, HL.settleTol);
    this.scenes = selectScenes(replay);
    if (this.scenes.length) {
      this.e = this.scenes[0]!.start;
      if (this.e > 1) this.summaries.push(this.summary(0, this.e));
    } else this.mode = 'live';
  }

  /** 결정 장면 다시 보기 (경기 재생이 아님) */
  get isClip(): boolean {
    return this.clipEnd !== null;
  }

  get ended(): boolean {
    return this.mode === 'ended';
  }

  /** 화면 뷰모델 (모드가 바뀔 때마다 다시 그린다) */
  vm(base: ReplayStaticVM): ReplayVM {
    const r = this.replay;
    const sc = this.scenes[this.idx];
    let transition: ReplayVM['transition'] = null;
    if (this.mode === 'transition' && this.trFrom && this.trTo) {
      const next = this.scenes[this.idx + 1]!;
      const m = (f: ReplayFrame, e: number) => clockLabel(f, e > r.halfE).split(':')[0]!.replace(/'$/, '');
      transition = { from: m(this.trFrom, sc!.end), to: m(this.trTo, next.start), summary: possessionSummary(r, sc!.end, next.start) };
    }
    return {
      ...base, speed: this.speed, paused: this.paused, mode: this.mode, scene: this.idx + 1,
      scenes: sceneTiles(r, this.scenes), sceneLabel: sc ? sceneName(r, sc).replace(/^\S+' /, '') : '', transition,
    };
  }

  attach(): void {
    cancelAnimationFrame(this.raf);
    readPalette();
    this.shown = '';
    this.last = performance.now();
    this.draw();
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused && !this.hold) this.advance(dt);
      if (!this.draw()) return;
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  /** 결정 장면 리플레이 (E5 최소, 부록 C.35): 이 구간만 실제 속도로 보고 끝 */
  private clipEnd: number | null = null;
  playClip(start: number, end: number): void {
    this.clipEnd = Math.min(this.replay.duration, end);
    this.e = Math.max(0, start);
    this.mode = 'live';
    this.paused = false;
    this.speed = 1;
  }

  /** 건너뛰기: 경기 전체를 건너뛰고 최종 결과로 (24.3, 디자인 17) */
  skip(): void {
    this.clipEnd = null;
    this.e = this.replay.duration;
    this.mode = 'ended';
  }

  /** [여기서부터 실시간]: 지금 시점부터 끊김 없이 실제 속도로 */
  goLive(): void {
    if (this.mode === 'transition' && this.trTo) this.e = this.trTo.e;
    this.mode = 'live';
    this.paused = false;
  }

  /** [하이라이트로 돌아가기] (디자인 49): 지금 시점 뒤의 다음 장면부터. 남은 장면이 없으면 실시간 그대로 */
  backToHighlight(): void {
    const next = this.scenes.findIndex((s) => s.start > this.e);
    if (next < 0) return;
    this.summaries.push(this.summary(this.e, this.scenes[next]!.start));
    this.idx = next;
    this.e = this.scenes[next]!.start;
    this.mode = 'scene';
  }

  /** 재개 대기 중 모두 자리를 잡았으면 빨리 감기 배율 (디자인 18) */
  ffFactor(): number {
    return this.settled[frameIndex(this.replay, this.e)] ? HL.deadBallFf : 1;
  }

  /** 실제 시간 dt 초만큼 진행 */
  advance(dt: number): void {
    const r = this.replay;
    if (this.mode === 'scene') {
      const sc = this.scenes[this.idx]!;
      this.e = Math.min(sc.end, this.e + dt * this.speed * this.ffFactor());
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
      const lim = this.clipEnd ?? r.duration;
      this.e = Math.min(lim, this.e + dt * this.speed * this.ffFactor());
      if (this.e >= lim) this.finish();
    }
  }

  private finish(): void {
    if (this.clipEnd === null) this.e = this.replay.duration;
    this.mode = 'ended';
    this.onChange();
  }

  private summary(from: number, to: number): Extra {
    return { e: to, text: possessionSummary(this.replay, from, to), kind: 'advantage', mine: false };
  }

  /** 지금 그릴 프레임 (전환 중이면 두 장면 사이 보간) */
  current(): ReplayFrame {
    if (this.mode === 'transition' && this.trFrom && this.trTo) return interpolateFrame(this.trFrom, this.trTo, this.tr);
    return frameAt(this.replay, this.e);
  }

  private draw(): boolean {
    const canvas = document.getElementById('rp-canvas') as HTMLCanvasElement | null;
    if (!canvas) return false;
    const { ctx, w, h } = fitCanvas(canvas);
    const f = this.current();
    drawFrame(ctx, w, h, f, this.players, this.renderer ?? activeRenderer(), this.replay.side, performance.now() / 1000);
    const at = this.mode === 'transition' ? f.e : this.e;
    const score = scoreAt(this.replay, at);
    const set = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el && el.textContent !== text) el.textContent = text;
    };
    set('rp-h', String(score[0]));
    set('rp-a', String(score[1]));
    const clock = clockLabel(f, at > this.replay.halfE);
    const minute = this.ended && this.clipEnd === null ? '90+' : clock.includes(':') ? `${Number(clock.split(':')[0]) + 1}` : clock.replace(/'$/, '');
    set('rp-clock', `${minute}'`);
    set('rp-strip-min', `${minute}'`);
    const live = replayLiveVM(this.replay, f, at, this.summaries.filter((x) => x.e <= at + 0.01));
    // 재개 대기 라벨 (21.5.2 3번): 공이 죽어 있는 동안만
    const note = document.getElementById('rp-note');
    const label = this.mode === 'transition' ? null : live.restart;
    if (note) {
      note.hidden = !label;
      set('rp-note-text', label ?? '');
    }
    if (label) set('rp-legend', `경기 중단 · ${label}${this.ffFactor() > 1 ? ` · 빨리 감기 ${HL.deadBallFf}×` : ''}`);
    const key = `${live.feed.length}:${this.mode}:${live.possession}:${label}`;
    if (key !== this.shown) {
      this.shown = key;
      const feed = document.getElementById('rp-feed');
      const lines = [...live.feed].sort((a, b) => (a.e ?? 0) - (b.e ?? 0));
      // 넓은 화면(2단)은 오른쪽 칸에 더 많이 (부록 C.23)
      const keep = window.matchMedia?.('(min-width: 1024px)').matches ? 10 : 3;
      if (feed) feed.innerHTML = lines.length ? lines.slice(-keep).map((x) => FeedItem(x)).join('') : FeedItem({ text: '킥오프를 기다리는 중', kind: 'normal' });
      const poss = document.getElementById('rp-poss');
      if (poss) poss.innerHTML = PossessionBar({ home: this.replay.side === 0 ? live.possession : 100 - live.possession });
      const my = document.getElementById('rp-my');
      if (my) my.innerHTML = `${StatChip({ icon: 'shot', label: '슈팅', value: live.my.shots, tone: 'mine' })}${StatChip({ icon: 'ball', label: '골', value: live.my.goals, tone: live.my.goals ? 'success' : 'neutral' })}`;
    }
    return true;
  }
}

