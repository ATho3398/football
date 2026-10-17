// 도트 선수 아이콘 (부록 C.45, docs/design/pixel-kits.md 6번): 레이어 분리 무손실, 매니페스트 448조합, 없는 조합 대체,
// 원정·GK 유니폼 충돌 규칙, 같은 id = 같은 인물, 사용자 지정 우선순위·되돌리기, 경기 결과 결정성(보기·아이콘 무관)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLUB_KITS, NATION_KITS } from '../data/kits';
import { PIXEL_KITS, PIXEL_ORDER, PIXEL_PEOPLE } from '../data/pixelPack';
import { REAL_PIXEL_LOOK } from '../data/players/pixelLook';
import { A_GRADE_PLAYERS } from '../data/players';
import { OUTSIDE_CLUBS } from '../data/outsideClubs';
import { BALANCE } from '../src/config/balance';
import { newGame, playRound } from '../src/game';
import { initialTeams } from '../src/league';
import {
  allPeople, autoPerson, emptyOverrides, kitDistance, kitFor, matchKits, personKey, personOf, rollPerson, setKitOverride, setPersonOverride, validPerson,
} from '../src/pixel';
import { deserialize, serialize } from '../src/save';
import { applyPixelManifest, pixelLayerUrls, type PixelManifest } from '../src/ui/faces';
import { setPitchView } from '../src/ui/pitch/renderer';
import { composite, decodePng, readPack16, splitLayers, type Rgba } from '../scripts/pixelPng';

const ROOT = join(__dirname, '..');
const PIX = join(ROOT, 'public/faces/pixel');
const ZIP = join(ROOT, 'docs/design/incoming/kits_full_pack.zip');
const CLASH = BALANCE.pixelLook.clashDistance;

const sameImage = (a: Rgba, b: Rgba): boolean => {
  if (a.w !== b.w || a.h !== b.h) return false;
  for (let i = 0; i < a.px.length; i += 4) {
    if (a.px[i + 3] === 0 && b.px[i + 3] === 0) continue;
    for (let k = 0; k < 4; k++) if (a.px[i + k] !== b.px[i + k]) return false;
  }
  return true;
};

describe('레이어 분리 (pixel-kits.md 1번)', () => {
  it('zip 448장 = 레포 인물 14장 + 유니폼 32장을 겹친 것과 픽셀 단위로 같다', () => {
    const originals = readPack16(new Uint8Array(readFileSync(ZIP)));
    expect(originals).toHaveLength(448);
    const split = splitLayers(originals);
    expect(split.stats.mixed).toBe(0);
    expect(split.order).toBe(PIXEL_ORDER);
    const people = new Map<string, Rgba>();
    const kits = new Map<string, Rgba>();
    for (const o of originals) {
      const pk = `${o.skin}_${o.hair}`;
      if (!people.has(pk)) people.set(pk, decodePng(new Uint8Array(readFileSync(join(PIX, 'person', `${pk}.png`)))));
      if (!kits.has(o.kit)) kits.set(o.kit, decodePng(new Uint8Array(readFileSync(join(PIX, 'kit', `${o.kit}.png`)))));
      const p = people.get(pk)!;
      const k = kits.get(o.kit)!;
      const c = PIXEL_ORDER === 'kit-over-person' ? composite(p, k) : composite(k, p);
      expect(sameImage(c, o.img), `${o.kit} ${pk}`).toBe(true);
    }
    expect(people.size).toBe(14);
    expect(kits.size).toBe(32);
  });
});

describe('매니페스트 version 2', () => {
  const manifest = JSON.parse(readFileSync(join(PIX, 'manifest.json'), 'utf8')) as PixelManifest & { kits: Record<string, { file: string; colors: string[]; mean: string }> };

  it('448조합 모두 레이어 파일이 있고, data/pixelPack.ts 와 같다', () => {
    expect(manifest.version).toBe(2);
    applyPixelManifest(manifest);
    expect(Object.keys(manifest.kits).sort()).toEqual(Object.keys(PIXEL_KITS).sort());
    for (const [id, k] of Object.entries(manifest.kits)) {
      expect(k.colors).toEqual(PIXEL_KITS[id]!.colors);
      expect(k.mean).toBe(PIXEL_KITS[id]!.mean);
    }
    expect(manifest.people).toEqual(PIXEL_PEOPLE);
    let n = 0;
    for (const p of allPeople()) {
      for (const kit of Object.keys(PIXEL_KITS)) {
        const urls = pixelLayerUrls(p, kit);
        expect(urls, `${personKey(p)} ${kit}`).toBeDefined();
        for (const u of urls!) expect(existsSync(join(ROOT, 'public', u))).toBe(true);
        n++;
      }
    }
    expect(n).toBe(448);
    expect(pixelLayerUrls({ skin: 'black', hair: 'brown' }, 'C01')).toBeUndefined();
    expect(pixelLayerUrls({ skin: 'white', hair: 'black' }, 'Z99')).toBeUndefined();
  });

  it('단색 유니폼 색은 원본 몸통 픽셀에서 (빨강 C01, 흑백 줄 S01 두 색)', () => {
    expect(PIXEL_KITS.C01!.colors).toHaveLength(1);
    expect(PIXEL_KITS.S01!.colors).toHaveLength(2);
    expect(kitDistance('C01', 'C02')).toBeGreaterThan(CLASH);
  });
});

