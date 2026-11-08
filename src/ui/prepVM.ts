// 경기 준비 (C.51, pending 82 3번): 경기 시작 전에 상대·전술·내 자리·덱·상태·플레이 방식을 한 화면에 모은다.
// 화면 값은 모두 지금 저장된 설정을 읽기만 한다. 여기서 바꾸는 것은 기존 저장 값(전술·덱·직접/자동·다른 경기 계산)이라
// 같은 세이브·같은 설정이면 같은 결과다

import { dateLabel } from '../calendar';
import { deckProblems } from '../cardCollection';
import { BALANCE } from '../config/balance';
import { nextYellowBan, seasonFrac } from '../discipline';
import { derbyOf } from '../derby';
import { npcBanLeft } from '../npcBan';
import { formLevel } from '../form';
import { isNeutralMatch, matchCompLabel, myMatchPosition, myStartChance, myScoutReport, natStartChance, nextFixture, type GameState } from '../game';
import { ensureNational, natId, natPreviewLineup } from '../national';
import type { ScoutReport } from '../rapport';
import { leaguePosition, teamById, type LeagueState } from '../league';
import { proficientOvr } from '../proficiency';
import { isUnlocked } from '../unlocks';
import { POSITION_NAMES_KO, type FieldPosition } from '../positions';
import { ROLE_NAMES_KO } from '../engine/roles';
import type { MatchControl } from '../game';
import { previewLineup } from '../myTactics';
import { DETAILS, LEVEL_NAMES_KO, type Detail } from '../engine/tactics';
import { proficiencyOf } from '../proficiency';
import { ROLE_DESC_KO } from '../engine/roles';
import type { FormationSlotProps } from './components';
import { envVM, formLine, injuryRiskOf, myTacticVM, teamTactic, type EnvVM, type TacticVM } from './viewModels';
import { attackOf, fitVM, matchupOf, oppPlanOf, tacticFitPts, type AttackVM, type FitVM, type MatchupVM, type OppPlanVM } from './prepNumbers';
import { ENGINE } from '../engine/config';
import { posGroup } from '../roster';
import { TENDENCY_NAMES_KO } from '../engine/tactics';
import type { Position } from '../types';
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
  /** 대표팀 경기 (C.81v): 클럽 전술을 쓰지 않는다 — 전술 칸은 "대표팀 전술 · 감독 고정" 한 줄, 전술·역할 바꾸기 없음 */
  natFixed: boolean;
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
  /** 상대 출장 정지 선수 (C.80a, 리그 경기만): "이름 (포지션)" */
  oppBans: string[];
  /** 상대 예상 계획 (17차 S08, 엔진 teamPlan → underdogPlan 그대로). 대표팀 경기는 null */
  oppPlan: OppPlanVM | null;
  /** 상성 (ENGINE.matchup): 우리 성향 vs 상대 예상 성향. 대표팀 경기는 null */
  matchup: (MatchupVM & { mineName: string; oppName: string }) | null;
  /** 지금 성향 적합도 (엔진 fitOnly 식). 대표팀 경기는 null */
  fit: FitVM | null;
  /** 공격 인원 (ENGINE.stackCap) */
  attack: AttackVM | null;
  /** 경기 변수 (A5~A9): 날씨 · 심판 · 부상 위험 */
  env: EnvVM;
  injuryRisk: { pct: number; mul: number; why: string } | null;
  /** 정지 빈도 3단계 뜻 (내 포지션군 중요도 기준 × 배수) */
  stops: { id: 'all' | 'important' | 'critical'; label: string; th: number }[];
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
  // C.81v3: 대표팀 경기는 클럽 전술(포메이션·내 슬롯)을 안 쓴다 — 엔진처럼 내 주 포지션 + 대표팀 포메이션
  const natPv = fx.nat ? natPreviewLineup(g, fx.nat.opp) : null;
  const pos = natPv ? (p.position as FieldPosition) : myMatchPosition(g);
  const ovr = proficientOvr(p, pos);
  const role = natPv ? undefined : myRoleId(g);
  const d = derbyOf(p.teamId, opp.id);
  const out = p.injury ? '부상' : p.suspended > 0 && !fx.nat ? '출장 정지' : null;
  const roster = g.rosters[p.teamId];
  const t = g.tactics;
  const lineup = natPv ? natPv.slots : roster ? previewLineup(t, roster, { name: p.name, attrs: p.attributes }) : [];
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
    my: team(my.id, my.rating, my.nameKo, fx.nat ? undefined : myTacticVM(g)),
    opp: team(opp.id, opp.rating, opp.nameKo, teamTactic(opp.id)),
    teams: L.teams.length,
    tacticsOpen: !fx.nat && isUnlocked(g.guide, 'tactics'),
    natFixed: !!fx.nat,
    tacticLine: DETAILS.map((d) => `${SHORT_DETAIL[d]} ${LEVEL_NAMES_KO[d][t.levels[d]]}`).join(' · '),
    hint: g.training.hints[0] ?? null,
    slots, formation: natPv ? natPv.formation : myTacticVM(g).formation ?? '',
    me: { pos, posKo: POSITION_NAMES_KO[pos], role: role ? ROLE_NAMES_KO[role] ?? role : '', roleDesc: role ? ROLE_DESC_KO[role] ?? '' : '', prof: Math.floor(proficiencyOf(p, pos)), ovr, mainPos: p.position, off: pos !== p.position },
    start: { out, trial: tr ? { n: tr.games + 1, of: tr.extended ? BALANCE.startClub.trialMaxGames : BALANCE.startClub.trialGames } : null, chance: out ? 0 : Math.round((fx.nat ? natStartChance(proficientOvr(p, p.position), my.rating) : myStartChance(g, ovr)) * 100) },
    condition: {
      fatigue: Math.round(p.fatigue), form: FORM_STEP[formLevel(p.recentRatings)],
      formLabel: formLine(p),
      yellows: p.season.yellows, yellowEvery: nextYellowBan(p.season.yellows, seasonFrac(g.league.round, g.league.schedule.length)),
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
    quick: g.options.others === 'quick',
    scout: myScoutReport(g),
    ...extras(g, fx.nat ? null : { oppId: opp.id, oppRating: opp.rating, myRating: my.rating }, natPv ? null : (lineup as { pos: string; attrs?: import('../attributes').FieldAttributes }[]).map((x) => ({ pos: x.pos as Position, ...(x.attrs ? { attrs: x.attrs } : {}) })), pos),
    oppBans: fx.cup || fx.nat ? [] : (g.rosters[opp.id]?.players ?? []).filter((x) => npcBanLeft(g.npcBan, x.id) > 0).map((x) => `${x.nameKo} (${x.position})`),
  };
}

