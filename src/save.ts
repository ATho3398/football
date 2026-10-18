// 저장/불러오기 (B.8, 25.4·부록 C.41): IndexedDB + gzip 압축, 수동 슬롯 3 + 자동 저장, 파일 내보내기/가져오기.
// C.40 까지의 localStorage 세이브는 initSaves 가 처음 한 번 옮긴다

import { A_GRADE_PLAYERS } from '../data/players';
import { BALANCE } from './config/balance';
import { myShirt, rebuildRosters, SAVE_FORMAT_VERSION, type GameState } from './game';
import { ensureFinance } from './finance';
import { sortedTable } from './league';
import { setNamePoolVersion } from './roster';
import { migrateRoleId } from './engine/roles';
import { chaptersFromHistory } from './chapters';
import { initialGuide, progressOf, refreshUnlocks } from './unlocks';
import { generatePlayer } from './generate';
import { realPeakTarget } from './growth';
import { emptyRecord } from './matchRecord';
import { positionOvr } from './positions';
import { initialProficiency, initialProfLog, profKey } from './proficiency';
import { migratedTactics, validTactics } from './myTactics';
import { customProblem } from './formations';
import { initCollection } from './cardCollection';
import { aptitudeSeed, mainPositionAptitude } from './aptitude';
import { daysBetween, seasonCalendar } from './calendar';
import { initTraining } from './training';
import { compress, decompress, storeBackend, type Encoding } from './saveStore';
import { packReplay, unpackReplay, type PackedReplay } from './replayCodec';
import type { Replay } from './replay';
import { initialMarket } from './transfer';
import { realBody, rollBody } from './body';
import { REAL_CAREER } from '../data/players/careers';
import { LEGEND_BY_ID } from './legends';
import { awardsFromTotals, trimArchive } from './worldStats';

const PREFIX = 'football-career:';
export const SAVE_SLOTS = ['auto', '1', '2', '3'] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

export interface SaveMeta {
  slot: SaveSlot;
  savedAt: string;
  name: string;
  season: number;
  round: number;
  age: number;
  /** 세이브를 시작한 패치 (21.5.1, 슬롯 목록 표시용). 이 필드가 생기기 전 슬롯은 없다 */
  startPatch?: string | null;
  /** 게임 날짜와 압축 크기 (바이트, C.41) */
  date?: string;
  size?: number;
}

/** 리플레이 프레임을 남기는 내 최근 경기 수 (25.4 2번) */
export const REPLAY_KEEP = 5;

