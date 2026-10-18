// 웹 UI (B.7, U단계 H.6): 모바일 세로 단일 컬럼, 프레임워크 없이 문자열 렌더링 + 이벤트 위임.
// 화면은 src/ui/views/ 모듈이 뷰모델(src/ui/viewModels.ts)만 받아 그리고, 이 파일은 상태와 동작만 맡는다 (부록 H.2)

import { bodySection, tagsSheet } from './views/body';
import { buyWeakFoot, choosePreset, matchCompLabel, myShirt, nextFixture, recommendPreset, setPresetAuto } from '../game';
import { COMP_NAMES_KO, type CompId } from '../cups';
import { budgetOf, customAct, customSpec, customVM, initialCustomForm } from './customVM';
import { autoCustom } from '../custom';
import { HL } from '../highlights';
import './design/tokens.css';
import './design/bundle.css';
import './design/skin-b.css';
import './style.css';
import { applySkin, isLandPhone, isWide, LANDPHONE_QUERY, setSkin, WIDE_QUERY } from './skin';

import type { FieldAttribute } from '../attributes';
import type { Difficulty } from '../config/balance';
import {
  acceptMyOffer, applyOther, campDay, canChangePosition, endDay, isVacationDay, setDayTraining, trainingLine, isMatchDay, myMatchPosition, newGame, otherJob, playOthers, randomSeed, playRound, retire, roundMatch,
  startNextSeason, todaysOthers, type GameState,
} from '../game';
import { addDays, dateLabel, daysBetween } from '../calendar';
import { addCustomPreset, deleteCustomPreset, updateCustomPreset, type TrainingKind, type TrainingState } from '../training';
import { gaugeSection, presetEditSheet, presetSection, todayRow, trainingSection, trainingSheet, weekPreview } from './views/training';
import { playNpcMatch } from '../engine/npcMatch';
import { EnginePool } from './enginePool';
import { adviceTakenText, checkAdviceTaken, rollProspect } from '../aptitude';
import { MyMatchRun, playMyMatch, type MyMatchOutput } from '../engine/adapter';
import type { Moment, StopLevel } from '../engine/moments';
import { replayPlayers } from '../replay';
import { deckHomeSection, deckUnusable, deckView, deckVM, myRoleId } from './views/deck';
import { canAdd, deckProblems, takePick } from '../cardCollection';
import { cardById } from '../config/cards';
import { MomentPitch, momentView, OutcomePitch, outcomeView, shownOptions, type OutcomeVM } from './views/moment';
import { decisionOutcome, OUTCOME, outcomeBand } from '../decisionOutcome';
import { ratingFromParts, ratingParts } from '../engine/rating';
import { autoAllocate, raiseAttribute } from '../growth';
import { positionOvrExact, type PlayablePosition } from '../positions';
import { teamById } from '../league';
import {
  copyReplays, deleteSave, exportFileName, initSaves, listSaves, loadGame, loadReplays, packReplayBytes, REPLAY_KEEP, SAVE_SLOTS, saveGame,
  saveReplays, unpackReplayBytes, type SaveSlot, type StoredReplay,
} from '../save';
import type { Replay } from '../replay';
import type { PlayerState } from '../types';
import { BADGE_NAMES_KO } from '../badges';
import { BALANCE } from '../config/balance';
import type { Appearance } from '../appearance';
import {
  checklistItems, FIRST_MATCH_LINES, isUnlocked, markDone, pendingIntro, refreshUnlocks, resetTips, tipFor, type FeatureId, type TipId,
} from '../unlocks';
import { checklistPanel, firstMatchOverlay, guideResetLink, tipBubble } from './views/guide';
import { Banner, Button, esc, HERO_NAME, HeroPanel, Icon, Modal, SectionTitle, Tabs, Toast, type ToastProps } from './components';
import {
  adviceCardVM, allocateVM, autoSheetVM, cupsWorldVM, homeVM, visiblePoints as homePoints, myFace, positionOptionsVM, matchResultVM, newGameVM, playerVM, replayStaticVM, retiredVM, savesVM, seasonLabel, seasonVM, versionVM, worldVM,
} from './viewModels';
import { drawAvgMap } from './views/avgMap';
import { dock, dockMoreSheet, panel, pitchViewSheet, roJosa, type DockVM } from './views/common';
import { autoLayerHtml, autoResultsHtml, autoSheet, type AutoResultLine } from './views/progress';
import { setPitchFaceResolver, setPitchKitClashResolver, setPitchNameResolver, setPitchNames, setPitchOrient, setPitchPixelResolver, setPitchSize, setPitchTeams, setPitchView } from './pitch/renderer';
import { alertCard, homeView, positionChangeSection, positionSheet, scheduleView } from './views/home';
import { goalsSection, homeInboxSection, inboxDetailView, inboxView, rivalSection } from './views/inbox';
import { collectNotices, goalsCardVM, homeInboxVM, inboxDetailVM, inboxVM, rivalCardVM } from './inboxVM';
import { markAllRead, markRead, unreadCount } from '../inbox';
import { answerEvent } from '../events';
import { competitionSection, meetingView } from './views/manager';
import { competitionVM, meetingVM } from './managerVM';
import { holdMeeting, type MeetingChoice } from '../manager';
import { prepView } from './views/prep';
import { prepVM } from './prepVM';
import { proficiencyOf, requestPositionChange } from '../proficiency';
import { matchResultView } from './views/matchResult';
import { playerView, type PlayerTab } from './views/player';
import { ReplayPlayer, replayView } from './views/replay';
import { allocateView, NEW_GAME_UI, newGameView, retiredView, type NewGameUI, savesView, seasonView, titleView, worldView, cupsSection, type SeasonTab, type SeasonTodo } from './views/screens';
import { tacticsView } from './views/tactics';
import { contractView, marketCard, newsSection, offersView, tagNewsSection } from './views/transfer';
import { marketVM, newsVM } from './transferVM';
import { cropStyle, foRangeText, lookupEntry, myLookVM, SET_UI_DEFAULT, settingsView, type FaceOnUI, type NameUI, type PixelUI, type SetPage, type SetSec, type SetUI } from './views/settings';
import { CARD_ART_UI_DEFAULT, caRangeText, type CardArtUI, type CardKindFilter } from './views/cardArtSettings';
import { clearCardArt, exportSaveFile, importSaveFile, initCardArt, normalizeArt, setCardArt, setCardArtPos, userArtBlob, cardArtPos } from './cardArt';
import { artStyle } from './components/gameCard';
import { emptyOverrides, kitClash, setKitOverride, setPersonOverride } from '../pixel';
import { pitchLabel } from './playerNames';
import { setNameOverride } from '../names';
import { clearFaceOn, setFaceOnCutout, faceSrc, pixelSrc, type FaceRef, squareToBlob, exportFacepack, importFacepack, initFaces, loadImage, setFaceOn, setPlayerNames, type FaceSlot } from './faces';
import { homeKitOf, matchKitsOf, playerIcon } from './pixelIcons';
import { declineOffer, declineOffers, marketPending, renewContract, requestTransfer, requestEligibility, releaseChance } from '../transfer';
import { presetEditVM, replayIndex, tacticsVM, trainingOptionsVM, type TacticsDraftUI } from './viewModels';
import { customized, defaultSlot, moveSlot, slotPos, startCustom, withFormation, withTendency, type MyTactics } from '../myTactics';
import { nearestCell } from '../formations';
import { OUTSIDE_CLUBS } from '../../data/outsideClubs';

/** 유스 구단 이름: 리그 팀 > 리그 밖 구단 > 실제 선수 데이터의 한글 이름 그대로(예 '함부르크', C.55: teamById 가 던져 선수 화면이 안 열리던 것) */
function youthClubName(g: GameState, club: string): string {
  return g.league.teams.find((t) => t.id === club)?.nameKo ?? OUTSIDE_CLUBS.find((c) => c.id === club)?.nameKo ?? club;
}
import { tendencyLevels, TENDENCY_NAMES_KO, type Detail, type Level } from '../engine/tactics';
import type { Formation } from '../formations';
import type { Tendency } from '../engine/types';
import { proficientOvr } from '../proficiency';
import { hasTeamDetail, personDetailVM, teamDetailVM, type PersonTab, type TeamTab } from './detailVM';
import { personDetailView, teamDetailView } from './views/detail';
import type { FieldPosition } from '../positions';

type Screen = 'title' | 'new' | 'home' | 'match' | 'moment' | 'replay' | 'allocate' | 'player' | 'world' | 'season' | 'saves' | 'retired' | 'tactics' | 'deck' | 'offers' | 'contract' | 'settings' | 'schedule' | 'prep' | 'team' | 'person' | 'meeting' | 'inbox';

