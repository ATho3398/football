#!/bin/bash
# C.82l 최종 상수(상성 칸 포함) 공통 관문: typecheck → vitest → engine:check → build
cd /home/user/football
D=scripts/diag/c82l
echo "start $(date +%T)"
npm run typecheck > $D/typecheck-final.log 2>&1; echo "typecheck done rc=$?"
npx vitest run > $D/test-final.log 2>&1; echo "test done $(date +%T) rc=$? $(grep -E 'Tests |Test Files' $D/test-final.log | tr '\n' ' ')"
npm run balance:engine:check > $D/echeck-final.log 2>&1; echo "echeck done $(date +%T) rc=$?"
npm run build > $D/build-final.log 2>&1; echo "build done $(date +%T) rc=$?"
echo FINALCDONE
