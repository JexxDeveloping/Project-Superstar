/**
 * Central types for the Actor Career Simulator.
 *
 * Every engine, the save layer and the UI import their shapes from here.
 * Two families live in this file:
 *   - the hot in-memory `GameState` (small, always loaded, touched every turn)
 *   - the entity schemas persisted in Dexie tables (Person, Movie, Studio, Director)
 *
 * Nothing in here has behaviour; it is the shared contract between engines.
 */

// ---------------------------------------------------------------------------
// Primitive vocab
// ---------------------------------------------------------------------------

export type Id = string;

export const GENRES = [
  'Action', 'Comedy', 'Drama', 'Romance', 'Horror', 'Thriller', 'Crime', 'Mystery',
  'Fantasy', 'Science Fiction', 'Historical', 'Musical', 'Sports', 'Family', 'Western',
] as const;
export type Genre = (typeof GENRES)[number];

export const MAIN_ATTRIBUTES = [
  'acting', 'starPower', 'reputation', 'connections', 'fanPopularity', 'criticalReputation',
  'professionalism', 'charisma', 'workEthic', 'negotiation', 'mediaSkill',
] as const;
export type MainAttribute = (typeof MAIN_ATTRIBUTES)[number];

export type Attributes = Record<MainAttribute, number>;
export type GenreSkills = Record<Genre, number>;

export type Gender = 'male' | 'female' | 'nonbinary';

export type Background =
  | 'Film Student' | 'Theater Actor' | 'Child Actor' | 'Model' | 'Comedian'
  | 'Social Media Personality' | 'Athlete' | 'Complete Unknown';

export type Archetype =
  | 'Jack of All Trades' | 'Action Hero' | 'Dramatic Performer' | 'Comedian' | 'Romantic Lead'
  | 'Method Actor' | 'Character Actor' | 'Blockbuster Star' | 'Indie Darling';

export type RoleType = 'Extra' | 'Minor' | 'Supporting' | 'Co-Lead' | 'Lead' | 'Main Protagonist';

export const BUDGET_TIERS = ['Micro Indie', 'Indie', 'Small Studio', 'Medium', 'Large', 'Tentpole'] as const;
export type BudgetTier = (typeof BUDGET_TIERS)[number];

export type StudioIdentity = 'blockbuster' | 'prestige' | 'comedy' | 'mainstream' | 'indie' | 'genre';

/** Fuzzy bands shown to the player instead of hidden numbers. */
export type EstimateBand = 'Very Low' | 'Low' | 'Low–Moderate' | 'Moderate' | 'Moderate–High' | 'High' | 'Very High';

// ---------------------------------------------------------------------------
// Entity schemas (Dexie tables). Every record carries `universeId`.
// ---------------------------------------------------------------------------

export interface FilmCredit {
  movieId: Id;
  characterName: string;
  roleType: RoleType;
  salary: number;
  /** Performance axis (1–5). Set when production wraps. */
  performance?: PerformanceResult;
  /** Age when the film's run resolved. */
  ageAtRelease?: number;
  /** Absent for a completed shoot; 'cancelled' when the production collapsed before cameras rolled. */
  status?: 'cancelled';
  /** Bonuses + points paid at run end (player credits only; NPCs are paid flat). */
  backend?: number;
}

/** Credits that count as experience (a collapsed production is a story, not a film). */
export function completedCredits(p: { filmography: FilmCredit[] }): FilmCredit[] {
  return p.filmography.filter((f) => f.status !== 'cancelled');
}

export interface Person {
  id: Id;
  universeId: Id;
  firstName: string;
  lastName: string;
  gender: Gender;
  /** Absolute week index of birth (can be negative relative to the universe epoch). */
  birthWeek: number;
  isPlayer: boolean;
  status: 'active' | 'retired';
  background: Background;
  archetype: Archetype;
  attributes: Attributes;
  genres: GenreSkills;
  energy: number; // 0–100
  stress: number; // 0–100
  cash: number;
  careerEarnings: number;
  xp: number;
  level: number;
  momentum: number; // -100..100
  filmography: FilmCredit[];
  /** Hidden NPC trajectory: peak potential (caps acting/star growth) and career swinginess. */
  ceiling: number;
  volatility: number;
  /** Week the career started; the cohort ("class of") is derived from it. */
  startWeek: number;
  /** Last week the person was on a set (drives inactivity decay + retirement). */
  lastWorkedWeek: number;
  peakStarPower: number;
  retiredWeek?: number;
  /** Movie ids the person is currently attached to (cast, not yet resolved). */
  activeMovieIds: Id[];
  /** Representation (player only in Phase 3). */
  agentId?: Id;
  /** Bonuses + points paid out at run end, net of commission (player). */
  backendEarnings: number;
  /** Every audition the player was scored against a named competitor: the raw material for rivalries. */
  headToHead: HeadToHeadRecord[];
  /** Running history for the profile page: worldwide gross of every released credit, and the critic average. */
  cumulativeGross: number;
  reviewCount: number;
  /** Mean critic score across released films (undefined until the first one). */
  reviewAvg?: number;
}

