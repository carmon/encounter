import { describe, expect, it } from 'vitest';
import { ROSTER } from '../src/content/roster';
import { SCENARIOS } from '../src/content/scenarios';
import { judge, legalActions } from '../src/engine/actions';
import { playOut } from '../src/engine/autoplay';
import { buildOutput, createEncounter, currentStep, step } from '../src/engine/encounter';
import { find, heldItems, price } from '../src/engine/rules';
import type { EncounterState } from '../src/engine/types';

const party = (ids = ['maren', 'ines', 'brannoc']) => ids.map((id) => ROSTER.find((c) => c.id === id)!);
const scn = (id: string) => SCENARIOS.find((s) => s.id === id)!;
const itemIds = (st: EncounterState) => [...heldItems(st, 'player'), ...heldItems(st, 'npc')].map((h) => h.item.id).sort();
const charIds = (st: EncounterState) => [...st.groups.player.members, ...st.groups.npc.members].map((m) => m.id).sort();

describe('encounter engine', () => {
  it('is deterministic for a seed', () => {
    const a = playOut(createEncounter(scn('ford'), party(), 42));
    const b = playOut(createEncounter(scn('ford'), party(), 42));
    expect(a.log.map((l) => l.text)).toEqual(b.log.map((l) => l.text));
  });

  it('player leader always acts first in a round', () => {
    const st = createEncounter(scn('rendezvous'), party(['pell', 'maren', 'corwin']), 7);
    expect(st.plan[0]).toEqual({ side: 'player', actorId: 'pell' });
  });

  it('never ends with the input 1 group unresolved, and never stalls', () => {
    for (const s of SCENARIOS)
      for (let seed = 1; seed <= 60; seed++) {
        const st = playOut(createEncounter(s, party(), seed * 977));
        expect(st.outcome, `${s.id} seed ${seed}`).not.toBe('ongoing');
        const out = buildOutput(st);
        expect(out.groups.length).toBeGreaterThanOrEqual(1);
        expect(out.groups.length).toBeLessThanOrEqual(2);
        expect(out.groups.length + out.eliminated.length).toBe(2);
      }
  });

  it('conserves items and characters (they move, they are never duplicated or lost)', () => {
    for (const s of SCENARIOS)
      for (let seed = 1; seed <= 60; seed++) {
        const start = createEncounter(s, party(['pell', 'tamsin', 'sabeth']), seed * 131);
        const end = playOut(start);
        expect(itemIds(end)).toEqual(itemIds(start));
        expect(charIds(end)).toEqual(charIds(start));
      }
  });

  it('price drops as disposition rises', () => {
    const st = createEncounter(scn('ford'), party(), 1);
    st.disposition = 0;
    const cold = price(st);
    st.disposition = 2;
    expect(price(st)).toBeLessThan(cold);
  });

  it('rejects terms that leave their want unmet, accepts a fair trade when warm', () => {
    const st = createEncounter(scn('rendezvous'), party(), 1);
    const token = st.groups.player.items.find((i) => i.tags.includes('token'))!.id;
    const coin = st.groups.player.items.find((i) => i.tags.includes('coin'))!.id;
    const ledger = st.groups.npc.items[0].id;
    expect(judge(st, { from: 'player', give: [token], ask: [ledger], join: false }).accept).toBe(false);
    st.disposition = 2;
    expect(judge(st, { from: 'player', give: [token, coin], ask: [ledger], join: false }).accept).toBe(true);
  });

  it('mundane steel cannot touch the dead; blessed steel can', () => {
    const st = createEncounter(scn('haunt'), party(['brannoc', 'ines', 'maren']), 3);
    expect(legalActions(st, 'brannoc')).not.toContain('strike');
    expect(legalActions(st, 'ines')).toContain('strike');
  });

  it('beasts cannot be negotiated with in words', () => {
    const st = createEncounter(scn('pack'), party(), 3);
    const s = currentStep(st)!;
    expect(legalActions(st, s.actorId)).not.toContain('propose');
    expect(legalActions(st, s.actorId)).toContain('parley'); // shown as Soothe
  });

  it('illegal choices are ignored, not applied', () => {
    const st = createEncounter(scn('haunt'), party(['brannoc', 'ines', 'maren']), 3);
    const next = step(st, { action: 'strike' });
    expect(next.fight).toBe(false);
    expect(find(next, 'brannoc')).toBeTruthy();
  });
});
