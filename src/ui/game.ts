import { itemsFor, legalActions, NEEDS_TARGET, targetsFor } from '../engine/actions';
import { npcChoice } from '../engine/ai';
import { buildOutput, currentStep, GOOD_OUTCOMES, respond, step } from '../engine/encounter';
import { active, find, findItem, heldItems, price, sideOf, tradable, verb, visibleToPlayer } from '../engine/rules';
import type { ActionId, Character, Choice, EncounterState, Item, Side } from '../engine/types';
import {
  ACTION_HELP,
  attrs,
  dispositionBar,
  el,
  esc,
  initiative,
  items,
  itemChip,
  mountReference,
  origin,
  temper,
  tensionBar,
  tongues,
  vitals,
} from './components';

export interface Session {
  st: EncounterState;
  draft: Map<string, Choice>;
  paused: boolean;
  timer: number | null;
  onExit: () => void;
}

const NPC_DELAY = 750;

const goalTags = (st: EncounterState) => st.scenario.objectives.flatMap((o) => ('tag' in o.check ? [o.check.tag] : []));

function stopTimer(s: Session) {
  if (s.timer !== null) clearTimeout(s.timer);
  s.timer = null;
}

function schedule(root: HTMLElement, s: Session) {
  stopTimer(s);
  const cur = currentStep(s.st);
  if (!cur || cur.side !== 'npc' || s.st.pending || s.paused) return;
  s.timer = window.setTimeout(() => {
    s.timer = null;
    const now = currentStep(s.st);
    if (!now || now.side !== 'npc' || s.st.pending) return;
    s.st = step(s.st, npcChoice(s.st, now.actorId));
    renderGame(root, s);
  }, NPC_DELAY);
}

// ── choice drafting ─────────────────────────────────────────────────
function defaultChoice(st: EncounterState, actor: Character, action: ActionId): Choice {
  const c: Choice = { action };
  const npc = st.groups.npc;
  const foes = active(npc);
  if (NEEDS_TARGET.includes(action)) {
    const pool = action === 'sway' ? targetsFor(st, actor, 'sway') : foes;
    const ldr = npc.leaderKnown ? pool.find((f) => f.id === npc.leaderId) : undefined;
    c.targetId = (action === 'strike' ? [...pool].sort((a, b) => a.resolve - b.resolve)[0] : ldr ?? pool[0])?.id;
  }
  if (['give', 'take', 'use', 'strike'].includes(action)) c.itemId = itemsFor(st, actor, action)[0]?.id;
  if (action === 'use') {
    const it = itemsFor(st, actor, 'use')[0];
    if (it?.effect?.type === 'heal') c.targetId = [...active(st.groups.player)].sort((a, b) => a.resolve - b.resolve)[0]?.id;
  }
  if (action === 'propose') Object.assign(c, { give: [], ask: [], join: false });
  return c;
}

function draftFor(s: Session, actor: Character): Choice {
  const legal = legalActions(s.st, actor.id);
  const d = s.draft.get(actor.id);
  if (d && legal.includes(d.action)) return d;
  const pref: ActionId[] = s.st.fight ? ['strike', 'guard'] : ['parley', 'read', 'guard'];
  const action = pref.find((a) => legal.includes(a)) ?? legal[0] ?? 'guard';
  const c = defaultChoice(s.st, actor, action);
  s.draft.set(actor.id, c);
  return c;
}

// ── rows ────────────────────────────────────────────────────────────
function movedBadge(st: EncounterState, c: Character) {
  const t = [...st.transfers].reverse().find((x) => x.kind === 'character' && x.id === c.id);
  return t ? `<span class="badge badge-moved" title="Changed group in round ${t.round}">${t.how}</span>` : '';
}

