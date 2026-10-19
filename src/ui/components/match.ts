// 경기 컴포넌트 (bundle.js 옮김, H.6 2번): FeedItem, ScoreBar, PossessionBar, TacticChip, Pitch.
// Pitch 는 디자인의 SVG 대신 기존 캔버스 MarkerRenderer(24.4) 위에 디자인 스타일만 입힌다 (H.6 2번)

import { Crest, Icon, RatingBadge, type IconName } from './basic';
import { actAttrs, cx, esc, type Action } from './html';
import { FitBadge } from './layout';

// ── FeedItem ──

export type FeedKind =
  | 'normal' | 'goal' | 'concede' | 'danger' | 'chance' | 'shot' | 'save' | 'corner' | 'freekick' | 'penalty' | 'foul'
  | 'offside' | 'advantage' | 'yellow' | 'red' | 'sub' | 'injury' | 'half' | 'throwin' | 'goalkick' | 'tactic';

const FEED: Record<FeedKind, IconName> = {
  normal: 'dot', goal: 'ball', concede: 'ball', danger: 'danger', chance: 'chance', shot: 'shot', save: 'save', corner: 'corner',
  freekick: 'freekick', penalty: 'penalty', foul: 'foul', offside: 'offside', advantage: 'advantage', yellow: 'card', red: 'card',
  sub: 'sub', injury: 'injury', half: 'clock', throwin: 'throwin', goalkick: 'goalkick', tactic: 'tactic',
};

export interface FeedItemProps { minute?: string | number; text: string; kind?: FeedKind; faint?: boolean; mine?: boolean; score?: string; /** 글 앞 작은 얼굴 등 (HTML, 부록 C.43) */ lead?: string }

