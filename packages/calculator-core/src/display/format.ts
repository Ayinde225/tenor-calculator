/**
 * Display formatter: turns an internal 13-digit value into the string the LCD shows.
 *
 * The central rule (guidebook p. 9): changing the decimal setting affects the
 * DISPLAY ONLY. The internal value is not rounded -- with exactly two exceptions,
 * amortization and depreciation, which do round their internal results to the
 * displayed setting. Those exceptions live in their own worksheet modules; this
 * module is purely presentational and never mutates stored state.
 *
 * Source: official guidebook pp. 9-10 (formats), p. 86 (accuracy).
 */
import { MAX_DISPLAY_DIGITS, roundToSignificantDigits } from '../numeric/precision.js';

/** DEC setting. 0-8 fix that many decimal places; 9 selects floating decimal. */
export type DecimalSetting = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** The DEC value that selects floating-decimal display. Guidebook p. 9. */
export const FLOATING_DECIMAL: DecimalSetting = 9;

/** Thousands/decimal separator convention. Guidebook p. 9. */
export type SeparatorFormat = 'US' | 'EUR';

export interface DisplayFormat {
  /** Decimal places, 0-8, or 9 for floating. Default 2. */
  readonly decimals: DecimalSetting;
  /** US -> `1,000.00`; EUR -> `1.000,00`. Default US. */
  readonly separator: SeparatorFormat;
}

export const DEFAULT_DISPLAY_FORMAT: DisplayFormat = Object.freeze({
  decimals: 2,
  separator: 'US',
});

const SEPARATORS: Readonly<Record<SeparatorFormat, { group: string; decimal: string }>> =
  Object.freeze({
    US: { group: ',', decimal: '.' },
    EUR: { group: '.', decimal: ',' },
  });

/**
 * Count significant display positions a fixed-notation rendering would need.
 * The LCD budget is 10 digits, excluding sign, separators and the decimal point.
 */
function digitCount(fixed: string): number {
  return fixed.replace(/[-.]/g, '').replace(/^0+(?=\d)/, '').length;
}

/** Insert group separators into an integer digit-string. */
function group(intDigits: string, sep: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/**
 * Render in the calculator's scientific notation: a mantissa carrying up to 10
 * significant digits, then the exponent. Used when a value cannot fit the
 * 10-digit display in fixed notation (guidebook p. 9).
 */
function toScientific(value: number, fmt: DisplayFormat): string {
  const { decimal } = SEPARATORS[fmt.separator];
  const mantissaDigits =
    fmt.decimals === FLOATING_DECIMAL ? MAX_DISPLAY_DIGITS - 1 : fmt.decimals;

  let s = value.toExponential(Math.min(mantissaDigits, MAX_DISPLAY_DIGITS - 1));
  let [mantissa = '0', expPart = '0'] = s.split('e');

  if (fmt.decimals === FLOATING_DECIMAL && mantissa.includes('.')) {
    mantissa = mantissa.replace(/\.?0+$/, '');
  }

  const exp = Number(expPart);
  const expStr = `${exp < 0 ? '-' : ''}${String(Math.abs(exp)).padStart(2, '0')}`;

  return `${mantissa.replace('.', decimal)} ${expStr}`;
}

/**
 * Format an internal value for the LCD.
 *
 * Returns the digits only -- indicator flags (BGN, 2nd, RAD, ...) are display
 * state owned by the state machine, not by this function.
 */
export function formatValue(value: number, fmt: DisplayFormat = DEFAULT_DISPLAY_FORMAT): string {
  if (!Number.isFinite(value)) return 'Error';

  // Negative zero displays as a plain zero; the sign is not shown.
  const v = Object.is(value, -0) ? 0 : value;
  const { group: g, decimal } = SEPARATORS[fmt.separator];

  if (fmt.decimals === FLOATING_DECIMAL) {
    return formatFloating(v, fmt, g, decimal);
  }
  return formatFixed(v, fmt, g, decimal);
}

function formatFixed(
  value: number,
  fmt: DisplayFormat,
  g: string,
  decimal: string,
): string {
  const fixed = value.toFixed(fmt.decimals);

  // Too wide for the 10-digit LCD -> fall back to scientific notation.
  if (digitCount(fixed) > MAX_DISPLAY_DIGITS) {
    return toScientific(value, fmt);
  }

  const negative = fixed.startsWith('-');
  const abs = negative ? fixed.slice(1) : fixed;
  const [intPart = '0', fracPart] = abs.split('.');

  const body =
    fracPart === undefined
      ? group(intPart, g)
      : `${group(intPart, g)}${decimal}${fracPart}`;

  // `-0.00` is not a thing the LCD shows; suppress the sign for an all-zero body.
  const isZero = /^[0.,]*$/.test(body) && !/[1-9]/.test(body);
  return negative && !isZero ? `-${body}` : body;
}

function formatFloating(
  value: number,
  fmt: DisplayFormat,
  g: string,
  decimal: string,
): string {
  if (value === 0) return '0';

  const abs = Math.abs(value);
  // Floating decimal shows up to 10 significant digits; beyond that the value
  // cannot be rendered in fixed notation and becomes scientific (p. 9).
  if (abs >= 1e10 || abs < 1e-9) {
    return toScientific(value, fmt);
  }

  const rounded = roundToSignificantDigits(value, MAX_DISPLAY_DIGITS);
  let s = String(rounded);
  if (s.includes('e')) return toScientific(rounded, fmt);

  const negative = s.startsWith('-');
  if (negative) s = s.slice(1);

  const [intPart = '0', fracPart] = s.split('.');
  const body =
    fracPart === undefined
      ? group(intPart, g)
      : `${group(intPart, g)}${decimal}${fracPart}`;

  return negative ? `-${body}` : body;
}