interface SaveFile {
  meta: SaveMeta;
  state: GameState;
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** 로스터(rosters)는 시드로 다시 만들 수 있으므로 담지 않는다 (23번) */
export function serialize(state: GameState): string {
  const { rosters: _r, ...rest } = state;
  return JSON.stringify(rest);
}

/**
 * 이전 형식 세이브 변환. 키 = 변환 전 형식, 값 = 다음 형식으로 바꾸는 함수.
 * SAVE_FORMAT_VERSION 을 올릴 때마다 하나씩 추가한다.
 */
const MIGRATIONS: Record<number, (s: any) => void> = {
  // 1 → 2: 폼 (부록 D.1). 이전 경기 평점은 남아 있지 않으므로 빈 기록에서 시작
  1: (s) => {
    s.player.recentRatings = [];
    if (s.lastMatch) s.lastMatch.formBonus = 0;
  },
  // 2 → 3: 부상 (부록 D.2). 부상 없음, 기록은 0
  2: (s) => {
    s.player.injury = null;
    for (const st of [s.player.season, ...s.player.history]) {
      st.injuries = 0;
      st.injuredWeeks = 0;
    }
  },
  // 3 → 4: 실제 선수 정점 목표 (부록 D.7 #1). 시작 능력치는 시드로 다시 만들 수 있다
  3: (s) => {
    const data = A_GRADE_PLAYERS.find((d) => d.id === s.player.realPlayerId);
    if (!data) return;
    const gen = generatePlayer(data, s.worldSeed);
    s.player.peakTarget = realPeakTarget(positionOvr(gen.attributes, data.position), BALANCE.newGame.startYear - data.birthYear);
  },
  // 4 → 5: 팀 로스터 (23번). 지난 시즌 수만큼 시즌 갱신을 다시 적용한다. 이번 시즌 팀 레이팅은 세이브 값을 유지
  4: (s) => {
    const done = s.league.season - BALANCE.newGame.startYear + (s.phase === 'season' ? 0 : 1);
    s.roster = { updates: Math.max(0, done) };
  },
  // 5 → 6: 카드와 출장 정지 (부록 E.10). 기록은 0, 정지 없음
  5: (s) => {
    s.player.suspended = 0;
    for (const st of [s.player.season, ...s.player.history]) {
      st.yellows = 0;
      st.reds = 0;
    }
  },
  // 6 → 7: 세이브 시작 버전 (21.5.1). 이전 세이브는 시작 버전을 모른다
  6: (s) => {
    s.startPatch = null;
  },
  // 7 → 8: 포지션 숙련도와 레전드 배지 (부록 D.3, D.4). 주 포지션 100·거리 기준 초기값, 실제 선수는 서브 포지션 70. 배지는 없음에서 시작
  7: (s) => {
    const data = A_GRADE_PLAYERS.find((d) => d.id === s.player.realPlayerId);
    s.player.proficiency = initialProficiency(s.player.position, data?.subPositions ?? []);
    s.player.badges = [];
  },
  // 8 → 9 (부록 C.23): 위상 점수는 그대로, 티어는 새 기준으로 다시 계산된다(티어는 저장하지 않고 점수·수상 기록으로 계산).
  // 수상 기록이 없으므로 레전더리였던 선수는 월드클래스가 된다. 이전 주 포지션 목록, 단계적 공개·안내 상태 추가
  8: (s) => {
    s.player.honors = { ballonDor: 0, trebles: 0, worldCups: 0 };
    s.player.formerPositions = s.player.formerPosition ? [s.player.formerPosition] : [];
    s.guide = initialGuide();
    // 이미 경기를 치른 세이브는 첫 경기 오버레이를 건너뛴다. 열린 기능의 소개는 한 번 보여 준다
    s.guide.firstMatchSeen = progressOf(s).matches > 0;
    refreshUnlocks(s);
  },
  // 9 → 10 (부록 C.25): 부진 연속 수(0에서 시작)와 이번 시즌 부진 감점 합계
  9: (s) => {
    s.player.slumpStreak = 0;
    s.player.season.slumpPenalty = 0;
  },
  // 10 → 11 (부록 C.30): 이번 시즌 경기 목록과 경기 기록 합계. 이전 경기 기록은 남아 있지 않으므로 빈 기록에서 시작
  10: (s) => {
    s.matchLog = [];
    s.player.season.rec = emptyRecord();
    s.player.season.recApps = 0;
  },
  // 11 → 12 (부록 C.32, E.19 저장): 내 팀 전술. 로스터를 다시 만든 뒤 "균형 + 팀 데이터 포메이션 + 주 포지션 슬롯"으로 채운다 (migrate 끝)
  11: (s) => {
    s.tactics = null;
  },
  // 12 → 13 (부록 C.33, E.21 1번): 역할 이름 변경(인사이드 포워드 → 윙포워드, 윙어 → 정통 윙어, 연계형 → 펄스 나인,
  // 플레이메이커 → 클래식 10번, 공격형 8번 → 메짤라, CDM 딥라잉 플레이메이커 → 레지스타)과 커스텀 포메이션(없음)
  12: (s) => {
    if (s.tactics) {
      s.tactics.custom = null;
      if (Array.isArray(s.tactics.roles)) s.tactics.roles = s.tactics.roles.map((r: string | null) => migrateRoleId(r));
    }
  },
  // 13 → 14 (부록 C.34, E.11): 내 선수 결정 순간 설정 (직접 모드, 중요한 순간만). 이전 경기의 결정 기록은 없다
  // 커스텀 포메이션 공격 줄 최대 4명 (C.34 임시 규칙): 넘는 대형은 프리셋으로 되돌린다 (전술의 나머지는 그대로)
  13: (s) => {
    s.control = { mode: 'direct', stop: 'important' };
    if (s.tactics && Array.isArray(s.tactics.custom) && customProblem(s.tactics.custom) !== null) s.tactics.custom = null;
  },
  // 14 → 15 (부록 C.35, E5 최소): 결정 기록에 화면이 보여 준 결과(seen)가 붙는다. 선택 필드라 옛 기록은 그대로 (평점 판정을 쓴다)
  14: () => {},
  // 15 → 16 (부록 C.36, 3단계 카드): 카드 모음. 주 포지션군 시작 덱 8장(덱 세트 3개 같은 덱), 숙련도·역할 출전 0,
  // 레벨 선택권은 지금 레벨까지 지난 것으로 친다 (변환 직후 선택권이 몰려 나오지 않게)
  15: (s) => {
    s.cards = initCollection(s.player.position, s.player.level ?? 0);
  },
  // 16 → 17 (부록 C.37, pending 36 ⑤): 숨은 포지션 적성. 지금 주 포지션군 1.2~1.4·나머지 0.7~1.0(엇갈림 없음),
  // 재능 타입은 능력치에서 추정. 조언 없음, 지난 시즌 기록의 포지션은 모른다(조언 판정은 지금 주 포지션으로 본다)
  16: (s) => {
    s.player.aptitude = mainPositionAptitude(s.player.position, s.player.attributes, aptitudeSeed(s.worldSeed));
    s.player.advice = null;
    s.player.adviceLog = [];
    s.player.aptBoost = null;
  },
  // 17 → 18 (부록 C.38, 25.1~25.2): 하루 단위 캘린더. 날짜 = 이번 라운드 첫 경기 날 (비시즌이면 최종 라운드 날).
  // 피로는 그 날부터 내 경기까지 하루씩 회복하므로, 옛 "경기 전 주간 회복"과 같아지게 모자란 날만큼 미리 회복해 둔다.
  // 부상 남은 주 → 남은 날 (× 7). 다른 경기 기록·선수 합계는 이번 라운드부터 쌓인다. 진행 설정은 전체 엔진
  17: (s) => {
    const cal = seasonCalendar(s.worldSeed, s.league.season, s.league.schedule);
    const r = s.league.round;
    if (s.phase === 'season' && r < s.league.schedule.length) {
      const date = cal.roundDates[r]!;
      const i = s.league.schedule[r].findIndex((f: any) => f.home === s.player.teamId || f.away === s.player.teamId);
      const gap = Math.max(0, daysBetween(date, cal.fixtureDates[r]![i]!));
      const F = BALANCE.fatigue;
      const weekly = s.player.injury ? F.noMatchWeekRecovery : F.weeklyRecovery;
      s.player.fatigue = Math.max(0, s.player.fatigue - (weekly * Math.max(0, 7 - gap)) / 7);
      s.calendar = { date };
    } else {
      s.calendar = { date: cal.final };
    }
    for (const inj of [s.player.injury, s.lastMatch?.injury]) {
      if (!inj) continue;
      inj.daysTotal = inj.weeksTotal * 7;
      inj.daysLeft = (inj.weeksLeft ?? inj.weeksTotal) * 7;
      delete inj.weeksLeft;
    }
    s.playerStats = {};
    s.options = { quickOthers: false };
  },
  // 18 → 19 (부록 C.39, D.3 개정): 숙련도 값은 그대로, 포지션별 진행 기록만 추가. 출전 수는 남아 있는 이번 시즌 경기 목록에서 세고
  // (지난 시즌은 모른다), 100인 포지션은 100 달성으로 본다. 연속 미출전은 0에서 시작
  18: (s) => {
    const log = initialProfLog(s.player.proficiency);
    for (const m of s.matchLog ?? []) {
      const k = m.minutes > 0 && m.position ? profKey(m.position) : null;
      if (k && log[k]) log[k]!.apps++;
    }
    s.player.profLog = log;
    // 능력치 바둑판의 이번 시즌 변화는 변환 시점부터
    s.player.seasonStartAttrs = { ...s.player.attributes };
  },
  // 19 → 20 (부록 C.41, 25.3·25.4): 훈련 상태(기본 계획·게이지 0에서 시작), 지난 시즌 보존 기록(없음에서 시작 — 옛 세이브는 지난 시즌 경기 목록이 없다).
  // 포변 조언 기간 "다음 시즌 4라운드" → "소집 뒤 30일".
  // 이미 다음 시즌 중인 조언은 남은 라운드를 날로 바꾸지 않고 30일을 그대로 준다 (짧아지지 않게)
  19: (s) => {
    s.training = initTraining(s.calendar.date);
    s.archive = [];
    if (s.player.advice) {
      delete s.player.advice.untilRound;
      s.player.advice.untilDays = BALANCE.aptitude.advice.windowDays;
    }
  },
  // 20 → 21 (부록 C.42, 18.6·18.10): NPC 이적 기록(없음에서 시작), 내 선수 계약(지금 팀, 오늘부터 — 가상 유망주 3년, 실제 선수 시드),
  // 제안·요청 없음. 비시즌 세이브는 다음 시즌 레이팅을 startNextSeason 이 다시 계산하고, 제안은 다음 비시즌부터 온다
  20: (s) => {
    s.transfers = [];
    s.market = initialMarket(s);
    if (s.phase !== 'season') s.market.contract = { ...s.market.contract, from: s.league.season + 1, until: s.market.contract.until + 1 };
  },
  // C.44: 시즌 시작 레벨 (시즌 종료 화면 레벨 변화). 옛 세이브는 모르므로 비워 둔다 (화면은 지금 레벨만)
  21: () => {},
  // 22 → 23 (부록 C.44a): 이름 고치기(별명·짧은 이름) 없음에서 시작. 실제 선수 한글 이름을 한국 통용 표기로 (반 다이크 등, 표시만)
  22: (s) => {
    s.nameOverrides = {};
    const ko = new Map(A_GRADE_PLAYERS.map((p) => [p.id, p.nameKo]));
    for (const n of s.npcs ?? []) if (ko.has(n.id)) n.nameKo = ko.get(n.id);
  },
  // 23 → 24 (부록 C.45): 내 선수 신체·양발(실제 선수 = 데이터, 유망주 = `me:<시드>` 분포), 장단점 없음(옛 커리어에 새로 붙이지 않는다),
  // 등번호(실제 선수 = 데이터, 유망주 = 경기 때 팀의 빈 관례 번호), 도트 아이콘 직접 바꾸기 없음. 강제 은퇴로 끝난 세이브는 그대로 은퇴 상태
  23: (s) => {
    const p = s.player;
    const real = p.realPlayerId ? A_GRADE_PLAYERS.find((d) => d.id === p.realPlayerId) : undefined;
    p.body = (p.realPlayerId && realBody(p.realPlayerId)) || rollBody(`me:${s.worldSeed}`, p.position);
    p.traits = [];
    if (real) p.shirt = real.shirtNumber;
    s.pixelOverrides = { players: {}, kits: {} };
  },
  // 24 → 25 (C.45 2차, pending 66): 장단점(traits)과 스토리 태그를 하나의 태그(tags)로. 이름 바뀜(다혈질 → 문제아, 기복 → 롤러코스터,
  // 스타 플레이어 → 스타 기질), 늦은 개화는 플레이 전용 "늦게 핀 꽃"(34c)이 되어 생성 선택분은 빠진다. 1차에서 고른 장단점은 영구. 원클럽맨 판정 기록
  24: (s) => {
    const p = s.player;
    const RENAME: Record<string, string> = { hotHead: 'troublemaker', inconsistent: 'rollercoaster', star: 'starQuality' };
    const start = s.league.season - (p.history?.length ?? 0);
    const created = (p.traits ?? []).filter((id: string) => id !== 'lateBloomer').map((id: string) => ({ id: RENAME[id] ?? id, perm: true, season: start }));
    const story = (p.tags ?? []).map((t: { id: string; name?: string; club?: string; season: number; date?: string }) => ({
      id: t.id, perm: t.id !== 'oneClubMan', season: t.season, ...(t.date ? { date: t.date } : {}), ...(t.name ? { name: t.name } : {}), ...(t.club ? { club: t.club } : {}),
    }));
    p.tags = [...created, ...story];
    delete p.traits;
    const moved = (s.market?.moves ?? []).filter((m: { loan?: boolean; back?: boolean }) => !m.loan && !m.back);
    const real = p.realPlayerId ? REAL_CAREER[p.realPlayerId] : undefined;
    p.clubRun = moved.length
      ? { club: p.teamId, renewals: 0, since: moved.at(-1).season, first: false }
      : { club: p.teamId, renewals: 0, since: real?.since ?? start, first: true };
    if (real && !p.youth) p.youth = { club: real.youth };
  },
  // 25 → 26 (C.46): 구단 재정. 이번 이적 시즌 예산 (비시즌이면 이번 시즌 순위, 시즌 중이면 레이팅 순). 옛 이적 기록에는 몸값이 없어 쓴 돈 0.
  // 로스터는 새 규칙(21세 이하 추가 유망주, 인원 맞추기)으로 다시 만들어진다
  // 26 → 27 (C.47): 레전드 팩 옵션(옛 세이브는 끔), 태그 기록 필드(늦게 핀 꽃 면제·방출 구단·자연 발생 태그 판정 기록)는 없으면 빈 값
  26: (s) => {
    s.legends = false;
  },
  // 27 → 28 (C.48): 계약 바이아웃(없으면 계약 길이로 계산, myBuyout), 소속 구단이 거절한 제안(market.refused, 없으면 없음). 옮길 값 없음
  27: () => {},
  // 28 → 29 (C.49, pending 80): 성장 포인트를 1~20 화면 칸 단위로. 남은 포인트 ÷ 5 올림(손해 없게), 레벨당 한 능력치 상한 기록(allocation) 없앰
  28: (s) => {
    const p = s.player;
    p.unspentPoints = Math.ceil((p.unspentPoints ?? 0) / 5);
    delete p.allocation;
  },
  // 29 → 30 (C.50, pending 82 1번): 실제 선수·레전드 한글 이름을 한국 통용 이름으로(요한 크루이프 등). 저장된 이름을 데이터 id 로 다시 읽는다
  // (NPC·이적 기록·내 선수). 레전드 로스터 선수는 로드 때 데이터에서 다시 만들어지므로 따로 옮길 것 없음
  29: (s) => {
    const ko = new Map<string, string>([...A_GRADE_PLAYERS.map((d) => [d.id, d.nameKo] as const), ...[...LEGEND_BY_ID.values()].map((l) => [l.id, l.nameKo] as const)]);
    for (const n of s.npcs ?? []) if (ko.has(n.id)) n.nameKo = ko.get(n.id);
    for (const t of s.transfers ?? []) if (ko.has(t.id)) t.name = ko.get(t.id);
    const me = s.player.realPlayerId ?? s.player.legendId;
    if (me && ko.has(me)) s.player.name = ko.get(me);
  },
  // 30 → 31 (C.52, pending 82 6번): 훈련 프리셋. 균형(= 지금까지의 기본 계획) · 자동 적용 켬 · 커스텀 없음, 이번 주는 다음 하루 진행 때 정한다
  30: (s) => {
    if (s.training) Object.assign(s.training, { preset: 'balance', presetWeek: '', presetAuto: true, presetManual: false, customPresets: [], presetSeq: 0 });
  },
  // 31 → 32 (C.62): 감독 신뢰도·면담(manager)과 시즌 기록 선수 이름(statNames). 옛 세이브는 둘 다 없음 → 다음 경기·화면에서 새 팀 시작값으로 만든다
  31: () => {},
  // 32 → 33 (C.63): 인박스·이벤트·라이벌·경질 감독·주장·생활 지표. 옛 세이브는 모두 없음 → 처음 쓸 때 만든다 (라이벌·슬롯은 다음 시즌부터)
  32: () => {},
  // 33 → 34 (C.64): 지난 시즌 시상 줄(aw)과 세이브 상한(오래된 시즌은 요약). 옛 기록은 선수 합계에서 시상을 다시 만들고(영플레이어 없음) 상한대로 줄인다
  33: (s) => {
    for (const a of s.archive ?? []) a.aw ??= awardsFromTotals(a.players ?? {});
    if (s.archive) trimArchive(s.archive);
  },
  // 34 → 35 (C.65): 시즌 목표(goals). 옛 세이브는 없음 → 시즌 중이면 다음 화면·경기에서 이번 시즌 목표를 만든다 (지금까지 기록으로 진행 표시)
  34: () => {},
  // 35 → 36 (C.67a): 컵 대진(cups)·가족 휴가(events.leave)·컵 기록(season.cup). 옛 세이브는 없음 → 다음 하루 진행 때 이번 시즌 FA컵을 만든다
  // (32강 날짜가 이미 지났으면 이번 시즌은 컵 없음, 다음 시즌부터)
  35: () => {},
  // 36 → 37 (C.67b): 챔스(cups.ucl)·챔스 우승 기록(honors.ucl). 옛 세이브는 없음 → 이번 시즌은 챔스 없이, 다음 시즌부터
  36: () => {},
  // 37 → 38 (C.68a): 개인 재정·스태프(money). 옛 세이브는 없음 → 처음 쓸 때 잔고 0 으로 만든다 (이미 치른 이번 시즌 출전·골은 보너스 없음,
  // 그 전 주급은 다음 시즌 시작 때 52주 − 정산한 주 몫에 같이 들어간다)
  37: () => {},
  // 38 → 39 (C.68b): 재정 b — money.shop·house·car·charity·invest·agent, cards.tp·tpUsed. 모두 없으면 기본값(숙소·차 없음·기부 0·투자 0·TP 0)
  38: () => {},
  // 39 → 40 (C.73a): 커리어 챕터 기록(chapters). 지난 시즌 기록(history)을 나이로 묶어 채운다 (리뷰·선택권 없음)
  39: (s) => { s.chapters = chaptersFromHistory(s); },
  25: (s) => {
    const offseason = s.phase !== 'season';
    const ranks = offseason ? Object.fromEntries(sortedTable(s.league).map((r, i) => [r.teamId, i + 1])) : undefined;
    ensureFinance(s, s.league.season + (offseason ? 1 : 0), ranks);
  },
};

export function migrate(raw: any): GameState {
  const from = raw.saveFormat;
  if (typeof from !== 'number' || from > SAVE_FORMAT_VERSION) {
    throw new Error(`세이브 형식이 맞지 않습니다 (세이브 ${from}, 게임 ${SAVE_FORMAT_VERSION})`);
  }
  for (let v = from; v < SAVE_FORMAT_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`세이브 형식 ${v} 을 변환할 수 없습니다`);
    step(raw);
    raw.saveFormat = v + 1;
  }
  const state = raw as GameState;
  // 이름 풀 판 (C.45 8번): namePool 이 없는 옛 세이브는 옛 풀로 다시 만들어 생성 선수 이름을 지킨다
  setNamePoolVersion(state.namePool ?? 1);
  state.rosters = rebuildRosters(state.worldSeed, state.player.realPlayerId, state.roster.updates, state.npcs, state.transfers, { on: !!state.legends, except: state.player.legendId });
  // 내 등번호 자리 비우기 (C.45, 표시용): 경기 때와 같은 로스터가 되게
  myShirt(state);
  if (!validTactics(state.tactics)) state.tactics = migratedTactics(state.player.teamId, state.rosters[state.player.teamId], state.player.position);
  return state;
}

