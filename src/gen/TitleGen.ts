/**
 * TitleGen — seeded, genre-flavored movie titles, unique per universe.
 */
import type { Genre } from '../core/GameState';
import type { Rng } from '../core/RNG';

interface Vocab { adj: string[]; noun: string[]; place: string[] }

const COMMON: Vocab = {
  adj: ['Last', 'Silent', 'Broken', 'Hollow', 'Northern', 'Midnight', 'Quiet', 'Burning', 'Little', 'Crooked', 'Golden', 'Blue', 'Lost', 'Wild', 'Distant', 'Second', 'Perfect', 'Empty', 'Bright', 'Bitter'],
  noun: ['Road', 'Season', 'Signal', 'Tide', 'Verdict', 'Garden', 'Country', 'Hours', 'Bridge', 'Ledger', 'Harbor', 'Orchard', 'Lanterns', 'Winter', 'River', 'Mirror', 'Door', 'Fire', 'Line', 'Heart', 'Sky', 'House', 'Letter', 'Voice', 'Echo'],
  place: ['Avalon', 'Marrow', 'Halcyon', 'Ashland', 'Redwater', 'Coldbrook', 'Salt Creek', 'Vale', 'Harlow', 'Kessington', 'Brightwater', 'Osprey Bay'],
};

const BY_GENRE: Partial<Record<Genre, Partial<Vocab>>> = {
  Action: { adj: ['Zero', 'Lethal', 'Final', 'Rogue', 'Iron', 'Blackout', 'Steel'], noun: ['Protocol', 'Strike', 'Vengeance', 'Code', 'Ghost', 'Extraction', 'Fury', 'Pursuit', 'Reckoning', 'Siege', 'Gauntlet'] },
  Horror: { adj: ['Hollow', 'Pale', 'Unholy', 'Buried', 'Wicked', 'Cursed'], noun: ['Whisper', 'Basement', 'Cellar', 'Hex', 'Tapes', 'Static', 'Ritual', 'Marrow', 'Lullaby', 'Hunger', 'Vigil', 'Shrine'] },
  Comedy: { adj: ['Awkward', 'Big', 'Perfectly', 'Accidental', 'Terrible', 'Totally'], noun: ['Wedding', 'Roommates', 'Vacation', 'Cousins', 'Bachelor', 'Reunion', 'Office', 'Rental', 'Weekend', 'Kellers', 'Neighbors', 'Divorce'] },
  Drama: { adj: ['Quiet', 'Long', 'Tender', 'Unspoken', 'Faithful'], noun: ['Harbor', 'Season', 'Lanterns', 'Orchard', 'Confession', 'Inheritance', 'Daughters', 'Fathers', 'Vigil', 'Harvest', 'Mercy'] },
  Romance: { adj: ['Almost', 'Nearly', 'Sweet', 'Unlikely'], noun: ['Letters', 'Summer', 'Kiss', 'Proposal', 'Postcards', 'Valentine', 'Honeymoon', 'Slow Dance', 'Serenade'] },
  Thriller: { adj: ['Cold', 'Silent', 'Blind', 'Sleepless'], noun: ['Witness', 'Signal', 'Deadline', 'Alibi', 'Motive', 'Hostage', 'Countdown', 'Descent', 'Blackout'] },
  Crime: { adj: ['Dirty', 'Crooked', 'Low', 'Hard'], noun: ['Ledger', 'Score', 'Heist', 'Shift', 'Precinct', 'Syndicate', 'Racket', 'Collateral', 'Bag Man'] },
  Mystery: { adj: ['Glass', 'Missing', 'Forgotten', 'Vanishing'], noun: ['Orchard', 'Cipher', 'Widow', 'Locket', 'Lighthouse', 'Manor', 'Riddle', 'Archive'] },
  Fantasy: { adj: ['Ember', 'Ashen', 'Eternal', 'Shattered'], noun: ['Kingdom', 'Crown', 'Ashes', 'Dragon', 'Realm', 'Prophecy', 'Sorcerer', 'Throne', 'Relic'], place: ['Avalon', 'Eldermoor', 'Thessaly', 'Ironhold', 'Wyrmfall'] },
  'Science Fiction': { adj: ['Orbital', 'Silent', 'Dark', 'Hyper'], noun: ['Orbit', 'Nova', 'Horizon', 'Colony', 'Singularity', 'Drift', 'Titan', 'Beacon', 'Aurora', 'Vector'] },
  Historical: { adj: ['Imperial', 'Forgotten', 'Sovereign'], noun: ['Empire', 'Crusade', 'Regiment', 'Armistice', 'Dynasty', 'Frontier', 'Ambassador', 'Coronation'] },
  Musical: { adj: ['Electric', 'Neon', 'Velvet'], noun: ['Encore', 'Lights', 'Overture', 'Rhapsody', 'Jukebox', 'Cabaret', 'Chorus'] },
  Sports: { adj: ['Second', 'Final', 'Underdog'], noun: ['Serve', 'Comeback', 'Season', 'Contender', 'Overtime', 'Rookie', 'Ringside', 'Marathon'] },
  Family: { adj: ['Great', 'Big', 'Magic'], noun: ['Puppy', 'Treehouse', 'Summer Camp', 'Robot', 'Dragon', 'Adventure', 'Sleepover', 'Snow Day'] },
  Western: { adj: ['Dusty', 'Red', 'Lonesome'], noun: ['Sundown', 'Dust', 'Outlaw', 'Frontier', 'Gunsmoke', 'Canyon', 'Marshal', 'Prairie'] },
};