function row(st: EncounterState, side: Side, c: Character, now: boolean, done: boolean) {
  const g = st.groups[side];
  const broken = c.resolve <= 0;
  const leads = g.leaderId === c.id;
  const ini = st.initiative[c.id];
  const flag = now ? `<span class="turn-flag">▶ now</span>` : '';
  const stats = `<div class="row-stats">${vitals(c)}${initiative(ini?.value, ini?.parts)}</div>`;
  const guard = st.guarding.includes(c.id) ? '<span class="badge badge-guard" title="Hits against them are −2; a miss is countered">guarding</span>' : '';
  const cls = `turn-row side-${side} ${broken ? 'broken' : ''} ${now ? 'turn-now' : ''} ${done ? 'done' : ''}`;
  if (side === 'npc') {
    const knownA = st.known.attrs.includes(c.id);
    const leaderBadge = leads && g.leaderKnown ? '<span class="badge badge-leader">Their leader</span>' : '';
    return el(`<div class="${cls}" data-id="${c.id}">${flag}
      <span class="side-chip them">Them</span>
      <div class="row-main">
        <div class="char-name">${esc(c.name)} ${leaderBadge}${guard}${movedBadge(st, c)}</div>
        <div class="char-meta" title="Speaks ${tongues(c)}">${origin(c)} · ${knownA ? temper(c) : '<span class="unknown">manner unknown</span>'}</div>
        <div class="char-skills">${knownA ? attrs(c) : '<span class="unknown">abilities unknown — Read them</span>'}</div>
        ${items(c.items.filter((i) => (!i.tags.includes('natural') || knownA) && visibleToPlayer(st, { side: 'npc', holder: c, item: i })), goalTags(st))}
      </div>${stats}</div>`);
  }
  return el(`<div class="${cls}" data-id="${c.id}">${flag}
    <span class="side-chip you">You</span>
    <div class="row-main">
      <div class="char-name">${esc(c.name)} ${leads ? '<span class="badge badge-leader">Leader</span>' : ''}${guard}${movedBadge(st, c)}</div>
      <div class="char-meta" title="Speaks ${tongues(c)}">${origin(c)} · ${temper(c)} · ${tongues(c)}</div>
      <div class="char-skills">${attrs(c)}</div>
      ${items(c.items, goalTags(st))}
    </div>${stats}</div>`);
}

function option(value: string, label: string, sel: boolean) {
  return `<option value="${esc(value)}" ${sel ? 'selected' : ''}>${esc(label)}</option>`;
}

function itemLabel(st: EncounterState, it: Item, self?: Character) {
  const h = findItem(st, it.id);
  if (h?.holder && h.holder.id === self?.id) return it.name;
  return `${it.name} (${h?.holder ? h.holder.name : 'group'})`;
}

