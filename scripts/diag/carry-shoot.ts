// C.75k 몰고 가다 슛 진단: 보일 때마다 고르는 봇으로, 표시 확률(몰고 가기 × 도착 xG × 할인)과 실제(몰고 가기 성공 · 둘째 단 슛 · 골)를 비교
// npx vite-node scripts/diag/carry-shoot.ts -- [포지션군당 선수=3] [라운드=6]
import { MY_ID, playMyMatch } from '../../src/engine/adapter';
import { ENGINE } from '../../src/engine/config';
import { bestChoice, type MomentPolicy } from '../../src/engine/moments';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../../src/game';
import { posGroup } from '../../src/roster';
import { setEnvironmentFixed } from '../../src/weather';

setEnvironmentFixed(true);
const args = process.argv.slice(2).filter((a) => a !== '--');
const per = Number(args[0] ?? 3);
const rounds = Number(args[1] ?? 6);
const MODE = args[2] ?? 'always';
const pool = selectableRealPlayers();
const picks = ['ST', 'WING', 'CAM'].flatMap((g) => pool.filter((p) => posGroup(p.position) === g).slice(0, per));
const ev: Record<string, { n: number; pred: number; real: number }> = {};
let n = 0, pSum = 0, pcSum = 0, xgSum = 0, shots = 0, goals = 0, xgShot = 0;
for (const p of picks) {
  const g = newGame({ mode: 'real', playerId: p.id, seed: `carry-${p.id}`, difficulty: 'normal' });
  for (let k = 0; k < rounds && g.phase === 'season'; k++) {
    const rm = roundMatch(g, { cards: false });
    const ts: number[] = [];
    const pred = new Map<number, [string, number]>();
    const pol: MomentPolicy = (m) => {
      const i = m.options.findIndex((o) => o.chain);
      const c = bestChoice(m, Infinity);
      if (typeof c === 'number') {
        const o = m.options[c]!;
        const R = ENGINE.rating;
        const v = o.chain ? o.p! * o.up + (1 - o.chain.p) * o.down : (o.p ?? 1) * o.up + (1 - (o.p ?? 1)) * o.down;
        pred.set(m.id, [o.chain ? 'carryShoot' : o.action, v]);
        void R;
      }
      if (i < 0 || MODE === 'bot') return c;
      const o = m.options[i]!;
      n++; pSum += o.p!; pcSum += o.chain!.p; xgSum += o.value; ts.push(m.t);
      return i;
    };
    const out = rm.plan.started ? playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'important', policy: pol } }) : null;
    if (out) for (const d of out.engine.decisions) {
      const pr = pred.get(d.id);
      if (!pr) continue;
      const e = (ev[pr[0]] ??= { n: 0, pred: 0, real: 0 });
      e.n++; e.pred += pr[1]; e.real += d.delta;
    }
    if (out) for (const t of ts) {
      const sh = out.engine.events.find((e) => e.type === 'shot' && e.players[0] === MY_ID && e.t > t && e.t <= t + ENGINE.moments.carryShootWindow + 1);
      if (sh) { shots++; xgShot += Number(sh.params?.xg ?? 0); if (out.engine.events.some((e) => e.type === 'goal' && e.players[0] === MY_ID && e.t >= sh.t && e.t <= sh.t + 4)) goals++; }
    }
    playRound(g, out ? { engineOut: out } : {});
  }
}
console.log(`몰고 가다 슛 ${n}번: 표시 p 평균 ${(pSum / n).toFixed(3)} · 몰고 가기 ${(pcSum / n).toFixed(2)} · 도착 xG ${(xgSum / n).toFixed(3)}`);
console.log(`실제: 둘째 단 슛 ${shots} (${((100 * shots) / n).toFixed(0)}%) · 그 슛 xG 평균 ${(xgShot / Math.max(1, shots)).toFixed(3)} · 골 ${goals} (${((100 * goals) / n).toFixed(1)}%)`);
for (const [k, e] of Object.entries(ev)) console.log(`${k}: ${e.n}번 · 예측(즉시 몫) ${(e.pred / e.n).toFixed(3)} · 결정 뒤 6초 평점 변화 ${(e.real / e.n).toFixed(3)}`);
process.exit(0);
