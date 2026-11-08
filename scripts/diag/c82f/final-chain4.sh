#!/bin/bash
# C.82g 병합 뒤 최종: 이동 거리 → 상성 960(41000·51000) → 비교(기준 = C.82g 최종표 c82g-960-final) → test → engine:check → build
cd /home/user/football
D=scripts/diag/c82f
echo "start $(date +%T)"
npx vite-node scripts/diag/c82c-dist.ts > $D/dist-final.log 2>&1; echo "dist done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=41000 out=$D/c82f-41.json > $D/mx-41.log 2>&1; echo "mx41 done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=51000 out=$D/c82f-51.json > $D/mx-51.log 2>&1; echo "mx51 done $(date +%T)"
node scripts/diag/c79u-merge.cjs scripts/diag/c82f-960.json $D/c82f-41.json $D/c82f-51.json
node scripts/diag/em25-matrix.cjs scripts/diag/c82f-960.json scripts/diag/c82g/c82g-960-final.json > $D/mx-960.txt 2>&1; echo "merge done $(date +%T)"
npx vitest run > $D/test-final.log 2>&1; echo "test done $(date +%T) rc=$?"
npm run balance:engine:check > $D/echeck-final.log 2>&1; echo "echeck done $(date +%T) rc=$?"
npm run build > $D/build-final.log 2>&1; echo "build done $(date +%T) rc=$?"
echo CHAINDONE
