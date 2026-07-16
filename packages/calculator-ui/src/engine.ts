/**
 * A thin stateful wrapper over the pure calculator-core reducer.
 *
 * The engine is the whole calculator. This class does nothing but hold the
 * current state, forward key presses to `reduce`, and notify subscribers with the
 * new display. All calculation, formatting, and error handling live in the core.
 */
import {
  reduce,
  project,
  INITIAL_STATE,
  type CalculatorState,
  type DisplayState,
  type Key,
} from '@tenor/calculator-core';

export type EngineListener = (display: DisplayState, state: CalculatorState) => void;

export class Engine {
  private state: CalculatorState;
  private readonly listeners = new Set<EngineListener>();

  constructor(initial: CalculatorState = INITIAL_STATE) {
    this.state = initial;
  }

  get display(): DisplayState {
    return project(this.state);
  }

  get current(): CalculatorState {
    return this.state;
  }

  /** True when 2ND is armed, so the UI can resolve a key's secondary function. */
  get secondArmed(): boolean {
    return this.state.secondArmed;
  }

  press(key: Key): void {
    const result = reduce(this.state, key);
    this.state = result.state;
    this.notify(result.display);
  }

  /** Replace the whole state (used when restoring a persisted session). */
  restore(state: CalculatorState): void {
    this.state = state;
    this.notify(project(state));
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    listener(this.display, this.state);
    return () => this.listeners.delete(listener);
  }

  private notify(display: DisplayState): void {
    for (const listener of this.listeners) listener(display, this.state);
  }
}
