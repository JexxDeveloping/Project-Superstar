/** Presentation-only text helpers for the box office (no simulation logic). */
import type { BoxOfficeTag, Campaign, Verdict, WeekNote, WomBand } from '../core/GameState';

export function weekNoteText(note: WeekNote | undefined, titleOf: (id: string) => string): string {
  if (!note) return '';
  switch (note.kind) {
    case 'opened_first': return 'Opened #1.';
    case 'opened_behind': return `Opened behind ${note.rivalId ? titleOf(note.rivalId) : 'a bigger film'}.`;
    case 'grew': return 'Grew on word of mouth.';
    case 'held': return 'Held well.';
    case 'holiday': return `${note.window ?? 'The holiday'} lifted the whole market.`;
    case 'crushed': return `Lost screens to ${note.rivalId ? titleOf(note.rivalId) : 'a new release'}.`;
    case 'collapsed': return 'Collapsed — the word got out.';
    case 'breathed': return 'Room to breathe as rivals faded.';
    case 'viral': return 'Went viral.';
    case 'dropped': return 'A normal drop.';
  }
}

export const WOM_LABEL: Record<WomBand, string> = { building: 'Building', strong: 'Strong', fading: 'Fading', toxic: 'Toxic' };
export const WOM_CLASS: Record<WomBand, string> = { building: 'info', strong: 'good', fading: 'warn', toxic: 'bad' };

export const CAMPAIGN_LABEL: Record<Campaign, string> = { heavy: 'Heavy', modest: 'Modest', minimal: 'Minimal' };

export function verdictClass(v?: Verdict | string): string {
  if (!v) return '';
  return ['Hit', 'Super Hit', 'Blockbuster', 'All-Time Blockbuster'].includes(v) ? 'good' : v === 'Average' ? 'warn' : 'bad';
}

export function tagClass(t: BoxOfficeTag): string {
  return t === 'Sleeper' || t === 'Beat expectations' || t === 'Viral' ? 'good' : t === 'Cult seed' ? 'info' : 'warn';
}

export function pct(n: number): string {
  return `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`;
}

/** Fuzzy estimate bands in order, for sorting. */
export const BAND_ORDER = ['Very Low', 'Low', 'Low–Moderate', 'Moderate', 'Moderate–High', 'High', 'Very High'];
export function bandRank(b: string): number { return BAND_ORDER.indexOf(b); }
