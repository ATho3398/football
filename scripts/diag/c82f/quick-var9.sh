#!/bin/bash
# 총량 9차: saveBase 가 상한(0.95) 포화로 둔해(2.18 1.58 · 2.22 1.56 · 2.26 ?) 12~16.5 m 거리 보정(distAdjV[1],[2] −0.13) 을 총량 레버로
cd /home/user/football
D=scripts/diag/c82f
until grep -q QVAR8DONE $D/quick-var8.out; do sleep 5; done
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |득점 비율|슈팅 비율 ST|골 경로: (세트|리바)|PK \(|선방률" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4 physics.fatigueIntensity=0.45 keeper.oneOnOne.drop=0.55 prob.stFinish=1.15"
run d09 $R keeper.saveBase=2.02 keeper.distAdjV.1=-0.09 keeper.distAdjV.2=-0.09
run d06 $R keeper.saveBase=2.02 keeper.distAdjV.1=-0.06 keeper.distAdjV.2=-0.06
run d08s210 $R keeper.saveBase=2.10 keeper.distAdjV.1=-0.08 keeper.distAdjV.2=-0.08
echo QVAR9DONE
