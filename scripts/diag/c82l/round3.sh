#!/bin/bash
# C.82l 3차: 정통 윙어 쪽 풀백 가산 −3 / +3 (role-pair 400 WING × 2 시드), 2차 끝난 뒤
cd /home/user/football
D=scripts/diag/c82l
until grep -q ROUND2BDONE $D/round2b.out; do sleep 10; done
echo "start $(date +%T)"
$D/wing.sh FBm3 roles.classicWingerFbGap=-3
$D/wing.sh FBp3 roles.classicWingerFbGap=3
echo "ROUND3DONE $(date +%T)"
