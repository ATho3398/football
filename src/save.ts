// 저장/불러오기 (B.8): 브라우저 localStorage

import { A_GRADE_PLAYERS } from '../data/players';
import { BALANCE } from './config/balance';
import { rebuildRosters, SAVE_FORMAT_VERSION, type GameState } from './game';
import { migrateRoleId } from './engine/roles';
import { initialGuide, progressOf, refreshUnlocks } from './unlocks';
import { generatePlayer } from './generate';
import { realPeakTarget } from './growth';
import { emptyRecord } from './matchRecord';
import { positionOvr } from './positions';
import { initialProficiency } from './proficiency';
import { migratedTactics, validTactics } from './myTactics';
import { customProblem } from './formations';

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
}

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
  state.rosters = rebuildRosters(state.worldSeed, state.player.realPlayerId, state.roster.updates, state.npcs);
  if (!validTactics(state.tactics)) state.tactics = migratedTactics(state.player.teamId, state.rosters[state.player.teamId], state.player.position);
  return state;
}

export function deserialize(json: string): GameState {
  return migrate(JSON.parse(json));
}

export function saveGame(slot: SaveSlot, state: GameState): boolean {
  const s = storage();
  if (!s) return false;
  const meta: SaveMeta = {
    slot,
    savedAt: new Date().toISOString(),
    name: state.player.name,
    season: state.league.season,
    round: state.league.round,
    age: state.player.age,
    startPatch: state.startPatch,
  };
  try {
    s.setItem(PREFIX + slot, `{"meta":${JSON.stringify(meta)},"state":${serialize(state)}}`);
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot: SaveSlot): GameState | null {
  const raw = storage()?.getItem(PREFIX + slot);
  if (!raw) return null;
  const file = JSON.parse(raw) as SaveFile;
  return deserialize(JSON.stringify(file.state));
}

export function listSaves(): (SaveMeta | null)[] {
  const s = storage();
  return SAVE_SLOTS.map((slot) => {
    const raw = s?.getItem(PREFIX + slot);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as SaveFile).meta;
    } catch {
      return null;
    }
  });
}

export function deleteSave(slot: SaveSlot): void {
  storage()?.removeItem(PREFIX + slot);
}
