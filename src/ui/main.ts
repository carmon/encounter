import { createParley, resolveStep, memberOf, canParley } from '../core/engine';
import type { Character, Ending, Order, ParleyState, PlayerAction } from '../core/types';
import { groupSharesLanguage } from '../core/affinity';
import { SCENARIOS } from '../data/scenarios';
import type { ScenarioDef } from '../data/scenarios';
import { actionLabel, currentLocale, localizeLog, scenarioText, setLocale, stanceLabel, t, worldLabel } from '../i18n';
import '../style.css';

const app = document.getElementById('app') as HTMLElement;

interface Setup {
  scenario: ScenarioDef | null;
  picked: string[];
  pool: string[];
}

interface Game {
  scenario: ScenarioDef;
  state: ParleyState;
  actions: Map<string, PlayerAction>;
  goods: Map<string, number>;
  targets: Map<string, string>;
  timer: number | null;
  awaiting: string | null;
  resumeAfterAct: boolean;
}

let setup: Setup = { scenario: null, picked: [], pool: [] };
let game: Game | null = null;

const ENDINGS: Record<Exclude<Ending, 'ongoing'>, { title: string; cls: string }> = {
  trade: { title: 'Trade Concluded', cls: 'good' },
  deal: { title: 'Deal Struck', cls: 'good' },
  alliance: { title: 'Alliance!', cls: 'good' },
  victory: { title: 'They Broke', cls: 'good' },
  escaped: { title: 'Clean Escape', cls: 'good' },
  defeat: { title: 'Your Party Broke', cls: 'bad' },
  routed: { title: 'Routed', cls: 'bad' },
  walkedAway: { title: 'They Walked Away', cls: 'neutral' },
};

const SKILL_SHORT: Record<string, string> = {
  combat: 'CMB',
  trade: 'TRD',
  diplomacy: 'DIP',
  leadership: 'LDR',
  perception: 'PER',
};

const SKILL_INFO: Record<string, string> = {
  combat: 'Combat — decides exchanges once weapons are drawn; backs threats of force',
  trade: 'Trade — haggling, offers, resisting demands on your cargo',
  diplomacy: 'Diplomacy — talk, persuade, threaten, bluff',
  leadership: 'Leadership — the Primary Leader grants +LDR/2 (max 2) to every party check; drives Rally and Coordinated Threat; steadies the group if the leader falls',
  perception: 'Perception — appraise, size up, spot withdrawals and bluffs',
};

const TEMPER_INFO: Record<string, string> = {
  aggressive: 'Aggressive — leans on threats and steel; quick to escalate',
  cautious: 'Cautious — probes and stalls; only fights when cornered',
  greedy: 'Greedy — demands goods and presses deals above all',
  honorable: 'Honorable — keeps its word; judges you by your conduct',
  vain: 'Vain — flattery (Talk) works doubly well on them',
};

const TARGETED: Set<PlayerAction> = new Set(['talk', 'persuade', 'threaten', 'bluff', 'appraise', 'attack']);

// Deliberate design choice: the setup screen shows a shuffled candidate pool
// of this size (out of the 9 roster templates), so every run hides some
// options and shuffle re-rolls the pool.
const POOL_SIZE = 8;

