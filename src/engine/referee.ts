// 심판 (E.10): 파울, 어드밴티지, 카드와 퇴장(수적 열세), 오프사이드

import { ENGINE } from './config';
import { event, setRestart } from './core';
import { attackDir, clamp, dist, inOppBox, L, positionValue, toNorm, W } from './pitch';
import { Purpose, rand } from './rng';
import type { Agent, CardType, SimState } from './state';
import { bestBench, emergencyKeeper, substitute } from './subs';

const R = ENGINE.referee;
const N = 0.5;

function r(s: SimState, a: number, p: number, k = 0): number {
  return rand(s.seed, s.tick, a, p, k);
}

// ── 카드와 퇴장 ──

/** 퇴장: 슬롯 제거, 같은 줄 선수들의 y 간격을 균등하게 다시 나눈다. GK 퇴장이면 GK 교체 또는 필드 선수가 GK */
export function sendOff(s: SimState, a: Agent): void {
  a.onPitch = false;
  a.leftAt = s.elapsed;
  a.stats.red = true;
  s.teams[a.team].stats.reds++;
  if (s.ball.owner === a.idx) s.ball.owner = -1;
  if (a.line === 0) {
    const gk = s.teams[a.team].subsLeft > 0 ? bestBench(s, a.team, 'GK') : null;
    const out = s.agents.filter((x) => x.onPitch && x.team === a.team && x.line !== 0 && !x.spec.isMe).sort((x, y) => y.line - x.line || y.sx - x.sx)[0];
    if (gk && gk.gk && out) {
      // 공격수 1명을 빼고 벤치 GK 투입 (빠진 자리는 GK 슬롯으로)
      const outLine = out.line;
      out.pos = 'GK';
      out.line = 0;
      out.sx = 0.04;
      out.sy = 0.5;
      substitute(s, out, gk);
      respace(s, a.team, outLine);
    } else emergencyKeeper(s, a.team);
    return;
  }
  respace(s, a.team, a.line);
}

function respace(s: SimState, team: 0 | 1, line: number): void {
  const mates = s.agents.filter((x) => x.onPitch && x.team === team && x.line === line).sort((x, y) => x.sy - y.sy);
  mates.forEach((m, i) => (m.sy = 0.08 + (0.84 * (i + 1)) / (mates.length + 1)));
}

export function giveCard(s: SimState, a: Agent, card: CardType): void {
  if (!a.onPitch) return;
  if (card === 'yellow') {
    a.stats.yellows++;
    s.teams[a.team].stats.yellows++;
    event(s, 'card', a.team, [a.id], { card: 'yellow', count: a.stats.yellows });
    if (a.stats.yellows >= 2) {
      event(s, 'card', a.team, [a.id], { card: 'red', second: 1 });
      sendOff(s, a);
    }
    return;
  }
  event(s, 'card', a.team, [a.id], { card: 'red' });
  sendOff(s, a);
}

/** 다음 경기 중단 때 보류된 카드를 준다 */
export function issuePendingCards(s: SimState): void {
  const cards = s.pendingCards;
  s.pendingCards = [];
  for (const c of cards) giveCard(s, s.agents[c.agent]!, c.card);
}

function rollCard(s: SimState, fouler: Agent): CardType | null {
  const x = r(s, fouler.idx, Purpose.Card);
  if (x < R.redShare) return 'red';
  if (x < R.redShare + R.yellowShare) {
    if (fouler.stats.yellows > 0 && r(s, fouler.idx, Purpose.Card, 1) >= R.secondYellow) return null;
    return 'yellow';
  }
  return null;
}

// ── 파울과 어드밴티지 ──

/**
 * 파울 (E.10). 피해 팀이 공을 갖고 유리하면 어드밴티지로 보류하고, 아니면 프리킥/PK.
 * 반환값: 경기를 멈췄으면 true
 */
/** 파울 확률 배율: 피해 팀의 공격 박스 안이면 boxFoulFactor */
export function foulFactor(s: SimState, victim: Agent, x: number, y: number, fouler?: Agent): number {
  const box = inOppBox(x, y, attackDir(victim.team, s.half)) ? R.boxFoulFactor : 1;
  return box * (fouler && fouler.stats.yellows > 0 ? R.bookedCare : 1);
}

