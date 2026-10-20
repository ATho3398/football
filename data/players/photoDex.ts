// 포토카드 도감 번호 (C.75t, pending 130): 게임 안 실제 선수 전원의 고정 번호. DEX_IDS[i] = No.(i + 1).
// 순서 = 현역(리그 → 구단 2018-19 최종 순위 → 포지션 GK·DF·MF·FW → 등번호) → 레전드(포지션 → 이름) → 미래 스타(포지션 → 이름).
// 선수가 늘면 `npm run dex:append` 로 **뒤에 이어 붙이기만** 한다 (기존 번호는 절대 바꾸지 않는다, tests/photocards.test.ts).
// 이 파일은 손으로 고치지 않는다 (DEX_IDS·DEX_LOCKS 는 스크립트가 쓴다. 순위 표는 손으로 더해도 된다)

/** 리그 순서 (이름 또는 리그 id, 소문자 비교). 표에 없는 리그는 맨 뒤 (이름순) */
export const DEX_LEAGUES: readonly (readonly string[])[] = [
  ['pl', 'premier league'],
  ['championship', 'efl championship'],
  ['laliga', 'la liga'],
  ['seriea', 'serie a'],
  ['bundesliga'],
  ['ligue1', 'ligue 1'],
];

/** 2018-19 최종 순위 (리그별, 구단 이름 또는 팀 id 여러 표기, 소문자 비교). 표에 없는 구단은 그 리그 맨 뒤 (이름순) */
export const DEX_CLUB_RANK: readonly (readonly string[])[] = [
  // Premier League
  ['manchester city', 'mci'], ['liverpool', 'liv'], ['chelsea', 'che'], ['tottenham hotspur', 'tottenham', 'tot'], ['arsenal', 'ars'],
  ['manchester united', 'mun'], ['wolverhampton', 'wolverhampton wanderers', 'wol'], ['everton', 'eve'], ['leicester city', 'lei'],
  ['west ham united', 'whu'], ['watford', 'wat'], ['crystal palace', 'cry'], ['newcastle united', 'new'], ['afc bournemouth', 'bournemouth', 'bou'],
  ['burnley', 'bur'], ['southampton', 'sou'], ['brighton & hove albion', 'brighton', 'bha'], ['cardiff city', 'car'], ['fulham', 'ful'],
  ['huddersfield town', 'hud'],
  // Championship
  ['norwich city', 'norwich'], ['sheffield united'], ['leeds united', 'leeds'], ['west bromwich albion', 'west brom'], ['aston villa'],
  ['derby county'], ['middlesbrough'], ['bristol city'], ['nottingham forest'], ['swansea city'], ['brentford'], ['sheffield wednesday'],
  ['hull city'], ['preston north end'], ['blackburn rovers'], ['stoke city'], ['birmingham city'], ['wigan athletic'],
  ['queens park rangers', 'qpr'], ['reading'], ['millwall'], ['rotherham united'], ['bolton wanderers'], ['ipswich town'],
  // La Liga
  ['fc barcelona', 'barcelona'], ['atlético madrid', 'atletico madrid'], ['real madrid'], ['valencia'], ['getafe'], ['sevilla'],
  ['espanyol'], ['athletic bilbao', 'athletic club'], ['real sociedad'], ['real betis'], ['alavés', 'alaves'], ['eibar'], ['leganés', 'leganes'],
  ['villarreal'], ['levante'], ['real valladolid'], ['celta vigo'], ['girona'], ['huesca'], ['rayo vallecano'],
  // Serie A
  ['juventus'], ['napoli'], ['atalanta'], ['inter milan', 'inter'], ['ac milan', 'milan'], ['as roma', 'roma'], ['torino'], ['lazio'],
  ['sampdoria'], ['bologna'], ['sassuolo'], ['udinese'], ['spal'], ['parma'], ['cagliari'], ['fiorentina'], ['genoa'], ['empoli'],
  ['frosinone'], ['chievo verona', 'chievo'],
  // Bundesliga
  ['bayern munich', 'bayern münchen', 'fc bayern'], ['borussia dortmund', 'dortmund'], ['rb leipzig'], ['bayer leverkusen'],
  ['borussia mönchengladbach', 'borussia monchengladbach'], ['vfl wolfsburg', 'wolfsburg'], ['eintracht frankfurt'], ['werder bremen'],
  ['tsg hoffenheim', 'hoffenheim'], ['fortuna düsseldorf', 'fortuna dusseldorf'], ['hertha bsc', 'hertha berlin'], ['mainz 05', 'mainz'],
  ['sc freiburg', 'freiburg'], ['schalke 04', 'schalke'], ['fc augsburg', 'augsburg'], ['vfb stuttgart', 'stuttgart'], ['hannover 96', 'hannover'],
  ['1. fc nürnberg', 'nürnberg', 'nurnberg'],
  // Ligue 1
  ['paris saint-germain', 'psg'], ['lille'], ['lyon', 'olympique lyonnais'], ['saint-étienne', 'saint-etienne'], ['marseille', 'olympique de marseille'],
  ['montpellier'], ['nice'], ['reims'], ['nîmes', 'nimes'], ['rennes'], ['strasbourg'], ['nantes'], ['angers'], ['bordeaux'], ['amiens'],
  ['toulouse'], ['monaco', 'as monaco'], ['dijon'], ['caen'], ['guingamp'],
];

