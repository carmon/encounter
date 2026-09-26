import type { Character } from './types';

export const AFFINITY: Record<string, Record<string, number>> = {
  valen: { valen: 1, karsk: -1, oran: 0 },
  karsk: { valen: -1, karsk: 1, oran: 0 },
  oran: { valen: 0, karsk: 0, oran: 1 },
  wild: { wild: 1 },
};

export function affinityMod(a: Character, b: Character): number {
  return AFFINITY[a.nationality]?.[b.nationality] ?? 0;
}

export function sharedLanguage(a: Character, b: Character): boolean {
  return a.languages.some((l) => b.languages.includes(l));
}

export function groupSharesLanguage(char: Character, group: Character[]): boolean {
  return group.some((m) => sharedLanguage(char, m));
}

export function partySharesLanguageWith(party: Character[], group: Character[]): boolean {
  return party.some((p) => groupSharesLanguage(p, group));
}
