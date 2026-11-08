#!/bin/bash
cd /home/user/football
until grep -q DONE scripts/diag/c82d/sweep.log; do sleep 10; done
PAIRS="4-3-1-2:4-4-2,4-2-3-1:4-4-2,4-3-3:4-4-2,4-3-1-2:4-2-3-1"
run() { name=$1; shift; echo "### $name $*" >> scripts/diag/c82d/sweep2.log; PAIRS=$PAIRS SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 200 "$@" 2>/dev/null | grep "^|" >> scripts/diag/c82d/sweep2.log; }
run pocket09 offball.pocketMark=0.9
run pocket09pull04 offball.pocketMark=0.9 offball.pocketPull=0.4
run pocket10pull03 offball.pocketMark=1.0 offball.pocketPull=0.3 offball.pocketSlack=6
echo DONE >> scripts/diag/c82d/sweep2.log
