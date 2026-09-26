export type MsgParams = Record<string, string | number>;

export interface Msg {
  en: string;
  es: string;
}

// Single source of truth for every engine log/ending string.
// `log()` only accepts keys of this table, so a new engine message cannot be
// added without providing both locales — the typecheck enforces it.
export const MESSAGES = {
  'warn.noSharedLanguage': {
    en: 'You share no language with them. An Interpret action is needed before any real negotiation.',
    es: 'No comparten idioma con ellos. Se necesita una acción de Interpretar antes de cualquier negociación real.',
  },
  'act.leaderOnly': {
    en: '{a} cannot lead that action — only the Primary Leader can.',
    es: '{a} no puede dirigir esa acción: solo el Líder Principal.',
  },
  'blocked.beasts': {
    en: 'They are beasts — words will not reach them. Gifts, threats, or steel speak for you.',
    es: 'Son bestias: las palabras no les llegan. Regalos, amenazas o acero hablan por ti.',
  },
  'blocked.tongues': {
    en: 'No common tongue with them — someone must Interpret first',
    es: 'No comparten idioma con ellos: alguien debe Interpretar primero.',
  },
  'hold.back': {
    en: '{a} holds back and watches.',
    es: '{a} espera y observa.',
  },
  'talk.charm': {
    en: '{a} charms {t}. The mood thaws a little.',
    es: '{a} cautiva a {t}. El ambiente se suaviza.',
  },
  'talk.charmDefer': {
    en: '{a} charms {t}, but {t} defers to their leader.',
    es: '{a} cautiva a {t}, pero {t} remite a su líder.',
  },
  'talk.small': {
    en: '{a} makes small talk with {t}, but it goes nowhere.',
    es: '{a} conversa con {t}, pero no logra nada.',
  },
  'persuade.strong': {
    en: '{a} makes a strong case to {t}. Their leader listens.',
    es: '{a} presenta un argumento sólido ante {t}. Su líder escucha.',
  },
  'persuade.sway': {
    en: '{a} sways {t} — and word reaches their leader.',
    es: '{a} convence a {t}, y la noticia llega a su líder.',
  },
  'persuade.swayDefer': {
    en: "{a} sways {t}, but only their leader can shift the group's mood.",
    es: '{a} convence a {t}, pero solo su líder puede cambiar el ánimo del grupo.',
  },
  'persuade.unmoved': {
    en: '{a} argues with {t}, but is unmoved.',
    es: '{a} discute con {t}, pero no le convence.',
  },
  'offer.tooMany': {
    en: '{a} offers goods you do not have.',
    es: '{a} ofrece bienes que no tienes.',
  },
  'offer.empty': {
    en: '{a} offers empty hands. They are insulted.',
    es: '{a} ofrece manos vacías. Se sienten insultados.',
  },
  'offer.brilliant': {
    en: '{a} bargains brilliantly, but the terms still fall short.',
    es: '{a} regatea de maravilla, pero las condiciones siguen sin alcanzar.',
  },
  'offer.waved': {
    en: '{a} makes an offer; their leader waves it off.',
    es: '{a} hace una oferta; su líder la rechaza.',
  },
  'gift.holdBack': {
    en: '{a} holds the gift back. It can only seal an open accord.',
    es: '{a} guarda el regalo. Solo puede sellar un acuerdo abierto.',
  },
  'gift.nothing': {
    en: '{a} has nothing left to give.',
    es: '{a} ya no tiene nada que ofrecer.',
  },
  'gift.present': {
    en: '{a} presents a gift. Warmth rises on both sides of the fire.',
    es: '{a} ofrece un regalo. El ambiente se vuelve cálido a ambos lados del fuego.',
  },
  'appraise.already': {
    en: '{a} has already read {t} worth reading.',
    es: '{a} ya ha leído de {t} todo lo que valía la pena.',
  },
  'appraise.full': {
    en: '{a} reads {t} closely — abilities and manner laid bare.',
    es: '{a} lee atentamente a {t}: capacidades y temperamento quedan al descubierto.',
  },
  'appraise.partial': {
    en: "{a} marks {t}'s capabilities.",
    es: '{a} evalúa las capacidades de {t}.',
  },
  'appraise.little': {
    en: '{a} studies {t} but learns little.',
    es: '{a} estudia a {t}, pero aprende poco.',
  },
  'sizeup.full': {
    en: '{a} pieces together their true intent: {goal} — they want {demand} goods, will {outcome} if talks drag, and break if {breaks} of them fall.',
    es: '{a} descifra su verdadera intención: {goal}: quieren {demand} bienes, {outcome} si la charla se alarga, y rompen si caen {breaks} de ellos.',
  },
  'sizeup.hint': {
    en: '{a} senses what drives them: {hint}',
    es: '{a} percibe lo que los impulsa: {hint}',
  },
  'sizeup.opaque': {
    en: '{a} watches for intent, but their manner stays opaque.',
    es: '{a} busca sus intenciones, pero su actitud sigue siendo opaca.',
  },
  'threaten.win': {
    en: '{a} singles out {t}. Nerves fray on the far side of the fire.',
    es: '{a} señala a {t}. Los nervios se tensan al otro lado del fuego.',
  },
  'threaten.hollow': {
    en: "{a}'s threat at {t} rings hollow. They grow colder, and time burns.",
    es: 'La amenaza de {a} contra {t} suena vacía. Se enfrían los ánimos y pasa el tiempo.',
  },
  'bluff.win': {
    en: '{a} bluffs {t} smoothly — they buy it for now.',
    es: '{a} engaña a {t} con soltura; por ahora lo creen.',
  },
  'bluff.seen': {
    en: "{t} sees through {a}'s lie. Trust curdles.",
    es: '{t} ve a través de la mentira de {a}. La confianza se agria.',
  },
  'bluff.waver': {
    en: "{a}'s bluff at {t} wavers, but nothing comes of it.",
    es: 'El engaño de {a} ante {t} titubea, pero no pasa nada.',
  },
  'interpret.already': {
    en: 'An interpreter is already bridging the gap.',
    es: 'Ya hay un intérprete salvando la barrera.',
  },
  'interpret.bridge': {
    en: '{a} bridges the language gap, relaying for the party.',
    es: '{a} salva la barrera lingüística e interpreta para el grupo.',
  },
  'interpret.cannot': {
    en: '{a} shares no tongue with them and cannot interpret.',
    es: '{a} no comparte idioma con ellos y no puede interpretar.',
  },
  'draw.standoff': {
    en: 'Steel flashes on both sides — the parley collapses into a standoff! Your party readies: one fighter gains +2 initiative next round, the rest +1.',
    es: '¡El acero brilla en ambos bandos: la negociación se convierte en un enfrentamiento! Tu grupo se prepara: un combatiente gana +2 de iniciativa la próxima ronda, los demás +1.',
  },
  'attack.noSteel': {
    en: '{a} keeps their hand well away from steel while talks hold.',
    es: '{a} mantiene la mano bien lejos del acero mientras haya conversación.',
  },
  'defend.noSteel': {
    en: '{a} keeps their hands loose while talks hold — no need for a guard yet.',
    es: '{a} mantiene las manos sueltas mientras haya conversación: aún no hace falta guardia.',
  },
  'escape.signal': {
    en: '{a} quietly marks the escape route. A withdrawal will be swifter.',
    es: '{a} marca discretamente la ruta de escape. La retirada será más rápida.',
  },
  'rally.party': {
    en: '{a} steadies the party.',
    es: '{a} reafirma al grupo.',
  },
  'threat.coordWin': {
    en: '{a} rallies the party behind one wordless threat. Their leader pales.',
    es: '{a} arenga al grupo tras una amenaza sin palabras. Su líder palidece.',
  },
  'threat.coordFlat': {
    en: "{a}'s coordinated menace falls flat and costs time.",
    es: 'La amenaza coordinada de {a} no surte efecto y cuesta tiempo.',
  },
  'finalOffer.cold': {
    en: 'They would treat, but not while relations run this cold.',
    es: 'Tratarían, pero no con las relaciones tan frías.',
  },
  'finalOffer.refused': {
    en: 'The final offer is refused. Something sours.',
    es: 'La oferta final es rechazada. Algo se agria.',
  },
  'withdraw.spotted': {
    en: 'The withdrawal is spotted — they cut off the route. It is a standoff now.',
    es: 'La retirada es vista: cortan la ruta. Ahora es un enfrentamiento.',
  },
  'combat.strike': {
    en: '{a} strikes {t}.',
    es: '{a} ataca a {t}.',
  },
  'combat.counter': {
    en: '{d} turns the blow aside and counters {a}.',
    es: '{d} desvía el golpe y contraataca a {a}.',
  },
  'combat.press': {
    en: '{a} presses {t}, but the blow skitters off.',
    es: '{a} presiona a {t}, pero el golpe resbala.',
  },
  'combat.guard': {
    en: '{c} sets their guard — blows against them will be turned.',
    es: '{c} se pone en guardia; desviará los golpes.',
  },
  'standoff.keepsSeat': {
    en: '{a} keeps their seat — no opening for words now.',
    es: '{a} se mantiene firme; ahora no hay lugar para palabras.',
  },
  'feud.npc': {
    en: '{h} fixes on {t}. They will remember this.',
    es: '{h} se fija en {t}. No lo olvidarán.',
  },
  'feud.player': {
    en: '{h} marks {t} for payback.',
    es: '{h} marca a {t} para cobrarse la venganza.',
  },
  'leader.falls.player': {
    en: '{leader} falls! {succ} takes command (Leadership {ldr}) — the party holds.',
    es: '¡{leader} cae! {succ} toma el mando (Liderazgo {ldr}): el grupo resiste.',
  },
  'leader.falls.npc': {
    en: '{leader} falls! {succ} snaps up the banner (Leadership {ldr}) — they hold.',
    es: '¡{leader} cae! {succ} alza el estandarte (Liderazgo {ldr}): resisten.',
  },
  'npc.talk.leader': {
    en: '{a} chats amiably with {t}. The mood eases on their side.',
    es: '{a} conversa amigablemente con {t}. El ánimo se suaviza en su bando.',
  },
  'npc.talk.leaderB': {
    en: '{a} pads up to {t}, tail low. Something eases.',
    es: '{a} se acerca a {t} con la cola baja. Algo se relaja.',
  },
  'npc.talk.sway': {
    en: '{a} wins {t} over, and the group softens a little.',
    es: '{a} gana a {t}, y el grupo se ablanda un poco.',
  },
  'npc.talk.swayB': {
    en: '{a} relaxes around {t}, and the pack follows.',
    es: '{a} se relaja junto a {t}, y la manada lo sigue.',
  },
  'npc.talk.warm': {
    en: '{a} warms to {t}, but the group watches its leader.',
    es: '{a} se encariña con {t}, pero el grupo vigila a su líder.',
  },
  'npc.talk.warmB': {
    en: '{a} warms to {t}, but the pack watches its leader.',
    es: '{a} se encariña con {t}, pero la manada vigila a su líder.',
  },
  'npc.talk.pleasant': {
    en: '{a} exchanges pleasantries; little comes of it.',
    es: '{a} intercambia cortesías; poco resulta de ello.',
  },
  'npc.talk.pleasantB': {
    en: '{a} sniffs and paces. No ground is given.',
    es: '{a} husmea y patrulla. No cede terreno.',
  },
  'npc.persuade.hard': {
    en: '{a} presses {t} hard. They seem more willing to talk terms.',
    es: '{a} presiona con dureza a {t}. Parecen más dispuestos a negociar.',
  },
  'npc.persuade.hardB': {
    en: '{a} circles {t} and yips. Your leader reads an opening.',
    es: '{a} rodea a {t} y ladrea. Tu líder ve una apertura.',
  },
  'npc.persuade.around': {
    en: '{a} talks {t} around, and the group shifts with them.',
    es: '{a} convence a {t}, y el grupo cambia con ellos.',
  },
  'npc.persuade.defer': {
    en: '{a} makes their pitch to {t}; your party defers to its leader.',
    es: '{a} presenta su propuesta a {t}; tu grupo remite a su líder.',
  },
  'npc.persuade.fail': {
    en: '{a} makes their pitch to {t}; it sidesteps it.',
    es: '{a} presenta su propuesta a {t}; la esquiva.',
  },
  'npc.persuade.failB': {
    en: '{a} circles, testing. {t} gives no ground.',
    es: '{a} rodea, tanteando. {t} no cede terreno.',
  },
  'npc.threaten.blunt': {
    en: "{a} makes a blunt threat at {t}. Your party's nerves fray.",
    es: '{a} amenaza directamente a {t}. Los nervios del grupo se tensan.',
  },
  'npc.threaten.bluntB': {
    en: "{a} bares its teeth at {t}. Your party's nerve wavers.",
    es: '{a} enseña los dientes a {t}. El ánimo de tu grupo vacila.',
  },
  'npc.threaten.posture': {
    en: '{a} postures at {t}; they stare it down. Time burns.',
    es: '{a} hace gestos de amenaza a {t}; lo miran fijamente. El tiempo corre.',
  },
  'npc.threaten.postureB': {
    en: '{a} postures at {t}; they hold its gaze. Time burns.',
    es: '{a} hace gestos de amenaza a {t}; sostienen su mirada. El tiempo corre.',
  },
  'npc.demand.take': {
    en: '{a} out-haggles {t} and takes a good from the wagon.',
    es: '{a} regatea mejor que {t} y toma un bien del carro.',
  },
  'npc.demand.takeB': {
    en: "{a} snatches food from under {t}'s nose.",
    es: '{a} arrebata comida de bajo las narices de {t}.',
  },
  'npc.demand.empty': {
    en: '{a} presses {t} but there is nothing left to take.',
    es: '{a} presiona a {t}, pero ya no queda nada que tomar.',
  },
  'npc.demand.emptyB': {
    en: '{a} snaps at the wagon but finds only empty hands.',
    es: '{a} muerde el carro, pero solo halla manos vacías.',
  },
  'npc.demand.keep': {
    en: '{a} haggles hard, but {t} holds the line.',
    es: '{a} regatea con dureza, pero {t} sostiene la línea.',
  },
  'npc.demand.keepB': {
    en: '{a} snaps at your cargo; {t} cracks the whip and keeps it.',
    es: '{a} muerde tu carga; {t} chasquea el látigo y la conserva.',
  },
  'npc.draw': {
    en: '{a} snaps orders — weapons come out on their side. Standoff!',
    es: '{a} da órdenes tajantes; sacan las armas. ¡Enfrentamiento!',
  },
  'npc.drawB': {
    en: '{a} snarls — the pack closes in. It is a fight now!',
    es: '{a} gruñe: la manada se cierra. ¡Ahora es una pelea!',
  },
  'npc.rally': {
    en: "{a} stiffens their group's resolve.",
    es: '{a} fortalece la determinación de su grupo.',
  },
  'npc.rallyB': {
    en: '{a} howls. The pack stiffens.',
    es: '{a} aúlla. La manada se yergue.',
  },
  'patience.spent': {
    en: 'Patience is spent — they stop talking and come at you!',
    es: 'La paciencia se agota: ¡dejan de hablar y van a por ti!',
  },
  'end.trade': {
    en: 'Deal struck: {goods} goods change hands. The way is open.',
    es: 'Trato cerrado: {goods} bienes cambian de manos. El paso queda abierto.',
  },
  'end.deal': {
    en: 'Terms accepted — {a} seals a deal with a handshake.',
    es: 'Condiciones aceptadas: {a} sella un trato con un apretón de manos.',
  },
  'end.alliance': {
    en: 'They clasp arms with your party — an alliance is struck.',
    es: 'Unen los brazos con tu grupo: se sella una alianza.',
  },
  'end.victoryBreaks': {
    en: 'The other side breaks — they throw down weapons and scatter. You hold the field.',
    es: 'El otro bando rompe: arrojan las armas y se dispersan. Controlas el terreno.',
  },
  'end.leaderRout': {
    en: '{leader} falls — leaderless, they lose their nerve and scatter.',
    es: '{leader} cae: sin líder, pierden el ánimo y se dispersan.',
  },
  'end.demandMet': {
    en: 'They have taken what they came for ({goods} goods) and let you pass.',
    es: 'Han tomado lo que buscaban ({goods} bienes) y te dejan pasar.',
  },
  'end.demandMetB': {
    en: 'They have eaten their fill of the offering ({goods} goods) and drift back from the trail.',
    es: 'Han comido hasta saciarse con la ofrenda ({goods} bienes) y se alejan del sendero.',
  },
  'end.routed': {
    en: '{leader} falls and no one can hold the line — the party breaks and runs, leaving the field (and the cargo) behind.',
    es: '{leader} cae y nadie puede sostener la línea: el grupo rompe y huye, abandonando el campo (y la carga).',
  },
  'end.defeat': {
    en: 'Your party is broken. They strip your goods and leave you on the road.',
    es: 'Tu grupo está derrotado. Se llevan tus bienes y te dejan en el camino.',
  },
  'end.escaped': {
    en: 'The party melts into the terrain. By the time anyone shouts, you are gone.',
    es: 'El grupo se funde con el terreno. Cuando alguien grita, ya no están.',
  },
  'end.overrun': {
    en: 'The standoff drags until your party, exhausted, is overrun.',
    es: 'El enfrentamiento se alarga hasta que tu grupo, agotado, es arrollado.',
  },
  'end.walkedAway': {
    en: 'They lose interest, shoulder their gear, and walk away. The moment is gone.',
    es: 'Pierden el interés, cargan sus pertenencias y se marchan. La ocasión se pierde.',
  },
} as const satisfies Record<string, Msg>;

export type MsgKey = keyof typeof MESSAGES;

// 'scenario.blurb' is data-driven prose from src/data/scenarios.ts, not a
// static template: the English blurb travels in params.blurb and the Spanish
// translation is looked up by scenario id at render time.
export type LogKey = MsgKey | 'scenario.blurb';

export function renderLog(locale: 'en' | 'es', key: LogKey, params: MsgParams = {}): string {
  if (key === 'scenario.blurb') return String(params.blurb ?? '');
  const template = MESSAGES[key][locale];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''));
}
