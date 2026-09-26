import type { PlayerAction } from './core/types';
import type { LogEvent } from './core/types';
import { MESSAGES, renderLog, type MsgKey } from './core/messages';

export type Locale = 'en' | 'es';

const dictionaries = {
  en: {
    'setup.title': 'Encounter!',
    'setup.scenario': '1 · Scenario',
    'setup.party': '2 · Party (pick 3, order matters)',
    'setup.shuffle': '↻ shuffle {count}',
    'setup.start': 'Begin the parley',
    'game.round': 'Round',
    'game.stance': 'Stance',
    'game.they': 'They',
    'game.you': 'You',
    'game.turnOrder': 'Turn order',
    'game.chronicle': 'Chronicle',
    'game.play': '▶ play',
    'game.pause': '❚❚ pause',
    'game.go': '▶ go',
    'game.aim': 'target:',
    'game.noSpeech': '⚠ no speech',
    'game.noTongue': '⚠ no shared tongue',
    'game.primaryLeader': 'Primary Leader',
    'game.theirLeader': 'Their leader',
    'game.interpreter': 'Interpreter',
    'game.guarding': 'guarding',
    'game.now': '▶ now',
    'game.standoffLabel': 'STANDOFF',
    'ending.again': 'New encounter',
  },
  es: {
    'setup.title': '¡Encuentro!',
    'setup.scenario': '1 · Escenario',
    'setup.party': '2 · Grupo (elige 3; el orden importa)',
    'setup.shuffle': '↻ barajar {count}',
    'setup.start': 'Comenzar el encuentro',
    'game.round': 'Ronda',
    'game.stance': 'Postura',
    'game.they': 'Ellos',
    'game.you': 'Tú',
    'game.turnOrder': 'Orden de turno',
    'game.chronicle': 'Crónica',
    'game.play': '▶ jugar',
    'game.pause': '❚❚ pausa',
    'game.go': '▶ actuar',
    'game.aim': 'objetivo:',
    'game.noSpeech': '⚠ sin habla',
    'game.noTongue': '⚠ sin idioma común',
    'game.primaryLeader': 'Líder principal',
    'game.theirLeader': 'Su líder',
    'game.interpreter': 'Intérprete',
    'game.guarding': 'en guardia',
    'game.now': '▶ ahora',
    'game.standoffLabel': 'ENFRENTAMIENTO',
    'ending.again': 'Nuevo encuentro',
  },
} as const;

let locale: Locale = localStorage.getItem('parley-locale') === 'es' ? 'es' : 'en';

export function currentLocale(): Locale {
  return locale;
}

export function setLocale(next: Locale): void {
  locale = next;
  localStorage.setItem('parley-locale', next);
}

export function t(key: keyof typeof dictionaries.en, values: Record<string, string | number> = {}): string {
  return dictionaries[locale][key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''));
}

const actions: Record<Locale, Record<PlayerAction, string>> = {
  en: {
    hold: 'Hold back', talk: 'Talk', persuade: 'Persuade', offer: 'Offer goods', gift: 'Gift', appraise: 'Appraise', sizeup: 'Size up', threaten: 'Threaten', bluff: 'Bluff', interpret: 'Interpret', draw: 'Draw weapons', attack: 'Attack', defend: 'Guard', signalEscape: 'Signal escape', rally: 'Rally (leader)', coordinatedThreat: 'Coordinated threat (leader)', finalOffer: 'Final offer (leader)', withdraw: 'Withdraw (leader)',
  },
  es: {
    hold: 'Esperar', talk: 'Hablar', persuade: 'Persuadir', offer: 'Ofrecer bienes', gift: 'Regalar', appraise: 'Evaluar', sizeup: 'Examinar', threaten: 'Amenazar', bluff: 'Engañar', interpret: 'Interpretar', draw: 'Desenvainar', attack: 'Atacar', defend: 'Proteger', signalEscape: 'Señalar huida', rally: 'Reagrupar (líder)', coordinatedThreat: 'Amenaza coordinada (líder)', finalOffer: 'Oferta final (líder)', withdraw: 'Retirarse (líder)',
  },
};

export function actionLabel(action: PlayerAction): string { return actions[locale][action]; }

const stances: Record<Locale, string[]> = {
  en: ['Hostile', 'Wary', 'Neutral', 'Open', 'Allied'],
  es: ['Hostil', 'Recelo', 'Neutral', 'Abierto', 'Aliado'],
};
export function stanceLabel(index: number): string { return stances[locale][index] ?? ''; }

const world: Record<Locale, Record<string, string>> = {
  en: { valen: 'Valen', karsk: 'Karsk', oran: 'Oran', wild: 'Beast of the Wild', trade: 'Trade Tongue', beast: 'growls and postures' },
  es: { valen: 'Valen', karsk: 'Karsk', oran: 'Oran', wild: 'Bestia salvaje', trade: 'Lengua comercial', beast: 'gruñidos y posturas' },
};
export function worldLabel(key: string): string { return world[locale][key] ?? key; }

// The engine stores locale-neutral log events (template key + params, with the
// English render kept on `text` for tests/inspection). Translate at render time
// so changing language also updates the chronicle. Every engine message key is
// typechecked against src/core/messages.ts, which carries both locales — a new
// engine string cannot exist without its Spanish translation.
export function localizeLog(event: LogEvent): string {
  if (locale === 'en') return event.text;
  if (event.key === 'scenario.blurb') {
    return scenarios.es[String(event.params?.id ?? '')]?.blurb ?? event.text;
  }
  if (event.key in MESSAGES) {
    return renderLog('es', event.key as MsgKey, event.params);
  }
  return event.text;
}

interface ScenarioText {
  name: string;
  bullets: string[];
  blurb?: string;
}

const scenarios: Record<Locale, Record<string, ScenarioText>> = {
  en: {},
  es: {
    toll_road: {
      name: 'El Camino del Peaje',
      bullets: ['Lengua: solo karsk — sin comercial/oran', 'Rival: bandidos karsk ×3', 'Posición: camino norte en la linde — bloquean el paso, carro expuesto', 'Actitud: peaje hostil — atacarán si se demora'],
      blurb: 'Bandidos karsk surgen de la arboleda y bloquean el camino. Solo hablan karsk. Tu carro de carga cruje detrás de ti.',
    },
    market: {
      name: 'Mercado Extranjero',
      bullets: ['Lengua: comercial + oran (comercial compartida)', 'Rival: caravana gremial oran ×3', 'Posición: plaza del mercado — bloquea la puerta sur, puestos alrededor', 'Actitud: vanidosos/codiciosos, sonríen pero negocian duro — se irán si hace frío'],
      blurb: 'Una caravana del gremio oran bloquea tu salida del mercado, sonriendo demasiado. Hablan la Lengua Comercial y negocian duro.',
    },
    wolves: {
      name: 'La Manada de Lobos',
      bullets: ['Lengua: sin lengua — bestias (solo gruñidos/posturas)', 'Rival: manada de lobos ×3', 'Posición: sendero del bosque — corta el paso, rodea el carro', 'Actitud: hambrienta, agresiva — solo entiende comida/amenazas/acero'],
      blurb: 'Una manada hambrienta corta el sendero y rodea el carro. No hay idioma común y las palabras se desperdician con ellos, pero comida, amenazas o acero hablan claro.',
    },
  },
};
export function scenarioText(id: string, fallback: { name: string; bullets: string[] }): { name: string; bullets: string[] } {
  return scenarios[locale][id] ?? { name: fallback.name, bullets: fallback.bullets };
}
