#!/bin/bash
cd /home/user/football
D=scripts/diag/c82f
for s in 47000 57000; do SEED=$s WORKERS=2 npx vite-node scripts/diag/role-pair.ts -- 400 WING > $D/wing-main-$s.log 2>&1; done
echo WINGDONE
