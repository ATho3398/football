// 저장/불러오기 (B.8): 브라우저 localStorage

import { SAVE_FORMAT_VERSION, type GameState } from './game';

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

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const state = JSON.parse(json) as GameState;
  if (state.saveFormat !== SAVE_FORMAT_VERSION) {
    throw new Error(`세이브 형식이 맞지 않습니다 (세이브 ${state.saveFormat}, 게임 ${SAVE_FORMAT_VERSION})`);
  }
  return state;
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
    s.setItem(PREFIX + slot, JSON.stringify({ meta, state } satisfies SaveFile));
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
