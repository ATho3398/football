#!/bin/bash
# C.82l 2c차: 라인 유지 연장 축 보강 (LH3 · FP04+LH2 · LH2+BD1)
cd /home/user/football
D=scripts/diag/c82l
until grep -q ROUND2BDONE $D/round2b.out; do sleep 10; done
echo "start $(date +%T)"
$D/trans.sh LH3 tendency.gegenLineHoldExtra=3
$D/trans.sh FP04LH2 tendency.gegenFirstPass=0.04 tendency.gegenLineHoldExtra=2
$D/trans.sh LH2BD1 tendency.gegenLineHoldExtra=2 tendency.gegenBreakDelay=1
echo "ROUND2CDONE $(date +%T)"
