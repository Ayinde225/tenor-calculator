/**
 * The LCD: a structured render of the engine's DisplayState.
 *
 * The screen has three parts, matching the DisplayState shape: a row of
 * annunciators along the top, an optional variable label, and the main numeric
 * readout. This is a projection only -- it never computes anything.
 */
import type { DisplayState, Indicator } from '@tenor/calculator-core';

/** The annunciators, in a fixed left-to-right order with their shown text and a spoken phrase. */
const INDICATORS: readonly { flag: Indicator; text: string; phrase: string }[] = [
  { flag: '2nd', text: '2ND', phrase: 'Second function armed' },
  { flag: 'INV', text: 'INV', phrase: 'Inverse' },
  { flag: 'HYP', text: 'HYP', phrase: 'Hyperbolic' },
  { flag: 'COMPUTE', text: 'COMPUTE', phrase: 'Compute' },
  { flag: 'ENTER', text: 'ENTER', phrase: 'Press Enter to store' },
  { flag: 'SET', text: 'SET', phrase: 'Press Set to change' },
  { flag: 'DEL', text: 'DEL', phrase: 'Delete available' },
  { flag: 'INS', text: 'INS', phrase: 'Insert available' },
  { flag: 'BGN', text: 'BGN', phrase: 'Begin-of-period payments' },
  { flag: 'RAD', text: 'RAD', phrase: 'Radians' },
];

export interface Lcd {
  readonly root: HTMLElement;
  update(display: DisplayState): void;
}

export function createLcd(): Lcd {
  const root = document.createElement('div');
  root.className = 'lcd';

  const annunciators = document.createElement('div');
  annunciators.className = 'lcd-annunciators';
  annunciators.setAttribute('aria-hidden', 'true');

  const spans = new Map<Indicator, HTMLSpanElement>();
  for (const { flag, text } of INDICATORS) {
    const span = document.createElement('span');
    span.className = 'lcd-flag';
    span.textContent = text;
    annunciators.append(span);
    spans.set(flag, span);
  }

  const main = document.createElement('div');
  main.className = 'lcd-main';

  const label = document.createElement('span');
  label.className = 'lcd-label';

  const value = document.createElement('span');
  value.className = 'lcd-value';

  // A live region so screen readers announce each new result without the user
  // having to hunt for it. The label+value together form the spoken line.
  const live = document.createElement('div');
  live.className = 'lcd-live';
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  // A separate status region for the annunciators, whose tiny glyphs are
  // aria-hidden. Pressing 2ND or toggling BGN changes no number, so without this a
  // screen-reader user would get no confirmation the mode changed (WCAG 4.1.3).
  const status = document.createElement('div');
  status.className = 'lcd-live';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  main.append(label, value);
  root.append(annunciators, main, live, status);

  let lastIndicators = '';

  function update(display: DisplayState): void {
    for (const { flag } of INDICATORS) {
      spans.get(flag)?.classList.toggle('on', display.indicators.includes(flag));
    }
    label.textContent = display.label;
    label.classList.toggle('hidden', display.label === '');
    value.textContent = display.value;
    value.classList.toggle('error', display.isError);

    const spoken = display.label ? `${display.label} ${display.value}` : display.value;
    live.textContent = spoken;

    // Announce the annunciator set only when it changes, so it does not repeat on
    // every keystroke. `=` (the value-belongs-to-label cue) is display-only.
    const active = INDICATORS.filter((i) => i.flag !== '=' && display.indicators.includes(i.flag));
    const key = active.map((i) => i.flag).join(',');
    if (key !== lastIndicators) {
      lastIndicators = key;
      status.textContent = active.length ? active.map((i) => i.phrase).join('. ') : '';
    }
  }

  return { root, update };
}
