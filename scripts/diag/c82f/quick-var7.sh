#!/bin/bash
# ST 비율 레버 7차: ST 발 슛 유효 슈팅 배수(prob.stFinish, 새 상수)
cd /home/user/football
D=scripts/diag/c82f
until grep -q QVAR6DONE $D/quick-var6.out; do sleep 5; done
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |득점 비율|슈팅 비율 ST|골 경로: (세트|리바)|PK \(" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4 physics.fatigueIntensity=0.45 keeper.oneOnOne.drop=0.55"
run st110 $R keeper.saveBase=2.17 prob.stFinish=1.1
run st115 $R keeper.saveBase=2.18 prob.stFinish=1.15
echo QVAR7DONE