export function foul(s: SimState, fouler: Agent, victim: Agent, x: number, y: number): boolean {
  if (s.restart || !fouler.onPitch) return false;
  fouler.stats.fouls++;
  s.teams[fouler.team].stats.fouls++;
  const card = rollCard(s, fouler);
  event(s, 'foul', fouler.team, [fouler.id, victim.id]);

  const team = victim.team;
  const dir = attackDir(team, s.half);
  const [nx, ny] = toNorm(x, y, dir);
  const inBox = inOppBox(x, y, dir);
  // 어드밴티지 조건: 피해 팀이 소유, 이어 가는 가치 > 프리킥 가치
  const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
  if (!inBox && owner && owner.team === team && card !== 'red') {
    const [ox, oy] = toNorm(owner.x, owner.y, dir);
    const playOn = positionValue(ox, oy) + (ox > 0.66 ? 0.02 : 0);
    const fk = positionValue(nx, ny) + (nx > 0.7 ? 0.03 : 0);
    const bias = R.advantageBias * (nx > 0.66 ? R.advantageFinalThird : 1);
    if (playOn > fk * 0.9 && r(s, victim.idx, Purpose.Advantage) < bias) {
      s.advantage = { t: s.t, team, x, y, card, fouler: fouler.idx, value: playOn };
      s.teams[team].stats.advantages++;
      event(s, 'advantage', team, [victim.id]);
      return false;
    }
  }
  if (card) s.pendingCards.push({ agent: fouler.idx, card });
  if (inBox) {
    const [gx] = [dir > 0 ? L - 11 : 11];
    setRestart(s, 'penalty', team, gx, W / 2, ENGINE.restart.freeKickDelay);
  } else {
    setRestart(s, 'freeKick', team, clamp(x, 1, L - 1), clamp(y, 1, W - 1), ENGINE.restart.freeKickDelay);
  }
  issuePendingCards(s);
  return true;
}

/** 어드밴티지 보류 확인: 4초 안에 소유를 잃으면 원래 위치 프리킥, 4초가 지나면 그대로 진행 (카드는 다음 중단 때) */
export function checkAdvantage(s: SimState): void {
  const adv = s.advantage;
  if (!adv) return;
  if (s.restart) {
    s.advantage = null;
    if (adv.card) s.pendingCards.push({ agent: adv.fouler, card: adv.card });
    issuePendingCards(s);
    return;
  }
  const lost = s.possTeam !== adv.team;
  if (lost && s.t - adv.t <= R.advantageWindow) {
    s.advantage = null;
    if (adv.card) s.pendingCards.push({ agent: adv.fouler, card: adv.card });
    setRestart(s, 'freeKick', adv.team, clamp(adv.x, 1, L - 1), clamp(adv.y, 1, W - 1), ENGINE.restart.freeKickDelay);
    issuePendingCards(s);
    return;
  }
  if (s.t - adv.t > R.advantageWindow) {
    s.advantage = null;
    if (adv.card) s.pendingCards.push({ agent: adv.fouler, card: adv.card });
  }
}

/** 공중볼/몸싸움 파울 판정 (태클 실패는 actions 에서) */
export function contactFouls(s: SimState): boolean {
  const o = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
  if (!o || s.restart) return false;
  for (const d of s.agents) {
    if (!d.onPitch || d.team === o.team || d.line === 0) continue;
    if (dist(d.x, d.y, o.x, o.y) > R.contactDist) continue;
    if (r(s, d.idx, Purpose.Foul, 5) < R.contactFoulRate * foulFactor(s, o, o.x, o.y, d)) return foul(s, d, o, o.x, o.y);
  }
  return false;
}

// ── 오프사이드 ──

/** 받을 선수가 오프사이드 위치인가 (E.10): 상대 진영, 공과 뒤에서 두 번째 상대보다 상대 골 쪽 */
export function offsideMargin(s: SimState, passer: Agent, receiver: Agent): number {
  const dir = attackDir(passer.team, s.half);
  const [rx] = toNorm(receiver.x, receiver.y, dir);
  if (rx <= N) return -1;
  const [bx] = toNorm(s.ball.x, s.ball.y, dir);
  let first = 0;
  let second = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === passer.team) continue;
    const nx = toNorm(o.x, o.y, dir)[0];
    if (nx > first) {
      second = first;
      first = nx;
    } else if (nx > second) second = nx;
  }
  const line = Math.max(second, bx);
  return (rx - line) * L;
}

/** 패서가 느끼는 오프사이드 확률 (판단 오차, 효용 반영용) */
export function offsideRisk(s: SimState, passer: Agent, receiver: Agent): number {
  if (s.exemptPass) return 0;
  const m = offsideMargin(s, passer, receiver);
  if (m < -3) return 0;
  const sigma = R.perceptionBase + (100 - passer.attrs.vision) * R.perceptionSlope;
  // 정규분포 CDF 근사
  const z = m / sigma;
  return R.offsideAwareness / (1 + Math.exp(-1.702 * z));
}

/** 패스가 오프사이드로 선언되는가 (판정 오차 없음) */
export function isOffside(s: SimState, passer: Agent, receiver: Agent): boolean {
  if (s.exemptPass) return false;
  return offsideMargin(s, passer, receiver) > 0;
}

export function callOffside(s: SimState, passer: Agent, receiver: Agent): void {
  receiver.stats.offsides++;
  s.teams[passer.team].stats.offsides++;
  event(s, 'offside', passer.team, [receiver.id]);
  const def = (1 - passer.team) as 0 | 1;
  setRestart(s, 'freeKick', def, clamp(receiver.x, 1, L - 1), clamp(receiver.y, 1, W - 1), ENGINE.restart.freeKickDelay);
  if (s.restart) s.restart.indirect = true;
  issuePendingCards(s);
}

