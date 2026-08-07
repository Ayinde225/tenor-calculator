/**
 * The keypad: a grid of buttons over the layout data.
 *
 * Each button reports the KeyDef it represents; the app resolves the actual token
 * (primary vs secondary) from the live 2ND state and forwards it to the engine.
 * The keypad owns only presentation and input hygiene:
 *
 *  - Touch and mouse are unified through Pointer Events, so a tap never fires
 *    twice (the classic 300ms click-after-touch double input).
 *  - Every button is a real <button>, so keyboard focus, Enter/Space activation,
 *    and screen-reader semantics come for free.
 *  - The 2ND label is exposed to sighted users as a superscript and to assistive
 *    tech through the button's accessible name.
 */
import { KEYPAD, ariaFor, type KeyDef } from './layout.js';
import type { Key } from '@tenor/calculator-core';

/**
 * Keys that auto-repeat while held — the worksheet scroll keys (guidebook p. 21:
 * "press and hold ↓ or ↑ ... to move quickly through the variables"). Holding is
 * only an accelerator: a single press and the keyboard arrows do the same thing,
 * so no action depends on the long-press (WCAG 2.5.1 pointer gestures).
 */
const REPEATABLE: ReadonlySet<Key> = new Set<Key>(['UP', 'DOWN', 'BKSP']);
const REPEAT_DELAY_MS = 380;
const REPEAT_INTERVAL_MS = 110;

export interface Keypad {
  readonly root: HTMLElement;
  /** Briefly flash a key as pressed, e.g. when driven from the hardware keyboard. */
  flash(primary: Key): void;
  /** Highlight a key as "press this next" (practice mode); null clears the hint. */
  hint(primary: Key | null): void;
}

export interface KeypadOptions {
  readonly onKey: (def: KeyDef) => void;
  /** Optional feedback fired on a real press (haptics, click sound). */
  readonly onFeedback?: () => void;
}

export function createKeypad(opts: KeypadOptions): Keypad {
  const root = document.createElement('div');
  root.className = 'keypad';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Calculator keypad');

  const byPrimary = new Map<Key, HTMLButtonElement>();

  for (const row of KEYPAD) {
    const rowEl = document.createElement('div');
    rowEl.className = 'keypad-row';
    for (const def of row) {
      rowEl.append(makeButton(def, opts, byPrimary));
    }
    root.append(rowEl);
  }

  function flash(primary: Key): void {
    const button = byPrimary.get(primary);
    if (button === undefined) return;
    button.classList.add('pressed');
    window.setTimeout(() => button.classList.remove('pressed'), 110);
  }

  let hinted: HTMLButtonElement | null = null;
  function hint(primary: Key | null): void {
    hinted?.classList.remove('hint');
    hinted = primary === null ? null : (byPrimary.get(primary) ?? null);
    hinted?.classList.add('hint');
  }

  return { root, flash, hint };
}

function makeButton(
  def: KeyDef,
  opts: KeypadOptions,
  byPrimary: Map<Key, HTMLButtonElement>,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `key key-${def.tone}`;
  button.setAttribute('aria-label', ariaFor(def));
  // Stable hook for end-to-end tests; the primary token uniquely identifies a key.
  button.dataset.key = def.primary;
  byPrimary.set(def.primary, button);

  if (def.secondaryLabel !== undefined) {
    const sec = document.createElement('span');
    sec.className = 'key-secondary';
    sec.textContent = def.secondaryLabel;
    sec.setAttribute('aria-hidden', 'true');
    button.append(sec);
  }

  const face = document.createElement('span');
  face.className = 'key-face';
  face.textContent = def.label;
  button.append(face);

  // Pointer input activates on the UP-event over the button, not on down (WCAG
  // 2.5.2 Pointer Cancellation): pressing down only shows the pressed state and, for
  // scroll keys, starts the hold timer. Sliding off before releasing — pointerleave
  // or pointercancel — aborts without firing, and CE/C undoes any accidental press.
  let holdDelay = 0;
  let holdInterval = 0;
  let armed = false;
  let repeated = false;

  const stopHold = (): void => {
    window.clearTimeout(holdDelay);
    window.clearInterval(holdInterval);
    holdDelay = 0;
    holdInterval = 0;
  };

  button.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // avoid the synthetic click; manage focus/press ourselves
    button.classList.add('pressed');
    button.focus({ preventScroll: true });
    armed = true;
    repeated = false;

    // Hold-to-repeat for the scroll keys: after a delay, keep firing until release.
    // Repeats skip the feedback pulse so a long hold is not a buzz storm.
    if (REPEATABLE.has(def.primary)) {
      holdDelay = window.setTimeout(() => {
        holdInterval = window.setInterval(() => {
          repeated = true;
          opts.onKey(def);
        }, REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    }
  });

  // Release over the button completes the press — unless a hold already repeated,
  // in which case the repeats were the activation and a final fire would double it.
  button.addEventListener('pointerup', () => {
    button.classList.remove('pressed');
    stopHold();
    if (armed && !repeated) {
      opts.onFeedback?.();
      opts.onKey(def);
    }
    armed = false;
  });

  const abort = (): void => {
    button.classList.remove('pressed');
    stopHold();
    armed = false;
  };
  button.addEventListener('pointercancel', abort);
  button.addEventListener('pointerleave', abort);

  // Keyboard activation (Enter/Space) for focus users. Pointer input is handled
  // separately above; 2.5.2 governs pointers only, so keyboard fires on keydown.
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      button.classList.add('pressed');
      opts.onFeedback?.();
      opts.onKey(def);
    }
  });
  button.addEventListener('keyup', abort);

  return button;
}
