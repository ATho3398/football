#!/bin/bash
# C.82k 최종 관문 묶음(최종 상수, 4 CPU 병렬): A) 상성 960(41000·51000) · 표준 대형 상호표 · 정통 윙어 role-pair(47000·57000) 동시 →
# B) quick 600 · 이동 거리 · 커스텀 · 공 뒤 인원(60경기) 동시 → 게겐 전환(em28-trans ×4) → 균형+라인 높음 전환(×2) → test · echeck · build 순차
cd /home/user/football
D=scripts/diag/c82k
echo "start $(date +%T)"
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=41000 out=$D/c82k-41.json > $D/mx-41.log 2>&1 &
npx vite-node scripts/diag/c78s-matrix.ts -- 480 seed=51000 out=$D/c82k-51.json > $D/mx-51.log 2>&1 &
(STDMAT=1 SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/stdmat-final.log 2>&1; echo STDDONE >> $D/stdmat-final.log) &
(for s in 47000 57000; do SEED=$s npx vite-node scripts/diag/role-pair.ts -- 400 WING > $D/wing-final-$s.log 2>&1; done) &
wait
node scripts/diag/c79u-merge.cjs scripts/diag/c82k-960.json $D/c82k-41.json $D/c82k-51.json
node scripts/diag/em25-matrix.cjs scripts/diag/c82k-960.json scripts/diag/c82j-960.json > $D/mx-960.txt 2>&1
node scripts/diag/em25-matrix.cjs scripts/diag/c82k-960.json scripts/diag/c82e/c82e-960.json > $D/mx-960-vs-c82e.txt 2>&1
node scripts/diag/c82h/stdmat-sum.cjs $D/stdmat-final.log > $D/stdmat-final.out 2>&1
echo "A done $(date +%T)"
(SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick > $D/quick-final.log 2>&1) &
(npx vite-node scripts/diag/c82c-dist.ts > $D/dist-final.log 2>&1) &
(PAIRS="80:4-4-2,80:4-3-1-2,26:4-4-2" SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/custom-final.log 2>&1) &
(npx vite-node scripts/diag/c82g-struct.ts -- 60 seed=41000 tac=gegenpress vs=balanced out=$D/st-final.json > $D/st-final.log 2>&1; node scripts/diag/c82j/behind.cjs final=$D/st-final.json > $D/behind-final.txt 2>&1) &
wait
echo "B done $(date +%T) quick $(grep -m1 '  득점  ' $D/quick-final.log | awk '{print $2}') ST $(grep -m1 '득점 비율 ST' $D/quick-final.log | awk '{print $4}') · dist $(head -1 $D/dist-final.log)"
scripts/diag/c82k/trans.sh final
for s in 41000 41100; do npx vite-node scripts/diag/em28-trans.ts -- 100 seed=$s tac=balanced lh=3 out=$D/tr-final-hiline-$s.json > $D/tr-final-hiline-$s.log 2>&1 & done; wait
node scripts/diag/em28-report.cjs 균형라인높음=$D/tr-final-hiline-41000.json,$D/tr-final-hiline-41100.json 균형=$D/tr-final-balanced-41000.json,$D/tr-final-balanced-41100.json > $D/trans-final-hiline.txt 2>&1
echo "trans done $(date +%T)"
npx vitest run > $D/test-final.log 2>&1; echo "test done $(date +%T) rc=$? $(grep -E 'Tests |Test Files' $D/test-final.log | tr '\n' ' ')"
npm run balance:engine:check > $D/echeck-final.log 2>&1; echo "echeck done $(date +%T) rc=$?"
npm run build > $D/build-final.log 2>&1; echo "build done $(date +%T) rc=$?"
echo CHAINDONE
