// 이벤트 표 (20.1·20.7, 부록 C.63). 엔진은 src/events.ts. 조건 변수는 EV_VARS 만, 효과 상한은 BALANCE.events.caps (tests/c63.test.ts 가 검사)
// 텍스트 변수: {name} {team} {opp} {manager} {rival} {rivalTeam} {goals} {assists} {rating} {rank} {pos} {age} {round}
// 조사: {은/는} {이/가} {을/를} {과/와} {으로/로} {아/야}. 문장 변형 3개 이상. 표 순서 = 같은 때 뜨는 이벤트의 우선순위
// 생활 이벤트(pending 47 상황 목록)는 아래 LIFE_EVENTS (b)

import type { EventDef } from '../src/events';
import { LIFE_EVENTS } from './lifeEvents';

const MATCH_EVENTS: readonly EventDef[] = [
  {
    id: 'm_hattrick', tags: ['match', 'media'], kind: 'message', on: 'match', cat: 'media', when: ['lastGoals', '>=', 3], cooldown: 7,
    title: ['해트트릭! 언론이 {name}{을/를} 주목해요', '{opp}전 해트트릭'],
    text: [
      '{opp}전 해트트릭으로 경기 공을 챙겼어요. 기자들이 "{team}의 새 해결사"라고 써요.',
      '세 골. 경기 뒤 믹스트존에 기자들이 몰렸어요. {name}{은/는} "동료들 덕분"이라고 웃었어요.',
      '{name}의 해트트릭이 주말 하이라이트 첫 장면을 차지했어요.',
    ],
    effects: [{ rep: 2 }, { form: 0.05, games: 2 }],
  },
  {
    id: 'm_decisive', tags: ['match', 'media', 'interview'], kind: 'choice', on: 'match', cat: 'media', when: { all: [['lastDecisive', '==', 1], ['lastPlayed', '==', 1]] }, chance: 0.6, cooldown: 14,
    title: ['결승골 인터뷰', '{opp}전 결승골, 기자가 마이크를 내밀어요'],
    text: [
      '{opp}전 결승골의 주인공 {name}. 방송 인터뷰에서 한마디 해 달래요.',
      '결승골 직후 중계 카메라가 {name}{을/를} 따라와요. "오늘 골, 어떤 기분이에요?"',
      '{team} 승리를 이끈 결승골. 기자들이 소감을 기다리고 있어요.',
    ],
    choices: [
      { id: 'team', label: '팀 덕분이라고 말한다', desc: '동료들이 좋아해요', effects: [{ rep: 1 }, { life: 'team', add: 4 }], result: ['"동료들이 만든 골"이라는 말에 라커룸이 박수를 쳤어요.', '겸손한 인터뷰가 좋은 평을 받았어요.', '"팀이 이긴 게 중요해요." 동료들이 등을 두드려 줬어요.'] },
      { id: 'bold', label: '자신감을 보인다', desc: '위상 +, 동료 관계는 조금 − (언론 울렁증이면 못 고름)', requires: { not: { tag: 'mediaShy' } }, effects: [{ rep: 2 }, { life: 'team', add: -2 }], result: ['"원래 넣을 수 있는 골이었어요." 헤드라인에 크게 실렸어요.', '자신감 넘치는 인터뷰가 화제가 됐어요. 몇몇 동료는 웃지 않았어요.', '"다음 경기도 넣겠습니다." 팬들이 열광했어요.'] },
      { id: 'fans', label: '팬들에게 감사한다', desc: '위상 +1', effects: [{ rep: 1 }], result: ['원정까지 온 팬들에게 인사를 건넸어요.', '팬들을 향한 감사 인사가 구단 SNS에 올라왔어요.', '"팬들 덕분에 뛰었어요." 무난한 인터뷰였어요.'] },
    ],
    fallback: 'fans',
  },
  {
    id: 'm_red', tags: ['match', 'media', 'critic'], kind: 'message', on: 'match', cat: 'media', when: ['lastRed', '==', 1], cooldown: 7,
    title: ['퇴장 · 비판 기사', '{opp}전 퇴장, 언론이 등을 돌렸어요'],
    text: [
      '{opp}전 퇴장에 "팀을 10명으로 만든 무모한 태클"이라는 기사가 나왔어요.',
      '퇴장 장면이 하루 종일 다시 돌았어요. {manager} 감독은 말을 아꼈어요.',
      '"{name}, 이번엔 선을 넘었다." 칼럼 한 편이 퇴장을 꼬집었어요.',
    ],
    effects: [{ rep: -2 }, { life: 'mental', add: 4 }],
  },
  {
    id: 'm_derbyHero', tags: ['match', 'derby'], kind: 'message', on: 'match', cat: 'media', when: { all: [['lastDerby', '==', 1], ['lastGoals', '>=', 1], ['lastResult', '==', 1]] }, cooldown: 14,
    title: ['더비의 영웅', '{opp}전 더비 승리 골'],
    text: [
      '더비에서 골을 넣고 이겼어요. 팬들이 {name}의 이름을 노래로 부르기 시작했어요.',
      '{opp}{과/와}의 더비 승리. 경기장 밖 펍까지 {name} 이야기로 가득해요.',
      '더비 골 하나로 {team} 팬들 사이에서 {name}의 자리가 달라졌어요.',
    ],
    effects: [{ rep: 2 }, { life: 'team', add: 2 }],
  },
  {
    id: 'm_derbyLoss', tags: ['match', 'derby', 'critic'], kind: 'message', on: 'match', cat: 'media', when: { all: [['lastDerby', '==', 1], ['lastResult', '==', -1], ['lastPlayed', '==', 1]] }, cooldown: 14,
    title: ['더비 패배 · 팬들이 화났어요', '{opp}전 패배 뒤'],
    text: [
      '더비에서 졌어요. 훈련장 앞에 팬들이 모여 항의했어요.',
      '{opp}에 진 다음 날, 동네 빵집 주인까지 한마디 했어요. "다음엔 꼭 이겨요."',
      '더비 패배 기사에 선수 평점이 줄줄이 붙었어요. {name}{은/는} {rating}점.',
    ],
    effects: [{ life: 'mental', add: 3 }],
  },
  {
    id: 'm_bigMom', tags: ['match', 'media', 'praise'], kind: 'message', on: 'match', cat: 'media', when: { all: [['lastMom', '==', 1], ['lastBig', '==', 1]] }, cooldown: 14,
    title: ['빅매치 최우수 선수', '{opp}전 최고의 선수'],
    text: [
      '{opp}{과/와}의 큰 경기에서 경기 최우수 선수로 뽑혔어요. 평점 {rating}.',
      '강팀 상대로 빛났어요. 해설진이 "{name}{은/는} 큰 경기에 강하다"고 말했어요.',
      '빅매치 최우수 선수. 다음 주 언론 인터뷰 요청이 쌓였어요.',
    ],
    effects: [{ rep: 1 }],
  },
  {
    id: 'm_badGame', tags: ['match', 'media', 'critic'], kind: 'message', on: 'match', cat: 'media', when: { all: [['lastPlayed', '==', 1], ['lastRating', '<', 5.8], ['lastRating', '>', 0]] }, chance: 0.35, cooldown: 28,
    title: ['혹평 기사', '"{name}, 오늘은 없었다"'],
    text: {
      neutral: [
        '{opp}전 평점 {rating}. "존재감이 없었다"는 평이 나왔어요.',
        '경기 뒤 평점표 맨 아래에 {name}의 이름이 있었어요.',
        '"{name}에게 쉬어 갈 시간이 필요하다." 한 기자의 칼럼이에요.',
      ],
      critic: [
        '{opp}전 패배의 원흉으로 {name}{이/가} 지목됐어요. 평점 {rating}.',
        '"오늘 {team}의 가장 약한 고리." 혹독한 기사가 나왔어요.',
        '패배와 함께 평점 {rating}. 팬 게시판이 시끄러워요.',
      ],
    },
    effects: [{ life: 'mental', add: 4 }],
  },
  {
    id: 'm_firstGoal', tags: ['match', 'career'], kind: 'message', on: 'match', cat: 'media', when: { all: [['goals', '==', 1], ['lastGoals', '>=', 1], ['seasonNo', '==', 1]] }, cooldown: 'once',
    title: ['데뷔 시즌 첫 골', '첫 골!'],
    text: [
      '{opp}전에서 {team} 유니폼을 입고 첫 골을 넣었어요. 가족에게 전화가 쏟아졌어요.',
      '첫 골이 들어갔어요. 동료들이 {name}{을/를} 둘러싸고 머리를 헝클었어요.',
      '프로 첫 골. 공은 기념으로 사물함에 넣어 뒀어요.',
    ],
    effects: [{ rep: 1 }, { life: 'home', add: 3 }],
  },
  {
    id: 'm_interviewSlip', tags: ['match', 'media', 'interview', 'chain'], kind: 'chain', on: 'match', cat: 'media', when: { all: [['lastResult', '==', -1], ['lastPlayed', '==', 1], ['lastRating', '<', 6.4]] }, chance: 0.35, chanceTags: { troublemaker: 1.5, mediaShy: 1.3 }, cooldown: 28,
    title: ['패배 뒤 인터뷰', '믹스트존 질문 하나'],
    text: [
      '{opp}전 패배 뒤 기자가 묻는다. "오늘 팀에 뭐가 부족했나요?"',
      '진 경기 뒤 인터뷰. "감독의 선택에 동의하나요?" 날카로운 질문이 날아왔어요.',
      '패배 뒤 마이크 앞. 감정이 아직 가라앉지 않았어요.',
    ],
    choices: [
      { id: 'calm', label: '차분하게 넘긴다', desc: '변화 없음', effects: [], result: ['"다음 경기에서 보여 주겠다"고만 했어요.', '침착한 대답이 무난하게 지나갔어요.', '말을 아꼈어요. 기사 한 줄로 끝났어요.'] },
      { id: 'blunt', label: '솔직하게 말한다', desc: '위상 +1, 며칠 뒤 파장이 올 수도', effects: [{ rep: 1 }, { next: 'c_slipFallout', days: 3 }], result: ['"우리 모두 부족했다. 나부터." 솔직한 말이 헤드라인이 됐어요.', '"전술이 맞지 않았다." 기자들의 눈이 반짝였어요.', '거침없는 대답에 기자들이 받아 적기 바빴어요.'] },
    ],
    fallback: 'calm',
  },
  {
    id: 'm_benchRun', tags: ['match', 'manager', 'minutes'], kind: 'choice', on: 'match', cat: 'manager', when: ['benchRun', '>=', 3], cooldown: 28,
    title: ['벤치가 길어져요', '{manager} 감독은 아직 나를 부르지 않아요'],
    text: [
      '세 경기째 벤치. 기자가 출전 시간에 대해 묻고 싶어 해요.',
      '벤치에서 보는 경기가 늘었어요. 에이전트가 전화를 걸어왔어요.',
      '출전이 없는 날이 이어져요. 어떻게 할까요?',
    ],
    choices: [
      { id: 'patient', label: '훈련으로 보여 준다', desc: '감독 신뢰도 +2, 멘탈 피로 조금', effects: [{ trust: 2 }, { life: 'mental', add: 3 }], result: ['묵묵히 훈련장에 가장 먼저 나왔어요. 코치들이 봤어요.', '불평 대신 땀. 감독이 지나가며 고개를 끄덕였어요.', '"기회는 온다." 스스로에게 말했어요.'] },
      { id: 'press', label: '기자에게 불만을 말한다', desc: '위상 +1, 감독 신뢰도 −4', effects: [{ rep: 1 }, { trust: -4 }], result: ['"나는 뛰고 싶다." 기사가 나가자 감독 표정이 굳었어요.', '불만 인터뷰가 화제가 됐어요. 감독은 "선수 선발은 내 일"이라고 받았어요.', '에이전트가 언론에 흘렸어요. 구단 분위기가 싸늘해요.'] },
    ],
    fallback: 'patient',
  },
  {
    id: 'm_rivalAhead', tags: ['match', 'rival'], kind: 'message', on: 'match', cat: 'rival', when: { all: [['hasRival', '==', 1], ['rivalGap', '<=', -5], ['round', '>=', 10]] }, cooldown: 42,
    title: ['라이벌 {rival}{이/가} 앞서가요', '{rival}, 공격 포인트 격차 벌려'],
    text: [
      '{rivalTeam}의 {rival}{이/가} 공격 포인트에서 앞서가요. 기자들이 비교 기사를 냈어요.',
      '"{rival} vs {name}, 올 시즌은 {rival} 쪽." 축구 팟캐스트 한 편이 올라왔어요.',
      '{rival}의 이름이 또 하이라이트에 나왔어요. 따라잡을 때예요.',
    ],
    effects: [{ form: 0.03, games: 2 }],
  },
  {
    id: 'm_rivalPassed', tags: ['match', 'rival', 'praise'], kind: 'message', on: 'match', cat: 'rival', when: { all: [['hasRival', '==', 1], ['rivalGap', '>=', 5], ['round', '>=', 10]] }, cooldown: 42,
    title: ['라이벌을 앞질렀어요', '{rival}보다 한발 앞서'],
    text: [
      '공격 포인트에서 {rivalTeam}의 {rival}{을/를} 넉넉히 앞섰어요.',
      '"올 시즌 같은 나이대 최고는 {name}." 비교 기사가 나왔어요.',
      '{rival}{과/와}의 경쟁에서 앞서가요. 팬들이 숫자를 세기 시작했어요.',
    ],
    effects: [{ rep: 1 }],
  },
  {
    id: 'm_longInjury', tags: ['match', 'injury'], kind: 'message', on: 'match', cat: 'club', when: { all: [['injured', '==', 1], ['injuryDays', '>=', 56]] }, cooldown: 'season',
    title: ['장기 부상', '재활이 길어질 거예요'],
    text: [
      '의료진 판정: 회복까지 오래 걸려요. 구단이 회복을 돕겠다고 했어요.',
      '긴 재활이 시작돼요. 동료들이 병문안 영상을 보냈어요.',
      '부상 소식에 팬들이 응원 메시지를 남겼어요. 서두르지 않는 게 중요해요.',
    ],
    effects: [{ life: 'mental', add: 6 }, { flag: 'trauma' }],
  },
];