function vocabFor(genres: Genre[]): Vocab {
  const v: Vocab = { adj: [...COMMON.adj], noun: [...COMMON.noun], place: [...COMMON.place] };
  for (const g of genres) {
    const extra = BY_GENRE[g];
    if (!extra) continue;
    // Genre words are weighted by repetition so the primary genre colors the title.
    if (extra.adj) v.adj.push(...extra.adj, ...extra.adj);
    if (extra.noun) v.noun.push(...extra.noun, ...extra.noun, ...extra.noun);
    if (extra.place) v.place.push(...extra.place, ...extra.place);
  }
  return v;
}

function pattern(rng: Rng, v: Vocab, genres: Genre[]): string {
  const roll = rng.next();
  const adj = () => rng.pick(v.adj);
  const noun = () => rng.pick(v.noun);
  const place = () => rng.pick(v.place);
  if (roll < 0.22) return `The ${noun()}`;
  if (roll < 0.45) return `${adj()} ${noun()}`;
  if (roll < 0.55) return `${noun()} of ${place()}`;
  if (roll < 0.65) return `${noun()}`;
  if (roll < 0.72) return `The ${adj()} ${noun()}`;
  if (roll < 0.78) return `${place()}`;
  if (roll < 0.86) return `${noun()} & ${noun()}`;
  if (roll < 0.93) return `${adj()} ${noun()}s`;
  if (genres.includes('Action') || genres.includes('Science Fiction')) return `${noun()}: ${adj()} ${noun()}`;
  return `A ${adj()} ${noun()}`;
}

/** A title no other movie in the universe already uses. */
export function generateTitle(rng: Rng, genres: Genre[], taken: Set<string>): string {
  const v = vocabFor(genres);
  for (let attempt = 0; attempt < 60; attempt++) {
    const t = pattern(rng, v, genres);
    if (/(\b\w+\b) & \1$/.test(t)) continue; // "Fire & Fire"
    if (!taken.has(t.toLowerCase())) {
      taken.add(t.toLowerCase());
      return t;
    }
  }
  const t = `${pattern(rng, v, genres)} ${rng.int(2, 9)}`;
  taken.add(t.toLowerCase());
  return t;
}
