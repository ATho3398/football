#!/bin/bash
# 최종 후보 (quick 600): 리바운드 레버 + 지친 선수 감속 0.45 + 1대1 drop/saveBase 두 벌
cd /home/user/football
D=scripts/diag/c82f
until grep -q QVAR4DONE $D/quick-var4.out; do sleep 5; done
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |득점 비율|슈팅 비율 ST|골 경로: (세트|리바)|PK \(" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4 physics.fatigueIntensity=0.45"
run fA $R keeper.oneOnOne.drop=0.55 keeper.saveBase=2.15
run fB $R keeper.oneOnOne.drop=0.6 keeper.saveBase=2.17
echo QVAR5DONE
