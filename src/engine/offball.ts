// 오프더볼 움직임 (E.6): 공격 시 슬롯 + 지원 + 침투(오프사이드 라인 인지), 수비 시 마킹 + 라인 동기화 + 압박

import { ENGINE } from './config';
import { ballNorm, manDiff, slotTarget, teamPhase } from './formation';
import { attackDir, clamp, dist, L, ownGoal, positionValue, toNorm, toPitch, W } from './pitch';
import { Purpose, rand, randn } from './rng';
import { TENDENCY } from './tactics';
import type { Agent, SimState } from './state';

const O = ENGINE.offball;
const F = ENGINE.formation;

/** 팀 전술 값 (수적 열세/우세 보정 포함, E.10) */
export function effectiveTactics(s: SimState, team: 0 | 1): { lineHeight: number; pressing: number } {
  const base = s.teams[team].tactics;
  const d = manDiff(s, team);
  const R = ENGINE.referee;
  if (d < 0) return { lineHeight: clamp(base.lineHeight - R.shortLine, 0, 1), pressing: clamp(base.pressing - R.shortPress, 0, 1) };
  if (d > 0) return { lineHeight: clamp(base.lineHeight + R.extraLine, 0, 1), pressing: clamp(base.pressing + R.extraPress, 0, 1) };
  return base;
}

/**
 * 팀의 오프사이드 라인 (그 팀 기준 정규화 x): 상대 뒤에서 두 번째 선수, 하프라인보다 뒤일 수 없다
 */
export function offsideLine(s: SimState, team: 0 | 1): number {
  const dir = attackDir(team, s.half);
  let first = 0;
  let second = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === team) continue;
    const nx = toNorm(o.x, o.y, dir)[0];
    if (nx > first) {
      second = first;
      first = nx;
    } else if (nx > second) second = nx;
  }
  return Math.max(0.5, second);
}

/** 상대 팀 수비 라인 x (자기 팀 기준 정규화). 수비수들이 같은 x 에 선다 */
function defensiveLine(s: SimState, team: 0 | 1): number {
  const t = effectiveTactics(s, team);
  const [bx] = ballNorm(s, team);
  const phase = teamPhase(s, team);
  let nx = F.lineBase + (t.lineHeight - 0.5) * F.lineRange + F.blockX * (bx - 0.5);
  if (phase < 0) nx += F.defendShift[1] * -phase;
  else nx += F.attackShift[1] * phase;
  if (phase < 0) nx = Math.min(nx, bx - F.lineBehindBall / L);
  return clamp(nx, F.lineMin, 0.7);
}

function setTarget(a: Agent, nx: number, ny: number, dir: 1 | -1, urgent: boolean): void {
  const [x, y] = toPitch(clamp(nx, 0.005, 0.995), clamp(ny, 0.01, 0.99), dir);
  a.tx = clamp(x + a.errY * O.jitter, 0.3, L - 0.3);
  a.ty = clamp(y + a.errX * O.jitter, 0.3, W - 0.3);
  a.urgent = urgent;
}

/** 공에 가까운 순위 (같은 팀, GK 제외, 0부터) */
function ballRank(s: SimState, a: Agent, bx: number, by: number): number {
  const d = dist(a.x, a.y, bx, by);
  let rank = 0;
  for (const o of s.agents) {
    if (o === a || !o.onPitch || o.team !== a.team || o.line === 0) continue;
    if (dist(o.x, o.y, bx, by) < d) rank++;
  }
  return rank;
}

