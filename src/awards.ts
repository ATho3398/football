// 개인 시상 (C.76n, 47a단계, docs/awards-design.md): 발롱도르 · 더 베스트 · 코파 · 야신 · 골든보이 · 골든부츠 · 게르트 뮐러.
// 시즌 끝(리그·컵·여름 대표팀 대회 뒤)에 선수 시즌 이력서(실적·트로피·대표팀·결정적 순간·서사·인기·재능)를 만들고,
// 상마다 투표단(기자·선수·감독주장·팬, 상 정의 = BALANCE.awards.defs 데이터 표)이 투표해 득표로 정한다. 결과는 그때 정해 두고
// 실제 시점(발롱도르 10월 · 골든보이 11월 · 더 베스트 12월, 골든부츠 시즌 끝)에 하루 끝(awardsDayEnd)에서 발표한다 — 보상도 발표 때.
// 대상 = 고른 리그 선수 + 나. 기록은 엔진 기록(내 리그 state.playerStats · 경기 득점 기록, 다른 리그 OtherLeague.stats),
// 다른 경기를 빠른 진행으로 돌려 엔진 기록이 없으면 OVR·팀 성적으로 추정한다(득점자 추첨이 있는 다른 리그는 골·도움은 그 기록).

import { BALANCE, type AwardDef } from './config/balance';
import { MY_ID } from './engine/adapter';
import { pushInbox } from './inbox';
import { gamesPerTeam, sortedTable, teamById, type Fixture, type LeagueState, type TableRow } from './league';
import { leagueTeamRoster, type OtherLeague } from './otherLeagues';
import { naturalOvr, pickLineup, posGroup, type PosGroup, type TeamRoster } from './roster';
import { createRng, gaussian, hashSeed, type Rng } from './rng';
import { myNationality } from './life';
import { uclReach, type CupTie } from './cups';
import { grantTierPick } from './cardCollection';
import { grantAchievementPick } from './seasonGoals';
import { npcStanding } from './worldStats';
import { derbyOf } from './derby';
import { leagueWeight, matchClutch } from './clutch';
import { playerOvr } from './growth';
import { addXp } from './growth';
import { awardBadges } from './badges';
import { isoDate, daysBetween, type IsoDate } from './calendar';
import type { GameState } from './game';
import type { Position } from './types';
import { natId, natRoster, nationRating, type TournamentRec } from './national';
import { nationOf } from '../data/nations';
import { LEAGUE_CATALOG } from '../data/leagues';
import { NAT_COMP_KO, type TournamentComp } from './national';
import { otherLeagueCalendar } from './otherLeagues';

const A = () => BALANCE.awards;
const R = () => BALANCE.awards.resume;

/** 상 id (BALANCE.awards.defs 키). 47a: 발롱도르 · 더 베스트 · 코파 · 야신 · 골든보이 · 골든부츠 · 게르트 뮐러 */
export type AwardId = string;
export type JuryId = 'journalist' | 'players' | 'coach' | 'fan';
export const JURY_KO: Record<JuryId, string> = { journalist: '기자단', players: '선수단', coach: '감독·주장', fan: '팬' };

export const awardDefs = (): Record<AwardId, AwardDef> => A().defs;
export const awardIds = (): AwardId[] => Object.keys(A().defs);
/** 결과 키 '상@리그' (47b 리그 상) → 상 id · 리그 */
export const awardBase = (key: string): AwardId => key.split('@')[0]!;
export const awardLeague = (key: string): string | null => key.split('@')[1] ?? null;
export const awardDefOf = (key: string): AwardDef | undefined => A().defs[awardBase(key)];
export const leagueKo = (lg: string): string => LEAGUE_CATALOG.find((x) => x.id === lg)?.nameKo ?? lg;

/** 상 이름: 리그 상은 리그 이름을 붙이고(PFA 는 고유 이름), 대륙컵 상은 대회 이름 (cont = 그해 대륙 대회) */
export function awardKo(key: string, cont?: string): string {
  const d = awardDefOf(key);
  if (!d) return key;
  const lg = awardLeague(key);
  if (lg && d.koByLeague?.[lg]) return d.koByLeague[lg]!;
  if (lg && d.koLeague) return `${leagueKo(lg)} ${d.ko}`;
  if (d.cont) return `${cont ? NAT_COMP_KO[cont as TournamentComp] ?? '대륙컵' : '대륙컵'} ${d.ko}`;
  return d.ko;
}

/** 상 설명 (화면) */
export function awardDesc(key: AwardId): string {
  const d = awardDefOf(key);
  if (!d) return '';
  if (d.xi) return `4-3-3 자리(GK 1 · 풀백 2 · 센터백 2 · 미드 3 · 공격 3)마다 ${d.scope === 'league' ? '리그 ' : ''}선수단 ${d.voters}명이 투표. 득표 많은 순으로 선정.`;
  if (d.formula === 'boot') return '유럽 리그 득점 × 리그 계수(5대 리그 2 · 포르투갈 · 네덜란드 1.5 · 그 밖 유럽 1). 아시아 · 남미 · MLS · 사우디 리그는 제외. 투표 없음.';
  if (d.formula === 'goals') return '클럽(리그 · 컵)과 대표팀 공식 경기 최다골. 투표 없음.';
  if (d.formula === 'wcBoot') return '월드컵 최다골 (같으면 도움 · 적은 출전). 투표 없음.';
  const who = Object.entries(d.vote ?? {}).map(([j, x]) => `${JURY_KO[j as JuryId]} ${Math.round((x ?? 0) * 100)}%`).join(' · ');
  const G_KO: Record<string, string> = { GK: '골키퍼', CB: '센터백', FB: '풀백', CDM: '수비형 미드' };
  const elig = [d.wc ? '월드컵 출전 선수' : '', d.cont ? '대륙 대회 출전 선수' : '', d.ucl ? '챔스에 나간 팀 선수' : '', d.scope === 'league' ? (d.monthly ? '리그 선수 · 그달 경기' : '리그 선수') : '', d.maxAge ? `${d.maxAge}세 이하(시즌 시작 나이)` : '', d.europe ? '유럽 리그' : '', d.groups ? d.groups.map((x) => G_KO[x] ?? x).join('·') : ''].filter(Boolean).join(' · ');
  return `${elig ? `${elig} · ` : ''}투표 ${who} — 투표자 ${d.voters}명이 ${(d.points ?? []).join('·')}점씩.`;
}

// ── 이력서 ──

/** 선수 시즌 이력서 (모든 상 공유) */
export interface Resume {
  id: string;
  name: string;
  teamId: string;
  team: string;
  lg: string;
  pos: Position;
  group: PosGroup;
  age: number | null;
  nation: string;
  apps: number;
  /** 시즌 환산 리그 골·도움 */
  goals: number;
  assists: number;
  avg: number;
  share: number;
  /** 공식 경기 골 (리그 환산 + 컵 + 대표팀, NPC 대표팀 골은 기록 없음) */
  allGoals: number;
  me: boolean;
  est: boolean;
  /** 항목 (원점수) */
  out: number; rat: number; def: number; tro: number; nat: number; clu: number; sto: number; fam: number; tal: number;
  /** 챔스 (47b): 단계 점수 × 출전 비중 + 챔스 골 (챔스에 안 나간 팀 0) */
  ucl: number;
  /** 서사 문구 (기사·화면) */
  tags: string[];
}

interface TeamCtx { lg: string; row: TableRow | undefined; pos: number; full: number; avgGf: number; avgGa: number; rating: number; rank: number; name: string; top: boolean }

