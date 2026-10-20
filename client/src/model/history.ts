// One undo/redo history per open entry, covering text and decorations alike.
//
// States are immutable snapshots of the entry (structural sharing keeps them
// cheap). Changes in the same group that follow each other quickly (a burst
// of typing, one drag) collapse into a single undo step.

interface Step<T> {
  state: T;
  group: string | null;
  at: number;
}

export class History<T> {
  private past: Step<T>[] = [];
  private future: T[] = [];

  constructor(
    private readonly limit = 300,
    private readonly mergeWindowMs = 900,
  ) {}

  /**
   * Call before applying a change, with the state as it was. Consecutive
   * calls in the same group within the merge window keep only the oldest
   * state, so one undo removes the whole burst.
   */
  record(before: T, group: string | null = null, now = Date.now()): void {
    const top = this.past[this.past.length - 1];
    if (group && top && top.group === group && now - top.at <= this.mergeWindowMs) {
      top.at = now;
    } else {
      this.past.push({ state: before, group, at: now });
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future = [];
  }

  /** Ends the current burst so the next change starts a new undo step. */
  seal(): void {
    const top = this.past[this.past.length - 1];
    if (top) top.group = null;
  }

  undo(current: T): T | null {
    const step = this.past.pop();
    if (!step) return null;
    this.future.push(current);
    return step.state;
  }

  redo(current: T): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push({ state: current, group: null, at: 0 });
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
