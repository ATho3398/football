// 진단 (12단계 A): 순간이동, 골 뒤 킥오프 대기·정지, GK 루즈볼 무반응을 틱 단위로 센다.
// C.24: 공 순간이동(비행 중이 아닌 공의 틱당 3 m 초과)과 킥오프 순간 자기 진영 측정을 더했다.
// C.28: GK 추격(횟수, 추격 중 실점), 침투 패스(상대 GK 유형별 시도·수신, GK 가 끊음)를 더했다. GKTYPE=sweeper|classic 이면 양 팀 GK 유형을 고정한다.
// 실행: npx vite-node scripts/diag/polish-a.ts -- [경기수=10] [홈레이팅=78] [원정레이팅=76]
// 엔진 코드는 건드리지 않고 createMatch().step() 을 한 틱씩 돌리며 상태를 읽는다.
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { keeperOf } from '../../src/engine/keeper';
import { attackDir, dist, L, W } from '../../src/engine/pitch';
import type { SimState } from '../../src/engine/state';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCED } from '../engine/job';

const args = process.argv.slice(2).filter((a) => a !== '--');
const N = Number(args[0] ?? 10);
const RH = Number(args[1] ?? 78);
const RA = Number(args[2] ?? 76);

const mk = (side: string, i: number, rating: number, opp: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating }, `diagA-${side}-${rating}-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), opp, `wA${i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  const gkType = process.env.GKTYPE as 'sweeper' | 'classic' | undefined;
  if (gkType) for (const p of [...s.lineup, ...s.bench]) if (p.gk) p.gk = { ...p.gk, type: gkType };
  return s;
};
// C.28: GK 추격 에피소드와 추격 중 실점, 침투 패스 (상대 GK 유형별)
const chase = { n: 0, gk: 0, outBox: 0, conceded: 0 };
const recvBy: Record<string, number> = { classic: 0, sweeper: 0 };
const thru: Record<string, { tries: number; recv: number; gkCut: number }> = { classic: { tries: 0, recv: 0, gkCut: 0 }, sweeper: { tries: 0, recv: 0, gkCut: 0 } };

const JUMP = 1.0; // 틱(0.1초)당 이 거리(m)를 넘으면 순간이동. 최대 속도 9.1 m/s → 0.91 m/틱
const jumps: Record<string, { n: number; sum: number; max: number }> = {};
const bump = (k: string, d: number) => {
  const j = (jumps[k] ??= { n: 0, sum: 0, max: 0 });
  j.n++;
  j.sum += d;
  j.max = Math.max(j.max, d);
};

// 공 순간이동 (C.24): 비행 중이 아닌 공이 틱당 BALL_JUMP m 넘게 이동 (재개 배치·하프타임 제외, 직전 공 속도 × 0.1초는 빼고 본다)
const BALL_JUMP = 3.0;
const ballJumps: Record<string, { n: number; sum: number; max: number }> = {};
// 킥오프 순간 양 팀 전원이 자기 진영인가 (C.24)
let kickoffs = 0;
let kickoffsOk = 0;
let kickoffOut = 0;
// 골 뒤 킥오프
const kick: { wait: number; settle: number; settleAll: number }[] = [];
// GK 루즈볼 에피소드
type Ep = { kind: string; team: 0 | 1; sweeper: boolean; gkLead: number; t0: number; gkMoved: number; outcome: string; reachable: boolean; ballSp: number; gkEta: number; outEta: number };
const eps: Ep[] = [];

function inBoxOf(s: SimState, team: 0 | 1, x: number, y: number): boolean {
  const dir = attackDir(team, s.half);
  const gx = dir > 0 ? 0 : L;
  return Math.abs(x - gx) <= ENGINE.pitch.boxDepth && Math.abs(y - W / 2) <= ENGINE.pitch.boxWidth / 2;
}

