import { describe, expect, it } from 'vitest';
import { createParley, resolveRound } from '../src/core/engine';
import { SCENARIOS } from '../src/data/scenarios';
import type { Order, PlayerAction } from '../src/core/types';

const ALL: PlayerAction[] = [
  'hold', 'talk', 'persuade', 'offer', 'gift', 'appraise', 'sizeup',
  'threaten', 'bluff', 'interpret', 'draw', 'attack', 'defend',
  'signalEscape', 'rally', 'coordinatedThreat', 'finalOffer', 'withdraw',
];

describe('fuzz', () => {
  it('survives 300 fully random parleys without crashing or hanging', () => {
    let seed = 12345;
    const rand = () => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return (seed >>> 8) / 16777216;
    };
    for (let g = 0; g < 300; g++) {
      const scenario = SCENARIOS[g % SCENARIOS.length];
      const ids = scenario.roster.map((c) => c.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      let s = createParley(scenario, ids.slice(0, 3), Math.floor(rand() * 0xffffffff));
      let rounds = 0;
      const npcIds = scenario.npcs.map((c) => c.id);
      while (s.ended === 'ongoing' && rounds++ < 30) {
        const orders: Order[] = s.player.order.map((id) => ({
          actorId: id,
          action: ALL[Math.floor(rand() * ALL.length)],
          goods: 1 + Math.floor(rand() * 3),
          targetId: rand() < 0.4 ? npcIds[Math.floor(rand() * npcIds.length)] : undefined,
        }));
        s = resolveRound(s, orders);
      }
      expect(s.ended).not.toBe('ongoing');
      for (const entry of s.log) {
        // Every message must render fully bound in English: a leftover
        // placeholder means a call site forgot a param.
        expect(entry.text.includes('{')).toBe(false);
      }
    }
  });
});
