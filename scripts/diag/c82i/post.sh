#!/bin/bash
cd /home/user/football
D=scripts/diag/c82i
PAIRS="80:4-4-2,80:4-3-1-2,26:4-4-2" SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- 400 > $D/custom-final2.log 2>&1; echo "custom2 done $(date +%T)"
npx vite-node scripts/diag/c82i/front.ts > $D/front.log 2>&1; echo "front done"
npx vitest run tests/c82i.test.ts tests/c82h.test.ts tests/c82f.test.ts tests/c81b.test.ts tests/c79x.test.ts tests/scenes/scenes.test.ts > $D/test-post.log 2>&1; echo "tests done rc=$? $(grep -E 'Tests ' $D/test-post.log)"
echo POSTDONE
