// C.80y: 세이브 이전 체계 — 모든 예시 세이브(tests/fixtures/saves/v*.json) → 지금 형식 이전·불러와 한 주 진행·저장,
// 지금 형식 fixture·이전 단계가 빠짐없이 있는지(SAVE_FORMAT_VERSION 을 올리고 이전 단계·fixture 를 안 넣으면 여기서 실패), 백업·실패 처리
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '../src/calendar';
import { endDay, isMatchDay, playOthers, playRound, SAVE_FORMAT_VERSION, type GameState } from '../src/game';
import {
  backupFile, deserialize, importSaveWithInfo, initSaves, latestBackup, listSaves, loadGameWithInfo, resetSaveCache, restoreWithInfo, SaveFormatError, SaveMigrationError,
  saveGame, serialize,
} from '../src/save';
import { MIGRATIONS, migrateSave, MIN_MIGRATABLE_FORMAT, needsMigration, validateSave } from '../src/saveMigrations';
import { compress, decompress, memoryBackend, setStoreBackend, storeBackend } from '../src/saveStore';

const DIR = join(__dirname, 'fixtures', 'saves');
const fixtures = readdirSync(DIR).filter((f) => /^v\d+\.json$/.test(f)).map((f) => Number(f.slice(1, -5))).sort((a, b) => a - b);
const fixture = (v: number): Record<string, any> => JSON.parse(readFileSync(join(DIR, `v${v}.json`), 'utf8'));

function advanceWeek(g: GameState): void {
  const until = addDays(g.calendar.date, 7);
  while (g.phase === 'season' && g.calendar.date < until) {
    if (isMatchDay(g)) playRound(g, { engine: 'quick' });
    else {
      playOthers(g, 'quick');
      endDay(g);
    }
  }
}

/** 슬롯에 JSON 그대로(옛 형식 포함) 써 넣기 */
async function putRaw(slot: 'auto' | '1', raw: unknown, meta: Record<string, unknown> = { slot, savedAt: 'x', name: '옛', season: 2018, round: 1, age: 17 }): Promise<void> {
  const json = JSON.stringify(raw);
  const { data, enc } = await compress(json);
  await storeBackend().put(`slot:${slot}`, { meta, data, enc, raw: json.length });
}

