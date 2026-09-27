import type { Attr, Character, Item, Temperament } from '../engine/types';
import { use, wear } from './items';
import { TEMPERAMENTS as TP } from './world';

export function char(
  id: string,
  name: string,
  origin: string,
  tongues: string[],
  [might, wits, charm, nerve]: [number, number, number, number],
  temperament: Temperament,
  items: Item[],
  opts: { tags?: string[]; resolve?: number } = {},
): Character {
  const attrs: Record<Attr, number> = { might, wits, charm, nerve };
  const max = opts.resolve ?? 6 + nerve;
  return { id, name, origin, tongues, tags: opts.tags ?? ['human'], attrs, temperament, resolve: max, maxResolve: max, items };
}

//                                                   MGT WIT CHA NRV
export const ROSTER: Character[] = [
  char('maren', 'Maren Voss', 'coast', ['cant', 'high'], [2, 3, 4, 3], TP.steady, [
    wear('Signet Ring', ['jewel'], 2, { type: 'boost', attr: 'charm', power: 1 }, 'a house seal that opens doors'),
  ]),
  char('brannoc', 'Brannoc', 'hills', ['deep', 'cant'], [5, 2, 1, 3], TP.bold, [
    wear('Longaxe', ['steel'], 2, { type: 'weapon', power: 2 }),
    wear('Hide Jerkin', ['hide'], 1, { type: 'ward', power: 1 }),
  ]),
  char('ines', 'Chaplain Ines', 'reach', ['high', 'old'], [1, 3, 3, 5], TP.devout, [
    use('Censer', ['incense'], 1, 2, { type: 'scare', power: 2, vs: ['spirit'] }),
    wear('Blessed Knife', ['blessed', 'steel'], 2, { type: 'weapon', power: 1 }),
  ]),
  char('pell', 'Pell', 'coast', ['cant'], [2, 5, 2, 2], TP.sly, [
    wear('Lockpicks', ['tools'], 1, { type: 'boost', attr: 'wits', power: 1 }),
    use('Smoke Pellet', ['alchemy'], 1, 1, { type: 'smoke', power: 3 }),
  ]),
  char('sabeth', 'Sabeth Orr', 'reach', ['high', 'cant'], [4, 3, 2, 3], TP.bold, [
    wear('Saber', ['steel'], 2, { type: 'weapon', power: 2 }),
    wear('Mail Shirt', ['steel'], 3, { type: 'ward', power: 2 }),
  ]),
  char('tamsin', 'Old Tamsin', 'hills', ['deep', 'cant', 'old'], [1, 4, 3, 3], TP.wary, [
    use('Poultice', ['herb'], 1, 2, { type: 'heal', power: 3 }),
    use('Dried Meat', ['food'], 1, 1, { type: 'heal', power: 1 }, 'beasts want it more than you do'),
  ]),
  char('corwin', 'Envoy Corwin', 'reach', ['high'], [1, 2, 5, 3], TP.proud, [
    wear('Letters of Passage', ['papers'], 1, { type: 'boost', attr: 'charm', power: 1 }),
    wear('Heavy Purse', ['coin'], 3, undefined, 'forty silver'),
  ]),
  char('jory', 'Jory the Houndsman', 'hills', ['deep', 'cant'], [3, 4, 2, 2], TP.wary, [
    wear('Hunting Spear', ['steel'], 1, { type: 'weapon', power: 1 }),
    use('Pitch Torch', ['fire'], 1, 2, { type: 'scare', power: 2, vs: ['beast', 'spirit'] }),
  ]),
];

export const PARTY_SIZE = 3;
