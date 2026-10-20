// 리그 데이터 공통 형식 (부록 C.75m, 45a). 리그마다 data/leagues/<id>.ts 한 파일, 실제 선수는 data/players/<id>.ts (stars.ts Row 형식, 45b 에서 연결).
// 필드는 뒤에 추가만 한다 (데이터 세션 6개가 같은 형식으로 만든다)

export interface LeagueTeamData { id: string; name: string; nameKo: string; rating: number; city?: string; colors?: { primary: string; secondary: string }; manager?: string; managerKo?: string; stadium?: string; stadiumKo?: string; }
export interface LeagueData { id: string; name: string; nameKo: string; country: string; tier: 1 | 2; season: string; calendar: 'autumn-spring' | 'spring-autumn'; teams: LeagueTeamData[]; derbies?: [string, string, string?][];
  /** 라운드로빈 횟수 (없으면 12팀 이하 3번 = K리그 33라운드, 그 밖 2번 = 홈·원정) */
  roundRobins?: 2 | 3;
}