for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('a', i, RH, RA), away: mk('b', i, RA, RH), mode: 'auto', difficulty: 'normal', seed: 5000 + i, bigMatch: false, neutral: true });
  const s = m.state;
  let prev = new Map(s.agents.map((a) => [a, [a.x, a.y] as [number, number]]));
  let prevOwner = s.ball.owner;
  let prevRestart = s.restart;
  let prevHalf = s.half;
  let prevEvents = s.events.length;
  let prevBall: [number, number] = [s.ball.x, s.ball.y];
  let prevFlight = !!s.ball.flight;
  let prevSpeed = 0;
  let goalAt = -1;
  let settled = -1;
  let cur: Ep | null = null;
  const chasing: [number, number] = [-1, -1]; // 추격 시작 시각
  const chaseFail: [number, number] = [-100, -100]; // GK 가 공을 못 얻고 끝난 추격의 끝 시각
  let lastFlight: unknown = null;
  while (!s.done) {
    m.step();
    for (const team of [0, 1] as const) {
      const gk = keeperOf(s, team);
      const on = s.teams[team].gkChase && s.ball.owner < 0 && !s.restart;
      if (on && chasing[team] < 0) {
        chasing[team] = s.t;
        chase.n++;
        if (gk && !inBoxOf(s, team, gk.tx, gk.ty)) chase.outBox++;
      } else if (!on && chasing[team] >= 0) {
        if (gk && s.ball.owner === gk.idx) chase.gk++;
        else chaseFail[team] = s.t;
        chasing[team] = -1;
      }
    }
    for (const e of s.events.slice(prevEvents)) {
      if (e.type !== 'goal') continue;
      const conc = (1 - e.team) as 0 | 1;
      if (chasing[conc] >= 0 || s.t - chaseFail[conc] <= 10) chase.conceded++;
    }
    const fl = s.ball.flight;
    if (fl && fl !== lastFlight && fl.through) {
      const att = s.agents[fl.passer]!.team;
      const gk = keeperOf(s, (1 - att) as 0 | 1);
      const k = thru[gk?.gk?.type === 'sweeper' ? 'sweeper' : 'classic']!;
      k.tries++;
      if (fl.outcome === 'intercept' && s.agents[fl.interceptor]?.line === 0) k.gkCut++;
    }
    lastFlight = fl;
    const newEvents = s.events.slice(prevEvents);
    const saved = newEvents.some((e) => e.type === 'save');
    const halfFlip = s.half !== prevHalf;
    const restartDone = prevRestart && !s.restart;
    const newOwner = s.ball.owner !== prevOwner ? s.ball.owner : -1;
    for (const a of s.agents) {
      if (!a.onPitch) continue;
      const pp = prev.get(a);
      if (!pp) continue;
      const d = dist(pp[0], pp[1], a.x, a.y);
      if (d <= JUMP) continue;
      if (halfFlip) { bump('하프타임 대형 (정상)', d); continue; }
      let k = '그 밖';
      if (restartDone && prevRestart!.taker === a.idx) k = `재개 키커 ${prevRestart!.type}`;
      else if (a.line === 0 && newOwner === a.idx && saved) k = 'GK 세이브 캐치';
      else if (a.line === 0 && newOwner === a.idx) k = 'GK 공중볼 처리/소유';
      else if (newOwner === a.idx) k = '공 소유 시작 (받기/가로채기/공중볼)';
      else if (newEvents.some((e) => e.type === 'shot' && e.players[0] === a.id)) k = '헤더 슈팅 전 착지점 이동';
      bump(k, d);
    }
    // 공 순간이동
    {
      // 구르는 공은 직전 속도만큼 움직이는 것이 정상: 그만큼 빼고 본다
      const bd = dist(prevBall[0], prevBall[1], s.ball.x, s.ball.y) - (prevOwner >= 0 ? 0 : prevSpeed * ENGINE.time.dt);
      const restartSet = !!s.restart && s.restart !== prevRestart;
      if (bd > BALL_JUMP && !s.ball.flight && !halfFlip && !restartSet) {
        const ev = newEvents.map((e) => e.type).join(',');
        const own = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
        const k = restartDone ? `재개 실행 ${prevRestart!.type}`
          : prevFlight ? '비행 끝'
          : own && newOwner >= 0 ? `소유 시작 (${own.line === 0 ? 'GK' : '필드'}${ev ? ' ' + ev : ''})`
          : own ? `소유 중 (${ev || '이벤트 없음'})`
          : `루즈볼 (${prevOwner >= 0 ? '직전 소유' : '직전 루즈'}${ev ? ' ' + ev : ''})`;
        const j = (ballJumps[k] ??= { n: 0, sum: 0, max: 0 });
        j.n++;
        j.sum += bd;
        j.max = Math.max(j.max, bd);
      }
    }
    // 킥오프 순간 자기 진영 (공에서 1 m 안 키커는 센터 서클 점 허용)
    if (restartDone && prevRestart!.type === 'kickoff') {
      kickoffs++;
      let ok = true;
      for (const a of s.agents) {
        if (!a.onPitch) continue;
        const own = (a.x - L / 2) * attackDir(a.team, s.half) <= (a.idx === prevRestart!.taker ? 1.0 : 0.05);
        if (!own) { ok = false; kickoffOut++; }
      }
      if (ok) kickoffsOk++;
    }
    // 골 → 킥오프
    for (const e of newEvents) if (e.type === 'goal') { goalAt = s.t; settled = -1; }
    if (goalAt >= 0 && s.restart?.type === 'kickoff') {
      const moving = s.agents.filter((a) => a.onPitch && Math.hypot(a.vx, a.vy) > 0.3).length;
      if (settled < 0 && moving === 0) settled = s.t;
    }
    if (goalAt >= 0 && restartDone && prevRestart!.type === 'kickoff') {
      kick.push({ wait: s.t - goalAt, settle: settled >= 0 ? settled - goalAt : NaN, settleAll: settled >= 0 ? s.t - settled : NaN });
      goalAt = -1;
    }
    // GK 루즈볼: 공 주인 없음, 비행 아님(또는 루즈 비행), 재개 아님, 어느 팀 박스 안
    const b = s.ball;
    const loose = b.owner < 0 && !s.restart && (!b.flight || b.flight.outcome === 'loose'); // 구르는 공 + 루즈 비행(빗나간 패스·클리어)
    if (cur) {
      // 에피소드 종료 판정
      let out: string | null = null;
      if (b.owner >= 0) {
        const o = s.agents[b.owner]!;
        out = o.line === 0 && o.team === cur.team ? 'GK 처리' : o.team === cur.team ? '우리 수비수 처리' : '상대 소유';
      } else if (s.restart) {
        const r = s.restart;
        out = r.team === cur.team ? `우리 ${r.type}` : `상대 ${r.type}`;
      } else if (b.flight && b.flight.outcome !== 'loose') out = '비행(패스 등)';
      if (out) {
        cur.outcome = out;
        eps.push(cur);
        cur = null;
      } else {
        const gk = keeperOf(s, cur.team);
        if (gk) cur.gkMoved = Math.max(cur.gkMoved, Math.hypot(gk.vx, gk.vy));
      }
    }
    if (!cur && loose) {
      const fl = b.flight;
      const px = fl ? fl.toX : b.x;
      const py = fl ? fl.toY : b.y;
      for (const team of [0, 1] as const) {
        if (!inBoxOf(s, team, px, py)) continue;
        const gk = keeperOf(s, team);
        if (!gk) continue;
        const gd = dist(gk.x, gk.y, px, py);
        let od = Infinity;
        for (const o of s.agents) if (o.onPitch && o !== gk) od = Math.min(od, dist(o.x, o.y, px, py));
        if (od - gd >= 3) {
          // GK 도착 시간(반응 0.5초 + 거리/7 m/s) 대 공이 라인 밖으로 나가는 시간 (등감속 굴림, 비행 중이면 비행 끝 + 굴림)
          const sp = fl ? 0 : Math.hypot(b.vx, b.vy);
          const gkEta = 0.5 + gd / 7;
          const flightLeft = fl ? Math.max(0, fl.t0 + fl.dur - s.t) : 0;
          let outEta = fl ? (px < 0 || px > L || py < 0 || py > W ? flightLeft : Infinity) : Infinity;
          if (sp > 0.1) {
            const dec = ENGINE.ball.groundDecel;
            const stopT = sp / dec;
            // 라인까지 거리 (진행 방향)
            const ux = b.vx / sp; const uy = b.vy / sp;
            const tx = ux > 0 ? (L - b.x) / ux : ux < 0 ? -b.x / ux : Infinity;
            const ty = uy > 0 ? (W - b.y) / uy : uy < 0 ? -b.y / uy : Infinity;
            const dOut = Math.min(tx, ty);
            const stopD = (sp * sp) / (2 * dec);
            if (dOut < stopD) { const disc = sp * sp - 2 * dec * dOut; outEta = (sp - Math.sqrt(Math.max(0, disc))) / dec; }
            void stopT;
          }
          cur = { kind: fl ? `비행 착지(${fl.kind})` : '구르는 공', team, sweeper: gk.gk?.type === 'sweeper', gkLead: od - gd, t0: s.t, gkMoved: Math.hypot(gk.vx, gk.vy), outcome: '', reachable: gkEta < outEta && gkEta < flightLeft + 2, ballSp: sp, gkEta, outEta };
          break;
        }
      }
    }
    prev = new Map(s.agents.map((a) => [a, [a.x, a.y] as [number, number]]));
    prevBall = [s.ball.x, s.ball.y];
    prevFlight = !!s.ball.flight;
    // 비행 중이면 비행 속도 (마지막 비행 틱의 이동은 정상)
    prevSpeed = s.ball.flight ? Math.hypot(s.ball.flight.toX - s.ball.flight.fromX, s.ball.flight.toY - s.ball.flight.fromY) / Math.max(0.05, s.ball.flight.dur) : Math.hypot(s.ball.vx, s.ball.vy);
    prevOwner = s.ball.owner;
    prevRestart = s.restart;
    prevHalf = s.half;
    prevEvents = s.events.length;
  }
  for (const team of [0, 1] as const) {
    const gk = keeperOf(s, (1 - team) as 0 | 1);
    recvBy[gk?.gk?.type === 'sweeper' ? 'sweeper' : 'classic']! += s.teams[team].stats.throughReceived;
  }
}