const SLOT_EVENTS: readonly EventDef[] = [
  {
    id: 's_charity', tags: ['slot', 'charity', 'chain'], kind: 'chain', on: 'slot', cat: 'event', weight: 1.2,
    title: ['자선 행사 초대', '어린이 병원 자선 행사'],
    text: [
      '지역 어린이 병원이 자선 행사에 와 달래요. 훈련 뒤 저녁 일정이에요.',
      '구단 재단이 자선 축구 교실에 나가 줄 선수를 찾아요.',
      '연말 자선 경매에 유니폼을 내고 참석해 달라는 요청이 왔어요.',
    ],
    choices: [
      { id: 'go', label: '직접 간다', desc: '위상 +2, 체력 조금 −', effects: [{ rep: 2 }, { fatigue: 4 }, { next: 'c_charityThanks', days: 14 }], result: ['아이들과 공을 찼어요. 사진이 구단 SNS에 올라왔어요.', '행사장에 가자 박수가 쏟아졌어요.', '사인을 백 장쯤 했어요. 피곤했지만 좋은 하루였어요.'] },
      { id: 'donate', label: '기부만 한다', desc: '위상 +1, 기부 주급 ×1', effects: [{ rep: 1 }, { money: -1, charity: true }], result: ['조용히 기부했어요. 재단이 감사 인사를 전했어요.', '이름 없이 보낸 기부금이 나중에 알려졌어요.', '유니폼과 기부금을 보냈어요.'] },
      { id: 'skip', label: '이번엔 쉰다', desc: '변화 없음', effects: [], result: ['이번엔 정중히 거절했어요.', '일정이 맞지 않아 다음을 약속했어요.', '쉬는 게 우선이에요. 재단은 이해했어요.'] },
    ],
    fallback: 'skip',
  },
  {
    id: 's_sponsor', tags: ['slot', 'sponsor', 'chain'], kind: 'chain', on: 'slot', cat: 'event', when: ['tier', '>=', 1],
    title: ['광고 촬영 제안', '스포츠 브랜드 광고 제안'],
    text: [
      '스포츠 브랜드가 광고 모델을 제안했어요. 촬영은 쉬는 날 하루.',
      '에너지 음료 회사가 광고 촬영을 원해요. "{team}의 얼굴"이 필요하대요.',
      '축구화 회사가 새 모델 광고를 같이 찍자고 해요.',
    ],
    choices: [
      { id: 'yes', label: '찍는다', desc: '위상 +1, 체력 −, 광고가 나오면 출연료 주급 ×3', effects: [{ rep: 1 }, { fatigue: 6 }, { next: 'c_sponsorAir', days: 21 }], result: ['촬영이 하루 종일 걸렸어요. 감독은 "경기에 지장 없게"라고만 했어요.', '카메라 앞에서 공을 백 번은 찼어요.', '촬영장 간식이 맛있었어요. 몸은 좀 무거워요.'] },
      { id: 'no', label: '축구에 집중한다', desc: '감독 신뢰도 +1', effects: [{ trust: 1 }], result: ['제안을 거절하고 훈련장에 남았어요. 감독이 좋게 봤어요.', '"지금은 축구만." 에이전트가 아쉬워했어요.', '정중히 거절했어요.'] },
    ],
    fallback: 'no',
  },
  {
    id: 's_youthClinic', tags: ['slot', 'club'], kind: 'choice', on: 'slot', cat: 'club',
    title: ['아카데미 일일 코치', '유소년 클리닉 요청'],
    text: [
      '구단 아카데미가 하루 코치를 부탁해요. 유망주들이 {name}{을/를} 보고 싶어 해요.',
      '유소년 팀 감독이 시범을 보여 달래요.',
      '아카데미 아이들이 사인을 받고 싶어 해요. 훈련 뒤 한 시간이에요.',
    ],
    choices: [
      { id: 'go', label: '간다', desc: 'XP +30, 팀 관계 +', effects: [{ xp: 30 }, { life: 'team', add: 3 }], result: ['아이들에게 가르치다 보니 스스로도 배웠어요.', '시범 슈팅이 골대를 맞혔어요. 아이들이 더 좋아했어요.', '"저도 저 나이에 이랬어요." 즐거운 시간이었어요.'] },
      { id: 'no', label: '다음에', desc: '변화 없음', effects: [], result: ['다음 기회를 약속했어요.', '일정이 맞지 않았어요.', '이번엔 넘어갔어요.'] },
    ],
    fallback: 'no',
  },
  {
    id: 's_extraTraining', tags: ['slot', 'training'], kind: 'choice', on: 'slot', cat: 'club', weight: 1.2,
    title: ['개인 훈련 제안', '코치가 따로 남으래요'],
    text: [
      '{pos} 코치가 훈련 뒤 개인 훈련을 하자고 해요. 약점을 같이 보재요.',
      '피지컬 코치가 개인 프로그램을 짜 왔어요. 며칠 힘들 거래요.',
      '"30분만 더." 코치가 공 바구니를 들고 기다려요.',
    ],
    choices: [
      { id: 'yes', label: '남는다', desc: 'XP +40, 체력 −10', effects: [{ xp: 40 }, { fatigue: 10 }, { trust: 1 }], result: ['땀을 쏟았어요. 코치가 "좋아졌다"고 했어요.', '다리가 후들거려요. 그래도 감이 좋아요.', '개인 훈련 끝. 감독이 멀리서 봤어요.'] },
      { id: 'no', label: '회복이 먼저다', desc: '변화 없음', effects: [], result: ['오늘은 회복에 집중했어요.', '코치는 "다음에"라며 웃었어요.', '몸 상태를 먼저 챙겼어요.'] },
    ],
    fallback: 'no',
  },
  {
    id: 's_documentary', tags: ['slot', 'media', 'interview'], kind: 'choice', on: 'slot', cat: 'media',
    title: ['다큐멘터리 인터뷰', '방송사 인물 다큐 제안'],
    text: [
      '방송사가 {name}의 하루를 따라다니는 다큐를 찍고 싶어 해요.',
      '축구 잡지가 긴 인터뷰를 요청했어요. 어린 시절 이야기도 묻는대요.',
      '구단 채널이 선수 다큐 첫 편의 주인공으로 {name}{을/를} 골랐어요.',
    ],
    choices: [
      { id: 'open', label: '솔직하게 응한다', desc: '위상 +2, 멘탈 피로 조금', effects: [{ rep: 2 }, { life: 'mental', add: 3 }], result: ['솔직한 이야기에 팬들이 공감했어요.', '방송이 나가고 메시지가 쏟아졌어요.', '어린 시절 사진이 공개됐어요. 조금 쑥스러워요.'] },
      { id: 'light', label: '가볍게 응한다', desc: '위상 +1', effects: [{ rep: 1 }], result: ['무난한 인터뷰였어요.', '짧게 찍고 끝냈어요.', '구단이 고른 질문에만 답했어요.'] },
      { id: 'no', label: '거절한다', desc: '변화 없음', effects: [], result: ['사생활은 지키기로 했어요.', '정중히 거절했어요.', '"지금은 축구에 집중할게요."'] },
    ],
    fallback: 'no',
  },
  {
    id: 's_birthday', tags: ['slot', 'team'], kind: 'choice', on: 'slot', cat: 'team',
    title: ['동료 생일 파티', '라커룸 생일 파티 초대'],
    text: [
      '주장이 생일 파티를 열어요. 팀 전체가 온대요.',
      '같은 포지션 동료가 생일 저녁에 초대했어요.',
      '팀 막내의 생일이에요. 다 같이 저녁 먹재요.',
    ],
    choices: [
      { id: 'go', label: '간다', desc: '팀 관계 +, 체력 조금 −', effects: [{ life: 'team', add: 5 }, { fatigue: 3 }], result: ['노래방까지 갔어요. 동료들과 한층 가까워졌어요.', '케이크를 얼굴에 맞았어요. 다들 웃었어요.', '좋은 저녁이었어요. 라커룸 분위기가 따뜻해요.'] },
      { id: 'no', label: '쉰다', desc: '팀 관계 조금 −', effects: [{ life: 'team', add: -1 }], result: ['선물만 보냈어요.', '피곤해서 일찍 쉬었어요.', '다음 날 사진으로만 봤어요.'] },
    ],
    fallback: 'no',
  },
  {
    id: 's_tacticsTalk', tags: ['slot', 'manager'], kind: 'choice', on: 'slot', cat: 'manager',
    title: ['전술 미팅', '{manager} 감독이 의견을 물어요'],
    text: [
      '전술 미팅에서 {manager} 감독이 {name}에게 의견을 물었어요.',
      '"너라면 어떻게 하겠나?" 감독이 화이트보드 펜을 건넸어요.',
      '다음 상대 분석 시간. 감독이 선수들의 생각을 듣고 싶어 해요.',
    ],
    choices: [
      { id: 'speak', label: '의견을 낸다', desc: '신뢰도 50 이상이면 +3, 아니면 −1', requires: ['trust', '>=', 50], effects: [{ trust: 3 }], result: ['감독이 아이디어를 받아들였어요.', '"좋은 생각이야." 감독이 메모했어요.', '동료들이 고개를 끄덕였어요.'] },
      { id: 'listen', label: '듣고 배운다', desc: '신뢰도 +1', effects: [{ trust: 1 }], result: ['열심히 받아 적었어요.', '감독의 설명을 끝까지 들었어요.', '질문 하나만 했어요. 감독이 만족했어요.'] },
    ],
    fallback: 'listen',
  },
  {
    id: 's_fans', tags: ['slot', 'fans'], kind: 'choice', on: 'slot', cat: 'event',
    title: ['팬 사인회', '팬 미팅 요청'],
    text: [
      '구단 스토어에서 팬 사인회를 열재요.',
      '서포터즈가 팬 미팅에 와 달라고 편지를 보냈어요.',
      '시즌권 회원 행사에 선수 대표로 나가 달래요.',
    ],
    choices: [
      { id: 'go', label: '간다', desc: '위상 +1', effects: [{ rep: 1 }, { fatigue: 2 }], result: ['줄이 매장 밖까지 섰어요.', '팬이 그려 온 초상화를 받았어요.', '사인하다 손목이 아플 정도였어요.'] },
      { id: 'no', label: '다음에', desc: '변화 없음', effects: [], result: ['다음 기회로 미뤘어요.', '구단이 다른 선수를 보냈어요.', '이번엔 쉬었어요.'] },
    ],
    fallback: 'no',
  },
  {
    id: 's_cover', tags: ['slot', 'media', 'star'], kind: 'choice', on: 'slot', cat: 'media', when: ['tier', '>=', 2],
    title: ['게임 표지 모델 제안', '축구 게임 표지 제안'],
    text: [
      '축구 게임 회사가 다음 판 표지 모델로 {name}{을/를} 원해요.',
      '"올해의 얼굴"로 게임 표지를 찍자는 제안이에요.',
      '게임 표지 촬영 제안. 세계 팬들이 볼 거예요.',
    ],
    choices: [
      { id: 'yes', label: '수락한다', desc: '위상 +3, 체력 −, 출연료 주급 ×2', effects: [{ rep: 3 }, { fatigue: 5 }, { money: 2 }], result: ['표지가 공개되자 SNS가 들썩였어요.', '"표지 저주는 없다." 기자들이 농담했어요.', '촬영은 길었지만 결과물이 멋져요.'] },
      { id: 'no', label: '거절한다', desc: '변화 없음', effects: [], result: ['다른 선수가 표지를 맡았어요.', '정중히 거절했어요.', '"아직은 아니에요."'] },
    ],
    fallback: 'no',
  },
  {
    id: 's_luxury', tags: ['slot', 'luxury', 'media'], kind: 'choice', on: 'slot', cat: 'media', when: ['tier', '>=', 1],
    title: ['사치 논란', '슈퍼카 사진이 퍼졌어요'],
    text: [
      '새 차 사진이 SNS에 퍼졌어요. 팀이 지고 있는데 너무 튄다는 말이 나와요.',
      '휴일 파티 사진이 기사로 나왔어요. "프로답지 않다"는 댓글이 달렸어요.',
      '명품 쇼핑 사진이 찍혔어요. 팬들 반응이 반반이에요.',
    ],
    choices: [
      { id: 'sorry', label: '사과한다', desc: '위상 −1, 팀 관계 +', effects: [{ rep: -1 }, { life: 'team', add: 2 }], result: ['짧은 사과문을 올렸어요. 금방 잠잠해졌어요.', '"더 신중하겠습니다." 구단도 사과를 받아들였어요.', '사과 뒤 팬들이 다시 응원해요.'] },
      { id: 'ignore', label: '신경 쓰지 않는다', desc: '위상 −2', effects: [{ rep: -2 }, { life: 'mental', add: 2 }], result: ['무시했더니 기사가 두 개 더 나왔어요.', '논란이 일주일 갔어요.', '감독이 조용히 불러 한마디 했어요.'] },
    ],
    fallback: 'ignore',
  },
  {
    id: 's_social', tags: ['slot', 'media', 'troublemaker'], kind: 'choice', on: 'slot', cat: 'media',
    title: ['SNS 논란', '오래된 게시물이 문제가 됐어요'],
    text: [
      '몇 년 전 올린 농담 게시물이 다시 퍼졌어요.',
      '경기 뒤 올린 글을 두고 "상대를 조롱했다"는 말이 나와요.',
      '팬과 주고받은 댓글이 캡처돼 돌고 있어요.',
    ],
    choices: [
      { id: 'sorry', label: '사과한다', desc: '위상 −1', effects: [{ rep: -1 }], result: ['빠른 사과로 일이 커지지 않았어요.', '사과문이 오히려 좋게 받아들여졌어요.', '잠깐 시끄러웠다가 지나갔어요.'] },
      { id: 'explain', label: '해명한다', desc: '위상 변화 없음, 멘탈 피로', effects: [{ life: 'mental', add: 3 }], result: ['해명 글에 다시 댓글이 달렸어요. 피곤해요.', '오해가 풀렸지만 며칠 걸렸어요.', '긴 해명 끝에 잠잠해졌어요.'] },
      { id: 'ignore', label: '무시한다', desc: '위상 −2', effects: [{ rep: -2 }], result: ['논란이 더 커졌어요.', '무시하자 기사가 더 나왔어요.', '구단 홍보팀이 한숨을 쉬었어요.'] },
    ],
    fallback: 'ignore',
  },
];

