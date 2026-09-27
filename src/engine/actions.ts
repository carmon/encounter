import type { ActionId, Character, Choice, EncounterState, Item, Proposal, Side } from './types';
import {
  ATTR_SHORT,
  active,
  attr,
  bestWard,
  bump,
  canSpeak,
  clamp,
  d6,
  end,
  find,
  findItem,
  has,
  heldItems,
  hurt,
  isLeader,
  itemPower,
  leaderOf,
  log,
  moveCharacter,
  moveItem,
  opposed,
  other,
  price,
  sharesTongue,
  shiftDisposition,
  shiftTension,
  sideOf,
  spendUse,
  startFight,
  tradable,
  usable,
  verb,
  visibleToPlayer,
  wantedByNpc,
  wear,
  weaponsOf,
} from './rules';

export const LEADER_ONLY: ActionId[] = ['rally', 'propose', 'withdraw'];
export const NEEDS_TARGET: ActionId[] = ['parley', 'press', 'read', 'strike', 'sway'];

const good = (side: Side) => (side === 'player' ? 'good' : 'bad');
const bad = (side: Side) => (side === 'player' ? 'bad' : 'good');

function weak(t: Character, a: ActionId) {
  return t.temperament.weakTo?.[a] ?? 0;
}

// ── availability ────────────────────────────────────────────────────
export function targetsFor(st: EncounterState, actor: Character, a: ActionId): Character[] {
  const side = sideOf(st, actor.id)!;
  const foes = active(st.groups[other(side)]);
  if (a === 'sway') {
    const g = st.groups[other(side)];
    return foes.filter((f) => f.id !== g.leaderId && (has(actor, 'spirit') ? f.resolve <= 5 && !has(f, 'spirit') : true));
  }
  if (a === 'use') return active(st.groups[side]);
  return foes;
}

/** Items the actor could hand over / take / use for this action. */
export function itemsFor(st: EncounterState, actor: Character, a: ActionId): Item[] {
  const side = sideOf(st, actor.id)!;
  if (a === 'give') {
    return [...actor.items, ...st.groups[side].items].filter(tradable);
  }
  if (a === 'take') {
    const theirs = heldItems(st, other(side)).filter((h) => tradable(h.item));
    return theirs.filter((h) => side === 'npc' || visibleToPlayer(st, h)).map((h) => h.item);
  }
  if (a === 'use') return actor.items.filter((i) => i.kind === 'consumable' && usable(i) && i.effect && i.effect.type !== 'weapon');
  if (a === 'strike') return weaponsOf(actor);
  return [];
}

export function legalActions(st: EncounterState, actorId: string): ActionId[] {
  const actor = find(st, actorId);
  if (!actor || actor.resolve <= 0 || st.outcome !== 'ongoing') return [];
  const side = sideOf(st, actorId)!;
  const leader = isLeader(st, actor);
  const speak = canSpeak(st);
  const foeSpirits = active(st.groups[other(side)]).every((f) => has(f, 'spirit'));
  const out: ActionId[] = [];
  const add = (a: ActionId, ok: boolean) => ok && out.push(a);

  add('parley', !st.fight && (speak || st.scenario.speech === 'none'));
  add('press', true);
  add('read', side === 'player' || actor.temperament.id === 'wary');
  add('strike', !foeSpirits || weaponsOf(actor).some((w) => w.tags.includes('blessed')) || has(actor, 'spirit'));
  add('use', itemsFor(st, actor, 'use').length > 0);
  add('give', !st.fight && itemsFor(st, actor, 'give').length > 0);
  add('take', itemsFor(st, actor, 'take').length > 0);
  add('guard', true);
  add('sway', !st.fight && targetsFor(st, actor, 'sway').length > 0 && (has(actor, 'spirit') || (speak && st.disposition >= 0)));
  if (leader) {
    add('rally', active(st.groups[side]).some((m) => m.resolve < m.maxResolve));
    add('propose', speak && !st.pending);
    add('withdraw', true);
  }
  return out;
}

// ── proposals ───────────────────────────────────────────────────────
export interface Verdict {
  accept: boolean;
  score: number;
  reason: string;
}