export function FeedItem(p: FeedItemProps): string {
  const kind = p.kind ?? 'normal';
  const faint = p.faint || kind === 'throwin' || kind === 'goalkick';
  return `<div class="${cx('po-feed', `po-feed--${kind}`, p.mine && 'is-mine', faint && 'is-faint')}"><span class="po-feed__min po-num">${p.minute != null ? `${esc(p.minute)}'` : ''}</span><span class="po-feed__icon">${
    Icon({ name: FEED[kind], size: kind === 'goal' ? 20 : 16 })}</span><span class="po-feed__text">${p.lead ?? ''}${esc(p.text)}${
    p.score ? `<b class="po-feed__score po-num">${esc(p.score)}</b>` : ''}</span>${p.mine ? '<span class="po-feed__tag">나</span>' : ''}</div>`;
}

// ── Tactic chips (ScoreBar 가 쓰는 하위 컴포넌트) ──

export type TacticStyle = 'balanced' | 'tikitaka' | 'gegen' | 'counter' | 'direct' | 'block';
const TSTYLES: Record<TacticStyle, string> = { balanced: '균형', tikitaka: '티키타카', gegen: '게겐프레싱', counter: '역습', direct: '직선', block: '수비 블록' };
const TSTYLE_ICON: Record<TacticStyle, IconName> = { balanced: 't-balanced', tikitaka: 't-tikitaka', gegen: 't-gegen', counter: 't-counter', direct: 't-direct', block: 't-block' };

export function TacticEmblem(p: { tactic: TacticStyle; size?: number; away?: boolean; on?: boolean }): string {
  const size = p.size ?? 40;
  return `<span class="${cx('po-temblem', p.away && 'is-away', p.on && 'is-on')}" style="width:${size}px;height:${size}px" role="img" aria-label="${TSTYLES[p.tactic]}">${
    Icon({ name: TSTYLE_ICON[p.tactic], size: Math.round(size * 0.55), strokeWidth: 2.2 })}</span>`;
}

export interface TacticChipProps extends Action {
  tactic: TacticStyle; size?: 'xs' | 'sm' | 'md'; team?: string; formation?: string; away?: boolean;
  /** 전술 화면 성향 고르기 (I.16 ①): 고른 칩, 적합도 배지. act 가 있으면 버튼 */
  selected?: boolean; fit?: 'good' | 'ok' | 'bad';
}

export function TacticChip(p: TacticChipProps): string {
  const size = p.size ?? 'md';
  const em = size === 'xs' ? 16 : size === 'sm' ? 22 : 30;
  const el = p.act ? 'button' : 'span';
  return `<${el}${el === 'button' ? ` type="button" aria-pressed="${!!p.selected}"` : ''} class="${cx('po-tchip', `po-tchip--${size}`, p.selected && 'is-on', p.away && 'is-away')}"${actAttrs(p)}>${
    TacticEmblem({ tactic: p.tactic, size: em, away: p.away, on: p.selected })}<span class="po-tchip__text">${
    p.team ? `<b class="po-tchip__team">${esc(p.team)}</b>` : ''}<span class="po-tchip__name">${TSTYLES[p.tactic]}</span>${
    p.formation ? `<span class="po-tchip__form po-num">${esc(p.formation)}</span>` : ''}</span>${p.fit ? FitBadge({ fit: p.fit }) : ''}</${el}>`;
}

// ── FormationPitch (전술 화면 미니 피치, I.16 ②) ──

export interface FormationSlotProps extends Action {
  pos: string;
  /** 0~100 왼쪽 → 오른쪽 */
  x: number;
  /** 0~100 우리 골문(아래) → 상대 골문(위) */
  y: number;
  name?: string; role?: string; me?: boolean; selected?: boolean; dim?: boolean; warn?: boolean;
  ovr?: number; ovrDown?: boolean;
  /** 끌어다 놓기 편집 (E.5.1): 슬롯 인덱스. 편집 중인 미니 피치에서만 */
  drag?: number;
}

export interface FormationPitchProps { slots: FormationSlotProps[]; compact?: boolean; height?: number; label?: string; edit?: boolean }

export function FormationPitch(p: FormationPitchProps): string {
  const slots = p.slots.map((s) => {
    const el = s.act || s.drag != null ? 'button' : 'div';
    const drag = s.drag != null ? ` data-drag="${s.drag}"` : '';
    return `<${el}${el === 'button' ? ' type="button"' : ''} class="${cx('po-fslot', s.me && 'is-me', s.selected && 'is-sel', s.dim && 'is-dim', s.warn && 'is-warn')}" style="left:${s.x}%;top:${100 - s.y}%"${actAttrs(s)}${drag}>`
      + `<span class="po-fslot__dot"><b>${esc(s.pos)}</b>${s.me ? '<span class="po-fslot__me">나</span>' : ''}</span>`
      + `${!p.compact && s.name ? `<span class="po-fslot__name">${esc(s.name)}</span>` : ''}${!p.compact && s.role ? `<span class="po-fslot__role">${esc(s.role)}</span>` : ''}`
      + `${s.ovr != null ? `<span class="${cx('po-fslot__ovr po-num', s.ovrDown && 'is-down')}">${s.ovr}</span>` : ''}</${el}>`;
  }).join('');
  return `<div class="${cx('po-fpitch', p.compact && 'po-fpitch--compact', p.edit && 'is-edit')}"${p.height ? ` style="height:${p.height}px"` : ''} role="group" aria-label="${esc(p.label ?? '포메이션')}">`
    + '<svg class="po-fpitch__lines" viewBox="0 0 68 100" preserveAspectRatio="none" aria-hidden="true"><rect x="1" y="1" width="66" height="98" rx="2"/>'
    + '<path d="M1 50H67 M20 1v14h28V1 M28 1v5h12V1 M20 99V85h28v14 M28 99v-5h12v5"/><ellipse cx="34" cy="50" rx="8" ry="6"/></svg>'
    + `${slots}</div>`;
}

// ── ScoreBar / SceneStrip (디자인 2차 수정본: 상단 띠) ──

export type ScoreView = 'highlight' | 'live' | 'halftime' | 'transition';

export interface SceneStripProps {
  /** 띠 종류. 하이라이트·실시간·하프타임·장면 전환 */
  view?: ScoreView;
  scene?: { index: number; total?: number; minute?: string | number; label?: string };
  /** 재개 대기 라벨 (21.5.2 3번, "스로인 준비") */
  sceneNote?: string;
  sceneNoteIcon?: IconName;
  minute: string | number;
  /** onLive / onHighlight / onSettings 대신 동작. onSettings 가 없으면 톱니를 숨긴다 (설정 항목이 없을 때) */
  onLive?: Action; onHighlight?: Action; onSettings?: Action;
  settingsOn?: boolean;
  idPrefix?: string;
}

function sceneStrip(p: SceneStripProps, solo: boolean): string {
  const id = (s: string) => (p.idPrefix ? ` id="${p.idPrefix}-${s}"` : '');
  const view = p.view;
  const sc = p.scene ?? { index: 0 };
  const total = sc.total ?? 7;
  const idx = sc.index;
  const lead = view === 'live' ? '<i class="po-live"></i>' : view === 'halftime' ? Icon({ name: 'clock', size: 13 }) : view ? Icon({ name: 'video', size: 13 }) : '';
  const text = view === 'live' ? `<span><b>실시간</b> · <span class="po-num"${id('strip-min')}>${esc(sc.minute ?? p.minute)}'</span></span>`
    : view === 'halftime' ? '<b>하프타임</b>'
    : view === 'transition' ? `<span><b>장면 전환</b> · 다음 <span class="po-num">${idx + 1}/${total}</span></span>`
    : view ? `<span><b>하이라이트</b> · 장면 <span class="po-num">${idx}/${total}</span>${sc.minute != null ? ` · <span class="po-num">${esc(sc.minute)}'</span>` : ''}${sc.label ? ` ${esc(sc.label)}` : ''}</span>`
    : '';
  const acts = `${view === 'highlight' || view === 'transition'
    ? `<button type="button" class="po-strip__btn"${actAttrs(p.onLive ?? {})}${view === 'transition' ? ' disabled' : ''}>${Icon({ name: 'play', size: 11, filled: true })}여기서부터 실시간</button>` : ''}${
    view === 'live' ? `<button type="button" class="po-strip__btn"${actAttrs(p.onHighlight ?? {})}>${Icon({ name: 'video', size: 11 })}하이라이트로 돌아가기</button>` : ''}${
    p.onSettings ? `<button type="button" class="${cx('po-strip__gear', p.settingsOn && 'is-on')}" aria-label="경기 설정"${actAttrs(p.onSettings)}>${Icon({ name: 'settings', size: 17 })}</button>` : ''}`;
  const ticks = view === 'highlight' || view === 'transition'
    ? `<div class="po-strip__ticks" aria-hidden="true">${Array.from({ length: total }, (_, i) =>
      `<i class="${cx(i + 1 < idx && 'is-done', i + 1 === idx && (view === 'transition' ? 'is-done' : 'is-on'), view === 'transition' && i === idx && 'is-next')}"></i>`).join('')}</div>`
    : '';
  return `<div class="${cx('po-strip', view && `po-strip--${view}`, solo && 'po-strip--solo')}"><div class="po-strip__row"><span class="po-strip__lead">${lead}${text}</span><span class="po-strip__acts">${acts}</span></div>${ticks}<span class="po-strip__note"${id('note')}${
    p.sceneNote ? '' : ' hidden'}>${Icon({ name: p.sceneNoteIcon ?? 'throwin', size: 12 })}<span${id('note-text')}>${esc(p.sceneNote ?? '')}</span></span></div>`;
}

