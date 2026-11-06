// @ts-nocheck — 진단 스크립트 (C.80i, 엄격 타입 검사 제외)
// 반대 전환 측정: A 팀(행) 의 반대 전환 패스(옆 sw m+ · 찬 자리와 목표점이 공 반대 측면, 크로스·GK 제외)
//   시도/경기 · 받음률 · 받는 순간 받는 선수 5/10 m 안 상대 필드 수 · 받은 뒤 10초 안 A 슈팅·xG
//   · 상대(B) 필드 선수 평균 y 가 공 옆 이동을 따라간 몫(찬 뒤 1·2·3·4·6초, 받는 순간)
//   · 결정 단위: 후보에 전환이 있었던 결정 수, 보인 몫, 고른 몫, 효용 1위와의 차(중앙값)
// 메인 스레드 · 상태 읽기만(엔진 지문 불변). 실행: npx vite-node scripts/diag/c80i-switch.ts -- [경기수=40] A B [seed=41000] [sw=25] [경로=값 …]
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { FORMATION_SLOTS } from '../../src/formations';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf } from '../../src/engine/tactics';
import { W, attackDir } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const specs: string[] = [];
let n = 40;
let seed0 = 41000;
let SW = 25;
let json = '';
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('sw=')) SW = Number(a.slice(3));
  else if (a.startsWith('json=')) json = a.slice(5);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else specs.push(a);
}
for (const [path, v] of Object.entries(overrides)) {
  const keys = path.split('.'); let o = ENGINE as any;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys[keys.length - 1]!] = v;
}
const tac = (spec: string) => {
  const [t, lv] = spec.split('@');
  const levels = lv ? { lineHeight: Number(lv[0]), pressing: Number(lv[1]), style: Number(lv[2]), width: Number(lv[3]) } : undefined;
  return tacticsOf(t as any, levels as any);
};
function build(side: string, seed: number, spec: string) {
  const roster = createTeamRoster({ id: `v${side}${seed}`, rating: 75 }, `eng-${side}-75-${seed}`, 2018, []);
  roster.formation = '4-4-2';
  const setup = teamSetupFromRoster(roster, rosterRating(roster), 75, `w${seed}`);
  const before = setup.tactics.tendency;
  setup.tactics = { ...setup.tactics, ...tac(spec) };
  if (setup.tactics.tendency !== before) {
    const slots = FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
  return setup;
}
const isSwitch = (fx: number, fy: number, tx: number, ty: number) => Math.abs(ty - fy) >= SW && (ty - W / 2) * (fy - W / 2) < 0;
const TS = [1, 2, 3, 4, 6];
const R = {
  att: 0, ok: 0, n5: 0, n10: 0, le1: 0, sh10: 0, xg10: 0, goal10: 0, air: 0,
  follow: TS.map(() => 0), followN: 0, followRecv: 0, followRecvN: 0,
  dec: 0, decHas: 0, decVis: 0, decPick: 0, gaps: [] as number[],
  // 비교: 같은 팀의 앞으로 25 m+ 롱패스(전환 아님)
  fwd: 0, fwdOk: 0, fwdSh: 0, fwdXg: 0,
  // 블록 대형이 비대칭일 때(공 쪽 쏠림) 기준
  hiAtt: 0, hiOk: 0, hiSh: 0, hiXg: 0,
  passes: 0, goals: 0, ga: 0, shots: 0,
};
const [A, B] = specs as [string, string];
let curS: any = null, sideA = 0;
const shotsLog: { t: number; team: number; xg: number }[] = [];
probe.shot = (s, p) => { shotsLog.push({ t: s.t, team: p.team, xg: p.xg ?? 0 }); };
let first: any = null;
const nxt: Record<string, number> = {};
probe.decide = (s, p) => {
  const a = p.a;
  if (first && a.idx === first.idx && s.t - first.t < 5) {
    const c = p.chosen;
    const fwd = (c.x - a.x) * attackDir(a.team, s.half);
    const d = Math.hypot(c.x - a.x, c.y - a.y);
    const k = c.type === 'pass' ? (d >= 25 ? (fwd > 5 ? 'pass-long-fwd' : 'pass-long-side/back') : fwd > 3 ? 'pass-fwd' : fwd < -3 ? 'pass-back' : 'pass-side') : c.type;
    nxt[k] = (nxt[k] ?? 0) + 1;
    first = null;
  }
  if (a.team !== sideA || a.line === 0 || s.restart) return;
  R.dec++;
  const sw = p.cands.filter((c) => (c.type === 'pass' || c.type === 'through') && isSwitch(a.x, a.y, c.x, c.y));
  if (!sw.length) return;
  R.decHas++;
  const vis = sw.filter((c) => p.vis.includes(c));
  if (vis.length) R.decVis++;
  if (sw.includes(p.chosen)) R.decPick++;
  const best = Math.max(...sw.map((c) => c.u));
  R.gaps.push(p.maxU - best);
};
const meanY = (s: any, team: number) => { let t = 0, k = 0; for (const o of s.agents) if (o.onPitch && o.team === team && o.line !== 0) { t += o.y; k++; } return t / k; };
for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const ta = build('a', seed, A);
  const tb = build('b', seed, B);
  const aHome = k % 2 === 0;
  const m = createMatch({ home: aHome ? ta : tb, away: aHome ? tb : ta, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = m.state; curS = s;
  sideA = aHome ? 0 : 1;
  const opp = 1 - sideA;
  shotsLog.length = 0;
  let cur: any = null;
  let lastFl: any = null;
  const track: any[] = []; // 전환 추적: {t0, y0, dy, my0, recvT, ...}
  const posts: { t: number; kind: 'sw' | 'fwd' }[] = [];
  while (!s.done) {
    m.step();
    const fl = s.ball.flight;
    if (cur && fl !== cur.fl) {
      // 비행 끝: 받음 판정은 다음 몇 틱 안 소유
      cur.left = 10; cur.ended = true;
    }
    if (cur && cur.ended) {
      if (s.ball.owner >= 0 || s.restart || cur.left <= 0) {
        const ok = s.ball.owner >= 0 && s.agents[s.ball.owner]!.team === sideA;
        if (cur.kind === 'sw') {
          R.att++; if (cur.air) R.air++; if (cur.hi) R.hiAtt++;
          if (ok) {
            R.ok++; if (cur.hi) R.hiOk++;
            const r = s.agents[s.ball.owner]!;
            let c5 = 0, c10 = 0;
            for (const o of s.agents) if (o.onPitch && o.team === opp && o.line !== 0) { const d = Math.hypot(o.x - r.x, o.y - r.y); if (d <= 5) c5++; if (d <= 10) c10++; }
            R.n5 += c5; R.n10 += c10; if (c5 <= 1) R.le1++;
            posts.push({ t: s.t, kind: 'sw', hi: cur.hi });
            first = { idx: r.idx, t: s.t };
            cur.tr.recvT = s.t; cur.tr.recvMy = meanY(s, opp);
          }
        } else {
          R.fwd++; if (ok) { R.fwdOk++; posts.push({ t: s.t, kind: 'fwd' }); }
        }
        cur = null;
      } else cur.left--;
    }
    const fresh = fl && fl !== lastFl;
    lastFl = fl;
    if (fresh && !cur && fl.aimD !== undefined && fl.passer >= 0 && !fl.fromCross && (fl.kind === 'pass' || fl.kind === 'long')) {
      const p = s.agents[fl.passer]!;
      if (p.team === sideA) {
        R.passes++;
        if (p.line !== 0 && isSwitch(fl.fromX, fl.fromY, fl.toX, fl.toY)) {
          const tr = { t0: s.t, dy: fl.toY - fl.fromY, my0: meanY(s, opp), at: TS.map(() => NaN), recvT: NaN, recvMy: NaN };
          track.push(tr);
          const nx = attackDir(sideA, s.half) === 1 ? fl.fromX / 105 : 1 - fl.fromX / 105;
          cur = { fl, kind: 'sw', air: fl.air, tr, ended: false, hi: nx >= 0.5 };
        } else if (p.line !== 0 && fl.aimD >= SW && Math.abs(fl.toY - fl.fromY) < SW / 2) {
          const fwd = attackDir(sideA, s.half) * (fl.toX - fl.fromX);
          if (fwd > SW * 0.7) cur = { fl, kind: 'fwd', ended: false };
        }
      }
    }
    // 대형 따라감 기록
    for (const tr of track) for (let i = 0; i < TS.length; i++) if (Number.isNaN(tr.at[i]) && s.t >= tr.t0 + TS[i]!) tr.at[i] = meanY(s, opp);
  }
  for (const tr of track) {
    if (TS.every((_, i) => !Number.isNaN(tr.at[i]))) { R.followN++; tr.at.forEach((y: number, i: number) => { R.follow[i] += (y - tr.my0) / tr.dy; }); }
    if (!Number.isNaN(tr.recvT)) { R.followRecvN++; R.followRecv += (tr.recvMy - tr.my0) / tr.dy; }
  }
  for (const p of posts) {
    const xs = shotsLog.filter((x) => x.team === sideA && x.t >= p.t && x.t <= p.t + 10);
    if (p.kind === 'sw' && p.hi) { R.hiSh += xs.length ? 1 : 0; R.hiXg += xs.reduce((t, x) => t + x.xg, 0); }
    if (p.kind === 'sw') { R.sh10 += xs.length ? 1 : 0; R.xg10 += xs.reduce((t, x) => t + x.xg, 0); }
    else { R.fwdSh += xs.length ? 1 : 0; R.fwdXg += xs.reduce((t, x) => t + x.xg, 0); }
  }
  R.goals += s.teams[sideA].stats.goals; R.ga += s.teams[opp].stats.goals; R.shots += s.teams[sideA].stats.shots;
}
const f = (v: number, d = 2) => v.toFixed(d);
const pc = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;
const med = (xs: number[]) => { const y = [...xs].sort((p, q) => p - q); return y[Math.floor(y.length / 2)] ?? NaN; };
console.log(`\n${A} 대 ${B} ${n}경기 seed ${seed0} sw ${SW} 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log(`${A}: 득실 ${f((R.goals - R.ga) / n)} (득 ${f(R.goals / n)} 실 ${f(R.ga / n)}) · 슈팅 ${f(R.shots / n, 1)} · 패스 ${f(R.passes / n, 0)}`);
console.log(`반대 전환 ${f(R.att / n)}/경기 (공중 ${pc(R.air, R.att)}) · 받음 ${pc(R.ok, R.att)} · 받는 순간 5 m 안 ${f(R.n5 / Math.max(1, R.ok))} · 10 m 안 ${f(R.n10 / Math.max(1, R.ok))} · 5 m 안 ≤1명 ${pc(R.le1, R.ok)} · 10초 안 슈팅 ${pc(R.sh10, R.ok)} · xG/받음 ${f(R.xg10 / Math.max(1, R.ok), 3)}`);
console.log(`  그중 상대 진영에서 찬 것 ${f(R.hiAtt / n)}/경기 · 받음 ${pc(R.hiOk, R.hiAtt)} · 10초 안 슈팅 ${pc(R.hiSh, R.hiOk)} · xG/받음 ${f(R.hiXg / Math.max(1, R.hiOk), 3)}`);
console.log(`비교 전진 롱(${SW} m+) ${f(R.fwd / n)}/경기 · 받음 ${pc(R.fwdOk, R.fwd)} · 10초 안 슈팅 ${pc(R.fwdSh, R.fwdOk)} · xG/받음 ${f(R.fwdXg / Math.max(1, R.fwdOk), 3)}`);
console.log(`상대 대형 평균 y 가 공 옆 이동을 따라간 몫(찬 뒤 ${TS.join('·')}초): ${R.follow.map((v) => f(v / Math.max(1, R.followN))).join(' · ')} · 받는 순간 ${f(R.followRecv / Math.max(1, R.followRecvN))}`);
console.log(`결정 ${f(R.dec / n, 0)}/경기 · 전환 후보 있음 ${pc(R.decHas, R.dec)} · 그중 보임 ${pc(R.decVis, R.decHas)} · 고름 ${pc(R.decPick, R.decHas)} · 효용 1위와 차 중앙값 ${f(med(R.gaps), 4)}`);
const nt = Object.values(nxt).reduce((t, v) => t + v, 0);
console.log(`받은 선수 다음 행동: ${Object.entries(nxt).sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k} ${pc(v, nt)}`).join(' · ')}`);
if (json) require('node:fs').writeFileSync(json, JSON.stringify({ A, B, n, seed0, overrides, R: { ...R, gaps: undefined, gapMed: med(R.gaps) } }));
process.exit(0);
