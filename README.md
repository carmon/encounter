# The Parley

A turn-based, non-spatial negotiation mini-game ("The Parley"): a 3v3 encounter
that has already happened, resolved through ~5 timed rounds of talk, pressure,
trade, gifts, or steel into one of Fight / Flight / Trade / Deal / Alliance.

Pure TypeScript core (`src/core`) + vanilla DOM UI, built as a liftable module
for a bigger web game (not yet built).

> **Working with agents on this repo?** `AGENTS.md` is the single source of
> truth: agent rules, the full design record (iteration 1 Q&A), the as-built
> spec (iteration 1b + rev 2), the iteration history, and the open TODO
> decisions. Start there.

## Run / build / test

```bash
npm run dev         # vite dev server
npm run typecheck   # tsc --noEmit
npm test            # vitest run (engine + message catalog + fuzz)
npm run coverage    # vitest run --coverage (v8)
npm run build       # tsc + vite build → dist/
```

## Layout

```
AGENTS.md     agent instructions + design/as-built record + open TODOs
src/core/     pure engine (engine, types, messages, affinity) — no DOM
src/data/     scenarios, roster
src/i18n.ts   EN/ES UI translation + log localization
src/ui/       DOM UI (main.ts)
tests/        engine, message catalog, fuzz (300 random parleys)
```

## Hello human, Carmon here:

This was the first iteration of a encounter micro game I'm working on.
It was fully LLMed, it landed were I needed it to land, I finish with even 
more ideas of what I wanted to create, this is the end of it but I will 
keep looping around the drive that brought me here.

Done using GLM - Muse Spark on the edges.