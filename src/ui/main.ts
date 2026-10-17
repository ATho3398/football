// 웹 UI (B.7, U단계 H.6): 모바일 세로 단일 컬럼, 프레임워크 없이 문자열 렌더링 + 이벤트 위임.
// 화면은 src/ui/views/ 모듈이 뷰모델(src/ui/viewModels.ts)만 받아 그리고, 이 파일은 상태와 동작만 맡는다 (부록 H.2)

import { HL } from '../highlights';
import './design/tokens.css';
import './design/bundle.css';
import './style.css';

import type { FieldAttribute } from '../attributes';
import type { Difficulty } from '../config/balance';
import { canChangePosition, myMatchPosition, newGame, randomSeed, playRound, retire, roundMatch, startNextSeason, type GameState } from '../game';
import { adviceTakenText, checkAdviceTaken, rollProspect } from '../aptitude';
import { MyMatchRun, type MyMatchOutput } from '../engine/adapter';
import type { Moment, StopLevel } from '../engine/moments';
import { replayPlayers } from '../replay';
import { deckHomeSection, deckUnusable, deckView, deckVM, myRoleId } from './views/deck';
import { canAdd, deckProblems, takePick } from '../cardCollection';
import { cardById } from '../config/cards';
import { MomentPitch, momentView, OutcomePitch, outcomeView, shownOptions, type OutcomeVM } from './views/moment';
import { decisionOutcome, OUTCOME, outcomeBand } from '../decisionOutcome';
import { autoAllocate, raiseAttribute } from '../growth';
import { positionOvrExact, type PlayablePosition } from '../positions';
import { teamById } from '../league';
import { deleteSave, listSaves, loadGame, SAVE_SLOTS, saveGame, type SaveSlot } from '../save';
import type { PlayerState } from '../types';
import { BADGE_NAMES_KO } from '../badges';
import { BALANCE } from '../config/balance';
import {
  checklistItems, FIRST_MATCH_LINES, markDone, pendingIntro, refreshUnlocks, resetTips, tipFor, type FeatureId, type TipId,
} from '../unlocks';
import { checklistPanel, firstMatchOverlay, guideResetLink, tipBubble } from './views/guide';
import { Button, Modal, Toast, type ToastProps } from './components';
import {
  adviceCardVM, allocateVM, homeVM, positionOptionsVM, matchResultVM, newGameVM, playerVM, replayStaticVM, retiredVM, savesVM, seasonLabel, seasonVM, versionVM, worldVM,
} from './viewModels';
import { drawAvgMap } from './views/avgMap';
import { navBar, roJosa } from './views/common';
import { adviceCard, homeView, positionChangeSection, positionSheet } from './views/home';
import { proficiencyOf, requestPositionChange } from '../proficiency';
import { matchResultView } from './views/matchResult';
import { playerView } from './views/player';
import { ReplayPlayer, replayView } from './views/replay';
import { allocateView, newGameView, retiredView, savesView, seasonView, titleView, worldView } from './views/screens';
import { tacticsView } from './views/tactics';
import { tacticsVM, type TacticsDraftUI } from './viewModels';
import { customized, defaultSlot, moveSlot, slotPos, startCustom, withFormation, withTendency, type MyTactics } from '../myTactics';
import { nearestCell } from '../formations';
import { tendencyLevels, TENDENCY_NAMES_KO, type Detail, type Level } from '../engine/tactics';
import type { Formation } from '../formations';
import type { Tendency } from '../engine/types';
import { proficientOvr } from '../proficiency';
import type { FieldPosition } from '../positions';

type Screen = 'title' | 'new' | 'home' | 'match' | 'moment' | 'replay' | 'allocate' | 'player' | 'world' | 'season' | 'saves' | 'retired' | 'tactics' | 'deck';

interface ModalState {
  title: string; body?: string; confirm: string; act: string; data?: Record<string, string>; tone?: 'info' | 'warning' | 'danger';
  /** 취소 버튼 대신 다른 동작 (기본은 "취소" = 닫기) */
  cancel?: { label: string; act: string; data?: Record<string, string> };
}

const ui = {
  screen: 'title' as Screen,
  game: null as GameState | null,
  toast: null as ToastProps | null,
  modal: null as ModalState | null,
  /** 시즌 자동 진행 중 */
  busy: false,
  /** 자동 진행 [중단]을 눌렀다: 진행 중인 라운드까지 끝내고 멈춘다 (22.2, 부록 C.30) */
  stopReq: false,
  /** 방금 치른 내 경기 재생 (E5-lite). 세이브에 담지 않는다 */
  replay: null as ReplayPlayer | null,
  /** 포인트 찍기 (디자인 50): 들어올 때 상태를 기억했다가 [−]·[초기화]는 그 상태에서 남은 배분을 다시 적용한다 */
  alloc: null as null | { snap: PlayerState; raises: FieldAttribute[]; startExact: number; back: Screen; coach: boolean; open: Set<string> },
  worldTab: 'table' as 'table' | 'stars',
  /** 주 포지션 변경 요청 시트 (D.3): 고른 포지션 */
  posSheet: null as string | null,
  /** 전술 화면 편집 중인 전술 (저장 전). 들어올 때 저장한 전술을 복사한다 (I.16) */
  tac: null as TacticsDraftUI | null,
  /** 직접 모드로 진행 중인 내 경기 (E.11, E4): 결정 순간마다 멈춘다. 세이브에 담지 않는다 (도중에 나가면 경기 전 상태) */
  live: null as null | {
    run: MyMatchRun; teams: [string, string]; sel: number | null; pitch: MomentPitch | null; prevE: number;
    /** 고른 패 카드 (C.36) */
    card: number | null;
    /** 결정 결과 재생 중 (E5 최소, 부록 C.35): 결과 구간 → 결과 띠 → 다음 장면 */
    oc: null | { vm: OutcomeVM; pitch: OutcomePitch; next: Moment | null; timer: number };
  },
  /** 덱 화면에서 편집 중인 덱 세트 (C.36) */
  deckSet: null as number | null,
  form: {
    mode: 'prospect' as 'prospect' | 'real', name: '', position: 'ST' as PlayablePosition, seed: '', difficulty: 'normal' as Difficulty, realId: '',
    /** 시드를 비웠을 때 쓰는 무작위 시드 (가상 유망주 시작 후보를 미리 보여 주려고 화면에 들어올 때 정한다, C.37) */
    roll: '',
    /** 시작 후보를 정한 시드 (바뀌면 고른 자리를 후보 1위로 되돌린다) */
    posFor: '',
    /** "다른 포지션에서 고르기" 펼침 */
    others: false,
  },
};