const DAY_EVENTS: readonly EventDef[] = [
  {
    id: 'd_newCompetitor', tags: ['day', 'rival', 'team'], kind: 'chain', on: 'day', cat: 'rival', when: { flag: 'competitor' }, cooldown: 7,
    title: ['같은 포지션 영입', '새 경쟁자가 왔어요'],
    text: [
      '구단이 {pos} 자리에 새 선수를 영입했어요. 주전 경쟁이 시작돼요.',
      '"{team}, {pos} 보강." 기사 제목에 내 자리가 걸려 있어요.',
      '새로 온 선수가 훈련 첫날부터 눈에 띄어요. 같은 자리예요.',
    ],
    choices: [
      { id: 'fight', label: '경쟁을 즐긴다', desc: '다음 3경기 폼 +0.05', effects: [{ form: 0.05, games: 3 }, { flag: 'competitor', on: false }, { next: 'c_competitorCheck', days: 28 }], result: ['"좋은 선수가 오면 나도 좋아진다." 훈련 강도가 올라갔어요.', '첫 연습 경기에서 먼저 골을 넣었어요.', '눈빛이 달라졌어요. 코치들이 알아챘어요.'] },
      { id: 'worry', label: '감독에게 묻는다', desc: '신뢰도 −1, 멘탈 피로 조금', effects: [{ trust: -1 }, { life: 'mental', add: 3 }, { flag: 'competitor', on: false }], result: ['감독은 "경쟁은 모두에게 열려 있다"고만 했어요.', '대답을 듣고도 마음이 편하지 않아요.', '"증명해 봐." 짧은 대답이었어요.'] },
    ],
    fallback: 'fight',
  },
  {
    id: 'd_captainOffer', tags: ['day', 'club', 'captain'], kind: 'choice', on: 'day', cat: 'club', cooldown: 'season',
    when: { all: [['captain', '==', 0], ['trust', '>=', 75], ['age', '>=', 23], { any: [['clubSeasons', '>=', 2], { tag: 'eternal' }] }, ['round', '>=', 3]] }, chance: 0.15,
    title: ['주장 제안', '{manager} 감독이 완장을 건네요'],
    text: [
      '{manager} 감독이 {name}에게 주장을 맡기고 싶어 해요.',
      '"라커룸에서 네 말을 듣는 선수가 많아." 감독이 주장 완장을 내밀었어요.',
      '구단이 새 주장을 찾고 있어요. 첫 후보는 {name}이에요.',
    ],
    choices: [
      { id: 'yes', label: '주장을 맡는다', desc: '신뢰도 +2, 하락 ×0.9, 시즌 끝 위상 +3', effects: [{ captain: true }, { trust: 2 }, { life: 'team', add: 4 }], result: ['완장을 찼어요. 첫 경기 동전 던지기가 떨려요.', '"책임감을 갖겠습니다." 동료들이 박수를 쳤어요.', '주장이 됐어요. 라커룸 한가운데 자리가 생겼어요.'] },
      { id: 'no', label: '아직은 이르다', desc: '변화 없음', effects: [], result: ['정중히 사양했어요. 감독은 이해했어요.', '"더 준비되면요." 감독이 웃었어요.', '선배에게 양보했어요.'] },
    ],
    fallback: 'no',
  },
  {
    id: 'd_rumour', tags: ['day', 'transfer', 'media'], kind: 'message', on: 'day', cat: 'transfer', when: { all: [['tier', '>=', 2], ['round', '>=', 15], ['form', '>', 0.1]] }, chance: 0.08, chanceTags: { starPlayer: 2, starQuality: 1.5 }, cooldown: 60,
    title: ['빅클럽 관심 루머', '"빅클럽이 {name}{을/를} 지켜본다"'],
    text: [
      '빅클럽 스카우트가 지난 경기를 보러 왔다는 기사가 나왔어요.',
      '이적 루머가 떴어요. {team} 팬들은 "절대 안 판다"고 외쳐요.',
      '이적 전문 기자가 {name}의 이름을 언급했어요.',
    ],
    effects: [{ rep: 1 }],
  },
  {
    id: 'd_contract', tags: ['day', 'contract'], kind: 'message', on: 'day', cat: 'contract', when: { all: [['contractLeft', '<=', 0], ['round', '>=', 20]] }, cooldown: 'season',
    title: ['계약 만료가 다가와요', '이번 시즌이 계약 마지막 해'],
    text: [
      '이번 시즌이 끝나면 계약이 끝나요. 시즌 끝에 재계약이나 이적을 정해요.',
      '에이전트가 "곧 계약 이야기를 해야 한다"고 연락해 왔어요.',
      '계약 마지막 시즌이에요. 기자들이 거취를 묻기 시작했어요.',
    ],
    effects: [{ life: 'mental', add: 2 }],
  },
  {
    id: 'd_coachPraise', tags: ['day', 'manager', 'praise'], kind: 'message', on: 'day', cat: 'manager', when: ['trust', '>=', 85], chance: 0.05, cooldown: 60,
    title: ['감독의 칭찬', '{manager} 감독 기자회견'],
    text: [
      '{manager} 감독이 기자회견에서 "{name}{은/는} 팀의 핵심"이라고 했어요.',
      '"요즘 {name}만큼 열심히 하는 선수는 없다." 감독의 말이에요.',
      '감독이 훈련 뒤 {name}의 어깨를 두드렸어요. 기자들이 그 장면을 찍었어요.',
    ],
    effects: [{ rep: 1 }],
  },
  {
    id: 'd_coachWarn', tags: ['day', 'manager', 'critic'], kind: 'message', on: 'day', cat: 'manager', when: { all: [['trust', '<', 35], ['round', '>=', 5]] }, chance: 0.05, cooldown: 45,
    title: ['감독의 경고', '{manager} 감독 "더 보여 줘야 한다"'],
    text: [
      '{manager} 감독이 기자회견에서 "{name}{은/는} 더 보여 줘야 한다"고 했어요.',
      '훈련 뒤 감독이 짧게 말했어요. "지금으론 부족해."',
      '감독의 인터뷰에 {name}의 이름이 나왔어요. 좋은 뜻은 아니었어요.',
    ],
    effects: [{ life: 'mental', add: 3 }],
  },
  {
    id: 'd_slump', tags: ['day', 'media', 'critic'], kind: 'message', on: 'day', cat: 'media', when: { all: [['form', '<', -0.15], ['apps', '>=', 5]] }, chance: 0.08, cooldown: 49,
    title: ['부진 기사', '"{name}에게 무슨 일이?"'],
    text: [
      '최근 경기 평점이 내려가자 "{name}에게 무슨 일이?"라는 기사가 나왔어요.',
      '부진이 길어진다는 분석 기사가 올라왔어요.',
      '팬 게시판에 "쉬게 해 줘야 한다"는 글이 늘었어요.',
    ],
    effects: [{ life: 'mental', add: 3 }],
  },
  {
    id: 'd_hotForm', tags: ['day', 'media', 'praise'], kind: 'message', on: 'day', cat: 'media', when: { all: [['form', '>', 0.2], ['apps', '>=', 5]] }, chance: 0.1, cooldown: 35,
    title: ['최고의 폼', '"요즘 {name}{은/는} 멈출 수 없다"'],
    text: [
      '최근 경기력이 좋아 "이 주의 선수" 후보에 올랐어요.',
      '"지금 리그에서 가장 뜨거운 선수 중 하나." 분석 기사가 나왔어요.',
      '{team} 팬들이 유니폼에 {name}의 이름을 새기기 시작했어요.',
    ],
    effects: [{ rep: 1 }],
  },
  {
    id: 'd_top', tags: ['day', 'club', 'praise'], kind: 'message', on: 'day', cat: 'club', when: { all: [['rank', '==', 1], ['round', '>=', 19]] }, chance: 0.1, cooldown: 'season',
    title: ['리그 선두', '{team}, 반환점을 1위로'],
    text: [
      '{team}{이/가} 1위를 달려요. 도시 전체가 들떠 있어요.',
      '"우승 후보 {team}." 신문 1면에 팀 사진이 실렸어요.',
      '선두 경쟁 한가운데. 훈련장 분위기가 뜨거워요.',
    ],
    effects: [{ life: 'team', add: 2 }],
  },
  {
    id: 'd_relegation', tags: ['day', 'club', 'critic'], kind: 'message', on: 'day', cat: 'club', when: { all: [['rank', '>=', 18], ['round', '>=', 25]] }, chance: 0.1, cooldown: 'season',
    title: ['강등 위기', '{team}, 강등권 {rank}위'],
    text: [
      '{team}{이/가} {rank}위로 강등권에 있어요. 남은 경기가 모두 결승이에요.',
      '구단 회장이 선수단 앞에서 "살아남아야 한다"고 말했어요.',
      '강등권 탈출 싸움. 팬들이 훈련장 담장에 응원 걸개를 걸었어요.',
    ],
    effects: [{ life: 'mental', add: 4 }],
  },
];

