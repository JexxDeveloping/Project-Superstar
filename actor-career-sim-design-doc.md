# ACTOR CAREER SIMULATOR — MASTER DESIGN DOCUMENT

This document is the complete, consolidated record for the game.

- **Part 1** is the original design brief, preserved in full.
- **Part 2** is the set of design refinements and enhancements (formalized systems + new features).
- **Part 3** is the additional features requested on top of Part 2.
- **Part 4** is the build sequence.
- **Part 5** is the finalized tech stack and file structure.
- **Part 6** is successor careers and universe continuity.

Nothing from the original has been removed. Later parts refine and extend earlier ones; where a later part differs from an earlier one, the later part is the decision of record, and it is noted.

---
---

# PART 1 — ORIGINAL DESIGN BRIEF

You are an expert indie game developer, systems designer, UI/UX designer, simulation designer, and programmer.

I want you to BUILD a complete playable 2D single-player actor career simulator.

Do not merely give me ideas, pseudocode, an outline, or a design document. Build the actual game and implement the systems described below.

## CORE CONCEPT

The game is a turn-based career/life simulation in which the player creates an aspiring actor and attempts to build a career in a fictional movie industry.

The player should begin as an unknown actor with very little money, limited acting ability, virtually no industry connections, and low star power.

The ultimate goal is open-ended.

The player could become:

* A legendary movie superstar
* A respected dramatic actor
* A blockbuster action star
* A comedy icon
* A romantic lead
* A character actor
* An indie-film legend
* An awards darling
* A wealthy but critically disliked celebrity
* A cult actor
* A journeyman actor
* A washed-up former star
* Or someone who never succeeds at all

Careers should emerge naturally from player decisions, opportunities, performances, randomness, industry trends, and previous career history.

There should NOT be a predetermined path to success.

## TIME SYSTEM

The game is TURN-BASED.

1 TURN = 1 WEEK.

Display prominently:

YEAR
MONTH
WEEK
AGE

Example:

March 2028
Week 3
Age: 24

The player presses an "End Week" button after completing their available actions.

Ending a week advances the simulation.

Certain events take multiple weeks:

* Auditions
* Acting classes
* Filming
* Rehearsals
* Press tours
* Vacations
* Injuries
* Contract negotiations
* Movie releases

The game should maintain a complete historical timeline.

## CHARACTER CREATION

At the beginning, allow the player to create an actor.

Choose:

First Name
Last Name
Age (18–25)
Gender
Appearance/avatar
Starting city
Background

Possible backgrounds:

Film Student
Theater Actor
Child Actor
Model
Comedian
Social Media Personality
Athlete
Complete Unknown

Backgrounds should provide small starting bonuses and penalties.

Example:

Film Student:

* Acting fundamentals
* Drama

- Star Power
- Industry Connections

Social Media Personality:

* Star Power
* Fanbase

- Acting Ability
- Critical Reputation

## CORE ATTRIBUTES

Attributes use 0–100 scales.

MAIN ATTRIBUTES:

Acting Overall
Star Power
Reputation
Industry Connections
Fan Popularity
Critical Reputation
Professionalism
Charisma
Work Ethic
Negotiation
Media Skill

GENRE SKILLS:

Action
Comedy
Drama
Romance
Horror
Thriller
Crime
Mystery
Fantasy
Science Fiction
Historical
Musical
Sports
Family
Western

These should develop separately.

Someone could therefore be:

Overall: 88

Drama: 95
Comedy: 91
Romance: 89
Action: 58

This should meaningfully influence casting and performances.

## ACTOR ARCHETYPES

At character creation choose an archetype.

Examples:

Jack of All Trades
Action Hero
Dramatic Performer
Comedian
Romantic Lead
Method Actor
Character Actor
Blockbuster Star
Indie Darling

Jack of All Trades should receive small bonuses to their three strongest genres but have fewer extreme specialization bonuses.

Specialists receive larger bonuses within their specialty but larger penalties outside it.

## ACTOR STATUS / STAR POWER TIERS

Star Power should translate into recognizable career tiers.

0–39: Unknown
40–49: Film Student / Amateur
50–59: Emerging Actor
60–69: D-List
70–79: C-List
80–84: B-List
85–89: A-List
90–94: Superstar
95–100: Industry Icon

These tiers affect:

Auditions
Salary
Negotiating leverage
Movie marketing
Opening weekends
Fan interest
Press coverage
Direct offers
Endorsements
Director interest
Franchise opportunities

Star Power should NOT automatically mean acting talent.

A 95 Star Power actor with 70 Acting could be an enormous celebrity but mediocre performer.

A 95 Acting / 60 Star Power actor could be one of the world's best actors but relatively unknown commercially.

## WEEKLY ACTIONS

Every week the player receives a limited number of actions.

Examples:

Search Auditions
Attend Audition
Acting Class
Genre Training
Meet Agent
Network
Meet Director
Read Scripts
Exercise
Prepare for Role
Rehearse
Rest
Attend Premiere
Attend Film Festival
Do Interview
Social Media Promotion
Public Appearance
Negotiate Contract

Actions should have opportunity costs.

Players cannot maximize everything simultaneously.

## ENERGY / STRESS

Include:

Energy
Stress

Working excessively reduces energy.

Low energy can hurt:

Auditions
Performances
Media appearances
Relationships
Professionalism

High stress can cause:

Poor performances
Burnout
Arguments
Missed auditions
Bad press
Need for vacation

Rest should therefore matter.

## AUDITION SYSTEM

Auditions should be one of the game's central mechanics.

An Auditions screen should display available roles.

Each listing should show:

Movie
Studio
Genre
Budget
Role Type
Character
Director
Expected Salary
Audition Difficulty
Required Acting Level
Preferred Genre Skill
Production Dates
Estimated Prestige
Estimated Commercial Potential

Role sizes:

Extra
Minor
Supporting
Co-Lead
Lead
Main Protagonist

The player can apply.

Applying does NOT guarantee an audition.

Casting probability should consider:

Acting
Genre Skill
Star Power
Appearance/fit
Previous performances
Director relationship
Agent quality
Reputation
Professionalism
Connections
Competition
Randomness

Never make outcomes completely deterministic.

## AUDITION EVENT

If selected, show an audition event.

Display competing actors.

Example:

AUDITION — NIGHT HEART

Role: Ethan Cole
Role Type: Lead
Genre: Action / Thriller
Studio: Titan Pictures
Budget: $72M

Casting Competition:
Clyde Osborne — Acting 82 / Star 74
Marcus Reed — Acting 76 / Star 82
Leo King — Acting 88 / Star 62

Allow preparation decisions before auditioning.

Possible preparation:

Study Character
Practice Scene
Work With Acting Coach
Research Genre
Physical Preparation
Do Nothing

Each costs time/money/energy.

Then calculate audition performance.

Show:

Audition Score: 84/100

Director Reaction:
"Strong emotional delivery, but the production team has concerns about his action experience."

Do NOT immediately reveal all hidden calculations.

## CONTRACT NEGOTIATIONS

If offered a role, open a negotiation interface.

Contract should include:

Base Salary
Box Office Bonus
Profit Participation
Sequel Option
Number of Films
Billing
Promotional Requirements
Production Weeks

Player options:

Accept
Reject
Counteroffer
Ask for higher salary
Ask for backend percentage
Ask for top billing
Reduce sequel options

