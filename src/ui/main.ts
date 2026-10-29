// 웹 UI (B.7, U단계 H.6): 모바일 세로 단일 컬럼, 프레임워크 없이 문자열 렌더링 + 이벤트 위임.
// 화면은 src/ui/views/ 모듈이 뷰모델(src/ui/viewModels.ts)만 받아 그리고, 이 파일은 상태와 동작만 맡는다 (부록 H.2)

import { DEFAULT_LEAGUES, leagueCatalog, leagueData } from '../../data/leagues';
import { applyOtherLeagueJob, calendarKind, normalizeLeagues, otherLeagueJobs, syncOtherLeagues } from '../otherLeagues';
import { isFacePhoto, isRace } from '../identity';
import { bodySection, josaIGa, LOOK_NICK_MAX, tagsSheet, type LookVM } from './views/body';
import { chapterReviewed } from '../chapters';
import { buyWeakFoot, chooseInjuryReturn, choosePreset, matchCompLabel, myShirt, nextFixture, recommendPreset, setPresetAuto } from '../game';
import { compNameKo, type CompId } from '../cups';
import { budgetOf, customAct, customNameAfter, customSpec, customVM, initialCustomForm } from './customVM';
import { fitToBudget, prospectToCustom, randomStep, rollCustom, rolledSpec } from './customRandom';
import { autoCustom } from '../custom';
import { HL } from '../highlights';
import { clipScenes, findClips, makeMatchClips, unpackClips, withClips } from '../highlightClips';
import './design/tokens.css';
import './design/bundle.css';
import './design/skin-b.css';
import './style.css';
import './design/season.css';
import { applySkin, isLandPhone, isWide, LANDPHONE_QUERY, setSkin, WIDE_QUERY } from './skin';