const SEASON_EVENTS: readonly EventDef[] = [
  {
    id: 'se_fanVote', tags: ['season', 'fans', 'praise'], kind: 'message', on: 'season', cat: 'club', when: { all: [['avg', '>=', 7.2], ['apps', '>=', 20]] },
    title: ['팬 선정 올해의 선수', '{team} 팬 투표 1위'],
    text: [
      '{team} 팬들이 뽑은 올해의 선수로 선정됐어요.',
      '팬 투표에서 압도적인 표를 받았어요. 시즌 평균 평점 {rating}의 힘이에요.',
      '시즌 마지막 홈 경기에서 팬 선정 트로피를 받았어요.',
    ],
    effects: [{ rep: 2 }, { life: 'home', add: 3 }],
  },
  {
    id: 'se_bigSeason', tags: ['season', 'praise'], kind: 'message', on: 'season', cat: 'media', when: ['goals', '>=', 15],
    title: ['시즌 {goals}골', '골잡이의 시즌'],
    text: [
      '{goals}골로 시즌을 마쳤어요. 시즌 결산 기사에 이름이 빠지지 않아요.',
      '"{name}의 {goals}골 시즌." 하이라이트 영상이 백만 회를 넘었어요.',
      '시즌 {goals}골. 다음 시즌 기대가 커졌어요.',
    ],
    effects: [{ rep: 1 }],
  },
  {
    id: 'se_quiet', tags: ['season', 'critic', 'minutes'], kind: 'message', on: 'season', cat: 'media', when: { all: [['apps', '<', 12], ['injured', '==', 0]] },
    title: ['조용한 시즌', '출전이 적었던 한 해'],
    text: [
      '이번 시즌 {name}의 출전은 많지 않았어요. 다음 시즌이 중요해요.',
      '시즌 결산 기사에 "기회를 못 잡은 선수" 명단이 실렸어요.',
      '에이전트가 "다음 시즌엔 더 뛰어야 한다"고 했어요.',
    ],
    effects: [{ life: 'mental', add: 3 }],
  },
];