interface ModalState {
  title: string; body?: string; rows?: [string, string][]; confirm: string; act: string; data?: Record<string, string>; tone?: 'info' | 'warning' | 'danger';
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
  alloc: null as null | { snap: PlayerState; raises: FieldAttribute[]; startExact: number; back: Screen; coach: boolean; sel: string | null },
  /** 덱 화면 카드 상세 시트 (C.39) */
  cardSheet: null as null | { id: string; from: 'deck' | 'pool' },
  worldTab: 'table' as 'table' | 'stars' | 'scorers' | 'transfers' | 'cups',
  /** 리그 스타 묶음 · 리그 기록 거르기 (C.64) */
  starGroup: 'league' as 'league' | 'world' | 'young',
  worldBoard: 'goals' as 'goals' | 'assists' | 'rating',
  /** 재계약 화면에서 고른 연수 (C.42) */
  renewYears: null as number | null,
  /** 주 포지션 변경 요청 시트 (D.3): 고른 포지션 */
  posSheet: null as string | null,
  /** 하루 훈련 고르기 시트 (C.41): 날짜 */
  trainSheet: null as string | null,
  /** 하루 훈련 시트에서 고른 줄 (확정 전, C.57) */
  trainPick: null as string | null,
  /** 훈련·일정 화면 탭 (C.52) */
  trainTab: 'pre' as 'pre' | 'cal' | 'g',
  /** 커스텀 프리셋 편집 시트 (C.52): id null = 새로 만들기 */
  presetSheet: null as null | { id: string | null },
  /** 내 최근 5경기 리플레이 (25.4 2번, C.41): 자동 저장 슬롯과 같이 저장한다. dirty 면 다음 자동 저장 때 쓴다 */
  recent: [] as StoredReplay[],
  recentDirty: false,
  /** 다시 보기 중이면 끝났을 때 돌아갈 화면 (경기 중 잠금 아님): 지난 경기 = 선수, 방금 경기 하이라이트 = 결과 (C.50) */
  rewatch: false as false | 'player' | 'match',
  /** 전술 화면 편집 중인 전술 (저장 전). 들어올 때 저장한 전술을 복사한다 (I.16) */
  tac: null as TacticsDraftUI | null,
  /** 다른 팀·선수 상세 (C.53): 보고 있는 팀·선수, 탭, 뒤로 가기 쌓임 (상세 화면끼리 오가면 쌓이고 다른 화면으로 가면 비운다) */
  detail: { team: '', person: '', teamTab: 'overview' as TeamTab, personTab: 'attrs' as PersonTab, stack: [] as { screen: Screen; team: string; person: string; teamTab: TeamTab; personTab: PersonTab }[] },
  /** 전술 화면에서 돌아갈 곳 (C.51: 경기 준비에서 열면 경기 준비로) */
  tacBack: 'home' as Screen,
  /** 직접 모드로 진행 중인 내 경기 (E.11, E4): 결정 순간마다 멈춘다. 세이브에 담지 않는다 (도중에 나가면 경기 전 상태) */
  live: null as null | {
    run: MyMatchRun; teams: [string, string]; sel: number | null; pitch: MomentPitch | null; prevE: number;
    /** 고른 패 카드 (C.36) */
    card: number | null;
    /** 결정 결과 재생 중 (E5 최소, 부록 C.35): 결과 구간 → 결과 띠 → 다음 장면 */
    oc: null | { vm: OutcomeVM; pitch: OutcomePitch; next: Moment | null; timer: number };
  },
  /** 설정 화면 페이스온 (C.43) */
  fo: { tab: 'players', q: '', sel: null, crop: null } as FaceOnUI,
  /** 설정 화면 카드 이미지 (C.48) */
  ca: { ...CARD_ART_UI_DEFAULT } as CardArtUI,
  /** 세이브 내보내기 "카드 이미지 포함" (C.48, 기본 끔) */
  exportCards: false,
  /** 경기 화면 보기 시트 (C.43) */
  pvSheet: false,
  /** 자동 진행 범위 시트 (C.44): 열림, 고른 경기 수 */
  autoSheet: false,
  autoCount: 5,
  /** 독 더보기 시트 (모바일) */
  moreSheet: false,
  /** 이적 제안 화면 펼친 제안 (C.60, 디자인 97) · 월드·결과 "더 보기" 펼침 (C.60) · 카드 획득 고른 칸 (디자인 85) */
  offerSel: 0,
  /** 감독 면담 고른 선택지 (C.62) */
  meetSel: null as string | null,
  /** 인박스 (C.63): 탭, 연 알림 id, 고른 선택지 */
  inboxTab: 'all' as 'all' | 'todo' | 'info',
  inboxSel: null as number | null,
  inboxPick: null as string | null,
  more: {} as Record<string, boolean>,
  pickSel: 1,
  /** 시즌 종료 화면 상세 보기 탭 (C.44). null = 요약 카드만 */
  seasonTab: null as SeasonTab | null,
  /** 설정 → 선수 이름 (C.44a) */
  nm: { q: '', team: '', sel: null } as NameUI,
  /** 설정 → 경기 아이콘 (C.45) */
  px: { tab: 'players', q: '', team: '', sel: null, kitSel: null } as PixelUI,
  /** 설정 화면 (C.59): 보고 있는 하위 화면, 펼친 섹션 */
  set: { ...SET_UI_DEFAULT } as SetUI,
  /** 설정 화면에서 돌아갈 화면 */
  settingsBack: 'home' as Screen,
  /** 선수 화면 태그 전체 시트 (C.47 → C.58 디자인 135) */
  tagsAll: false,
  /** 선수 화면 탭 (C.58 디자인 93~96·134·136), 몸·태그 탭 이름표 편집 펼침 */
  playerTab: 'attrs' as PlayerTab,
  lookName: false,
  /** 새 게임 화면 상태 (C.58): 실제 선수 묶음·검색·정렬·포지션군·보이는 수, 랜덤 능력치 펼침, 커스텀 단계 */
  ng: { ...NEW_GAME_UI } as NewGameUI,
  /** 포인트 찍기 규칙 펼침 (C.58) */
  allocRule: false,
  /** 덱 화면에서 편집 중인 덱 세트 (C.36) */
  deckSet: null as number | null,
  /** 덱 화면에서 돌아갈 곳 (C.51) */
  deckBack: 'home' as 'home' | 'prep',
  form: {
    mode: 'prospect' as 'prospect' | 'real' | 'custom', name: '', position: 'ST' as PlayablePosition, seed: '', difficulty: 'normal' as Difficulty, realId: '',
    /** 레전드 팩 (C.47) */
    legends: 'off' as 'on' | 'off',
    /** 시드를 비웠을 때 쓰는 무작위 시드 (가상 유망주 시작 후보를 미리 보여 주려고 화면에 들어올 때 정한다, C.37) */
    roll: '',
    /** 시작 후보를 정한 시드 (바뀌면 고른 자리를 후보 1위로 되돌린다) */
    posFor: '',
    /** "다른 포지션에서 고르기" 펼침 */
    others: false,
    /** 커스텀 생성 (C.45) */
    cu: initialCustomForm(),
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
/** 새 기능 소개를 띄우는 화면 */
const NAV_SCREENS: Screen[] = ['home', 'player', 'world'];
/** 하단 독을 숨기는 화면 (C.44: 게임 중 모든 화면에 고정) */
const NAV_HIDDEN: Screen[] = ['title', 'new', 'retired'];

/** 진행 중인 경기 화면 (C.39): 직접 모드 경기가 결정 순간에 멈춰 있으면 결정 화면, 경기 재생 중이면 재생 화면 */
function liveScreen(): Screen | null {
  if (ui.live) return 'moment';
  if (ui.replay && !ui.replay.ended && !ui.replay.isClip && !ui.rewatch) return 'replay';
  return null;
}

/**
 * 경기 중 잠그는 동작 (C.39): 다른 화면은 보기만. 직접 모드 경기는 아직 상태에 반영되지 않았으므로
 * 경기 시작·날 넘기기·포인트·전술·덱·포지션·세이브를 바꾸면 경기 결과가 달라진다
 */
const LOCK_ACTS = new Set([
  'buy-weakfoot', 'play', 'day-one', 'day-continue', 'sim-rest', 'auto-run', 'auto-until', 'raise', 'lower', 'auto-alloc', 'alloc-reset', 'alloc-done', 'tac-save',
  'deck-add', 'deck-remove', 'deck-use', 'pick-take', 'pos-change', 'next-season', 'retire', 'retire-ok', 'save', 'load', 'delete-ok',
  'start', 'continue', 'opt-quick', 'ctl-mode', 'ctl-stop', 'train-set', 'train-focus', 'preset-pick', 'preset-apply', 'preset-auto', 'preset-save', 'preset-del', 'export', 'import',
  'offer-accept', 'offer-accept-ok', 'offer-decline', 'offers-decline', 'renew', 'transfer-request', 'transfer-request-ok',
  'ca-upload', 'ca-adjust', 'ca-clear', 'ca-crop-save',
]);

/**
 * 자동 저장 (25.4 3번, 하루 진행 후마다): IndexedDB 쓰기는 비동기라 한 번에 하나만. 쓰는 중에 또 부르면 끝난 뒤 최신 상태로 한 번 더.
 * 리플레이는 바뀌었을 때만 같이 쓴다
 */
let saving: Promise<void> | null = null;
let saveAgain = false;
function autosave(): Promise<void> {
  if (!ui.game) return Promise.resolve();
  if (saving) {
    saveAgain = true;
    return saving;
  }
  saving = (async () => {
    do {
      saveAgain = false;
      const g = ui.game;
      if (!g) break;
      const t0 = performance.now();
      await saveGame('auto', g);
      if (ui.recentDirty) {
        ui.recentDirty = false;
        await saveReplays('auto', ui.recent);
      }
      saveLog.push(Math.round(performance.now() - t0));
    } while (saveAgain);
  })().finally(() => { saving = null; });
  return saving;
}
/** 저장 시간 측정 (부록 C.41) */
const saveLog: number[] = [];
(globalThis as unknown as { __saveLog: number[] }).__saveLog = saveLog;
/** 캡처 스크립트용 (부록 C.42 캡처): 지금 게임 상태 */
(globalThis as unknown as { __game: () => GameState | null }).__game = () => ui.game;

/** 방금 치른 내 경기 리플레이를 최근 5경기에 넣는다 */
async function keepReplay(g: GameState, r: Replay, rep: { season: number; round: number; opponentId: string; result: { goalsFor: number; goalsAgainst: number }; cup?: { comp: CompId; stage: string } }): Promise<void> {
  const { season, round } = rep;
  const label = `${rep.cup ? `${COMP_NAMES_KO[rep.cup.comp]} ${rep.cup.stage}` : `${round}R`} ${teamById(g.league, rep.opponentId)?.nameKo ?? ''} ${rep.result.goalsFor}-${rep.result.goalsAgainst}`;
  const data = await packReplayBytes(r);
  ui.recent = [...ui.recent.filter((x) => !(x.season === season && x.round === round)), { season, round, label, data }].slice(-REPLAY_KEEP);
  ui.recentDirty = true;
  syncReplayIndex();
  void autosave();
}

function syncReplayIndex(): void {
  replayIndex.clear();
  for (const x of ui.recent) replayIndex.add(`${x.season}:${x.round}`);
}

function go(screen: Screen): void {
  if (screen !== 'team' && screen !== 'person') ui.detail.stack = [];
  // "더 보기" 펼침·고른 제안 (C.60)은 다른 화면으로 가면 처음으로. 팀·선수 상세를 다녀올 때는 그대로
  const detail = (x: Screen) => x === 'team' || x === 'person';
  if (screen !== ui.screen && !detail(screen) && !detail(ui.screen)) { ui.more = {}; ui.offerSel = 0; ui.pickSel = 1; ui.meetSel = null; if (screen !== 'inbox') ui.inboxSel = null; }
  if (screen === 'inbox' && ui.screen === 'inbox') ui.inboxSel = null;
  ui.screen = screen;
  ui.modal = null;
  render();
  window.scrollTo(0, 0);
}

let toastTimer = 0;
function showToast(t: ToastProps | string, ms = 1600): void {
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
  if (b.length) showToast({ kind: 'badge', title: `레전드 배지 · ${BADGE_NAMES_KO[b[0]!.id]}`, body: `위상이 ${BALANCE.badges.reputation}점 올랐어요.` }, 2600);
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
      return newGameView(newGameVM({ ...ui.form, seed: ui.form.seed, roll: prospectSeed() }), ui.form.mode === 'custom' ? customVM(ui.form.cu, ui.form.name) : undefined, ui.ng);
    case 'saves': return savesView(savesVM(listSaves(), SAVE_SLOTS), !!g && g.phase !== 'retired', versionVM(g), ui.exportCards);
    case 'settings': return settingsView(g, ui.fo, versionVM(g), ui.nm, ui.px, ui.ca, !!liveScreen(), ui.set);
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
      collectNotices(g);
      const list = g.player.history.length === 0 ? checklistItems(g.guide) : null;
      const deck = g.cards ? deckHomeSection({ active: g.cards.active, count: g.cards.decks[g.cards.active]?.length ?? 0, unusable: deckUnusable(g, myRoleId(g)), picks: g.cards.picks.length }) : '';
      const hvm = homeVM(g);
      // C.57 (디자인 133): 닫을 수 있는 알림(태그·구단 거절 소식·포변 조언)이 둘 이상이면 위에 "알림 n · 모두 닫기"
      const mvm = marketVM(g);
      // 감독 면담 (C.62): 열린 면담 띠(닫기 없음). 알림(태그·포변 조언·면담 결과·이적 소식)은 인박스로 (C.63, 홈에는 안 읽은 것 3개)
      const comp = competitionVM(g);
      const meetBand = comp?.meeting ? Banner({ tone: 'info', title: '감독이 면담하자고 해요', children: comp.hint, action: '면담하기', onAction: { act: 'go', data: { to: 'meeting' } } }) : '';
      const hin = homeInboxVM(g);
      const rv = rivalCardVM(g);
      const gl = goalsCardVM(g);
      return homeView(hvm, deck + (list ? checklistPanel(list) : '') + pos, (gl ? goalsSection(gl) : '') + (comp ? competitionSection(comp) : '') + (rv ? rivalSection(rv) : ''), hvm.training ? todayRow(hvm.training) : '', meetBand + marketCard(mvm) + homeInboxSection(hin.rows, hin.unread), unreadCount(g)) + guideResetLink() + sheet;
    }
    case 'schedule': {
      const hvm = homeVM(g);
      const tOpts = ui.trainSheet ? trainingOptionsVM(g, ui.trainSheet) : null;
      const tv = hvm.training;
      // 훈련·일정 탭 (C.52, 디자인 159): 훈련 프리셋 · 일정 · 게이지
      const tab = tv ? ui.trainTab : 'cal';
      const tabs = tv ? Tabs({ items: [{ id: 'pre', label: '훈련 프리셋' }, { id: 'cal', label: '일정' }, { id: 'g', label: '게이지' }], value: tab, variant: 'underline', fill: true, act: 'train-tab', label: '훈련·일정' }) : '';
      const body = !tv ? '' : tab === 'pre' ? presetSection(tv.presets) + weekPreview(tv) : tab === 'g' ? gaugeSection(tv) : trainingSection(tv, false);
      const pSheet = tv && ui.presetSheet ? presetEditSheet(presetEditVM(g, ui.presetSheet.id)) : '';
      return scheduleView(hvm, tabs + body, tab === 'cal') + (tOpts ? trainingSheet({ ...tOpts, weakFoot: weakFootLine(g) }, ui.trainSheet!, ui.trainPick) : '') + pSheet;
    }
    case 'deck': {
      const vm = deckVM(g, ui.deckSet ?? g.cards.active, myRoleId(g));
      const cs = ui.cardSheet;
      const c = cs ? (cs.from === 'deck' ? vm.deck : vm.pool).find((x) => x.id === cs.id) : undefined;
      return deckView(vm, cs && c ? { from: cs.from, card: c } : null, ui.deckBack, { sel: ui.pickSel, later: !!ui.more.pickLater });
    }
    case 'player': {
      const p = g.player;
      const youth = p.youth ? youthClubName(g, p.youth.club) : '';
      const body = bodySection(p, g.phase !== 'retired' && p.body.weakFoot < 5 && p.unspentPoints >= BALANCE.weakFoot.pointCost, myShirt(g), youth, myLookVM(g, ui.lookName),
        p.youth && g.league.teams.some((t) => t.id === p.youth!.club) ? p.youth.club : '');
      return playerView(playerVM(g), { tab: ui.playerTab, body, market: g.phase !== 'retired' ? marketVM(g) : null, points: p.unspentPoints, retired: g.phase === 'retired' })
        + (ui.tagsAll ? tagsSheet(p, p.name, youth) : '');
    }
    case 'world': return worldView(worldVM(g), ui.worldTab, ui.worldTab === 'transfers' ? newsSection(newsVM(g), ui.more) + tagNewsSection((g.tagNews ?? []).slice().reverse().map((n) => ({ season: seasonLabel(n.season), name: n.name, team: teamById(g.league, n.teamId).nameKo, tag: n.tag })), ui.more) : '', ui.more, ui.starGroup, ui.worldBoard, ui.worldTab === 'cups' ? cupsSection(cupsWorldVM(g)) : '');
    case 'offers': return offersView(marketVM(g), ui.offerSel);
    case 'inbox': {
      collectNotices(g);
      const dv = ui.inboxSel !== null ? inboxDetailVM(g, ui.inboxSel) : null;
      return dv ? inboxDetailView(dv, ui.inboxPick) : inboxView(inboxVM(g, ui.inboxTab));
    }
    case 'meeting': {
      const mv = meetingVM(g);
      if (!mv) { ui.screen = 'home'; return screenHtml(); }
      return meetingView(mv, ui.meetSel);
    }
    case 'contract': return contractView(marketVM(g), ui.renewYears);
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
        return allocateView(allocateVM(g, a.startExact, a.coach, a.snap.attributes, a.raises), a.sel, pending, ui.allocRule);
      }
      break;
    }
    case 'season': {
      const vm = seasonVM(g);
      if (vm) {
        // 디자인 106 (C.60): 응답이 필요하면 "다음 할 일" 줄 하나(답하기), 그 밖의 이적 알림(방금 옮긴 팀 등)은 그대로 카드
        const off = g.phase === 'offseason';
        const pend = off && marketPending(g);
        const mvm = off ? marketVM(g) : null;
        const todo: SeasonTodo | null = pend && mvm
          ? { title: mvm.renewal ? '계약 만료 · 응답 필요' : `이적 제안 ${mvm.offers?.length ?? 0}개 · 응답 필요`, sub: '답하기 전에는 다음 시즌으로 안 넘어가요', act: 'go', data: { to: mvm.offers?.length ? 'offers' : 'contract' }, cta: '답하기', warn: true, icon: 'chat' }
          : null;
        return seasonView(vm, mvm && !pend ? marketCard(mvm) : '', pend, ui.seasonTab, ui.seasonTab === 'transfers' ? newsSection(newsVM(g), ui.more) : '', todo);
      }
      break;
    }
    case 'retired': return retiredView(retiredVM(g));
    case 'tactics':
      if (ui.tac) return tacticsView(tacticsVM(g, ui.tac));
      break;
    case 'team': {
      const vm = teamDetailVM(g, ui.detail.team);
      if (vm) return teamDetailView(vm, ui.detail.teamTab, ui.detail.stack.length > 0);
      break;
    }
    case 'person': {
      const vm = personDetailVM(g, ui.detail.person);
      if (vm) return personDetailView(vm, ui.detail.personTab, ui.detail.stack.length > 0);
      return `${HeroPanel({ title: '선수', back: ui.detail.stack.length ? { act: 'detail-back' } : false, compact: true, pad: false, progress: false, value: '—' })}<div class="body"><p class="muted">이 선수는 지금 리그 팀에 없어요(리그 밖 이적·은퇴).</p></div>`;
    }
    case 'prep': {
      const vm = prepVM(g);
      if (vm && isMatchDay(g)) return prepView(vm);
      return homeView(homeVM(g));
    }
    default: break;
  }
  const vm = matchResultVM(g, ui.replay?.replay ?? null);
  return vm ? matchResultView(vm, ui.more) : homeView(homeVM(g));
}

