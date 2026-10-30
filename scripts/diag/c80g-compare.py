# C.80g: 상성 비교 — 기준 = main 960 기준표 c80e-matrix-41/51 (C.80e), 새 = 인자 json 들(시드 묶음별, 칸은 묶음 평균). 행 = 그 성향 기준 6칸 평균 득실차
# 실행: python3 scripts/diag/c80g-compare.py 새41.json [새51.json]   (기준도 같은 시드 묶음만 씀)
import json, sys
cell = lambda r: (r['gf'] - r['ga']) / r['n']
def load(files):
    acc = {}
    for f in files:
        for r in json.load(open(f)): acc.setdefault((r['a'], r['b']), []).append(cell(r))
    return {k: sum(v) / len(v) for k, v in acc.items()}
newf = sys.argv[1:]
seeds = ['51' if '51' in f.split('/')[-1] else '41' for f in newf]
base = load([f'scripts/diag/c80e-matrix-{s}.json' for s in seeds])
new = load(newf)
T = ['balanced', 'tikitaka', 'gegenpress', 'counter', 'direct', 'block', 'block@0020']
g = lambda m, a, b: m[(a, b)] if (a, b) in m else -m[(b, a)]
row = lambda m, t: sum(g(m, t, o) for o in T if o != t) / 6
print('행 | main | C.80g | 변화')
for t in T: print(f'{t} | {row(base,t):+.3f} | {row(new,t):+.3f} | {row(new,t)-row(base,t):+.3f}')
nb = sum(row(new, t) - row(base, t) for t in ['direct', 'block', 'block@0020'])
print(f'비점유 3행 합 변화 {nb:+.3f} (관문 ≥ −0.08)')
for m, nm in [(base, 'main'), (new, 'C.80g')]:
    c = [g(m, 'gegenpress', 'tikitaka'), g(m, 'tikitaka', 'direct'), g(m, 'direct', 'block'), g(m, 'block', 'gegenpress')]
    print(nm, '순환 G>T T>D D>B B>G', ' '.join(f'{x:+.3f}' for x in c), f'평균 {sum(c)/4:+.3f}')
print('칸 변화:', ', '.join(f'{a}/{b} {new[(a,b)]-base[(a,b)]:+.2f}' for (a, b) in new))
