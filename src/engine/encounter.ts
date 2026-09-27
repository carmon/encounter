import { applyProposal, legalActions, resolve } from './actions';
import {
  active,
  d6,
  end,
  find,
  heldItems,
  hurt,
  leaderOf,
  log,
  moveCharacter,
  moveItem,
  price,
  rollInitiative,
  shiftDisposition,
  shiftTension,
  sideOf,
  startFight,
  tradable,
} from './rules';
import type {
  Character,
  Choice,
  EncounterOutput,
  EncounterState,
  Group,
  Item,
  Objective,
  Outcome,
  PlanStep,
  ScenarioDef,
} from './types';

export const OUTCOME_TITLES: Record<Outcome, string> = {
  ongoing: 'Ongoing',
  accord: 'Accord',
  alliance: 'Alliance',
  parting: 'Parting of Ways',
  escape: 'Clean Escape',
  rout: 'They Broke',
  defeat: 'Your Group Broke',
};

/** Hard cap so no encounter can stall: both sides draw apart, exhausted. */
export const MAX_ROUNDS = 12;

export const GOOD_OUTCOMES: Outcome[] = ['accord', 'alliance', 'rout', 'escape', 'parting'];

const clone = <T>(v: T): T => structuredClone(v);

export function createEncounter(scn: ScenarioDef, party: Character[], seed: number): EncounterState {
  const player: Group = {
    id: 'player',
    name: scn.playerGroupName,
    side: 'player',
    members: clone(party),
    items: clone(scn.playerItems),
    leaderId: party[0].id,
    leaderKnown: true,
  };
  const npc = clone(scn.npc);
  const st: EncounterState = {
    scenario: clone(scn),
    round: 1,
    groups: { player, npc },
    disposition: scn.disposition,
    tension: 0,
    fight: false,
    seizing: false,
    plan: [],
    cursor: 0,
    initiative: {},
    momentum: {},
    guarding: [],
    escapePrep: { player: 0, npc: 0 },
    received: 0,
    known: { attrs: [], leader: npc.leaderKnown, agenda: 0, items: scn.revealItems },
    pending: null,
    lastDemandRound: -9,
    leaderChecked: [],
    fallen: [],
    eliminated: [],
    outcome: 'ongoing',
    endText: '',
    log: [],
    transfers: [],
    initialItems: {},
    rng: seed >>> 0 || 1,
  };
  for (const side of ['player', 'npc'] as const)
    for (const h of heldItems(st, side)) st.initialItems[h.item.id] = { name: h.item.name, state: h.item.state };
  log(st, 'info', scn.blurb);
  if (scn.speech === 'words' && !active(npc).some((n) => active(player).some((p) => p.tongues.some((t) => n.tongues.includes(t))))) {
    log(st, 'bad', 'Nobody in your group shares a tongue with them. Words will not carry.');
  }
  planRound(st);
  return st;
}

function planRound(st: EncounterState) {
  st.initiative = {};
  const steps: (PlanStep & { init: number; tie: number })[] = [];
  for (const side of ['player', 'npc'] as const) {
    for (const m of active(st.groups[side])) {
      const roll = rollInitiative(st, m);
      st.initiative[m.id] = roll;
      steps.push({ side, actorId: m.id, init: roll.value, tie: side === 'player' ? 0 : 1 });
    }
  }
  st.momentum = {};
  const lead = st.groups.player.leaderId;
  steps.sort((a, b) => (a.actorId === lead ? -1 : b.actorId === lead ? 1 : b.init - a.init || a.tie - b.tie));
  st.plan = steps.map(({ side, actorId }) => ({ side, actorId }));
  st.cursor = 0;
  skipBroken(st);
}

function skipBroken(st: EncounterState) {
  while (st.cursor < st.plan.length) {
    const c = find(st, st.plan[st.cursor].actorId);
    if (c && c.resolve > 0 && sideOf(st, c.id) === st.plan[st.cursor].side) return;
    st.cursor++;
  }
}

function endRound(st: EncounterState) {
  const scn = st.scenario;
  const ag = scn.agenda;
  if (ag.wantCount > 0 && st.received >= price(st) && !st.fight) {
    return end(st, 'parting', `${st.groups.npc.name} have what they came for and let you be.`);
  }
  if (!st.fight) shiftTension(st, 1);
  if (scn.attrition && st.tension >= scn.attrition.from) {
    const a = scn.attrition;
    for (const m of active(st.groups.player)) {
      const die = d6(st);
      if (m.attrs[a.attr] + die < a.dc) {
        log(st, 'bad', `${m.name}: ${a.text}`, `${m.name} resolve −${a.loss}`, `${a.attr.slice(0, 3).toUpperCase()} ${m.attrs[a.attr]}+${die} < ${a.dc}`);
        hurt(st, m, a.loss);
        if (st.outcome !== 'ongoing') return;
      }
    }
  }
  if (!st.fight && st.tension >= scn.tensionMax) {
    if (ag.onBoil === 'leave') return end(st, 'parting', `${st.groups.npc.name} run out of patience and vanish.`);
    if (ag.onBoil === 'seize') st.seizing = true;
    startFight(st, 'Patience is spent — they come at you.');
  }
  if (st.round >= MAX_ROUNDS) return end(st, 'parting', 'Exhausted, both sides draw apart. Nothing more will happen here today.');
  st.round += 1;
  planRound(st);
}