function leagueCtx(lg: LeagueState): Map<string, TeamCtx> {
  const rows = sortedTable(lg);
  const played = rows.reduce((t, r) => t + r.played, 0);
  const avgGf = played ? rows.reduce((t, r) => t + r.gf, 0) / played : 1.4;
  const avgGa = played ? rows.reduce((t, r) => t + r.ga, 0) / played : 1.4;
  const full = gamesPerTeam(lg);
  const byRating = [...lg.teams].sort((a, b) => b.rating - a.rating || (a.id < b.id ? -1 : 1)).map((t) => t.id);
  return new Map(lg.teams.map((t) => {
    const pos = rows.findIndex((r) => r.teamId === t.id) + 1;
    const rank = byRating.indexOf(t.id) + 1;
    return [t.id, { lg: lg.id, row: rows[pos - 1], pos, full, avgGf, avgGa, rating: t.rating, rank, name: t.nameKo, top: rank <= R().clutch.topRank }];
  }));
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

interface Raw { apps: number; goals: number; assists: number; avg: number; clu: number | null; est: boolean }

/** 추정 기록 (엔진 기록이 없을 때): 선발·벤치·그 밖 출전 비율, 포지션군 경기당 골·도움, 평점 */
function estimate(seed: string, season: number, id: string, position: Position, ovr: number, starter: 0 | 1 | 2, ctx: TeamCtx): Raw {
  const E = BALANCE.awards.estimate;
  const G = BALANCE.goals;
  const rng = createRng(hashSeed(`${seed}:aw-est:${season}:${id}`));
  const played = ctx.row?.played ?? 0;
  const apps = Math.round(played * Math.min(1, E.share[starter]! * (0.88 + rng() * 0.17)));
  const rate = G.rates[posGroup(position)] ?? [0, 0, 0];
  const rel = ovr - ctx.rating;
  const k = clamp(1 + rel * G.ovrK, 0.5, 1.8);
  const fa = ctx.row && ctx.row.played ? clamp(ctx.row.gf / ctx.row.played / ctx.avgGf, 0.5, 1.8) : 1;
  const goals = Math.round(apps * rate[0] * k * fa * (0.7 + rng() * 0.6));
  const assists = Math.round(apps * rate[1] * k * fa * (0.7 + rng() * 0.6));
  const gd = ctx.row && ctx.row.played ? (ctx.row.gf + 0.5) / (ctx.row.ga + 0.5) : 1;
  const avg = clamp(E.ratingBase + rel * E.ratingRel + (ovr - 75) * E.ratingOvr + (clamp(gd, 0.4, 2.5) - 1) * E.ratingTeam + (rng() * 2 - 1) * E.ratingJitter, E.ratingMin, E.ratingMax);
  return { apps, goals, assists, avg, clu: null, est: true };
}

/** 엔진 기록이 충분한가 (출전 수가 있는 선수 기록이 leagueStatsMin 명 이상) */
function hasEngine(stats: Record<string, readonly (number | undefined)[]> | undefined, appsAt: number): boolean {
  let n = 0;
  for (const t of Object.values(stats ?? {})) if ((t[appsAt] ?? 0) > 0 && ++n >= BALANCE.goals.leagueStatsMin) return true;
  return false;
}

/** 내 리그 내 팀 밖 치른 경기 중 득점 기록(엔진 경기)이 있는 비율 (0-0 은 기록이 없어 1보다 조금 작다) */
function otherCoverage(state: GameState): number {
  const me = state.player.teamId;
  let n = 0;
  let g = 0;
  for (const round of state.league.schedule) for (const f of round) {
    if (f.homeGoals === undefined || f.home === me || f.away === me) continue;
    n++;
    if (f.g?.length || f.homeGoals + (f.awayGoals ?? 0) === 0) g++;
  }
  return n ? g / n : 0;
}

/** 내 리그·컵 경기 득점 기록 → 선수별 결정적 순간 · 컵 골 */
function myLeagueClutch(state: GameState, ctx: Map<string, TeamCtx>): { clu: Map<string, number>; cupGoals: Map<string, number>; uclGoals: Map<string, number> } {
  const clu = new Map<string, number>();
  const cupGoals = new Map<string, number>();
  const uclGoals = new Map<string, number>();
  const add = (id: string, p: number) => clu.set(id, (clu.get(id) ?? 0) + p);
  for (const round of state.league.schedule) {
    for (const f of round) {
      if (f.homeGoals === undefined || !f.g?.length) continue;
      const derby = !!derbyOf(f.home, f.away);
      matchClutch(f.g, f.homeGoals, f.awayGoals!, [leagueWeight(derby, !!ctx.get(f.away)?.top), leagueWeight(derby, !!ctx.get(f.home)?.top)], add);
    }
  }
  const C = R().clutch;
  const tie = (t: CupTie, w: number, ucl = false) => {
    if (t.hg === undefined || !t.g?.length) return;
    matchClutch(t.g, t.hg, t.ag!, [w, w], add);
    for (const [, , s] of t.g) {
      if (!s) continue;
      cupGoals.set(s, (cupGoals.get(s) ?? 0) + 1);
      if (ucl) uclGoals.set(s, (uclGoals.get(s) ?? 0) + 1);
    }
  };
  const cups = state.cups && state.cups.season === state.league.season ? state.cups : null;
  if (cups?.fa) {
    const n = cups.fa.rounds.length;
    const total = cups.fa.dates.length;
    cups.fa.rounds.forEach((r, s) => r.forEach((t) => tie(t, s === total - 1 ? C.fa.final : s === total - 2 ? C.fa.semi : C.fa.early)));
    void n;
  }
  if (cups?.ucl) {
    for (const md of cups.ucl.gs) for (const t of md) tie(t, C.ucl.group, true);
    cups.ucl.ko.forEach((st, s) => [...st.l1, ...st.l2].forEach((t) => tie(t, s === 3 ? C.ucl.final : C.ucl.ko[s] ?? 1.5, true)));
  }
  return { clu, cupGoals, uclGoals };
}

/** 국가의 이번 여름 대회 성적: 4 우승 · 3 준우승 · 2 4강 · 1 8강 · 0 그 밖 */
function natReach(rec: TournamentRec, nation: string): number {
  if (rec.champion === nation) return 4;
  for (let k = rec.ko.length - 1; k >= 0; k--) {
    if (!rec.ko[k]!.ties.some((t) => t.a === nation || t.b === nation)) continue;
    const name = rec.ko[k]!.name;
    return name === '결승' ? 3 : name === '4강' ? 2 : name === '8강' ? 1 : 0;
  }
  return 0;
}

const coefOf = (lg: string) => A().leagueCoef[lg] ?? A().otherCoef;

/** 이번 시즌 이력서 전체 (내 리그 + 고른 다른 리그 + 나). natRec = 이번 여름 대표팀 대회 (없으면 null) */
export function buildResumes(state: GameState, natRec: TournamentRec | null = null): Resume[] {
  const season = state.league.season;
  const P = R();
  const myCtx = leagueCtx(state.league);
  const ctxOf = new Map<string, TeamCtx>(myCtx);
  const ps = state.playerStats ?? {};
  // 내 리그: 다른 경기가 엔진이었는가 (내 경기 상대 선수 기록만 있는 빠른 진행과 구분 — 내 팀 밖 경기 득점 기록이 절반 이상)
  const myEngine = hasEngine(ps, 0) && otherCoverage(state) >= 0.5;
  const { clu: myClu, cupGoals, uclGoals } = myLeagueClutch(state, myCtx);
  const cups = state.cups && state.cups.season === season ? state.cups : null;
  const nat = new Map<string, number>();
  if (natRec) {
    const table = natRec.comp === 'wc' ? P.wc : P.continental;
    for (const n of new Set(natRec.groups.flatMap((g) => g.table.map((r) => r.team)))) {
      const r = natReach(natRec, n);
      if (r > 0) nat.set(n, table[r - 1] ?? 0);
    }
  }
  const moved = new Set((state.transfers ?? []).filter((t) => t.season === season).map((t) => `${t.id}>${t.to}`));
  const out: Resume[] = [];
  const push = (base: { id: string; name: string; teamId: string; pos: Position; age: number | null; nation: string; ovr: number }, raw: Raw, ctx: TeamCtx, me: boolean, extra: { cupGoals: number; natGoals: number; fame: number; story: string[]; storyPts: number; uclGoals?: number }) => {
    const played = ctx.row?.played ?? 0;
    if (!played || raw.apps <= 0) return;
    const proj = Math.max(1, ctx.full / played);
    const group = posGroup(base.pos);
    const share = Math.min(1, raw.apps / played);
    const goals = Math.round(raw.goals * proj);
    const assists = Math.round(raw.assists * proj);
    const coef = coefOf(ctx.lg);
    const defGap = ctx.row ? ctx.avgGa - ctx.row.ga / played : 0;
    const trophyShare = Math.min(1, share / P.fullShare);
    const ur = cups?.ucl ? uclReach(cups.ucl, base.teamId) : -1;
    const tro = ((P.league[ctx.pos - 1] ?? 0) + (cups?.fa?.winner === base.teamId ? P.cup : 0)) * coef * trophyShare + (ur >= 0 ? P.ucl[ur] ?? 0 : 0) * trophyShare;
    const clu = raw.clu ?? raw.goals * P.clutchPerGoal;
    out.push({
      id: base.id, name: base.name, teamId: base.teamId, team: ctx.name, lg: ctx.lg, pos: base.pos, group, age: base.age, nation: base.nation,
      apps: raw.apps, goals, assists, avg: raw.avg, share, allGoals: goals + extra.cupGoals + extra.natGoals, me, est: raw.est,
      out: (goals * (P.goal[group] ?? 1) + assists * (P.assist[group] ?? 0.7)) * coef,
      rat: ((raw.avg - P.ratingBase) * (P.rating[group] ?? 12) + share * P.apps) * coef,
      def: Math.max(0, defGap) * (P.cleanSheet[group] ?? 0) * share * coef,
      tro, nat: nat.get(base.nation) ?? 0, clu: clu * proj, sto: extra.storyPts, fam: extra.fame,
      tal: base.age === null ? base.ovr : base.ovr + (21 - base.age) * P.talentAge,
      ucl: ur >= 0 ? ((P.ucl[ur] ?? 0) + P.uclIn) * trophyShare + (extra.uclGoals ?? 0) * P.uclGoal : 0, tags: extra.story,
    });
  };
  const story = (age: number | null, ctx: TeamCtx, share: number, newClub: boolean): { story: string[]; storyPts: number } => {
    const S = P.story;
    const tags: string[] = [];
    let pts = 0;
    if (age !== null && age <= 19) { pts += S.teen * share; tags.push('10대'); } else if (age !== null && age <= 21) pts += S.young * share;
    if (age !== null && age >= 34) { pts += S.veteran * share; tags.push('베테랑'); }
    const gain = ctx.rank - ctx.pos;
    if (gain > 3) { pts += Math.min(S.underdogMax, (gain - 3) * S.underdogPer) * share; tags.push('약팀 돌풍'); }
    if (newClub) { pts += S.newClub * share; tags.push('이적 첫 시즌'); }
    return { story: tags, storyPts: pts };
  };
  const fameOf = (id: string, ovr: number) => npcStanding(state, id, ovr) / 100;

  // 내 리그: [출전, 골, 도움, 평점×10, 분]
  for (const [teamId, roster] of Object.entries(state.rosters ?? {})) {
    const ctx = myCtx.get(teamId);
    if (!ctx) continue;
    let lineup: { s: Set<string>; b: Set<string> } | null = null;
    for (const p of roster.players) {
      if (p.id === MY_ID) continue;
      const ovr = naturalOvr(p);
      let raw: Raw;
      if (myEngine) {
        const t = ps[p.id];
        if (!t || !t[0]) continue;
        raw = { apps: t[0], goals: t[1], assists: t[2], avg: t[3] / t[0] / 10, clu: myClu.get(p.id) ?? 0, est: false };
      } else {
        lineup ??= lineupSets(roster);
        raw = estimate(state.worldSeed, season, p.id, p.position, ovr, lineup.s.has(p.id) ? 0 : lineup.b.has(p.id) ? 1 : 2, ctx);
      }
      if (raw.apps / Math.max(1, ctx.row?.played ?? 1) < Math.min(A().minShare, A().youngMinShare)) continue;
      const st = story(p.age, ctx, Math.min(1, raw.apps / Math.max(1, ctx.row?.played ?? 1)), moved.has(`${p.id}>${teamId}`));
      push({ id: p.id, name: p.nameKo, teamId, pos: p.position, age: p.age, nation: p.nationality, ovr }, raw, ctx, false,
        { cupGoals: cupGoals.get(p.id) ?? 0, uclGoals: uclGoals.get(p.id) ?? 0, natGoals: 0, fame: fameOf(p.id, ovr), ...st });
    }
  }
  // 다른 리그: [골, 도움, 출전?, 평점×10?, 분?, 결정적 순간×10?]
  for (const lg of (state.otherLeagues ?? []) as OtherLeague[]) {
    if (!sortedTable(lg).some((r) => r.played)) continue;
    const ctxs = leagueCtx(lg);
    for (const [id, c] of ctxs) ctxOf.set(id, c);
    const st = lg.stats ?? {};
    const engine = hasEngine(st, 2);
    const quickGoals = !engine && Object.keys(st).length > 0;
    for (const t of lg.teams) {
      const ctx = ctxs.get(t.id)!;
      const roster = leagueTeamRoster(state.worldSeed, t.id, t.rating, lg.season, state.npcs);
      let lineup: { s: Set<string>; b: Set<string> } | null = null;
      for (const p of roster.players) {
        const ovr = naturalOvr(p);
        const x = st[p.id];
        let raw: Raw;
        if (engine) {
          if (!x || !x[2]) continue;
          raw = { apps: x[2], goals: x[0], assists: x[1], avg: (x[3] ?? 0) / x[2] / 10, clu: (x[5] ?? 0) / 10, est: false };
        } else {
          lineup ??= lineupSets(roster);
          raw = estimate(state.worldSeed, lg.season, p.id, p.position, ovr, lineup.s.has(p.id) ? 0 : lineup.b.has(p.id) ? 1 : 2, ctx);
          if (quickGoals) { raw.goals = x?.[0] ?? 0; raw.assists = x?.[1] ?? 0; }
        }
        if (raw.apps / Math.max(1, ctx.row?.played ?? 1) < Math.min(A().minShare, A().youngMinShare)) continue;
        const sto = story(p.age, ctx, Math.min(1, raw.apps / Math.max(1, ctx.row?.played ?? 1)), false);
        push({ id: p.id, name: p.nameKo, teamId: t.id, pos: p.position, age: p.age, nation: p.nationality, ovr }, raw, ctx, false,
          { cupGoals: cupGoals.get(p.id) ?? 0, uclGoals: uclGoals.get(p.id) ?? 0, natGoals: 0, fame: fameOf(p.id, ovr), ...sto });
      }
    }
  }
  // 나
  const p = state.player;
  const s = p.season;
  const ctx = myCtx.get(p.teamId);
  if (s.apps > 0 && ctx?.row?.played) {
    const age = state.phase === 'season' ? p.age : p.age - 1;
    const share = Math.min(1, s.apps / ctx.row.played);
    const prevTeam = p.history.at(-1)?.teamId;
    const st = story(age, ctx, share, !!prevTeam && prevTeam !== p.teamId);
    if ((s.injuredWeeks ?? 0) >= P.story.comebackWeeks && share >= 0.5) { st.storyPts += P.story.comeback; st.story.push('부상 복귀'); }
    const natGoals = (state.national?.fixtures ?? []).filter((m) => m.season === season).reduce((t, m) => t + (m.g ?? 0), 0);
    const nation = state.national?.nation ?? myNationality(p);
    push({ id: MY_ID, name: p.name, teamId: p.teamId, pos: p.position, age, nation, ovr: playerOvr(p) },
      { apps: s.apps, goals: s.goals, assists: s.assists, avg: s.ratingSum / s.apps, clu: myClu.get(MY_ID) ?? (myEngine ? 0 : null), est: false }, ctx, true,
      { cupGoals: s.cup?.goals ?? 0, uclGoals: uclGoals.get(MY_ID) ?? 0, natGoals, fame: p.reputation / 100, ...st });
  }
  // 리그 득점 1위 · 시즌 기록 (서사)
  const S = P.story;
  const best = new Map<string, Resume>();
  for (const r of out) { const b = best.get(r.lg); if (!b || r.goals > b.goals) best.set(r.lg, r); }
  for (const r of best.values()) { r.sto += S.topScorer; r.tags.push('득점왕'); }
  for (const r of out) {
    const full = ctxOf.get(r.teamId)?.full ?? 38;
    if (r.goals >= S.recordGoals * full / 38) { r.sto += S.record; r.tags.push('시즌 기록'); }
  }
  return out;
}

function lineupSets(roster: TeamRoster): { s: Set<string>; b: Set<string> } {
  const l = pickLineup(roster);
  return { s: new Set(l.slots.map((x) => x.playerId)), b: new Set(l.bench) };
}

// ── 투표 ──

const KEYS = ['out', 'rat', 'def', 'tro', 'nat', 'clu', 'sto', 'fam', 'tal', 'ucl'] as const;
type Key = (typeof KEYS)[number];

/** 상 자격 */
export function eligible(def: AwardDef, r: Resume): boolean {
  if (def.maxAge !== undefined && (r.age === null || r.age > def.maxAge)) return false;
  if (def.europe && A().bootCoef[r.lg] === undefined) return false;
  if (def.groups && !def.groups.includes(r.group)) return false;
  if (def.ucl && r.ucl <= 0) return false;
  return r.share >= (def.youth ? A().youngMinShare : A().minShare);
}

/** 한 줄 결과: 득표(투표 상) 또는 값(골든부츠 점수 · 뮐러 골) */
/** p = 포지션군 */
export interface AwardRow { id: string; n: string; t: string; p: PosGroup; v: number; f?: number; g?: number; me?: 1 }

/** 팀 이름 (줄에는 팀 id 만 담는다 — 세이브 크기) */
export function awardTeam(state: GameState, id: string): string {
  try { return teamById(state.league, id).nameKo; } catch { return id; }
}

/** 투표단 가중치 (상 덮어쓰기 · 비율 합) */
function juryWeights(def: AwardDef, jury: JuryId): Record<Key, number> {
  const w = def.wj?.[jury] ?? def.w ?? A().juries[jury].w;
  return Object.fromEntries(KEYS.map((k) => [k, w[k] ?? 0])) as Record<Key, number>;
}

/** 투표 상 하나: 후보(종합 상위 nominees) → 투표단마다 voters 명이 점수 순위 상위 points.length 명에게 점수 */
function runVote(state: GameState, id: AwardId, def: AwardDef, pool: Resume[], lastWinner: string | null, fatigueAll = 0): AwardRow[] {
  if (!pool.length) return [];
  const mean: Record<Key, number> = {} as Record<Key, number>;
  const sd: Record<Key, number> = {} as Record<Key, number>;
  for (const k of KEYS) {
    const xs = pool.map((r) => r[k]);
    const m = xs.reduce((t, x) => t + x, 0) / xs.length;
    mean[k] = m;
    sd[k] = Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / xs.length) || 1;
  }
  const z = (r: Resume, k: Key) => (r[k] - mean[k]) / sd[k];
  const juries = Object.entries(def.vote ?? {}) as [JuryId, number][];
  const base = (r: Resume, w: Record<Key, number>) => KEYS.reduce((t, k) => t + w[k] * z(r, k), 0);
  // 후보 = 투표단 비율로 섞은 종합 점수 상위
  const ws = juries.map(([j, x]) => [juryWeights(def, j), x] as const);
  const comp = (r: Resume) => ws.reduce((t, [w, x]) => t + x * base(r, w), 0);
  const noms = [...pool].sort((a, b) => comp(b) - comp(a) || (a.id < b.id ? -1 : 1)).slice(0, def.nominees ?? 10);
  // 투표는 후보 안에서 다시 표준화한다 (전체 선수 기준이면 1위가 너무 앞서 만장일치가 된다)
  for (const k of KEYS) {
    const xs = noms.map((r) => r[k]);
    const m = xs.reduce((t, x) => t + x, 0) / xs.length;
    mean[k] = m;
    sd[k] = Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / xs.length) || 1;
  }
  const pts = new Map<string, number>(noms.map((r) => [r.id, 0]));
  const firsts = new Map<string, number>();
  const points = def.points ?? [5, 3, 1];
  const season = state.league.season;
  const leagues = [...new Set(noms.map((r) => r.lg))];
  const nations = [...new Set(noms.map((r) => r.nation))];
  for (const [jury, ratio] of juries) {
    const J = A().juries[jury];
    const w = juryWeights(def, jury);
    const n = Math.max(1, Math.round((def.voters ?? 100) * ratio));
    // 투표단 종합 점수를 후보 안에서 표준화 → 노이즈·성향은 이 단위 (1 = 후보 사이 한 표준편차)
    const raw = noms.map((r) => base(r, w));
    const bm = raw.reduce((t, x) => t + x, 0) / raw.length;
    const bs = Math.sqrt(raw.reduce((t, x) => t + (x - bm) ** 2, 0) / raw.length) || 1;
    const b = raw.map((x) => (x - bm) / bs);
    for (let v = 0; v < n; v++) {
      const rng: Rng = createRng(hashSeed(`${state.worldSeed}:vote:${season}:${id}:${jury}:${v}`));
      const lg = leagues[Math.floor(rng() * leagues.length)];
      const nt = nations[Math.floor(rng() * nations.length)];
      const scored = noms.map((r, i) => {
        let x = b[i]! + gaussian(rng) * J.noise;
        if (jury === 'journalist' && r.id === lastWinner) x -= A().fatigue;
        if (fatigueAll && r.id === lastWinner) x -= fatigueAll;
        if (jury === 'coach') x += (r.lg === lg ? A().sameLeague : 0) + (r.nation === nt ? A().sameNation : 0);
        if (jury === 'fan' && (r.group === 'ST' || r.group === 'WING' || r.group === 'CAM')) x += A().fanAttacker;
        return { r, x };
      }).sort((a, c) => c.x - a.x || (a.r.id < c.r.id ? -1 : 1));
      scored.slice(0, points.length).forEach((s, k) => {
        pts.set(s.r.id, (pts.get(s.r.id) ?? 0) + points[k]! * ratio * (def.voters ?? 100) / n);
        if (k === 0) firsts.set(s.r.id, (firsts.get(s.r.id) ?? 0) + 1);
      });
    }
  }
  return noms.map((r) => ({ ...rowOf(r, Math.round(pts.get(r.id)!)), f: firsts.get(r.id) ?? 0 }))
    .sort((a, b) => b.v - a.v || (b.f ?? 0) - (a.f ?? 0) || (a.id < b.id ? -1 : 1));
}

