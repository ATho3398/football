// C.75x·C.75y (pending 131): 레전드 팩에 도르트문트 레전드, 따로 미래 스타 팩 (구현 리그 첫 시즌에 등장)
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { autoMarket, newGame, playRound, rebuildRosters, SAVE_FORMAT_VERSION, startNextSeason, type GameState } from '../src/game';
import { deserialize, serialize } from '../src/save';
import { BVB_LEGENDS, FUTURE_STARS, LEGEND_RETIRED_BY } from '../data/players/legends';
import { A_GRADE_PLAYERS } from '../data/players';
import { futureAge, futureDebut, futureEntry, LEGEND_PACK, LEGENDS, legendPeak, legendSpawns, packRealExcludes, selectableLegends, upcomingFutureStars, waitingFutureStars } from '../src/legends';
import { initialTeams } from '../src/league';
import { naturalOvr, type Rosters } from '../src/roster';
import { withinRules } from '../src/squad';
import { newGameVM, worldVM } from '../src/ui/viewModels';
import { personDetailVM } from '../src/ui/detailVM';

const TEAMS = initialTeams().map((t) => ({ id: t.id, rating: t.baseRating }));
const ids = (r: Rosters) => new Set(Object.values(r).flatMap((x) => x.players.map((p) => p.id)));
const find = (r: Rosters, id: string) => Object.values(r).flatMap((x) => x.players).find((p) => p.id === id);

function finishSeason(g: GameState): void {
  while (g.phase === 'season') playRound(g, { engine: 'quick' });
}

describe('도르트문트 레전드 (C.75x)', () => {
  it('21명, 이름 표기 "위르겐 콜러"·"얀 콜러", 2020 뒤 은퇴는 이 명단만 예외(lateRetired)', () => {
    expect(BVB_LEGENDS.length).toBe(21);
    const names = BVB_LEGENDS.map((l) => l.nameKo);
    for (const n of ['로만 바이덴펠러', '옌스 레만', '슈테판 클로스', '마티아스 자머', '위르겐 콜러', '데데', '미하엘 초르크', '라르스 리켄', '토마시 로시츠키', '제바스티안 켈', '스테판 샤퓌자', '얀 콜러', '우카시 피슈첵', '네벤 수보티치', '마르셀 슈멜처']) {
      expect(names, n).toContain(n);
    }
    for (const l of BVB_LEGENDS) {
      expect(l.group).toBe('bvb');
      expect(l.youthKo).toBe('도르트문트');
      expect(!!l.lateRetired).toBe(l.retired > LEGEND_RETIRED_BY);
    }
    // 2020 예외는 도르트문트 명단에만
    expect(LEGENDS.filter((l) => l.retired > LEGEND_RETIRED_BY).every((l) => (l.group === 'bvb' || l.group === 'ext') && l.lateRetired)).toBe(true); // C.75w 추가 명단도 예외
    expect(BVB_LEGENDS.filter((l) => l.lateRetired).map((l) => l.id).sort()).toEqual(
      ['lg-barrios', 'lg-hummels', 'lg-kuba', 'lg-piszczek', 'lg-sahin', 'lg-santana', 'lg-sbender', 'lg-schmelzer', 'lg-subotic'],
    );
    // 고를 수 있는 레전드에 도르트문트 필드 선수 포함 (GK 3명 제외)
    expect(selectableLegends().filter((l) => l.group === 'bvb').length).toBe(18);
  });

  it('id·실제 선수와 겹치지 않는다 (중복 금지)', () => {
    const all = [...LEGENDS, ...FUTURE_STARS];
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    expect(all.some((l) => A_GRADE_PLAYERS.some((p) => p.id === l.id))).toBe(false);
    // 같은 이름 실제 선수는 지금 없다 (있으면 팩을 켤 때 현역 로스터에서 빠진다)
    expect(packRealExcludes(LEGEND_PACK, true).size).toBe(0);
    for (const l of all) expect(legendPeak(l).ovr).toBeGreaterThanOrEqual(BALANCE.legends.groupMinPeak);
  });
});