export function SceneStrip(p: SceneStripProps): string {
  return sceneStrip(p, true);
}

export interface ScoreBarProps extends SceneStripProps {
  home: string; away: string; homeScore: number | string; awayScore: number | string;
  homeTactic?: { tactic: TacticStyle; formation?: string };
  awayTactic?: { tactic: TacticStyle; formation?: string };
  homeRed?: number; awayRed?: number;
  /** 배속. false 면 속도 묶음을 숨긴다 */
  speed?: string | false;
  speeds?: string[];
  paused?: boolean;
  status?: string;
  ff?: boolean;
  minuteTo?: string | number;
  /** onSpeed/onPause/onSkip 대신 동작. onSpeed 는 data-v=배속 */
  onSpeed?: Action; onPause?: Action; onSkip?: Action;
}

function redTag(red: number | undefined): string {
  if (!red) return '';
  const n = 11 - red;
  return `<span class="po-score__red" aria-label="레드카드 ${red}장, ${n}명"><i class="po-score__redcard"></i><b class="po-num">${n}명</b></span>`;
}

export function ScoreBar(p: ScoreBarProps): string {
  const id = (s: string) => (p.idPrefix ? ` id="${p.idPrefix}-${s}"` : '');
  const speeds = p.speeds ?? ['1×', '2×', '4×'];
  const view = p.view;
  const strip = view || p.onSettings ? sceneStrip(p, false) : '';
  const lock = view === 'transition' || view === 'halftime';
  const lead = p.ff ? Icon({ name: 'ff', size: 12, filled: true }) : p.paused ? Icon({ name: 'pause', size: 12, strokeWidth: 3 }) : '<i class="po-live"></i>';
  const speed = p.speed !== false
    ? `<span class="${cx('po-speed', lock && 'is-disabled')}" role="group" aria-label="경기 속도"${lock ? ' aria-disabled="true"' : ''}><button type="button" class="po-speed__btn" aria-label="${p.paused ? '재생' : '일시정지'}"${actAttrs(p.onPause ?? {})}>${
      Icon({ name: p.paused ? 'play' : 'pause', size: 14, strokeWidth: 2.5 })}</button>${speeds.map((s) =>
      `<button type="button" class="${cx('po-speed__btn', p.speed === s && 'is-on')}" aria-pressed="${p.speed === s}"${actAttrs({ ...p.onSpeed, data: { ...p.onSpeed?.data, v: s } })}>${s}</button>`).join('')}<button type="button" class="po-speed__btn" aria-label="건너뛰기"${actAttrs(p.onSkip ?? {})}>${
      Icon({ name: 'skip', size: 14 })}</button></span>`
    : '';
  const tactics = p.homeTactic || p.awayTactic
    ? `<div class="po-score__tactics">${p.homeTactic ? TacticChip({ size: 'xs', ...p.homeTactic }) : '<span></span>'}${p.awayTactic ? TacticChip({ size: 'xs', away: true, ...p.awayTactic }) : '<span></span>'}</div>`
    : '';
  return `<div class="${cx('po-score', p.paused && 'is-paused', view && 'po-score--strip')}">${strip}<div class="po-score__teams"><span class="po-score__team"><span class="po-score__id">${Crest({ name: p.home, size: 22 })}<span>${esc(p.home)}</span></span>${redTag(p.homeRed)}</span><span class="po-score__board"><b class="po-num"${id('h')}>${p.homeScore}</b><i>-</i><b class="po-num"${id('a')}>${p.awayScore}</b></span><span class="po-score__team po-score__team--away"><span class="po-score__id"><span>${esc(p.away)}</span>${
    Crest({ name: p.away, size: 22, color: 'var(--away)' })}</span>${redTag(p.awayRed)}</span></div><div class="po-score__row"><span class="${cx('po-score__min', p.status && !p.ff && 'has-status', p.ff && 'is-ff')}">${lead}<span class="po-num"${id('clock')}>${esc(p.minute)}'</span>${
    p.minuteTo != null ? `<span class="po-num po-score__to">→ ${esc(p.minuteTo)}'</span>` : ''}${p.ff ? '<span>빨리 감기</span>' : p.status ? `<span>${esc(p.status)}</span>` : ''}</span>${speed}</div>${tactics}</div>`;
}

