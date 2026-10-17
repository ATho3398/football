// 결정 순간 화면 (E.11, I.5·I.17 3번, E4 최소판): 직접 모드에서 내 선수 결정 순간마다 경기가 멈춘다.
// 피치에는 직전 결정 뒤부터 이 순간까지를 1× 로 보여 주고 마지막 0.5초는 슬로모션으로 멈춘 뒤, 선택지 방향 화살표를 그린다.
// 패널: 선택지 3개(안전/균형/도박, 성공 확률, 성공/실패 결과, 평점 변화, 오프사이드 위험) → 패 카드 자리(3단계) → [맡기기] [확정].
// E5 최소(부록 C.35): 모바일은 패널을 바텀시트로, [확정]·[맡기기] 뒤에는 결과 구간 재생 → 결과 띠(outcomeView).
// 카드(C.36, I.17 3·4번): 패 카드 줄. 확률 카드를 누르면 선택지 확률이 "+8 카드"로 바뀌어 보이고, 플레이 카드를 누르면 4번째 선택지가 카드 색 테두리로 생긴다.
// 다시 누르면 취소. 쓸 수 없는 카드는 회색에 이유.

import type { DecisionRecord, Moment, MomentOption, StopLevel } from '../../engine/moments';
import { SCENE_LABEL } from '../../engine/moments';
import { interpolateFrame, type ReplayFrame, type ReplayPlayer } from '../../replay';
import { Button, ChoiceButton, Crest, esc, GameCard, Icon, Pitch, ResultSplash, signed, Tabs, type GameCardData } from '../components';
import { cardById } from '../../config/cards';
import { gameCardData } from './deck';
import { attackDirOf, attackFrac, clampCenter, cropLength, drawFrame, fitCanvas, PitchCamera, PORTRAIT_MOMENT_MAX_H, readPalette, type PitchProjection } from '../pitch/renderer';
import { pitchViewButton } from './common';

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
/** 선택지 화살표 색 = 디자인 ChoiceButton 유형 색 (안전 시안 · 균형 라임 · 도박 주황 · 플레이 카드 보라) */
export const KIND_COLOR: Record<MomentOption['kind'], string> = { safe: '#5ee0ff', balanced: '#d6ff3c', gamble: '#ff9a3d', card: '#b685ff' };

const signedR = (x: number) => signed(x, 2);
const pctOf = (p: number | null) => (p === null ? null : Math.round(Math.max(0, Math.min(0.99, p)) * 100));

export function lastResultText(r: DecisionRecord): string {
  const res = r.result === 'success' ? '성공' : r.result === 'fail' ? '실패' : '결과 보통';
  return `${r.minute}' ${SCENE_LABEL[r.scene]} · ${r.label} → ${res} (평점 ${signedR(r.delta)})`;
}

/** 지금 화면에 보이는 선택지: 기본 3개 + 고른 플레이 카드가 연 4번째 */
export function shownOptions(m: Moment, card: number | null): MomentOption[] {
  const mc = card === null ? null : m.cards.find((c) => c.hand === card);
  return mc?.option ? [...m.options, mc.option] : m.options;
}

/** [확정] 버튼에 넣을 짧은 행동 이름 (5차 77 "확정 · 백패스 88%"): 선택지 이름의 마지막 낱말 */
export function actionWord(label: string): string {
  return label.trim().split(/\s+/).pop() ?? label;
}

/** 압축 스코어 줄 (5차 77, 약 80px): 엠블럼 · 팀 · 점수 / 분 칩 · 장면 · [보기] */
function scoreTop(teams: [string, string], score: [number, number], side: 0 | 1, minute: number, sceneText: string, scoreId = ''): string {
  const team = (i: 0 | 1) => `<span class="mo-team${i === side ? ' is-me' : ' is-opp'}${i === 1 ? ' is-away' : ''}">${i === 0 ? Crest({ name: teams[0], size: 20 }) : ''}<span>${esc(teams[i])}</span>${i === 1 ? Crest({ name: teams[1], size: 20 }) : ''}</span>`;
  return `<div class="mo-top">
      <div class="mo-score">${team(0)}<b class="po-num"${scoreId ? ` id="${scoreId}"` : ''}>${score[0]}<i>:</i>${score[1]}</b>${team(1)}</div>
      <div class="mo-scene"><span class="mo-min po-num">${minute}'</span><span class="mo-scene__t">${esc(sceneText)}</span>${pitchViewButton(true)}</div>
    </div>`;
}

