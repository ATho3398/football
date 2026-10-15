// 행동 실행과 결과 판정: 패스, 드리블 돌파, 태클, 슛, 크로스, 클리어링, 공중볼, 세이브

import { ENGINE } from './config';
import { event, looseBall, reaction, setOwner, setRestart } from './core';
import { aerialScore, aerialWin, dribbleProb } from './duel';
import { catchProb, claimProb, keeperOf, saveProb } from './keeper';
import { updateOffball } from './offball';
import { carryReachDist, crossTarget, finishMult, leadTempoMul, makePass, receivesBack, shotModel, type Candidate } from './onball';
import { callOffside, foul, foulFactor, isOffside } from './referee';
import { attackDir, clamp, dist, inOppBox, L, oppGoal, segDist, W } from './pitch';
import { Purpose, rand, randn } from './rng';
import type { Agent, Flight, SimState } from './state';

const PR = ENGINE.prob;
const K = ENGINE.keeper;
const G = ENGINE.pitch.goalWidth;

function r(s: SimState, a: number, p: number, k = 0): number {
  return rand(s.seed, s.tick, a, p, k);
}

function launch(s: SimState, a: Agent, fl: Flight): void {
  const b = s.ball;
  b.owner = -1;
  b.flight = fl;
  b.lastTouch = a.idx;
  b.lastTeam = a.team;
  const who = fl.outcome === 'receive' ? fl.receiver : fl.outcome === 'intercept' ? fl.interceptor : -1;
  if (who >= 0) updateOffball(s, s.agents[who]!);
  a.cooldown = reaction(a);
}

export function execute(s: SimState, a: Agent, c: Candidate): void {
  const team = s.teams[a.team];
  switch (c.type) {
    case 'pass':
    case 'through':
    case 'cutback':
    case 'layoff': {
      a.stats.passes++;
      team.stats.passes++;
      if (c.type === 'cutback') team.stats.cutbacks++;
      if (c.type === 'layoff') team.stats.layoffs++;
      if (dist(a.x, a.y, c.x, c.y) >= 30) {
        team.stats.longPasses++;
        team.stats.longPSum += c.p;
      }
      if (c.type === 'through') team.stats.throughPasses++;
      const fl = makePass(s, a, c);
      const receiver = s.agents[c.receiver]!;
      const offside = fl.outcome === 'receive' && isOffside(s, a, receiver);
      s.exemptPass = false;
      if (offside) {
        callOffside(s, a, receiver);
        return;
      }
      launch(s, a, fl);
      return;
    }
    case 'dribble':
      dribble(s, a, c);
      return;
    case 'holdup':
      holdup(s, a, c);
      return;
    case 'shoot':
      shoot(s, a, false);
      return;
    case 'cross':
      cross(s, a, c);
      return;
    case 'clear':
      longBall(s, a, c.x, c.y, 'clear');
      return;
    case 'carry':
      if (pressureLoss(s, a, c)) return;
      a.tx = c.x;
      a.ty = c.y;
      a.urgent = true;
      a.cooldown = Math.max(ENGINE.onball.carryTime, reaction(a));
      return;
    case 'hold':
    default:
      if (pressureLoss(s, a, c)) return;
      a.tx = a.x;
      a.ty = a.y;
      a.urgent = false;
      // 템포 (E.18 A5): 점유형일수록 유지 간격이 길다
      a.cooldown = (reaction(a) + ENGINE.onball.holdTime) * (ENGINE.tactics.possBase + ENGINE.tactics.possSlope * s.teams[a.team].tactics.style) * leadTempoMul(s, a.team);
  }
}

/**
 * 몰고 가기/유지의 실패 판정: 판단에 쓴 성공 확률 P 그대로 (E.18 A1, P 는 실제 판정과 같아야 한다).
 * 실패하면 가장 가까운 압박 수비수가 태클로 빼앗는다
 */
