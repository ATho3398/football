#!/bin/bash
# C.82d 레버 스윕: 변형마다 4쌍 × 200경기 (시드 71000)
cd /home/user/football
PAIRS="4-3-1-2:4-4-2,4-2-3-1:4-4-2,4-3-3:4-4-2,4-3-1-2:4-2-3-1"
run() { name=$1; shift; echo "### $name $*" >> scripts/diag/c82d/sweep.log; PAIRS=$PAIRS SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 200 "$@" 2>/dev/null | grep "^|" >> scripts/diag/c82d/sweep.log; }
run base
run midGap09 formation.midGap=0.09
run closeDown35 offball.closeDownZone=35
run track30 offball.trackZone=30 offball.trackTargetZone=28
run boxMatch1 offball.boxMatch=1
run c10shoot07 role.classic10.pref.shoot=0.7
echo DONE >> scripts/diag/c82d/sweep.log
