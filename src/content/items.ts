import type { Item, ItemEffect, ItemKind } from '../engine/types';

let seq = 0;
function item(kind: ItemKind, name: string, tags: string[], value: number, effect?: ItemEffect, extra: Partial<Item> = {}): Item {
  seq += 1;
  const id = `${name.toLowerCase().replace(/[^a-z]+/g, '-')}-${seq}`;
  return { id, name, kind, tags, value, state: 'intact', effect, ...extra };
}

export const wear = (name: string, tags: string[], value: number, effect?: ItemEffect, note?: string) =>
  item('wearable', name, tags, value, effect, { note });
export const use = (name: string, tags: string[], value: number, uses: number, effect: ItemEffect, note?: string) =>
  item('consumable', name, tags, value, effect, { uses, note });
export const gear = (name: string, tags: string[], value: number, note?: string) => item('group', name, tags, value, undefined, { note });

export function describeEffect(it: Item): string {
  const e = it.effect;
  if (!e) return it.note ?? '';
  const base = (() => {
    switch (e.type) {
      case 'weapon': return `Weapon +${e.power} to Strike`;
      case 'ward': return `Ward +${e.power} vs Strike`;
      case 'boost': return `+${e.power} ${e.attr}`;
      case 'heal': return `Restores ${e.power} resolve`;
      case 'scare': return `Scares ${e.vs.join('/')} (+${e.power})`;
      case 'smoke': return `Withdraw +${e.power}`;
    }
  })();
  return [base, it.note].filter(Boolean).join(' — ');
}
