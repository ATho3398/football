import { describe, expect, it } from 'vitest';
import { BALANCE_VERSION } from '../src/config/balance';
import { ENGINE_VERSION } from '../src/engine/config';
import { newGame, SAVE_FORMAT_VERSION } from '../src/game';
import { deserialize, serialize } from '../src/save';
import { PATCH_LABEL, saveStartNotice, versionLabel } from '../src/version';

describe('버전 표시 (21.5.1)', () => {
  it('패치 이름은 부록 C 소절 번호 형식 (fix 소절 포함)', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?( fix\d*)?$/);
  });

  it('버전 문자열 형식', () => {
    expect(versionLabel()).toMatch(
      /^버전 C\.\d+[a-z]?( fix\d*)? · 엔진 \d+ · 밸런스 \d+ · (\d{4}-\d{2}-\d{2} 배포|dev 빌드) \(커밋 ([0-9a-f]{7,}|dev)\)$/,
    );
    expect(versionLabel({ patch: 'C.18', commit: 'abc1234', date: '2026-10-15' })).toBe(
      `버전 C.18 · 엔진 ${ENGINE_VERSION} · 밸런스 ${BALANCE_VERSION} · 2026-10-15 배포 (커밋 abc1234)`,
    );
  });

  it('세이브 시작 버전 알림', () => {
    expect(saveStartNotice(PATCH_LABEL)).toBeNull();
    expect(saveStartNotice('C.16', 'C.18')).toBe('이 세이브는 C.16에서 시작했어요. 이전 버전으로 진행된 경기 기록이 섞여 있어요.');
    expect(saveStartNotice(null)).toBe('이전 버전에서 시작한 세이브예요.');
  });

  it('새 게임은 시작 패치를 기록하고 저장/불러오기 후에도 유지', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'ver', difficulty: 'normal' });
    expect(g.startPatch).toBe(PATCH_LABEL);
    expect(deserialize(serialize(g)).startPatch).toBe(PATCH_LABEL);
  });

  it('이전 형식(6) 세이브는 시작 버전 없음(null)으로 변환', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'ver-old', difficulty: 'normal' });
    const raw = JSON.parse(serialize(g));
    delete raw.startPatch;
    raw.saveFormat = 6;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(loaded.startPatch).toBeNull();
    expect(saveStartNotice(loaded.startPatch)).toBe('이전 버전에서 시작한 세이브예요.');
  });
});
