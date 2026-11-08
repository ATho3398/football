#!/bin/bash
# C.82h 전환 변형 측정: 이름 + 덮어쓰기 → em28-trans 게겐·균형 × 시드 41000·41100 → 보고
cd /home/user/football
D=scripts/diag/c82h
NAME=$1; shift
for t in gegenpress balanced; do for s in 41000 41100; do npx vite-node scripts/diag/em28-trans.ts -- 100 seed=$s tac=$t out=$D/tr-$NAME-$t-$s.json "$@" > $D/tr-$NAME-$t-$s.log 2>&1; done; done
node scripts/diag/em28-report.cjs 게겐=$D/tr-$NAME-gegenpress-41000.json,$D/tr-$NAME-gegenpress-41100.json 균형=$D/tr-$NAME-balanced-41000.json,$D/tr-$NAME-balanced-41100.json > $D/trans-$NAME.txt 2>&1
echo "TRDONE $NAME $(date +%T)"
