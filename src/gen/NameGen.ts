/**
 * NameGen — seeded people and character names.
 *
 * Pools are deliberately broad so a 40-year universe with ~1,000 actors doesn't repeat itself;
 * uniqueness is enforced against the names already taken in the universe.
 */
import type { Gender } from '../core/GameState';
import type { Rng } from '../core/RNG';

const MALE_FIRST = [
  'Marcus', 'Leo', 'Jonah', 'Derek', 'Tyrell', 'Ronan', 'Caleb', 'Ethan', 'Mateo', 'Idris', 'Julian', 'Theo', 'Rafael',
  'Owen', 'Silas', 'Dominic', 'Elijah', 'Kai', 'Nikolai', 'Andre', 'Felix', 'Gabriel', 'Hugo', 'Isaac', 'Jasper', 'Kenji',
  'Lucas', 'Malik', 'Nathan', 'Oscar', 'Preston', 'Quentin', 'Reuben', 'Sebastian', 'Tobias', 'Uriel', 'Victor', 'Wesley',
  'Xavier', 'Zane', 'Amir', 'Bram', 'Cyrus', 'Dev', 'Emmett', 'Finn', 'Grant', 'Hector', 'Ivan', 'Jude', 'Kofi', 'Lorenzo',
  'Miles', 'Nico', 'Otis', 'Pascal', 'Rhys', 'Soren', 'Tariq', 'Wade', 'Yusuf', 'Adrian', 'Blake', 'Cole', 'Dashiell',
];
const FEMALE_FIRST = [
  'Priya', 'Sofia', 'Hana', 'Elena', 'Victoria', 'Nadia', 'Amara', 'Camila', 'Iris', 'June', 'Lena', 'Maya', 'Noor', 'Olive',
  'Paloma', 'Quinn', 'Rosa', 'Simone', 'Talia', 'Uma', 'Vera', 'Willa', 'Yara', 'Zoe', 'Ada', 'Beatrix', 'Clara', 'Delia',
  'Esme', 'Freya', 'Greta', 'Harper', 'Imani', 'Josephine', 'Keira', 'Leila', 'Margot', 'Nina', 'Ophelia', 'Penelope', 'Ramona',
  'Sadie', 'Tessa', 'Valentina', 'Wren', 'Ximena', 'Yasmin', 'Zara', 'Anika', 'Bianca', 'Celeste', 'Dahlia', 'Eloise', 'Farah',
  'Gemma', 'Helena', 'Ingrid', 'Juno', 'Kenna', 'Lucia', 'Mira', 'Naomi', 'Odette', 'Pilar', 'Rhea', 'Sloane', 'Thea',
];
const NEUTRAL_FIRST = [
  'Sam', 'Alex', 'Riley', 'Jordan', 'Casey', 'Rowan', 'Avery', 'Morgan', 'Sky', 'Emery', 'Reese', 'Sage', 'Dakota', 'Ellis',
  'Arden', 'Blair', 'Devon', 'Finley', 'Hayden', 'Indigo', 'Jules', 'Kit', 'Lane', 'Marlowe', 'Noel', 'Remy', 'Tatum', 'Wren',
];
const LAST = [
  'Reed', 'King', 'Nair', 'Whitfield', 'Castellano', 'Boone', 'Ito', 'Banks', 'Voss', 'Delgado', 'Hale', 'Blake', 'Ferreira',
  'Osborne', 'Holt', 'Okafor', 'Lindqvist', 'Reyes', 'Park', 'Marsh', 'Abernathy', 'Adeyemi', 'Alvarez', 'Ashford', 'Bautista',
  'Beckett', 'Bergström', 'Calloway', 'Carvalho', 'Chen', 'Coleman', 'Dawson', 'DeLuca', 'Dubois', 'Ellington', 'Fairbanks',
  'Fontaine', 'Gallagher', 'Garza', 'Haddad', 'Hartley', 'Hoffman', 'Ibarra', 'Iqbal', 'Jensen', 'Kaplan', 'Kowalski', 'Lambert',
  'Larsen', 'Lowell', 'Mahoney', 'Mendes', 'Mercer', 'Nakamura', 'Navarro', 'Novak', 'Okonkwo', 'Oyelaran', 'Petrov', 'Pham',
  'Quintero', 'Rahman', 'Rasmussen', 'Rivera', 'Rossi', 'Sato', 'Schreiber', 'Sinclair', 'Sterling', 'Sullivan', 'Tanaka',
  'Thornton', 'Torres', 'Underwood', 'Vance', 'Varga', 'Vega', 'Wallace', 'Whitaker', 'Winters', 'Yamada', 'Zimmerman', 'Ashby',
  'Brennan', 'Cruz', 'Donovan', 'Escobar', 'Fielding', 'Greer', 'Hollis', 'Ingram', 'Jemison', 'Kessler', 'Lockhart', 'Moreau',
  'Nwosu', 'Ortega', 'Prescott', 'Radford', 'Salazar', 'Tremblay', 'Ueda', 'Villanueva', 'Waverly', 'Xu', 'Yates', 'Zeller',
];