describe('인물 (3번)', () => {
  it('없는 조합 대체: black+brown → black, mideast+blonde → brown, 그 밖에는 같은 피부의 첫 머리', () => {
    expect(validPerson({ skin: 'black', hair: 'brown' })).toEqual({ skin: 'black', hair: 'black' });
    expect(validPerson({ skin: 'mideast', hair: 'blonde' })).toEqual({ skin: 'mideast', hair: 'brown' });
    expect(validPerson({ skin: 'yellow', hair: 'red' })).toEqual({ skin: 'yellow', hair: 'black' });
    expect(validPerson({ skin: 'white', hair: 'bald' })).toEqual({ skin: 'white', hair: 'bald' });
    expect(validPerson({ skin: 'green', hair: 'black' }).skin).toBe('white');
    // 팩이 바뀌어 조합이 빠져도 대체
    expect(validPerson({ skin: 'white', hair: 'blonde' }, { white: ['brown', 'black'] })).toEqual({ skin: 'white', hair: 'brown' });
  });

  it('같은 선수 id 는 늘 같은 인물, 모두 팩에 있는 조합, 외모군 분포를 따른다', () => {
    const keys = new Set(allPeople().map(personKey));
    for (let i = 0; i < 300; i++) {
      for (const a of ['eastAsian', 'white', 'irish', 'black', 'latinMideast'] as const) {
        const p = rollPerson(`gen:${i}`, a);
        expect(rollPerson(`gen:${i}`, a)).toEqual(p);
        expect(keys.has(personKey(p))).toBe(true);
      }
    }
    expect(rollPerson('x', 'eastAsian').skin).toBe('yellow');
    expect(rollPerson('x', 'black').skin).toBe('black');
    let mideast = 0;
    for (let i = 0; i < 1000; i++) if (rollPerson(`lm${i}`, 'latinMideast').skin === 'mideast') mideast++;
    expect(mideast / 1000).toBeGreaterThan(0.6);
    expect(mideast / 1000).toBeLessThan(0.8);
  });

  it('실제 선수 표: 34명 모두 있는 실제 선수 id, 팩에 있는 조합', () => {
    const ids = new Set(A_GRADE_PLAYERS.map((p) => p.id));
    for (const [id, p] of Object.entries(REAL_PIXEL_LOOK)) {
      expect(ids.has(id), id).toBe(true);
      expect(validPerson(p)).toEqual(p);
    }
    expect(Object.keys(REAL_PIXEL_LOOK)).toHaveLength(34);
    expect(personOf('son', 'eastAsian')).toEqual({ skin: 'yellow', hair: 'black' });
    expect(personOf('neymar', 'latinMideast')).toEqual({ skin: 'white', hair: 'blonde' });
  });

  it('내 선수: 고른 머리(pixelHair) + 외모군 피부, 없는 머리면 대체', () => {
    const p = personOf('me:seed', 'eastAsian', { hair: 'brown' });
    expect(p).toEqual({ skin: 'yellow', hair: 'brown' });
    expect(personOf('me:seed', 'black', { hair: 'brown' })).toEqual({ skin: 'black', hair: 'black' });
    expect(personOf('me:seed', 'eastAsian').skin).toBe('yellow');
  });

  it('우선순위: 사용자 지정 > 실제 선수 표 > 자동, [자동으로 되돌리기]', () => {
    const o = emptyOverrides();
    const auto = autoPerson('gen:1', 'white');
    expect(personOf('gen:1', 'white', { overrides: o })).toEqual(auto);
    setPersonOverride(o, 'son', { skin: 'white', hair: 'blonde' });
    setPersonOverride(o, 'gen:1', { skin: 'black', hair: 'bald' });
    expect(personOf('son', 'eastAsian', { overrides: o })).toEqual({ skin: 'white', hair: 'blonde' });
    expect(personOf('gen:1', 'white', { overrides: o })).toEqual({ skin: 'black', hair: 'bald' });
    setPersonOverride(o, 'son', null);
    setPersonOverride(o, 'gen:1', null);
    expect(o.players).toEqual({});
    expect(personOf('son', 'eastAsian', { overrides: o })).toEqual({ skin: 'yellow', hair: 'black' });
    expect(personOf('gen:1', 'white', { overrides: o })).toEqual(auto);
  });
});

