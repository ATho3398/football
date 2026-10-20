import type * as React from 'react';

export type Tier = 'normal' | 'key' | 'top' | 'world' | 'legend';
export type CardType = 'play' | 'setpiece' | 'passive' | 'combo' | 'manage' | 'signature' | 'order';
export type CardPos = 'all' | 'att' | 'mid' | 'def';
export type Rarity = 'common' | 'rare' | 'epic' | 'legend';
export type IconName = 'ball' | 'save' | 'card' | 'sub' | 'injury' | 'danger' | 'chance' | 'dot' | 'clock' | 'bell' | 'disk' | 'home' | 'match' | 'player' | 'career' | 'world' | 'lock' | 'plus' | 'minus' | 'check' | 'close' | 'chevron-right' | 'chevron-down' | 'play' | 'pause' | 'skip' | 'risk' | 'arrow-up' | 'arrow-down' | 'arrow-flat' | 'double-up' | 'double-down' | CardType | 'star' | 'levelup' | 'info' | 'filter' | 'restore' | 'search' | 'pos-all' | 'pos-att' | 'pos-mid' | 'defense' | 'throwin' | 'goalkick' | 'tactic' | 'order' | 'solo' | 't-balanced' | 't-tikitaka' | 't-gegen' | 't-counter' | 't-direct' | 't-block' | 'newchoice' | 'signature' | 'ff' | 'auto' | 'manual' | 'settings' | 'calendar' | 'train' | 'video' | 'rest' | 'recover' | 'target' | 'download' | 'upload' | 'plane' | 'replay' | 'stop' | 'menu' | 'deck' | 'chat' | 'trophy' | 'swap' | 'edit' | 'eye' | 'grid' | 'face' | 'sliders' | 'pin' | 'collapse' | 'inbox' | 'coin' | 'running' | 'sun' | 'cloud' | 'rain' | 'snow' | 'wind' | 'fog' | 'whistle' | 'album';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; block?: boolean; icon?: IconName; iconRight?: IconName }
export declare function Button(props: ButtonProps): React.ReactElement;

export interface IconProps { name: IconName; size?: number; strokeWidth?: number; filled?: boolean; label?: string; className?: string; style?: React.CSSProperties }
export declare function Icon(props: IconProps): React.ReactElement;

export interface AvatarProps { src?: string; name?: string; size?: number; shape?: 'circle' | 'square'; ring?: boolean }
export declare function Avatar(props: AvatarProps): React.ReactElement;

export interface CrestProps { name: string; src?: string; size?: number; color?: string }
export declare function Crest(props: CrestProps): React.ReactElement;

export interface TierBadgeProps { tier: Tier; score?: number; size?: 'sm' | 'md' }
export declare function TierBadge(props: TierBadgeProps): React.ReactElement;

export interface RatingBadgeProps { value: number; delta?: number; size?: 'sm' | 'md' | 'lg' }
export declare function RatingBadge(props: RatingBadgeProps): React.ReactElement;

export interface StatChipProps { label?: string; value?: React.ReactNode; icon?: IconName; tone?: 'neutral' | 'brand' | 'mine' | 'success' | 'fail' | 'warning' }
export declare function StatChip(props: StatChipProps): React.ReactElement;

export interface MeterProps { value: number; max?: number; gain?: number; label?: string; showValue?: boolean; tone?: 'brand' | 'xp' | 'mine' | 'warning'; size?: 'md' | 'lg' }
export declare function Meter(props: MeterProps): React.ReactElement;

export interface FatigueGaugeProps { value: number; compact?: boolean }
export declare function FatigueGauge(props: FatigueGaugeProps): React.ReactElement;

export interface FormIndicatorProps { level: 1 | 2 | 3 | 4 | 5; showLabel?: boolean; size?: number }
export declare function FormIndicator(props: FormIndicatorProps): React.ReactElement;

export interface StatBarProps { label: string; value: number; max?: number; add?: number; editable?: boolean; cost?: number; ovrDelta?: number; maxed?: boolean; locked?: boolean; highlight?: boolean; onPlus?: () => void; onMinus?: () => void }
export declare function StatBar(props: StatBarProps): React.ReactElement;

export interface Player { name: string; age: number; position: string; ovr: number; tier: Tier; tierScore?: number; level: number; xp?: number; xpMax?: number; team: string; avatar?: string; crest?: string }
export interface PlayerCardProps { player: Player; variant?: 'full' | 'compact' }
export declare function PlayerCard(props: PlayerCardProps): React.ReactElement;

