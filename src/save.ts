// 저장/불러오기 (B.8, 25.4·부록 C.41): IndexedDB + gzip 압축, 수동 슬롯 3 + 자동 저장, 파일 내보내기/가져오기.
// 옛 형식 세이브는 불러올 때 지금 형식으로 이전한다 (C.80y, saveMigrations.ts). 이전 체계 전 형식(59 미만)만 안내 뒤 지운다

import { myShirt, rebuildRosters, rosterLeagues, SAVE_FORMAT_VERSION, type GameState } from './game';
import { setSquadLeague } from './squad';
import { leagueMoves } from './leagueMove';
import { setNamePoolVersion } from './roster';
import { migratedTactics, validTactics } from './myTactics';
import { compress, decompress, storeBackend, type Encoding } from './saveStore';
import { packReplay, unpackReplay, type PackedReplay } from './replayCodec';
import type { Replay } from './replay';
import { migrateSave, MIN_MIGRATABLE_FORMAT, needsMigration, SaveFormatError, SaveMigrationError } from './saveMigrations';

export { SaveFormatError, SaveMigrationError } from './saveMigrations';

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

/** 이 세이브(JSON 객체)가 지금 형식 그대로인가 (이전 없이 이어 할 수 있나) */
export function sameFormat(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && (raw as { saveFormat?: unknown }).saveFormat === SAVE_FORMAT_VERSION;
}

/**
 * 세이브 복원 + 옛 형식이면 이전한 형식 번호 (C.80y). 원본 raw 는 건드리지 않는다.
 * 이전 체계 전 형식·더 새 형식은 SaveFormatError, 이전 실패(단계 예외·검증 실패·복원 예외)는 SaveMigrationError
 */
export function restoreWithInfo(raw: unknown): { state: GameState; migratedFrom: number | null } {
  const { save, from } = migrateSave(raw);
  const migrated = from !== SAVE_FORMAT_VERSION;
  try {
    return { state: restoreCurrent(save as GameState), migratedFrom: migrated ? from : null };
  } catch (e) {
    if (migrated) throw new SaveMigrationError(from, `복원: ${(e as Error)?.message ?? String(e)}`);
    throw e;
  }
}

/** 세이브 복원 (옛 형식이면 이전 뒤). 로스터는 시드로 다시 만든다 */
export function restore(raw: unknown): GameState {
  return restoreWithInfo(raw).state;
}

function restoreCurrent(state: GameState): GameState {
  // 이름 풀 판 (C.45 8번)
  setNamePoolVersion(state.namePool ?? 1);
  // 내 리그 (C.76c): 로스터를 만들기 전에 리그 규칙을 맞춘다
  setSquadLeague(state.league.id);
  state.rosters = rebuildRosters(state.worldSeed, state.player.realPlayerId, state.roster.updates, state.npcs, state.transfers, { on: !!state.legends, except: state.player.legendId, pack: state.legendPack, future: !!state.futureStars }, rosterLeagues(state), leagueMoves(state));
  // 내 등번호 자리 비우기 (C.45, 표시용): 경기 때와 같은 로스터가 되게
  myShirt(state);
  if (!validTactics(state.tactics)) state.tactics = migratedTactics(state.player.teamId, state.rosters[state.player.teamId], state.player.position);
  return state;
}

