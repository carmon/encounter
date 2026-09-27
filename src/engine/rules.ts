import type {
  ActionId,
  Attr,
  Character,
  EncounterState,
  Group,
  InitiativeRoll,
  Item,
  LogEntry,
  Outcome,
  Side,
} from './types';

export const DISPOSITION_LABELS = ['Hostile', 'Wary', 'Neutral', 'Open', 'Allied'];
export const ATTR_SHORT: Record<Attr, string> = { might: 'MGT', wits: 'WIT', charm: 'CHA', nerve: 'NRV' };

export const other = (s: Side): Side => (s === 'player' ? 'npc' : 'player');
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── dice ────────────────────────────────────────────────────────────
export function d6(st: EncounterState): number {
  st.rng = (Math.imul(st.rng, 1103515245) + 12345) >>> 0;
  return ((st.rng >>> 8) % 6) + 1;
}

export function pick<T>(st: EncounterState, arr: T[]): T {
  return arr[(d6(st) * 7 + d6(st)) % arr.length];
}

export interface Opposed {
  margin: number;
  aDie: number;
  text: string;
}

export function opposed(st: EncounterState, aLabel: string, a: number, bLabel: string, b: number): Opposed {
  const aDie = d6(st);
  const bDie = d6(st);
  return { margin: a + aDie - (b + bDie), aDie, text: `${aLabel} ${a}+${aDie} vs ${bLabel} ${b}+${bDie}` };
}

// ── lookups ─────────────────────────────────────────────────────────
export function sideOf(st: EncounterState, id: string): Side | undefined {
  if (st.groups.player.members.some((m) => m.id === id)) return 'player';
  if (st.groups.npc.members.some((m) => m.id === id)) return 'npc';
  return undefined;
}

export function find(st: EncounterState, id: string): Character | undefined {
  return st.groups.player.members.find((m) => m.id === id) ?? st.groups.npc.members.find((m) => m.id === id);
}

export const active = (g: Group) => g.members.filter((m) => m.resolve > 0);
export const leaderOf = (g: Group) => g.members.find((m) => m.id === g.leaderId);
export const isLeader = (st: EncounterState, c: Character) => {
  const s = sideOf(st, c.id);
  return !!s && st.groups[s].leaderId === c.id;
};
export const has = (c: Character, tag: string) => c.tags.includes(tag);

export function itemPower(it: Item): number {
  if (!it.effect || !('power' in it.effect)) return 0;
  if (it.state === 'broken' || it.state === 'spent') return 0;
  return it.state === 'worn' ? Math.max(0, it.effect.power - 1) : it.effect.power;
}

export const usable = (it: Item) => it.state !== 'broken' && it.state !== 'spent';
/** Natural weapons (fangs, grave chill) can't be traded, taken or looted. */
export const tradable = (it: Item) => it.state !== 'spent' && !it.tags.includes('natural');

export function weaponsOf(c: Character): Item[] {
  return c.items.filter((i) => i.effect?.type === 'weapon' && usable(i));
}

export function bestWard(c: Character): Item | undefined {
  return c.items
    .filter((i) => i.effect?.type === 'ward' && usable(i))
    .sort((a, b) => itemPower(b) - itemPower(a))[0];
}

export function wear(st: EncounterState, it: Item, why: string) {
  if (it.state === 'intact') it.state = 'worn';
  else if (it.state === 'worn') it.state = 'broken';
  else return;
  log(st, 'info', `${it.name} is ${it.state} (${why}).`, `${it.name}: ${it.state}`);
}

export function spendUse(st: EncounterState, it: Item) {
  it.uses = Math.max(0, (it.uses ?? 1) - 1);
  if (it.uses === 0) {
    it.state = 'spent';
    log(st, 'info', `${it.name} is used up.`);
  }
}

// ── derived properties ──────────────────────────────────────────────
export function attr(st: EncounterState, c: Character, a: Attr): number {
  let v = c.attrs[a];
  for (const it of c.items) if (it.effect?.type === 'boost' && it.effect.attr === a) v += itemPower(it);
  if (c.resolve <= 3 && (a === 'might' || a === 'charm')) v -= 1;
  const s = sideOf(st, c.id);
  if (s && a === 'nerve') {
    const ldr = leaderOf(st.groups[s]);
    if (ldr && ldr.id !== c.id && ldr.resolve > 0 && ldr.attrs.nerve >= 4) v += 1;
  }
  return Math.max(0, v);
}

