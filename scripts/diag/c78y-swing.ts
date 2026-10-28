// @ts-nocheck — 진단 (C.78y): 장면 ㉔·㉕ 값 출력 (판단 보정 counterRun 이 전환 장면에 주는 영향)
import { sceneGegenBus, sceneBalancedSwing } from '../../tests/scenes/swing';
console.log(JSON.stringify(sceneGegenBus().values));
console.log(JSON.stringify(sceneBalancedSwing().values));
process.exit(0);
