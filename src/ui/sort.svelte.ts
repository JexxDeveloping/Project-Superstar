/**
 * Click-to-sort for data tables (presentation only). First click on a column sorts ascending,
 * the next click flips to descending. Missing values always sort last; ties keep table order.
 */
export type SortValue = number | string | undefined | null;
export type SortDir = 'asc' | 'desc';
export type Accessors<T> = Record<string, (row: T) => SortValue>;

export class TableSort {
  key = $state<string | null>(null);
  dir = $state<SortDir>('asc');

  constructor(key: string | null = null, dir: SortDir = 'asc') {
    this.key = key;
    this.dir = dir;
  }

  toggle(key: string): void {
    if (this.key === key) this.dir = this.dir === 'asc' ? 'desc' : 'asc';
    else { this.key = key; this.dir = 'asc'; }
  }

  apply<T>(rows: T[], accessors: Accessors<T>): T[] {
    const key = this.key;
    if (!key || !accessors[key]) return rows;
    const get = accessors[key];
    const sign = this.dir === 'asc' ? 1 : -1;
    return rows
      .map((r, i) => ({ r, i, v: get(r) }))
      .sort((a, b) => {
        const am = a.v === undefined || a.v === null || a.v === '';
        const bm = b.v === undefined || b.v === null || b.v === '';
        if (am && bm) return a.i - b.i;
        if (am) return 1;
        if (bm) return -1;
        let c = 0;
        if (typeof a.v === 'number' && typeof b.v === 'number') c = a.v - b.v;
        else c = String(a.v).localeCompare(String(b.v), undefined, { sensitivity: 'base', numeric: true });
        return c !== 0 ? c * sign : a.i - b.i;
      })
      .map((x) => x.r);
  }
}
