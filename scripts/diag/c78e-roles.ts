// 진단 (C.78e, 로드맵 6단계 역할): 엔진 무수정 분해.
//   wide: 4-4-2(LM/RM) 대 4-3-3(LW/RW) — 우리 공이 최종 3분의 1(정규화 x ≥ 2/3)에 들어간 순간부터 측면 선수가 ⅓·박스에 도착하는 시각(공 쪽 / 반대쪽),
//         진입 3초 뒤 위치, 반대쪽 측면 크로스 때 먼 포스트 도착(크로스 착지 순간 거리·박스 안)
//   nine: 4-3-3 슬롯 9 역할만 바꿈(기본 falseNine 대 poacher, 짝 조건 PAIR) — ST 패스 수신 중 내려와 받음 → 가장 가까운 CB 따라감 → 빈자리 크기 →
//         동료 침투(3초 안 빈자리 채널 = 그 CB y ± 8 m · 수비 줄 − 3 m 보다 깊이) → 그 채널로 패스 시도·성공(4초) → 슛(8초), 안 따라가면 돌아서 전진(2.5초 안 앞으로 3 m+ 몰기·전진 패스)
// 실행: npx vite-node scripts/diag/c78e-roles.ts -- wide [경기수=30] [LM/RM 역할=기본] [경로=값 ...]
//       npx vite-node scripts/diag/c78e-roles.ts -- nine [경기수=30] [역할1=falseNine] [역할2=poacher] [경로=값 ...]
import { ENGINE, ENGINE_VERSION } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { offsideLine } from '../../src/engine/offball';
import { tacticsOf } from '../../src/engine/tactics';
import { attackDir, dist, inOppBox, oppGoal, toNorm, toPitch, L, W } from '../../src/engine/pitch';
import type { Agent, SimState } from '../../src/engine/state';
import type { TeamSetup } from '../../src/engine/types';
import { FORMATION_SLOTS, type Formation } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const MODE = args[0] ?? 'wide';
const N = Number(args[1] ?? 30);
const O = ENGINE.offball;
const DT = ENGINE.time.dt;
const DEEP = Number(process.env.DEEP ?? 0.8);
const SEED0 = Number(process.env.SEED ?? 78500);

