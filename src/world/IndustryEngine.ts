/**
 * IndustryEngine — bootstraps the fictional industry.
 *
 * The opening universe is procedural: six studios with identities, a named core of directors and
 * actors (so early careers have familiar faces to chase), and tiers of generated talent around
 * them. The world then runs on its own for a year of "prehistory" before the player enters
 * (see Game.create), so theaters, slates and shortlists are already alive at week 1.
 */
import { type Director, type Id, type Person, type Studio, type StudioIdentity } from '../core/GameState';
import { generateActor, type NpcTier } from '../sim/NPCEngine';
import { generateDirector, type DirectorTier } from './DirectorEngine';

interface StudioSpec { id: string; name: string; identity: StudioIdentity; description: string; reputation: number; slateTarget: number }
const STUDIOS: StudioSpec[] = [
  { id: 'st-titan', name: 'Titan Pictures', identity: 'blockbuster', description: 'Huge blockbuster studio.', reputation: 82, slateTarget: 8 },
  { id: 'st-evergreen', name: 'Evergreen Films', identity: 'prestige', description: 'Prestige dramas and awards contenders.', reputation: 78, slateTarget: 7 },
  { id: 'st-laughtrack', name: 'LaughTrack Studios', identity: 'comedy', description: 'Comedy specialist.', reputation: 62, slateTarget: 8 },
  { id: 'st-northstar', name: 'Northstar Entertainment', identity: 'mainstream', description: 'Mid-budget mainstream films.', reputation: 68, slateTarget: 12 },
  { id: 'st-horizon', name: 'Horizon Indie', identity: 'indie', description: 'Independent films on tight budgets.', reputation: 55, slateTarget: 20 },
  { id: 'st-redline', name: 'Redline Pictures', identity: 'genre', description: 'Horror, thrillers and genre fare.', reputation: 58, slateTarget: 10 },
];

interface DirectorSpec { id: string; first: string; last: string; age: number; overall: number; prestige: number; specialty: Director['genreSpecialty']; actorDev: number; boxOffice: number }
const NAMED_DIRECTORS: DirectorSpec[] = [
  { id: 'd-holt', first: 'James', last: 'Holt', age: 46, overall: 74, prestige: 60, specialty: ['Action', 'Thriller'], actorDev: 50, boxOffice: 72 },
  { id: 'd-okafor', first: 'Amara', last: 'Okafor', age: 51, overall: 81, prestige: 84, specialty: ['Drama', 'Historical'], actorDev: 82, boxOffice: 48 },
  { id: 'd-lindqvist', first: 'Sven', last: 'Lindqvist', age: 44, overall: 66, prestige: 58, specialty: ['Horror', 'Thriller'], actorDev: 45, boxOffice: 60 },
  { id: 'd-reyes', first: 'Camila', last: 'Reyes', age: 39, overall: 70, prestige: 66, specialty: ['Comedy', 'Romance'], actorDev: 64, boxOffice: 58 },
  { id: 'd-park', first: 'Daniel', last: 'Park', age: 33, overall: 58, prestige: 40, specialty: ['Drama', 'Mystery'], actorDev: 55, boxOffice: 30 },
  { id: 'd-marsh', first: 'Tobias', last: 'Marsh', age: 36, overall: 52, prestige: 35, specialty: ['Horror', 'Comedy'], actorDev: 38, boxOffice: 42 },
];