export interface PersonName { firstName: string; lastName: string }

function firstPool(gender: Gender | 'any', rng: Rng): readonly string[] {
  if (gender === 'male') return rng.chance(0.15) ? NEUTRAL_FIRST : MALE_FIRST;
  if (gender === 'female') return rng.chance(0.15) ? NEUTRAL_FIRST : FEMALE_FIRST;
  if (gender === 'nonbinary') return NEUTRAL_FIRST;
  return rng.pick([MALE_FIRST, FEMALE_FIRST, NEUTRAL_FIRST]);
}

/** A unique full name for a new person. `taken` holds "First Last" strings already in the universe. */
export function generatePersonName(rng: Rng, gender: Gender, taken: Set<string>): PersonName {
  for (let attempt = 0; attempt < 40; attempt++) {
    const firstName = rng.pick(firstPool(gender, rng));
    const lastName = rng.pick(LAST);
    const key = `${firstName} ${lastName}`;
    if (!taken.has(key)) {
      taken.add(key);
      return { firstName, lastName };
    }
  }
  // Pools exhausted for this combination — disambiguate with an initial.
  const firstName = rng.pick(firstPool(gender, rng));
  const lastName = `${rng.pick(LAST)}-${rng.pick(LAST)}`;
  taken.add(`${firstName} ${lastName}`);
  return { firstName, lastName };
}

const CHARACTER_LAST = [
  'Cole', 'Vance', 'Pryce', 'Marlow', 'Ford', 'Dunn', 'Vale', 'Cross', 'Pike', 'Harper', 'Tate', 'Lane', 'Kessler', 'Adler',
  'Quill', 'Drake', 'Hart', 'Stone', 'Frost', 'Rook', 'Sloan', 'Kane', 'Locke', 'Wolfe', 'Mercer', 'Keller', 'Lowe', 'Rhodes',
];
const TITLES = ['Det.', 'Dr.', 'Capt.', 'Sgt.', 'Agent', 'Coach', 'Professor', 'Father', 'Sister', 'Judge'];

/** A character name for a role. Leads get full names; smaller parts are often just a first name or a title. */
export function generateCharacterName(rng: Rng, gender: Gender | 'any', roleSize: 'lead' | 'supporting' | 'minor'): string {
  const first = rng.pick(firstPool(gender, rng));
  if (roleSize === 'lead') return `${first} ${rng.pick(CHARACTER_LAST)}`;
  if (roleSize === 'supporting') return rng.chance(0.6) ? `${first} ${rng.pick(CHARACTER_LAST)}` : first;
  if (rng.chance(0.25)) return `${rng.pick(TITLES)} ${rng.pick(CHARACTER_LAST)}`;
  return first;
}