/** 선택지 → ChoiceButton (compact). dp = 확률 카드 변화, 카드 선택지는 바탕 행동 대비 */
function choice(o: MomentOption, i: number, on: boolean, dp: number, card: { name: string; rarity: GameCardData['rarity'] } | null): string {
  const isCard = o.kind === 'card';
  const base = isCard && o.baseP !== undefined && o.p !== null ? o.baseP : o.p;
  const delta = isCard && o.baseP !== undefined && o.p !== null ? Math.round((o.p - o.baseP) * 100) : Math.round(dp * 100);
  const chance = pctOf(base);
  return ChoiceButton({
    act: 'mo-pick', data: { v: i }, compact: true, selected: on, kind: o.kind === 'card' ? 'play' : o.kind, name: o.label, chance,
    ...(chance !== null && delta ? { chanceDelta: Math.max(-chance, Math.min(99 - chance, delta)), deltaSource: '카드' } : {}),
    success: { text: o.success, rating: signedR(o.up) }, fail: { text: o.fail, rating: signedR(o.down) },
    ...(o.offside ? { offside: o.offside } : {}), ...(isCard && card ? { card: card.name, rarity: card.rarity } : {}),
  });
}

function cardLook(id: string, fallback: string): { name: string; rarity: GameCardData['rarity'] } {
  const def = cardById(id);
  return def ? { name: def.name, rarity: gameCardData(def).rarity } : { name: fallback, rarity: 'common' };
}

/** 패 칩 한 줄 (5차 77, 38px): 누르면 확률이 바로 바뀌고(확률 카드) 4번째 선택지가 생긴다(플레이 카드). 못 쓰는 카드는 흐리게 */
function handChips(vm: MomentVM): string {
  const m = vm.moment;
  const n = m.cards.length;
  const pas = m.passives.length ? ` · 패시브 ${m.passives.length}` : '';
  if (!n) return `<div class="mo-hand"><div class="mo-hand__head"><span>내 패 <b class="po-num">0</b></span><span class="muted">${m.passives.length ? `장착 패시브 · ${m.passives.map(esc).join(', ')}` : '패가 비었어요 · 15분마다 1장'}</span></div></div>`;
  const picked = vm.card === null ? null : m.cards.find((c) => c.hand === vm.card) ?? null;
  const offs = m.cards.filter((c) => !c.usable);
  const info = picked
    ? `${esc(picked.name)}${picked.option ? '를 골랐어요 · 4번째 선택지' : ` · ${esc(picked.text)}`}`
    : offs.length === n ? `지금 쓸 수 있는 카드가 없어요${pas}` : `누르면 확률이 바로 바뀌어요${pas}`;
  const chips = m.cards.map((c) => {
    const look = cardLook(c.id, c.name);
    const on = vm.card === c.hand;
    return `<button type="button" role="listitem" class="mo-chip po-rarity--${look.rarity}${on ? ' is-on' : ''}${c.usable ? '' : ' is-off'}" data-act="mo-card" data-v="${c.hand}" aria-pressed="${on}"${
      c.usable ? '' : ' aria-disabled="true"'} title="${esc(c.usable ? c.text : `못 씀 · ${c.reason ?? ''}`)}"><i class="mo-chip__dot" aria-hidden="true"></i>${esc(c.name)}</button>`;
  }).join('');
  return `<div class="mo-hand"><div class="mo-hand__head"><span>내 패 <b class="po-num">${n}</b></span><span class="muted mo-hand__info">${info}</span></div>
    <div class="mo-chips" role="list" aria-label="내 패">${chips}</div></div>`;
}