/** 화면 → 첫 방문 말풍선 id */
const TIP_SCREENS: Partial<Record<Screen, TipId>> = {
  // schedule 은 말풍선 없음 (C.44)
  home: 'home', player: 'player', world: 'world', replay: 'replay', match: 'match', allocate: 'allocate', season: 'season', tactics: 'tactics',
};

/** 새 기능 안내 제목·바로 가기 (디자인 65) */
const INTRO_HEAD: Partial<Record<FeatureId, { title: string; cta: string }>> = {
  tactics: { title: '이제 팀 전술을 내가 정해요', cta: '전술 보기' },
  growth: { title: '포인트로 능력치를 올려요', cta: '찍으러 가기' },
};

/** 첫 플레이 안내 (21.4): 공개 소개 → 첫 경기 오버레이 → 말풍선 순으로 한 번에 하나만 */
function guideHtml(g: GameState | null): { modal: string; tip: string } {
  if (!g || ui.modal || g.phase === 'retired') return { modal: '', tip: '' };
  const intro = NAV_SCREENS.includes(ui.screen) ? pendingIntro(g.guide) : null;
  if (intro) {
    return {
      // 디자인 65: 아이콘 머리 + "새 기능" 꼬리표 + [나중에][바로 가기]
      modal: Modal({
        title: INTRO_HEAD[intro.id]?.title ?? intro.name, badge: '새 기능', children: intro.intro, icon: 'star', tone: 'info',
        actions: INTRO_HEAD[intro.id]
          ? [Button({ variant: 'secondary', block: true, act: 'intro-ok', data: { id: intro.id }, children: '나중에' }),
            Button({ block: true, act: 'intro-ok', data: { id: intro.id, go: intro.id }, children: INTRO_HEAD[intro.id]!.cta })]
          : [Button({ block: true, act: 'intro-ok', data: { id: intro.id }, children: '확인' })],
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

/**
 * 미페 머리말 긴 이름 (C.57, B-apply 2절): 그린 뒤 실제 폭으로 글자 크기를 줄인다(풀 50 · compact 36 → 최소 24px).
 * 최소에서도 넘치면 그때만 말줄임(CSS). 글꼴(PO Head)이 늦게 오면 받은 뒤 한 번 더
 */
function fitHeroNames(): void {
  for (const el of app.querySelectorAll<HTMLElement>('.po-hero__name[data-fit]')) {
    let size = Number(el.dataset.fit) || HERO_NAME.full;
    const apply = () => { el.style.fontSize = `${size}px`; el.style.lineHeight = `${Math.round(size * 1.08)}px`; };
    apply();
    while (size > HERO_NAME.min && el.scrollWidth > el.clientWidth + 0.5) {
      size--;
      apply();
    }
  }
}
void document.fonts?.ready.then(fitHeroNames);
// PC 2열 (C.61): 1024px 경계를 넘으면 배치가 바뀌는 화면이 있어 다시 그린다. 가로 폰(C.66)도 같은 2열이라 돌릴 때 다시 그린다
globalThis.matchMedia?.(WIDE_QUERY).addEventListener?.('change', () => render());
globalThis.matchMedia?.(LANDPHONE_QUERY).addEventListener?.('change', () => render());

/**
 * 세로 폰 안내 (C.66 사용자 지시 "모바일은 가로 전용"): 세로로 들면 CSS 가 #app 을 숨기고 이 안내 한 장만 보인다(입력도 막힘).
 * [전체 화면으로] = requestFullscreen 뒤 screen.orientation.lock('landscape') (안드로이드 크롬만 됨, 안 되면 조용히 무시 — 안내만)
 */
function mountRotateGate(): void {
  if (document.getElementById('rotate-gate')) return;
  document.body.insertAdjacentHTML('beforeend', `<div id="rotate-gate" class="rotate-gate" role="dialog" aria-label="가로로 돌려 주세요">
    <span class="rotate-gate__icon" aria-hidden="true">${Icon({ name: 'auto', size: 40, strokeWidth: 2.2 })}</span>
    <b class="rotate-gate__title">가로로 돌려 주세요</b>
    <p class="rotate-gate__desc">PLAYER ONE 은 폰을 가로로 눕혀서 해요</p>
    <button type="button" class="po-btn po-btn--primary po-btn--lg rotate-gate__btn" data-gate="fs">${Icon({ name: 'chevron-right', size: 18, strokeWidth: 2.4 })}<span>전체 화면으로</span></button>
  </div>`);
  document.querySelector('#rotate-gate [data-gate="fs"]')?.addEventListener('click', () => {
    void (async () => {
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        // 전체 화면이 안 되는 브라우저(iOS 사파리 등): 안내만
      }
      try {
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
      } catch {
        // 방향 잠금이 안 되는 브라우저: 직접 돌리면 된다
      }
    })();
  });
}

function render(): void {
  const g = ui.game;
  const nav = g && !NAV_HIDDEN.includes(ui.screen) && !(g.phase === 'retired') ? dock(dockVM(g)) : '';
  const live = liveScreen();
  const band = g && live && live !== ui.screen ? liveBand(live) : '';
  const m = ui.modal;
  const guide = guideHtml(g);
  const modal = m
    ? Modal({
      title: m.title, ...(m.body ? { children: m.body } : {}), ...(m.rows ? { rows: m.rows } : {}), icon: m.tone === 'danger' ? 'danger' : 'info', tone: m.tone ?? 'info', onClose: { act: 'modal-close' },
      actions: [
        Button({ variant: 'secondary', block: true, act: m.cancel?.act ?? 'modal-close', ...(m.cancel?.data ? { data: m.cancel.data } : {}), children: m.cancel?.label ?? '취소' }),
        Button({ variant: m.tone === 'danger' ? 'danger' : 'primary', block: true, act: m.act, ...(m.data ? { data: m.data } : {}), children: m.confirm }),
      ],
    })
    : guide.modal;
  const toast = ui.toast ? `<div class="toast-wrap">${Toast(ui.toast)}</div>` : '';
  // C.63c: 진행 중 띠(중단 단추가 있는 토스트)는 머리말을 덮지 않게 화면을 그만큼 내린다
  const bandToast = ui.toast?.onAction?.act === 'sim-stop';
  document.documentElement.classList.toggle('is-landphone', isLandPhone());
  app.className = `${nav ? 'has-nav ' : ''}${band ? 'match-lock ' : ''}${bandToast ? 'has-band-toast ' : ''}app-${ui.screen}`;
  const pv = (ui.pvSheet ? pitchViewSheet() : '')
    + (ui.autoSheet && g && g.phase === 'season' ? autoSheet(autoSheetVM(g), ui.autoCount) : '')
    + (ui.moreSheet && g && isWide() && !isLandPhone() ? dockMoreSheet(isUnlocked(g.guide, 'tactics')) : '');
  app.innerHTML = `${band}<main class="screen screen-${ui.screen}">${guide.tip}${screenHtml()}</main>${nav}${pv}${modal}${toast}`;
  fitHeroNames();
  bindDockMore();
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

/** 더보기 펼침 줄 (C.63c): 가로 스크롤 위치에 따라 처음·끝 흐림 */
function bindDockMore(): void {
  const el = document.querySelector<HTMLElement>('.dock-more__scroll');
  if (!el) return;
  const upd = () => {
    el.classList.toggle('at-start', el.scrollLeft <= 2);
    el.classList.toggle('at-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };
  el.addEventListener('scroll', upd, { passive: true });
  upd();
}

/** 독 진행 칸 (C.44): 경기 중이면 돌아가기, 경기 날이면 경기, 아니면 [계속], 비시즌이면 시즌 요약 */
function dockVM(g: GameState): DockVM {
  const live = liveScreen();
  let prog: DockVM['prog'];
  if (live) prog = { label: '경기 중', icon: 'match', act: 'live-return', live: true, kind: 'live' };
  else if (g.phase !== 'season') prog = { label: '시즌 요약', icon: 'trophy', act: 'go-tab', data: { v: 'season' }, kind: 'season' };
  else if (ui.busy) prog = { label: '진행 중', icon: 'clock', act: 'noop', kind: 'busy' };
  else if (marketPending(g)) {
    const n = (g.market?.offers?.length ?? 0) + (g.market?.renewal ? 1 : 0);
    prog = { label: '답하기', icon: 'chat', act: 'day-continue', kind: 'answer', ...(n ? { badge: n } : {}) };
  } else if (isMatchDay(g)) prog = { label: '경기', icon: 'match', act: 'play', kind: 'match' };
  else prog = { label: '계속', icon: 'chevron-right', act: 'day-continue', kind: 'continue' };
  return { screen: ui.screen, prog, tacticsOpen: isUnlocked(g.guide, 'tactics'), points: g.phase === 'retired' ? 0 : homePoints(g), more: ui.moreSheet, inbox: unreadCount(g) };
}

/** "경기 중 · 돌아가기" 띠 (C.39, C.54 디자인 60): 다른 화면 위에. 첫 줄 = 분·스코어, 둘째 줄 = 상태, 오른쪽 [경기로 돌아가기] */
function liveBand(to: Screen): string {
  const lv = ui.live;
  const m = lv?.run.pending ?? lv?.oc?.vm.moment;
  const head = lv && m ? `경기 중 · ${m.minute}' ${lv.teams[0]} ${m.score[0]}-${m.score[1]} ${lv.teams[1]}` : '경기 중';
  const sub = lv && m ? '결정 순간에서 멈췄어요' : to === 'replay' ? '경기 재생 중' : '';
  return `<button type="button" class="live-band" data-act="live-return"><span class="live-dot" aria-hidden="true"></span><span class="grow"><b>${esc(head)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><b class="live-back">경기로 돌아가기</b></button>`;
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
    setPitchTeams(lv.teams);
    // 카드 장면 시트 (5차 80): 쓸 수 있는 첫 카드를 미리 골라 둔다 (화면 상태만, [안 쓰고 계속]이면 카드 없이)
    const first = m.type === 'react' ? m.cards.find((c) => c.usable && c.option) : undefined;
    if (first) {
      lv.card = first.hand;
      lv.sel = m.options.length;
    }
    lv.pitch = new MomentPitch(lv.run.frames, players, m.side, m, fromE, lv.sel, shownOptions(m, lv.card));
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
/** 결과 구간 판정 종류: 카드 장면(C.40)은 상대 슈팅·상대 세트피스면 수비, 우리 공중볼이면 공격으로 본다 */
function outcomeType(m: Moment): 'onball' | 'duel' | 'setPiece' {
  return m.type === 'react' ? (m.scene.startsWith('opp') ? 'duel' : 'onball') : m.type;
}

function liveDecide(g: GameState, choice: number | 'delegate'): void {
  const lv = ui.live!;
  const m = lv.run.pending!;
  const s = lv.run.sim.state;
  const startIdx = lv.run.frames.length - 1;
  const ev0 = s.events.length;
  // 결정 직전 내 평점 (화면 표시만, 엔진 상태는 읽기만 한다)
  const meAgent = s.agents.find((x) => x.id === m.me);
  const before = meAgent ? ratingFromParts(ratingParts(s, meAgent, Math.max(1, s.elapsed))) : null;
  const shown = shownOptions(m, lv.card);
  const opt = choice === 'delegate' ? null : shown[choice] ?? null;
  // 카드 (C.36): 고른 카드와 함께. 플레이 카드 선택지는 opt 'card'
  const card = choice !== 'delegate' && lv.card !== null ? m.cards.find((c) => c.hand === lv.card) ?? null : null;
  const used = card && (card.role !== 'play' || choice === m.options.length) ? card : null;
  lv.run.resolve(choice === 'delegate' ? 'delegate' : used ? { opt: choice === m.options.length ? 'card' : choice, card: used.hand } : choice);
  const next = lv.run.advance();
  const players = livePlayers(g);
  const o = decisionOutcome({ frames: lv.run.frames, startIdx, events: s.events.slice(ev0), players, type: outcomeType(m), action: m.type === 'react' ? null : opt?.action ?? null, side: m.side });
  const rec = s.moments.log.find((r) => r.id === m.id);
  const score: [number, number] = [...m.score];
  if (o.goal !== null) score[o.goal]++;
  const KO = { safe: '안전', balanced: '균형', gamble: '도박', card: '카드' } as const;
  const band = outcomeBand(o, rec, m.side);
  // 결정 기록도 화면에서 본 결과를 따른다 (띠와 기록이 엇갈리지 않게)
  if (rec) rec.seen = { result: band.tone === 'goal' ? 'success' : band.tone === 'conceded' ? 'fail' : band.tone, flow: band.flow };
  const delta = rec?.delta ?? 0;
  const headline = band.tone === 'goal' ? (opt?.kind === 'card' ? `골! ${opt.label}` : '골!') : band.tone === 'conceded' ? '실점'
    : opt && band.tone === 'success' ? opt.success : opt && band.tone === 'fail' ? opt.fail : band.title;
  const vm: OutcomeVM = {
    moment: m, teams: lv.teams, score, shown: false, band, kind: opt ? opt.kind : 'delegate',
    headline, ratingDelta: delta, rating: before === null ? null : Math.max(0, Math.min(10, before + delta)), card: used?.name ?? null,
    choice: opt ? `${used ? `🃏 ${used.name} · ` : `${KO[opt.kind]} · `}${opt.label}${opt.p !== null ? ` (${Math.round(Math.min(0.99, opt.p + (used?.deltas?.[choice as number] ?? 0)) * 100)}%)` : ''}` : '맡기기 (엔진 판단)',
  };
  lv.prevE = o.to;
  const center = lv.pitch?.center ?? 0.5;
  lv.pitch?.stop();
  lv.pitch = null;
  setPitchTeams(lv.teams);
  const pitch = new OutcomePitch(lv.run.frames, new Map(players.map((p) => [p.id, p])), m.side, o.from, o.to, () => {
    const oc = ui.live?.oc;
    if (!oc || oc.pitch !== pitch) return;
    oc.vm.shown = true;
    if (ui.screen === 'moment') render();
    // 다른 화면으로 나가 있으면 넘기지 않는다 (돌아오면 다시 잰다, C.39)
    oc.timer = window.setTimeout(() => {
      if (ui.screen === 'moment') liveContinue(g);
      else oc.timer = 0;
    }, OUTCOME.bandMs);
  }, center);
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

/**
 * 라운드 처리 후 결과 화면으로 (out 이 있으면 직접 모드로 이미 계산한 경기).
 * C.50(pending 82 2번): 하이라이트를 강제로 보여 주지 않는다. 재생기는 끝난 상태로 두고(평균 위치·결정 장면 다시 보기용),
 * 하이라이트는 결과 화면 [하이라이트 다시보기]로만 본다
 */
function finishPlay(g: GameState, out?: MyMatchOutput): void {
  ui.rewatch = false;
  let replay: Replay | null = null;
  const report = playRound(g, { ...(out ? { engineOut: out } : {}), onReplay: (r) => { replay = r; ui.replay = new ReplayPlayer(r, () => render()); ui.replay.skip(); } });
  if (replay) void keepReplay(g, replay, report);
  void autosave();
  go('match');
  if (g.phase !== 'season') badgeToast(g);
  if (report.cardUnlock) showToast({ kind: 'info', title: `시그니처 카드 해금 · ${report.cardUnlock}`, body: '덱 편집에서 덱에 넣을 수 있어요.' }, 2200);
  else if (report.levelsGained > 0) showToast({ kind: 'levelup', title: `레벨 업! Lv.${g.player.level}`, body: `포인트 ${g.player.unspentPoints}P · 1P = 능력치 한 칸(높은 칸은 2~3P)` }, 2200);
}

/** 다시 보기 끝: 지난 경기면 선수 화면, 방금 경기 하이라이트면 결과 화면 (재생기는 끝난 상태로 남겨 평균 위치에 쓴다) */
function rewatchExit(): void {
  const back = ui.rewatch;
  ui.rewatch = false;
  if (back === 'match' && ui.replay) {
    ui.replay.skip();
    go('match');
    return;
  }
  ui.replay = null;
  go('player');
}

/** 커리어 태그 획득·해제 홈 알림 (C.47 → C.57 디자인 133 알림 카드) */
function tagNoticeBanner(g: GameState): string {
  const n = g.tagNotice;
  if (!n) return '';
  return alertCard({ icon: 'star', eyebrow: `태그 · ${n.season}-${String((n.season + 1) % 100).padStart(2, '0')} 시즌 끝`, title: n.text, body: '선수 → 몸·태그에서 전체를 봐요.', close: 'tag-notice-close' });
}

/** 약발 훈련 줄 (디자인 150): 지금 게이지 · 시즌 */
function weakFootLine(g: GameState): string {
  const w = g.player.weakFootTrain;
  return `지금 ${Math.floor(w?.gauge ?? 0)}/${BALANCE.weakFoot.trainingGauge} · 시즌 +${w?.gained ?? 0}/${BALANCE.weakFoot.seasonMax}`;
}

// ── 동작 ──

function readFormInputs(): void {
  const name = document.getElementById('f-name') as HTMLInputElement | null;
  const seed = document.getElementById('f-seed') as HTMLInputElement | null;
  if (name) ui.form.name = name.value;
  if (seed) ui.form.seed = seed.value;
}

/** 포인트 찍기 들어가기: 지금 상태를 기억한다 */
function enterAllocate(g: GameState, back: Screen): void {
  ui.alloc = { snap: structuredClone(g.player), raises: [], startExact: positionOvrExact(g.player.attributes, g.player.position), back, coach: false, sel: null };
}

/** 기억한 상태로 되돌리고 남은 배분을 다시 적용 */
function replayAlloc(g: GameState): void {
  const a = ui.alloc!;
  g.player = structuredClone(a.snap);
  for (const attr of a.raises) raiseAttribute(g.player, attr);
}

/** 응답이 필요한 제안·재계약이 있으면 진행하지 않고 그 화면으로 (C.42) */
function pendingStop(g: GameState): void {
  go(g.market.offers?.length ? 'offers' : 'contract');
  showToast({ kind: 'info', title: '먼저 답해 주세요', body: g.market.renewal ? '계약이 끝났어요. 재계약하거나 제안을 수락해요.' : '이적 제안에 답하기 전에는 진행이 멈춰요.' }, 2400);
}

// ── 하루 단위 진행 (25.1~25.2, 부록 C.38) ──

let enginePool: EnginePool | null = null;
const pool = (): EnginePool => (enginePool ??= new EnginePool());

/** 진행 측정 (부록 C.38 측정 보고용): 하루마다 걸린 시간과 계산한 경기 수 */
const progressLog: { date: string; ms: number; matches: number; my: boolean }[] = [];
(globalThis as unknown as { __progress: typeof progressLog }).__progress = progressLog;

/** 오늘 다른 경기를 계산한다: 전체 엔진은 Web Worker 풀에 나눠 병렬로, 빠른 진행은 바로 (같은 시드 같은 결과) */
async function runOthersToday(g: GameState): Promise<number> {
  const jobs = todaysOthers(g).map(([r, i]) => otherJob(g, r, i));
  if (!jobs.length) return 0;
  if (g.options.quickOthers) {
    playOthers(g, 'quick');
    return jobs.length;
  }
  const outs = await Promise.all(jobs.map((j) => pool().npc(j.input).catch(() => playNpcMatch(j.input))));
  jobs.forEach((j, k) => applyOther(g, j.r, j.i, outs[k]!));
  return jobs.length;
}

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * 날 넘기기. 'one' = [하루 진행], 'continue' = [계속] (다음 일정 = 내 경기 날까지, 그날 다른 경기는 미리 계산).
 * 여러 경기 자동 진행은 autoRun (C.44). [중단]은 그날까지 끝내고 멈춘다
 */
async function advanceDays(g: GameState, mode: 'one' | 'continue'): Promise<void> {
  if (ui.busy || g.phase !== 'season') return;
  if (marketPending(g)) return pendingStop(g);
  ui.busy = true;
  ui.stopReq = false;
  const stop = { action: '중단', onAction: { act: 'sim-stop' } };
  const title = '진행 중';
  const t0 = performance.now();
  let days = 0;
  let wasVacation = false;
  let lastTrain: string | null = null;
  try {
    for (;;) {
      if (g.phase !== 'season') break;
      // 응답이 필요한 제안 (C.42): [계속]·휴가 넘기기 모두 멈춘다
      if (marketPending(g)) break;
      // 경기 날이면 그날 다른 경기만 미리 계산하고 멈춘다 (내 경기는 [경기 시작])
      if (isMatchDay(g)) {
        await runOthersToday(g);
        break;
      }
      // [계속]: 휴가가 시작한 날과 끝난 날(훈련 재개)에도 멈춘다 (25.3 5번: 휴가 중 [계속]은 휴장 끝까지 한 번에)
      const vac = isVacationDay(g, g.calendar.date);
      if (mode === 'continue' && days > 0 && vac !== wasVacation) break;
      wasVacation = vac;
      ui.toast = { kind: 'info', title, body: `${dateLabel(g.calendar.date)} · ${g.league.round}/${g.league.schedule.length}라운드`, ...stop };
      render();
      await nextFrame();
      const d0 = performance.now();
      const date = g.calendar.date;
      const n = await runOthersToday(g);
      lastTrain = trainingLine(endDay(g));
      progressLog.push({ date, ms: Math.round(performance.now() - d0), matches: n, my: false });
      days++;
      autosave();
      if (mode === 'one' || ui.stopReq) break;
    }
  } finally {
    ui.busy = false;
    const stopped = ui.stopReq;
    ui.stopReq = false;
    ui.toast = null;
    autosave();
    if (g.phase !== 'season') {
      go('season');
      badgeToast(g);
    } else if (marketPending(g)) {
      go('home');
      showToast({ kind: 'info', title: '이적 제안이 왔어요', body: `${dateLabel(g.calendar.date)} · 답하기 전에는 진행이 멈춰요.` }, 2600);
    } else {
      go('home');
      const sec = ((performance.now() - t0) / 1000).toFixed(1);
      if (stopped) showToast({ kind: 'info', title: '진행을 멈췄어요', body: `${dateLabel(g.calendar.date)} · ${g.league.round}/${g.league.schedule.length}라운드까지 치렀어요.` }, 2000);
      else if (mode === 'continue') {
        const title = isMatchDay(g) ? '경기 날이에요' : isVacationDay(g, g.calendar.date) ? '휴가 시작 · 리그 휴장' : isVacationDay(g, addDays(g.calendar.date, -1)) ? '휴가 끝 · 훈련 재개' : '다음 일정';
        showToast({ kind: 'info', title, body: `${dateLabel(g.calendar.date)} · ${days}일 진행 (${sec}초)` }, 2200);
      }
      else if (mode === 'one' && lastTrain) showToast({ kind: 'info', title: '하루 진행', body: lastTrain }, 2200);
    }
  }
}

/**
 * [경기 시작]·독 [경기]·결과 [다음 경기] (C.51): 바로 시작하지 않고 경기 준비를 띄운다.
 * 경기 날이 아니면 [계속]으로 경기 날까지 간 뒤 경기 준비로 (C.38). 그날 다른 경기는 먼저 계산해 둔다(내 경기보다 먼저 — 순서는 이전과 같다)
 */
async function openPrep(g: GameState): Promise<void> {
  if (marketPending(g)) return pendingStop(g);
  if (!isMatchDay(g)) {
    await advanceDays(g, 'continue');
    if (g.phase !== 'season' || marketPending(g) || !isMatchDay(g)) return;
  }
  await othersFirst(g);
  ui.moreSheet = false;
  go('prep');
}

/** 그날 다른 경기가 남았으면 먼저 계산 */
async function othersFirst(g: GameState): Promise<void> {
  if (!todaysOthers(g).length) return;
  ui.busy = true;
  ui.toast = { kind: 'info', title: '오늘 다른 경기 계산 중', body: dateLabel(g.calendar.date) };
  render();
  try {
    await runOthersToday(g);
  } finally {
    ui.busy = false;
    ui.toast = null;
  }
}

/** 경기 준비 [경기 시작]: 내 경기를 시작한다 */
async function startPlay(g: GameState): Promise<void> {
  if (marketPending(g)) return pendingStop(g);
  if (!isMatchDay(g)) return openPrep(g);
  if (todaysOthers(g).length) {
    ui.busy = true;
    ui.toast = { kind: 'info', title: '오늘 다른 경기 계산 중', body: dateLabel(g.calendar.date) };
    render();
    try {
      await runOthersToday(g);
    } finally {
      ui.busy = false;
      ui.toast = null;
    }
  }
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
}

/**
 * 자동 진행 (C.44 pending 47 5번·52 4번): matches 경기를 치르거나, untilRound 라운드 내 경기 날 경기 직전에 멈춘다.
 * 진행 중에는 화면을 다시 그리지 않고 지금 화면 위 반투명 레이어의 글자만 바꾼다. [중단]은 그날(경기 포함)까지 끝내고 멈춘다.
 * 응답이 필요한 일(이적 제안·재계약)이 생기면 멈춘다
 */
async function autoRun(g: GameState, opts: { matches: number; untilDate?: string }): Promise<void> {
  if (ui.busy || g.phase !== 'season') return;
  if (marketPending(g)) return pendingStop(g);
  ui.busy = true;
  ui.stopReq = false;
  ui.toast = null;
  render();
  const total = Math.max(0, opts.matches);
  const layer = openAutoLayer();
  const t0 = performance.now();
  const startRound = g.league.round;
  const before = { goals: g.player.season.goals, assists: g.player.season.assists, levels: g.player.level };
  const results: string[] = [];
  const lines: AutoResultLine[] = [];
  const pts0 = g.player.unspentPoints;
  let played = 0;
  let reason: 'done' | 'until' | 'stop' | 'market' | 'season' = 'done';
  const myRow = () => {
    const pos = g.league.table.findIndex((r) => r.teamId === g.player.teamId) + 1;
    return pos > 0 ? `${pos}위` : '-';
  };
  const update = () => {
    const fx = isMatchDay(g) ? nextFixture(g) : null;
    const what = fx ? `${matchCompLabel(g, fx)} ${teamById(g.league, fx.opponentId).nameKo}전 계산 중` : '훈련일 진행 중';
    updateAutoLayer(layer, { n: played, m: total, meta: `${dateLabel(g.calendar.date)} · ${what}`, lines, rank: myRow(), pts: Math.max(0, g.player.unspentPoints - pts0) });
  };
  try {
    for (;;) {
      if (g.phase !== 'season') { reason = 'season'; break; }
      if (marketPending(g)) { reason = 'market'; break; }
      // 중요 경기까지면 그 경기 날(경기 전)까지 날을 넘긴다
      if (opts.untilDate === undefined && played >= total) break;
      const match = isMatchDay(g);
      // 중요 경기 날 (C.67: 리그 라운드 대신 날짜 — 컵 경기도 같은 방식). 그 날짜를 지났으면(그 경기가 없어졌으면) 거기서 멈춘다
      const until = opts.untilDate !== undefined && daysBetween(opts.untilDate, g.calendar.date) >= 0;
      if (until && (match || daysBetween(opts.untilDate!, g.calendar.date) > 0)) {
        // 중요 경기 직전: 그날 다른 경기는 미리 계산해 두고 멈춘다
        await runOthersToday(g);
        reason = 'until';
        break;
      }
      update();
      await nextFrame();
      const d0 = performance.now();
      const date = g.calendar.date;
      const n = await runOthersToday(g);
      if (match) {
        const rm = roundMatch(g);
        const out = await pool().my(rm.input).catch(() => playMyMatch(rm.input));
        const rep = playRound(g, { engineOut: out });
        played++;
        lines.push({ label: rep.cup ? rep.cup.stage : `${rep.round}R`, opp: teamById(g.league, rep.opponentId).nameKo, gf: rep.result.goalsFor, ga: rep.result.goalsAgainst, rating: rep.result.rating });
        results.push(rep.result.goalsFor > rep.result.goalsAgainst ? 'W' : rep.result.goalsFor < rep.result.goalsAgainst ? 'L' : 'D');
      } else {
        endDay(g);
      }
      progressLog.push({ date, ms: Math.round(performance.now() - d0), matches: n + (match ? 1 : 0), my: match });
      autosave();
      if (ui.stopReq) { reason = 'stop'; break; }
    }
  } finally {
    ui.busy = false;
    ui.stopReq = false;
    closeAutoLayer(layer);
    autosave();
    const w = results.filter((x) => x === 'W').length;
    const d = results.filter((x) => x === 'D').length;
    const l = results.length - w - d;
    const goals = g.player.season.goals - before.goals;
    const assists = g.player.season.assists - before.assists;
    // 디자인 64: 끝 요약 토스트 "자동 진행 끝 · n경기" + 전적·내 골·도움·순위 + [자세히](순위표). 걸린 시간은 측정 기록(autoLog)에만
    const body = `${w}승 ${d}무 ${l}패 · 내 골 ${goals} 도움 ${assists}${g.player.level > before.levels ? ` · Lv.${g.player.level}` : ''} · 지금 ${myRow()}`;
    autoLog.push({ played, rounds: g.league.round - startRound, ms: Math.round(performance.now() - t0), reason });
    if (g.phase !== 'season') {
      go('season');
      badgeToast(g);
    } else if (reason === 'market') {
      go('home');
      showToast({ kind: 'info', title: `이적 제안이 와서 멈췄어요 · ${played}경기`, body: `${body} · 답하기 전에는 진행이 멈춰요.` }, 3200);
    } else {
      go('home');
      const title = reason === 'until' ? '중요 경기 직전에 멈췄어요' : reason === 'stop' ? '자동 진행을 멈췄어요' : '자동 진행 끝';
      showToast({ kind: 'info', title: `${title} · ${played}경기`, body, action: '자세히', onAction: { act: 'go-tab', data: { v: 'world' } } }, 4200);
    }
  }
}

/** 자동 진행 측정 (캡처·부록 C.44) */
const autoLog: { played: number; rounds: number; ms: number; reason: string }[] = [];
(globalThis as unknown as { __auto: typeof autoLog }).__auto = autoLog;

/** 반투명 레이어: #app 밖(body)에 붙여 화면을 다시 그리지 않는다 */
function openAutoLayer(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'auto-layer';
  el.innerHTML = autoLayerHtml();
  // [중단]은 누르는 순간에 받는다 (C.30 과 같은 이유)
  el.addEventListener('pointerdown', (ev) => {
    if ((ev.target as HTMLElement).closest('[data-act="sim-stop"]')) {
      requestSimStop();
      // 디자인 63: 주황 점 "멈추는 중", [중단] → 흐린 "지금 경기가 끝나면 멈춰요"
      el.classList.add('is-stopping');
      const t = el.querySelector('.auto-layer__title');
      if (t) t.textContent = '멈추는 중';
      const meta = el.querySelector('.auto-layer__meta');
      if (meta && !meta.textContent?.includes('멈춰요')) meta.textContent += ' · 이 경기까지 하고 멈춰요';
      const b = el.querySelector<HTMLButtonElement>('.auto-layer__stop');
      if (b) { b.disabled = true; b.innerHTML = '<span>지금 경기가 끝나면 멈춰요</span>'; }
    }
  });
  document.body.appendChild(el);
  return el;
}

function updateAutoLayer(el: HTMLElement, p: { n: number; m: number; meta: string; lines: AutoResultLine[]; rank: string; pts: number }): void {
  const q = (c: string) => el.querySelector<HTMLElement>(c);
  const set = (c: string, t: string) => { const x = q(c); if (x) x.textContent = t; };
  set('.auto-layer__n', String(p.n));
  set('.auto-layer__m', `/ ${p.m}경기`);
  set('.auto-layer__meta', `${p.meta}${el.classList.contains('is-stopping') ? ' · 이 경기까지 하고 멈춰요' : ''}`);
  set('.auto-layer__rank', p.rank);
  set('.auto-layer__pts', String(p.pts));
  const ul = q('.auto-layer__results');
  if (ul) ul.innerHTML = autoResultsHtml(p.lines);
  const bar = q('.auto-layer__bar i');
  if (bar) bar.style.width = `${p.m ? Math.round((p.n / p.m) * 100) : 0}%`;
}

function closeAutoLayer(el: HTMLElement): void {
  el.remove();
}

/** [중단]은 라운드마다 다시 그려지는 토스트 안에 있어 click(누름·뗌이 같은 요소)이 끊길 수 있으므로 누르는 순간에 받는다 */
function requestSimStop(): void {
  if (!ui.busy || ui.stopReq) return;
  ui.stopReq = true;
  // 자동 진행 레이어가 떠 있으면 화면은 그대로 둔다 (레이어 글자만 바뀐다)
  if (document.querySelector('.auto-layer')) return;
  ui.toast = { kind: 'info', title: '멈추는 중', body: '오늘 경기까지 치르고 멈춰요.' };
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
  const id = (ev.target as HTMLElement | null)?.id;
  if (id === 'cu-nat') {
    // 커스텀 생성 국적 (C.45): 외모군은 그 국적에서 가장 흔한 것으로 맞춰 준다 (바꿀 수 있음)
    readFormInputs();
    const nat = (ev.target as HTMLSelectElement).value;
    const dist = BALANCE.appearance.byNationality[nat];
    const top = dist ? (Object.entries(dist).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] as Appearance | undefined) : undefined;
    ui.form.cu = customAct(customAct(ui.form.cu, 'nat', nat), 'app', top ?? ui.form.cu.appearance);
    render();
    return;
  }
  if (id === 'auto-n') {
    ui.autoCount = Math.max(1, Math.floor(Number((ev.target as HTMLInputElement).value) || 1));
    setTimeout(render, 0);
    return;
  }
  if ((id === 'f-rq' || id === 'f-rsort') && ui.screen === 'new') {
    // 실제 선수 검색·정렬 (C.58 디자인 131): 엔터·칸 벗어남 때 반영
    readFormInputs();
    const val = (ev.target as HTMLInputElement).value;
    if (id === 'f-rq') { ui.ng.rq = val; ui.ng.rshow = 10; } else ui.ng.rsort = val as NewGameUI['rsort'];
    setTimeout(render, 0);
    return;
  }
  if (id !== 'f-seed' || ui.screen !== 'new') return;
  readFormInputs();
  // 입력 칸이 blur 되는 중에 DOM 을 바꾸면 오류라 다음 틱에 그린다
  setTimeout(render, 0);
});

app.addEventListener('click', (ev) => {
  // 더보기 줄 (C.63c): 독 밖을 누르면 접는다 (누른 곳의 동작은 그대로 한다 — 배경을 막지 않음)
  if (ui.moreSheet && (!isWide() || isLandPhone()) && !(ev.target as HTMLElement).closest('.dock-bar')) {
    ui.moreSheet = false;
    if (!(ev.target as HTMLElement).closest('[data-act]')) render();
  }
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  // 겹침 바깥만 누르면 닫는다 (모달·시트 안쪽 클릭은 무시)
  if (el.dataset.overlay && ev.target !== el) return;
  const act = el.dataset.act!;
  const g = ui.game;
  const v = el.dataset.v;
  // 경기 중에는 다른 화면을 보기만 한다 (C.39)
  if (liveScreen() && LOCK_ACTS.has(act) && ui.screen !== liveScreen()) {
    showToast({ kind: 'info', title: '경기 중에는 볼 수만 있어요', body: '위 띠를 누르면 경기로 돌아가요.' }, 1800);
    return;
  }

  switch (act) {
    case 'intro-ok':
      if (!g) return;
      g.guide.introsSeen.push(el.dataset.id as FeatureId);
      autosave();
      render();
      // 바로 가기: 같은 동작 단추를 눌러 준다 (전술 열기 · 포인트 찍기)
      if (el.dataset.go === 'tactics' || el.dataset.go === 'growth') {
        const b = document.createElement('button');
        b.dataset.act = el.dataset.go === 'tactics' ? 'tac-open' : 'go';
        if (el.dataset.go === 'growth') b.dataset.to = 'allocate';
        b.hidden = true;
        app.appendChild(b);
        b.click();
        b.remove();
      }
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
      ui.trainSheet = null;
      ui.presetSheet = null;
      ui.autoSheet = false;
      ui.moreSheet = false;
      render();
      return;
    case 'pos-change': {
      if (!g || !v) return;
      const from = g.player.position;
      if (requestPositionChange(g.player, v as PlayablePosition, canChangePosition(g))) {
        // 내 위치도 새 주 포지션 슬롯으로 (E.19 ②). 포메이션·역할·세부 전술은 그대로
        g.tactics = { ...g.tactics, mySlot: defaultSlot(g.tactics.formation, v as PlayablePosition, g.rosters[g.player.teamId], g.tactics.custom) };
        // 포변 조언대로 바꿨으면 보너스 (부록 C.37)
        const taken = checkAdviceTaken(g.player, myMatchPosition(g), g.league.season, campDay(g));
        autosave();
        ui.posSheet = null;
        showToast({ kind: 'info', title: `주 포지션 ${from} → ${v}`, body: taken ? adviceTakenText(String(v)) : g.phase === 'season' ? '다음 경기부터 새 포지션으로 뛰어요.' : '다음 시즌부터 새 포지션으로 뛰어요.' }, 2400);
      }
      return;
    }
    case 'modal-close':
      ui.modal = null;
      render();
      return;
    case 'tac-open':
      if (!g) return;
      ui.moreSheet = false;
      if (!isUnlocked(g.guide, 'tactics')) {
        showToast({ kind: 'info', title: '전술은 아직 잠겨 있어요', body: '3경기를 치르면 열려요.' }, 1800);
        return;
      }
      ui.tacBack = ui.screen === 'prep' ? 'prep' : 'home';
      ui.tac = { draft: structuredClone(g.tactics), pickMe: false, sheet: null, sheetPick: null, edit: false, moving: null };
      // 경기 준비 [역할 바꾸기] (C.51): 내 슬롯 역할 시트를 바로 연다
      if (v === 'role') {
        ui.tac.sheet = g.tactics.mySlot;
        ui.tac.sheetPick = g.tactics.roles[g.tactics.mySlot] ?? null;
      }
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
      go(ui.tacBack);
      return;
    case 'tac-leave':
      ui.tac = null;
      go(ui.tacBack);
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
      if (g.phase === 'season' && checkAdviceTaken(g.player, myMatchPosition(g), g.league.season, campDay(g))) {
        autosave();
        showToast({ kind: 'info', title: '전술을 저장했어요', body: adviceTakenText(myMatchPosition(g)) }, 2400);
        return;
      }
      autosave();
      showToast({ kind: 'info', title: '전술을 저장했어요', body: '바꾸기 전까지 매 경기 이 전술로 뛰어요.' });
      return;
    case 'go':
    case 'go-tab': {
      ui.moreSheet = false;
      if (ui.screen === 'new') readFormInputs();
      const to = (act === 'go-tab' ? v : el.dataset.to) as Screen;
      if (to === 'deck') {
        ui.deckBack = ui.screen === 'prep' ? 'prep' : 'home';
        ui.deckSet = null;
        ui.cardSheet = null;
      }
      if (ui.screen === 'deck' && to !== 'deck' && g) g.cards.fresh = [];
      if (to === 'settings' && ui.screen !== 'settings') ui.set = { page: 'main', open: ui.set.open };
      if (to === 'allocate' && g) enterAllocate(g, ui.screen === 'season' ? 'season' : ui.screen === 'player' ? 'player' : g.phase === 'season' ? 'home' : 'season');
      go(to);
      return;
    }
    case 'world-tab':
      ui.worldTab = v as typeof ui.worldTab;
      // 인박스 기록 소식의 [리그 기록 보기] (C.64): 다른 화면에서 오면 월드로
      if (ui.screen !== 'world') { go('world'); return; }
      render();
      return;
    case 'world-stars':
      ui.starGroup = v as typeof ui.starGroup;
      ui.more = { ...ui.more, stars: false };
      render();
      return;
    case 'world-board':
      ui.worldBoard = v as typeof ui.worldBoard;
      render();
      return;
    // ── 다른 팀·선수 상세 (C.53) ──
    case 'team-open':
    case 'person-open': {
      if (!g || !v) return;
      ui.moreSheet = false;
      if (act === 'person-open' && v === 'me') { go('player'); return; }
      if (act === 'team-open' && !hasTeamDetail(g, v)) return;
      const d = ui.detail;
      if (act === 'team-open' ? ui.screen === 'team' && d.team === v : ui.screen === 'person' && d.person === v) return;
      d.stack.push({ screen: ui.screen, team: d.team, person: d.person, teamTab: d.teamTab, personTab: d.personTab });
      if (d.stack.length > 20) d.stack.shift();
      if (act === 'team-open') { d.team = v; d.teamTab = 'overview'; go('team'); } else { d.person = v; d.personTab = 'attrs'; go('person'); }
      return;
    }
    case 'team-tab':
      ui.detail.teamTab = v as TeamTab;
      render();
      if (v === 'squad') window.scrollTo(0, 0);
      return;
    case 'player-tab':
      ui.playerTab = v as PlayerTab;
      render();
      if (el.dataset.look) requestAnimationFrame(() => document.querySelector('.pl-look')?.scrollIntoView({ block: 'center' }));
      else window.scrollTo(0, 0);
      return;
    case 'cu-step':
      readFormInputs();
      ui.ng.cuStep = Math.max(1, Math.min(6, Number(v) || 1));
      render();
      window.scrollTo(0, 0);
      return;
    case 'ng-attrs':
      ui.ng.attrsOpen = !ui.ng.attrsOpen;
      render();
      return;
    case 'ng-real': {
      readFormInputs();
      const k = el.dataset.k;
      if (k === 'realTab') { ui.ng.realTab = v === 'legend' ? 'legend' : 'real'; ui.ng.rshow = 10; ui.ng.rsort = ui.ng.realTab === 'legend' ? 'peak' : 'ovr'; }
      else if (k === 'rgroup') { ui.ng.rgroup = v as NewGameUI['rgroup']; ui.ng.rshow = 10; }
      else if (k === 'rshow') ui.ng.rshow = Number(v) || 10;
      else if (k === 'rq') { ui.ng.rq = v ?? ''; ui.ng.rshow = 10; }
      render();
      return;
    }
    case 'alloc-rule':
      ui.allocRule = !ui.allocRule;
      render();
      return;
    case 'look-name':
      ui.lookName = !ui.lookName;
      render();
      return;
    case 'person-tab':
      ui.detail.personTab = v as PersonTab;
      render();
      return;
    case 'detail-back': {
      const d = ui.detail;
      const prev = d.stack.pop();
      if (!prev) { go('home'); return; }
      Object.assign(d, { team: prev.team, person: prev.person, teamTab: prev.teamTab, personTab: prev.personTab });
      go(prev.screen);
      return;
    }
    // ── 이적·계약 (C.42) ──
    case 'offer-accept': {
      if (!g?.market.offers) return;
      const i = Number(el.dataset.i);
      const o = g.market.offers[i];
      const ov = marketVM(g);
      const vo = ov.offers?.find((x) => x.i === i);
      if (!o || !vo) return;
      const team = teamById(g.league, o.teamId).nameKo;
      const others = (ov.offers?.length ?? 1) - 1;
      // 디자인 98 (C.60): 계약 · 주급 · 팀 전력 · 예상 선발 · 위상 표 + 나머지 제안 자동 거절 안내
      confirmModal({
        title: o.teamId === g.player.teamId ? `${team}와 1군 계약할까요?` : o.kind === 'loan' ? `${team} 임대를 수락할까요?` : `${team}로 갈까요?`,
        rows: [
          ['계약', o.kind === 'loan' ? '임대 1시즌 · 계약은 그대로' : `${o.years}년 · ${vo.until} 시즌까지`],
          ['주급', `${ov.curWage} → ${vo.wage}`],
          ['팀 전력', `${ov.rating} → ${vo.rating}`],
          ['예상 선발', `${vo.startPct}%`],
          ['위상', vo.repLoss ? `약 −${vo.repLoss} (약팀 이적)` : '변화 없음'],
        ],
        body: `${o.kind === 'loan' ? '1시즌 뒤 원 소속팀으로 돌아와요. ' : '전술은 새 팀 기본값으로 바뀌어요. '}${others > 0 ? `수락하면 나머지 제안 ${others}개는 자동으로 거절돼요. ` : ''}되돌릴 수 없어요.`,
        confirm: '수락', act: 'offer-accept-ok', data: { i: String(i) },
      });
      return;
    }
    case 'more':
      ui.more[v!] = !ui.more[v!];
      render();
      return;
    case 'pick-sel':
      ui.pickSel = Number(v);
      render();
      return;
    case 'offer-sel':
      ui.offerSel = Number(v);
      render();
      return;
    case 'offer-accept-ok': {
      if (!g) return;
      const { points } = acceptMyOffer(g, Number(el.dataset.i));
      autosave();
      go('home');
      showToast({ kind: 'info', title: g.market.notice ?? '이적 완료', body: points > 0 ? `약팀 이적 · 위상 −${points}` : `${teamById(g.league, g.player.teamId).nameKo} 선수가 됐어요.` }, 2600);
      return;
    }
    case 'offer-decline':
      if (!g) return;
      declineOffer(g, Number(el.dataset.i));
      autosave();
      if (!marketPending(g)) go('home');
      else render();
      return;
    case 'offers-decline':
      if (!g) return;
      declineOffers(g);
      autosave();
      go(g.market.renewal ? 'contract' : 'home');
      showToast(g.market.renewal ? '제안을 모두 거절했어요. 재계약해요.' : '제안을 모두 거절했어요.');
      return;
    case 'renew-years':
      ui.renewYears = Number(v);
      render();
      return;
    case 'renew':
      if (!g) return;
      renewContract(g, Number(v));
      ui.renewYears = null;
      autosave();
      go('home');
      showToast({ kind: 'info', title: '재계약 완료', body: `${v}년 연장했어요.` });
      return;
    case 'market-notice-close':
      if (!g) return;
      g.market.notice = null;
      render();
      return;
    case 'market-refused-close':
      if (!g) return;
      g.market.refused = null;
      render();
      return;
    case 'tag-notice-close':
      if (!g) return;
      g.tagNotice = null;
      autosave();
      render();
      return;
    case 'tags-all':
      ui.tagsAll = !ui.tagsAll;
      render();
      return;
    case 'transfer-request': {
      if (!g) return;
      const el2 = requestEligibility(g);
      if (!el2.ok) return showToast(el2.reason);
      confirmModal({
        title: '이적을 요청할까요?', body: `${el2.reason}. 구단이 놓아줄 확률 ${Math.round(releaseChance(g) * 100)}%. 시즌에 한 번만 할 수 있어요.`,
        confirm: '요청하기', act: 'transfer-request-ok',
      });
      return;
    }
    case 'transfer-request-ok': {
      if (!g) return;
      const r = requestTransfer(g);
      autosave();
      ui.modal = null;
      if (r.offersNow) go('offers');
      else render();
      showToast(r.accepted
        ? { kind: 'info', title: '이적 명단에 올랐어요', body: r.offersNow ? '겨울 이적시장 제안이 왔어요.' : '1월 1일 겨울 이적시장이 열리면 제안이 와요.' }
        : { kind: 'info', title: '구단이 거절했어요', body: '이번 시즌에는 다시 요청할 수 없어요.' }, 2600);
      return;
    }
    case 'continue':
      void loadSlot('auto');
      return;
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
      const k = el.dataset.k as 'mode' | 'position' | 'difficulty' | 'realId' | 'legends';
      (ui.form as unknown as Record<string, string>)[k] = v!;
      render();
      return;
    }
    case 'cu':
    case 'cu-sel':
    case 'cu-raise':
    case 'cu-lower': {
      // 커스텀 생성 (C.45): 나이·포지션·신체·외모·장단점·능력치 한 칸
      readFormInputs();
      const k = act === 'cu' ? el.dataset.k ?? '' : act.slice(3);
      ui.form.cu = customAct(ui.form.cu, k, act === 'cu' ? v : (el.dataset.attr ?? v));
      render();
      return;
    }
    case 'buy-weakfoot': {
      if (!g) return;
      if (buyWeakFoot(g)) {
        autosave();
        showToast({ kind: 'info', title: `약발 ${g.player.body.weakFoot}`, body: g.player.body.weakFoot >= 5 ? '양발잡이가 됐어요.' : `포인트 ${BALANCE.weakFoot.pointCost}P를 썼어요.` });
      }
      render();
      return;
    }
    case 'cu-auto': {
      readFormInputs();
      const c = ui.form.cu;
      ui.form.cu = { ...c, attrs: autoCustom(c.position, budgetOf(c), c.height, c.attrs) };
      render();
      return;
    }
    case 'start': {
      readFormInputs();
      const f = ui.form;
      if (f.mode === 'real' && !f.realId) return;
      if (f.mode === 'custom') {
        const cv = customVM(f.cu, f.name);
        if (cv.over || !cv.start.ready) return;
      }
      ui.game = f.mode === 'prospect'
        ? newGame({ mode: 'prospect', name: f.name, position: f.position, seed: prospectSeed(), difficulty: f.difficulty, rolled: true, legends: f.legends === 'on' })
        : f.mode === 'custom'
          ? newGame({ mode: 'custom', custom: customSpec(f.cu, f.name), seed: prospectSeed(), difficulty: f.difficulty, legends: f.legends === 'on' })
          : newGame({ mode: 'real', playerId: f.realId, seed: f.seed, difficulty: f.difficulty, legends: f.legends === 'on' });
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
    case 'live-return': {
      const to = liveScreen();
      if (!g || !to) return;
      go(to);
      // 결과 띠를 보던 중에 나갔으면 다시 잰다
      const oc = ui.live?.oc;
      if (oc?.vm.shown && !oc.timer) oc.timer = window.setTimeout(() => { if (ui.screen === 'moment') liveContinue(g); else oc.timer = 0; }, OUTCOME.bandMs);
      return;
    }
    case 'train-day':
      if (!g || g.phase !== 'season' || !v) return;
      ui.trainSheet = trainingOptionsVM(g, v) ? v : null;
      ui.trainPick = null;
      render();
      return;
    case 'train-pick':
      ui.trainPick = v ?? null;
      render();
      return;
    case 'meet-pick':
      ui.meetSel = v ?? null;
      render();
      return;
    case 'meet-ok': {
      if (!g || !v) return;
      const req = requestEligibility(g, true);
      const r = holdMeeting(g, v as MeetingChoice, { requestOk: req.ok });
      let body = r.text;
      if (r.request) {
        const t = requestTransfer(g, true);
        body = t.accepted ? (t.offersNow ? '구단이 놓아줬어요. 겨울 이적시장 제안이 왔어요.' : '구단이 놓아줬어요. 1월 1일 겨울 이적시장이 열리면 제안이 와요.') : '구단이 거절했어요. 이번 시즌에는 다시 요청할 수 없어요.';
        g.manager!.result = { date: g.calendar.date, title: t.accepted ? '이적 명단에 올랐어요' : '구단이 이적 요청을 거절했어요', text: body };
        autosave();
        if (t.offersNow) { go('offers'); return; }
      } else autosave();
      go('home');
      showToast({ kind: 'info', title: g.manager?.result?.title ?? r.title, body }, 2600);
      return;
    }
    case 'inbox-tab':
      if (v === 'all' || v === 'todo' || v === 'info') ui.inboxTab = v;
      ui.inboxSel = null;
      render();
      return;
    case 'inbox-open':
      if (!g || !v) return;
      ui.inboxSel = +v;
      ui.inboxPick = null;
      markRead(g, +v);
      if (ui.screen !== 'inbox') { go('inbox'); return; }
      render();
      window.scrollTo(0, 0);
      return;
    case 'inbox-read':
      if (!g || !v) return;
      markRead(g, +v);
      autosave();
      render();
      return;
    case 'inbox-all-read':
      if (!g) return;
      markAllRead(g);
      autosave();
      render();
      return;
    case 'inbox-pick':
      ui.inboxPick = v ?? null;
      render();
      return;
    case 'inbox-answer': {
      const id = el.dataset.id;
      if (!g || !v || !id) return;
      const text = answerEvent(g, +id, v);
      autosave();
      ui.inboxPick = null;
      render();
      showToast({ kind: 'info', title: '답했어요', body: text }, 2600);
      return;
    }
    case 'meet-result-close':
      if (!g || !g.manager) return;
      g.manager.result = null;
      autosave();
      render();
      return;
    case 'alerts-close':
      if (!g) return;
      if (g.manager) g.manager.result = null;
      g.tagNotice = null;
      if (g.player.advice) g.player.advice.dismissed = true;
      if (!g.market.offers?.length) g.market.refused = null;
      autosave();
      render();
      return;
    case 'train-set': {
      const date = el.dataset.date;
      if (!g || !v || !date) return;
      if (setDayTraining(g, date, v as TrainingKind)) autosave();
      ui.trainSheet = null;
      render();
      return;
    }
    case 'train-tab':
      if (v === 'pre' || v === 'cal' || v === 'g') ui.trainTab = v;
      render();
      return;
    case 'preset-pick':
      if (!g || g.phase !== 'season' || !v) return;
      if (choosePreset(g, v)) autosave();
      render();
      return;
    case 'preset-apply':
      if (!g || g.phase !== 'season') return;
      if (choosePreset(g, recommendPreset(g).id, false)) autosave();
      render();
      return;
    case 'preset-auto':
      if (!g?.training) return;
      setPresetAuto(g, v === 'on');
      autosave();
      render();
      return;
    case 'preset-edit':
      if (!g?.training) return;
      ui.presetSheet = { id: v || null };
      render();
      return;
    case 'preset-save': {
      if (!g?.training) return;
      const name = (document.getElementById('f-preset-name') as HTMLInputElement | null)?.value ?? '';
      const slots = [...document.querySelectorAll<HTMLSelectElement>('[data-preset-slot]')].map((s) => s.value as TrainingKind);
      if (v) updateCustomPreset(g.training, v, name, slots);
      else choosePreset(g, addCustomPreset(g.training, name, slots));
      ui.presetSheet = null;
      autosave();
      render();
      return;
    }
    case 'preset-del':
      if (!g?.training || !v) return;
      deleteCustomPreset(g.training, v);
      ui.presetSheet = null;
      autosave();
      render();
      return;
    case 'train-focus':
      if (!g?.training || !v) return;
      g.training.focus = v as TrainingState['focus'];
      autosave();
      render();
      return;
    case 'day-one':
      if (g && g.phase === 'season' && !ui.busy) void advanceDays(g, 'one');
      return;
    case 'day-continue':
      if (g && g.phase === 'season' && !ui.busy) void advanceDays(g, 'continue');
      return;
    case 'faceon-open':
      ui.fo.sel = el.dataset.key ?? null;
      ui.fo.tab = ui.fo.sel?.startsWith('t:') ? 'clubs' : 'players';
      ui.set.page = 'faceon';
      go('settings');
      return;
    case 'faceon-tab':
      if (v !== 'players' && v !== 'clubs') return;
      ui.fo.tab = v;
      ui.fo.q = '';
      render();
      return;
    case 'faceon-pick':
      ui.fo.sel = el.dataset.key ?? null;
      render();
      window.scrollTo(0, 0);
      return;
    // ── 설정 화면 틀 (C.59): 하위 화면 · 섹션 접기 · 이동 칩 ──
    case 'set-page':
      if (!v || !['main', 'names', 'pixel', 'faceon', 'cardart'].includes(v)) return;
      ui.set.page = v as SetPage;
      go('settings');
      return;
    case 'set-back':
      // 페이스온·카드 이미지 편집 → 목록, 목록·다른 하위 화면 → 설정 첫 화면
      if (ui.set.page === 'faceon' && ui.fo.sel) ui.fo.sel = null;
      else if (ui.set.page === 'cardart' && ui.ca.sel) ui.ca.sel = null;
      else ui.set.page = 'main';
      go('settings');
      return;
    case 'set-nav':
      // PC 설정 왼쪽 목록 (C.61): 하위 화면에서도 첫 화면으로 돌아가 그 섹션을 연다
      if (!v) return;
      ui.set.page = 'main';
      ui.set.open = v as SetSec;
      go('settings');
      return;
    case 'set-toggle':
    case 'set-open': {
      const sec = v as SetSec;
      ui.set.open = act === 'set-toggle' && ui.set.open === sec && !isWide() ? null : sec;
      render();
      if (act === 'set-open') document.getElementById(`set-${sec}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    case 'px-side':
      if (v !== 'home' && v !== 'away') return;
      ui.px.side = v;
      render();
      return;
    case 'ca-more':
      ui.ca.more = true;
      render();
      return;
    case 'ca-crop-center': {
      const c = ui.ca.crop;
      if (!c) return;
      c.x = 0;
      c.y = 0;
      render();
      return;
    }
    case 'faceon-upload': {
      const input = document.getElementById('fo-file') as HTMLInputElement | null;
      if (!input || !el.dataset.key || !el.dataset.slot) return;
      input.dataset.key = el.dataset.key;
      input.dataset.slot = el.dataset.slot;
      input.click();
      return;
    }
    case 'faceon-clear': {
      const key = el.dataset.key;
      if (!key) return;
      void clearFaceOn(key, el.dataset.slot as FaceSlot | undefined).then(() => {
        render();
        showToast('되돌렸어요');
      });
      return;
    }
    case 'faceon-cutout': {
      const key = el.dataset.key;
      if (!key) return;
      void setFaceOnCutout(key, v === 'on').then(() => render());
      return;
    }
    case 'faceon-crop-cancel':
      if (ui.fo.crop) URL.revokeObjectURL(ui.fo.crop.src);
      ui.fo.crop = null;
      render();
      return;
    case 'faceon-crop-save': {
      const c = ui.fo.crop;
      if (!c) return;
      void (async () => {
        try {
          const img = await loadImage(c.src);
          const club = c.slot === 'crest';
          const blob = await squareToBlob(img, c, club ? 160 : 256, club ? 'center' : 'bottom');
          await setFaceOn(c.key, c.name, c.slot, blob);
          URL.revokeObjectURL(c.src);
          ui.fo.crop = null;
          render();
          showToast({ kind: 'info', title: '이미지를 바꿨어요', body: `${c.name} · ${(blob.size / 1024).toFixed(0)} KB` });
        } catch (e) {
          showToast((e as Error).message || '저장하지 못했어요');
        }
      })();
      return;
    }
    case 'facepack-export':
      void (async () => {
        const blob = await exportFacepack();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'player-one-facepack.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast({ kind: 'info', title: '페이스팩을 내보냈어요', body: `${(blob.size / 1024).toFixed(0)} KB` });
      })();
      return;
    case 'facepack-import':
      (document.getElementById('fp-file') as HTMLInputElement | null)?.click();
      return;
    // ── 카드 이미지 (C.48) ──
    case 'ca-pick':
      ui.ca.sel = el.dataset.key ?? null;
      render();
      window.scrollTo(0, 0);
      return;
    case 'ca-kind':
      ui.ca.kind = (v ?? 'all') as CardKindFilter;
      render();
      return;
    case 'ca-none':
      ui.ca.none = !ui.ca.none;
      render();
      return;
    case 'ca-upload': {
      const input = document.getElementById('ca-file') as HTMLInputElement | null;
      if (!input || !el.dataset.key) return;
      input.dataset.key = el.dataset.key;
      input.click();
      return;
    }
    case 'ca-adjust': {
      const id = el.dataset.key;
      if (!id) return;
      void userArtBlob(id).then((blob) => {
        if (!blob) return;
        const pos = cardArtPos(id) ?? { x: 0, y: 0, zoom: 1 };
        ui.ca.crop = { id, name: cardById(id)?.name ?? id, src: URL.createObjectURL(blob), fresh: false, ...pos };
        render();
      });
      return;
    }
    case 'ca-clear': {
      const id = el.dataset.key;
      if (!id) return;
      void clearCardArt(id).then(() => {
        render();
        showToast('기본 그림으로 돌렸어요');
      });
      return;
    }
    case 'ca-crop-cancel':
      if (ui.ca.crop) URL.revokeObjectURL(ui.ca.crop.src);
      ui.ca.crop = null;
      render();
      return;
    case 'ca-crop-save': {
      const c = ui.ca.crop;
      if (!c) return;
      const pos = { x: c.x, y: c.y, zoom: c.zoom };
      void (async () => {
        try {
          if (c.fresh) {
            const blob = await normalizeArt(await loadImage(c.src));
            await setCardArt(c.id, blob, pos);
            showToast({ kind: 'info', title: '카드 그림을 바꿨어요', body: `${c.name} · ${(blob.size / 1024).toFixed(0)} KB` });
          } else {
            await setCardArtPos(c.id, pos);
            showToast('위치를 맞췄어요');
          }
          URL.revokeObjectURL(c.src);
          ui.ca.crop = null;
          render();
        } catch (e) {
          showToast((e as Error).message || '저장하지 못했어요');
        }
      })();
      return;
    }
    case 'ex-cards':
      ui.exportCards = !ui.exportCards;
      render();
      return;
    case 'pv-open':
      ui.pvSheet = true;
      render();
      return;
    case 'pv-close':
      ui.pvSheet = false;
      render();
      return;
    case 'skin-set':
      if (v !== 'a' && v !== 'b') return;
      setSkin(v);
      render();
      return;
    case 'po-orient':
      if (v !== 'auto' && v !== 'landscape' && v !== 'portrait') return;
      setPitchOrient(v);
      render();
      return;
    case 'po-size':
      if (v !== 'normal' && v !== 'large' && v !== 'xlarge') return;
      setPitchSize(v);
      render();
      return;
    case 'po-names':
      if (v !== 'all' && v !== 'mine' && v !== 'off') return;
      setPitchNames(v);
      render();
      return;
    // 경기 아이콘 (C.45): 선수 인물·팀 유니폼 직접 바꾸기 → 세이브 pixelOverrides
    case 'px-tab':
      if (v !== 'players' && v !== 'kits') return;
      ui.px.tab = v;
      ui.px.q = '';
      render();
      return;
    case 'px-pick':
    case 'px-team-pick':
      if (act === 'px-pick') ui.px.sel = el.dataset.id ?? null;
      else {
        ui.px.kitSel = el.dataset.id ?? null;
        ui.px.side = 'home';
      }
      render();
      document.querySelector('.px-editor')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    case 'px-open-me':
      if (!g) return;
      ui.px = { ...ui.px, tab: 'players', sel: myFace(g).id };
      ui.set.page = 'pixel';
      go('settings');
      requestAnimationFrame(() => document.querySelector('.px-editor')?.scrollIntoView({ block: 'center' }));
      return;
    case 'px-person':
    case 'px-auto': {
      const id = el.dataset.id;
      if (!g || !id) return;
      const o = (g.pixelOverrides ??= emptyOverrides());
      const [skin, hair] = (el.dataset.key ?? '').split('_');
      setPersonOverride(o, id, act === 'px-person' && skin && hair ? { skin, hair } : null);
      autosave();
      render();
      if (act === 'px-auto') showToast({ kind: 'info', title: '자동 아이콘으로 되돌렸어요' });
      return;
    }
    case 'px-kit':
    case 'px-kit-auto': {
      const id = el.dataset.id;
      if (!g || !id) return;
      const o = (g.pixelOverrides ??= emptyOverrides());
      if (act === 'px-kit') {
        const side = el.dataset.side === 'away' ? 'away' : 'home';
        setKitOverride(o, id, side, el.dataset.kit ?? null);
      } else {
        setKitOverride(o, id, 'home', null);
        setKitOverride(o, id, 'away', null);
        showToast({ kind: 'info', title: '기본 유니폼으로 되돌렸어요' });
      }
      autosave();
      render();
      return;
    }
    case 'nm-pick':
      ui.nm.sel = el.dataset.id ?? null;
      render();
      document.querySelector('.nm-editor')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    case 'nm-save':
    case 'nm-clear': {
      const id = el.dataset.id;
      if (!g || !id) return;
      const val = (x: string) => (act === 'nm-save' ? (document.getElementById(x) as HTMLInputElement | null)?.value ?? '' : '');
      setNameOverride(g.nameOverrides, id, 'nickname', val('nm-nick'));
      setNameOverride(g.nameOverrides, id, 'shortName', val('nm-short'));
      autosave();
      render();
      showToast({ kind: 'info', title: act === 'nm-save' ? '이름을 저장했어요' : '자동 이름으로 되돌렸어요' });
      return;
    }
    case 'pv-set':
      if (v !== 'face' && v !== 'number' && v !== 'character') return;
      setPitchView(v);
      ui.pvSheet = false;
      render();
      return;
    case 'opt-quick':
      if (!g) return;
      g.options = { quickOthers: v === 'quick' };
      autosave();
      render();
      return;
    case 'play': {
      if (!g || g.phase !== 'season' || ui.busy) return;
      void openPrep(g);
      return;
    }
    case 'prep-start': {
      if (!g || g.phase !== 'season' || ui.busy) return;
      void startPlay(g);
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
      ui.cardSheet = null;
      autosave();
      render();
      return;
    }
    case 'card-open':
      if (!v) return;
      ui.cardSheet = { id: v, from: el.dataset.from === 'pool' ? 'pool' : 'deck' };
      render();
      return;
    case 'card-close':
      ui.cardSheet = null;
      render();
      return;
    case 'pick-take': {
      if (!g || !v) return;
      const [pi, oi] = v.split(':').map(Number);
      const id = takePick(g.cards, pi!, oi!);
      ui.pickSel = 1;
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
    case 'mo-pick-confirm': {
      // 카드 장면 시트 (5차 80): [안 쓰고 계속] = "카드 없이" 선택지, [카드 쓰기] = 고른 카드의 카드 선택지를 바로 확정
      const lv = ui.live;
      const m = lv?.run.pending;
      if (!g || !lv || !m || lv.oc || v === undefined) return;
      const k = Number(v);
      if (k < m.options.length) lv.card = null;
      else if (lv.card === null) return;
      lv.sel = k;
      liveDecide(g, k);
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
      if (ui.rewatch) {
        rewatchExit();
        return;
      }
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
      if (ui.rewatch) {
        rewatchExit();
        return;
      }
      go('match');
      return;
    case 'sim-rest':
      // 자동 진행 범위 시트 (C.44): 경기 수 또는 다음 중요 경기 직전까지
      if (!g || g.phase !== 'season' || ui.busy) return;
      if (marketPending(g)) return pendingStop(g);
      ui.autoSheet = true;
      render();
      return;
    case 'auto-count':
      ui.autoCount = Number(v) || 1;
      render();
      return;
    case 'auto-run': {
      if (!g || g.phase !== 'season' || ui.busy) return;
      const inp = document.getElementById('auto-n') as HTMLInputElement | null;
      const n = Math.max(1, Math.min(autoSheetVM(g).remaining, Math.floor(Number(inp?.value) || ui.autoCount)));
      ui.autoCount = n;
      ui.autoSheet = false;
      void autoRun(g, { matches: n });
      return;
    }
    case 'auto-until': {
      // data-v = 그 경기 날짜, data-n = 그 전까지 치를 경기 수 (C.67)
      if (!g || g.phase !== 'season' || ui.busy || v === undefined) return;
      ui.autoSheet = false;
      void autoRun(g, { matches: Number(el.dataset.n) || 0, untilDate: v });
      return;
    }
    case 'season-tab': {
      // 요약 ↔ 상세는 다른 화면처럼 맨 위로 (C.60)
      const flip = (v === 'close') !== (ui.seasonTab === null);
      ui.seasonTab = v === 'close' ? null : (v as SeasonTab);
      render();
      if (flip) window.scrollTo(0, 0);
      return;
    }
    case 'dock-more':
      ui.moreSheet = !ui.moreSheet;
      render();
      return;
    case 'noop':
      return;
    case 'raise': {
      if (!g || !ui.alloc) return;
      const before = g.player.coachWarned;
      // 찍기 한 번 = 화면 +1칸 (C.49). [−]는 한 칸씩 되돌린다
      const attr = el.dataset.attr as FieldAttribute;
      if (raiseAttribute(g.player, attr)) ui.alloc.raises.push(attr);
      if (!before && g.player.coachWarned) ui.alloc.coach = true;
      render();
      return;
    }
    case 'lower': {
      if (!g || !ui.alloc) return;
      const attr = el.dataset.attr as FieldAttribute;
      const i = ui.alloc.raises.lastIndexOf(attr);
      if (i >= 0) ui.alloc.raises.splice(i, 1);
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
    case 'alloc-sel': {
      const a = ui.alloc;
      if (!a || !v) return;
      a.sel = a.sel === v ? null : v;
      render();
      return;
    }
    case 'auto-alloc': {
      if (!g || !ui.alloc) return;
      ui.alloc.raises.push(...autoAllocate(g.player));
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
      if (marketPending(g)) return pendingStop(g);
      startNextSeason(g);
      ui.replay = null;
      ui.seasonTab = null;
      autosave();
      go('home');
      showToast({ kind: 'info', title: '휴가 끝 · 소집', body: `${dateLabel(g.calendar.date)} · 개막 7일 전이에요. 훈련 계획을 확인해요.` }, 2600);
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
      const slot = el.dataset.slot as SaveSlot;
      void (async () => {
        const t0 = performance.now();
        await autosave();
        const ok = await saveGame(slot, g);
        if (ok) await copyReplays('auto', slot);
        render();
        showToast(ok ? { kind: 'info', title: '저장했어요', body: `${Math.round(performance.now() - t0)} ms` } : '저장하지 못했어요 (브라우저 저장소를 쓸 수 없음)');
      })();
      return;
    }
    case 'load':
      void loadSlot(el.dataset.slot as SaveSlot);
      return;
    case 'export':
      if (!g) return;
      void (async () => {
        // 카드 이미지 포함 (C.48): 켜면 zip(세이브 + cards/)
        const out = await exportSaveFile(g, ui.exportCards);
        const bytes = out.bytes;
        const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: out.zip ? 'application/zip' : 'application/gzip' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = out.zip ? exportFileName(g).replace(/\.gz$/, '.zip') : exportFileName(g);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast({ kind: 'info', title: '파일로 내보냈어요', body: `${a.download} · ${(bytes.length / 1024).toFixed(0)} KB` }, 2400);
      })();
      return;
    case 'import':
      (document.getElementById('import-file') as HTMLInputElement | null)?.click();
      return;
    case 'hl-rewatch':
      // 방금 경기 하이라이트 다시보기 (C.50): 처음부터 새로 재생, 끝나거나 건너뛰면 결과 화면으로
      if (!ui.replay) return;
      ui.replay.stop();
      ui.replay = new ReplayPlayer(ui.replay.replay, () => render());
      ui.rewatch = 'match';
      go('replay');
      return;
    case 'replay-open': {
      const [season, round] = (v ?? '').split(':').map(Number);
      const x = ui.recent.find((r) => r.season === season && r.round === round);
      if (!x) return;
      void unpackReplayBytes(x.data).then((rp) => {
        ui.replay = new ReplayPlayer(rp, () => render());
        ui.rewatch = 'player';
        go('replay');
      });
      return;
    }
    case 'delete':
      confirmModal({ title: '이 슬롯을 지울까요?', body: '지운 세이브는 되살릴 수 없어요.', confirm: '지우기', act: 'delete-ok', data: { slot: el.dataset.slot! }, tone: 'danger' });
      return;
    case 'delete-ok':
      ui.modal = null;
      void deleteSave(el.dataset.slot as SaveSlot).then(render);
      return;
  }
});

/** 슬롯 불러오기 (자동 저장 슬롯이면 [이어하기]). 리플레이도 같이 불러온다 */
async function loadSlot(slot: SaveSlot): Promise<void> {
  try {
    const t0 = performance.now();
    const loaded = await loadGame(slot);
    if (!loaded) return;
    refreshUnlocks(loaded);
    ui.game = loaded;
    ui.replay = null;
    ui.rewatch = false;
    ui.recent = await loadReplays(slot);
    ui.recentDirty = slot !== 'auto';
    syncReplayIndex();
    loadLog.push(Math.round(performance.now() - t0));
    if (slot !== 'auto') void autosave();
    go(loaded.phase === 'retired' ? 'retired' : 'home');
  } catch (e) {
    showToast((e as Error).message);
  }
}
const loadLog: number[] = [];
(globalThis as unknown as { __loadLog: number[] }).__loadLog = loadLog;

// 파일 가져오기 (25.4 3번)
app.addEventListener('change', (ev) => {
  const input = ev.target as HTMLInputElement;
  if (input.id !== 'import-file' || !input.files?.[0]) return;
  const file = input.files[0];
  input.value = '';
  void (async () => {
    try {
      const { state: st, cards } = await importSaveFile(new Uint8Array(await file.arrayBuffer()), (id) => !!cardById(id));
      refreshUnlocks(st);
      ui.game = st;
      ui.replay = null;
      ui.recent = [];
      ui.recentDirty = true;
      syncReplayIndex();
      await autosave();
      go(st.phase === 'retired' ? 'retired' : 'home');
      showToast({ kind: 'info', title: '세이브를 가져왔어요', body: `${st.player.name} · ${seasonLabel(st.league.season)} 시즌. 자동 저장 슬롯에 들어갔어요.${cards ? ` 카드 이미지 ${cards}장.` : ''}` }, 2600);
    } catch (e) {
      showToast((e as Error).message || '가져오지 못했어요');
    }
  })();
});

// 페이스온 (C.43): 검색 칸, 자르기 슬라이더 (다시 그리지 않고 미리보기만 바꾼다), 이미지·zip 파일
let foTimer = 0;
app.addEventListener('input', (ev) => {
  const t = ev.target as HTMLInputElement;
  // 경기 아이콘 검색 (C.45)
  if (t.id === 'px-q') {
    ui.px.q = t.value;
    clearTimeout(foTimer);
    foTimer = window.setTimeout(() => {
      render();
      const q = document.getElementById('px-q') as HTMLInputElement | null;
      if (q) {
        q.focus();
        q.setSelectionRange(q.value.length, q.value.length);
      }
    }, 200);
    return;
  }
  // 선수 이름 검색 (C.44a)
  if (t.id === 'nm-q') {
    ui.nm.q = t.value;
    clearTimeout(foTimer);
    foTimer = window.setTimeout(() => {
      render();
      const q = document.getElementById('nm-q') as HTMLInputElement | null;
      if (q) {
        q.focus();
        q.setSelectionRange(q.value.length, q.value.length);
      }
    }, 200);
    return;
  }
  if (t.id === 'ca-q') {
    ui.ca.q = t.value;
    clearTimeout(foTimer);
    foTimer = window.setTimeout(() => {
      render();
      const q = document.getElementById('ca-q') as HTMLInputElement | null;
      if (q) {
        q.focus();
        q.setSelectionRange(q.value.length, q.value.length);
      }
    }, 200);
    return;
  }
  // 카드 이미지 위치·확대 (C.48): 다시 그리지 않고 미리보기 그림만 옮긴다
  const cc = ui.ca.crop;
  if (cc && ['ca-zoom', 'ca-x', 'ca-y'].includes(t.id)) {
    const n = Number(t.value);
    if (t.id === 'ca-zoom') cc.zoom = n / 100;
    else if (t.id === 'ca-x') cc.x = n;
    else cc.y = n;
    const lab = document.getElementById(`${t.id}-v`);
    if (lab) lab.textContent = caRangeText(t.id as 'ca-zoom', n);
    document.querySelectorAll<HTMLImageElement>('#ca-prev .po-art').forEach((img) => {
      const full = !!img.closest('.po-gc__photo');
      img.setAttribute('style', artStyle(full ? '50% 30%' : '50% 35%', cc));
    });
    return;
  }
  if (t.id === 'fo-q') {
    ui.fo.q = t.value;
    clearTimeout(foTimer);
    foTimer = window.setTimeout(() => {
      render();
      const q = document.getElementById('fo-q') as HTMLInputElement | null;
      if (q) {
        q.focus();
        q.setSelectionRange(q.value.length, q.value.length);
      }
    }, 200);
    return;
  }
  const c = ui.fo.crop;
  if (!c || !['fo-zoom', 'fo-x', 'fo-y'].includes(t.id)) return;
  const n = Number(t.value) / 100;
  if (t.id === 'fo-zoom') c.zoom = n;
  else if (t.id === 'fo-x') c.x = n;
  else c.y = n;
  const prev = document.getElementById('fo-prev');
  if (prev) prev.setAttribute('style', cropStyle(c));
  const lab = document.getElementById(`${t.id}-v`);
  if (lab) lab.textContent = foRangeText(t.id as 'fo-zoom', Number(t.value));
});

app.addEventListener('change', (ev) => {
  const input = ev.target as HTMLInputElement;
  if (input.id === 'fo-file' && input.files?.[0]) {
    const file = input.files[0];
    const key = input.dataset.key;
    const slot = input.dataset.slot as FaceSlot | undefined;
    input.value = '';
    if (!key || !slot) return;
    const src = URL.createObjectURL(file);
    void loadImage(src).then((img) => {
      const name = lookupEntry(ui.game, key)?.name ?? key.slice(2);
      ui.fo.crop = { key, name, slot, src, zoom: 1, x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
      render();
    }, () => {
      URL.revokeObjectURL(src);
      showToast('이미지를 읽지 못했어요');
    });
    return;
  }
  if (input.id === 'ca-file' && input.files?.[0]) {
    const file = input.files[0];
    const id = input.dataset.key;
    input.value = '';
    if (!id) return;
    const src = URL.createObjectURL(file);
    void loadImage(src).then(() => {
      ui.ca.crop = { id, name: cardById(id)?.name ?? id, src, fresh: true, x: 0, y: 0, zoom: 1 };
      render();
    }, () => {
      URL.revokeObjectURL(src);
      showToast('이미지를 읽지 못했어요');
    });
    return;
  }
  if (input.id === 'fp-file' && input.files?.[0]) {
    const file = input.files[0];
    input.value = '';
    const g = ui.game;
    if (g) setPlayerNames(Object.values(g.rosters ?? {}).flatMap((r) => r.players.map((p) => ({ id: p.id, name: p.name, nameKo: p.nameKo }))));
    void importFacepack(file, (key) => lookupEntry(ui.game, key)?.name, (id) => !!cardById(id)).then((r) => {
      render();
      showToast({ kind: 'info', title: `페이스팩 가져오기 · ${r.added}장${r.cards ? ` · 카드 ${r.cards}장` : ''}`, body: r.skipped.length ? `못 찾은 파일 ${r.skipped.length}개: ${r.skipped.slice(0, 3).join(', ')}` : '모두 넣었어요.' }, 3200);
    }, (e) => showToast((e as Error).message || '가져오지 못했어요'));
  }
});

// 선수 이름 라벨 (C.44a): 별명 > 짧은 이름. 게임 밖(리플레이 파일 등)이면 리플레이 이름의 짧은 이름
setPitchNameResolver((id, isMe, fallback, scope) => (ui.game ? pitchLabel(ui.game, id, isMe, fallback, scope) : fallback.split(/\s+/).pop() ?? fallback));
app.addEventListener('change', (ev) => {
  const t = ev.target as HTMLSelectElement;
  if (t.id === 'px-team') {
    ui.px.team = t.value;
    render();
    return;
  }
  if (t.id !== 'nm-team') return;
  ui.nm.team = t.value;
  render();
});

// 경기 화면 얼굴 보기 (C.43): 리플레이 선수 id = 로스터 id. 로스터가 바뀌면 색인을 다시 만든다
let faceIndex: { of: unknown; map: Map<string, FaceRef> } | null = null;
setPitchFaceResolver((id, isMe, kind) => {
  const g = ui.game;
  if (!g) return undefined;
  const pick = kind === 'pixel' ? pixelSrc : faceSrc;
  if (isMe) return pick(myFace(g));
  if (faceIndex?.of !== g.rosters) {
    const map = new Map<string, FaceRef>();
    for (const r of Object.values(g.rosters ?? {})) for (const p of r.players) map.set(p.id, { id: p.id, age: p.age, appearance: p.appearance });
    faceIndex = { of: g.rosters, map };
  }
  return pick(faceIndex.map.get(id) ?? { id });
});

// 캐릭터 보기 (C.45): 선수 인물 + 이 경기 유니폼(홈·원정·GK) 레이어. 팀을 모르면(게임 밖) 표의 홈 유니폼
setPitchPixelResolver((m, teams) => {
  const g = ui.game;
  if (!g || !m.id) return undefined;
  const kits = teams ? matchKitsOf(g, teams) : null;
  const kit = kits ? (m.teamId === 0 ? (m.gk ? kits.homeGk : kits.home) : (m.gk ? kits.awayGk : kits.away)) : homeKitOf(g, m.id, m.isMe);
  return playerIcon(g, m.id, m.isMe, kit);
});
// 원정 몸통 주황 테두리 (C.54 디자인 139): 두 팀 몸통 밝기가 비슷한 경기
setPitchKitClashResolver((teams) => {
  if (!teams) return false;
  const k = matchKitsOf(ui.game, teams);
  return kitClash(k.home, k.away);
});

applySkin();
mountRotateGate();
render();
void initFaces().then(render, () => render());
void initCardArt().then(render, () => render());
// 카드 그림 (C.48): 못 읽은 그림(404 등)은 지워 기본 장면이 보이게
app.addEventListener('error', (ev) => {
  const t = ev.target;
  if (t instanceof HTMLImageElement && t.classList.contains('po-art')) t.remove();
}, true);
void initSaves().then(render, () => render());