const mk = (tag: string, i: number, formation: Formation, roles: Record<number, string>): TeamSetup => {
  const r = createTeamRoster({ id: `e${tag}${i}`, rating: 75 }, `diagE-${tag}-${i}`, 2018, []);
  r.formation = formation;
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wE${i}`);
  s.tactics = tacticsOf('balanced');
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  for (const [sl, rid] of Object.entries(roles)) { const p = s.lineup.find((x) => x.slot === Number(sl)); if (p) p.role = rid; }
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
};
const isWide = (a: Agent) => a.pos === 'LM' || a.pos === 'RM' || a.pos === 'LW' || a.pos === 'RW';
const pct = (a: number, b: number) => (b ? (100 * a) / b : 0).toFixed(1);
const avg = (xs: number[]) => (xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : NaN);
const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '-');

// ───────────────────────── wide ─────────────────────────
interface Ep { a: Agent; t0: number; nx0: number; side: 'same' | 'opp'; t3?: number; t8?: number; tBox?: number; p3?: [number, number, boolean]; done: boolean; lost: boolean; lost8?: boolean }
interface WAcc { eps: number; reach8: number[]; cap8: number[]; reach3: number[]; reachBox: number[]; lost: number; at3s: [number, number, boolean][]; already: number; cross: number; crossD: number[]; crossBox: number; crossTarget: number; crossGot: number; inBoxAtCross: number[] }
const wacc = (): WAcc => ({ eps: 0, reach8: [], cap8: [], reach3: [], reachBox: [], lost: 0, at3s: [], already: 0, cross: 0, crossD: [], crossBox: 0, crossTarget: 0, crossGot: 0, inBoxAtCross: [] });
function runWide(): void {
  const role = args[2] && args[2] !== '-' ? args[2] : null;
  const W_ = { 'LM/RM': { same: wacc(), opp: wacc() }, 'LW/RW': { same: wacc(), opp: wacc() } } as Record<string, Record<'same' | 'opp', WAcc>>;
  const boxCnt = { 'LM/RM': [0, 0], 'LW/RW': [0, 0] } as Record<string, number[]>;
  for (let i = 0; i < N; i++) {
    const seed = SEED0 + i;
    const r442: Record<number, string> = role ? { 6: role, 9: role } : {};
    const t442 = mk('M', i, '4-4-2', r442);
    const t433 = mk('W', i, '4-3-3', {});
    const flip = i % 2 === 1;
    const m = createMatch({ home: flip ? t433 : t442, away: flip ? t442 : t433, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
    const s = m.state;
    const inThird = [false, false];
    const lastEntry = [-100, -100];
    let eps: Ep[] = [];
    let flightSeen: unknown = null;
    const pendingCross: { a: Agent; tEnd: number; tx: number; ty: number; side: number }[] = [];
    while (!s.done) {
      m.step();
      const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
      // 최종 3분의 1 진입
      for (const tm of [0, 1] as const) {
        const dir = attackDir(tm, s.half);
        const has = !!owner && owner.team === tm && !s.restart;
        const bnx = toNorm(s.ball.x, s.ball.y, dir)[0];
        const now = has && bnx >= 2 / 3;
        if (now && !inThird[tm] && s.t - lastEntry[tm]! > 5) {
          lastEntry[tm] = s.t;
          const bny = toNorm(s.ball.x, s.ball.y, dir)[1];
          for (const a of s.agents) {
            if (!a.onPitch || a.team !== tm || !isWide(a) || a === owner) continue;
            const side = Math.sign(a.sy - 0.5) === Math.sign(bny - 0.5) ? 'same' : 'opp';
            eps.push({ a, t0: s.t, nx0: toNorm(a.x, a.y, dir)[0], side, done: false, lost: false });
          }
        }
        if (has) inThird[tm] = now; else if (!s.ball.flight || (s.ball.flight && s.agents[s.ball.flight.passer]?.team !== tm)) inThird[tm] = false;
      }
      for (const e of eps) {
        if (e.done) continue;
        const dir = attackDir(e.a.team, s.half);
        const el = s.t - e.t0;
        const poss = s.ball.owner >= 0 ? s.agents[s.ball.owner]!.team === e.a.team : !!s.ball.flight && s.agents[s.ball.flight.passer]?.team === e.a.team;
        const [nx, ny] = toNorm(e.a.x, e.a.y, dir);
        if (e.t3 === undefined && nx >= 2 / 3) e.t3 = el;
        if (e.t8 === undefined && nx >= DEEP) e.t8 = el;
        if (e.tBox === undefined && inOppBox(e.a.x, e.a.y, dir)) e.tBox = el;
        if (!e.p3 && el >= 3) e.p3 = [nx, Math.abs(ny - 0.5) * W, inOppBox(e.a.x, e.a.y, dir)];
        if (el >= 10 || (!poss && !s.restart) || s.restart) { e.done = true; e.lost = el < 10 && e.t3 === undefined; e.lost8 = el < 10 && e.t8 === undefined; }
      }
      // 크로스
      const fl = s.ball.flight;
      if (fl && fl !== flightSeen) {
        flightSeen = fl;
        const passer = s.agents[fl.passer];
        if (passer && fl.kind === 'cross') {
          const dir = attackDir(passer.team, s.half);
          const pny = toNorm(fl.fromX, fl.fromY, dir)[1];
          if (Math.abs(pny - 0.5) >= O.lateRunWide) for (const a of s.agents) {
            if (!a.onPitch || a.team !== passer.team || !isWide(a) || a === passer) continue;
            if (Math.sign(a.sy - 0.5) === Math.sign(pny - 0.5)) continue;
            const side = pny < 0.5 ? -1 : 1;
            const [tx, ty] = toPitch(1 - O.backPostDepth / L, 0.5 - side * O.backPostSpread, dir);
            pendingCross.push({ a, tEnd: fl.t0 + fl.dur, tx, ty, side });
            const g = a.pos === 'LM' || a.pos === 'RM' ? 'LM/RM' : 'LW/RW';
            const w = W_[g]!.opp;
            w.cross++;
            if (fl.receiver === a.idx) w.crossTarget++;
          }
        }
      }
      for (let k = pendingCross.length - 1; k >= 0; k--) {
        const c = pendingCross[k]!;
        if (s.t + 1e-9 < c.tEnd + 0.3) continue;
        const g = c.a.pos === 'LM' || c.a.pos === 'RM' ? 'LM/RM' : 'LW/RW';
        const w = W_[g]!.opp;
        w.crossD.push(dist(c.a.x, c.a.y, c.tx, c.ty));
        if (inOppBox(c.a.x, c.a.y, attackDir(c.a.team, s.half))) w.crossBox++;
        if (s.ball.owner === c.a.idx) w.crossGot++;
        pendingCross.splice(k, 1);
      }
      if (s.tick % 10 === 0 && owner && !s.restart) for (const a of s.agents) {
        if (!a.onPitch || !isWide(a) || a.team !== owner.team) continue;
        const dir = attackDir(a.team, s.half);
        if (toNorm(s.ball.x, s.ball.y, dir)[0] < 2 / 3) continue;
        const g = a.pos === 'LM' || a.pos === 'RM' ? 'LM/RM' : 'LW/RW';
        boxCnt[g]![0]!++;
        if (inOppBox(a.x, a.y, dir)) boxCnt[g]![1]!++;
      }
      eps = eps.filter((e) => {
        if (!e.done) return true;
        const g = e.a.pos === 'LM' || e.a.pos === 'RM' ? 'LM/RM' : 'LW/RW';
        const w = W_[g]![e.side];
        w.eps++;
        if (e.nx0 >= 2 / 3) w.already++;
        if (e.t3 !== undefined) w.reach3.push(e.t3);
        if (e.t8 !== undefined) { w.reach8.push(e.t8); w.cap8.push(e.t8); } else if (!e.lost8) w.cap8.push(10);
        if (e.tBox !== undefined) w.reachBox.push(e.tBox);
        if (e.lost) w.lost++;
        if (e.p3) w.at3s.push(e.p3);
        return false;
      });
    }
  }
  console.log(`\nC.78e wide 분해 · 엔진 ${ENGINE_VERSION} · ${N}경기 (4-4-2 대 4-3-3, 홈/원정 번갈아) · LM/RM 역할 ${role ?? '기본'}`);
  console.log('| 측면 | 공 쪽 | 진입 수 | 진입 때 이미 ⅓ % | ⅓ 도착 % (10초) | ⅓ 도착 평균 s | 중앙값 s | 박스 도착 % | 박스 도착 평균 s | 도착 전 공 잃음 % | 3초 뒤 x | 3초 뒤 터치라인 거리 m | 3초 뒤 박스 % | 깊이 x≥DEEP 도착 % | 깊이 도착 평균 s | 깊이 도착 s (못 오면 10, 공 잃음 제외) |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const g of ['LM/RM', 'LW/RW']) for (const sd of ['same', 'opp'] as const) {
    const w = W_[g]![sd];
    const med = w.reach3.slice().sort((a, b) => a - b)[Math.floor(w.reach3.length / 2)] ?? NaN;
    console.log(`| ${g} | ${sd === 'same' ? '같은 쪽' : '반대쪽'} | ${w.eps} | ${pct(w.already, w.eps)} | ${pct(w.reach3.length, w.eps)} | ${f2(avg(w.reach3))} | ${f2(med)} | ${pct(w.reachBox.length, w.eps)} | ${f2(avg(w.reachBox))} | ${pct(w.lost, w.eps)} | ${f2(avg(w.at3s.map((p) => p[0])))} | ${f2(W / 2 - avg(w.at3s.map((p) => p[1])))} | ${pct(w.at3s.filter((p) => p[2]).length, w.at3s.length)} | ${pct(w.reach8.length, w.eps)} | ${f2(avg(w.reach8))} | ${f2(avg(w.cap8))} |`);
  }
  console.log('\n반대쪽 측면 크로스 (먼 포스트 = 골라인 8 m·중앙에서 0.1 폭):');
  console.log('| 측면 | 크로스 수 | 착지 때 먼 포스트 거리 m | 착지 때 박스 % | 그 선수가 크로스 대상 % | 받음 % |');
  console.log('|---|---|---|---|---|---|');
  for (const g of ['LM/RM', 'LW/RW']) {
    const w = W_[g]!.opp;
    console.log(`| ${g} | ${w.cross} | ${f2(avg(w.crossD))} | ${pct(w.crossBox, w.crossD.length)} | ${pct(w.crossTarget, w.cross)} | ${pct(w.crossGot, w.crossD.length)} |`);
  }
  console.log(`\n최종 ⅓ 공격 중 박스 안 비율: LM/RM ${pct(boxCnt['LM/RM']![1]!, boxCnt['LM/RM']![0]!)}% · LW/RW ${pct(boxCnt['LW/RW']![1]!, boxCnt['LW/RW']![0]!)}%`);
}

// ───────────────────────── nine ─────────────────────────
interface NAcc {
  games: number; stRec: number; drop: number; follow: number; cbAhead: number[]; cbD: number[]; gap: number[]; gapNo: number[]; run: number; runT: number[]; passTry: number; passOk: number; shot8: number;
  shotAfterNo: number; turn: number; turnFollow: number; layoff1: number; fwdPass: number; goals: number; shots: number; l2Goals: number; stGoals: number; dropTicks: number; possTicks: number; oppGoals: number;
}
const nacc = (): NAcc => ({ games: 0, stRec: 0, drop: 0, follow: 0, cbAhead: [], cbD: [], gap: [], gapNo: [], run: 0, runT: [], passTry: 0, passOk: 0, shot8: 0, shotAfterNo: 0, turn: 0, turnFollow: 0, layoff1: 0, fwdPass: 0, goals: 0, shots: 0, l2Goals: 0, stGoals: 0, dropTicks: 0, possTicks: 0, oppGoals: 0 });
interface Chain { st: Agent; t0: number; follow: boolean; px: number; py: number; cb: Agent | null; runner: Agent | null; runT?: number; tried: boolean; ok: boolean; shot: boolean; turned: boolean; x0: number; done: boolean; firstAct: boolean }
/** 상대 수비 줄(line 1) 중 cb 를 뺀 평균 x(우리 공격 방향 정규화) */
function defLineX(s: SimState, defTeam: number, dir: 1 | -1, except: Agent | null): number {
  let t = 0, n = 0;
  for (const o of s.agents) if (o.onPitch && o.team === defTeam && o.line === 1 && o !== except) { t += toNorm(o.x, o.y, dir)[0]; n++; }
  return n ? t / n : 1;
}
function runNine(): void {
  const roles = [args[2] ?? 'falseNine', args[3] ?? 'poacher'];
  const res: Record<string, NAcc> = {};
  for (const role of roles) {
    const A = (res[role] = nacc());
    for (let i = 0; i < N; i++) {
      const seed = SEED0 + i;
      const pair: Record<number, string> = process.env.PAIR === '0' ? {} : { 8: 'wingForward', 10: 'wingForward', 6: 'boxToBox' };
      const me = mk('N', i, '4-3-3', { ...pair, 9: role });
      const op = mk('O', i, '4-3-3', {});
      const home = i % 2 === 0;
      const tm = home ? 0 : 1;
      const m = createMatch({ home: home ? me : op, away: home ? op : me, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
      const s = m.state;
      A.games++;
      let prevOwner = -1;
      let chains: Chain[] = [];
      let flightSeen: unknown = null;
      const shotsPrev = new Map(s.agents.map((a) => [a, a.stats.shots]));
      while (!s.done) {
        m.step();
        const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
        const dir = attackDir(tm as 0 | 1, s.half);
        let teamShot = false;
        for (const a of s.agents) if (a.stats.shots > shotsPrev.get(a)!) { shotsPrev.set(a, a.stats.shots); if (a.team === tm) teamShot = true; }
        const st = s.agents.find((a) => a.onPitch && a.team === tm && (a.pos === 'ST' || a.pos === 'CF'));
        if (owner && owner.team === tm && !s.restart && st) {
          A.possTicks++;
          if ((offsideLine(s, tm as 0 | 1) - toNorm(st.x, st.y, dir)[0]) * L >= 4) A.dropTicks++;
        }
        // ST 패스 수신
        if (owner && st && owner === st && prevOwner !== st.idx && s.lastPass && s.lastPass.receiver === st.idx && s.t - s.lastPass.t < 3 && !s.restart) {
          A.stRec++;
          const [gx, gy] = oppGoal(dir);
          const gd = dist(st.x, st.y, gx, gy);
          const behind = (offsideLine(s, tm as 0 | 1) - toNorm(st.x, st.y, dir)[0]) * L;
          if (behind >= 4 && gd >= 18 && gd <= 50) {
            A.drop++;
            // 가장 가까운 상대 CB
            let cb: Agent | null = null; let bd = Infinity;
            for (const o of s.agents) if (o.onPitch && o.team !== tm && o.pos === 'CB') { const d = dist(o.x, o.y, st.x, st.y); if (d < bd) { bd = d; cb = o; } }
            const lx = defLineX(s, 1 - tm, dir, cb);
            const ahead = cb ? (lx - toNorm(cb.x, cb.y, dir)[0]) * L : 0; // 상대 기준 앞 = 우리 기준 x 가 작다
            const follow = !!cb && (ahead >= 3 || bd <= 3);
            A.cbAhead.push(ahead);
            A.cbD.push(bd);
            // 빈자리: 그 CB 의 y, 나머지 수비 줄 x
            const [px, py] = cb ? toPitch(lx, toNorm(cb.x, cb.y, dir)[1], dir) : [0, 0];
            let free = 30;
            for (const o of s.agents) if (o.onPitch && o.team !== tm && o !== cb && o.pos !== 'GK') free = Math.min(free, dist(o.x, o.y, px, py));
            if (follow) { A.follow++; A.gap.push(free); } else A.gapNo.push(free);
            chains.push({ st, t0: s.t, follow, px, py, cb, runner: null, tried: false, ok: false, shot: false, turned: false, x0: toNorm(st.x, st.y, dir)[0], done: false, firstAct: false });
          }
        }
        // 비행 시작: 연결 패스
        const fl = s.ball.flight;
        const newFl = fl && fl !== flightSeen;
        if (newFl) flightSeen = fl;
        for (const c of chains) {
          if (c.done) continue;
          const el = s.t - c.t0;
          // 동료 침투: 3초 안 빈자리 5 m 안 (ST 제외, 줄 2·3)
          if (!c.runner && el >= 0 && el <= 3) for (const a of s.agents) {
            if (!a.onPitch || a.team !== tm || a === c.st || a.line < 2) continue;
            const [anx, any] = toNorm(a.x, a.y, dir);
            const [gnx, gny] = toNorm(c.px, c.py, dir);
            if (Math.abs(any - gny) * W <= 8 && (anx - gnx) * L >= -3) { c.runner = a; c.runT = el; break; }
          }
          // ST 첫 행동
          if (!c.firstAct && newFl && fl!.passer === c.st.idx) {
            c.firstAct = true;
            if (el <= 0.6) A.layoff1++;
            const [tnx] = toNorm(fl!.toX, fl!.toY, dir);
            if ((tnx - c.x0) * L >= 5) { A.fwdPass++; if (!c.follow) c.turned = true; }
          }
          if (newFl && el <= 4 && s.agents[fl!.passer]?.team === tm && fl!.kind !== 'shot') {
            const [tnx, tny] = toNorm(fl!.toX, fl!.toY, dir);
            const [gnx, gny] = toNorm(c.px, c.py, dir);
            const r = fl!.receiver >= 0 ? s.agents[fl!.receiver]! : null;
            if (r && r !== c.st && Math.abs(tny - gny) * W <= 8 && (tnx - gnx) * L >= -3) { c.tried = true; c.runner = r; }
          }
          if (c.tried && !c.ok && owner && owner === c.runner) c.ok = true;
          if (!c.turned && !c.follow && owner === c.st && el <= 2.5 && (toNorm(c.st.x, c.st.y, dir)[0] - c.x0) * L >= 3) c.turned = true;
          if (teamShot && el <= 8) c.shot = true;
          if (el > 8 || el < 0 || (owner && owner.team !== tm) || s.restart) c.done = true;
        }
        chains = chains.filter((c) => {
          if (!c.done) return true;
          if (c.follow) {
            if (c.runner && c.runT !== undefined && c.runT <= 3) { A.run++; A.runT.push(c.runT); }
            if (c.tried) A.passTry++;
            if (c.ok) A.passOk++;
            if (c.shot) A.shot8++;
            if (c.turned) A.turnFollow++;
          } else {
            if (c.turned) A.turn++;
            if (c.shot) A.shotAfterNo++;
          }
          return false;
        });
        prevOwner = owner ? owner.idx : -1;
      }
      const tg = s.teams[tm]!.stats.goals;
      A.goals += tg;
      A.oppGoals += s.teams[1 - tm]!.stats.goals;
      for (const a of s.agents) if (a.team === tm) { A.shots += a.stats.shots; if (a.pos === 'ST' || a.pos === 'CF') A.stGoals += a.stats.goals; else if (a.line >= 2) A.l2Goals += a.stats.goals; }
    }
  }
  console.log(`\nC.78e nine 연결 고리 · 엔진 ${ENGINE_VERSION} · 역할마다 ${N}경기 (4-3-3 대 4-3-3 균형${process.env.PAIR === '0' ? '' : ', 짝 조건 윙 포워드 ×2 + 박스투박스'})`);
  console.log('| 역할 | ST 패스 수신/경기 | 내려와 받음/경기 (4 m+ 뒤, 골 18~50 m) | 공 가진 시간 중 ST 4 m+ 내려옴 % | CB 따라감 % | CB 라인 앞 m | CB–ST m | 빈자리 m (따라감) | 빈자리 m (안 따라감) | 동료 침투 % (따라감, 3초) | 침투 s | 그 동료에게 패스 % | 성공 % | 슛 8초 % (따라감) | 0.6초 안 첫 패스 % | 전진 패스 % | 안 따라감 → 돌아서 전진 % | 안 따라감 → 슛 8초 % |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const role of roles) {
    const A = res[role]!;
    const g = A.games;
    const no = A.drop - A.follow;
    console.log(`| ${role} | ${f2(A.stRec / g)} | ${f2(A.drop / g)} | ${pct(A.dropTicks, A.possTicks)} | ${pct(A.follow, A.drop)} | ${f2(avg(A.cbAhead))} | ${f2(avg(A.cbD))} | ${f2(avg(A.gap))} | ${f2(avg(A.gapNo))} | ${pct(A.run, A.follow)} | ${f2(avg(A.runT))} | ${pct(A.passTry, A.follow)} | ${pct(A.passOk, A.follow)} | ${pct(A.shot8, A.follow)} | ${pct(A.layoff1, A.drop)} | ${pct(A.fwdPass, A.drop)} | ${pct(A.turn, no)} | ${pct(A.shotAfterNo, no)} |`);
  }
  console.log('\n| 역할 | 득점 | 실점 | 슛 | ST 골 | 2선 골 |');
  console.log('|---|---|---|---|---|---|');
  for (const role of roles) { const A = res[role]!; const g = A.games; console.log(`| ${role} | ${f2(A.goals / g)} | ${f2(A.oppGoals / g)} | ${f2(A.shots / g)} | ${f2(A.stGoals / g)} | ${f2(A.l2Goals / g)} |`); }
}

if (MODE === 'nine') runNine(); else runWide();
process.exit(0);
