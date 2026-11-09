#!/bin/bash
# C.82k 게겐 전환 비용 (em28-trans 100 × 시드 41000·41100, 게겐·균형 4-4-2 대 균형 4-4-2) — 4개 동시. 사용: trans.sh 태그 [경로=값 …]
cd /home/user/football
D=scripts/diag/c82k
TAG=$1; shift
for t in gegenpress balanced; do for s in 41000 41100; do
  npx vite-node scripts/diag/em28-trans.ts -- 100 seed=$s tac=$t out=$D/tr-$TAG-$t-$s.json "$@" > $D/tr-$TAG-$t-$s.log 2>&1 &
done; done; wait
node scripts/diag/em28-report.cjs 게겐=$D/tr-$TAG-gegenpress-41000.json,$D/tr-$TAG-gegenpress-41100.json 균형=$D/tr-$TAG-balanced-41000.json,$D/tr-$TAG-balanced-41100.json > $D/trans-$TAG.txt 2>&1
echo "TRANSDONE $TAG $(date +%T)"; tail -7 $D/trans-$TAG.txt
