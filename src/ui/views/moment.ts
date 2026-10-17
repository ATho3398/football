// 결정 순간 화면 (E.11, I.5·I.17 3번, E4 최소판): 직접 모드에서 내 선수 결정 순간마다 경기가 멈춘다.
// 피치에는 직전 결정 뒤부터 이 순간까지를 1× 로 보여 주고 마지막 0.5초는 슬로모션으로 멈춘 뒤, 선택지 방향 화살표를 그린다.
// 패널: 선택지 3개(안전/균형/도박, 성공 확률, 성공/실패 결과, 평점 변화, 오프사이드 위험) → 패 카드 자리(3단계) → [맡기기] [확정].
// E5 최소(부록 C.35): 모바일은 패널을 바텀시트로, [확정]·[맡기기] 뒤에는 결과 구간 재생 → 결과 띠(outcomeView).
// 카드(C.36, I.17 3·4번): 패 카드 줄. 확률 카드를 누르면 선택지 확률이 "+8 카드"로 바뀌어 보이고, 플레이 카드를 누르면 4번째 선택지가 카드 색 테두리로 생긴다.
// 다시 누르면 취소. 쓸 수 없는 카드는 회색에 이유.

import type { DecisionRecord, Moment, MomentOption, StopLevel } from '../../engine/moments';
import { SCENE_LABEL } from '../../engine/moments';
import { interpolateFrame, type ReplayFrame, type ReplayPlayer } from '../../replay';
import { Button, esc, GameCard, Pitch, Tabs } from '../components';
import { cardById } from '../../config/cards';
import { gameCardData } from './deck';
import { drawFrame, fitCanvas, readPalette } from '../pitch/renderer';

export interface MomentVM {
  moment: Moment;
  teams: [string, string];
  /** 고른 선택지 (options 인덱스, 플레이 카드 선택지는 options.length) */
  selected: number | null;
  /** 고른 패 카드 (hand 인덱스) */
  card: number | null;
  stop: StopLevel;
  /** 직전 결정 결과 */
  last: DecisionRecord | null;
  /** 이번 경기 멈춘 횟수 (지금 포함) */
  count: number;
}

const KIND_KO: Record<MomentOption['kind'], string> = { safe: '안전', balanced: '균형', gamble: '도박', card: '카드' };
const STOP_ITEMS: { id: StopLevel; label: string }[] = [
  { id: 'all', label: '모든 순간' }, { id: 'important', label: '중요한 순간만' }, { id: 'critical', label: '결정적 순간만' },
];
export const KIND_COLOR: Record<MomentOption['kind'], string> = { safe: '#2e9e5b', balanced: '#2f6fd6', gamble: '#e07a1f', card: '#8a4fd8' };
const OFFSIDE_KO = { low: '낮음', mid: '중간', high: '높음' } as const;

const signed = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(x).toFixed(2)}`;
const pct = (p: number | null) => (p === null ? '판정 없음' : `${Math.round(p * 100)}%`);

export function lastResultText(r: DecisionRecord): string {
  const res = r.result === 'success' ? '성공' : r.result === 'fail' ? '실패' : '결과 보통';
  return `${r.minute}' ${SCENE_LABEL[r.scene]} · ${r.label} → ${res} (평점 ${signed(r.delta)})`;
}

/** 지금 화면에 보이는 선택지: 기본 3개 + 고른 플레이 카드가 연 4번째 */
export function shownOptions(m: Moment, card: number | null): MomentOption[] {
  const mc = card === null ? null : m.cards.find((c) => c.hand === card);
  return mc?.option ? [...m.options, mc.option] : m.options;
}

