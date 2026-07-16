/**
 * The LCD: a structured render of the engine's DisplayState.
 *
 * The screen has three parts, matching the DisplayState shape: a row of
 * annunciators along the top, an optional variable label, and the main numeric
 * readout. This is a projection only -- it never computes anything.
 */
import type { DisplayState, Indicator } from '@tenor/calculator-core';

/** The annunciators, in a fixed left-to-right order with their shown text. */
const INDICATORS: readonly { flag: Indicator; text: string }[] = [
  { flag: '2nd', text: '2ND' },
  { flag: 'INV', text: 'INV' },
  { flag: 'HYP', text: 'HYP' },
  { flag: 'COMPUTE', text: 'COMPUTE' },
  { flag: 'ENTER', text: 'ENTER' },
  { flag: 'SET', text: 'SET' },
  { flag: 'DEL', text: 'DEL' },
  { flag: 'INS', text: 'INS' },
  { flag: 'BGN', text: 'BGN' },
  { flag: 'RAD', text: 'RAD' },
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

  main.append(label, value);
  root.append(annunciators, main, live);

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
  }

  return { root, update };
}