function pressureLoss(s: SimState, a: Agent, c: Candidate): boolean {
  if (c.p >= 1 || a.line === 0) return false;
  if (r(s, a.idx, Purpose.Tackle, 7) < c.p) return false;
  let def: Agent | null = null;
  let bd: number = ENGINE.prob.pressureDist;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || s.t < o.beatenUntil) continue;
    // 판단 P 와 같은 범위 (GK 포함). 몰고 가기는 가는 길에 가장 먼저 닿는 수비수(실효 거리), 유지는 지금 위치에서 가장 가까운 수비수
    const d = c.type === 'carry' ? carryReachDist(s, o, a, c.x, c.y) : dist(o.x, o.y, a.x, a.y);
    if (d < bd) {
      bd = d;
      def = o;
    }
  }
  if (!def) return false;
  tackleWon(s, a, def);
  return true;
}

/** 태클에 이긴 수비수: 공을 갖거나 (tackleKeep) 루즈볼 */
function tackleWon(s: SimState, att: Agent, def: Agent): void {
  def.stats.tackles++;
  def.stats.tacklesWon++;
  s.teams[def.team].stats.tackles++;
  s.teams[def.team].stats.tacklesWon++;
  if (r(s, def.idx, Purpose.Tackle, 3) < PR.tackleKeep) {
    setOwner(s, def);
  } else {
    // 태클로 튄 공 (E.18 A4): 무작위 방향, 속도 6~12 m/s
    const ang = r(s, def.idx, Purpose.Tackle, 4) * Math.PI * 2;
    const [lo, hi] = ENGINE.restart.tackleBounce;
    const sp = lo + (hi - lo) * r(s, def.idx, Purpose.Tackle, 5);
    looseBall(s, att.x, att.y, Math.cos(ang) * sp, Math.sin(ang) * sp, def.team, def.idx);
  }
  att.cooldown = 0.6;
}

/** 드리블 돌파 (E.8): 성공하면 수비수를 제치고 전진, 실패하면 태클 */
function dribble(s: SimState, a: Agent, c: Candidate): void {
  const def = s.agents[c.opponent!]!;
  a.stats.dribbles++;
  s.teams[a.team].stats.dribbles++;
  def.stats.dribblesFaced++;
  if (r(s, a.idx, Purpose.Dribble) < c.p) {
    a.stats.dribblesWon++;
    def.stats.dribbledPast++;
    s.teams[a.team].stats.dribblesWon++;
    def.beatenUntil = s.t + PR.beatenTime;
    a.tx = c.x;
    a.ty = c.y;
    a.urgent = true;
    a.cooldown = Math.max(ENGINE.onball.carryTime, reaction(a));
    // 제쳐진 수비수의 파울 (태클 실패)
    if (r(s, def.idx, Purpose.Foul, 1) < ENGINE.referee.tackleFoul * foulFactor(s, a, a.x, a.y, def)) foul(s, def, a, a.x, a.y);
    return;
  }
  tackleWon(s, a, def);
}

/** 버티기 (E.18 A2): 성공하면 1초 동안 공을 지킨다 (수비수 도전 실패 → 파울 판정), 실패하면 태클 */
function holdup(s: SimState, a: Agent, c: Candidate): void {
  const def = s.agents[c.opponent!]!;
  s.teams[a.team].stats.holdups++;
  if (r(s, a.idx, Purpose.Dribble, 5) < c.p) {
    s.teams[a.team].stats.holdupsWon++;
    a.tx = a.x;
    a.ty = a.y;
    a.urgent = false;
    a.cooldown = ENGINE.onball.holdupTime;
    a.backToGoal = true;
    def.beatenUntil = s.t + ENGINE.onball.holdupTime * 0.5;
    if (r(s, def.idx, Purpose.Foul, 6) < ENGINE.referee.tackleFoul * foulFactor(s, a, a.x, a.y, def)) foul(s, def, a, a.x, a.y);
    return;
  }
  tackleWon(s, a, def);
}

