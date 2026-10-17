// 레전드 팩 점검 (C.47): 명단 수·전성기 OVR·시작 나이/OVR·소속 분포, 시즌 갱신으로 29~31세 OVR 이 전성기에 닿는지.
// 실행: npx vite-node scripts/diag/c47-legends.ts -- [시드 수(기본 3)]
import { LEGENDS, legendPeak, legendSpawns } from '../../src/legends';
import { initialTeams } from '../../src/league';
import { rebuildRosters } from '../../src/game';
import { naturalOvr } from '../../src/roster';

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 3);
const teams = initialTeams().map((t) => ({ id: t.id, rating: t.baseRating }));
console.log(`명단 ${LEGENDS.length}명 (GK ${LEGENDS.filter((l) => l.position === 'GK').length})`);
const peaks = LEGENDS.map((l) => legendPeak(l).ovr);
console.log(`전성기 OVR 평균 ${(peaks.reduce((a, b) => a + b, 0) / peaks.length).toFixed(1)} 최소 ${Math.min(...peaks)} 최대 ${Math.max(...peaks)}`);
for (const l of LEGENDS) if (legendPeak(l).ovr > 96) console.log(`  범위 밖 ${l.id} ${legendPeak(l).ovr}`);
const sp = legendSpawns('c47', 2018, teams);
const byTeam: Record<string, number> = {};
for (const s of sp) byTeam[s.teamId] = (byTeam[s.teamId] ?? 0) + 1;
console.log('소속', JSON.stringify(byTeam));
const diffs: number[] = [];
for (let k = 0; k < N; k++) {
  const ws = `lg${k}`;
  const r0 = rebuildRosters(ws, undefined, 0, undefined, [], { on: true });
  const found0 = Object.values(r0).flatMap((r) => r.players.filter((p) => p.legend));
  const r12 = rebuildRosters(ws, undefined, 12, undefined, [], { on: true });
  const all = Object.values(r12).flatMap((r) => r.players);
  console.log(`시드 ${ws}: 시작 로스터 레전드 ${found0.length}명, 12시즌 뒤 남은 레전드 ${all.filter((p) => p.legend).length}명`);
  for (const lg of found0) {
    const peak = lg.peakOvr;
    // 29~31세가 되는 시즌 수
    const need = 30 - lg.age;
    if (need < 0 || need > 15) continue;
    const r = rebuildRosters(ws, undefined, need, undefined, [], { on: true });
    const p = Object.values(r).flatMap((x) => x.players).find((x) => x.id === lg.id);
    if (p) diffs.push(naturalOvr(p) - peak);
  }
}
diffs.sort((a, b) => a - b);
console.log(`30세 OVR − 전성기: 평균 ${(diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(2)} 중앙 ${diffs[diffs.length >> 1]} 범위 ${diffs[0]}~${diffs.at(-1)} (n=${diffs.length})`);