import type { FieldAttribute } from '../attributes';
import type { Difficulty } from '../config/balance';
import {
  acceptMyOffer, applyOther, campDay, canChangePosition, endDay, isVacationDay, setDayTraining, trainingLine, isMatchDay, myMatchPosition, newGame, otherJob, playOthers, randomSeed, playRound, retire, roundMatch,
  nextCampDate, startNextSeason, todaysOthers, upcomingOthers, type GameState,
} from '../game';
import { addDays, dateLabel, daysBetween } from '../calendar';
import { addCustomPreset, deleteCustomPreset, updateCustomPreset, type TrainingKind, type TrainingState } from '../training';
import { gaugeSection, presetEditSheet, presetSection, todayRow, trainingSection, trainingSheet, weekPreview } from './views/training';
import { playNpcMatch } from '../engine/npcMatch';
import { EnginePool } from './enginePool';
import type { EngineJob } from '../engine/jobs';
import { adviceTakenText, checkAdviceTaken } from '../aptitude';
import { MyMatchRun, playMyMatch, type MyMatchOutput } from '../engine/adapter';
import type { Moment, StopLevel } from '../engine/moments';
import { elapsedMapper, replayEvents, replayPlayers } from '../replay';
import { ENGINE } from '../engine/config';
import { animCard, cardDetailVM, cardSheet, deckHomeSection, deckUnusable, deckView, deckVM, demoAnimCards, myRoleId } from './views/deck';
import { playGoalSplash, saveGoalSplashPref } from './goalSplash';
import { markPickSeen, pickKey, pickSeen, playPackReveal, rarityRank, savePackAnimPref, bestRarity, type PackAnimPref } from './packAnim';
import { canAdd, deckProblems, takePick } from '../cardCollection';
import { cardById } from '../config/cards';
import { MomentPitch, momentCrop, momentView, OutcomePitch, outcomeView, shownOptions, type MomentVM, type OutcomeVM } from './views/moment';
import { decisionOutcome, OUTCOME, outcomeBand } from '../decisionOutcome';
import { ratingFromParts, ratingParts } from '../engine/rating';
import { autoAllocate, raiseAttribute } from '../growth';
import { positionOvrExact, type PlayablePosition } from '../positions';
import { leagueOfTeam, teamById } from '../league';
import {
  copyReplays, deleteSave, exportFileName, initSaves, listSaves, loadGame, loadReplays, packReplayBytes, REPLAY_KEEP, SAVE_SLOTS, SaveFormatError, saveGame,
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
import { Banner, Button, esc, HERO_NAME, HeroPanel, Icon, Modal, Tabs, Toast, type ToastProps } from './components';
import {
  allocateVM, autoSheetVM, RARITY_KO, cupsWorldVM, homeVM, visiblePoints as homePoints, myFace, positionOptionsVM, matchResultVM, newGameVM, playerVM, replayStaticVM, retiredVM, chapterReviewVM, savesVM, seasonLabel, seasonVM, versionVM, worldVM,
} from './viewModels';
import { drawAvgMap } from './views/avgMap';
import { dock, dockMoreSheet, pitchViewSheet, roJosa, routeOf, type DockVM } from './views/common';
import { autoLayerHtml, autoResultsHtml, autoSheet, type AutoResultLine } from './views/progress';
import { isPortraitPitch, setMomentZoom, setPitchFaceResolver, setPitchKitClashResolver, setPitchNameResolver, setPitchNames, setPitchOrient, setPitchPixelResolver, setPitchSize, setPitchTeams, setPitchView, setPitchWeather } from './pitch/renderer';
import { homeView, injuryReturnSheet, positionChangeSection, positionSheet, recordsLinkRow, recordsSection, scheduleView } from './views/home';
import { takeFreshRecords } from '../records';
import { goalsSection, homeInboxSection, inboxDetailBody, inboxDetailView, inboxView, rivalSection } from './views/inbox';
import { collectNotices, goalsCardVM, homeInboxVM, inboxDetailVM, inboxVM, rivalCardVM } from './inboxVM';
import { markAllRead, markRead, pendingItems, unreadCount } from '../inbox';
import { loadAutoPrefs, saveAutoPrefs, type AutoPrefs } from './autoPrefs';
import { claimNewGameBonus, loadLegacy, recordRetirement, type LegacyStore } from '../legacy';
import { answerEvent, autoAnswerInterviews, eventById, fireEvent } from '../events';
import { competitionSection, meetingView } from './views/manager';
import { competitionVM, meetingVM } from './managerVM';
import { agentSection, financeView, shopView, staffSection, type FinanceTab } from './views/finance';
import { photoDexView } from './views/photos';
import { photoDexVM } from './photoVM';
import { nationalView, type NationalTab } from './views/national';
import { nationalVM } from './nationalVM';
import { awardsView, type AwardsTab } from './views/awards';
import { awardsVM } from './awardsVM';
import type { PhotoSort } from '../photocards';
import { agentVM, financeVM, staffVM } from './financeVM';
import { hireStaff, startScout, toggleLeave, ensureMoney } from '../money';
import { buyPack, buyShopCard, donate, donateBlocked, moveInvest, setLife, useTp, type InvestKind, type LifeItem, type TpKind } from '../wealth';
import { holdMeeting, type MeetingChoice } from '../manager';
import { prepView } from './views/prep';
import { prepVM } from './prepVM';
import { proficiencyOf, requestPositionChange } from '../proficiency';
import { celebrateView, matchResultView } from './views/matchResult';
import { celebrateVM, compRecordVM, seasonCompsVM } from './seasonVM';
import { compRecordSection, homeTodoRow, seasonCompsSection } from './views/season';
import { playerView, type PlayerTab } from './views/player';
import { ReplayPlayer, replayView } from './views/replay';
import { allocateView, chapterView, NEW_GAME_UI, newGameView, retiredView, type NewGameUI, savesView, seasonView, titleView, worldView, cupsSection, cupSubDefault, type SeasonTab, type SeasonTodo } from './views/screens';
import { halftimeView, tacticsView } from './views/tactics';
import { contractView, marketCard, newsSection, offersView, tagNewsSection } from './views/transfer';
import { marketVM, newsVM } from './transferVM';
import { cropStyle, foRangeText, lookupEntry, myLookVM, SET_UI_DEFAULT, settingsView, setPrecomputeStatus, type FaceOnUI, type NameUI, type PixelUI, type SetPage, type SetSec, type SetUI } from './views/settings';
import { CARD_ART_UI_DEFAULT, caRangeText, type CardArtUI, type CardKindFilter } from './views/cardArtSettings';
import { applyUpdate, registerServiceWorker, updateReady } from '../pwa/register';
import { clearCardArt, exportSaveFile, importSaveFile, initCardArt, normalizeArt, setCardArt, setCardArtPos, userArtBlob, cardArtPos } from './cardArt';
import { artLayer } from './components/gameCard';
import { emptyOverrides, kitClash, setKitOverride, setPersonOverride } from '../pixel';
import { autoShortNames, pitchLabel } from './playerNames';
import { setNameOverride } from '../names';
import { clearFaceOn, setFaceOnCutout, faceSrc, pixelSrc, type FaceRef, squareToBlob, exportFacepack, importFacepack, initFaces, loadImage, setFaceOn, setPlayerNames, type FaceSlot } from './faces';
import { homeKitOf, matchKitsOf, playerIcon } from './pixelIcons';
import { declineOffer, declineOffers, midWindowKo, windowKo, marketPending, renewContract, requestTransfer, requestEligibility, releaseChance } from '../transfer';
import { jerseyPanelVM, showroomVM } from './jerseyVM';
import { showroomView } from './views/showroom';
import { requestJersey, showcasePut, showcaseTake } from '../jerseys';
import { feedKind, setSeasonLabelKind, injuryReturnVM, presetEditVM, recordRowsVM, replayIndex, halftimeSets, halftimeVM, tacticsVM, trainingOptionsVM, type HalftimeDraft, type TacticsDraftUI } from './viewModels';
import { customized, defaultSlot, moveSlot, slotPos, startCustom, withFormation, withTendency, type MyTactics } from '../myTactics';
import { nearestCell } from '../formations';
import { OUTSIDE_CLUBS } from '../../data/outsideClubs';

/** 유스 구단 이름: 리그 팀 > 리그 밖 구단 > 실제 선수 데이터의 한글 이름 그대로(예 '함부르크', C.55: teamById 가 던져 선수 화면이 안 열리던 것) */
function youthClubName(g: GameState, club: string): string {
  return g.league.teams.find((t) => t.id === club)?.nameKo ?? OUTSIDE_CLUBS.find((c) => c.id === club)?.nameKo ?? club;
}
import { tacticsOf, tendencyLevels, TENDENCY_NAMES_KO, type Detail, type Level } from '../engine/tactics';
import type { Formation } from '../formations';
import type { Tendency } from '../engine/types';
import { proficientOvr } from '../proficiency';
import { hasTeamDetail, leftPersonVM, personDetailVM, teamDetailVM, type PersonTab, type TeamTab } from './detailVM';
import { leftPersonView, personDetailView, teamDetailView } from './views/detail';
import type { FieldPosition } from '../positions';

type TrainTab = 'pre' | 'cal' | 'g' | 'staff';
type Screen = 'title' | 'new' | 'home' | 'match' | 'moment' | 'replay' | 'allocate' | 'player' | 'world' | 'season' | 'saves' | 'retired' | 'tactics' | 'deck' | 'offers' | 'contract' | 'settings' | 'schedule' | 'prep' | 'team' | 'person' | 'meeting' | 'inbox' | 'finance' | 'shop' | 'chapter' | 'dex' | 'showroom' | 'national' | 'awards';

interface ModalState {
  title: string; body?: string; rows?: [string, string][]; confirm: string; act: string; data?: Record<string, string>; tone?: 'info' | 'warning' | 'danger';
  /** 취소 버튼 대신 다른 동작 (기본은 "취소" = 닫기) */
  cancel?: { label: string; act: string; data?: Record<string, string> };
}

const ui = {
  screen: 'title' as Screen,
  game: null as GameState | null,
  toast: null as ToastProps | null,
  /** 방금 경기에서 레벨업 (C.70 디자인 162 홈 배너 "Lv n · 포인트 +n"). 포인트 찍기에 들어가면 지운다 */
  lvUp: null as { level: number; plus: number } | null,
  /** 레벨업 토스트를 홈에 처음 올 때 띄울지 (C.72 디자인 162: 홈 배너 + 독 위 토스트. 결과 화면은 배너만) */
  lvToast: false,
  /** 방금 경기 앞뒤 신뢰도·위상 변화 (C.72 디자인 170 보상 줄, 화면 표시만 · 세이브 안 함) */
  matchDelta: null as { trust: number | null; rep: number } | null,
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
  cardSheet: null as null | { id: string; from: 'deck' | 'pool' | 'view' },
  worldTab: 'table' as 'table' | 'stars' | 'scorers' | 'transfers' | 'cups',
  /** 리그 스타 묶음 · 리그 기록 거르기 (C.64) */
  starGroup: 'league' as 'league' | 'world' | 'young',
  worldBoard: 'goals' as 'goals' | 'assists' | 'rating',
  /** 월드 순위·득점 리그 (C.76c): '' = 내 리그, 아니면 고른 다른 리그 id */
  worldLeague: '',
  /** 월드 컵·챔스 묶음 · 국내 컵 라운드 (C.76j 205): null = 지금 시점 기본 */
  /** 본 우승 축하 (C.76j 207): 이 키면 다시 띄우지 않음 (세이브에 담지 않음) */
  celebrated: '' as string,
  cupSub: null as null | 'groups' | 'ko' | 'fa',
  cupRound: null as number | null,
  /** 재계약 화면에서 고른 연수 (C.42) */
  renewYears: null as number | null,
  /** 주 포지션 변경 요청 시트 (D.3): 고른 포지션 */
  posSheet: null as string | null,
  /** 부상 복귀 선택 시트 (C.74b) */
  injSheet: false,
  /** 하루 훈련 고르기 시트 (C.41): 날짜 */
  trainSheet: null as string | null,
  /** 하루 훈련 시트에서 고른 줄 (확정 전, C.57) */
  trainPick: null as string | null,
  /** 훈련·일정 화면 탭 (C.52, C.77q 스태프 탭 추가) */
  trainTab: 'pre' as TrainTab,
  /** 커스텀 프리셋 편집 시트 (C.52): id null = 새로 만들기 */
  presetSheet: null as null | { id: string | null; sel: number; draft: { name: string; slots: TrainingKind[] } | null },
  /** 내 최근 5경기 리플레이 (25.4 2번, C.41): 자동 저장 슬롯과 같이 저장한다. dirty 면 다음 자동 저장 때 쓴다 */
  recent: [] as StoredReplay[],
  recentDirty: false,
  /** 다시 보기 중이면 끝났을 때 돌아갈 화면 (경기 중 잠금 아님): 지난 경기 = 선수, 방금 경기 하이라이트 = 결과 (C.50) */
  rewatch: false as false | 'player' | 'match',
  /** 하이라이트 클립 다시 보기 중이면 그 전 재생기 (C.77o): 끝나면 되돌린다 */
  clipBack: null as null | { replay: ReplayPlayer | null },
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
    /** 하프타임 전술 초안 (C.75k): 경기 전 전술(base)에서 시작 */
    ht?: { draft: HalftimeDraft; base: Pick<HalftimeDraft, 'tendency' | 'levels'> } | null;
    /** PC 결정 순간 "최근 흐름" (218, C.76f): 멈출 때 한 번 만든다 */
    feed?: MomentVM['feed'];
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
  /** 자동 진행 설정 (22.2, C.73b): 포인트 추천 배분 · 선택 이벤트/부상에서 멈춤. localStorage */
  autoPrefs: loadAutoPrefs(),
  /** 명예의 전당 (18.11, C.73b): 커리어 요약에 들어올 때 기록한 결과 */
  legacy: null as null | { rank: number | null; legacy: LegacyStore },
  /** 독 더보기 시트 (모바일) */
  moreSheet: false,
  /** 더보기 줄을 끝까지 민 상태 (C.72 디자인 Dock `is-end`): 다시 그려도 위치를 지킨다 */
  moreEnd: false,
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
  /** 새 버전 알림 띠 [나중에] (C.77r): 이번 실행 동안 숨긴다 */
  swLater: false,
  /** 선수 화면 태그 전체 시트 (C.47 → C.58 디자인 135) */
  tagsAll: false,
  /** 선수 화면 탭 (C.58 디자인 93~96·134·136), 몸·태그 탭 이름표 편집 펼침 */
  playerTab: 'attrs' as PlayerTab,
  /** 재정 화면 탭 (C.68b) */
  financeTab: 'money' as FinanceTab,
  /** 상점에서 방금 연 카드팩 (C.77q, 세이브 밖): 상점 화면에 mini 로 남겨 눌러서 상세를 본다 */
  lastPack: [] as string[],
  /** 포토카드 도감 (C.75t): 정렬 · 내림차순 · 뒤집은 카드 */
  dex: { sort: 'no' as PhotoSort, desc: false, flip: null as string | null, open: false },
  /** 대표팀 화면 (C.76d): 탭 · 고른 대회 */
  nat: { tab: 'fixtures' as NationalTab, cup: null as string | null },
  // 개인 시상 (C.76n): 탭 · 연도 · 역대 수상자 상
  aw: { tab: 'year' as AwardsTab, season: null as number | null, hist: null as string | null, group: null as string | null, cer: null as { id: string; step: number } | null },
  lookName: false,
  /** 선수 포지션 탭 레전더리 대회 조건 펼침 (C.71a 디자인 182) */
  legendOpen: false,
  /** 새 게임 화면 상태 (C.58): 실제 선수 묶음·검색·정렬·포지션군·보이는 수, 랜덤 능력치 펼침, 커스텀 단계 */
  ng: { ...NEW_GAME_UI } as NewGameUI,
  /** 포인트 찍기 규칙 펼침 (C.58) */
  allocRule: false,
  /** 덱 화면에서 편집 중인 덱 세트 (C.36) */
  deckSet: null as number | null,
  /** 덱 화면에서 돌아갈 곳 (C.51) */
  deckBack: 'home' as 'home' | 'prep',
  form: {
    /** 시작 방식 (C.74d): 커스텀(기본) · 실제 선수. 'prospect' = 커스텀 [전체 랜덤] 결과 화면 */
    mode: 'custom' as 'prospect' | 'real' | 'custom', name: '', position: 'ST' as PlayablePosition, seed: '', difficulty: 'normal' as Difficulty, realId: '',
    /** 레전드 팩 (C.47) */
    legends: 'off' as 'on' | 'off',
    /** 미래 스타 팩 (C.75y, 레전드 팩과 따로) */
    futureStars: 'off' as 'on' | 'off',
    /** 고른 리그 (C.75m 리그 고르기): 기본 묶음. 데이터 없는 리그는 시작할 때 빠진다 */
    leagues: [...DEFAULT_LEAGUES] as string[],
    /** 전체 랜덤 시작 팀 (45b b): '' = 랜덤. 시작 팀 고르기 리그 탭 */
    startTeam: '',
    pickLeague: '',
    /** 시드를 비웠을 때 쓰는 무작위 시드 (가상 유망주 시작 후보를 미리 보여 주려고 화면에 들어올 때 정한다, C.37) */
    roll: '',
    /** 시작 후보를 정한 시드 (바뀌면 고른 자리를 후보 1위로 되돌린다) */
    posFor: '',
    /** "다른 포지션에서 고르기" 펼침 */
    others: false,
    /** 랜덤 인종·기본 사진 (C.73c): '' = 시드 랜덤 / 인종 사진 */
    race: '',
    photo: '',
    /** 커스텀 생성 (C.45) */
    cu: initialCustomForm(),
    /** [이 단계 랜덤] 누른 횟수 (C.74d): 시드 + 횟수로 뽑아 같은 시드·같은 순서면 같은 결과 */
    rand: 0,
    /** 이름이 랜덤으로 채운 것인지 (C.75z): 국적·인종을 바꾸면 랜덤 이름·빈 칸은 새로 뽑고 직접 입력한 이름은 둔다 */
    nameAuto: false,
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
  ui.form.position = rollCustom(key).candidates[0]!.pos;
  ui.form.others = false;
  ui.form.race = '';
  ui.form.photo = '';
}

const app = document.getElementById('app')!;
/** 새 기능 소개를 띄우는 화면 */
const NAV_SCREENS: Screen[] = ['home', 'player', 'world'];
/** 하단 독을 숨기는 화면 (C.44: 게임 중 모든 화면에 고정) */
const NAV_HIDDEN: Screen[] = ['title', 'new', 'retired', 'chapter'];

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
/** 선수 화면 "내 모습" (C.71a 디자인 177): 이름표 [편집]은 설정의 이름 칸 대신 별명 칸 + 미리 보기를 그 줄 아래로 펼친다 */
function myLookWithEdit(g: GameState): LookVM {
  const look = myLookVM(g, false);
  if (!ui.lookName) return look;
  const id = myFace(g).id;
  const o = g.nameOverrides[id] ?? {};
  return { ...look, edit: { id, nick: o.nickname ?? '', auto: o.shortName || (autoShortNames(g).get(id) ?? g.player.name), own: !!(o.nickname || o.shortName), full: g.player.name } };
}

/** 새 게임 화면 명예의 전당 보너스 줄 (C.73b) */
function newGameBonusVM(): { rarity: string; from: string; legend: boolean } | null {
  const b = loadLegacy().bonus;
  return b ? { rarity: RARITY_KO[b.rarity] ?? b.rarity, from: b.from, legend: b.legend } : null;
}

const LOCK_ACTS = new Set([
  'buy-weakfoot', 'play', 'day-one', 'day-continue', 'sim-rest', 'auto-run', 'auto-until', 'auto-end', 'raise', 'lower', 'auto-alloc', 'alloc-reset', 'alloc-done', 'tac-save',
  'deck-add', 'deck-remove', 'deck-use', 'pick-take', 'pos-change', 'next-season', 'retire', 'retire-ok', 'chapter-done', 'save', 'load', 'delete-ok',
  'start', 'continue', 'opt-quick', 'ctl-mode', 'ctl-stop', 'train-set', 'train-focus', 'preset-pick', 'preset-apply', 'preset-auto', 'preset-save', 'preset-del', 'export', 'import',
  'offer-accept', 'offer-accept-ok', 'offer-decline', 'offers-decline', 'renew', 'transfer-request', 'transfer-request-ok',
  'ca-upload', 'ca-adjust', 'ca-clear', 'ca-crop-save', 'to-title', 'to-title-ok',
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
/** 우승 축하 한 장 (C.76j 디자인 207): 경기 결과 화면에서 한 번 */
function celebrateHtml(g: GameState | null): string {
  if (!g || ui.screen !== 'match') return '';
  const vm = celebrateVM(g);
  return vm && ui.celebrated !== vm.key ? celebrateView(vm) : '';
}

/** 월드 컵·챔스 탭 (C.76j 205): 고른 묶음·라운드 */
function cupsView(g: GameState): string {
  const vm = cupsWorldVM(g);
  return cupsSection(vm, ui.cupSub ?? cupSubDefault(vm), ui.cupRound, !!ui.more.cupTies);
}

(globalThis as unknown as { __game: () => GameState | null }).__game = () => ui.game;
/** 캡처 스크립트용 (C.76i): 이벤트를 인박스에 띄운다 */
(globalThis as unknown as { __fireEvent: (id: string) => number | null }).__fireEvent = (id) => { const d = eventById(id); return ui.game && d ? fireEvent(ui.game, d).id : null; };

/** 방금 치른 내 경기 리플레이를 최근 5경기에 넣는다 */
async function keepReplay(g: GameState, r: Replay, rep: { season: number; round: number; opponentId: string; result: { goalsFor: number; goalsAgainst: number }; cup?: { comp: CompId; stage: string }; nat?: { label: string } }): Promise<void> {
  const { season, round } = rep;
  const label = `${rep.nat ? rep.nat.label : rep.cup ? `${compNameKo(rep.cup.comp, g.league.id)} ${rep.cup.stage}` : `${round}R`} ${teamById(g.league, rep.opponentId)?.nameKo ?? ''} ${rep.result.goalsFor}-${rep.result.goalsAgainst}`;
  // 경기 후 하이라이트 3개 (24.6, C.77o): 클립 구간 프레임만 세이브에 (최근 CLIP.keep 경기)
  const mc = makeMatchClips(r, { season, round, label });
  if (mc) g.clips = withClips(g.clips, mc);
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
  // 은퇴 후 (18.11, C.73b): 커리어 요약에 들어오면 명예의 전당에 기록하고 새 게임 보너스를 예약한다 (커리어마다 한 번, 세이브 밖 localStorage)
  if (screen === 'retired' && ui.game?.phase === 'retired') ui.legacy = recordRetirement(ui.game);
  render();
  window.scrollTo(0, 0);
  // 디자인 162 (C.72): 레벨업 토스트는 경기 뒤 홈에 처음 왔을 때 독 위에 (홈·결과 공통 위치 .toast-wrap.is-bottom)
  const g = ui.game;
  if (screen === 'home' && ui.lvToast && ui.lvUp && g) {
    ui.lvToast = false;
    if (g.player.unspentPoints > 0) showToast({ kind: 'levelup', title: `Lv ${ui.lvUp.level} · 포인트 +${ui.lvUp.plus}`, body: `찍을 포인트가 ${g.player.unspentPoints}P가 됐어요`, action: '찍기', onAction: { act: 'go', data: { to: 'allocate' } } }, 3000);
  }
}

/** 옛 진입점 → 새 위치 (C.77q 메뉴 정리, routeOf): 탭을 맞추고 화면을 돌려준다 */
function redirectScreen(to: string, tab?: string): Screen {
  const r = routeOf(to, tab);
  if (r.trainTab) ui.trainTab = r.trainTab;
  if (r.playerTab) ui.playerTab = r.playerTab as PlayerTab;
  return r.screen as Screen;
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

/** 기록 달성 토스트 (C.74b): 경기 뒤 깬 기록 (여럿이면 첫 기록 + 나머지 수) */
function recordToast(g: GameState): void {
  const f = takeFreshRecords(g);
  if (!f.length) return;
  const xp = f.reduce((t, r) => t + r.xp, 0);
  const rep = f.reduce((t, r) => t + r.rep, 0);
  showToast({ kind: 'badge', title: `기록 · ${f[0]!.title}${f.length > 1 ? ` 외 ${f.length - 1}개` : ''}`, body: `XP +${xp}${rep ? ` · 위상 +${rep}` : ''}` }, 2600);
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
      return newGameView({ ...newGameVM({ ...ui.form, seed: ui.form.seed, roll: prospectSeed() }), bonus: newGameBonusVM() }, ui.form.mode === 'custom' ? customVM(ui.form.cu, ui.form.name, normalizeLeagues(ui.form.leagues)[0], ui.form.pickLeague) : undefined, ui.ng);
    case 'saves': return savesView(savesVM(listSaves(), SAVE_SLOTS), !!g && g.phase !== 'retired', versionVM(g), ui.exportCards);
    case 'settings': return settingsView(g, ui.fo, versionVM(g), ui.nm, ui.px, ui.ca, !!liveScreen(), ui.set);
    default: break;
  }
  if (!g) return titleScreen();
  if (g.phase === 'retired' && !['retired', 'season', 'saves', 'player', 'chapter'].includes(ui.screen)) return retiredView(retiredVM(g));
  switch (ui.screen) {
    case 'home': {
      const canPos = canChangePosition(g);
      const inSeason = g.phase === 'season';
      const pos = canPos ? positionChangeSection(g.player.position, Math.floor(proficiencyOf(g.player, g.player.position)), inSeason) : '';
      const ivm = ui.injSheet ? injuryReturnVM(g) : null;
      const sheet = (ui.posSheet && canPos ? positionSheet(positionOptionsVM(g), ui.posSheet, inSeason) : '') + (ivm ? injuryReturnSheet(ivm) : '');
      collectNotices(g);
      const list = g.player.history.length === 0 ? checklistItems(g.guide) : null;
      const deck = g.cards ? deckHomeSection({ active: g.cards.active, count: g.cards.decks[g.cards.active]?.length ?? 0, unusable: deckUnusable(g, myRoleId(g)), picks: 0 }) : '';
      const hvm = homeVM(g);
      hvm.exit = !liveScreen();
      hvm.inbox = unreadCount(g);
      // C.70 (디자인 162): 방금 레벨업했으면 포인트 배너를 "Lv n · 포인트 +n" 으로
      if (ui.lvUp && hvm.points > 0) hvm.banners = hvm.banners.map((b) => (b.to === 'allocate' ? { ...b, title: `Lv ${ui.lvUp!.level} · 포인트 +${ui.lvUp!.plus}`, body: `레벨이 올랐어요. 찍을 포인트가 ${hvm.points}P가 됐어요.` } : b));
      // C.57 (디자인 133): 닫을 수 있는 알림(태그·구단 거절 소식·포변 조언)이 둘 이상이면 위에 "알림 n · 모두 닫기"
      const mvm = marketVM(g);
      // 감독 면담 (C.62): 열린 면담 띠(닫기 없음). 알림(태그·포변 조언·면담 결과·이적 소식)은 인박스로 (C.63, 홈에는 안 읽은 것 3개)
      const comp = competitionVM(g);
      const meetBand = comp?.meeting ? Banner({ tone: 'info', title: '감독이 면담하자고 해요', children: comp.hint, action: '면담하기', onAction: { act: 'go', data: { to: 'meeting' } } }) : '';
      const hin = homeInboxVM(g);
      const rv = rivalCardVM(g);
      const gl = goalsCardVM(g);
      // C.70 (디자인 161): 다음 경기 → 오늘 훈련 → 카드 덱 → (기록·주전 경쟁·라이벌) → 안내·포변. C.76g (디자인 204): 시즌 목표는 다음 경기 바로 아래
      return homeView(hvm, (list ? checklistPanel(list) : '') + pos, recordsLinkRow(recordRowsVM(g).length) + (comp ? competitionSection(comp) : '') + (rv ? rivalSection(rv) : ''), (hvm.training ? todayRow(hvm.training, hvm.day?.full ?? '') : '') + deck, meetBand + marketCard(mvm) + homeInboxSection(hin.rows, hin.unread), gl ? goalsSection(gl) : '', homeTodoRow(g.cards?.picks.length ?? 0) + seasonCompsSection(seasonCompsVM(g))) + guideResetLink() + sheet;
    }
    case 'schedule': {
      const hvm = homeVM(g);
      const tOpts = ui.trainSheet ? trainingOptionsVM(g, ui.trainSheet) : null;
      const tv = hvm.training;
      // 훈련·일정 탭 (C.52, 디자인 159): 훈련 프리셋 · 일정 · 게이지 · 코치·스태프(C.77q, 재정에서 옮김 — 비시즌에도 일정 · 코치·스태프 두 탭)
      const tab: TrainTab = tv || ui.trainTab === 'staff' ? ui.trainTab : 'cal';
      const coach = g.phase !== 'retired' ? (g.money?.candidates.length ?? 0) : 0;
      const staffTab = { id: 'staff', label: coach ? `스태프 ${coach}` : '스태프' };
      const tabs = g.phase === 'retired' ? '' : Tabs({ items: tv ? [{ id: 'pre', label: '훈련 프리셋' }, { id: 'cal', label: '일정' }, { id: 'g', label: '게이지' }, staffTab] : [{ id: 'cal', label: '일정' }, staffTab], value: tab, variant: 'underline', fill: true, act: 'train-tab', label: '훈련·일정' });
      const body = tab === 'staff' ? staffSection(staffVM(g)) : !tv ? '' : tab === 'pre' ? presetSection(tv.presets) + weekPreview(tv) : tab === 'g' ? gaugeSection(tv) : trainingSection(tv, false);
      const pSheet = tv && ui.presetSheet ? presetEditSheet(presetEditVM(g, ui.presetSheet.id, ui.presetSheet.draft, ui.presetSheet.sel)) : '';
      return scheduleView(hvm, tabs + body, tab === 'cal') + (tOpts ? trainingSheet({ ...tOpts, weakFoot: weakFootLine(g) }, ui.trainSheet!, ui.trainPick) : '') + pSheet;
    }
    case 'deck': {
      const vm = deckVM(g, ui.deckSet ?? g.cards.active, myRoleId(g));
      const cs = ui.cardSheet;
      const c = cs && cs.from !== 'view' ? (cs.from === 'deck' ? vm.deck : vm.pool).find((x) => x.id === cs.id) : undefined;
      return deckView(vm, cs && c ? { from: cs.from, card: c } : null, ui.deckBack, { sel: ui.pickSel, later: !!ui.more.pickLater });
    }
    case 'player': {
      const p = g.player;
      const youth = p.youth ? youthClubName(g, p.youth.club) : '';
      const body = bodySection(p, g.phase !== 'retired' && p.body.weakFoot < 5 && p.unspentPoints >= BALANCE.weakFoot.pointCost, myShirt(g), youth, myLookWithEdit(g),
        p.youth && g.league.teams.some((t) => t.id === p.youth!.club) ? p.youth.club : '');
      return playerView(playerVM(g), { tab: ui.playerTab, body, records: recordsSection(recordRowsVM(g)) + compRecordSection(compRecordVM(g)), market: g.phase !== 'retired' ? marketVM(g) : null, agent: g.phase !== 'retired' ? agentSection(agentVM(g)) : '', points: p.unspentPoints, retired: g.phase === 'retired', legendOpen: ui.legendOpen })
        + (ui.tagsAll ? tagsSheet(p, p.name, youth) : '');
    }
    case 'world': return worldView(worldVM(g, ui.worldLeague), ui.worldTab, ui.worldTab === 'transfers' ? newsSection(newsVM(g), ui.more) + tagNewsSection((g.tagNews ?? []).slice().reverse().map((n) => ({ season: seasonLabel(n.season), name: n.name, team: teamById(g.league, n.teamId).nameKo, tag: n.tag })), ui.more) : '', ui.more, ui.starGroup, ui.worldBoard, ui.worldTab === 'cups' ? cupsView(g) : '');
    case 'offers': return offersView(marketVM(g), ui.offerSel);
    case 'inbox': {
      collectNotices(g);
      const dv = ui.inboxSel !== null ? inboxDetailVM(g, ui.inboxSel) : null;
      // C.76i (디자인 193·194 PC): 넓은 화면은 왼쪽 목록 / 오른쪽 상세(고른 것, 없으면 맨 위 줄 — 읽음 처리는 안 함)
      if (isWide()) {
        const lv = inboxVM(g, ui.inboxTab);
        const side = dv ?? (lv.rows[0] ? inboxDetailVM(g, lv.rows[0].id) : null);
        return inboxView(lv, side ? `<div class="panel ib-side">${inboxDetailBody(side, ui.inboxPick, true).body}</div>` : '', side?.id ?? null);
      }
      return dv ? inboxDetailView(dv, ui.inboxPick) : inboxView(inboxVM(g, ui.inboxTab));
    }
    case 'meeting': {
      const mv = meetingVM(g);
      if (!mv) { ui.screen = 'home'; return screenHtml(); }
      return meetingView(mv, ui.meetSel);
    }
    case 'contract': return contractView(marketVM(g), ui.renewYears);
    case 'finance': return financeView(financeVM(g), ui.financeTab);
    case 'shop': {
      // 상점 (C.77q): 카드를 누르면 덱과 같은 카드 상세 시트 (from 'view' = 닫기만)
      const sc = ui.cardSheet?.from === 'view' ? cardDetailVM(g, ui.cardSheet.id, myRoleId(g)) : null;
      return shopView(financeVM(g), { lastPack: ui.lastPack, sheet: sc });
    }
    case 'dex': return photoDexView(photoDexVM(g, ui.dex.sort, ui.dex.desc, ui.dex.flip), ui.dex.open);
    case 'showroom': return showroomView(showroomVM(g));
    case 'national': return nationalView(nationalVM(g, ui.nat.cup), ui.nat.tab);
    case 'awards': return awardsView(awardsVM(g, ui.aw.season, ui.aw.hist, ui.aw.group, ui.aw.cer), ui.aw.tab);
    case 'replay':
      if (ui.replay) return replayView(ui.replay.vm(replayStaticVM(ui.replay.replay, g)));
      break;
    case 'moment': {
      const lv = ui.live;
      if (lv?.oc) return outcomeView(lv.oc.vm);
      const m = lv?.run.pending;
      if (lv && m?.type === 'halftime' && lv.ht) return halftimeView(halftimeVM(lv.ht.draft, lv.ht.base, lv.teams, m.score, m.side));
      if (lv && m) {
        const log = lv.run.sim.state.moments.log;
        return momentView({ moment: m, teams: lv.teams, selected: lv.sel, card: lv.card, stop: g.control.stop, last: log.at(-1) ?? null, count: log.length + 1, ...(lv.feed ? { feed: lv.feed } : {}) });
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
    case 'retired': return retiredView(retiredVM(g, ui.legacy));
    case 'chapter': {
      // 챕터 리뷰 (C.73a): 볼 리뷰가 없으면 시즌 요약(은퇴면 커리어 요약)으로
      const cvm = chapterReviewVM(g);
      if (cvm) return chapterView(cvm);
      return g.phase === 'retired' ? retiredView(retiredVM(g)) : seasonView(seasonVM(g)!);
    }
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
      const left = leftPersonVM(g, ui.detail.person);
      if (left) return leftPersonView(left, ui.detail.stack.length > 0);
      return `${HeroPanel({ title: '선수', back: ui.detail.stack.length ? { act: 'detail-back' } : false, compact: true, pad: false, progress: false, value: '—' })}<div class="body"><p class="muted">이 선수는 지금 리그 팀에 없어요(리그 밖 이적·은퇴).</p></div>`;
    }
    case 'prep': {
      const vm = prepVM(g);
      if (vm && isMatchDay(g)) {
        const cs = ui.cardSheet?.from === 'view' ? vm.deck.cards.find((x) => x.id === ui.cardSheet!.id) : undefined;
        return prepView(vm) + (cs ? cardSheet({ from: 'view', card: cs }, vm.deck.cards.length) : '');
      }
      return homeView(homeVM(g));
    }
    default: break;
  }
  const vm = matchResultVM(g, ui.replay?.replay ?? null);
  return vm ? matchResultView(vm, ui.more, ui.rewatch ? null : ui.matchDelta, jerseyPanelVM(g)) : homeView(homeVM(g));
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
 * 한 줄 유지, 최소에서도 넘치면 그때만 말줄임(CSS). 글꼴(PO Head)이 늦게 오면 받은 뒤 한 번 더
 */
function fitHeroNames(): void {
  for (const el of app.querySelectorAll<HTMLElement>('.po-hero__name[data-fit]')) {
    let size = Number(el.dataset.fit) || HERO_NAME.full;
    const apply = () => { el.style.fontSize = `${size}px`; el.style.lineHeight = `${Math.round(size * 1.08)}px`; };
    // scrollWidth·clientWidth는 정수로 반올림돼 1px 미만 넘침(말줄임은 됨)을 못 잡는다 → 글자 실폭(Range)을 소수점까지 잰다 (C.75u)
    const range = document.createRange();
    range.selectNodeContents(el);
    const over = () => typeof range.getBoundingClientRect === 'function'
      ? range.getBoundingClientRect().width > el.getBoundingClientRect().width - 1
      : el.scrollWidth > el.clientWidth;
    apply();
    while (size > HERO_NAME.min && over()) {
      size--;
      apply();
    }
  }
}
void document.fonts?.ready.then(fitHeroNames);
document.fonts?.addEventListener?.('loadingdone', () => fitHeroNames());
// PC 2열 (C.61): 1024px 경계를 넘으면 배치가 바뀌는 화면이 있어 다시 그린다. 가로 폰(C.66)도 같은 2열이라 돌릴 때 다시 그린다
globalThis.matchMedia?.(WIDE_QUERY).addEventListener?.('change', () => render());
globalThis.matchMedia?.(LANDPHONE_QUERY).addEventListener?.('change', () => render());


function render(): void {
  const g = ui.game;
  // 시즌 이름 (C.76c): 3~12월 리그가 내 리그면 "2018" (C.76m: 통일 전 세이브의 진행 중 춘추제 시즌만)
  setSeasonLabelKind(g ? calendarKind(g.league) : 'autumn-spring');
  if (ui.screen === 'settings') setPrecomputeStatus(enginePool?.parallel ? enginePool.planned : typeof Worker === 'undefined' ? null : { ready: 0, total: 0 });
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
  const toast = ui.toast ? `<div class="toast-wrap${ui.toast.kind === 'levelup' ? ' is-bottom' : ''}">${Toast(ui.toast)}</div>` : '';
  // C.63c: 진행 중 띠(중단 단추가 있는 토스트)는 머리말을 덮지 않게 화면을 그만큼 내린다
  const bandToast = ui.toast?.onAction?.act === 'sim-stop';
  document.documentElement.classList.toggle('is-landphone', isLandPhone());
  // C.66b: 피치가 가로면(기본) 결정 순간 피치 칸을 피치 비율에 맞춘다 (세로 피치 42% 고정 칸의 빈칸 없앰)
  document.documentElement.classList.toggle('is-pitch-portrait', isPortraitPitch());
  app.className = `${nav ? 'has-nav ' : ''}${band ? 'match-lock ' : ''}${bandToast ? 'has-band-toast ' : ''}app-${ui.screen}`;
  const pv = (ui.pvSheet ? pitchViewSheet() : '')
    + (ui.autoSheet && g && g.phase === 'season' ? autoSheet(autoSheetVM(g), ui.autoCount, ui.autoPrefs) : '')
    + (ui.moreSheet && g && isWide() && !isLandPhone() ? dockMoreSheet(isUnlocked(g.guide, 'tactics')) : '')
    + celebrateHtml(g);
  // 새 버전 (C.77r): 경기 중·진행 띠·모달이 떠 있을 때는 미룬다 (자동으로 새로고침하지 않는다)
  const upd = updateReady() && !ui.swLater && !live && !bandToast && !m
    ? `<div class="sw-update" role="status"><span class="grow"><b>새 버전</b><small>다시 열면 적용돼요 (자동 저장 뒤)</small></span>${Button({ size: 'sm', act: 'sw-reload', children: '다시 열기' })}${Button({ variant: 'ghost', size: 'sm', act: 'sw-later', children: '나중에' })}</div>`
    : '';
  app.innerHTML = `${band}<main class="screen screen-${ui.screen}">${guide.tip}${screenHtml()}</main>${nav}${pv}${modal}${toast}${upd}`;
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
  schedulePlan();
  revealPick();
}

/** 카드 선택권 공개 연출 (C.76o): 고르기 화면이 처음 열릴 때 한 번, 세 장을 뒤집어 보여 준다 (고르는 건 그 아래 화면) */
function revealPick(): void {
  const g = ui.game;
  const p = g?.cards.picks[0];
  if (!g || !p || ui.screen !== 'deck' || ui.more.pickLater || ui.cardSheet) return;
  const key = pickKey(p.label, p.options);
  if (pickSeen(key)) return;
  markPickSeen(key);
  const cards = p.options.map((id) => {
    const n = g.cards.owned[id] ?? 0;
    return animCard(cardById(id)!, { isNew: n === 0, dup: n > 0 });
  });
  const fancy = p.source !== 'level' && p.source !== 'season' && rarityRank(bestRarity(cards.map((c) => c.rarity))) >= 2;
  void playPackReveal({ pack: { kind: 'pick', name: p.label, fancy, cover: fancy ? 'achievement' : 'pick' }, cards });
}

/** 더보기 펼침 줄 (C.63c): 가로 스크롤 위치에 따라 처음·끝 흐림 */
function bindDockMore(): void {
  document.querySelectorAll<HTMLElement>('.dock-more__scroll, .prep-deck').forEach(bindEdgeFade);
  // 디자인 Dock README (C.72): 폰 더보기 줄은 처음·끝 두 자리. 끌다 놓으면 가까운 쪽으로 붙고, 끝이면 .dock-more.is-end
  document.querySelectorAll<HTMLElement>('.dock-more__scroll').forEach((el) => {
    const max = () => el.scrollWidth - el.clientWidth;
    if (max() <= 2 || getComputedStyle(el).overflowX !== 'auto') return;
    const mark = (end: boolean) => { ui.moreEnd = end; el.parentElement?.classList.toggle('is-end', end); };
    if (ui.moreEnd) { el.scrollLeft = max(); mark(true); }
    let t = 0;
    el.addEventListener('scroll', () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const end = el.scrollLeft > max() / 2;
        mark(end);
        if (Math.abs(el.scrollLeft - (end ? max() : 0)) > 1) el.scrollTo({ left: end ? max() : 0, behavior: 'smooth' });
      }, 140);
    }, { passive: true });
  });
}

/** 가로 스크롤 줄 처음·끝 흐림 (더보기 줄 C.63c, 경기 준비 덱 줄 C.66c) */
function bindEdgeFade(el: HTMLElement): void {
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
  else if (ui.busy) prog = { label: '진행 중', icon: 'running', act: 'noop', kind: 'running' };
  else if (marketPending(g)) {
    const n = (g.market?.offers?.length ?? 0) + (g.market?.renewal ? 1 : 0);
    prog = { label: '답하기', icon: 'chat', act: 'day-continue', kind: 'answer', ...(n ? { badge: n } : {}) };
  } else if (isMatchDay(g)) prog = { label: '경기', icon: 'match', act: 'play', kind: 'match' };
  else prog = { label: '계속', icon: 'chevron-right', act: 'day-continue', kind: 'continue' };
  return { screen: ui.screen, prog, tacticsOpen: isUnlocked(g.guide, 'tactics'), points: g.phase === 'retired' ? 0 : homePoints(g), more: ui.moreSheet, inbox: unreadCount(g), coach: g.money?.candidates.length ?? 0 };
}

/** "경기 중 · 돌아가기" 띠 (C.39, C.54 디자인 60): 다른 화면 위에. 첫 줄 = 분·스코어, 둘째 줄 = 상태, 오른쪽 [경기로 돌아가기] */
function liveBand(to: Screen): string {
  const lv = ui.live;
  const m = lv?.run.pending ?? lv?.oc?.vm.moment;
  const head = lv && m ? `경기 중 · ${m.minute}' ${lv.teams[0]} ${m.score[0]}-${m.score[1]} ${lv.teams[1]}` : '경기 중';
  const sub = lv && m?.type === 'halftime' ? '하프타임 · 후반 전술을 정하면 이어서 해요' : lv && m ? '결정 순간에서 멈췄어요 · 돌아가면 이어서 해요' : to === 'replay' ? '경기 재생 중 · 돌아가면 이어서 봐요' : '';
  return `<button type="button" class="live-band" data-act="live-return"><span class="live-dot" aria-hidden="true"></span><span class="grow"><b>${esc(head)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span><b class="live-back">경기로 돌아가기${Icon({ name: 'chevron-right', size: 14, strokeWidth: 2.6 })}</b></button>`;
}

function livePlayers(g: GameState) {
  const s = ui.live!.run.sim.state;
  return replayPlayers(s.input.home, s.input.away).map((p) => (p.isMe ? { ...p, name: g.player.name } : p));
}

/** 피드 한 줄: 골 줄은 끝의 " — 스코어"를 떼고 */
function feedLine(x: ReturnType<typeof replayEvents>[number], m: Moment): NonNullable<MomentVM['feed']>[number] {
  return { minute: x.minute, text: x.score ? x.text.replace(/ — \d+ : \d+$/, '') : x.text, kind: feedKind(x, m.side), mine: x.players[0] === m.me };
}

/** PC 결정 순간 "최근 흐름" (218, C.76f): 이 순간까지의 경기 이벤트 피드 마지막 2줄. 엔진 이벤트는 읽기만 한다 */
function recentFeed(events: Parameters<typeof replayEvents>[0], players: Parameters<typeof replayEvents>[1], teams: [string, string], m: Moment): NonNullable<MomentVM['feed']> {
  return replayEvents(events, players, teams, elapsedMapper(events, ENGINE.time.halfSeconds))
    .filter((x) => x.type !== 'kickoff' && x.type !== 'halftime' && x.type !== 'fulltime')
    .slice(-2)
    .map((x) => feedLine(x, m));
}

/** 직접 모드 경기: 다음 결정 순간까지 돌리고 멈추면 결정 화면, 끝나면 결과 처리 */
function liveAdvance(g: GameState): void {
  liveShow(g, ui.live!.run.advance());
}

/** 멈춘 결정 순간을 보여 주거나 (없으면) 경기를 마친다 */
function liveShow(g: GameState, m: Moment | null): void {
  const lv = ui.live!;
  lv.pitch?.stop();
  if (m?.type === 'halftime') {
    // 하프타임 전술 변경 (C.75k): 경기 전 전술에서 시작하는 시트. 뒤에 전반 마지막 장면을 멈춘 채 흐리게 (237, C.76f)
    setPitchTeams(lv.teams);
    lv.pitch = new MomentPitch(lv.run.frames, new Map(livePlayers(g).map((p) => [p.id, p])), m.side, m, lv.run.frames.at(-1)!.e, null, []);
    const t = lv.run.input.myTactics;
    const base = { tendency: t?.tendency ?? 'balanced', levels: { ...(t?.levels ?? tendencyLevels(t?.tendency ?? 'balanced')) } } as Pick<HalftimeDraft, 'tendency' | 'levels'>;
    lv.ht = { base, draft: { ...base, levels: { ...base.levels }, set: 0 } };
    go('moment');
    return;
  }
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
    lv.feed = recentFeed(lv.run.sim.state.events, [...players.values()], lv.teams, m);
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
  return m.type === 'react' ? (m.scene.startsWith('opp') ? 'duel' : 'onball') : m.type === 'halftime' ? 'onball' : m.type;
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
  // 190 해설 시간 줄 (C.72): 결정 장면부터 결과까지(+2초) 경기 이벤트 피드 문구. 엔진 이벤트는 읽기만 한다
  const e0 = lv.run.frames[startIdx]?.e ?? o.from;
  const lines = replayEvents(s.events, players, lv.teams, elapsedMapper(s.events, ENGINE.time.halfSeconds))
    .filter((x) => x.e >= e0 - 0.01 && x.e <= o.to + 2 && x.type !== 'kickoff' && x.type !== 'halftime' && x.type !== 'fulltime')
    .slice(0, 4)
    .map((x) => feedLine(x, m));
  const vm: OutcomeVM = {
    moment: m, teams: lv.teams, score, shown: false, band, kind: opt ? opt.kind : 'delegate', lines,
    headline, ratingDelta: delta, rating: before === null ? null : Math.max(0, Math.min(10, before + delta)), card: used?.name ?? null,
    choice: opt ? `${used ? `🃏 ${used.name} · ` : `${KO[opt.kind]} · `}${opt.label}${opt.p !== null ? ` (${Math.round(Math.min(0.99, opt.p + (used?.deltas?.[choice as number] ?? 0)) * 100)}%)` : ''}` : '맡기기 (엔진 판단)',
  };
  lv.prevE = o.to;
  const center = lv.pitch?.center ?? 0.5;
  const cy = lv.pitch?.cy ?? 34;
  lv.pitch?.stop();
  lv.pitch = null;
  setPitchTeams(lv.teams);
  const pitch = new OutcomePitch(lv.run.frames, new Map(players.map((p) => [p.id, p])), m.side, o.from, o.to, () => {
    const oc = ui.live?.oc;
    if (!oc || oc.pitch !== pitch) return;
    oc.vm.shown = true;
    if (ui.screen === 'moment') {
      render();
      // 골 연출 (C.77p): 결정 결과(우리 골) 판이 먼저 뜨고 그 위 피치에 한 번. 실점에는 없다
      if (vm.band.tone === 'goal') playGoalSplash('mo-canvas');
    }
    // 다른 화면으로 나가 있으면 넘기지 않는다 (돌아오면 다시 잰다, C.39)
    oc.timer = window.setTimeout(() => {
      if (ui.screen === 'moment') liveContinue(g);
      else oc.timer = 0;
    }, OUTCOME.bandMs);
  }, center, cy, momentCrop(m).len);
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
  ui.clipBack = null;
  let replay: Replay | null = null;
  const trust0 = g.manager?.teamId === g.player.teamId ? g.manager.trust : null;
  const rep0 = g.player.reputation;
  const report = playRound(g, { ...(out ? { engineOut: out } : {}), onReplay: (r) => { replay = r; ui.replay = new ReplayPlayer(r, () => render()); ui.replay.skip(); } });
  // 날씨 (C.74a): 방금 경기 하이라이트·평균 위치·결정 장면은 그 경기 날씨로 그린다
  setPitchWeather(report.cond?.weather);
  if (replay) void keepReplay(g, replay, report);
  const trust1 = g.manager?.teamId === g.player.teamId ? g.manager.trust : null;
  ui.matchDelta = { trust: trust0 !== null && trust1 !== null ? Math.round((trust1 - trust0) * 10) / 10 : null, rep: g.player.reputation - rep0 };
  void autosave();
  go('match');
  if (g.phase !== 'season') badgeToast(g);
  if (report.cardUnlock) showToast({ kind: 'info', title: `시그니처 카드 해금 · ${report.cardUnlock}`, body: '덱 편집에서 덱에 넣을 수 있어요.' }, 2200);
  else recordToast(g);
  if (report.levelsGained > 0) {
    // C.70 (디자인 162): 홈 배너 + 독 위 토스트(Toast levelup, [찍기])
    ui.lvUp = { level: g.player.level, plus: report.levelsGained * BALANCE.growth.pointsPerLevel };
    ui.lvToast = !report.cardUnlock;
  }
}

/** 다시 보기 끝: 지난 경기면 선수 화면, 방금 경기 하이라이트면 결과 화면 (재생기는 끝난 상태로 남겨 평균 위치에 쓴다) */
function rewatchExit(): void {
  const back = ui.rewatch;
  ui.rewatch = false;
  if (ui.clipBack) {
    // 하이라이트 클립 (C.77o): 클립 전 재생기(방금 경기면 끝난 상태, 불러온 세이브면 없음)로 되돌린다
    ui.replay?.stop();
    ui.replay = ui.clipBack.replay;
    ui.clipBack = null;
    go('match');
    return;
  }
  if (back === 'match' && ui.replay) {
    ui.replay.skip();
    go('match');
    return;
  }
  ui.replay = null;
  go('player');
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
  if (name && name.value !== ui.form.name) {
    ui.form.name = name.value;
    ui.form.nameAuto = false;
  }
  if (seed) ui.form.seed = seed.value;
}

/** 커스텀 이름 다시 뽑기 (C.75z): force = [랜덤] 버튼. 아니면(국적·인종 변경) 랜덤으로 채운 이름·빈 칸일 때만 */
function rerollCustomName(force: boolean): void {
  const f = ui.form;
  const r = customNameAfter(f.cu, f.name, f.nameAuto, force, `${prospectSeed()}:name:${f.rand + 1}`);
  if (!r) return;
  f.rand += 1;
  f.name = r;
  f.nameAuto = true;
}

/** 포인트 찍기 들어가기: 지금 상태를 기억한다 */
function enterAllocate(g: GameState, back: Screen): void {
  ui.lvUp = null;
  ui.lvToast = false;
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

(globalThis as unknown as { __pool: () => unknown }).__pool = () => (enginePool ? { ...enginePool.stats, planned: enginePool.planned } : null);

/** 자동 진행 중 훈련일 자동 저장 간격 (C.75b) */
const AUTO_SAVE_DAYS = 7;

/** 미리 볼 날짜 범위 (C.75b) · 미리 계산할 다른 경기 날 수 (C.76m: 경기가 있는 날 기준 3일치 — 보관 상한 PREFETCH_KEEP) */
const AHEAD_DAYS = 7;
const PRECOMPUTE_DAYS = 3;

/** 마지막으로 미리 계산을 맡긴 상태 (같으면 다시 맡기지 않음). '' = 다음 유휴 때 다시 */
let planSig = '';

const planSigOf = (g: GameState): string =>
  [g.calendar.date, g.phase, g.options.quickOthers ? 'q' : 'e', g.league.id, g.league.season, g.league.round, ...(g.otherLeagues ?? []).map((o) => `${o.id}${o.season}.${o.round}`)].join('|');

const aheadJobs = (g: GameState): EngineJob[] => upcomingOthers(g, PRECOMPUTE_DAYS, AHEAD_DAYS).map((input): EngineJob => ({ kind: 'npc', input }));

/**
 * 다른 경기 백그라운드 미리 계산 (C.75b → C.76m, 결과 불변): 앞으로 3일치 다른 경기를 지금 상태의 입력으로 워커에 맡겨 보관한다.
 * 그날이 오면 실제 입력을 다시 만들고, 입력이 같을 때만 보관한 결과를 쓴다(EnginePool.run) — 그 사이 세이브·불러오기·로스터·레이팅이 바뀌었으면 버리고 새로 계산.
 * 홈·다른 화면에 있는 동안, 내 경기를 보는 동안, 날짜를 넘기는 동안 노는 워커가 계산한다. 빠른 진행이면 하지 않는다
 */
function planAhead(g: GameState): void {
  planSig = planSigOf(g);
  // 측정용 (부록 C.76m 전후 비교): __noPrecompute = true 면 미리 계산하지 않는다
  if (!pool().parallel || (globalThis as unknown as { __noPrecompute?: boolean }).__noPrecompute) return;
  if (g.options.quickOthers || g.phase === 'retired') { enginePool?.clearPrefetch(); return; }
  pool().plan(aheadJobs(g));
}

/** 유휴 때 미리 계산 맡기기 (렌더마다 부르지만 상태가 바뀌었을 때만 맡긴다) */
let planIdle = false;
function schedulePlan(): void {
  const g = ui.game;
  if (!g || ui.busy || planIdle || planSigOf(g) === planSig) return;
  planIdle = true;
  const go = () => {
    planIdle = false;
    const cur = ui.game;
    if (cur && !ui.busy) planAhead(cur);
  };
  const ric = (globalThis as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(go, { timeout: 2000 });
  else setTimeout(go, 300);
}

/** 게임을 연 뒤 (C.75b 첫 워커 데우기 → C.76m): 유휴 때 미리 계산을 맡긴다 */
function warmPool(): void {
  planSig = '';
  schedulePlan();
}

/** 오늘 다른 경기를 계산한다: 전체 엔진은 Web Worker 풀에 나눠 병렬로, 빠른 진행은 바로 (같은 시드 같은 결과) */
async function runOthersToday(g: GameState, ahead = false, progress?: (done: number, total: number, pre?: number) => void): Promise<number> {
  const jobs = todaysOthers(g).map(([r, i]) => otherJob(g, r, i));
  // 고른 다른 리그 (45b b): 풀 엔진이면 그날 경기를 같은 워커 풀로 (빠른 계산이면 하루 끝 syncOtherLeagues)
  const lgJobs = g.options.quickOthers ? [] : otherLeagueJobs(g, g.calendar.date);
  if (!jobs.length && !lgJobs.length) {
    if (ahead) planAhead(g);
    return 0;
  }
  if (g.options.quickOthers) {
    playOthers(g, 'quick');
    return jobs.length;
  }
  const total = jobs.length + lgJobs.length;
  // 미리 계산해 둔 경기 수 (C.76m, 진행 표시용)
  const pre = progress ? [...jobs, ...lgJobs].filter((j) => pool().ready({ kind: 'npc', input: j.input })).length : 0;
  let done = 0;
  const tick = <T,>(p: Promise<T>): Promise<T> => p.then((x) => { done++; progress?.(done, total, pre); return x; });
  const runs = jobs.map((j) => tick(pool().npc(j.input).catch(() => playNpcMatch(j.input))));
  const lgRuns = lgJobs.map((j) => tick(pool().npc(j.input).catch(() => playNpcMatch(j.input))));
  // 오늘 일을 다 맡긴 뒤 다음 날 것을 미리 (실제 작업이 먼저 돈다)
  if (ahead) planAhead(g);
  const outs = await Promise.all(runs);
  jobs.forEach((j, k) => applyOther(g, j.r, j.i, outs[k]!));
  const lgOuts = await Promise.all(lgRuns);
  lgJobs.forEach((j, k) => applyOtherLeagueJob(g, j, lgOuts[k]!));
  return total;
}

/** 비시즌 동안 다른 리그 경기를 소집일 전날까지 하루씩 엔진으로 (45b b): 진행 표시 n/전체, 취소 없이 기다린다 */
async function offseasonOthers(g: GameState): Promise<void> {
  const upto = addDays(nextCampDate(g), -1);
  for (let d = g.calendar.date; daysBetween(d, upto) >= 0; d = addDays(d, 1)) {
    const jobs = otherLeagueJobs(g, d);
    if (jobs.length) {
      const prog = othersProgress('비시즌 · 다른 리그 경기', dateLabel(d));
      let done = 0;
      prog(0, jobs.length);
      const outs = await Promise.all(jobs.map((j) => pool().npc(j.input).catch(() => playNpcMatch(j.input)).then((x) => { prog(++done, jobs.length); return x; })));
      jobs.forEach((j, k) => applyOtherLeagueJob(g, j, outs[k]!));
    }
    syncOtherLeagues(g, d);
  }
}

/** 다음 시즌 시작 (비시즌 [다음 시즌]) */
function nextSeasonStart(g: GameState): void {
  startNextSeason(g);
  ui.replay = null;
  ui.seasonTab = null;
  autosave();
  go('home');
  showToast({ kind: 'info', title: '휴가 끝 · 소집', body: `${dateLabel(g.calendar.date)} · 개막 7일 전이에요. 훈련 계획을 확인해요.` }, 2600);
}

/** 진행 중 띄움 글 (45b b): 다른 경기 n/전체 (C.76m: 미리 계산해 둔 경기 수) */
function othersProgress(title: string, body: string): (done: number, total: number, pre?: number) => void {
  let last = 0;
  return (done, total, pre = 0) => {
    const now = performance.now();
    if (done < total && now - last < 150) return;
    last = now;
    ui.toast = { ...(ui.toast ?? { kind: 'info', title }), title, body: `${body} · 다른 경기 ${done}/${total}${pre ? ` (미리 계산 ${pre})` : ''}` } as typeof ui.toast;
    render();
  };
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
        await runOthersToday(g, false, othersProgress(title, dateLabel(g.calendar.date)));
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
      const n = await runOthersToday(g, true, othersProgress(title, `${dateLabel(g.calendar.date)} · ${g.league.round}/${g.league.schedule.length}라운드`));
      lastTrain = trainingLine(endDay(g));
      progressLog.push({ date, ms: Math.round(performance.now() - d0), matches: n, my: false });
      days++;
      autosave();
      if (mode === 'one' || ui.stopReq) break;
    }
  } finally {
    // C.76m: 미리 계산은 버리지 않고 유휴 때 지금 날짜 기준으로 다시 맡긴다 (목록에 없는 것만 버림)
    planSig = '';
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
  setPitchWeather(rm.cond.weather);
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
 * toEnd (22.2 "시즌 요약으로 바로 이동", C.73b) 면 시즌이 끝날 때까지.
 * 진행 중에는 화면을 다시 그리지 않고 지금 화면 위 반투명 레이어의 글자만 바꾼다. [중단]은 그날(경기 포함)까지 끝내고 멈춘다.
 * 응답이 필요한 일(이적 제안·재계약)이 생기면 멈춘다. 설정(ui.autoPrefs, C.73b): 새 선택 이벤트 · 새 부상에서 멈춤, 포인트 추천 배분 자동 적용
 */
async function autoRun(g: GameState, opts: { matches: number; untilDate?: string; toEnd?: boolean }): Promise<void> {
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
  const prefs: AutoPrefs = { ...ui.autoPrefs };
  // 진행 전부터 있던 답할 이벤트는 멈추지 않는다 (새로 온 것만)
  const pend0 = new Set(pendingItems(g).map((x) => x.id));
  let spent = 0;
  const interviews: string[] = [];
  let newEvent: string | null = null;
  let played = 0;
  let reason: 'done' | 'until' | 'stop' | 'market' | 'season' | 'event' | 'injury' = 'done';
  let unsaved = 0;
  const myRow = () => {
    const pos = g.league.table.findIndex((r) => r.teamId === g.player.teamId) + 1;
    return pos > 0 ? `${pos}위` : '-';
  };
  const update = () => {
    const fx = isMatchDay(g) ? nextFixture(g) : null;
    const what = fx ? `${matchCompLabel(g, fx)} ${teamById(g.league, fx.opponentId).nameKo}전 계산 중` : '훈련일 진행 중';
    // C.76j (디자인 215): 계산 중인 경기가 컵·챔스·대표팀이면 대회 단계 칩
    const chip = fx && (fx.cup || fx.nat) ? (prepCupBadge(matchCompLabel(g, fx))) : '';
    updateAutoLayer(layer, { n: played, m: total, meta: `${dateLabel(g.calendar.date)} · ${fx ? `${fx.home ? '홈' : '원정'} · ${teamById(g.league, fx.opponentId).nameKo}전 계산 중` : what}`, lines, rank: myRow(), pts: prefs.alloc ? spent : Math.max(0, g.player.unspentPoints - pts0), alloc: prefs.alloc, chip });
  };
  try {
    for (;;) {
      if (g.phase !== 'season') { reason = 'season'; break; }
      if (marketPending(g)) { reason = 'market'; break; }
      // 중요 경기까지면 그 경기 날(경기 전)까지 날을 넘긴다
      if (opts.untilDate === undefined && !opts.toEnd && played >= total) break;
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
      const injBefore = g.player.injury;
      // 부상 복귀 선택 (C.74b): 자동 진행 중에는 추천안(완전 회복)
      if (g.player.injury?.ret === 'ask') chooseInjuryReturn(g, 'full');
      // 내 경기도 다른 경기와 같이 미리 (C.75b): 다른 경기 결과를 기록한 뒤 다시 만든 입력이 같을 때만 그 결과를 쓴다
      if (match) pool().prefetch({ kind: 'my', input: roundMatch(g).input });
      const n = await runOthersToday(g, true);
      if (match) {
        const rm = roundMatch(g);
        const out = await pool().my(rm.input).catch(() => playMyMatch(rm.input));
        const rep = playRound(g, { engineOut: out });
        played++;
        lines.push({ label: rep.nat ? rep.nat.label : rep.cup ? `${rep.cup.comp === 'ucl' ? '챔스' : compNameKo(rep.cup.comp, g.league.id)} ${rep.cup.stage}` : `리그 ${rep.round}R`, opp: teamById(g.league, rep.opponentId).nameKo, gf: rep.result.goalsFor, ga: rep.result.goalsAgainst, rating: rep.result.rating });
        results.push(rep.result.goalsFor > rep.result.goalsAgainst ? 'W' : rep.result.goalsFor < rep.result.goalsAgainst ? 'L' : 'D');
      } else {
        endDay(g);
      }
      // 포인트 추천 배분 자동 적용 (22.2): 레벨업으로 생긴 포인트를 바로 찍는다 (포인트 화면 [자동 배분]과 같은 규칙)
      if (prefs.alloc && g.player.unspentPoints > 0) {
        const p0 = g.player.unspentPoints;
        autoAllocate(g.player);
        spent += p0 - g.player.unspentPoints;
      }
      // 인터뷰 (C.75x): 자동 진행 중에는 멈추지 않고 손해가 가장 적은 답 (답은 인박스에 남는다). 진행 전부터 있던 것은 그대로
      interviews.push(...autoAnswerInterviews(g, pend0));
      progressLog.push({ date, ms: Math.round(performance.now() - d0), matches: n + (match ? 1 : 0), my: match });
      // 자동 저장 (C.75b): 자동 진행 중에는 내 경기 날과 AUTO_SAVE_DAYS 일마다만 (저장은 메인 스레드에서 상태 전체를 묶어 워커와 코어를 나눠 쓴다).
      // 멈추거나 끝나면 아래 finally 에서 한 번 더 저장한다
      if (match || ++unsaved >= AUTO_SAVE_DAYS) {
        unsaved = 0;
        autosave();
      }
      if (ui.stopReq) { reason = 'stop'; break; }
      if (g.phase !== 'season') continue;
      if (prefs.injury && !injBefore && g.player.injury) { reason = 'injury'; break; }
      const ne = prefs.event ? pendingItems(g).find((x) => !pend0.has(x.id)) : undefined;
      if (ne) { newEvent = ne.title; reason = 'event'; break; }
    }
  } finally {
    planSig = '';
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
    const recs = takeFreshRecords(g);
    const body = `${w}승 ${d}무 ${l}패 · 내 골 ${goals} 도움 ${assists}${g.player.level > before.levels ? ` · Lv.${g.player.level}` : ''}${spent ? ` · 포인트 ${spent}P 자동 배분` : ''}${recs.length ? ` · 기록 ${recs.length}개 달성` : ''}${interviews.length ? ` · 인터뷰 ${interviews.length}개 자동 답` : ''} · 지금 ${myRow()}`;
    autoLog.push({ played, rounds: g.league.round - startRound, ms: Math.round(performance.now() - t0), reason });
    if (g.phase !== 'season') {
      go('season');
      badgeToast(g);
    } else if (reason === 'market') {
      go('home');
      showToast({ kind: 'info', title: `이적 제안이 와서 멈췄어요 · ${played}경기`, body: `${body} · 답하기 전에는 진행이 멈춰요.` }, 3200);
    } else if (reason === 'event') {
      go('home');
      showToast({ kind: 'info', title: `답할 일이 생겨 멈췄어요 · ${played}경기`, body: `${newEvent ?? '선택 이벤트'} · ${body}`, action: '인박스', onAction: { act: 'go', data: { to: 'inbox' } } }, 4200);
    } else if (reason === 'injury') {
      go('home');
      const inj = g.player.injury;
      showToast({ kind: 'info', title: `부상으로 멈췄어요 · ${played}경기`, body: `${inj ? `${inj.daysLeft}일 결장 예상 · ` : ''}${body}` }, 4200);
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
/** 캡처용 (C.74a): 피치 날씨를 바꿔 그려 본다 */
(globalThis as unknown as { __pitchWeather: typeof setPitchWeather }).__pitchWeather = setPitchWeather;

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

/** "챔스 조별 1차전" → "챔피언스리그 · 조별 1차전" (C.76j 215 진행 레이어 칩) */
function prepCupBadge(label: string): string {
  return label.replace(/^챔스 /, '챔피언스리그 ').replace(' ', ' · ');
}

function updateAutoLayer(el: HTMLElement, p: { n: number; m: number; meta: string; lines: AutoResultLine[]; rank: string; pts: number; alloc?: boolean; chip?: string }): void {
  const q = (c: string) => el.querySelector<HTMLElement>(c);
  const set = (c: string, t: string) => { const x = q(c); if (x) x.textContent = t; };
  set('.auto-layer__n', String(p.n));
  set('.auto-layer__m', `/ ${p.m}경기`);
  set('.auto-layer__meta', `${p.meta}${el.classList.contains('is-stopping') ? ' · 이 경기까지 하고 멈춰요' : ''}`);
  set('.auto-layer__rank', p.rank);
  set('.auto-layer__pts', String(p.pts));
  const chip = q('.auto-layer__chip');
  if (chip) { chip.hidden = !p.chip; const b = chip.querySelector('b'); if (b) b.textContent = p.chip ?? ''; }
  set('.auto-layer__ptsl', p.alloc ? '자동 배분 포인트' : '쌓인 포인트');
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
    rerollCustomName(false);
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
    case 'sw-reload':
      // 새 버전으로 (C.77r): 자동 저장을 끝낸 뒤 넘어간다
      if (liveScreen()) return;
      void autosave().then(applyUpdate);
      return;
    case 'sw-later':
      ui.swLater = true;
      render();
      return;
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
    case 'set-credits':
      ui.set.credits = !ui.set.credits;
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
    case 'inj-return-open':
      ui.injSheet = true;
      render();
      return;
    case 'inj-return': {
      ui.injSheet = false;
      if (g && chooseInjuryReturn(g, v === 'early' ? 'early' : 'full')) {
        autosave();
        showToast(v === 'early'
          ? { kind: 'info', title: '조기 복귀', body: `오늘부터 뛸 수 있어요 · ${BALANCE.injuryReturn.reinjuryDays}일 동안 재부상 위험 ×${BALANCE.injuryReturn.reinjuryMul}` }
          : { kind: 'info', title: '완전 회복', body: '끝까지 회복하고 돌아가요.' }, 2400);
      } else render();
      return;
    }
    case 'sheet-close':
      ui.injSheet = false;
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
    // C.73d: 초기화면으로 (홈 왼쪽 위 ‹ · 설정 세이브 섹션). 자동 저장을 끝낸 뒤 게임을 내려놓고 타이틀로
    case 'to-title':
      if (!g || liveScreen()) return;
      confirmModal({ title: '초기화면으로 갈까요?', body: '진행은 자동 저장돼요. 초기화면의 [이어하기]로 바로 돌아와요.', confirm: '저장하고 나가기', act: 'to-title-ok' });
      return;
    case 'to-title-ok':
      ui.modal = null;
      if (!g || liveScreen()) { render(); return; }
      void (async () => {
        try {
          await autosave();
        } catch (e) {
          showToast((e as Error).message);
          render();
          return;
        }
        ui.game = null;
        enginePool?.clearPrefetch();
        ui.replay = null;
        ui.rewatch = false;
        ui.recent = [];
        ui.recentDirty = false;
        syncReplayIndex();
        ui.moreSheet = false;
        go('title');
      })();
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
      if (ui.cardSheet?.from === 'view') ui.cardSheet = null;
      if (ui.screen === 'new') readFormInputs();
      const to = redirectScreen((act === 'go-tab' ? v : el.dataset.to) ?? 'home', el.dataset.tab);
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
    // 월드 리그 고르기 (C.76c)
    case 'celebrate-close': {
      const vm = g ? celebrateVM(g) : null;
      ui.celebrated = vm?.key ?? '';
      render();
      return;
    }
    case 'cup-sub':
      ui.cupSub = v as typeof ui.cupSub;
      ui.more = { ...ui.more, cupTies: false };
      render();
      return;
    case 'cup-round':
      ui.cupRound = Number(v);
      ui.more = { ...ui.more, cupTies: false };
      render();
      return;
    case 'world-league':
      ui.worldLeague = v ?? '';
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
    case 'ng-lg-open':
      readFormInputs();
      ui.ng.leaguesOpen = !ui.ng.leaguesOpen;
      render();
      return;
    // 리그 고르기 묶음 접기·펼치기 (디자인 239)
    case 'ng-lg-group': {
      readFormInputs();
      if (!v) return;
      const el = document.querySelector(`.ng-lg__ghead[data-v="${v}"]`);
      ui.ng.lgFold = { ...ui.ng.lgFold, [v]: el?.getAttribute('aria-expanded') !== 'true' };
      render();
      return;
    }
    case 'ng-league': {
      // 리그 고르기 (C.75m): 내 리그(맨 앞)는 필수, 데이터 없는 리그는 고를 수 없다
      readFormInputs();
      const ids = normalizeLeagues(ui.form.leagues);
      if (!v || v === ids[0] || !leagueData(v)) return;
      ui.form.leagues = ids.includes(v) ? ids.filter((x) => x !== v) : [...ids, v];
      render();
      return;
    }
    // 시작 팀 고르기 리그 탭 (45b b)
    case 'ng-pick-league':
      readFormInputs();
      ui.form.pickLeague = v ?? '';
      render();
      return;
    // 내 리그로 (C.76c): 고른 리그를 맨 앞으로
    case 'ng-league-mine': {
      readFormInputs();
      const ids = normalizeLeagues(ui.form.leagues);
      if (!v || !ids.includes(v) || !leagueData(v)) return;
      ui.form.leagues = [v, ...ids.filter((x) => x !== v)];
      render();
      return;
    }
    case 'ng-leagues':
      readFormInputs();
      {
        // 내 리그는 그대로 맨 앞 (C.76c)
        const mine = normalizeLeagues(ui.form.leagues)[0]!;
        ui.form.leagues = v === 'mine' ? [mine] : normalizeLeagues(v === 'all' ? leagueCatalog().map((e) => e.id) : [...DEFAULT_LEAGUES], mine);
      }
      render();
      return;
    case 'ng-sort':
    case 'ng-sort-close':
      // 실제 선수 정렬 (C.71b 디자인 175): 펼침 목록·아래 시트 열고 닫기
      readFormInputs();
      ui.ng.sortOpen = act === 'ng-sort' ? !ui.ng.sortOpen : false;
      render();
      return;
    case 'ng-sort-pick':
      readFormInputs();
      if (v === 'peak' || v === 'ovr' || v === 'age' || v === 'name') ui.ng.rsort = v;
      ui.ng.sortOpen = false;
      render();
      return;
    case 'ng-hooks': {
      // 커스텀 태그 (디자인 183): "효과가 다음 업데이트에서 열리는" 묶음 펼치기
      if (v !== 'pro' && v !== 'con') return;
      const cur = ui.ng.cuHooks ?? [];
      ui.ng.cuHooks = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
      render();
      return;
    }
    case 'ng-real': {
      readFormInputs();
      ui.ng.sortOpen = false;
      const k = el.dataset.k;
      if (k === 'realTab') { ui.ng.realTab = v === 'legend' || v === 'future' ? v : 'real'; ui.ng.rshow = 10; ui.ng.rsort = ui.ng.realTab === 'legend' ? 'peak' : 'ovr'; }
      else if (k === 'rgroup') { ui.ng.rgroup = v as NewGameUI['rgroup']; ui.ng.rshow = 10; }
      else if (k === 'rshow') ui.ng.rshow = Number(v) || 10;
      else if (k === 'rq') { ui.ng.rq = v ?? ''; ui.ng.rshow = 10; }
      else if (k === 'lpack') { ui.ng.lpack = v === 'base' || v === 'bvb' ? v : 'all'; ui.ng.rshow = 10; }
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
      if (ui.lookName) (document.querySelector('.pl-look #nm-nick') as HTMLInputElement | null)?.focus({ preventScroll: true });
      return;
    case 'legend-more':
      ui.legendOpen = !ui.legendOpen;
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
        ? { kind: 'info', title: '이적 명단에 올랐어요', body: r.offersNow ? `${windowKo(g.league, 'winter')} 이적시장 제안이 왔어요.` : `${midWindowKo(g.league)} 이적시장이 열리면 제안이 와요.` }
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
      const k = el.dataset.k as 'mode' | 'position' | 'difficulty' | 'realId' | 'legends' | 'futureStars' | 'race' | 'photo' | 'startTeam';
      (ui.form as unknown as Record<string, string>)[k] = v!;
      // 시작 팀 (45b b): 고른 팀의 리그가 내 리그 (랜덤이면 그대로)
      if (k === 'startTeam') {
        if (v === 'random') ui.form.startTeam = '';
        else if (v) ui.form.leagues = normalizeLeagues(ui.form.leagues, leagueOfTeam(v));
      }
      // 인종을 바꾸면 사진도 그 인종으로 (C.73c)
      if (k === 'race') ui.form.photo = '';
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
      if (k === 'app') rerollCustomName(false);
      // 시작 소속 팀 (45b b): 고른 팀의 리그가 내 리그
      if ((k === 'startClub' || k === 'youthClub') && v && v !== 'random' && leagueOfTeam(v)) ui.form.leagues = normalizeLeagues(ui.form.leagues, leagueOfTeam(v));
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
    case 'ng-random':
      // 전체 랜덤 (C.74d): 시드를 적었으면 그 시드, 아니면 새로 굴린다 → 결과 화면 [이대로 시작][편집하기][다시 돌리기]
      readFormInputs();
      if (!ui.form.seed.trim()) ui.form.roll = randomSeed();
      ui.form.mode = 'prospect';
      ui.ng.attrsOpen = false;
      render();
      window.scrollTo(0, 0);
      return;
    case 'ng-edit': {
      // 편집하기 (C.74d): 랜덤 결과를 커스텀 폼으로 옮겨 1단계부터
      readFormInputs();
      const f = ui.form;
      const r = prospectToCustom(prospectSeed(), f.position, isRace(f.race) ? f.race : undefined, isFacePhoto(f.photo) ? f.photo : undefined);
      f.cu = r.form;
      if (!f.name.trim()) { f.name = r.name; f.nameAuto = true; }
      f.mode = 'custom';
      ui.ng.cuStep = 1;
      render();
      window.scrollTo(0, 0);
      return;
    }
    case 'cu-rand': {
      readFormInputs();
      const f = ui.form;
      f.rand += 1;
      const r = randomStep(f.cu, f.name, Number(v) || ui.ng.cuStep, `${prospectSeed()}:cu${v}:${f.rand}`);
      f.cu = r.form;
      if (r.name !== f.name) { f.name = r.name; f.nameAuto = true; }
      render();
      return;
    }
    case 'cu-name-rand': {
      // 이름 [랜덤] (C.75z): 고른 국적·인종에 맞는 이름
      readFormInputs();
      rerollCustomName(true);
      render();
      return;
    }
    case 'cu-fit': {
      readFormInputs();
      const c = ui.form.cu;
      ui.form.cu = { ...c, attrs: fitToBudget(c.attrs, c.position, budgetOf(c), c.height) };
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
        const cv = customVM(f.cu, f.name, normalizeLeagues(f.leagues)[0]);
        if (cv.over || !cv.start.ready) return;
      }
      // 전체 랜덤 [이대로 시작] (C.74d): 커스텀 예산 안으로 맞춘 결과 그대로 커스텀 시작 (팀·잠재력·숨은 적성은 예전 랜덤과 같은 굴림)
      ui.game = f.mode === 'prospect'
        ? newGame({ mode: 'custom', custom: rolledSpec(prospectSeed(), f.position, f.name, isRace(f.race) ? f.race : undefined, isFacePhoto(f.photo) ? f.photo : undefined),
          seed: prospectSeed(), difficulty: f.difficulty, legends: f.legends === 'on', futureStars: f.futureStars === 'on', leagues: f.leagues, ...(f.startTeam ? { teamId: f.startTeam } : {}) })
        : f.mode === 'custom'
          ? newGame({ mode: 'custom', custom: customSpec(f.cu, f.name), seed: prospectSeed(), difficulty: f.difficulty, legends: f.legends === 'on', futureStars: f.futureStars === 'on', leagues: f.leagues })
          : newGame({ mode: 'real', playerId: f.realId, seed: f.seed, difficulty: f.difficulty, legends: f.legends === 'on', futureStars: f.futureStars === 'on', leagues: f.leagues });
      ui.replay = null;
      f.roll = '';
      f.posFor = '';
      // 새 게임 보너스 (18.11, C.73b): 은퇴한 커리어가 남긴 시작 카드 선택권
      const bonus = claimNewGameBonus(ui.game);
      f.race = '';
      f.photo = '';
      if (f.mode === 'prospect') f.mode = 'custom';
      autosave();
      go('home');
      warmPool();
      showToast({ kind: 'info', title: `${ui.game.player.name} · ${teamById(ui.game.league, ui.game.player.teamId).nameKo}`, body: bonus ? `커리어를 시작했어요. 명예의 전당 보너스: ${RARITY_KO[bonus.rarity] ?? bonus.rarity} 카드 선택권 1장(덱).` : '커리어를 시작했어요.' });
      return;
    }
    case 'sim-stop':
      requestSimStop();
      return;
    case 'ht-set': {
      const h = ui.live?.ht;
      if (!h || v === undefined) return;
      const x = halftimeSets(h.base)[Number(v)];
      if (!x) return;
      h.draft = { tendency: x.tendency, levels: { ...x.levels }, set: Number(v) };
      render();
      return;
    }
    case 'ht-tend': {
      const h = ui.live?.ht;
      if (!h || !v) return;
      // 성향을 바꾸면 세부 전술은 그 성향 기본값 (전술 화면과 같은 규칙)
      h.draft = { tendency: v as Tendency, levels: tendencyLevels(v as Tendency), set: null };
      render();
      return;
    }
    case 'ht-level': {
      const h = ui.live?.ht;
      if (!h || v === undefined) return;
      h.draft = { ...h.draft, levels: { ...h.draft.levels, [el.dataset.k as Detail]: Number(v) as Level }, set: null };
      render();
      return;
    }
    case 'ht-keep':
    case 'ht-ok': {
      const lv = ui.live;
      if (!g || !lv?.ht || lv.run.pending?.type !== 'halftime') return;
      const d = lv.ht.draft;
      const vm = halftimeVM(d, lv.ht.base, lv.teams, lv.run.pending.score, lv.run.pending.side);
      const change = act === 'ht-ok' && vm.changed;
      lv.run.halftime(change ? tacticsOf(d.tendency, d.levels) : null, change ? `하프타임 전술 변경 · ${vm.chips.join(' · ')}` : undefined);
      lv.ht = null;
      liveAdvance(g);
      return;
    }
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
    // 재정 (C.68a): 코치 모집 · 고용 · 해지
    case 'fn-scout':
      if (g && startScout(g)) autosave();
      render();
      return;
    case 'fn-hire':
      if (g && v && hireStaff(g, v)) autosave();
      render();
      return;
    case 'fn-leave':
      if (g && v && toggleLeave(g, v)) autosave();
      render();
      return;
    // 재정 b (C.68b): 탭 · 카드 상점 · 카드팩 · TP · 집·차 · 기부 · 투자 · 에이전트
    // 포토카드 도감 (C.75t): 정렬 · 방향 · 카드 뒤집기
    // 대표팀 (C.76d): 탭 · 대회 고르기
    case 'nat-tab':
      ui.nat = { ...ui.nat, tab: (v ?? 'fixtures') as NationalTab };
      render();
      return;
    case 'nat-cup':
      ui.nat = { ...ui.nat, cup: v ?? null };
      render();
      return;
    // 개인 시상 (C.76n): 탭 · 연도 · 역대 수상자 상
    case 'aw-tab':
      ui.aw = { ...ui.aw, tab: (v ?? 'year') as AwardsTab, cer: null };
      render();
      return;
    case 'aw-season':
      ui.aw = { ...ui.aw, season: v ? Number(v) : null, cer: null };
      render();
      return;
    // C.76t: 부문(세계 · 리그) · 시상식 열기/닫기 · 단계
    case 'aw-group':
      ui.aw = { ...ui.aw, group: v ?? null, cer: null };
      render();
      return;
    case 'aw-cer':
      ui.aw = { ...ui.aw, cer: v ? { id: v, step: 0 } : null };
      render();
      return;
    case 'aw-cer-step':
      if (ui.aw.cer) ui.aw = { ...ui.aw, cer: { ...ui.aw.cer, step: Number(v ?? 0) } };
      render();
      return;
    case 'aw-hist':
      ui.aw = { ...ui.aw, hist: v ?? null };
      render();
      return;
    case 'pc-sort':
      ui.dex = { ...ui.dex, sort: (v ?? 'no') as PhotoSort, flip: null, open: false };
      render();
      return;
    // 정렬 접는 선택 (디자인 238 폰): 누르면 아래로 8가지 목록
    case 'pc-sort-open':
      ui.dex = { ...ui.dex, open: !ui.dex.open };
      render();
      return;
    case 'pc-dir':
      ui.dex = { ...ui.dex, desc: !ui.dex.desc, open: false };
      render();
      return;
    case 'pc-flip':
      ui.dex = { ...ui.dex, flip: ui.dex.flip === v ? null : v ?? null };
      render();
      return;
    // 유니폼 교환 · 진열실 (C.76b)
    case 'jersey-ask': {
      const r = g && v ? requestJersey(g, v) : null;
      if (r) autosave(); // 결과는 결과 화면 패널에 한 줄로
      render();
      return;
    }
    case 'sr-put':
      if (g && v && showcasePut(g, v)) autosave();
      render();
      return;
    case 'sr-take':
      if (g && v && showcaseTake(g, v)) autosave();
      render();
      return;
    case 'fn-tab':
      // 옛 재정 › 카드 상점 탭 (C.77q) → 상점 화면
      if (v === 'shop') { go(redirectScreen('finance', v)); return; }
      ui.financeTab = v === 'life' ? 'life' : 'money';
      render();
      return;
    case 'fn-buy':
      if (g && v && buyShopCard(g, Number(v))) {
        autosave();
        showToast({ kind: 'info', title: '카드를 샀어요', body: '덱 화면에서 넣을 수 있어요.' });
      }
      render();
      return;
    case 'fn-pack': {
      if (!g) return;
      // 팩 개봉 연출 (C.76o): 결과는 buyPack 이 정한 그대로, 연출은 보여 주기만. NEW = 처음 얻음, 중복 = 이미 가진 카드
      const have: Record<string, number> = { ...g.cards.owned };
      const got = buyPack(g);
      if (got.length) {
        autosave();
        ui.lastPack = got;
        const cards = got.map((id) => {
          const n = have[id] ?? 0;
          have[id] = n + 1;
          return animCard(cardById(id)!, { isNew: n === 0, dup: n > 0 });
        });
        // 결과 줄을 누르면 그 카드 상세 (C.77q): 상점 화면 위 덱과 같은 시트
        const onPick = (id: string) => { ui.cardSheet = { id, from: 'view' }; if (ui.screen !== 'shop') go('shop'); else render(); };
        void playPackReveal({ pack: { kind: 'pack', name: '일반 카드팩', cover: 'normal' }, cards, onPick }).then((shown) => {
          if (!shown) showToast({ kind: 'info', title: `카드팩 · ${got.length}장`, body: got.map((id) => cardById(id)?.name ?? id).join(' · ') }, 2600);
        });
      }
      render();
      return;
    }
    case 'goal-splash-set':
      if (v !== 'on' && v !== 'off') return;
      saveGoalSplashPref(v);
      render();
      return;
    case 'pack-anim-set':
      if (v !== 'full' && v !== 'short' && v !== 'off') return;
      savePackAnimPref(v as PackAnimPref);
      render();
      return;
    case 'pack-anim-demo': {
      // 설정 미리보기 (C.76o): 고른 희귀도가 최고인 팩. 세이브·카드는 바뀌지 않는다
      const r = v === 'rare' || v === 'epic' || v === 'legendary' ? v : 'common';
      void playPackReveal({ pack: { kind: el.dataset.k === 'pick' ? 'pick' : 'pack', name: el.dataset.k === 'pick' ? '미리보기 · 업적 선택권' : '일반 카드팩', fancy: el.dataset.k === 'pick', cover: el.dataset.k === 'pick' ? 'achievement' : 'normal' }, cards: demoAnimCards(r), results: el.dataset.k !== 'pick', force: 'full' });
      return;
    }
    case 'fn-tp':
      if (g && v && useTp(g, v as TpKind)) {
        autosave();
        showToast({ kind: 'info', title: 'TP 카드 해금', body: '덱 화면에서 3장 중 하나를 골라요.' });
      }
      render();
      return;
    case 'fn-life': {
      const [k, lvl] = (v ?? '').split(':');
      if (g && k && setLife(g, k as LifeItem, Number(lvl))) autosave();
      render();
      return;
    }
    case 'fn-donate': {
      if (!g || !v || donateBlocked(g, Number(v))) return;
      const before = g.player.reputation;
      const d = donate(g, Number(v));
      {
        autosave();
        showToast({ kind: 'info', title: '기부했어요', body: d ? `위상 +${g.player.reputation - before}` : '이번 시즌 위상 상한에 닿았어요(자선 누적에는 들어가요).' });
      }
      render();
      return;
    }
    case 'fn-invest': {
      const [k, a] = (v ?? '').split(':');
      if (g && k && moveInvest(g, k as InvestKind, a === '-all' ? -Infinity : Number(a))) autosave();
      render();
      return;
    }
    case 'fn-agent':
      if (g) {
        const m = ensureMoney(g);
        if (m.agent === 'premium') delete m.agent;
        else m.agent = 'premium';
        autosave();
      }
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
        body = t.accepted ? (t.offersNow ? `구단이 놓아줬어요. ${windowKo(g.league, 'winter')} 이적시장 제안이 왔어요.` : `구단이 놓아줬어요. ${midWindowKo(g.league)} 이적시장이 열리면 제안이 와요.`) : '구단이 거절했어요. 이번 시즌에는 다시 요청할 수 없어요.';
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
      answerEvent(g, +id, v);
      autosave();
      ui.inboxPick = null;
      // C.76i (디자인 194): 결과는 토스트 대신 상세 화면 "결과" 칸에 남는다
      ui.inboxSel = +id;
      render();
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
    case 'news-cal':
      // 디자인 180 (C.72): 이적 소식 빈 상태 [일정에서 보기] = 훈련·일정의 일정 탭
      ui.trainTab = 'cal';
      go('schedule');
      return;
    case 'train-tab':
      if (v === 'pre' || v === 'cal' || v === 'g' || v === 'staff') ui.trainTab = v;
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
      ui.presetSheet = { id: v || null, sel: 0, draft: null };
      render();
      return;
    // 편집 시트 (C.71a 디자인 167): 칸을 고르고 아래 종류를 누르면 그 칸이 바뀌고 다음 칸으로 간다. 저장 전까지는 초안
    case 'preset-slot':
    case 'preset-kind': {
      const ps = ui.presetSheet;
      if (!g?.training || !ps || v === undefined) return;
      const cur = presetEditVM(g, ps.id, ps.draft, ps.sel);
      const name = (document.getElementById('f-preset-name') as HTMLInputElement | null)?.value ?? cur.name;
      const draft = { name, slots: cur.slots.map((x) => x.kind) };
      if (act === 'preset-slot') ps.sel = Number(v) || 0;
      else {
        draft.slots[ps.sel] = v as TrainingKind;
        ps.sel = Math.min(draft.slots.length - 1, ps.sel + 1);
      }
      ps.draft = draft;
      render();
      return;
    }
    case 'preset-save': {
      if (!g?.training || !ui.presetSheet) return;
      const name = (document.getElementById('f-preset-name') as HTMLInputElement | null)?.value ?? '';
      const slots = presetEditVM(g, ui.presetSheet.id, ui.presetSheet.draft).slots.map((x) => x.kind);
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
      // 칸이 없으면(선수 화면 이름표 편집은 별명 칸만, C.71a 디자인 177) 그 값은 그대로 둔다
      const val = (x: string) => (act === 'nm-save' ? (document.getElementById(x) as HTMLInputElement | null)?.value ?? null : '');
      for (const [f, x] of [['nickname', 'nm-nick'], ['shortName', 'nm-short']] as const) {
        const nv = val(x);
        if (nv !== null) setNameOverride(g.nameOverrides, id, f, nv);
      }
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
      // 빠른 진행 = 미리 계산 안 함 (C.76m): 보관분을 버린다. 전체 엔진으로 돌아오면 유휴 때 다시
      if (g.options.quickOthers) enginePool?.clearPrefetch();
      planSig = '';
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
      ui.cardSheet = { id: v, from: el.dataset.from === 'pool' ? 'pool' : el.dataset.from === 'view' ? 'view' : 'deck' };
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
      // 리셋 즉발 (C.75h, pending 133): 확인 시트 → 장면 진행 없이 카드만 바꾼다 (카드 1장 제한에 안 셈, 장면당 1번)
      if (mc.role === 'redraw') {
        confirmModal({
          title: '리셋 카드를 사용할까요?', body: '경기는 멈춘 채로 못 쓰는 카드부터 1장 버리고 1장 뽑아요. 이 장면에서 카드 1장은 그대로 더 쓸 수 있어요 (리셋은 장면당 1번).',
          confirm: '리셋 사용', act: 'mo-reset', data: { v: String(mc.hand) },
        });
        return;
      }
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
    case 'mo-reset': {
      ui.modal = null;
      const lv = ui.live;
      const m = lv?.run.pending;
      if (!lv || !m || lv.oc || v === undefined) return render();
      if (lv.run.resetNow(Number(v))) {
        // 패가 바뀌었다: 고른 카드·카드 선택지는 풀고 기본 선택지는 그대로 둔다
        lv.card = null;
        if (lv.sel !== null && lv.sel >= m.options.length) lv.sel = null;
        if (lv.pitch) {
          lv.pitch.options = shownOptions(m, null);
          lv.pitch.selected = lv.sel;
        }
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
    case 'mo-zoom': {
      // 결정 순간·결과 피치 [확대]/[전체] (C.69, 189): 기기 설정, 화면만 다시 그린다
      if (v !== 'zoom' && v !== 'full') return;
      setMomentZoom(v);
      render();
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
    case 'auto-end': {
      // "시즌 요약으로 바로 이동" (22.2, C.73b): 시즌이 끝날 때까지 자동 진행 → 시즌 요약
      if (!g || g.phase !== 'season' || ui.busy) return;
      ui.autoSheet = false;
      void autoRun(g, { matches: autoSheetVM(g).remaining, toEnd: true });
      return;
    }
    case 'auto-pref': {
      const k = el.dataset.k as keyof AutoPrefs | undefined;
      if (!k || !(k in ui.autoPrefs)) return;
      ui.autoPrefs = { ...ui.autoPrefs, [k]: v === 'on' };
      saveAutoPrefs(ui.autoPrefs);
      render();
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
      ui.moreEnd = false;
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
      void (async () => {
        // 비시즌 동안 다른 리그 경기 (45b b): 풀 엔진이면 소집일 전날까지 하루씩 워커로 (빠른 계산이면 startNextSeason 이 한 번에)
        if (!g.options.quickOthers && g.otherLeagues?.length && !ui.busy) {
          ui.busy = true;
          try {
            await offseasonOthers(g);
          } finally {
            ui.busy = false;
            ui.toast = null;
          }
        }
        nextSeasonStart(g);
      })();
      return;
    case 'retire':
      confirmModal({ title: '정말 은퇴할까요?', body: '되돌릴 수 없어요.', confirm: '은퇴하기', act: 'retire-ok', tone: 'danger' });
      return;
    case 'retire-ok':
      if (!g) return;
      retire(g);
      autosave();
      // 은퇴 (C.73a): 지금 챕터 리뷰 → 커리어 요약
      go(chapterReviewVM(g) ? 'chapter' : 'retired');
      return;
    case 'chapter-done':
      if (!g) return;
      chapterReviewed(g);
      autosave();
      go(g.phase === 'retired' ? 'retired' : 'season');
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
      setPitchWeather(g?.lastMatch?.cond?.weather);
      ui.rewatch = 'match';
      go('replay');
      return;
    case 'clip-play': {
      // 경기 후 하이라이트 3개 (24.6, C.77o): 하나(v = 번호) 또는 모두(v = all). 끝나면 결과 화면으로
      const lm = g?.lastMatch;
      const mc = lm ? findClips(g.clips, lm.season, lm.round) : undefined;
      if (!mc) return;
      const pick = v === 'all' ? mc.clips : mc.clips.filter((_, i) => String(i) === v);
      if (!pick.length) return;
      ui.replay?.stop();
      ui.clipBack = { replay: ui.replay };
      setPitchWeather(lm?.cond?.weather);
      ui.replay = new ReplayPlayer(unpackClips(mc), () => render(), undefined, clipScenes(pick));
      ui.rewatch = 'match';
      go('replay');
      return;
    }
    case 'replay-open': {
      const [season, round] = (v ?? '').split(':').map(Number);
      const x = ui.recent.find((r) => r.season === season && r.round === round);
      if (!x) return;
      void unpackReplayBytes(x.data).then((rp) => {
        // 보관 리플레이에는 날씨가 없어 맑음으로 그린다 (C.74a)
        setPitchWeather('clear');
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
    ui.clipBack = null;
    ui.recent = await loadReplays(slot);
    ui.recentDirty = slot !== 'auto';
    syncReplayIndex();
    loadLog.push(Math.round(performance.now() - t0));
    if (slot !== 'auto') void autosave();
    go(loaded.phase === 'retired' ? 'retired' : 'home');
    warmPool();
  } catch (e) {
    // 형식이 다른 옛 세이브 (C.77r): loadGame 이 그 슬롯을 이미 지웠다
    if (e instanceof SaveFormatError) showToast({ kind: 'info', title: e.message, body: '현재 버전에서는 이어 할 수 없어 이 슬롯을 지웠어요. 새 게임으로 시작해 주세요.' }, 4200);
    else showToast((e as Error).message);
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
      warmPool();
      showToast({ kind: 'info', title: '세이브를 가져왔어요', body: `${st.player.name} · ${seasonLabel(st.league.season)} 시즌. 자동 저장 슬롯에 들어갔어요.${cards ? ` 카드 이미지 ${cards}장.` : ''}` }, 2600);
    } catch (e) {
      if (e instanceof SaveFormatError) showToast({ kind: 'info', title: e.message, body: '현재 버전에서는 이어 할 수 없어 가져오지 않았어요.' }, 4200);
      else showToast((e as Error).message || '가져오지 못했어요');
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
  // 선수 화면 이름표 편집 (C.71a 디자인 177): 별명을 쓰면 미리 보기·글자 수만 바로 바꾼다
  if (t.id === 'nm-nick' && t.closest('.pl-look')) {
    const box = t.closest('.pl-look')!;
    const label = t.value.trim() || box.querySelector<HTMLElement>('[data-auto]')?.dataset.auto || '';
    box.querySelectorAll('.lk-prev-name').forEach((x) => { x.textContent = label; });
    const sub = box.querySelector('.lk-prev-sub');
    if (sub) sub.textContent = `${label}${josaIGa(label)} 안으로 파고듭니다`;
    const cnt = box.querySelector('.po-field__label .po-num');
    if (cnt) cnt.textContent = `${[...t.value].length}/${LOOK_NICK_MAX}`;
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
    document.querySelectorAll<SVGGElement>('#ca-prev .po-art-g').forEach((g) => {
      g.innerHTML = artLayer(cc.src, cc, false);
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
render();
void initFaces().then(render, () => render());
void initCardArt().then(render, () => render());
// 카드 그림 (C.48): 못 읽은 그림(404 등)은 지워 기본 장면이 보이게 (C.68c: 카드 안 그림은 SVG 층 .po-art-g 통째로)
app.addEventListener('error', (ev) => {
  const t = ev.target;
  if (t instanceof HTMLImageElement && t.classList.contains('po-art')) t.remove();
  else if (t instanceof SVGImageElement) t.closest('.po-art-g')?.remove();
}, true);
void initSaves().then(render, () => render());
// 오프라인 PWA (C.77r): 배포 빌드에서만 서비스 워커. 새 버전이 설치되면 알림 띠
registerServiceWorker(() => render());
