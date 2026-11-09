#!/bin/bash
# C.82i 총량 레버 사다리 (quick 600 = 균형 4-2-3-1 끼리, 새 코드 frontLine 0.65 · share 0.3 · stFinish 1.3 위에서)
cd /home/user/football
D=scripts/diag/c82i
Q() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "$name $(grep -m1 '  득점  ' $D/q-$name.log | awk '{print $2}') ST $(grep -m1 '득점 비율 ST' $D/q-$name.log | awk '{print $4}') $(date +%T)"; }
Q drop42 keeper.oneOnOne.drop=0.42
Q drop42-sf10 keeper.oneOnOne.drop=0.42 prob.shotFree=0.10
Q drop45-sf08 keeper.oneOnOne.drop=0.45 prob.shotFree=0.08
Q drop38 keeper.oneOnOne.drop=0.38
Q sf05 prob.shotFree=0.05
echo QLDONE
