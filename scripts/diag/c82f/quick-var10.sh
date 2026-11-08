#!/bin/bash
# 총량 10차: 슛 판단 가산(decide.bias.shoot 0.14) 낮춤 — 질 낮은(먼) 슛부터 줄어 총량 ↓ · 슈팅 14.9(목표 12) ↓ · 미드 몫 ↓
cd /home/user/football
D=scripts/diag/c82f
until grep -q QVAR9DONE $D/quick-var9.out; do sleep 5; done
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |  슈팅  |유효 슈팅  |득점 비율|슈팅 비율 ST|골 경로: (세트|리바)|PK \(" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4 physics.fatigueIntensity=0.45 keeper.oneOnOne.drop=0.55 prob.stFinish=1.15 keeper.saveBase=2.02"
run sh10 $R decide.bias.shoot=0.10
run sh06 $R decide.bias.shoot=0.06
echo QVAR10DONE