const ACTIONS_REF: Array<[string, string, string]> = [
  ['Hold back', 'anyone', 'Skip this turn and watch. In a standoff, hold your ground without swinging.'],
  ['Talk', 'target', 'Opposed DIP vs the target. Aim at their leader for full stance gain — others only respond on decisive wins. Free if it fails.'],
  ['Persuade', 'target', 'Opposed DIP vs the target. Only their leader shifts the group\'s mood fully; others cave only on decisive wins.'],
  ['Offer goods', 'their leader', 'Opposed TRD. Accepted when stance ≥ their threshold and goods ≥ demand; a decisive haggle lowers the price by 1.'],
  ['Gift', 'open accord', 'Only at Open stance: lose 1 cargo, gain 1 trust, and seal an alliance.'],
  ['Appraise', 'target', 'PER + d6 ≥ 7 reveals the target\'s skills; ≥ 10 also their temperament.'],
  ['Size up', '—', 'PER + d6 ≥ 7 reveals a hint of their goal; ≥ 10 reveals the full intent.'],
  ['Threaten', 'target', 'Opposed DIP. Target loses 2–3 morale (decisive: everyone −1), stance down, 1 patience burned — and a feud is born.'],
  ['Bluff', 'target', 'Opposed DIP vs the target\'s PER. Stance +1 if believed; badly caught costs stance, patience and a feud.'],
  ['Interpret', 'anyone with a shared tongue', 'Bridges the language gap. Others speak through the relay at −1.'],
  ['Draw weapons', 'anyone', 'Ends talk. One random party member gains +2 Initiative for the next combat round, the others +1; standoff turns run highest Initiative first.'],
  ['Attack', 'target', 'Standoff only. Opposed CMB vs the target (−2 if they guard). A hit costs them 2–3 morale.'],
  ['Guard', '—', 'Standoff only. Until your next action: attacks against you are at −2, and a missed blow is countered for 1–2 morale.'],
  ['Signal escape', 'anyone', 'Marks a route: later Withdraw attempts get +2.'],
  ['Rally', 'leader only', 'Opposed LDR. Party morale +2 (+3 on a decisive win). Works mid-standoff too.'],
  ['Coordinated threat', 'leader only', 'Opposed LDR. Their leader loses 2 morale, stance down; burns 1 patience — and their leader holds a grudge.'],
  ['Final offer', 'leader only', 'Opposed DIP. Seals a deal if stance is Neutral or better; refusal sours relations.'],
  ['Withdraw', 'leader only', 'Opposed PER (+2 with escape route). Success = leave with your holdings; spotted = the fight goes on.'],
];

const REF_NOTES = `
  <p><strong>Feuds (⚔)</strong> — threats, caught bluffs and snatched cargo breed grudges. A grudge-holder singles their target out on their turns — and anyone holding a feud gets +1 on checks against the other side of it. Use it: threaten the one who robbed you.</p>
  <p><strong>Standoff</strong> — once weapons are drawn, every fighter acts each round in Initiative order. Drawing weapons gives one random party member +2 Initiative and the rest +1 for the next combat round. <strong>Attack</strong> a chosen foe, <strong>Guard</strong> to turn blows and counter (lasts until your next action), or the leader may <strong>Rally</strong>/<strong>Withdraw</strong>. Morale is the blood — at 0 a fighter breaks, and a side whose fighters break loses.</p>
  <p><strong>Broken fighters are out</strong> — at morale 0 they stop acting and can no longer intervene. If a <strong>Primary Leader falls</strong>, the best surviving Leadership takes command — but there is a chance the whole group routs and runs (rout on d6 ≤ 6 − that Leadership: a strong second keeps everyone steady).</p>
  <p><strong>No shared tongue?</strong> Talk, Persuade, Bluff, Offer and Final Offer are blocked until someone Interprets. Against beasts there is no speech at all — those actions are off the table. A <strong>Gift</strong> is only available once the other side is Open, when it seals an alliance.</p>
  <p><strong>Pacing</strong> — each character acts in turn, and the game pauses on every party member's turn so you can pick an action. Click the <strong>▶ now</strong> tag on the current card to let the scene play out on its own; click it again to pause.</p>
`;

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function vitals(m: number): string {
  return `<span class="vitals ${m <= 3 ? 'vit-low' : ''}" title="Morale — at 0 a fighter breaks and is out">♥ ${m}/10</span>`;
}

function initiative(value: number): string {
  const safe = Math.max(2, Math.min(12, value));
  return `<span class="initiative" title="Initiative — higher scores act first in a standoff"><span>INIT</span><b>${safe}</b><i style="width:${(safe / 12) * 100}%"></i></span>`;
}