// ── PossessionBar ──

export function PossessionBar(p: { home: number; label?: string | false }): string {
  const v = p.home;
  return `<div class="po-poss"><span class="po-num po-poss__us">${v}%</span><span class="po-poss__track"><i class="po-poss__home" style="width:${v}%"></i><i class="po-poss__away"></i></span><span class="po-num po-poss__them">${100 - v}%</span>${
    p.label !== false ? `<span class="po-poss__label">${esc(p.label || '점유율')}</span>` : ''}</div>`;
}

// ── Pitch: 캔버스 자리 (렌더러는 src/ui/pitch/renderer.ts) ──

export interface PitchProps { canvasId: string; label?: string; children?: string }

export function Pitch(p: PitchProps): string {
  return `<div class="po-pitch" role="img" aria-label="${esc(p.label ?? '경기장')}"><canvas id="${esc(p.canvasId)}" class="po-pitch__canvas"></canvas>${
    p.children ? `<div class="po-pitch__overlay">${p.children}</div>` : ''}</div>`;
}

/** 피치 아래 범례 (05 화면): 우리 / 상대 / 나 */
export function PitchLegend(left: string): string {
  return `<div class="po-pitch-legend"><span class="po-pitch-legend__state">${left}</span><span class="po-pitch-legend__keys"><span><i class="k-home"></i>우리</span><span><i class="k-away"></i>상대</span><span><i class="k-me"></i>나</span></span></div>`;
}

