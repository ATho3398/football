#!/bin/bash
# C.82l 정통 윙어 쪽 풀백 가산 변형 — role-pair 400 WING × 시드 47000·57000 (기준 c82k wing-final-*.log: 정통 윙어 역할 대비 −0.21 / −0.03 = −0.12)
cd /home/user/football
D=scripts/diag/c82l
TAG=$1; shift
for s in 47000 57000; do SEED=$s npx vite-node scripts/diag/role-pair.ts -- 400 WING "$@" > $D/wing-$TAG-$s.log 2>&1; done
echo "WINGDONE $TAG $(date +%T)"
grep "^| 정통 윙어\|^| 와이드 미드" $D/wing-$TAG-47000.log $D/wing-$TAG-57000.log | cut -c1-90