/** 팀의 필드 선수 중 (x, y)에 가장 가까운 선수 */
function nearestTo(s: SimState, team: 0 | 1, x: number, y: number): Agent | null {
  let best: Agent | null = null;
  let bd = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== team || o.line === 0) continue;
    const d = dist(o.x, o.y, x, y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/** 루즈볼이면 공이 멈출 지점 근처를 예측 */
function ballChasePoint(s: SimState): [number, number] {
  const b = s.ball;
  if (b.flight) return [b.flight.toX, b.flight.toY];
  const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  if (sp < 0.5) return [b.x, b.y];
  const stop = (sp * sp) / (2 * ENGINE.ball.groundDecel);
  const k = Math.min(stop, 6) / sp;
  return [b.x + b.vx * k, b.y + b.vy * k];
}

export function keeperTarget(s: SimState, a: Agent): void {
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = ownGoal(dir);
  const [bx] = ballNorm(s, a.team);
  const sweeper = a.gk?.type === 'sweeper';
  const K = ENGINE.keeper;
  // 공이 멀수록 전진
  const far = clamp((bx - 0.2) / 0.6, 0, 1);
  const depth = sweeper ? K.sweeperMin + (K.sweeperMax - K.sweeperMin) * far : K.classicMin + (K.classicMax - K.classicMin) * far;
  a.tx = gx + dir * depth;
  a.ty = clamp(gy + (s.ball.y - gy) * K.lateral, gy - ENGINE.pitch.goalWidth / 2 - 1, gy + ENGINE.pitch.goalWidth / 2 + 1);
  a.urgent = false;
  // 각 좁히기: 상대 소유자가 박스 안 골 가까이 들어오면 공과 골 사이로 나간다
  const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
  if (owner && owner.team !== a.team && !s.restart) {
    const gd = dist(owner.x, owner.y, gx, gy);
    const inBox = Math.abs(owner.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(owner.y - gy) <= ENGINE.pitch.boxWidth / 2;
    if (inBox && gd < K.rushDist && gd > 0.1) {
      a.tx = owner.x + ((gx - owner.x) / gd) * K.rushGap;
      a.ty = owner.y + ((gy - owner.y) / gd) * K.rushGap;
      a.urgent = true;
    }
  }
}

/** 오프더볼 목표 갱신 */
export function updateOffball(s: SimState, a: Agent): void {
  a.minRun = false;
  const dir = attackDir(a.team, s.half);
  const b = s.ball;
  const fl = b.flight;

  // 패스를 받을/가로챌 선수는 도착점으로
  if (fl && (fl.outcome === 'receive' && fl.receiver === a.idx || fl.outcome === 'intercept' && fl.interceptor === a.idx)) {
    a.tx = fl.toX;
    a.ty = fl.toY;
    a.urgent = true;
    return;
  }
  // 크로스 공중볼 (E.22 B 헤더 경합): 대상 선수와 착지점에 가장 가까운 상대 필드 선수가 착지점으로 뛰어든다
  if (fl && fl.outcome === 'aerial' && fl.fromCross && a.line !== 0) {
    const passer = s.agents[fl.passer];
    if (fl.receiver === a.idx || (passer && a.team !== passer.team && nearestTo(s, a.team, fl.toX, fl.toY) === a)) {
      a.tx = clamp(fl.toX, 0.3, L - 0.3);
      a.ty = clamp(fl.toY, 0.3, W - 0.3);
      a.urgent = true;
      return;
    }
  }
  if (a.line === 0 && !s.restart) {
    keeperTarget(s, a);
    return;
  }

  // 리스타트 대기: 키커는 공으로, 나머지는 대형
  if (s.restart) {
    if (s.restart.taker === a.idx) {
      a.tx = s.restart.x;
      a.ty = s.restart.y;
      a.urgent = true;
      return;
    }
    if (a.line === 0) {
      keeperTarget(s, a);
      return;
    }
    if (setPieceTarget(s, a)) return;
    const [nx, ny] = slotTarget(s, a);
    // 프리킥/코너 등에서 공 근처 9 m 밖
    let [x, y] = toPitch(nx, ny, dir);
    if (s.restart.team !== a.team && dist(x, y, s.restart.x, s.restart.y) < 9.15) {
      const d = dist(x, y, s.restart.x, s.restart.y) || 1;
      x = s.restart.x + ((x - s.restart.x) / d) * 9.2;
      y = s.restart.y + ((y - s.restart.y) / d) * 9.2;
    }
    if (s.restart.type === 'kickoff') {
      // 킥오프: 자기 진영
      const own = toNorm(x, y, dir)[0];
      if (own > 0.48) [x, y] = toPitch(0.48, toNorm(x, y, dir)[1], dir);
    }
    a.tx = clamp(x, 0.5, L - 0.5);
    a.ty = clamp(y, 0.5, W - 0.5);
    a.urgent = false;
    return;
  }

  // 루즈볼: 팀별 가장 가까운 chasers 명이 쫓는다
  const loose = b.owner < 0 && (!fl || fl.outcome === 'loose');
  if (loose) {
    const [cx, cy] = ballChasePoint(s);
    if (ballRank(s, a, cx, cy) < ENGINE.ball.chasers) {
      a.tx = cx;
      a.ty = cy;
      a.urgent = true;
      return;
    }
  }

  // 직선(롱볼) 세컨드볼 (E.19): 우리 팀 롱볼이 떠 있으면 착지점에 가까운 2선 2명은 착지점 10~15 m 뒤로
  if (fl && (fl.kind === 'long' || fl.kind === 'clear') && s.agents[fl.passer]?.team === a.team && a.line === 2
    && s.teams[a.team].tactics.tendency === 'direct') {
    const mids = s.agents.filter((o) => o.onPitch && o.team === a.team && o.line === 2)
      .sort((x, y) => dist(x.x, x.y, fl.toX, fl.toY) - dist(y.x, y.y, fl.toX, fl.toY));
    const k = mids.indexOf(a);
    if (k >= 0 && k < 2) {
      const back = TENDENCY.directSecond[k]!;
      a.tx = clamp(fl.toX - dir * back, 1, L - 1);
      a.ty = clamp(fl.toY + (k === 0 ? -3 : 3), 1, W - 1);
      a.urgent = true;
      return;
    }
  }

  const attacking = s.possTeam === a.team;
  const [bnx, bny] = ballNorm(s, a.team);
  if (attacking) attackTarget(s, a, dir, bnx, bny);
  else defendTarget(s, a, dir, bnx, bny);
}

function attackTarget(s: SimState, a: Agent, dir: 1 | -1, bnx: number, bny: number): void {
  const shortHanded = manDiff(s, a.team) < 0;
  let [nx, ny] = slotTarget(s, a, shortHanded ? ENGINE.referee.shortAttackShift : 1);
  const line = offsideLine(s, a.team);
  const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
  let urgent = false;

  // 침투: 공격 위치선정 × run 비례 확률로 수비 라인 근처로 달린다
  if (s.t >= a.runUntil && a.line >= 2 && owner && owner.team === a.team) {
    const chance = a.role.run * (a.attrs.offTheBall / 100) * O.runChance * Math.max(0.3, 1 + (O.runPace * (a.attrs.pace - 70)) / 100);
    if (rand(s.seed, s.tick, a.idx, Purpose.Run) < chance) a.runUntil = s.t + O.runSeconds;
  }
  const running = s.t < a.runUntil;
  // 라인을 타는 정확도: 능력치가 낮을수록 라인보다 앞에 설 확률이 높다
  const sigma = ((100 - a.attrs.offTheBall) * O.offsideSigma) / L;
  if (running) {
    nx = line + a.errX * sigma * O.runLineError;
    const [px, py] = toPitch(nx, ny, dir);
    urgent = dist(px, py, a.x, a.y) > 3;
  } else if (a.line >= 2) {
    nx = Math.min(nx, line - 1 / L + a.errX * sigma);
  }
  // 공이 상대 최종 3분의 1 측면 (E.18 A2): 2선 늦은 침투(컷백 존), 세컨드 볼 담당, ST 니어/파 포스트
  const third = owner && owner.team === a.team && owner !== a && bnx >= O.lateRunFromX;
  const wide = third && Math.abs(bny - 0.5) >= O.lateRunWide;
  let job: ReturnType<typeof finalThirdJob> = null;
  // 측면 공이면 침투 중인 선수도 박스 안 역할 자리로 (E.22 B: 침투 중인 반대편 윙어가 자기 측면 라인에 머물러 박스 인원이 모자랐다)
  if (third && (!running || wide)) {
    const side = bny < 0.5 ? -1 : 1;
    job = finalThirdJob(s, a, owner);
    // 중앙이면 ST 는 그대로, 침투 미드는 공 반대편 박스 채널로 늦게 들어간다 (2선 박스 도착, E.15.1)
    if (!wide && (job === 'near' || job === 'far')) job = null;
    if (wide && job === 'halfSpace') job = null;
    if (job === 'cutback' && !wide) {
      nx = 1 - O.boxRunDepth / L;
      ny = 0.5 - side * O.boxRunSpread;
    } else if (job === 'cutback') {
      // 2선 늦은 침투 (E.22 B): 측면 공이면 페널티 지점 부근 박스 안으로 (컷백·크로스 모두 받는 자리)
      nx = 1 - O.lateRunDepth / L;
      ny = 0.5 + side * 0.04;
    } else if (job === 'edge') {
      nx = 1 - O.edgeZone / L;
      ny = 0.5 - side * 0.05;
    } else if (job === 'near' || job === 'far') {
      nx = 1 - O.postDepth / L;
      ny = 0.5 + (job === 'near' ? side : -side) * (O.postSpread / W);
    } else if (job === 'backPost') {
      nx = 1 - O.backPostDepth / L;
      ny = 0.5 - side * O.backPostSpread;
    } else if (job === 'halfSpace') {
      nx = 1 - O.halfSpaceDepth / L;
      ny = 0.5 + Math.sign(a.sy - 0.5) * O.halfSpaceSpread;
    }
    if (job) {
      nx = Math.min(nx, line - 0.5 / L);
      const [px, py] = toPitch(nx, ny, dir);
      urgent = dist(px, py, a.x, a.y) > 6;
    }
  }
  // 내려와서 받기 / 지원 간격 (티키타카는 지원 삼각형 간격이 좁다, E.19)
  const tiki = s.teams[a.team].tactics.tendency === 'tikitaka';
  // 빌드업 전술: 짧게일수록 지원 간격이 좁다 (E.19 ③)
  const sk = 1 + F.styleSupport * (0.5 - s.teams[a.team].tactics.style);
  const supMin = (tiki ? TENDENCY.tikiSupport[0] : O.supportMin) * sk;
  const supMax = (tiki ? TENDENCY.tikiSupport[1] : O.supportMax) * sk;
  if (owner && owner.team === a.team && owner !== a && !job) {
    const [ox, oy] = toNorm(owner.x, owner.y, dir);
    if (!running && a.role.drop > 0 && nx > ox) nx -= (a.role.drop * O.dropDist) / L * 0.5;
    const [px, py] = toPitch(nx, ny, dir);
    const d = dist(px, py, owner.x, owner.y);
    if (d < supMin && d > 0.1) {
      const k = supMin / d;
      const [qx, qy] = [owner.x + (px - owner.x) * k, owner.y + (py - owner.y) * k];
      [nx, ny] = toNorm(qx, qy, dir);
    } else if (d > supMax && a.line === 2 && !running) {
      // 지원 간격 (E.6): 중원 줄은 소유자에게서 supportMax 안에서 받을 자리를 잡는다
      const k = supMax / d;
      const [qx, qy] = [owner.x + (px - owner.x) * k, owner.y + (py - owner.y) * k];
      [nx, ny] = toNorm(qx, qy, dir);
    } else if (d > supMax + 15 && a.line >= 2) {
      // 너무 멀면 공 쪽으로 약간
      nx += (ox - nx) * 0.15;
      ny += (oy - ny) * 0.15;
    }
  }
  // 수적 우세 프리맨 (E.18 A6): 마크가 없는 선수 중 공에 가장 가까운 1명은 공 쪽 빈 공간으로 (효용 가산 없음)
  if (!running && owner && owner.team === a.team && owner !== a && a.line >= 1 && manDiff(s, a.team) > 0 && isFreeman(s, a, owner)) {
    const spot = freeSpot(s, a, owner);
    if (spot) [nx, ny] = toNorm(spot[0], spot[1], dir);
  }
  void bny;
  setTarget(a, nx, ny, dir, urgent);
}

function unmarked(s: SimState, a: Agent): boolean {
  for (const o of s.agents) if (o.onPitch && o.team !== a.team && dist(o.x, o.y, a.x, a.y) < ENGINE.referee.freeMark) return false;
  return true;
}

/** 마크가 없는 필드 선수 중 공에 가장 가까운 선수인가 */
function isFreeman(s: SimState, a: Agent, owner: Agent): boolean {
  if (!unmarked(s, a)) return false;
  const d = dist(a.x, a.y, owner.x, owner.y);
  for (const o of s.agents) {
    if (o === a || o === owner || !o.onPitch || o.team !== a.team || o.line === 0) continue;
    if (dist(o.x, o.y, owner.x, owner.y) < d && unmarked(s, o)) return false;
  }
  return true;
}

/** 소유자에게서 12~20 m, 가장 가까운 상대에게서 6 m 이상인 빈 곳 중 가장 여유 있는 곳 (공격 방향 앞쪽 우선) */
function freeSpot(s: SimState, a: Agent, owner: Agent): [number, number] | null {
  const R = ENGINE.referee;
  const dir = attackDir(a.team, s.half);
  let best: [number, number] | null = null;
  let bestScore = -Infinity;
  for (const r of [R.freeMin, (R.freeMin + R.freeMax) / 2, R.freeMax]) {
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      const x = owner.x + Math.cos(ang) * r;
      const y = owner.y + Math.sin(ang) * r;
      if (x < 2 || x > L - 2 || y < 2 || y > W - 2) continue;
      let near = Infinity;
      for (const o of s.agents) if (o.onPitch && o.team !== a.team) near = Math.min(near, dist(o.x, o.y, x, y));
      if (near < R.freeSpace) continue;
      const score = near + 0.15 * (x - owner.x) * dir - 0.05 * dist(x, y, a.x, a.y);
      if (score > bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
  }
  return best;
}

/**
 * 공이 상대 최종 3분의 1 측면일 때의 역할 (E.18 A2): 침투 성향(run ≥ 0.4) CM/CAM 중 공에 가장 가까운 1명은 컷백 존,
 * 다음 미드 1명은 박스 경계 바깥(세컨드 볼, 중거리), ST/CF 2명은 니어/파 포스트 (공에 가까운 쪽이 니어)
 */
function finalThirdJob(s: SimState, a: Agent, owner: Agent): 'cutback' | 'edge' | 'near' | 'far' | 'backPost' | 'halfSpace' | null {
  const mates = s.agents.filter((o) => o.onPitch && o.team === a.team && o !== owner);
  const bd = (o: Agent) => dist(o.x, o.y, s.ball.x, s.ball.y);
  // 윙어: 공이 반대쪽 측면이면 먼 포스트로, 공이 중앙이면 같은 쪽 하프스페이스로 파고든다
  if (a.pos === 'LW' || a.pos === 'RW' || a.pos === 'LM' || a.pos === 'RM') {
    const by = toNorm(s.ball.x, s.ball.y, attackDir(a.team, s.half))[1];
    if (Math.abs(by - 0.5) >= O.lateRunWide) return Math.sign(by - 0.5) !== Math.sign(a.sy - 0.5) ? 'backPost' : null;
    // 공이 중앙이면 공에서 먼 쪽 윙어는 먼 포스트로 파고들고, 가까운 쪽은 하프스페이스 (E.20, 박스 도착 인원)
    return Math.sign(a.sy - 0.5) !== Math.sign(by - 0.5) ? 'backPost' : 'halfSpace';
  }
  if (a.pos === 'ST' || a.pos === 'CF') {
    const sts = mates.filter((o) => o.pos === 'ST' || o.pos === 'CF');
    // 1톱이면 니어 포스트 (E.22 B: 크로스 순간 박스 안 인원)
    if (sts.length < 2) return 'near';
    return sts.sort((x, y) => bd(x) - bd(y))[0] === a ? 'near' : 'far';
  }
  if (a.pos !== 'CM' && a.pos !== 'CAM' && a.pos !== 'CDM') return null;
  // 침투 성향(run ≥ lateRunRun) CM/CAM 중 공에 가장 가까운 1명. 없으면 run 이 가장 높은 CM/CAM (누군가는 2선에서 도착한다, E.20)
  const mids = mates.filter((o) => o.pos === 'CM' || o.pos === 'CAM');
  const runners = mids.filter((o) => o.role.run >= O.lateRunRun).sort((x, y) => bd(x) - bd(y));
  const runner = runners[0] ?? mids.slice().sort((x, y) => y.role.run - x.role.run || bd(x) - bd(y))[0];
  if (runner === a) return 'cutback';
  const rest = mates.filter((o) => (o.pos === 'CM' || o.pos === 'CAM' || o.pos === 'CDM') && o !== runner).sort((x, y) => bd(x) - bd(y));
  return rest[0] === a ? 'edge' : null;
}

function defendTarget(s: SimState, a: Agent, dir: 1 | -1, bnx: number, bny: number): void {
  const t = effectiveTactics(s, a.team);
  const b = s.ball;
  const owner = b.owner >= 0 ? s.agents[b.owner]! : null;

  // 역압박 (E.18 A3): 가담 선수 중 가장 가까운 1명은 소유자, 나머지는 소유자와 가까운 동료 사이 패스 길을 최대 속도로
  const tm = s.teams[a.team];
  if (owner && owner.team !== a.team && s.t < tm.counterUntil) {
    const k = tm.counterPressers.indexOf(a.idx);
    if (k === 0) {
      a.tx = owner.x;
      a.ty = owner.y;
      a.urgent = true;
      return;
    }
    if (k > 0) {
      const mates = s.agents
        .filter((o) => o.onPitch && o.team === owner.team && o !== owner && o.line !== 0)
        .sort((x, y) => dist(x.x, x.y, owner.x, owner.y) - dist(y.x, y.y, owner.x, owner.y));
      const m = mates[k - 1];
      if (m) {
        a.tx = owner.x + (m.x - owner.x) * O.counterLane;
        a.ty = owner.y + (m.y - owner.y) * O.counterLane;
        a.urgent = true;
        return;
      }
    }
  }

  // 돌파 후 커버 (E.22 A): 동료가 제쳐졌으면 돌파한 선수의 골 쪽 진행 방향을 막는다
  if (owner && owner.team !== a.team && tm.coverAgent === a.idx && s.t < tm.coverUntil) {
    const [cgx, cgy] = ownGoal(dir);
    const cd = dist(owner.x, owner.y, cgx, cgy) || 1;
    a.tx = owner.x + ((cgx - owner.x) / cd) * O.coverAhead;
    a.ty = owner.y + ((cgy - owner.y) / cd) * O.coverAhead;
    a.urgent = true;
    return;
  }

  const [gx0, gy0] = ownGoal(dir);
  const boxZone = dist(b.x, b.y, gx0, gy0) < O.boxZone;
  // 압박: 공에 가까운 1~2명 (2번째는 압박 성향이 높을 때)
  if (owner && owner.team !== a.team) {
    const rank = ballRank(s, a, b.x, b.y);
    const pressDist = (O.pressDistBase + t.pressing * O.pressDistRange) * (a.line === 3 ? Math.max(0.1, O.attackerPress + O.attackerPressPer * (t.pressing - 0.55)) : 1);
    const d = dist(a.x, a.y, b.x, b.y);
    const danger = dist(b.x, b.y, gx0, gy0) < O.dangerPress;
    let wants = rank === 0 || (rank === 1 && (danger || t.pressing * (0.5 + a.role.press) > 0.6));
    // 박스 안 압박 (E.23): 공이 우리 박스 안이면 가장 가까운 2명이 성향과 무관하게 바로 붙는다
    const ownBox = Math.abs(b.x - gx0) <= ENGINE.pitch.boxDepth && Math.abs(b.y - gy0) <= ENGINE.pitch.boxWidth / 2;
    if (ownBox && rank < 2) {
      const bd0 = dist(b.x, b.y, gx0, gy0) || 1;
      a.tx = b.x + ((gx0 - b.x) / bd0) * ENGINE.defense.boxPressGap;
      a.ty = b.y + ((gy0 - b.y) / bd0) * ENGINE.defense.boxPressGap;
      a.urgent = true;
      return;
    }
    // 수비 블록: 공격 줄은 1명만 압박 / 역습: 남는 최전방은 압박하지 않는다 (E.19)
    const tendency = s.teams[a.team].tactics.tendency;
    if (a.line === 3 && tendency === 'block' && closerForward(s, a, b.x, b.y)) wants = false;
    if (a.line === 3 && tendency === 'counter' && isTopForward(s, a)) wants = false;
    if (wants && (danger && rank < 2 || d < pressDist * (rank === 0 ? 1 : 0.6))) {
      // 공과 자기 골 사이에서 압박. 첫 압박 선수는 가장 위험한 전진 패스 대상을 등 뒤로 가리는 각도 (커버 섀도, E.22 A)
      const [gx, gy] = ownGoal(dir);
      const gd = dist(b.x, b.y, gx, gy) || 1;
      let ux = (gx - b.x) / gd;
      let uy = (gy - b.y) / gd;
      let gap = 1.0;
      // 패스길 막기를 고른 수비수 (E.23)도 커버 섀도 각도로
      const lane = rank === 0 || s.t < a.laneUntil ? shadowTarget(s, owner, dir) : null;
      if (lane) {
        const ld = dist(lane.x, lane.y, b.x, b.y) || 1;
        ux = ux * (1 - O.shadowW) + ((lane.x - b.x) / ld) * O.shadowW;
        uy = uy * (1 - O.shadowW) + ((lane.y - b.y) / ld) * O.shadowW;
        const un = Math.sqrt(ux * ux + uy * uy) || 1;
        ux /= un;
        uy /= un;
        gap = O.shadowGap;
      }
      a.tx = b.x + ux * gap;
      a.ty = b.y + uy * gap;
      a.urgent = true;
      return;
    }
  }

  // 박스 앞 수비 블록 (E.20 3번): 수비수는 ST 마크 1명과 박스 안 공간 덮기
  if (a.line === 1 && dist(b.x, b.y, gx0, gy0) < Math.max(O.boxZone, O.stMarkZone) && boxDefense(s, a, dir, boxZone)) return;

  let [nx, ny] = slotTarget(s, a);
  const tendency = s.teams[a.team].tactics.tendency;
  let lineX = defensiveLine(s, a.team);
  // 수비 블록 (E.19): 수비 라인은 박스 경계 앞으로 나가지 않고, 수비-중원 간격 12 m 이하
  if (tendency === 'block') lineX = Math.min(lineX, TENDENCY.blockLineMax / L);
  const midGap = tendency === 'block' ? Math.min(F.midGap, TENDENCY.blockGap / L) : F.midGap;
  if (a.line === 2) nx = Math.min(nx, lineX + midGap);
  else if (a.line === 3) nx = Math.min(nx, lineX + F.attGap);
  // 역습 (E.19): 최전방 1명은 하프라인 부근에 남는다
  if (tendency === 'counter' && a.line === 3 && isTopForward(s, a)) nx = Math.max(nx, TENDENCY.counterStayX);
  // CDM 스크린 (E.22 A): 공과 상대 최전방 사이 중앙 길목
  if (a.pos === 'CDM' && owner && owner.team !== a.team) {
    const spot = screenSpot(s, a, owner, dir, lineX);
    if (spot) {
      setTarget(a, spot[0], spot[1], dir, false);
      return;
    }
  }
  if (a.line === 1) {
    // 수비 라인 동기화. 오차는 수비 포지셔닝과 마킹
    const sigma = ((100 - (a.attrs.defensivePositioning + a.attrs.marking) / 2) * O.markSigma) / L;
    nx = lineX + a.errX * sigma;
  }

  // 마킹: 존 근처의 위협적인 상대. 수비 주의 집중 대상(E.20 8번)이 존 근처에 있으면 그 선수를 먼저, 더 가깝게
  const [zx, zy] = toPitch(nx, ny, dir);
  let mark: Agent | null = null;
  let best = 14;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || o.line === 0) continue;
    const d = dist(o.x, o.y, zx, zy);
    if (d < best) {
      best = d;
      mark = o;
    }
  }
  const focus = focusThreat(s, a.team);
  if (focus && dist(focus.x, focus.y, zx, zy) < 14) mark = focus;
  const goalSide = O.markGoalSide * (mark && mark === focus ? O.focusMark : 1);
  if (mark) {
    const [gx, gy] = ownGoal(dir);
    const gd = dist(mark.x, mark.y, gx, gy) || 1;
    const bd = dist(mark.x, mark.y, b.x, b.y) || 1;
    // 골 쪽과 공 쪽 사이 (패스 경로를 막는 위치)
    let ux = ((gx - mark.x) / gd) * (1 - O.markBallSide) + ((b.x - mark.x) / bd) * O.markBallSide;
    let uy = ((gy - mark.y) / gd) * (1 - O.markBallSide) + ((b.y - mark.y) / bd) * O.markBallSide;
    const un = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= un;
    uy /= un;
    const sigma = (100 - (a.attrs.marking + a.attrs.defensivePositioning) / 2) * O.markSigma;
    const mx = mark.x + ux * goalSide + a.errX * sigma;
    const my = mark.y + uy * goalSide + a.errY * sigma;
    const [mnx, mny] = toNorm(mx, my, dir);
    if (a.line === 1) {
      ny = ny * 0.5 + mny * 0.5;
      nx = Math.min(nx, mnx);
    } else {
      const w = a.line === 3 ? 0.3 : 0.65;
      nx = nx * (1 - w) + mnx * w;
      ny = ny * (1 - w) + mny * w;
    }
  }
  // 복귀 (E.18 A3): 목표가 자기 골 쪽으로 10 m 이상이면 러닝 이상, 20 m 이상이면 (긴급 복귀 판단 시) 최대 속도
  const [ax] = toNorm(a.x, a.y, dir);
  const back = (ax - nx) * L;
  void bnx;
  void bny;
  setTarget(a, nx, ny, dir, back >= O.recoverSprint && a.recoverUrgent);
  a.minRun = back >= O.recoverRun;
}

/**
 * 박스 앞 수비 블록의 수비수 배치 (E.20 3번). 공에 가장 가까운 2명(압박)을 뺀 수비 줄에서
 * ① 가장 위협적인 상대 ST(소유자 제외, 위치 가치가 가장 큰 ST/CF, 없으면 공격 줄)에게 가장 가까운 CB 가 골과 ST 를 잇는 선상 1.5 m 마크
 * ② 나머지는 니어 포스트, 페널티 지점, 파 포스트 순서로 가까운 자리를 덮는다 (자리가 모자라면 평소 라인)
 * 같은 상태에서 팀의 모든 수비수가 같은 배치를 계산한다. 배치가 정해지면 true
 */
function boxDefense(s: SimState, a: Agent, dir: 1 | -1, cover: boolean): boolean {
  const b = s.ball;
  const [gx, gy] = ownGoal(dir);
  const defs = s.agents.filter((o) => o.onPitch && o.team === a.team && o.line === 1 && ballRank(s, o, b.x, b.y) >= 2);
  if (!defs.includes(a)) return false;
  const owner = b.owner >= 0 ? s.agents[b.owner]! : null;
  const oppDir = (-dir) as 1 | -1;
  // 가장 위협적인 상대 (수비 주의 집중, E.20 8번): 골까지 가까움과 박스 안 여부. 없으면 위치 가치가 가장 큰 ST/공격 줄
  let threat: Agent | null = focusThreat(s, a.team);
  if (!threat) {
    let tv = -Infinity;
    for (const pass of [true, false]) {
      for (const o of s.agents) {
        if (!o.onPitch || o.team === a.team || o === owner || o.line === 0) continue;
        if (pass ? o.pos !== 'ST' && o.pos !== 'CF' : o.line !== 3) continue;
        const v = positionValue(...toNorm(o.x, o.y, oppDir));
        if (v > tv) {
          tv = v;
          threat = o;
        }
      }
      if (threat) break;
    }
  }
  let rest = defs;
  if (threat) {
    const t = threat;
    const near = (x: Agent, y: Agent) => dist(x.x, x.y, t.x, t.y) - dist(y.x, y.y, t.x, t.y) || x.idx - y.idx;
    const cbs = defs.filter((o) => o.pos === 'CB');
    const marker = (cbs.length ? cbs : defs).slice().sort(near)[0]!;
    // 박스 안이면 가까운 수비 1명이 더 붙는다 (공 쪽)
    const inBox = Math.abs(t.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(t.y - gy) <= ENGINE.pitch.boxWidth / 2;
    const second = inBox ? defs.filter((o) => o !== marker).sort(near)[0] : undefined;
    const gd = dist(t.x, t.y, gx, gy) || 1;
    const focus = t === focusThreat(s, a.team) ? O.focusMark : 1;
    if (marker === a) {
      // 볼 쪽 마크 (E.22 A): 공이 측면이면 골 쪽에서 공 쪽으로 반 발
      let ux = (gx - t.x) / gd;
      let uy = (gy - t.y) / gd;
      const wideB = Math.abs(toNorm(b.x, b.y, dir)[1] - 0.5) >= O.wideBall;
      if (wideB) {
        const bd = dist(t.x, t.y, b.x, b.y) || 1;
        ux = ux * (1 - O.stBallSide) + ((b.x - t.x) / bd) * O.stBallSide;
        uy = uy * (1 - O.stBallSide) + ((b.y - t.y) / bd) * O.stBallSide;
        const un = Math.sqrt(ux * ux + uy * uy) || 1;
        ux /= un;
        uy /= un;
      }
      a.tx = clamp(t.x + ux * O.stMark * focus + a.errX * O.markSigma, 0.3, L - 0.3);
      a.ty = clamp(t.y + uy * O.stMark * focus + a.errY * O.markSigma, 0.3, W - 0.3);
      a.urgent = dist(a.tx, a.ty, a.x, a.y) > 3;
      a.minRun = false;
      return true;
    }
    if (second === a) {
      const bd = dist(t.x, t.y, b.x, b.y) || 1;
      a.tx = clamp(t.x + ((b.x - t.x) / bd) * O.stMark + a.errX * O.markSigma, 0.3, L - 0.3);
      a.ty = clamp(t.y + ((b.y - t.y) / bd) * O.stMark + a.errY * O.markSigma, 0.3, W - 0.3);
      a.urgent = dist(a.tx, a.ty, a.x, a.y) > 3;
      a.minRun = false;
      return true;
    }
    rest = defs.filter((o) => o !== marker && o !== second);
  }
  if (!cover) return false;
  // 덮는 자리: 니어 포스트(공 쪽), 페널티 지점, 파 포스트
  const side = b.y < gy ? -1 : 1;
  const spots: [number, number][] = [
    [gx + dir * O.coverPostDepth, gy + side * O.coverPostY],
    [gx + dir * O.coverSpot, gy],
    [gx + dir * (O.coverPostDepth + 1), gy - side * O.coverPostY],
  ];
  // 자리 순서대로, 아직 배정되지 않은 수비수 중 가장 가까운 선수
  const free = rest.slice().sort((x, y) => x.idx - y.idx);
  for (const [sx, sy] of spots) {
    if (!free.length) break;
    let k = 0;
    for (let i = 1; i < free.length; i++) if (dist(free[i]!.x, free[i]!.y, sx, sy) < dist(free[k]!.x, free[k]!.y, sx, sy)) k = i;
    if (free[k] === a) {
      a.tx = clamp(sx + a.errX * O.markSigma * 10, 0.3, L - 0.3);
      a.ty = clamp(sy + a.errY * O.markSigma * 10, 0.3, W - 0.3);
      a.urgent = dist(a.tx, a.ty, a.x, a.y) > 4;
      a.minRun = false;
      return true;
    }
    free.splice(k, 1);
  }
  return false;
}

const focusCache = new WeakMap<SimState, { tick: number; team: number; focus: Agent | null }[]>();

/**
 * 수비 주의 집중 대상 (E.20 8번, C.16 결정 1): 수비 팀 기준, 공을 갖지 않은 상대 필드 선수(미드·공격 줄) 중
 * 위협도 = max(0, 1 − 골까지 거리 / focusRange) + (박스 안이면 focusBox) 가 가장 높은 1명. 위치로만 고르고 능력치는 보지 않는다
 * (좋은 마무리 선수일수록 집중 마크를 받아 득점 반응이 뒤집히던 문제). 틱마다 한 번 계산
 */
export function focusThreat(s: SimState, defTeam: 0 | 1): Agent | null {
  let cache = focusCache.get(s);
  if (!cache) focusCache.set(s, (cache = [{ tick: -1, team: 0, focus: null }, { tick: -1, team: 1, focus: null }]));
  const c = cache[defTeam]!;
  if (c.tick === s.tick) return c.focus;
  const [gx, gy] = ownGoal(attackDir(defTeam, s.half));
  let best: Agent | null = null;
  let bv = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === defTeam || o.line < 2 || o.idx === s.ball.owner) continue;
    const inBox = Math.abs(o.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(o.y - gy) <= ENGINE.pitch.boxWidth / 2;
    const v = Math.max(0, 1 - dist(o.x, o.y, gx, gy) / O.focusRange) + (inBox ? O.focusBox : 0);
    if (v > bv) {
      bv = v;
      best = o;
    }
  }
  c.tick = s.tick;
  c.focus = best;
  return best;
}

/**
 * 커버 섀도 대상 (E.22 A): 소유자 팀의 필드 선수 중 공보다 우리 골에 가깝고 공에서 passMaxDist 안,
 * 그 팀 기준 위치 가치가 가장 큰 선수 (대개 ST). 위치로만 고른다
 */
function shadowTarget(s: SimState, owner: Agent, defDir: 1 | -1): Agent | null {
  const [gx, gy] = ownGoal(defDir);
  const bd = dist(owner.x, owner.y, gx, gy);
  const oppDir = (-defDir) as 1 | -1;
  let best: Agent | null = null;
  let bv = -Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== owner.team || o === owner || o.line === 0) continue;
    if (dist(o.x, o.y, gx, gy) > bd - 2 || dist(o.x, o.y, owner.x, owner.y) > ENGINE.onball.passMaxDist) continue;
    const v = positionValue(...toNorm(o.x, o.y, oppDir));
    if (v > bv) {
      bv = v;
      best = o;
    }
  }
  return best;
}