export function deserialize(json: string): GameState {
  return migrate(JSON.parse(json));
}

// ── 저장소 (25.4, 부록 C.41): IndexedDB + gzip. 슬롯 목록은 메모리에 들고 있어 화면이 바로 그린다 ──

interface StoredSave {
  meta: SaveMeta;
  data: Uint8Array;
  enc: Encoding;
  /** 압축 전 바이트 */
  raw: number;
}

const metas = new Map<SaveSlot, SaveMeta>();
let ready: Promise<void> | null = null;

function metaOf(slot: SaveSlot, state: GameState, size?: number): SaveMeta {
  return {
    slot, savedAt: new Date().toISOString(), name: state.player.name, season: state.league.season, round: state.league.round, age: state.player.age,
    startPatch: state.startPatch, date: state.calendar?.date, ...(size !== undefined ? { size } : {}),
  };
}

/**
 * 저장소 열기: 슬롯 목록을 읽고, 옛 localStorage 세이브(C.40 까지)는 처음 한 번 IndexedDB 로 옮긴 뒤 지운다.
 * 옮긴 세이브는 형식 그대로 (불러올 때 migrate 로 변환)
 */
export function initSaves(): Promise<void> {
  return (ready ??= (async () => {
    const db = storeBackend();
    const ls = storage();
    for (const slot of SAVE_SLOTS) {
      const key = PREFIX + slot;
      const legacy = ls?.getItem(key);
      if (legacy) {
        try {
          const file = JSON.parse(legacy) as SaveFile;
          if (!(await db.get(`slot:${slot}`))) {
            const json = JSON.stringify(file.state);
            const { data, enc } = await compress(json);
            await db.put(`slot:${slot}`, { meta: { ...file.meta, size: data.length }, data, enc, raw: json.length } satisfies StoredSave);
          }
          ls!.removeItem(key);
        } catch {
          // 깨진 옛 세이브는 그대로 둔다
        }
      }
      const rec = await db.get<StoredSave>(`slot:${slot}`);
      if (rec) metas.set(slot, rec.meta);
      else metas.delete(slot);
    }
  })());
}