function actionControls(root: HTMLElement, s: Session, actor: Character): HTMLElement {
  const st = s.st;
  const legal = legalActions(st, actor.id);
  const c = draftFor(s, actor);
  const rerender = () => renderGame(root, s);
  const set = (patch: Partial<Choice>) => (s.draft.set(actor.id, { ...c, ...patch }), rerender());

  const parts: string[] = [];
  parts.push(`<select class="act" title="Action">${legal.map((a) => option(a, verb(st, a, actor), a === c.action)).join('')}</select>`);

  const foes = active(st.groups.npc);
  const needsFoe = ['parley', 'press', 'read', 'strike', 'sway'].includes(c.action);
  if (needsFoe) {
    const pool = c.action === 'sway' ? targetsFor(st, actor, 'sway') : foes;
    parts.push(`<select class="tgt" title="Target">${pool.map((f) => option(f.id, f.name, f.id === c.targetId)).join('')}</select>`);
  }
  const it = c.itemId ? findItem(st, c.itemId)?.item : undefined;
  if (['give', 'take', 'use', 'strike'].includes(c.action)) {
    const list = itemsFor(st, actor, c.action);
    if (c.action === 'strike') list.length || parts.push('<span class="char-meta">bare-handed (−1)</span>');
    if (list.length) parts.push(`<select class="itm" title="Item">${list.map((i) => option(i.id, itemLabel(st, i, actor), i.id === c.itemId)).join('')}</select>`);
  }
  if (c.action === 'use' && it?.effect?.type === 'heal') {
    parts.push(`<select class="tgt" title="On whom">${active(st.groups.player).map((m) => option(m.id, `${m.name} ♥${m.resolve}`, m.id === c.targetId)).join('')}</select>`);
  }
  parts.push('<button class="primary go">▶ go</button>');
  parts.push(`<div class="act-help">${esc(ACTION_HELP[c.action][1])}</div>`);

  if (c.action === 'propose') {
    const mine = heldItems(st, 'player').filter((h) => tradable(h.item));
    const theirs = heldItems(st, 'npc').filter((h) => tradable(h.item) && visibleToPlayer(st, h));
    const chip = (h: { item: Item }, list: string[], kind: string) =>
      `<button class="chip-toggle ${list.includes(h.item.id) ? 'on' : ''}" data-${kind}="${h.item.id}" title="${esc(itemLabel(st, h.item))}">${esc(h.item.name)}</button>`;
    parts.push(`<div class="terms">
      <div><span class="lbl">You give</span>${mine.map((h) => chip(h, c.give ?? [], 'give')).join('') || '<span class="unknown">nothing</span>'}</div>
      <div><span class="lbl">You ask</span>${theirs.map((h) => chip(h, c.ask ?? [], 'ask')).join('') || '<span class="unknown">nothing you can see</span>'}</div>
      <label class="join"><input type="checkbox" class="joinbox" ${c.join ? 'checked' : ''}/> …and ask them to join your group</label>
    </div>`);
  }

  const box = el(`<div class="row-act">${parts.join('')}</div>`);
  box.querySelector<HTMLSelectElement>('.act')!.addEventListener('change', (e) => {
    s.draft.set(actor.id, defaultChoice(st, actor, (e.target as HTMLSelectElement).value as ActionId));
    rerender();
  });
  box.querySelector<HTMLSelectElement>('.tgt')?.addEventListener('change', (e) => set({ targetId: (e.target as HTMLSelectElement).value }));
  box.querySelector<HTMLSelectElement>('.itm')?.addEventListener('change', (e) => {
    const next = defaultChoice(st, actor, c.action);
    s.draft.set(actor.id, { ...next, itemId: (e.target as HTMLSelectElement).value });
    rerender();
  });
  box.querySelectorAll<HTMLButtonElement>('[data-give],[data-ask]').forEach((b) =>
    b.addEventListener('click', () => {
      const key = b.dataset.give ? 'give' : 'ask';
      const id = (b.dataset.give ?? b.dataset.ask)!;
      const list = new Set(c[key] ?? []);
      list.has(id) ? list.delete(id) : list.add(id);
      set({ [key]: [...list] });
    }),
  );
  box.querySelector<HTMLInputElement>('.joinbox')?.addEventListener('change', (e) => set({ join: (e.target as HTMLInputElement).checked }));
  box.querySelector('.go')!.addEventListener('click', () => {
    s.st = step(st, s.draft.get(actor.id) ?? c);
    s.draft.delete(actor.id);
    rerender();
  });
  return box;
}

// ── side panels ─────────────────────────────────────────────────────
function objectivesHtml(st: EncounterState) {
  const out = buildOutput(st);
  return `<ul class="objectives">${out.objectives
    .map((o) => `<li class="${o.primary ? '' : 'opt'}">${o.primary ? '◆' : '◇'} ${esc(o.label)}${o.primary ? '' : ' <span class="unknown">optional</span>'}</li>`)
    .join('')}</ul>`;
}

function agendaHtml(st: EncounterState) {
  const ag = st.scenario.agenda;
  if (st.known.agenda === 0) return '<div class="agenda">Their intent is unclear. A sharp Read might tell you more.</div>';
  if (st.known.agenda === 1) return `<div class="agenda">${esc(ag.hint)}</div>`;
  const left = Math.max(0, price(st) - st.received);
  return `<div class="agenda">${esc(ag.truth)}<br/>Right now they still want <b>${left}</b> more (${ag.wants.join(' / ')}).</div>`;
}

function holdingsHtml(st: EncounterState) {
  const npcItems = st.known.items ? items(st.groups.npc.items, goalTags(st)) || '<span class="unknown">nothing</span>' : '<span class="unknown">unknown — Read them</span>';
  return `<div class="holdings">
    <div class="panel"><h4>${esc(st.groups.player.name)} · group items</h4>${items(st.groups.player.items, goalTags(st)) || '<span class="unknown">nothing</span>'}</div>
    <div class="panel"><h4>${esc(st.groups.npc.name)} · group items</h4>${npcItems}</div>
  </div>`;
}

