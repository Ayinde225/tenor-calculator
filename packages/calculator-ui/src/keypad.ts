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
import { KEYPAD, tokenFor, ariaFor, type KeyDef } from './layout.js';
import type { Key } from '@tenor/calculator-core';

export interface Keypad {
  readonly root: HTMLElement;
  /** Briefly flash a key as pressed, e.g. when driven from the hardware keyboard. */
  flash(primary: Key): void;
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

  return { root, flash };
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

  // Pointer Events unify mouse, touch and pen and fire exactly once per press, so
  // there is no touch/click double-input to guard against. The visual "pressed"
  // state is driven here rather than by :active so it also works when a press is
  // replayed from the physical keyboard via flash().
  button.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // keep focus off the button on touch; avoid the synthetic click
    button.classList.add('pressed');
    button.focus({ preventScroll: true });
    opts.onFeedback?.();
    opts.onKey(def);
  });
  const release = (): void => button.classList.remove('pressed');
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);

  // Keyboard activation (Enter/Space) still needs to work for focus users. Since
  // pointerdown handled pointer input, only synthesise on real keyboard clicks.
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      button.classList.add('pressed');
      opts.onFeedback?.();
      opts.onKey(def);
    }
  });
  button.addEventListener('keyup', release);

  return button;
}
