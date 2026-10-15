import type * as React from 'react';

export type Tier = 'normal' | 'key' | 'top' | 'world' | 'legend';
export type CardType = 'play' | 'setpiece' | 'passive' | 'combo' | 'manage' | 'signature' | 'order';
export type CardPos = 'all' | 'att' | 'mid' | 'def';
export type Rarity = 'common' | 'rare' | 'epic' | 'legend';
export type IconName = 'ball' | 'save' | 'card' | 'sub' | 'injury' | 'danger' | 'chance' | 'dot' | 'clock' | 'bell' | 'disk' | 'home' | 'match' | 'player' | 'career' | 'world' | 'lock' | 'plus' | 'minus' | 'check' | 'close' | 'chevron-right' | 'chevron-down' | 'play' | 'pause' | 'skip' | 'risk' | 'arrow-up' | 'arrow-down' | 'arrow-flat' | 'double-up' | 'double-down' | CardType | 'star' | 'levelup' | 'info' | 'filter' | 'restore' | 'search' | 'pos-all' | 'pos-att' | 'pos-mid' | 'defense' | 'throwin' | 'goalkick' | 'tactic' | 'order' | 'solo' | 't-balanced' | 't-tikitaka' | 't-gegen' | 't-counter' | 't-direct' | 't-block' | 'newchoice' | 'signature' | 'ff' | 'auto' | 'manual' | 'settings' | 'calendar' | 'train' | 'video' | 'rest' | 'recover' | 'target' | 'download' | 'upload' | 'plane' | 'replay' | 'stop';

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
/** 카드 그림 위치·확대. x = 오른쪽으로 이동(%, 음수면 왼쪽), y = 위로 올림(%, 음수면 내림), 둘 다 4:3 그림 칸(280×210) 기준. zoom = 확대 배율 1~4(기본 1). */
export interface CardArtPos { x?: number; y?: number; zoom?: number }
export interface Card {pos?: CardPos; order?: 'follow' | 'solo'; id?: string; name: string; type: CardType; rarity: Rarity; level?: number; effect?: CardEffect | string; effectValue?: string; condition?: CardCondition; art?: string; artPos?: CardArtPos; isNew?: boolean; count?: number; disabled?: boolean }
/** full 280×392 · deck 168×235 (both with screentone art fade) · mini (deck slot, 116px tall) · hand 76×108 (both simplified, no screentone) */
export interface GameCardProps { card: Card; size?: 'full' | 'deck' | 'mini' | 'hand'; state?: 'normal' | 'selected' | 'disabled' | 'locked'; reason?: string; onClick?: () => void }
export declare function GameCard(props: GameCardProps): React.ReactElement;

export interface DeckSlotProps { card?: Card | null; onClick?: () => void }
export declare function DeckSlot(props: DeckSlotProps): React.ReactElement;

export interface CardHandProps { cards: Card[]; selectedId?: string; onSelect?: (id: string) => void }
export declare function CardHand(props: CardHandProps): React.ReactElement;

export interface HeroPanelProps { title: string; right?: React.ReactNode; onBack?: (() => void) | false; eyebrow?: string; value?: number | string; total?: number; pad?: boolean; progress?: boolean; chips?: Array<string | { label: string; soft?: boolean }>; children?: React.ReactNode }
export declare function HeroPanel(props: HeroPanelProps): React.ReactElement;

export interface SectionTitleProps { title: string; action?: React.ReactNode; as?: 'h2' | 'h3' }
export declare function SectionTitle(props: SectionTitleProps): React.ReactElement;

export interface Outcome { text: string; rating: number }
export interface ChoiceButtonProps { kind?: 'safe' | 'balanced' | 'gamble' | 'play'; card?: string; rarity?: Rarity; deltaSource?: string; offside?: 'low' | 'mid' | 'high'; name: string; chance: number; chanceDelta?: number; success: Outcome; fail: Outcome; risk?: string; selected?: boolean; disabled?: boolean; onClick?: () => void }
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

