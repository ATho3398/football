#!/bin/bash
# C.82e 측정 묶음: 전환(em28-trans) + 재탈취(c82e-rewin), 게겐·균형 × 시드 41000·41100. 사용: bash run-set.sh 이름 [경로=값 …]
cd /home/user/football
name=$1; shift
D=scripts/diag/c82e
for t in gegenpress balanced; do for sd in 41000 41100; do
  npx vite-node scripts/diag/c82e-rewin.ts -- 100 seed=$sd tac=$t out=$D/$name-rw-$t-$sd.json "$@" > $D/$name-rw-$t-$sd.log 2>&1 &
done; done; wait
for t in gegenpress balanced; do for sd in 41000 41100; do
  npx vite-node scripts/diag/em28-trans.ts -- 100 seed=$sd tac=$t out=$D/$name-tr-$t-$sd.json "$@" > $D/$name-tr-$t-$sd.log 2>&1 &
done; done; wait
echo "== $name 재탈취"; node scripts/diag/c82e-rewin-report.cjs 게겐=$D/$name-rw-gegenpress-41000.json,$D/$name-rw-gegenpress-41100.json 균형=$D/$name-rw-balanced-41000.json,$D/$name-rw-balanced-41100.json
echo "== $name 전환"; node scripts/diag/em28-report.cjs 게겐=$D/$name-tr-gegenpress-41000.json,$D/$name-tr-gegenpress-41100.json 균형=$D/$name-tr-balanced-41000.json,$D/$name-tr-balanced-41100.json | grep -v "^| .* 상대 |" | grep -v "^| .* 자기⅓\|^| .* 가운데"
echo DONE
