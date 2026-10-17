// 경기 준비 (C.51, pending 82 3번): 경기 시작 전에 상대·전술·내 자리·덱·상태·플레이 방식을 한 화면에 모은다.
// 화면 값은 모두 지금 저장된 설정을 읽기만 한다. 여기서 바꾸는 것은 기존 저장 값(전술·덱·직접/자동·다른 경기 계산)이라
// 같은 세이브·같은 설정이면 같은 결과다

import { dateLabel } from '../calendar';
import { deckProblems } from '../cardCollection';
import { BALANCE } from '../config/balance';
import { derbyOf } from '../derby';
import { formBonus, formLevel } from '../form';
import { myMatchPosition, nextFixture, type GameState } from '../game';
import { leaguePosition, teamById, type LeagueState } from '../league';
import { startProbability } from '../match';
import { proficientOvr } from '../proficiency';
import { startBonus } from '../tags';
import { isUnlocked } from '../unlocks';
import { POSITION_NAMES_KO } from '../positions';
import { ROLE_NAMES_KO } from '../engine/roles';
import type { MatchControl } from '../game';
import { myTacticVM, teamTactic, type TacticVM } from './viewModels';
import { deckUnusable, myRoleId } from './views/deck';

export type FormMark = 'W' | 'D' | 'L';

export interface PrepTeamVM {
  name: string; rank: number; rating: number;
  /** 최근 5경기 (오래된 것 → 최근) */
  form: FormMark[];
  tactic?: TacticVM;
}

export interface PrepVM {
  date: string;
  comp: string;
  home: boolean;
  derby: { name: string; big: boolean } | null;
  my: PrepTeamVM;
  opp: PrepTeamVM;
  teams: number;
  tacticsOpen: boolean;
  me: { pos: string; posKo: string; role: string; ovr: number; mainPos: string; off: boolean };
  /** 출전: 결장 사유가 있으면 out, 1군 테스트면 보장, 아니면 선발 가능성(%) */
  start: { out: string | null; trial: boolean; chance: number };
  condition: { fatigue: number; form: 1 | 2 | 3 | 4 | 5; formLabel: string; yellows: number; yellowEvery: number; injury: string | null; suspended: number };
  deck: { active: number; sets: { idx: number; count: number; ok: boolean; unusable: number }[]; picks: number };
  control: MatchControl;
  quick: boolean;
}

const FORM_STEP = { veryBad: 1, bad: 2, normal: 3, good: 4, veryGood: 5 } as const;

/** 팀 최근 n경기 결과 (지난 라운드에서) */
export function teamForm(league: LeagueState, teamId: string, n = 5): FormMark[] {
  const out: FormMark[] = [];
  for (let r = league.round - 1; r >= 0 && out.length < n; r--) {
    const f = league.schedule[r]?.find((x) => x.home === teamId || x.away === teamId);
    if (!f || f.homeGoals === undefined || f.awayGoals === undefined) continue;
    const [mine, theirs] = f.home === teamId ? [f.homeGoals, f.awayGoals] : [f.awayGoals, f.homeGoals];
    out.push(mine > theirs ? 'W' : mine < theirs ? 'L' : 'D');
  }
  return out.reverse();
}

export function prepVM(g: GameState): PrepVM | null {
  if (g.phase !== 'season') return null;
  const fx = nextFixture(g);
  if (!fx) return null;
  const p = g.player;
  const L = g.league;
  const my = teamById(L, p.teamId);
  const opp = teamById(L, fx.opponentId);
  const pos = myMatchPosition(g);
  const ovr = proficientOvr(p, pos);
  const role = myRoleId(g);
  const d = derbyOf(p.teamId, opp.id);
  const out = p.injury ? '부상' : p.suspended > 0 ? '출장 정지' : null;
  const team = (id: string, rating: number, name: string, tactic?: TacticVM): PrepTeamVM => ({ name, rank: leaguePosition(L, id), rating: Math.round(rating), form: teamForm(L, id), ...(tactic ? { tactic } : {}) });
  const enough = p.recentRatings.length >= BALANCE.form.games;
  const b = formBonus(p.recentRatings);
  return {
    date: dateLabel(g.calendar.date),
    comp: `리그 ${Math.min(L.round + 1, L.schedule.length)}R`,
    home: fx.home,
    derby: d ? { name: d.name, big: d.big } : null,
    my: team(my.id, my.rating, my.nameKo, myTacticVM(g)),
    opp: team(opp.id, opp.rating, opp.nameKo, teamTactic(opp.id)),
    teams: L.teams.length,
    tacticsOpen: isUnlocked(g.guide, 'tactics'),
    me: { pos, posKo: POSITION_NAMES_KO[pos], role: role ? ROLE_NAMES_KO[role] ?? role : '', ovr, mainPos: p.position, off: pos !== p.position },
    start: { out, trial: !!g.trial, chance: out ? 0 : Math.round(startProbability(ovr + startBonus(p, p.teamId), my.rating, p.fatigue) * 100) },
    condition: {
      fatigue: Math.round(p.fatigue), form: FORM_STEP[formLevel(p.recentRatings)],
      formLabel: enough ? `평점 보정 ${b >= 0 ? '+' : '−'}${Math.abs(b).toFixed(2)}` : `${p.recentRatings.length}/${BALANCE.form.games}경기`,
      yellows: p.season.yellows % BALANCE.discipline.yellowBanEvery, yellowEvery: BALANCE.discipline.yellowBanEvery,
      injury: p.injury ? `${p.injury.daysLeft}일 남음` : null, suspended: p.suspended,
    },
    deck: {
      active: g.cards.active,
      sets: g.cards.decks.map((deck, idx) => ({ idx, count: deck.length, ok: deckProblems(deck).length === 0, unusable: deckUnusable(g, role, idx) })),
      picks: g.cards.picks.length,
    },
    control: g.control,
    quick: !!g.options.quickOthers,
  };
}
