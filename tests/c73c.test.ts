// C.73c (사용자 요청): 인종별 기본 사진 4장 · 생성 때 인종 고르면 자동 적용 · 랜덤 선수 다인종(국적·이름·외모·사진 일치) · 세이브 41 이식
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { newGame, SAVE_FORMAT_VERSION } from '../src/game';
import { FACE_PHOTOS, PHOTO_OF, raceNationalities, RACES, rollIdentity } from '../src/identity';
import { deserialize, serialize } from '../src/save';
import { customAct, customSpec, customVM, initialCustomForm, SKIN_OF } from '../src/ui/customVM';
import { myFace, newGameVM } from '../src/ui/viewModels';
import { newGameView } from '../src/ui/views/screens';
import { defaultPhotoSrc, faceSrc, heroFaceOf } from '../src/ui/faces';
import { whoOf } from '../src/ui/pixelIcons';
import { NAME_POOLS, PLAYER_EXTRA_POOLS } from '../data/names';

const HANGUL = /^[가-힣]+( [가-힣]+)*$/;
const prospect = (seed: string, extra: object = {}) => newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal', rolled: true, ...extra });

describe('인종 4개 · 기본 사진 4장', () => {
  it('순서 중동 → 동양인 → 백인 → 흑인, 사진 파일 이름', () => {
    expect(RACES).toEqual(['latinMideast', 'eastAsian', 'white', 'black']);
    expect(FACE_PHOTOS).toEqual(['mideast', 'asian', 'white', 'black']);
    expect(RACES.map((r) => PHOTO_OF[r])).toEqual(FACE_PHOTOS);
    expect(PHOTO_OF.irish).toBe('white');
    expect(defaultPhotoSrc('asian')).toBe('faces/default/asian-face.webp');
    expect(defaultPhotoSrc('black', 'full')).toBe('faces/default/black.webp');
  });

  it('커스텀: 인종을 고르면 사진이 자동, 사진 줄로 따로 바꿀 수 있고 스펙에 실린다', () => {
    let f = initialCustomForm();
    expect(f.facePhoto).toBe('asian');
    f = customAct(f, 'app', 'black');
    expect([f.appearance, f.facePhoto]).toEqual(['black', 'black']);
    f = customAct(f, 'photo', 'mideast');
    expect([f.appearance, f.facePhoto]).toEqual(['black', 'mideast']);
    f = customAct(f, 'photo', 'nope');
    expect(f.facePhoto).toBe('mideast');
    const vm = customVM(f, '');
    expect(vm.appearances.map((a) => a.ko)).toEqual(['중동', '동양인', '백인', '흑인']);
    expect(vm.skin).toBe(SKIN_OF.black);
    const g = newGame({ mode: 'custom', custom: customSpec(f, ''), seed: 'c73c-cu', difficulty: 'normal' });
    expect(g.player.facePhoto).toBe('mideast');
    expect(myFace(g).photo).toBe('mideast');
  });
});

