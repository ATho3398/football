#!/bin/bash
# C.82e main 병합 뒤 공통 관문: test → engine:check → build
cd /home/user/football; D=scripts/diag/c82e
npx vitest run > $D/test3.log 2>&1; echo "test done $(date +%T) rc=$?"
npm run balance:engine:check > $D/echeck3.log 2>&1; echo "echeck done $(date +%T) rc=$?"
npm run build > $D/build3.log 2>&1; echo "build done $(date +%T) rc=$?"
echo CHAIN5DONE
