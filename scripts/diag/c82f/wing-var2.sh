#!/bin/bash
# 정통 윙어 전용 가산 재탐색(최종 총량 레버 뒤): +20 · +30, 정통 윙어만(다른 역할은 wing-final 값 그대로)
cd /home/user/football
D=scripts/diag/c82f
for v in 20 30; do for s in 47000 57000; do
  ROLES=classicWinger SEED=$s npx vite-node scripts/diag/role-pair.ts -- 400 WING roles.classicWingerCross=$v > $D/wing-f-cw$v-$s.log 2>&1
  echo "== cw$v seed $s: $(grep '정통 윙어 |' $D/wing-f-cw$v-$s.log | cut -c1-60)"
done; done
echo WINGVAR2DONE
