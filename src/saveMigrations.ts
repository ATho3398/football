// 세이브 이전 (C.80y, 사용자 2026-11-04 "이제 패치돼도 세이브 마이그레이션되게"): 옛 형식 세이브를 불러올 때
// 저장된 형식 번호부터 지금 SAVE_FORMAT_VERSION 까지 단계 표(MIGRATIONS)를 차례로 적용한다.
//
// 세이브 형식을 바꾸는 패치 체크리스트 (docs/automation.md 와 같다):
//   1. SAVE_FORMAT_VERSION 을 n → n+1 로 올리고 MIGRATIONS[n] 에 n → n+1 단계를 넣는다 (순수 함수: 새 필드는 기본값, 옛 필드는 변환·삭제)
//   2. tests/fixtures/saves/v{n+1}.json 을 만든다 (npm run save:fixture) — 옛 fixture 는 지우지 않는다
//   3. npm test (tests/save-migration.test.ts 가 모든 fixture → 지금 형식 이전·한 주 진행·저장을 검사한다)
//
// 이 체계가 생기기 전 형식(MIN_MIGRATABLE_FORMAT 미만)만 기존처럼 "이어 할 수 없음" 안내 뒤 지운다.

import { SAVE_FORMAT_VERSION } from './game';

/** 이전할 수 있는 가장 옛 형식 (C.80y 시점의 형식). 이보다 낮으면 이전 코드가 없던 시절이라 지운다 */
export const MIN_MIGRATABLE_FORMAT = 59;

/** 세이브 JSON (로스터 뺀 GameState). 이전 단계는 타입을 모르는 옛 객체를 다룬다 */
export type RawSave = Record<string, any>;

/**
 * 이전 단계 표: MIGRATIONS[n] 은 형식 n 세이브를 n+1 로 바꾼다.
 * 각 단계는 받은 객체를 고치지 않고(structuredClone 한 복사본을 받는다) 새 객체를 돌려준다. saveFormat 은 migrateSave 가 맞춘다
 */
export const MIGRATIONS: Record<number, (save: RawSave) => RawSave> = {
  // 59 → 60 (C.80y): 체계 시연용 빈 단계. 필드 변화 없음
  59: (s) => s,
};

/** 형식 번호가 이전할 수 없을 만큼 옛것(이전 코드가 없던 시절)이거나 지금보다 새것 */
export class SaveFormatError extends Error {
  constructor(readonly found: unknown) {
    super(typeof found === 'number' && found > SAVE_FORMAT_VERSION
      ? '이 세이브는 더 새 버전에서 저장돼 이어 할 수 없습니다'
      : '이 세이브는 이전 버전 형식이라 이어 할 수 없습니다');
    this.name = 'SaveFormatError';
  }
}

/** 이전하다 실패(단계 예외·검증 실패). 원본 세이브는 지우지 않는다 */
export class SaveMigrationError extends Error {
  constructor(readonly from: number, readonly reason: string) {
    super('이 세이브를 새 버전으로 옮기지 못했어요');
    this.name = 'SaveMigrationError';
  }
}

/** 이 세이브가 이전 대상인가 (형식 번호가 MIN 이상 지금 미만) */
export function needsMigration(raw: unknown): boolean {
  const v = (raw as { saveFormat?: unknown } | null)?.saveFormat;
  return typeof v === 'number' && v >= MIN_MIGRATABLE_FORMAT && v < SAVE_FORMAT_VERSION;
}

/**
 * 저장된 형식에서 지금 형식까지 이전한다. 원본(raw)은 건드리지 않는다.
 * 같은 형식이면 raw 그대로. 너무 옛것·더 새것·숫자 아님 → SaveFormatError. 단계가 없거나 예외·검증 실패 → SaveMigrationError
 */
export function migrateSave(raw: unknown, migrations: Record<number, (s: RawSave) => RawSave> = MIGRATIONS, target = SAVE_FORMAT_VERSION): { save: RawSave; from: number } {
  if (!raw || typeof raw !== 'object') throw new SaveFormatError(undefined);
  const from = (raw as RawSave).saveFormat;
  if (typeof from !== 'number' || !Number.isInteger(from) || from < MIN_MIGRATABLE_FORMAT || from > target) throw new SaveFormatError(from);
  if (from === target) return { save: raw as RawSave, from };
  let s: RawSave = structuredClone(raw) as RawSave;
  for (let v = from; v < target; v++) {
    const step = migrations[v];
    if (!step) throw new SaveMigrationError(from, `${v} → ${v + 1} 이전 단계가 없음`);
    try {
      s = step(s);
    } catch (e) {
      throw new SaveMigrationError(from, `${v} → ${v + 1}: ${(e as Error)?.message ?? String(e)}`);
    }
    if (!s || typeof s !== 'object') throw new SaveMigrationError(from, `${v} → ${v + 1}: 결과가 객체가 아님`);
    s.saveFormat = v + 1;
  }
  const bad = validateSave(s, target);
  if (bad.length) throw new SaveMigrationError(from, `검증 실패: ${bad.join(', ')}`);
  return { save: s, from };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * 지금 형식 스키마 가벼운 검사 (필수 필드·타입). 문제 목록, 비면 통과.
 * 이전 결과 확인용이라 깊이 보지 않는다: 불러온 뒤 화면·한 주 진행이 깨지지 않을 뼈대만
 */
export function validateSave(s: unknown, target = SAVE_FORMAT_VERSION): string[] {
  const out: string[] = [];
  if (!isObj(s)) return ['세이브가 객체가 아님'];
  const need = (path: string, ok: boolean) => { if (!ok) out.push(path); };
  need('saveFormat', s.saveFormat === target);
  need('balanceVersion', typeof s.balanceVersion === 'number');
  need('worldSeed', typeof s.worldSeed === 'string' && s.worldSeed.length > 0);
  need('difficulty', typeof s.difficulty === 'string');
  need('phase', s.phase === 'season' || s.phase === 'offseason' || s.phase === 'retired');
  const p = s.player;
  need('player', isObj(p));
  if (isObj(p)) {
    need('player.name', typeof p.name === 'string');
    need('player.teamId', typeof p.teamId === 'string');
    need('player.position', typeof p.position === 'string');
    need('player.age', typeof p.age === 'number');
    need('player.attributes', isObj(p.attributes));
  }
  const l = s.league;
  need('league', isObj(l));
  if (isObj(l)) {
    need('league.id', typeof l.id === 'string');
    need('league.season', typeof l.season === 'number');
    need('league.round', typeof l.round === 'number');
    need('league.teams', Array.isArray(l.teams));
    need('league.schedule', Array.isArray(l.schedule));
    need('league.table', Array.isArray(l.table));
  }
  need('calendar.date', isObj(s.calendar) && typeof s.calendar.date === 'string');
  need('roster.updates', isObj(s.roster) && typeof s.roster.updates === 'number');
  need('npcs', Array.isArray(s.npcs));
  need('transfers', Array.isArray(s.transfers));
  return out;
}