export interface HeadToHeadRecord {
  personId: Id;
  week: number;
  movieId: Id;
  roleType: RoleType;
  /** Did the player out-read this competitor in the room? */
  won: boolean;
}

export interface Studio {
  id: Id;
  universeId: Id;
  name: string;
  identity: StudioIdentity;
  description: string;
  reputation: number; // 0–100
  /** Trust in the player; drives future offers. */
  playerRelationship: number; // 0–100
  /** Films the studio aims to greenlight per year. */
  slateTarget: number;
  /** Films greenlit in the current calendar year. */
  greenlitThisYear: number;
  /** How the studio remembers dealing with the player: 50 neutral; lower = they open lower and walk sooner. */
  dealTemper: number; // 0–100
  /** Per-film record, appended when each film's run resolves (basis for studio profiles later). */
  filmLog: StudioFilmLogEntry[];
}

export interface StudioFilmLogEntry {
  movieId: Id;
  week: number;
  verdict: Verdict;
  worldwide: number;
  budget: number;
  playerInCast: boolean;
  /** Change to the studio's trust in the player from this film (0 when the player wasn't in it). */
  playerTrustDelta: number;
}

export interface Director {
  id: Id;
  universeId: Id;
  firstName: string;
  lastName: string;
  birthWeek: number;
  status: 'active' | 'retired';
  overall: number; // 0–100
  prestige: number; // 0–100
  genreSpecialty: Genre[];
  actorDevelopment: number; // 0–100, how much they lift performances
  boxOfficeRecord: number; // 0–100
  playerRelationship: number; // 0–100
  filmIds: Id[];
  /** Per-film record, appended when each film's run resolves (the director's filmography). */
  credits: DirectorCredit[];
  lastWorkedWeek: number;
  /** Movie id currently attached to (a director shoots one film at a time). */
  activeMovieId?: Id;
}

export interface DirectorCredit {
  movieId: Id;
  week: number;
  verdict: Verdict;
  worldwide: number;
  criticScore: number;
  recoup: number;
}

export interface Role {
  id: Id;
  characterName: string;
  roleType: RoleType;
  genderPref: Gender | 'any';
  ageMin: number;
  ageMax: number;
  requiredActing: number;
  difficulty: number; // 0–100
  /** Base salary for an unknown; casting scales it with star power. */
  salary: number;
  castPersonId?: Id;
}

export interface CastEntry {
  personId: Id;
  roleId: Id;
  characterName: string;
  roleType: RoleType;
  billing: number; // 1 = top billed
  salary: number;
  /** Negotiated terms (player only); NPCs are paid `salary` flat. */
  contract?: ContractTerms;
  /** Set when production wraps. */
  performance?: PerformanceResult;
}

export type MovieStatus =
  | 'casting' | 'pre-production' | 'filming' | 'post-production' | 'released' | 'completed' | 'cancelled';

/** Why this week went the way it did — the result screen turns these into sentences. */
export type WeekNoteKind =
  | 'opened_first' | 'opened_behind' | 'grew' | 'held' | 'crushed' | 'collapsed' | 'holiday' | 'breathed' | 'dropped' | 'viral';

export interface WeekNote {
  kind: WeekNoteKind;
  /** The rival that shaped the week (opened ahead, or crushed this film). */
  rivalId?: Id;
  /** Name of the holiday window that lifted the week. */
  window?: string;
}

export type WomBand = 'building' | 'strong' | 'fading' | 'toxic';

export interface BoxOfficeWeek {
  week: number; // absolute week index
  domestic: number;
  international: number;
  /** Domestic rank that week (1 = #1), assigned once every film's week is in. */
  rank?: number;
  /** Word of mouth as the public sees it that week. */
  wom?: WomBand;
  note?: WeekNote;
}