/** How the NPC side judges a proposal made by the player. */
export function judge(st: EncounterState, p: Proposal): Verdict {
  const ag = st.scenario.agenda;
  const items = (ids: string[]) => ids.map((id) => findItem(st, id)?.item).filter((i): i is Item => !!i);
  const given = items(p.give);
  const asked = items(p.ask);
  const giveVal = given.reduce((s, i) => s + i.value * (wantedByNpc(st, i) ? 2 : 1), 0);
  const askVal = asked.reduce((s, i) => {
    const mult = i.tags.some((t) => ag.offers.includes(t)) ? 1 : i.tags.some((t) => ag.guards.includes(t)) ? 3 : 2;
    return s + i.value * mult;
  }, 0);
  const wantedGiven = given.filter((i) => wantedByNpc(st, i)).length;
  const need = price(st);
  const short = ag.wantCount > 0 ? need - (st.received + wantedGiven) : 0;
  const broken = st.groups.npc.members.filter((m) => m.resolve <= 0).length;
  const join = p.join ? 3 : 0;
  const score = giveVal - askVal + 2 * (st.disposition - ag.acceptAt) + broken - join - (st.fight ? 1 : 0);
  if (p.join && (!ag.canAlly || st.disposition < 2)) return { accept: false, score, reason: 'They will not bind themselves to you — not like this.' };
  if (st.disposition < ag.acceptAt - 1 && broken < 2) return { accept: false, score, reason: 'Relations are too cold to talk terms.' };
  if (short > 0 && broken < 2) return { accept: false, score, reason: `They want more of what they came for (${short} short).` };
  if (score < 0) return { accept: false, score, reason: askVal > giveVal ? 'You ask too much for too little.' : 'They are not moved.' };
  return { accept: true, score, reason: 'Terms accepted.' };
}

export function applyProposal(st: EncounterState, p: Proposal, proposerSide: Side) {
  const recvSide = other(proposerSide);
  const recvLeader = leaderOf(st.groups[recvSide]) ?? null;
  const propLeader = leaderOf(st.groups[proposerSide]) ?? null;
  for (const id of p.give) moveItem(st, id, recvSide, recvLeader, 'terms');
  for (const id of p.ask) moveItem(st, id, proposerSide, propLeader, 'terms');
  const parts = [p.give.length ? `${p.give.length} given` : '', p.ask.length ? `${p.ask.length} received` : ''].filter(Boolean).join(', ');
  if (p.join) {
    const npc = st.groups.npc;
    for (const m of [...npc.members]) moveCharacter(st, m.id, 'player', 'alliance');
    for (const it of [...npc.items]) moveItem(st, it.id, 'player', null, 'alliance');
    st.eliminated.push('npc');
    end(st, 'alliance', `The two groups become one. ${parts ? `(${parts})` : ''}`.trim());
  } else {
    end(st, 'accord', `Terms are struck${parts ? ` — ${parts}` : ''}. Both groups go their way.`);
  }
}

// ── resolution ──────────────────────────────────────────────────────
function socialTarget(st: EncounterState, actor: Character, c: Choice): Character | undefined {
  const t = c.targetId ? find(st, c.targetId) : undefined;
  if (t && t.resolve > 0 && sideOf(st, t.id) !== sideOf(st, actor.id)) return t;
  const g = st.groups[other(sideOf(st, actor.id)!)];
  return active(g).find((m) => m.id === g.leaderId) ?? active(g)[0];
}