/**
 * 올해의 팀 (47b): 4-3-3 슬롯(xiSlots)마다 후보 = 그 포지션군 투표단 종합 점수 상위 (자리 수 × xiPool) → 투표자마다 노이즈를 더해
 * 자리 수만큼 골라 1표씩. 득표 많은 순으로 자리를 채운다. 줄 순서 = 슬롯 순서 (GK · 풀백 · 센터백 · 미드 · 공격), v = 득표
 */
function runXi(state: GameState, key: string, def: AwardDef, pool: Resume[]): AwardRow[] {
  const season = state.league.season;
  const out: AwardRow[] = [];
  const juries = Object.entries(def.vote ?? {}) as [JuryId, number][];
  for (const [slot, groups, count] of A().xiSlots) {
    const cand = pool.filter((r) => groups.includes(r.group));
    if (!cand.length) continue;
    const z = (xs: Resume[]) => {
      const st = Object.fromEntries(KEYS.map((k) => {
        const v = xs.map((r) => r[k]);
        const m = v.reduce((t, x) => t + x, 0) / v.length;
        return [k, [m, Math.sqrt(v.reduce((t, x) => t + (x - m) ** 2, 0) / v.length) || 1]];
      })) as Record<Key, [number, number]>;
      return (r: Resume, w: Record<Key, number>) => KEYS.reduce((t, k) => t + w[k] * (r[k] - st[k][0]) / st[k][1], 0);
    };
    const ws = juries.map(([j, x]) => [juryWeights(def, j), x] as const);
    const all = z(cand);
    const noms = [...cand].sort((a, b) => ws.reduce((t, [w, x]) => t + x * (all(b, w) - all(a, w)), 0) || (a.id < b.id ? -1 : 1)).slice(0, count * A().xiPool);
    const inNom = z(noms);
    const votes = new Map<string, number>(noms.map((r) => [r.id, 0]));
    for (const [jury, ratio] of juries) {
      const w = juryWeights(def, jury);
      const raw = noms.map((r) => inNom(r, w));
      const bm = raw.reduce((t, x) => t + x, 0) / raw.length;
      const bs = Math.sqrt(raw.reduce((t, x) => t + (x - bm) ** 2, 0) / raw.length) || 1;
      const n = Math.max(1, Math.round((def.voters ?? 60) * ratio));
      for (let v = 0; v < n; v++) {
        const rng: Rng = createRng(hashSeed(`${state.worldSeed}:xi:${season}:${key}:${slot}:${jury}:${v}`));
        noms.map((r, i) => ({ r, x: (raw[i]! - bm) / bs + gaussian(rng) * A().juries[jury].noise }))
          .sort((a, b) => b.x - a.x || (a.r.id < b.r.id ? -1 : 1)).slice(0, count)
          .forEach((s) => votes.set(s.r.id, votes.get(s.r.id)! + 1));
      }
    }
    out.push(...noms.map((r) => rowOf(r, votes.get(r.id)!)).sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1)).slice(0, count));
  }
  return out;
}

