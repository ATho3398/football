// 경기 준비 (C.51, pending 82 3번): 경기 시작 전에 상대·전술·내 자리·덱·상태·플레이 방식을 한 화면에 모은다.
// 화면 값은 모두 지금 저장된 설정을 읽기만 한다. 여기서 바꾸는 것은 기존 저장 값(전술·덱·직접/자동·다른 경기 계산)이라
// 같은 세이브·같은 설정이면 같은 결과다

import { dateLabel } from '../calendar';
import { deckProblems } from '../cardCollection';
import { BALANCE } from '../config/balance';
import { derbyOf } from '../derby';
import { formLevel } from '../form';
import { isNeutralMatch, matchCompLabel, myMatchPosition, myStartChance, myScoutReport, natStartChance, nextFixture, type GameState } from '../game';
import { ensureNational, natId } from '../national';
import type { ScoutReport } from '../rapport';
import { leaguePosition, teamById, type LeagueState } from '../league';
import { proficientOvr } from '../proficiency';
import { isUnlocked } from '../unlocks';
import { POSITION_NAMES_KO } from '../positions';
import { ROLE_NAMES_KO } from '../engine/roles';
import type { MatchControl } from '../game';
import { previewLineup } from '../myTactics';
import { DETAILS, LEVEL_NAMES_KO, type Detail } from '../engine/tactics';
import { proficiencyOf } from '../proficiency';
import { ROLE_DESC_KO } from '../engine/roles';
import type { FormationSlotProps } from './components';
import { formLine, myTacticVM, teamTactic, type TacticVM } from './viewModels';
import { deckCardsVM, deckUnusable, myRoleId, type DeckCardVM } from './views/deck';

export type FormMark = 'W' | 'D' | 'L';

export interface PrepTeamVM {
  id: string; name: string; rank: number; rating: number;
  /** 최근 5경기 (오래된 것 → 최근) */
  form: FormMark[];
  tactic?: TacticVM;
}

export interface PrepVM {
  date: string;
  comp: string;
  home: boolean;
  /** 중립 경기 (컵·챔스 결승, 대표팀 대회, C.79o) */
  neutral: boolean;
  derby: { name: string; big: boolean } | null;
  my: PrepTeamVM;
  opp: PrepTeamVM;
  teams: number;
  tacticsOpen: boolean;
  /** 우리 전술 세부 한 줄 (라인·압박·빌드업 등) */
  tacticLine: string;
  /** 영상 분석 힌트 (훈련, 있을 때만) */
  hint: string | null;
  /** 내 포지션 미니 피치 */
  slots: FormationSlotProps[];
  formation: string;
  me: { pos: string; posKo: string; role: string; roleDesc: string; prof: number; ovr: number; mainPos: string; off: boolean };
  /** 출전: 결장 사유가 있으면 out, 1군 테스트면 보장, 아니면 선발 가능성(%) */
  start: { out: string | null; trial: { n: number; of: number } | null; chance: number };
  condition: { fatigue: number; form: 1 | 2 | 3 | 4 | 5; formLabel: string; yellows: number; yellowEvery: number; injury: string | null; suspended: number; seasonFatigue?: number };
  deck: { active: number; sets: { idx: number; count: number; ok: boolean; unusable: number }[]; picks: number; /** 지금 고른 덱 세트의 카드 (C.66c) */ cards: DeckCardVM[] };
  control: MatchControl;
  quick: boolean;
  /** 상대 분석 리포트 (C.74c): 나를 맡을 수비수 약점. GK·상대 맞자리 없음이면 null */
  scout: ScoutReport | null;
  /** 대회 배지 (C.76j 디자인 212): 컵·챔스 경기면 "챔피언스리그 · 조별 1차전" */
  cupBadge: string | null;
}

