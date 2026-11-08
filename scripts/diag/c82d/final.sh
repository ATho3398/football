#!/bin/bash
# 상한 0.735 최종 측정 (순차): 표준 13쌍 400 · quick 600 · engine:check · c76w 스캔 · 테스트 전체 · 빌드
cd /home/user/football
D=scripts/diag/c82d
ROW="4-3-1-2:4-4-2,4-3-1-2:4-3-3,4-3-1-2:4-2-3-1,4-3-1-2:3-5-2,4-3-1-2:5-3-2,4-3-1-2:4-1-4-1,4-3-1-2:3-4-3,4-3-3:4-4-2,4-2-3-1:4-4-2,3-5-2:4-4-2,5-3-2:4-4-2,4-1-4-1:4-4-2,3-4-3:4-4-2"
PAIRS=$ROW SEED0=71000 OUT=$D/pairs-final.json npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/pairs-final.log 2>&1
SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick > $D/quick-final.log 2>&1
npm run balance:engine:check > $D/echeck-final.log 2>&1; echo "exit $?" >> $D/echeck-final.log
npx vite-node /tmp/claude-0/-home-user-football/463ffca6-eee8-5fa2-b8d4-0bc5d2c45199/scratchpad/c76w-scan.ts > $D/c76w-scan-final.log 2>&1
npm test > $D/test-final.log 2>&1; echo "exit $?" >> $D/test-final.log
npm run build > $D/build-final.log 2>&1; echo "exit $?" >> $D/build-final.log
echo DONE > $D/final.done
