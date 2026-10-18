// 라이벌 (20.5, 부록 C.63): 시즌 시작 때 리그 안 다른 팀에서 같은 포지션군 · 나이 ±3 · 위상이 비슷한 NPC 1명 (C.64: OVR 대신 NPC 위상 = worldStats.npcStanding).
// 지표 = 시즌 골+도움, 평균 평점 (NPC 기록이 없으면 OVR 로 추정). 시즌 끝 비교 → 위상·신뢰도·인박스 기사 톤.
// 교체: 리그를 떠남(이적·은퇴) 또는 위상 차이가 world.rivalMaxGap 을 넘을 때. 수치는 BALANCE.events.rival · BALANCE.world

import { BALANCE } from './config/balance';
import { teamById } from './league';
import { proficientOvr } from './proficiency';
import { posGroup, slotOvr, type RosterPlayer } from './roster';
import { createRng, hashSeed } from './rng';
import { pushInbox } from './inbox';
import { addTrust } from './manager';
import { fill, pickText } from './text';
import type { GameState } from './game';
import type { Position } from './types';
import { npcStanding } from './worldStats';

const R = () => BALANCE.events.rival;

export interface RivalState {
  id: string;
  /** 처음 라이벌이 된 시즌 */
  since: number;
  /** 지난 시즌 비교 [시즌, 내 골+도움, 그 골+도움, 내 평점, 그 평점, 결과 1 이김 / 0 / −1] */
  history: [number, number, number, number, number, number][];
}

export interface RivalView { id: string; name: string; team: string; teamId: string; age: number; pos: string; ovr: number; rep: number; myRep: number; apps: number; ga: number; avg: number; est: boolean; me: { ga: number; avg: number } }

/** 리그 팀 로스터에서 그 선수 */
function findInLeague(state: GameState, id: string): { p: RosterPlayer; teamId: string } | null {
  for (const t of state.league.teams) {
    const p = state.rosters?.[t.id]?.players.find((x) => x.id === id);
    if (p) return { p, teamId: t.id };
  }
  return null;
}

const ovrOf = (p: RosterPlayer) => slotOvr(p, p.position);
const repOf = (state: GameState, p: RosterPlayer) => npcStanding(state, p.id, ovrOf(p));

/** 라이벌 후보 고르기: 다른 리그 팀 · 같은 포지션군 · 나이 ±ageGap · 위상 가까운 순 상위 3 중 시드로 하나 */
export function pickRival(state: GameState): RosterPlayer | null {
  const me = state.player;
  const my = me.reputation;
  const myOvr = proficientOvr(me, me.position);
  const scale = BALANCE.world.rivalRepScale;
  const g = posGroup(me.position as Position);
  const cands: { p: RosterPlayer; d: number }[] = [];
  for (const t of state.league.teams) {
    if (t.id === me.teamId) continue;
    for (const p of state.rosters?.[t.id]?.players ?? []) {
      if (p.gk || p.position === 'GK' || posGroup(p.position) !== g || Math.abs(p.age - me.age) > R().ageGap) continue;
      // 실력(OVR 차 rivalOvrGap 이내)이 비슷한 선수 중 위상이 가까운 순 (위상만 보면 초반 위상이 낮은 고OVR 선수에게 약한 라이벌이 붙는다)
      const dOvr = Math.abs(ovrOf(p) - myOvr);
      if (dOvr > BALANCE.world.rivalOvrGap) continue;
      cands.push({ p, d: Math.abs(repOf(state, p) - my) / scale + dOvr + Math.abs(p.age - me.age) * 0.5 });
    }
  }
  if (!cands.length) return null;
  cands.sort((a, b) => a.d - b.d || (a.p.id < b.p.id ? -1 : 1));
  const top = cands.slice(0, 3);
  const r = createRng(hashSeed(`${state.worldSeed}:rival:${state.league.season}`))();
  return top[Math.min(top.length - 1, Math.floor(r * top.length))]!.p;
}

