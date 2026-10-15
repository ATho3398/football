// 교체 (E.10): 팀당 3명. 스태미나가 낮은 선수를 같은 포지션군 벤치 선수로. 내 선수 출전 구간(myMinutes)

import { BALANCE } from '../config/balance';
import { positionOvr, type FieldPosition } from '../positions';
import { gkOvr, posGroup } from '../roster';
import { ENGINE } from './config';
import { delayRestart, event } from './core';
import { lineOf } from './formation';
import { attackDir, toPitch, W } from './pitch';
import { Purpose, rand } from './rng';
import type { Agent, SimState } from './state';

const SB = ENGINE.subs;

function slotOvr(a: Agent, pos: Agent['pos']): number {
  if (pos === 'GK') return a.gk ? gkOvr(a.gk.attrs, a.gk.type) : 20;
  if (a.gk) return 10;
  return positionOvr(a.attrs, pos as FieldPosition);
}

/** 벤치에서 그 슬롯에 가장 맞는 선수 (같은 포지션군 우선) */
export function bestBench(s: SimState, team: 0 | 1, pos: Agent['pos']): Agent | null {
  const g = posGroup(pos);
  let best: Agent | null = null;
  let bestScore = -Infinity;
  for (const b of s.bench[team]) {
    if (b.leftAt !== null || b.onPitch) continue;
    if (b.spec.isMe && !s.input.myMinutes) continue;
    const score = slotOvr(b, pos) - (posGroup(b.spec.position) === g ? 0 : 6);
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

/** out 을 빼고 inA 를 그 슬롯에 넣는다 */
export function substitute(s: SimState, out: Agent, inA: Agent): void {
  const team = s.teams[out.team];
  team.subsLeft--;
  delayRestart(s, ENGINE.restart.sub, 2);
  out.onPitch = false;
  out.leftAt = s.elapsed;
  inA.idx = s.agents.length;
  s.agents.push(inA);
  s.bench[out.team] = s.bench[out.team].filter((b) => b !== inA);
  inA.onPitch = true;
  inA.enteredAt = s.elapsed;
  inA.pos = out.pos;
  inA.line = lineOf(out.pos);
  inA.sx = out.sx;
  inA.sy = out.sy;
  inA.stats.position = out.pos;
  inA.stats.slot = out.stats.slot;
  // 터치라인 하프라인 근처에서 들어온다
  const dir = attackDir(out.team, s.half);
  [inA.x] = toPitch(0.45, 0, dir);
  inA.y = out.y < W / 2 ? 0 : W;
  inA.tx = out.x;
  inA.ty = out.y;
  inA.nextOffball = 0;
  if (s.ball.owner === out.idx) s.ball.owner = -1;
  event(s, 'sub', out.team, [inA.id, out.id]);
}

/** AI 교체: 58~85분, 스태미나가 낮은 필드 선수. 내 선수는 출전 구간으로만 바뀐다 */
export function aiSubs(s: SimState): void {
  if (s.t < s.nextSubCheck || s.restart === null) return;
  const minute = s.t / 60;
  if (minute < SB.fromMin || minute > SB.toMin) return;
  s.nextSubCheck = s.t + SB.checkEvery;
  for (const team of [0, 1] as const) {
    if (s.teams[team].subsLeft <= 0) continue;
    const tired = s.agents
      .filter((a) => a.onPitch && a.team === team && a.line !== 0 && !a.spec.isMe)
      .sort((a, b) => a.stamina - b.stamina)[0];
    if (!tired) continue;
    const late = minute >= 75 && rand(s.seed, s.tick, tired.idx, Purpose.Sub) < SB.lateChance;
    if (tired.stamina >= SB.threshold && !late) continue;
    const inA = bestBench(s, team, tired.pos);
    if (inA) substitute(s, tired, inA);
  }
}

/** 내 선수 출전 구간 (E.16): 교체 투입 시각과 부상/교체 아웃 시각 */
export function myMinutes(s: SimState): void {
  const mm = s.input.myMinutes;
  const myId = s.input.myPlayerId;
  if (!mm || !myId) return;
  const minute = s.t / 60;
  const onPitch = s.agents.find((a) => a.id === myId && a.onPitch);
  if (!onPitch && minute >= mm.start && mm.start > 0) {
    const me = s.bench.flat().find((b) => b.id === myId && b.leftAt === null);
    if (me && s.restart) {
      const out = s.agents
        .filter((a) => a.onPitch && a.team === me.team && a.line !== 0)
        .sort((a, b) => (posGroup(a.pos) === posGroup(me.spec.position) ? 0 : 1) - (posGroup(b.pos) === posGroup(me.spec.position) ? 0 : 1) || a.stamina - b.stamina)[0];
      if (out) {
        // 내 투입은 교체 수와 무관하게 보장한다
        s.teams[me.team].subsLeft = Math.max(1, s.teams[me.team].subsLeft);
        substitute(s, out, me);
      }
    }
  }
  if (onPitch && minute >= mm.end && mm.end < 90) {
    const inA = s.teams[onPitch.team].subsLeft > 0 ? bestBench(s, onPitch.team, onPitch.pos) : null;
    if (inA) substitute(s, onPitch, inA);
    else {
      onPitch.onPitch = false;
      onPitch.leftAt = s.elapsed;
      if (s.ball.owner === onPitch.idx) s.ball.owner = -1;
    }
  }
}

/** 필드 선수가 GK 를 맡는다 (E.10). 능력치는 fieldPlayerAsGk */
export function emergencyKeeper(s: SimState, team: 0 | 1): void {
  const pick = s.agents.filter((a) => a.onPitch && a.team === team && a.line !== 0).sort((a, b) => a.line - b.line || a.sx - b.sx)[0];
  if (!pick) return;
  pick.pos = 'GK';
  pick.line = 0;
  pick.gk = { attrs: { ...BALANCE.goalkeeper.fieldPlayerAsGk }, type: 'classic' };
  pick.sx = 0.04;
  pick.sy = 0.5;
}
