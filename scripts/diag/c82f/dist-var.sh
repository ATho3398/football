#!/bin/bash
# 이동 거리 레버 감도 (c82c-dist 60시드, main 기준 14.108 / 15.80)
cd /home/user/football
D=scripts/diag/c82f
for v in "physics.fatigueIntensity=0.45" "physics.fatigueIntensity=0.5" "physics.tiredMaxFloor=0.8" "physics.fatigueIntensity=0.45 physics.tiredMaxFloor=0.8" "physics.tiredFloor=0.2"; do
  echo "== $v"; npx vite-node scripts/diag/c82c-dist.ts -- $v 2>&1 | head -8
done
echo DISTVARDONE