const rowOf = (r: Resume, v: number): AwardRow => ({ id: r.id, n: r.name, t: r.teamId, p: r.group, v, ...(r.me ? { me: 1 as const } : {}) });

/** 공식 상 (투표 없음): 골든부츠 = 골 × 계수, 뮐러 = 공식 경기 골 */
function runFormula(def: AwardDef, pool: Resume[]): AwardRow[] {
  if (def.formula === 'boot') {
    return pool.filter((r) => r.goals > 0).map((r) => ({ ...rowOf(r, r.goals * A().bootCoef[r.lg]!), g: r.goals }))
      .sort((a, b) => b.v - a.v || b.g! - a.g! || (a.id < b.id ? -1 : 1)).slice(0, 10);
  }
  if (def.formula === 'wcBoot') {
    return pool.filter((r) => r.goals > 0).map((r) => ({ ...rowOf(r, r.goals), g: r.goals }))
      .sort((a, b) => b.v - a.v || (pool.find((x) => x.id === b.id)!.assists - pool.find((x) => x.id === a.id)!.assists) || (a.id < b.id ? -1 : 1)).slice(0, 10);
  }
  return pool.filter((r) => r.allGoals > 0).map((r) => ({ ...rowOf(r, r.allGoals), g: r.allGoals }))
    .sort((a, b) => b.v - a.v || (a.id < b.id ? -1 : 1)).slice(0, 10);
}