/** 시즌 시작: 라이벌이 없거나, 리그를 떠났거나, 격차가 크면 새로 정한다. 새로 정했으면 그 선수 */
export function rivalSeasonStart(state: GameState): RosterPlayer | null {
  const cur = state.rival ? findInLeague(state, state.rival.id) : null;
  const keep = cur && cur.teamId !== state.player.teamId && Math.abs(repOf(state, cur.p) - state.player.reputation) <= BALANCE.world.rivalMaxGap
    && Math.abs(ovrOf(cur.p) - proficientOvr(state.player, state.player.position)) <= BALANCE.world.rivalOvrGap;
  if (keep) return null;
  const p = pickRival(state);
  state.rival = p ? { id: p.id, since: state.league.season, history: state.rival?.history ?? [] } : null;
  return p;
}

/** 지금 라이벌 정보 (없으면 null) */
export function rivalOf(state: GameState): RivalView | null {
  if (!state.rival) return null;
  const f = findInLeague(state, state.rival.id);
  if (!f) return null;
  const { p, teamId } = f;
  const st = state.playerStats?.[p.id];
  const me = state.player.season;
  const myView = { ga: me.goals + me.assists, avg: me.apps ? Math.round((me.ratingSum / me.apps) * 100) / 100 : 0 };
  const ovr = ovrOf(p);
  const rep = npcStanding(state, p.id, ovr);
  const myRep = state.player.reputation;
  if (st && st[0] > 0) {
    return { id: p.id, name: p.nameKo, team: teamById(state.league, teamId)?.nameKo ?? teamId, teamId, age: p.age, pos: p.position, ovr, rep, myRep, apps: st[0], ga: st[1] + st[2], avg: Math.round((st[3] / 10 / st[0]) * 100) / 100, est: false, me: myView };
  }
  // 추정 (20.5 "NPC는 추정값"): 팀 경기 수 × 출전 비율, 포지션군별 경기당 골+도움 × OVR 배율, 평점 6.4 + (OVR − 70) × 0.03
  const games = state.league.round;
  const apps = Math.round(games * R().estApps);
  const rate: number = (R().estGa as Record<string, number>)[posGroup(p.position)] ?? 0.2;
  const ga = Math.round(apps * rate * Math.max(0.3, 1 + (ovr - 75) * 0.04));
  const avg = apps ? Math.round((6.4 + (ovr - 70) * 0.03) * 100) / 100 : 0;
  return { id: p.id, name: p.nameKo, team: teamById(state.league, teamId)?.nameKo ?? teamId, teamId, age: p.age, pos: p.position, ovr, rep, myRep, apps, ga, avg, est: true, me: myView };
}

/** 내 골+도움 − 라이벌 골+도움 (라이벌 없으면 null) */
export function rivalGap(state: GameState): number | null {
  const r = rivalOf(state);
  return r ? r.me.ga - r.ga : null;
}

/** 시즌 끝 비교 점수: 골+도움 차 + 평균 평점 차 × avgWeight. 1 이김 / 0 비김(±1 이내) / −1 짐 */
export function rivalVerdict(r: RivalView): number {
  const score = (r.me.ga - r.ga) + (r.me.avg - r.avg) * R().avgWeight;
  return score > 1 ? 1 : score < -1 ? -1 : 0;
}