const CHAIN_FOLLOWUPS: readonly EventDef[] = [
  {
    id: 'c_charityThanks', tags: ['next', 'charity'], kind: 'message', on: 'next', cat: 'event', cooldown: 0,
    title: ['감사 편지', '병원에서 온 편지'],
    text: [
      '자선 행사에서 만난 아이가 그림 편지를 보냈어요.',
      '재단이 행사 뒤 모인 기부금이 두 배가 됐다고 알려 왔어요.',
      '병원 아이들이 경기 날 응원 영상을 보냈어요.',
    ],
    effects: [{ rep: 1 }, { life: 'home', add: 2 }],
  },
  {
    id: 'c_sponsorAir', tags: ['next', 'sponsor'], kind: 'message', on: 'next', cat: 'event', cooldown: 0,
    title: ['광고 공개', '찍었던 광고가 나왔어요'],
    text: [
      '찍었던 광고가 공개됐어요. 지하철역에 {name}의 얼굴이 걸렸어요.',
      '광고 영상 조회 수가 빠르게 올라가요.',
      '광고가 나간 뒤 유니폼 판매가 늘었대요.',
    ],
    effects: [{ rep: 1 }, { money: 3 }],
  },
  {
    id: 'c_slipFallout', tags: ['next', 'media', 'team'], kind: 'message', on: 'next', cat: 'team', cooldown: 0,
    title: ['인터뷰 파장', '라커룸이 술렁여요'],
    text: [
      '지난 인터뷰가 라커룸에 퍼졌어요. 몇몇 동료가 서운해해요.',
      '감독이 인터뷰 기사를 들고 왔어요. "다음엔 안에서 말해."',
      '동료 한 명이 "그건 밖에서 할 말이 아니었다"고 했어요.',
    ],
    effects: [{ trust: -2 }, { life: 'team', add: -5 }],
  },
  {
    id: 'c_competitorCheck', tags: ['next', 'rival', 'team'], kind: 'message', on: 'next', cat: 'rival', cooldown: 0,
    title: ['주전 경쟁 한 달', '새 경쟁자와 한 달'],
    text: {
      praise: [
        '한 달이 지났어요. 주전 경쟁에서 {name}{이/가} 한발 앞서 있어요.',
        '새 경쟁자 영입 뒤 오히려 더 좋아졌다는 평이에요.',
        '"경쟁이 {name}{을/를} 깨웠다." 기자들의 평가예요.',
      ],
      neutral: [
        '한 달째 주전 경쟁이 팽팽해요. 감독은 둘 다 쓰고 있어요.',
        '새 동료와 번갈아 나서고 있어요. 아직 승부는 나지 않았어요.',
        '경쟁은 계속돼요. 훈련 강도가 높아졌어요.',
      ],
      critic: [
        '한 달이 지났어요. 새 경쟁자가 먼저 기회를 잡는 경기가 늘었어요.',
        '"주전 자리가 흔들린다." 기사 한 줄이 마음에 걸려요.',
        '벤치에서 새 동료의 골을 봤어요. 다시 보여 줄 때예요.',
      ],
    },
    effects: [],
  },
];

