#!/bin/bash
# C.82i 총량 레버 사다리 2 (quick 600): drop 0.42 위에 shotBase
cd /home/user/football
D=scripts/diag/c82i
Q() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "$name $(grep -m1 '  득점  ' $D/q-$name.log | awk '{print $2}') ST $(grep -m1 '득점 비율 ST' $D/q-$name.log | awk '{print $4}') $(date +%T)"; }
Q drop42-sb60 keeper.oneOnOne.drop=0.42 prob.shotBase=0.60
Q drop42-sf10-sb60 keeper.oneOnOne.drop=0.42 prob.shotFree=0.10 prob.shotBase=0.60
Q drop42-sb59 keeper.oneOnOne.drop=0.42 prob.shotBase=0.59
echo QLDONE
