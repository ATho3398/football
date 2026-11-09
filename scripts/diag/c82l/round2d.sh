#!/bin/bash
# C.82l 2d차: 라인 유지 연장 3 s 와 첫 패스 압박 묶음 · 연장 2 + 지연 2 (2c 뒤, 윙어 측정과 동시)
cd /home/user/football
D=scripts/diag/c82l
until grep -q ROUND2CDONE $D/round2c.out; do sleep 10; done
echo "start $(date +%T)"
$D/trans.sh FP04LH3 tendency.gegenFirstPass=0.04 tendency.gegenLineHoldExtra=3
$D/trans.sh FP08LH3 tendency.gegenFirstPass=0.08 tendency.gegenLineHoldExtra=3
$D/trans.sh LH2BD2 tendency.gegenLineHoldExtra=2 tendency.gegenBreakDelay=2
$D/trans.sh FP04LH2BD1 tendency.gegenFirstPass=0.04 tendency.gegenLineHoldExtra=2 tendency.gegenBreakDelay=1
echo "ROUND2DDONE $(date +%T)"
