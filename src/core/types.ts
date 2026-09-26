import type { LogKey, MsgParams } from './messages';

export type Temperament =
  | 'aggressive'
  | 'cautious'
  | 'greedy'
  | 'honorable'
  | 'vain';

export type PlayerAction =
  | 'hold'
  | 'talk'
  | 'persuade'
  | 'offer'
  | 'gift'
  | 'appraise'
  | 'sizeup'
  | 'threaten'
  | 'bluff'
  | 'interpret'
  | 'draw'
  | 'attack'
  | 'defend'
  | 'signalEscape'
  | 'rally'
  | 'coordinatedThreat'
  | 'finalOffer'
  | 'withdraw';

export type NpcAction =
  | 'talk'
  | 'persuade'
  | 'threaten'
  | 'demand'
  | 'draw'
  | 'rally';

export type Ending =
  | 'ongoing'
  | 'trade'
  | 'deal'
  | 'alliance'
  | 'victory'
  | 'defeat'
  | 'routed'
  | 'escaped'
  | 'walkedAway';

export type SpeechMode = 'tongues' | 'beasts';

export type PlanStep = { side: 'player' | 'npc'; actorId: string };

export interface Skills {
  combat: number;
  trade: number;
  diplomacy: number;
  leadership: number;
  perception: number;
}

export interface Character {
  id: string;
  name: string;
  nationality: string;
  languages: string[];
  skills: Skills;
  temperament: Temperament;
  morale: number;
}

export interface HiddenGoal {
  name: string;
  hint: string;
  acceptStance: number;
  demandGoods: number;
  defaultOutcome: 'attack' | 'leave';
  breaksToFlee: number;
}

export interface GroupState {
  members: Character[];
  order: string[];
  resources: number;
  armed: boolean;
  escapeReady: boolean;
  interpreterId: string | null;
  goodsTaken: number;
}

export interface LogEvent {
  round: number;
  key: LogKey;
  params?: MsgParams;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'end';
  delta?: string;
}

export interface ParleyState {
  speech: SpeechMode;
  round: number;
  patience: number;
  stance: number;
  trust: number;
  player: GroupState;
  npc: GroupState;
  goal: HiddenGoal;
  plan: PlanStep[];
  stepCursor: number;
  initiative: Record<string, number>;
  combatRound: boolean;
  defending: string[];
  grudges: Record<string, number>;
  leaderDownRolled: string[];
  revealedSkills: string[];
  revealedTemper: string[];
  goalHintSeen: boolean;
  goalKnown: boolean;
  standoff: boolean;
  ended: Ending;
  log: LogEvent[];
  rngState: number;
}

export interface Order {
  actorId: string;
  action: PlayerAction;
  goods?: number;
  targetId?: string;
}

export interface RollOpts {
  dice?: number[];
}
