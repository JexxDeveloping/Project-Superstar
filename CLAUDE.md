# CLAUDE.md — Actor Career Simulator

## What this is
A 2D single-player actor career simulator: a turn-based (1 week = 1 turn) management sim set in a persistent, living fictional movie industry. The player is one actor inside a world that evolves whether they act or not.

## Source of truth
The full spec is **`actor-career-sim-design-doc.md`** in this folder. It is the authority for all systems. Read it before building. Parts:
- Part 1 — original design brief (all systems)
- Part 2 — refinements (three-axis design, persistent world, enhancements) + architecture
- Part 3 — universe tables + Bollywood box-office verdicts
- Part 4 — **build sequence (follow this order)**
- Part 5 — **finalized tech stack + file structure (follow exactly)**
- Part 6 — successor careers, universe continuity, legacy toggle, career params

Where later parts differ from earlier ones, the later part governs.

## Tech stack (Part 5 — do not substitute)
- **TypeScript + Vite** (browser, runnable locally), **Vitest** for tests
- **Seeded PRNG (mulberry32)** with **context-derived seeds** (`worldSeed + entityId + week + eventId`) — deterministic, order-independent saves
- State split: small hot in-memory `GameState` + **Dexie** entity tables (movies, people, studios, directors, relationships) queried on demand
- **UI: Svelte 5** (runes for reactivity) + CSS/CSS variables — presentation only, never simulation logic
- **Charts: ECharts**
- Sim engine is UI-agnostic and Web Worker-ready
- Files split by engine under `src/` per Part 5's tree (core / sim / industry / world / meta / gen / ui / tests)

## How to build
- **Phase by phase, per Part 4. Do NOT attempt the whole game in one pass.**
- Start every new system by confirming the plan, then implement it fully — no stubs, no `// TODO` placeholders standing in for real logic.
- **Each phase must be runnable before moving to the next.** After a phase, tell me how to run it and what to test.
- **Version every phase.** The folder is a git repo: at the end of each Part 4 step, commit and tag it `phase-N` (e.g. `phase-2`), so any earlier version can be run again with `git checkout phase-N`. Don't commit mid-phase work-in-progress without saying so.
- Current phase target: see "Status" at the bottom — update it as phases complete.

## Non-negotiable rules (these cause silent bugs if broken)
1. **All randomness goes through the seeded RNG, with context-derived seeds.** Never call `Math.random()`. Derive each roll's seed from `worldSeed + entityId + week + eventId` so results are reproducible regardless of call order or Worker execution.
2. **The sim engine is 100% UI-agnostic; Svelte only displays.** No DOM references inside any engine, and no simulation logic inside Svelte components — they read state and render, nothing more. (Keeps the Worker option + iOS port alive, and the engine testable headless.)
3. **Only `SaveEngine` touches Dexie.** Other engines operate on the in-memory working set handed to them.
4. **No `await` inside the weekly tick.** Load the working set before, persist deltas after — never query the DB mid-loop. Protects speed + deterministic RNG ordering.
5. **Central types.** The hot `GameState` shape and every entity schema live in one shared types module that everything imports.