/** 한 시즌 시상 (역대 수상자 · 발표 상태) */
export interface AwardYear {
  season: number;
  /** 상 id → 결과 (득표 순). 가장 최근 시즌은 후보 전체, 그 앞은 keepRows 줄 */
  res: Record<AwardId, AwardRow[]>;
  /** 발표 날짜 (상 id → 날짜). 발롱도르 후보 발표는 'ballonDor:nominees' */
  due: Record<string, IsoDate>;
  /** 발표한 것 */
  shown: string[];
  /** 기록을 추정한 시상인가 (빠른 진행) */
  est?: 1;
  /** 내 이력서 요약 (화면): 항목별 원점수 · 서사 */
  mine?: { tags: string[]; clu: number; sto: number };
  /** 그해 대륙 대회 (대륙컵 상 이름, 47b) */
  cont?: string;
}

/** 이달의 선수 한 줄 (47b): s 시즌 · m 'YYYY-MM' · lg 리그 · 수상자 · 팀 · 그달 골(반올림) · 득표 */
export interface PotmRec { s: number; m: string; lg: string; id: string; n: string; t: string; g: number; v: number; me?: 1 }

export interface AwardsState {
  years: AwardYear[];
  /** 이달의 선수 (47b, potmKeepSeasons 시즌) */
  months?: PotmRec[];
  /** 내 이달의 선수 통산 */
  potm?: number;
}

// ── 월드컵 이력서 (월드컵 상) ──

/**
 * 월드컵 출전 선수 이력서: 나라마다 대표팀 명단(natRoster)의 선발 11 · 벤치에 경기 수를 주고, 나라 골을 포지션 득점률 × OVR 로 나눠 준다(시드).
 * 나는 실제 대표팀 경기 기록. 평점 = OVR · 성적 · 골로 추정. 트로피 = 나라 성적
 */
export function wcResumes(state: GameState, rec: TournamentRec): Resume[] {
  const comp = rec.comp;
  const P = R();
  const G = BALANCE.goals;
  const season = state.league.season;
  const nations = [...new Set(rec.groups.flatMap((g) => g.table.map((r) => r.team)))];
  const mine = (state.national?.fixtures ?? []).filter((m) => m.comp === comp && m.season === season && (m.min ?? 0) > 0);
  const myNat = state.national?.nation ?? myNationality(state.player);
  const out: Resume[] = [];
  let gaSum = 0;
  let gpSum = 0;
  const info = new Map<string, { p: number; gf: number; ga: number; reach: number }>();
  for (const n of nations) {
    const row = rec.groups.flatMap((g) => g.table).find((r) => r.team === n)!;
    let p = row.p; let gf = row.gf; let ga = row.ga;
    for (const st of rec.ko) for (const t of st.ties) {
      if (t.a === n) { p++; gf += t.ga; ga += t.gb; } else if (t.b === n) { p++; gf += t.gb; ga += t.ga; }
    }
    info.set(n, { p, gf, ga, reach: natReach(rec, n) });
    gaSum += ga; gpSum += p;
  }
  const avgGa = gpSum ? gaSum / gpSum : 1.3;
  for (const n of nations) {
    const x = info.get(n)!;
    if (!x.p) continue;
    const roster = natRoster(state, n);
    const l = lineupSets(roster);
    const rng = createRng(hashSeed(`${state.worldSeed}:wc-aw:${season}:${n}`));
    const meIn = n === myNat && mine.length > 0;
    const myGoals = meIn ? mine.reduce((t, m) => t + (m.g ?? 0), 0) : 0;
    const lines = roster.players.map((p) => {
      const apps = l.s.has(p.id) ? x.p : l.b.has(p.id) ? Math.round(x.p * (0.2 + rng() * 0.4)) : 0;
      const rate = G.rates[posGroup(p.position)] ?? [0, 0, 0];
      const ovr = naturalOvr(p);
      return { p, ovr, apps, wg: apps * rate[0] * Math.max(0.3, 1 + (ovr - nationRating(n)) * G.ovrK), wa: apps * rate[1] * Math.max(0.3, 1 + (ovr - nationRating(n)) * G.ovrK), goals: 0, assists: 0 };
    }).filter((z) => z.apps > 0);
    const pickW = (key: 'wg' | 'wa') => {
      const tot = lines.reduce((t, z) => t + z[key], 0);
      let u = rng() * tot;
      for (const z of lines) { u -= z[key]; if (u <= 0) return z; }
      return lines.at(-1)!;
    };
    for (let k = 0; k < Math.max(0, x.gf - myGoals) && lines.length; k++) {
      pickW('wg').goals++;
      if (rng() < 0.75) pickW('wa').assists++;
    }
    const tro = ((comp === 'wc' ? P.wc : P.continental)[x.reach - 1] ?? 0);
    const defGap = avgGa - x.ga / x.p;
    const add = (id: string, name: string, pos: Position, age: number | null, ovr: number, apps: number, goals: number, assists: number, avg: number, me: boolean, fam: number) => {
      const group = posGroup(pos);
      const share = Math.min(1, apps / x.p);
      out.push({
        id, name, teamId: natId(n), team: nationOf(n).nameKo, lg: comp, pos, group, age, nation: n, apps, goals, assists, avg, share, allGoals: goals, me, est: !me,
        out: goals * (P.goal[group] ?? 1) + assists * (P.assist[group] ?? 0.7), rat: (avg - P.ratingBase) * (P.rating[group] ?? 12) + share * P.apps,
        def: Math.max(0, defGap) * (P.cleanSheet[group] ?? 0) * share, tro: tro * share, nat: 0, clu: goals * P.clutchPerGoal, sto: 0, fam,
        tal: age === null ? ovr : ovr + (21 - age) * P.talentAge, ucl: 0, tags: [],
      });
    };
    for (const z of lines) {
      const avg = clamp(6.5 + (z.ovr - 75) * 0.03 + x.reach * 0.12 + (z.goals / Math.max(1, z.apps)) * 0.6 + (rng() * 2 - 1) * 0.2, 5.8, 8.6);
      add(z.p.id, z.p.nameKo, z.p.position, z.p.age, z.ovr, z.apps, z.goals, z.assists, avg, false, npcStanding(state, z.p.id, z.ovr) / 100);
    }
    if (meIn) {
      const rs = mine.filter((m) => typeof m.r === 'number');
      const p = state.player;
      add(MY_ID, p.name, p.position, state.phase === 'season' ? p.age : p.age - 1, playerOvr(p), mine.length, myGoals, mine.reduce((t, m) => t + (m.a ?? 0), 0),
        rs.length ? rs.reduce((t, m) => t + (m.r as number), 0) / rs.length : 6.5, true, p.reputation / 100);
    }
  }
  return out;
}