describe('랜덤 선수 다인종 (예전엔 국적이 없어 한국·동양계만)', () => {
  it('인종이 고르게 나오고 국적·이름·사진이 인종과 맞다', () => {
    const count: Record<string, number> = {};
    const mideast = new Set<string>(BALANCE.appearance.random.mideastNationalities);
    for (let i = 0; i < 800; i++) {
      const who = rollIdentity(`s${i}`);
      count[who.race] = (count[who.race] ?? 0) + 1;
      expect(who.photo).toBe(PHOTO_OF[who.race]);
      expect(who.name).toMatch(HANGUL);
      expect(raceNationalities(who.race).map(([n]) => n)).toContain(who.nationality);
      if (who.race === 'latinMideast') expect(mideast.has(who.nationality)).toBe(true);
      if (who.nationality === 'Korea Republic' || who.nationality === 'China') expect(who.name).not.toContain(' ');
    }
    for (const r of RACES) expect(count[r]).toBeGreaterThan(150);
  });

  it('국적별 이름 풀: 실제 선수 풀네임을 만들지 않고 한글 표기가 있다', () => {
    for (const p of PLAYER_EXTRA_POOLS) {
      expect(NAME_POOLS.some((q) => q.nationality === p.nationality)).toBe(false);
      for (const [en, ko] of [...p.given, ...p.family]) { expect(en).toBeTruthy(); expect(ko).toMatch(/^[가-힣]+$/); }
    }
  });

  it('랜덤 새 게임에 인종·국적·사진이 저장되고, 같은 시드 = 같은 결과, 능력치·팀은 인종과 무관', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => `c73c-${x}`);
    const races = new Set<string>();
    for (const s of seeds) {
      const g = prospect(s);
      const who = rollIdentity(s);
      expect(g.player.name).toBe(who.name);
      expect([g.player.appearance, g.player.nationality, g.player.facePhoto]).toEqual([who.race, who.nationality, who.photo]);
      races.add(who.race);
      const h = prospect(s, { race: 'black', facePhoto: 'white', name: '테스트' });
      expect([h.player.appearance, h.player.facePhoto, h.player.name]).toEqual(['black', 'white', '테스트']);
      expect(h.player.attributes).toEqual(g.player.attributes);
      expect(h.player.teamId).toBe(g.player.teamId);
      expect(h.player.tags).toEqual(g.player.tags);
    }
    expect(races.size).toBeGreaterThan(1);
  });

  it('랜덤 화면: 인종 칩 4개 · 사진 4장 · 국적·이름 미리보기 (고르면 그 인종)', () => {
    const base = { mode: 'prospect' as const, name: '', position: 'ST', seed: '', difficulty: 'normal', realId: '', roll: 'c73c-view', others: false };
    const vm = newGameVM(base);
    expect(vm.identity!.races.map((r) => r.ko)).toEqual(['중동', '동양인', '백인', '흑인']);
    const html = newGameView(vm);
    expect(html.match(/class="ng-photo[ "]/g)?.length).toBe(4);
    expect(html).toContain(`비우면 ${vm.identity!.name}`);
    const vm2 = newGameVM({ ...base, race: 'white', photo: 'asian' });
    expect([vm2.identity!.race, vm2.identity!.photo, vm2.identity!.picked]).toEqual(['white', 'asian', true]);
  });

  it('내 선수 얼굴·도트: 기본 사진(사용자 사진 없을 때) · 머리말 전신 누끼 · 피부 = 인종', () => {
    const g = prospect('c73c-face', { race: 'latinMideast' });
    const face = myFace(g);
    expect(face.photo).toBe('mideast');
    expect(faceSrc(face)).toBe('faces/default/mideast-face.webp');
    expect(heroFaceOf(face)).toEqual({ src: 'faces/default/mideast.webp', cutout: true });
    expect(whoOf(g, face.id).skin).toBe('mideast');
  });
});

describe('세이브 41 (SAVE_FORMAT_VERSION)', () => {
  it('옛 세이브(40)는 지금 외모로 인종·사진을 채운다 (실제 선수는 없음)', () => {
    expect(SAVE_FORMAT_VERSION).toBe(45);
    const g = prospect('c73c-save');
    const back = deserialize(serialize(g));
    expect(back.player.facePhoto).toBe(g.player.facePhoto);
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 40;
    delete raw.player.facePhoto;
    delete raw.player.appearance;
    delete raw.player.nationality;
    const old = deserialize(JSON.stringify(raw));
    expect([old.player.appearance, old.player.facePhoto]).toEqual(['eastAsian', 'asian']);
    const real = newGame({ mode: 'real', playerId: newGameVM({ mode: 'real', name: '', position: 'ST', seed: '', difficulty: 'normal', realId: '', roll: 'x', others: false }).reals[0]!.id, seed: 'c73c-real', difficulty: 'normal' });
    const r2 = JSON.parse(serialize(real));
    r2.saveFormat = 40;
    expect(deserialize(JSON.stringify(r2)).player.facePhoto).toBeUndefined();
    expect(myFace(real).photo).toBeUndefined();
  });
});