## Core design invariants (do not collapse these)
- **Three independent axes:** Player Performance (P, 1–5), Movie Quality (Q), Commercial success (C) are separate systems routed to different downstream stats. A 5/5 performance can happen in a flop; a phoned-in 2/5 can be in a $700M hit.
- **Persistent universe:** NPCs run the same career engine, age, and persist. Retired actors (incl. past player characters) stay in the world via a shared `universeId`. Successor careers continue the same universe.
- **Controlled randomness:** outcome = fundamentals + circumstances + bounded variance. Luck widens the band, never overrides fundamentals. Variance is threshold-gated (can't luck into an All-Time performance without the fundamentals clearing a high bar).

## Commands
- `npm run dev` — start the local dev server (http://localhost:5173)
- `npm test` — run Vitest (unit + headless slice/determinism/save tests)
- `npm run check` — svelte-check + TypeScript over the whole project
- `npm run build` — production build

## Status

### Part 4 build sequence
- [x] **1. Slice** — state + weekly turn + one actor + a few hand-built auditions → book → simple production → the 3-axis result screen. Runnable in a day of turns.
- [x] **2. Procedural movie/NPC generation + the living-world weekly tick.**
- [ ] 3. Full casting/audition probability + contracts + negotiation.
- [ ] 4. Box office engine (the hard math) + release calendar competition.
- [ ] 5. Perception, typecasting, rivalries, relationships, news.
- [ ] 6. Awards, finances, milestones, scandals.
- [ ] 7. UI polish + saves + tutorial + the two universe tables (People, Movies).
- [ ] 8. Tune via simulated careers — headless 40-year sims; check economy/box-office distributions.

### Details
- **Phase 1 — COMPLETE (vertical slice).** Runnable end to end: new game → weekly actions → audition board → callback → prep → audition vs. named NPC competitors → offer → accept → multi-week shoot with events → P/Q sealed at wrap → post-production → weekly box office run (ECharts) → Bollywood verdict → 3-axis result screen with per-axis career impacts. Autosave every tick/command via Dexie; reload + Load resumes.
  - Built: `core/{GameState,RNG,EventBus,TimeEngine,Game}`, `sim/ActorEngine`, `industry/{Audition,Casting,Movie,Production,Performance,Quality,BoxOffice}Engine`, `world/IndustryEngine` (hand-built universe + deterministic refill), `meta/SaveEngine` (only Dexie importer), `ui/*` (Svelte 5 runes, presentation only), `tests/*` (24 tests).
  - Decisions locked in Phase 1: verdict ladder on worldwide ÷ production budget (Disaster <0.30 · Flop <0.75 · Average <1.5 · Hit <2.0 · Super Hit <2.5 · Blockbuster <3.0 · All-Time ≥3.0; `VERDICT_BASIS` constant in BoxOfficeEngine); P raw = 0.85×fundamentals + circumstances + variance with thresholds 36/58/76/96 and gates (4 needs F≥60; 5 needs F≥78 + circumstances ≥4); 4-4-5 calendar, epoch Jan 2028, start week 8 (March 2028), fixed age 20.
  - Known Phase 1 simplifications (by design, replaced in later phases): box office is v1 (no release calendar/competition — Phase 4); offers have a fixed salary, no negotiation (Phase 3); NPCs don't run careers yet and un-booked announced movies stay announced (Phase 2); estimate bands use a fixed fuzz (Phase 5 ties width to connections/agent).
- **Phase 2 — COMPLETE (living world).** The industry runs whether the player acts or not: studios greenlight toward annual slates by identity (`StudioEngine` + `gen/MovieGen`), every role is shortlisted and cast from the real actor pool (`CastingEngine.castRole`, fresh faces fill gaps), films shoot/wrap (Q + a P for every cast member), open and run their box office, get verdicts, and route impacts to every cast member's career; NPC craft/star power drift (`NPCEngine`), aging/retirement/cohorts/new directors (`CareerEngine`, `DirectorEngine`); director/studio records follow results. A **52-week prehistory** runs before the player enters (`Game.create`), so week 1 has films in theaters and real shortlists. The audition board is drawn from movies in `casting` status, filtered by Part 1's Movie Offer Logic (`AuditionEngine.listingVisibility`); competitors are the role's actual shortlist. New `Industry` screen (Box Office / Movies / People — plain versions; Phase 7 polishes). Save schema v2; Phase 1 saves show as incompatible with a delete button.
  - Balance (10-year idle sweep, `scratchpad` script): ~65 films/yr, ~230 active actors, ~11 retirements/yr, 12–20 entrants/yr; verdicts ≈ Disaster 1% / Flop 24% / Average 42% / Hit 15% / Super Hit 7% / Blockbuster 5% / All-Time 6%; worldwide÷budget p10/p50/p90 ≈ 0.5/1.1/2.5, even across tiers; star power 1–3 ≥85, ~14 in 70–84, most <50 — no inflation over 40 years; 40 idle years ≈ 2 s headless.
  - Balance levers worth knowing: `OPENING_RATIO` per tier + log-shaped luck `exp(variance(1.5))` in BoxOfficeEngine; star gains use an exposure term plus diminishing headroom `(1 − star/115)` and a slow baseline fade (NPCEngine); casting is one-film-at-a-time with a star-scaled cooldown (`CastingEngine.eligibleFor`); big films chase names for lead parts (`roleFit`).
  - Known Phase 2 simplifications: NPC↔director/studio trust isn't tracked (Phase 5 RelationshipEngine); no head-to-head rivalry log yet (Phase 5); no NPC salaries/contracts beyond a star-scaled base (Phase 3); compaction of long-retired NPCs not yet implemented (Phase 7 with saves); timeline is capped at 1,500 hot entries.
- **Next: Phase 3** — full casting/audition probability (agent, previous performances, relationships, typecasting hooks) + contracts + negotiation (`ContractEngine`).
- Update this section as each Part 4 phase completes so future sessions resume correctly.