/** 테스트용: 저장소를 다시 열게 한다 */
export function resetSaveCache(): void {
  ready = null;
  metas.clear();
}

/** 슬롯 목록 (initSaves 뒤. 그 전에는 비어 있다) */
export function listSaves(): (SaveMeta | null)[] {
  return SAVE_SLOTS.map((slot) => metas.get(slot) ?? null);
}

/** 압축한 세이브 바이트 (측정·내보내기) */
export async function packState(state: GameState): Promise<{ data: Uint8Array; enc: Encoding; raw: number }> {
  const json = serialize(state);
  return { ...(await compress(json)), raw: json.length };
}

export async function saveGame(slot: SaveSlot, state: GameState): Promise<boolean> {
  try {
    await initSaves();
    const { data, enc, raw } = await packState(state);
    const meta = metaOf(slot, state, data.length);
    await storeBackend().put(`slot:${slot}`, { meta, data, enc, raw } satisfies StoredSave);
    metas.set(slot, meta);
    return true;
  } catch {
    return false;
  }
}

export async function loadGame(slot: SaveSlot): Promise<GameState | null> {
  await initSaves();
  const rec = await storeBackend().get<StoredSave>(`slot:${slot}`);
  if (!rec) return null;
  return deserialize(await decompress(rec.data));
}