/** 시즌 끝 (endSeason): 라이벌과 비교 → 위상·신뢰도, 인박스 기사 (톤 = 결과) */
export function rivalSeasonEnd(state: GameState): void {
  const r = rivalOf(state);
  if (!r || !state.rival) return;
  const X = R();
  const v = rivalVerdict(r);
  state.rival.history.push([state.league.season, r.me.ga, r.ga, r.me.avg, r.avg, v]);
  if (state.rival.history.length > 10) state.rival.history.shift();
  const rep = v > 0 ? X.winRep : v < 0 ? X.loseRep : 0;
  if (rep) state.player.reputation = Math.max(0, state.player.reputation + rep);
  const trust = v > 0 ? X.winTrust : v < 0 ? X.loseTrust : 0;
  if (trust) addTrust(state, trust, `라이벌 ${r.name}${v > 0 ? '에게 이김' : '에게 짐'}`, { scaled: false });
  const vars = { name: state.player.name, rival: r.name, rivalTeam: r.team, me: r.me.ga, them: r.ga, myAvg: r.me.avg.toFixed(2), theirAvg: r.avg.toFixed(2) };
  const rng = createRng(hashSeed(`${state.worldSeed}:rival-end:${state.league.season}`))();
  const lines = v > 0
    ? ['올 시즌 라이벌 {rival}({rivalTeam})에게 이겼어요. 골+도움 {me} 대 {them}, 평점 {myAvg} 대 {theirAvg}.', '"{rival}보다 {name}." 시즌 결산 기사가 {name}의 손을 들어 줬어요. 골+도움 {me} 대 {them}.', '라이벌 경쟁 승리. {rival}{과/와}의 비교에서 앞섰어요 ({me} 대 {them}).']
    : v < 0
      ? ['올 시즌은 라이벌 {rival}({rivalTeam})의 승리예요. 골+도움 {me} 대 {them}, 평점 {myAvg} 대 {theirAvg}.', '"{rival}, 같은 나이대 최고." 결산 기사는 {rival} 쪽이었어요. {me} 대 {them}.', '라이벌에게 밀렸어요. 다음 시즌에 되갚아요 ({me} 대 {them}).']
      : ['라이벌 {rival}{과/와} 팽팽했어요. 골+도움 {me} 대 {them}, 평점 {myAvg} 대 {theirAvg}.', '{rival}{과/와}의 경쟁은 무승부. 다음 시즌이 진짜 승부예요.', '비슷한 시즌이었어요. 기자들은 "둘 다 성장했다"고 썼어요.'];
  const tail = [rep ? `위상 ${rep > 0 ? '+' : '−'}${Math.abs(rep)}` : '', trust ? `감독 신뢰도 ${trust > 0 ? '+' : '−'}${Math.abs(trust)}` : ''].filter(Boolean).join(' · ');
  pushInbox(state, {
    cat: 'rival', key: `rival-end:${state.league.season}`,
    title: v > 0 ? `라이벌 경쟁 승리 · ${r.name}` : v < 0 ? `라이벌 경쟁 패배 · ${r.name}` : `라이벌 경쟁 무승부 · ${r.name}`,
    body: fill(pickText(lines, rng), vars) + (tail ? ` (${tail}${r.est ? ' · 라이벌 기록은 추정' : ''})` : r.est ? ' (라이벌 기록은 추정)' : ''),
  });
}

/** 새 라이벌 소개 (시즌 시작) */
export function rivalIntro(state: GameState, p: RosterPlayer): void {
  const r = rivalOf(state);
  if (!r) return;
  pushInbox(state, {
    cat: 'rival', key: `rival:${state.league.season}:${p.id}`,
    title: `올 시즌 라이벌 · ${r.name}`,
    body: fill('{rivalTeam}의 {rival}({pos}, {age}세, 위상 {rep}){이/가} 라이벌로 지목됐어요. 시즌 골+도움과 평균 평점으로 겨뤄요.', { rivalTeam: r.team, rival: r.name, pos: r.pos, age: r.age, rep: r.rep }),
  });
}

/** 같은 포지션 영입 감지 (하루 끝): 내 팀으로 온 같은 포지션군 · OVR ≥ 내 OVR − 3 선수 → 이벤트 플래그 */
export function detectCompetitor(state: GameState, flags: Record<string, number>, seen: number): number {
  const list = state.transfers ?? [];
  const me = state.player;
  const my = proficientOvr(me, me.position);
  const g = posGroup(me.position as Position);
  for (let i = seen; i < list.length; i++) {
    const t = list[i]!;
    if (t.to === me.teamId && t.pos !== 'GK' && posGroup(t.pos) === g && t.ovr >= my - R().competitorGap) flags.competitor = (flags.competitor ?? 0) + 1;
  }
  return list.length;
}
