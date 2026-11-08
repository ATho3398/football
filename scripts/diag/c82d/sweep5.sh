#!/bin/bash
cd /home/user/football
PAIRS="4-3-1-2:4-4-2,4-2-3-1:4-4-2,4-3-3:4-4-2,4-3-1-2:4-2-3-1"
run() { name=$1; shift; echo "### $name $*" >> scripts/diag/c82d/sweep5.log; PAIRS=$PAIRS SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 200 "$@" 2>/dev/null | grep "^|" >> scripts/diag/c82d/sweep5.log; }
run A_cap072_shift020 formation.midAttackCap=0.72 formation.attackShift.2=0.2
run B_cap070_width055 formation.midAttackCap=0.70 formation.defendWidth=0.55
run C_cap070_boxMatch formation.midAttackCap=0.70 offball.boxMatch=1
run D_cap070_c10pass formation.midAttackCap=0.70 role.classic10.pref.forward=0.8 role.classic10.pref.pass=1.1
run E_cap070_pocket formation.midAttackCap=0.70 offball.pocketMark=0.9
echo DONE >> scripts/diag/c82d/sweep5.log
