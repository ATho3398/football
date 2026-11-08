#!/bin/bash
cd /home/user/football
D=scripts/diag/c82d
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=41000 out=$D/c82d-41.json > $D/matrix-41.log 2>&1
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=51000 out=$D/c82d-51.json > $D/matrix-51.log 2>&1
node scripts/diag/c79u-merge.cjs $D/c82d-960.json $D/c82d-41.json $D/c82d-51.json > $D/merge.log 2>&1
node scripts/diag/c80d-matrix-cmp.cjs scripts/diag/c82b-960.json $D/c82d-960.json > $D/cmp-960.log 2>&1
node scripts/diag/c81s-show.cjs $D/c82d-960.json scripts/diag/c82b-960.json > $D/show-960.log 2>&1
npx vite-node scripts/diag/em25-dist.ts -- 120 > $D/dist.log 2>&1
npm run balance:engine:check > $D/echeck.log 2>&1
echo DONE > $D/gates.done