// ── ChoiceButton (결정 순간 선택지, 5차 77~79): 유형 칩 + 이름 + 성공/실패 한 줄(compact) + 오른쪽 큰 확률과 막대 ──

export type ChoiceKind = 'safe' | 'balanced' | 'gamble' | 'play';
const CHOICE_KO: Record<ChoiceKind, string> = { safe: '안전', balanced: '균형', gamble: '도박', play: '플레이 카드' };
const CHOICE_ICON: Record<ChoiceKind, IconName> = { safe: 'safe', balanced: 'balanced', gamble: 'gamble', play: 'newchoice' };
const OFFSIDE_STEP = { low: { l: '낮음', n: 1 }, mid: { l: '중간', n: 2 }, high: { l: '높음', n: 3 } } as const;

export interface ChoiceButtonProps extends Action {
  kind: ChoiceKind;
  name: string;
  /** 확률 % (없으면 판정 없음) */
  chance: number | null;
  /** 카드로 바뀐 %p */
  chanceDelta?: number;
  deltaSource?: string;
  success: { text: string; rating: string };
  fail: { text: string; rating: string };
  offside?: 'low' | 'mid' | 'high';
  /** 플레이 카드 선택지의 카드 이름 칩 */
  card?: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legend';
  selected?: boolean;
  compact?: boolean;
  /** 접은 한 줄 (C.69, 디자인 189): 태그 · 이름 · 확률만, 고른 줄만 성공·실패 줄과 오프사이드·카드 칩을 펼친다 */
  collapsed?: boolean;
  /** 판정 없는 선택지 (C.69, 189): 확률 자리에 작은 "✓ 확정" 칩, 실패 줄 없음. 없으면 chance === null 일 때 "판정 없음" 글자(이전 모양) */
  certain?: boolean;
  disabled?: boolean;
}

