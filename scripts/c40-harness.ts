// 결정 순간 레이아웃 하네스 (부록 C.40): 실경기에서 드문 "선택지 2개만 남은 정지"를 같은 화면 코드(momentView)로 그려 캡처한다.
// 개발 서버에서만 연다: npx vite --port 5174 → http://localhost:5174/scripts/c40-harness.html (빌드·배포에는 들어가지 않는다)
import '../src/ui/design/tokens.css';
import '../src/ui/design/bundle.css';
import '../src/ui/style.css';
import type { Moment } from '../src/engine/moments';
import { momentView } from '../src/ui/views/moment';

const m: Moment = {
  id: 3, type: 'onball', scene: 'keyPass', t: 2011, minute: 34, stake: 0.52, score: [1, 0], side: 0, sure: true,
  options: [
    { kind: 'safe', action: 'pass', label: '헨더슨에게 전진 패스', p: 0.84, success: '패스 연결', fail: '공을 뺏김', up: 0.05, down: -0.04, value: 0.09, to: { x: 62, y: 30 }, ref: 0 },
    { kind: 'gamble', action: 'through', label: '살라에게 침투 패스', p: 0.41, success: '침투 패스 연결', fail: '차단당함', up: 0.12, down: -0.04, value: 0.21, offside: 'mid', to: { x: 84, y: 18 }, ref: 1 },
  ],
  cards: [], passives: [], me: 'me',
};
document.getElementById('app')!.className = 'app-moment';
document.getElementById('app')!.innerHTML = `<main class="screen screen-moment">${momentView({ moment: m, teams: ['리버풀', '토트넘'], selected: null, card: null, stop: 'important', last: null, count: 3 })}</main>`;