Studios can:

Accept
Counter
Reject
Withdraw Offer

Negotiation success depends on:

Star Power
Negotiation
Role importance
Studio desperation
Other available actors
Previous box office results
Relationship
Budget

Being greedy should sometimes cost the player the role.

## AGENTS

Allow players to hire agents.

Agents have:

Name
Agency
Level
Connections
Negotiation Skill
Commission
Specialization

Example:

Rachel Monroe
Silver Talent Agency

Connections: 72
Negotiation: 81
Commission: 10%

Good agents unlock better auditions and direct offers.

Elite agencies may refuse unknown actors.

Agents may approach successful players.

## MOVIE DATABASE

Every movie generated should become a permanent entity.

Movie properties:

Title
Genre(s)
Studio
Director
Budget
Marketing Budget
Cast
Role hierarchy
Production length
Release date
Release strategy
MPAA-style rating
Quality
Audience score
Critic score
Box office
Awards
Profitability
Franchise
Cult status

Budgets should vary enormously.

Micro Indie:
$100K–$1M

Indie:
$1M–$10M

Small Studio:
$10M–$40M

Medium:
$40M–$100M

Large:
$100M–$200M

Tentpole:
$200M+

## MOVIE PRODUCTION

After accepting a role, filming should take multiple weeks.

Example:

PRODUCTION
Week 4 of 11

Each week events can occur.

Examples:

Great Scene
Bad Take
Director Conflict
Cast Chemistry
Script Rewrite
Improvised Scene
Injury
Production Delay
Budget Overrun
Viral Set Photo
Director Praises Player
Co-Star Conflict
Unexpected Breakthrough Scene

Choices should sometimes appear.

## PERFORMANCE SYSTEM

When production finishes, calculate the player's performance.

Factors:

Acting Overall
Genre Skill
Role Fit
Preparation
Director Quality
Script Quality
Co-Star Chemistry
Energy
Stress
Experience
Random Variance

Performance categories:

1 — Mediocre
2 — Above Average
3 — Good
4 — Great
5 — All-Time

All-Time performances should be RARE.

Do not hand them out simply because someone has 95+ acting.

A legendary performance should require several favorable circumstances.

## MOVIE QUALITY

Movie quality should be independent from actor performance.

A player can give a 5/5 performance in a terrible movie.

Or:

Player Performance: 2/5
Movie: 5/5

Movie quality factors include:

Script
Director
Cast
Chemistry
Production
Editing
Genre execution
Budget efficiency
Random events

## BOX OFFICE ENGINE

This is extremely important.

Create a detailed box-office simulation.

Movie success should NEVER simply be:

Budget × fixed multiplier.

Calculate demand using:

Budget
Marketing
Star Power of cast
Franchise popularity
Genre popularity
Release date
Competition
Reviews
Audience reception
Word of mouth
Director reputation
Studio reputation
Rating
Seasonality
Opening hype
Previous franchise films
Cultural buzz
Randomness

Simulate:

Opening Weekend Domestic
Opening Weekend International

Then every theatrical week.

Example:

WEEK 1
Domestic: $38.2M
International: $51.4M

WEEK 2
Domestic: $19.7M (-48%)
International: $28.9M (-44%)

Continue for approximately 6–10 weeks depending on performance.

Movies with exceptional word-of-mouth should have unusually strong legs.

Poorly received movies may collapse 60–75% in Week 2.

Sleeper hits may START SMALL and grow.

Example:

Week 1: $3M
Week 2: $4.2M
Week 3: $5.1M

Rare viral movies should exist.

## COMMERCIAL RESULT LABELS

After theatrical run classify movies relative to their economics.

Possible classifications:

Disaster
Flop
Underperformer
Average
Moderate Success
Hit
Super Hit
Blockbuster
Mega Blockbuster
All-Time Blockbuster

Do NOT classify merely from raw gross.

A $150M gross on a $20M movie could be enormous.

A $300M gross on a $250M movie could be disappointing.

## CAREER BOX OFFICE IMPACT

The player's contribution to box office should depend upon role size.

A superstar appearing for 4 minutes should NOT magically make a movie a blockbuster.

Use a Role Influence modifier.

Example:

Cameo: 5%
Minor: 10%
Supporting: 25%
Co-Lead: 60%
Lead: 85%
Central Protagonist: 100%

This affects how much the player's Star Power influences demand.

## RELEASE CALENDAR

Maintain an industry-wide movie release calendar.

Movies compete against each other.

Example:

JULY 4 WEEKEND

Galaxy Force — $220M budget
Clyde's Movie — $90M
Dragon Kingdom II — $175M

These movies should steal screens and audience demand from one another.

Holiday periods provide larger total audiences but stronger competition.

Important windows:

Valentine's Day
Spring Break
Memorial Day
July 4
Summer
Halloween
Thanksgiving
Christmas

Genres should react differently.

Romance gets Valentine's boost.

Horror gets Halloween boost.

Family movies benefit from Christmas.

Blockbusters benefit from summer.

## INDUSTRY SIMULATION

Generate persistent fictional:

Actors
Actresses
Directors
Studios
Agents
Franchises

NPC actors should have careers independent of the player.

They age.

They improve.

They decline.

They star in movies.

They win awards.

They become stars.

They flop.

They compete with the player.

They retire.

The world should feel like it exists without the player.

## RIVALRIES

Actors competing for similar roles may develop rivalries.

Track:

Friendship
Professional Relationship
Rivalry
Chemistry

A rival may repeatedly beat the player for roles.

Eventually the player might surpass them.

## STUDIOS

Create fictional studios with identities.

Example:

Titan Pictures
Huge blockbuster studio.

Evergreen Films
Prestige dramas.

LaughTrack Studios
Comedy specialist.

Northstar Entertainment
Mid-budget mainstream films.

Horizon Indie
Independent films.

Studios track their relationship with the player.

Successful collaborations increase trust.

Repeated flops reduce it.

## DIRECTORS

Directors should have:

Overall
Prestige
Genre Specialty
Actor Development
Box Office Record
Relationship with Player

Great directors can improve performances.

Directors may repeatedly cast actors they trust.

## REVIEWS

After release generate critic and audience reactions.

Example:

Critics: 82%
Audience: 91%

Sample fictional review snippets can appear.

Reviews influence box office legs.

## AWARDS

Have an annual awards season.

Awards include fictional equivalents of:

Best Picture
Best Actor
Best Actress
Supporting Actor
Supporting Actress
Director
Screenplay
Cinematography
Original Score

Players can receive:

Nomination
Win

Awards dramatically improve prestige but only moderately increase commercial star power.

Awards should be difficult.

## CAREER AWARDS PAGE

Track:

Nominations
Wins
Best Actor Wins
Supporting Wins
Movie Awards

## PLAYER LEVELING

Create XP and player levels.

XP comes from:

Completing movies
Strong performances
Box office success
Awards
Auditions
Training
Career milestones

Level-ups grant Skill Points.

Allow allocation into:

Acting
Comedy
Drama
Romance
Action
Charisma
Negotiation
Media
Professionalism
etc.

Higher skills should become progressively more expensive.

Reaching 95–100 should be extremely difficult.

## CAREER MILESTONES

Track achievements such as:

First Audition
First Role
First Lead
First $1M Movie
First $10M Movie
First $100M Movie
First $500M Movie
First $1B Movie
First Hit
First Blockbuster
First Award Nomination
First Award
First Franchise
First A-List Status
First Superstar Status

