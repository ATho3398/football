// 리그 구단 위키백과(영어) 문서 제목 (C.77u). 게임 속 이름과 문서 제목이 갈리는 팀만 넣는다.
// 리다이렉트 제목이어도 된다(요약 API 가 따라간다). 잘못 잡히면 여기 제목을 고치고 그 파일을 지운 뒤 다시 돌린다.
export const LEAGUE_CLUB_OVERRIDES: Record<string, string[]> = {
  // 라리가
  'laliga:bar': ['FC Barcelona'], 'laliga:atm': ['Atlético Madrid'], 'laliga:rma': ['Real Madrid CF'], 'laliga:val': ['Valencia CF'],
  'laliga:get': ['Getafe CF'], 'laliga:sev': ['Sevilla FC'], 'laliga:esp': ['RCD Espanyol'], 'laliga:ath': ['Athletic Bilbao'],
  'laliga:rso': ['Real Sociedad'], 'laliga:bet': ['Real Betis'], 'laliga:ala': ['Deportivo Alavés'], 'laliga:eib': ['SD Eibar'],
  'laliga:leg': ['CD Leganés'], 'laliga:vil': ['Villarreal CF'], 'laliga:lev': ['Levante UD'], 'laliga:vll': ['Real Valladolid'],
  'laliga:cel': ['RC Celta de Vigo'], 'laliga:gir': ['Girona FC'], 'laliga:hue': ['SD Huesca'], 'laliga:ray': ['Rayo Vallecano'],
  // 세리에 A
  'seriea:juv': ['Juventus FC'], 'seriea:nap': ['SSC Napoli'], 'seriea:ata': ['Atalanta BC'], 'seriea:int': ['Inter Milan'],
  'seriea:mil': ['AC Milan'], 'seriea:rom': ['AS Roma'], 'seriea:tor': ['Torino FC'], 'seriea:laz': ['SS Lazio'],
  'seriea:sam': ['UC Sampdoria'], 'seriea:bol': ['Bologna FC 1909'], 'seriea:sas': ['US Sassuolo Calcio'], 'seriea:udi': ['Udinese Calcio'],
  'seriea:spa': ['SPAL (football club)', 'SPAL 2013'], 'seriea:par': ['Parma Calcio 1913'], 'seriea:cag': ['Cagliari Calcio'],
  'seriea:fio': ['ACF Fiorentina'], 'seriea:gen': ['Genoa CFC'], 'seriea:emp': ['Empoli FC'], 'seriea:fro': ['Frosinone Calcio'],
  'seriea:chi': ['AC ChievoVerona', 'A.C. ChievoVerona'],
  // 프리메이라
  'primeira:fcp': ['FC Porto'], 'primeira:slb': ['S.L. Benfica'], 'primeira:scp': ['Sporting CP'], 'primeira:bra': ['S.C. Braga'],
  'primeira:vsc': ['Vitória S.C.'], 'primeira:rav': ['Rio Ave F.C.'], 'primeira:mor': ['Moreirense F.C.'], 'primeira:boa': ['Boavista F.C.'],
  'primeira:mar': ['C.S. Marítimo'], 'primeira:scl': ['C.D. Santa Clara'], 'primeira:bel': ['B-SAD', 'Belenenses SAD'],
  'primeira:por': ['Portimonense S.C.'], 'primeira:vfc': ['Vitória F.C.'], 'primeira:ton': ['C.D. Tondela'], 'primeira:ave': ['C.D. Aves'],
  'primeira:fei': ['C.D. Feirense'], 'primeira:nac': ['C.D. Nacional'], 'primeira:cha': ['G.D. Chaves'],
  // K리그1
  'kleague1:jbh': ['Jeonbuk Hyundai Motors'], 'kleague1:ulh': ['Ulsan HD FC', 'Ulsan Hyundai FC'], 'kleague1:ssb': ['Suwon Samsung Bluewings'],
  'kleague1:gnm': ['Gyeongnam FC'], 'kleague1:poh': ['Pohang Steelers'], 'kleague1:jej': ['Jeju SK FC', 'Jeju United FC'],
  'kleague1:fcs': ['FC Seoul'], 'kleague1:dgu': ['Daegu FC'], 'kleague1:gwn': ['Gangwon FC'], 'kleague1:icn': ['Incheon United FC'],
  'kleague1:ssm': ['Sangju Sangmu FC', 'Gimcheon Sangmu FC'], 'kleague1:jnd': ['Jeonnam Dragons'],
  // J1리그
  'jleague1:kaw': ['Kawasaki Frontale'], 'jleague1:kas': ['Kashima Antlers'], 'jleague1:ura': ['Urawa Red Diamonds'],
  'jleague1:cer': ['Cerezo Osaka'], 'jleague1:fct': ['FC Tokyo'], 'jleague1:gam': ['Gamba Osaka'], 'jleague1:vis': ['Vissel Kobe'],
  'jleague1:yfm': ['Yokohama F. Marinos'], 'jleague1:kar': ['Kashiwa Reysol'], 'jleague1:hir': ['Sanfrecce Hiroshima'],
  'jleague1:sap': ['Hokkaido Consadole Sapporo'], 'jleague1:sim': ['Shimizu S-Pulse'], 'jleague1:sen': ['Vegalta Sendai'],
  'jleague1:nag': ['Nagoya Grampus'], 'jleague1:jub': ['Júbilo Iwata'], 'jleague1:tos': ['Sagan Tosu'], 'jleague1:sho': ['Shonan Bellmare'],
  'jleague1:vvn': ['V-Varen Nagasaki'],
  // 브라질레이랑
  'brasileirao:pal': ['Sociedade Esportiva Palmeiras'], 'brasileirao:fla': ['CR Flamengo', 'Clube de Regatas do Flamengo'],
  'brasileirao:gre': ['Grêmio Foot-Ball Porto Alegrense'], 'brasileirao:cru': ['Cruzeiro Esporte Clube'],
  'brasileirao:cor': ['Sport Club Corinthians Paulista'], 'brasileirao:int': ['Sport Club Internacional'], 'brasileirao:sao': ['São Paulo FC'],
  'brasileirao:cam': ['Clube Atlético Mineiro'], 'brasileirao:san': ['Santos FC'], 'brasileirao:cap': ['Club Athletico Paranaense'],
  'brasileirao:flu': ['Fluminense FC'], 'brasileirao:bot': ['Botafogo de Futebol e Regatas'], 'brasileirao:vas': ['CR Vasco da Gama'],
  'brasileirao:bah': ['Esporte Clube Bahia'], 'brasileirao:spo': ['Sport Club do Recife'], 'brasileirao:cha': ['Associação Chapecoense de Futebol'],
  'brasileirao:vit': ['Esporte Clube Vitória'], 'brasileirao:cea': ['Ceará Sporting Club'], 'brasileirao:ame': ['América Futebol Clube (MG)'],
  'brasileirao:par': ['Paraná Clube'],
  // 분데스리가
  'bundesliga:bay': ['FC Bayern Munich'], 'bundesliga:bvb': ['Borussia Dortmund'], 'bundesliga:rbl': ['RB Leipzig'],
  'bundesliga:b04': ['Bayer 04 Leverkusen'], 'bundesliga:bmg': ['Borussia Mönchengladbach'], 'bundesliga:s04': ['FC Schalke 04'],
  'bundesliga:tsg': ['TSG 1899 Hoffenheim'], 'bundesliga:sge': ['Eintracht Frankfurt'], 'bundesliga:wob': ['VfL Wolfsburg'],
  'bundesliga:svw': ['SV Werder Bremen'], 'bundesliga:bsc': ['Hertha BSC'], 'bundesliga:m05': ['1. FSV Mainz 05'],
  'bundesliga:scf': ['SC Freiburg'], 'bundesliga:vfb': ['VfB Stuttgart'], 'bundesliga:fca': ['FC Augsburg'],
  'bundesliga:f95': ['Fortuna Düsseldorf'], 'bundesliga:h96': ['Hannover 96'], 'bundesliga:fcn': ['1. FC Nürnberg'],
  // 2. 분데스리가
  'bundesliga2:koe': ['1. FC Köln'], 'bundesliga2:hsv': ['Hamburger SV'], 'bundesliga2:fcu': ['1. FC Union Berlin'],
  'bundesliga2:boc': ['VfL Bochum'], 'bundesliga2:fch': ['1. FC Heidenheim'], 'bundesliga2:ksv': ['Holstein Kiel'],
  'bundesliga2:stp': ['FC St. Pauli'], 'bundesliga2:scp': ['SC Paderborn 07'], 'bundesliga2:dsc': ['Arminia Bielefeld'],
  'bundesliga2:fci': ['FC Ingolstadt 04'], 'bundesliga2:ssv': ['SSV Jahn Regensburg'], 'bundesliga2:sgd': ['Dynamo Dresden'],
  'bundesliga2:d98': ['SV Darmstadt 98'], 'bundesliga2:sgf': ['SpVgg Greuther Fürth'], 'bundesliga2:aue': ['FC Erzgebirge Aue'],
  'bundesliga2:svs': ['SV Sandhausen'], 'bundesliga2:msv': ['MSV Duisburg'], 'bundesliga2:fcm': ['1. FC Magdeburg'],
  // 챔피언십 (대부분 "<이름> F.C." 로 찾는다)
  'championship:avl': ['Aston Villa F.C.'], 'championship:qpr': ['Queens Park Rangers F.C.'],
  // 에레디비시
  'eredivisie:ajx': ['AFC Ajax'], 'eredivisie:psv': ['PSV Eindhoven'], 'eredivisie:fey': ['Feyenoord'], 'eredivisie:alk': ['AZ Alkmaar'],
  'eredivisie:vit': ['SBV Vitesse'], 'eredivisie:utr': ['FC Utrecht'], 'eredivisie:her': ['Heracles Almelo'], 'eredivisie:gro': ['FC Groningen'],
  'eredivisie:hee': ['SC Heerenveen'], 'eredivisie:ado': ['ADO Den Haag'], 'eredivisie:wil': ['Willem II (football club)'],
  'eredivisie:pec': ['PEC Zwolle'], 'eredivisie:vvv': ['VVV-Venlo'], 'eredivisie:for': ['Fortuna Sittard'],
  'eredivisie:exc': ['Excelsior Rotterdam', 'SBV Excelsior'], 'eredivisie:nac': ['NAC Breda'], 'eredivisie:emm': ['FC Emmen'],
  'eredivisie:gra': ['De Graafschap'],
  // 리그 1
  'ligue1:psg': ['Paris Saint-Germain F.C.'], 'ligue1:lyo': ['Olympique Lyonnais'], 'ligue1:mar': ['Olympique de Marseille'],
  'ligue1:asm': ['AS Monaco FC'], 'ligue1:lil': ['Lille OSC'], 'ligue1:ase': ['AS Saint-Étienne'], 'ligue1:ren': ['Stade Rennais F.C.'],
  'ligue1:nic': ['OGC Nice'], 'ligue1:bor': ['FC Girondins de Bordeaux'], 'ligue1:mtp': ['Montpellier HSC'], 'ligue1:nan': ['FC Nantes'],
  'ligue1:str': ['RC Strasbourg Alsace'], 'ligue1:tou': ['Toulouse FC'], 'ligue1:ang': ['Angers SCO'], 'ligue1:rei': ['Stade de Reims'],
  'ligue1:nim': ['Nîmes Olympique'], 'ligue1:cae': ['Stade Malherbe Caen'], 'ligue1:dij': ['Dijon FCO'], 'ligue1:ami': ['Amiens SC'],
  'ligue1:gui': ['En Avant Guingamp'],
  // MLS
  'mls:atl': ['Atlanta United FC'], 'mls:nyr': ['New York Red Bulls'], 'mls:nyc': ['New York City FC'], 'mls:clb': ['Columbus Crew'],
  'mls:dcu': ['D.C. United'], 'mls:phi': ['Philadelphia Union'], 'mls:tor': ['Toronto FC'], 'mls:mtl': ['CF Montréal'],
  'mls:ner': ['New England Revolution'], 'mls:chi': ['Chicago Fire FC'], 'mls:orl': ['Orlando City SC'], 'mls:skc': ['Sporting Kansas City'],
  'mls:sea': ['Seattle Sounders FC'], 'mls:lfc': ['Los Angeles FC'], 'mls:dal': ['FC Dallas'], 'mls:por': ['Portland Timbers'],
  'mls:rsl': ['Real Salt Lake'], 'mls:lag': ['LA Galaxy'], 'mls:van': ['Vancouver Whitecaps FC'], 'mls:hou': ['Houston Dynamo FC'],
  'mls:min': ['Minnesota United FC'], 'mls:col': ['Colorado Rapids'], 'mls:sje': ['San Jose Earthquakes'],
  // 사우디
  'saudi:hil': ['Al Hilal SFC'], 'saudi:nas': ['Al Nassr FC'], 'saudi:ahl': ['Al-Ahli Saudi FC'], 'saudi:itt': ['Al-Ittihad Club (Jeddah)', 'Al-Ittihad Club'],
  'saudi:taa': ['Al-Taawoun FC'], 'saudi:sha': ['Al Shabab FC (Riyadh)'], 'saudi:weh': ['Al-Wehda Club (Mecca)'], 'saudi:fai': ['Al-Faisaly FC'],
  'saudi:fat': ['Al-Fateh SC'], 'saudi:ett': ['Al-Ettifaq FC'], 'saudi:fay': ['Al-Fayha FC'], 'saudi:rae': ['Al-Raed FC'],
  'saudi:haz': ['Al-Hazem F.C.'], 'saudi:qad': ['Al-Qadsiah FC'], 'saudi:bat': ['Al-Batin FC'], 'saudi:ohd': ['Ohod Club'],
};