export function deserialize(json: string): GameState {
  return restore(JSON.parse(json));
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
 * 저장소 열기: 슬롯 목록을 읽는다. 옛 localStorage 세이브(C.40 까지)는 형식이 달라 이어 할 수 없으므로 지운다 (C.77r)
 */
export function initSaves(): Promise<void> {
  return (ready ??= (async () => {
    const db = storeBackend();
    const ls = storage();
    for (const slot of SAVE_SLOTS) {
      try {
        ls?.removeItem(PREFIX + slot);
      } catch {
        // 못 지우면 그대로 둔다 (읽지 않는다)
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

/** 슬롯 불러오기 (옛 형식이면 이전, C.80y). 결과만 */
export async function loadGame(slot: SaveSlot): Promise<GameState | null> {
  return (await loadGameWithInfo(slot))?.state ?? null;
}

/**
 * 슬롯 불러오기 (C.80y): 옛 형식(59 이상)이면 원본을 백업(`save_backup_v{n}`, 최근 1개)에 보관한 뒤 이전하고, 성공하면 슬롯을 새 형식으로 다시 쓴다.
 * 이전 실패 → SaveMigrationError (슬롯·백업 그대로). 이전 체계 전 형식(59 미만) → 그 슬롯(리플레이 포함)을 지우고 SaveFormatError.
 * 더 새 형식(옛 앱으로 연 경우) → 지우지 않고 SaveFormatError
 */
export async function loadGameWithInfo(slot: SaveSlot): Promise<{ state: GameState; migratedFrom: number | null } | null> {
  await initSaves();
  const db = storeBackend();
  const rec = await db.get<StoredSave>(`slot:${slot}`);
  if (!rec) return null;
  const json = await decompress(rec.data);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('세이브 파일이 깨져 불러오지 못했어요');
  }
  if (needsMigration(raw)) await putBackup(slot, (raw as { saveFormat: number }).saveFormat, rec);
  try {
    const r = restoreWithInfo(raw);
    if (r.migratedFrom !== null) {
      // 새 형식으로 다시 써 둔다 (다음 불러오기는 이전 없이). meta 는 그대로(저장 시각 유지)
      const { data, enc, raw: n } = await packState(r.state);
      await db.put(`slot:${slot}`, { meta: { ...rec.meta, size: data.length }, data, enc, raw: n } satisfies StoredSave);
    }
    return r;
  } catch (e) {
    if (e instanceof SaveFormatError && tooOld(e.found)) await deleteSave(slot);
    throw e;
  }
}

const tooOld = (v: unknown): boolean => typeof v !== 'number' || v < MIN_MIGRATABLE_FORMAT;

// ── 이전 전 원본 백업 (C.80y): `save_backup_v{형식}` 하나만 둔다 (최근 1개) ──

const BACKUP_PREFIX = 'save_backup_v';
export interface SaveBackup { slot: SaveSlot; from: number; at: string; meta: SaveMeta; data: Uint8Array; enc: Encoding; raw: number }

async function putBackup(slot: SaveSlot, from: number, rec: StoredSave): Promise<void> {
  const db = storeBackend();
  for (const k of await db.keys()) if (k.startsWith(BACKUP_PREFIX)) await db.del(k);
  await db.put(`${BACKUP_PREFIX}${from}`, { slot, from, at: new Date().toISOString(), meta: rec.meta, data: rec.data, enc: rec.enc, raw: rec.raw } satisfies SaveBackup);
}

/** 가장 최근 이전 백업 (없으면 null) */
export async function latestBackup(): Promise<SaveBackup | null> {
  const db = storeBackend();
  const k = (await db.keys()).find((x) => x.startsWith(BACKUP_PREFIX));
  return k ? ((await db.get<SaveBackup>(k)) ?? null) : null;
}

/** 백업을 내보내기 파일(.fcsave.gz) 형식으로: 고친 버전이 나오면 [가져오기]로 다시 넣을 수 있다 */
export async function backupFile(b: SaveBackup): Promise<{ bytes: Uint8Array; name: string }> {
  const json = await decompress(b.data);
  const { data } = await compress(`{"kind":"${FILE_KIND}","meta":${JSON.stringify(b.meta)},"state":${json}}`);
  return { bytes: data, name: `football-career_backup_v${b.from}_${b.meta.season}_${b.meta.date ?? `r${b.meta.round}`}.fcsave.gz` };
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

/** 가져오기: 압축 파일이나 그냥 JSON 모두 받는다. 옛 형식이면 이전(C.80y). 이전 체계 전 형식은 SaveFormatError, 이전 실패는 SaveMigrationError */
export async function importSave(bytes: Uint8Array): Promise<GameState> {
  return (await importSaveWithInfo(bytes)).state;
}

export async function importSaveWithInfo(bytes: Uint8Array): Promise<{ state: GameState; migratedFrom: number | null }> {
  const text = await decompress(bytes);
  let file: { kind?: string; state?: unknown };
  try {
    file = JSON.parse(text);
  } catch {
    throw new Error('이 게임의 세이브 파일이 아니에요');
  }
  if (file.kind !== FILE_KIND || !file.state) throw new Error('이 게임의 세이브 파일이 아니에요');
  return restoreWithInfo(file.state);
}
