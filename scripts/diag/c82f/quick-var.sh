#!/bin/bash
# 득점 총량·비율 레버 (quick 600, C.82d 명령). 기준 main 1.49 · ST 29 · 미드 29 · 수비 13 · 리바운드 4 · 세트피스 29
cd /home/user/football
D=scripts/diag/c82f
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |득점 비율|골 경로|1대1|코너 몇|PK \(" $D/q-$name.log; }
run reb keeper.parryDownSave=0.4 keeper.catchSkill=0.4
run reb-st5 keeper.parryDownSave=0.4 keeper.catchSkill=0.4 prob.setPieceTargetWst=5
run reb-st5-sb200 keeper.parryDownSave=0.4 keeper.catchSkill=0.4 prob.setPieceTargetWst=5 keeper.saveBase=2.0
run reb-st5-sb198 keeper.parryDownSave=0.4 keeper.catchSkill=0.4 prob.setPieceTargetWst=5 keeper.saveBase=1.98
echo QVARDONE
