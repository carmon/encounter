# AGENTS.md — The Parley (negotiation)

This file is auto-loaded into every agent session. It is the **single source of
truth** for this repo: agent rules, the design record, the as-built record, and
open decisions. `README.md` is the human-facing overview.

## 0. Orientation & source systems

- **What this is**: a turn-based, **non-spatial** negotiation mini-game ("The
  Parley") — a 3v3 encounter that has *already happened*, resolved through ~5
  timed rounds of talk, pressure, trade, gifts, or steel into one of
  Fight / Flight / Trade / Deal / Alliance. Pure TypeScript core + vanilla
  DOM UI, no framework.
- **The designer is the human owner**, reachable in conversation. Design
  questions and TODO decisions (§6) must be routed to them via chat — never
  decided silently. The Q&A record in §3 is immutable unless the owner
  overrides it.
- **The bigger game**: a future web game (not yet built) that this mini-game
  will be lifted into as a module. It is why the core must stay pure and
  framework-agnostic (§2).
- **Provenance**: designed via Q&A with the owner (iteration 1), implemented
  by an LLM (iteration 1b), post-review fixed (rev 2), then consolidated into
  this file. See §5.

## 1. Commands & verification

```bash
npm run dev         # vite dev server
npm run typecheck   # tsc --noEmit
npm test            # vitest run — 32 tests (27 engine + 4 message catalog + 1 fuzz)
npm run coverage    # vitest run --coverage (v8; engine ~98%, UI untested by design)
npm run build       # tsc + vite build → dist/
```

Before any handoff or stop: `npm run typecheck && npm test && npm run build`
must pass. Do not hand off a red build.

## 2. Hard rules (non-negotiable)

1. **Non-spatial, turn-timed post-encounter scene** — do not redesign into a
   map/movement game.
2. **d6 opposed resolution**: `skill + mods` vs `skill + mods`; margin < 3 =
   partial effect, ≥ 3 = decisive.
3. **3v3, ~5 rounds** (patience 4–5, standoff round cap 20).
4. **TypeScript core in `src/core` is pure** (no DOM, no framework) and
   framework-agnostic. **UI never mutates game state** — only through
   `createParley` / `resolveStep` / `canParley` / `memberOf`.
5. **New engine log/ending strings** go in the keyed bilingual catalog
   `src/core/messages.ts` with BOTH `en` and `es` — the typecheck rejects
   unregistered or half-registered keys (`LogKey = keyof MESSAGES`).
6. **New scenarios** follow the 4-bullet contract (Tongue → Foe → Position →
   Attitude) plus an ES entry (name/bullets/blurb) in the `scenarios` table in
   `src/i18n.ts`. No engine change needed.
7. **Documentation uses stable anchors** (function/type names) — never
   `file:line` references; they rot.
8. **Designer-confirmed decisions (§3 Q&A) are never silently changed** —
   route to the owner in chat first (§0).

## 3. Design baseline & rationale (iteration 1 — the why)

Concept: each individual has **group advantages** (nationality, languages) and
**affinity advantages** (leadership, trade skills) plus a profile
(temperament, morale). The parley runs on a patience clock and an NPC stance
ladder with a hidden goal revealed through play.

### Q&A record — asked of the owner, answered. Immutable unless overridden.

| # | Question | Answer |
|---|----------|--------|
| 1 | What's the bigger game this plugs into (decides core tech)? | **Web/JS** — pure TypeScript core (engine-agnostic) + quick browser UI |
| 2 | How opaque should the NPC group be? | **(owner reframed)** This is the *post-encounter* game — no spatial thinking, just turn-timed. **Partial fog**: names/nationality/languages visible; skills & hidden goal discovered via `Appraise`/`Size Up` |
| 3 | Resolution math? | **Modified d6 opposed**; margin <3 = partial, ≥3 = decisive |
| 4 | Encounter scale? | **3v3, ~5 rounds** |
| 5 | Re-order party / change Primary Leader each round? | **Set once** — order fixed at encounter start; slot 1 = Primary Leader for the whole parley. Party composition + leader pick is the *pre-scene* decision (the bigger game feeds this in later) |
| 6 | When the parley turns violent, how deep is fight resolution? | **Abstract standoff** — opposed combat checks + morale attrition inside the SAME round engine; no separate combat scene. A side at morale 0 flees/surrenders |

### Safe-to-redo list (re-ask the owner BEFORE implementing; record per §5)

1. Information model (partial fog vs fully visible vs fully hidden)
2. Leader ordering (set once vs re-order each round)
3. Fight depth (abstract standoff vs hand off to a combat system)
4. Scenario themes & content scope
5. UI stack detail (vanilla TS vs lightweight framework) — core stays
   framework-agnostic regardless

*(Of these, 1–3 were re-confirmed unchanged at iteration 1b — see §4.)*

Dropped in the curated merge (superseded by §4, divergence tracked in the
changelog): iteration 1's prose spec and its original build plan.

## 4. As-built spec (iteration 1b + rev 2 — the truth)

### 4.1 Iteration 1 → 1b changelog

| Area | Iteration 1 design | As built |
|---|---|---|
| **Scenarios** | 2 themes, prose blurb | **3 scenarios**; `blurb` kept for the engine log + `bullets[4]` (Tongue/Foe/Position/Attitude) as the UI truth |
| **Gift** | Always available, +1 stance | **Gated to Open (stance ≥ 3)** in both `availableActions` and `resolvePlayerAction`. ⚠ Unconfirmed design change — TODO §6.1 |
| **Draw Weapons / Initiative** | No initiative | **Initiative 2–12** (placeholder `d6+d6` at `createParley`); standoff turns sorted by initiative desc (stable tie-break). Draw gives a **random split: one living member +2, the rest +1** (rev 2; was +3 to all) |
| **Party morale visibility** | Per-character only | Combined party morale bar in topbar + per-card `♥ m/10` and `INIT` chip |
| **Party pool** | Full `ROSTER` (9) | **Shuffled pool of `POOL_SIZE = 8`** (deliberate: every run hides one template); shuffle keeps picks |
| **Internationalization** | None | **EN/ES** toggle, persisted (`localStorage` `parley-locale`), re-renders in place |
| **Chronicle localization** | Raw engine strings | Keyed log events localized at render (rev 2 — see §4.3) |
| **Turn order / game layout (1c)** | Interleaved talk turns; two fixed 3v3 card rows | Round 1 opens with both leaders, then initiative desc; later rounds are pure initiative. Compact plan-ordered rows replace the fixed cards; targets live in a floating action popup. |

Decisions re-confirmed at 1b: partial fog, fixed leader order, abstract
standoff (all unchanged from §3).

### 4.2 Rev 2 — post-review fixes

| # | Fix | Detail |
|---|-----|--------|
| 1 | Draw Weapons rebalanced | Random +2 to one living member / +1 to the rest (`nextRoll % alive.length` — deterministic under seed, uniform at party size 3). Test asserts gains `[2,1,1]` + plan order, pick-agnostic |
| 2 | Engine log i18n made structural | Replaced a fragile regex table (~30 patterns; new strings silently untranslated — dozens actually were) with the **keyed catalog `src/core/messages.ts`** (~85 keys, beast/tongues variants included). `log()`/`end()` take `LogKey` + params; `LogEvent` carries `key`/`params` plus the English render on `text` (tests assert on `text`). **The typecheck enforces locale completeness.** `localizeLog(event)` renders ES from the catalog; scenario blurbs translate by id (`scenario.blurb` special key) |
| 3 | `POOL_SIZE` constant | Pool cap was a hardcoded `8` in three places; now one named constant in `src/ui/main.ts`, marked as an intentional design choice |
| 4 | TODO list | Open decisions tracked (now §6) |

### 4.3 Implemented snapshot

**Character** (`Character`, `src/core/types.ts`): `id, name, nationality,
languages[], skills {combat, trade, diplomacy, leadership, perception} 1..5,
temperament (aggressive|cautious|greedy|honorable|vain), morale 0..10`.
Roster: 9 templates (Mireille, Brann, Quill, Osman, Yara, Elandor, Tomas,
Ansel, Kessa) in `src/data/roster.ts`; nationalities `valen/karsk/oran/wild`;
languages `valen/karsk/oran/trade/beast`.

**Scene state** (`ParleyState`): `patience` 4–5 (−1/round and on
threats/bluffs; at 0 → hidden-goal default: `attack` arms both sides →
standoff, `leave` → `walkedAway`); `stance` 0–3 with 4 = Allied (only Gift
reaches 4); `trust`; `initiative: Record<id, 2..12>`; `standoff`/
`combatRound`; `defending[]`; `grudges`; `revealedSkills`/`revealedTemper`;
`goalHintSeen`/`goalKnown`.

**Scenarios** (`SCENARIOS`, `src/data/scenarios.ts`):
- **Toll Road** (`toll_road`, Karsk, stance 1, patience 5, resources 3, goal
  "Toll by any means", 2 goods / breaks at 2)
- **Foreign Market** (`market`, Trade+Oran, stance 2, patience 5, resources 3,
  goal "A guild price", 3 goods / breaks at 3, default `leave`)
- **Wolf Pack** (`wolves`, beasts, stance 0, patience 4, resources 4, goal
  "Hunger", 1 good / breaks at 2)
NPC trios: Redgar/Vex/Mule, Sarei/Nimo/Osta, Grey Alpha/Scar Ear/Pup. The
`Position` bullet is a deliberate scaffold — the future feed for initiative
(proximity/terrain/climate).

**Turn loop** (`startRound` / `resolveStep` / `endOfRound`, `src/core/engine.ts`):
a `plan` is built per round — **round 1 opens with both leaders (player leader,
then NPC leader); every other turn, and every later round, runs in initiative
order, highest first** (stable side/slot tie-break); broken (morale 0) members
are excluded. `resolveStep` executes one `PlanStep` (pure,
`structuredClone`); `defend` guard lasts until the actor's next action;
mid-standoff social actions are blocked ("keeps their seat"); a standoff
starting mid-round truncates the plan; `endOfRound` ticks patience and
escalates.

**Actions** (as implemented):
- Social (needs `canParley` — shared tongue or living interpreter): `Talk`
  (opposed DIP; vain ×2; full gain only on a leader hit), `Persuade`, `Offer`
  (opposed TRD vs leader; decisive lowers demand by 1), `Bluff` (DIP vs PER),
  `Final Offer` (leader, Neutral+ to deal)
- Pressure: `Threaten` (opposed DIP, −1 patience, morale 2–3, feud),
  `Coordinated Threat` (leader)
- Intel: `Appraise` (PER+d6 → skills / +temperament), `Size Up` (goal
  hint/full)
- Bridge: `Interpret` (shares a tongue with living NPCs)
- Prep: `Signal Escape` (+2 to Withdraw), `Draw Weapons` (arms both, −1
  stance, random +2/+1 initiative split)
- Help: `Gift` (stance ≥ 3 only, −1 cargo +1 trust +1 stance, Allied →
  alliance)
- Standoff-only: `Attack` (opposed CMB, guard −2, riposte 1–2), `Guard`,
  `Rally` (leader, +2/+3 morale), `Withdraw` (PER vs best NPC PER)

Language bridge: `canParley` checks shared language or living interpreter;
interpreter relays at −1 if the actor doesn't share the tongue; beasts have no
speech at all.

**Endings**: `trade` (offer/demand thresholds, incl. NPC demands accruing),
`deal` (Final Offer), `alliance` (gift at Allied), `victory` (NPC breaks ≥
`breaksToFlee` or leader rout), `defeat`/`routed` (player breaks / leader
rout), `escaped` (Withdraw), `walkedAway` (patience → `leave`).

**NPC AI** (`chooseNpcAction` / `chooseNpcTarget` / `resolveNpcAction`):
temperament-weighted pools (aggressive → threaten/draw, cautious →
talk/rally, greedy → demand, honorable/vain → talk/persuade) +
temperament-agnostic standoff weights (cautious guards more). Targets:
social → prefer player leader; pressure → `grudge × 3 + leader bias`.
`honorable` is flavor-only since the honor mechanics were removed (owner)
— no threat penalty, no dedicated AI pool.

**Morale & leader succession** (`checkLeaderDown` / `checkBreaks`): morale 0
= broken, excluded from plans. Leader down → best living Leadership
successor; rout roll `d6 ≤ 6 − succ.leadership` (clamped 0–6) →
`routed`/`victory`, else successor promoted and order re-set.

**Affinity & mods** (`src/core/affinity.ts`): `affinityMod`
(nationality/temperament), `leaderMod` (+floor(LDR/2), max 2), `commsPenalty`
(−1 via interpreter), `revengeBonus` (+1 if grudge).

**Tuning knobs**: stance thresholds (`acceptStance` 2–3, gift alliance at 4),
`demandGoods` 1–3, `breaksToFlee` 2–3, patience 4–5, skills 1–5, morale 10
max, cargo 3–4.

### 4.4 File map

```
src/core/engine.ts    — pure: createParley, resolveStep/Round, canParley, memberOf
src/core/types.ts     — Temperament, PlayerAction, NpcAction, Ending, SpeechMode, Character, HiddenGoal, ParleyState, LogEvent (+key/params)
src/core/messages.ts  — keyed bilingual catalog (MESSAGES en/es, ~85 keys, renderLog); LogKey = keyof MESSAGES | 'scenario.blurb'
src/core/affinity.ts  — affinityMod, language helpers
src/data/scenarios.ts — ScenarioDef { blurb, bullets[4], ... }, SCENARIOS[3]
src/data/roster.ts    — ROSTER[9]
src/i18n.ts           — Locale EN/ES, t(), actionLabel(), stanceLabel(), worldLabel(), scenarioText(), localizeLog(event) — catalog-keyed
src/ui/main.ts        — DOM: renderSetup (pool of POOL_SIZE + shuffle), renderGame (topbar, turn-order rows, inline card controls, chronicle, EN/ES + ? FABs)
src/style.css         — theme, turn-order rows, initiative chip, stance meter, scenario-bullets, overlay
tests/engine.test.ts  — 27 tests (trade/demand, leader-first initiative ordering, standoff, initiative draw ordering, gift gate, feuds, wolves, leader falls, purity)
tests/messages.test.ts— 4 tests (catalog completeness, placeholder discipline, scenario.blurb passthrough)
tests/fuzz.test.ts    — 300 random parleys + log-render sanity (no unbound {placeholders})
```

### 4.5 UI as built (condensed)

- **Setup**: `Encounter!` → scenario cards (4 bullets each) → roster grid of
  `POOL_SIZE` shuffled candidates (shuffle keeps picks) → party strip
  (`Primary Leader` / `Slot N`, reorder/remove) → `Begin the parley` (seeds
  RNG via `Date.now() ^ Math.random()`).
- **Game topbar**: scenario name + round number on the left; the 5-segment
  stance meter sits on the right, next to the `STANDOFF` chip when a
  standoff is active (patience pips, the combined party-morale bar, and
  the whole meta-line were removed from the UI at the owner's request —
  all still run in the engine). Below it a two-column layout: turn order
  (left, 50%) and chronicle (right, 50%), stacking under 860px.
- **Floating buttons**: a circular `?` help FAB (top-right) with a
  second circular EN/ES locale FAB directly below it; both live outside
  the topbars and persist across screens (re-attached on each render).
- **Turn order list**: one compact vertical list replaces the old 3v3 card
  rows — every character as a full-width row **in plan (acting) order**, with a
  YOU/THEM side chip and colored edge; broken members appended at the end,
  dimmed. Rows carry `♥ m/10` (red ≤ 3), `INIT` chip, skill chips with
  tooltips (NPCs only what `Appraise` revealed), temperament (NPCs only if
  revealed), `guarding`/`interpreter`/`leader` badges, feud `⚔` line, queued
  action, and `▶ now` turn flags.
- **Inline card controls**: the active player's row carries an action
  dropdown (`availableActions` — gift only at Open, social only if
  `canParley`), a target dropdown for targeted actions (living foes only),
  a goods dropdown for Offer, and a `▶ go` button (temporary UX). While a
  row is active, the other rows dim.
- **Controls**: there is no separate transport row. The `▶ now` tag on the
  current card *is* the play button — clicking it toggles auto-play
  (`▶ now` / `❚❚ pause`), and on a paused player card it acts like `▶ go`.
  The back/forward review buttons and the loop toggle were removed (owner:
  "broken, just keep the play button"; loop removed later) — there is no
  history-review UI; the game always renders the latest state. The
  round/action step-info line was removed too (owner request).
- **Chronicle**: full history, always rendered; the log fills its column's
  full height and scrolls internally (no "last 4" truncation — that and its
  toggle were removed at the owner's request). `localizeLog(event)`
  translates at render, so language switching updates history. The only
  standoff indicator is the `STANDOFF` chip in the topbar (the chronicle
  system message was removed at the owner's request).
- **`?` reference popup**: actions table + feuds/standoff/broken/speech/pacing
  notes. **Ending overlay**: 8 endings, trust/cargo summary, `New encounter`.

### 4.6 Tests that encode decisions

- `round 1 opens with both leaders, then initiative order; later rounds are pure initiative` — player leader, then NPC leader, then descending initiative; every later round is descending initiative
- `draw weapons boosts party initiative and orders the next combat round` —
  gains `[2,1,1]`, plan order pick-agnostic
- `does not spend a gift until relations are Open` — resources/trust
  unchanged, "holds the gift back"
- wolves: `a gift can seal an alliance with the pack once it is Open` — stance
  3 → alliance in 1 round, not 4 gifts from Hostile
- `guarding turns blows and counters` — explicit initiative fixture forcing
  guard-before-strike order
- message catalog: every key has non-empty EN + ES, no leftover placeholders,
  ES never invents params EN doesn't supply
- fuzz: 300 random parleys, no crash/hang, every log event fully bound

## 5. History & iteration recording

| Stage | What happened |
|---|---|
| Iteration 1 | Design via Q&A with the owner; recorded as a handoff (`iterations/1/handoff.md`) |
| Iteration 1b | Implementation by an LLM; divergence recorded (`iterations/1b/handoff.md`); 3 redo-questions re-confirmed unchanged |
| Rev 2 | Post-review fixes (see §4.2) |
| This merge | Both handoffs consolidated into this file (curated); the `iterations/` folder was **deleted** — AGENTS.md is the surviving record. The doc-rot TODO was resolved here by the anchor policy (§2.7) |
| Iteration 1c | Owner-approved turn-order and game-layout override: leaders open round 1, initiative governs all remaining turns; the 3v3 view became a turn-order list (see table below) |

### Iteration 1c overrides

| Area | Earlier behavior | Owner-approved override |
|---|---|---|
| Turn order | Non-standoff rounds interleaved `player[i]`, `npc[i]`; only standoffs sorted by initiative | Round 1 opens with the player leader, then the NPC leader. The remaining actors in round 1, and every actor in later rounds, are sorted by initiative descending with the existing stable side/slot tie-break. |
| Game layout | Two fixed 3v3 card rows (`They` / `You`) | One vertical turn-order list renders actors in their current `plan` order; broken members append dimmed. Side chips identify YOU/THEM. |
| Targeting / action menu | Click a pickable NPC card after selecting a targeted action; inline action bar | Temporary: action dropdowns and a `▶ go` button render inline on the active player's row (action select + target select for targeted actions + goods select for Offer); while one row is active, the others dim. The owner will revisit this UX. |
| Game layout (1c+) | Turn order and chronicle stacked vertically, full width; action popup auto-opens on a player turn | Owner-approved: turn order and chronicle sit side by side at 50% width each (stack below 860px). The floating action popup was later dropped entirely (see the row above). |

**Convention going forward**: new iterations record themselves *in this file*.
Append an "Iteration 1c/2 overrides" table here for owner-approved design
deltas, and extend the §4.1 changelog for implementation deltas. Do not create
new handoff files; AGENTS.md is auto-loaded, so no manual context management.

## 6. Open TODO (owner decisions — route via chat, do not decide silently)

1. **Gift gating needs owner re-confirmation.** Iteration 1 specified Gift as
   always available; 1b gated it to Open stance (≥ 3) without sign-off (§4.1).
   Re-confirm or revert — it changes the entire Help/Alliance route pacing.
2. **`delta` log strings are not localized.** Log `text` is fully translated
   via the catalog, but the small delta annotations (`foe morale −2`,
   `cargo −1 · trust +1`) still render in English in the ES UI. Migrate them
   to `src/core/messages.ts` if it matters.
3. **`initiative` is a placeholder.** Seeded `d6+d6` at `createParley` plus
   the Draw Weapons bonus; the structured scenario `Position` bullet is the
   intended future feed (proximity/terrain/climate) — see §4.3.