/** 전술 세부 짧은 이름 (디자인 156 "라인 높음 · 압박 높음 · 빌드업 혼합") */
const SHORT_DETAIL: Record<Detail, string> = { lineHeight: '라인', pressing: '압박', style: '빌드업', width: '폭' };

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
  // 대표팀 경기 (C.76d): 내 쪽 = 대표팀, 출장 정지는 리그만
  const my = teamById(L, fx.nat ? natId(ensureNational(g).nation) : p.teamId);
  const opp = teamById(L, fx.opponentId);
  const pos = myMatchPosition(g);
  const ovr = proficientOvr(p, pos);
  const role = myRoleId(g);
  const d = derbyOf(p.teamId, opp.id);
  const out = p.injury ? '부상' : p.suspended > 0 && !fx.nat ? '출장 정지' : null;
  const roster = g.rosters[p.teamId];
  const t = g.tactics;
  const lineup = roster ? previewLineup(t, roster, { name: p.name, attrs: p.attributes }) : [];
  const slots: FormationSlotProps[] = lineup.map((x) => ({ pos: x.pos, x: Math.round(10 + x.y * 80), y: Math.round(8 + x.x * 95), me: x.me, ...(x.me ? { ovr } : {}) }));
  const tr = g.trial;
  const team = (id: string, rating: number, name: string, tactic?: TacticVM): PrepTeamVM => ({ id, name, rank: leaguePosition(L, id), rating: Math.round(rating), form: teamForm(L, id), ...(tactic ? { tactic } : {}) });
  return {
    date: dateLabel(g.calendar.date),
    comp: matchCompLabel(g, fx),
    cupBadge: fx.cup ? fx.cup.label.replace(/^챔스 /, '챔피언스리그 ').replace(' ', ' · ') : null,
    home: fx.home,
    neutral: isNeutralMatch(fx),
    derby: d ? { name: d.name, big: d.big } : null,
    my: team(my.id, my.rating, my.nameKo, myTacticVM(g)),
    opp: team(opp.id, opp.rating, opp.nameKo, teamTactic(opp.id)),
    teams: L.teams.length,
    tacticsOpen: isUnlocked(g.guide, 'tactics'),
    tacticLine: DETAILS.map((d) => `${SHORT_DETAIL[d]} ${LEVEL_NAMES_KO[d][t.levels[d]]}`).join(' · '),
    hint: g.training.hints[0] ?? null,
    slots, formation: myTacticVM(g).formation ?? '',
    me: { pos, posKo: POSITION_NAMES_KO[pos], role: role ? ROLE_NAMES_KO[role] ?? role : '', roleDesc: role ? ROLE_DESC_KO[role] ?? '' : '', prof: Math.floor(proficiencyOf(p, pos)), ovr, mainPos: p.position, off: pos !== p.position },
    start: { out, trial: tr ? { n: tr.games + 1, of: tr.extended ? BALANCE.startClub.trialMaxGames : BALANCE.startClub.trialGames } : null, chance: out ? 0 : Math.round((fx.nat ? natStartChance(proficientOvr(p, p.position), my.rating) : myStartChance(g, ovr)) * 100) },
    condition: {
      fatigue: Math.round(p.fatigue), form: FORM_STEP[formLevel(p.recentRatings)],
      formLabel: formLine(p),
      yellows: p.season.yellows % BALANCE.discipline.yellowBanEvery, yellowEvery: BALANCE.discipline.yellowBanEvery,
      injury: p.injury ? `${p.injury.daysLeft}일 남음` : null, suspended: p.suspended,
      ...((p.seasonFatigue ?? 0) >= 1 ? { seasonFatigue: Math.round(p.seasonFatigue!) } : {}),
    },
    deck: {
      active: g.cards.active,
      sets: g.cards.decks.map((deck, idx) => ({ idx, count: deck.length, ok: deckProblems(deck).length === 0, unusable: deckUnusable(g, role, idx) })),
      picks: g.cards.picks.length,
      cards: deckCardsVM(g, g.cards.active, role),
    },
    control: g.control,
    quick: !!g.options.quickOthers,
    scout: myScoutReport(g),
  };
}
