import type { FieldPlayerData } from '../../src/types';

// 샘플: 중심값은 기억 기반 초안이며 이후 조정 예정
export const messi: FieldPlayerData = {
  id: 'messi',
  name: 'Lionel Messi',
  nameKo: '리오넬 메시',
  birthYear: 1987,
  nationality: 'Argentina',
  height: 170,
  weight: 72,
  foot: 'left',
  club: 'FC Barcelona',
  league: 'La Liga',
  shirtNumber: 10,
  position: 'RW',
  subPositions: ['CF', 'CAM'],
  traits: ['playmaker', 'dribbler'],
  potentialTier: 'legendary',
  reputation: 1000,
  legendBadge: true,
  attributes: {
    dribbling: 95, ballControl: 95,
    shooting: 93, longShots: 88, heading: 60, offTheBall: 93,
    shortPassing: 91, longPassing: 88, crossing: 80, freeKick: 92, vision: 94,
    tackling: 30, interception: 35, marking: 25, defensivePositioning: 30,
    pace: 80, acceleration: 92, agility: 95,
    stamina: 72, strength: 68, jumping: 70,
    composure: 94, bigMatch: 88, leadership: 75, workRate: 70,
  },
  variance: { spread: 3, overrides: { heading: [58, 70] } },
};
