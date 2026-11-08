#!/bin/bash
cd /home/user/football
PAIRS="4-3-1-2:4-4-2,4-2-3-1:4-4-2,4-3-3:4-4-2,4-3-1-2:4-2-3-1"
run() { name=$1; shift; echo "### $name $*" >> scripts/diag/c82d/sweep4.log; PAIRS=$PAIRS SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 200 "$@" 2>/dev/null | grep "^|" >> scripts/diag/c82d/sweep4.log; }
run cap076 formation.midAttackCap=0.76
run cap072 formation.midAttackCap=0.72
run cap068 formation.midAttackCap=0.68
echo DONE >> scripts/diag/c82d/sweep4.log
