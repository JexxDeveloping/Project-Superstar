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
- [x] **3. Full casting/audition probability + contracts + negotiation.**
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
  - Post-phase fixes (playtest, 2026-09-11): double-booking deadlock → a player film whose shoot arrives while the player is on another set now holds up to 6 weeks then recasts (`TimeEngine` player-ready handling, `CastingEngine.replacePlayer`), offers/applications are refused only on shoot-window overlap (`AuditionEngine.shootConflict`); lost-write race in `SaveEngine.persistDeltas` (dirty marks cleared after the await) fixed — snapshot+clear before the write, UI saves serialized, and `Game.load` repairs holes (`repairWorkingSet`). Saves from before these fixes may load with a "Save repaired" notice.
  - Known Phase 2 simplifications: NPC↔director/studio trust isn't tracked (Phase 5 RelationshipEngine); no head-to-head rivalry log yet (Phase 5); no NPC salaries/contracts beyond a star-scaled base (Phase 3); compaction of long-retired NPCs not yet implemented (Phase 7 with saves); timeline is capped at 1,500 hot entries.
- **Phase 3 — COMPLETE (casting, contracts, agents).** Callback odds now use Part 1's full factor list (`CastingEngine.callbackProbability` + `trackRecord`: recent P average and verdicts, momentum, competition gap vs. the shortlist, agent). Winning a room (or a **direct offer** — D-list+ names get roles sent to them, `findDirectOffer`) opens a **negotiation** (`ContractEngine`): terms (base, box-office bonus tiers, gross/net points, billing, sequel option, promo weeks, pay-or-play), hidden studio patience vs. player leverage, four Part 1 counter moves + pay-or-play, studio replies accept / halfway / hold / **withdraw** with per-round fatigue, studios remember (`Studio.dealTemper`), backend pays out at run end (`computePayout`: gross points from dollar one, net points ≈ nothing). **Agents** (`world/AgentEngine`, an addition to the Part 5 tree): 10-agent roster in 5 agency tiers, elite refuse below a star floor, agents approach on heat, effects on visibility/callbacks/leverage/direct offers, commission on salary and backend. **Scripts** screen + `read_script` action (near-exact bands, small audition edge). **Films can collapse** in casting/pre-production (`MovieEngine.tickCancellations`, ~5% of films; pay-or-play has teeth; a defensive sweep clears any player attachment to a dead film). **Head-to-head log** (`Person.headToHead`) records every named competitor per audition for Phase 5's rivalries. Offers compare side by side on Home. Save schema v3 (Phase 2 saves flagged incompatible).
  - Balance (sweeps in scratchpad): one polite salary ask never loses the role and gains ~8–18%; a greedy triple-ask loses it ~30% (rookie on an indie), ~13% (mid-tier), ~0% (A-list, who instead gets "meets you halfway" on the third push); direct offers none below 60 star power; world distributions unchanged from Phase 2 (~65 films/yr, verdict spread, star pyramid) with ~5% cancellations.
  - Levers worth knowing: `ContractEngine.counterOffer` score = leverage − cost×(1+0.35·(round−1)) − 8·(round−1) + (patience−50)/2 + variance(15) − 18; accept > 15, halfway > −5, hold while score > −20 and patience − cost > 10, else withdraw; a 4th ask always withdraws. `salaryGuideline` clamps to Part 1's bands by star tier.
  - Known Phase 3 simplifications: multi-picture/franchise deals wait for the franchise entity (Phase 5/6); typecasting/perception are hooks only (Phase 5); NPCs have no agents/contracts beyond a star-scaled flat salary; endorsements/appearance fees are Phase 6; sequel options are recorded but not yet exercised (needs sequels, Phase 5/6).