export interface CardEffect { pre: string; hi?: string; post?: string }
export interface CardCondition { text: string; met: boolean; current?: number | string }
/** 카드 그림 위치·확대. x = 오른쪽으로 이동(%, 음수면 왼쪽), y = 위로 올림(%, 음수면 내림), 둘 다 4:3 그림 칸(280×210) 기준. zoom = 확대 배율 1~4(기본 1). flip = 좌우 반전. rotate = 기울기(도, −45~45, 시계 방향 +). */
export interface CardArtPos { x?: number; y?: number; zoom?: number; flip?: boolean; rotate?: number }
export interface Card {/** 그림이 없을 때: 'type'(기본, 요청 6 — 단색 + 종류 아이콘) · 'scene'(예전 골문 장면) */ placeholder?: 'type' | 'scene'; pos?: CardPos; order?: 'follow' | 'solo'; id?: string; name: string; type: CardType; rarity: Rarity; level?: number; effect?: CardEffect | string; effectValue?: string; condition?: CardCondition; art?: string; /** true면 그림이 1:1 원본 — 가로를 칸에 맞추고 세로는 칸 밖으로 넘치며, y로 위아래를 옮겨 고른다 */ artSquare?: boolean; artPos?: CardArtPos; /** 간략 카드(덱 슬롯 mini · 경기 중 패 hand) 공용. 없으면 artPos */ artPosMini?: CardArtPos; isNew?: boolean; count?: number; disabled?: boolean }
/** full 280×392 · deck 168×235 (both with screentone art fade) · mini (deck slot, 116px tall) · hand 76×108 (both simplified, no screentone) */
export interface GameCardProps { card: Card; size?: 'full' | 'deck' | 'mini' | 'hand'; state?: 'normal' | 'selected' | 'disabled' | 'locked'; reason?: string; onClick?: () => void }
export declare function GameCard(props: GameCardProps): React.ReactElement;

export interface DeckSlotProps { card?: Card | null; onClick?: () => void }
export declare function DeckSlot(props: DeckSlotProps): React.ReactElement;

export interface CardHandProps { cards: Card[]; selectedId?: string; onSelect?: (id: string) => void }
export declare function CardHand(props: CardHandProps): React.ReactElement;

/** compact = 한 줄 머리말(탭마다 반복되는 화면). value가 글자(숫자·단위가 아님)면 '글자 머리말': 48px 한 줄(compact는 22px), 6자 이내, 넘치면 말줄임. */
export interface HeroPanelProps { /** B 테마 · 미페 머리말: 배경 투명 미페 이미지(색 처리 없음) */ face?: string; /** face가 배경 있는 사진이면 true — 같은 자리에 네모 사진 그대로(폰 홈 230 · 선수 128, PC 1024+ 홈 270 · 선수 176 = CSS 변수 --hero-photo). 긴 name은 글자 크기를 50→24px(compact 36→24px)까지 자동으로 줄여요. */ photo?: boolean; /** 등번호(두 자리면 작게) */ kit?: number | string; /** face일 때 큰 이름 */ name?: string; /** face일 때 숫자 아래 작은 단위(예: OVR · LW) */ unit?: string; title: string; right?: React.ReactNode; onBack?: (() => void) | false; eyebrow?: string; value?: number | string; total?: number; pad?: boolean; progress?: boolean; compact?: boolean; chips?: Array<string | { label: string; soft?: boolean }>; children?: React.ReactNode }
export declare function HeroPanel(props: HeroPanelProps): React.ReactElement;

export interface SectionTitleProps { title: string; action?: React.ReactNode; as?: 'h2' | 'h3' }
export declare function SectionTitle(props: SectionTitleProps): React.ReactElement;

export interface Outcome { text: string; rating: number }
/** collapsed = 결정 순간 v3 접은 한 줄(태그 · 이름 · 확률). 고른 것만 성공·실패 줄 펼침. certain = 판정 없는 선택지: 확률 자리에 작은 '확정' 칩, 실패 줄 없음. */
export interface ChoiceButtonProps { collapsed?: boolean; certain?: boolean; compact?: boolean; kind?: 'safe' | 'balanced' | 'gamble' | 'play'; card?: string; rarity?: Rarity; deltaSource?: string; offside?: 'low' | 'mid' | 'high'; name: string; chance: number; chanceDelta?: number; success: Outcome; fail: Outcome; risk?: string; selected?: boolean; disabled?: boolean; onClick?: () => void }
export declare function ChoiceButton(props: ChoiceButtonProps): React.ReactElement;