/** 가상 유망주 시드: 입력한 시드, 비웠으면 화면이 정한 무작위 시드 */
function prospectSeed(): string {
  if (!ui.form.roll) ui.form.roll = randomSeed();
  return ui.form.seed.trim() || ui.form.roll;
}

/** 시드가 바뀌면 시작 포지션을 새 후보 1위로 (pending 31 01:03 개정) */
function syncProspectPick(): void {
  const key = prospectSeed();
  if (ui.form.posFor === key) return;
  ui.form.posFor = key;
  ui.form.position = rollProspect(key).candidates[0]!.pos;
  ui.form.others = false;
}

const app = document.getElementById('app')!;
const NAV_SCREENS: Screen[] = ['home', 'player', 'world'];

function autosave(): void {
  if (ui.game) saveGame('auto', ui.game);
}

function go(screen: Screen): void {
  ui.screen = screen;
  ui.modal = null;
  render();
  window.scrollTo(0, 0);
}

let toastTimer = 0;
function showToast(t: ToastProps | string, ms = 2200): void {
  ui.toast = typeof t === 'string' ? { kind: 'info', title: t } : t;
  render();
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    ui.toast = null;
    render();
  }, ms);
}

/** 레전드 배지 알림 (D.4) */
function badgeToast(g: GameState): void {
  const b = g.lastSeasonSummary?.badges ?? [];
  if (b.length) showToast({ kind: 'badge', title: `레전드 배지 · ${BADGE_NAMES_KO[b[0]!.id]}`, body: `위상이 ${BALANCE.badges.reputation}점 올랐어요.` }, 3500);
}

function confirmModal(m: ModalState): void {
  ui.modal = m;
  render();
}

// ── 화면 ──

function titleScreen(): string {
  const auto = listSaves()[0];
  return titleView({
    cont: auto ? { name: auto.name, team: `${auto.age}세`, meta: `${seasonLabel(auto.season)} 시즌 · ${auto.round}라운드 · 자동 저장` } : null,
    version: versionVM(),
  });
}

function screenHtml(): string {
  const g = ui.game;
  switch (ui.screen) {
    case 'title': return titleScreen();
    case 'new':
      syncProspectPick();
      return newGameView(newGameVM({ ...ui.form, seed: ui.form.seed, roll: prospectSeed() }));
    case 'saves': return savesView(savesVM(listSaves(), SAVE_SLOTS), !!g && g.phase !== 'retired', versionVM(g));
    default: break;
  }
  if (!g) return titleScreen();
  if (g.phase === 'retired' && !['retired', 'season', 'saves', 'player'].includes(ui.screen)) return retiredView(retiredVM(g));
  switch (ui.screen) {
    case 'home': {
      const canPos = canChangePosition(g);
      const inSeason = g.phase === 'season';
      const pos = canPos ? positionChangeSection(g.player.position, Math.floor(proficiencyOf(g.player, g.player.position)), inSeason) : '';
      const sheet = ui.posSheet && canPos ? positionSheet(positionOptionsVM(g), ui.posSheet, inSeason) : '';
      const adv = adviceCardVM(g);
      const list = g.player.history.length === 0 ? checklistItems(g.guide) : null;
      const deck = g.cards ? deckHomeSection({ active: g.cards.active, count: g.cards.decks[g.cards.active]?.length ?? 0, unusable: deckUnusable(g, myRoleId(g)), picks: g.cards.picks.length }) : '';
      return homeView(homeVM(g), deck + (list ? checklistPanel(list) : '') + pos, adv ? adviceCard(adv) : '') + guideResetLink() + sheet;
    }
    case 'deck': return deckView(deckVM(g, ui.deckSet ?? g.cards.active, myRoleId(g)));
    case 'player': return playerView(playerVM(g));
    case 'world': return worldView(worldVM(g), ui.worldTab);
    case 'replay':
      if (ui.replay) return replayView(ui.replay.vm(replayStaticVM(ui.replay.replay, g)));
      break;
    case 'moment': {
      const lv = ui.live;
      if (lv?.oc) return outcomeView(lv.oc.vm);
      const m = lv?.run.pending;
      if (lv && m) {
        const log = lv.run.sim.state.moments.log;
        return momentView({ moment: m, teams: lv.teams, selected: lv.sel, card: lv.card, stop: g.control.stop, last: log.at(-1) ?? null, count: log.length + 1 });
      }
      break;
    }
    case 'allocate': {
      const a = ui.alloc;
      if (a) {
        const pending = a.snap.unspentPoints - g.player.unspentPoints;
        return allocateView(allocateVM(g, a.startExact, a.coach), a.open, pending);
      }
      break;
    }
    case 'season': {
      const vm = seasonVM(g);
      if (vm) return seasonView(vm);
      break;
    }
    case 'retired': return retiredView(retiredVM(g));
    case 'tactics':
      if (ui.tac) return tacticsView(tacticsVM(g, ui.tac));
      break;
    default: break;
  }
  const vm = matchResultVM(g, ui.replay?.replay ?? null);
  return vm ? matchResultView(vm) : homeView(homeVM(g));
}

/** 화면 → 첫 방문 말풍선 id */
const TIP_SCREENS: Partial<Record<Screen, TipId>> = {
  home: 'home', player: 'player', world: 'world', replay: 'replay', match: 'match', allocate: 'allocate', season: 'season', tactics: 'tactics',
};

