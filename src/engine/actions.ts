// 행동 실행과 결과 판정: 패스, 드리블 돌파, 태클, 슛, 크로스, 클리어링, 공중볼, 세이브

import { ENGINE } from './config';
import { event, looseBall, reaction, setOwner, setRestart } from './core';
import { aerialScore, aerialWin, dribbleProb } from './duel';
import { catchProb, claimProb, keeperOf, saveProb } from './keeper';
import { updateOffball } from './offball';
import { makePass, shotModel, type Candidate } from './onball';
import { attackDir, clamp, dist, inOppBox, L, oppGoal, W } from './pitch';
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
    case 'through': {
      a.stats.passes++;
      team.stats.passes++;
      launch(s, a, makePass(s, a, c));
      return;
    }
    case 'dribble':
      dribble(s, a, c);
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
      a.tx = c.x;
      a.ty = c.y;
      a.urgent = true;
      a.cooldown = Math.max(ENGINE.onball.carryTime, reaction(a));
      return;
    case 'hold':
    default:
      a.tx = a.x;
      a.ty = a.y;
      a.urgent = false;
      a.cooldown = reaction(a) + ENGINE.onball.holdTime;
  }
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
    const ang = r(s, def.idx, Purpose.Tackle, 4) * Math.PI * 2;
    looseBall(s, att.x, att.y, Math.cos(ang) * 4, Math.sin(ang) * 4, def.team, def.idx);
  }
  att.cooldown = 0.6;
}

/** 드리블 돌파 (E.8): 성공하면 수비수를 제치고 전진, 실패하면 태클 */
function dribble(s: SimState, a: Agent, c: Candidate): void {
  const def = s.agents[c.opponent!]!;
  a.stats.dribbles++;
  s.teams[a.team].stats.dribbles++;
  if (r(s, a.idx, Purpose.Dribble) < c.p) {
    a.stats.dribblesWon++;
    s.teams[a.team].stats.dribblesWon++;
    def.beatenUntil = s.t + PR.beatenTime;
    a.tx = c.x;
    a.ty = c.y;
    a.urgent = true;
    a.cooldown = Math.max(ENGINE.onball.carryTime, reaction(a));
    return;
  }
  tackleWon(s, a, def);
}

