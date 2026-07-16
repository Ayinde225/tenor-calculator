/**
 * The LCD as a structured value rather than a string.
 *
 * The screen is not one field. It carries a variable label, a numeric readout,
 * and a row of annunciators, and golden cases assert all three:
 *
 *     RST ?          prompt + ENTER indicator, no number
 *     P/Y=  12.00    label + value
 *     BGN            annunciator only
 *     Error 5        an error, latched until CE/C
 *
 * Modelling it as `{ label, value, indicators }` keeps those separable; the flat
 * string is a rendering produced for test comparison, not the source of truth.
 *
 * One display trap is worth reproducing deliberately: inside a worksheet the
 * absence of the `=` indicator is the only cue that the number on screen does not
 * belong to the label on screen (guidebook p. 27).
 *
 * Source: guidebook pp. 7-8 (indicators), p. 23 (entry/compute cues), p. 27.
 */
import { formatValue, type DisplayFormat } from '../display/format.js';
import { errorDisplay, type ErrorCode } from '../errors.js';

/** Every annunciator the LCD can light. Guidebook pp. 7-8. */
export type Indicator =
  | '2nd'
  | 'INV'
  | 'HYP'
  | 'COMPUTE'
  | 'ENTER'
  | 'SET'
  | 'DEL'
  | 'INS'
  | 'BGN'
  | 'RAD'
  | 'UP'
  | 'DOWN'
  | '='; // the "this value belongs to this label" cue (p. 23)

export interface DisplayState {
  /** Variable label, e.g. `P/Y=`, `CFo=`, `RST ?`. Empty in standard mode. */
  readonly label: string;
  /** The numeric readout as it appears, already formatted. */
  readonly value: string;
  /** Lit annunciators. */
  readonly indicators: readonly Indicator[];
  /** True when an error is latched; `value` then holds `Error <n>`. */
  readonly isError: boolean;
}

export function makeDisplay(
  value: string,
  label = '',
  indicators: readonly Indicator[] = [],
  isError = false,
): DisplayState {
  return { label, value, indicators, isError };
}

/** The display for a latched error. Guidebook p. 84. */
export function errorDisplayState(code: ErrorCode): DisplayState {
  return makeDisplay(errorDisplay(code), '', [], true);
}

/**
 * Render a committed numeric value.
 *
 * Committed values are formatted to the DEC setting. Mid-entry text is NOT --
 * see `renderEntry`.
 */
export function renderValue(
  value: number,
  fmt: DisplayFormat,
  label = '',
  indicators: readonly Indicator[] = [],
): DisplayState {
  return makeDisplay(formatValue(value, fmt), label, indicators);
}

/**
 * Render an in-progress entry buffer.
 *
 * Keyed digits echo as typed and are NOT padded to the DEC setting: the p. 18
 * table shows a keyed `3` echoing as `3`, while a computed result on the same
 * page shows as `24.00`. Group separators are applied as you type, and a bare
 * trailing decimal point survives (`1,234.`) because the user is still mid-number.
 *
 * The guidebook never states this rule outright -- it is only inferable by
 * reading the p. 18 and p. 19 tables against each other (OPEN-QUESTIONS: MEM-8).
 */
export function renderEntry(
  buffer: string,
  fmt: DisplayFormat,
  label = '',
  indicators: readonly Indicator[] = [],
): DisplayState {
  const negative = buffer.startsWith('-');
  const body = negative ? buffer.slice(1) : buffer;
  const [intPart = '', fracPart] = body.split('.');
  const sep = fmt.separator === 'US' ? ',' : '.';
  const dec = fmt.separator === 'US' ? '.' : ',';

  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const hasPoint = body.includes('.');
  const text = `${negative ? '-' : ''}${groupedInt}${hasPoint ? dec : ''}${fracPart ?? ''}`;

  return makeDisplay(text === '' ? '0' : text, label, indicators);
}

/** Flatten to a single string, for golden-test comparison. */
export function renderFlat(d: DisplayState): string {
  return d.label ? `${d.label} ${d.value}`.trim() : d.value;
}