/** 수비수가 시도하는 태클 (E.8). 성공 = 1 − 드리블 성공. 실패하면 제쳐짐 (파울은 E3 referee) */
export function tryTackles(s: SimState): void {
  const o = s.agents[s.ball.owner];
  if (!o || o.line === 0) return;
  for (const d of s.agents) {
    if (!d.onPitch || d.team === o.team || d.line === 0 || d.cooldown > 0 || s.t < d.beatenUntil) continue;
    if (dist(d.x, d.y, o.x, o.y) > PR.tackleRange) continue;
    const pressing = s.teams[d.team].tactics.pressing;
    const rate = PR.tackleRate * (0.5 + d.role.press) * (0.5 + d.attrs.workRate / 200) * (0.5 + pressing);
    if (r(s, d.idx, Purpose.Tackle) >= rate) continue;
    d.cooldown = PR.tackleCooldown;
    if (r(s, d.idx, Purpose.Tackle, 1) < 1 - dribbleProb(o, d)) {
      tackleWon(s, o, d);
      return;
    }
    d.stats.tackles++;
    s.teams[d.team].stats.tackles++;
    d.beatenUntil = s.t + PR.beatenTime;
    if (r(s, d.idx, Purpose.Foul) < ENGINE.referee.tackleFoul * foulFactor(s, o, o.x, o.y, d)) {
      foul(s, d, o, o.x, o.y);
      return;
    }
  }
}

// ── 슛 ──

export function shoot(s: SimState, a: Agent, header: boolean): void {
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const m = shotModel(s, a, header);
  const team = s.teams[a.team];
  a.stats.shots++;
  team.stats.shots++;
  const lp = s.lastPass;
  if (lp && lp.receiver === a.idx && lp.t >= s.possSince) {
    s.agents[lp.passer]!.stats.keyPasses++;
    team.stats.keyPasses++;
  }
  if (s.possOrigin === 'open' && s.t - s.possStartT < 10) team.stats.counterShots++;
  if (s.possOrigin === 'goalKick' && s.t - s.possStartT < 15) team.stats.goalKickShots++;
  if (Math.abs(a.y - W / 2) <= G / 2) team.stats.centralShots++;
  a.cooldown = 1;
  s.ball.lastTouch = a.idx;
  s.ball.lastTeam = a.team;
  s.lastWasShot = true;
  s.exemptPass = false;

  // 블록
  if (r(s, a.idx, Purpose.Block) < m.pBlock) {
    const blocker = s.agents.filter((o) => o.onPitch && o.team !== a.team && o.line !== 0)
      .sort((x, y) => dist(x.x, x.y, a.x, a.y) - dist(y.x, y.y, a.x, a.y))[0];
    event(s, 'block', a.team, [a.id, blocker?.id ?? '']);
    const defTeam = (1 - a.team) as 0 | 1;
    if (r(s, a.idx, Purpose.Block, 1) < PR.blockCorner) {
      s.teams[a.team].stats.corners++;
      setRestart(s, 'corner', a.team, gx, a.y < W / 2 ? 0 : W, 'auto');
      return;
    }
    const ang = r(s, a.idx, Purpose.Block, 2) * Math.PI * 2;
    looseBall(s, a.x + dir * 1.5, a.y, Math.cos(ang) * 6, Math.sin(ang) * 6, defTeam, blocker?.idx ?? -1);
    return;
  }

  const onTarget = r(s, a.idx, Purpose.Shot) < m.pOn;
  const side = r(s, a.idx, Purpose.Shot, 1) < 0.5 ? -1 : 1;
  const speed = m.speed * (0.9 + 0.2 * r(s, a.idx, Purpose.Shot, 2));
  if (onTarget) {
    team.stats.shotsOnTarget++;
    a.stats.shotsOnTarget++;
    // 구석일수록 막기 어렵다. 능력치가 높으면 구석으로
    // 구석은 능력치와 무관 (마무리 능력은 마무리 배수 한 곳에서, E.20 7번)
    const corner = clamp(r(s, a.idx, Purpose.Shot, 3) * PR.cornerRange, 0, 1);
    const ty = gy + side * corner * (G / 2 - 0.3);
    s.ball.owner = -1;
    s.ball.flight = {
      kind: 'shot', fromX: a.x, fromY: a.y, toX: gx, toY: ty, t0: s.t, dur: Math.max(0.15, m.d / speed), air: header,
      passer: a.idx, receiver: -1, outcome: 'shot', interceptor: -1, shot: { speed, corner, d: m.d, header },
    };
    event(s, 'shot', a.team, [a.id], { onTarget: 1, xg: Math.round(m.xg * 100) / 100, d: Math.round(m.d) });
    return;
  }
  // 빗나감: 골라인 밖으로 → 골킥
  const missY = gy + side * (G / 2 + 0.5 + r(s, a.idx, Purpose.Shot, 4) * 6);
  s.ball.owner = -1;
  s.ball.flight = {
    kind: 'shot', fromX: a.x, fromY: a.y, toX: gx + dir * 3, toY: missY, t0: s.t, dur: Math.max(0.15, (m.d + 3) / speed), air: true,
    passer: a.idx, receiver: -1, outcome: 'loose', interceptor: -1,
  };
  event(s, 'shot', a.team, [a.id], { onTarget: 0, xg: Math.round(m.xg * 100) / 100, d: Math.round(m.d) });
}

