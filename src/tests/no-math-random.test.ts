import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|svelte)$/.test(name) && !full.includes(`${join('src', 'tests')}`)) out.push(full);
  }
  return out;
}

describe('Discipline — no Math.random anywhere in src/', () => {
  it('every source file routes randomness through the seeded RNG', () => {
    const offenders = walk(join(process.cwd(), 'src')).filter((f) => readFileSync(f, 'utf8').includes('Math.random'));
    expect(offenders).toEqual([]);
  });
});
