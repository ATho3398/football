// C.81s: 상성 합본 칸 표 · 행 강도 · 관문 칸 (± SE). 실행: node scripts/diag/c81s-show.cjs 파일.json [기준.json(행 Δ)]
const fs = require('fs');
const load = (f) => {
  const d = {}, se = {};
  for (const x of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    const v = (x.gf - x.ga) / x.n;
    const u = x.unit ?? []; const m = u.reduce((a, b) => a + b, 0) / (u.length || 1);
    const e = u.length > 1 ? Math.sqrt(u.reduce((a, b) => a + (b - m) ** 2, 0) / (u.length - 1) / u.length) : 0;
    (d[x.a] ??= {})[x.b] = v; (d[x.b] ??= {})[x.a] = -v; (se[x.a] ??= {})[x.b] = e; (se[x.b] ??= {})[x.a] = e;
  }
  return { d, se };
};
const [fa, fb] = process.argv.slice(2);
const { d, se } = load(fa);
const T = ['balanced', 'tikitaka', 'gegenpress', 'counter', 'direct', 'block', 'block@0020'].filter((t) => d[t]);
const nm = { balanced: '균형', tikitaka: '티키', gegenpress: '게겐', counter: '역습', direct: '직선', block: '블록', 'block@0020': '버스' };
const f = (v) => (v == null ? '   .  ' : (v >= 0 ? '+' : '') + v.toFixed(3));
console.log('      ' + T.map((t) => nm[t].padStart(6)).join(' '));
for (const a of T) console.log(nm[a].padEnd(4) + '  ' + T.map((b) => (a === b ? '     -' : f(d[a][b]).padStart(6))).join(' '));
const row = (D, t) => { const o = T.filter((x) => x !== t && D[t]?.[x] != null); return o.reduce((s, x) => s + D[t][x], 0) / o.length; };
console.log('행 강도:', T.map((t) => `${nm[t]} ${f(row(d, t))}`).join(' · '));
if (fb) { const B = load(fb).d; const dl = T.map((t) => row(d, t) - row(B, t)); console.log(`행 Δ (vs ${fb.split('/').pop()}):`, T.map((t, i) => `${nm[t]} ${f(dl[i])}`).join(' · '), '| 비점유 3행 합', f(dl[4] + dl[5] + dl[6])); }
const c = (a, b) => `${f(d[a]?.[b])}±${(se[a]?.[b] ?? 0).toFixed(3)}`;
const cyc = ['gegenpress', 'tikitaka', 'direct', 'block'];
console.log(`순환 G>T>D>B ${f(cyc.reduce((s, t, i) => s + d[t][cyc[(i + 1) % 4]], 0))} | 게겐>티키 ${c('gegenpress', 'tikitaka')} | 티키>직선 ${c('tikitaka', 'direct')} | 직선>블록 ${c('direct', 'block')} | 게겐>직선 ${c('gegenpress', 'direct')} | 직선>버스 ${c('direct', 'block@0020')} | 블록>게겐 ${c('block', 'gegenpress')}`);