/** 유효 슈팅 도착: GK 세이브 판정 (E.9) */
function shotArrives(s: SimState, fl: Flight): void {
  const shooter = s.agents[fl.passer]!;
  const defTeam = (1 - shooter.team) as 0 | 1;
  const gk = keeperOf(s, defTeam);
  const sh = fl.shot!;
  const dir = attackDir(shooter.team, s.half);
  if (r(s, shooter.idx, Purpose.Save) < saveProb(gk, sh.speed, sh.corner, sh.d)) {
    s.teams[defTeam].stats.saves++;
    event(s, 'save', defTeam, [gk?.id ?? '', shooter.id]);
    if (gk && r(s, shooter.idx, Purpose.Save, 1) < catchProb(gk)) {
      gk.x = s.ball.x - dir * 0.5;
      gk.y = s.ball.y;
      setOwner(s, gk);
      gk.cooldown = K.holdTime;
      return;
    }
    // 쳐내기: 코너 또는 리바운드
    if (r(s, shooter.idx, Purpose.Save, 2) < K.parryCorner) {
      s.teams[shooter.team].stats.corners++;
      setRestart(s, 'corner', shooter.team, dir > 0 ? L : 0, s.ball.y < W / 2 ? 0 : W, 'auto');
      return;
    }
    const ang = (r(s, shooter.idx, Purpose.Save, 3) - 0.5) * 2.4;
    looseBall(s, s.ball.x - dir * 1, s.ball.y, -dir * Math.cos(ang) * 7, Math.sin(ang) * 7, defTeam, gk?.idx ?? -1);
    return;
  }
  goal(s, shooter);
}

function goal(s: SimState, scorer: Agent): void {
  const team = s.teams[scorer.team];
  team.stats.goals++;
  scorer.stats.goals++;
  const lp = s.lastPass;
  let assist: Agent | null = null;
  if (lp && lp.receiver === scorer.idx && lp.t >= s.possSince && s.t - lp.t < 15) {
    assist = s.agents[lp.passer]!;
    assist.stats.assists++;
  }
  event(s, 'goal', scorer.team, assist ? [scorer.id, assist.id] : [scorer.id], {
    home: s.teams[0].stats.goals, away: s.teams[1].stats.goals,
  });
  s.lastPass = null;
  for (const o of s.agents) if (o.onPitch && o.team !== scorer.team) o.rt.conceded++;
  setRestart(s, 'kickoff', (1 - scorer.team) as 0 | 1, L / 2, W / 2, 'auto');
}

// ── 크로스, 롱볼, 공중볼 ──

function cross(s: SimState, a: Agent, c: Candidate): void {
  const t = s.teams[a.team];
  a.stats.passes++;
  t.stats.passes++;
  t.stats.crosses++;
  a.stats.crosses++;
  const target = s.agents[c.receiver];
  const exempt = s.exemptPass;
  s.exemptPass = false;
  if (target && !exempt && isOffside(s, a, target)) {
    callOffside(s, a, target);
    return;
  }
  const [, nd] = nearestOppOf(s, a);
  if (nd < 2.5 && r(s, a.idx, Purpose.Cross, 2) < PR.crossBlockCorner) {
    t.stats.corners++;
    const dir = attackDir(a.team, s.half);
    setRestart(s, 'corner', a.team, dir > 0 ? L : 0, a.y < W / 2 ? 0 : W, 'auto');
    return;
  }
  const err = (100 - a.attrs.crossing) * PR.crossError;
  const tx = clamp(c.x + randn(s.seed, s.tick, a.idx, Purpose.Cross, 0) * err, 0.5, L - 0.5);
  const ty = clamp(c.y + randn(s.seed, s.tick, a.idx, Purpose.Cross, 1) * err, 0.5, W - 0.5);
  const d = dist(a.x, a.y, tx, ty);
  launch(s, a, {
    kind: 'cross', fromX: a.x, fromY: a.y, toX: tx, toY: ty, t0: s.t, dur: Math.max(0.4, d / ENGINE.ball.airSpeed), air: true,
    passer: a.idx, receiver: c.receiver, outcome: 'aerial', interceptor: -1, fromCross: true,
  });
}