/** 첫 플레이 안내 (21.4): 공개 소개 → 첫 경기 오버레이 → 말풍선 순으로 한 번에 하나만 */
function guideHtml(g: GameState | null): { modal: string; tip: string } {
  if (!g || ui.modal || g.phase === 'retired') return { modal: '', tip: '' };
  const intro = NAV_SCREENS.includes(ui.screen) ? pendingIntro(g.guide) : null;
  if (intro) {
    return {
      modal: Modal({
        title: `새 기능 · ${intro.name}`, children: intro.intro, icon: 'star', tone: 'info',
        actions: [Button({ block: true, act: 'intro-ok', data: { id: intro.id }, children: '확인' })],
      }),
      tip: '',
    };
  }
  if (ui.screen === 'replay' && ui.replay && !g.guide.firstMatchSeen) {
    ui.replay.hold = true;
    return { modal: firstMatchOverlay(FIRST_MATCH_LINES), tip: '' };
  }
  const id = TIP_SCREENS[ui.screen];
  const text = id ? tipFor(g.guide, id) : null;
  return { modal: '', tip: id && text ? tipBubble(id, text) : '' };
}

function render(): void {
  const g = ui.game;
  const nav = g && NAV_SCREENS.includes(ui.screen) && !(g.phase === 'retired') ? navBar(ui.screen) : '';
  const m = ui.modal;
  const guide = guideHtml(g);
  const modal = m
    ? Modal({
      title: m.title, ...(m.body ? { children: m.body } : {}), icon: m.tone === 'danger' ? 'danger' : 'info', tone: m.tone ?? 'info', onClose: { act: 'modal-close' },
      actions: [
        Button({ variant: 'secondary', block: true, act: m.cancel?.act ?? 'modal-close', ...(m.cancel?.data ? { data: m.cancel.data } : {}), children: m.cancel?.label ?? '취소' }),
        Button({ variant: m.tone === 'danger' ? 'danger' : 'primary', block: true, act: m.act, ...(m.data ? { data: m.data } : {}), children: m.confirm }),
      ],
    })
    : guide.modal;
  const toast = ui.toast ? `<div class="toast-wrap">${Toast(ui.toast)}</div>` : '';
  app.className = `${nav ? 'has-nav ' : ''}app-${ui.screen}`;
  app.innerHTML = `<main class="screen screen-${ui.screen}">${guide.tip}${screenHtml()}</main>${nav}${modal}${toast}`;
  if (ui.screen === 'replay' && ui.replay) ui.replay.attach();
  else ui.replay?.stop();
  if (ui.screen === 'moment' && ui.live?.oc) ui.live.oc.pitch.attach();
  else if (ui.screen === 'moment' && ui.live?.pitch) ui.live.pitch.attach();
  else {
    ui.live?.pitch?.stop();
    ui.live?.oc?.pitch.stop();
  }
  if (ui.screen === 'match' && ui.replay) drawAvgMap(ui.replay.replay);
}

function livePlayers(g: GameState) {
  const s = ui.live!.run.sim.state;
  return replayPlayers(s.input.home, s.input.away).map((p) => (p.isMe ? { ...p, name: g.player.name } : p));
}

/** 직접 모드 경기: 다음 결정 순간까지 돌리고 멈추면 결정 화면, 끝나면 결과 처리 */
function liveAdvance(g: GameState): void {
  liveShow(g, ui.live!.run.advance());
}

/** 멈춘 결정 순간을 보여 주거나 (없으면) 경기를 마친다 */
function liveShow(g: GameState, m: Moment | null): void {
  const lv = ui.live!;
  lv.pitch?.stop();
  if (m) {
    lv.sel = null;
    lv.card = null;
    const players = new Map(livePlayers(g).map((p) => [p.id, p]));
    const endE = lv.run.frames.at(-1)!.e;
    // 앞 장면: 직전 결정(결과 재생) 뒤부터 (최대 8초, 처음이거나 오래전이면 4초)
    const fromE = lv.prevE > 0 && endE - lv.prevE <= 8 ? lv.prevE : Math.max(0, endE - 4);
    lv.pitch = new MomentPitch(lv.run.frames, players, m.side, m, fromE, null);
    go('moment');
    return;
  }
  const out = lv.run.finish();
  ui.live = null;
  finishPlay(g, out);
}

/**
 * 결정 확정 (E5 최소, 부록 C.35): 그 틱을 마저 진행하고 다음 결정 순간(또는 경기 끝)까지 미리 계산한 뒤,
 * 멈춘 장면에서 결과가 날 때까지(공 소유 변경·슈팅 결과·파울·아웃·골, 최대 6초)를 실제 속도로 보여 주고 결과 띠를 띄운다
 */
function liveDecide(g: GameState, choice: number | 'delegate'): void {
  const lv = ui.live!;
  const m = lv.run.pending!;
  const s = lv.run.sim.state;
  const startIdx = lv.run.frames.length - 1;
  const ev0 = s.events.length;
  const shown = shownOptions(m, lv.card);
  const opt = choice === 'delegate' ? null : shown[choice] ?? null;
  // 카드 (C.36): 고른 카드와 함께. 플레이 카드 선택지는 opt 'card'
  const card = choice !== 'delegate' && lv.card !== null ? m.cards.find((c) => c.hand === lv.card) ?? null : null;
  const used = card && (card.role !== 'play' || choice === m.options.length) ? card : null;
  lv.run.resolve(choice === 'delegate' ? 'delegate' : used ? { opt: choice === m.options.length ? 'card' : choice, card: used.hand } : choice);
  const next = lv.run.advance();
  const players = livePlayers(g);
  const o = decisionOutcome({ frames: lv.run.frames, startIdx, events: s.events.slice(ev0), players, type: m.type, action: opt?.action ?? null, side: m.side });
  const rec = s.moments.log.find((r) => r.id === m.id);
  const score: [number, number] = [...m.score];
  if (o.goal !== null) score[o.goal]++;
  const KO = { safe: '안전', balanced: '균형', gamble: '도박', card: '카드' } as const;
  const band = outcomeBand(o, rec, m.side);
  // 결정 기록도 화면에서 본 결과를 따른다 (띠와 기록이 엇갈리지 않게)
  if (rec) rec.seen = { result: band.tone === 'goal' ? 'success' : band.tone === 'conceded' ? 'fail' : band.tone, flow: band.flow };
  const vm: OutcomeVM = {
    moment: m, teams: lv.teams, score, shown: false, band, kind: opt ? opt.kind : 'delegate',
    choice: opt ? `${used ? `🃏 ${used.name} · ` : `${KO[opt.kind]} · `}${opt.label}${opt.p !== null ? ` (${Math.round(Math.min(0.99, opt.p + (used?.deltas?.[choice as number] ?? 0)) * 100)}%)` : ''}` : '맡기기 (엔진 판단)',
  };
  lv.prevE = o.to;
  lv.pitch?.stop();
  lv.pitch = null;
  const pitch = new OutcomePitch(lv.run.frames, new Map(players.map((p) => [p.id, p])), m.side, o.from, o.to, () => {
    const oc = ui.live?.oc;
    if (!oc || oc.pitch !== pitch) return;
    oc.vm.shown = true;
    if (ui.screen === 'moment') render();
    oc.timer = window.setTimeout(() => liveContinue(g), OUTCOME.bandMs);
  });
  lv.oc = { vm, pitch, next, timer: 0 };
  go('moment');
}