function optionCard(o: MomentOption, i: number, on: boolean, dp = 0, cardName = ''): string {
  const off = o.offside ? `<span class="mo-off mo-off--${o.offside}">오프사이드 위험 ${OFFSIDE_KO[o.offside]}</span>` : '';
  const p = o.p === null ? null : Math.max(0, Math.min(0.99, o.p + dp));
  // 원인별 변화 (I.17 4번): 확률 카드는 dp, 카드 선택지는 바탕 행동 대비
  const show = o.kind === 'card' && o.baseP !== undefined && o.p !== null ? Math.round((o.p - o.baseP) * 100) / 100 : dp;
  const chg = show && o.p !== null ? `<span class="mo-dp ${show > 0 ? 'up' : 'down'} po-num">${show > 0 ? '+' : '−'}${Math.round(Math.abs(show) * 100)} 카드</span>` : '';
  const tag = o.kind === 'card' && cardName && cardName !== o.label ? `<span class="mo-kind">🃏 ${esc(cardName)}</span>` : `<span class="mo-kind">${o.kind === 'card' ? '🃏 카드' : KIND_KO[o.kind]}</span>`;
  return `<button type="button" class="mo-opt${on ? ' is-on' : ''}${o.kind === 'card' ? ' mo-opt--card' : ''}" data-act="mo-pick" data-v="${i}" style="--k:${KIND_COLOR[o.kind]}">
    <span class="mo-opt__head">${tag}<b>${esc(o.label)}</b>${chg}<span class="mo-p po-num">${pct(p)}</span></span>
    <span class="mo-opt__body"><span class="ok">성공 · ${esc(o.success)} <i class="po-num">${signed(o.up)}</i></span><span class="bad">실패 · ${esc(o.fail)} <i class="po-num">${signed(o.down)}</i></span>${off}</span>
  </button>`;
}

/** 패 카드 (C.39): 디자인 GameCard hand 크기를 부채꼴로. 고른 카드는 위로, 못 쓰는 카드는 회색 + 이유 */
function handRow(vm: MomentVM): string {
  const m = vm.moment;
  if (!m.cards.length) return `<div class="mo-cards"><span class="small muted">패 카드</span><span class="mo-card-slot">${m.passives.length ? '' : '패가 비었어요 · 15분마다 1장'}</span></div>`;
  const pas = m.passives.length ? `<span class="small muted">장착 패시브 · ${m.passives.map(esc).join(', ')}</span>` : '';
  const n = m.cards.length;
  const mid = (n - 1) / 2;
  const slots = m.cards.map((c, i) => {
    const off = i - mid;
    const sel = vm.card === c.hand;
    const def = cardById(c.id);
    const tf = `translateY(${sel ? -16 : off * off * 1.6}px) rotate(${sel ? 0 : off * 3}deg)`;
    const card = def ? gameCardData(def) : { name: c.name, type: 'passive' as const, rarity: 'common' as const, level: 1, effect: { pre: c.text }, condition: { text: '', met: true } };
    return `<div role="listitem" class="po-hand__slot${sel ? ' is-sel' : ''}" style="transform:${tf};z-index:${sel ? 20 : 10 - Math.abs(Math.round(off))}" title="${esc(c.usable ? c.text : c.reason ?? '')}">${
      GameCard({ card, size: 'hand', act: 'mo-card', data: { v: c.hand }, state: sel ? 'selected' : c.usable ? 'normal' : 'disabled', ...(c.usable ? {} : { reason: '못 씀' }) })}</div>`;
  }).join('');
  const picked = vm.card === null ? null : m.cards.find((c) => c.hand === vm.card) ?? null;
  const offs = m.cards.filter((c) => !c.usable);
  const info = picked
    ? `<p class="small mo-hand__info"><b>🃏 ${esc(picked.name)}</b> · ${esc(picked.text)} <span class="muted">(다시 누르면 취소)</span></p>`
    : `<p class="small muted mo-hand__info">카드를 누르면 써요 · ${ROLE_HINT}${offs.length ? ` · 못 씀: ${offs.map((c) => `${esc(c.name)}(${esc(c.reason ?? '')})`).join(', ')}` : ''}</p>`;
  return `<div class="mo-hand"><div class="kv"><span class="small muted">패 ${n}장 · 한 번에 1장</span>${pas}</div>
    <div class="po-hand" role="list" aria-label="내 패">${slots}</div>${info}</div>`;
}

const ROLE_HINT = '확률 카드는 선택지 확률이 바뀌고, 플레이 카드는 4번째 선택지가 생겨요';

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
      <div class="mo-panel mo-sheet" role="dialog" aria-label="결정 선택">
        <div class="mo-sheet__head"><b>어떻게 할까요?</b><span class="small muted">선택지를 누르면 피치에 방향이 보여요</span></div>
        <div class="mo-opts">${optionsHtml(vm)}</div>
        ${handRow(vm)}
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