export function longBall(s: SimState, a: Agent, x0: number, y0: number, kind: 'clear' | 'long'): void {
  s.exemptPass = false;
  let x = x0;
  let y = y0;
  if (kind === 'clear') {
    // 클리어링 방향 산포 σ (E.18 A4)
    const ang = randn(s.seed, s.tick, a.idx, Purpose.Clear, 2) * ((ENGINE.restart.clearSpreadDeg * Math.PI) / 180);
    const dx = x0 - a.x;
    const dy = y0 - a.y;
    x = a.x + dx * Math.cos(ang) - dy * Math.sin(ang);
    y = a.y + dx * Math.sin(ang) + dy * Math.cos(ang);
  }
  const err = (100 - a.attrs.longPassing) * 0.08 + 2;
  const tx = clamp(x + randn(s.seed, s.tick, a.idx, Purpose.Clear, 0) * err, -1, L + 1);
  const ty = clamp(y + randn(s.seed, s.tick, a.idx, Purpose.Clear, 1) * err, -1, W + 1);
  const d = dist(a.x, a.y, tx, ty);
  launch(s, a, {
    kind, fromX: a.x, fromY: a.y, toX: tx, toY: ty, t0: s.t, dur: Math.max(0.5, d / ENGINE.ball.airSpeed), air: true,
    passer: a.idx, receiver: -1, outcome: 'aerial', interceptor: -1,
  });
}