const STOP_LABEL = { all: '모든 순간', important: '중요한 순간만', critical: '결정적 순간만' } as const;

/** 17차 S08 추가 칸: 예상 계획 · 상성 · 적합도 · 공격 인원 · 경기 변수 · 정지 빈도 뜻 */
function extras(
  g: GameState, club: { oppId: string; oppRating: number; myRating: number } | null,
  lineup: { pos: Position; attrs?: import('../attributes').FieldAttributes }[] | null, myPos: FieldPosition,
): Pick<PrepVM, 'oppPlan' | 'matchup' | 'fit' | 'attack' | 'env' | 'injuryRisk' | 'stops'> {
  const L = g.league;
  const oppRoster = club ? g.rosters[club.oppId] : undefined;
  const leagueAvg = L.teams.reduce((t, x) => t + x.rating, 0) / L.teams.length;
  const oppPlan = club && oppRoster ? oppPlanOf(club.oppId, club.oppRating, club.myRating, oppRoster.formation, g.worldSeed, leagueAvg) : null;
  const mine = g.tactics.tendency;
  const matchup = oppPlan ? { ...matchupOf(mine, oppPlan.tendency), mineName: TENDENCY_NAMES_KO[mine], oppName: oppPlan.name } : null;
  const th = ENGINE.moments.threshold[posGroup(myPos)] ?? 0.45;
  return {
    oppPlan, matchup,
    fit: club && lineup ? fitVM(tacticFitPts(mine, lineup)) : null,
    attack: lineup ? attackOf(lineup.map((x) => x.pos)) : null,
    env: envVM(g),
    injuryRisk: g.player.injury ? null : injuryRiskOf(g),
    stops: (['all', 'important', 'critical'] as const).map((id) => ({ id, label: STOP_LABEL[id], th: Math.round(th * ENGINE.moments.stopMul[id] * 100) / 100 })),
  };
}
