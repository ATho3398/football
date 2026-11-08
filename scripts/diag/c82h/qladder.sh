#!/bin/bash
# C.82h 총량 레버 사다리 (quick 600, 새 코드 stFinishShare 1 · freeFront 1 위에서)
cd /home/user/football
D=scripts/diag/c82h
Q() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "$name $(grep -m1 '  득점  ' $D/q-$name.log | awk '{print $2}') ST $(grep -m1 '득점 비율 ST' $D/q-$name.log | awk '{print $4}') $(date +%T)"; }
Q drop50 keeper.oneOnOne.drop=0.5
Q drop45 keeper.oneOnOne.drop=0.45
Q st11 prob.stFinish=1.1
Q sf20 prob.shotFree=0.2
Q drop50-st11 keeper.oneOnOne.drop=0.5 prob.stFinish=1.1
echo QLDONE