/** 착지점 공중볼 (E.8): GK 처리 → 양 팀 최고 점수 선수 경합 → 이긴 쪽 헤더/컨트롤/걷어내기 */
function resolveAerial(s: SimState, fl: Flight): void {
  const b = s.ball;
  const passer = s.agents[fl.passer]!;
  const att = passer.team;
  const def = (1 - att) as 0 | 1;
  const dirAtt = attackDir(att, s.half);
  const R = PR.aerialRadius;

  if (b.x < 0 || b.x > L || b.y < 0 || b.y > W) return; // 라인 밖: ballOut 이 처리

  const gk = keeperOf(s, def);
  if (gk && inOppBox(b.x, b.y, dirAtt) && dist(gk.x, gk.y, b.x, b.y) < K.claimRange) {
    if (r(s, gk.idx, Purpose.Keeper) < claimProb(gk)) {
      setOwner(s, gk);
      gk.cooldown = K.holdTime;
      return;
    }
  }
  let bestA: Agent | null = null;
  let bestD: Agent | null = null;
  for (const a of s.agents) {
    if (!a.onPitch || a.line === 0 || dist(a.x, a.y, b.x, b.y) > R) continue;
    if (a.team === att) {
      if (!bestA || aerialScore(a) > aerialScore(bestA)) bestA = a;
    } else if (!bestD || aerialScore(a) > aerialScore(bestD)) bestD = a;
  }
  if (!bestA && !bestD) {
    // 측면에서 튄 공은 바깥쪽으로 (E.18 A4)
    const out = Math.abs(b.y - W / 2) > W / 4 ? Math.sign(b.y - W / 2) * ENGINE.restart.wideBias : 0;
    looseBall(s, b.x, b.y, (fl.toX - fl.fromX) * 0.05, (fl.toY - fl.fromY) * 0.05 + out, att, passer.idx);
    return;
  }
  let winner: Agent;
  if (bestA && bestD) {
    s.teams[0].stats.aerials++;
    s.teams[1].stats.aerials++;
    bestA.stats.aerialDuels++;
    bestD.stats.aerialDuels++;
    if (r(s, bestA.idx, Purpose.Foul, 2) < ENGINE.referee.aerialFoul * foulFactor(s, bestA, b.x, b.y)) {
      // 공중볼 몸싸움 파울: 대부분 수비 쪽 파울
      const defFoul = r(s, bestA.idx, Purpose.Foul, 3) < 0.7;
      foul(s, defFoul ? bestD : bestA, defFoul ? bestA : bestD, b.x, b.y);
      return;
    }
    const pA = 1 / (1 + Math.exp(-((aerialScore(bestA) - aerialScore(bestD)) / PR.aerialScale + (fl.fromCross ? PR.aerialAttackBonus : 0) + bestA.duelEdge - bestD.duelEdge)));
    winner = r(s, bestA.idx, Purpose.Aerial) < pA ? bestA : bestD;
    winner.stats.aerialsWon++;
  } else winner = (bestA ?? bestD)!;

  if (winner.team === att) {
    if (fl.fromCross) {
      s.teams[att].stats.crossesCompleted++;
      passer.stats.crossesCompleted++;
      winner.stats.received++;
      passer.stats.passesCompleted++;
      s.teams[att].stats.passesCompleted++;
      s.lastPass = { passer: passer.idx, receiver: winner.idx, t: s.t };
    }
    const [gx, gy] = oppGoal(dirAtt);
    if (inOppBox(b.x, b.y, dirAtt) && dist(b.x, b.y, gx, gy) < PR.headerMaxDist) {
      winner.x = b.x;
      winner.y = b.y;
      shoot(s, winner, true);
      return;
    }
    winner.x = b.x;
    winner.y = b.y;
    setOwner(s, winner);
    return;
  }
  // 수비가 이김: 헤더 걷어내기 (가끔 코너)
  const dirDef = attackDir(def, s.half);
  if (fl.fromCross && r(s, winner.idx, Purpose.Header) < PR.clearCorner) {
    s.teams[att].stats.corners++;
    setRestart(s, 'corner', att, dirAtt > 0 ? L : 0, b.y < W / 2 ? 0 : W, 'auto');
    return;
  }
  if (!fl.fromCross && r(s, winner.idx, Purpose.Header, 2) < 0.4) {
    winner.x = b.x;
    winner.y = b.y;
    setOwner(s, winner);
    return;
  }
  const [lo, hi] = PR.clearDist;
  const len = lo + (hi - lo) * r(s, winner.idx, Purpose.Header, 1);
  // 걷어내기 방향 산포 σ (E.18 A4). 측면 경합이면 바깥쪽 편향
  const wideOut = Math.abs(b.y - W / 2) > W / 4 ? Math.sign(b.y - W / 2) * dirDef * 0.3 : 0;
  const ang = randn(s.seed, s.tick, winner.idx, Purpose.Header, 3) * ((ENGINE.restart.clearSpreadDeg * Math.PI) / 180) + wideOut;
  looseBall(s, b.x, b.y, 0, 0, def, winner.idx);
  s.ball.flight = {
    kind: 'clear', fromX: b.x, fromY: b.y, toX: b.x + dirDef * Math.cos(ang) * len, toY: clamp(b.y + Math.sin(ang) * len, -2, W + 2),
    t0: s.t, dur: len / 16, air: true, passer: winner.idx, receiver: -1, outcome: 'loose', interceptor: -1,
  };
}

