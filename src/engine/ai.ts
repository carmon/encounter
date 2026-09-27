import { itemsFor, judge, legalActions, targetsFor } from './actions';
import { active, d6, find, has, heldItems, isLeader, other, price, sideOf, wantedByNpc, weaponsOf } from './rules';
import type { ActionId, Character, Choice, EncounterState, Item } from './types';

function weighted(st: EncounterState, opts: [ActionId, number][]): ActionId {
  const total = opts.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return 'guard';
  let r = ((d6(st) - 1) * 6 + (d6(st) - 1)) / 36 * total;
  for (const [a, w] of opts) {
    r -= Math.max(0, w);
    if (r < 0) return a;
  }
  return opts[opts.length - 1][0];
}

const lowest = (cs: Character[]) => [...cs].sort((a, b) => a.resolve - b.resolve)[0];

/** NPC decision: temperament leanings × situation. */
export function npcChoice(st: EncounterState, actorId: string): Choice {
  const actor = find(st, actorId)!;
  const legal = legalActions(st, actorId);
  const ag = st.scenario.agenda;
  const lean = (a: ActionId) => actor.temperament.leans?.[a] ?? 1;
  const leader = isLeader(st, actor);
  const pl = st.groups.player;
  const wantedOnTable = heldItems(st, 'player').filter((h) => wantedByNpc(st, h.item) && h.item.state !== 'spent');
  const mates = active(st.groups.npc);
  const broken = st.groups.npc.members.filter((m) => m.resolve <= 0).length;
  const w: [ActionId, number][] = [];
  const opt = (a: ActionId, n: number) => legal.includes(a) && w.push([a, n * lean(a)]);

  if (st.fight) {
    opt('strike', 5);
    opt('guard', actor.resolve <= 3 ? 2 : 0.5);
    opt('use', actor.resolve <= 3 ? 4 : 0.5);
    opt('press', 1);
    opt('rally', leader && mates.some((m) => m.resolve <= 4) ? 3 : 0);
    opt('take', st.seizing && wantedOnTable.length ? 4 : 0.3);
    opt('withdraw', leader && broken >= ag.breakAt - 1 ? 2 : 0);
    opt('propose', leader && broken >= 1 ? 1.5 : 0);
  } else {
    opt('parley', st.disposition < 2 ? 2 : 0.5);
    opt('press', st.disposition <= -1 ? 1.5 : 0.6);
    opt('take', ag.takes && wantedOnTable.length ? 1.2 : 0);
    opt('read', st.round === 1 ? 1 : 0.2);
    opt('guard', 0.4);
    opt('sway', targetsFor(st, actor, 'sway').some((t) => t.resolve <= 4) ? 3 : 0.15);
    opt('propose', leader && wantedOnTable.length && st.round >= 2 && st.round - st.lastDemandRound >= 2 ? 3 : 0);
    opt('strike', st.disposition <= -2 ? 0.8 : 0);
    opt('rally', leader && mates.some((m) => m.resolve <= 3) ? 2 : 0);
  }
  const action = weighted(st, w.length ? w : [['guard', 1]]);
  const choice: Choice = { action };
  const foes = active(pl);
  switch (action) {
    case 'parley':
    case 'press': {
      const ldr = foes.find((f) => f.id === pl.leaderId);
      choice.targetId = ldr && d6(st) <= 4 ? ldr.id : foes[d6(st) % foes.length]?.id;
      break;
    }
    case 'strike':
      choice.targetId = lowest(foes)?.id;
      choice.itemId = weaponsOf(actor)[0]?.id;
      break;
    case 'sway':
      choice.targetId = lowest(targetsFor(st, actor, 'sway'))?.id;
      break;
    case 'take': {
      const pickFrom = itemsFor(st, actor, 'take');
      const want = pickFrom.filter((i) => wantedByNpc(st, i));
      choice.itemId = (want.length ? want : pickFrom).sort((a, b) => b.value - a.value)[0]?.id;
      break;
    }
    case 'use':
      choice.itemId = itemsFor(st, actor, 'use')[0]?.id;
      break;
    case 'propose': {
      const need = Math.max(1, price(st) - st.received);
      choice.ask = wantedOnTable.slice(0, need).map((h) => h.item.id);
      choice.give = heldItems(st, 'npc')
        .filter((h) => h.item.tags.some((t) => ag.offers.includes(t)))
        .map((h) => h.item.id);
      if (st.fight) choice.ask = choice.ask.slice(0, 1);
      break;
    }
  }
  return choice;
}

