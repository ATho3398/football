// 진단 (21.5.2, 부록 C.22): tactical-report.ts 가 저장한 팀별 경기 통계로 판정 빈도를 센다 (경계값은 BALANCE.tacticalReport)
// 실행: npx vite-node scripts/diag/tactical-report-freq.ts -- 파일1.json [파일2.json …]
import { readFileSync } from 'node:fs';
import { commonVerdict, longPct, longShare, passPct, tendencyVerdict, type ReportInput } from '../../src/tacticalReport';

const files = process.argv.slice(2).filter((a) => a !== '--');
const rows: ReportInput[] = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as ReportInput[]);
const by = new Map<string, ReportInput[]>();
for (const r of rows) by.set(r.tendency, [...(by.get(r.tendency) ?? []), r]);
const pc = (a: number, b: number) => `${((a / Math.max(1, b)) * 100).toFixed(0)}%`;
const q = (xs: number[], k: number) => [...xs].sort((a, b) => a - b)[Math.floor(k * (xs.length - 1))]!;
console.log(`팀 경기 ${rows.length}개 (경기 ${rows.length / 2})`);
console.log('\n[성향 판정] 성향 / 표본 / ✓ / ✗');
for (const [t, rs] of by) {
  const v = rs.map(tendencyVerdict);
  console.log(`${t.padEnd(11)} ${String(rs.length).padStart(4)}  ✓ ${pc(v.filter((x) => x?.ok).length, rs.length).padStart(4)}  ✗ ${pc(v.filter((x) => x && !x.ok).length, rs.length).padStart(4)}`);
}
console.log('\n[공통 판정] (우선순위대로 첫 번째만)');
const cnt = new Map<string, number>();
for (const r of rows) {
  const v = commonVerdict(r);
  const k = v ? `${v.id} ${v.title.replace(/\d+/, 'n')}` : '없음';
  cnt.set(k, (cnt.get(k) ?? 0) + 1);
}
for (const [k, n] of [...cnt].sort()) console.log(`${k.padEnd(28)} ${pc(n, rows.length)}`);
console.log('\n[분포] 10/25/50/75/90 백분위');
const dist = (label: string, f: (r: ReportInput) => number, rs = rows) => console.log(`${label.padEnd(26)} ${[0.1, 0.25, 0.5, 0.75, 0.9].map((k) => q(rs.map(f), k)).join(' / ')}`);
dist('점유 %', (r) => r.own.poss);
dist('슈팅', (r) => r.own.shots);
dist('유효 슈팅', (r) => r.own.onTarget);
dist('역습 슈팅', (r) => r.own.counterShots);
dist('역습 슈팅 비율 %', (r) => Math.round((r.own.counterShots / Math.max(1, r.own.shots)) * 100));
dist('상대 진영 탈취', (r) => r.own.oppHalfWins);
dist('탈취 비 (우리/상대) ×10', (r) => Math.round((r.own.oppHalfWins / Math.max(1, r.opp.oppHalfWins)) * 10));
dist('패스 성공 %', (r) => passPct(r.own));
dist('롱패스 비율 %', (r) => longShare(r.own));
dist('롱패스 성공 %', (r) => longPct(r.own));
dist('중앙 슈팅', (r) => r.own.centralShots);
dist('오프사이드', (r) => r.own.offsides);
dist('크로스', (r) => r.own.crosses);
for (const [t, rs] of by) {
  console.log(`-- ${t}`);
  dist('  점유 %', (r) => r.own.poss, rs);
  dist('  역습 슈팅', (r) => r.own.counterShots, rs);
  dist('  탈취 / 상대 탈취', (r) => r.own.oppHalfWins - r.opp.oppHalfWins, rs);
  dist('  상대 탈취 우리', (r) => r.own.oppHalfWins, rs);
  dist('  롱패스 비율 %', (r) => longShare(r.own), rs);
  dist('  롱패스 성공 %', (r) => longPct(r.own), rs);
  dist('  상대 유효 슈팅', (r) => r.opp.onTarget, rs);
  dist('  상대 중앙 슈팅', (r) => r.opp.centralShots, rs);
  dist('  슈팅 차', (r) => r.own.shots - r.opp.shots, rs);
}