function advance(st: EncounterState) {
  if (st.outcome !== 'ongoing') return finalize(st);
  st.cursor += 1;
  skipBroken(st);
  if (st.cursor >= st.plan.length) endRound(st);
  if (st.outcome !== 'ongoing') finalize(st);
}

export function currentStep(st: EncounterState): PlanStep | null {
  if (st.outcome !== 'ongoing') return null;
  return st.plan[st.cursor] ?? null;
}

/** Resolve the current actor's choice and move to the next step. */
export function step(prev: EncounterState, choice: Choice): EncounterState {
  const st = clone(prev);
  const s = currentStep(st);
  if (!s || st.pending) return st;
  const actor = find(st, s.actorId);
  if (actor && actor.resolve > 0 && legalActions(st, actor.id).includes(choice.action)) resolve(st, actor, choice);
  else if (actor) log(st, 'info', `${actor.name} hesitates.`);
  advance(st);
  return st;
}

/** Player's answer to a proposal the NPC side put on the table. */
export function respond(prev: EncounterState, accept: boolean): EncounterState {
  const st = clone(prev);
  const p = st.pending;
  if (!p) return st;
  st.pending = null;
  if (accept) {
    applyProposal(st, p, 'npc');
    finalize(st);
  } else {
    shiftTension(st, 1);
    const proud = leaderOf(st.groups.npc)?.temperament.id;
    if (proud === 'proud' || proud === 'greedy' || proud === 'bold') shiftDisposition(st, -1);
    log(st, 'info', 'You refuse their terms.', proud === 'proud' || proud === 'greedy' || proud === 'bold' ? 'tension +1 · disposition −1' : 'tension +1');
  }
  return st;
}

function finalize(st: EncounterState) {
  if (st.outcome === 'ongoing' || st.plan.length === 0) return;
  const npc = st.groups.npc;
  const pl = st.groups.player;
  if (st.outcome === 'rout' && !st.eliminated.includes('npc')) {
    for (const it of [...npc.items]) moveItem(st, it.id, 'player', null, 'looted');
    for (const m of npc.members.filter((x) => x.resolve <= 0))
      for (const it of m.items.filter(tradable)) moveItem(st, it.id, 'player', leaderOf(pl) ?? null, 'looted');
    st.eliminated.push('npc');
  }
  if (st.outcome === 'defeat') {
    const taker = leaderOf(npc) ?? active(npc)[0] ?? null;
    for (const it of [...pl.items]) moveItem(st, it.id, 'npc', taker, 'seized');
    if (st.scenario.agenda.onVictory === 'capture') {
      for (const m of [...pl.members]) moveCharacter(st, m.id, 'npc', 'captured');
      st.eliminated.push('player');
    }
  }
  // broken characters in surviving groups come round with 1 resolve
  for (const side of ['player', 'npc'] as const)
    if (!st.eliminated.includes(side)) for (const m of st.groups[side].members) if (m.resolve <= 0) m.resolve = 1;
  st.plan = [];
}

// ── output ──────────────────────────────────────────────────────────
function groupHas(g: Group, tag: string) {
  const all: Item[] = [...g.items, ...g.members.flatMap((m) => m.items)];
  return all.some((i) => i.tags.includes(tag) && i.state !== 'spent');
}

function checkObjective(st: EncounterState, o: Objective): boolean {
  const pl = st.groups.player;
  const alive = !st.eliminated.includes('player');
  switch (o.check.type) {
    case 'hold':
    case 'obtain':
      return alive && groupHas(pl, o.check.tag);
    case 'deliver':
      return groupHas(st.groups.npc, o.check.tag) && !st.eliminated.includes('npc');
    case 'standing':
      return alive && pl.members.filter((m) => !st.fallen.includes(m.id)).length >= o.check.min;
    case 'pass':
      return ['accord', 'alliance', 'parting', 'rout'].includes(st.outcome);
    case 'knowLeader':
      return st.groups.npc.leaderKnown;
  }
}

export function buildOutput(st: EncounterState): EncounterOutput {
  const groups = (['player', 'npc'] as const)
    .filter((s) => !st.eliminated.includes(s))
    .map((s) => {
      const g = st.groups[s];
      return { id: g.id, name: g.name, side: g.side, leaderId: g.leaderId, members: clone(g.members), items: clone(g.items) };
    });
  const itemChanges: EncounterOutput['itemChanges'] = [];
  for (const side of ['player', 'npc'] as const)
    for (const h of heldItems(st, side)) {
      const was = st.initialItems[h.item.id];
      if (!was) itemChanges.push({ id: h.item.id, name: h.item.name, from: 'new', to: h.item.state });
      else if (was.state !== h.item.state) itemChanges.push({ id: h.item.id, name: h.item.name, from: was.state, to: h.item.state });
    }
  const objectives = st.scenario.objectives.map((o) => ({ label: o.label, met: checkObjective(st, o), primary: o.primary }));
  return {
    outcome: st.outcome,
    label: st.scenario.labels?.[st.outcome] ?? OUTCOME_TITLES[st.outcome],
    text: st.endText,
    rounds: st.round,
    groups,
    eliminated: [...st.eliminated],
    transfers: clone(st.transfers),
    itemChanges,
    objectives,
    success: objectives.filter((o) => o.primary).every((o) => o.met),
  };
}

export { legalActions };