/** 도감 번호 순서 (스크립트가 쓴다). 번호 = 자리 + 1 */
export const DEX_IDS: readonly string[] = [
  'de-bruyne', // 1
  'foden', // 2
  'sterling', // 3
  'aguero', // 4
  'sane', // 5
  'van-dijk', // 6
  'alexander-arnold', // 7
  'firmino', // 8
  'mane', // 9
  'salah', // 10
  'kante', // 11
  'hazard', // 12
  'eriksen', // 13
  'son', // 14
  'kane', // 15
  'aubameyang', // 16
  'pogba', // 17
  'rashford', // 18
  'busquets', // 19
  'suarez', // 20
  'messi', // 21
  'griezmann', // 22
  'ramos', // 23
  'kroos', // 24
  'modric', // 25
  'vinicius', // 26
  'ronaldo', // 27
  'dybala', // 28
  'kimmich', // 29
  'lewandowski', // 30
  'sancho', // 31
  'havertz', // 32
  'mbappe', // 33
  'neymar', // 34
  'lg-banks', // 35
  'lg-seaman', // 36
  'lg-zoff', // 37
  'lg-dida', // 38
  'lg-yashin', // 39
  'lg-weidenfeller', // 40
  'lg-valdes', // 41
  'lg-klos', // 42
  'lg-vandersar', // 43
  'lg-lehmann', // 44
  'lg-kahn', // 45
  'lg-leewoonjae', // 46
  'lg-casillas', // 47
  'lg-buffon', // 48
  'lg-juliocesar', // 49
  'lg-taffarel', // 50
  'lg-cech', // 51
  'lg-schmeichel', // 52
  'lg-campos', // 53
  'lg-gneville', // 54
  'lg-vidic', // 55
  'lg-subotic', // 56
  'lg-dede', // 57
  'lg-marquez', // 58
  'lg-bonucci', // 59
  'lg-blanc', // 60
  'lg-lucio', // 61
  'lg-ferdinand', // 62
  'lg-thuram', // 63
  'lg-desailly', // 64
  'lg-schmelzer', // 65
  'lg-marcelo', // 66
  'lg-hummels', // 67
  'lg-sammer', // 68
  'lg-moore', // 69
  'lg-kompany', // 70
  'lg-campbell', // 71
  'lg-nesta', // 72
  'lg-acole', // 73
  'lg-stam', // 74
  'lg-piszczek', // 75
  'lg-jkohler', // 76
  'lg-leeyoungpyo', // 77
  'lg-zambrotta', // 78
  'lg-carragher', // 79
  'lg-chiellini', // 80
  'lg-terry', // 81
  'lg-puyol', // 82
  'lg-cafu', // 83
  'lg-adams', // 84
  'lg-cannavaro', // 85
  'lg-maldini', // 86
  'lg-breitner', // 87
  'lg-evra', // 88
  'lg-hierro', // 89
  'lg-pepe', // 90
  'lg-santana', // 91
  'lg-beckenbauer', // 92
  'lg-baresi', // 93
  'lg-lahm', // 94
  'lg-zanetti', // 95
  'lg-pique', // 96
  'lg-rcarlos', // 97
  'lg-hongmyungbo', // 98
  'lg-rcarvalho', // 99
  'lg-hagi', // 100
  'lg-guti', // 101
  'lg-nakata', // 102
  'lg-sahin', // 103
  'lg-derossi', // 104
  'lg-dsilva', // 105
  'lg-beckham', // 106
  'lg-deco', // 107
  'lg-dunga', // 108
  'lg-deschamps', // 109
  'lg-maradona', // 110
  'lg-ricken', // 111
  'lg-pires', // 112
  'lg-baggio', // 113
  'lg-keane', // 114
  'lg-matthaus', // 115
  'lg-gullit', // 116
  'lg-carrick', // 117
  'lg-ozil', // 118
  'lg-platini', // 119
  'lg-laudrup', // 120
  'lg-ballack', // 121
  'lg-zorc', // 122
  'lg-schweinsteiger', // 123
  'lg-park', // 124
  'lg-sneijder', // 125
  'lg-alonso', // 126
  'lg-xavi', // 127
  'lg-fabregas', // 128
  'lg-sbender', // 129
  'lg-gerrard', // 130
  'lg-iniesta', // 131
  'lg-pirlo', // 132
  'lg-yaya', // 133
  'lg-davids', // 134
  'lg-petit', // 135
  'lg-hargreaves', // 136
  'lg-zola', // 137
  'lg-kehl', // 138
  'lg-gattuso', // 139
  'lg-zidane', // 140
  'lg-zico', // 141
  'lg-gilberto', // 142
  'lg-valderrama', // 143
  'lg-kaka', // 144
  'lg-seedorf', // 145
  'lg-marchisio', // 146
  'lg-makelele', // 147
  'lg-rosicky', // 148
  'lg-nedved', // 149
  'lg-vieira', // 150
  'lg-scholes', // 151
  'lg-rijkaard', // 152
  'lg-lampard', // 153
  'lg-ljungberg', // 154
  'lg-mascherano', // 155
  'lg-ronaldinho', // 156
  'lg-riquelme', // 157
  'lg-veron', // 158
  'lg-ruicosta', // 159
  'lg-rivaldo', // 160
  'lg-garrincha', // 161
  'lg-batistuta', // 162
  'lg-bale', // 163
  'lg-gmuller', // 164
  'lg-lineker', // 165
  'lg-suker', // 166
  'lg-villa', // 167
  'lg-ginola', // 168
  'lg-trezeguet', // 169
  'lg-bergkamp', // 170
  'lg-drogba', // 171
  'lg-berbatov', // 172
  'lg-forlan', // 173
  'lg-raul', // 174
  'lg-giggs', // 175
  'lg-fowler', // 176
  'lg-vanpersie', // 177
  'lg-vannistelrooy', // 178
  'lg-figo', // 179
  'lg-barrios', // 180
  'lg-vanbasten', // 181
  'lg-overmars', // 182
  'lg-owen', // 183
  'lg-klose', // 184
  'lg-bcharlton', // 185
  'lg-etoo', // 186
  'lg-matthews', // 187
  'lg-chapuisat', // 188
  'lg-robben', // 189
  'lg-shevchenko', // 190
  'lg-ahnjunghwan', // 191
  'lg-delpiero', // 192
  'lg-distefano', // 193
  'lg-andycole', // 194
  'lg-shearer', // 195
  'lg-kuba', // 196
  'lg-jkoller', // 197
  'lg-crespo', // 198
  'lg-cantona', // 199
  'lg-eusebio', // 200
  'lg-bierhoff', // 201
  'lg-cruyff', // 202
  'lg-rooney', // 203
  'lg-klinsmann', // 204
  'lg-iwright', // 205
  'lg-rush', // 206
  'lg-best', // 207
  'lg-weah', // 208
  'lg-zlatan', // 209
  'lg-chabumkun', // 210
  'lg-rummenigge', // 211
  'lg-vieri', // 212
  'lg-henry', // 213
  'lg-kluivert', // 214
  'lg-puskas', // 215
  'lg-torres', // 216
  'lg-pele', // 217
  'lg-totti', // 218
  'lg-ribery', // 219
  'lg-crouch', // 220
  'lg-inzaghi', // 221
  'lg-larsson', // 222
  'lg-ronaldo9', // 223
  'lg-romario', // 224
  'lg-stoichkov', // 225
  'fs-cubarsi', // 226
  'fs-gavi', // 227
  'fs-camavinga', // 228
  'fs-zaireemery', // 229
  'fs-musiala', // 230
  'fs-bellingham', // 231
  'fs-mainoo', // 232
  'fs-pedri', // 233
  'fs-wirtz', // 234
  'fs-yamal', // 235
  'fs-garnacho', // 236
  'fs-endrick', // 237
  'fs-haaland', // 238
];

/** 고정 확인 [개수, 앞부분 해시]: 판마다 하나씩 이어 붙인다. 테스트가 지금 DEX_IDS 앞부분이 그대로인지 본다 */
export const DEX_LOCKS: readonly (readonly [number, string])[] = [
  [238, '5cf01d5b'],
];