function stanceMeter(s: number): string {
  return Array.from({ length: 5 }, (_, i) => `<span class="seg ${i === s ? 'seg-on' : ''}">${stanceLabel(i)}</span>`).join('');
}

function langLabel(l: string): string {
  return worldLabel(l);
}

function natLabel(n: string): string {
  return worldLabel(n);
}

function skillLine(s: { combat: number; trade: number; diplomacy: number; leadership: number; perception: number }): string {
  return Object.keys(SKILL_SHORT)
    .map((k) => `<span class="skill" title="${SKILL_INFO[k]}">${SKILL_SHORT[k]} <b>${s[k as keyof typeof s]}</b></span>`)
    .join('');
}

function temperSpan(t: string): string {
  return `<span class="skill" title="${TEMPER_INFO[t] ?? ''}">${t}</span>`;
}

function actionsRefTable(): string {
  return `<table class="actions-ref">
    <thead><tr><th>Action</th><th>Who</th><th>Effect</th></tr></thead>
    <tbody>${ACTIONS_REF.map(([a, w, e]) => `<tr><td>${a}</td><td>${w}</td><td>${e}</td></tr>`).join('')}</tbody>
  </table>`;
}

function attachRefPopup(): void {
  document.querySelectorAll('.ref-fab, .ref-popup, .locale-fab').forEach((n) => n.remove());
  const fab = el('<button class="ref-fab" title="Actions reference">?</button>');
  const popup = el(`<div class="ref-popup hidden"><div class="ref-popup-inner">
    <button class="ref-close" title="Close">×</button>
    <h3>Actions reference</h3>
    ${actionsRefTable()}
    <div class="ref-notes">${REF_NOTES}</div>
  </div></div>`);
  const localeFab = el(
    `<button class="locale-fab" title="Language / Idioma">${currentLocale() === 'en' ? 'ES' : 'EN'}</button>`,
  );
  document.body.appendChild(fab);
  document.body.appendChild(localeFab);
  document.body.appendChild(popup);
  fab.addEventListener('click', () => popup.classList.toggle('hidden'));
  localeFab.addEventListener('click', () => {
    setLocale(currentLocale() === 'en' ? 'es' : 'en');
    if (game) renderGame();
    else renderSetup();
  });
  popup.querySelector('.ref-close')!.addEventListener('click', () => popup.classList.add('hidden'));
  popup.addEventListener('click', (e) => {
    if (e.target === popup) popup.classList.add('hidden');
  });
}

function endingTitle(scenario: ScenarioDef, ending: Exclude<Ending, 'ongoing'>): string {
  return scenario.endingLabels?.[ending] ?? ENDINGS[ending].title;
}

function feudsOf(state: ParleyState, id: string): string[] {
  const names: string[] = [];
  for (const [k, v] of Object.entries(state.grudges)) {
    if (v <= 0) continue;
    const [h, t] = k.split('>');
    if (h !== id) continue;
    const m = memberOf(state.player, t) ?? memberOf(state.npc, t);
    if (m && m.morale > 0) names.push(m.name);
  }
  return names;
}

function shuffledPool(scenario: ScenarioDef, selected: string[]): string[] {
  const selectedSet = new Set(selected);
  const rest = scenario.roster.filter((c) => !selectedSet.has(c.id));
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...selected, ...rest.map((c) => c.id)].slice(0, POOL_SIZE);
}