export type Verdict =
  | 'Disaster' | 'Flop' | 'Average' | 'Hit' | 'Super Hit' | 'Blockbuster' | 'All-Time Blockbuster';

export type BoxOfficeTag = 'Sleeper' | 'Cult seed' | 'Beat expectations' | 'Missed expectations' | 'Viral';

export interface BoxOfficeRun {
  weeks: BoxOfficeWeek[];
  openingDomestic: number;
  openingInternational: number;
  totalDomestic: number;
  totalInternational: number;
  worldwide: number;
  finished: boolean;
  verdict?: Verdict;
  /** Hidden word-of-mouth stat (0–100); the player only ever sees `weeks[i].wom`. */
  wom: number;
  /** What the opening "should" have been from fundamentals alone (no luck) — the basis for Beat/Missed. */
  expectedOpening: number;
  /** Domestic rank on opening week. */
  openingRank?: number;
  /** 1-based index of the biggest domestic week (a sleeper peaks after week 1). */
  peakWeek: number;
  /** Set when the run finishes: the truth behind the verdict. */
  theatricalTake?: number;
  afterlife?: number;
  recoup?: number;
  profit?: number;
  tags?: BoxOfficeTag[];
}

/** A tracking report the week before release: the studio's estimate of the domestic opening. */
export interface TrackingReport {
  week: number;
  low: number;
  high: number;
}

export type Campaign = 'heavy' | 'modest' | 'minimal';

export type MovieType = 'live-action' | 'animation';
export type MovieRating = 'G' | 'PG' | 'PG-13' | 'R';

export interface ReviewSnippet {
  outlet: string;
  text: string;
}

export interface MovieReviews {
  critics: ReviewSnippet[];
  audience: string;
}

export interface Movie {
  id: Id;
  universeId: Id;
  title: string;
  genres: Genre[];
  studioId: Id;
  directorId: Id;
  budget: number;
  marketingBudget: number;
  budgetTier: BudgetTier;
  roles: Role[];
  cast: CastEntry[];
  status: MovieStatus;
  announcedWeek: number;
  castingCloseWeek: number;
  productionStartWeek: number;
  productionWeeks: number;
  /** Weeks the shoot has waited for a cast member (the player) who was on another set. */
  holdWeeks?: number;
  /** Set when a production falls apart before cameras roll. */
  cancelledWeek?: number;
  cancelledReason?: string;
  /** Set when production wraps. */
  wrapWeek?: number;
  /** Claimed on the release calendar at wrap; can move if a bigger rival lands on it. */
  releaseWeek?: number;
  /** Times the studio moved the date (each one comes with a news line). */
  dateMoves?: number;
  /** Metadata for the movie profile page. */
  type: MovieType;
  rating: MovieRating;
  runtime: number; // minutes
  plotArc: string;
  plot: string;
  /** Hidden truths the player only sees as bands. */
  hidden: {
    scriptQuality: number; // 0–100
    audienceAppeal: number; // 0–100
    commercialPotential: number; // 0–100
  };
  /** Accumulated on-set quality modifiers (events, troubled shoots). */
  productionQualityMod: number;
  /** Movie Quality axis (Q). Set when production wraps. */
  quality?: QualityResult;
  /** Critic and audience snippets, written on release. */
  reviews?: MovieReviews;
  /** The week before release (player films only). */
  tracking?: TrackingReport;
  boxOffice?: BoxOfficeRun;
}

// ---------------------------------------------------------------------------
// The three axes
// ---------------------------------------------------------------------------

export type PerformanceScore = 1 | 2 | 3 | 4 | 5;
export const PERFORMANCE_LABELS: Record<PerformanceScore, string> = {
  1: 'Mediocre', 2: 'Above Average', 3: 'Good', 4: 'Great', 5: 'All-Time',
};

export interface PerformanceResult {
  score: PerformanceScore;
  label: string;
  /** Raw 0–100 evaluation behind the score. */
  raw: number;
  /** Fundamentals-only component (what gates the top tiers). */
  fundamentals: number;
  notes: string[];
}

export type QualityBand = 'Poor' | 'Mediocre' | 'Solid' | 'Good' | 'Excellent' | 'Masterpiece';

export interface QualityResult {
  q: number; // 0–100 hidden
  band: QualityBand;
  criticScore: number; // 0–100
  audienceScore: number; // 0–100
  notes: string[];
}