## FINANCES

Track personal money.

Income:

Acting salaries
Backend deals
Endorsements
Appearance fees

Expenses:

Agent commission
Manager
Publicist
Acting coaches
Lifestyle
Travel
Training

Display:

Cash
Career Earnings
Annual Income
Highest Salary
Backend Earnings

## LIFESTYLE

As wealth increases, allow optional lifestyle upgrades.

Apartment
House
Luxury House
Car
Personal Trainer
Acting Coach
Publicist

These can provide small benefits but recurring expenses.

Do NOT turn this into a detailed life simulator. Career should remain the focus.

## PUBLIC IMAGE

Track:

Public Reputation
Fanbase
Media Sentiment

Possible public identities emerge naturally:

America's Sweetheart
Comedy King
Action Star
Serious Actor
Indie Darling
Box Office Poison
Franchise Star
Critics' Favorite
Cult Icon
Hollywood Bad Boy
Reliable Veteran

These labels should be earned from career patterns.

## MEDIA EVENTS

Random events:

Interview Goes Viral
Bad Interview
Funny Clip Goes Viral
Rumor
Director Praises Actor
Co-Star Praises Actor
Fan Backlash
Award Snub
Career Comeback Story
Box Office Failure Headlines
Breakout Star Headlines

Give player decisions during some events.

## CAREER MOMENTUM

Track hidden or visible Momentum.

Hot actors receive more offers.

Several successful movies create momentum.

Flops reduce momentum.

However, one flop should not automatically destroy an established superstar.

Career history matters.

## AGING

The player ages naturally.

Age affects role availability.

Young:
Teen / college / coming-of-age roles.

20s–30s:
Wide lead opportunities.

40s–50s:
Veteran roles.

60+:
Older character / prestige roles.

Do NOT simply make older actors worse.

Acting ability may actually increase with experience while commercial opportunities change.

## RETIREMENT

Allow voluntary retirement.

NPCs can retire.

At retirement display a massive career summary.

CAREER LENGTH
MOVIES
LEAD ROLES
TOTAL BOX OFFICE
CAREER EARNINGS
AVERAGE CRITIC SCORE
AVERAGE PERFORMANCE
HITS
FLOPS
BLOCKBUSTERS
$1B MOVIES
AWARD NOMINATIONS
AWARD WINS
HIGHEST GROSSING FILM
BEST PERFORMANCE
WORST PERFORMANCE
MOST SUCCESSFUL FRANCHISE
CAREER PEAK
FINAL STAR POWER

Then calculate legacy.

Legacy tiers:

Forgotten
Working Actor
Recognizable Actor
Cult Favorite
Industry Veteran
Movie Star
Superstar
Generational Star
Industry Legend
GOAT Candidate

## HALL OF FAME

Retired legendary actors should appear in a Hall of Fame.

Allow future careers to exist in the same simulated universe if possible.

## CAREER PAGE

Create a filmography table.

YEAR | AGE | MOVIE | ROLE | GENRE | BUDGET | BOX OFFICE | PERFORMANCE | MOVIE RATING | RESULT

Allow clicking movies for details.

## STATISTICS

Have a deep Statistics page.

Show:

Total Movies
Lead Roles
Supporting Roles
Average Performance
Average Movie Rating
Total Worldwide Gross
Average Worldwide Gross
Total Budgets
Career ROI
Highest Grossing Film
Lowest Grossing Film
Biggest Flop
Biggest Hit
Longest Hit Streak
Longest Flop Streak
Genre Breakdown
Average Gross by Genre
Performance by Genre
Movies by Studio
Movies by Director
Career earnings

Use charts where appropriate.

## UI STYLE

I want a polished 2D management-game interface.

Think:

Football Manager
Basketball GM
Hollywood management simulator
Modern tycoon game

Do NOT make it look like a generic website.

Use panels, cards, sidebars, icons, tooltips, modal windows, tables, career graphs and dashboards.

Primary navigation:

HOME
CAREER
AUDITIONS
SCRIPTS
TRAINING
RELATIONSHIPS
INDUSTRY
MOVIES
BOX OFFICE
AWARDS
FINANCES
STATISTICS

Top bar:

Clyde Osborne
Age 25
Overall 78
Star Power 71
Cash $420K

Current Date:
June — Week 2 — 2031

END WEEK

## HOME DASHBOARD

Show:

Actor portrait

Overall
Star Power
Career Momentum
Energy
Stress

Current Project

Upcoming Auditions

Recent News

Current Box Office

Upcoming Releases

Career Milestones

## NEWS SYSTEM

Create a fictional entertainment news feed.

Example:

BOX OFFICE
"Morgan dominates weekend with $72M opening."

CASTING
"Titan Pictures reportedly considering Osborne for upcoming thriller."

AWARDS
"Evergreen leads nominations."

INDUSTRY
"Director James Holt signs three-picture deal with Northstar."

The news system should report on the ENTIRE simulated industry, not only the player.

## RANDOMNESS

The game needs uncertainty.

However randomness must be controlled.

Do NOT make results completely random.

Think:

Outcome = underlying fundamentals + circumstances + controlled random variance.

Excellent decisions should improve probability, not guarantee success.

Bad movies can unexpectedly become hits.

Great movies can disappoint commercially.

Unknown actors can suddenly break out.

Superstars can flop.

Franchises can decline.

Cult films can emerge.

Careers should produce stories naturally.

## HIDDEN VARIABLES

Some information should remain hidden from players.

Examples:

True script quality
Audience appeal
Final movie quality
Exact casting preference
Potential chemistry
True commercial potential

Players instead receive estimates.

Example:

Script Quality:
"Promising"

Commercial Potential:
"Moderate–High"

This prevents perfect optimization.

## SAVE SYSTEM

Implement:

New Game
Save Game
Load Game
Multiple Save Slots
Autosave

The entire simulation state must persist.

## GAME BALANCE

An average career should NOT automatically result in superstardom.

Many careers should plateau.

Example probabilities across simulated careers might roughly produce:

Many working actors
Some C/B-list actors
Few A-list stars
Very few superstars
Extremely rare industry legends

The player should need skill, strategy, luck, and good career decisions.

## IMPORTANT DESIGN PRINCIPLE

Do NOT artificially protect the player.

The player can:

Fail auditions
Lose roles
Make bad movies
Have several flops
Become typecast
Lose star power
Get bad reviews
Make terrible contract decisions
Have career slumps

Likewise, surprising success should be possible.

A $2M indie movie could unexpectedly gross $80M.

An unknown actor could deliver an incredible performance and become an overnight sensation.

## CAREER MEMORY

The simulation MUST remember historical context.

If the player starred in "Scary Movie" ten years ago and a sequel is announced, the game should know:

They starred in the original.
How successful it was.
How good their performance was.
Their relationship with the studio.
How popular the franchise became.

Historical context should influence future simulation.

This is extremely important.

## PROCEDURAL MOVIE GENERATION

Generate movie opportunities dynamically.

Do not use the same handful repeatedly.

Generate:

Titles
Premises
Genres
Budgets
Directors
Studios
Cast
Roles
Character names
Release dates
Franchise possibilities

Movies should sometimes receive sequels based on success.

Flops usually kill franchises.

Unexpected cult hits may receive sequels years later.

## MOVIE OFFER LOGIC

