#!/bin/bash
# C.82e 최종 관문 묶음: v5(출하 설정 전환·재탈취) → 상성 960(41000·51000) → quick 600 → test → engine:check → build
cd /home/user/football
D=scripts/diag/c82e
bash $D/run-set.sh v5 > $D/v5.out 2>&1
echo "v5 done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=41000 out=$D/c82e-41.json > $D/mx-41.log 2>&1
echo "mx41 done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=51000 out=$D/c82e-51.json > $D/mx-51.log 2>&1
echo "mx51 done $(date +%T)"
node scripts/diag/c79u-merge.cjs $D/c82e-960.json $D/c82e-41.json $D/c82e-51.json
node scripts/diag/em25-matrix.cjs $D/c82e-960.json scripts/diag/c81z-960.json > $D/mx-960.txt 2>&1
echo "merge done $(date +%T)"
npm run balance:quick > $D/quick.log 2>&1
echo "quick done $(date +%T)"
npx vitest run > $D/test.log 2>&1
echo "test done $(date +%T) rc=$?"
npm run balance:engine:check > $D/echeck.log 2>&1
echo "echeck done $(date +%T) rc=$?"
npm run build > $D/build.log 2>&1
echo "build done $(date +%T) rc=$?"
echo CHAINDONE