export function resolve(st: EncounterState, actor: Character, c: Choice) {
  const side = sideOf(st, actor.id)!;
  const opp = other(side);
  st.guarding = st.guarding.filter((id) => id !== actor.id);
  const V = verb(st, c.action, actor);

  switch (c.action) {
    case 'parley': {
      const t = socialTarget(st, actor, c);
      if (!t) return;
      const soothe = st.scenario.speech === 'none';
      const relay = !soothe && !sharesTongue(actor, active(st.groups[opp])) ? -1 : 0;
      const a = attr(st, actor, 'charm') + relay + weak(t, 'parley');
      const bKey = soothe ? 'nerve' : 'charm';
      const r = opposed(st, 'CHA', a, ATTR_SHORT[bKey], attr(st, t, bKey));
      const tLeads = isLeader(st, t);
      if (r.margin > 0) {
        let gain = tLeads ? (r.margin >= 3 ? 2 : 1) : r.margin >= 3 ? 1 : 0;
        if (soothe) gain = Math.min(gain, 1);
        if (gain) {
          shiftDisposition(st, gain);
          shiftTension(st, -1);
          bump(st, actor, 1);
          log(st, 'good', `${actor.name} ${soothe ? 'calms' : 'reaches'} ${t.name}. The mood eases.`, `disposition +${gain} · tension −1`, r.text);
        } else {
          log(st, 'info', `${actor.name} gets through to ${t.name}, but ${t.name} looks to someone else to decide.`, undefined, r.text);
        }
        if (tLeads && r.margin >= 3 && side === 'player' && !st.groups.npc.leaderKnown) {
          st.groups.npc.leaderKnown = true;
          log(st, 'good', `${t.name} answers for all of them — they are the leader.`, 'leader revealed');
        }
      } else if (r.margin <= -3 && side === 'player') {
        shiftDisposition(st, -1);
        log(st, 'bad', `${actor.name}'s words land badly with ${t.name}.`, 'disposition −1', r.text);
      } else {
        log(st, 'info', `${actor.name} ${V.toLowerCase()}s with ${t.name}; nothing moves.`, undefined, r.text);
      }
      return;
    }

    case 'press': {
      const t = socialTarget(st, actor, c);
      if (!t) return;
      const key = has(t, 'spirit') || has(actor, 'spirit') ? 'nerve' : 'might';
      const r = opposed(st, ATTR_SHORT[key], attr(st, actor, key) + weak(t, 'press'), 'NRV', attr(st, t, 'nerve'));
      shiftTension(st, 1);
      if (r.margin > 0) {
        const loss = r.margin >= 3 ? 3 : 2;
        shiftDisposition(st, -1);
        bump(st, actor, 1);
        log(st, good(side), `${actor.name} ${V === 'Snarl' ? 'snarls at' : 'bears down on'} ${t.name}. ${t.name} falters.`, `${t.name} resolve −${loss} · disposition −1`, r.text);
        hurt(st, t, loss);
      } else {
        log(st, 'info', `${t.name} holds against ${actor.name}'s pressure.`, 'tension +1', r.text);
      }
      return;
    }

    case 'read': {
      const t = socialTarget(st, actor, c);
      if (!t) return;
      const die = d6(st);
      const v = attr(st, actor, 'wits') + die + weak(t, 'read');
      const roll = `WIT ${attr(st, actor, 'wits')}+${die}${weak(t, 'read') ? ` ${weak(t, 'read')}` : ''} = ${v}`;
      if (side === 'npc') {
        bump(st, actor, 1);
        log(st, 'info', `${actor.name} watches your group closely.`, 'their momentum +1', roll);
        return;
      }
      if (v < 7) return log(st, 'info', `${actor.name} studies ${t.name} but learns little.`, undefined, roll);
      const found: string[] = [];
      if (!st.known.attrs.includes(t.id)) st.known.attrs.push(t.id), found.push('abilities');
      if (v >= 9) {
        const g = st.groups.npc;
        if (!g.leaderKnown) {
          if (t.id === g.leaderId) (g.leaderKnown = true), found.push('they lead');
          else found.push('not the leader');
        }
        if (!st.known.items) (st.known.items = true), found.push('their holdings');
        if (st.known.agenda < 1) (st.known.agenda = 1), found.push('a hint of intent');
      }
      if (v >= 11 && st.known.agenda < 2) (st.known.agenda = 2), (st.groups.npc.leaderKnown = true), found.push('their true agenda');
      bump(st, actor, 1);
      log(st, 'good', `${actor.name} reads ${t.name}: ${found.join(', ') || 'nothing new'}.`, undefined, roll);
      return;
    }

    case 'strike': {
      const t = c.targetId ? find(st, c.targetId) : undefined;
      const tgt = t && t.resolve > 0 && sideOf(st, t.id) === opp ? t : active(st.groups[opp]).sort((a, b) => a.resolve - b.resolve)[0];
      if (!tgt) return;
      const weapon = (c.itemId && weaponsOf(actor).find((w) => w.id === c.itemId)) || weaponsOf(actor)[0];
      startFight(st, `${actor.name} goes for ${tgt.name} — it is a fight now.`);
      if (has(tgt, 'spirit') && !has(actor, 'spirit') && !weapon?.tags.includes('blessed')) {
        return log(st, bad(side), `${actor.name}'s blow passes straight through ${tgt.name}.`);
      }
      const power = weapon ? itemPower(weapon) : -1;
      const chill = has(actor, 'spirit');
      const ward = chill ? undefined : bestWard(tgt);
      const guard = st.guarding.includes(tgt.id) ? 2 : 0;
      const key = chill ? 'nerve' : 'might';
      const r = opposed(st, ATTR_SHORT[key], attr(st, actor, key) + power, ATTR_SHORT[key], attr(st, tgt, key) + (ward ? itemPower(ward) : 0) + guard);
      const withWhat = weapon ? ` with ${weapon.name}` : ' bare-handed';
      if (r.aDie === 1 && weapon && !weapon.tags.includes('natural')) wear(st, weapon, 'a bad swing');
      if (r.margin > 0) {
        const dmg = clamp(2 + (r.margin >= 3 ? 1 : 0) + (power >= 2 && r.margin >= 3 ? 1 : 0), 2, 4);
        if (ward && r.margin >= 3) wear(st, ward, 'took the blow');
        bump(st, actor, 1);
        log(st, good(side), `${actor.name} strikes ${tgt.name}${withWhat}.`, `${tgt.name} resolve −${dmg}`, r.text);
        hurt(st, tgt, dmg);
      } else if (guard) {
        log(st, bad(side), `${tgt.name} turns the blow and counters ${actor.name}.`, `${actor.name} resolve −1`, r.text);
        hurt(st, actor, 1);
      } else {
        log(st, 'info', `${actor.name} swings${withWhat} at ${tgt.name} and misses.`, undefined, r.text);
      }
      return;
    }

    case 'use': {
      const it = actor.items.find((i) => i.id === c.itemId && usable(i)) ?? itemsFor(st, actor, 'use')[0];
      if (!it?.effect) return;
      const e = it.effect;
      if (e.type === 'heal') {
        const t = (c.targetId && find(st, c.targetId)) || active(st.groups[side]).sort((a, b) => a.resolve / a.maxResolve - b.resolve / b.maxResolve)[0];
        if (!t || sideOf(st, t.id) !== side) return;
        const before = t.resolve;
        t.resolve = clamp(t.resolve + e.power, 0, t.maxResolve);
        log(st, good(side), `${actor.name} uses ${it.name} on ${t.name}.`, `${t.name} resolve +${t.resolve - before}`);
      } else if (e.type === 'scare') {
        const foes = active(st.groups[opp]).filter((f) => f.tags.some((tg) => e.vs.includes(tg)));
        log(st, good(side), `${actor.name} brandishes ${it.name}.`, 'tension +1');
        shiftTension(st, 1);
        for (const f of foes) {
          const r = opposed(st, 'NRV', attr(st, actor, 'nerve') + itemPower(it), 'NRV', attr(st, f, 'nerve'));
          if (r.margin > 0) {
            log(st, good(side), `${f.name} shies back.`, `${f.name} resolve −2`, r.text);
            hurt(st, f, 2);
            if (st.outcome !== 'ongoing') break;
          } else log(st, 'info', `${f.name} does not flinch.`, undefined, r.text);
        }
      } else if (e.type === 'smoke') {
        st.escapePrep[side] += e.power;
        log(st, good(side), `${actor.name} readies ${it.name} — a withdrawal will be easier.`, `withdraw +${e.power}`);
      }
      spendUse(st, it);
      return;
    }

    case 'give': {
      const it = itemsFor(st, actor, 'give').find((i) => i.id === c.itemId);
      if (!it) return;
      const recvLeader = leaderOf(st.groups[opp]) ?? null;
      const wanted = side === 'player' && wantedByNpc(st, it);
      moveItem(st, it.id, opp, recvLeader, 'gift');
      if (wanted) {
        const gain = st.groups.npc.members.some((m) => m.id === st.groups.npc.leaderId && m.temperament.id === 'greedy') ? 2 : 1;
        shiftDisposition(st, gain);
        shiftTension(st, -1);
        log(st, 'good', `${actor.name} hands over ${it.name}. It is exactly what they wanted.`, `disposition +${gain} · tension −1`);
      } else if (it.value >= 2 && st.disposition < 1) {
        shiftDisposition(st, 1);
        log(st, 'info', `${actor.name} offers ${it.name}. Accepted, coolly.`, 'disposition +1');
      } else {
        log(st, 'info', `${actor.name} offers ${it.name}. They take it without a word.`);
      }
      return;
    }

    case 'take': {
      const h = c.itemId ? findItem(st, c.itemId) : undefined;
      const choices = itemsFor(st, actor, 'take');
      const it = h && choices.includes(h.item) ? h.item : choices.sort((a, b) => b.value - a.value)[0];
      if (!it) return;
      const held = findItem(st, it.id)!;
      const guards = active(st.groups[opp]);
      const best = Math.max(0, ...guards.map((g) => attr(st, g, 'wits'))) + (held.holder && held.holder.resolve > 0 ? 1 : 0);
      const r = opposed(st, 'WIT', attr(st, actor, 'wits'), 'WIT', best);
      shiftDisposition(st, -1);
      if (r.margin > 0) {
        moveItem(st, it.id, side, actor, 'taken');
        shiftTension(st, 1);
        bump(st, actor, 1);
        log(st, good(side), `${actor.name} ${V === 'Snatch' ? 'snatches' : 'takes'} ${it.name}${held.holder ? ` from ${held.holder.name}` : ''}.`, 'disposition −1 · tension +1', r.text);
      } else {
        shiftTension(st, 2);
        log(st, bad(side), `${actor.name} is caught reaching for ${it.name}.`, 'disposition −1 · tension +2', r.text);
      }
      return;
    }

    case 'guard': {
      st.guarding.push(actor.id);
      if (!st.fight && actor.resolve < actor.maxResolve) {
        actor.resolve += 1;
        log(st, 'info', `${actor.name} steadies and keeps watch.`, `${actor.name} resolve +1`);
      } else log(st, 'info', `${actor.name} sets their guard.`);
      return;
    }

    case 'sway': {
      const t = c.targetId ? find(st, c.targetId) : undefined;
      const tgt = t && targetsFor(st, actor, 'sway').includes(t) ? t : targetsFor(st, actor, 'sway')[0];
      if (!tgt) return;
      const spirit = has(actor, 'spirit');
      const key = spirit ? 'nerve' : 'charm';
      const bonus = (tgt.resolve <= 3 ? 2 : 0) + (spirit ? 0 : st.disposition) + weak(tgt, 'sway');
      const r = opposed(st, ATTR_SHORT[key], attr(st, actor, key) + bonus, 'NRV', attr(st, tgt, 'nerve'));
      if (r.margin >= 2) {
        moveCharacter(st, tgt.id, side, spirit ? 'possessed' : 'swayed');
        shiftDisposition(st, -1);
        log(
          st,
          good(side),
          spirit ? `${tgt.name}'s eyes go blank. ${actor.name} has taken them.` : `${actor.name} wins ${tgt.name} over — they cross to the other side.`,
          `${tgt.name} changes group`,
          r.text,
        );
        const lost = other(side);
        if (active(st.groups[lost]).length === 0) end(st, lost === 'player' ? 'defeat' : 'rout', `Nobody is left standing with ${st.groups[lost].name}.`);
      } else {
        shiftTension(st, 1);
        log(st, 'info', `${tgt.name} resists ${actor.name}.`, 'tension +1', r.text);
      }
      return;
    }

    case 'rally': {
      const die = d6(st);
      const v = attr(st, actor, 'nerve') + die;
      const gain = v >= 9 ? 2 : v >= 6 ? 1 : 0;
      for (const m of active(st.groups[side])) m.resolve = clamp(m.resolve + gain, 0, m.maxResolve);
      log(st, gain ? good(side) : 'info', gain ? `${actor.name} rallies ${st.groups[side].name}.` : `${actor.name}'s rally falls flat.`, gain ? `group resolve +${gain}` : undefined, `NRV ${attr(st, actor, 'nerve')}+${die} = ${v}`);
      return;
    }

    case 'propose': {
      const p: Proposal = { from: side, give: c.give ?? [], ask: c.ask ?? [], join: !!c.join };
      if (side === 'npc') {
        st.pending = p;
        st.lastDemandRound = st.round;
        log(st, 'info', `${actor.name} puts terms to you.`, 'awaiting your answer');
        return;
      }
      const v = judge(st, p);
      if (v.accept) applyProposal(st, p, 'player');
      else {
        shiftTension(st, 1);
        log(st, 'bad', `${actor.name}'s proposal is refused. ${v.reason}`, 'tension +1', `score ${v.score}`);
      }
      return;
    }

    case 'withdraw': {
      if (side === 'npc') return end(st, 'parting', `${actor.name} signals, and ${st.groups.npc.name} withdraw.`);
      const best = Math.max(0, ...active(st.groups.npc).map((m) => attr(st, m, 'wits')));
      const prep = st.escapePrep.player;
      const r = opposed(st, 'WIT', attr(st, actor, 'wits') + prep, 'WIT', best);
      if (r.margin > 0) return end(st, 'escape', `${actor.name} leads the group away before anyone can stop you.`);
      shiftTension(st, 2);
      log(st, 'bad', `The withdrawal is spotted.`, 'tension +2', r.text);
      if (st.scenario.agenda.onBoil === 'fight' && !st.fight) startFight(st, 'They cut you off. Steel comes out.');
      return;
    }
  }
}
