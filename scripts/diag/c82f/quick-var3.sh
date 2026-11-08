#!/bin/bash
# ST 비율 레버 3차: 1대1 보정 ↑ + saveBase ↑ (C.81s 방식) · 줄 대응
cd /home/user/football
D=scripts/diag/c82f
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |득점 비율|슈팅 비율 ST|골 경로: (세트|리바)|PK \(" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4"
run oo55 $R keeper.oneOnOne.drop=0.55 keeper.saveBase=2.05
run oo70 $R keeper.oneOnOne.drop=0.7 keeper.saveBase=2.08
echo QVAR3DONE
