// C.80a NPC 출장 정지: 내 선수와 같은 징계 규칙(퇴장 1경기, 리그 옐로 5장마다 1경기)을 NPC 에도. 엔진 출력 카드 칸 · 빠른 경기 카드 굴림 ·
// NPC 상태(npcBan) · 정지 선수 선발 제외 · 시즌 초기화
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { summarize } from '../src/engine/npcMatch';
import { npcInjuredOut } from '../src/engine/setup';
import { endSeason, newGame, otherJob, playRound, selectableRealPlayers, SAVE_FORMAT_VERSION, startNextSeason } from '../src/game';
import { engineCards, npcBanAfterMatch, npcBanLeft, quickCards, type NpcBanMap } from '../src/npcBan';
import { npcConditions } from '../src/npcFit';
import { lineupLines } from '../src/npcQuick';
import { createTeamRoster, pickLineup } from '../src/roster';
import { prepVM } from '../src/ui/prepVM';
import { teamDetailVM } from '../src/ui/detailVM';

const roster = (id: string) => createTeamRoster({ id, rating: 80 }, 'c80a', 2018, []);

describe('C.80a NPC 출장 정지', () => {
  it('세이브 형식 59', () => expect(SAVE_FORMAT_VERSION).toBe(59));

  it('엔진 출력: 카드 받은 선수만 옐로·퇴장 칸이 붙는다', () => {
    const base = { goals: 0, assists: 0, rating: 6.5, distance: 9000 };
    const sum = summarize({
      homeGoals: 0, awayGoals: 0, events: [],
      players: [
        { id: 'a', minutes: 90, ...base, yellows: 0, red: false },
        { id: 'b', minutes: 90, ...base, yellows: 1, red: false },
        { id: 'c', minutes: 60, ...base, yellows: 2, red: true },
      ],
    });
    expect(sum.players[0]).toHaveLength(6);
    expect(sum.players[1]!.slice(6)).toEqual([1, 0]);
    expect(engineCards(sum)).toEqual([{ id: 'b', yellows: 1, red: false }, { id: 'c', yellows: 2, red: true }]);
  });

  it('규칙: 퇴장 1경기 · 옐로 5장째 1경기 · 경고 누적 퇴장은 옐로 누적 제외 · 정지는 다음 리그 경기에서 먼저 소화', () => {
    const r = roster('t1');
    const [a, b, c] = r.players.map((p) => p.id);
    const ban: NpcBanMap = {};
    npcBanAfterMatch(ban, [r], [{ id: a!, yellows: 0, red: true }, { id: c!, yellows: 2, red: true }]);
    expect(npcBanLeft(ban, a!)).toBe(1);
    expect(ban[c!]).toEqual([0, 1, 1]);
    for (let k = 0; k < 4; k++) npcBanAfterMatch(ban, [r], [{ id: b!, yellows: 1, red: false }]);
    expect(ban[b!]).toEqual([4, 0]);
    // 다음 경기: a·c 는 정지를 채우고, b 는 5장째 옐로로 정지
    npcBanAfterMatch(ban, [r], [{ id: b!, yellows: 1, red: false }]);
    expect(npcBanLeft(ban, a!)).toBe(0);
    expect(npcBanLeft(ban, c!)).toBe(0);
    expect(ban[b!]).toEqual([5, 1]);
    // 로스터 밖 선수(내 선수 등)는 세지 않는다
    npcBanAfterMatch(ban, [r], [{ id: 'me', yellows: 0, red: true }]);
    expect(ban.me).toBeUndefined();
  });

  it('선발: 정지 선수는 그날 컨디션 결장 칸 1 → 선발에서 빠진다', () => {
    const r = roster('t2');
    const best = pickLineup(r).slots.map((s) => s.playerId).filter((id) => r.players.find((p) => p.id === id)!.position !== 'GK').slice(0, 2);
    const ban: NpcBanMap = Object.fromEntries(best.map((id) => [id, [0, 1]]));
    const cond = npcConditions(undefined, [r], 7000, ban)!;
    expect(best.every((id) => cond[id]![1] === 1)).toBe(true);
    const out = npcInjuredOut(r, cond);
    const lu = pickLineup(r, out).slots.map((s) => s.playerId);
    expect(lu).toHaveLength(11);
    expect(best.some((id) => lu.includes(id))).toBe(false);
    // 빠른 경기 명단도 같은 길
    expect(lineupLines(r, cond).some((l) => best.includes(l.id))).toBe(false);
  });

  it('빠른 경기 카드 굴림: 결정적, GK 는 카드 없음, 평균 카드율이 엔진 근처', () => {
    const r = roster('t3');
    const lines = lineupLines(r, undefined);
    expect(quickCards(r, lines, 'w', 1)).toEqual(quickCards(r, lines, 'w', 1));
    let y = 0;
    let red = 0;
    const gk = new Set(r.players.filter((p) => p.position === 'GK').map((p) => p.id));
    for (let s = 0; s < 2000; s++) {
      for (const c of quickCards(r, lines, 'w', s)) {
        expect(gk.has(c.id)).toBe(false);
        y += c.yellows;
        if (c.red) red++;
      }
    }
    // 엔진 측정: 팀당 경기 옐로 0.93 · 레드 0.041 (성향·포지션 구성에 따라 위아래)
    expect(y / 2000).toBeGreaterThan(0.6);
    expect(y / 2000).toBeLessThan(1.4);
    expect(red / 2000).toBeGreaterThan(0.015);
    expect(red / 2000).toBeLessThan(0.08);
  });

  it('본편 빠른 시즌: 정지가 쌓이고, 정지 선수는 다음 경기 입력에서 결장, 화면에 표시, 새 시즌에 비운다', () => {
    const g = newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed: 'c80a-t', difficulty: 'normal' });
    let seen = false;
    while (g.phase === 'season') {
      playRound(g, { engine: 'quick', others: 'quick', cards: false });
      const banned = Object.entries(g.npcBan ?? {}).filter(([, b]) => b[1] > 0).map(([id]) => id);
      if (!seen && banned.length && g.phase === 'season') {
        // 다음 라운드 다른 경기 입력: 그 팀 정지 선수가 결장 칸 1
        const r = g.league.round;
        const i = g.league.schedule[r]!.findIndex((f) => f.home !== g.player.teamId && f.away !== g.player.teamId && [f.home, f.away].some((t) => g.rosters[t]!.players.some((p) => banned.includes(p.id))));
        if (i >= 0) {
          const job = otherJob(g, r, i).input;
          const ids = [...job.home.players, ...job.away.players].map((p) => p.id).filter((id) => banned.includes(id));
          expect(ids.length).toBeGreaterThan(0);
          for (const id of ids) expect(job.cond?.[id]?.[1]).toBe(1);
          const f = g.league.schedule[r]![i]!;
          const team = g.rosters[f.home]!.players.some((p) => ids.includes(p.id)) ? f.home : f.away;
          expect(teamDetailVM(g, team)!.key.some((k) => ids.includes(k.id) && k.note.includes('출장 정지'))).toBe(true);
          seen = true;
        }
      }
    }
    expect(seen).toBe(true);
    const total = Object.values(g.npcBan!).reduce((t, b) => t + (b[2] ?? 0) + Math.floor(b[0] / BALANCE.discipline.yellowBanEvery), 0);
    expect(total / g.league.teams.length).toBeGreaterThan(1.5);
    expect(total / g.league.teams.length).toBeLessThan(8);
    endSeason(g);
    startNextSeason(g);
    expect(g.npcBan).toBeUndefined();
    expect(prepVM(g)?.oppBans ?? []).toEqual([]);
  }, 60_000);
});
