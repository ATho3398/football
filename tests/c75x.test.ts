// C.75x (pending 131): 레전드 팩에 도르트문트 레전드 + 미래 스타 (데뷔 시즌에 등장)
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { autoMarket, newGame, playRound, rebuildRosters, SAVE_FORMAT_VERSION, startNextSeason, type GameState } from '../src/game';
import { deserialize, serialize } from '../src/save';
import { BVB_LEGENDS, FUTURE_STARS, LEGEND_RETIRED_BY } from '../data/players/legends';
import { A_GRADE_PLAYERS } from '../data/players';
import { futureAge, futureDebut, LEGEND_PACK, LEGENDS, legendPeak, legendSpawns, packRealExcludes, selectableLegends, upcomingFutureStars } from '../src/legends';
import { initialTeams } from '../src/league';
import { naturalOvr, type Rosters } from '../src/roster';
import { withinRules } from '../src/squad';
import { newGameVM, worldVM } from '../src/ui/viewModels';

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
    expect(LEGENDS.filter((l) => l.retired > LEGEND_RETIRED_BY).every((l) => l.group === 'bvb' && l.lateRetired)).toBe(true);
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
    expect(packRealExcludes(LEGEND_PACK).size).toBe(0);
    for (const l of all) expect(legendPeak(l).ovr).toBeGreaterThanOrEqual(BALANCE.legends.groupMinPeak);
  });
});

describe('미래 스타 (C.75x)', () => {
  it('13명, 2018-19 세계(실제 선수)에 없음, 데뷔 시즌 실제 나이', () => {
    expect(FUTURE_STARS.length).toBe(13);
    const age = (id: string) => { const l = FUTURE_STARS.find((x) => x.id === id)!; return [futureDebut(l), futureAge(l, futureDebut(l))]; };
    expect(age('fs-yamal')).toEqual([2022, 15]);
    expect(age('fs-bellingham')).toEqual([2019, 16]);
    expect(age('fs-cubarsi')).toEqual([2023, 16]);
    expect(age('fs-garnacho')).toEqual([2021, 17]);
    expect(age('fs-haaland')).toEqual([2018, 18]); // 데뷔 2016 → 게임 시작에 그때 나이로
    expect(upcomingFutureStars(2018).length).toBe(11);
  });

  it('데뷔 전에는 없고 데뷔 시즌 시작에 들어온다 (rebuild 와 같음), 시작은 낮고 성장한다', () => {
    const ws = 'c75x-fs';
    const r0 = rebuildRosters(ws, undefined, 0, undefined, [], { on: true, pack: 2 });
    expect(ids(r0).has('fs-haaland')).toBe(true);
    expect(ids(r0).has('fs-camavinga')).toBe(true);
    expect(ids(r0).has('fs-bellingham')).toBe(false);
    expect(ids(r0).has('fs-yamal')).toBe(false);
    const r1 = rebuildRosters(ws, undefined, 1, undefined, [], { on: true, pack: 2 });
    const jb = find(r1, 'fs-bellingham')!;
    expect(jb.age).toBe(16);
    expect(naturalOvr(jb)).toBeLessThan(70);
    expect(ids(r1).has('fs-yamal')).toBe(false);
    const r4 = rebuildRosters(ws, undefined, 4, undefined, [], { on: true, pack: 2 });
    expect(find(r4, 'fs-yamal')?.age).toBe(15);
    expect(ids(r4).has('fs-cubarsi')).toBe(false);
    expect(naturalOvr(find(r4, 'fs-bellingham')!)).toBeGreaterThan(naturalOvr(jb));
    for (const r of Object.values(r4)) expect(withinRules(r.players), r.teamId).toBe(true);
    // 맨유 데뷔 = 맨유
    expect(Object.values(r4).find((r) => r.players.some((p) => p.id === 'fs-garnacho'))?.teamId).toBe('mun');
  });

  it('1판(옛 세이브 = C.47 117명)에는 도르트문트·미래 스타가 없다', () => {
    const r = rebuildRosters('c75x-old', undefined, 2, undefined, [], { on: true });
    expect([...ids(r)].filter((id) => id.startsWith('fs-') || BVB_LEGENDS.some((l) => l.id === id))).toEqual([]);
    expect(legendSpawns('c75x-old', 2018, TEAMS, undefined, 1).length).toBe(117);
  });
});

describe('새 게임·플레이·세이브 (C.75x)', () => {
  it('끄면 세계 그대로, 켜면 2판 저장 → 시즌 끝에 데뷔 선수 등장, 세이브 왕복 같은 로스터', () => {
    const off = newGame({ mode: 'prospect', position: 'ST', seed: 'c75x-ng', difficulty: 'normal' });
    expect(JSON.stringify(off.rosters)).toBe(JSON.stringify(rebuildRosters('c75x-ng', undefined, 0)));
    expect(off.legendPack).toBeUndefined();
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75x-ng', difficulty: 'normal', legends: true });
    expect(g.legendPack).toBe(2);
    expect(g.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(ids(g.rosters).has('lg-hummels')).toBe(true);
    expect(ids(g.rosters).has('fs-pedri')).toBe(false);
    expect(worldVM(g).upcoming.map((u) => u.name)).toContain('페드리');
    finishSeason(g);
    autoMarket(g, 'stay');
    startNextSeason(g);
    const pedri = find(g.rosters, 'fs-pedri');
    expect(pedri?.age).toBe(16);
    expect(ids(g.rosters).has('fs-yamal')).toBe(false);
    expect(worldVM(g).legends.find((x) => x.id === 'fs-pedri')?.kind).toBe('미래 스타');
    const back = deserialize(serialize(g));
    expect(back.legendPack).toBe(2);
    expect(JSON.stringify(back.rosters)).toBe(JSON.stringify(g.rosters));
  }, 60_000);

  it('옛 세이브(43, 판 없음)는 1판 그대로 불러온다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75x-mig', difficulty: 'normal', legends: true });
    const raw = JSON.parse(serialize(g));
    delete raw.legendPack;
    raw.saveFormat = 43;
    const back = deserialize(JSON.stringify(raw));
    expect(back.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(back.legendPack).toBeUndefined();
    expect(ids(back.rosters).has('lg-hummels')).toBe(false);
    expect(ids(back.rosters).has('lg-zidane')).toBe(true);
  });

  it('새 게임 화면: 실제 선수 탭에 레전드(도르트문트 포함)·미래 스타 묶음', () => {
    const vm = newGameVM({ mode: 'real', name: '', position: 'ST', seed: 'c75x-vm', difficulty: 'normal', realId: '', legends: 'on', roll: 'c75x-vm', others: false });
    expect(vm.futureList.length).toBe(13);
    expect(vm.futureList[0]!.debut).toBe('2018-19');
    expect(vm.legendList.some((l) => l.id === 'lg-rosicky' && l.bvb)).toBe(true);
    const yamal = vm.futureList.find((f) => f.id === 'fs-yamal')!;
    expect(yamal).toMatchObject({ debut: '2022-23', age: 15, realClub: '바르셀로나', peak: 94 });
    expect(yamal.start).toBeLessThan(65);
  });
});