console.log(`\n== 순간이동 (틱당 ${JUMP} m 초과 이동), ${N}경기 ${RH} 대 ${RA} 중립 ==`);
for (const [k, j] of Object.entries(jumps).sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${k.padEnd(32)} 경기당 ${(j.n / N).toFixed(1)}회  평균 ${(j.sum / j.n).toFixed(1)} m  최대 ${j.max.toFixed(1)} m`);
}
const nJump = Object.entries(jumps).filter(([k]) => !k.startsWith('하프타임')).reduce((t, [, j]) => t + j.n, 0);
console.log(`  → 하프타임 제외 합계 ${nJump}회`);
console.log(`\n== 공 순간이동 (비행 중이 아닌 공, 틱당 ${BALL_JUMP} m 초과, 재개 배치·하프타임 제외) ==`);
for (const [k, j] of Object.entries(ballJumps).sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${k.padEnd(32)} 경기당 ${(j.n / N).toFixed(1)}회  평균 ${(j.sum / j.n).toFixed(1)} m  최대 ${j.max.toFixed(1)} m`);
}
console.log(`  → 합계 ${Object.values(ballJumps).reduce((t, j) => t + j.n, 0)}회`);
console.log(`\n== 킥오프 순간 전원 자기 진영: ${kickoffsOk}/${kickoffs} (${((100 * kickoffsOk) / Math.max(1, kickoffs)).toFixed(0)}%), 벗어난 선수 ${kickoffOut}명 ==`);
const mean = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : NaN);
console.log(`\n== 골 뒤 킥오프 (${kick.length}골) ==`);
console.log(`  골 → 킥오프 대기 평균 ${mean(kick.map((k) => k.wait)).toFixed(1)}초 (범위 ${Math.min(...kick.map((k) => k.wait)).toFixed(0)}~${Math.max(...kick.map((k) => k.wait)).toFixed(0)})`);
console.log(`  골 → 모두 정지 평균 ${mean(kick.map((k) => k.settle).filter((x) => !Number.isNaN(x))).toFixed(1)}초, 정지 상태로 기다린 시간 평균 ${mean(kick.map((k) => k.settleAll).filter((x) => !Number.isNaN(x))).toFixed(1)}초`);
console.log(`\n== GK 루즈볼 (박스 안, GK 가 다른 모든 선수보다 3 m 이상 가까움) ${eps.length}회 (경기당 ${(eps.length / N).toFixed(1)}) ==`);
const by: Record<string, number> = {};
for (const e of eps) by[e.outcome] = (by[e.outcome] ?? 0) + 1;
for (const [k, n] of Object.entries(by).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(20)} ${n} (${((100 * n) / eps.length).toFixed(0)}%)`);
console.log(`  클래식 ${eps.filter((e) => !e.sweeper).length} / 스위퍼 ${eps.filter((e) => e.sweeper).length}, GK 우위 평균 ${mean(eps.map((e) => e.gkLead)).toFixed(1)} m, 에피소드 중 GK 최대 속도 평균 ${mean(eps.map((e) => e.gkMoved)).toFixed(2)} m/s`);
for (const kind of [...new Set(eps.map((e) => e.kind))]) {
  const es = eps.filter((e) => e.kind === kind);
  const byK: Record<string, number> = {};
  for (const e of es) byK[e.outcome] = (byK[e.outcome] ?? 0) + 1;
  console.log(`  [${kind}] ${es.length}회: ${Object.entries(byK).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')} · GK 가 먼저 닿을 수 있음 ${es.filter((e) => e.reachable).length}`);
}
const reach = eps.filter((e) => e.reachable);
console.log(`  GK 가 라인 아웃 전에 닿을 수 있는 경우(반응 0.5초 + 7 m/s): ${reach.length} (${((100 * reach.length) / eps.length).toFixed(0)}%), 그중 결과: ${Object.entries(reach.reduce((r, e) => ((r[e.outcome] = (r[e.outcome] ?? 0) + 1), r), {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`  시작 시 공 속도 평균 ${mean(eps.map((e) => e.ballSp)).toFixed(1)} m/s, GK 도착 평균 ${mean(eps.map((e) => e.gkEta)).toFixed(1)}초, 아웃까지 평균(유한만) ${mean(eps.map((e) => e.outEta).filter((x) => Number.isFinite(x))).toFixed(1)}초, 멈추는 공(아웃 안 됨) ${eps.filter((e) => !Number.isFinite(e.outEta)).length}`);
console.log(`\n== C.28 GK 추격 ==`);
console.log(`  추격 ${chase.n}회 (경기당 ${(chase.n / N).toFixed(1)}), GK 가 공을 얻음 ${chase.gk} (${((100 * chase.gk) / Math.max(1, chase.n)).toFixed(0)}%), 박스 밖 추격 ${chase.outBox}, 추격 중·실패 10초 안 실점 ${chase.conceded} (경기당 ${(chase.conceded / N).toFixed(2)})`);
for (const [k, v] of Object.entries(thru)) console.log(`  침투 패스 (상대 GK ${k}): 시도 ${v.tries}, 수신 ${recvBy[k]} (경기당 ${(recvBy[k]! / N).toFixed(2)}), GK 가 끊음 ${v.gkCut} (${((100 * v.gkCut) / Math.max(1, v.tries)).toFixed(0)}%)`);
process.exit(0);