// ── player autopilot (used by sim, and as a "suggest" helper) ───────
const objTags = (st: EncounterState, type: 'hold' | 'obtain' | 'deliver') =>
  st.scenario.objectives.flatMap((o) => (o.check.type === type ? [o.check.tag] : []));

export function autoChoice(st: EncounterState, actorId: string): Choice {
  const actor = find(st, actorId)!;
  const legal = legalActions(st, actorId);
  const side = sideOf(st, actorId)!;
  const npc = st.groups[other(side)];
  const foes = active(npc);
  const keep = objTags(st, 'hold');
  const obtain = objTags(st, 'obtain');
  const deliver = objTags(st, 'deliver');
  const expendable = (i: Item) => !i.tags.some((t) => keep.includes(t) || obtain.includes(t));
  const leaderT = foes.find((f) => f.id === npc.leaderId && npc.leaderKnown) ?? foes[0];

  if (legal.includes('propose')) {
    const give = heldItems(st, 'player')
      .filter((h) => (wantedByNpc(st, h.item) || h.item.tags.some((t) => deliver.includes(t))) && expendable(h.item))
      .slice(0, Math.max(1, price(st) - st.received))
      .map((h) => h.item.id);
    const ask = heldItems(st, 'npc').filter((h) => h.item.tags.some((t) => obtain.includes(t))).map((h) => h.item.id);
    if (judge(st, { from: 'player', give, ask, join: false }).accept) return { action: 'propose', give, ask };
  }
  if (st.fight) {
    if (legal.includes('use') && actor.resolve <= 3) return { action: 'use', itemId: itemsFor(st, actor, 'use')[0].id };
    if (legal.includes('withdraw') && (active(st.groups.player).length <= 1 || !legal.includes('strike'))) return { action: 'withdraw' };
    if (legal.includes('strike')) return { action: 'strike', targetId: lowest(foes)?.id, itemId: weaponsOf(actor)[0]?.id };
    return { action: legal.includes('rally') ? 'rally' : 'guard' };
  }
  const theyHoldGoal = heldItems(st, 'npc').some((h) => h.item.tags.some((t) => obtain.includes(t)));
  const giveable = legal.includes('give') && !theyHoldGoal
    ? itemsFor(st, actor, 'give').filter((i) => (wantedByNpc(st, i) || i.tags.some((t) => deliver.includes(t))) && expendable(i))
    : [];
  if (giveable.length && d6(st) <= 3) return { action: 'give', itemId: giveable[0].id };
  if (legal.includes('read') && !npc.leaderKnown && d6(st) <= 3) return { action: 'read', targetId: foes[d6(st) % foes.length].id };
  const grab = legal.includes('take') ? itemsFor(st, actor, 'take').filter((i) => i.tags.some((t) => obtain.includes(t))) : [];
  if (grab.length && actor.attrs.wits >= 4 && d6(st) <= 2) return { action: 'take', itemId: grab[0].id };
  if (legal.includes('use') && itemsFor(st, actor, 'use').some((i) => i.effect?.type === 'scare') && d6(st) <= 2)
    return { action: 'use', itemId: itemsFor(st, actor, 'use').find((i) => i.effect?.type === 'scare')!.id };
  if (legal.includes('parley') && leaderT) return { action: 'parley', targetId: leaderT.id };
  if (legal.includes('press') && foes.length && has(actor, 'human') && actor.attrs.might >= 4) return { action: 'press', targetId: leaderT?.id };
  return { action: 'guard' };
}

/** Autopilot answer to an NPC proposal: accept unless it costs an objective item. */
export function autoRespond(st: EncounterState): boolean {
  const p = st.pending;
  if (!p) return false;
  const keep = st.scenario.objectives.flatMap((o) => (o.primary && (o.check.type === 'hold' || o.check.type === 'obtain') ? [o.check.tag] : []));
  return !p.ask.some((id) => heldItems(st, 'player').find((h) => h.item.id === id)?.item.tags.some((t) => keep.includes(t)));
}