As Star Power increases:

Unknown:
Mostly indie auditions.

Emerging:
Small studio roles.

C-List:
Supporting roles in major movies / leads in smaller movies.

B-List:
Regular studio leads.

A-List:
Major lead offers.

Superstar:
Studios develop movies around actor.

Industry Icon:
Actor can potentially influence casting/directors/projects.

But exceptions should occur.

## PROJECT CHOICE

Eventually successful actors should receive multiple scripts simultaneously.

The player must choose.

Example:

PROJECT A
$150M Action Franchise
Salary: $18M
Commercial Potential: Very High
Prestige: Medium

PROJECT B
$18M Drama
Salary: $3M
Commercial Potential: Low
Prestige: Very High

PROJECT C
$65M Comedy
Salary: $9M
Commercial Potential: High
Prestige: Medium

Career strategy should matter.

## CONTRACT SALARY SCALING

Early career:
Hundreds / thousands.

Working actor:
$20K–$250K.

Recognizable actor:
$250K–$2M.

Star:
$2M–$10M.

A-list:
$10M–$25M.

Mega-star:
Potentially $20M+ plus backend.

These are guidelines, not strict rules.

## DIFFICULTY

Provide:

Casual
Normal
Hard
Industry

Normal should be the intended experience.

Industry difficulty should make superstar careers extremely difficult.

## TUTORIAL

Create a short interactive tutorial explaining:

Weekly turns
Auditions
Training
Contracts
Movies
Star Power
Performance
Box office

Then allow the player to play freely.

## TECHNICAL REQUIREMENTS

Choose a practical technology stack suitable for a polished 2D management game.

If building this as a browser game, make it runnable locally with straightforward setup.

Structure the project cleanly.

Separate:

Simulation engine
UI
Data
Save system
Movie generation
NPC generation
Box office simulation
Career progression

Do not put the entire game into one giant file.

Use reusable components.

Use seeded random generation where appropriate so saves remain consistent.

The simulation should support thousands of weekly turns without breaking.

## GAME ENGINE ARCHITECTURE

Build simulation modules approximately corresponding to:

ActorEngine
CareerEngine
MovieEngine
CastingEngine
AuditionEngine
ContractEngine
ProductionEngine
PerformanceEngine
BoxOfficeEngine
AwardsEngine
IndustryEngine
NPCActorEngine
RelationshipEngine
NewsEngine
FinanceEngine
ProgressionEngine
TimeEngine
SaveEngine

They should interact through shared game state rather than being tightly coupled.

## BOX OFFICE REALISM

Pay particular attention to box office math.

Opening weekend should be affected heavily by:

Marketing
Franchise recognition
Star Power
Genre
Release window
Competition
Pre-release buzz

Legs should be affected heavily by:

Audience score
Critical reception
Genre
Competition
Word of mouth

Do not create unrealistic runs where every week declines by exactly $2M or some arbitrary fixed number.

Use percentage declines and demand curves.

Typical movies might fall approximately 35–65% depending on circumstances.

Exceptional word-of-mouth may produce drops under 30%.

Terrible reception can produce 65–80% collapses.

Holiday behavior can differ.

International and domestic markets should behave differently.

## EXAMPLE MOVIE RESULT SCREEN

NORTH STAR

Budget: $45.0M
Genre: Drama / Holiday
Studio: Evergreen Pictures

Opening Weekend:
Domestic: $31.8M
International: $18.4M
Worldwide: $50.2M

FINAL:
Domestic: $102.7M
International: $74.9M

WORLDWIDE:
$177.6M

RESULT:
SUPER HIT

Critics: 84%
Audience: 92%

Clyde Osborne:
Performance: 4/5 — GREAT

Career Impact:

Star Power +3
Drama +2
Reputation +4
Momentum +18

Headline:

"OSBORNE DELIVERS CAREER-BEST PERFORMANCE AS NORTH STAR BECOMES HOLIDAY HIT"

## IMPORTANT: BUILD THE GAME

I do NOT want you to respond with:

"Here's how you could build it..."

I want you to actually implement it.

Work systematically.

FIRST:
Design the architecture and file structure.

SECOND:
Implement the core game state and weekly turn engine.

THIRD:
Implement actor generation, NPCs and progression.

FOURTH:
Implement auditions and casting.

FIFTH:
Implement contracts.

SIXTH:
Implement movie production.

SEVENTH:
Implement movie quality and performance.

EIGHTH:
Implement the full box office simulation.

NINTH:
Implement industry simulation, competing releases and NPC careers.

TENTH:
Implement awards, finances, news, relationships and career history.

ELEVENTH:
Build and polish the complete UI.

TWELFTH:
Implement saving/loading.

THIRTEENTH:
Populate the game with enough procedural content that a player can play an entire 40+ year career without constantly seeing repetitive events.

FOURTEENTH:
Test the simulation extensively.

Run simulated careers and look for:

Broken economies
Unrealistic box office
Too-easy superstardom
Impossible progression
Repeated movies
Broken saves
Extreme attribute inflation
NPC stagnation
Unrealistic salaries
Unrealistic budgets

Tune the systems based on those tests.

## MOST IMPORTANT REQUIREMENT

I want this to feel like a WORLD SIMULATOR, not an actor-stat-clicker.

If I do nothing, movies should still release.

Actors should still become stars.

Franchises should rise and fall.

Studios should have good and bad years.

Directors should build careers.

Box office records should be broken.

Actors should age and retire.

New young actors should enter the industry.

The player is ONE ACTOR living inside an evolving fictional movie industry.

Every career should produce a different story.

Do not simplify or remove major systems merely to finish faster. If implementation is too large for one response/session, build it in coherent working phases while maintaining the architecture for the complete game.

Start by creating the actual project architecture, then begin implementing the playable game.

---
---

# PART 2 — DESIGN REFINEMENTS & ENHANCEMENTS

The two flagged principles below are the spine of the design. The rest are additive features.

## THE THREE INDEPENDENT AXES

Separate movie quality, player performance, and commercial success into three independent systems. This creates much better stories. The player could give a legendary 5/5 performance in a $150M disaster, or phone in a 2/5 performance while the movie somehow grosses $700M.

The trick isn't just "separate them," it's routing each axis to *different* downstream stats so all 27 combinations produce a distinct career consequence. Otherwise they collapse back into one number.

| Axis | Scale | Driven by | Feeds into (and nothing else) |
|---|---|---|---|
| **Player Performance (P)** | 1–5 | your acting, genre skill, role fit, prep, director, chemistry, energy/stress, variance | your acting reputation, award odds, director trust, skill XP, critic mentions *of you* |
| **Movie Quality (Q)** | 0–100 hidden → shown as bands | script, director, ensemble, editing, production luck | critic score, cult potential, legacy, franchise viability |
| **Commercial (C)** | box office vs economics | star power of cast, marketing, genre/window, competition, WOM, reviews | your star power, salary, studio trust, momentum, endorsement offers |

That routing is what makes the story cells real:

| P / Q / C | Story it tells | What it does to you |
|---|---|---|
| 5 / 2 / 1 | Tour-de-force in a disaster | Critical rep ↑↑, award buzz ↑, star power flat, studio trust ↓ |
| 2 / 5 / 5 | Carried by the film | Star power ↑↑, salary ↑, but "weak link" press → typecast risk |
| 5 / 5 / 1 | Misunderstood masterpiece | Seeds **cult status**; reappraised years later; awards ↑, flop on record |
| 1 / 1 / 5 | Critic-proof crowd-pleaser | Box-office poison label with critics, beloved by fans, franchise offer incoming |
| 5 / 5 / 5 | Grand slam | Rare. Career-defining. Everything ↑ |

