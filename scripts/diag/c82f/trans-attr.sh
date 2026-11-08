#!/bin/bash
# 전환 슛(균형 대 균형 3.08 → 3.65) 원인 레버 찾기: 레버 하나씩 main 값으로 되돌려 균형 100경기(시드 41000)
cd /home/user/football
D=scripts/diag/c82f
run() { n=$1; shift; npx vite-node scripts/diag/em28-trans.ts -- 100 seed=41000 tac=balanced "$@" out=$D/tra-$n.json > $D/tra-$n.log 2>&1; }
run fat physics.fatigueIntensity=0.4 &
run gk keeper.parryDownSave=0.6 keeper.catchSkill=0.5 &
run sf prob.shotFree=0.30 &
run dist keeper.distAdjV.1=-0.13 keeper.distAdjV.2=-0.13 &
run st keeper.oneOnOne.drop=0.39 prob.stFinish=1 &
run none &
wait
for n in none fat gk sf dist st; do echo "== $n: $(node scripts/diag/em28-report.cjs x=$D/tra-$n.json 2>/dev/null | grep '대상: ' | grep -o '그중 전환[^·]*')"; done
echo TRANSATTRDONE