export interface PitchPlayer { x: number; y: number; team: 'home' | 'away'; num?: number; me?: boolean; label?: string; flag?: boolean; dim?: boolean }
export interface PitchArrow { from: [number, number]; to: [number, number]; kind: 'pass' | 'through' | 'cross' | 'dribble' | 'shot'; tone?: 'safe' | 'balanced' | 'gamble'; curve?: [number, number]; ghost?: boolean }
export interface PitchProps { players: PitchPlayer[]; ball?: [number, number]; arrows?: PitchArrow[]; offsideX?: number; marks?: Array<{ x: number; y: number; text: string; tone?: 'brand' | 'warning' | 'fail' | 'white' }>; label?: string; children?: React.ReactNode }
export declare function Pitch(props: PitchProps): React.ReactElement;

export interface PossessionBarProps { home: number; label?: string | false }
export declare function PossessionBar(props: PossessionBarProps): React.ReactElement;

export interface AppBarProps { team: string; subtitle?: string; crest?: string | false; unread?: number; onSave?: () => void }
export declare function AppBar(props: AppBarProps): React.ReactElement;

export interface TabItem { id: string; label: string; icon?: IconName; badge?: number }
export interface TabsProps { items: TabItem[]; value: string; variant?: 'segment' | 'underline' | 'nav'; fill?: boolean; label?: string; onChange?: (id: string) => void }
export declare function Tabs(props: TabsProps): React.ReactElement;

export interface BannerProps { tone?: 'injury' | 'warning' | 'info' | 'success'; title: string; children?: React.ReactNode; action?: string; onAction?: () => void }
export declare function Banner(props: BannerProps): React.ReactElement;

export interface ToastProps { kind?: 'levelup' | 'badge' | 'card' | 'info'; title: string; body?: string; action?: string; onAction?: () => void }
export declare function Toast(props: ToastProps): React.ReactElement;

export interface BottomSheetProps { title?: string; eyebrow?: string; subtitle?: string; children?: React.ReactNode; footer?: React.ReactNode; open?: boolean; inline?: boolean; onClose?: () => void }
export declare function BottomSheet(props: BottomSheetProps): React.ReactElement | null;

export interface ModalProps { title: string; children?: React.ReactNode; icon?: IconName; tone?: 'info' | 'warning' | 'danger'; actions?: React.ReactNode[]; open?: boolean; inline?: boolean; onClose?: () => void }
export declare function Modal(props: ModalProps): React.ReactElement | null;

export interface ResultSplashProps { result: 'success' | 'fail'; title: string; detail?: string; rating?: number; ratingDelta?: number }
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
declare global { interface Window { PlayerOne: { Button: typeof Button; Icon: typeof Icon; Avatar: typeof Avatar; Crest: typeof Crest; TierBadge: typeof TierBadge; RatingBadge: typeof RatingBadge; StatChip: typeof StatChip; Meter: typeof Meter; FatigueGauge: typeof FatigueGauge; FormIndicator: typeof FormIndicator; StatBar: typeof StatBar; PlayerCard: typeof PlayerCard; GameCard: typeof GameCard; CardHand: typeof CardHand; ChoiceButton: typeof ChoiceButton; FeedItem: typeof FeedItem; ScoreBar: typeof ScoreBar; SceneStrip: typeof SceneStrip; PossessionBar: typeof PossessionBar; AppBar: typeof AppBar; Tabs: typeof Tabs; Banner: typeof Banner; Toast: typeof Toast; BottomSheet: typeof BottomSheet; Modal: typeof Modal; ResultSplash: typeof ResultSplash; DeckSlot: typeof DeckSlot; HeroPanel: typeof HeroPanel; SectionTitle: typeof SectionTitle; Pitch: typeof Pitch; FitBadge: typeof FitBadge; TacticEmblem: typeof TacticEmblem; TacticChip: typeof TacticChip; FormationPitch: typeof FormationPitch; OptionRow: typeof OptionRow; Slider: typeof Slider; Switch: typeof Switch; CellGauge: typeof CellGauge } } }