## PERSISTENT WORLD — A LIVING COHORT, NOT JUST "NPCs DON'T DESPAWN"

If a 24-year-old NPC beats you for an audition, that guy shouldn't disappear afterward — five years later he might be an A-lister competing with you again. That's what makes a 30–40 year career genuinely fun. To make it happen mechanically:

- **Every NPC runs the same career engine you do** (a cheaper version): they audition, book, film, get reviewed, gain/lose star power, age, retire. The world ticks every week whether you act or not.
- **Generational cohorts.** Actors enter in waves. You get tagged with a "class" (everyone who started within ~3 years of you). The game quietly tracks your cohort for 30 years — "you and Marcus Reed both came up in 2028" — so the press and awards narratives compare you to your peers, not to 60-year-old legends.
- **Head-to-head rivalry records.** When you and an NPC audition for the same role, log it. "Reed leads your head-to-head 4–2 for leads." Rivalries emerge from data, not a scripted flag, and can flip when you surpass them.
- **Hidden trajectories.** Each NPC gets a latent *ceiling* and *volatility* at creation. Some are late bloomers, some flame out at 30. You can't see it — you just watch careers unfold, which is the whole point.

## ENHANCEMENTS

Grouped by how much story-per-line-of-code they generate. The first four are near-essential; the rest are strong-if-time.

**Perception vs. reality layer.** The industry sees a *lagged* copy of your stats. Break out and perceived star power spikes above real; slump and perception decays slowly, so offers keep coming for a while. This is the actual mechanism behind the "one flop shouldn't kill a superstar" rule — momentum + slow-decaying perception, not a hard rule. Makes reputation a stock, not a readout.

**Typecasting as emergent tax.** If >60% of your notable roles are one genre, offers skew hard to that genre and you take an audition penalty *outside* it (casting directors "can't see you" as the villain / the dramatic lead / whatever). Breaking type is a deliberate risky play — take a low-paid against-type indie and prove it. This is the engine behind "America's Sweetheart wants to be taken seriously."

**Information as a progression axis.** Hidden variables are shown as bands ("Commercial Potential: Moderate–High"). Tie the *width* of those bands to your Industry Connections + agent quality + a Read Scripts action. Bad connections = wide fuzzy bands = bad decisions. Now knowledge itself is something you level up, and it prevents perfect optimization exactly as intended.

**Deeper contracts (this is where negotiation earns its keep).** Backend is the real money, and it should have teeth:

| Term | What it does |
|---|---|
| Gross points (first-dollar) | % of revenue from dollar one — huge on a hit, what superstars demand |
| Net points | "Hollywood accounting" — famously pays ~nothing; a trap for the naive |
| Pay-or-play | You get paid even if the film collapses in pre-production |
| Sequel option (studio-favorable) | Locks your future rate low; giving it up cheaply is a rookie mistake |

A savvy high-Negotiation player takes gross points on a likely hit and refuses cheap sequel options. Greed still risks losing the role.

**Chemistry & the muse system.** Persist co-star chemistry and director loyalty as relationship edges. Great chemistry in a hit rom-com → studios reunite "the duo" for a buzz bonus. A director who trusts you casts you across a decade and lifts your performance ceiling in *their* films (the DiCaprio/Scorsese effect). Both are pure emergent-story generators.

**Reinvention / comeback arc.** Aging shouldn't just be a debuff. Model discrete career eras and a rare "reinvention" opportunity for washed-up actors — the one gritty indie that resurrects a career (the McConaughey move). Makes the down-slope recoverable and dramatic instead of a slow death.

**Scandals + PR.** Extend media events into a real reputation-risk system: scandals of varying severity, response choices (apologize / deny / lay low / spin), publicist quality mattering, backlash that decays over time. This is where "Hollywood Bad Boy" vs "Reliable Veteran" identities actually get earned.

**Awards campaigning.** Make awards season semi-active: studios (and you) can spend money/energy on the circuit and festival premieres to boost nomination odds. Snubs and upsets happen. Turns automatic-dice awards into a tense annual event.

**Franchise fatigue.** Model a franchise as an entity with a novelty/fatigue meter. Sequels earn more but decay in quality and eventually collapse — "one sequel too many." Signing a multi-picture deal becomes a genuine strategic fork: guaranteed money + star power vs. years of calendar locked + typecast risk.

**Passion projects (late-game agency).** Once you have power, attach yourself to develop projects, push for a director, or partially self-finance a passion project — risking your own money and rep. Gives superstars something to *do* besides pick from a menu.

## REFINED ARCHITECTURE

The engine list from the original brief holds. Additions and explicit coupling — everything reads/writes one serializable `GameState`, engines never call each other directly:

```
core/        RNG (seeded), EventBus, GameState, TimeEngine
sim/         ActorEngine, NPCEngine, CareerEngine, ProgressionEngine
industry/    MovieEngine, CastingEngine, AuditionEngine, ContractEngine,
             ProductionEngine, PerformanceEngine, QualityEngine [split from Perf],
             BoxOfficeEngine, ReleaseCalendarEngine, AwardsEngine
world/       IndustryEngine, StudioEngine, DirectorEngine, RelationshipEngine,
             RivalryEngine, NewsEngine, PerceptionEngine
meta/        FinanceEngine, SaveEngine, MilestoneEngine
gen/         NameGen, MovieGen, TitleGen, ReviewGen (all seeded)
ui/          panels/cards/modals + one chart module
```

