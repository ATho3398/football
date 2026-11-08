#!/bin/bash
# 총량 11차: 자유로운 슛 유효 가산(prob.shotFree 0.30) 낮춤 — GK 쪽(saveBase·거리 보정)은 상한 포화로 둔함, 슛 쪽 레버
cd /home/user/football
D=scripts/diag/c82f
until grep -q QVAR10DONE $D/quick-var10.out; do sleep 5; done
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |  슈팅  |유효 슈팅  |득점 비율|슈팅 비율 ST|골 경로: (세트|리바)|PK \(" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4 physics.fatigueIntensity=0.45 keeper.oneOnOne.drop=0.55 prob.stFinish=1.15 keeper.saveBase=2.02"
run sf20 $R prob.shotFree=0.2
run sf12 $R prob.shotFree=0.12
echo QVAR11DONE