function proposalBox(root: HTMLElement, s: Session) {
  const p = s.st.pending!;
  const name = (id: string) => {
    const it = findItem(s.st, id)?.item;
    return it ? itemChip(it, goalTags(s.st)) : '';
  };
  const box = el(`<div class="panel proposal">
    <h4>They put terms to you</h4>
    <div class="char-meta">They want: ${p.ask.map(name).join(' ') || 'nothing'}</div>
    <div class="char-meta">They offer: ${p.give.map(name).join(' ') || 'nothing — just your way through'}</div>
    <div class="btns"><button class="primary acc">Accept</button><button class="ref">Refuse</button></div>
  </div>`);
  box.querySelector('.acc')!.addEventListener('click', () => ((s.st = respond(s.st, true)), renderGame(root, s)));
  box.querySelector('.ref')!.addEventListener('click', () => ((s.st = respond(s.st, false)), renderGame(root, s)));
  return box;
}

// ── ending ──────────────────────────────────────────────────────────
function endingOverlay(s: Session) {
  const out = buildOutput(s.st);
  const cls = out.outcome === 'defeat' ? 'bad' : out.success ? 'good' : GOOD_OUTCOMES.includes(out.outcome) ? 'neutral' : 'bad';
  const groupHtml = out.groups
    .map(
      (g) => `<div class="panel"><h4>${esc(g.name)}${g.side === 'player' ? ' (yours)' : ''}</h4>
      ${g.members.map((m) => `<div class="out-member">${m.id === g.leaderId ? '★ ' : ''}${esc(m.name)} <span class="unknown">♥${m.resolve}/${m.maxResolve}</span>${items(m.items.filter((i) => !i.tags.includes('natural')))}</div>`).join('')}
      <div class="char-meta" style="margin-top:.3rem">Group items</div>${items(g.items) || '<span class="unknown">none</span>'}</div>`,
    )
    .join('');
  const gone = out.eliminated.map((side) => `<div class="panel"><h4>${esc(s.st.groups[side].name)}</h4><span class="unknown">no longer a group — ${side === 'npc' && out.outcome === 'alliance' ? 'merged into yours' : out.outcome === 'defeat' ? 'captured' : 'scattered'}</span></div>`).join('');
  const transfers = out.transfers.length
    ? `<ul class="transfers">${out.transfers.map((t) => `<li>R${t.round} · <b>${esc(t.name)}</b> ${esc(t.from)} → ${esc(t.to)} <span class="unknown">(${t.how})</span></li>`).join('')}</ul>`
    : '<div class="unknown">Nothing changed hands.</div>';
  const changes = out.itemChanges.filter((c) => c.from !== 'new');
  const box = el(`<div class="overlay"><div class="overlay-box ${cls}">
    <h1>${esc(out.label)}</h1>
    <p class="ending-text">${esc(out.text)}</p>
    <h2>Objectives</h2>
    <ul class="objectives">${out.objectives.map((o) => `<li class="${o.met ? 'met' : 'unmet'}">${o.met ? '✓' : '✗'} ${esc(o.label)}${o.primary ? '' : ' <span class="unknown">optional</span>'}</li>`).join('')}</ul>
    <h2>Output · ${out.groups.length} group${out.groups.length === 1 ? '' : 's'} after ${out.rounds} round${out.rounds === 1 ? '' : 's'}</h2>
    <div class="out-groups">${groupHtml}${gone}</div>
    <h2>Transfers</h2>${transfers}
    ${changes.length ? `<h2>Item states</h2><ul class="transfers">${changes.map((c) => `<li><b>${esc(c.name)}</b> ${c.from} → ${c.to}</li>`).join('')}</ul>` : ''}
    <div class="overlay-actions">
      <button class="primary again">New encounter</button>
      <button class="copy" title="Copy the EncounterOutput JSON — the system's contract">Copy output JSON</button>
      <button class="log-btn">Back to the chronicle</button>
    </div>
  </div></div>`);
  box.querySelector('.again')!.addEventListener('click', () => s.onExit());
  box.querySelector('.copy')!.addEventListener('click', async (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      b.textContent = 'Copied ✓';
    } catch {
      b.textContent = 'Clipboard blocked';
    }
  });
  box.querySelector('.log-btn')!.addEventListener('click', () => box.remove());
  return box;
}