export async function deleteSave(slot: SaveSlot): Promise<void> {
  await initSaves();
  await storeBackend().del(`slot:${slot}`);
  await deleteReplays(slot);
  metas.delete(slot);
}

// ── 리플레이 프레임: 내 최근 5경기만 (25.4 2번). 경기마다 따로 압축해 두고(replayCodec), 목록만 슬롯에 ──

export interface ReplayMeta { season: number; round: number; label: string }
export interface StoredReplay extends ReplayMeta { data: Uint8Array }

const rpKey = (slot: SaveSlot, m: ReplayMeta) => `rp:${slot}:${m.season}:${m.round}`;

/** 리플레이 하나를 압축 바이트로 (경기 직후 한 번) */
export async function packReplayBytes(r: Replay): Promise<Uint8Array> {
  return (await compress(JSON.stringify(packReplay(r)))).data;
}

export async function unpackReplayBytes(data: Uint8Array): Promise<Replay> {
  return unpackReplay(JSON.parse(await decompress(data)) as PackedReplay);
}

/** 슬롯의 리플레이 목록을 list 로 맞춘다: 없는 것만 쓰고, 빠진 것은 지운다 */
export async function saveReplays(slot: SaveSlot, list: StoredReplay[]): Promise<void> {
  const db = storeBackend();
  const keep = list.slice(-REPLAY_KEEP);
  const old = (await db.get<ReplayMeta[]>(`replays:${slot}`)) ?? [];
  const oldKeys = new Set(old.map((m) => rpKey(slot, m)));
  for (const r of keep) if (!oldKeys.has(rpKey(slot, r))) await db.put(rpKey(slot, r), r.data);
  const newKeys = new Set(keep.map((r) => rpKey(slot, r)));
  for (const k of oldKeys) if (!newKeys.has(k)) await db.del(k);
  await db.put(`replays:${slot}`, keep.map(({ season, round, label }) => ({ season, round, label })));
}

