#!/bin/bash
# C.82f 기준(main e520ac5) 측정: quick 600(C.82d 명령) → 이동 거리 60시드 → 상성 960(41000·51000)
cd /home/user/football
D=scripts/diag/c82f
echo "start $(date +%T)"
SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick > $D/quick-main.log 2>&1
echo "quick done $(date +%T)"
npx vite-node scripts/diag/c82c-dist.ts > $D/dist-main.log 2>&1
echo "dist done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=41000 out=$D/main-41.json > $D/mx-main-41.log 2>&1
echo "mx41 done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=51000 out=$D/main-51.json > $D/mx-main-51.log 2>&1
echo "mx51 done $(date +%T)"
node scripts/diag/c79u-merge.cjs $D/main-960.json $D/main-41.json $D/main-51.json
node scripts/diag/em25-matrix.cjs $D/main-960.json scripts/diag/c82e/c82e-960.json > $D/mx-main-960.txt 2>&1
echo "BASEDONE $(date +%T)"