// ── page ────────────────────────────────────────────────────────────
export function renderGame(root: HTMLElement, s: Session) {
  const st = s.st;
  const cur = currentStep(st);
  const awaiting = cur && cur.side === 'player' && !st.pending ? find(st, cur.actorId) : undefined;
  const warn =
    st.scenario.speech === 'none'
      ? '<span class="warnchip" title="No speech — Parley becomes Soothe; no terms can be put">no speech</span>'
      : active(st.groups.player).some((m) => active(st.groups.npc).some((n) => n.tongues.some((t) => m.tongues.includes(t))))
        ? ''
        : '<span class="warnchip" title="Nobody shares a tongue with them — no Parley, Sway or Propose">no shared tongue</span>';
  root.innerHTML = '';
  const page = el(`<div class="game">
    <header class="topbar">
      <div><strong>${esc(st.scenario.name)}</strong> · Round ${st.round}</div>
      <div class="topbar-right">
        ${st.fight ? '<span class="warnchip fight-chip">Fight</span>' : ''}
        <div>Tension ${tensionBar(st.tension, st.scenario.tensionMax)}</div>
        <div>Disposition <span class="stance">${dispositionBar(st.disposition)}</span></div>
        <button class="pause" title="Pause or resume their turns">${s.paused ? '▶ resume' : '❚❚ pause'}</button>
      </div>
    </header>
    <div class="columns">
      <div class="col">
        <h2>Turn order ${warn} ${st.groups.npc.leaderKnown ? '' : '<span class="warnchip" style="border-color:var(--warn);color:var(--warn)" title="You do not know who leads them. Parley only fully lands on the real leader.">their leader: unknown</span>'}</h2>
        <div class="turn-list" id="turns"></div>
      </div>
      <div class="col">
        <h2>Stakes</h2>
        <div class="panel">${objectivesHtml(st)}${agendaHtml(st)}</div>
        <h2>Holdings</h2>
        ${holdingsHtml(st)}
        <h2>Chronicle</h2>
        <div id="pending"></div>
        <div class="log" id="log"></div>
      </div>
    </div>
  </div>`);
  root.appendChild(page);
  mountReference((a) => verb(st, a));

  page.querySelector('.pause')!.addEventListener('click', () => {
    s.paused = !s.paused;
    renderGame(root, s);
  });

  const list = page.querySelector('#turns')!;
  const planned = new Set<string>();
  st.plan.forEach((p, i) => {
    const c = find(st, p.actorId);
    if (!c || sideOf(st, c.id) !== p.side) return;
    planned.add(c.id);
    const now = i === st.cursor && !!cur;
    const r = row(st, p.side, c, now, i < st.cursor);
    if (now && awaiting && awaiting.id === c.id) r.querySelector('.row-main')!.appendChild(actionControls(root, s, c));
    list.appendChild(r);
  });
  for (const side of ['player', 'npc'] as const)
    for (const m of st.groups[side].members) if (!planned.has(m.id)) list.appendChild(row(st, side, m, false, false));
  if (awaiting) list.classList.add('has-active');

  if (st.pending) page.querySelector('#pending')!.appendChild(proposalBox(root, s));

  const logBox = page.querySelector('#log')!;
  for (const l of [...st.log].reverse()) {
    logBox.appendChild(
      el(`<div class="log-line log-${l.kind}"><span class="log-round">R${l.round}</span>${esc(l.text)}${l.delta ? `<span class="delta">${esc(l.delta)}</span>` : ''}${l.roll ? `<span class="roll">${esc(l.roll)}</span>` : ''}</div>`),
    );
  }

  if (st.outcome !== 'ongoing') {
    stopTimer(s);
    page.appendChild(endingOverlay(s));
    return;
  }
  schedule(root, s);
}