/**
 * CDM 스크린 자리 (E.22 A): 공과 상대 최전방(우리 골에 가장 가까운 상대 ST/CF, 없으면 공격 줄)을 잇는 선에서 공 쪽 screenFrac 지점.
 * 수비 라인 앞 screenGap m 보다 골 쪽으로 내려가지 않는다. 팀에 CDM 이 둘이면 그 자리에 가까운 1명. 정규화 좌표를 돌려준다
 */
function screenSpot(s: SimState, a: Agent, owner: Agent, dir: 1 | -1, lineX: number): [number, number] | null {
  const [gx, gy] = ownGoal(dir);
  let top: Agent | null = null;
  for (const pass of [true, false]) {
    let bd = Infinity;
    for (const o of s.agents) {
      if (!o.onPitch || o.team === a.team || o === owner || o.line === 0) continue;
      if (pass ? o.pos !== 'ST' && o.pos !== 'CF' : o.line !== 3) continue;
      const d = dist(o.x, o.y, gx, gy);
      if (d < bd) {
        bd = d;
        top = o;
      }
    }
    if (top) break;
  }
  if (!top || dist(top.x, top.y, gx, gy) >= dist(owner.x, owner.y, gx, gy) - 3) return null;
  const px = owner.x + (top.x - owner.x) * O.screenFrac;
  const py = owner.y + (top.y - owner.y) * O.screenFrac;
  let [nx, ny] = toNorm(px, py, dir);
  nx = Math.max(nx, lineX + O.screenGap / L);
  const [qx, qy] = toPitch(nx, ny, dir);
  for (const o of s.agents) {
    if (o === a || !o.onPitch || o.team !== a.team || o.pos !== 'CDM') continue;
    if (dist(o.x, o.y, qx, qy) < dist(a.x, a.y, qx, qy)) return null;
  }
  return [nx, ny];
}