**Stack recommendation** (browser, matching the Campus Dynasty build style): vanilla JS + Vite, plain DOM/CSS for the management UI (it's table- and panel-heavy, not canvas), canvas only for the career charts. Seeded PRNG (mulberry32). Whole sim in one serializable state object. **Saves in IndexedDB, not localStorage** — a 40-year career (~2,080 weeks × full industry) will blow past localStorage's ~5MB. Plan to keep full detail on recent/notable entities and compress old minor NPC careers to summary stats so saves stay lean.

*(If this is built as the iOS version instead: Swift/SwiftUI + SwiftData, same engine design, SwiftData replacing the IndexedDB save layer.)*

---
---

# PART 3 — ADDITIONAL FEATURES

## UNIVERSE — PEOPLE TABLE

Add a screen or tab where I can see the people in the universe in a table format. I can filter to newcomers that year, the overall pool for actors & actresses, i can see old retired ones and their overall stats and cumulative box office.

## UNIVERSE — MOVIES TABLE

A similar tab or screen above where I can see a table view of all the movies that happen in my universe with their budget, total box office, their overall stats and quality scores.

## BOX OFFICE VERDICTS (BOLLYWOOD-STYLE)

I want movie box office verdicts (similar to how bollywood does it) once the movie's theatrical run finishes:

* Disaster - The movie does 30% or less of its budget
* Flop - the movie does 75% or less of its budget
* Average - the movie does 10 to 50% more than its budget
* Hit - the movie does more than 50% of its budget
* Super Hit - the movie does double its budget
* Blockbuster - the movie does more than double its budget
* All-Time Blockbuster - the movie does three times its budget

**[Designer note — RESOLVED 2026-09-11 (Phase 4 design). The seven labels above stand as the record; "Average" keeps its name.]**

The verdict measures **recoupment**, not raw gross against production budget. Gross-vs-budget is how people talk, but it can call a money-losing film a Hit (studios keep roughly half of gross, and marketing is paid on top). The Bollywood verdicts these labels come from are profit verdicts — "Hit" means the people who paid for the film made money — so the model follows that intent:

```
recoup = (worldwide gross × 0.8) / (production budget + marketing)
```

The single constant 0.8 folds in the theater split (~50% of gross) plus the ancillary revenue a studio counts on (home/streaming/TV, ~25–30% of theatrical). It is a tunable constant, deliberately not a sub-simulation. It reproduces the real rule of thumb automatically: a medium film with marketing ≈ budget breaks even near **2.5× budget**, a micro-indie with light marketing near **1.6×**, a tentpole near **2.4×** — tier-sensitivity for free, no per-tier curve.

**Ladder (strict, non-overlapping, on `recoup`):**

| Verdict | Recoup | Meaning |
|---|---|---|
| Disaster | < 0.40 | Lost most of the money |
| Flop | 0.40 – 0.75 | Lost a lot |
| Average | 0.75 – 1.10 | Roughly broke even, either side |
| Hit | 1.10 – 1.50 | Clearly profitable |
| Super Hit | 1.50 – 2.00 | Big profit |
| Blockbuster | 2.00 – 3.00 | Returned double-plus |
| All-Time Blockbuster | ≥ 3.00 **and** a magnitude gate | Historic |

- **All-Time Blockbuster requires scale, not just ratio**: worldwide gross must rank among the biggest in the universe's recent history (e.g. top-10 of the last five years), so the bar rises as the industry's economy grows across a 50-year career and a tiny film tripling its cost is not an "all-timer".
- **Same recoupment ⇒ same verdict** regardless of budget size. A $5M film that returned 2× its cost made its studio proportionally as happy as a $250M one. Magnitude is expressed through the top-rung gate and the headline gross, not a second ladder.
- **No extra rungs.** Story colour comes from **tags** shown beside the verdict: *Sleeper* (grew after opening on word of mouth), *Cult seed* (high quality, commercial failure — the 5/5/1 cell), *Beat expectations* / *Missed expectations* (vs. pre-release tracking).
- **Three numbers are tracked separately on every film**: worldwide gross (the headline), recoupment / estimated profit (the truth), and the verdict (the label). Career routing splits accordingly: **fame** (star power, fan popularity, records, news) follows gross; **trust** (studio relationship, momentum, rehire odds, franchise decisions) follows the verdict.
- Accepted consequence: verdicts are truthfully harsher than the Phase 1 gross ladder (most films lose money theatrically; a Hit means something). The Phase 4 balance pass re-tunes the Commercial impacts so a break-even indie still advances a rookie through the fame channel.

## ENTITY PROFILE PAGES

Every actor, actress, director, and movie generated in the universe has
its own clickable profile page that displays that entity's full recorded history.
This is the payoff of the persistent-world + Dexie design (Part 5): the data is
already stored per entity; these pages are the views onto it. The goal is
immersion — the player can click any name anywhere (cast lists, audition
competition, news, the universe tables) and land on a real record with a real
history.

Universality: this applies to EVERY generated person and EVERY generated movie,
not just notable ones. Pages render on demand from a single Dexie query for that
entity, so it scales to thousands of records.

Reachability: profile pages are the drill-down from the Part 3 universe People
and Movies tables, and are linked from every place an entity's name appears
(cast/crew lists, audition competitors, news items, filmographies). Clicking a
name on one profile opens that entity's profile (movie -> cast member -> their
filmography -> another movie, etc.).

### PERSON PROFILE (actor / actress / director)

- Header: portrait/avatar, name, role label (e.g. Actor, Director), age.
- Summary stats: Career Earnings, Cumulative Box Office, Overall rating,
  Average Review (career critic average).
- Ratings block (adapts to role type):
  - Actors/actresses: per-genre acting skills (Drama, Action, Comedy, Romance,
    etc.) plus core attributes (Star Power, Charisma, etc.), and Chemistry /
    Content flags.
  - Directors: craft ratings (Directing, Leadership, Pacing, Style, etc.)
    plus Star Power / reputation.
- Filmography ("Movies"): paginated list of every film the entity worked on,
  each row showing icon, title, release status or date, studio, that entity's
  salary on the film, budget, review/critic score, box-office %, and box office.
  For player characters, also show the player's 1-5 Performance (P) per film.
- Awards: list of nominations/wins, or "No awards found" if none.


### MOVIE PROFILE

