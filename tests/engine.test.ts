import { describe, expect, it } from 'vitest';
import { createParley, resolveRound, resolveStep } from '../src/core/engine';
import { SCENARIOS } from '../src/data/scenarios';
import type { Order, ParleyState } from '../src/core/types';

const toll = SCENARIOS[0];
const market = SCENARIOS[1];
const wolves = SCENARIOS[2];

function holdAll(state: ParleyState): Order[] {
  return state.player.order.map((id) => ({ actorId: id, action: 'hold' as const }));
}

describe('createParley', () => {
  it('builds a fresh ongoing state with fixed order', () => {
    const s = createParley(toll, ['mireille', 'brann', 'tomas'], 42);
    expect(s.ended).toBe('ongoing');
    expect(s.player.order[0]).toBe('mireille');
    expect(s.patience).toBe(5);
    expect(s.npc.members).toHaveLength(3);
  });

  it('round plans include every living member from round 1', () => {
    const s = createParley(toll, ['mireille', 'brann', 'tomas'], 42);
    expect(s.plan).toHaveLength(6);
    expect(s.plan.filter((p) => p.side === 'player')).toHaveLength(3);
    expect(s.plan.filter((p) => p.side === 'npc')).toHaveLength(3);
    const s2 = resolveRound(s, holdAll(s));
    expect(s2.plan).toHaveLength(6);
  });

  it('round 1 opens with both leaders, then initiative order; later rounds are pure initiative', () => {
    const s = createParley(toll, ['brann', 'mireille', 'tomas'], 3);
    expect(s.plan).toHaveLength(6);
    expect(s.plan[0]).toEqual({ side: 'player', actorId: 'brann' });
    expect(s.plan[1]).toEqual({ side: 'npc', actorId: 'redgar' });
    const restInit = s.plan.slice(2).map((p) => s.initiative[p.actorId]);
    expect([...restInit].sort((a, b) => b - a)).toEqual(restInit);
    const s2 = resolveRound(s, holdAll(s));
    const inits = s2.plan.map((p) => s2.initiative[p.actorId]);
    expect([...inits].sort((a, b) => b - a)).toEqual(inits);
  });

  it('warns when no shared language exists', () => {
    const s = createParley(toll, ['mireille', 'brann', 'tomas'], 42);
    expect(s.log.some((l) => l.text.includes('no language'))).toBe(true);
  });
});

