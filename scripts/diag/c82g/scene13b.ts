// @ts-nocheck C.82g: 장면 ⑬ 시행별 행동 보기 (tests/scenes/receive.ts sceneRunIn 복제)
import { ENGINE } from '../../../src/engine/config';
import * as H from '../../../tests/scenes/harness';
import { execute } from '../../../src/engine/actions';
import { candidates } from '../../../src/engine/onball';
const args = process.argv.slice(2).filter((a) => a !== '--');
for (const a of args) { const [k, v] = a.split('='); const parts = k.split('.'); let o: any = ENGINE; for (const p of parts.slice(0, -1)) o = o[p]; o[parts.at(-1)!] = Number(v); }
const { sceneState, pick, setBody, place } = H as any;
function only(s, keep) { for (const o of s.agents) if (!keep.includes(o) && o.line !== 0) o.onPitch = false; s.onVer++; }
function own(s, o) { s.ball.owner = o.idx; s.ball.x = o.x; s.ball.y = o.y; s.ball.flight = null; s.ball.reserve = null; s.possTeam = o.team; s.possOrigin = 'open'; s.possSince = s.t - 30; s.possStartT = s.t - 30; }
function kick(s, from, to, type) { const c = candidates(s, from).find((x) => x.receiver === to.idx && x.type === type); if (!c) return false; execute(s, from, { ...c, p: 1, pFlight: 1 }); return true; }
for (let k = 0; k < 10; k++) {
  const s = sceneState(60 + k);
  const passer = pick(s, 0, 2, 1), st = pick(s, 0, 3, 0), cb = pick(s, 1, 1, 1);
  only(s, [passer, st, cb]); setBody(st, 85); setBody(cb, 75);
  st.attrs = { ...st.attrs, ballControl: 75, shooting: 75 };
  place(passer, 55, 30); place(st, 70, 34, 8, 0); place(cb, 71, 36, 5, 0);
  st.runUntil = s.t + 4; st.tx = 92; st.ty = 34; st.urgent = true; own(s, passer);
  if (!kick(s, passer, st, 'through')) { console.log(k, 'no kick'); continue; }
  const t0 = s.t; let gotAt = NaN, log: string[] = [];
  while (s.t - t0 < 6) {
    const shots = s.teams[st.team].stats.shots;
    (H as any).sceneSim.step();
    if (Number.isNaN(gotAt) && s.ball.owner === st.idx) { gotAt = s.t; log.push(`got@${(s.t - t0).toFixed(2)} x=${st.x.toFixed(1)} v=${Math.hypot(st.vx, st.vy).toFixed(1)} cbgap=${Math.hypot(cb.x - st.x, cb.y - st.y).toFixed(1)} back=${st.backToGoal} tx=${st.tx.toFixed(1)}`); }
    if (!Number.isNaN(gotAt) && s.ball.owner === st.idx && Math.round((s.t - t0) * 10) % 5 === 0) log.push(`t${(s.t - t0).toFixed(1)} x=${st.x.toFixed(1)} v=${Math.hypot(st.vx, st.vy).toFixed(1)} gap=${Math.hypot(cb.x - st.x, cb.y - st.y).toFixed(1)} cd=${st.cooldown.toFixed(2)}`);
    if (!Number.isNaN(gotAt) && s.ball.owner !== st.idx) {
      const fl = s.ball.flight;
      const act = s.teams[st.team].stats.shots > shots ? 'shoot' : fl && fl.passer === st.idx ? 'pass' : 'lost';
      log.push(`${act}@${(s.t - t0).toFixed(2)} x=${st.x.toFixed(1)} gap=${Math.hypot(cb.x - st.x, cb.y - st.y).toFixed(1)}`);
      break;
    }
  }
  console.log(k, log.join(' | '));
}
