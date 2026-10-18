// 생활 이벤트 (pending 47 4번 상황 목록, 부록 C.63 b). 엔진 src/events.ts, 생활 지표 src/life.ts
// tags 에 'life' 가 있으면 시즌 상한(BALANCE.life.eventsPerSeason, 쉬움 1 · 보통 2 · 어려움 3)을 같이 쓴다. 효과의 생활 지표는 숨은 값(문장에 숫자 없음)

import type { EventDef } from '../src/events';

export const LIFE_EVENTS: readonly EventDef[] = [
  {
    id: 'l_familyTrouble', tags: ['life', 'day', 'family'], kind: 'choice', on: 'day', cat: 'life', when: ['offseason', '==', 0], chance: 0.0003, cooldown: 'season',
    title: ['집에서 온 전화', '가족에게 일이 생겼어요'],
    text: [
      '집에서 급한 전화가 왔어요. 가족 한 명이 아프대요.',
      '가족에게 걱정되는 일이 생겼어요. 마음이 경기장에 있지 않아요.',
      '고향 집에 큰일이 생겼다는 소식이에요. 어떻게 할까요?',
    ],
    choices: [
      { id: 'go', label: '가족 곁으로 간다', desc: '감독 신뢰도 −2, 마음은 조금 놓여요', effects: [{ trust: -2 }, { life: 'home', add: -8 }], result: ['며칠 집에 다녀왔어요. 감독은 "가족이 먼저"라고 했지만 아쉬워하는 눈치예요.', '가족 곁을 지켰어요. 마음이 조금 놓였어요.', '짧게 다녀왔어요. 돌아오니 동료들이 안부를 물었어요.'] },
      { id: 'stay', label: '경기에 집중한다', desc: '다음 3경기 폼 −0.08, 마음이 무거워요', effects: [{ life: 'home', add: -20 }, { life: 'mental', add: 8 }, { form: -0.08, games: 3 }], result: ['훈련장에 남았지만 휴대폰만 보게 돼요.', '경기에 집중하려 해도 쉽지 않아요.', '"괜찮아." 스스로에게 말했지만 잠이 오지 않아요.'] },
    ],
    fallback: 'go',
  },
  {
    id: 'l_adaptFail', tags: ['life', 'day', 'adapt'], kind: 'message', on: 'day', cat: 'life', when: { all: [['adapt', '<', 40], ['apps', '>=', 3]] }, chance: 0.15, cooldown: 'season',
    title: ['새 팀이 아직 낯설어요', '적응이 더뎌요'],
    text: [
      '새 팀 전술 용어가 아직 헷갈려요. 동료와 식사하거나 외국어 공부를 해 보세요.',
      '훈련장에서 혼자 밥을 먹는 날이 많아요. 아직 이 팀이 낯설어요.',
      '{team}에서의 첫 몇 주가 생각보다 어려워요. 시간이 필요해요.',
    ],
    effects: [{ form: -0.05, games: 3 }],
  },
  {
    id: 'l_language', tags: ['life', 'day', 'adapt', 'language'], kind: 'choice', on: 'day', cat: 'life', when: { all: [['foreign', '==', 1], ['adapt', '<', 55]] }, chance: 0.05, cooldown: 'season',
    title: ['언어 장벽', '통역 없이 듣는 전술 미팅'],
    text: [
      '전술 미팅에서 감독 말의 절반만 알아들었어요.',
      '동료들 농담에 혼자 웃지 못했어요. 말이 더 늘면 좋겠어요.',
      '경기 중 "뒤!"라는 외침을 못 알아들었어요. 언어가 문제예요.',
    ],
    choices: [
      { id: 'tutor', label: '개인 교사를 구한다', desc: '적응이 빨라져요, 체력 조금 −', effects: [{ life: 'adapt', add: 8 }, { fatigue: 3 }], result: ['저녁마다 수업을 들어요. 단어가 조금씩 들려요.', '선생님이 축구 용어부터 가르쳐 줬어요.', '첫 수업 숙제가 많아요. 그래도 재미있어요.'] },
      { id: 'interpreter', label: '통역에 기댄다', desc: '변화 없음', effects: [{ life: 'mental', add: 2 }], result: ['통역이 옆에 붙어 다녀요. 편하지만 느려요.', '당분간은 통역에 기대기로 했어요.', '급한 건 통역이 해결해 줘요.'] },
    ],
    fallback: 'interpreter',
  },
  {
    id: 'l_homesick', tags: ['life', 'day', 'family', 'homesick'], kind: 'choice', on: 'day', cat: 'life', when: { all: [{ tag: 'homesick' }, ['foreign', '==', 1], ['home', '<', 65]] }, chance: 0.06, cooldown: 'season',
    title: ['향수병', '고향 음식이 그리워요'],
    text: [
      '고향 음식 생각이 자꾸 나요. 밤에 가족 사진을 오래 봤어요.',
      '창밖 비가 길어요. 고향 햇볕이 그리워요.',
      '가족 영상 통화를 끊고 한참 멍하니 있었어요.',
    ],
    choices: [
      { id: 'invite', label: '가족을 초대한다', desc: '가정 안정이 크게 좋아져요', effects: [{ life: 'home', add: 12 }, { life: 'mental', add: -3 }], result: ['가족이 왔어요. 집에서 고향 음식 냄새가 나요.', '공항에서 가족을 안았어요. 한결 나아졌어요.', '가족과 보낸 일주일이 큰 힘이 됐어요.'] },
      { id: 'endure', label: '참는다', desc: '멘탈 피로 조금', effects: [{ life: 'mental', add: 5 }], result: ['꾹 참고 훈련에 나갔어요.', '혼자 견디기로 했어요. 쉽지 않아요.', '고향 음식점을 찾아갔지만 맛이 달랐어요.'] },
    ],
    fallback: 'invite',
  },
  {
    id: 'l_discord', tags: ['life', 'day', 'team', 'discord'], kind: 'choice', on: 'day', cat: 'team', when: ['team', '<', 40], chance: 0.06, chanceTags: { leader: 0.5 }, cooldown: 'season',
    title: ['라커룸이 서먹해요', '팀 내 불화'],
    text: [
      '훈련 중 동료와 언성이 높아졌어요. 라커룸 분위기가 차가워요.',
      '단체 대화방에서 내 이름만 빠져 있었어요.',
      '패스가 잘 안 와요. 동료들과 사이가 멀어진 것 같아요.',
    ],
    choices: [
      { id: 'meal', label: '동료들에게 식사를 제안한다', desc: '팀 관계가 좋아져요', effects: [{ life: 'team', add: 8 }, { fatigue: 2 }], result: ['고기를 샀어요. 웃음이 다시 돌아왔어요.', '저녁 한 끼에 오해가 많이 풀렸어요.', '"우리 다 같은 편이잖아." 식사 자리에서 정리됐어요.'] },
      { id: 'sorry', label: '사과 인터뷰를 한다', desc: '위상 −1, 팀 관계 +', effects: [{ rep: -1 }, { life: 'team', add: 6 }], result: ['공개 사과에 동료들이 고개를 끄덕였어요.', '먼저 손을 내밀었어요. 라커룸이 조용히 받아들였어요.', '사과 기사가 나갔어요. 팀 분위기가 나아졌어요.'] },
      { id: 'ignore', label: '신경 쓰지 않는다', desc: '팀 관계 −, 멘탈 피로', effects: [{ life: 'team', add: -4 }, { life: 'mental', add: 3 }], result: ['신경 쓰지 않으려 해도 자꾸 신경 쓰여요.', '거리가 더 멀어졌어요.', '혼자 훈련하는 시간이 늘었어요.'] },
    ],
    fallback: 'meal',
  },
  {
    id: 'l_leaderHelp', tags: ['life', 'day', 'team', 'leader'], kind: 'message', on: 'day', cat: 'team', when: { all: [{ tag: 'leader' }, ['team', '<', 45]] }, chance: 0.1, cooldown: 'season',
    title: ['리더의 한마디', '라커룸을 다시 모았어요'],
    text: [
      '분위기가 가라앉자 {name}{이/가} 먼저 동료들을 불러 모았어요.',
      '"우리끼리 싸울 때가 아니야." {name}의 한마디에 라커룸이 조용해졌어요.',
      '{name}{이/가} 훈련 뒤 막내들과 따로 이야기를 나눴어요.',
    ],
    effects: [{ life: 'team', add: 6 }, { trust: 1 }],
  },
  {
    id: 'l_managerConflict', tags: ['life', 'day', 'manager'], kind: 'message', on: 'day', cat: 'manager', when: { all: [['trust', '<', 30], ['team', '<', 50]] }, chance: 0.05, cooldown: 'season',
    title: ['감독과 냉랭해요', '{manager} 감독과 갈등'],
    text: [
      '{manager} 감독과 눈을 마주치는 일이 줄었어요. 면담이 열리면 이야기를 해 보세요.',
      '훈련장에서 감독이 {name}{을/를} 지나쳐 갔어요. 갈등이 길어져요.',
      '감독과의 거리가 멀어졌다는 기사가 나왔어요.',
    ],
    effects: [{ life: 'mental', add: 4 }],
  },
  {
    id: 'l_burnout', tags: ['life', 'day', 'mental'], kind: 'choice', on: 'day', cat: 'life', when: ['mental', '>=', 75], chance: 0.15, cooldown: 'season',
    title: ['번아웃', '몸보다 마음이 지쳤어요'],
    text: [
      '연전이 이어지며 축구가 재미없게 느껴져요.',
      '아침에 일어나기가 힘들어요. 마음이 지쳤어요.',
      '경기장 소음이 버겁게 들려요. 쉼이 필요해요.',
    ],
    choices: [
      { id: 'trip', label: '짧은 휴식을 요청한다', desc: '멘탈 피로가 크게 줄어요, 감독 신뢰도 −1', effects: [{ life: 'mental', add: -15 }, { trust: -1 }], result: ['감독이 이틀 휴가를 줬어요. 바다를 보고 왔어요.', '휴대폰을 끄고 쉬었어요. 숨이 쉬어져요.', '짧은 여행이 생각보다 큰 힘이 됐어요.'] },
      { id: 'push', label: '참고 뛴다', desc: '다음 3경기 폼 −0.08', effects: [{ form: -0.08, games: 3 }, { life: 'mental', add: 2 }], result: ['버텼지만 발이 무거워요.', '꾹 참았어요. 몸이 말을 안 들어요.', '"조금만 더." 스스로를 다그쳤어요.'] },
    ],
    fallback: 'trip',
  },
  {
    id: 'l_mediaStorm', tags: ['life', 'match', 'media', 'interview'], kind: 'choice', on: 'match', cat: 'media', when: { all: [['lastBig', '==', 1], ['lastPlayed', '==', 1], ['lastRating', '<', 6.0], ['lastRating', '>', 0]] }, chance: 0.4, chanceTags: { mediaShy: 1.5 }, cooldown: 'season',
    title: ['언론의 비난', '큰 경기 부진 뒤 쏟아진 기사'],
    text: [
      '{opp}전 부진에 비난 기사가 쏟아졌어요. 인터뷰 요청이 왔어요.',
      '"큰 경기에 약한 {name}?" 자극적인 제목이 붙었어요.',
      '평점 {rating}. 한 방송 패널이 {name}{을/를} 강하게 비판했어요.',
    ],
    choices: [
      { id: 'reply', label: '정면으로 반박한다', desc: '위상 +1, 멘탈 피로 (언론 울렁증이면 못 고름)', requires: { not: { tag: 'mediaShy' } }, effects: [{ rep: 1 }, { life: 'mental', add: 4 }], result: ['"다음 경기를 보라." 단호한 답이 화제가 됐어요.', '조목조목 반박했어요. 팬들이 박수를 쳤어요.', '정면 승부. 기자들도 한발 물러섰어요.'] },
      { id: 'silent', label: '침묵한다', desc: '멘탈 피로 조금', effects: [{ life: 'mental', add: 2 }], result: ['말을 아꼈어요. 기사는 며칠 뒤 잠잠해졌어요.', '인터뷰를 사양했어요.', '침묵으로 넘겼어요.'] },
      { id: 'sorry', label: '팬들에게 사과한다', desc: '위상 −1, 팀 관계 +', effects: [{ rep: -1 }, { life: 'team', add: 3 }], result: ['"제 탓이에요." 동료들이 어깨를 두드렸어요.', '사과 글에 응원 댓글이 달렸어요.', '고개를 숙였어요. 팬들은 다음 경기를 기다린대요.'] },
    ],
    fallback: 'silent',
  },
  {
    id: 'l_contract', tags: ['life', 'day', 'contract'], kind: 'choice', on: 'day', cat: 'contract', when: { all: [['contractLeft', '<=', 0], ['round', '>=', 25]] }, chance: 0.1, cooldown: 'season',
    title: ['계약 신경전', '재계약 이야기가 길어져요'],
    text: [
      '계약 이야기로 에이전트 전화가 잦아요. 집중이 흐트러져요.',
      '구단과 에이전트 사이 협상이 길어진다는 기사가 나왔어요.',
      '"남을 건가, 떠날 건가?" 매일 같은 질문을 받아요.',
    ],
    choices: [
      { id: 'agent', label: '에이전트에게 맡긴다', desc: '마음이 편해져요', effects: [{ life: 'mental', add: -3 }], result: ['계약은 에이전트 몫. 축구만 생각하기로 했어요.', '휴대폰 알림을 껐어요.', '"시즌 끝나고 이야기하자." 깔끔하게 정리했어요.'] },
      { id: 'self', label: '직접 챙긴다', desc: '감독 신뢰도 +1, 멘탈 피로', effects: [{ trust: 1 }, { life: 'mental', add: 5 }], result: ['구단 사무실을 직접 찾아갔어요. 감독이 진심을 알아줬어요.', '협상 자리에 직접 앉았어요. 피곤해요.', '남고 싶다는 뜻을 직접 전했어요.'] },
    ],
    fallback: 'agent',
  },
  {
    id: 'l_trauma', tags: ['life', 'day', 'injury'], kind: 'message', on: 'day', cat: 'life', when: { all: [{ flag: 'trauma' }, ['injured', '==', 0]] }, cooldown: 30,
    title: ['부상 트라우마', '복귀했지만 몸이 망설여요'],
    text: [
      '긴 부상에서 돌아왔지만 태클 앞에서 발이 먼저 빠져요.',
      '경합 순간 다쳤던 장면이 떠올라요. 시간이 필요해요.',
      '복귀전, 몸은 나았는데 마음은 아직이에요.',
    ],
    effects: [{ form: -0.05, games: 3 }, { flag: 'trauma', on: false }],
  },
  {
    id: 'l_goodNews', tags: ['life', 'day', 'family', 'praise'], kind: 'message', on: 'day', cat: 'life', when: { all: [['age', '>=', 24], ['offseason', '==', 0]] }, chance: 0.0008, cooldown: 'season',
    title: ['좋은 소식', '집에 경사가 났어요'],
    text: [
      '결혼 소식을 전했어요. 동료들이 라커룸에서 축하 노래를 불렀어요.',
      '아이가 태어났어요. 다음 골은 아기 세리머니예요.',
      '고향 신문 1면에 {name}의 이야기가 실렸어요. 가족이 자랑스러워해요.',
    ],
    effects: [{ life: 'home', add: 10 }, { form: 0.05, games: 3 }],
  },
  {
    id: 'l_chemistry', tags: ['life', 'match', 'team', 'praise'], kind: 'message', on: 'match', cat: 'team', when: { all: [['team', '>=', 75], ['lastAssists', '>=', 1]] }, chance: 0.25, cooldown: 'season',
    title: ['동료와 케미', '눈빛만 봐도 통해요'],
    text: [
      '오늘 도움은 눈빛 하나로 나왔어요. 동료와 호흡이 척척 맞아요.',
      '"말 안 해도 알아." 동료가 웃으며 하이파이브를 했어요.',
      '훈련장 2대2에서도 둘이 붙으면 못 막는대요.',
    ],
    effects: [{ life: 'team', add: 3 }, { form: 0.03, games: 2 }],
  },
  {
    id: 'l_hometown', tags: ['life', 'match', 'family', 'praise'], kind: 'message', on: 'match', cat: 'life', when: { all: [['foreign', '==', 1], ['lastMom', '==', 1]] }, chance: 0.3, cooldown: 'season',
    title: ['고향 언론의 칭찬', '고향이 들썩여요'],
    text: [
      '고향 방송이 {name}의 하이라이트를 저녁 뉴스에 내보냈어요.',
      '고향 친구들이 단체로 응원 사진을 보냈어요.',
      '"우리 동네 자랑." 고향 신문 기사에 가족이 뿌듯해해요.',
    ],
    effects: [{ life: 'home', add: 5 }, { rep: 1 }],
  },
  {
    id: 'l_teamOuting', tags: ['life', 'day', 'team'], kind: 'choice', on: 'day', cat: 'team', when: { all: [['team', '<', 60], ['offseason', '==', 0]] }, chance: 0.02, cooldown: 'season',
    title: ['팀 행사', '구단 볼링 대회'],
    text: [
      '구단이 선수단 볼링 대회를 열어요. 참석할까요?',
      '주말에 팀 바비큐가 있어요.',
      '선수단 단체 영화 관람이 잡혔어요.',
    ],
    choices: [
      { id: 'go', label: '참석한다', desc: '팀 관계 +, 체력 조금 −', effects: [{ life: 'team', add: 5 }, { fatigue: 3 }], result: ['볼링 꼴찌를 했지만 제일 많이 웃었어요.', '고기를 굽다 동료와 친해졌어요.', '영화보다 끝나고 간 야식이 더 재밌었어요.'] },
      { id: 'skip', label: '쉰다', desc: '팀 관계 조금 −', effects: [{ life: 'team', add: -1 }], result: ['집에서 쉬었어요.', '사진으로만 봤어요.', '다음엔 꼭 가기로 했어요.'] },
    ],
    fallback: 'go',
  },
  {
    id: 'l_mentalHint', tags: ['life', 'day', 'mental'], kind: 'message', on: 'day', cat: 'life', when: ['mental', '>=', 85], chance: 0.2, cooldown: 30,
    title: ['코치가 걱정해요', '"요즘 표정이 어둡다"'],
    text: [
      '피지컬 코치가 "요즘 표정이 어둡다"며 심리 상담을 권했어요.',
      '팀 닥터가 잠은 잘 자는지 물었어요. 하루 쉬어 가도 좋대요.',
      '동료가 "주말에 바람 쐬러 가자"고 했어요.',
    ],
    effects: [],
  },
  {
    id: 'l_captainTalk', tags: ['life', 'day', 'team', 'captain'], kind: 'choice', on: 'day', cat: 'team', when: { all: [['captain', '==', 1], ['team', '<', 50]] }, chance: 0.08, cooldown: 'season',
    title: ['주장의 몫', '라커룸을 모을 때'],
    text: [
      '연패로 라커룸이 무거워요. 주장으로서 뭔가 해야 해요.',
      '어린 선수들이 기가 죽었어요. 주장의 말이 필요해요.',
      '팀 분위기가 가라앉았어요. 모두 주장을 봐요.',
    ],
    choices: [
      { id: 'meet', label: '선수단 미팅을 연다', desc: '팀 관계 +, 신뢰도 +1', effects: [{ life: 'team', add: 8 }, { trust: 1 }], result: ['미팅 뒤 훈련 강도가 확 올라갔어요.', '"한 경기씩." 주장의 말에 모두 고개를 끄덕였어요.', '어린 선수들과 따로 이야기를 나눴어요.'] },
      { id: 'skip', label: '지켜본다', desc: '팀 관계 조금 −', effects: [{ life: 'team', add: -2 }], result: ['조금 더 지켜보기로 했어요.', '말보다 경기로 보여 주기로 했어요.', '시간이 해결해 주길 바랐어요.'] },
    ],
    fallback: 'meet',
  },
  {
    id: 'l_fanLetter', tags: ['life', 'day', 'fans'], kind: 'message', on: 'day', cat: 'life', when: ['offseason', '==', 0], chance: 0.002, cooldown: 'season',
    title: ['팬레터', '손편지 한 통'],
    text: [
      '어린 팬이 손편지를 보냈어요. "커서 {name}처럼 될래요."',
      '병원에 있는 팬이 {name}의 경기를 보며 힘을 낸대요.',
      '구단으로 온 팬레터 묶음에 {name}의 이름이 가장 많았어요.',
    ],
    effects: [{ life: 'home', add: 3 }, { life: 'mental', add: -3 }],
  },
  {
    id: 'l_lonely', tags: ['life', 'day', 'adapt', 'team'], kind: 'message', on: 'day', cat: 'life', when: { all: [['team', '<', 35], ['adapt', '<', 50]] }, chance: 0.08, cooldown: 'season',
    title: ['혼자인 것 같아요', '낯선 도시의 밤'],
    text: [
      '훈련이 끝나면 갈 곳이 없어요. 낯선 도시의 밤이 길어요.',
      '동료들은 다 약속이 있어요. 혼자 저녁을 먹었어요.',
      '집에 오면 너무 조용해요. 동료와 식사라도 해 보면 어떨까요.',
    ],
    effects: [{ life: 'mental', add: 3 }],
  },
];
