#!/bin/bash
# C.82h 총량 레버 사다리 2: 1대1 drop × shotFree 조합 (quick 600)
cd /home/user/football
D=scripts/diag/c82h
until grep -q QLDONE $D/qladder.out; do sleep 10; done
Q() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "$name $(grep -m1 '  득점  ' $D/q-$name.log | awk '{print $2}') ST $(grep -m1 '득점 비율 ST' $D/q-$name.log | awk '{print $4}') 리바운드 $(grep -m1 '리바운드 %' $D/q-$name.log | awk '{print $5}') $(date +%T)"; }
Q drop50-sf20 keeper.oneOnOne.drop=0.5 prob.shotFree=0.2
Q drop45-sf20 keeper.oneOnOne.drop=0.45 prob.shotFree=0.2
Q drop50-sf15 keeper.oneOnOne.drop=0.5 prob.shotFree=0.15
Q drop50-sf25 keeper.oneOnOne.drop=0.5 prob.shotFree=0.25
echo QL2DONE
