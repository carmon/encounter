export type Side = 'player' | 'npc';
export type Attr = 'might' | 'wits' | 'charm' | 'nerve';
export const ATTRS: Attr[] = ['might', 'wits', 'charm', 'nerve'];

export type ItemKind = 'wearable' | 'consumable' | 'group';
export type ItemState = 'intact' | 'worn' | 'broken' | 'spent';

export type ItemEffect =
  | { type: 'weapon'; power: number }
  | { type: 'ward'; power: number }
  | { type: 'boost'; attr: Attr; power: number }
  | { type: 'heal'; power: number }
  | { type: 'scare'; power: number; vs: string[] }
  | { type: 'smoke'; power: number };

export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  tags: string[];
  value: number;
  state: ItemState;
  uses?: number;
  effect?: ItemEffect;
  note?: string;
}

export interface Temperament {
  id: string;
  label: string;
  note: string;
  /** Bonus the *other* side gets when targeting this temperament with an action. */
  weakTo?: Partial<Record<ActionId, number>>;
  /** Weight multipliers for the AI picking actions. */
  leans?: Partial<Record<ActionId, number>>;
}

export interface Character {
  id: string;
  name: string;
  origin: string;
  tongues: string[];
  /** 'human' | 'beast' | 'spirit' … matched by items (scare vs) and rules (spirits). */
  tags: string[];
  attrs: Record<Attr, number>;
  temperament: Temperament;
  resolve: number;
  maxResolve: number;
  items: Item[];
}

export interface Group {
  id: string;
  name: string;
  side: Side;
  members: Character[];
  items: Item[];
  leaderId: string;
  /** Whether the opposing side knows who leads this group. */
  leaderKnown: boolean;
}

export interface Agenda {
  wants: string[];
  wantCount: number;
  offers: string[];
  guards: string[];
  acceptAt: number;
  onBoil: 'fight' | 'leave' | 'seize';
  onVictory: 'strip' | 'capture';
  breakAt: number;
  canAlly: boolean;
  /** Will they grab items outside a fight (beasts, thieves) or only bargain for them? */
  takes: boolean;
  hint: string;
  truth: string;
}

export type ObjectiveCheck =
  | { type: 'hold'; tag: string }
  | { type: 'obtain'; tag: string }
  | { type: 'deliver'; tag: string }
  | { type: 'standing'; min: number }
  | { type: 'pass' }
  | { type: 'knowLeader' };

export interface Objective {
  id: string;
  label: string;
  check: ObjectiveCheck;
  primary: boolean;
}

export interface Attrition {
  attr: Attr;
  dc: number;
  loss: number;
  /** Tension at which attrition starts. */
  from: number;
  text: string;
}

export type Outcome = 'ongoing' | 'accord' | 'alliance' | 'parting' | 'escape' | 'rout' | 'defeat';

export interface ScenarioDef {
  id: string;
  name: string;
  blurb: string;
  bullets: string[];
  speech: 'words' | 'none';
  disposition: number;
  tensionMax: number;
  revealItems: boolean;
  npc: Group;
  playerGroupName: string;
  playerItems: Item[];
  agenda: Agenda;
  objectives: Objective[];
  attrition?: Attrition;
  labels?: Partial<Record<Outcome, string>>;
  /** Action label overrides, e.g. parley → "Soothe" for beasts. */
  verbs?: Partial<Record<ActionId, string>>;
}

export type ActionId =
  | 'parley'
  | 'press'
  | 'read'
  | 'strike'
  | 'use'
  | 'give'
  | 'take'
  | 'guard'
  | 'sway'
  | 'rally'
  | 'propose'
  | 'withdraw';

export interface Choice {
  action: ActionId;
  targetId?: string;
  itemId?: string;
  give?: string[];
  ask?: string[];
  join?: boolean;
}

export interface Proposal {
  from: Side;
  give: string[];
  ask: string[];
  join: boolean;
}

export interface LogEntry {
  round: number;
  kind: 'info' | 'good' | 'bad' | 'end';
  text: string;
  delta?: string;
  roll?: string;
}

export interface PlanStep {
  side: Side;
  actorId: string;
}

export interface Transfer {
  kind: 'item' | 'character';
  id: string;
  name: string;
  from: string;
  to: string;
  round: number;
  how: string;
}

export interface InitiativeRoll {
  value: number;
  parts: string;
}

export interface EncounterState {
  scenario: ScenarioDef;
  round: number;
  groups: Record<Side, Group>;
  disposition: number;
  tension: number;
  fight: boolean;
  seizing: boolean;
  plan: PlanStep[];
  cursor: number;
  initiative: Record<string, InitiativeRoll>;
  momentum: Record<string, number>;
  guarding: string[];
  escapePrep: Record<Side, number>;
  /** Wanted items the NPC group has received (given or taken). */
  received: number;
  known: { attrs: string[]; leader: boolean; agenda: 0 | 1 | 2; items: boolean };
  pending: Proposal | null;
  lastDemandRound: number;
  leaderChecked: string[];
  /** Everyone who hit 0 resolve at any point. */
  fallen: string[];
  eliminated: Side[];
  outcome: Outcome;
  endText: string;
  log: LogEntry[];
  transfers: Transfer[];
  initialItems: Record<string, { name: string; state: ItemState }>;
  rng: number;
}

export interface OutputGroup {
  id: string;
  name: string;
  side: Side;
  leaderId: string;
  members: Character[];
  items: Item[];
}

export interface EncounterOutput {
  outcome: Outcome;
  label: string;
  text: string;
  rounds: number;
  groups: OutputGroup[];
  eliminated: Side[];
  transfers: Transfer[];
  itemChanges: { id: string; name: string; from: ItemState | 'new'; to: ItemState }[];
  objectives: { label: string; met: boolean; primary: boolean }[];
  success: boolean;
}
