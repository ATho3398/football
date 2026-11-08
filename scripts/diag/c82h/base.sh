#!/bin/bash
# C.82h 기준선(main be669eb = C.82f 최종) — 별도 worktree /home/user/football-main 에서 돌려 작업 트리 수정의 영향을 안 받는다
cd /home/user/football-main
D=/home/user/football/scripts/diag/c82h
echo "start $(date +%T)"
for s in 41000 41100; do npx vite-node scripts/diag/em28-trans.ts -- 100 seed=$s tac=balanced out=$D/tr-base-balanced-$s.json > $D/tr-base-balanced-$s.log 2>&1; done
node scripts/diag/em28-report.cjs 게겐=$D/tr-base-gegenpress-41000.json,$D/tr-base-gegenpress-41100.json 균형=$D/tr-base-balanced-41000.json,$D/tr-base-balanced-41100.json > $D/trans-base.txt 2>&1; echo "trans done $(date +%T)"
for s in 47000 57000; do SEED=$s npx vite-node scripts/diag/role-pair.ts -- 400 WING > $D/wing-base-$s.log 2>&1; done; echo "wing done $(date +%T)"
STDMAT=1 SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/stdmat-base.log 2>&1; echo "stdmat done $(date +%T)"
PAIRS="80:4-4-2,80:4-3-1-2,26:4-4-2" SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/custom-base.log 2>&1; echo "custom done $(date +%T)"
echo BASEDONE
