import { describe, expect, it } from 'vitest';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch } from '../src/engine/sim';
import { newGame, playRound, startNextSeason } from '../src/game';
import { primaryItems, recordLine } from '../src/matchRecord';
import { createTeamRoster } from '../src/roster';
import { deserialize, serialize } from '../src/save';
import { matchResultVM, seasonMatchesVM } from '../src/ui/viewModels';

describe('경기 기록 확장 (부록 C.30)', () => {
  const results = [0, 1, 2].map((i) => {
    const h = createTeamRoster({ id: `h${i}`, rating: 76 }, `rec-h${i}`, 2018, []);
    const a = createTeamRoster({ id: `a${i}`, rating: 72 }, `rec-a${i}`, 2018, []);
    return createMatch({ home: teamSetupFromRoster(h, 76, 72), away: teamSetupFromRoster(a, 72, 76), mode: 'auto', difficulty: 'normal', seed: 70 + i, bigMatch: false }).runToEnd();
  });

  it('선수 기록이 팀 기록·이벤트와 맞는다', () => {
    let bigs = 0;
    let clears = 0;
    for (const r of results) {
      for (const side of [0, 1] as const) {
        const ps = r.players.filter((p) => p.team === side);
        const t = r.teamStats[side];
        expect(ps.reduce((s, p) => s + p.saves, 0)).toBe(t.saves);
        expect(ps.reduce((s, p) => s + p.throughCompleted, 0)).toBe(t.throughReceived);
        expect(ps.reduce((s, p) => s + p.throughPasses, 0)).toBe(t.throughPasses);
        const blockEvents = r.events.filter((e) => e.type === 'block' && e.team !== side && e.players[1]).length;
        expect(ps.reduce((s, p) => s + p.blocks, 0)).toBe(blockEvents);
      }
      for (const p of r.players) {
        expect(p.bigChances).toBeLessThanOrEqual(p.keyPasses);
        expect(p.dangerClearances).toBeLessThanOrEqual(p.clearances);
        if (p.position !== 'GK') expect(p.saves).toBe(0);
        bigs += p.bigChances;
        clears += p.dangerClearances;
      }
    }
    expect(bigs).toBeGreaterThan(0);
    expect(clears).toBeGreaterThan(0);
  });

  it('포지션별 6개, 한 줄 요약', () => {
    for (const pos of ['ST', 'LW', 'CAM', 'CM', 'CDM', 'LB', 'CB', 'GK'] as const) expect(new Set(primaryItems(pos)).size).toBe(6);
    const g = newGame({ mode: 'prospect', position: 'CB', seed: 'rec-line', difficulty: 'normal' });
    for (let i = 0; i < 2; i++) playRound(g);
    const played = g.matchLog.find((e) => e.rec);
    if (played) expect(recordLine(played.rec!, 'CB')).toMatch(/^걷어내기 \d+ · 인터셉트 \d+ · 태클 \d+$/);
  });

  it('엔진 경기는 경기 목록·시즌 합계·세이브에 남고, 빠른 경기는 기록 없음', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'rec-log', difficulty: 'normal' });
    for (let i = 0; i < 3; i++) playRound(g);
    playRound(g, { engine: 'quick' });
    expect(g.matchLog.length).toBe(4);
    const engineApps = g.matchLog.filter((e) => e.rec).length;
    expect(g.player.season.recApps).toBe(engineApps);
    const shots = g.matchLog.reduce((s, e) => s + (e.rec?.shots ?? 0), 0);
    expect(g.player.season.rec!.shots).toBe(shots);
    const quick = g.matchLog[3]!;
    expect(quick.rec).toBeNull();
    const vm = seasonMatchesVM(g);
    expect(vm.rows[0]!.round).toBe(4);
    if (quick.minutes > 0) expect(vm.rows[0]!.line).toBe('기록 없음');
    const back = deserialize(serialize(g));
    expect(back.matchLog).toEqual(g.matchLog);
    expect(back.player.season.rec).toEqual(g.player.season.rec);
  });

  it('경기 결과 화면: 6개 + 전체 보기', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'rec-vm', difficulty: 'normal' });
    let tries = 0;
    do playRound(g); while (!g.lastMatch?.rec && ++tries < 6);
    const vm = matchResultVM(g, null)!;
    expect(g.lastMatch!.rec).toBeDefined();
    expect(vm.my.slice(0, 6).map((m) => m.label)).toEqual(['슈팅(유효)', '키패스', '결정적 기회 창출', '드리블 돌파', '공중볼 승리', '패스']);
    expect(vm.myMore.length).toBe(8);
  });

  it('옛 세이브(형식 10)는 빈 기록으로 바뀌고, 다음 시즌에는 목록을 비운다', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'rec-mig', difficulty: 'normal' });
    playRound(g, { engine: 'quick' });
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 10;
    delete raw.matchLog;
    delete raw.player.season.rec;
    delete raw.player.season.recApps;
    const m = deserialize(JSON.stringify(raw));
    expect(m.matchLog).toEqual([]);
    expect(m.player.season.recApps).toBe(0);
    expect(seasonMatchesVM(m).total).toBeNull();
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    expect(g.matchLog.length).toBe(g.league.schedule.length);
    startNextSeason(g);
    expect(g.matchLog).toEqual([]);
  });
});