function optionsHtml(vm: MomentVM): string {
  const m = vm.moment;
  const mc = vm.card === null ? null : m.cards.find((c) => c.hand === vm.card) ?? null;
  return shownOptions(m, vm.card).map((o, i) => optionCard(o, i, vm.selected === i, i < m.options.length ? mc?.deltas?.[i] ?? 0 : 0, mc?.name ?? '')).join('');
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
    /** 화살표로 그릴 선택지 (플레이 카드 선택지 포함, C.36) */
    public options: MomentOption[] = moment.options,
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
    this.options.forEach((o, i) => {
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

// ── 결정 결과 보여 주기 (E5 최소, 부록 C.35) ──

export interface OutcomeVM {
  moment: Moment;
  teams: [string, string];
  /** "균형 · 드리블 돌파 (52%)" 또는 "맡기기 (엔진 판단)" */
  choice: string;
  kind: MomentOption['kind'] | 'delegate';
  band: { tone: 'success' | 'fail' | 'neutral' | 'goal' | 'conceded'; title: string; flow: string; delta: string };
  /** 결과 뒤 스코어 */
  score: [number, number];
  /** 결과 띠를 이미 보여 주는 중 */
  shown: boolean;
}

const BAND_ICON = { success: '✓', fail: '✕', neutral: '•', goal: '⚽', conceded: '!' } as const;

export function outcomeView(vm: OutcomeVM): string {
  const m = vm.moment;
  const [h, a] = vm.shown ? vm.score : m.score;
  const color = vm.kind === 'delegate' ? 'var(--ink-muted)' : KIND_COLOR[vm.kind];
  const b = vm.band;
  return `
    <div class="moment mo-outcome">
      <div class="mo-top">
        <div class="mo-score"><span class="${m.side === 0 ? 'me' : ''}">${esc(vm.teams[0])}</span><b class="po-num" id="oc-score">${h} : ${a}</b><span class="${m.side === 1 ? 'me' : ''}">${esc(vm.teams[1])}</span></div>
        <div class="mo-scene"><span class="mo-min po-num">${m.minute}'</span><b>${esc(SCENE_LABEL[m.scene])}</b><span class="muted small">결과 보는 중 · 실제 속도</span></div>
      </div>
      <div class="pitch-wrap oc-wrap">${Pitch({ canvasId: 'mo-canvas', label: '결정 결과 재생' })}
        <div class="oc-band oc-band--${b.tone}${vm.shown ? ' is-shown' : ''}" id="oc-band" role="status" aria-live="polite">
          <span class="oc-icon">${BAND_ICON[b.tone]}</span>
          <span class="oc-text"><b>${esc(b.title)}</b><span>${esc(b.flow)}</span></span>
          <span class="oc-delta po-num">${esc(b.delta)}</span>
        </div>
      </div>
      <div class="mo-panel oc-panel">
        <div class="oc-choice" style="--k:${color}"><span class="small muted">내 선택</span><b>${esc(vm.choice)}</b></div>
        ${Button({ variant: 'secondary', size: 'lg', block: true, act: 'oc-skip', children: vm.shown ? '다음 장면으로' : '결과 바로 보기' })}
      </div>
    </div>`;
}

/** 결과 구간을 1× 로 재생하고 끝나면 onDone */
export class OutcomePitch {
  private raf = 0;
  private t0 = 0;
  done = false;
  constructor(
    private readonly frames: ReplayFrame[],
    private readonly players: Map<string, ReplayPlayer>,
    private readonly side: 0 | 1,
    private readonly from: number,
    private readonly to: number,
    private readonly onDone: () => void,
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
    if (!document.getElementById('mo-canvas')) return;
    readPalette();
    this.t0 = this.t0 || performance.now();
    const span = Math.max(0, this.to - this.from);
    const tick = (now: number) => {
      const c = document.getElementById('mo-canvas') as HTMLCanvasElement | null;
      if (!c) return;
      const { ctx, w, h } = fitCanvas(c);
      const el = (now - this.t0) / 1000;
      const end = this.done || el >= span;
      drawFrame(ctx, w, h, this.frameAt(end ? this.to : this.from + el), this.players, undefined, this.side, el);
      if (end) {
        if (!this.done) {
          this.done = true;
          this.onDone();
        }
        return;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** 결과 바로 보기 */
  jump(): void {
    if (this.done) return;
    this.done = true;
    this.attach();
    this.onDone();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