export interface StatDelta {
  target: string; // e.g. 'starPower', 'genre:Drama', 'momentum', 'studio:st-titan', 'director:d-holt'
  label: string;
  amount: number;
}

export interface MovieResult {
  movieId: Id;
  title: string;
  characterName: string;
  roleType: RoleType;
  performance: PerformanceResult;
  quality: QualityResult;
  boxOffice: BoxOfficeRun;
  impacts: { fromPerformance: StatDelta[]; fromQuality: StatDelta[]; fromCommercial: StatDelta[] };
  headline: string;
  weekResolved: number;
}

// ---------------------------------------------------------------------------
// Agents & contracts
// ---------------------------------------------------------------------------

export interface Agent {
  id: Id;
  firstName: string;
  lastName: string;
  agency: string;
  /** 1 boutique … 5 elite. */
  level: number;
  connections: number; // 0–100
  negotiation: number; // 0–100
  commission: number; // fraction, e.g. 0.1
  specialization: Genre | 'general';
  /** Won't represent anyone below this star power. */
  minStarPower: number;
}

export interface BonusTier {
  /** Worldwide gross as a multiple of production budget. */
  multiple: number;
  amount: number;
}

export interface ContractTerms {
  baseSalary: number;
  bonuses: BonusTier[];
  /** Percent of worldwide gross from dollar one. */
  grossPoints: number;
  /** Percent of "net profit" — Hollywood accounting; pays close to nothing. */
  netPoints: number;
  /** 1 = top billed. */
  billing: number;
  sequelOption: boolean;
  /** Locked rate for a sequel if the option is exercised. */
  sequelOptionRate?: number;
  promoWeeks: number;
  payOrPlay: boolean;
}

export type CounterMove = 'higher_salary' | 'backend' | 'top_billing' | 'drop_sequel' | 'pay_or_play';
export type StudioResponse = 'accepted' | 'countered' | 'held' | 'withdrew';

export interface NegotiationEvent {
  round: number;
  move: CounterMove;
  response: StudioResponse;
  text: string;
}

export interface ContractOffer {
  terms: ContractTerms;
  original: ContractTerms;
  round: number;
  maxRounds: number;
  /** Hidden: how much the studio will put up with before walking (0–100). */
  patience: number;
  /** Hidden: the player's bargaining strength (0–100). */
  leverage: number;
  status: 'open' | 'accepted' | 'withdrawn' | 'declined';
  log: NegotiationEvent[];
  /** What your agent thinks the room is like (accuracy depends on the agent). */
  agentRead: string;
  /** Moves already used (each can be pushed once). */
  used: CounterMove[];
}

export interface ContractPayout {
  bonus: number;
  gross: number;
  net: number;
  commission: number;
  /** What actually lands in the player's account. */
  total: number;
}

// ---------------------------------------------------------------------------
// Hot state: auditions, production, weekly plan
// ---------------------------------------------------------------------------

export interface AuditionListing {
  id: Id;
  movieId: Id;
  roleId: Id;
  characterName: string;
  roleType: RoleType;
  expectedSalary: number;
  difficulty: number; // 0–100
  requiredActing: number; // 0–100
  preferredGenre: Genre;
  estimatedPrestige: EstimateBand;
  estimatedCommercial: EstimateBand;
  /** NPC person ids on the shortlist for the role — the real competition. */
  competitorIds: Id[];
  postedWeek: number;
  expiresWeek: number;
  /** The player read the script: bands are near-exact and the audition gets a small edge. */
  scriptRead?: boolean;
}

export type PrepChoice =
  | 'Study Character' | 'Practice Scene' | 'Work With Acting Coach'
  | 'Research Genre' | 'Physical Preparation' | 'Do Nothing';

export type ApplicationStatus =
  | 'applied' | 'no_callback' | 'audition_pending' | 'offer' | 'rejected'
  | 'booked' | 'in_production' | 'declined' | 'expired';

export interface CompetitorScore {
  personId: Id;
  name: string;
  acting: number;
  starPower: number;
  score: number;
}

export interface Application {
  listingId: Id;
  movieId: Id;
  roleId: Id;
  /** Denormalised so history still reads well after the listing leaves the board. */
  movieTitle: string;
  characterName: string;
  roleType: RoleType;
  appliedWeek: number;
  status: ApplicationStatus;
  /** How the role came: auditioned for, or offered outright. */
  source: 'audition' | 'direct';
  /** The deal on the table (set when the status becomes `offer`). */
  contract?: ContractOffer;
  /** Chosen during the audition week; resolved at End Week. */
  prep?: PrepChoice;
  auditionWeek?: number;
  auditionScore?: number;
  directorReaction?: string;
  competitorScores?: CompetitorScore[];
  offerExpiresWeek?: number;
  /** Prep bonus carried into the production if booked. */
  prepBonus?: number;
}

