// 진단 (엔진 관리자 9대, pending 145 ①): 결정 순간 정책별 실제 평점 — 같은 선수·같은 경기 시드에서 정책만 바꿔 경기 평점과 결정당 실제 평점 변화(DecisionRecord.delta)를 잰다.
// 정책: safe = 확률 가장 높은 선택지, attack = 슛·전진 계열 중 확률 가장 높은 것(없으면 safe), bot = 기대 평점 최대(bestChoice), delegate = 맡기기
// npx vite-node scripts/diag/moment-policy.ts -- [포지션군당 선수 수=2] [라운드 수=4]
import { newGame, roundMatch, selectableRealPlayers } from '../../src/game';
import { playMyMatch } from '../../src/engine/adapter';
import { bestChoice, type MomentPolicy, type MomentOption } from '../../src/engine/moments';
import { posGroup } from '../../src/roster';
import { setEnvironmentFixed } from '../../src/weather';
setEnvironmentFixed(true);
const args = process.argv.slice(2).filter((a) => a !== '--');
const perGroup = Number(args[0] ?? 2), rounds = Number(args[1] ?? 4);
const groups = ['ST', 'WING', 'CAM', 'CM', 'CDM', 'FB', 'CB'];
const pool = selectableRealPlayers();
const picks = groups.flatMap((g) => pool.filter((p) => posGroup(p.position) === g).slice(0, perGroup));
const isAtt = (o: MomentOption) => { const a = o.action as string; return a === 'shoot' || !!o.chain || a === 'through' || a === 'cross' || a === 'cutback' || a === 'dribble' || a === 'carry' || (a === 'pass' && o.label.includes('전진')); };
const pickBy = (m: Parameters<MomentPolicy>[0], f: (o: MomentOption) => boolean) => { let bi = -1, bp = -1; m.options.forEach((o, i) => { if (o.kind === 'card' || !f(o)) return; const p = o.p ?? 1; if (p > bp) { bp = p; bi = i; } }); return bi; };
const POL: Record<string, MomentPolicy> = {
  delegate: () => 'delegate',
  safe: (m) => (m.type === 'onball' ? (pickBy(m, () => true) >= 0 ? pickBy(m, () => true) : 'delegate') : bestChoice(m, Infinity)),
  attack: (m) => { if (m.type !== 'onball') return bestChoice(m, Infinity); const i = pickBy(m, isAtt); return i >= 0 ? i : pickBy(m, () => true) >= 0 ? pickBy(m, () => true) : 'delegate'; },
  bot: (m) => bestChoice(m, Infinity),
};
const out: Record<string, { r: number[]; d: number[]; n: number; g: number }> = {};
for (const [name, pol] of Object.entries(POL)) {
  for (const p of picks) {
    const key = `${name}|${posGroup(p.position)}`;
    for (const k2 of [key, `${name}|ALL`]) out[k2] ??= { r: [], d: [], n: 0, g: 0 };
    const g = newGame({ mode: 'real', playerId: p.id, seed: `mpol-${p.id}`, difficulty: 'normal' });
    for (let k = 0; k < rounds && g.phase === 'season'; k++) {
      const rm = roundMatch(g);
      const o = playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'important', policy: pol } });
      const decs = o.engine.decisions.filter((d) => d.choice !== 'delegate' || name === 'delegate');
      for (const k2 of [key, `${name}|ALL`]) {
        const t = out[k2]!; if (o.my?.rating != null) t.r.push(o.my.rating); for (const d of decs) t.d.push(d.delta); t.n += decs.length; t.g += o.my?.goals ?? 0;
      }
    }
  }
}
const avg = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
for (const grp of ['ALL', ...groups]) {
  console.log(`${grp}: ` + Object.keys(POL).map((n) => { const t = out[`${n}|${grp}`]; return t ? `${n} 평점 ${avg(t.r).toFixed(2)} · 결정 ${t.n} · 결정당 실제 Δ ${avg(t.d).toFixed(3)} · 골 ${t.g}` : ''; }).join(' | '));
}
