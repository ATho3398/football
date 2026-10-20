// 대표팀 화면 (C.76d): 국가·소집 확률·통산 기록, 대표팀 일정·결과(컵 표와 같은 줄), 지난 대회 조 순위·대진
import { BALANCE } from '../config/balance';
import { CONFED_KO, nationOf } from '../../data/nations';
import { calendarOf, type GameState } from '../game';
import { dateLabel, daysBetween } from '../calendar';
import { reputationTier, playerOvr, TIER_NAMES_KO } from '../growth';
import { callChance, ensureNational, myTournament, NAT_COMP_KO, natId, natLabel, natWindows, nextWorldCupYear, type NatMatch, type TournamentRec } from '../national';

export interface NatFixtureVM {
  date: string;
  label: string;
  opp: string;
  oppId: string;
  venue: string;
  score: string | null;
  outcome: 'win' | 'draw' | 'loss' | null;
  /** "선발 90분 · 1골 1도움 · 7.4" / "결장(부상)" */
  line: string;
}

export interface NatTableVM { name: string; mine: boolean; rows: { team: string; teamId: string; p: number; w: number; d: number; l: number; gd: string; pts: number; me: boolean; through: boolean }[] }
export interface NatTieVM { a: string; aId: string; b: string; bId: string; score: string; w: string; me: boolean }
export interface NatTournamentVM { id: string; title: string; reach: string; champion: string; called: boolean; groups: NatTableVM[]; ko: { name: string; ties: NatTieVM[] }[]; note: string }

export interface NationalVM {
  nation: string;
  nationId: string;
  confed: string;
  rating: number;
  ovr: number;
  tier: string;
  callPct: number;
  /** 소집 상태 한 줄 */
  status: string;
  career: { apps: number; starts: number; goals: number; assists: number; avg: string; moms: number };
  upcoming: NatFixtureVM[];
  results: NatFixtureVM[];
  /** 다가오는 대회 한 줄 */
  next: string;
  honors: { year: number; label: string; reach: string; xp: number }[];
  tournaments: { id: string; label: string }[];
  tournament: NatTournamentVM | null;
}

function fixtureVM(g: GameState, m: NatMatch): NatFixtureVM {
  const played = m.gf !== undefined;
  const opp = nationOf(m.opp);
  const pens = m.pens ? ` (승부차기 ${m.pens[0]}-${m.pens[1]})` : '';
  const outcome = !played ? null : m.gf! > m.ga! || (m.pens && m.pens[0] > m.pens[1]) ? 'win' : m.gf! < m.ga! || m.pens ? 'loss' : 'draw';
  const line = !played ? '' : (m.min ?? 0) > 0
    ? [`${m.started ? '선발' : '교체'} ${m.min}분`, [m.g ? `${m.g}골` : '', m.a ? `${m.a}도움` : ''].filter(Boolean).join(' '), m.r != null ? `평점 ${m.r.toFixed(1)}` : ''].filter(Boolean).join(' · ')
    : m.absent === 'injured' ? '결장 (부상)' : '벤치';
  void g;
  return {
    date: dateLabel(m.date), label: natLabel(m), opp: opp.nameKo, oppId: natId(m.opp),
    venue: m.comp === 'friendly' ? (m.home ? '홈' : '원정') : '중립', score: played ? `${m.gf}-${m.ga}${pens}` : null, outcome, line,
  };
}