export function momentView(vm: MomentVM): string {
  const m = vm.moment;
  if (m.type === 'react') return reactView(vm);
  const sel = vm.selected;
  const shown = shownOptions(m, vm.card);
  const mc = vm.card === null ? null : m.cards.find((c) => c.hand === vm.card) ?? null;
  const look = mc ? cardLook(mc.id, mc.name) : null;
  const opts = shown.map((o, i) => choice(o, i, sel === i, i < m.options.length ? mc?.deltas?.[i] ?? 0 : 0, look)).join('');
  const picked = sel === null ? null : shown[sel] ?? null;
  const pp = picked ? pctOf(picked.p === null ? null : picked.p + (sel! < m.options.length ? mc?.deltas?.[sel!] ?? 0 : 0)) : null;
  const confirm = picked ? `확정 · ${actionWord(picked.label)}${pp === null ? '' : ` ${pp}%`}` : '선택지를 고르세요';
  const tension = m.minute >= 75 && Math.abs(m.score[0] - m.score[1]) <= 1 ? ' · 접전 막판' : '';
  const note = m.sure
    ? `<p class="mo-note">확실한 선택지(90%+)는 뺐어요 · 맡기기가 할 일${m.options.length < 3 ? ` · 남은 선택지 ${m.options.length}개` : ''}</p>` : '';
  return `
    <div class="moment mo-fold">
      ${scoreTop(vm.teams, m.score, m.side, m.minute, `${SCENE_LABEL[m.scene]} · 결정 순간 ${vm.count}${tension}`)}
      <div class="pitch-wrap mo-stage">${Pitch({ canvasId: 'mo-canvas', label: '결정 순간 정지 화면' })}</div>
      <div class="mo-panel" role="group" aria-label="결정 선택">
        <div class="mo-head"><b>어떻게 할까요?</b><span>누르면 피치에 방향이 보여요</span></div>
        ${note}
        <div class="mo-opts">${opts}</div>
        ${handChips(vm)}
        <div class="mo-actions">
          ${Button({ variant: 'secondary', size: 'lg', block: true, icon: 'auto', act: 'mo-delegate', children: '맡기기' })}
          ${Button({ size: 'lg', block: true, icon: 'check', act: 'mo-confirm', disabled: sel === null, children: confirm })}
        </div>
      </div>
    </div>
    ${moreSettings(vm)}`;
}

/** 한 화면 아래(스크롤): 직전 결정 · 정지 빈도 · 자동 전환 */
function moreSettings(vm: MomentVM): string {
  return `<div class="mo-more">
      ${vm.last ? `<div class="mo-last">직전 결정 · ${esc(lastResultText(vm.last))}</div>` : ''}
      <span class="small muted">정지 빈도 (다음 순간부터) · 중요도 ${vm.moment.stake.toFixed(2)}</span>
      ${Tabs({ items: STOP_ITEMS, value: vm.stop, act: 'mo-stop', fill: true, label: '정지 빈도' })}
      ${Button({ variant: 'ghost', size: 'sm', block: true, act: 'mo-auto', children: '자동으로 전환 (남은 경기는 엔진이 결정)' })}
    </div>`;
}

/**
 * 카드 장면 시트 (C.40 → 5차 80): 공중볼·상대 슈팅에서 바로 쓸 수 있는 반응 카드만 크게 보여 주고 [안 쓰고 계속] [카드 쓰기].
 * 안 쓰고 계속 = "카드 없이" 선택지 확정, 쓰기 = 고른 카드의 카드 선택지 확정 (지금과 같은 결정)
 */
