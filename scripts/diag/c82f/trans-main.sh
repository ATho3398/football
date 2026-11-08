#!/bin/bash
# 전환 지표 기준(main 상수로 되돌린 덮어쓰기): 게겐·균형 × 시드 41000·41100, 4개 동시
cd /home/user/football
D=scripts/diag/c82f
OV="keeper.parryDownSave=0.6 keeper.catchSkill=0.5 physics.fatigueIntensity=0.4 keeper.oneOnOne.drop=0.39 prob.stFinish=1 prob.shotFree=0.30 keeper.distAdjV.1=-0.13 keeper.distAdjV.2=-0.13"
for t in gegenpress balanced; do for s in 41000 41100; do npx vite-node scripts/diag/em28-trans.ts -- 100 seed=$s tac=$t $OV out=$D/trm-$t-$s.json > $D/trm-$t-$s.log 2>&1 & done; done; wait
node scripts/diag/em28-report.cjs 게겐=$D/trm-gegenpress-41000.json,$D/trm-gegenpress-41100.json 균형=$D/trm-balanced-41000.json,$D/trm-balanced-41100.json > $D/trans-main.txt 2>&1
grep "경기 · 맞은 슛" $D/trans-main.txt | cut -c1-300
echo TRANSMAINDONE
