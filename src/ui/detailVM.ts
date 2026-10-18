// 다른 팀·다른 선수 상세 (C.53, pending 82 4번) — 6차 디자인 157 팀 상세 · 158 선수 상세(다른 선수).
// 읽기 전용: 지금 세이브에 있는 값(리그 표·로스터·이적 기록·선수 기록 합계·지난 시즌 보관)을 모아 보여 주기만 한다.
// 없는 데이터(다른 선수 레벨 등)는 만들지 않는다. 감독·홈구장은 C.62 data/managers.ts (2018-19 개막 기준)

import { MANAGER_STYLE_KO } from '../../data/managers';
import { coachOf } from '../club';
import { GK_ATTRIBUTES, type GkAttribute } from '../attributes';
import { FOOT_KO } from '../body';
import { OUTSIDE_CLUBS } from '../../data/outsideClubs';
import { derbyOf } from '../derby';
import { DETAILS, LEVEL_NAMES_KO, tendencyLevels, TENDENCY_NAMES_KO, type Detail } from '../engine/tactics';
import { TEAM_TACTICS } from '../engine/teamData';
import { financeTier, npcAnnualWage, npcReputation, npcValue, remainingBudget, TIER_KO, valueLabel, wageBill, type FinanceTier } from '../finance';
import { FORMATION_SLOTS } from '../formations';
import type { GameState } from '../game';
import { playerOvr, reputationTier, TIER_NAMES_KO } from '../growth';
import { leaguePosition, teamById } from '../league';
import { npcCareerTag, npcYouth } from '../npcTags';
import { allPositionOvrs, POSITION_NAMES_KO, profileOf, type FieldPosition } from '../positions';
import { findRosterPlayer, naturalOvr, pickLineup, type RosterPlayer } from '../roster';
import type { AttrGroupVM } from './views/attrGrid';
import type { DesignTier, FormationSlotProps } from './components';
import { NATIONALITY_KO } from './customVM';
import type { FaceRef } from './faces';
import { teamForm, type FormMark } from './prepVM';
import { attrGroupsVM, designTier, myFace, seasonLabel, tacticStyle, type TacticVM } from './viewModels';

export type TeamTab = 'overview' | 'squad' | 'tactics' | 'matches';
export type PersonTab = 'attrs' | 'body' | 'pos' | 'record' | 'contract';

/** 스쿼드 줄: 선수 상세로 간다 (내 선수면 선수 화면) */
export interface SquadRowVM { id: string; name: string; pos: string; age: number; ovr: number; face: FaceRef; me: boolean; legend: boolean; shirt?: number }
export interface SquadGroupVM { name: string; rows: SquadRowVM[] }
export interface TeamMatchVM { round: number; opp: string; oppId: string; home: boolean; score: string | null; mark: FormMark | null }

export interface TeamDetailVM {
  id: string; name: string; mine: boolean;
  round: number; rounds: number;
  rank: number; teams: number; rating: number; ratingRank: number;
  tier: FinanceTier; tierKo: string;
  record: { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number };
  avgAge: number | null;
  form: FormMark[];
  tactic: TacticVM | null; tendencyKo: string; tacticLine: string;
  /** 베스트 11 (로스터 자동 선발과 같은 규칙) */
  slots: FormationSlotProps[];
  squad: SquadGroupVM[]; squadSize: number;
  /** 주요 선수: OVR 상위 3 + 팀 득점 1위 */
  key: (SquadRowVM & { note: string })[];
  matches: TeamMatchVM[];
  finance: { budget: string; wages: string };
  derby: string | null;
  /** 우리 팀과의 이번 시즌 상대 전적 (다른 팀일 때만) */
  vsMe: TeamMatchVM[];
  /** 감독·홈구장 (C.62, 2018-19 개막 기준). 데이터 없는 구단은 null */
  manager: { name: string; style: string; stadium: string } | null;
}

const SHORT_DETAIL: Record<Detail, string> = { lineHeight: '라인', pressing: '압박', style: '빌드업', width: '폭' };
const GROUP_OF = (pos: string): string => (pos === 'GK' ? 'GK' : ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos) ? 'DF' : ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos) ? 'MF' : 'FW');
const GROUPS = ['GK', 'DF', 'MF', 'FW'] as const;

const faceOf = (p: RosterPlayer): FaceRef => ({ id: p.id, age: p.age, appearance: p.appearance });
const rowOf = (p: RosterPlayer): SquadRowVM => ({ id: p.id, name: p.nameKo, pos: p.position, age: p.age, ovr: naturalOvr(p), face: faceOf(p), me: false, legend: !!p.legend, ...(p.shirt ? { shirt: p.shirt } : {}) });

