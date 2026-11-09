#!/bin/bash
# C.82j 수치 레버 시도: 이름 [경로=값 …] → 20경기 게겐 대 균형(시드 41000) 공 뒤 인원(70~87 m·GK 제외) 요약
cd /home/user/football
D=scripts/diag/c82j
run() { name=$1; shift; npx vite-node scripts/diag/c82g-struct.ts -- ${N:-20} seed=41000 tac=gegenpress vs=balanced out=$D/st-$name.json "$@" > $D/st-$name.log 2>&1; echo "## $name $* $(date +%T)"; node $D/behind.cjs $name=$D/st-$name.json | grep -E '^==|상실 포지션|지속 공격|상실 순간|진입 3' | sed 's/^/  /'; }
for spec in "$@"; do run $spec; done
echo LEVERDONE
