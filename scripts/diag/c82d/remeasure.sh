#!/bin/bash
# main(C.81z·C.82c) 병합 뒤 재측정 (순차)
cd /home/user/football
D=scripts/diag/c82d
ROW="4-3-1-2:4-4-2,4-3-1-2:4-3-3,4-3-1-2:4-2-3-1,4-3-1-2:3-5-2,4-3-1-2:5-3-2,4-3-1-2:4-1-4-1,4-3-1-2:3-4-3,4-3-3:4-4-2,4-2-3-1:4-4-2,3-5-2:4-4-2,5-3-2:4-4-2,4-1-4-1:4-4-2,3-4-3:4-4-2"
PAIRS=$ROW SEED0=71000 OUT=$D/pairs-after-m.json npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/pairs-after-m.log 2>&1
SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick > $D/quick-after-m.log 2>&1
npm run balance:engine:check > $D/echeck-m.log 2>&1; echo "exit $?" >> $D/echeck-m.log
npx vite-node /tmp/claude-0/-home-user-football/463ffca6-eee8-5fa2-b8d4-0bc5d2c45199/scratchpad/c76w-scan.ts > $D/c76w-scan-m.log 2>&1
PAIRS=$ROW SEED0=71000 OUT=$D/pairs-before-m.json npx vite-node scripts/diag/c82a-forms.ts -- 400 formation.midAttackCap=0 formation.midAttackCapPer=0 > $D/pairs-before-m.log 2>&1
echo DONE > $D/remeasure.done