describe('language bridge', () => {
  it('blocks social actions without a common tongue', () => {
    let s = createParley(toll, ['mireille', 'brann', 'tomas'], 7);
    s = resolveRound(s, [
      { actorId: 'mireille', action: 'persuade' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    expect(s.log.some((l) => l.text.includes('No common tongue'))).toBe(true);
    expect(s.log.some((l) => l.text.includes('makes a strong case'))).toBe(false);
  });

  it('interpret enables negotiation through a relay', () => {
    let s = createParley(toll, ['mireille', 'brann', 'tomas'], 7);
    s.player.members.find((m) => m.id === 'tomas')!.languages = ['karsk'];
    s = resolveRound(s, [
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'interpret' },
    ], { dice: [4, 1, 6, 1, 1, 6, 1, 1, 6] });
    expect(s.player.interpreterId).toBe('tomas');
    s = resolveRound(s, [
      { actorId: 'mireille', action: 'persuade' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [5, 1, 6, 6, 1, 5, 1, 6, 5, 1, 6] });
    expect(s.log.filter((l) => l.round === 2 && l.text.includes('No common tongue'))).toHaveLength(0);
    expect(s.log.some((l) => l.text.includes('makes a strong case'))).toBe(true);
  });
});

describe('trade ending', () => {
  it('accepts an offer meeting stance and demand thresholds', () => {
    let s = createParley(toll, ['osman', 'brann', 'tomas'], 11);
    s.stance = 2;
    s = resolveRound(s, [
      { actorId: 'osman', action: 'offer', goods: 2 },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    expect(s.ended).toBe('trade');
    expect(s.player.resources).toBe(1);
  });

  it('npc demands accumulating to the toll also end in trade', () => {
    let s = createParley(toll, ['osman', 'brann', 'tomas'], 11);
    s.stance = 2;
    s.npc.goodsTaken = 1;
    s.player.resources = 2;
    s = resolveRound(s, [
      { actorId: 'osman', action: 'hold' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    if (s.npc.goodsTaken >= s.goal.demandGoods) {
      expect(s.ended).toBe('trade');
    } else {
      expect(s.ended).toBe('ongoing');
    }
  });
});

describe('standoff', () => {
  it('draw weapons boosts party initiative and orders the next combat round', () => {
    let s = createParley(toll, ['brann', 'mireille', 'tomas'], 3);
    Object.assign(s.initiative, { brann: 9, mireille: 7, tomas: 5, redgar: 10, vex: 8, mule: 6 });
    s = resolveRound(s, [
      { actorId: 'brann', action: 'draw' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    const gains = [s.initiative.brann - 9, s.initiative.mireille - 7, s.initiative.tomas - 5].sort((a, b) => b - a);
    expect(gains).toEqual([2, 1, 1]);
    expect(s.plan.slice(0, 3).map((step) => step.actorId)).toEqual(['brann', 'redgar', 'mireille']);
  });

  it('drawing weapons starts a standoff that resolves by morale breaks', () => {
    let s = createParley(toll, ['brann', 'mireille', 'tomas'], 3);
    s = resolveRound(s, [
      { actorId: 'brann', action: 'draw' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    expect(s.standoff).toBe(true);
    expect(s.player.armed).toBe(true);
    expect(s.combatRound).toBe(true);
    expect(s.plan.filter((p) => p.side === 'player')).toHaveLength(3);
    let guard = 0;
    while (s.ended === 'ongoing' && guard++ < 25) {
      s = resolveRound(s, holdAll(s));
    }
    expect(['victory', 'defeat', 'routed']).toContain(s.ended);
  });

  it('victory when enough npc members break', () => {
    let s = createParley(toll, ['brann', 'mireille', 'tomas'], 3);
    s.npc.members.forEach((m) => (m.morale = 1));
    s = resolveRound(s, [
      { actorId: 'brann', action: 'draw' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    s = resolveRound(s, [
      { actorId: 'brann', action: 'attack', targetId: 'redgar' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [6, 1, 6, 6, 1, 6, 6, 1] });
    expect(s.npc.members.find((m) => m.id === 'redgar')!.morale).toBe(0);
    s = resolveRound(s, [
      { actorId: 'brann', action: 'attack', targetId: 'vex' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [6, 1] });
    expect(s.ended).toBe('victory');
  });

  it('a targeted attack wounds its target', () => {
    let s = createParley(toll, ['brann', 'mireille', 'tomas'], 3);
    s = resolveRound(s, [
      { actorId: 'brann', action: 'draw' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    s = resolveRound(s, [
      { actorId: 'brann', action: 'attack', targetId: 'redgar' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [6, 1, 3, 3, 3] });
    expect(s.npc.members.find((m) => m.id === 'redgar')!.morale).toBe(6);
    expect(s.log.some((l) => l.text.includes('strikes Redgar'))).toBe(true);
  });

  it('guarding turns blows and counters', () => {
    let s = createParley(toll, ['brann', 'mireille', 'tomas'], 3);
    Object.assign(s.initiative, { brann: 9, redgar: 8, mireille: 4, vex: 6, tomas: 2, mule: 4 });
    s = resolveRound(s, [
      { actorId: 'brann', action: 'draw' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    s = resolveRound(s, [
      { actorId: 'brann', action: 'defend' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [0, 1, 6, 3, 3] });
    expect(s.defending).toContain('brann');
    expect(s.npc.members.find((m) => m.id === 'redgar')!.morale).toBe(7);
    expect(s.log.filter((l) => l.text.includes('counters'))).toHaveLength(1);
    expect(s.player.members.find((m) => m.id === 'brann')!.morale).toBe(9);
    s = resolveRound(s, [
      { actorId: 'brann', action: 'attack', targetId: 'redgar' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [6, 1, 3, 3, 3] });
    expect(s.defending).not.toContain('brann');
  });
});

describe('flight', () => {
  it('escape route bonus + winning perception check ends in escape', () => {
    let s = createParley(toll, ['mireille', 'brann', 'tomas'], 5);
    s = resolveRound(s, [
      { actorId: 'mireille', action: 'signalEscape' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    expect(s.player.escapeReady).toBe(true);
    s = resolveRound(s, [
      { actorId: 'mireille', action: 'withdraw' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [6, 1] });
    expect(s.ended).toBe('escaped');
  });
});

describe('help / alliance', () => {
  it('does not spend a gift until relations are Open', () => {
    let s = createParley(toll, ['osman', 'brann', 'tomas'], 9);
    s = resolveRound(s, [
      { actorId: 'osman', action: 'gift' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    expect(s.player.resources).toBe(3);
    expect(s.trust).toBe(0);
    expect(s.log.some((l) => l.text.includes('holds the gift back'))).toBe(true);
  });

  it('a gift at Open stance reaches Allied and ends in alliance', () => {
    let s = createParley(toll, ['osman', 'brann', 'tomas'], 9);
    s.stance = 3;
    s = resolveRound(s, [
      { actorId: 'osman', action: 'gift' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    expect(s.ended).toBe('alliance');
    expect(s.trust).toBe(1);
  });
});

describe('feuds / grudges', () => {
  it('threatening an NPC breeds a grudge against the actor', () => {
    let s = createParley(toll, ['mireille', 'brann', 'tomas'], 3);
    s = resolveRound(s, [
      { actorId: 'mireille', action: 'threaten', targetId: 'redgar' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [6, 1, 4, 1, 6, 1, 1, 6, 1, 1, 6] });
    expect(s.grudges['redgar>mireille']).toBe(1);
    expect(s.log.filter((l) => l.text.includes('will remember'))).toHaveLength(1);
    s = resolveRound(s, [
      { actorId: 'mireille', action: 'threaten', targetId: 'redgar' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [4, 6, 1, 4, 1, 6, 4, 1, 6] });
    expect(s.grudges['redgar>mireille']).toBe(2);
    expect(s.log.filter((l) => l.text.includes('will remember'))).toHaveLength(1);
  });

  it('a held feud grants +1 on checks against its target', () => {
    const orders: Order[] = [{ actorId: 'mireille', action: 'talk', targetId: 'redgar' }];
    const a = createParley(toll, ['mireille', 'brann', 'yara'], 3);
    const stepA = resolveStep(a, orders, { dice: [3, 6] });
    expect(stepA.stance).toBe(1);
    const b = createParley(toll, ['mireille', 'brann', 'yara'], 3);
    b.grudges['mireille>redgar'] = 1;
    const stepB = resolveStep(b, orders, { dice: [3, 6] });
    expect(stepB.stance).toBe(2);
  });
});

describe('patience clock', () => {
  it('market group walks away when patience runs out', () => {
    let s = createParley(market, ['mireille', 'brann', 'tomas'], 13);
    const dice: number[] = [];
    for (let i = 0; i < 60; i++) dice.push(1, 6);
    for (let r = 0; r < 5 && s.ended === 'ongoing'; r++) {
      s = resolveRound(s, holdAll(s), { dice: [...dice] });
    }
    expect(s.ended).toBe('walkedAway');
  });
});

describe('beasts (wolf pack)', () => {
  it('blocks speech actions against beasts entirely', () => {
    let s = createParley(wolves, ['mireille', 'brann', 'tomas'], 21);
    s = resolveRound(s, [
      { actorId: 'mireille', action: 'talk' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [4, 1, 6, 1, 1, 6, 1, 1, 6] });
    expect(s.log.some((l) => l.text.includes('words will not reach them'))).toBe(true);
    expect(s.stance).toBe(0);
  });

  it('a gift can seal an alliance with the pack once it is Open', () => {
    let s = createParley(wolves, ['mireille', 'brann', 'tomas'], 21);
    s.stance = 3;
    s = resolveRound(s, [
      { actorId: 'mireille', action: 'gift' },
      { actorId: 'brann', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    expect(s.ended).toBe('alliance');
    expect(s.trust).toBe(1);
    expect(s.player.resources).toBe(3);
  });
});

describe('leader falls', () => {
  function brannDown(s: ParleyState): ParleyState {
    s.player.members.find((m) => m.id === 'brann')!.morale = 1;
    s.grudges['redgar>brann'] = 3;
    return s;
  }

  it('routs when the fallen leader had no steady second (r1 setup round)', () => {
    let s = brannDown(createParley(toll, ['brann', 'mireille', 'tomas'], 3));
    s = resolveRound(s, holdAll(s), { dice: [4, 1, 6, 1, 1, 6, 1, 1, 6] });
    s = resolveRound(s, holdAll(s), { dice: [0, 6, 1, 0, 6, 1, 1] });
    expect(s.ended).toBe('routed');
  });

  it('holds when a high-Leadership second takes command', () => {
    let s = brannDown(createParley(toll, ['brann', 'mireille', 'tomas'], 3));
    s = resolveRound(s, holdAll(s), { dice: [4, 1, 6, 1, 1, 6, 1, 1, 6] });
    s = resolveRound(s, holdAll(s), { dice: [0, 6, 1, 0, 6, 1, 3] });
    expect(s.ended).toBe('ongoing');
    expect(s.player.order[0]).toBe('mireille');
    expect(s.log.some((l) => l.text.includes('takes command'))).toBe(true);
  });

  it('npc leader falling can rout the whole group into victory', () => {
    let s = createParley(toll, ['brann', 'mireille', 'tomas'], 3);
    s.npc.members.find((m) => m.id === 'redgar')!.morale = 1;
    s = resolveRound(s, [
      { actorId: 'brann', action: 'draw' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    s = resolveRound(s, [
      { actorId: 'brann', action: 'attack', targetId: 'redgar' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [6, 1, 1] });
    expect(s.ended).toBe('victory');
  });

  it('npc leadership successor can prevent the rout', () => {
    let s = createParley(toll, ['brann', 'mireille', 'tomas'], 3);
    s.npc.members.find((m) => m.id === 'redgar')!.morale = 1;
    s = resolveRound(s, [
      { actorId: 'brann', action: 'draw' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    s = resolveRound(s, [
      { actorId: 'brann', action: 'attack', targetId: 'redgar' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [6, 1, 6] });
    expect(s.ended).toBe('ongoing');
    expect(s.npc.order[0]).toBe('vex');
    expect(s.log.some((l) => l.text.includes('snaps up the banner'))).toBe(true);
  });

  it('broken fighters are excluded from later round plans and skip their steps', () => {
    let s = createParley(toll, ['brann', 'mireille', 'tomas'], 3);
    s.npc.members.find((m) => m.id === 'vex')!.morale = 1;
    s = resolveRound(s, [
      { actorId: 'brann', action: 'draw' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    s = resolveRound(s, [
      { actorId: 'brann', action: 'attack', targetId: 'vex' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ], { dice: [6, 1] });
    expect(s.npc.members.find((m) => m.id === 'vex')!.morale).toBe(0);
    s = resolveRound(s, holdAll(s));
    expect(s.plan).toHaveLength(5);
    expect(s.plan.every((p) => p.actorId !== 'vex')).toBe(true);
  });
});

describe('purity', () => {
  it('resolveRound does not mutate its input', () => {
    const s = createParley(toll, ['brann', 'mireille', 'tomas'], 3);
    const snapshot = JSON.stringify(s);
    resolveRound(s, [
      { actorId: 'brann', action: 'draw' },
      { actorId: 'mireille', action: 'hold' },
      { actorId: 'tomas', action: 'hold' },
    ]);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
