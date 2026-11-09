#!/bin/bash
# C.82l 상성 칸 2차: 게겐 → 티키 사다리 (−12/−8 +0.20 · −11/−7 +0.16 — 잡음 ±0.05, 목표 +0.25 가운데)
cd /home/user/football
D=scripts/diag/c82l
until grep -q CELLSDONE $D/cells.out; do sleep 10; done
echo "start $(date +%T)"
$D/cell.sh GT106 gegenpress/tikitaka matchup.gegenpress.tikitaka.tackle=-10 matchup.gegenpress.tikitaka.air=-6
$D/cell.sh GT95 gegenpress/tikitaka matchup.gegenpress.tikitaka.tackle=-9 matchup.gegenpress.tikitaka.air=-5
echo "CELLS2DONE $(date +%T)"
