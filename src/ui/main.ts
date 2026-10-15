// 웹 UI (B.7, U단계 H.6): 모바일 세로 단일 컬럼, 프레임워크 없이 문자열 렌더링 + 이벤트 위임.
// 화면은 src/ui/views/ 모듈이 뷰모델(src/ui/viewModels.ts)만 받아 그리고, 이 파일은 상태와 동작만 맡는다 (부록 H.2)

import './design/tokens.css';
import './design/bundle.css';
import './style.css';

import type { FieldAttribute } from '../attributes';
import type { Difficulty } from '../config/balance';
import { newGame, playRound, retire, startNextSeason, type GameState } from '../game';
import { autoAllocate, raiseAttribute } from '../growth';
import { positionOvrExact, type PlayablePosition } from '../positions';
import { teamById } from '../league';
import { deleteSave, listSaves, loadGame, SAVE_SLOTS, saveGame, type SaveSlot } from '../save';
import type { PlayerState } from '../types';
import { BADGE_NAMES_KO } from '../badges';
import { Button, Modal, Toast, type ToastProps } from './components';
import {
  allocateVM, homeVM, positionOptionsVM, matchResultVM, newGameVM, playerVM, replayStaticVM, retiredVM, savesVM, seasonLabel, seasonVM, versionVM, worldVM,
} from './viewModels';
import { drawAvgMap } from './views/avgMap';
import { navBar } from './views/common';
import { homeView, positionChangeSection, positionSheet } from './views/home';
import { proficiencyOf, requestPositionChange } from '../proficiency';
import { matchResultView } from './views/matchResult';
import { playerView } from './views/player';
import { ReplayPlayer, replayView } from './views/replay';
import { allocateView, newGameView, retiredView, savesView, seasonView, titleView, worldView } from './views/screens';

type Screen = 'title' | 'new' | 'home' | 'match' | 'replay' | 'allocate' | 'player' | 'world' | 'season' | 'saves' | 'retired';

interface ModalState { title: string; body?: string; confirm: string; act: string; data?: Record<string, string>; tone?: 'info' | 'warning' | 'danger' }

const ui = {
  screen: 'title' as Screen,
  game: null as GameState | null,
  toast: null as ToastProps | null,
  modal: null as ModalState | null,
  /** 시즌 자동 진행 중 */
  busy: false,
  /** 방금 치른 내 경기 재생 (E5-lite). 세이브에 담지 않는다 */
  replay: null as ReplayPlayer | null,
  /** 포인트 찍기 (디자인 50): 들어올 때 상태를 기억했다가 [−]·[초기화]는 그 상태에서 남은 배분을 다시 적용한다 */
  alloc: null as null | { snap: PlayerState; raises: FieldAttribute[]; startExact: number; back: Screen; coach: boolean; open: Set<string> },
  worldTab: 'table' as 'table' | 'stars',
  /** 주 포지션 변경 요청 시트 (D.3): 고른 포지션 */
  posSheet: null as string | null,
  form: { mode: 'prospect' as 'prospect' | 'real', name: '', position: 'ST' as PlayablePosition, seed: '', difficulty: 'normal' as Difficulty, realId: '' },
};

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
  if (b.length) showToast({ kind: 'badge', title: `레전드 배지 · ${BADGE_NAMES_KO[b[0]!.id]}`, body: '위상이 100점 올랐어요.' }, 3500);
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
    case 'new': return newGameView(newGameVM(ui.form));
    case 'saves': return savesView(savesVM(listSaves(), SAVE_SLOTS), !!g && g.phase !== 'retired', versionVM(g));
    default: break;
  }
  if (!g) return titleScreen();
  if (g.phase === 'retired' && !['retired', 'season', 'saves', 'player'].includes(ui.screen)) return retiredView(retiredVM(g));
  switch (ui.screen) {
    case 'home': {
      const pos = g.phase === 'offseason' ? positionChangeSection(g.player.position, Math.floor(proficiencyOf(g.player, g.player.position))) : '';
      const sheet = ui.posSheet && g.phase === 'offseason' ? positionSheet(positionOptionsVM(g), ui.posSheet) : '';
      return homeView(homeVM(g), pos) + sheet;
    }
    case 'player': return playerView(playerVM(g));
    case 'world': return worldView(worldVM(g), ui.worldTab);
    case 'replay':
      if (ui.replay) return replayView(ui.replay.vm(replayStaticVM(ui.replay.replay, g)));
      break;
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
    default: break;
  }
  const vm = matchResultVM(g, ui.replay?.replay ?? null);
  return vm ? matchResultView(vm) : homeView(homeVM(g));
}