/** 팀 이번 시즌 경기 (치른 것 + 남은 것) */
function teamMatches(g: GameState, teamId: string): TeamMatchVM[] {
  const L = g.league;
  const out: TeamMatchVM[] = [];
  L.schedule.forEach((fs, r) => {
    const f = fs.find((x) => x.home === teamId || x.away === teamId);
    if (!f) return;
    const home = f.home === teamId;
    const oppId = home ? f.away : f.home;
    const played = f.homeGoals !== undefined && f.awayGoals !== undefined;
    const [a, b] = played ? (home ? [f.homeGoals!, f.awayGoals!] : [f.awayGoals!, f.homeGoals!]) : [0, 0];
    out.push({ round: r + 1, opp: teamById(L, oppId).nameKo, oppId, home, score: played ? `${a}-${b}` : null, mark: played ? (a > b ? 'W' : a < b ? 'L' : 'D') : null });
  });
  return out;
}

export function teamDetailVM(g: GameState, teamId: string): TeamDetailVM | null {
  const L = g.league;
  const team = L.teams.find((t) => t.id === teamId);
  if (!team) return null;
  const mine = teamId === g.player.teamId;
  const md = coachOf(g, teamId);
  const row = L.table.find((r) => r.teamId === teamId);
  const roster = g.rosters[teamId];
  const players = roster?.players ?? [];
  const rows = players.map(rowOf);
  if (mine) {
    const p = g.player;
    rows.push({ id: 'me', name: p.name, pos: p.position, age: p.age, ovr: playerOvr(p), face: myFace(g), me: true, legend: false });
  }
  rows.sort((a, b) => b.ovr - a.ovr || a.age - b.age);
  const squad = GROUPS.map((name) => ({ name, rows: rows.filter((r) => GROUP_OF(r.pos) === name) })).filter((x) => x.rows.length);
  const tt = TEAM_TACTICS[teamId];
  const lv = tt ? tendencyLevels(tt.tendency) : null;
  let slots: FormationSlotProps[] = [];
  if (roster) {
    const lu = pickLineup(roster);
    const fs = FORMATION_SLOTS[lu.formation];
    slots = lu.slots.map((s) => {
      const at = fs[s.slot]!;
      return { pos: s.pos, x: Math.round(10 + at.y * 80), y: Math.round(8 + at.x * 95), ovr: Math.round(s.ovr), act: 'person-open', data: { v: s.playerId } };
    });
  }
  const scorer = players
    .map((p) => ({ p, goals: g.playerStats?.[p.id]?.[1] ?? 0 }))
    .filter((x) => x.goals > 0).sort((a, b) => b.goals - a.goals)[0];
  const top = rows.filter((r) => !r.me).slice(0, 3).map((r) => ({ ...r, note: `OVR ${r.ovr}` }));
  const key = scorer && !top.some((t) => t.id === scorer.p.id) ? [...top, { ...rowOf(scorer.p), note: `팀 득점 1위 · ${scorer.goals}골` }] : top.map((t) => (scorer && t.id === scorer.p.id ? { ...t, note: `OVR ${t.ovr} · 팀 득점 1위 ${scorer.goals}골` } : t));
  const ratings = [...L.teams].sort((a, b) => b.rating - a.rating);
  const all = teamMatches(g, teamId);
  const d = mine ? null : derbyOf(g.player.teamId, teamId);
  const ages = players.map((p) => p.age);
  return {
    id: teamId, name: team.nameKo, mine,
    round: Math.min(L.round, L.schedule.length), rounds: L.schedule.length,
    rank: leaguePosition(L, teamId), teams: L.teams.length, rating: Math.round(team.rating * 10) / 10,
    ratingRank: ratings.findIndex((t) => t.id === teamId) + 1,
    tier: financeTier(teamId), tierKo: TIER_KO[financeTier(teamId)],
    record: { played: row?.played ?? 0, won: row?.won ?? 0, drawn: row?.drawn ?? 0, lost: row?.lost ?? 0, gf: row?.gf ?? 0, ga: row?.ga ?? 0, points: row?.points ?? 0 },
    avgAge: ages.length ? Math.round((ages.reduce((t, a) => t + a, 0) / ages.length) * 10) / 10 : null,
    form: teamForm(L, teamId),
    tactic: tt ? { tactic: tacticStyle(tt.tendency), formation: tt.formation } : null,
    tendencyKo: tt ? TENDENCY_NAMES_KO[tt.tendency] : '—',
    tacticLine: lv ? DETAILS.map((x) => `${SHORT_DETAIL[x]} ${LEVEL_NAMES_KO[x][lv[x]]}`).join(' · ') : '—',
    slots, squad, squadSize: rows.length, key,
    matches: all,
    finance: { budget: valueLabel(remainingBudget(g, teamId, L.season)), wages: valueLabel(wageBill(g.rosters, teamId, team.rating)) },
    derby: d ? d.name : null,
    vsMe: mine ? [] : all.filter((m) => m.oppId === g.player.teamId),
    manager: md ? { name: md.nameKo, style: MANAGER_STYLE_KO[md.style], stadium: md.stadiumKo } : null,
  };
}

// ── 선수 상세 (158) ──

