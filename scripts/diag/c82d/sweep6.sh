#!/bin/bash
cd /home/user/football
PAIRS="4-3-1-2:4-4-2,4-2-3-1:4-4-2,4-3-3:4-4-2,4-3-1-2:4-2-3-1"
run() { name=$1; shift; echo "### $name $*" >> scripts/diag/c82d/sweep6.log; PAIRS=$PAIRS SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 200 "$@" 2>/dev/null | grep "^|" >> scripts/diag/c82d/sweep6.log; }
run F_cap072_per006 formation.midAttackCap=0.72 formation.midAttackCapPer=0.06
run G_cap072_per010 formation.midAttackCap=0.72 formation.midAttackCapPer=0.10
run H_cap070_per012 formation.midAttackCap=0.70 formation.midAttackCapPer=0.12
echo DONE >> scripts/diag/c82d/sweep6.log