interface NpcSpec {
  id: string; first: string; last: string; gender: Person['gender']; age: number;
  acting: number; star: number; charisma?: number; genres: Partial<Person['genres']>;
  archetype: Person['archetype']; ceiling: number; volatility: number;
}
/** The player's cohort (peers) plus a few established names who anchor bigger casts. */
const NAMED_NPCS: NpcSpec[] = [
  { id: 'p-reed', first: 'Marcus', last: 'Reed', gender: 'male', age: 23, acting: 44, star: 30, charisma: 55, genres: { Drama: 46, Action: 40, Romance: 42 }, archetype: 'Blockbuster Star', ceiling: 92, volatility: 40 },
  { id: 'p-king', first: 'Leo', last: 'King', gender: 'male', age: 24, acting: 52, star: 14, genres: { Drama: 58, Crime: 50, Mystery: 44 }, archetype: 'Method Actor', ceiling: 85, volatility: 30 },
  { id: 'p-nair', first: 'Priya', last: 'Nair', gender: 'female', age: 22, acting: 47, star: 22, genres: { Romance: 52, Comedy: 45, Drama: 44 }, archetype: 'Romantic Lead', ceiling: 80, volatility: 35 },
  { id: 'p-whitfield', first: 'Jonah', last: 'Whitfield', gender: 'male', age: 26, acting: 38, star: 35, charisma: 60, genres: { Action: 42, Thriller: 38 }, archetype: 'Action Hero', ceiling: 70, volatility: 50 },
  { id: 'p-castellano', first: 'Sofia', last: 'Castellano', gender: 'female', age: 21, acting: 41, star: 18, genres: { Horror: 46, Thriller: 40 }, archetype: 'Jack of All Trades', ceiling: 75, volatility: 45 },
  { id: 'p-boone', first: 'Derek', last: 'Boone', gender: 'male', age: 25, acting: 33, star: 12, genres: { Comedy: 36, Drama: 32 }, archetype: 'Character Actor', ceiling: 60, volatility: 25 },
  { id: 'p-ito', first: 'Hana', last: 'Ito', gender: 'female', age: 24, acting: 55, star: 10, genres: { Drama: 62, Historical: 50, Mystery: 48 }, archetype: 'Indie Darling', ceiling: 88, volatility: 20 },
  { id: 'p-banks', first: 'Tyrell', last: 'Banks', gender: 'male', age: 22, acting: 36, star: 40, charisma: 65, genres: { Comedy: 48, Action: 35 }, archetype: 'Comedian', ceiling: 78, volatility: 60 },
  { id: 'p-voss', first: 'Elena', last: 'Voss', gender: 'female', age: 23, acting: 49, star: 26, genres: { Drama: 52, Romance: 48, Thriller: 42 }, archetype: 'Dramatic Performer', ceiling: 84, volatility: 30 },
  { id: 'p-delgado', first: 'Sam', last: 'Delgado', gender: 'nonbinary', age: 22, acting: 42, star: 15, genres: { Comedy: 50, Family: 44, Drama: 38 }, archetype: 'Jack of All Trades', ceiling: 72, volatility: 40 },
  { id: 'p-hale', first: 'Victoria', last: 'Hale', gender: 'female', age: 34, acting: 78, star: 72, genres: { Drama: 84, Historical: 76, Romance: 70 }, archetype: 'Dramatic Performer', ceiling: 90, volatility: 15 },
  { id: 'p-blake', first: 'Ronan', last: 'Blake', gender: 'male', age: 38, acting: 70, star: 80, charisma: 75, genres: { Action: 82, Thriller: 78, Crime: 72 }, archetype: 'Action Hero', ceiling: 86, volatility: 20 },
  { id: 'p-ferreira', first: 'Nadia', last: 'Ferreira', gender: 'female', age: 29, acting: 74, star: 58, charisma: 70, genres: { Comedy: 80, Romance: 74, Drama: 66 }, archetype: 'Comedian', ceiling: 84, volatility: 25 },
];

/** Generated talent around the named core, by tier. */
const ACTOR_FILL: { tier: NpcTier; count: number }[] = [
  { tier: 'unknown', count: 26 }, { tier: 'working', count: 22 }, { tier: 'recognizable', count: 14 }, { tier: 'star', count: 8 }, { tier: 'superstar', count: 3 },
];
const DIRECTOR_FILL: { tier: DirectorTier; count: number }[] = [
  { tier: 'new', count: 7 }, { tier: 'working', count: 11 }, { tier: 'established', count: 7 }, { tier: 'elite', count: 3 },
];

/** Rebuild a studio row from its template (studio ids are fixed, so a lost row can be restored exactly). */
export function studioFromTemplate(universeId: Id, id: Id): Studio | undefined {
  const s = STUDIOS.find((t) => t.id === id);
  if (!s) return undefined;
  return { id: s.id, universeId, name: s.name, identity: s.identity, description: s.description, reputation: s.reputation, playerRelationship: 50, slateTarget: s.slateTarget, greenlitThisYear: 0, dealTemper: 50, filmLog: [] };
}

export interface UniverseSeed {
  studios: Studio[];
  directors: Director[];
  people: Person[];
  /** Next value for GameState.genCounter. */
  genCounter: number;
}

/** Build the opening universe (no movies yet — prehistory ticks create them). Deterministic per worldSeed. */
export function seedUniverse(universeId: Id, worldSeed: number, week: number): UniverseSeed {
  const studios: Studio[] = STUDIOS.map((s) => ({
    id: s.id, universeId, name: s.name, identity: s.identity, description: s.description,
    reputation: s.reputation, playerRelationship: 50, slateTarget: s.slateTarget, greenlitThisYear: 0, dealTemper: 50, filmLog: [],
  }));

  const names = new Set<string>();
  let counter = 0;

  const directors: Director[] = NAMED_DIRECTORS.map((d) =>
    generateDirector(universeId, worldSeed, week, d.id, 'working', names, {
      firstName: d.first, lastName: d.last, ageYears: d.age, overall: d.overall, prestige: d.prestige,
      specialty: d.specialty, actorDevelopment: d.actorDev, boxOfficeRecord: d.boxOffice,
    }),
  );
  for (const fill of DIRECTOR_FILL) {
    for (let i = 0; i < fill.count; i++) {
      counter += 1;
      directors.push(generateDirector(universeId, worldSeed, week, `d-seed-${counter}`, fill.tier, names));
    }
  }

  const people: Person[] = NAMED_NPCS.map((n) =>
    generateActor(universeId, worldSeed, week, n.id, 'working', names, {
      firstName: n.first, lastName: n.last, gender: n.gender, ageYears: n.age, acting: n.acting, starPower: n.star,
      charisma: n.charisma, genres: n.genres, archetype: n.archetype, ceiling: n.ceiling, volatility: n.volatility,
    }),
  );
  for (const fill of ACTOR_FILL) {
    for (let i = 0; i < fill.count; i++) {
      counter += 1;
      people.push(generateActor(universeId, worldSeed, week, `p-seed-${counter}`, fill.tier, names));
    }
  }

  return { studios, directors, people, genCounter: counter };
}
