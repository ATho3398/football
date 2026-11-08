#!/bin/bash
# 총량 12차(최종 후보): shotFree ↓ + 12~16.5 m 거리 보정 소폭 (saveBase 2.02 그대로)
cd /home/user/football
D=scripts/diag/c82f
until grep -q QVAR11DONE $D/quick-var11.out; do sleep 5; done
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |  슈팅  |유효 슈팅  |득점 비율|슈팅 비율 ST|골 경로: (세트|리바)|PK \(|상황 고정" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4 physics.fatigueIntensity=0.45 keeper.oneOnOne.drop=0.55 prob.stFinish=1.15 keeper.saveBase=2.02"
run F1 $R prob.shotFree=0.10 keeper.distAdjV.1=-0.11 keeper.distAdjV.2=-0.11
run F2 $R prob.shotFree=0.12 keeper.distAdjV.1=-0.09 keeper.distAdjV.2=-0.09
echo QVAR12DONE