function reactView(vm: MomentVM): string {
  const m = vm.moment;
  const usable = m.cards.filter((c) => c.usable);
  const picked = vm.card === null ? null : usable.find((c) => c.hand === vm.card) ?? null;
  const cards = usable.map((c) => {
    const def = cardById(c.id);
    const data = def ? gameCardData(def) : { name: c.name, type: 'passive' as const, rarity: 'common' as const, level: 1, effect: { pre: c.text }, condition: { text: '', met: true } };
    return GameCard({ card: data, size: 'deck', act: 'mo-card', data: { v: c.hand }, state: picked?.hand === c.hand ? 'selected' : 'normal' });
  }).join('');
  const opt = picked?.option;
  const gain = opt && opt.p !== null && opt.baseP !== undefined ? ` · 성공 ${pctOf(opt.baseP)}% → ${pctOf(opt.p)}%` : '';
  const useIdx = m.options.length;
  return `
    <div class="moment mo-fold mo-react">
      ${scoreTop(vm.teams, m.score, m.side, m.minute, `${SCENE_LABEL[m.scene]} · 카드 장면`)}
      <div class="pitch-wrap mo-stage">${Pitch({ canvasId: 'mo-canvas', label: '카드 장면 정지 화면' })}</div>
      <div class="mo-rsheet" role="dialog" aria-label="카드를 쓸까요?">
        <span class="mo-rsheet__grip" aria-hidden="true"></span>
        <span class="mo-rsheet__eyebrow po-num">${m.minute}' · ${esc(SCENE_LABEL[m.scene])}</span>
        <b class="mo-rsheet__title">카드를 쓸까요?</b>
        <p class="mo-rsheet__desc">이 장면에서 바로 쓸 수 있는 반응 카드만 보여요. 안 쓰면 패에 남아요.</p>
        <div class="mo-rcards">${cards}</div>
        ${picked ? `<div class="mo-rinfo">${Icon({ name: 'info', size: 16 })}<span><b>${esc(picked.name)}</b> · ${esc(picked.text)}${gain}</span></div>` : ''}
        <div class="mo-actions">
          ${Button({ variant: 'secondary', size: 'lg', block: true, act: 'mo-pick-confirm', data: { v: 0 }, children: '안 쓰고 계속' })}
          ${Button({ size: 'lg', block: true, icon: 'card', act: 'mo-pick-confirm', data: { v: useIdx }, disabled: !opt, children: picked ? `${picked.name} 쓰기` : '카드를 고르세요' })}
        </div>
        <p class="mo-rsheet__foot">자동 진행·자동 결정 중에는 이 시트가 뜨지 않아요</p>
      </div>
    </div>`;
}

/**
 * 한 화면 배치(C.56)의 피치 맞추기: 폰은 .mo-stage 가 남은 높이를 차지하고(그 안 .po-pitch 는 absolute), 캔버스는 그 높이에 맞춰
 * 세로 피치를 잘라 보여 준다. PC·가로는 지금처럼 화면 높이 비율
 */
function stageFit(c: HTMLCanvasElement): ReturnType<typeof fitCanvas> {
  const box = c.parentElement;
  const fill = !!box && getComputedStyle(box).position === 'absolute' && box.clientHeight > 0;
  return fitCanvas(c, PORTRAIT_MOMENT_MAX_H, fill ? { heightPx: box!.clientHeight } : {});
}

/**
 * 결정 순간 보이는 칸 (5차 77 crop): 내 선수 · 공 · 선택지 도착점이 다 들어오게 가운데를 고르고, 다 못 넣으면 내 선수를 우선
 */
export function momentCenter(frame: ReplayFrame, players: Map<string, ReplayPlayer>, side: 0 | 1, meId: string, targets: { x: number }[], len: number): number {
  if (len >= 0.999) return 0.5;
  const dir = attackDirOf(frame, players, side);
  const me = frame.players.find((p) => p.id === meId);
  const aMe = attackFrac(me?.x ?? frame.ball.x, dir);
  const pts = [aMe, attackFrac(frame.ball.x, dir), ...targets.map((t) => attackFrac(t.x, dir))];
  const margin = len * 0.12;
  const mid = (Math.min(...pts) + Math.max(...pts)) / 2;
  return clampCenter(Math.min(aMe + len / 2 - margin, Math.max(aMe - len / 2 + margin, mid)), len);
}