export interface ProductionEvent {
  week: number; // production week (1-based)
  title: string;
  description: string;
  performanceMod: number;
  qualityMod: number;
  energyMod: number;
  stressMod: number;
}

export interface Production {
  movieId: Id;
  roleId: Id;
  characterName: string;
  roleType: RoleType;
  salary: number;
  currentWeek: number; // 0 before first week ticks
  totalWeeks: number;
  events: ProductionEvent[];
  performanceMod: number;
  qualityMod: number;
  prepBonus: number;
}

export type DayJobId = 'cafe' | 'bar' | 'warehouse';

export type PlannedAction =
  | { type: 'rest' }
  | { type: 'acting_class' }
  | { type: 'genre_training'; genre: Genre }
  | { type: 'prepare_role' }
  | { type: 'read_script'; listingId: Id }
  | { type: 'apply'; listingId: Id };

export type TimelineCategory =
  | 'time' | 'training' | 'audition' | 'casting' | 'contract' | 'agent' | 'production' | 'release' | 'box_office' | 'result' | 'finance' | 'industry' | 'news';

export interface TimelineEvent {
  week: number;
  category: TimelineCategory;
  title: string;
  description: string;
}

/** Hot-state timeline is capped; full history lives on the entities. */
export const TIMELINE_CAP = 1500;

export interface GameState {
  saveVersion: number;
  universeId: Id;
  worldSeed: number;
  /** Absolute week index since the universe epoch (week 0 = first week of `epochYear`). */
  week: number;
  epochYear: number;
  player: Person;
  actionsPerWeek: number;
  weekPlan: PlannedAction[];
  /** Open listings on the audition board (roles in movies currently casting). */
  listings: AuditionListing[];
  applications: Application[];
  activeProduction: Production | null;
  /** Movies the player is attached to that are in post-production or released. */
  trackedMovieIds: Id[];
  pendingResults: MovieResult[];
  weeklyReport: TimelineEvent[];
  timeline: TimelineEvent[];
  weeklyExpenses: number;
  /** Standing part-time work between shoots; null when the player has quit. */
  dayJob: DayJobId | null;
  /** Counter so procedurally generated ids stay unique and seeds stable. */
  genCounter: number;
  /** The agent roster for this universe (small; lives in hot state). */
  agents: Agent[];
  /** Agents currently offering to represent the player. */
  agentApproaches: Id[];
  /** How in fashion each genre is right now (1 = normal); random-walks over the years. */
  genreTrends: Record<Genre, number>;
  /** Box-office records: all-time and per calendar year. */
  records: BoxOfficeRecords;
}

export interface RecordEntry {
  movieId: Id;
  title: string;
  amount: number;
  week: number;
}

export interface RecordSet {
  opening?: RecordEntry;
  gross?: RecordEntry;
  /** Amount = estimated loss. */
  bomb?: RecordEntry;
}

export interface BoxOfficeRecords {
  allTime: RecordSet;
  byYear: Record<number, RecordSet>;
}

/**
 * The in-memory working set of cold entities the tick operates on.
 * Loaded by SaveEngine before the tick, deltas persisted after.
 */
export interface WorkingSet {
  people: Map<Id, Person>;
  movies: Map<Id, Movie>;
  studios: Map<Id, Studio>;
  directors: Map<Id, Director>;
  /** Ids touched this tick, for delta writes. */
  dirty: { people: Set<Id>; movies: Set<Id>; studios: Set<Id>; directors: Set<Id> };
}

export function createWorkingSet(): WorkingSet {
  return {
    people: new Map(),
    movies: new Map(),
    studios: new Map(),
    directors: new Map(),
    dirty: { people: new Set(), movies: new Set(), studios: new Set(), directors: new Set() },
  };
}

export function markDirty(ws: WorkingSet, table: keyof WorkingSet['dirty'], id: Id): void {
  ws.dirty[table].add(id);
}

export function clearDirty(ws: WorkingSet): void {
  ws.dirty.people.clear();
  ws.dirty.movies.clear();
  ws.dirty.studios.clear();
  ws.dirty.directors.clear();
}

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
