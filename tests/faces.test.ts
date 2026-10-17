// 얼굴·엠블럼·페이스온 (부록 C.43)
import { describe, expect, it } from 'vitest';
import { APPEARANCES, rollAppearance } from '../src/appearance';
import { newGame } from '../src/game';
import { ageSlot, autoEmblem, clubInitials, clubOf, faceSrc, playerIdOf } from '../src/ui/faces';
import { readZip, writeZip } from '../src/ui/zip';

describe('외모군', () => {
  it('국적 분포에서 뽑고, 같은 키는 같은 결과', () => {
    expect(rollAppearance('a', 'Korea Republic')).toBe('eastAsian');
    expect(rollAppearance('x1', 'England')).toBe(rollAppearance('x1', 'England'));
    const n = 2000;
    let irish = 0;
    for (let i = 0; i < n; i++) if (rollAppearance(`ie${i}`, 'Republic of Ireland') === 'irish') irish++;
    expect(irish / n).toBeGreaterThan(0.6);
    expect(irish / n).toBeLessThan(0.8);
    const eng = new Set(Array.from({ length: 300 }, (_, i) => rollAppearance(`en${i}`, 'England')));
    expect(eng.has('white') && eng.has('black')).toBe(true);
  });

  it('모든 로스터 선수에 외모군이 있다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'faces-a', difficulty: 'normal' });
    const all = Object.values(g.rosters).flatMap((r) => r.players);
    expect(all.length).toBeGreaterThan(400);
    for (const p of all) expect(APPEARANCES).toContain(p.appearance);
    expect(all.find((p) => p.id === 'kane')?.appearance).toBe('white');
  });
});

describe('이름 색인·엠블럼', () => {
  it('한글·영문 구단 이름과 선수 이름을 찾는다', () => {
    expect(clubOf('아스널')?.id).toBe('ars');
    expect(clubOf('Tottenham Hotspur')?.id).toBe('tot');
    expect(clubOf('토트넘 홋스퍼')?.id).toBe('tot');
    expect(clubOf('')).toBeUndefined();
    expect(playerIdOf('손흥민')).toBe('son');
    expect(playerIdOf('Kylian Mbappe')).toBe('mbappe');
  });

  it('자동 엠블럼은 시드 고정, 구단마다 다르다', () => {
    expect(autoEmblem('ars', '아스널', 24)).toBe(autoEmblem('ars', '아스널', 24));
    expect(autoEmblem('ars', '아스널', 24)).not.toBe(autoEmblem('tot', '토트넘 홋스퍼', 24));
    expect(clubInitials('Manchester City')).toBe('MC');
    expect(clubInitials('FC Barcelona')).toBe('BAR');
    expect(autoEmblem('v:new-club', 'Riverside Rovers', 24)).toContain('RR');
  });

  it('나이대 칸과 사진 없는 선수', () => {
    expect([ageSlot(17), ageSlot(23), ageSlot(24), ageSlot(29), ageSlot(30)]).toEqual(['young', 'young', 'prime', 'prime', 'veteran']);
    // 매니페스트를 읽기 전(테스트)에는 이미지가 없다 → 지금 아바타
    expect(faceSrc({ id: 'v:x', age: 20, appearance: 'white' })).toBeUndefined();
  });
});

describe('페이스팩 zip', () => {
  it('쓰고 다시 읽으면 같다 (무압축, UTF-8 이름)', async () => {
    const a = new Uint8Array([1, 2, 3, 250]);
    const b = new TextEncoder().encode('{"version":1}');
    const z = writeZip([{ name: 'players/손흥민__son@prime.webp', data: a }, { name: 'facepack.json', data: b }]);
    const back = await readZip(z);
    expect(back.map((e) => e.name)).toEqual(['players/손흥민__son@prime.webp', 'facepack.json']);
    expect([...back[0]!.data]).toEqual([...a]);
    expect(new TextDecoder().decode(back[1]!.data)).toBe('{"version":1}');
  });
});
