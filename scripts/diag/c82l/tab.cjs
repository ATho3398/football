// C.82l: trans-<태그>.txt 들에서 부록 전환 표 행을 뽑는다. 사용: node tab.cjs 태그[:라벨] ...  (태그에 -s42 가 붙으면 42000 시드)
const fs = require('fs');
const D = 'scripts/diag/c82l';
function read(tag) {
  const f = `${D}/trans-${tag}.txt`;
  if (!fs.existsSync(f)) return null;
  const t = fs.readFileSync(f, 'utf8');
  const sum = (who) => { const m = t.match(new RegExp(`${who} 대상: .*전환\\(같은 소유 15 s\\) ([\\d.]+) .*전환 xG/경기 ([\\d.]+) · 실점/경기 ([\\d.]+)`)); return m ? { shot: +m[1], xg: +m[2], ga: +m[3] } : null; };
  const re = (who) => { const row = t.split('\n').find((l) => l.startsWith(`| ${who} | 대상 | 전체 |`)); return row ? +row.split('|')[5].trim() : NaN; };
  const gd = (t.match(/게겐 득실\/경기 (-?[\d.]+)/) || [])[1];
  return { g: sum('게겐'), b: sum('균형'), rg: re('게겐'), rb: re('균형'), gd: gd ? +gd : NaN };
}
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
for (const arg of process.argv.slice(2)) {
  const [tag, label] = arg.split(':');
  const r = read(tag);
  if (!r || !r.g || !r.b) { console.log(`| ${label ?? tag} | (없음) |`); continue; }
  console.log(`| ${label ?? tag} | ${f2(r.g.shot)} / ${f2(r.b.shot)} | ${f2(r.g.shot / r.b.shot)} | ${f3(r.g.xg)} / ${f3(r.b.xg)} | ${f2(r.g.xg / r.b.xg)} | ${r.rg.toFixed(1)} / ${r.rb.toFixed(1)} (${(r.rg - r.rb) >= 0 ? '+' : ''}${(r.rg - r.rb).toFixed(1)}) | ${f2(r.g.ga)} / ${f2(r.b.ga)} | ${r.gd >= 0 ? '+' : ''}${f3(r.gd)} |`);
}
