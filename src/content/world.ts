import type { Temperament } from '../engine/types';

// Setting is disposable flavour: the engine only compares strings.
export const TONGUES: Record<string, string> = {
  cant: 'Roadcant',
  high: 'Highspeech',
  deep: 'Deeproot',
  old: 'the Old Tongue',
  none: 'no speech',
};

export const ORIGINS: Record<string, string> = {
  coast: 'Brinecoast',
  hills: 'Tallow Hills',
  reach: 'the Ashen Reach',
  wild: 'the Wild',
  dead: 'the Restless Dead',
  salt: 'Salt Market',
};

const T = (t: Temperament) => t;

export const TEMPERAMENTS = {
  steady: T({ id: 'steady', label: 'steady', note: 'Talks first, keeps its head.', leans: { parley: 1.5, guard: 1.2 } }),
  bold: T({ id: 'bold', label: 'bold', note: 'Leans on force; hard to intimidate (−1 to Press them).', weakTo: { press: -1 }, leans: { press: 2, strike: 2.5 } }),
  wary: T({ id: 'wary', label: 'wary', note: 'Watches everything (−1 to Read or Take from them).', weakTo: { read: -1, take: -1 }, leans: { read: 2, guard: 2 } }),
  sly: T({ id: 'sly', label: 'sly', note: 'Grabs and bends people; hard to steal from.', weakTo: { take: -1 }, leans: { take: 2, sway: 1.5 } }),
  proud: T({ id: 'proud', label: 'proud', note: 'Flattery works (+1 to Parley them); insulted by refusals.', weakTo: { parley: 1 }, leans: { parley: 1.2, propose: 1.5 } }),
  greedy: T({ id: 'greedy', label: 'greedy', note: 'Wanted gifts count double; can be bought (+1 to Sway them).', weakTo: { sway: 1 }, leans: { take: 2, propose: 2 } }),
  devout: T({ id: 'devout', label: 'devout', note: 'Unshakeable faith (−2 to Sway or Possess them).', weakTo: { sway: -2 }, leans: { rally: 2, parley: 1.5 } }),
  feral: T({ id: 'feral', label: 'feral', note: 'Snarls, snatches, bites. No words.', leans: { parley: 0, press: 2.5, take: 1.5, strike: 1.5 } }),
  hungry: T({ id: 'hungry', label: 'hungry', note: 'Goes straight for food.', leans: { parley: 0, take: 3, press: 1 } }),
  restless: T({ id: 'restless', label: 'restless', note: 'Wants to be heard — and to wear the living.', leans: { sway: 2.5, press: 1.5, parley: 1.2 } }),
  keening: T({ id: 'keening', label: 'keening', note: 'Pure grief; wails at the living (+1 to Parley them).', weakTo: { parley: 1 }, leans: { press: 3, parley: 0.5 } }),
};
