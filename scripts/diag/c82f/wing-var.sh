#!/bin/bash
# 정통 윙어 전용 크로스 가산(roles.classicWingerCross) 측정: 정통 윙어만 400경기 × 시드 2벌 (다른 역할은 기본 역할 경로라 기준과 동일)
cd /home/user/football
D=scripts/diag/c82f
for v in 10 15; do for s in 47000 57000; do
  ROLES=classicWinger SEED=$s WORKERS=2 npx vite-node scripts/diag/role-pair.ts -- 400 WING roles.classicWingerCross=$v > $D/wing-cw$v-$s.log 2>&1
  echo "== cw$v seed $s: $(grep '정통 윙어 |' $D/wing-cw$v-$s.log | cut -c1-80)"
done; done
echo WINGVARDONE
