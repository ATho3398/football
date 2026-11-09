#!/bin/bash
# C.82l 최종 관문 A (게겐 값 확정 뒤, 윙어 값과 무관 — rolePicked 없는 AI 팀은 비트 동일): 상성 960(41000·51000) · 표준 대형 상호표
cd /home/user/football
D=scripts/diag/c82l
until grep -q CONFIRMDONE $D/confirm.out; do sleep 10; done
echo "start $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=41000 out=$D/c82l-41.json > $D/mx-41.log 2>&1 &
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=51000 out=$D/c82l-51.json > $D/mx-51.log 2>&1 &
(STDMAT=1 SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/stdmat-final.log 2>&1; echo STDDONE >> $D/stdmat-final.log) &
wait
node scripts/diag/c79u-merge.cjs scripts/diag/c82l-960.json $D/c82l-41.json $D/c82l-51.json
node scripts/diag/em25-matrix.cjs scripts/diag/c82l-960.json scripts/diag/c82k-960.json > $D/mx-960.txt 2>&1
node scripts/diag/em25-matrix.cjs scripts/diag/c82l-960.json scripts/diag/c82e/c82e-960.json > $D/mx-960-vs-c82e.txt 2>&1
node scripts/diag/c82h/stdmat-sum.cjs $D/stdmat-final.log > $D/stdmat-final.out 2>&1
echo "FINALADONE $(date +%T)"