function renderSetup(): void {
  app.innerHTML = '';
  const wrap = el(`<div class="setup">
    <h1 class="big-title">${t('setup.title')}</h1>
    <h2>${t('setup.scenario')}</h2>
    <div class="scenarios" id="scenarios"></div>
    <h2>${t('setup.party')} <button id="shuffle-pool" title="Shuffle the available candidates">${t('setup.shuffle', { count: POOL_SIZE })}</button></h2>
    <div class="roster" id="roster"></div>
    <div class="party" id="party"></div>
    <button id="start" class="primary" ${setup.scenario && setup.picked.length === 3 ? '' : 'disabled'}>${t('setup.start')}</button>
  </div>`);
  app.appendChild(wrap);
  attachRefPopup();

  const sc = wrap.querySelector('#scenarios') as HTMLElement;
  for (const s of SCENARIOS) {
    const t = scenarioText(s.id, s);
    const bullets = t.bullets.map((b) => `<li>${b}</li>`).join('');
    const card = el(`<div class="card scenario ${setup.scenario?.id === s.id ? 'sel' : ''}">
      <h3>${t.name}</h3><ul class="scenario-bullets">${bullets}</ul></div>`);
    card.addEventListener('click', () => {
      setup.scenario = s;
      setup.picked = [];
      setup.pool = shuffledPool(s, []);
      renderSetup();
    });
    sc.appendChild(card);
  }

  const rosterEl = wrap.querySelector('#roster') as HTMLElement;
  const fullRoster = setup.scenario?.roster ?? [];
  if (setup.scenario && setup.pool.length === 0) setup.pool = shuffledPool(setup.scenario, setup.picked);
  const roster = setup.pool.map((id) => fullRoster.find((c) => c.id === id)).filter((c): c is Character => !!c);
  for (const c of roster) {
    const picked = setup.picked.includes(c.id);
    const card = el(`<div class="card char ${picked ? 'sel' : ''}">
      <div class="char-name">${c.name}</div>
      <div class="char-meta">${natLabel(c.nationality)} · ${temperSpan(c.temperament)}</div>
      <div class="char-meta">${c.languages.map(langLabel).join(', ')}</div>
      <div class="char-skills">${skillLine(c.skills)}</div>
    </div>`);
    card.addEventListener('click', () => {
      if (picked) setup.picked = setup.picked.filter((x) => x !== c.id);
      else if (setup.picked.length < 3) setup.picked.push(c.id);
      renderSetup();
    });
    rosterEl.appendChild(card);
  }

  (wrap.querySelector('#shuffle-pool') as HTMLButtonElement).addEventListener('click', () => {
    if (!setup.scenario) return;
    setup.pool = shuffledPool(setup.scenario, setup.picked);
    renderSetup();
  });

  const partyEl = wrap.querySelector('#party') as HTMLElement;
  setup.picked.forEach((id, i) => {
    const c = roster.find((x) => x.id === id);
    if (!c) return;
    const row = el(`<div class="party-row">
      <span class="badge ${i === 0 ? 'badge-leader' : ''}">${i === 0 ? t('game.primaryLeader') : `Slot ${i + 1}`}</span>
      <strong>${c.name}</strong>
      <button data-up="${id}" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button data-down="${id}" ${i === setup.picked.length - 1 ? 'disabled' : ''}>↓</button>
      <button data-remove="${id}">×</button>
    </div>`);
    partyEl.appendChild(row);
  });

  partyEl.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      const up = b.getAttribute('data-up');
      const down = b.getAttribute('data-down');
      const rm = b.getAttribute('data-remove');
      if (up) {
        const i = setup.picked.indexOf(up);
        [setup.picked[i - 1], setup.picked[i]] = [setup.picked[i], setup.picked[i - 1]];
      } else if (down) {
        const i = setup.picked.indexOf(down);
        [setup.picked[i + 1], setup.picked[i]] = [setup.picked[i], setup.picked[i + 1]];
      } else if (rm) {
        setup.picked = setup.picked.filter((x) => x !== rm);
      }
      renderSetup();
    });
  });

  (wrap.querySelector('#start') as HTMLButtonElement).addEventListener('click', () => {
    if (!setup.scenario || setup.picked.length !== 3) return;
    const state = createParley(setup.scenario, setup.picked, (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    const first = state.plan[0];
    game = {
      scenario: setup.scenario,
      state,
      actions: new Map(),
      goods: new Map(),
      targets: new Map(),
      timer: null,
      awaiting: first && first.side === 'player' ? first.actorId : null,
      resumeAfterAct: false,
    };
    renderGame();
  });
}

function availableActions(state: ParleyState, actorId: string, isLeader: boolean): PlayerAction[] {
  if (state.standoff) {
    const list: PlayerAction[] = ['hold', 'attack', 'defend'];
    if (isLeader) {
      if (state.player.members.some((m) => m.morale > 0 && m.morale < 10)) list.push('rally');
      list.push('withdraw');
    }
    return list;
  }
  const actor = memberOf(state.player, actorId);
  if (!actor) return ['hold'];
  const aliveNpcs = state.npc.members.filter((m) => m.morale > 0);
  const socialOK = state.speech === 'tongues' && canParley(state);
  const list: PlayerAction[] = ['hold'];
  if (socialOK) list.push('talk', 'persuade', 'bluff');
  list.push('threaten');
  if (socialOK && state.player.resources >= 1) list.push('offer');
  if (state.stance >= 3 && state.player.resources >= 1) list.push('gift');
  if (aliveNpcs.some((m) => !state.revealedSkills.includes(m.id))) list.push('appraise');
  if (!state.goalKnown) list.push('sizeup');
  if (!canParley(state) && state.speech === 'tongues' && !state.player.interpreterId && groupSharesLanguage(actor, aliveNpcs)) {
    list.push('interpret');
  }
  if (!state.player.escapeReady) list.push('signalEscape');
  list.push('draw');
  if (isLeader) {
    if (socialOK && state.stance >= 2) list.push('finalOffer');
    if (state.player.members.some((m) => m.morale > 0 && m.morale < 10)) list.push('rally');
    list.push('coordinatedThreat', 'withdraw');
  }
  return list;
}

function defaultTarget(state: ParleyState, action: PlayerAction): string {
  if (action === 'appraise') {
    return (
      state.npc.members.find((m) => m.morale > 0 && !state.revealedSkills.includes(m.id))?.id ??
      state.npc.order[0]
    );
  }
  if (action === 'attack') {
    const alive = state.npc.members.filter((m) => m.morale > 0).sort((a, b) => a.morale - b.morale);
    return alive[0]?.id ?? state.npc.order[0];
  }
  return state.npc.order[0];
}

function queuedAction(viewed: ParleyState, id: string): PlayerAction {
  const isLeader = viewed.player.order[0] === id;
  const acts = availableActions(viewed, id, isLeader);
  const chosen = game!.actions.get(id) ?? 'hold';
  return acts.includes(chosen) ? chosen : 'hold';
}

function turnRow(viewed: ParleyState, side: 'player' | 'npc', id: string, flag: string | null): HTMLElement {
  const group = side === 'player' ? viewed.player : viewed.npc;
  const c = memberOf(group, id)!;
  const broken = c.morale <= 0;
  const isLeader = group.order[0] === id;
  const guarding = viewed.defending.includes(id);
  const feuds = feudsOf(viewed, id);
  const flagHtml = flag ? `<span class="turn-flag">${t('game.now')}</span>` : '';
  const stats = `<div class="row-stats">${vitals(c.morale)} ${initiative(viewed.initiative[id] ?? 2)}</div>`;
  if (side === 'npc') {
    const revealed = viewed.revealedSkills.includes(id);
    const temper = viewed.revealedTemper.includes(id);
    return el(`<div class="turn-row side-npc ${broken ? 'broken' : ''} ${flag ? 'turn-now' : ''}">
      ${flagHtml}
      <span class="side-chip them">${t('game.they')}</span>
      <div class="row-main">
        <div class="char-name">${c.name} ${isLeader ? `<span class="badge badge-leader">${t('game.theirLeader')}</span>` : ''}${guarding ? `<span class="badge badge-guard" title="Attacks against them are −2, and a missed blow is countered">${t('game.guarding')}</span>` : ''}</div>
        <div class="char-meta" title="${c.languages.map(langLabel).join(', ')}">${natLabel(c.nationality)} · ${temper ? temperSpan(c.temperament) : 'manner unknown'}</div>
        <div class="char-skills">${revealed ? skillLine(c.skills) : 'abilities unknown'}</div>
        ${feuds.length ? `<div class="feuds" title="They hold a grudge — expect them to single these members out">⚔ ${feuds.join(', ')}</div>` : ''}
      </div>
      ${stats}
    </div>`);
  }
  const isInterp = viewed.player.interpreterId === id;
  const queued = queuedAction(viewed, id);
  return el(`<div class="turn-row side-player ${broken ? 'broken' : ''} ${flag ? 'turn-now' : ''}">
    ${flagHtml}
    <span class="side-chip you">${t('game.you')}</span>
    <div class="row-main">
      <div class="char-name">${c.name}
        ${isLeader ? `<span class="badge badge-leader">${t('game.primaryLeader')}</span>` : ''}
        ${isInterp ? `<span class="badge">${t('game.interpreter')}</span>` : ''}
        ${guarding ? `<span class="badge badge-guard" title="Attacks against them are −2, and a missed blow is countered">${t('game.guarding')}</span>` : ''}
      </div>
      <div class="char-meta" title="${c.languages.map(langLabel).join(', ')}">${natLabel(c.nationality)} · ${temperSpan(c.temperament)}</div>
      <div class="char-skills">${skillLine(c.skills)}</div>
      ${feuds.length ? `<div class="feuds feuds-payback" title="Payback: +1 on checks against them">⚔ ${feuds.join(', ')}</div>` : ''}
      ${broken ? '' : `<div class="queued" title="Action pre-selected for this member's next turn">${actionLabel(queued)}</div>`}
    </div>
    ${stats}
  </div>`);
}

function stopTimer(): void {
  if (game?.timer !== null && game?.timer !== undefined) {
    clearInterval(game.timer);
    game.timer = null;
  }
}

function advance(force: boolean): void {
  if (!game || game.state.ended !== 'ongoing') {
    stopTimer();
    return;
  }
  const base = game.state;
  const actor = base.plan[base.stepCursor] ?? null;
  if (actor && actor.side === 'player' && !force) {
    const m = memberOf(base.player, actor.actorId);
    if (m && m.morale > 0) {
      game.awaiting = actor.actorId;
      if (game.timer !== null) {
        stopTimer();
        game.resumeAfterAct = true;
      }
      renderGame();
      return;
    }
  }
  const orders: Order[] = base.player.order.map((id) => ({
    actorId: id,
    action: game!.actions.get(id) ?? 'hold',
    goods: game!.goods.get(id) ?? 1,
    targetId: game!.targets.get(id),
  }));
  const next = resolveStep(base, orders);
  game.state = next;
  game.awaiting = null;
  if (next.ended !== 'ongoing') {
    stopTimer();
    game.resumeAfterAct = false;
  } else if (next.round > base.round) {
    game.actions.forEach((v, k) => {
      const isLeader = next.player.order[0] === k;
      if (!availableActions(next, k, isLeader).includes(v)) game!.actions.set(k, 'hold');
    });
  }
  if (game.resumeAfterAct && game.timer === null && game.state.ended === 'ongoing') {
    game.resumeAfterAct = false;
    game.timer = window.setInterval(() => advance(false), 1100);
  }
  renderGame();
}

function speechChip(viewed: ParleyState): string {
  if (viewed.speech === 'beasts') {
    return `<span class="warnchip" title="No speech possible — gifts of food, threats, or steel speak for you">${t('game.noSpeech')}</span>`;
  }
  if (!canParley(viewed)) {
    return `<span class="warnchip" title="No shared tongue — someone must Interpret before any real negotiation">${t('game.noTongue')}</span>`;
  }
  return '';
}

function togglePlay(): void {
  if (!game || game.state.ended !== 'ongoing' || game.awaiting) return;
  if (game.timer !== null) {
    stopTimer();
    game.resumeAfterAct = false;
    renderGame();
  } else {
    game.timer = window.setInterval(() => advance(false), 1100);
    advance(false);
  }
}

function renderGame(): void {
  if (!game) return;
  const viewed = game.state;
  const nextActor = viewed.ended === 'ongoing' ? viewed.plan[viewed.stepCursor] ?? null : null;

  const flagFor = (side: 'player' | 'npc', id: string): string | null => {
    const m = memberOf(side === 'player' ? viewed.player : viewed.npc, id);
    if (!m || m.morale <= 0) return null;
    if (nextActor && nextActor.side === side && nextActor.actorId === id) return '▶ now';
    return null;
  };

  const awaitingId = game.awaiting && viewed.ended === 'ongoing' ? game.awaiting : null;
  const awaitingChar = awaitingId ? memberOf(viewed.player, awaitingId) : undefined;
  const useAct = awaitingId ? queuedAction(viewed, awaitingId) : 'hold';
  const pickMode = !!(awaitingId && awaitingChar && awaitingChar.morale > 0 && TARGETED.has(useAct));
  const storedTarget = awaitingId ? game.targets.get(awaitingId) : undefined;
  const storedAlive = !!(storedTarget && (memberOf(viewed.npc, storedTarget)?.morale ?? 0) > 0);
  const selTargetId = pickMode
    ? storedAlive ? storedTarget! : defaultTarget(viewed, useAct)
    : null;

  app.innerHTML = '';
  const wrap = el(`<div class="game">
    <header class="topbar">
      <div><strong>${scenarioText(game.scenario.id, game.scenario).name}</strong> · ${t('game.round')} ${viewed.round}</div>
      <div class="topbar-right">
        ${viewed.standoff ? `<span class="warnchip standoff-chip">${t('game.standoffLabel')}</span>` : ''}
        <div>${t('game.stance')} <span class="stance">${stanceMeter(viewed.stance)}</span></div>
      </div>
    </header>
    <div class="columns">
      <div class="col">
        <h2>${t('game.turnOrder')} ${speechChip(viewed)}</h2>
        <div class="turn-list" id="turn-list"></div>
      </div>
      <div class="col">
        <h2>${t('game.chronicle')}</h2>
        <div class="log" id="log"></div>
      </div>
    </div>
  </div>`);
  app.appendChild(wrap);
  attachRefPopup();

  const turnList = wrap.querySelector('#turn-list') as HTMLElement;
  for (const step of viewed.plan) {
    const row = turnRow(viewed, step.side, step.actorId, flagFor(step.side, step.actorId));
    if (step.side === 'player' && step.actorId === awaitingId && awaitingChar && awaitingChar.morale > 0) {
      const acts = availableActions(viewed, awaitingId, viewed.player.order[0] === awaitingId);
      const goods = Math.max(1, Math.min(viewed.player.resources, game.goods.get(awaitingId) ?? 1));
      const act = el(`<div class="row-act">
        <select class="act-select" title="Choose this member's action">
          ${acts.map((a) => `<option value="${a}" ${a === useAct ? 'selected' : ''}>${actionLabel(a)}</option>`).join('')}
        </select>
        ${pickMode
          ? `<select class="target-select" title="${t('game.aim')}">${viewed.npc.members
              .filter((m) => m.morale > 0)
              .map((m) => `<option value="${m.id}" ${m.id === selTargetId ? 'selected' : ''}>${m.name}</option>`)
              .join('')}</select>`
          : ''}
        ${useAct === 'offer'
          ? `<select class="goods-select" title="Goods on the table">${Array.from({ length: viewed.player.resources }, (_, i) => i + 1)
              .map((n) => `<option value="${n}" ${n === goods ? 'selected' : ''}>${n}</option>`)
              .join('')}</select>`
          : ''}
        <button class="primary go">${t('game.go')}</button>
      </div>`);
      (act.querySelector('.act-select') as HTMLSelectElement).addEventListener('change', (e) => {
        if (!game || !awaitingId) return;
        game.actions.set(awaitingId, (e.target as HTMLSelectElement).value as PlayerAction);
        renderGame();
      });
      const targetSel = act.querySelector('.target-select') as HTMLSelectElement | null;
      targetSel?.addEventListener('change', (e) => {
        if (!game || !awaitingId) return;
        game.targets.set(awaitingId, (e.target as HTMLSelectElement).value);
        renderGame();
      });
      const goodsSel = act.querySelector('.goods-select') as HTMLSelectElement | null;
      goodsSel?.addEventListener('change', (e) => {
        if (!game || !awaitingId) return;
        game.goods.set(awaitingId, Math.max(1, Math.min(viewed.player.resources, Number((e.target as HTMLSelectElement).value))));
        renderGame();
      });
      (act.querySelector('.go') as HTMLButtonElement).addEventListener('click', () => {
        advance(true);
      });
      (row.querySelector('.row-main') as HTMLElement).appendChild(act);
    }
    if (nextActor && nextActor.side === step.side && nextActor.actorId === step.actorId && viewed.ended === 'ongoing') {
      const flagEl = row.querySelector('.turn-flag') as HTMLElement | null;
      if (flagEl) {
        flagEl.classList.add('turn-flag-btn');
        if (awaitingId === step.actorId) {
          flagEl.title = t('game.go');
          flagEl.addEventListener('click', () => advance(true));
        } else {
          const playing = game.timer !== null;
          flagEl.textContent = playing ? t('game.pause') : t('game.now');
          flagEl.title = playing ? t('game.pause') : t('game.play');
          flagEl.addEventListener('click', () => togglePlay());
        }
      }
    }
    turnList.appendChild(row);
  }
  if (awaitingId) turnList.classList.add('has-active');
  for (const side of ['player', 'npc'] as const) {
    const group = side === 'player' ? viewed.player : viewed.npc;
    for (const m of group.members) {
      if (m.morale > 0 || viewed.plan.some((p) => p.side === side && p.actorId === m.id)) continue;
      turnList.appendChild(turnRow(viewed, side, m.id, null));
    }
  }

  const logEl = wrap.querySelector('#log') as HTMLElement;
  for (const e of [...viewed.log].reverse()) {
    logEl.appendChild(el(`<div class="log-line log-${e.kind}"><span class="log-round">R${e.round}</span>${localizeLog(e)}${e.delta ? `<span class="delta">${e.delta}</span>` : ''}</div>`));
  }

  if (viewed.ended !== 'ongoing') {
    const meta = ENDINGS[viewed.ended];
    const title = endingTitle(game.scenario, viewed.ended);
    const finalLog = [...viewed.log].reverse().find((l) => l.kind === 'end');
    wrap.appendChild(el(`<div class="overlay"><div class="overlay-box ${meta.cls}">
      <h1>${title}</h1>
      <p>${finalLog ? localizeLog(finalLog) : ''}</p>
      <p class="sub">Trust carried out of the parley: ${viewed.trust} · Cargo remaining: ${viewed.player.resources}</p>
      <button id="again" class="primary">${t('ending.again')}</button>
    </div></div>`));
    (wrap.querySelector('#again') as HTMLButtonElement).addEventListener('click', () => {
      stopTimer();
      setup = { scenario: setup.scenario, picked: [], pool: setup.scenario ? shuffledPool(setup.scenario, []) : [] };
      game = null;
      renderSetup();
    });
  }
}

renderSetup();
