#!/bin/bash
# ST 비율 레버 6차: 윙어 마무리 배수(prob.wingFinish 0.92) 낮춤 — 윙 29~30% → ST 로
cd /home/user/football
D=scripts/diag/c82f
until grep -q QVAR5DONE $D/quick-var5.out; do sleep 5; done
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |득점 비율|슈팅 비율 ST|골 경로: (세트|리바)|PK \(" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4 physics.fatigueIntensity=0.45 keeper.oneOnOne.drop=0.55"
run w80 $R keeper.saveBase=2.15 prob.wingFinish=0.8
run w70 $R keeper.saveBase=2.12 prob.wingFinish=0.7
echo QVAR6DONE