/** 결과 띠 뒤 다음 장면으로 */
function liveContinue(g: GameState): void {
  const lv = ui.live;
  if (!lv?.oc) return;
  window.clearTimeout(lv.oc.timer);
  lv.oc.pitch.stop();
  const next = lv.oc.next;
  lv.oc = null;
  liveShow(g, next);
}

/** 라운드 처리 후 재생 화면으로 (out 이 있으면 직접 모드로 이미 계산한 경기) */
function finishPlay(g: GameState, out?: MyMatchOutput): void {
  const report = playRound(g, { ...(out ? { engineOut: out } : {}), onReplay: (r) => { ui.replay = new ReplayPlayer(r, () => render()); } });
  autosave();
  go(ui.replay ? 'replay' : 'match');
  if (g.phase !== 'season') badgeToast(g);
  if (report.cardUnlock) showToast({ kind: 'info', title: `시그니처 카드 해금 · ${report.cardUnlock}`, body: '덱 편집에서 덱에 넣을 수 있어요.' }, 3000);
  else if (report.levelsGained > 0) showToast({ kind: 'levelup', title: `레벨 업! Lv.${g.player.level}`, body: `능력치 포인트 ${g.player.unspentPoints}개를 쓸 수 있어요.` }, 3000);
}

// ── 동작 ──

function readFormInputs(): void {
  const name = document.getElementById('f-name') as HTMLInputElement | null;
  const seed = document.getElementById('f-seed') as HTMLInputElement | null;
  if (name) ui.form.name = name.value;
  if (seed) ui.form.seed = seed.value;
}

/** 포인트 찍기 들어가기: 지금 상태를 기억한다. 처음엔 핵심 능력치가 많은 묶음을 펼친다 */
function enterAllocate(g: GameState, back: Screen): void {
  const vm = allocateVM(g, 0, false);
  const best = [...vm.groups].sort((a, b) => b.rows.filter((r) => r.key).length - a.rows.filter((r) => r.key).length)[0]!;
  ui.alloc = {
    snap: structuredClone(g.player), raises: [], startExact: positionOvrExact(g.player.attributes, g.player.position), back,
    coach: false, open: new Set([best.name]),
  };
}

/** 기억한 상태로 되돌리고 남은 배분을 다시 적용 */
function replayAlloc(g: GameState): void {
  const a = ui.alloc!;
  g.player = structuredClone(a.snap);
  for (const attr of a.raises) raiseAttribute(g.player, attr);
}

function startSimRest(g: GameState): void {
  // 경기 엔진은 한 경기에 약 0.5초가 걸리므로 라운드마다 화면에 진행 상황을 그린다
  ui.busy = true;
  ui.stopReq = false;
  const stop = { action: '중단', onAction: { act: 'sim-stop' } };
  const next = () => {
    if (g.phase !== 'season') {
      ui.busy = false;
      ui.stopReq = false;
      ui.toast = null;
      autosave();
      go('season');
      badgeToast(g);
      return;
    }
    // [중단]: 라운드 사이에서만 확인하므로 진행 중인 라운드는 끝까지 치른다
    if (ui.stopReq) {
      ui.busy = false;
      ui.stopReq = false;
      autosave();
      go('home');
      showToast({ kind: 'info', title: '자동 진행을 멈췄어요', body: `${g.league.round}/${g.league.schedule.length}라운드까지 치렀어요.` }, 2600);
      return;
    }
    playRound(g);
    autoAllocate(g.player);
    ui.toast = { kind: 'info', title: '자동 진행 중', body: `${g.league.round}/${g.league.schedule.length}라운드`, ...stop };
    render();
    setTimeout(next, 0);
  };
  ui.toast = { kind: 'info', title: '자동 진행 중', ...stop };
  render();
  setTimeout(next, 0);
}

/** [중단]은 라운드마다 다시 그려지는 토스트 안에 있어 click(누름·뗌이 같은 요소)이 끊길 수 있으므로 누르는 순간에 받는다 */
function requestSimStop(): void {
  if (!ui.busy || ui.stopReq) return;
  ui.stopReq = true;
  ui.toast = { kind: 'info', title: '멈추는 중', body: '진행 중인 라운드까지 치르고 멈춰요.' };
  render();
}

app.addEventListener('pointerdown', (ev) => {
  if ((ev.target as HTMLElement).closest('[data-act="sim-stop"]')) requestSimStop();
  formationPointerDown(ev);
});

// ── 커스텀 포메이션 끌어다 놓기 (E.5.1, I.16): 보이지 않는 격자의 가장 가까운 칸에 붙는다 ──
let fdrag: { slot: number; el: HTMLElement; pitch: HTMLElement; x0: number; y0: number; moved: boolean } | null = null;

