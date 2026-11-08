#!/bin/bash
# C.82e main(C.82c2·C.82d) 병합 뒤 재측정: 게겐 행 6칸 + 대조 칸 960 → 끼우기 → 표
cd /home/user/football; D=scripts/diag/c82e
ONLY=only=balanced/tikitaka,balanced/gegenpress,tikitaka/gegenpress,gegenpress/counter,gegenpress/direct,gegenpress/block,gegenpress/block@0020
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=41000 $ONLY out=$D/c82e-m-g41.json > $D/mxm-41.log 2>&1; echo "mxm41 done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=51000 $ONLY out=$D/c82e-m-g51.json > $D/mxm-51.log 2>&1; echo "mxm51 done $(date +%T)"
node scripts/diag/c79u-merge.cjs $D/c82e-m-g960.json $D/c82e-m-g41.json $D/c82e-m-g51.json
node $D/splice.cjs $D/c82e-960.json scripts/diag/c81z-960.json $D/c82e-m-g960.json > $D/splice.txt 2>&1
node scripts/diag/em25-matrix.cjs $D/c82e-960.json scripts/diag/c81z-960.json > $D/mx-960.txt 2>&1
echo CHAIN4DONE