export function rollInitiative(st: EncounterState, c: Character): InitiativeRoll {
  const die = d6(st);
  const parts = [`WIT ${attr(st, c, 'wits')}`, `d6 ${die}`];
  let v = attr(st, c, 'wits') + die;
  if (isLeader(st, c)) (v += 1), parts.push('leader +1');
  if (st.fight && weaponsOf(c).length) (v += 1), parts.push('armed +1');
  if (c.resolve <= 3) (v -= 2), parts.push('shaken −2');
  const mo = st.momentum[c.id] ?? 0;
  if (mo) (v += mo), parts.push(`momentum ${mo > 0 ? '+' : ''}${mo}`);
  return { value: v, parts: parts.join(' · ') };
}

export function bump(st: EncounterState, c: Character, n: number) {
  st.momentum[c.id] = clamp((st.momentum[c.id] ?? 0) + n, -2, 2);
}

// ── speech ──────────────────────────────────────────────────────────
export function sharesTongue(c: Character, others: Character[]) {
  return others.some((o) => o.tongues.some((t) => c.tongues.includes(t)));
}

export function canSpeak(st: EncounterState): boolean {
  if (st.scenario.speech === 'none') return false;
  const them = active(st.groups.npc);
  return active(st.groups.player).some((m) => sharesTongue(m, them));
}

// ── items ───────────────────────────────────────────────────────────
export interface Held {
  side: Side;
  holder: Character | null;
  item: Item;
}

export function heldItems(st: EncounterState, side: Side): Held[] {
  const g = st.groups[side];
  const out: Held[] = g.items.map((item) => ({ side, holder: null, item }));
  for (const m of g.members) for (const item of m.items) out.push({ side, holder: m, item });
  return out;
}

export function findItem(st: EncounterState, id: string): Held | undefined {
  return [...heldItems(st, 'player'), ...heldItems(st, 'npc')].find((h) => h.item.id === id);
}

/** How many wanted items the NPC side still asks for. Drops as disposition rises. */
export function price(st: EncounterState): number {
  const ag = st.scenario.agenda;
  if (ag.wantCount <= 0) return 0;
  return Math.max(1, ag.wantCount + ag.acceptAt - st.disposition);
}

/** Can the player side see this NPC item? Gear in plain sight (weapons, wards, worn trinkets) yes; the rest needs a Read. */
export function visibleToPlayer(st: EncounterState, h: Held): boolean {
  if (h.side === 'player' || st.known.items) return true;
  return !!h.holder && !!h.item.effect && ['weapon', 'ward', 'boost'].includes(h.item.effect.type);
}

export const wantedByNpc = (st: EncounterState, it: Item) => it.tags.some((t) => st.scenario.agenda.wants.includes(t));

export function groupLabel(st: EncounterState, side: Side) {
  return st.groups[side].name;
}

export function moveItem(st: EncounterState, id: string, to: Side, toHolder: Character | null, how: string) {
  const h = findItem(st, id);
  if (!h) return;
  const fromArr = h.holder ? h.holder.items : st.groups[h.side].items;
  fromArr.splice(fromArr.indexOf(h.item), 1);
  const personal = h.item.kind !== 'group' && toHolder;
  (personal ? toHolder.items : st.groups[to].items).push(h.item);
  const fromName = h.holder ? `${h.holder.name} (${groupLabel(st, h.side)})` : groupLabel(st, h.side);
  const toName = personal ? `${toHolder.name} (${groupLabel(st, to)})` : groupLabel(st, to);
  st.transfers.push({ kind: 'item', id, name: h.item.name, from: fromName, to: toName, round: st.round, how });
  if (to === 'npc' && h.side === 'player' && wantedByNpc(st, h.item)) st.received += 1;
}

export function moveCharacter(st: EncounterState, id: string, to: Side, how: string) {
  const from = sideOf(st, id);
  if (!from || from === to) return;
  const g = st.groups[from];
  const c = g.members.find((m) => m.id === id)!;
  g.members.splice(g.members.indexOf(c), 1);
  st.groups[to].members.push(c);
  st.guarding = st.guarding.filter((x) => x !== id);
  st.plan = st.plan.map((p, i) => (i > st.cursor && p.actorId === id ? { side: to, actorId: id } : p));
  st.transfers.push({ kind: 'character', id, name: c.name, from: groupLabel(st, from), to: groupLabel(st, to), round: st.round, how });
}