/** 이번 시즌 시상 계산 (결정적) */
export function computeAwards(state: GameState, natRec: TournamentRec | null = null, resumes = buildResumes(state, natRec)): AwardYear {
  const season = state.league.season;
  const res: Record<AwardId, AwardRow[]> = {};
  const due: Record<string, IsoDate> = {};
  const prev = state.globalAwards?.years.find((y) => y.season === season - 1);
  const wc = natRec?.comp === 'wc' ? wcResumes(state, natRec) : null;
  const cont = natRec && natRec.comp !== 'wc' ? wcResumes(state, natRec) : null;
  const lgs = seasonLeagues(state);
  for (const [id, def] of Object.entries(A().defs)) {
    if (def.monthly || (def.wc && !wc) || (def.cont && !cont)) continue;
    const src = def.wc ? wc! : def.cont ? cont! : resumes;
    // 리그 상 (47b): 고른 리그마다 따로 (키 '상@리그')
    const keys: [string, string | null][] = def.scope === 'league'
      ? lgs.filter((lg) => (!def.leagues || def.leagues.includes(lg)) && !def.notLeagues?.includes(lg)).map((lg) => [`${id}@${lg}`, lg])
      : [[id, null]];
    for (const [key, lg] of keys) {
      const pool = src.filter((r) => (!lg || r.lg === lg) && eligible(def, r));
      if (lg && pool.length < 3) continue;
      const rows = def.formula ? runFormula(def, pool) : def.xi ? runXi(state, key, def, pool) : runVote(state, key, def, pool, prev?.res[key]?.[0]?.id ?? null);
      // 저장: 후보 발표가 있는 상(발롱도르)·올해의 팀은 전체, 나머지는 keepLatest 줄 (세이브 크기)
      res[key] = def.nomineesDue || def.xi ? rows : rows.slice(0, A().keepLatest);
      if (def.due) due[key] = isoDate(season + 1, def.due[0], def.due[1]);
      if (def.nomineesDue) due[`${key}:nominees`] = isoDate(season + 1, def.nomineesDue[0], def.nomineesDue[1]);
    }
  }
  const me = resumes.find((r) => r.me);
  return {
    season, res, due, shown: [], ...(resumes.some((r) => r.est) ? { est: 1 as const } : {}), ...(me ? { mine: { tags: me.tags, clu: Math.round(me.clu * 10) / 10, sto: Math.round(me.sto * 10) / 10 } } : {}),
    ...(cont ? { cont: natRec!.comp } : {}),
  };
}

/** 이번 시즌 리그 (내 리그 먼저, 그다음 고른 다른 리그) */
export function seasonLeagues(state: GameState): string[] {
  return [state.league.id, ...((state.otherLeagues ?? []) as OtherLeague[]).map((l) => l.id).filter((id) => id !== state.league.id)];
}

/** 내 순위 (없으면 null) */
export const myAwardRank = (rows: readonly { me?: 1 }[] | undefined): number | null => {
  const i = (rows ?? []).findIndex((r) => r.me);
  return i < 0 ? null : i + 1;
};

// ── 시즌 끝 · 발표 ──

/**
 * 시즌 끝 시상 (endSeason, 컵·대표팀 여름 대회 뒤): 이력서 → 투표 → 결과를 저장하고, 발표 날짜가 없는 상(골든부츠)은 바로 발표한다.
 * 후보가 거의 없으면(리그 로스터 없음) 시상하지 않는다. 돌려주는 값 = 바로 발표한 상의 업적 (시즌 업적 줄)
 */
export function awardsSeasonEnd(state: GameState, natRec: TournamentRec | null): AwardReveal[] {
  // 이달의 선수 (47b): 마지막 달 (리그 최종 라운드가 든 달)
  const last = otherLeagueCalendar(state.worldSeed, state.league).roundDates.at(-1);
  if (last) potmRun(state, last.slice(0, 7));
  const resumes = buildResumes(state, natRec);
  if (resumes.filter((r) => !r.me).length < BALANCE.goals.leagueStatsMin) return [];
  const year = computeAwards(state, natRec, resumes);
  const st = (state.globalAwards ??= { years: [] });
  for (const y of st.years) {
    for (const k of Object.keys(y.res)) if (!awardDefOf(k)?.xi && y.res[k]!.length > A().keepRows) y.res[k] = y.res[k]!.slice(0, A().keepRows);
  }
  st.years = [...st.years.filter((y) => y.season !== year.season), year];
  const out: AwardReveal[] = [];
  for (const id of Object.keys(year.res)) if (!year.due[id]) out.push(...reveal(state, year, id, false));
  return out;
}

/** 발표 한 건의 내 보상 (업적 줄) */
export interface AwardReveal { id: AwardId; label: string; xp: number; rank: number }

/** 상 하나 발표: 기사 · 내가 받으면 보상 (XP는 inSeasonEnd 면 시즌 업적으로 넘기고, 아니면 바로 더한다) */
function reveal(state: GameState, year: AwardYear, id: AwardId, addNow: boolean): AwardReveal[] {
  if (year.shown.includes(id)) return [];
  year.shown.push(id);
  const def = awardDefOf(id);
  const rows = year.res[id] ?? [];
  if (!def) return [];
  const out: AwardReveal[] = [];
  const ko = awardKo(id, year.cont);
  // 올해의 팀 (47b): 11명에 들면 선정 (보상 = 배지 · 시상 머리말 횟수)
  const rank = def.xi ? (rows.some((r) => r.me) ? 1 : null) : myAwardRank(rows.slice(0, 3));
  const p = state.player;
  if (rank && ((def.xp[rank - 1] ?? 0) > 0 || def.xi)) {
    const xp = def.xp[rank - 1] ?? 0;
    out.push({ id, label: def.xi ? `${awardYearOf(year)} ${ko} 선정` : rank === 1 ? `${awardYearOf(year)} ${ko} 수상` : `${awardYearOf(year)} ${ko} ${rank}위`, xp, rank });
    if (addNow && xp > 0) addXp(p, Math.round(xp * BALANCE.difficulty[state.difficulty].xp));
  }
  if (rank === 1) {
    p.reputation = Math.min(BALANCE.reputation.max, p.reputation + def.rep);
    // 최고 개인상 (레전더리 조건 4a): 시즌마다 센다 (시즌당 상한은 판정 때). 같은 묶음(topKey, 리그 올해의 선수 PFA · FWA)은 한 시즌 1회
    const dup = !!def.topKey && year.shown.some((k) => k !== id && awardDefOf(k)?.topKey === def.topKey && year.res[k]?.[0]?.me);
    if (def.top && !dup) {
      const top = { ...(p.honors.top ?? {}) };
      top[year.season] = (top[year.season] ?? 0) + 1;
      p.honors = { ...p.honors, top };
    }
    const label = `${awardYearOf(year)} ${ko}`;
    if (id === 'ballonDor') {
      p.honors = { ...p.honors, ballonDor: (p.honors.ballonDor ?? 0) + 1 };
      grantAchievementPick(state, 'ballonDor', label);
      // 레전드 배지 (8.2): 발롱도르 1회 — 시즌 중 발표라 여기서 바로
      if (addNow) awardBadges(p, year.season);
    } else if (def.pick && state.cards) {
      grantTierPick(state.cards, `award:${year.season}:${id}`, p.position, state.worldSeed, label, def.pick, 'award');
    }
    if (addNow) addTrophy(state, year.season, def.xi ? `${label} 선정` : label);
  }
  // 기사: 다른 리그 상은 내가 들었을 때만 (리그마다 기사가 쏟아지지 않게)
  const lg = awardLeague(id);
  if (!state.events?.off && (!lg || lg === state.league.id || rows.some((r) => r.me))) awardArticle(state, year, id, rows, rank);
  return out;
}

/** 트로피 (챕터 기록 → 진열실 · 커리어): 그 시즌이 든 챕터에 */
function addTrophy(state: GameState, season: number, label: string): void {
  const list = state.chapters?.list ?? [];
  const ch = list.find((c) => c.startSeason <= season && season <= c.endSeason) ?? list.at(-1);
  // 챕터 트로피 줄은 "시즌 라벨" 꼴이라 시즌 대신 시상 연도를 붙인 라벨 그대로
  if (ch) ch.trophies.push(label);
}

/** 시상 연도 = 시즌이 끝나는 해 (2018-19 시즌 → 2019 발롱도르) */
export const awardYearOf = (y: { season: number }): number => y.season + 1;

const juryLine = (def: AwardDef) => Object.entries(def.vote ?? {}).map(([j, x]) => `${JURY_KO[j as JuryId]}${(x ?? 0) < 1 ? ` ${Math.round((x ?? 0) * 100)}%` : ''}`).join(' · ');

/** 올해의 팀 줄 포지션 이름 */
export const XI_KO: Record<string, string> = { GK: 'GK', FB: '풀백', CB: '센터백', CDM: '미드', CM: '미드', CAM: '미드', WING: '공격', ST: '공격' };

