#!/bin/bash
cd /home/user/football
D=scripts/diag/c82d
npx vite-node scripts/diag/em25-dist.ts -- 120 > $D/dist.log 2>&1
npm run balance:engine:check > $D/echeck.log 2>&1; echo "exit $?" >> $D/echeck.log
echo DONE > $D/gates.done
