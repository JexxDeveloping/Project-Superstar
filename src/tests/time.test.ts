import { describe, expect, it } from 'vitest';
import { dateForWeek, formatDate } from '../core/TimeEngine';

describe('TimeEngine — calendar', () => {
  it('week 0 is January week 1 of the epoch year', () => {
    const d = dateForWeek(0, 2028);
    expect(d).toMatchObject({ year: 2028, month: 0, monthName: 'January', weekOfMonth: 1 });
  });

  it('week 8 is March week 1 (4-4-5 calendar)', () => {
    expect(formatDate(8, 2028)).toBe('March 2028 — Week 1');
  });

  it('rolls the year after 52 weeks', () => {
    expect(dateForWeek(52, 2028)).toMatchObject({ year: 2029, month: 0, weekOfMonth: 1 });
    expect(dateForWeek(51, 2028)).toMatchObject({ year: 2028, month: 11, weekOfMonth: 5 });
  });

  it('never produces a week-of-month outside the month length', () => {
    for (let w = 0; w < 52 * 3; w++) {
      const d = dateForWeek(w, 2028);
      expect(d.weekOfMonth).toBeGreaterThanOrEqual(1);
      expect(d.weekOfMonth).toBeLessThanOrEqual(5);
      expect(d.month).toBeGreaterThanOrEqual(0);
      expect(d.month).toBeLessThanOrEqual(11);
    }
  });
});
