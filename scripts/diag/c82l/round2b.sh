#!/bin/bash
# C.82l 2b차: 라인 유지 연장 묶음 (FP 와 LH 가 서로 깎는지)
cd /home/user/football
D=scripts/diag/c82l
until grep -q ROUND2DONE $D/round2.out; do sleep 10; done
echo "start $(date +%T)"
$D/trans.sh FP08LH2 tendency.gegenFirstPass=0.08 tendency.gegenLineHoldExtra=2
$D/trans.sh FP06LH2 tendency.gegenFirstPass=0.06 tendency.gegenLineHoldExtra=2
$D/trans.sh FP08LH2BD1 tendency.gegenFirstPass=0.08 tendency.gegenLineHoldExtra=2 tendency.gegenBreakDelay=1
echo "ROUND2BDONE $(date +%T)"
