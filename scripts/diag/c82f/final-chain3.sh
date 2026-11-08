#!/bin/bash
# 1대1 freeR 4 뒤 재측정: quick 600 → 이동 거리 → 상성 960 → 비교(main) → test → engine:check → build (표준 대형·윙어·커스텀·전환은 freeR 전 측정 그대로 — 부록에 표시)
cd /home/user/football
D=scripts/diag/c82f
echo "start $(date +%T)"
SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick > $D/quick-final.log 2>&1; echo "quick done $(date +%T)"
npx vite-node scripts/diag/c82c-dist.ts > $D/dist-final.log 2>&1; echo "dist done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=41000 out=$D/c82f-41.json > $D/mx-41.log 2>&1; echo "mx41 done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=51000 out=$D/c82f-51.json > $D/mx-51.log 2>&1; echo "mx51 done $(date +%T)"
node scripts/diag/c79u-merge.cjs scripts/diag/c82f-960.json $D/c82f-41.json $D/c82f-51.json
node scripts/diag/em25-matrix.cjs scripts/diag/c82f-960.json $D/main-960.json > $D/mx-960.txt 2>&1; echo "merge done $(date +%T)"
npx vitest run > $D/test-final.log 2>&1; echo "test done $(date +%T) rc=$?"
npm run balance:engine:check > $D/echeck-final.log 2>&1; echo "echeck done $(date +%T) rc=$?"
npm run build > $D/build-final.log 2>&1; echo "build done $(date +%T) rc=$?"
echo CHAINDONE
