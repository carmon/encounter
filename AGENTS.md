# AGENTS.md — Encounter (iteration 2)

A generic **group-encounter system** for games, plus a browser harness to play it.
Two groups meet; characters act in initiative order; the encounter resolves into
1 or 2 groups with changed membership, items, and item states.

Iteration 1 (reference only): https://encounter-rosy.vercel.app/ — pass-through /
cargo toll game, 5 skills, 18 actions. Iteration 2 replaces cargo with **items**,
cuts attributes to 4 and actions to 12 (context-filtered), and supports
non-bargain scenarios (beasts, haunt, rendezvous).

## Commands

```bash
npm run dev        # play at http://localhost:5173
npm test           # vitest — engine rules + invariants
npm run sim        # headless balance run: N auto-played encounters per scenario
npm run trace -- scenario=haunt seed=4 party=brannoc,pell,sabeth   # one run's chronicle
npm run build      # tsc (strict) + vite build — must pass before handing off
```

Always run `npm test && npm run build` after touching `src/engine/`. Run
`npm run sim` after touching numbers (attributes, DCs, agenda, scenario data)
and compare outcome distribution against the table in "Balance targets".

## Layout

```
src/engine/      PURE, deterministic, no DOM. Seeded RNG lives in state.
  types.ts       The contract: Item, Character, Group, ScenarioDef, EncounterState, EncounterOutput
  rules.ts       Derived props (attr, initiative), lookups, transfers, checks, logging
  actions.ts     The 12 actions: availability + resolution (shared by both sides)
  encounter.ts   create → step → respond → buildOutput (the public API)
  ai.ts          NPC choice (temperament + agenda weighted) and a player autopilot for sims
src/content/     Data only. World (tongues, origins, temperaments), items, roster, scenarios
src/ui/          Vanilla TS + template strings, re-render on every state change
  autoplay.ts    playOut(): runs an encounter to the end with autopilot vs NPC AI
scripts/sim.ts   Balance harness · scripts/trace.ts prints one run's log
tests/           vitest
```

**Rule: the engine never imports from `content/` or `ui/`.** Content imports
engine types. UI imports both. If you need world flavour in a log line, put the
string on the data (item/scenario/temperament), not in the engine.

## The system (contract)

**Input**: `ScenarioDef` (NPC group + agenda + objectives + player group items)
and the player's picked characters (order matters: index 0 = leader).

**Output** (`buildOutput(state)` → `EncounterOutput`):
- `groups`: 1 or 2 surviving groups (members, personal items, group items, states)
- `eliminated`: sides that no longer exist (routed, merged, captured)
- `transfers`: every item/character that changed group, with round and cause
- `itemChanges`: every item whose state changed (intact → worn → broken, → spent)
- `objectives`: each scenario objective, met or not

### Items
Three kinds: `wearable` (carried by a character, passive or used by an action —
weapons, wards, trinkets), `consumable` (carried, has `uses`, becomes `spent`),
`group` (belongs to the group, not a person — goods, relics, ledgers).
Items have `tags` (what an agenda/objective matches on), `value` (bargaining
weight), `state`, and an optional `effect` (`weapon | ward | boost | heal |
scare | smoke`). Worn items lose 1 power; broken/spent have none.

### Attributes (4, range 1–5)
| Attr  | Used for |
|-------|----------|
| Might | Strike, Press (vs living), resisting Strike |
| Wits  | Read, Take, Withdraw, **initiative**, resisting Take |
| Charm | Parley, Sway (words) |
| Nerve | Resisting Press/Sway, Rally, Press vs spirits, Possess, leader succession |

**Resolve** (0–max) is the one damage track — hurt, fear and doubt all drain it.
At 0 a character is **broken**: out of action. Resolve ≤ 3 = shaken (−1 Might/Charm, −2 initiative).

### Derived props (recomputed every round)
- **Initiative** = Wits + d6 + 1 if leader + 1 if armed in a fight − 2 if shaken + momentum.
  Momentum: +1 after a success last round, −1 after being hurt.
- Effective attributes include wearable boosts, wound penalty, and leader aura
  (leader Nerve ≥ 4 → +1 Nerve to the rest of the group).

### Turn order
Player leader always acts first (protagonism). Everyone else, both sides, by
initiative (ties → player side). NPC leader may be **hidden**
(`leaderKnown: false`): parley only fully lands on the real leader, so finding
them (Read, or a decisive Parley) matters.

### Shared state
- **Disposition** −2..+2 (Hostile, Wary, Neutral, Open, Allied) — mutual.
- **Tension** 0..max — rises +1 every round and with aggression. At max the NPC
  agenda `onBoil` fires: `fight` | `leave` (encounter ends, they walk) | `seize` (fight + grabbing).
- **Fight** flag — once steel is out, Parley/Sway/Give are off; Propose still works (truce terms, harder).

