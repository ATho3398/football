#!/bin/bash
cd /home/user/football
D=scripts/diag/c82d
until [ -f $D/final.done ]; do sleep 15; done
PAIRS="26:5-3-2,80:5-3-2,26:4-3-3,80:4-3-3,26:4-4-2,80:4-4-2" SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/custom-final.log 2>&1
echo DONE > $D/custom2.done
