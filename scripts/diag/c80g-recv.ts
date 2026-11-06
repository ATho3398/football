// @ts-nocheck — 진단 스크립트 (C.80g, 엄격 타입 검사 제외)
// 성향별 20 m+ 패스 받음률: 패스(크로스 제외)를 찬 거리(aimD) 20 m 이상을 땅볼/공중으로 나눠, 비행이 끝난 뒤 10틱 안 공을 가진 팀이 차는 팀이면 받음.
// 땅볼은 받는 순간 가장 가까운 상대 필드 선수 거리(3 m 안/밖)로도 나눈다. 메인 스레드 · 상태 읽기만(엔진 지문 불변).
// 실행: npx vite-node scripts/diag/c80g-recv.ts -- [경기수=40] A전술 B전술 [레이팅=75:75] [seed=41000] [경로=값 …]
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { FORMATION_SLOTS } from '../../src/formations';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf } from '../../src/engine/tactics';
import { dist } from '../../src/engine/pitch';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const specs: string[] = [];
let n = 40;
let ratings = [75, 75];
let seed0 = 41000;
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else if (/^\d+:\d+$/.test(a)) ratings = a.split(':').map(Number);
  else specs.push(a);
}
for (const [path, v] of Object.entries(overrides)) {
  const keys = path.split('.'); let o = ENGINE as any;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys[keys.length - 1]!] = v;
}
function build(side: string, seed: number, rating: number, spec: string, opp: number) {
  const roster = createTeamRoster({ id: `v${side}${seed}`, rating }, `eng-${side}-${rating}-${seed}`, 2018, []);
  roster.formation = '4-4-2';
  const setup = teamSetupFromRoster(roster, rosterRating(roster), opp, `w${seed}`);
  const before = setup.tactics.tendency;
  setup.tactics = { ...setup.tactics, ...tacticsOf(spec as any) };
  if (setup.tactics.tendency !== before) {
    const slots = FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
  return setup;
}
const mk = () => ({ all: 0, allOk: 0, g: 0, gOk: 0, gNear: 0, gNearOk: 0, a: 0, aOk: 0, passes: 0, goals: 0 });
const acc = [mk(), mk()];
const near: [number, number, number][] = []; // 수비 2.5 m 안 땅볼 20 m+: [팀, 받는 선수 점수(볼컨 .5 + 근력 .3 + 민첩 .2), 받음]
const [A, B] = specs as [string, string];
for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const ta = build('a', seed, ratings[0]!, A, ratings[1]!);
  const tb = build('b', seed, ratings[1]!, B, ratings[0]!);
  const aHome = k % 2 === 0;
  const m = createMatch({ home: aHome ? ta : tb, away: aHome ? tb : ta, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = m.state;
  const side = (team: number) => (aHome ? team : 1 - team); // 0 = A
  let cur: any = null;
  let pend: any = null;
  while (!s.done) {
    m.step();
    const fl = s.ball.flight;
    if (pend) {
      if (s.ball.owner >= 0 || s.restart || pend.left <= 0) {
        const own = s.ball.owner >= 0 ? s.agents[s.ball.owner]!.team : -1;
        const c = acc[side(pend.team)]!;
        const ok = own === pend.team ? 1 : 0;
        c.all++; c.allOk += ok;
        if (pend.air) { c.a++; c.aOk += ok; } else { c.g++; c.gOk += ok; if (pend.near) { c.gNear++; c.gNearOk += ok; near.push([side(pend.team), pend.sc, ok]); } }
        pend = null;
      } else pend.left--;
    }
    if (cur && fl !== cur) {
      const team = s.agents[cur.passer]!.team;
      if (cur.aimD >= 20) {
        let nd = Infinity;
        const rc = cur.receiver >= 0 ? s.agents[cur.receiver] : null;
        if (rc) for (const o of s.agents) if (o.onPitch && o.team !== team && o.line !== 0) nd = Math.min(nd, dist(o.x, o.y, s.ball.x, s.ball.y));
        pend = { team, air: !!cur.air, near: nd < 2.5, left: 10, sc: rc ? rc.attrs.ballControl * 0.5 + (rc.attrs.strength + rc.body.strength) * 0.3 + rc.attrs.agility * 0.2 : 0 };
      }
      cur = null;
    }
    if (fl && fl !== cur && fl.aimD !== undefined && fl.passer >= 0 && !fl.fromCross) { cur = fl; acc[side(s.agents[fl.passer]!.team)]!.passes++; }
  }
  for (const t of [0, 1]) acc[side(t)]!.goals += s.teams[t].stats.goals;
}
const pct = (a: number, b: number) => ((100 * a) / Math.max(1, b)).toFixed(1);
console.log(`\n${A} 대 ${B} ${n}경기 seed ${seed0} 덮어쓰기 ${JSON.stringify(overrides)}`);
[A, B].forEach((nm, i) => {
  const c = acc[i]!;
  console.log(`${nm}: 패스 ${(c.passes / n).toFixed(0)} · 20m+ ${(c.all / n).toFixed(1)}/경기 받음 ${pct(c.allOk, c.all)}% · 땅볼 ${(c.g / n).toFixed(1)} ${pct(c.gOk, c.g)}% (2.5m 안 ${(c.gNear / n).toFixed(1)} ${pct(c.gNearOk, c.gNear)}%) · 공중 ${(c.a / n).toFixed(1)} ${pct(c.aOk, c.a)}% · 득점 ${(c.goals / n).toFixed(2)}`);
});
const scs = near.map((x) => x[1]).sort((x, y) => x - y);
const med = scs[Math.floor(scs.length / 2)] ?? 0;
for (const half of [0, 1]) {
  const xs = near.filter((x) => (half ? x[1] >= med : x[1] < med));
  console.log(`수비 2.5 m 안 땅볼 20 m+ — 받는 선수 점수 ${half ? '상위' : '하위'} 절반(기준 ${med.toFixed(1)}): ${xs.length}회 받음 ${pct(xs.reduce((t, x) => t + x[2], 0), xs.length)}%`);
}
console.log('JSON ' + JSON.stringify({ A, B, n, seed0, overrides, acc }));
process.exit(0);