/** 비행 중인 공 갱신과 도착 처리 */
export function resolveFlight(s: SimState): void {
  const b = s.ball;
  const fl = b.flight!;
  const k = clamp((s.t - fl.t0) / fl.dur, 0, 1);
  b.x = fl.fromX + (fl.toX - fl.fromX) * k;
  b.y = fl.fromY + (fl.toY - fl.fromY) * k;
  b.z = fl.air ? Math.sin(Math.PI * k) * (fl.kind === 'shot' ? 1.2 : 4) : 0;
  if (k < 1) return;
  b.flight = null;
  b.z = 0;
  const passer = s.agents[fl.passer]!;
  switch (fl.outcome) {
    case 'shot':
      shotArrives(s, fl);
      return;
    case 'aerial':
      resolveAerial(s, fl);
      return;
    case 'receive': {
      const rc = s.agents[fl.receiver]!;
      if (rc.onPitch && dist(rc.x, rc.y, b.x, b.y) < 4) {
        // 롱볼은 착지점에서 수비수와 경합
        if (fl.air) {
          const [def, dd] = nearestOppOf(s, rc);
          if (def && dd < PR.longContest) {
            s.teams[0].stats.aerials++;
            s.teams[1].stats.aerials++;
            rc.stats.aerialDuels++;
            def.stats.aerialDuels++;
            if (r(s, rc.idx, Purpose.Aerial, 1) >= aerialWin(rc, def)) {
              def.stats.aerialsWon++;
              setOwner(s, def);
              return;
            }
            rc.stats.aerialsWon++;
          }
        }
        setOwner(s, rc);
        // 등지고 받았는가 (몸 방향 = 공이 온 쪽): 공격 방향과 backAngle 이상이면 포스트플레이 후보 (E.18 A2)
        rc.backToGoal = receivesBack(fl.fromX, fl.fromY, b.x, b.y, attackDir(rc.team, s.half));
        if (fl.quick) rc.cooldown = reaction(rc);
        rc.x = b.x;
        rc.y = b.y;
        passer.stats.passesCompleted++;
        s.teams[passer.team].stats.passesCompleted++;
        rc.stats.received++;
        if (Math.hypot(fl.toX - fl.fromX, fl.toY - fl.fromY) >= 30) s.teams[rc.team].stats.longCompleted++;
        if (fl.through) {
          rc.stats.throughReceived++;
          s.teams[rc.team].stats.throughReceived++;
        }
        s.lastPass = { passer: passer.idx, receiver: rc.idx, t: s.t };
        if ((fl.toX - fl.fromX) * attackDir(passer.team, s.half) > 8) passer.rt.forward++;
        return;
      }
      break;
    }
    case 'intercept': {
      const rc = s.agents[fl.interceptor]!;
      if (rc.onPitch) {
        setOwner(s, rc);
        rc.x = b.x;
        rc.y = b.y;
        rc.stats.interceptions++;
        s.teams[rc.team].stats.interceptions++;
        return;
      }
      break;
    }
  }
  // 루즈볼: 진행 방향으로 굴러간다. 땅볼은 남은 속도 그대로, 공중볼은 튀면서 일부만 (E.18 A4 빗나간 패스)
  const dx = fl.toX - fl.fromX;
  const dy = fl.toY - fl.fromY;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const v0 = d / Math.max(0.1, fl.dur);
  const sp = fl.air ? Math.max(2, v0 * ENGINE.ball.airBounce) : Math.max(4, v0 - ENGINE.ball.groundDecel * fl.dur);
  b.vx = (dx / d) * sp;
  b.vy = (dy / d) * sp;
}

function nearestOppOf(s: SimState, a: Agent): [Agent | null, number] {
  let best: Agent | null = null;
  let bd = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || o.line === 0) continue;
    const d = dist(o.x, o.y, a.x, a.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return [best, bd];
}

// ── 세트피스 (E.10) ──

/** 코너: 박스 안 공중볼 최고 동료에게 크로스 (가끔 짧은 패스) */
export function takeCorner(s: SimState, a: Agent): boolean {
  if (rand(s.seed, s.tick, a.idx, Purpose.Corner) < ENGINE.setPiece.shortCorner) return false;
  const ct = crossTarget(s, a);
  if (!ct) return false;
  s.exemptPass = true;
  cross(s, a, { type: 'cross', p: 0.3, u: 0, x: ct.r.x, y: ct.r.y, receiver: ct.r.idx, value: ct.value });
  return true;
}

