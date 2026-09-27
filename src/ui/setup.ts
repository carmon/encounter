import { PARTY_SIZE, ROSTER } from '../content/roster';
import { SCENARIOS } from '../content/scenarios';
import { DEFAULT_VERBS } from '../engine/rules';
import type { ScenarioDef } from '../engine/types';
import { attrs, el, esc, items, mountReference, origin, temper, tongues } from './components';

export interface SetupState {
  scenario: ScenarioDef | null;
  picked: string[];
}

const goalTags = (s: ScenarioDef | null) =>
  s ? s.objectives.flatMap((o) => ('tag' in o.check ? [o.check.tag] : [])) : [];

export function renderSetup(root: HTMLElement, ui: SetupState, onStart: (s: ScenarioDef, party: string[]) => void) {
  const rerender = () => renderSetup(root, ui, onStart);
  root.innerHTML = '';
  const ready = !!ui.scenario && ui.picked.length === PARTY_SIZE;
  const page = el(`<div class="setup">
    <h1 class="big-title">Encounter</h1>
    <p class="tagline">Two groups meet. Someone leaves with more than they came with.</p>
    <h2>1 · Scenario</h2>
    <div class="scenarios" id="scenarios"></div>
    <h2>2 · Company <span class="unknown" style="text-transform:none;letter-spacing:0">pick ${PARTY_SIZE} — the first is your leader and always acts first</span></h2>
    <div class="roster" id="roster"></div>
    <div class="party" id="party"></div>
    <div id="group-items"></div>
    <button id="start" class="primary" ${ready ? '' : 'disabled'}>Begin the encounter</button>
  </div>`);
  root.appendChild(page);
  mountReference((a) => ui.scenario?.verbs?.[a] ?? DEFAULT_VERBS[a]);

  const scnBox = page.querySelector('#scenarios')!;
  for (const s of SCENARIOS) {
    const card = el(`<div class="card ${ui.scenario?.id === s.id ? 'sel' : ''}">
      <h3>${esc(s.name)}</h3><ul class="scenario-bullets">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>`);
    card.addEventListener('click', () => ((ui.scenario = s), rerender()));
    scnBox.appendChild(card);
  }

  const roster = page.querySelector('#roster')!;
  for (const c of ROSTER) {
    const idx = ui.picked.indexOf(c.id);
    const card = el(`<div class="card ${idx >= 0 ? 'sel' : ''}">
      ${idx >= 0 ? `<span class="pick-no">${idx + 1}</span>` : ''}
      <div class="char-name">${esc(c.name)}</div>
      <div class="char-meta">${origin(c)} · ${temper(c)}</div>
      <div class="char-meta">speaks ${tongues(c)}</div>
      <div class="char-skills">${attrs(c)} <span class="skill" title="Resolve">♥ <b>${c.maxResolve}</b></span></div>
      ${items(c.items, goalTags(ui.scenario))}
    </div>`);
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.item')) return;
      if (idx >= 0) ui.picked.splice(idx, 1);
      else if (ui.picked.length < PARTY_SIZE) ui.picked.push(c.id);
      rerender();
    });
    roster.appendChild(card);
  }

  const party = page.querySelector('#party')!;
  ui.picked.forEach((id, i) => {
    const c = ROSTER.find((r) => r.id === id)!;
    const row = el(`<div class="party-row">
      <span class="badge ${i === 0 ? 'badge-leader' : ''}">${i === 0 ? 'Leader' : `Slot ${i + 1}`}</span>
      <strong class="grow">${esc(c.name)}</strong>
      <button data-a="up" ${i === 0 ? 'disabled' : ''} title="Move up">↑</button>
      <button data-a="down" ${i === ui.picked.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
      <button data-a="x" title="Remove">×</button>
    </div>`);
    row.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        const p = ui.picked;
        if (a === 'up') [p[i - 1], p[i]] = [p[i], p[i - 1]];
        if (a === 'down') [p[i + 1], p[i]] = [p[i], p[i + 1]];
        if (a === 'x') p.splice(i, 1);
        rerender();
      }),
    );
    party.appendChild(row);
  });

  if (ui.scenario) {
    const s = ui.scenario;
    page.querySelector('#group-items')!.appendChild(
      el(`<div><h2>3 · What your group carries</h2><div class="panel">
        <div class="setup-group"><span class="char-meta">Group items</span>${items(s.playerItems, goalTags(s))}</div>
        <div class="char-meta" style="margin-top:.4rem">Objectives: ${s.objectives.map((o) => `${o.primary ? '<b>' : ''}${esc(o.label)}${o.primary ? '</b>' : ' (optional)'}`).join(' · ')}</div>
      </div></div>`),
    );
  }

  page.querySelector('#start')!.addEventListener('click', () => ready && onStart(ui.scenario!, [...ui.picked]));
}