export function ChoiceButton(p: ChoiceButtonProps): string {
  const off = p.offside ? OFFSIDE_STEP[p.offside] : null;
  const d = p.chanceDelta ?? 0;
  const shown = p.chance === null ? null : Math.max(0, Math.min(99, p.chance + d));
  const tags = `<span class="po-choice__tags"><span class="po-kind po-kind--${p.kind}">${Icon({ name: CHOICE_ICON[p.kind], size: 12, strokeWidth: 2.4 })}${CHOICE_KO[p.kind]}</span>${
    p.card ? `<span class="po-choice__card">${esc(p.card)}</span>` : ''}${
    off ? `<span class="po-offside po-offside--${p.offside}" title="오프사이드 위험">${Icon({ name: 'offside', size: 12, strokeWidth: 2.2 })}오프사이드 ${off.l}<span class="po-offside__bars" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= off.n ? 'on' : ''}"></i>`).join('')}</span></span>` : ''}</span>`;
  const out = (cls: 'ok' | 'bad', icon: IconName, o: { text: string; rating: string }) =>
    `<span class="po-out po-out--${cls}">${Icon({ name: icon, size: 14, strokeWidth: 3 })}<span>${esc(o.text)}</span><b class="po-num">${esc(o.rating)}</b></span>`;
  const prob = p.certain
    ? `<span class="po-choice__prob po-choice__prob--certain"><span class="po-choice__sure">${Icon({ name: 'check', size: 12, strokeWidth: 3 })}확정</span></span>`
    : shown === null
    ? '<span class="po-choice__prob"><b class="po-choice__none">판정 없음</b></span>'
    : `<span class="po-choice__prob">${d ? `<s class="po-num">${p.chance}%</s>` : ''}<b class="${cx('po-num', d > 0 && 'is-up', d < 0 && 'is-down')}">${shown}<small>%</small></b>${
      d ? `<span class="${cx('po-choice__delta po-num', d > 0 ? 'is-up' : 'is-down')}">${d > 0 ? '▲' : '▼'}${d > 0 ? '+' : '−'}${Math.abs(d)}${p.deltaSource ? `<small> ${esc(p.deltaSource)}</small>` : ''}</span>` : ''}<span class="po-choice__probbar"><i style="width:${shown}%"></i></span></span>`;
  return `<button type="button" class="${cx('po-choice', `po-choice--${p.kind}`, p.kind === 'play' && `po-rarity--${p.rarity ?? 'rare'}`, p.compact && 'po-choice--compact', p.collapsed && 'po-choice--row', p.certain && 'is-certain', p.selected && 'is-selected')}"${actAttrs(p)} aria-pressed="${!!p.selected}"${p.disabled ? ' disabled' : ''}>
    <span class="po-choice__main">${tags}<span class="po-choice__name">${esc(p.name)}</span><span class="po-choice__outcomes">${out('ok', 'check', p.success)}${p.certain ? '' : out('bad', 'close', p.fail)}</span></span>${prob}</button>`;
}

// ── ResultSplash (결정 결과, 5차 82~84): 도장(성공/실패) + 제목 + 설명 + 평점 ──

export interface ResultSplashProps {
  result: 'success' | 'fail' | 'neutral' | 'goal' | 'conceded'; title: string; detail?: string; rating?: number; ratingDelta?: number;
  /** 피치 아래 낮은 판 (C.69, 디자인 190): 도장 · 제목 / 흐름 한 줄 · 오른쪽 평점 */
  compact?: boolean;
}

export function ResultSplash(p: ResultSplashProps): string {
  const ok = p.result === 'success' || p.result === 'goal';
  const bad = p.result === 'fail' || p.result === 'conceded';
  const stamp = p.result === 'goal' ? '골' : p.result === 'conceded' ? '실점' : ok ? '성공' : bad ? '실패' : '보통';
  const rating = p.rating == null ? '' : RatingBadge({ value: p.rating, ...(p.ratingDelta != null ? { delta: p.ratingDelta } : {}), size: 'lg' });
  return `<div class="${cx('po-splash', ok ? 'po-splash--ok' : bad ? 'po-splash--bad' : 'po-splash--flat po-splash--mid', p.result === 'goal' && 'po-splash--goal', p.result === 'conceded' && 'po-splash--concede', p.compact && 'po-splash--compact')}" role="status">
    <span class="po-splash__stamp">${Icon({ name: ok ? 'check' : bad ? 'close' : 'minus', size: p.compact ? 20 : 24, strokeWidth: 3.5 })}${stamp}</span><b class="po-splash__title">${esc(p.title)}</b>${
    p.detail ? `<span class="po-splash__detail">${esc(p.detail)}</span>` : ''}${rating}</div>`;
}
