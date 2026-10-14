// 저장/불러오기 (B.8): 브라우저 localStorage

import { A_GRADE_PLAYERS } from '../data/players';
import { BALANCE } from './config/balance';
import { rebuildRosters, SAVE_FORMAT_VERSION, type GameState } from './game';
import { generatePlayer } from './generate';
import { realPeakTarget } from './growth';
import { positionOvr } from './positions';

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
