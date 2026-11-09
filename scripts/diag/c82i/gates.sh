#!/bin/bash
# C.82i 공통 관문(최종 상수: frontLine 0.62 · 티키 → 블록 공중 3 포함): typecheck → test → engine:check → build
cd /home/user/football
D=scripts/diag/c82i
npm run typecheck > $D/typecheck-final.log 2>&1; echo "typecheck done rc=$?"
npx vitest run > $D/test-final2.log 2>&1; echo "test done $(date +%T) rc=$? $(grep -E 'Tests |Test Files' $D/test-final2.log | tr '\n' ' ')"
npm run balance:engine:check > $D/echeck-final2.log 2>&1; echo "echeck done $(date +%T) rc=$?"
npm run build > $D/build-final2.log 2>&1; echo "build done $(date +%T) rc=$?"
echo GATESDONE
