#!/bin/bash
# C.82d 관문 측정 (순차): 표준 대형 13쌍 400경기 전후 · 커스텀 3종 · quick 600
cd /home/user/football
D=scripts/diag/c82d
ROW="4-3-1-2:4-4-2,4-3-1-2:4-3-3,4-3-1-2:4-2-3-1,4-3-1-2:3-5-2,4-3-1-2:5-3-2,4-3-1-2:4-1-4-1,4-3-1-2:3-4-3,4-3-3:4-4-2,4-2-3-1:4-4-2,3-5-2:4-4-2,5-3-2:4-4-2,4-1-4-1:4-4-2,3-4-3:4-4-2"
PAIRS=$ROW SEED0=71000 OUT=$D/pairs-after.json npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/pairs-after.log 2>&1
PAIRS=$ROW SEED0=71000 OUT=$D/pairs-before.json npx vite-node scripts/diag/c82a-forms.ts -- 400 formation.midAttackCap=0 formation.midAttackCapPer=0 > $D/pairs-before.log 2>&1
CUS="80:4-4-2,119:4-4-2,26:4-4-2,80:4-3-3,119:4-3-3,26:4-3-3,80:5-3-2,119:5-3-2,26:5-3-2,80:4-3-1-2,119:4-3-1-2,26:4-3-1-2"
PAIRS=$CUS SEED0=71000 OUT=$D/custom-after.json npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/custom-after.log 2>&1
SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick > $D/quick-after.log 2>&1
echo DONE > $D/measure.done
