#!/bin/bash
# C.82l 2차: 첫 패스 압박 + 복귀 지연 묶음 (시드 41000·41100 200경기)
cd /home/user/football
D=scripts/diag/c82l
until grep -q ROUND1DONE $D/round1.out; do sleep 10; done
echo "start $(date +%T)"
$D/trans.sh FP08BD2 tendency.gegenFirstPass=0.08 tendency.gegenBreakDelay=2
$D/trans.sh FP08BD3 tendency.gegenFirstPass=0.08 tendency.gegenBreakDelay=3
$D/trans.sh FP10BD2 tendency.gegenFirstPass=0.10 tendency.gegenBreakDelay=2
echo "ROUND2DONE $(date +%T)"
