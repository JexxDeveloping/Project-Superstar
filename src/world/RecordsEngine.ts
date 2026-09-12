/**
 * RecordsEngine — box-office records (biggest opening, biggest gross, biggest bomb), all-time and
 * per calendar year, with the news lines that go with a new record.
 */
import type { BoxOfficeRecords, GameState, Movie, RecordEntry, RecordSet } from '../core/GameState';
import type { EventBus } from '../core/EventBus';
import { dateForWeek } from '../core/TimeEngine';
import { formatMoney } from '../industry/BoxOfficeEngine';

export function emptyRecords(): BoxOfficeRecords {
  return { allTime: {}, byYear: {} };
}

function yearSet(records: BoxOfficeRecords, year: number): RecordSet {
  return (records.byYear[year] ??= {});
}

function better(current: RecordEntry | undefined, amount: number): boolean {
  return !current || amount > current.amount;
}

/** After a film's opening week is in. Returns true when an all-time opening record fell. */
export function recordOpening(state: GameState, movie: Movie, bus: EventBus): void {
  const run = movie.boxOffice!;
  const amount = run.openingDomestic + run.openingInternational;
  const entry: RecordEntry = { movieId: movie.id, title: movie.title, amount, week: state.week };
  const year = dateForWeek(state.week, state.epochYear).year;
  const ys = yearSet(state.records, year);
  if (better(ys.opening, amount)) ys.opening = entry;
  if (better(state.records.allTime.opening, amount)) {
    const prev = state.records.allTime.opening;
    state.records.allTime.opening = entry;
    if (prev) bus.emit('news', `Opening record: ${movie.title}`, `${formatMoney(amount)} worldwide in its first week — past ${prev.title}'s ${formatMoney(prev.amount)}.`);
  }
}

/** After a run finishes: biggest gross and biggest bomb (estimated loss), year and all-time. */
export function recordFinish(state: GameState, movie: Movie, bus: EventBus): void {
  const run = movie.boxOffice!;
  const year = dateForWeek(movie.releaseWeek ?? state.week, state.epochYear).year;
  const ys = yearSet(state.records, year);
  const gross: RecordEntry = { movieId: movie.id, title: movie.title, amount: run.worldwide, week: state.week };
  if (better(ys.gross, run.worldwide)) ys.gross = gross;
  if (better(state.records.allTime.gross, run.worldwide)) {
    const prev = state.records.allTime.gross;
    state.records.allTime.gross = gross;
    if (prev) bus.emit('news', `${movie.title} is the biggest film in history`, `${formatMoney(run.worldwide)} worldwide, past ${prev.title}'s ${formatMoney(prev.amount)}.`);
  }
  const loss = -(run.profit ?? 0);
  if (loss > 0) {
    const bomb: RecordEntry = { movieId: movie.id, title: movie.title, amount: loss, week: state.week };
    if (better(ys.bomb, loss)) {
      const first = !ys.bomb;
      ys.bomb = bomb;
      if (!first && loss >= 20_000_000) bus.emit('news', `${movie.title} is the year's biggest bomb`, `An estimated ${formatMoney(loss)} lost on a $${(movie.budget / 1e6).toFixed(0)}M budget.`);
    }
    if (better(state.records.allTime.bomb, loss)) state.records.allTime.bomb = bomb;
  }
}
