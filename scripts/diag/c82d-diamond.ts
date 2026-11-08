// @ts-nocheck — 진단 스크립트 (C.82d): 대형 A(기본 4-3-1-2) 대 B(기본 4-4-2)에서 A 의 골·슈팅이 어디서 나오나.
// 포지션별 골·슈팅·xG, 골 경로, 어시스트(마지막 패서) 포지션, 수신(패스 받은 순간)마다 받은 선수 포지션 · 정규화 x 구간 · 가장 가까운 상대 거리·포지션 ·
// 줄 사이(상대 수비 줄~중원 줄 사이) 여부 · 받은 뒤 5초 안 슈팅·골. 엔진 상태는 읽기만. 홈·원정 짝(같은 시드 두 번, 자리 바꿈).
// 실행: npx vite-node scripts/diag/c82d-diamond.ts -- [경기수=200] [seed=71000] [A=4-3-1-2] [B=4-4-2] [경로=값 …]
import { applyOverrides, buildTeam } from '../engine/job';
import { createMatch } from '../../src/engine/sim';
import { attackDir, toNorm, L, W } from '../../src/engine/pitch';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ov: Record<string, number> = {};
let n = 200, seed0 = 71000, FA = '4-3-1-2', FB = '4-4-2';
for (const a of args) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('A=')) FA = a.slice(2);
  else if (a.startsWith('B=')) FB = a.slice(2);
  else if (a.includes('=')) { const [k, v] = a.split('='); ov[k] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
const restore = applyOverrides(ov);
const inc = (o, k, v = 1) => (o[k] = (o[k] ?? 0) + v);
const mk = () => ({ goals: 0, shots: 0, xg: 0, gPos: {}, sPos: {}, xgPos: {}, gPath: {}, assistPos: {}, assistPosGoal: {},
  // 수신: 포지션 → { n, near(거리 합), free(3 m 안 상대 없음), pocket(줄 사이), xzone[4], shot5, goal5, nearPos{} , fromPos{} }
  recv: {}, throughRecv: 0, boxRecv: {}, passesTo: {}, roles: {}, poss: 0, passes: 0, thruAtt: {}, thruOk: {}, thruX: [0, 0, 0, 0], thruOkX: [0, 0, 0, 0], thruShot5: 0, thruGoal5: 0, thruShotByRecv: {}, shotAfterThru: 0, xgAfterThru: 0, shotAfterPlain: 0, xgAfterPlain: 0, shotNoRecv: 0, xgNoRecv: 0 });
const R: any = { matches: 0, A: mk(), B: mk() };
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

for (let k = 0; k < n; k++) {
  const seed = seed0 + Math.floor(k / 2); const flip = k % 2 === 1;
  const specA = { id: `va${seed}`, rating: 75, seed: `eng-a-75-${seed}`, formation: FA, tactics: 'balanced' };
  const specB = { id: `vb${seed}`, rating: 75, seed: `eng-b-75-${seed}`, formation: FB, tactics: 'balanced' };
  const ws = `w${seed}`;
  const home = buildTeam(flip ? specB : specA, 75, ws), away = buildTeam(flip ? specA : specB, 75, ws);
  const sim = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const teamA = flip ? 1 : 0;
  const side = (tm) => (tm === teamA ? R.A : R.B);
  if (k < 2) for (const a of s.agents) if (a.team === teamA && a.line !== 0) inc(R.A.roles, `${a.pos}:${a.role.id}`);
  if (k < 2) for (const a of s.agents) if (a.team !== teamA && a.line !== 0) inc(R.B.roles, `${a.pos}:${a.role.id}`);
  let lastSeen = s.lastPass;
  const watch: any[] = []; // 수신 뒤 5초 관찰
  let lastFl: any = null; let pendThru: any = null;
  while (!s.done) {
    const evLen = s.events.length;
    sim.step();
    const fl = s.ball.flight;
    if (fl && fl !== lastFl) {
      lastFl = fl;
      if (fl.through && fl.passer >= 0) {
        const p = s.agents[fl.passer];
        if (p && p.line !== 0) {
          const T = side(p.team); const dir = attackDir(p.team, s.half); const px = toNorm(fl.fromX, fl.fromY, dir)[0];
          inc(T.thruAtt, p.pos); T.thruX[px < 0.4 ? 0 : px < 0.6 ? 1 : px < 0.8 ? 2 : 3]++;
          pendThru = { passer: fl.passer, receiver: fl.receiver, t0: fl.t0, pos: p.pos, xz: px < 0.4 ? 0 : px < 0.6 ? 1 : px < 0.8 ? 2 : 3 };
        }
      }
    }
    // 수신 감지
    if (s.lastPass && s.lastPass !== lastSeen) {
      lastSeen = s.lastPass;
      const r = s.agents[s.lastPass.receiver], p = s.agents[s.lastPass.passer];
      if (r && p && r.team === p.team) {
        const T = side(r.team);
        const dir = attackDir(r.team, s.half);
        const [nx, ny] = toNorm(r.x, r.y, dir);
        let near = Infinity, nearA = null;
        for (const o of s.agents) if (o.onPitch && o.team !== r.team && o.line !== 0) { const d = dist(o.x, o.y, r.x, r.y); if (d < near) { near = d; nearA = o; } }
        // 상대 줄 x (수신자 기준 정규화): 수비 줄(line 1) 평균, 중원 줄(line 2) 평균
        let dx = 0, dn = 0, mx = 0, mn = 0;
        for (const o of s.agents) if (o.onPitch && o.team !== r.team) { const ox = toNorm(o.x, o.y, dir)[0]; if (o.line === 1) { dx += ox; dn++; } else if (o.line === 2) { mx += ox; mn++; } }
        const defX = dn ? dx / dn : 1, midX = mn ? mx / mn : 0;
        const pocket = nx > midX + 0.02 && nx < defX - 0.02;
        const rec = (T.recv[r.pos] ??= { n: 0, near: 0, free: 0, pocket: 0, xz: [0, 0, 0, 0], shot5: 0, goal5: 0, nearPos: {}, fromPos: {}, pocketShot5: 0, pocketGoal5: 0, inBox: 0 });
        rec.n++; rec.near += Math.min(near, 15); if (near > 3) rec.free++; if (pocket) rec.pocket++;
        rec.xz[nx < 0.4 ? 0 : nx < 0.6 ? 1 : nx < 0.8 ? 2 : 3]++;
        if (nearA) inc(rec.nearPos, nearA.pos); inc(rec.fromPos, p.pos);
        const inBox = nx > 1 - 16.5 / L && Math.abs(ny - 0.5) * W < 20.16;
        if (inBox) rec.inBox++;
        inc(T.passesTo, `${p.pos}>${r.pos}`);
        const thru = pendThru && pendThru.passer === p.idx && s.t - pendThru.t0 < 4;
        if (thru) { inc(T.thruOk, p.pos); T.thruOkX[pendThru.xz]++; pendThru = null; }
        watch.push({ t: s.t, team: r.team, pos: r.pos, pocket, rec, shot: false, goal: false, idx: r.idx, from: p.pos, thru });
      }
    }
    for (let i = evLen; i < s.events.length; i++) {
      const e = s.events[i];
      if (e.type === 'shot') {
        const sh = s.agents.find((a) => a.id === e.players[0]);
        const T = side(e.team);
        T.shots++; T.xg += e.params?.xg ?? 0;
        if (sh) { inc(T.sPos, sh.pos); inc(T.xgPos, sh.pos, e.params?.xg ?? 0); }
        // 5초 창: 이 팀의 마지막 수신(들)
        if (sh) { const w = [...watch].reverse().find((w) => w.idx === sh.idx && s.t - w.t <= 5); if (w && !w.shot) { w.shot = true; w.rec.shot5++; if (w.pocket) w.rec.pocketShot5++; }
          const xg = e.params?.xg ?? 0;
          if (w && w.thru) { T.shotAfterThru++; T.xgAfterThru += xg; inc(T.thruShotByRecv, w.pos); } else if (w) { T.shotAfterPlain++; T.xgAfterPlain += xg; } else { T.shotNoRecv++; T.xgNoRecv += xg; } }
      } else if (e.type === 'goal') {
        const sc = s.agents.find((a) => a.id === e.players[0]);
        const T = side(e.team);
        T.goals++;
        if (sc) { inc(T.gPos, sc.pos); inc(T.gPath, `${sc.pos}:${sc.shotPath}`); }
        // 어시스트: 마지막 수신 창 중 이 팀 득점자 수신(10초 안) → 그 패서 포지션
        const lp = sc ? [...watch].reverse().find((w) => w.idx === sc.idx && s.t - w.t <= 10) : null;
        if (lp && sc) { inc(T.assistPos, lp.from); inc(T.assistPosGoal, `${lp.from}>${sc.pos}`); } else inc(T.assistPos, '(none)');
        if (lp && lp.shot && !lp.goal && s.t - lp.t <= 6) { lp.goal = true; lp.rec.goal5++; if (lp.pocket) lp.rec.pocketGoal5++; if (lp.thru) T.thruGoal5++; }
      }
    }
    while (watch.length && s.t - watch[0].t > 12) watch.shift();
  }
  for (const tm of [0, 1]) { side(tm).throughRecv += s.teams[tm].stats.throughReceived; side(tm).poss += s.teams[tm].stats.possessionTicks / (s.teams[0].stats.possessionTicks + s.teams[1].stats.possessionTicks); side(tm).passes += s.teams[tm].stats.passes; }
  R.matches++;
}
restore();
const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '-');
const show = (name, T) => {
  const m = R.matches;
  console.log(`\n## ${name} — 골 ${(T.goals / m).toFixed(2)} · 슈팅 ${(T.shots / m).toFixed(1)} · xG ${(T.xg / m).toFixed(2)} · 침투 수신 ${(T.throughRecv / m).toFixed(1)}`);
  console.log(`역할: ${Object.keys(T.roles).join(' ')} · 점유 ${pct(T.poss, m)}% · 패스 ${(T.passes / m).toFixed(0)}`);
  const ta = Object.values(T.thruAtt).reduce((a: number, b: number) => a + b, 0), to = Object.values(T.thruOk).reduce((a: number, b: number) => a + b, 0);
  console.log(`침투 패스 시도 ${(ta / m).toFixed(1)}/경기 · 성공 ${pct(to, ta)}% · 패서별 시도(성공%): ${Object.entries(T.thruAtt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / m).toFixed(1)}(${pct(T.thruOk[k] ?? 0, v)})`).join(' · ')}`);
  console.log(`침투 패서 x 구간 <0.4/0.4~0.6/0.6~0.8/0.8+ 시도: ${T.thruX.map((v) => (v / m).toFixed(1)).join('/')} · 성공%: ${T.thruX.map((v, i) => pct(T.thruOkX[i], v)).join('/')}`);
  console.log(`슈팅 출처(5초 안 수신 기준): 침투 수신 뒤 ${(T.shotAfterThru / m).toFixed(1)} (xG ${(T.xgAfterThru / m).toFixed(2)}, 골 ${(T.thruGoal5 / m).toFixed(2)}) · 일반 수신 뒤 ${(T.shotAfterPlain / m).toFixed(1)} (xG ${(T.xgAfterPlain / m).toFixed(2)}) · 수신 없음(탈취·리바운드 등) ${(T.shotNoRecv / m).toFixed(1)} (xG ${(T.xgNoRecv / m).toFixed(2)}) · 침투 수신 슈터: ${JSON.stringify(T.thruShotByRecv)}`);
  const poss = Object.keys({ ...T.gPos, ...T.sPos }).sort();
  console.log('| 포지션 | 골/경기 | 골 % | 슈팅/경기 | xG/경기 | 골/xG | 경로(0패스/1돌파/5리바/6그밖) |');
  console.log('|---|---|---|---|---|---|---|');
  for (const p of poss) {
    const g = T.gPos[p] ?? 0, sh = T.sPos[p] ?? 0, xg = T.xgPos[p] ?? 0;
    const paths = [0, 1, 2, 3, 4, 5, 6].map((i) => T.gPath[`${p}:${i}`] ?? 0).join('/');
    console.log(`| ${p} | ${(g / m).toFixed(2)} | ${pct(g, T.goals)} | ${(sh / m).toFixed(1)} | ${(xg / m).toFixed(2)} | ${xg ? (g / xg).toFixed(2) : '-'} | ${paths} |`);
  }
  console.log(`어시스트(마지막 패서) 포지션: ${Object.entries(T.assistPos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`어시스트 → 득점자: ${Object.entries(T.assistPosGoal).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log('| 수신 포지션 | 수신/경기 | 평균 가까운 상대 m | 자유(>3 m) % | 줄 사이 % | x <0.4/0.4~0.6/0.6~0.8/0.8+ % | 박스 안 % | 5초 안 슛 % | 5초 안 골/경기 | 줄 사이 수신 → 슛 % · 골/경기 | 가장 가까운 상대 포지션 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of Object.keys(T.recv).sort()) {
    const r = T.recv[p];
    const np = Object.entries(r.nearPos).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${pct(v, r.n)}`).join(' ');
    console.log(`| ${p} | ${(r.n / m).toFixed(1)} | ${(r.near / r.n).toFixed(1)} | ${pct(r.free, r.n)} | ${pct(r.pocket, r.n)} | ${r.xz.map((v) => pct(v, r.n)).join('/')} | ${pct(r.inBox, r.n)} | ${pct(r.shot5, r.n)} | ${(r.goal5 / m).toFixed(2)} | ${pct(r.pocketShot5, r.pocket)} · ${(r.pocketGoal5 / m).toFixed(2)} | ${np} |`);
  }
  const top = Object.entries(T.passesTo).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${(v / m).toFixed(1)}`).join(' · ');
  console.log(`패스 경로 상위(경기당): ${top}`);
};
console.log(`덮어쓰기 ${JSON.stringify(ov)} · 시드 ${seed0} · ${R.matches}경기 · A ${FA} 대 B ${FB}`);
show(`A ${FA}`, R.A);
show(`B ${FB}`, R.B);
process.exit(0);
