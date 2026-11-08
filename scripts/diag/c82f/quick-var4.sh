#!/bin/bash
# 총량 보정 4차: 1대1 drop 0.55 고정, saveBase 사다리 (quick 600). 장면 ④: drop 0.55 1대1 골 0.328 ✓ · drop 0.7 은 느린 횡패스 − 빠른 컷백 0.187 < 0.2 ✗
cd /home/user/football
D=scripts/diag/c82f
until grep -q QVAR3DONE $D/quick-var3.out; do sleep 5; done
run() { name=$1; shift; SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick -- "$@" > $D/q-$name.log 2>&1; echo "== $name $* $(date +%T)"; grep -E "  득점  |득점 비율|슈팅 비율 ST|골 경로: (세트|리바)|PK \(" $D/q-$name.log; }
R="keeper.parryDownSave=0.4 keeper.catchSkill=0.4 keeper.oneOnOne.drop=0.55"
run sb212 $R keeper.saveBase=2.12
run sb220 $R keeper.saveBase=2.20
echo QVAR4DONE
