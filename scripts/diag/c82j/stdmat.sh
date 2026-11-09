#!/bin/bash
# C.82j 표준 대형 상호표 28쌍 × 400 (시드 71000) — 태그 인자
cd /home/user/football
D=scripts/diag/c82j
TAG=${1:-1}; shift
STDMAT=1 SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 400 "$@" > $D/stdmat-$TAG.log 2>&1
echo STDDONE >> $D/stdmat-$TAG.log
node scripts/diag/c82h/stdmat-sum.cjs $D/stdmat-$TAG.log