function tournamentVM(t: TournamentRec, me: string): NatTournamentVM {
  const ko = t.ko.slice().reverse().map((r) => ({
    name: r.name,
    ties: r.ties.map((x) => ({
      a: nationOf(x.a).nameKo, aId: natId(x.a), b: nationOf(x.b).nameKo, bId: natId(x.b),
      score: `${x.ga}-${x.gb}${x.pens ? ` (PK ${x.pens[0]}-${x.pens[1]})` : ''}`, w: nationOf(x.winner).nameKo, me: x.a === me || x.b === me,
    })),
  }));
  const koTeams = new Set(t.ko[0]?.ties.flatMap((x) => [x.a, x.b]) ?? []);
  const groups = t.groups.map((gr) => ({
    name: gr.name, mine: gr.table.some((r) => r.team === me),
    rows: gr.table.map((r) => ({
      team: nationOf(r.team).nameKo, teamId: natId(r.team), p: r.p, w: r.w, d: r.d, l: r.l, gd: `${r.gf - r.ga >= 0 ? '+' : ''}${r.gf - r.ga}`, pts: r.pts,
      me: r.team === me, through: koTeams.has(r.team),
    })),
  }));
  groups.sort((a, b) => Number(b.mine) - Number(a.mine));
  const T = BALANCE.national.tournaments[t.comp];
  return {
    id: t.id, title: `${t.year} ${NAT_COMP_KO[t.comp]}`, reach: t.qualified ? t.reach : '본선 진출 실패', champion: nationOf(t.champion).nameKo, called: t.called, groups, ko,
    note: `${T.teams}팀 · ${T.groups}개 조 1회전 → ${T.ko}강 녹아웃 (조 1·2위${T.ko > T.groups * 2 ? ' + 성적 좋은 3위' : ''}) · 녹아웃 무승부는 승부차기 · 내 경기가 아닌 경기는 전력으로 간이 계산`,
  };
}

export function nationalVM(g: GameState, pick: string | null): NationalVM {
  const nat = ensureNational(g);
  const n = nationOf(nat.nation);
  const p = g.player;
  const c = nat.career;
  const season = g.league.season;
  // 다음 A매치 주간 (시즌 중) · 소집 상태
  let status = '';
  if (g.phase === 'season') {
    const wins = natWindows(g, calendarOf(g).breaks);
    const upcoming = nat.fixtures.find((m) => m.season === season && m.gf === undefined);
    const nextW = wins.find((w) => nat.calls[w.key] === undefined && daysBetween(g.calendar.date, w.dates[0]!) > 0);
    if (upcoming) status = `소집됨 · ${dateLabel(upcoming.date)} ${nationOf(upcoming.opp).nameKo}전`;
    else if (nextW) status = `다음 A매치 주간 ${dateLabel(nextW.sat)} 무렵 · ${BALANCE.national.window.announce}일 전 명단 발표`;
    else status = '이번 시즌 A매치 주간이 끝났어요 · 시즌 뒤 여름에 대회 또는 평가전';
  } else status = '비시즌 · 다음 시즌 A매치 주간에 다시 소집 판정';
  // 비시즌이면 이번 여름 대회는 이미 치렀다 → 다음 시즌 끝 여름
  const year = season + 1 + (g.phase === 'season' ? 0 : 1);
  const comp = myTournament(n, year);
  const wc = nextWorldCupYear(year);
  const next = [comp ? `${g.phase === 'season' ? '이번' : '다음'} 여름 ${year} ${NAT_COMP_KO[comp]}` : `${g.phase === 'season' ? '이번' : '다음'} 여름 6월 평가전`, comp === 'wc' ? '' : `다음 월드컵 ${wc}`].filter(Boolean).join(' · ');
  const fixtures = nat.fixtures.filter((m) => m.season >= season - 1);
  const ts = nat.tournaments.slice().reverse();
  const t = ts.find((x) => x.id === pick) ?? ts[0] ?? null;
  return {
    nation: n.nameKo, nationId: natId(n.name), confed: CONFED_KO[n.confed], rating: n.rating, ovr: playerOvr(p),
    tier: TIER_NAMES_KO[reputationTier(p.reputation, p.honors)], callPct: Math.round(callChance(g) * 100), status,
    career: { apps: c.apps, starts: c.starts, goals: c.goals, assists: c.assists, avg: c.apps ? (c.ratingSum / c.apps).toFixed(2) : '-', moms: c.moms },
    upcoming: fixtures.filter((m) => m.gf === undefined).map((m) => fixtureVM(g, m)),
    results: fixtures.filter((m) => m.gf !== undefined).slice(-12).reverse().map((m) => fixtureVM(g, m)),
    next,
    honors: nat.honors.slice().reverse().map((h) => ({ year: h.year, label: NAT_COMP_KO[h.comp], reach: h.reach, xp: h.xp })),
    tournaments: ts.map((x) => ({ id: x.id, label: `${x.year} ${NAT_COMP_KO[x.comp]}` })),
    tournament: t ? tournamentVM(t, nat.nation) : null,
  };
}
