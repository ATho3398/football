#!/bin/bash
# C.82l 상성 칸 3차: 게겐 → 티키 −8/−4 (사다리가 단조가 아님: −10/−6 +0.125 · −11/−7 +0.16 · −12/−8 +0.20)
cd /home/user/football
D=scripts/diag/c82l
until grep -q CELLS2DONE $D/cells2.out; do sleep 10; done
echo "start $(date +%T)"
$D/cell.sh GT84 gegenpress/tikitaka matchup.gegenpress.tikitaka.tackle=-8 matchup.gegenpress.tikitaka.air=-4
echo "CELLS3DONE $(date +%T)"
