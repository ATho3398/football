// C.81x 할당 표본 프로파일: node --heap-prof 는 살아 있는 객체만 남겨 경기 중 할당·해제(churn)가 안 보인다 → inspector 로 죽은 객체까지 포함해 기록한다.
// 사용: BENCH=<c81e-bench 번들.mjs> OUT=<out.heapprofile> node scripts/diag/c81x-allocprof.mjs x <N>  → node scripts/diag/c81x-profsum.mjs <out.heapprofile> <N>
import inspector from 'node:inspector';
import fs from 'node:fs';
const sess = new inspector.Session();
sess.connect();
const post = (m, p) => new Promise((res, rej) => sess.post(m, p, (e, r) => (e ? rej(e) : res(r))));
await post('HeapProfiler.enable');
await post('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
process.argv[2] = process.argv[3];
await import(process.env.BENCH);
const r = await post('HeapProfiler.stopSampling');
fs.writeFileSync(process.env.OUT, JSON.stringify(r.profile));
