// C.75w (pending 133): 레전드 팩 3판 = 117 + 도르트문트 21 + 추가 53명. 팀당 상한, 넘치면 리그 밖에서 시작해 이적으로 유입
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { autoMarket, newGame, playRound, rebuildRosters, startNextSeason, type GameState } from '../src/game';
import { deserialize, serialize } from '../src/save';
import { EXT_LEGENDS, FUTURE_STARS, LEGEND_RETIRED_BY } from '../data/players/legends';
import { A_GRADE_PLAYERS } from '../data/players';
import { LEGEND_PACK, LEGENDS, legendPlacement, legendSpawns, packLegends, packRealExcludes } from '../src/legends';
import { initialTeams } from '../src/league';
import { posGroup, type Rosters } from '../src/roster';
import { withinRules } from '../src/squad';
import { newGameVM, worldVM } from '../src/ui/viewModels';

const TEAMS = initialTeams().map((t) => ({ id: t.id, rating: t.baseRating }));
const ids = (r: Rosters) => new Set(Object.values(r).flatMap((x) => x.players.map((p) => p.id)));
const norm = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

const NAMES = [
  '잔루이지 부폰', '빅토르 발데스', '줄리우 세자르', '디다', '호르헤 캄포스', '이운재',
  '제이미 캐러거', '루시우', '헤라르드 피케', '페페', '조르조 키엘리니', '히카르두 카르발류', '솔 캠벨', '레오나르도 보누치', '뱅상 콤파니',
  '파트리스 에브라', '잔루카 잠브로타', '마르셀루',
  '디디에 데샹', '에마뉘엘 프티', '질베르투 실바', '오언 하그리브스', '둥가',
  '안드레스 이니에스타', '클라렌스 세이도르프', '다니엘레 데 로시', '클라우디오 마르키시오', '세스크 파브레가스',
  '다비드 실바', '메수트 외질', '잔프랑코 졸라', '카를로스 발데라마', '나카타 히데토시', '구티', '뤼트 굴리트',
  '프랑크 리베리', '아리언 로번', '개러스 베일',
  '필리포 인자기', '크리스티안 비에리', '에르난 크레스포', '파트리크 클라위버르트', '다보르 슈케르', '이언 러시', '안정환', '웨인 루니',
  '즐라탄 이브라히모비치', '로비 파울러', '앤디 콜', '이언 라이트', '피터 크라우치', '디미타르 베르바토프', '올리버 비어호프',
];

function finishSeason(g: GameState): void {
  while (g.phase === 'season') playRound(g, { engine: 'quick' });
}

describe('추가 53명 명단 (C.75w)', () => {
  it('사용자 확정 53명, 포지션 묶음 수, 1990년 이후 은퇴 확인, 2020 뒤 은퇴는 lateRetired', () => {
    expect(EXT_LEGENDS.length).toBe(53);
    expect(EXT_LEGENDS.map((l) => l.nameKo).sort()).toEqual([...NAMES].sort());
    const g = (gs: string[]) => EXT_LEGENDS.filter((l) => gs.includes(l.position)).length;
    expect([g(['GK']), g(['CB']), g(['LB', 'RB']), g(['CDM']), g(['CM']), g(['CAM']), g(['LW', 'RW']), g(['ST'])]).toEqual([6, 9, 3, 5, 5, 7, 3, 15]);
    for (const l of EXT_LEGENDS) {
      expect(l.group).toBe('ext');
      expect(l.retired).toBeGreaterThanOrEqual(1990);
      expect(l.retired).toBeLessThanOrEqual(2026);
      expect(!!l.lateRetired).toBe(l.retired > LEGEND_RETIRED_BY);
      expect(l.peak).toBeGreaterThanOrEqual(BALANCE.legends.groupMinPeak);
    }
    expect(EXT_LEGENDS.filter((l) => l.lateRetired).length).toBe(15);
  });

  it('id·이름 중복 없음, 2018-19 실제 현역과 겹치지 않음 (겹치면 팩을 켤 때 현역에서 빠진다)', () => {
    const all = [...LEGENDS, ...FUTURE_STARS];
    expect(new Set(all.map((l) => l.id)).size).toBe(all.length);
    expect(new Set(all.map((l) => norm(l.name))).size).toBe(all.length);
    const real = new Set(A_GRADE_PLAYERS.map((p) => norm(p.name)));
    expect(EXT_LEGENDS.filter((l) => real.has(norm(l.name)))).toEqual([]);
    expect(packRealExcludes(3).size).toBe(0);
  });

  it('판: 1 = 117, 2 = 138 (C.75x), 3 = 191 (새 게임)', () => {
    expect(LEGEND_PACK).toBe(3);
    expect([packLegends(1).length, packLegends(2).length, packLegends(3).length]).toEqual([117, 138, 191]);
    // 2판 배치는 예전 그대로 (C.75x 세이브 재생성이 같은 로스터)
    expect(legendSpawns('c75w-p2', 2018, TEAMS, undefined, 2).length).toBe(138);
  });
});