export interface FeedItemProps { minute?: number; text?: React.ReactNode; children?: React.ReactNode; kind?: 'normal' | 'goal' | 'concede' | 'danger' | 'chance' | 'shot' | 'save' | 'corner' | 'freekick' | 'penalty' | 'foul' | 'offside' | 'advantage' | 'yellow' | 'red' | 'sub' | 'injury' | 'half' | 'throwin' | 'goalkick' | 'tactic'; faint?: boolean; mine?: boolean; score?: string }
export declare function FeedItem(props: FeedItemProps): React.ReactElement;

export interface ScoreBarProps { mode?: 'manual' | 'auto'; onMode?: (m: 'manual' | 'auto') => void; ff?: boolean; homeTactic?: { tactic: TacticStyle; formation?: string }; awayTactic?: { tactic: TacticStyle; formation?: string }; homeRed?: number; awayRed?: number; homePlayers?: number; awayPlayers?: number; home: string; away: string; homeScore: number; awayScore: number; minute: number; speed?: '1×' | '2×' | '4×' | false; speeds?: string[]; paused?: boolean; status?: string; onSpeed?: (s: string) => void; onPause?: () => void; onSkip?: () => void;
  /** 상단 띠. highlight = "하이라이트 · 장면 n/7 · 분' 라벨" + [여기서부터 실시간], live = "실시간 · 분'" + [하이라이트로 돌아가기], halftime = "하프타임"만, transition = 장면 사이 전환(배속·실시간 비활성). 띠 오른쪽 끝은 항상 설정 톱니. */
  view?: 'highlight' | 'live' | 'halftime' | 'transition'; scene?: { index: number; total?: number; minute?: number; label?: string }; sceneNote?: string; sceneNoteIcon?: IconName; minuteTo?: number; settings?: boolean; settingsOn?: boolean; onSettings?: () => void; onLive?: () => void; onHighlight?: () => void }
export declare function ScoreBar(props: ScoreBarProps): React.ReactElement;
/** ScoreBar 맨 위 띠만 따로(하프타임·전환 스케치처럼 점수판이 없는 경기 화면용). */
export type SceneStripProps = Pick<ScoreBarProps, 'view' | 'scene' | 'sceneNote' | 'sceneNoteIcon' | 'minute' | 'onSettings' | 'onLive' | 'onHighlight'>;
export declare function SceneStrip(props: SceneStripProps): React.ReactElement;

export interface PixelKit { kit?: string; kit2?: string; pattern?: 'solid' | 'stripe' | 'hoop'; skin?: string; hair?: string | 'none' }
export interface PitchPlayer { /** 요청 6 · 픽셀 캐릭터 유니폼(경기마다 홈·원정·GK 자동) */ kit?: PixelKit; x: number; y: number; team: 'home' | 'away'; num?: number; me?: boolean; label?: string; /** 겹칠 때 쓰는 짧은 이름(성·별명). 없으면 '.' 뒤 3자 */ short?: string; /** 공 가진 선수(이름표 우선순위 2) */ ball?: boolean; /** 얼굴 마커 이미지 */ face?: string; flag?: boolean; dim?: boolean }
export interface PitchArrow { from: [number, number]; to: [number, number]; kind: 'pass' | 'through' | 'cross' | 'dribble' | 'shot'; tone?: 'safe' | 'balanced' | 'gamble'; curve?: [number, number]; ghost?: boolean }
/** 가로 피치(기본, 요청 7~9 통합): crop [from,to] = 공격 방향 x 범위 %로 확대, cropY = 폭 방향 범위 %(없으면 aspect 비율로 공·내 선수 중심), aspect = 그려질 가로:세로(기본 105:68, 폰 결정 순간 390:240). names·collide·size도 가로에서 써요 — 이름표 우선순위 내 선수 > 공 가진 선수 > 공과 가까운 순, 겹치면 짧은 이름 → 그래도 겹치면 숨김. 확대하면 원·글자는 덜 커져요(zoom^0.62로 나눔). */
/** orient='vertical' = 세로 피치(내 팀 아래→위). 세로에서만: crop [from,to](공격 방향 %, 예 [56,100] = 상대 진영 쪽만), marker, size, names, collide, dot(캐릭터 도트 px), renderWidth(실제 그려지는 폭 px). */
export interface PitchProps { players: PitchPlayer[]; ball?: [number, number]; arrows?: PitchArrow[]; offsideX?: number; marks?: Array<{ x: number; y: number; text: string; tone?: 'brand' | 'warning' | 'fail' | 'white' }>; label?: string; children?: React.ReactNode;
  orient?: 'horizontal' | 'vertical'; crop?: [number, number]; cropY?: [number, number]; aspect?: number; marker?: 'number' | 'face' | 'pixel'; size?: 'sm' | 'md' | 'lg' | 'xl'; names?: 'all' | 'mine' | 'off'; collide?: boolean; dot?: 2 | 4; renderWidth?: number;
  /** 요청 6 · marker='pixel'일 때 캐릭터 아래 등번호 띠(홈 라임 · 원정 주황, 기본 켬) */ band?: boolean; /** 두 팀 유니폼이 비슷한 경기: 원정 캐릭터 몸통에 주황 테두리 */ kitClash?: boolean }