/** 정지 화면 애니메이션: 앞 장면을 1× 로, 마지막 0.5초는 0.5× 로 보여 주고 멈춘 뒤 화살표 */
export class MomentPitch {
  private raf = 0;
  private t0 = 0;
  /** 세로 잘라 보기 가운데 (결과 재생이 이어 받는다) */
  center = 0.5;
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
    const last = this.frames.at(-1)!;
    const tick = (now: number) => {
      const c = document.getElementById('mo-canvas') as HTMLCanvasElement | null;
      if (!c) return;
      const { ctx, w, h, portrait } = stageFit(c);
      this.center = momentCenter(last, this.players, this.side, this.moment.me, this.options.map((o) => o.to), cropLength(w, h, portrait));
      const el = (now - this.t0) / 1000;
      const done = el >= wall;
      const fast = lead - slow;
      const e = done ? endE : el < fast ? this.fromE + el : this.fromE + fast + (el - fast) / 2;
      const proj = drawFrame(ctx, w, h, this.frameAt(e), this.players, undefined, this.side, el, { center: this.center, portrait });
      if (done) {
        this.arrows(ctx, proj);
        return;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  /** 선택지 화살표: 피치와 같은 좌표 변환(세로면 돌린 좌표, C.44a) */
  private arrows(ctx: CanvasRenderingContext2D, proj: PitchProjection): void {
    const f = this.frames.at(-1)!;
    const me = f.players.find((p) => p.id === this.moment.me);
    if (!me) return;
    this.options.forEach((o, i) => {
      const on = this.selected === i;
      const faint = this.selected !== null && !on;
      const [x0, y0] = proj.toScreen(me.x, me.y);
      const [x1, y1] = proj.toScreen(o.to.x, o.to.y);
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
  /** 결과 카드 큰 글자 (선택지의 성공·실패 결과, 골이면 "골!") */
  headline: string;
  /** 이 결정의 평점 변화 (결정 기록 delta) */
  ratingDelta: number;
  /** 결과 뒤 내 평점 (결정 직전 평점 + 변화, 화면 표시만). 계산 못 하면 null */
  rating: number | null;
  /** 쓴 카드 이름 (5차 84 "카드 사용") */
  card: string | null;
  /** 결과 뒤 스코어 */
  score: [number, number];
  /** 결과 띠를 이미 보여 주는 중 */
  shown: boolean;
}

/**
 * 결정 결과 (5차 81~84): 재생 중 = 내 선택 + [결과 바로 보기], 결과 = ResultSplash(도장·결과·흐름·평점) + [계속].
 * 피치는 결정 순간과 같은 한 화면 배치(세로 잘라 보기)
 */
export function outcomeView(vm: OutcomeVM): string {
  const m = vm.moment;
  const score = vm.shown ? vm.score : m.score;
  const color = vm.kind === 'delegate' ? 'var(--ink-muted)' : KIND_COLOR[vm.kind];
  const b = vm.band;
  const scene = vm.shown ? `결과 · ${b.title}` : '결과 보는 중 · 실제 속도';
  const splash = vm.shown
    ? ResultSplash({ result: b.tone, title: vm.headline, detail: b.flow, ...(vm.rating !== null ? { rating: vm.rating } : {}), ratingDelta: vm.ratingDelta })
    : '';
  const cardNote = vm.shown && vm.card ? `<p class="oc-cardnote">${Icon({ name: 'card', size: 16 })}<span>${esc(vm.card)} 카드를 썼어요 · 패에서 빠졌어요</span></p>` : '';
  return `
    <div class="moment mo-fold mo-outcome">
      ${scoreTop(vm.teams, score, m.side, m.minute, scene, 'oc-score')}
      <div class="pitch-wrap mo-stage">${Pitch({ canvasId: 'mo-canvas', label: '결정 결과 재생' })}</div>
      <div class="mo-panel oc-panel" aria-live="polite">
        <div class="oc-choice" style="--k:${color}"><span class="oc-choice__t"><small>내 선택</small><b>${esc(vm.choice)}</b></span>${vm.card ? '<span class="oc-cardtag">카드 사용</span>' : ''}</div>
        ${splash}${cardNote}
        ${vm.shown
          ? Button({ size: 'lg', block: true, iconRight: 'chevron-right', act: 'oc-skip', children: '계속' })
          : Button({ variant: 'secondary', size: 'lg', block: true, icon: 'skip', act: 'oc-skip', children: '결과 바로 보기' })}
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
    /** 결정 순간 보이는 칸 가운데에서 시작해 공을 따라간다 */
    center = 0.5,
  ) {
    this.camera.center = center;
  }

  private readonly camera = new PitchCamera();

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
      const { ctx, w, h, portrait } = stageFit(c);
      const el = (now - this.t0) / 1000;
      const end = this.done || el >= span;
      const f = this.frameAt(end ? this.to : this.from + el);
      const center = this.camera.follow(f, this.players, this.side, cropLength(w, h, portrait), now, end && el < span);
      drawFrame(ctx, w, h, f, this.players, undefined, this.side, el, { center, portrait });
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