describe('미래 스타 팩 (C.75y: 레전드 팩과 따로, 구현 리그 첫 시즌 등장)', () => {
  it('13명, 리그 id 기준 첫 시즌 데이터 · PL 등장 4명(가르나초·마이누·홀란·비르츠), 나머지는 리그 추가 후', () => {
    expect(FUTURE_STARS.length).toBe(13);
    const at = (id: string) => { const l = FUTURE_STARS.find((x) => x.id === id)!; const d = futureDebut(l); return d === undefined ? null : [d, futureAge(l, d), futureEntry(l)!.team]; };
    expect(at('fs-garnacho')).toEqual([2021, 17, 'mun']);
    expect(at('fs-mainoo')).toEqual([2022, 17, 'mun']);
    expect(at('fs-haaland')).toEqual([2022, 22, 'mci']);
    expect(at('fs-wirtz')).toEqual([2025, 22, 'liv']);
    for (const id of ['fs-yamal', 'fs-pedri', 'fs-gavi', 'fs-bellingham', 'fs-musiala', 'fs-camavinga', 'fs-cubarsi', 'fs-endrick', 'fs-zaireemery']) expect(at(id), id).toBeNull();
    expect(waitingFutureStars().length).toBe(9);
    expect(upcomingFutureStars(2018).map((l) => l.id)).toEqual(['fs-garnacho', 'fs-haaland', 'fs-mainoo', 'fs-wirtz']);
    // 리그가 추가되면 그 리그 첫 시즌 (예: 분데스리가 → 홀란 2019-20 도르트문트)
    expect(futureEntry(FUTURE_STARS.find((l) => l.id === 'fs-haaland')!, ['pl', 'bundesliga'])).toEqual({ league: 'bundesliga', season: 2019, team: 'x:bvb' });
    // 실제 경력 표가 있다
    for (const l of FUTURE_STARS) expect(l.career!.length, l.id).toBeGreaterThan(0);
  });

  it('등장 전에는 없고 첫 시즌 시작에 그 팀으로 들어온다 (rebuild 와 같음), 시작은 낮고 성장한다', () => {
    const ws = 'c75y-fs';
    const opt = { on: false, future: true };
    const r0 = rebuildRosters(ws, undefined, 0, undefined, [], opt);
    expect([...ids(r0)].filter((id) => id.startsWith('fs-'))).toEqual([]);
    const r3 = rebuildRosters(ws, undefined, 3, undefined, [], opt);
    const ag = find(r3, 'fs-garnacho')!;
    expect(ag.age).toBe(17);
    expect(naturalOvr(ag)).toBeLessThan(65);
    expect(Object.values(r3).find((r) => r.players.some((p) => p.id === 'fs-garnacho'))?.teamId).toBe('mun');
    expect(ids(r3).has('fs-haaland')).toBe(false);
    const r4 = rebuildRosters(ws, undefined, 4, undefined, [], opt);
    expect(Object.values(r4).find((r) => r.players.some((p) => p.id === 'fs-haaland'))?.teamId).toBe('mci');
    expect(find(r4, 'fs-haaland')!.age).toBe(22);
    expect(find(r4, 'fs-mainoo')!.age).toBe(17);
    expect(ids(r4).has('fs-yamal')).toBe(false);
    expect(naturalOvr(find(r4, 'fs-garnacho')!)).toBeGreaterThan(naturalOvr(ag));
    for (const r of Object.values(r4)) expect(withinRules(r.players), r.teamId).toBe(true);
    // 레전드 팩만 켜면 미래 스타 없음, 1판(옛 세이브)엔 도르트문트도 없음
    const lg = rebuildRosters(ws, undefined, 4, undefined, [], { on: true, pack: 2 });
    expect([...ids(lg)].filter((id) => id.startsWith('fs-'))).toEqual([]);
    const old = rebuildRosters('c75x-old', undefined, 2, undefined, [], { on: true });
    expect([...ids(old)].filter((id) => BVB_LEGENDS.some((l) => l.id === id))).toEqual([]);
    expect(legendSpawns('c75x-old', 2018, TEAMS, undefined, 1).length).toBe(117);
  });
});

