// 2018-19 프리미어리그 (C.75m 에서 src/league.ts 에서 옮김). 레이팅은 초기 추정치 (= 로스터 생성 목표). 팀 id 는 세이브 호환이라 바꾸지 않는다

import type { LeagueData } from './types';

export const PL: LeagueData = {
  id: 'pl',
  name: 'Premier League',
  nameKo: '프리미어리그',
  country: 'England',
  tier: 1,
  season: '2018-19',
  calendar: 'autumn-spring',
  teams: [
    { id: 'mci', name: 'Manchester City', nameKo: '맨체스터 시티', rating: 85 },
    { id: 'liv', name: 'Liverpool', nameKo: '리버풀', rating: 84 },
    { id: 'che', name: 'Chelsea', nameKo: '첼시', rating: 81 },
    { id: 'tot', name: 'Tottenham Hotspur', nameKo: '토트넘 홋스퍼', rating: 81 },
    { id: 'mun', name: 'Manchester United', nameKo: '맨체스터 유나이티드', rating: 80 },
    { id: 'ars', name: 'Arsenal', nameKo: '아스널', rating: 79 },
    { id: 'eve', name: 'Everton', nameKo: '에버턴', rating: 75 },
    { id: 'lei', name: 'Leicester City', nameKo: '레스터 시티', rating: 74 },
    { id: 'whu', name: 'West Ham United', nameKo: '웨스트햄 유나이티드', rating: 73 },
    { id: 'wol', name: 'Wolverhampton', nameKo: '울버햄튼', rating: 73 },
    { id: 'cry', name: 'Crystal Palace', nameKo: '크리스털 팰리스', rating: 72 },
    { id: 'wat', name: 'Watford', nameKo: '왓포드', rating: 71 },
    { id: 'bou', name: 'AFC Bournemouth', nameKo: '본머스', rating: 71 },
    { id: 'new', name: 'Newcastle United', nameKo: '뉴캐슬 유나이티드', rating: 71 },
    { id: 'sou', name: 'Southampton', nameKo: '사우샘프턴', rating: 71 },
    { id: 'bur', name: 'Burnley', nameKo: '번리', rating: 70 },
    { id: 'bha', name: 'Brighton & Hove Albion', nameKo: '브라이턴', rating: 70 },
    { id: 'ful', name: 'Fulham', nameKo: '풀럼', rating: 69 },
    { id: 'car', name: 'Cardiff City', nameKo: '카디프 시티', rating: 67 },
    { id: 'hud', name: 'Huddersfield Town', nameKo: '허더즈필드', rating: 67 },
  ],
};