- Header: poster/icon, title, release (Week X, Year Y) or upcoming status, Critic
  score (from Movie Quality, Part 2's Q axis), Box Office (total, the C axis),
  and Studio.
- Information: Plot (expandable summary), Type (animation/live-action), Genre(s),
  Plot Arc, Rating, Runtime, and Franchise/Brand if part of one.
- Box-office verdict: display the Part 3 verdict label (Disaster ... All-Time
  Blockbuster) once the theatrical run is complete.
- Director: name + stats (box-office %, salary, movie count, avg review, cumulative
  box office), linking to that person's profile.
- Cast: each member with name, role type (Leading Actor/Actress, Supporting,
  etc.), box-office %, salary, movie count, review, and box office, each linking
  to that person's profile.
- Awards: list, or "No awards found."
- Budget breakdown: Production (cast, director), Post-production (marketing),
  allocated box-office %, and totals shown both without ads and with ads
  (production cost vs. total cost).
- Box office: week-by-week gross for the full theatrical run, First Week and
  Total figures, and a bar chart of the weekly decline (ECharts).

### DATA REQUIREMENT

These pages display history, not snapshots, so the underlying data must be
accumulated as the simulation runs (starting Phase 2), not recomputed at view
time: each movie stores its weekly box-office array and final verdict; each
person stores their per-film record, cumulative gross, career earnings, and
running average review. If this history is persisted to each entity's Dexie
record as it happens, these pages are pure read-only views built in Phase 7.

---
---

# PART 4 — BUILD SEQUENCE

The 14-step content order in Part 1 remains the reference. This is the practical execution order — a playable vertical slice first, then widen.

1. **Slice:** state + weekly turn + one actor + a handful of hand-built auditions → book → simple production → the 3-axis result screen. Playable in a day of turns.
2. Procedural movie/NPC generation + the living-world weekly tick.
3. Full casting/audition probability + contracts + negotiation.
4. Box office engine (the hard math) + release calendar competition.
   *Phase 4 notes:* store running cumulative box office + average review on each person record instead of computing on the fly. Add movie metadata fields: Type (animation/live-action), Plot Arc, Rating, Runtime, Plot summary — required by the Movie Profile page.
5. Perception, typecasting, rivalries, relationships, news.
6. Awards, finances, milestones, scandals.
   *Note for phases 2–6:* Persist per-entity history as it is generated (each movie's weekly box office, each person's per-film result, cumulative gross, avg review) to the entity's Dexie record — do not compute-and-discard. Required by the Entity Profile Pages in Part 3.
7. UI polish + saves + tutorial + the two universe tables (People, Movies) + entity profile pages (people + movies), drill-down from the universe tables.
8. Tune via simulated careers (original step 14) — run headless 40-year sims and check the economy/box-office distributions before calling it done.

---
---

# PART 5 — TECH STACK & FILE STRUCTURE (FINALIZED)

This part finalizes the "Stack recommendation" and "REFINED ARCHITECTURE" notes in Part 2. Where this part and Part 2 differ, this part is the decision of record.

*Revision note: the UI layer is now **Svelte 5** (previously vanilla DOM + a signals layer), charts are now **ECharts** (previously hand-built Canvas), and the seeded RNG now uses **context-derived seeds** (previously a single global stream). Reasons are in the table below. Everything else — engine list, file structure, hot-state + Dexie, TS/Vite/Vitest, Worker-ready, iOS fallback — is unchanged.*

## FINAL TECH STACK

Browser build, runnable locally, structured so the simulation engine can be ported to iOS later without a rewrite.

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** | One giant shared `GameState` flows through ~18 engines plus save/load serialization. TS catches wrong-shaped state and typo'd fields at write-time instead of failing silently 400 lines away, and makes cross-engine refactors survivable. Vite handles `.ts` with zero extra config, so the cost is near-nil. |
| Build / dev server | **Vite** | One command to run locally, fast hot reloads. |
| Test runner | **Vitest** | Doubles as the balance harness — run headless 40-year sims and assert no broken economies, sane box-office distributions, no attribute inflation (the original brief's step-14 testing). Pairs natively with Vite. |
| Randomness | **Seeded PRNG (mulberry32), context-derived seeds** | Deterministic saves — same seed replays identically. Rather than drawing every roll from one global stream (which is order-dependent — reordering calls or moving work into a Worker shifts every downstream result), derive a local seed per event from a combination like `worldSeed + entityId (movie/actor) + week + eventId`. Each outcome is then reproducible independent of call order, which is what makes lazy-loading and the Web Worker safe. Randomness still exists — it's just controlled and replayable. |
| State | **Split: hot in-memory `GameState` + Dexie entity tables** | The hot object holds only what the current turn touches — the player actor, current date/week, active project, RNG state, transient flags. The world's bulk (movies, people, studios, directors, relationships) lives as indexed Dexie records queried on demand, so a 40-year universe never has to sit fully in memory or serialize as one giant blob. |
| Saves | **Dexie (IndexedDB), versioned** | Dexie is a thin wrapper over IndexedDB that gives entity tables, indexes, compound keys, and range queries — exactly what the universe People/Movies browse tables need (sort/filter thousands of rows on demand instead of holding + sorting everything in JS). Autosave becomes cheap **delta writes** (only changed/new records), not a full-blob rewrite every week. Schema changes use Dexie's built-in migration system (`db.version(n).stores(...).upgrade()`), satisfying the versioned-save requirement. A `universeId` on records keeps multiple universes cleanly separable in one DB. |
| Sim isolation | **Engine is UI-agnostic, Web Worker-ready** | The living-world weekly tick (advancing thousands of NPC careers, skipping weeks) can freeze the UI on big turns. Keep the engine fully decoupled from the DOM so it can move to a Worker when a turn feels slow — and so the iOS port stays real. |
| UI | **Svelte 5 (+ CSS / CSS variables)** | The game has many reactive screens — dashboard, auditions, contracts, movie pages, actor profiles, box-office tables, awards, finances, industry news, career history, statistics, modals, and weekly updates. Hand-syncing all of that with vanilla DOM would mean endless manual element selection, event wiring, and state-to-DOM syncing that gets worse as the game grows. Svelte 5's runes give clean automatic reactivity — when game state changes, the UI updates itself — while compiling to tiny vanilla JS with almost no runtime overhead. Svelte is used for **presentation only**; it never contains simulation logic. |
| Charts | **ECharts** | The game needs many statistical visualizations — star power over time, acting progression, career earnings, box-office history, genre performance, average gross by genre, momentum, studio relationships, profitability, award history. Hand-drawing all of these on Canvas is wasted effort; ECharts covers them out of the box and stays styled to match the game. (It's the one heavier dependency (~1MB); if bundle size ever bites, uPlot/Chart.js are lighter fallbacks, but ECharts is the pick.) |

**iOS fallback:** Swift/SwiftUI + SwiftData, same engine design, SwiftData replacing the Dexie layer. This mapping is now cleaner than before — SwiftData is itself an entity store, so Dexie tables translate almost one-to-one to SwiftData `@Model` types. The engine stays identical; only the UI shell and persistence layer differ.

## PERSISTENCE ARCHITECTURE (how the split works)

The DB-backed model has one rule that keeps it fast and deterministic:

- **The weekly sim tick runs entirely on an in-memory working set — never async DB reads mid-loop.** Advancing thousands of NPC careers can't `await` a query per NPC; that would be slow and would threaten the deterministic ordering the seeded RNG depends on. So at the start of a tick the engine loads the working set it needs synchronously, simulates in memory, and writes results back to Dexie at end-of-tick / autosave. On-demand querying is for the **UI** (the People/Movies browse tables, statistics), not the simulation loop.
- **Hot vs. cold.** Hot state (player, current week, active project, RNG state) is small and always in memory. Cold state (the entity tables) is loaded in slices as needed and persisted as deltas.
- **Determinism is preserved** because each roll's seed is derived from stable context (`worldSeed + entityId + week + eventId`), so an outcome replays identically no matter what's paged in from Dexie or in what order the tick happens to touch entities. This is stronger than relying on a single stream's call order — it's what makes lazy-loading and a future Worker safe.
- **The `SaveEngine` owns the Dexie schema and all reads/writes** — it's the only module that touches the DB, so the rest of the engines stay persistence-agnostic (and the iOS port only has to reimplement this one layer).

## DISCIPLINE RULES (NON-NEGOTIABLE)

These aren't stack choices but they bite hard if ignored:

- **Central types.** The hot `GameState` shape and every entity table schema (Movie, Person, Studio, Director, Relationship, …) live in one place (`core/GameState.ts` + a shared types module) that everything imports. This is exactly where TypeScript pays off — a wrong field shape is caught across files instead of at runtime, and it keeps the Dexie schema and the in-memory shapes from drifting apart.
- **All randomness goes through the seeded RNG, with context-derived seeds.** Never call `Math.random()` — one stray call desyncs saves. Derive each roll's seed from stable context (`worldSeed + entityId + week + eventId`) rather than a single global sequence, so results stay reproducible regardless of call order or Worker execution.
- **The sim engine is 100% UI-agnostic; Svelte only displays.** No DOM references inside any engine, and no simulation logic inside Svelte components — components read state and render, nothing more. This keeps the Worker option and the iOS port alive, and keeps the engine testable headless.
- **Only `SaveEngine` touches Dexie.** No other engine imports the DB. Engines operate on the in-memory working set; `SaveEngine` handles loading slices in and writing deltas out. This is what keeps the persistence layer swappable (Dexie → SwiftData) and the engines pure.
- **No `await` inside the weekly tick.** The tick is synchronous over an already-loaded working set; all DB I/O happens before (load) and after (persist), never during. This protects both speed and deterministic RNG ordering.

## FILE STRUCTURE

Split by engine — roughly one file per engine plus the shared pieces. This keeps each turn's diffs small and reviewable, lets a bug in one engine stay contained, and keeps the engine layer portable.

```
src/
  core/     RNG.ts, GameState.ts, TimeEngine.ts, EventBus.ts
  sim/      ActorEngine.ts, NPCEngine.ts, CareerEngine.ts, ProgressionEngine.ts
  industry/ MovieEngine.ts, CastingEngine.ts, AuditionEngine.ts, ContractEngine.ts,
            ProductionEngine.ts, PerformanceEngine.ts, QualityEngine.ts,
            BoxOfficeEngine.ts, ReleaseCalendarEngine.ts, AwardsEngine.ts
  world/    IndustryEngine.ts, StudioEngine.ts, DirectorEngine.ts,
            RelationshipEngine.ts, RivalryEngine.ts, NewsEngine.ts, PerceptionEngine.ts
  meta/     FinanceEngine.ts, SaveEngine.ts, MilestoneEngine.ts
  gen/      NameGen.ts, MovieGen.ts, TitleGen.ts, ReviewGen.ts   (all seeded)
  ui/       one Svelte component per screen (home, auditions, scripts, training,
            relationships, industry, movies-table, people-table, box-office, awards,
            finances, statistics) + shared panels/cards/modals + an ECharts chart-wrapper module
  tests/    headless-sim harness + per-engine unit tests (Vitest)
```

- **`QualityEngine.ts` is split out from performance** so movie quality (Q) and player performance (P) stay independent per Part 2's three-axis design.
- **`ReleaseCalendarEngine.ts`, `RivalryEngine.ts`, `PerceptionEngine.ts`** are the new engines the Part 2 enhancements require.
- **`meta/SaveEngine.ts` owns the Dexie schema and is the only module that reads/writes the DB.** All entity tables (movies, people, studios, directors, relationships), their indexes, and the version/migration steps are defined here. Every other engine works on the in-memory working set `SaveEngine` hands it.
- **Types are centralized in `core/GameState.ts`** (hot state + entity table schemas), imported everywhere; engines communicate only through shared state, never by calling each other directly.

---
---

# PART 6 — SUCCESSOR CAREERS & UNIVERSE CONTINUITY

Decision of record. Where this differs from Part 1 (character creation age, retirement), this part governs. It builds directly on the Hall of Fame (Part 1), the persistent-world/cohort design (Part 2), and the `universeId` / Dexie persistence layer (Part 5).

## THE MODEL: NEW ACTOR, SAME UNIVERSE

On retirement, the player creates a new young actor and **keeps the same universe.** The universe continues right where the previous character retired — same date, same world clock, no reset.

- The retired character persists as a permanent record: visible in the **Universe → People tab**, and in the **Hall of Fame** if they qualified.
- Everything the previous career touched persists: NPCs, studios, franchises, directors, relationships, box-office records, and the retired legend themselves.
- **Emergent continuity is the whole point.** Your new rookie might audition for — or get cast by — a director your old character made famous. Franchises your old character launched may still be running (or fading). Your old rivals may now be aging A-listers, or retired legends in the Hall of Fame.

## FLOW AT RETIREMENT

1. Show the career summary + legacy tier (as defined in Part 1's RETIREMENT section).
2. Write the retired actor into the universe as a permanent NPC record with a `retired` status, and — if they qualify — add them to the Hall of Fame.
3. Offer the player a choice:
   - **Continue in this universe** → create a new actor, same `universeId`, world clock keeps running.
   - **End the save.**
4. **Time marches on — the world does NOT rewind.** Old peers keep aging; some are now legends or already retired; a fresh young cohort has entered the industry while the previous character was climbing. The new rookie steps into a world with real history.

## WHAT THE SUCCESSOR INHERITS (AND WHAT IT DOESN'T)

- **Inherits the world, not the character.** The new actor is a fresh unknown — low stats, little money, no connections, low star power — exactly per the original starting conditions in Part 1's CORE CONCEPT. None of the previous character's fame, money, skills, or relationships carry over.
- **Inherits world state, not personal relationships.** A director/studio/franchise that a previous character made prestigious is now a universe fact. The new rookie can benefit from that world (that famous director exists and casts people; that franchise is still hiring) but starts *cold* with them personally — no inherited trust, no inherited rivalry. Relationships are per-character; the world they shaped is permanent.

## OPTIONAL TOGGLE: LEGACY START ("NEPO BABY")

**Off by default** — the default successor is a fresh unknown as described above. When enabled at new-character creation, and only if the *previous* character finished notable enough (A-list peak or higher, or made the Hall of Fame), the new rookie can be framed as that legend's child or protégé and starts with a small leg up.

What it grants — a nudge, not a cheat. **Talent is never inherited; only doors are:**

| Boosted at start | Not boosted |
|---|---|
| Star Power (name recognition) | Acting Overall |
| Industry Connections | Any genre skill |
| A slightly better opening agent tier | Reputation, Professionalism, work ethic |

Scale the bump to how big the predecessor was:

| Predecessor's peak | Successor starting nudge |
|---|---|
| A-list | small (+a few points Star Power / Connections) |
| Superstar | moderate |
| Industry Icon / Hall of Fame | largest (but still far below a made career) |

**The catch that keeps it balanced (and on-theme):** a legacy start attaches a **"nepo baby" media label.** Early on, critics and the industry are skeptical — a harsher critical-reception modifier and a press narrative of "only cast because of the family name" — until the character proves themselves with a genuine hit or a strong performance, at which point the label fades. So the toggle trades a faster *start* for a harder *credibility climb*. It never touches the fundamentals that decide performance, so it can't manufacture a great actor — it only opens doors a nobody wouldn't get, then makes the player earn the respect anyway.

This is fully optional and universe-flavored: with it off, every generation earns everything from zero; with it on, you get a Hollywood dynasty where the name opens rooms but the work still has to be real.

## PLAYER CAREER PARAMETERS (OVERRIDES PART 1)

- **Starting age: 20 (fixed).** This supersedes the "Age (18–25)" range in Part 1's CHARACTER CREATION. Every player character — the first and every successor — begins at 20.
- **Career length cap: 55 years.** A career runs to at most age 75 (20 + 55), at which point it concludes with the full retirement summary.
- **Voluntary retirement remains available at any time before the cap.** The 55-year figure is a hard ceiling, not a target — careers can (and often should) end earlier and organically, when offers dry up or the player chooses to hang it up. Aging still shifts role availability per Part 1's AGING section; the cap is simply the outer bound.

## CONTINUITY IN THE SAME UNIVERSE

- **Same `universeId` across all successor careers** — the Dexie design from Part 5 makes this native; no special-casing required.
- **Retired player characters live in the same tables as NPC legends.** The People tab and Hall of Fame treat them as ordinary universe records, distinguished only by a marker/flag so the player can find their own dynasty's past selves ("your lineage").
- **Cross-career memory** works exactly like Part 1's CAREER MEMORY requirement, extended across generations: a franchise your first character built, ten years later, is still remembered — its history, box office, and who starred in it — when a sequel is greenlit during your second character's career.

## COMPACTION (LOAD-BEARING FOR A MULTI-CAREER UNIVERSE)

Because the universe now runs indefinitely across successor careers, the compaction policy flagged in Part 5 becomes **required, not optional:**

- Long-retired, minor NPCs get squashed to summary records (name, peak star power, career totals, legacy tier, a handful of key films) while notable legends and Hall of Famers keep full detail.
- This keeps the People/Movies tables snappy and the Dexie save bounded no matter how many generations play out. Without it, an endless multi-career universe grows without limit.