export declare function Pitch(props: PitchProps): React.ReactElement;

export interface PossessionBarProps { home: number; label?: string | false }
export declare function PossessionBar(props: PossessionBarProps): React.ReactElement;

export interface AppBarProps { team: string; subtitle?: string; crest?: string | false; unread?: number; onSave?: () => void }
export declare function AppBar(props: AppBarProps): React.ReactElement;

export interface TabItem { id: string; label: string; icon?: IconName; badge?: number }
/** scroll = 가로 스크롤 + 오른쪽 흐림(섹션 이동 칩 등). cols = n열 바둑판(6개 이상 탭을 잘리지 않게, 폰 3×2). */
export interface TabsProps { items: TabItem[]; value: string; variant?: 'segment' | 'underline' | 'nav'; fill?: boolean; scroll?: boolean; cols?: number; label?: string; onChange?: (id: string) => void }
export declare function Tabs(props: TabsProps): React.ReactElement;

export interface BannerProps { tone?: 'injury' | 'warning' | 'info' | 'success'; title: string; children?: React.ReactNode; action?: string; onAction?: () => void }
export declare function Banner(props: BannerProps): React.ReactElement;

export interface ToastProps { kind?: 'levelup' | 'badge' | 'card' | 'info'; title: string; body?: string; action?: string; onAction?: () => void }
export declare function Toast(props: ToastProps): React.ReactElement;

export interface BottomSheetProps { title?: string; eyebrow?: string; subtitle?: string; children?: React.ReactNode; footer?: React.ReactNode; open?: boolean; inline?: boolean; onClose?: () => void }
export declare function BottomSheet(props: BottomSheetProps): React.ReactElement | null;

export interface ModalProps { title: string; children?: React.ReactNode; icon?: IconName; tone?: 'info' | 'warning' | 'danger'; actions?: React.ReactNode[]; open?: boolean; inline?: boolean; onClose?: () => void }
export declare function Modal(props: ModalProps): React.ReactElement | null;

/** result: success 라임 면 · fail 빨간 테두리 · neutral(보통) 회색 면 · concede(실점) 빨간 테두리 + 빨간 도장. compact = 결정 결과 v3(190)처럼 피치 아래 낮은 판. */
export interface ResultSplashProps { compact?: boolean; result: 'success' | 'fail' | 'neutral' | 'concede'; title: string; detail?: string; rating?: number; ratingDelta?: number }
export declare function ResultSplash(props: ResultSplashProps): React.ReactElement;

