// @ts-nocheck — 진단 스크립트 (C.80l): 게겐 팀 이동 거리 분해. c80c-dist 와 같은 표본(76:74 시드 11~30 × 게겐 홈/원정, 상대 opp)
// 틱마다 이동량을 상태별로 나눈다: 공 소유 · 공격(달리기 runUntil / 대형) · 수비(역압박 · 소유자 압박 · 사람 따라가기 = 선제 마크·분담·추적 · 대형 블록) · 주인 없는 공 · 리스타트
// 실행: npx vite-node scripts/diag/c80l-dist.ts -- [opp=tikitaka] [seeds=20] [tendency.X=v] [경로.X=v]
import { TENDENCY, tacticsOf } from '../../src/engine/tactics';
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { gegenMarkPlan, restPlan } from '../../src/engine/offball';
import { createTeamRoster } from '../../src/roster';
let opp = 'tikitaka', me = 'gegenpress', nSeeds = 20, seed0 = 11; const ovs = [];
for (const a of process.argv.slice(2).filter((x) => x !== '--')) {
  if (a.startsWith('opp=')) opp = a.slice(4);
  else if (a.startsWith('me=')) me = a.slice(3);
  else if (a.startsWith('seeds=')) nSeeds = Number(a.slice(6));
  else if (a.startsWith('seed0=')) seed0 = Number(a.slice(6));
  else if (a.startsWith('tendency.')) { const [k, v] = a.split('='); TENDENCY[k.slice(9)] = Number(v); ovs.push(a); }
  else if (a.includes('=')) { const [k, v] = a.split('='); const ks = k.split('.'); let o = ENGINE; for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = Number(v); ovs.push(a); }
}
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
const CLS = ['ball', 'atkRun', 'atkShape', 'cPress', 'press', 'gMark', 'rest', 'track', 'follow', 'dShape', 'dFree', 'loose', 'restart'];
const byPos = {}; const tot = Object.fromEntries(CLS.map((c) => [c, 0])); const totSpr = Object.fromEntries(CLS.map((c) => [c, 0]));
const topCls = Object.fromEntries(CLS.map((c) => [c, 0])); let topN = 0;
let sumTop = 0, maxOne = 0, avg = 0, cnt = 0, oppAvg = 0, oppCnt = 0; const tops = []; const top3 = [];
for (const gHome of [true, false]) for (let seed = seed0; seed < seed0 + nSeeds; seed++) {
  const H = teamSetupFromRoster(home, 76, 74), A = teamSetupFromRoster(away, 74, 76);
  const g = gHome ? 0 : 1;
  (gHome ? H : A).tactics = tacticsOf(me);
  (gHome ? A : H).tactics = tacticsOf(opp);
  const m = createMatch({ home: H, away: A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false });
  const s = m.state;
  const tl = {}; const z = () => Object.fromEntries(CLS.map((c) => [c, 0])); const acc = {}, accS = {};
  let guard = 0;
  while (!s.done && guard++ < 1e6) {
    const before = new Map(s.agents.map((a) => [a, a.stats.distance]));
    m.step();
    const b = s.ball; const owner = b.owner >= 0 ? s.agents[b.owner] : null;
    for (const a of s.agents) {
      if (a.team !== g || !a.onPitch || a.line === 0) continue;
      const d = a.stats.distance - (before.get(a) ?? a.stats.distance); if (d <= 0) continue;
      acc[a.idx] ??= z(); accS[a.idx] ??= z();
      const bin = Math.min(6, Math.floor(s.t / 900)) + (s.half === 2 ? 0 : 0); tl[a.idx] ??= [0,0,0,0,0,0,0,'',0,0,0,0]; tl[a.idx][bin] += d; if (a.stamina < 10) { const v = Math.hypot(a.vx, a.vy); tl[a.idx][a.urgent ? 8 : v > 4 ? 9 : v > 2 ? 10 : 11] += d; } if (s.tick % 1800 === 0) tl[a.idx][7] += `${a.stamina.toFixed(0)},`;
      let c;
      const tm = s.teams[g];
      if (s.restart) c = 'restart';
      else if (owner === a) c = 'ball';
      else if (!owner && !b.flight) c = 'loose';
      else if (s.possTeam === g) c = a.runUntil > s.t ? 'atkRun' : 'atkShape';
      else if (owner && s.t < tm.counterUntil && tm.counterPressers.includes(a.idx)) c = 'cPress';
      else if (owner && a.tvIdx === owner.idx) c = 'press';
      else if (owner && me === 'gegenpress' && TENDENCY.gegenMarkN > 0 && gegenMarkPlan(s, g).has(a.idx)) c = 'gMark';
      else if (owner && restPlan(s, g).has(a.idx)) c = 'rest';
      else if (a.trackIdx >= 0) c = 'track';
      else if (a.tvIdx >= 0) c = 'follow';
      else c = owner ? 'dShape' : 'dFree';
      acc[a.idx][c] += d; if (a.sprinting) accS[a.idx][c] += d;
    }
  }
  const r = m.runToEnd();
  const ps = r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK' && p.team === g);
  const os = r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK' && p.team !== g);
  os.forEach((p) => { oppAvg += p.distance; oppCnt++; });
  const sorted = [...ps].sort((x, y) => y.distance - x.distance);
  const top = sorted[0].distance;
  top3.push(sorted.slice(0, 3).map((p) => `${p.position}${(p.distance / 1000).toFixed(1)}`).join('/'));
  for (const p of ps) {
    avg += p.distance; cnt++;
    const ag = s.agents.find((a) => a.id === p.id && a.team === g);
    const k = p.position; byPos[k] ??= { n: 0, d: 0, c: Object.fromEntries(CLS.map((c) => [c, 0])) };
    byPos[k].n++; byPos[k].d += p.distance;
    if (ag && acc[ag.idx]) for (const c of CLS) { byPos[k].c[c] += acc[ag.idx][c]; tot[c] += acc[ag.idx][c]; totSpr[c] += accS[ag.idx][c]; }
    if (ag && acc[ag.idx] && p === sorted[0] && p.distance > 14500) console.log(`  >14.5 시드${seed}${gHome ? 'H' : 'A'} ${p.position} ${(p.distance / 1000).toFixed(2)} 끝 체력 ${ag.stamina.toFixed(0)} 체력능력 ${ag.attrs.stamina} 활동량 ${ag.attrs.workRate ?? '-'} 속도 ${ag.maxSpeed.toFixed(2)} :`, CLS.map((c) => `${c} ${(acc[ag.idx][c] / 1000).toFixed(2)}`).join(' '), '\n     15분별 km', tl[ag.idx].slice(0, 7).map((v) => (v / 1000).toFixed(2)).join(' '), '체력<10 거리: 긴급', (tl[ag.idx][8] / 1000).toFixed(2), '비긴급 4m/s+', (tl[ag.idx][9] / 1000).toFixed(2), '2~4', (tl[ag.idx][10] / 1000).toFixed(2), '<2', (tl[ag.idx][11] / 1000).toFixed(2));
    if (ag && acc[ag.idx] && p === sorted[0]) { for (const c of CLS) topCls[c] += acc[ag.idx][c]; topN++; }
  }
  sumTop += top; maxOne = Math.max(maxOne, top); tops.push((top / 1000).toFixed(2));
}
const km = (v, n) => (v / n / 1000).toFixed(2);
console.log(`[${ovs.join(' ') || '기본'}] ${me} 대 ${opp} 시드 11~${10 + nSeeds} ×홈/원정: 최다 평균 ${km(sumTop, tops.length)} · 한 선수 최다 ${(maxOne / 1000).toFixed(2)} · 게겐 필드 평균 ${km(avg, cnt)} · 상대 필드 평균 ${km(oppAvg, oppCnt)}`);
const n90 = cnt; console.log('상태별 km/선수 (스프린트 몫):', CLS.map((c) => `${c} ${km(tot[c], n90)}(${(totSpr[c] / Math.max(1, tot[c]) * 100).toFixed(0)}%)`).join(' · '));
console.log('경기 최다 선수 상태별 km:', CLS.map((c) => `${c} ${km(topCls[c], topN)}`).join(' · '));
for (const [k, v] of Object.entries(byPos)) console.log(`  ${k} n${v.n} 평균 ${km(v.d, v.n)} :`, CLS.map((c) => `${c} ${km(v.c[c], v.n)}`).join(' '));
console.log('경기별 최다:', tops.join(' '));
console.log('상위 3:', top3.join(' | '));
process.exit(0);
