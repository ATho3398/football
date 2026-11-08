#!/bin/bash
# C.82e 최종 관문 묶음 2 (라인 K 끔): v6 → 게겐 행 960(41000·51000, 대조 칸 포함) → 끼우기 → quick 600 → test → engine:check → build
cd /home/user/football
D=scripts/diag/c82e
ONLY=only=balanced/tikitaka,balanced/gegenpress,tikitaka/gegenpress,gegenpress/counter,gegenpress/direct,gegenpress/block,gegenpress/block@0020
bash $D/run-set.sh v6 > $D/v6.out 2>&1
echo "v6 done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=41000 $ONLY out=$D/c82e-g41.json > $D/mxg-41.log 2>&1
echo "mxg41 done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=51000 $ONLY out=$D/c82e-g51.json > $D/mxg-51.log 2>&1
echo "mxg51 done $(date +%T)"
node scripts/diag/c79u-merge.cjs $D/c82e-g960.json $D/c82e-g41.json $D/c82e-g51.json
node $D/splice.cjs $D/c82e-960.json scripts/diag/c81z-960.json $D/c82e-g960.json > $D/splice.txt 2>&1
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