/** 미니 피치 위 화면 좌표 → 정규화 (x 0 우리 골 → 1 상대 골, y 0 왼쪽 → 1 오른쪽). FormationPitch 의 배치식 left = 10 + y × 80, top = 100 − (8 + x × 95) 의 역 */
function pitchNorm(pitch: HTMLElement, cx: number, cy: number): [number, number, number, number] {
  const r = pitch.getBoundingClientRect();
  const left = Math.min(100, Math.max(0, ((cx - r.left) / r.width) * 100));
  const top = Math.min(100, Math.max(0, ((cy - r.top) / r.height) * 100));
  return [(100 - top - 8) / 95, (left - 10) / 80, left, top];
}

function dropSlot(slot: number, x: number, y: number): void {
  const g = ui.game;
  if (!ui.tac || !g) return;
  const { tactics, problem } = moveSlot(ui.tac.draft, slot, nearestCell(x, y));
  ui.tac.draft = tactics;
  ui.tac.moving = null;
  if (problem) showToast({ kind: 'info', title: '그 자리로 옮길 수 없어요', body: problem }, 2400);
  render();
}

function formationPointerDown(ev: PointerEvent): void {
  if (!ui.tac?.edit) return;
  const t = ev.target as HTMLElement;
  const pitch = t.closest<HTMLElement>('.po-fpitch.is-edit');
  if (!pitch) return;
  const el = t.closest<HTMLElement>('[data-drag]');
  if (!el) {
    // 선수를 고른 뒤 빈 곳을 누르면 그리로 옮긴다
    if (ui.tac.moving != null) {
      const [x, y] = pitchNorm(pitch, ev.clientX, ev.clientY);
      dropSlot(ui.tac.moving, x, y);
    }
    return;
  }
  ev.preventDefault();
  fdrag = { slot: Number(el.dataset.drag), el, pitch, x0: ev.clientX, y0: ev.clientY, moved: false };
  el.setPointerCapture?.(ev.pointerId);
}

app.addEventListener('pointermove', (ev) => {
  if (!fdrag) return;
  if (!fdrag.moved && Math.hypot(ev.clientX - fdrag.x0, ev.clientY - fdrag.y0) < 6) return;
  fdrag.moved = true;
  const [, , left, top] = pitchNorm(fdrag.pitch, ev.clientX, ev.clientY);
  fdrag.el.style.left = `${left}%`;
  fdrag.el.style.top = `${top}%`;
  fdrag.el.classList.add('is-drag');
});

app.addEventListener('pointerup', (ev) => {
  const d = fdrag;
  fdrag = null;
  if (!d || !ui.tac) return;
  if (d.moved) {
    const [x, y] = pitchNorm(d.pitch, ev.clientX, ev.clientY);
    dropSlot(d.slot, x, y);
    return;
  }
  // 탭: 선수 고르기 (이미 고른 선수를 다시 누르면 취소, 다른 선수를 누르면 그 선수로)
  ui.tac.moving = ui.tac.moving === d.slot ? null : d.slot;
  render();
});

app.addEventListener('pointercancel', () => {
  if (fdrag) {
    fdrag = null;
    render();
  }
});