/** 팀의 가장 앞 공격수 (슬롯 x 기준, 같으면 idx) */
function isTopForward(s: SimState, a: Agent): boolean {
  for (const o of s.agents) {
    if (o === a || !o.onPitch || o.team !== a.team || o.line !== 3) continue;
    if (o.sx > a.sx || (o.sx === a.sx && o.idx < a.idx)) return false;
  }
  return true;
}

/** 공에 더 가까운 같은 팀 공격수가 있는가 */
function closerForward(s: SimState, a: Agent, bx: number, by: number): boolean {
  const d = dist(a.x, a.y, bx, by);
  return s.agents.some((o) => o !== a && o.onPitch && o.team === a.team && o.line === 3 && dist(o.x, o.y, bx, by) < d);
}

/** 오프더볼 갱신 때 위치 오차를 새로 뽑는다 */
export function refreshErrors(s: SimState, a: Agent): void {
  a.errX = randn(s.seed, s.tick, a.idx, Purpose.Mark, 0);
  a.errY = randn(s.seed, s.tick, a.idx, Purpose.Mark, 1);
}

/** 세트피스 박스 안 자리 [골라인에서 m, 공 쪽 + / 반대쪽 − y m] (E.22 B) */
const SP_SPOTS: [number, number][] = [[6, 0], [9, 4], [12, 0], [6, -4], [9, -8]];