const nameOf = (state: GameState, r: AwardRow | undefined) => (r ? `${r.me ? state.player.name : r.n}(${awardTeam(state, r.t)})` : '-');

function awardArticle(state: GameState, year: AwardYear, id: AwardId, rows: AwardRow[], rank: number | null): void {
  const def = awardDefOf(id)!;
  const w = rows[0];
  if (!w) return;
  const ko = awardKo(id, year.cont);
  if (def.xi) {
    const mine = rows.some((r) => r.me);
    pushInbox(state, {
      cat: 'media', key: `aw:${year.season}:${id}`,
      title: mine ? `${awardYearOf(year)} ${ko} 선정 · ${state.player.name}` : `${awardYearOf(year)} ${ko} 발표`,
      body: `${awardYearOf(year)} ${ko} (선수단 투표, 4-3-3): ${rows.map((r) => `${XI_KO[r.p] ?? r.p} ${nameOf(state, r)}`).join(' · ')}.${mine ? ' 내 이름이 들어갔어요.' : ''}`,
      link: { to: 'awards', label: '시상식 보기' },
    });
    return;
  }
  const val = (r: AwardRow) => (def.formula === 'boot' ? `${r.g}골 · ${r.v}점` : def.formula === 'goals' || def.formula === 'wcBoot' ? `${r.g ?? r.v}골` : `${r.v}점${r.f ? ` · 1위표 ${r.f}` : ''}`);
  const podium = rows.slice(0, 3).map((r, i) => `${i + 1}위 ${nameOf(state, r)} ${val(r)}`).join(' · ');
  const mine = myAwardRank(rows);
  const meLine = rank === 1 ? '' : mine ? ` ${state.player.name}은(는) ${mine}위${def.formula ? '' : ` (${rows[mine - 1]!.v}점)`}.` : '';
  pushInbox(state, {
    cat: 'media', key: `aw:${year.season}:${id}`,
    title: rank === 1 ? `${awardYearOf(year)} ${ko} 수상 · ${state.player.name}` : `${awardYearOf(year)} ${ko} · ${w.me ? state.player.name : w.n}`,
    body: `${awardYearOf(year)} ${ko}${def.formula ? '' : ` (${juryLine(def)})`}. ${podium}.${meLine}`,
    link: { to: 'awards', label: '시상식 보기' },
  });
}

/** 발롱도르 30인 후보 발표 기사 */
function nomineesArticle(state: GameState, year: AwardYear, id: AwardId): void {
  const rows = year.res[id] ?? [];
  if (state.events?.off || !rows.length) return;
  const mine = rows.some((r) => r.me);
  const names = [...rows].sort((a, b) => (a.n < b.n ? -1 : 1)).slice(0, 8).map((r) => (r.me ? state.player.name : r.n)).join(' · ');
  pushInbox(state, {
    cat: 'media', key: `aw:${year.season}:${id}:nom`,
    title: mine ? `${awardYearOf(year)} ${awardKo(id)} 후보 ${rows.length}인 · ${state.player.name} 포함` : `${awardYearOf(year)} ${awardKo(id)} 후보 ${rows.length}인 발표`,
    body: `${awardYearOf(year)} ${awardKo(id)} 후보 ${rows.length}명이 발표됐어요 (가나다순 일부: ${names} …). 시상은 ${year.due[id]?.slice(5).replace('-', '월 ')}일.${mine ? ' 내 이름이 들어갔어요.' : ''}`,
    link: { to: 'awards', label: '후보 보기' },
  });
}

/** 하루 끝 (endDay): 발표 날짜가 된 상을 발표한다 (후보 발표 → 결과) */
export function awardsDayEnd(state: GameState, date: IsoDate): void {
  powerArticle(state, date);
  // 이달의 선수 (47b): 매달 1일에 지난달
  if (state.phase === 'season' && date.slice(8) === '01') {
    const [yy, mm] = [Number(date.slice(0, 4)), Number(date.slice(5, 7))];
    potmRun(state, mm === 1 ? `${yy - 1}-12` : `${yy}-${String(mm - 1).padStart(2, '0')}`);
  }
  for (const y of state.globalAwards?.years ?? []) {
    for (const [k, d] of Object.entries(y.due)) {
      if (y.shown.includes(k) || daysBetween(d, date) < 0) continue;
      if (k.endsWith(':nominees')) {
        y.shown.push(k);
        nomineesArticle(state, y, k.slice(0, -':nominees'.length));
      } else reveal(state, y, k, true);
    }
  }
}

// ── 이달의 선수 (47b) ──

/**
 * 그달 후보 이력서: 그달 리그 경기(팀 경기 수 · 득실 · 승점)와 선수 골 · 도움 · 결정적 순간. 엔진 득점 기록이 있는 팀은 그 기록,
 * 없으면(빠른 진행) 시즌 비율 × 그달 팀 득점 비 × 달마다 흔들림. 평점은 시즌 평균 + 그달 팀 승점
 */
function potmPool(state: GameState, L: LeagueState, ym: string, fx: Fixture[], base: Resume[]): Resume[] {
  const P = R();
  const ctx = leagueCtx(L);
  const team = new Map<string, { p: number; gf: number; ga: number; pts: number }>();
  const noRec = new Set<string>();
  const rg = new Map<string, number>();
  const ra = new Map<string, number>();
  const clu = new Map<string, number>();
  const inc = (m: Map<string, number>, id: string, x: number) => m.set(id, (m.get(id) ?? 0) + x);
  const upd = (id: string, gf: number, ga: number) => {
    const t = team.get(id) ?? { p: 0, gf: 0, ga: 0, pts: 0 };
    t.p++; t.gf += gf; t.ga += ga; t.pts += gf > ga ? 3 : gf === ga ? 1 : 0;
    team.set(id, t);
  };
  for (const f of fx) {
    const hg = f.homeGoals!;
    const ag = f.awayGoals!;
    upd(f.home, hg, ag);
    upd(f.away, ag, hg);
    if (!f.g?.length && hg + ag > 0) { noRec.add(f.home); noRec.add(f.away); continue; }
    for (const [, , sc, as] of f.g ?? []) { if (sc) inc(rg, sc, 1); if (as) inc(ra, as, 1); }
    const derby = !!derbyOf(f.home, f.away);
    matchClutch(f.g ?? [], hg, ag, [leagueWeight(derby, !!ctx.get(f.away)?.top), leagueWeight(derby, !!ctx.get(f.home)?.top)], (id, x) => inc(clu, id, x));
  }
  let gp = 0;
  let ga = 0;
  for (const t of team.values()) { gp += t.p; ga += t.ga; }
  const avgGa = gp ? ga / gp : 1.4;
  const coef = coefOf(L.id);
  const out: Resume[] = [];
  for (const r of base) {
    const tm = team.get(r.teamId);
    const c = ctx.get(r.teamId);
    if (!tm || !c) continue;
    const apps = r.share * tm.p;
    if (apps < A().potmMinApps) continue;
    let goals: number;
    let assists: number;
    let cl: number;
    if (!noRec.has(r.teamId)) {
      goals = rg.get(r.id) ?? 0; assists = ra.get(r.id) ?? 0; cl = clu.get(r.id) ?? 0;
    } else {
      const rng = createRng(hashSeed(`${state.worldSeed}:potm:${ym}:${r.id}`));
      const rate = c.row?.played ? c.row.gf / c.row.played : 1.4;
      const k = clamp(tm.gf / tm.p / Math.max(0.3, rate), 0.3, 2.5) * tm.p / Math.max(1, c.full);
      goals = r.goals * k * (0.4 + rng() * 1.2);
      assists = r.assists * k * (0.4 + rng() * 1.2);
      cl = goals * P.clutchPerGoal;
    }
    const g = r.group;
    out.push({
      ...r, goals, assists, apps,
      out: (goals * (P.goal[g] ?? 1) + assists * (P.assist[g] ?? 0.7)) * coef,
      rat: (r.avg - P.ratingBase) * (P.rating[g] ?? 12) * coef + (tm.pts / tm.p) * 3,
      def: Math.max(0, avgGa - tm.ga / tm.p) * (P.cleanSheet[g] ?? 0) * coef,
      tro: tm.pts / tm.p, clu: cl, sto: 0, nat: 0, tal: 0, ucl: 0,
    });
  }
  return out;
}