describe('3판 배치 (C.75w)', () => {
  it('팀당 상한 안, 시작 + 리그 밖 = 191, 리그 밖은 다음 시즌부터 시즌마다 arrivalsPerSeason 명', () => {
    const L = BALANCE.legends;
    for (const seed of ['m1', 'm2', 'm3', 'c75w-a']) {
      const pl = legendPlacement(seed, TEAMS);
      expect(pl.spawns.length + pl.abroad.length).toBe(191);
      const per: Record<string, number> = {};
      for (const s of pl.spawns) per[s.teamId] = (per[s.teamId] ?? 0) + 1;
      expect(Math.max(...Object.values(per))).toBeLessThanOrEqual(L.maxPerTeam);
      pl.abroad.forEach((a, i) => {
        expect(a.club.startsWith('x:')).toBe(true);
        expect(a.season).toBe(BALANCE.newGame.startYear + 1 + Math.floor(i / L.arrivalsPerSeason));
      });
    }
    // 내 선수로 고른 레전드는 빠진다
    expect(legendPlacement('m2', TEAMS, 'lg-iniesta').spawns.some((s) => s.legend.id === 'lg-iniesta')).toBe(false);
  });

  it('새 게임: 모든 팀 인원 규칙 안 → 시즌 끝 리그 밖 레전드 이적 유입 → 인원 규칙 안, 세이브 왕복·재생성 같은 로스터', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'm2', difficulty: 'normal', legends: true });
    expect(g.legendPack).toBe(3);
    const abroad = legendPlacement('m2', TEAMS).abroad;
    expect(abroad.length).toBeGreaterThan(0);
    for (const r of Object.values(g.rosters)) expect(withinRules(r.players)).toBe(true);
    const there = ids(g.rosters);
    expect(there.has('lg-iniesta') || abroad.some((a) => a.legend.id === 'lg-iniesta')).toBe(true);
    for (const a of abroad) expect(there.has(a.legend.id)).toBe(false);
    expect(worldVM(g).abroad.map((a) => a.name)).toEqual(abroad.map((a) => a.legend.nameKo));
    finishSeason(g);
    autoMarket(g, 'stay');
    startNextSeason(g);
    const now = ids(g.rosters);
    for (const a of abroad.filter((x) => x.season === g.league.season)) {
      expect(now.has(a.legend.id)).toBe(true);
      const p = Object.values(g.rosters).flatMap((r) => r.players).find((x) => x.id === a.legend.id)!;
      expect(p.legend).toBe(true);
      expect(p.youth).toBe(a.club);
      expect(posGroup(p.position)).toBe(posGroup(a.legend.position));
    }
    for (const r of Object.values(g.rosters)) expect(withinRules(r.players)).toBe(true);
    const back = deserialize(serialize(g));
    expect(JSON.stringify(back.rosters)).toBe(JSON.stringify(g.rosters));
    expect(worldVM(g).abroad.length).toBe(abroad.filter((a) => a.season > g.league.season).length);
  }, 120_000);

  it('재생성 4시즌: 리그 밖 레전드가 모두 들어오고 인원 규칙 안', () => {
    const pl = legendPlacement('c75w-a', TEAMS);
    const r = rebuildRosters('c75w-a', undefined, 4, undefined, [], { on: true, pack: 3 });
    const have = ids(r);
    for (const a of pl.abroad.filter((x) => x.season <= BALANCE.newGame.startYear + 4)) expect(have.has(a.legend.id)).toBe(true);
    for (const t of Object.values(r)) expect(withinRules(t.players)).toBe(true);
  });

  it('옛 세이브 2판(C.75x·C.75y)은 2판 그대로: 추가 53명 없음', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75w-old', difficulty: 'normal', legends: true });
    const raw = JSON.parse(serialize(g));
    raw.legendPack = 2;
    const back = deserialize(JSON.stringify(raw));
    expect(back.legendPack).toBe(2);
    const have = ids(back.rosters);
    expect(EXT_LEGENDS.some((l) => have.has(l.id))).toBe(false);
    expect(have.has('lg-hummels')).toBe(true);
    expect(worldVM(back).abroad).toEqual([]);
  });

  it('새 게임 화면: 레전드 탭에 추가 53명 중 필드 선수 47명, 리그 밖 선수는 "(시즌 이적)" 표시', () => {
    const base = { mode: 'real' as const, name: '', position: 'ST', seed: 'm2', difficulty: 'normal', realId: '', roll: 'm2', others: false };
    const vm = newGameVM({ ...base, legends: 'on' });
    const ext = new Set(EXT_LEGENDS.filter((l) => l.position !== 'GK').map((l) => l.id));
    expect(vm.legendList.filter((l) => ext.has(l.id)).length).toBe(47);
    const away = legendPlacement('m2', TEAMS).abroad.filter((a) => a.legend.position !== 'GK');
    for (const a of away) expect(vm.legendList.find((l) => l.id === a.legend.id)?.club).toMatch(/이적\)$/);
  });
});
