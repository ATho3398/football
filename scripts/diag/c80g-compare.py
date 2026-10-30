# C.80g: 상성 41000 480 비교 — main 기준 = c79q-matrix-41 + 게겐 5칸 c80c-g5-s41 + 티키/게겐 c80c-tg-s41(960). 행 = 그 성향 기준 6칸 평균 득실차
import json, sys
L = lambda f: json.load(open(f'scripts/diag/{f}.json'))
cell = lambda r: (r['gf'] - r['ga']) / r['n']
base = {(r['a'], r['b']): cell(r) for r in L('c79q-matrix-41')}
for r in L('c80c-g5-s41') + L('c80c-tg-s41'): base[(r['a'], r['b'])] = cell(r)
new = {(r['a'], r['b']): cell(r) for r in L(sys.argv[1] if len(sys.argv) > 1 else 'c80g-matrix-41')}
T = ['balanced', 'tikitaka', 'gegenpress', 'counter', 'direct', 'block', 'block@0020']
def row(m, t):
    v = [m[(t, o)] if (t, o) in m else -m[(o, t)] for o in T if o != t]
    return sum(v) / len(v)
print('행 | main | C.80g | 변화')
for t in T:
    print(f'{t} | {row(base,t):+.3f} | {row(new,t):+.3f} | {row(new,t)-row(base,t):+.3f}')
g = lambda m, a, b: m[(a, b)] if (a, b) in m else -m[(b, a)]
for m, nm in [(base, 'main'), (new, 'C.80g')]:
    print(nm, '순환 G>T', f"{g(m,'gegenpress','tikitaka'):+.3f}", 'T>D', f"{g(m,'tikitaka','direct'):+.3f}", 'D>B', f"{g(m,'direct','block'):+.3f}", 'B>G', f"{g(m,'block','gegenpress'):+.3f}")
print('칸 변화:', ', '.join(f'{a}/{b} {new[(a,b)]-base[(a,b)]:+.2f}' for (a, b) in new))
