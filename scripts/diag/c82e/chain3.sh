#!/bin/bash
# C.82e 최종 상수(게겐 → 티키 −9/−6)로 engine:check → build
cd /home/user/football; D=scripts/diag/c82e
npm run balance:engine:check > $D/echeck.log 2>&1; echo "echeck done $(date +%T) rc=$?"
npm run build > $D/build.log 2>&1; echo "build done $(date +%T) rc=$?"
echo CHAIN3DONE
