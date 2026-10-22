// C.77n 커리어 노쇠 비교 (pending 142b): 같은 실제 NPC 들을 24세부터 주전으로 뛰게 하고 성향별 시즌 부하로 마모를 쌓아
// 30세 이후 OVR 곡선 · 정점 나이 · 가상 선수 은퇴 나이 기대값을 비교한다 (growNpc · retires 와 같은 곡선 = 본편 경로).
// 사용: npx vite-node scripts/diag/c77n-wear.ts -- [리그 주전 시즌 부하(기본 31)] [챔스 추가 부하(기본 10)] [선수 수(기본 150)]
import { BALANCE } from '../../src/config/balance';
import { agingRateShifted } from '../../src/growth';
import { seasonWear, wearAging } from '../../src/load';
import { newGame } from '../../src/game';
import { growNpc } from '../../src/npc';
import { positionOvr } from '../../src/positions';

const args = process.argv.slice(2).filter((a) => /^[\d.]+$/.test(a)).map(Number);
const base = args[0] ?? 31;
const cup = args[1] ?? 10;
const n = args[2] ?? 150;
const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c77n-wear', difficulty: 'normal' });
const pool = g.npcs.filter((x) => x.age <= 30 && !x.retired).slice(0, n);
const T = BALANCE.load.tendency;
const variants: [string, number][] = [
  ['블록(리그만)', base * T.block!],
  ['균형(리그만)', base * T.balanced!],
  ['게겐(리그만)', base * T.gegenpress!],
  ['균형+챔스', (base + cup) * T.balanced!],
  ['게겐+챔스', (base + cup) * T.gegenpress!],
];
const ages = [29, 30, 31, 32, 33, 34, 35, 36, 37];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const rows: { name: string; load: number; ovr: number[]; wear30: number; shift30: number; peakAge: number; retire: number }[] = [];
for (const [name, load] of variants) {
  const ovrAt = ages.map(() => [] as number[]);
  const peaks: number[] = [];
  const retires: number[] = [];
  let w30 = 0;
  for (const src of pool) {
    let p = { ...src, attributes: { ...src.attributes }, age: 24 };
    let wear = 0;
    let best = -1;
    let bestAge = 24;
    // 가상 선수 은퇴 기대 나이 (retires 와 같은 곡선 · 마모 shift)
    let alive = 1;
    let eRetire = 0;
    for (let season = 2018; p.age < 38; season++) {
      wear += seasonWear(load);
      p = growNpc({ ...p, retired: false }, 'c77n-wear', season, wear);
      const o = positionOvr(p.attributes, p.position);
      if (o > best) { best = o; bestAge = p.age; }
      const k = ages.indexOf(p.age);
      if (k >= 0) ovrAt[k]!.push(o);
      if (p.age === 30) w30 += wear;
      const q = p.age >= BALANCE.retirement.forcedAge ? 1 : agingRateShifted(BALANCE.roster.retireChance, p.age, wearAging(wear, p.age).shift);
      eRetire += alive * q * p.age;
      alive *= 1 - q;
    }
    eRetire += alive * BALANCE.retirement.forcedAge;
    peaks.push(bestAge);
    retires.push(eRetire);
  }
  const wear30 = w30 / pool.length;
  rows.push({ name, load, ovr: ovrAt.map(avg), wear30, shift30: wearAging(wear30).shift, peakAge: avg(peaks), retire: avg(retires) });
}
console.log(`[C.77n 커리어 노쇠] 실제 NPC ${pool.length}명 24세부터 주전 · 리그 시즌 부하 ${base} · 챔스 +${cup} · load ${JSON.stringify({ wearFrom: BALANCE.load.wearFrom, agePerWear: BALANCE.load.agePerWear, maxShift: BALANCE.load.maxShift, ratePerWear: BALANCE.load.ratePerWear })}`);
console.log(`| 변형 | 시즌 부하 | 30세 마모 · 나이 이동 | 정점 나이 | ${ages.map((a) => `${a}세`).join(' | ')} | 가상 은퇴 기대 나이 |`);
console.log(`|---|---|---|---|${ages.map(() => '---').join('|')}|---|`);
const ref = rows.find((r) => r.name === '균형(리그만)')!;
for (const r of rows) {
  console.log(`| ${r.name} | ${r.load.toFixed(1)} | ${r.wear30.toFixed(0)} · ${r.shift30.toFixed(2)} | ${r.peakAge.toFixed(2)} | ${r.ovr.map((v, i) => `${v.toFixed(1)}${r === ref ? '' : ` (${(v - ref.ovr[i]!) >= 0 ? '+' : ''}${(v - ref.ovr[i]!).toFixed(1)})`}`).join(' | ')} | ${r.retire.toFixed(2)} |`);
}
// 같은 OVR 하락까지 걸린 나이 차 (균형 대비): 33세 균형 OVR 에 도달한 나이(선형 보간)
const reach = (r: (typeof rows)[number], target: number) => {
  for (let i = 1; i < ages.length; i++) if (r.ovr[i]! <= target) {
    const a = r.ovr[i - 1]!;
    const b = r.ovr[i]!;
    return ages[i - 1]! + (a - target) / Math.max(1e-9, a - b);
  }
  return NaN;
};
const tgt = ref.ovr[ages.indexOf(33)]!;
console.log(`균형 33세 OVR ${tgt.toFixed(1)} 에 닿는 나이: ${rows.map((r) => `${r.name} ${reach(r, tgt).toFixed(2)}`).join(' · ')}`);
