#!/bin/bash
# 총량 마무리 8차: stFinish 1.15 고정, saveBase 사다리
cd /home/user/football
D=scripts/diag/c82f
until grep -q QVAR7DONE $D/quick-var7.out; do sleep 5; done
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |득점 비율|슈팅 비율 ST|골 경로: (세트|리바)|PK \(" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4 physics.fatigueIntensity=0.45 keeper.oneOnOne.drop=0.55 prob.stFinish=1.15"
run sb222 $R keeper.saveBase=2.22
run sb226 $R keeper.saveBase=2.26
echo QVAR8DONE
