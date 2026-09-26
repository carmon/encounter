import { describe, expect, it } from 'vitest';
import { MESSAGES, renderLog } from '../src/core/messages';

const FILLER: Record<string, string | number> = {
  a: 'Aster',
  t: 'Tereza',
  d: 'Defender',
  c: 'Cassian',
  h: 'Holda',
  leader: 'Leandra',
  succ: 'Succor',
  ldr: 3,
  goods: 2,
  goal: 'a goal',
  demand: 2,
  outcome: 'attack',
  breaks: 2,
  hint: 'a hint',
};

describe('message catalog', () => {
  it('every template provides both locales and renders without leftover placeholders', () => {
    for (const [key, msg] of Object.entries(MESSAGES)) {
      expect(msg.en.length, `${key} en empty`).toBeGreaterThan(0);
      expect(msg.es.length, `${key} es empty`).toBeGreaterThan(0);
      expect(msg.es, `${key} es identical to en`).not.toBe(msg.en);
      for (const locale of ['en', 'es'] as const) {
        const rendered = renderLog(locale, key as keyof typeof MESSAGES, FILLER);
        expect(rendered, `${key} ${locale} leaves placeholders`).not.toMatch(/\{\w+\}/);
        expect(rendered, `${key} ${locale} renders empty`).not.toBe('');
      }
    }
  });

  it('never uses placeholder names the English template does not supply', () => {
    const names = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
    for (const [key, msg] of Object.entries(MESSAGES)) {
      const en = names(msg.en);
      for (const p of names(msg.es)) {
        expect(en.has(p), `${key} es uses unknown placeholder {${p}}`).toBe(true);
      }
    }
  });

  it('scenario.blurb passes the English blurb through', () => {
    expect(renderLog('en', 'scenario.blurb', { id: 'toll_road', blurb: 'The blurb.' })).toBe('The blurb.');
    expect(renderLog('es', 'scenario.blurb', { id: 'toll_road', blurb: 'The blurb.' })).toBe('The blurb.');
  });

  it('missing params render as empty rather than raw placeholders', () => {
    expect(renderLog('en', 'combat.strike')).toBe(' strikes .');
  });
});