// ── logging & state ─────────────────────────────────────────────────
export function log(st: EncounterState, kind: LogEntry['kind'], text: string, delta?: string, roll?: string) {
  st.log.push({ round: st.round, kind, text, delta, roll });
}

export function shiftDisposition(st: EncounterState, n: number) {
  st.disposition = clamp(st.disposition + n, -2, 2);
}

export function shiftTension(st: EncounterState, n: number) {
  st.tension = clamp(st.tension + n, 0, st.scenario.tensionMax);
}

export function end(st: EncounterState, outcome: Outcome, text: string) {
  if (st.outcome !== 'ongoing') return;
  st.outcome = outcome;
  st.endText = text;
  log(st, 'end', text);
}

export function startFight(st: EncounterState, text: string) {
  if (st.fight) return;
  st.fight = true;
  st.tension = st.scenario.tensionMax;
  st.disposition = Math.min(st.disposition, -1);
  st.pending = null;
  log(st, 'bad', text, 'FIGHT');
}

export function verb(st: EncounterState, a: ActionId, actor?: Character): string {
  if (actor && has(actor, 'spirit') && a === 'sway') return 'Possess';
  if (actor && has(actor, 'beast')) {
    if (a === 'press') return 'Snarl';
    if (a === 'strike') return 'Bite';
    if (a === 'take') return 'Snatch';
  }
  return st.scenario.verbs?.[a] ?? DEFAULT_VERBS[a];
}

export const DEFAULT_VERBS: Record<ActionId, string> = {
  parley: 'Parley',
  press: 'Press',
  read: 'Read',
  strike: 'Strike',
  use: 'Use item',
  give: 'Give',
  take: 'Take',
  guard: 'Guard',
  sway: 'Sway',
  rally: 'Rally',
  propose: 'Propose',
  withdraw: 'Withdraw',
};

/** Applies damage to resolve and handles broken/leader-fall/rout checks. */
export function hurt(st: EncounterState, c: Character, n: number) {
  c.resolve = clamp(c.resolve - n, 0, c.maxResolve);
  bump(st, c, -1);
  if (c.resolve === 0) {
    const s = sideOf(st, c.id)!;
    if (!st.fallen.includes(c.id)) st.fallen.push(c.id);
    log(st, s === 'player' ? 'bad' : 'good', `${c.name} is broken and out of the encounter.`);
  }
  checkBreaks(st);
}

function successorCheck(st: EncounterState, side: Side): boolean {
  const g = st.groups[side];
  const ldr = leaderOf(g);
  if (!ldr || ldr.resolve > 0 || st.leaderChecked.includes(ldr.id)) return true;
  st.leaderChecked.push(ldr.id);
  const next = active(g).sort((a, b) => b.attrs.nerve - a.attrs.nerve)[0];
  if (!next) return false;
  const die = d6(st);
  const ok = next.attrs.nerve + die >= 7;
  if (ok) {
    g.leaderId = next.id;
    if (side === 'npc') g.leaderKnown = true;
    log(st, side === 'player' ? 'good' : 'info', `${ldr.name} falls — ${next.name} takes charge.`, undefined, `NRV ${next.attrs.nerve}+${die} ≥ 7`);
  }
  return ok;
}

export function checkBreaks(st: EncounterState) {
  if (st.outcome !== 'ongoing') return;
  const npc = st.groups.npc;
  const npcBroken = npc.members.filter((m) => m.resolve <= 0).length;
  if (active(npc).length === 0 || npcBroken >= st.scenario.agenda.breakAt) {
    return end(st, 'rout', `${npc.name} break and scatter. The field is yours.`);
  }
  if (!successorCheck(st, 'npc')) {
    return end(st, 'rout', `With their leader down, ${npc.name} lose their nerve and scatter.`);
  }
  if (active(st.groups.player).length === 0) {
    return end(st, 'defeat', 'Your whole group is broken.');
  }
  if (!successorCheck(st, 'player')) {
    return end(st, 'defeat', 'Your leader falls and nobody holds the group together.');
  }
}