/** 수비수가 시도하는 태클 (E.8). 성공 = 1 − 드리블 성공. 실패하면 제쳐짐 (파울은 E3 referee) */
export function tryTackles(s: SimState, onFoul?: (att: Agent, def: Agent) => boolean): void {
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
    if (onFoul?.(o, d)) return;
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
  if (lp && lp.receiver === a.idx && lp.t >= s.possSince) s.agents[lp.passer]!.stats.keyPasses++;
  a.cooldown = 1;
  s.ball.lastTouch = a.idx;
  s.ball.lastTeam = a.team;

  // 블록
  if (r(s, a.idx, Purpose.Block) < m.pBlock) {
    const blocker = s.agents.filter((o) => o.onPitch && o.team !== a.team && o.line !== 0)
      .sort((x, y) => dist(x.x, x.y, a.x, a.y) - dist(y.x, y.y, a.x, a.y))[0];
    event(s, 'block', a.team, [a.id, blocker?.id ?? '']);
    const defTeam = (1 - a.team) as 0 | 1;
    if (r(s, a.idx, Purpose.Block, 1) < PR.blockCorner) {
      s.teams[a.team].stats.corners++;
      setRestart(s, 'corner', a.team, gx, a.y < W / 2 ? 0 : W, ENGINE.restart.cornerDelay);
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
    const skill = header ? a.attrs.heading : a.attrs.shooting;
    const corner = clamp(r(s, a.idx, Purpose.Shot, 3) * (0.6 + (0.6 * skill) / 100), 0, 1);
    const ty = gy + side * corner * (G / 2 - 0.3);
    s.ball.owner = -1;
    s.ball.flight = {
      kind: 'shot', fromX: a.x, fromY: a.y, toX: gx, toY: ty, t0: s.t, dur: Math.max(0.15, m.d / speed), air: header,
      passer: a.idx, receiver: -1, outcome: 'shot', interceptor: -1, shot: { speed, corner, d: m.d, header },
    };
    event(s, 'shot', a.team, [a.id], { onTarget: 1, xg: Math.round(m.xg * 100) / 100 });
    return;
  }
  // 빗나감: 골라인 밖으로 → 골킥
  const missY = gy + side * (G / 2 + 0.5 + r(s, a.idx, Purpose.Shot, 4) * 6);
  s.ball.owner = -1;
  s.ball.flight = {
    kind: 'shot', fromX: a.x, fromY: a.y, toX: gx + dir * 3, toY: missY, t0: s.t, dur: Math.max(0.15, (m.d + 3) / speed), air: true,
    passer: a.idx, receiver: -1, outcome: 'loose', interceptor: -1,
  };
  event(s, 'shot', a.team, [a.id], { onTarget: 0, xg: Math.round(m.xg * 100) / 100 });
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
      setRestart(s, 'corner', shooter.team, dir > 0 ? L : 0, s.ball.y < W / 2 ? 0 : W, ENGINE.restart.cornerDelay);
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
  setRestart(s, 'kickoff', (1 - scorer.team) as 0 | 1, L / 2, W / 2, ENGINE.restart.goalDelay);
}

// ── 크로스, 롱볼, 공중볼 ──

function cross(s: SimState, a: Agent, c: Candidate): void {
  const t = s.teams[a.team];
  a.stats.passes++;
  t.stats.passes++;
  t.stats.crosses++;
  const [, nd] = nearestOppOf(s, a);
  if (nd < 2.5 && r(s, a.idx, Purpose.Cross, 2) < PR.crossBlockCorner) {
    t.stats.corners++;
    const dir = attackDir(a.team, s.half);
    setRestart(s, 'corner', a.team, dir > 0 ? L : 0, a.y < W / 2 ? 0 : W, ENGINE.restart.cornerDelay);
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

export function longBall(s: SimState, a: Agent, x: number, y: number, kind: 'clear' | 'long'): void {
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
    looseBall(s, b.x, b.y, (fl.toX - fl.fromX) * 0.05, (fl.toY - fl.fromY) * 0.05, att, passer.idx);
    return;
  }
  let winner: Agent;
  if (bestA && bestD) {
    s.teams[0].stats.aerials++;
    s.teams[1].stats.aerials++;
    winner = r(s, bestA.idx, Purpose.Aerial) < aerialWin(bestA, bestD) ? bestA : bestD;
    winner.stats.aerialsWon++;
  } else winner = (bestA ?? bestD)!;

  if (winner.team === att) {
    if (fl.fromCross) {
      s.teams[att].stats.crossesCompleted++;
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
    setRestart(s, 'corner', att, dirAtt > 0 ? L : 0, b.y < W / 2 ? 0 : W, ENGINE.restart.cornerDelay);
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
  const ang = (r(s, winner.idx, Purpose.Header, 3) - 0.5) * 1.6;
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
            if (r(s, rc.idx, Purpose.Aerial, 1) >= aerialWin(rc, def)) {
              def.stats.aerialsWon++;
              setOwner(s, def);
              return;
            }
            rc.stats.aerialsWon++;
          }
        }
        setOwner(s, rc);
        rc.x = b.x;
        rc.y = b.y;
        passer.stats.passesCompleted++;
        s.teams[passer.team].stats.passesCompleted++;
        s.lastPass = { passer: passer.idx, receiver: rc.idx, t: s.t };
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
  // 루즈볼: 진행 방향으로 굴러간다
  const dx = fl.toX - fl.fromX;
  const dy = fl.toY - fl.fromY;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const sp = fl.air ? 2 : 4;
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
