#!/bin/bash
# C.82l 1차: 레버 하나씩 (em28-trans 200경기, 기준 = c82k trans-final2.txt 4.22/3.92 · 30.3/29.2)
cd /home/user/football
D=scripts/diag/c82l
echo "start $(date +%T)"
$D/trans.sh FP04 tendency.gegenFirstPass=0.04
$D/trans.sh FP08 tendency.gegenFirstPass=0.08
$D/trans.sh BD2 tendency.gegenBreakDelay=2
$D/trans.sh LH2 tendency.gegenLineHoldExtra=2
echo "ROUND1DONE $(date +%T)"
