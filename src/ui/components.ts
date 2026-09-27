import { describeEffect } from '../content/items';
import { ORIGINS, TONGUES } from '../content/world';
import { ATTR_SHORT, DISPOSITION_LABELS } from '../engine/rules';
import type { ActionId, Attr, Character, Item } from '../engine/types';
import { ATTRS } from '../engine/types';

export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const ATTR_HELP: Record<Attr, string> = {
  might: 'Might — Strike, Press the living, resisting blows',
  wits: 'Wits — Read, Take, Withdraw, resisting theft; drives initiative',
  charm: 'Charm — Parley and Sway',
  nerve: 'Nerve — resisting Press/Sway, Rally, facing the dead, holding the group together',
};

export function attrs(c: Character) {
  return ATTRS.map((a) => `<span class="skill" title="${ATTR_HELP[a]}">${ATTR_SHORT[a]} <b>${c.attrs[a]}</b></span>`).join('');
}

export function temper(c: Character) {
  return `<span class="skill" title="${esc(c.temperament.note)}">${c.temperament.label}</span>`;
}

export const origin = (c: Character) => ORIGINS[c.origin] ?? c.origin;
export const tongues = (c: Character) => (c.tongues.length ? c.tongues.map((t) => TONGUES[t] ?? t).join(', ') : TONGUES.none);

export function itemChip(it: Item, goalTags: string[] = []) {
  const goal = it.tags.some((t) => goalTags.includes(t)) ? ' goal' : '';
  const uses = it.kind === 'consumable' && it.state !== 'spent' ? `<span class="uses">×${it.uses ?? 1}</span>` : '';
  const state = it.state === 'intact' ? '' : ` (${it.state})`;
  const tip = [`${it.kind}`, describeEffect(it), `value ${it.value}`, `tags: ${it.tags.join(', ')}`].filter(Boolean).join(' · ');
  return `<span class="item k-${it.kind} s-${it.state}${goal}" title="${esc(tip)}">${esc(it.name)}${uses}${state}</span>`;
}

export function items(list: Item[], goalTags: string[] = []) {
  return list.length ? `<div class="items">${list.map((i) => itemChip(i, goalTags)).join('')}</div>` : '';
}

export function vitals(c: Character) {
  return `<span class="vitals ${c.resolve <= 3 ? 'vit-low' : ''}" title="Resolve — hurt, fear and doubt all drain it. At 0 they are broken.">♥ ${c.resolve}/${c.maxResolve}</span>`;
}

export function initiative(value: number | undefined, parts = '') {
  const v = Math.max(0, Math.min(14, value ?? 0));
  return `<span class="initiative" title="Initiative (rerolled each round): ${esc(parts)}"><span>INIT</span><b>${value ?? '–'}</b><i style="width:${(v / 14) * 100}%"></i></span>`;
}

export function dispositionBar(d: number) {
  return DISPOSITION_LABELS.map((l, i) => `<span class="seg ${i === d + 2 ? 'seg-on' : ''}">${l}</span>`).join('');
}

export function tensionBar(t: number, max: number) {
  const pips = Array.from({ length: max }, (_, i) => `<span class="pip ${i < t ? 'on' : ''}"></span>`).join('');
  return `<span class="tension ${t >= max - 1 ? 'hot' : ''}" title="Tension ${t}/${max} — rises every round and with aggression. At the top, their patience snaps.">${pips}</span>`;
}

export const ACTION_HELP: Record<ActionId, [string, string]> = {
  parley: ['target', 'Charm vs Charm (vs Nerve when soothing beasts). On their leader: disposition +1/+2. Others only move on a decisive win. Needs a shared tongue.'],
  press: ['target', 'Might vs Nerve (Nerve vs Nerve against or by the dead). Target loses 2–3 resolve; disposition −1; tension +1.'],
  read: ['target', 'Wits + d6: ≥7 abilities · ≥9 whether they lead, their holdings, a hint · ≥11 their full agenda.'],
  strike: ['target + weapon', 'Starts a fight. Might+weapon vs Might+ward (+2 if guarding). Hit: resolve −2..−4. A roll of 1 wears the weapon. Only blessed steel touches spirits.'],
  use: ['item', 'Use a consumable: heal an ally, scare tagged foes (Nerve+power vs their Nerve), or ready smoke for a withdrawal.'],
  give: ['item', 'Hand an item over. Something they want: disposition +1 (greedy leader +2), tension −1, and it counts toward their price.'],
  take: ['item', 'Wits vs their best Wits (+1 if someone holds it). Success moves the item to you. Disposition −1; tension +1 (+2 if caught).'],
  guard: ['—', 'Until your next turn, hits on you are −2 and a miss is countered. Outside a fight, also recover 1 resolve.'],
  sway: ['target', 'Charm + disposition vs Nerve (+2 if shaken). Win by 2+ and they change sides with everything they carry.'],
  rally: ['leader', 'Nerve + d6: ≥6 group resolve +1, ≥9 +2.'],
  propose: ['leader', 'Put terms: items you give, items you ask for, optionally ask them to join you. They weigh value, what they want, and how they feel about you.'],
  withdraw: ['leader', 'Wits (+smoke) vs their best Wits. Success: you leave with what you have. Spotted: tension +2, and some will attack.'],
};

export function referenceHtml(verbFor: (a: ActionId) => string) {
  const rows = (Object.keys(ACTION_HELP) as ActionId[])
    .map((a) => `<tr><td>${verbFor(a)}</td><td>${ACTION_HELP[a][0]}</td><td>${ACTION_HELP[a][1]}</td></tr>`)
    .join('');
  return `<table class="actions-ref"><thead><tr><th>Action</th><th>Who / needs</th><th>Effect</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="ref-notes">
    <p><strong>Turn order</strong> — your leader always acts first. Everyone else, on both sides, goes by initiative, rerolled every round (Wits + d6, +1 leader, +1 armed in a fight, −2 shaken, ± momentum from last round).</p>
    <p><strong>Disposition</strong> is shared: Hostile → Allied. <strong>Their price</strong> — how many of the things they want they ask for — drops as disposition rises. Read them to learn it.</p>
    <p><strong>Tension</strong> climbs every round. When it tops out their agenda decides: some attack, some grab, some simply vanish.</p>
    <p><strong>Resolve</strong> is the only damage track. ≤3 is shaken (−1 Might/Charm). At 0 a character is broken and out. If a leader breaks, the steadiest Nerve must hold the group (Nerve + d6 ≥ 7) or it routs.</p>
    <p><strong>Items</strong> — wearables (weapons, wards, trinkets) work passively or through Strike; consumables have uses; group items belong to nobody in particular. Items can be given, taken, traded, looted, worn and broken.</p>
    <p><strong>People move too</strong> — Sway wins a foe over to your side; the dead can Possess the shaken; a defeat may end in capture; an alliance merges both groups into one.</p>
  </div>`;
}

export function mountReference(verbFor: (a: ActionId) => string) {
  document.querySelectorAll('.ref-fab, .ref-popup').forEach((n) => n.remove());
  const fab = el('<button class="ref-fab" title="Rules reference">?</button>');
  const pop = el(`<div class="ref-popup hidden"><div class="ref-popup-inner">
    <button class="ref-close" title="Close">×</button><h3>How encounters work</h3>${referenceHtml(verbFor)}</div></div>`);
  document.body.append(fab, pop);
  fab.addEventListener('click', () => pop.classList.toggle('hidden'));
  pop.querySelector('.ref-close')!.addEventListener('click', () => pop.classList.add('hidden'));
  pop.addEventListener('click', (e) => e.target === pop && pop.classList.add('hidden'));
}
