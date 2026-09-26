import type { Character, Ending, HiddenGoal, SpeechMode } from '../core/types';
import { ROSTER } from './roster';

export interface ScenarioDef {
  id: string;
  name: string;
  blurb: string;
  bullets: string[];
  speech: SpeechMode;
  stance: number;
  resources: number;
  patience: number;
  goal: HiddenGoal;
  endingLabels?: Partial<Record<Exclude<Ending, 'ongoing'>, string>>;
  roster: Character[];
  npcs: Character[];
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'toll_road',
    name: 'The Toll Road',
    blurb: 'Karsk bandits rise from the tree line and block the road. They speak only the Karsk tongue. Your cargo wagon creaks behind you.',
    bullets: [
      'Tongue: Karsk only — no Trade / Oran',
      'Foe: Karsk bandits ×3',
      'Position: North road at the treeline — blocking the road, wagon in the open',
      'Attitude: Hostile toll demand — will attack if talks stall',
    ],
    speech: 'tongues',
    stance: 1,
    resources: 3,
    patience: 5,
    goal: {
      name: 'Toll by any means',
      hint: 'They keep glancing at your cargo... and at the tree line behind you.',
      acceptStance: 2,
      demandGoods: 2,
      defaultOutcome: 'attack',
      breaksToFlee: 2,
    },
    roster: ROSTER,
    npcs: [
      {
        id: 'redgar',
        name: 'Redgar',
        nationality: 'karsk',
        languages: ['karsk'],
        skills: { combat: 4, trade: 1, diplomacy: 2, leadership: 3, perception: 2 },
        temperament: 'aggressive',
        morale: 9,
      },
      {
        id: 'vex',
        name: 'Vex',
        nationality: 'karsk',
        languages: ['karsk'],
        skills: { combat: 2, trade: 3, diplomacy: 2, leadership: 1, perception: 3 },
        temperament: 'greedy',
        morale: 8,
      },
      {
        id: 'mule',
        name: 'Mule',
        nationality: 'karsk',
        languages: ['karsk'],
        skills: { combat: 3, trade: 1, diplomacy: 1, leadership: 1, perception: 2 },
        temperament: 'cautious',
        morale: 7,
      },
    ],
  },
  {
    id: 'market',
    name: 'Foreign Market',
    blurb:
      'An Oran guild caravan blocks your exit from the market, smiling too widely. They speak the Trade Tongue and drive a hard bargain.',
    bullets: [
      'Tongue: Trade + Oran (shared Trade Tongue)',
      'Foe: Oran guild caravan ×3',
      'Position: Market square — blocking the south gate, stalls hem you in',
      'Attitude: Vain/greedy, smiling but hard-bargaining — will walk away if cold',
    ],
    speech: 'tongues',
    stance: 2,
    resources: 3,
    patience: 5,
    goal: {
      name: 'A guild price',
      hint: 'The guildmaster keeps mentioning the "foreigner surcharge" with a laugh that is not a laugh.',
      acceptStance: 3,
      demandGoods: 3,
      defaultOutcome: 'leave',
      breaksToFlee: 3,
    },
    roster: ROSTER,
    npcs: [
      {
        id: 'sarei',
        name: 'Guildmaster Sarei',
        nationality: 'oran',
        languages: ['oran', 'trade'],
        skills: { combat: 1, trade: 4, diplomacy: 4, leadership: 3, perception: 3 },
        temperament: 'vain',
        morale: 8,
      },
      {
        id: 'nimo',
        name: 'Factor Nimo',
        nationality: 'oran',
        languages: ['oran', 'trade'],
        skills: { combat: 1, trade: 4, diplomacy: 2, leadership: 1, perception: 3 },
        temperament: 'greedy',
        morale: 7,
      },
      {
        id: 'osta',
        name: 'Guard Osta',
        nationality: 'oran',
        languages: ['oran', 'trade'],
        skills: { combat: 4, trade: 1, diplomacy: 1, leadership: 1, perception: 3 },
        temperament: 'cautious',
        morale: 9,
      },
    ],
  },
  {
    id: 'wolves',
    name: 'The Wolf Pack',
    blurb:
      'A starving pack has cut off the trail, circling the wagon. No shared tongue exists here and words are wasted on them — but gifts of food, threats, or steel all speak plainly.',
    bullets: [
      'Tongue: No tongue — beasts (growls & postures only)',
      'Foe: Wolf pack ×3',
      'Position: Forest trail — pack has cut off the path, circling the wagon',
      'Attitude: Starving, aggressive — only gifts/threats/steel speak',
    ],
    speech: 'beasts',
    stance: 0,
    resources: 4,
    patience: 4,
    goal: {
      name: 'Hunger',
      hint: 'Ribs show under matted fur; every eye keeps dropping to the cargo.',
      acceptStance: 2,
      demandGoods: 1,
      defaultOutcome: 'attack',
      breaksToFlee: 2,
    },
    endingLabels: {
      victory: 'Pack Driven Off',
      escaped: 'Danger Avoided',
      alliance: 'Trust Earned',
      trade: 'Offering Accepted',
      deal: 'Trail Truce',
      defeat: 'Mauled',
      routed: 'Run Off the Trail',
      walkedAway: 'They Lose Interest',
    },
    roster: ROSTER,
    npcs: [
      {
        id: 'alpha',
        name: 'Grey Alpha',
        nationality: 'wild',
        languages: ['beast'],
        skills: { combat: 5, trade: 2, diplomacy: 1, leadership: 3, perception: 4 },
        temperament: 'aggressive',
        morale: 10,
      },
      {
        id: 'scar',
        name: 'Scar Ear',
        nationality: 'wild',
        languages: ['beast'],
        skills: { combat: 3, trade: 2, diplomacy: 1, leadership: 1, perception: 4 },
        temperament: 'cautious',
        morale: 7,
      },
      {
        id: 'pup',
        name: 'The Pup',
        nationality: 'wild',
        languages: ['beast'],
        skills: { combat: 2, trade: 3, diplomacy: 1, leadership: 1, perception: 3 },
        temperament: 'greedy',
        morale: 6,
      },
    ],
  },
];