export interface PersonDetailVM {
  id: string; name: string; face: FaceRef;
  team: string; teamId: string | null;
  pos: string; posKo: string; age: number; ovr: number; shirt: number | null;
  nationality: string;
  tier: DesignTier; tierName: string; repScore: number;
  clubTier: FinanceTier | null; clubTierKo: string;
  legend: boolean; real: boolean;
  value: string; yearsLeft: number; until: string; wage: string;
  season: { apps: number; goals: number; assists: number; avg: string };
  /** 효과 없는 이름표: 레전드·실제 선수·유스 출신·커리어 태그 */
  tags: { label: string; kind: 'legend' | 'career' | 'story' }[];
  attrs: AttrGroupVM[]; keyNote: string;
  body: { height: string; weight: string; foot: string; weakFoot: string };
  youth: string;
  posOvrs: { pos: string; ovr: number; main: boolean }[];
  history: { season: string; apps: number; goals: number; assists: number; avg: string }[];
}

const GK_NAMES_KO: Record<GkAttribute, string> = { shotStopping: '선방', handling: '핸들링', commandOfArea: '공중볼 장악', distribution: '배급' };

export function personDetailVM(g: GameState, id: string): PersonDetailVM | null {
  const hit = findRosterPlayer(g.rosters, id);
  if (!hit) return null;
  const { teamId, player: p } = hit;
  const L = g.league;
  const team = teamById(L, teamId);
  const ovr = naturalOvr(p);
  const rep = Math.round(npcReputation(ovr));
  const tier = reputationTier(rep);
  const yearsLeft = Math.max(0, p.contractEnd - L.season);
  const st = g.playerStats?.[id];
  const tags: PersonDetailVM['tags'] = [];
  if (p.legend) tags.push({ label: '레전드', kind: 'legend' });
  const career = npcCareerTag(g, p, teamId);
  if (career) tags.push({ label: career, kind: 'career' });
  const youthId = npcYouth(g, p);
  const youthName = L.teams.find((t) => t.id === youthId)?.nameKo ?? OUTSIDE_CLUBS.find((c) => c.id === youthId)?.nameKo ?? '—';
  if (youthId === teamId && !career) tags.push({ label: `${team.nameKo} 유스 출신`, kind: 'story' });
  let attrs: AttrGroupVM[];
  let keyNote: string;
  let posOvrs: PersonDetailVM['posOvrs'];
  if (p.gk) {
    const gk = p.gk;
    attrs = [{ name: '골키퍼', cells: GK_ATTRIBUTES.map((a) => ({ attr: a, label: GK_NAMES_KO[a], value: gk.attrs[a], key: a === 'shotStopping' || a === (gk.type === 'sweeper' ? 'distribution' : 'handling') })) }];
    keyNote = `${gk.type === 'sweeper' ? '스위퍼 키퍼' : '클래식 키퍼'} · 테두리 = 핵심`;
    posOvrs = [{ pos: 'GK', ovr, main: true }];
  } else {
    const pos = p.position as FieldPosition;
    const a = p.attributes!;
    attrs = attrGroupsVM(a, profileOf(pos).keys);
    keyNote = `테두리 = ${p.position} 핵심`;
    const all = allPositionOvrs(a);
    posOvrs = Object.entries(all).map(([k, v]) => ({ pos: k, ovr: v, main: k === p.position })).sort((x, y) => Number(y.main) - Number(x.main) || y.ovr - x.ovr);
  }
  const history = (g.archive ?? []).map((s) => ({ s, t: s.players[id] })).filter((x) => x.t && x.t[0] > 0)
    .map(({ s, t }) => ({ season: seasonLabel(s.season), apps: t![0], goals: t![1], assists: t![2], avg: (t![3] / t![0] / 10).toFixed(2) }))
    .reverse();
  const b = p.body;
  const wage = Math.round(npcAnnualWage(p, team.rating));
  return {
    id, name: p.nameKo, face: faceOf(p),
    team: team.nameKo, teamId,
    pos: p.position, posKo: POSITION_NAMES_KO[p.position as FieldPosition] ?? (p.position === 'GK' ? '골키퍼' : p.position),
    age: p.age, ovr, shirt: p.shirt ?? null,
    nationality: p.nationality ? NATIONALITY_KO[p.nationality] ?? p.nationality : '—',
    tier: designTier(tier), tierName: TIER_NAMES_KO[tier], repScore: rep,
    clubTier: financeTier(teamId), clubTierKo: TIER_KO[financeTier(teamId)],
    legend: !!p.legend, real: p.real,
    value: valueLabel(npcValue(p, L.season)), yearsLeft, until: seasonLabel(p.contractEnd), wage: `${valueLabel(Math.round(wage / 52))} / 주`,
    season: st ? { apps: st[0], goals: st[1], assists: st[2], avg: st[0] ? (st[3] / st[0] / 10).toFixed(1) : '-' } : { apps: 0, goals: 0, assists: 0, avg: '-' },
    tags, attrs, keyNote,
    body: b
      ? { height: `${b.height}cm`, weight: `${b.weight}kg`, foot: FOOT_KO[b.foot], weakFoot: `${b.weakFoot}/5` }
      : { height: '—', weight: '—', foot: '—', weakFoot: '—' },
    youth: youthName,
    posOvrs, history,
  };
}

/** 이 팀이 리그 팀인지 (리그 밖 클럽은 상세 없음) */
export const hasTeamDetail = (g: GameState, id: string): boolean => g.league.teams.some((t) => t.id === id);
