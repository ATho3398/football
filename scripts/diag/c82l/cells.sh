#!/bin/bash
# C.82l 상성 칸 보정 후보 (게겐 행이 +0.11 세짐: 게겐>티키 +0.50 · 게겐>역습 +0.10(기준 −0.14) · 게겐>직선 +0.04(기준 −0.08))
cd /home/user/football
D=scripts/diag/c82l
echo "start $(date +%T)"
$D/cell.sh GT128 gegenpress/tikitaka matchup.gegenpress.tikitaka.tackle=-12 matchup.gegenpress.tikitaka.air=-8
$D/cell.sh GC53 gegenpress/counter matchup.gegenpress.counter.tackle=5 matchup.gegenpress.counter.air=3
$D/cell.sh GD33 gegenpress/direct matchup.gegenpress.direct.tackle=3 matchup.gegenpress.direct.air=3
$D/cell.sh GT117 gegenpress/tikitaka matchup.gegenpress.tikitaka.tackle=-11 matchup.gegenpress.tikitaka.air=-7
$D/cell.sh GC42 gegenpress/counter matchup.gegenpress.counter.tackle=4 matchup.gegenpress.counter.air=2
echo "CELLSDONE $(date +%T)"