/** 재정 (C.68b, 19.7 사치 리스크 · 19.9 이벤트형 투자): 재정 화면 행동·주 정산이 예약해서만 뜬다 (on: 'next') */
const MONEY_EVENTS: readonly EventDef[] = [
  {
    id: 'n_luxuryBuy', tags: ['next', 'luxury', 'media'], kind: 'choice', on: 'next', cat: 'media', cooldown: 0,
    title: ['사치 논란', '새 집·새 차가 기사로'],
    text: [
      '새로 산 집 사진이 기사로 나왔어요. "{team} 성적은 이런데"라는 댓글이 달려요.',
      '새 차를 몰고 훈련장에 온 사진이 퍼졌어요. 감독이 기사를 봤대요.',
      '"{name}의 호화 생활" 기사가 났어요. 팬들 반응이 갈려요.',
    ],
    choices: [
      { id: 'sorry', label: '조용히 사과한다', desc: '위상 −1, 감독 신뢰도 −1', effects: [{ rep: -1 }, { trust: -1 }], result: ['짧게 사과했어요. 금방 잠잠해졌어요.', '"축구로 보여 드리겠습니다." 기사가 하루 만에 내려갔어요.', '구단 홍보팀과 같이 정리했어요.'] },
      { id: 'ignore', label: '신경 쓰지 않는다', desc: '감독 신뢰도 −3, 멘탈 피로 조금', effects: [{ trust: -3 }, { life: 'mental', add: 3 }], result: ['기사가 두 개 더 나왔어요. 감독 표정이 굳었어요.', '논란이 일주일 갔어요.', '감독이 조용히 불러 "축구에 집중하라"고 했어요.'] },
    ],
    fallback: 'ignore',
  },
  {
    id: 'n_investDeal', tags: ['next', 'money', 'invest'], kind: 'choice', on: 'next', cat: 'money', cooldown: 0,
    title: ['투자 제안', '사업 투자 제안'],
    text: [
      '{deal}에 {dealAmount}{을/를} 투자해 달라는 제안이 왔어요. 결과는 시즌 끝에 정산해요.',
      '아는 사람이 {deal} 이야기를 꺼냈어요. {dealAmount}면 지분을 준대요. 시즌 끝에 결과가 나와요.',
      '에이전트가 {deal} 투자 건을 가져왔어요. 금액은 {dealAmount}, 시즌 끝 정산이에요.',
    ],
    choices: [
      { id: 'in', label: '투자한다', desc: '시즌 끝 정산: 잃을 수도, 몇 배가 될 수도 (투자금 안에서만 손해)', requires: ['cash', '>=', 1], effects: [{ invest: 'deal' }], result: ['계약서에 사인했어요. 시즌 끝을 기다려요.', '"잘될 거야." 악수를 나눴어요.', '투자금을 보냈어요. 이제 축구에 집중할 시간이에요.'] },
      { id: 'no', label: '거절한다', desc: '변화 없음', effects: [{ invest: 'no' }], result: ['정중히 거절했어요.', '"지금은 축구만." 아쉬워하는 눈치였어요.', '돈은 은행에 두기로 했어요.'] },
    ],
    fallback: 'no',
  },
];

