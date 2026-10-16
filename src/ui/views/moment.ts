// 결정 순간 화면 (E.11, I.5·I.17 3번, E4 최소판): 직접 모드에서 내 선수 결정 순간마다 경기가 멈춘다.
// 피치에는 직전 결정 뒤부터 이 순간까지를 1× 로 보여 주고 마지막 0.5초는 슬로모션으로 멈춘 뒤, 선택지 방향 화살표를 그린다.
// 패널: 선택지 3개(안전/균형/도박, 성공 확률, 성공/실패 결과, 평점 변화, 오프사이드 위험) → 패 카드 자리(3단계) → [맡기기] [확정].
// 다듬은 바텀시트·카드 미리보기는 E5(25단계).

import type { DecisionRecord, Moment, MomentOption, StopLevel } from '../../engine/moments';
import { SCENE_LABEL } from '../../engine/moments';
import { interpolateFrame, type ReplayFrame, type ReplayPlayer } from '../../replay';
import { Button, esc, Pitch, Tabs } from '../components';
import { drawFrame, fitCanvas, readPalette } from '../pitch/renderer';

export interface MomentVM {
  moment: Moment;
  teams: [string, string];
  selected: number | null;
  stop: StopLevel;
  /** 직전 결정 결과 */
  last: DecisionRecord | null;
  /** 이번 경기 멈춘 횟수 (지금 포함) */
  count: number;
}

const KIND_KO: Record<MomentOption['kind'], string> = { safe: '안전', balanced: '균형', gamble: '도박' };
const STOP_ITEMS: { id: StopLevel; label: string }[] = [
  { id: 'all', label: '모든 순간' }, { id: 'important', label: '중요한 순간만' }, { id: 'critical', label: '결정적 순간만' },
];
export const KIND_COLOR: Record<MomentOption['kind'], string> = { safe: '#2e9e5b', balanced: '#2f6fd6', gamble: '#e07a1f' };
const OFFSIDE_KO = { low: '낮음', mid: '중간', high: '높음' } as const;

const signed = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(x).toFixed(2)}`;
const pct = (p: number | null) => (p === null ? '판정 없음' : `${Math.round(p * 100)}%`);

export function lastResultText(r: DecisionRecord): string {
  const res = r.result === 'success' ? '성공' : r.result === 'fail' ? '실패' : '결과 보통';
  return `${r.minute}' ${SCENE_LABEL[r.scene]} · ${r.label} → ${res} (평점 ${signed(r.delta)})`;
}

function optionCard(o: MomentOption, i: number, on: boolean): string {
  const off = o.offside ? `<span class="mo-off mo-off--${o.offside}">오프사이드 위험 ${OFFSIDE_KO[o.offside]}</span>` : '';
  return `<button type="button" class="mo-opt${on ? ' is-on' : ''}" data-act="mo-pick" data-v="${i}" style="--k:${KIND_COLOR[o.kind]}">
    <span class="mo-opt__head"><span class="mo-kind">${KIND_KO[o.kind]}</span><b>${esc(o.label)}</b><span class="mo-p po-num">${pct(o.p)}</span></span>
    <span class="mo-opt__body"><span class="ok">성공 · ${esc(o.success)} <i class="po-num">${signed(o.up)}</i></span><span class="bad">실패 · ${esc(o.fail)} <i class="po-num">${signed(o.down)}</i></span>${off}</span>
  </button>`;
}

export function momentView(vm: MomentVM): string {
  const m = vm.moment;
  const [h, a] = m.score;
  const side = m.side;
  const tension = m.minute >= 75 && Math.abs(h - a) <= 1 ? ' · 접전 막판' : '';
  const sel = vm.selected;
  const last = vm.last ? `<div class="mo-last">${esc(lastResultText(vm.last))}</div>` : '';
  return `
    <div class="moment">
      <div class="mo-top">
        <div class="mo-score"><span class="${side === 0 ? 'me' : ''}">${esc(vm.teams[0])}</span><b class="po-num">${h} : ${a}</b><span class="${side === 1 ? 'me' : ''}">${esc(vm.teams[1])}</span></div>
        <div class="mo-scene"><span class="mo-min po-num">${m.minute}'</span><b>${esc(SCENE_LABEL[m.scene])}</b><span class="muted small">결정 순간 ${vm.count}${tension} · 중요도 ${m.stake.toFixed(2)}</span></div>
      </div>
      <div class="pitch-wrap">${Pitch({ canvasId: 'mo-canvas', label: '결정 순간 정지 화면' })}</div>
      ${last}
      <div class="mo-panel">
        <div class="mo-opts">${m.options.map((o, i) => optionCard(o, i, sel === i)).join('')}</div>
        <div class="mo-cards"><span class="small muted">패 카드</span><span class="mo-card-slot">카드 0~1장 자리 · 3단계에서 열림</span></div>
        <div class="btn-row">
          ${Button({ variant: 'secondary', size: 'lg', block: true, act: 'mo-delegate', children: '맡기기' })}
          ${Button({ size: 'lg', block: true, act: 'mo-confirm', disabled: sel === null, children: sel === null ? '선택지를 고르세요' : '확정' })}
        </div>
        <div class="mo-settings">
          <span class="small muted">정지 빈도 (다음 순간부터)</span>
          ${Tabs({ items: STOP_ITEMS, value: vm.stop, act: 'mo-stop', fill: true, label: '정지 빈도' })}
          ${Button({ variant: 'ghost', size: 'sm', block: true, act: 'mo-auto', children: '자동으로 전환 (남은 경기는 엔진이 결정)' })}
        </div>
      </div>
    </div>`;
}