- **Longevity pass (after Phase 3, 2026-09-11):** a 55-year policy-driven career (`scratchpad/career.ts`) and a 30-year regression test (`tests/career.test.ts`) now guard the long game. Fixed: direct offers duplicating an existing application's listing id (crash); acting inflation (training gains vanish above `TRAINING_CEILING` = 80, performance-based craft gains scale by `(1 − acting/100)²` — 95–100 stays extremely hard); careers not graduating (`listingVisibility` narrows names to leads on studio films, indie leads only as prestige plays; direct offers respect the same rule); the player's star power never fading (same slow fade + idle fade as NPCs, in `resolvePlayerWeek`); unbounded application history (`APPLICATION_HISTORY_CAP` = 150 resolved); UI cloning the whole working set per click (store now shares the maps; only hot state is cloned). Result: Amateur at 30 → A-list at 40 → Icon at 50; ~2.5 ms/tick at year 55; hot state < 1 MB. Known long-game gaps for later phases: nothing spends money (Phase 6), momentum pins at 100 and perception is not lagged (Phase 5), P4+ is rare until late career (tune in Phase 8), a relentless player can still do 3–5 films/yr.
- **Next: Phase 4 — the full box office engine + release calendar.** Reference list (agreed 2026-09-11; design in Part 3's resolved designer note):
  1. **Release calendar** (`ReleaseCalendarEngine`): studios pick dates; holiday windows (Valentine's, Spring Break, Memorial Day, July 4, Summer, Halloween, Thanksgiving, Christmas) with bigger audiences and stronger competition; studios move dates when a rival lands; calendar view on the Industry screen with the head-to-head lineup.
  2. **Competition for screens/audience**: finite weekly demand split between films; counter-programming; a film's weekly change depends on what opens against it.
  3. **Seasonality × genre**: romance at Valentine's, horror at Halloween, family at Christmas, blockbusters in summer.
  4. **Opening model** rebuilt: pre-release buzz from marketing spend (a per-film studio decision, not a fixed ratio), franchise recognition (hook for Phase 5/6), cast star power weighted by role influence, genre, window, tracking.
  5. **Word of mouth (WOM)** as a first-class per-film stat that evolves weekly: seeded from audience score minus the hype gap (marketing vs. quality); drifts toward true reception at a speed set by how many have seen it; a rare seeded viral spike. Weekly change = base drop + competition + season + WOM term, so films can **grow** in weeks 2–4 (sleepers), hold (leggy hits), or collapse 65–80% (toxic). Shown as a band (building / strong / fading / toxic), never the number. Small late-arriving fame effect from strong WOM.
  6. **Legs**: domestic and international behave differently; drops driven by audience, reviews, WOM, genre, next week's competition.
  7. **Verdict on recoupment** (Part 3 note): `recoup = (domestic × 0.50 + international × 0.40 + worldwide × afterlifeRate) / (budget + marketing)`, where `afterlifeRate` = 0.30 base ± 0.15 by audience score + a genre adjustment, clamped 0.10–0.50 (≈ 0.8 of gross for an average film; flexes with reception and genre); ladder 0.40 / 0.75 / 1.10 / 1.50 / 2.00 / 3.00 — Disaster / Flop / **Average** (name kept) / Hit / Super Hit / Blockbuster / All-Time Blockbuster; All-Time also needs **worldwide gross ≥ $100M** (fixed floor, tunable; decision 2026-09-12). Gross, recoup/profit and verdict stored separately; **fame follows gross, trust follows verdict**. Tags beside the verdict: Sleeper, Cult seed, Beat/Missed expectations.
  8. **Reviews with words** (`gen/ReviewGen`): critic + audience snippets on release, feeding legs.
  9. **Box-office news + records**: weekly #1, opening records, biggest bomb of the year; a Records panel (biggest opening / gross / bomb) on the Industry screen.
  10. **Tracking reports** the week before release ("tracking suggests $18–26M"), accuracy scaling with connections/agent.
  11. Result screen explains the run week by week (opened #2 behind X; held on strong WOM; crushed by Y in week 3).
  12. Balance pass: re-derive the verdict distribution through competition (target roughly Disaster 10 / Flop 30 / Average 30 / Hit 15 / Super Hit 8 / Blockbuster 5 / All-Time 2) and re-tune Commercial impacts so a break-even indie still advances a rookie via fame.
  13. **Entity-history decisions** (Part 3 → Entity Profile Pages, accepted 2026-09-12): per-film backend on the player's credit; cumulative box office + average review stored per person; a per-film credit shape for directors. *(Already done ahead of Phase 4: cancelled productions leave a "cancelled" credit on every attached person; studios keep a per-film log — film, result, relationship change — with no studio UI until Phase 7.)*
  Engine model is specified in Part 3 → **"Box Office Engine — Behavioural Specification"** (decision of record): total = opening × legs per market; opening = awareness (marketing, stars, franchise hook, genre, window, competition, buzz, luck); legs = `week_n = week_(n−1) × retention × window ratio` with retention = base × reception × WOM × competition × age × discovery and **retention allowed above 100%**; seasonal 52-week market tables per market; studios claim dates and can bump smaller films (incl. the player's); six required behaviours (big-budget flop, mid-budget ~$1B, indie sleeper, sleeper peak, holiday leg-up, reception ≠ commerce, viral outliers) verified by a ~300-film harness before any UI. Build order for Phase 4: engine + calendar + verdict + harness first (show verification), then the UI items above.
  14. **Judgement calls settled (2026-09-12):** (a) the profit-based verdict stays harsh for rookies — early careers should mostly see Flop/Average, Hits are rare for a newcomer; no small-film bias. (b) Studios *can* move the player's film's date to dodge a bigger rival — rarely, always with a news line explaining why. (c) Word of mouth is shown as a word (building / strong / fading / toxic), never a number, and must genuinely drive the weekly box office (growth, holds, collapses), not be cosmetic.
  Deferred: franchises/sequels (Phase 5/6), awards-season timing (Phase 6).
- Update this section as each Part 4 phase completes so future sessions resume correctly.
