import { describe, expect, it } from 'vitest';
import { afterlifeRate, recoupmentFor, verdictFor, VERDICT_LADDER } from '../industry/BoxOfficeEngine';

describe('BoxOfficeEngine — recoupment verdict (Part 3 resolved note)', () => {
  it('maps the agreed cutoffs on recoup', () => {
    expect(verdictFor(0)).toBe('Disaster');
    expect(verdictFor(0.399)).toBe('Disaster');
    expect(verdictFor(0.40)).toBe('Flop');
    expect(verdictFor(0.749)).toBe('Flop');
    expect(verdictFor(0.75)).toBe('Average');
    expect(verdictFor(1.099)).toBe('Average');
    expect(verdictFor(1.10)).toBe('Hit');
    expect(verdictFor(1.499)).toBe('Hit');
    expect(verdictFor(1.50)).toBe('Super Hit');
    expect(verdictFor(1.999)).toBe('Super Hit');
    expect(verdictFor(2.00)).toBe('Blockbuster');
    expect(verdictFor(2.999)).toBe('Blockbuster');
    expect(verdictFor(3.00)).toBe('All-Time Blockbuster');
  });

  it('All-Time Blockbuster also needs the era gate; without it the film is a Blockbuster', () => {
    expect(verdictFor(3.5, 400_000_000, 500_000_000)).toBe('Blockbuster');
    expect(verdictFor(3.5, 500_000_000, 500_000_000)).toBe('All-Time Blockbuster');
    expect(verdictFor(2.5, 900_000_000, 100_000_000)).toBe('Blockbuster'); // ratio short, gate irrelevant
  });

  it('is a strict, non-overlapping ladder', () => {
    for (let i = 1; i < VERDICT_LADDER.length; i++) expect(VERDICT_LADDER[i - 1].min).toBeGreaterThan(VERDICT_LADDER[i].min);
    expect(VERDICT_LADDER[VERDICT_LADDER.length - 1].min).toBe(0);
  });

  it('theatrical take is 50% domestic / 40% international, over budget + marketing', () => {
    const movie = { budget: 100, marketingBudget: 100, genres: ['Thriller' as const] };
    const r = recoupmentFor({ totalDomestic: 200, totalInternational: 100, worldwide: 300 }, movie, 60);
    expect(r.theatricalTake).toBeCloseTo(140, 6);
    expect(r.afterlife).toBeCloseTo(90, 6); // 0.30 base at audience 60, no genre adjustment
    expect(r.recoup).toBeCloseTo(1.15, 6);
    expect(r.profit).toBeCloseTo(30, 6);
  });

  it('afterlife flexes with audience score and genre, clamped 0.10–0.50', () => {
    expect(afterlifeRate({ genres: ['Thriller'] }, 60)).toBeCloseTo(0.30, 6);
    expect(afterlifeRate({ genres: ['Thriller'] }, 90)).toBeCloseTo(0.45, 6);
    expect(afterlifeRate({ genres: ['Thriller'] }, 30)).toBeCloseTo(0.15, 6);
    expect(afterlifeRate({ genres: ['Family'] }, 60)).toBeCloseTo(0.38, 6);
    expect(afterlifeRate({ genres: ['Historical'] }, 60)).toBeCloseTo(0.25, 6);
    expect(afterlifeRate({ genres: ['Family'] }, 100)).toBeLessThanOrEqual(0.50);
    expect(afterlifeRate({ genres: ['Western'] }, 0)).toBeGreaterThanOrEqual(0.10);
  });

  it('same recoupment ⇒ same verdict regardless of budget size', () => {
    const small = recoupmentFor({ totalDomestic: 4, totalInternational: 2, worldwide: 6 }, { budget: 2, marketingBudget: 1, genres: ['Drama'] }, 60);
    const big = recoupmentFor({ totalDomestic: 400, totalInternational: 200, worldwide: 600 }, { budget: 200, marketingBudget: 100, genres: ['Drama'] }, 60);
    expect(small.recoup).toBeCloseTo(big.recoup, 9);
    expect(verdictFor(small.recoup)).toBe(verdictFor(big.recoup));
  });
});