export async function loadReplays(slot: SaveSlot): Promise<StoredReplay[]> {
  const db = storeBackend();
  const index = (await db.get<ReplayMeta[]>(`replays:${slot}`)) ?? [];
  const out: StoredReplay[] = [];
  for (const m of index) {
    const data = await db.get<Uint8Array>(rpKey(slot, m));
    if (data) out.push({ ...m, data });
  }
  return out;
}

export async function copyReplays(from: SaveSlot, to: SaveSlot): Promise<void> {
  await saveReplays(to, await loadReplays(from));
}

async function deleteReplays(slot: SaveSlot): Promise<void> {
  await saveReplays(slot, []);
  await storeBackend().del(`replays:${slot}`);
}

// ── 파일 내보내기/가져오기 (25.4 3번): gzip 압축 JSON ──

const FILE_KIND = 'football-career-save';

/** 내보내기 파일 바이트: gzip({ kind, meta, state }) */
export async function exportSave(state: GameState): Promise<Uint8Array> {
  const meta = metaOf('auto', state);
  const { data } = await compress(`{"kind":"${FILE_KIND}","meta":${JSON.stringify(meta)},"state":${serialize(state)}}`);
  return data;
}

/** 내보내기 파일 이름: football-career_시즌_날짜.fcsave.gz (한글 파일 이름은 일부 브라우저가 무시하고 "download"로 바꾼다, C.41 캡처) */
export function exportFileName(state: GameState): string {
  return `football-career_${state.league.season}_${state.calendar?.date ?? `r${state.league.round}`}.fcsave.gz`;
}

/** 가져오기: 압축 파일이나 그냥 JSON 모두 받는다. 옛 형식은 변환한다 */
export async function importSave(bytes: Uint8Array): Promise<GameState> {
  const text = await decompress(bytes);
  const file = JSON.parse(text) as { kind?: string; state?: unknown };
  if (file.kind !== FILE_KIND || !file.state) throw new Error('이 게임의 세이브 파일이 아니에요');
  return migrate(file.state);
}