/** 정지 화면 애니메이션: 앞 장면을 1× 로, 마지막 0.5초는 0.5× 로 보여 주고 멈춘 뒤 화살표 */
export class MomentPitch {
  private raf = 0;
  private t0 = 0;
  constructor(
    private readonly frames: ReplayFrame[],
    private readonly players: Map<string, ReplayPlayer>,
    private readonly side: 0 | 1,
    private readonly moment: Moment,
    /** 앞 장면 시작 (흐른 시간) */
    private readonly fromE: number,
    public selected: number | null,
  ) {}

  private frameAt(e: number): ReplayFrame {
    const fs = this.frames;
    let i = fs.length - 1;
    while (i > 0 && fs[i]!.e > e) i--;
    const a = fs[i]!;
    const b = fs[Math.min(fs.length - 1, i + 1)]!;
    if (b === a || b.e <= a.e) return a;
    return interpolateFrame(a, b, Math.min(1, Math.max(0, (e - a.e) / (b.e - a.e))));
  }

  attach(): void {
    cancelAnimationFrame(this.raf);
    const canvas = document.getElementById('mo-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    readPalette();
    const endE = this.frames.at(-1)!.e;
    const lead = Math.max(0, endE - this.fromE);
    const slow = Math.min(0.5, lead);
    // 벽시계 시간: 앞 장면(lead − slow)초 + 슬로모션 slow × 2 초
    const wall = lead - slow + slow * 2;
    this.t0 = this.t0 || performance.now();
    const tick = (now: number) => {
      const c = document.getElementById('mo-canvas') as HTMLCanvasElement | null;
      if (!c) return;
      const { ctx, w, h } = fitCanvas(c);
      const el = (now - this.t0) / 1000;
      const done = el >= wall;
      const fast = lead - slow;
      const e = done ? endE : el < fast ? this.fromE + el : this.fromE + fast + (el - fast) / 2;
      drawFrame(ctx, w, h, this.frameAt(e), this.players, undefined, this.side, el);
      if (done) {
        this.arrows(ctx, w, h);
        return;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private arrows(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const f = this.frames.at(-1)!;
    const me = f.players.find((p) => p.id === this.moment.me);
    if (!me) return;
    const sx = w / 105;
    const sy = h / 68;
    this.moment.options.forEach((o, i) => {
      const on = this.selected === i;
      const faint = this.selected !== null && !on;
      const x0 = me.x * sx;
      const y0 = me.y * sy;
      const x1 = o.to.x * sx;
      const y1 = o.to.y * sy;
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len < 4) {
        ctx.beginPath();
        ctx.arc(x0, y0, 14, 0, Math.PI * 2);
        ctx.strokeStyle = KIND_COLOR[o.kind];
        ctx.globalAlpha = faint ? 0.25 : 0.9;
        ctx.lineWidth = on ? 3.5 : 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      }
      const ux = (x1 - x0) / len;
      const uy = (y1 - y0) / len;
      ctx.globalAlpha = faint ? 0.25 : 0.95;
      ctx.strokeStyle = KIND_COLOR[o.kind];
      ctx.fillStyle = KIND_COLOR[o.kind];
      ctx.lineWidth = on ? 4 : 2.5;
      ctx.setLineDash(o.action === 'dribble' || o.action === 'carry' ? [6, 4] : []);
      ctx.beginPath();
      ctx.moveTo(x0 + ux * 10, y0 + uy * 10);
      ctx.lineTo(x1 - ux * 6, y1 - uy * 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - ux * 11 - uy * 6, y1 - uy * 11 + ux * 6);
      ctx.lineTo(x1 - ux * 11 + uy * 6, y1 - uy * 11 - ux * 6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
}