### Actions (12; the UI only lists what is legal right now)
| Action | Who | Check | Effect |
|---|---|---|---|
| Parley (Soothe vs beasts) | any, needs shared tongue | Charm vs Charm (Nerve if beasts) | leader target: disposition +1/+2; others only on decisive |
| Press (Snarl) | any | Might vs Nerve (Nerve vs Nerve vs spirits) | target resolve −2/−3, disposition −1, tension +1 |
| Read | any | Wits + d6 ≥ 7/9/11 | reveals attrs → leader & items & hint → full agenda |
| Strike (uses a weapon) | any | Might+weapon vs Might+ward | starts fight; resolve −2..−4; fumble wears weapon; spirits need `blessed` |
| Use | any, has consumable | — | heal / scare (group press vs tagged foes) / smoke (escape bonus) |
| Give | any, not fighting | — | item → other group; wanted items raise disposition and satisfy the agenda |
| Take | any | Wits vs best Wits | item → your side; disposition −1, tension +1 (+2 if caught) |
| Guard | any | — | −2 to hits on you until your next turn; +1 resolve if calm |
| Sway (Possess for spirits) | any, not fighting | Charm vs Nerve (+2 if target shaken) | margin ≥ 2 → target **changes group** with their items |
| Rally | leader | Nerve + d6 ≥ 6/9 | group resolve +1/+2 |
| Propose | leader, needs speech | NPC scores the deal | give/ask items, optionally "join us" → Accord / Alliance |
| Withdraw | leader | Wits+prep vs best Wits | Escape (player) / Parting (NPC); failure raises tension |

### Endings
`accord` (terms accepted), `alliance` (groups merge → 1 group), `parting`
(they got what they wanted, or lost patience and left), `escape`, `rout`
(NPC broken → eliminated; you loot group items + broken foes' items),
`defeat` (agenda `onVictory`: `strip` your group items, or `capture` your people).

### NPC agenda (per scenario)
`wants` tags + `wantCount` (satisfied → they part), `offers` tags (what they will
trade away), `guards` tags (expensive to ask for), `acceptAt` disposition,
`onBoil`, `onVictory`, `breakAt` (broken members before rout), `canAlly`.
Proposal score = given value (×2 if wanted) − asked value (×1 offered, ×2 normal,
×3 guarded) − 2 if their want stays unmet + 2×(disposition − acceptAt) + broken
members − 2 for "join us". Accept at ≥ 0 and disposition ≥ acceptAt − 1.

## Scenarios (content/scenarios.ts)
1. **Gullwater Ford** — bargain/toll. Wardens want 2 `goods`; keep the sealed letter.
2. **The Hollow Pack** — beasts, no speech. They want `food`; torches scare.
3. **Saint Veyl's Haunt** — spirits speak only the Old Tongue, leader hidden,
   possession moves your people to their side. Trade the locket for the key, or banish them.
4. **The Salt Market Rendezvous** — meet a contact cell (decoy leader), obtain the
   cipher ledger. They leave if tension boils. Their muscle can be swayed.

## Conventions
- TypeScript strict. No frameworks. No runtime deps.
- Engine functions take `EncounterState` and **clone before mutating** at the public
  API boundary (`step`, `respond`); internals mutate the clone.
- Every rule change that moves a number goes through `npm run sim`.
- Log lines: `kind` is from the player's point of view (`good` = good for the player).
  Put the dice in `roll` (e.g. `CHA 4+3 vs 3+2`), mechanical deltas in `delta`.
- UI mirrors iteration 1's structure: setup (scenario cards → roster → party order)
  → game (topbar with disposition/tension, turn order column, chronicle column)
  → ending overlay. Theme tokens live in `:root` in `src/ui/style.css`; each
  iteration gets its own palette (this one: "Verdigris").

## Balance targets (sim with autopilot, 400 runs/scenario)
Rough goals, not laws: no single outcome > 70% in a scenario; defeat 10–35%;
every scenario has ≥ 3 distinct outcomes; median length 3–7 rounds.

### Baseline (iteration 2, 400 runs, random parties, autopilot)
| Scenario | Outcomes (top) | Primary success | Median rounds | Char transfers |
|---|---|---|---|---|
| Gullwater Ford | parting ~73%, accord ~27% | 100% | 1 | 9% |
| Hollow Pack | defeat 36, rout 32, parting 20, escape 12 | 50% | 4 | 0% |
| Saint Veyl's Haunt | accord 42, defeat 31, escape 23 | 44% | 3 | 32% |
| Salt Market | accord ~77%, parting 17 | 88% | 2 | 5% |

Misses against the targets: **Ford and Salt Market are too easy and too short**
(autopilot pays the price on turn 1 and it works). Ideas: a haggling window
before they accept, a price that *rises* with tension, or the NPC reading your
cargo value. The autopilot is also dumb — a better one would give a truer
picture of human play.

## Iteration log
- **v2.0** Items replace cargo; 4 attributes; 12 actions; hidden leaders; price
  falls with disposition; possession/sway/capture/alliance move characters;
  4 scenarios. Sim-driven fixes so far: price mechanic (everything was solved
  turn 1), `agenda.takes` (the meeting cell was pickpocketing), natural weapons
  don't wear (spirits disarmed themselves over 79 rounds), spirits use Nerve,
  MAX_ROUNDS = 12 (stalemates), NPC items without visible effect hidden until
  Read (the key gave away the hidden leader).

## Known gaps / next iterations
- No ES localization yet (iteration 1 had EN/ES).
- NPC AI is weighted-random, not planning.
- Characters carry no persistent state across encounters beyond the output.