/** 직접 프리킥: 30 m 이내, 골문이 보이면 슛 (벽 블록 확률), 측면이면 크로스. 아니면 일반 판단 */
export function takeFreeKick(s: SimState, a: Agent, indirect: boolean): boolean {
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const d = dist(a.x, a.y, gx, gy);
  const central = Math.abs(a.y - gy) < 15;
  if (!indirect && d <= ENGINE.setPiece.directMax && central && r(s, a.idx, Purpose.FreeKick, 9) < ENGINE.setPiece.directChance) {
    const t = s.teams[a.team];
    a.stats.shots++;
    t.stats.shots++;
    s.lastWasShot = true;
    event(s, 'freeKick', a.team, [a.id], { direct: 1 });
    if (r(s, a.idx, Purpose.FreeKick) < ENGINE.setPiece.wallBlock) {
      event(s, 'block', a.team, [a.id]);
      const ang = r(s, a.idx, Purpose.FreeKick, 1) * Math.PI * 2;
      looseBall(s, a.x + dir * 9, a.y, Math.cos(ang) * 6, Math.sin(ang) * 6, (1 - a.team) as 0 | 1);
      return true;
    }
    const pOn = Math.min(PR.shotCap, clamp(PR.shotBase - PR.shotPerM * d, PR.shotMin, PR.shotMax) * ENGINE.setPiece.directAccuracy * finishMult(a.attrs, 'freeKick'));
    const speed = ENGINE.ball.shotSpeed;
    const side = r(s, a.idx, Purpose.FreeKick, 2) < 0.5 ? -1 : 1;
    if (r(s, a.idx, Purpose.FreeKick, 3) < pOn) {
      t.stats.shotsOnTarget++;
      a.stats.shotsOnTarget++;
      const corner = clamp(r(s, a.idx, Purpose.FreeKick, 4) * PR.cornerRange, 0, 1);
      s.ball.owner = -1;
      s.ball.flight = {
        kind: 'shot', fromX: a.x, fromY: a.y, toX: gx, toY: gy + side * corner * (G / 2 - 0.3), t0: s.t, dur: d / speed, air: true,
        passer: a.idx, receiver: -1, outcome: 'shot', interceptor: -1, shot: { speed, corner, d, header: false },
      };
    } else {
      s.ball.owner = -1;
      s.ball.flight = {
        kind: 'shot', fromX: a.x, fromY: a.y, toX: gx + dir * 3, toY: gy + side * (G / 2 + 1 + r(s, a.idx, Purpose.FreeKick, 5) * 4),
        t0: s.t, dur: (d + 3) / speed, air: true, passer: a.idx, receiver: -1, outcome: 'loose', interceptor: -1,
      };
    }
    return true;
  }
  // 측면 프리킥: 크로스
  const [nx] = [dir > 0 ? a.x / L : 1 - a.x / L];
  if (nx > 0.65 && d < 40) {
    const ct = crossTarget(s, a);
    if (ct) {
      cross(s, a, { type: 'cross', p: 0.3, u: 0, x: ct.r.x, y: ct.r.y, receiver: ct.r.idx, value: ct.value });
      return true;
    }
  }
  return false;
}

/** PK (E.10): 키커의 슈팅과 침착성, GK 선방 */
export function takePenalty(s: SimState, a: Agent): void {
  const SP = ENGINE.setPiece;
  const def = (1 - a.team) as 0 | 1;
  const gk = keeperOf(s, def);
  const kick = (a.attrs.shooting + a.attrs.composure) / 2;
  const p = clamp(SP.penaltyBase + (SP.penaltySkill * (kick - 75)) / 100 - (SP.penaltyKeeper * ((gk?.gk?.attrs.shotStopping ?? 20) - 70)) / 100, 0.4, 0.95);
  const t = s.teams[a.team];
  a.stats.shots++;
  t.stats.shots++;
  s.lastWasShot = true;
  event(s, 'penalty', a.team, [a.id]);
  const dir = attackDir(a.team, s.half);
  if (r(s, a.idx, Purpose.Penalty) < p) {
    t.stats.shotsOnTarget++;
    a.stats.shotsOnTarget++;
    s.lastPass = null;
    goal(s, a);
    return;
  }
  if (r(s, a.idx, Purpose.Penalty, 1) < SP.penaltySaveShare) {
    t.stats.shotsOnTarget++;
    a.stats.shotsOnTarget++;
    s.teams[def].stats.saves++;
    event(s, 'save', def, [gk?.id ?? '', a.id]);
    const ang = (r(s, a.idx, Purpose.Penalty, 2) - 0.5) * 2;
    looseBall(s, a.x + dir * 9, a.y, -dir * Math.cos(ang) * 6, Math.sin(ang) * 6, def, gk?.idx ?? -1);
    return;
  }
  setRestart(s, 'goalKick', def, dir > 0 ? L - 5.5 : 5.5, W / 2, 'auto');
}