describe('세이브 이전 체계 (C.80y)', () => {
  beforeEach(() => {
    setStoreBackend(memoryBackend());
    resetSaveCache();
  });

  it('지금 형식 fixture 가 있고, MIN 부터 지금까지 모든 형식 fixture·이전 단계가 있다', () => {
    expect(existsSync(join(DIR, `v${SAVE_FORMAT_VERSION}.json`)), `tests/fixtures/saves/v${SAVE_FORMAT_VERSION}.json 없음 — npm run save:fixture`).toBe(true);
    expect(fixtures[0]).toBe(MIN_MIGRATABLE_FORMAT);
    for (let v = MIN_MIGRATABLE_FORMAT; v < SAVE_FORMAT_VERSION; v++) {
      expect(typeof MIGRATIONS[v], `MIGRATIONS[${v}] (${v} → ${v + 1}) 없음`).toBe('function');
    }
    for (const v of fixtures) expect(fixture(v).saveFormat).toBe(v);
  });

  it.each(fixtures)('v%i fixture → 지금 형식으로 이전·검증 → 불러와 한 주 진행 → 저장·다시 불러오기', (v) => {
    const raw = fixture(v);
    const before = JSON.stringify(raw);
    const { state, migratedFrom } = restoreWithInfo(raw);
    if (v !== SAVE_FORMAT_VERSION) expect(JSON.stringify(raw)).toBe(before); // 이전은 원본을 건드리지 않는다 (같은 형식은 그 객체를 그대로 쓴다)
    expect(migratedFrom).toBe(v === SAVE_FORMAT_VERSION ? null : v);
    expect(state.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(validateSave(JSON.parse(serialize(state)))).toEqual([]);
    const date = state.calendar.date;
    const round = state.league.round;
    advanceWeek(state);
    expect(state.calendar.date > date).toBe(true);
    expect(state.league.round).toBeGreaterThanOrEqual(round);
    const json = serialize(state);
    expect(serialize(deserialize(json))).toBe(json);
  });

  it('지금 형식 fixture 는 검증을 통과하고, 검증은 빠진 필드를 잡는다', () => {
    const cur = fixture(SAVE_FORMAT_VERSION);
    expect(validateSave(cur)).toEqual([]);
    const bad = structuredClone(cur);
    delete bad.player.teamId;
    bad.league.schedule = 3;
    expect(validateSave(bad)).toEqual(['player.teamId', 'league.schedule']);
    expect(validateSave(null)).toEqual(['세이브가 객체가 아님']);
  });

  it('migrateSave: 너무 옛것·더 새것·숫자 아님은 SaveFormatError, 단계 예외·빠진 단계·검증 실패는 SaveMigrationError', () => {
    const cur = fixture(SAVE_FORMAT_VERSION);
    for (const v of [MIN_MIGRATABLE_FORMAT - 1, 1, SAVE_FORMAT_VERSION + 1, undefined, '59', 59.5]) {
      expect(() => migrateSave({ ...cur, saveFormat: v })).toThrow(SaveFormatError);
    }
    expect(needsMigration({ saveFormat: MIN_MIGRATABLE_FORMAT - 1 })).toBe(false);
    const src = { ...cur, saveFormat: 59 };
    expect(() => migrateSave(src, { 59: () => { throw new Error('펑'); } }, 60)).toThrow(SaveMigrationError);
    const reason = (f: () => unknown): string => {
      try { f(); } catch (e) { return (e as SaveMigrationError).reason; }
      return '';
    };
    expect(reason(() => migrateSave(src, {}, 60))).toMatch(/이전 단계가 없음/);
    expect(reason(() => migrateSave(src, { 59: (s) => ({ ...s, player: undefined }) }, 60))).toMatch(/검증 실패: player/);
    // 여러 단계를 차례로, saveFormat 은 단계마다 맞춘다
    const seen: number[] = [];
    const r = migrateSave({ ...cur, saveFormat: 59 }, { 59: (s) => (seen.push(s.saveFormat), s), 60: (s) => (seen.push(s.saveFormat), { ...s, extra: 1 }) }, 61);
    expect(seen).toEqual([59, 60]);
    expect(r.save.saveFormat).toBe(61);
    expect(r.save.extra).toBe(1);
  });

  it('슬롯 불러오기: 옛 형식은 원본을 백업(최근 1개)하고 이전, 슬롯을 새 형식으로 다시 써 두 번째는 이전 없음', async () => {
    const old = fixtures.find((v) => v < SAVE_FORMAT_VERSION)!;
    await putRaw('auto', fixture(old));
    await initSaves();
    const r = await loadGameWithInfo('auto');
    expect(r!.migratedFrom).toBe(old);
    const b = await latestBackup();
    expect(b?.from).toBe(old);
    expect(b?.slot).toBe('auto');
    expect(JSON.parse(await decompress(b!.data)).saveFormat).toBe(old);
    expect((await storeBackend().keys()).filter((k) => k.startsWith('save_backup_v'))).toEqual([`save_backup_v${old}`]);
    const again = await loadGameWithInfo('auto');
    expect(again!.migratedFrom).toBeNull();
    expect(serialize(again!.state)).toBe(serialize(r!.state));
    // 백업 파일은 가져오기로 다시 이어 할 수 있다 (이전 포함)
    const f = await backupFile(b!);
    expect(f.name).toMatch(new RegExp(`^football-career_backup_v${old}_`));
    const imp = await importSaveWithInfo(f.bytes);
    expect(imp.migratedFrom).toBe(old);
    expect(serialize(imp.state)).toBe(serialize(r!.state));
    // 다른 슬롯을 이전하면 백업은 그것 하나로 바뀐다
    await putRaw('1', { ...fixture(old), worldSeed: 'other' });
    resetSaveCache();
    await loadGameWithInfo('1');
    expect((await latestBackup())?.slot).toBe('1');
    expect((await storeBackend().keys()).filter((k) => k.startsWith('save_backup_v')).length).toBe(1);
  });

  it('이전 실패: SaveMigrationError, 슬롯·백업은 그대로 (지우지 않는다)', async () => {
    const old = fixtures.find((v) => v < SAVE_FORMAT_VERSION)!;
    await putRaw('auto', fixture(old));
    const step = MIGRATIONS[old]!;
    MIGRATIONS[old] = () => { throw new Error('일부러'); };
    try {
      await expect(loadGameWithInfo('auto')).rejects.toThrow(SaveMigrationError);
      await expect(loadGameWithInfo('auto')).rejects.toThrow('이 세이브를 새 버전으로 옮기지 못했어요');
    } finally {
      MIGRATIONS[old] = step;
    }
    const rec = await storeBackend().get<{ data: Uint8Array }>('slot:auto');
    expect(JSON.parse(await decompress(rec!.data)).saveFormat).toBe(old);
    expect(listSaves()[0]).not.toBeNull();
    expect((await latestBackup())?.from).toBe(old);
    // 고친 뒤에는 그대로 이어 한다
    expect((await loadGameWithInfo('auto'))!.migratedFrom).toBe(old);
  });

  it('이전 체계 전 형식(59 미만)은 안내 뒤 슬롯을 지우고, 더 새 형식은 지우지 않는다', async () => {
    await putRaw('auto', { ...fixture(SAVE_FORMAT_VERSION), saveFormat: MIN_MIGRATABLE_FORMAT - 1 });
    await putRaw('1', { ...fixture(SAVE_FORMAT_VERSION), saveFormat: SAVE_FORMAT_VERSION + 1 });
    await initSaves();
    await expect(loadGameWithInfo('auto')).rejects.toThrow('이 세이브는 이전 버전 형식이라 이어 할 수 없습니다');
    expect(listSaves()[0]).toBeNull();
    expect(await latestBackup()).toBeNull();
    await expect(loadGameWithInfo('1')).rejects.toThrow('이 세이브는 더 새 버전에서 저장돼 이어 할 수 없습니다');
    expect(listSaves()[1]).not.toBeNull();
  });

  it('저장한 세이브는 지금 형식이고 다시 불러오면 이전 없음', async () => {
    const { state } = restoreWithInfo(fixture(fixtures[0]!));
    expect(await saveGame('2' as never, state)).toBe(true);
    resetSaveCache();
    const r = await loadGameWithInfo('2' as never);
    expect(r!.migratedFrom).toBeNull();
    expect(r!.state.saveFormat).toBe(SAVE_FORMAT_VERSION);
  });
});
