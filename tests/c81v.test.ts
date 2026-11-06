// C.81v (53단계) 대표팀 대회 후속: 내 나라가 떨어진 뒤 남은 경기도 그 날짜에 진행·소식 · 빈 날짜는 휴가 · 기다림이 길면 몰아서(소식은 경기 날짜)
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { addDays, daysBetween } from '../src/calendar';
import { clubSeasonOver, endDay, isMatchDay, isVacationDay, newGame, playOthers, playRound, type GameState } from '../src/game';
import { homeVM } from '../src/ui/viewModels';
import { ensureNational, myNationOut, natTournamentAlive, tournamentEndDate, tournamentState } from '../src/national';

const N = BALANCE.national;
const son = (seed: string) => {
  const g = newGame({ mode: 'real', playerId: 'son', seed, difficulty: 'normal' });
  g.player.reputation = BALANCE.reputation.tierCuts.worldClass + 1;
  return g;
};

/** 내 나라가 대회에서 떨어진 직후까지 (클럽 시즌 → 대회 내 경기). 우승하면 null */
function toElimination(seed: string): GameState | null {
  const g = son(seed);
  while (g.phase === 'season' && !clubSeasonOver(g)) playRound(g, { engine: 'quick' });
  const live = ensureNational(g).live;
  if (!live?.called) return null;
  while (g.phase === 'season' && !myNationOut(g, live)) playRound(g, { engine: 'quick' });
  // 몰아서 치른 경우(시즌이 이미 끝남)는 기록의 성적으로
  if (g.phase !== 'season') return ensureNational(g).tournaments.at(-1)!.reach !== '우승' ? g : null;
  return !tournamentState(g, live).done ? g : null;
}

function findElimination(): GameState {
  for (let k = 0; k < 12; k++) {
    const g = toElimination(`c81v-${k}`);
    if (g) return g;
  }
  throw new Error('탈락 시드 없음');
}

describe('탈락 뒤 남은 대회 경기 (C.81v)', () => {
  it('떨어진 뒤에도 시즌은 결승 날까지: 빈 날짜는 휴가 · 남은 경기는 그 날짜에 하루 끝 계산 · 단계 소식은 그날 인박스', () => {
    const g = findElimination();
    const nat = ensureNational(g);
    const live = nat.live!;
    const end = tournamentEndDate(live);
    const lastMine = nat.fixtures.filter((m) => m.key.startsWith(`t:${live.id}:`)).at(-1)!.date;
    expect(daysBetween(lastMine, end)).toBeLessThanOrEqual(N.waitAfterOut);
    expect(natTournamentAlive(g)).toBe(true);
    // 홈: 다음 경기 없음(오류 없이) · 머리말 칩 "휴가 · 아시안컵 결승 6/26"
    const hv = homeVM(g);
    expect(hv.next).toBeNull();
    expect(hv.summerWait).toMatch(/^휴가 · .+ 결승 \d+\/\d+$/);
    // 내 경기 afterMatch 일 뒤부터 휴가, 더 이상 내 경기 날 없음
    expect(isVacationDay(g, addDays(lastMine, BALANCE.training.vacation.afterMatch))).toBe(true);
    expect(isVacationDay(g, addDays(end, -1))).toBe(true);
    const newsKeys = new Set<string>();
    let days = 0;
    while (g.phase === 'season') {
      expect(isMatchDay(g)).toBe(false);
      const today = g.calendar.date;
      playOthers(g, 'quick');
      endDay(g);
      days++;
      if (nat.live) {
        // 지난 날짜(오늘 포함)의 경기는 모두 결과가 있고, 앞날 경기는 아직 없다
        const v = tournamentState(g, nat.live);
        expect(v.matches.filter((m) => daysBetween(m.date, today) >= 0 && !m.res)).toEqual([]);
        expect(v.matches.filter((m) => daysBetween(today, m.date) > 0 && m.res)).toEqual([]);
      }
      for (const x of g.inbox!.items) {
        if (!x.key?.startsWith(`natnews:${live.id}:`) || newsKeys.has(x.key)) continue;
        newsKeys.add(x.key);
        expect(x.date).toBe(today);
      }
      if (days > 40) throw new Error('대회가 안 끝남');
    }
    expect(g.calendar.date).toBe(addDays(end, 1));
    expect(newsKeys.size).toBeGreaterThan(0);
    const rec = nat.tournaments.at(-1)!;
    expect(rec.id).toBe(live.id);
    expect(rec.champion).not.toBe('');
    expect(g.inbox!.items.find((x) => x.key === `natnews:${live.id}:k${rec.ko.length - 1}`)!.title).toContain(' 우승');
  }, 240_000);

  it('기다림이 waitAfterOut 을 넘으면: 떨어진 날 하루 끝에 남은 경기를 몰아서 치르고 시즌 끝 · 소식 날짜는 경기 날짜', () => {
    const N0 = N.waitAfterOut;
    (N as { waitAfterOut: number }).waitAfterOut = 0;
    try {
      const g = findElimination();
      const nat = ensureNational(g);
      expect(natTournamentAlive(g)).toBe(false);
      // 떨어진 경기 뒤 시즌 끝 처리가 이미 돌았거나 그날 하루 끝에 돈다
      if (g.phase === 'season') { playOthers(g, 'quick'); endDay(g); }
      expect(g.phase).toBe('offseason');
      expect(nat.live).toBeUndefined();
      const rec = nat.tournaments.at(-1)!;
      expect(rec.champion).not.toBe('');
      const live = { id: rec.id, comp: rec.comp, start: nat.fixtures.find((m) => m.key.startsWith(`t:${rec.id}:`))!.date };
      const end = tournamentEndDate(live);
      // 시즌은 내 마지막 대회 경기 날(또는 다음 날 아침) 끝 — 결승 날짜보다 앞
      expect(daysBetween(g.calendar.date, end)).toBeGreaterThan(0);
      const news = g.inbox!.items.filter((x) => x.key?.startsWith(`natnews:${live.id}:`));
      expect(news.length).toBeGreaterThan(0);
      expect(news.at(-1)!.date).toBe(end);
      expect(news.every((x) => daysBetween(g.calendar.date, x.date) >= 0)).toBe(true);
    } finally {
      (N as { waitAfterOut: number }).waitAfterOut = N0;
    }
  }, 240_000);
});

describe('대표팀 경기 준비 전술 칸 · 위험 등급 칩 (C.81v)', () => {
  it('대표팀 경기 준비: 클럽 전술 대신 "대표팀 전술 · 감독 고정" (바꾸기·역할 바꾸기 없음)', async () => {
    const { prepVM } = await import('../src/ui/prepVM');
    const g = son('c81l');
    while (g.phase === 'season' && !clubSeasonOver(g)) playRound(g, { engine: 'quick' });
    while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); }
    const vm = prepVM(g)!;
    expect(vm.natFixed).toBe(true);
    expect(vm.tacticsOpen).toBe(false);
    expect(vm.my.tactic).toBeUndefined();
  }, 120_000);

  it('RiskChip: 결정 순간 칩과 같은 모양 (위험 낮음/보통/높음 + 막대 칸)', async () => {
    const { RiskChip } = await import('../src/ui/components');
    expect(RiskChip('low')).toContain('위험 낮음');
    expect(RiskChip('high')).toContain('po-risk--high');
    expect((RiskChip('mid').match(/class="on"/g) ?? []).length).toBe(2);
  });
});
