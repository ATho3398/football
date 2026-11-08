#!/bin/bash
# C.82g 측정 묶음: 전환(em28-trans) 게겐·균형·균형+라인높음(lh=3) × 시드 41000·41100 (각 100경기). 사용: bash run-set3.sh 이름 [경로=값 …]
cd /home/user/football
name=$1; shift
D=scripts/diag/c82g
for t in "gegenpress" "balanced" "balanced lh=3"; do set -- $t "$@"; tn=$1; shift; extra=""; if [ "$1" = "lh=3" ]; then extra="lh=3"; shift; fi; tag=$tn${extra:+-lh3}
  for sd in 41000 41100; do
    npx vite-node scripts/diag/em28-trans.ts -- 100 seed=$sd tac=$tn $extra out=$D/$name-tr-$tag-$sd.json "$@" > $D/$name-tr-$tag-$sd.log 2>&1 &
  done
done; wait
echo "== $name 전환"; node scripts/diag/em28-report.cjs 게겐=$D/$name-tr-gegenpress-41000.json,$D/$name-tr-gegenpress-41100.json 균형=$D/$name-tr-balanced-41000.json,$D/$name-tr-balanced-41100.json 균형라인높음=$D/$name-tr-balanced-lh3-41000.json,$D/$name-tr-balanced-lh3-41100.json | grep -v "^| .* 상대 |" | grep -v "^| .* 자기⅓\|^| .* 가운데"
echo DONE
