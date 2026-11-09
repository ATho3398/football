#!/bin/bash
# 같은 trans.sh 이되 시드 42000·42100 (확인용 두 번째 200경기)
cd /home/user/football
D=scripts/diag/c82l
TAG=$1; shift
for t in gegenpress balanced; do for s in 42000 42100; do
  npx vite-node scripts/diag/em28-trans.ts -- 100 seed=$s tac=$t out=$D/tr-$TAG-$t-$s.json "$@" > $D/tr-$TAG-$t-$s.log 2>&1 &
done; done; wait
node scripts/diag/em28-report.cjs 게겐=$D/tr-$TAG-gegenpress-42000.json,$D/tr-$TAG-gegenpress-42100.json 균형=$D/tr-$TAG-balanced-42000.json,$D/tr-$TAG-balanced-42100.json > $D/trans-$TAG-s42.txt 2>&1
echo "TRANSDONE $TAG s42 $(date +%T)"; grep "대상:" $D/trans-$TAG-s42.txt