function render(): void {
  const g = ui.game;
  const nav = g && NAV_SCREENS.includes(ui.screen) && !(g.phase === 'retired') ? navBar(ui.screen) : '';
  const m = ui.modal;
  const modal = m
    ? Modal({
      title: m.title, ...(m.body ? { children: m.body } : {}), icon: m.tone === 'danger' ? 'danger' : 'info', tone: m.tone ?? 'info', onClose: { act: 'modal-close' },
      actions: [
        Button({ variant: 'secondary', block: true, act: 'modal-close', children: '취소' }),
        Button({ variant: m.tone === 'danger' ? 'danger' : 'primary', block: true, act: m.act, ...(m.data ? { data: m.data } : {}), children: m.confirm }),
      ],
    })
    : '';
  const toast = ui.toast ? `<div class="toast-wrap">${Toast(ui.toast)}</div>` : '';
  app.className = nav ? 'has-nav' : '';
  app.innerHTML = `<main class="screen screen-${ui.screen}">${screenHtml()}</main>${nav}${modal}${toast}`;
  if (ui.screen === 'replay' && ui.replay) ui.replay.attach();
  else ui.replay?.stop();
  if (ui.screen === 'match' && ui.replay) drawAvgMap(ui.replay.replay);
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
  const next = () => {
    if (g.phase !== 'season') {
      ui.busy = false;
      ui.toast = null;
      autosave();
      go('season');
      badgeToast(g);
      return;
    }
    playRound(g);
    autoAllocate(g.player);
    ui.toast = { kind: 'info', title: '자동 진행 중', body: `${g.league.round}/${g.league.schedule.length}라운드` };
    render();
    setTimeout(next, 0);
  };
  ui.toast = { kind: 'info', title: '자동 진행 중' };
  render();
  setTimeout(next, 0);
}

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  // 겹침 바깥만 누르면 닫는다 (모달·시트 안쪽 클릭은 무시)
  if (el.dataset.overlay && ev.target !== el) return;
  const act = el.dataset.act!;
  const g = ui.game;
  const v = el.dataset.v;

  switch (act) {
    case 'pos-open':
      if (!g) return;
      ui.posSheet = g.player.position;
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
      if (requestPositionChange(g.player, v as PlayablePosition, g.phase === 'offseason')) {
        autosave();
        ui.posSheet = null;
        showToast({ kind: 'info', title: `주 포지션 ${from} → ${v}`, body: '다음 시즌부터 새 포지션으로 뛰어요.' }, 2600);
      }
      return;
    }
    case 'modal-close':
      ui.modal = null;
      render();
      return;
    case 'go':
    case 'go-tab': {
      if (ui.screen === 'new') readFormInputs();
      const to = (act === 'go-tab' ? v : el.dataset.to) as Screen;
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
      } catch (e) {
        showToast((e as Error).message);
        return;
      }
      go(ui.game?.phase === 'retired' ? 'retired' : 'home');
      return;
    }
    case 'form': {
      readFormInputs();
      const k = el.dataset.k as 'mode' | 'position' | 'difficulty' | 'realId';
      (ui.form as Record<string, string>)[k] = v!;
      render();
      return;
    }
    case 'start': {
      readFormInputs();
      const f = ui.form;
      if (f.mode === 'real' && !f.realId) return;
      ui.game = f.mode === 'prospect'
        ? newGame({ mode: 'prospect', name: f.name, position: f.position, seed: f.seed, difficulty: f.difficulty })
        : newGame({ mode: 'real', playerId: f.realId, seed: f.seed, difficulty: f.difficulty });
      ui.replay = null;
      autosave();
      go('home');
      showToast({ kind: 'info', title: `${ui.game.player.name} · ${teamById(ui.game.league, ui.game.player.teamId).nameKo}`, body: '커리어를 시작했어요.' });
      return;
    }
    case 'play': {
      if (!g || g.phase !== 'season' || ui.busy) return;
      ui.replay = null;
      const report = playRound(g, { onReplay: (r) => { ui.replay = new ReplayPlayer(r, () => render()); } });
      autosave();
      go(ui.replay ? 'replay' : 'match');
      if (g.phase !== 'season') badgeToast(g);
      if (report.levelsGained > 0) showToast({ kind: 'levelup', title: `레벨 업! Lv.${g.player.level}`, body: `능력치 포인트 ${g.player.unspentPoints}개를 쓸 수 있어요.` }, 3000);
      return;
    }
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
