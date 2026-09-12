/**
 * ReviewGen — reviews with words. Two critic snippets and one audience line per film, written on
 * release from the Q axis (critic score, audience score, notes), the genre and the director.
 * Seeded on the film; presentation reads them, the box office engine reads only the scores.
 */
import type { Genre, Movie, MovieReviews, WorkingSet } from '../core/GameState';
import { rngFor, type Rng } from '../core/RNG';

const OUTLETS = ['The Ledger', 'Screen Weekly', 'The Marquee', 'Reel Talk', 'The Daily Cut', 'Frame & Focus', 'Cineline', 'The Aisle Seat', 'Popcorn Press', 'The Projectionist'];

const GENRE_NOUN: Record<Genre, string> = {
  Action: 'actioner', Comedy: 'comedy', Drama: 'drama', Romance: 'romance', Horror: 'horror film', Thriller: 'thriller', Crime: 'crime picture',
  Mystery: 'mystery', Fantasy: 'fantasy', 'Science Fiction': 'science-fiction film', Historical: 'period piece', Musical: 'musical', Sports: 'sports movie',
  Family: 'family film', Western: 'western',
};

const RAVE = [
  'A {noun} that earns every minute of its running time.',
  '{director} has made the best {noun} in years — confident, alive, and unexpectedly moving.',
  'Thrilling, funny and sad in the right proportions. A {noun} for the ages.',
  'It shouldn\'t work, and then it does, spectacularly.',
  'Every frame feels chosen. The rare {noun} that trusts its audience.',
];
const GOOD = [
  'A sturdy, well-made {noun} with more on its mind than the trailer suggests.',
  '{director} keeps a firm hand on the wheel; the cast does the rest.',
  'Familiar shape, fresh execution. It goes down easy.',
  'Not quite great, but consistently good — and good is underrated.',
  'A {noun} that knows exactly what it is. Recommended.',
];
const MIXED = [
  'Handsome and hollow. The {noun} looks better than it plays.',
  'Two good scenes and a lot of connective tissue.',
  'The cast works hard to sell a script that keeps changing its mind.',
  'Watchable, forgettable, and about twenty minutes too long.',
  'It has its moments. It also has a second act.',
];
const PAN = [
  'A {noun} assembled rather than directed.',
  'Loud, long and lifeless. {director} seems as bored as we are.',
  'The kind of film that makes you check the runtime twice.',
  'A screenplay in search of a reason to exist.',
  'It wants to be three movies and manages to be none of them.',
];
const AUD_LOVE = ['Saw it twice already. Take everyone you know.', 'The whole theater cheered at the end.', 'Better than the trailers — way better.', 'Didn\'t expect to cry at a {noun}, and yet.'];
const AUD_LIKE = ['Solid night out. Would watch a sequel.', 'Good fun, nothing more, nothing less.', 'Better than I expected, honestly.', 'Worth the ticket, especially on a big screen.'];
const AUD_MEH = ['Fine. Kind of long.', 'The trailer had all the best parts.', 'Wait for streaming.', 'My friends liked it more than I did.'];
const AUD_HATE = ['Walked out with twenty minutes left.', 'Two hours I want back.', 'How did this get made?', 'The popcorn was the highlight.'];

function fill(rng: Rng, pool: string[], noun: string, director: string): string {
  return rng.pick(pool).replace('{noun}', noun).replace('{director}', director);
}

export function generateReviews(worldSeed: number, week: number, movie: Movie, ws: WorkingSet): MovieReviews {
  const rng = rngFor(worldSeed, movie.id, week, 'reviews');
  const d = ws.directors.get(movie.directorId);
  const director = d ? `${d.firstName} ${d.lastName}` : 'The director';
  const noun = GENRE_NOUN[movie.genres[0]];
  const critic = movie.quality?.criticScore ?? 55;
  const audience = movie.quality?.audienceScore ?? 55;
  const pool = critic >= 78 ? RAVE : critic >= 60 ? GOOD : critic >= 42 ? MIXED : PAN;
  // Critics rarely agree: the second voice comes from the neighbouring band.
  const neighbour = critic >= 78 ? GOOD : critic >= 60 ? (rng.chance(0.5) ? RAVE : MIXED) : critic >= 42 ? (rng.chance(0.5) ? GOOD : PAN) : MIXED;
  const outlets = rng.shuffle(OUTLETS);
  const critics = [
    { outlet: outlets[0], text: fill(rng, pool, noun, director) },
    { outlet: outlets[1], text: fill(rng, neighbour, noun, director) },
  ];
  const audPool = audience >= 78 ? AUD_LOVE : audience >= 60 ? AUD_LIKE : audience >= 42 ? AUD_MEH : AUD_HATE;
  return { critics, audience: fill(rng, audPool, noun, director) };
}
