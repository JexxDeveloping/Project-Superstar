import { describe, expect, it } from 'vitest';
import { verdictFor, VERDICT_LADDER } from '../industry/BoxOfficeEngine';

const movie = { budget: 100, marketingBudget: 50 };

describe('BoxOfficeEngine — verdict ladder (gross ÷ production budget)', () => {
  it('maps the agreed cutoffs', () => {
    expect(verdictFor(0, movie)).toBe('Disaster');
    expect(verdictFor(29.9, movie)).toBe('Disaster');
    expect(verdictFor(30, movie)).toBe('Flop');
    expect(verdictFor(74.9, movie)).toBe('Flop');
    expect(verdictFor(75, movie)).toBe('Average');
    expect(verdictFor(149.9, movie)).toBe('Average');
    expect(verdictFor(150, movie)).toBe('Hit');
    expect(verdictFor(199.9, movie)).toBe('Hit');
    expect(verdictFor(200, movie)).toBe('Super Hit');
    expect(verdictFor(249.9, movie)).toBe('Super Hit');
    expect(verdictFor(250, movie)).toBe('Blockbuster');
    expect(verdictFor(299.9, movie)).toBe('Blockbuster');
    expect(verdictFor(300, movie)).toBe('All-Time Blockbuster');
    expect(verdictFor(10_000, movie)).toBe('All-Time Blockbuster');
  });

  it('is a strict, non-overlapping ladder', () => {
    for (let i = 1; i < VERDICT_LADDER.length; i++) {
      expect(VERDICT_LADDER[i - 1].min).toBeGreaterThan(VERDICT_LADDER[i].min);
    }
    expect(VERDICT_LADDER[VERDICT_LADDER.length - 1].min).toBe(0);
  });

  it('ignores marketing in the production-budget basis', () => {
    expect(verdictFor(150, { budget: 100, marketingBudget: 1000 })).toBe('Hit');
  });
});