describe('유니폼 (4번)', () => {
  it('표: PL 20 + 리그 밖 34 구단 id 가 게임 id 와 같고, 대표팀 23, 모두 팩 유니폼', () => {
    const ids = [...initialTeams().map((t) => t.id), ...OUTSIDE_CLUBS.map((c) => c.id)].sort();
    expect(Object.keys(CLUB_KITS).sort()).toEqual(ids);
    expect(Object.keys(NATION_KITS)).toHaveLength(23);
    for (const k of [...Object.values(CLUB_KITS), ...Object.values(NATION_KITS)]) {
      expect(PIXEL_KITS[k.home]).toBeDefined();
      expect(PIXEL_KITS[k.away]).toBeDefined();
    }
    for (const n of Object.keys(NATION_KITS)) expect(BALANCE.appearance.byNationality[n], n).toBeDefined();
  });

  it('리버풀(홈)–맨유: 같은 빨강 → 맨유 원정(흰)', () => {
    expect(matchKits('liv', 'mun')).toMatchObject({ home: 'C01', away: 'C02' });
  });

  it('첼시–에버턴: 같은 파랑 → 에버턴 원정(검정), 토트넘–풀럼 흰 → 풀럼 검정, 뉴캐슬–사우샘프턴 줄무늬 → 원정', () => {
    expect(matchKits('che', 'eve')).toMatchObject({ home: 'C03', away: 'C05' });
    expect(matchKits('tot', 'ful')).toMatchObject({ home: 'C02', away: 'C05' });
    expect(matchKits('new', 'sou')).toMatchObject({ home: 'S01', away: 'C05' });
    // 색이 다르면 원정 팀도 홈 유니폼
    expect(matchKits('liv', 'che')).toMatchObject({ home: 'C01', away: 'C03' });
  });

  it('GK: 모든 PL 경기에서 양 팀 필드 유니폼·상대 GK와 기준 이상 떨어진다', () => {
    const teams = initialTeams().map((t) => t.id);
    for (const h of teams) {
      for (const a of teams) {
        if (h === a) continue;
        const k = matchKits(h, a);
        expect(kitDistance(k.home, k.away), `${h}-${a}`).toBeGreaterThanOrEqual(CLASH);
        for (const gk of [k.homeGk, k.awayGk]) {
          expect(kitDistance(gk, k.home), `${h}-${a} ${gk}`).toBeGreaterThanOrEqual(CLASH);
          expect(kitDistance(gk, k.away), `${h}-${a} ${gk}`).toBeGreaterThanOrEqual(CLASH);
        }
        expect(kitDistance(k.homeGk, k.awayGk), `${h}-${a}`).toBeGreaterThanOrEqual(CLASH);
      }
    }
    expect(matchKits('liv', 'mun')).toMatchObject({ homeGk: 'C07', awayGk: 'C06' });
  });

  it('표에 없는 팀: 팀 색과 가장 가까운 단색이 홈, 가장 먼 단색이 원정. 색도 모르면 흰/검정', () => {
    expect(kitFor('zzz')).toEqual(BALANCE.pixelLook.fallbackKit);
    expect(kitFor('n:Atlantis')).toEqual(BALANCE.pixelLook.fallbackKit);
    expect(kitFor('n:England')).toEqual({ home: 'C02', away: 'C01' });
  });

  it('사용자 지정 유니폼이 먼저, 충돌 규칙은 바꾼 값으로 다시 계산, 되돌리기', () => {
    const o = emptyOverrides();
    setKitOverride(o, 'mun', 'home', 'C05');
    expect(kitFor('mun', o)).toEqual({ home: 'C05', away: 'C02' });
    expect(matchKits('liv', 'mun', o)).toMatchObject({ home: 'C01', away: 'C05' });
    setKitOverride(o, 'mun', 'home', 'NOPE');
    expect(kitFor('mun', o).home).toBe('C01');
    setKitOverride(o, 'liv', 'away', 'C06');
    setKitOverride(o, 'liv', 'away', null);
    expect(o.kits).toEqual({});
  });
});

describe('겉모습만 (6번 결정성)', () => {
  it('캐릭터 보기 켜고 끄기, 아이콘·유니폼을 바꿔도 같은 시드면 같은 경기 결과. 세이브 왕복에도 pixelOverrides 유지', () => {
    const play = (setup: (g: ReturnType<typeof newGame>) => void) => {
      const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c45-pixel', difficulty: 'normal' });
      setup(g);
      const rep = playRound(g);
      const { pixelOverrides: _o, ...rest } = g;
      return JSON.stringify({ rep, table: rest.league.table, player: rest.player });
    };
    setPitchView('number');
    const a = play(() => {});
    setPitchView('character');
    const b = play((g) => {
      const o = (g.pixelOverrides = emptyOverrides());
      for (const r of Object.values(g.rosters)) for (const p of r.players) setPersonOverride(o, p.id, { skin: 'black', hair: 'bald' });
      setKitOverride(o, 'liv', 'home', 'C10');
    });
    setPitchView('number');
    expect(b).toBe(a);

    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c45-save', difficulty: 'normal' });
    g.pixelOverrides = emptyOverrides();
    setPersonOverride(g.pixelOverrides, 'son', { skin: 'white', hair: 'brown' });
    setKitOverride(g.pixelOverrides, 'tot', 'away', 'C06');
    const back = deserialize(serialize(g));
    expect(back.pixelOverrides).toEqual(g.pixelOverrides);
    setPersonOverride(back.pixelOverrides!, 'son', null);
    expect(personOf('son', 'eastAsian', { overrides: back.pixelOverrides })).toEqual({ skin: 'yellow', hair: 'black' });
  });
});