// 새 게임 시드를 바꾸면 시작 후보를 다시 보여 준다 (C.37)
app.addEventListener('change', (ev) => {
  if ((ev.target as HTMLElement | null)?.id !== 'f-seed' || ui.screen !== 'new') return;
  readFormInputs();
  // 입력 칸이 blur 되는 중에 DOM 을 바꾸면 오류라 다음 틱에 그린다
  setTimeout(render, 0);
});

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  // 겹침 바깥만 누르면 닫는다 (모달·시트 안쪽 클릭은 무시)
  if (el.dataset.overlay && ev.target !== el) return;
  const act = el.dataset.act!;
  const g = ui.game;
  const v = el.dataset.v;

  switch (act) {
    case 'intro-ok':
      if (!g) return;
      g.guide.introsSeen.push(el.dataset.id as FeatureId);
      autosave();
      render();
      return;
    case 'fm-close':
      if (!g) return;
      g.guide.firstMatchSeen = true;
      if (ui.replay) ui.replay.hold = false;
      autosave();
      render();
      return;
    case 'tip-close':
      if (!g || !v) return;
      g.guide.tipsSeen.push(v as TipId);
      autosave();
      render();
      return;
    case 'tips-off':
      if (!g) return;
      g.guide.tipsOff = true;
      autosave();
      render();
      return;
    case 'tips-reset':
      if (!g) return;
      resetTips(g.guide);
      autosave();
      showToast('안내를 처음부터 다시 보여 줄게요.');
      return;
    case 'pos-open':
      if (!g) return;
      ui.posSheet = v ?? g.player.position;
      render();
      return;
    case 'advice-close':
      if (!g?.player.advice) return;
      g.player.advice.dismissed = true;
      autosave();
      render();
      return;
    case 'pos-pick':
      ui.posSheet = v ?? null;
      render();
      return;
    case 'sheet-close':
      ui.posSheet = null;
      render();
      return;
    case 'pos-change': {
      if (!g || !v) return;
      const from = g.player.position;
      if (requestPositionChange(g.player, v as PlayablePosition, canChangePosition(g))) {
        // 내 위치도 새 주 포지션 슬롯으로 (E.19 ②). 포메이션·역할·세부 전술은 그대로
        g.tactics = { ...g.tactics, mySlot: defaultSlot(g.tactics.formation, v as PlayablePosition, g.rosters[g.player.teamId], g.tactics.custom) };
        // 포변 조언대로 바꿨으면 보너스 (부록 C.37)
        const taken = checkAdviceTaken(g.player, myMatchPosition(g), g.league.season, g.league.round);
        autosave();
        ui.posSheet = null;
        showToast({ kind: 'info', title: `주 포지션 ${from} → ${v}`, body: taken ? adviceTakenText(String(v)) : g.phase === 'season' ? '다음 경기부터 새 포지션으로 뛰어요.' : '다음 시즌부터 새 포지션으로 뛰어요.' }, 3200);
      }
      return;
    }
    case 'modal-close':
      ui.modal = null;
      render();
      return;
    case 'tac-open':
      if (!g) return;
      ui.tac = { draft: structuredClone(g.tactics), pickMe: false, sheet: null, sheetPick: null, edit: false, moving: null };
      markDone(g.guide, 'tactics');
      autosave();
      go('tactics');
      return;
    case 'tac-back':
      if (ui.tac && g && JSON.stringify(ui.tac.draft) !== JSON.stringify(g.tactics)) {
        confirmModal({ title: '저장하지 않고 나갈까요?', body: '바꾼 전술은 사라지고 저장한 전술로 경기해요.', confirm: '나가기', act: 'tac-leave', tone: 'warning' });
        return;
      }
      ui.tac = null;
      go('home');
      return;
    case 'tac-leave':
      ui.tac = null;
      go('home');
      return;
    case 'tac-detail':
      if (!g) return;
      g.guide.tacticsDetailOpen = !g.guide.tacticsDetailOpen;
      autosave();
      render();
      return;
    case 'tac-tend': {
      const t = ui.tac;
      if (!t || !v || v === t.draft.tendency) return;
      const c = customized(t.draft);
      if (c.details + c.roles === 0) {
        t.draft = withTendency(t.draft, v as Tendency, true);
        render();
        return;
      }
      // I.16 상태: 바꾼 세부 전술·역할이 있으면 성향 기본값으로 바꿀지 묻는다 (디자인 28)
      confirmModal({
        title: `${TENDENCY_NAMES_KO[v as Tendency]}${roJosa(TENDENCY_NAMES_KO[v as Tendency])} 바꿀까요?`,
        body: `세부 전술 ${c.details}개와 역할 ${c.roles}개를 직접 바꿔 두었어요. 성향 기본값으로 바꿀까요?`,
        confirm: '기본값으로 바꾸기', act: 'tac-tend-ok', data: { v, reset: '1' },
        cancel: { label: '성향만 바꾸기', act: 'tac-tend-ok', data: { v, reset: '0' } },
      });
      return;
    }
    case 'tac-tend-ok':
      if (!ui.tac || !v) return;
      ui.tac.draft = withTendency(ui.tac.draft, v as Tendency, el.dataset.reset === '1');
      ui.modal = null;
      render();
      return;
    case 'tac-form':
      if (!ui.tac || !g || !v) return;
      if (v === 'custom') {
        // 커스텀 포메이션 (E.5.1): 지금 프리셋에서 시작해 끌어다 놓는다
        ui.tac.draft = startCustom(ui.tac.draft);
        ui.tac.edit = true;
        ui.tac.moving = null;
      } else {
        ui.tac.draft = withFormation(ui.tac.draft, v as Formation, g.rosters[g.player.teamId]);
        ui.tac.edit = false;
      }
      ui.tac.sheet = null;
      ui.tac.pickMe = false;
      render();
      return;
    case 'tac-edit':
      if (!ui.tac) return;
      ui.tac.edit = !ui.tac.edit;
      ui.tac.moving = null;
      ui.tac.pickMe = false;
      render();
      return;
    case 'tac-level':
      if (!ui.tac) return;
      ui.tac.draft = { ...ui.tac.draft, levels: { ...ui.tac.draft.levels, [el.dataset.k as Detail]: Number(v) as Level } };
      render();
      return;
    case 'tac-pick-me':
      if (!ui.tac) return;
      ui.tac.pickMe = !ui.tac.pickMe;
      render();
      return;
    case 'tac-me-slot': {
      const t = ui.tac;
      if (!t || !g || v === undefined) return;
      const slot = Number(v);
      const pos = slotPos(t.draft, slot) as FieldPosition;
      t.pickMe = false;
      if (pos !== g.player.position) {
        // 주 포지션 밖 슬롯 경고 (I.16, 디자인 29)
        const main = proficientOvr(g.player, g.player.position);
        const there = proficientOvr(g.player, pos);
        confirmModal({
          title: `${pos} 슬롯에서 뛸까요?`, tone: 'warning',
          body: `주 포지션(${g.player.position})이 아니라서 OVR이 ${main} → ${there}로 낮아져요. 선발 확률과 경기력도 그만큼 떨어지고, 이 포지션 숙련도가 조금씩 올라요.`,
          confirm: `${pos}로 정하기`, act: 'tac-me-ok', data: { v: String(slot) },
        });
        return;
      }
      t.draft = { ...t.draft, mySlot: slot };
      render();
      return;
    }
    case 'tac-me-ok':
      if (!ui.tac || v === undefined) return;
      ui.tac.draft = { ...ui.tac.draft, mySlot: Number(v) };
      ui.modal = null;
      render();
      return;
    case 'tac-role-open':
      if (!ui.tac || v === undefined) return;
      ui.tac.sheet = Number(v);
      ui.tac.sheetPick = ui.tac.draft.roles[Number(v)] ?? null;
      render();
      return;
    case 'tac-role-pick':
      if (!ui.tac) return;
      ui.tac.sheetPick = v ? v : null;
      render();
      return;
    case 'tac-role-ok': {
      const t = ui.tac;
      if (!t || t.sheet === null) return;
      const roles = [...t.draft.roles];
      roles[t.sheet] = t.sheetPick;
      t.draft = { ...t.draft, roles };
      t.sheet = null;
      render();
      return;
    }
    case 'tac-sheet-close':
      if (!ui.tac) return;
      ui.tac.sheet = null;
      render();
      return;
    case 'tac-reset':
      if (!ui.tac) return;
      ui.tac.draft = { ...ui.tac.draft, roles: ui.tac.draft.roles.map(() => null), levels: tendencyLevels(ui.tac.draft.tendency) };
      showToast(`${TENDENCY_NAMES_KO[ui.tac.draft.tendency]} 기본값으로 되돌렸어요. 저장해야 적용돼요.`);
      return;
    case 'tac-save':
      if (!g || !ui.tac) return;
      g.tactics = structuredClone(ui.tac.draft) as MyTactics;
      // 전술 "내 위치"를 조언받은 포지션군 슬롯으로 바꿔도 포변으로 본다 (pending 36 ②)
      if (g.phase === 'season' && checkAdviceTaken(g.player, myMatchPosition(g), g.league.season, g.league.round)) {
        autosave();
        showToast({ kind: 'info', title: '전술을 저장했어요', body: adviceTakenText(myMatchPosition(g)) }, 3200);
        return;
      }
      autosave();
      showToast({ kind: 'info', title: '전술을 저장했어요', body: '바꾸기 전까지 매 경기 이 전술로 뛰어요.' });
      return;
    case 'go':
    case 'go-tab': {
      if (ui.screen === 'new') readFormInputs();
      const to = (act === 'go-tab' ? v : el.dataset.to) as Screen;
      if (to === 'deck') ui.deckSet = null;
      if (ui.screen === 'deck' && to !== 'deck' && g) g.cards.fresh = [];
      if (to === 'allocate' && g) enterAllocate(g, ui.screen === 'season' ? 'season' : g.phase === 'season' ? 'home' : 'season');
      go(to);
      return;
    }
    case 'world-tab':
      ui.worldTab = v as 'table' | 'stars';
      render();
      return;
    case 'continue': {
      try {
        ui.game = loadGame('auto');
        if (ui.game) refreshUnlocks(ui.game);
      } catch (e) {
        showToast((e as Error).message);
        return;
      }
      go(ui.game?.phase === 'retired' ? 'retired' : 'home');
      return;
    }
    case 'form-others':
      readFormInputs();
      ui.form.others = !ui.form.others;
      render();
      return;
    case 'form-reroll':
      readFormInputs();
      ui.form.seed = '';
      ui.form.roll = randomSeed();
      render();
      return;
    case 'form': {
      readFormInputs();
      const k = el.dataset.k as 'mode' | 'position' | 'difficulty' | 'realId';
      (ui.form as unknown as Record<string, string>)[k] = v!;
      render();
      return;
    }
    case 'start': {
      readFormInputs();
      const f = ui.form;
      if (f.mode === 'real' && !f.realId) return;
      ui.game = f.mode === 'prospect'
        ? newGame({ mode: 'prospect', name: f.name, position: f.position, seed: prospectSeed(), difficulty: f.difficulty, rolled: true })
        : newGame({ mode: 'real', playerId: f.realId, seed: f.seed, difficulty: f.difficulty });
      ui.replay = null;
      f.roll = '';
      f.posFor = '';
      autosave();
      go('home');
      showToast({ kind: 'info', title: `${ui.game.player.name} · ${teamById(ui.game.league, ui.game.player.teamId).nameKo}`, body: '커리어를 시작했어요.' });
      return;
    }
    case 'sim-stop':
      requestSimStop();
      return;
    case 'play': {
      if (!g || g.phase !== 'season' || ui.busy) return;
      ui.replay = null;
      // 직접 모드 (E.11): 내가 뛰는 경기면 결정 순간마다 멈춘다. 자동 모드·결장은 기존처럼 한 번에
      const rm = roundMatch(g);
      if (g.control.mode === 'direct' && rm.plan.minutes) {
        const run = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop: g.control.stop } }, { teams: rm.teams });
        ui.live = { run, teams: rm.teams, sel: null, pitch: null, prevE: 0, oc: null, card: null };
        liveAdvance(g);
        return;
      }
      finishPlay(g);
      return;
    }
    case 'mo-pick': {
      const lv = ui.live;
      if (!lv || v === undefined) return;
      lv.sel = lv.sel === Number(v) ? null : Number(v);
      if (lv.pitch) lv.pitch.selected = lv.sel;
      render();
      return;
    }
    case 'deck-set':
      if (!g || v === undefined) return;
      ui.deckSet = Number(v);
      render();
      return;
    case 'deck-use':
      if (!g || v === undefined || deckProblems(g.cards.decks[Number(v)] ?? []).length) return;
      g.cards.active = Number(v);
      autosave();
      render();
      return;
    case 'deck-add':
    case 'deck-remove': {
      if (!g || !v) return;
      const set = ui.deckSet ?? g.cards.active;
      const deck = g.cards.decks[set]!;
      if (act === 'deck-add') {
        if (canAdd(g.cards, deck, v) !== null) return;
        deck.push(v);
      } else {
        const k = deck.lastIndexOf(v);
        if (k < 0 || deck.length <= BALANCE.cards.deckMin) return;
        deck.splice(k, 1);
      }
      g.cards.fresh = g.cards.fresh.filter((x) => x !== v);
      autosave();
      render();
      return;
    }
    case 'pick-take': {
      if (!g || !v) return;
      const [pi, oi] = v.split(':').map(Number);
      const id = takePick(g.cards, pi!, oi!);
      if (id) showToast({ kind: 'info', title: `카드 획득 · ${cardById(id)?.name ?? id}`, body: '가진 카드에서 덱에 넣을 수 있어요.' });
      autosave();
      render();
      return;
    }
    case 'mo-card': {
      // 패 카드 (I.17 3번): 확률 카드는 선택지 확률이 바뀌어 보이고, 플레이 카드는 4번째 선택지를 연다. 다시 누르면 취소
      const lv = ui.live;
      const m = lv?.run.pending;
      if (!lv || !m || v === undefined) return;
      const mc = m.cards.find((c) => c.hand === Number(v));
      if (!mc?.usable) return;
      const off = lv.card === mc.hand;
      if (lv.sel !== null && lv.sel >= m.options.length) lv.sel = null;
      lv.card = off ? null : mc.hand;
      if (!off && mc.option) lv.sel = m.options.length;
      if (lv.pitch) {
        lv.pitch.options = shownOptions(m, lv.card);
        lv.pitch.selected = lv.sel;
      }
      render();
      return;
    }
    case 'mo-confirm':
    case 'mo-delegate': {
      const lv = ui.live;
      if (!g || !lv || !lv.run.pending || lv.oc) return;
      if (act === 'mo-confirm' && lv.sel === null) return;
      liveDecide(g, act === 'mo-confirm' ? lv.sel! : 'delegate');
      return;
    }
    case 'dec-replay': {
      // 결정 기록 → 그 장면 리플레이 (E5 최소): 결정 앞 6초부터 뒤 7초까지
      const d = ui.replay?.replay.decisions?.[Number(v)];
      if (!ui.replay || !d) return;
      ui.replay.playClip(d.e - HL.decisionLead, d.e + HL.decisionAfter);
      go('replay');
      return;
    }
    case 'oc-skip': {
      const oc = ui.live?.oc;
      if (!g || !oc) return;
      if (!oc.vm.shown) oc.pitch.jump();
      else liveContinue(g);
      return;
    }
    case 'mo-stop': {
      const lv = ui.live;
      if (!g || !v) return;
      g.control.stop = v as StopLevel;
      if (lv) lv.run.sim.state.moments.control.stop = v as StopLevel;
      autosave();
      render();
      return;
    }
    case 'mo-auto': {
      const lv = ui.live;
      if (!g || !lv) return;
      // 자동으로 전환 (I.17 2번): 이번 순간부터 엔진이 결정하고, 다음 경기도 자동 (홈에서 다시 바꿀 수 있다)
      g.control.mode = 'auto';
      lv.run.sim.state.moments.control.mode = 'auto';
      if (lv.run.pending) lv.run.resolve('delegate');
      liveAdvance(g);
      return;
    }
    case 'ctl-mode':
      if (!g || !v) return;
      g.control.mode = v === 'auto' ? 'auto' : 'direct';
      autosave();
      render();
      return;
    case 'ctl-stop':
      if (!g || !v) return;
      g.control.stop = v as StopLevel;
      autosave();
      render();
      return;
    case 'rp-toggle':
      if (!ui.replay || ui.replay.ended) return;
      ui.replay.paused = !ui.replay.paused;
      render();
      return;
    case 'rp-live':
      ui.replay?.goLive();
      render();
      return;
    case 'rp-highlight':
      ui.replay?.backToHighlight();
      render();
      return;
    case 'rp-speed':
      if (!ui.replay) return;
      ui.replay.speed = parseInt(v ?? '1', 10);
      render();
      return;
    case 'rp-skip':
      if (ui.replay?.ended) {
        go('match');
        return;
      }
      ui.replay!.paused = true;
      confirmModal({ title: '경기 결과로 건너뛸까요?', body: '남은 경기를 보지 않고 결과 화면으로 가요. 결과는 같아요.', confirm: '건너뛰기', act: 'rp-skip-ok' });
      return;
    case 'rp-skip-ok':
      // 건너뛰기는 경기 전체 (24.3, 디자인 17)
      ui.replay?.skip();
      go('match');
      return;
    case 'rp-result':
      go('match');
      return;
    case 'sim-rest':
      if (!g || g.phase !== 'season' || ui.busy) return;
      confirmModal({ title: '남은 시즌을 자동으로 진행할까요?', body: '남은 경기를 모두 진행해요. 포인트는 자동으로 배분돼요.', confirm: '진행', act: 'sim-rest-ok' });
      return;
    case 'sim-rest-ok':
      ui.modal = null;
      if (g && g.phase === 'season' && !ui.busy) startSimRest(g);
      return;
    case 'raise': {
      if (!g || !ui.alloc) return;
      const before = g.player.coachWarned;
      if (raiseAttribute(g.player, el.dataset.attr as FieldAttribute)) ui.alloc.raises.push(el.dataset.attr as FieldAttribute);
      if (!before && g.player.coachWarned) ui.alloc.coach = true;
      render();
      return;
    }
    case 'lower': {
      if (!g || !ui.alloc) return;
      const i = ui.alloc.raises.lastIndexOf(el.dataset.attr as FieldAttribute);
      if (i < 0) return;
      ui.alloc.raises.splice(i, 1);
      replayAlloc(g);
      render();
      return;
    }
    case 'alloc-reset':
      if (!g || !ui.alloc) return;
      ui.alloc.raises = [];
      replayAlloc(g);
      render();
      return;
    case 'alloc-open': {
      const a = ui.alloc;
      if (!a || !v) return;
      if (a.open.has(v)) a.open.delete(v);
      else a.open.add(v);
      render();
      return;
    }
    case 'auto-alloc': {
      if (!g || !ui.alloc) return;
      const before = { ...g.player.attributes };
      autoAllocate(g.player);
      for (const [a, val] of Object.entries(g.player.attributes) as [FieldAttribute, number][]) {
        for (let k = before[a]; k < val; k++) ui.alloc.raises.push(a);
      }
      render();
      return;
    }
    case 'alloc-done':
      if (!g) return;
      if (ui.alloc?.raises.length) markDone(g.guide, 'allocate');
      autosave();
      go(ui.alloc?.back ?? 'home');
      ui.alloc = null;
      return;
    case 'alloc-cancel':
      if (!g) return;
      if (ui.alloc) {
        ui.alloc.raises = [];
        replayAlloc(g);
      }
      go(ui.alloc?.back ?? 'home');
      ui.alloc = null;
      return;
    case 'next-season':
      if (!g) return;
      startNextSeason(g);
      ui.replay = null;
      autosave();
      go('home');
      return;
    case 'retire':
      confirmModal({ title: '정말 은퇴할까요?', body: '되돌릴 수 없어요.', confirm: '은퇴하기', act: 'retire-ok', tone: 'danger' });
      return;
    case 'retire-ok':
      if (!g) return;
      retire(g);
      autosave();
      go('retired');
      return;
    case 'save': {
      if (!g) return;
      const ok = saveGame(el.dataset.slot as SaveSlot, g);
      showToast(ok ? '저장했어요' : '저장하지 못했어요 (브라우저 저장소를 쓸 수 없음)');
      return;
    }
    case 'load': {
      try {
        const loaded = loadGame(el.dataset.slot as SaveSlot);
        if (!loaded) return;
        refreshUnlocks(loaded);
        ui.game = loaded;
        ui.replay = null;
        autosave();
        go(loaded.phase === 'retired' ? 'retired' : 'home');
      } catch (e) {
        showToast((e as Error).message);
      }
      return;
    }
    case 'delete':
      confirmModal({ title: '이 슬롯을 지울까요?', body: '지운 세이브는 되살릴 수 없어요.', confirm: '지우기', act: 'delete-ok', data: { slot: el.dataset.slot! }, tone: 'danger' });
      return;
    case 'delete-ok':
      deleteSave(el.dataset.slot as SaveSlot);
      ui.modal = null;
      render();
      return;
  }
});

render();