/**
 * 세트피스 위치 (코너, 상대 골 35 m 안 프리킥): 공격 팀은 CB·공격수·공중볼 좋은 미드가 박스로,
 * 수비 팀은 공격수 1명을 빼고 박스 안으로
 */
function setPieceTarget(s: SimState, a: Agent): boolean {
  const r = s.restart!;
  const attTeam = r.team;
  const dirAtt = attackDir(attTeam, s.half);
  const [gx, gy] = [dirAtt > 0 ? L : 0, W / 2];
  const near = r.type === 'corner' || (r.type === 'freeKick' && dist(r.x, r.y, gx, gy) < 35);
  if (!near) return false;
  const mates = s.agents
    .filter((o) => o.onPitch && o.team === a.team && o.line !== 0 && o.idx !== r.taker)
    .sort((x, y) => (y.attrs.heading + y.attrs.jumping) - (x.attrs.heading + x.attrs.jumping));
  const k = mates.indexOf(a);
  if (k < 0) return false;
  if (a.team === attTeam) {
    // 박스 가담 (E.22 B): 공중볼 좋은 CB 최대 setPieceCB 명 + 공중볼 상위 선수로 5명 박스 안, 2명 박스 바깥, 나머지 하프라인 쪽.
    // 박스 안 자리: 중앙 7 m, 니어 포스트, 파 포스트, 페널티 지점, 니어 쪽 9 m (공중볼 순서대로)
    const cbs = mates.filter((o) => o.pos === 'CB').slice(0, O.setPieceCB);
    const box = [...cbs, ...mates.filter((o) => !cbs.includes(o))].slice(0, 5).sort((x, y) => mates.indexOf(x) - mates.indexOf(y));
    const rest = mates.filter((o) => !box.includes(o));
    const side = r.y < gy ? -1 : 1;
    const bk = box.indexOf(a);
    if (bk >= 0) {
      const [dx, dy] = SP_SPOTS[bk]!;
      a.tx = gx - dirAtt * dx;
      a.ty = gy + side * dy;
    } else {
      const ek = rest.indexOf(a);
      if (ek >= 2) return false;
      a.tx = gx - dirAtt * 20;
      a.ty = gy + (ek === 0 ? -10 : 10);
    }
    a.urgent = false;
    return true;
  }
  // 수비: 가장 앞선 공격수 1명은 남고 나머지는 박스 안
  const forward = mates.slice().sort((x, y) => y.line - x.line || y.sx - x.sx)[0];
  if (a === forward) return false;
  // 대인 마크 (E.22 B): 공중볼 상위 수비 setPieceMark 명이 박스 안 상대 공중볼 상위 선수를 골 쪽 1 m 에서 맡는다 (같은 순위끼리)
  const markers = mates.filter((o) => o !== forward).slice(0, O.setPieceMark);
  const mi = markers.indexOf(a);
  if (mi >= 0) {
    const opp = s.agents
      .filter((o) => o.onPitch && o.team === attTeam && o.line !== 0 && o.idx !== r.taker && Math.abs(o.x - gx) < ENGINE.pitch.boxDepth + 2)
      .sort((x, y) => (y.attrs.heading + y.attrs.jumping) - (x.attrs.heading + x.attrs.jumping));
    const t = opp[mi];
    if (t) {
      const gd = dist(t.x, t.y, gx, gy) || 1;
      a.tx = t.x + ((gx - t.x) / gd) * 1;
      a.ty = t.y + ((gy - t.y) / gd) * 1;
      a.urgent = false;
      return true;
    }
  }
  a.tx = gx - dirAtt * (3 + (k % 4) * 3);
  a.ty = gy - 10 + (k % 7) * 3.3;
  a.urgent = false;
  return true;
}