export type TacticStyle = 'balanced' | 'tikitaka' | 'gegen' | 'counter' | 'direct' | 'block';
export type Fit = 'good' | 'ok' | 'bad';
export interface FitBadgeProps { fit: Fit; label?: string }
export declare function FitBadge(props: FitBadgeProps): React.ReactElement;
export interface TacticEmblemProps { tactic: TacticStyle; size?: number; away?: boolean; on?: boolean }
export declare function TacticEmblem(props: TacticEmblemProps): React.ReactElement;
export interface TacticChipProps { tactic: TacticStyle; size?: 'xs' | 'sm' | 'md'; team?: string; formation?: string; fit?: Fit; selected?: boolean; away?: boolean; onClick?: () => void }
export declare function TacticChip(props: TacticChipProps): React.ReactElement;
export interface FormationSlot { drag?: boolean; ghost?: boolean; id?: string; x: number; y: number; pos: string; name?: string; role?: string; me?: boolean; selected?: boolean; dim?: boolean; warn?: boolean; ovr?: number; ovrDown?: boolean }
export interface FormationPitchProps { grid?: boolean; cells?: Array<{ col: number; row: number; tone?: 'target' | 'bad'; label?: string }>; slots: FormationSlot[]; compact?: boolean; height?: number; label?: string }
export declare function FormationPitch(props: FormationPitchProps): React.ReactElement;
export interface OptionRowProps { note?: string; title: string; desc?: string; icon?: IconName; fit?: Fit; tag?: string; right?: React.ReactNode; selected?: boolean; radio?: boolean; disabled?: boolean; onClick?: () => void }
export declare function OptionRow(props: OptionRowProps): React.ReactElement;
export interface SliderProps { label: string; value: number; valueLabel?: string; left?: string; right?: string }
export declare function Slider(props: SliderProps): React.ReactElement;
export interface SwitchProps { label: string; desc?: string; on?: boolean; onChange?: (on: boolean) => void }
export declare function Switch(props: SwitchProps): React.ReactElement;
export interface CellGaugeProps { label?: string; value: number; add?: number; cells?: number; valueLabel?: string }
export declare function CellGauge(props: CellGaugeProps): React.ReactElement;
/* ---------- 요청 5 새 컴포넌트 ---------- */
export type DockItem = 'home' | 'progress' | 'player' | 'schedule' | 'world' | 'more' | 'deck' | 'tactic' | 'settings' | 'save' | 'inbox' | 'finance';
/** 요청 6: 홈이 항상 가운데. 폰 6칸(진행 2fr · 선수 · 홈 · 훈련·일정 · 월드 · 더보기) / PC 9칸(진행 · 선수 · 훈련·일정 · 덱 · 홈 · 전술 · 월드 · 설정 · 저장). progress = 진행 칸 상태(5종). */
/** B 독 v3: 폰 5칸 = 홈 · 선수 · [다음] · 훈련·일정 · 더보기(moreOpen = 독 위 한 줄: 인박스 · 재정 · 월드 · 덱 · 전술 · 설정 · 저장, moreScroll = 끈 위치). PC = 홈 · 선수 · 덱 · 전술 · 인박스 | [다음] | 훈련·일정 · 월드 · 재정 · 설정 · 저장. progress = [다음] 키 상태. */
export interface DockProps { moreOpen?: boolean; moreScroll?: 'start' | 'end'; device?: 'phone' | 'pc'; value?: DockItem; progress?: 'continue' | 'running' | 'match' | 'live' | 'locked' | 'answer' | 'season'; badges?: Partial<Record<DockItem, number>>; locked?: DockItem[]; onSelect?: (id: DockItem) => void }
export declare function Dock(props: DockProps): React.ReactElement;
/** 능력치 1~20. 색 구간 17+ brand · 15+ success · 13+ tier-key(하늘) · 10+ ink · ~9 away(주황). keyAttr = 포지션 핵심(테두리). */
export interface AttrTileProps { name: string; value: number; progress?: number; delta?: number; add?: number; keyAttr?: boolean; editable?: boolean; selected?: boolean; cost?: number; ovrDelta?: number | null; maxed?: boolean; onClick?: () => void; onPlus?: () => void; onMinus?: () => void }
export declare function AttrTile(props: AttrTileProps): React.ReactElement;
export interface AttrGridProps { groups: Array<{ name: string; note?: string; items: AttrTileProps[] }>; columns?: number; editable?: boolean }
export declare function AttrGrid(props: AttrGridProps): React.ReactElement;
export interface DayCellProps { day: string; date: string | number; label: string; kind?: 'train' | 'rest' | 'match'; icon?: IconName; today?: boolean; fixed?: boolean; selected?: boolean; past?: boolean; onClick?: () => void }
export declare function DayCell(props: DayCellProps): React.ReactElement;
export interface Offer { club: string; crest?: string; color?: string; league: string; rank?: number; strength: string | number; apps: number; starts: number; years: string; weekly: string; yearly: string; loan?: boolean; tag?: string; note?: string }
export interface OfferCardProps { offer: Offer; selected?: boolean; actions?: boolean; onAccept?: () => void; onReject?: () => void }
export declare function OfferCard(props: OfferCardProps): React.ReactElement;
/** fill = 빈자리 보충 줄(위 이적 줄 아래에 붙음) */
export interface TransferRowProps { name: string; pos: string; age: number; ovr: number; status?: string; from: string; to?: string; avatar?: string; mine?: boolean; fill?: boolean }
export declare function TransferRow(props: TransferRowProps): React.ReactElement;
export interface TextFieldProps { value?: string; placeholder?: string; label?: string; count?: string; hint?: string; icon?: IconName; focused?: boolean; clearable?: boolean }
export declare function TextField(props: TextFieldProps): React.ReactElement;
/* ---------- 요청 6 새 컴포넌트 ---------- */
/** − 값 + 조절(나이·키·몸무게). sub = 값이 주는 영향 한 줄(포인트·상한). */
export interface StepperProps { label?: string; value: number; unit?: string; min?: number; max?: number; range?: string; sub?: string; subTone?: 'gain' | 'cost' | 'warn'; disabled?: boolean; size?: 'md' | 'sm'; onMinus?: () => void; onPlus?: () => void }
export declare function Stepper(props: StepperProps): React.ReactElement;
/** 배분 포인트 띠. 상태는 left로 자동: 남음 / 0 / 초과(시작 막힘). */
export interface PointBarProps { left: number; total: number; label?: string; items?: Array<{ label: string; value: number; base?: boolean }>; message?: string; sticky?: boolean }
export declare function PointBar(props: PointBarProps): React.ReactElement;
/** 색 = 장점/단점/효과 없음 · 앞 기호 = 종류(± 생성 · 핀 커리어 · 별 플레이 · 말풍선 스토리) · 점선 + 시계 = 해제형 · 취소선 = 해제됨 */
export type TagKind = 'gen' | 'career' | 'play' | 'story';
export interface TagChipProps { name: string; kind?: TagKind; polarity?: 'pro' | 'con'; release?: string; released?: boolean; scope?: string; showScope?: boolean; desc?: string; size?: 'md' | 'sm'; onClick?: () => void }
export declare function TagChip(props: TagChipProps): React.ReactElement;
/** 16px 도트 타일. scale = 정수배(1~6). */
export interface PixelSprite { kind?: 'person' | 'kit'; skin?: string; hair?: string | 'none'; hairStyle?: 'short' | 'long' | 'curly'; kit?: string; kit2?: string; pattern?: 'solid' | 'stripe' | 'hoop' }
export interface PixelTileProps { sprite?: PixelSprite; src?: string; scale?: 1 | 2 | 3 | 4 | 5 | 6; label?: string; title?: string; selected?: boolean; isDefault?: boolean; disabled?: boolean; onClick?: () => void }
export declare function PixelTile(props: PixelTileProps): React.ReactElement;
declare global { interface Window { PlayerOne: { Button: typeof Button; Icon: typeof Icon; Avatar: typeof Avatar; Crest: typeof Crest; TierBadge: typeof TierBadge; RatingBadge: typeof RatingBadge; StatChip: typeof StatChip; Meter: typeof Meter; FatigueGauge: typeof FatigueGauge; FormIndicator: typeof FormIndicator; StatBar: typeof StatBar; PlayerCard: typeof PlayerCard; GameCard: typeof GameCard; CardHand: typeof CardHand; ChoiceButton: typeof ChoiceButton; FeedItem: typeof FeedItem; ScoreBar: typeof ScoreBar; SceneStrip: typeof SceneStrip; PossessionBar: typeof PossessionBar; AppBar: typeof AppBar; Tabs: typeof Tabs; Banner: typeof Banner; Toast: typeof Toast; BottomSheet: typeof BottomSheet; Modal: typeof Modal; ResultSplash: typeof ResultSplash; DeckSlot: typeof DeckSlot; HeroPanel: typeof HeroPanel; SectionTitle: typeof SectionTitle; Pitch: typeof Pitch; FitBadge: typeof FitBadge; TacticEmblem: typeof TacticEmblem; TacticChip: typeof TacticChip; FormationPitch: typeof FormationPitch; OptionRow: typeof OptionRow; Slider: typeof Slider; Switch: typeof Switch; CellGauge: typeof CellGauge; Dock: typeof Dock; AttrTile: typeof AttrTile; AttrGrid: typeof AttrGrid; DayCell: typeof DayCell; OfferCard: typeof OfferCard; TransferRow: typeof TransferRow; TextField: typeof TextField; Stepper: typeof Stepper; PointBar: typeof PointBar; TagChip: typeof TagChip; PixelTile: typeof PixelTile } } }
