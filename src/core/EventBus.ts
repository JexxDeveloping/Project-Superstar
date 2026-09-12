/**
 * Synchronous event bus used inside a weekly tick.
 *
 * Engines never call each other; they publish what happened (an audition scored, a scene went
 * badly, a movie opened) and the tick collects those into the weekly report and the permanent
 * timeline. Subscribers can also hook in headless (tests, a future news engine).
 */
import type { TimelineCategory, TimelineEvent } from './GameState';

type Listener = (event: TimelineEvent) => void;

export class EventBus {
  private readonly listeners: Listener[] = [];
  private readonly collected: TimelineEvent[] = [];

  constructor(private readonly week: number) {}

  on(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  emit(category: TimelineCategory, title: string, description = ''): TimelineEvent {
    const event: TimelineEvent = { week: this.week, category, title, description };
    this.collected.push(event);
    for (const l of this.listeners) l(event);
    return event;
  }

  /** Everything emitted so far this tick, in order. */
  events(): TimelineEvent[] {
    return this.collected.slice();
  }
}
