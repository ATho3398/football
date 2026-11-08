#!/bin/bash
# C.82h 공통 관문: test → engine:check → build (최종 상수)
cd /home/user/football
D=scripts/diag/c82h
npx vitest run > $D/test-final.log 2>&1; echo "test done $(date +%T) rc=$? $(grep -E 'Tests |Test Files' $D/test-final.log | tr '\n' ' ')"
npm run balance:engine:check > $D/echeck-final.log 2>&1; echo "echeck done $(date +%T) rc=$?"
npm run build > $D/build-final.log 2>&1; echo "build done $(date +%T) rc=$?"
echo GATESDONE