describe('새 게임·플레이·세이브 (C.75x·C.75y)', () => {
  it('끄면 세계 그대로, 레전드 팩 = 2판(도르트문트), 미래 스타 팩은 따로 저장, 세이브 왕복 같은 로스터', () => {
    const off = newGame({ mode: 'prospect', position: 'ST', seed: 'c75x-ng', difficulty: 'normal' });
    expect(JSON.stringify(off.rosters)).toBe(JSON.stringify(rebuildRosters('c75x-ng', undefined, 0)));
    expect(off.legendPack).toBeUndefined();
    expect(off.futureStars).toBeUndefined();
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75x-ng', difficulty: 'normal', legends: true, futureStars: true });
    expect(g.legendPack).toBe(LEGEND_PACK); // C.75w: 3판
    expect(g.futureStars).toBe(true);
    expect(g.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(ids(g.rosters).has('lg-hummels')).toBe(true);
    expect(worldVM(g).upcoming.map((u) => u.name)).toContain('알레한드로 가르나초');
    expect(worldVM(g).waiting).toBe(9);
    finishSeason(g);
    autoMarket(g, 'stay');
    startNextSeason(g);
    const back = deserialize(serialize(g));
    expect(back.futureStars).toBe(true);
    expect(JSON.stringify(back.rosters)).toBe(JSON.stringify(g.rosters));
    // 미래 스타만 켜도 된다 (레전드 팩과 독립)
    const fo = newGame({ mode: 'prospect', position: 'ST', seed: 'c75x-ng', difficulty: 'normal', futureStars: true });
    expect(fo.legends).toBeUndefined();
    expect(fo.futureStars).toBe(true);
    // 선수 화면 "이전 경력": 홀란 = 맨시티 등장 전 6줄 (브뤼네 → 도르트문트)
    fo.rosters = rebuildRosters('c75x-ng', undefined, 4, undefined, [], { on: false, future: true });
    const hd = personDetailVM(fo, 'fs-haaland')!;
    expect(hd.priorCareer.map((c) => c.team)).toEqual(['브뤼네 2', '브뤼네', '몰데 2', '몰데', '레드불 잘츠부르크', '도르트문트']);
    expect(hd.priorCareer.at(-1)).toMatchObject({ years: '2020–2022', apps: 67, goals: 62 });
  }, 60_000);

  it('옛 세이브: 43(판 없음) = 1판, 44(C.75x 2판) = 도르트문트 그대로·미래 스타 끔', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75x-mig', difficulty: 'normal', legends: true });
    const raw = JSON.parse(serialize(g));
    delete raw.legendPack;
    raw.saveFormat = 43;
    const back = deserialize(JSON.stringify(raw));
    expect(back.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(back.legendPack).toBeUndefined();
    expect(ids(back.rosters).has('lg-hummels')).toBe(false);
    expect(ids(back.rosters).has('lg-zidane')).toBe(true);
    const raw44 = JSON.parse(serialize(g));
    raw44.saveFormat = 44;
    raw44.legendPack = 2; // C.75x 세이브는 2판
    const b44 = deserialize(JSON.stringify(raw44));
    expect(b44.legendPack).toBe(2);
    expect(b44.futureStars).toBeUndefined();
    expect(ids(b44.rosters).has('lg-hummels')).toBe(true);
  });

  it('새 게임 화면: 레전드 탭(도르트문트 포함)과 미래 스타 탭(등장 4 + 리그 추가 후 9)', () => {
    const base = { mode: 'real' as const, name: '', position: 'ST', seed: 'c75x-vm', difficulty: 'normal', realId: '', roll: 'c75x-vm', others: false };
    const lg = newGameVM({ ...base, legends: 'on' });
    expect(lg.futureList).toEqual([]);
    expect(lg.legendList.some((l) => l.id === 'lg-rosicky' && l.bvb)).toBe(true);
    const vm = newGameVM({ ...base, futureStars: 'on' });
    expect(vm.futureList.length).toBe(13);
    expect(vm.futureList.filter((f) => !f.waiting).map((f) => f.id)).toEqual(['fs-garnacho', 'fs-haaland', 'fs-mainoo', 'fs-wirtz']);
    expect(vm.futureList[0]).toMatchObject({ debut: '2021-22', age: 17, club: '맨체스터 유나이티드' });
    const yamal = vm.futureList.find((f) => f.id === 'fs-yamal')!;
    expect(yamal).toMatchObject({ waiting: true, realClub: '2022-23 바르셀로나', peak: 94 });
  });
});
