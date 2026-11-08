#!/bin/bash
# 득점 비율 ST 레버 (quick 600). 리바운드 레버(parryDownSave 0.4·catchSkill 0.4) 포함. 기준 reb: 1.50 · ST 31 · 윙 29 · 미드 27 · 수비 13
cd /home/user/football
D=scripts/diag/c82f
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |득점 비율|슈팅 비율|골 경로: (세트|리바)|코너 몇|PK \(" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4"
run fin20 $R prob.finishPerPoint=0.02
run fw07 $R prob.crossFarWing=0.7
run fin20-fw07 $R prob.finishPerPoint=0.02 prob.crossFarWing=0.7
echo QVAR2DONE
