#!/bin/bash
# C.82l 확인: 상위 후보를 시드 42000·42100 200경기로 다시 (400경기 합으로 슛 비 판단)
cd /home/user/football
D=scripts/diag/c82l
until grep -q ROUND2DDONE $D/round2d.out; do sleep 10; done
echo "start $(date +%T)"
$D/trans2.sh FP04LH3 tendency.gegenFirstPass=0.04 tendency.gegenLineHoldExtra=3
$D/trans2.sh LH3 tendency.gegenLineHoldExtra=3
$D/trans2.sh LH2BD1 tendency.gegenLineHoldExtra=2 tendency.gegenBreakDelay=1
echo "CONFIRMDONE $(date +%T)"
