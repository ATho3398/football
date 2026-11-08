#!/bin/bash
# C.82h 최종 관문 묶음(최종 상수, 순차): quick 600 → 이동 거리 → 상성 960(41000·51000) → 표준 대형 상호표(STDMAT 400) → 정통 윙어 role-pair(47000·57000) → 커스텀 → 게겐 전환(em28-trans)
cd /home/user/football
D=scripts/diag/c82h
echo "start $(date +%T)"
SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick > $D/quick-final.log 2>&1; echo "quick done $(date +%T) $(grep -m1 '  득점  ' $D/quick-final.log | awk '{print $2}') ST $(grep -m1 '득점 비율 ST' $D/quick-final.log | awk '{print $4}')"
npx vite-node scripts/diag/c82c-dist.ts > $D/dist-final.log 2>&1; echo "dist done $(date +%T) $(head -1 $D/dist-final.log)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=41000 out=$D/c82h-41.json > $D/mx-41.log 2>&1; echo "mx41 done $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=51000 out=$D/c82h-51.json > $D/mx-51.log 2>&1; echo "mx51 done $(date +%T)"
node scripts/diag/c79u-merge.cjs scripts/diag/c82h-960.json $D/c82h-41.json $D/c82h-51.json
node scripts/diag/em25-matrix.cjs scripts/diag/c82h-960.json scripts/diag/c82f-960.json > $D/mx-960.txt 2>&1; echo "merge done $(date +%T)"
STDMAT=1 SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/stdmat-final.log 2>&1; echo "stdmat done $(date +%T)"
for s in 47000 57000; do SEED=$s npx vite-node scripts/diag/role-pair.ts -- 400 WING > $D/wing-final-$s.log 2>&1; done; echo "wing done $(date +%T)"
PAIRS="80:4-4-2,80:4-3-1-2,26:4-4-2" SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/custom-final.log 2>&1; echo "custom done $(date +%T)"
for t in gegenpress balanced; do for s in 41000 41100; do npx vite-node scripts/diag/em28-trans.ts -- 100 seed=$s tac=$t out=$D/tr-final-$t-$s.json > $D/tr-final-$t-$s.log 2>&1; done; done
node scripts/diag/em28-report.cjs 게겐=$D/tr-final-gegenpress-41000.json,$D/tr-final-gegenpress-41100.json 균형=$D/tr-final-balanced-41000.json,$D/tr-final-balanced-41100.json > $D/trans-final.txt 2>&1; echo "trans done $(date +%T)"
echo CHAINDONE
