import { afterEach, describe, expect, it } from 'vitest';
import { FAMOUS_FULL_NAMES, NAME_POOLS, NAME_POOLS_V1 } from '../data/names';
import { A_GRADE_PLAYERS } from '../data/players';
import { newGame, rebuildRosters, type GameState } from '../src/game';
import { nameFromPool, nameKey, setNamePoolVersion, type Rosters } from '../src/roster';
import { deserialize, serialize } from '../src/save';

// 부록 C.45 8번: 생성 선수 이름 풀 2판

const MAJOR = new Set(['England', 'Scotland', 'Republic of Ireland', 'France', 'Spain', 'Portugal', 'Germany', 'Netherlands', 'Belgium', 'Brazil', 'Argentina']);

afterEach(() => setNamePoolVersion(2));

describe('이름 풀 2판 (C.45 8번)', () => {
  it('국적·순서·weight 는 1판과 같다 (풀 고르기가 같아 국적도 그대로)', () => {
    expect(NAME_POOLS.map((p) => [p.nationality, p.weight])).toEqual(NAME_POOLS_V1.map((p) => [p.nationality, p.weight]));
  });

  it('주요 국적은 성 120·이름 60 이상, 나머지는 성 40·이름 25 이상. 중복 없음, 한글 표기 있음', () => {
    for (const p of NAME_POOLS) {
      const [minF, minG] = MAJOR.has(p.nationality) ? [120, 60] : [40, 25];
      expect(p.family.length, `${p.nationality} 성`).toBeGreaterThanOrEqual(minF);
      expect(p.given.length, `${p.nationality} 이름`).toBeGreaterThanOrEqual(minG);
      for (const list of [p.given, p.family]) {
        expect(new Set(list.map(([r]) => r)).size, `${p.nationality} 영문 중복`).toBe(list.length);
        for (const [r, k] of list) {
          expect(r).toMatch(/^[A-Za-zÀ-ÿĀ-ž' ]+$/);
          expect(k, r).toMatch(/^[가-힣]+( [가-힣]+)*$/);
        }
      }
    }
  });

  it('1판 풀에 이미 있던 이름은 2판에도 남는다 (풀만 늘림)', () => {
    for (let i = 0; i < NAME_POOLS_V1.length; i++) {
      const v2g = new Set(NAME_POOLS[i]!.given.map(([r]) => r));
      const v2f = new Set(NAME_POOLS[i]!.family.map(([r]) => r));
      for (const [r] of NAME_POOLS_V1[i]!.given) expect(v2g.has(r), r).toBe(true);
      for (const [r] of NAME_POOLS_V1[i]!.family) expect(v2f.has(r), r).toBe(true);
    }
  });

  it('풀에서 나오는 모든 조합이 게임 데이터 실제 선수(A_GRADE_PLAYERS) 이름과 같지 않다 (흔한 성이라 겹치는 조합은 다음 성으로 넘긴다)', () => {
    const real = new Set(A_GRADE_PLAYERS.map((p) => nameKey(p.name)));
    for (const p of NAME_POOLS) {
      for (let gi = 0; gi < p.given.length; gi++) {
        for (let fi = 0; fi < p.family.length; fi++) {
          const n = nameFromPool(p, gi, fi, 2).name;
          expect(real.has(nameKey(n)), n).toBe(false);
        }
      }
    }
  });

  it('2판에서 실제로 나오는 이름은 실제 선수·유명 선수 풀네임을 피한다', () => {
    const banned = new Set([...A_GRADE_PLAYERS.map((p) => p.name), ...FAMOUS_FULL_NAMES].map(nameKey));
    let skipped = 0;
    for (const p of NAME_POOLS) {
      for (let gi = 0; gi < p.given.length; gi++) {
        for (let fi = 0; fi < p.family.length; fi++) {
          const n = nameFromPool(p, gi, fi, 2);
          expect(banned.has(nameKey(n.name)), n.name).toBe(false);
          if (n.name !== `${p.given[gi]![0]} ${p.family[fi]![0]}`) skipped++;
        }
      }
    }
    expect(skipped).toBeGreaterThan(0);
  });
});

function build(v: 1 | 2, seed: string, updates: number): Rosters {
  setNamePoolVersion(v);
  return rebuildRosters(seed, undefined, updates);
}

/** 이름에서 나오는 값(name, nameKo, appearance — rollAppearance 키가 id:name)만 뺀다 */
function strip(r: Rosters): unknown {
  return JSON.parse(JSON.stringify(r, (k, v) => (k === 'name' || k === 'nameKo' || k === 'appearance' ? undefined : v)));
}

describe('이름 풀 판과 결정성 (C.45 8번)', () => {
  it('1판·2판 로스터는 이름(name·nameKo)과 외형(appearance) 말고 모두 같다 (rng 호출 수 동일)', () => {
    for (const [seed, updates] of [['pool-a', 0], ['pool-b', 2]] as const) {
      const a = build(1, seed, updates);
      const b = build(2, seed, updates);
      expect(strip(b)).toEqual(strip(a));
      const nat = (r: Rosters) => Object.values(r).flatMap((t) => t.players.map((p) => p.nationality));
      expect(nat(b)).toEqual(nat(a));
      const names = (r: Rosters) => Object.values(r).flatMap((t) => t.players.filter((p) => !p.real).map((p) => p.name));
      expect(names(b)).not.toEqual(names(a));
    }
  });

  it('새 게임은 namePool 2, 옛 세이브(namePool 없음)는 1판 이름으로, 2판 세이브는 2판 이름으로 다시 만든다', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'pool-save', difficulty: 'normal' });
    expect(g.namePool).toBe(2);
    const names = (s: GameState) => Object.values(s.rosters).flatMap((t) => t.players.map((p) => `${p.id}:${p.name}:${p.nameKo}`));
    const v2 = names(g);

    const again = deserialize(serialize(g));
    expect(names(again)).toEqual(v2);

    const raw = JSON.parse(serialize(g));
    delete raw.namePool;
    const old = deserialize(JSON.stringify(raw));
    expect(old.namePool).toBeUndefined();
    const v1 = names(old);
    expect(v1).not.toEqual(v2);
    setNamePoolVersion(1);
    const ref = rebuildRosters(g.worldSeed, undefined, 0);
    expect(v1).toEqual(Object.values(ref).flatMap((t) => t.players.map((p) => `${p.id}:${p.name}:${p.nameKo}`)));
  });
});