/** 황혼 챕터 이벤트 (22.1, C.73a): 노화 · 은퇴 질문 · 멘토. 30세 이상만 (챕터 배율로 황혼에서 더 자주) */
const TWILIGHT_EVENTS: readonly EventDef[] = [
  {
    id: 'd_agingBody', tags: ['day', 'aging'], kind: 'message', on: 'day', cat: 'club', when: { all: [['age', '>=', 31], ['apps', '>=', 5]] }, chance: 0.04, cooldown: 'season',
    title: ['회복이 느려졌어요', '몸이 예전 같지 않아요', '나이를 실감하는 아침'],
    text: [
      '경기 다음 날 다리가 무거워요. 피지오가 "회복 루틴을 늘리자"고 했어요.',
      '전력 질주 뒤 숨이 고르기까지 조금 더 걸려요. 코치가 훈련량을 조절해 줬어요.',
      '{age}세. 아침 스트레칭이 길어졌어요. 그래도 공을 차는 감각은 그대로예요.',
    ],
    effects: [{ life: 'mental', add: 2 }],
  },
  {
    id: 'd_retireTalk', tags: ['day', 'retire', 'media'], kind: 'message', on: 'day', cat: 'media', when: { all: [['age', '>=', 32], ['round', '>=', 20]] }, chance: 0.05, cooldown: 'season',
    title: ['은퇴 계획을 묻는 기자', '"언제까지 뛸 건가요?"', '은퇴 질문'],
    text: {
      praise: ['기자가 은퇴 계획을 묻자 "아직 보여 줄 게 많다"고 웃었어요. 팬들이 박수를 쳤어요.', '"은퇴요? 이 폼으로요?" 기자회견장이 웃음바다가 됐어요.', '"몸이 허락하는 한." 짧은 대답이 헤드라인이 됐어요.'],
      neutral: ['기자가 은퇴 계획을 물었어요. 시즌이 끝나면 생각해 보겠다고 했어요.', '"언제까지 뛸 건가요?" 질문이 처음으로 나왔어요.', '은퇴 이야기가 기사에 오르기 시작했어요. 비시즌에 결정할 수 있어요.'],
      critic: ['"이제 내려놓을 때"라는 칼럼이 실렸어요.', '기자들이 은퇴 시점을 묻기 시작했어요. 대답하기 쉽지 않아요.', '부진한 경기 뒤 은퇴 질문이 쏟아졌어요.'],
    },
  },
  {
    id: 's_mentor', tags: ['slot', 'mentor', 'team'], kind: 'choice', on: 'slot', cat: 'team', when: ['age', '>=', 30],
    title: ['유망주의 부탁', '멘토가 되어 줄래요?', '어린 동료의 질문'],
    text: [
      '1군에 막 올라온 유망주가 개인 훈련을 같이 해 달라고 부탁했어요.',
      '감독이 "어린 선수들을 좀 챙겨 달라"고 했어요.',
      '유스 출신 신인이 훈련이 끝나도 집에 가지 않고 내 뒤를 따라다녀요.',
    ],
    choices: [
      { id: 'mentor', label: '멘토가 된다', desc: '감독 신뢰도 +2, 팀 관계 +, 체력 조금 −', effects: [{ trust: 2 }, { life: 'team', add: 4 }, { fatigue: 3 }], result: ['슈팅 자세를 하나씩 알려 줬어요. 신인의 눈이 반짝였어요.', '"저도 저 나이 때 그랬어요." 같이 남아 훈련했어요.', '훈련이 끝나고 같이 밥을 먹었어요. 라커룸 분위기가 따뜻해요.'] },
      { id: 'no', label: '내 훈련에 집중한다', desc: '변화 없음', effects: [], result: ['정중히 사양했어요. 지금은 내 몸이 먼저예요.', '"다음 시즌에 보자." 신인이 고개를 끄덕였어요.', '코치에게 대신 부탁했어요.'] },
    ],
    fallback: 'no',
  },
];

export const EVENTS: readonly EventDef[] = [...MATCH_EVENTS, ...SLOT_EVENTS, ...DAY_EVENTS, ...SEASON_EVENTS, ...CHAIN_FOLLOWUPS, ...LIFE_EVENTS, ...MONEY_EVENTS, ...TWILIGHT_EVENTS];
