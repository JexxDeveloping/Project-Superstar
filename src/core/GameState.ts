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
  lastWorkedWeek: number;
  /** Movie id currently attached to (a director shoots one film at a time). */
  activeMovieId?: Id;
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
  /** Set when production wraps. */
  performance?: PerformanceResult;
}

export type MovieStatus =
  | 'casting' | 'pre-production' | 'filming' | 'post-production' | 'released' | 'completed';

export interface BoxOfficeWeek {
  week: number; // absolute week index
  domestic: number;
  international: number;
}

export type Verdict =
  | 'Disaster' | 'Flop' | 'Average' | 'Hit' | 'Super Hit' | 'Blockbuster' | 'All-Time Blockbuster';

export interface BoxOfficeRun {
  weeks: BoxOfficeWeek[];
  openingDomestic: number;
  openingInternational: number;
  totalDomestic: number;
  totalInternational: number;
  worldwide: number;
  finished: boolean;
  verdict?: Verdict;
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
  /** Set when production wraps. */
  wrapWeek?: number;
  releaseWeek?: number;
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

export type PlannedAction =
  | { type: 'rest' }
  | { type: 'acting_class' }
  | { type: 'genre_training'; genre: Genre }
  | { type: 'prepare_role' }
  | { type: 'apply'; listingId: Id };

export type TimelineCategory =
  | 'time' | 'training' | 'audition' | 'casting' | 'production' | 'release' | 'box_office' | 'result' | 'finance' | 'industry';

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
  /** Counter so procedurally generated ids stay unique and seeds stable. */
  genCounter: number;
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