/** 그달(ym 'YYYY-MM') 리그마다 이달의 선수 (기자단 + 팬): 그달 경기가 모자라거나 이미 뽑은 리그는 건너뛴다. 내가 받으면 XP (위상 증가에 넣지 않음) */
export function potmRun(state: GameState, ym: string): void {
  const def = A().defs.potm;
  if (!def) return;
  const st = (state.globalAwards ??= { years: [] });
  const months = (st.months ??= []);
  const season = state.league.season;
  const leagues: LeagueState[] = [state.league, ...((state.otherLeagues ?? []) as OtherLeague[]).filter((l) => l.id !== state.league.id)];
  let resumes: Resume[] | null = null;
  for (const L of leagues) {
    if (months.some((x) => x.m === ym && x.lg === L.id)) continue;
    const cal = otherLeagueCalendar(state.worldSeed, L);
    const fx: Fixture[] = [];
    L.schedule.forEach((round, r) => round.forEach((f, i) => { if (f.homeGoals !== undefined && cal.fixtureDates[r]?.[i]?.startsWith(ym)) fx.push(f); }));
    if (fx.length < (L.teams.length / 2) * A().potmMinRounds) continue;
    resumes ??= buildResumes(state);
    const pool = potmPool(state, L, ym, fx, resumes.filter((r) => r.lg === L.id));
    if (pool.length < 3) continue;
    const prev = months.filter((x) => x.lg === L.id && x.m < ym).sort((a, b) => (a.m < b.m ? 1 : -1))[0];
    const rows = runVote(state, `potm:${ym}@${L.id}`, def, pool, prev?.id ?? null, A().potmFatigue);
    const w = rows[0];
    if (!w) continue;
    const g = Math.round(pool.find((x) => x.id === w.id)!.goals);
    months.push({ s: season, m: ym, lg: L.id, id: w.id, n: w.n, t: w.t, g, v: w.v, ...(w.me ? { me: 1 as const } : {}) });
    if (w.me) {
      st.potm = (st.potm ?? 0) + 1;
      addXp(state.player, Math.round((def.xp[0] ?? 0) * BALANCE.difficulty[state.difficulty].xp));
    }
    if (L.id === state.league.id && !state.events?.off) {
      const mo = Number(ym.slice(5));
      const mine = myAwardRank(rows);
      pushInbox(state, {
        cat: 'media', key: `aw-potm:${ym}:${L.id}`,
        title: w.me ? `${mo}월 이달의 선수 · ${state.player.name}` : `${leagueKo(L.id)} ${mo}월 이달의 선수 · ${w.n}`,
        body: `${leagueKo(L.id)} ${mo}월 이달의 선수 (기자단 · 팬 투표): ${rows.slice(0, 3).map((r, i) => `${i + 1}위 ${nameOf(state, r)}`).join(' · ')}.${w.me ? '' : mine ? ` ${state.player.name}은(는) ${mine}위.` : ''}`,
        link: { to: 'awards', label: '시상 보기' },
      });
    }
  }
  st.months = months.filter((x) => x.s > season - A().potmKeepSeasons);
}

// ── 시즌 중 파워 랭킹 (발롱도르 레이스) ──

/** 발롱도르 기자단 종합 점수 순위 (노이즈 없음, 지금까지 기록 시즌 환산): 상위 n명 + 내 순위 */
export function powerRanking(state: GameState, n = 5): { top: { name: string; team: string; me: boolean }[]; mine: number | null } {
  const def = A().defs.ballonDor!;
  const pool = buildResumes(state).filter((r) => eligible(def, r));
  if (!pool.length) return { top: [], mine: null };
  const w = juryWeights(def, 'journalist');
  const stat = (k: Key) => {
    const xs = pool.map((r) => r[k]);
    const m = xs.reduce((t, x) => t + x, 0) / xs.length;
    return [m, Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / xs.length) || 1] as const;
  };
  const st = Object.fromEntries(KEYS.map((k) => [k, stat(k)])) as Record<Key, readonly [number, number]>;
  const score = (r: Resume) => KEYS.reduce((t, k) => t + w[k] * (r[k] - st[k][0]) / st[k][1], 0);
  const sorted = pool.map((r) => ({ r, x: score(r) })).sort((a, b) => b.x - a.x || (a.r.id < b.r.id ? -1 : 1));
  const i = sorted.findIndex((x) => x.r.me);
  return { top: sorted.slice(0, n).map(({ r }) => ({ name: r.me ? state.player.name : r.name, team: r.team, me: r.me })), mine: i < 0 ? null : i + 1 };
}

const raceCache = new Map<string, number | null>();

/** 홈 칩 (C.76t): 시즌 중(리그 powerFromRound 라운드 뒤) 발롱도르 파워 랭킹 내 순위. 같은 날·라운드는 캐시 */
export function raceRank(state: GameState): number | null {
  const L = state.league;
  if (state.phase !== 'season' || L.round < A().powerFromRound || L.round >= L.schedule.length) return null;
  const key = `${state.worldSeed}:${L.season}:${L.round}:${state.calendar.date}:${state.player.season.apps}`;
  if (!raceCache.has(key)) {
    if (raceCache.size > 8) raceCache.clear();
    const r = powerRanking(state).mine;
    raceCache.set(key, r && r <= A().raceChipMax ? r : null);
  }
  return raceCache.get(key) ?? null;
}

/** 하루 끝: 매달 1일(리그 8라운드 뒤 ~ 시즌 끝 전) 발롱도르 파워 랭킹 기사 */
function powerArticle(state: GameState, date: IsoDate): void {
  const L = state.league;
  if (state.phase !== 'season' || state.events?.off || date.slice(8) !== '01' || L.round < A().powerFromRound || L.round >= L.schedule.length) return;
  const pr = powerRanking(state);
  if (!pr.top.length) return;
  const month = Number(date.slice(5, 7));
  const meLine = pr.mine && pr.mine > 5 ? ` ${state.player.name}은(는) ${pr.mine}위.` : !pr.mine ? ` ${state.player.name}은(는) 아직 순위 밖 (출전이 모자라요).` : '';
  pushInbox(state, {
    cat: 'media', key: `aw-power:${L.season}:${month}`,
    title: pr.mine && pr.mine <= 5 ? `발롱도르 파워 랭킹 ${pr.mine}위 · ${state.player.name}` : `발롱도르 파워 랭킹 · ${month}월`,
    body: `기자들이 본 지금 발롱도르 레이스: ${pr.top.map((t, k) => `${k + 1}위 ${t.name}(${t.team})`).join(' · ')}.${meLine} 트로피 · 결정적 순간 · 서사가 기록만큼 중요해요.`,
    link: { to: 'awards', label: '시상 보기' },
  });
}

/** 은퇴 (커리어 끝): 남은 발표를 모두 한다 */
export function awardsFlush(state: GameState): void {
  for (const y of state.globalAwards?.years ?? []) for (const k of Object.keys(y.due)) if (!y.shown.includes(k) && !k.endsWith(':nominees')) reveal(state, y, k, true);
}

/** 발표된 결과만 (화면·위상): 아직이면 null */
export function shownRows(y: AwardYear, id: AwardId): AwardRow[] | null {
  return y.shown.includes(id) ? y.res[id] ?? [] : null;
}

/** NPC 위상 (C.64 수상 개수): fromSeason 시즌부터 발표된 개인상 1위 (발롱도르 = standingBallonDor 개, 나머지 1개) */
export function npcGlobalHonors(state: GameState, id: string, fromSeason: number): number {
  let n = 0;
  for (const y of state.globalAwards?.years ?? []) {
    if (y.season < fromSeason) continue;
    for (const k of y.shown) {
      const d = awardDefOf(k);
      // 올해의 팀 · 리그 영플레이어는 위상 수상 개수에 넣지 않는다 (47b)
      if (!d || d.xi || (d.scope === 'league' && !d.top)) continue;
      if (y.res[k]?.[0]?.id === id) n += k === 'ballonDor' ? A().standingBallonDor : 1;
    }
  }
  return n;
}

/** 내 개인상 통산 (커리어 기록): 상 id → 1위 횟수 */
export function myAwardCounts(state: GameState): Record<AwardId, number> {
  const out: Record<AwardId, number> = {};
  for (const y of state.globalAwards?.years ?? []) {
    for (const k of y.shown) {
      const rows = y.res[k] ?? [];
      if (awardDefOf(k)?.xi ? rows.some((r) => r.me) : rows[0]?.me) out[k] = (out[k] ?? 0) + 1;
    }
  }
  return out;
}
