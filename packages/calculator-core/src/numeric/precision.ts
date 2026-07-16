/**
 * Numeric compatibility layer.
 *
 * The BA II Plus is a 13-significant-digit decimal machine that displays at most
 * 10 digits. IEEE-754 doubles carry ~15-17 significant digits, so they are more
 * precise than the hardware -- which sounds harmless but is the single largest
 * source of parity drift. The extra precision must be actively discarded.
 *
 * The guidebook's own worked example (p. 86) pins this down:
 *
 *     1 / 3            -> 0.3333333333333     (13 digits, not 0.3333333333333333)
 *     0.3333333333333 * 3 -> 0.9999999999999  (NOT 1)
 *     displayed as     -> 1                   (display rounds 13 -> 10 digits)
 *
 * A naive double computes `(1/3)*3 === 1` exactly, so the intermediate
 * 0.9999999999999 never appears. Here it produces the same *display*, but the
 * divergence is real and compounds through iterative solves. So: every value
 * entering the calculator's internal store passes through `toInternal`.
 *
 * Source: official guidebook p. 86 (accuracy), pp. 84-85 (ranges/errors).
 */
import { CalculatorError, ErrorCode } from '../errors.js';

/** Significant digits retained internally ("guard digits"). Guidebook p. 86. */
export const INTERNAL_DIGITS = 13;

/** Maximum significant digits the LCD can render. Guidebook p. 86. */
export const MAX_DISPLAY_DIGITS = 10;

/**
 * Overflow boundary.
 *
 * The guidebook prints the range as +/-9.9999999999999E99, which is 14
 * significant digits and therefore inconsistent with its own statement that the
 * machine stores 13. Rather than guess which is the typo, we test against 1E100:
 * every candidate mantissa (9.999999999999E99 at 13 digits, 9.9999999999999E99
 * at 14) is strictly below 1E100, so this boundary is correct under either
 * reading. Tracked in docs/OPEN-QUESTIONS.md.
 */
export const OVERFLOW_LIMIT = 1e100;

/** Smallest representable magnitude; anything smaller flushes to zero. */
export const UNDERFLOW_LIMIT = 1e-99;

/**
 * Round to `digits` significant decimal digits.
 *
 * `toPrecision` is used rather than the usual `Math.round(x * 10**k) / 10**k`
 * because the latter overflows its scale factor for extreme exponents and
 * misrounds near representability boundaries. `toPrecision` is specified to
 * produce the correctly rounded decimal string, which is exactly the decimal
 * semantics being emulated.
 *
 * Preserves negative zero, which the hardware distinguishes.
 */
export function roundToSignificantDigits(x: number, digits: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  return Number(x.toPrecision(digits));
}

/**
 * Normalise a freshly computed value into the internal 13-digit store.
 *
 * Applies, in order: NaN/Infinity rejection, 13-digit rounding, underflow flush,
 * overflow detection. Call this on the result of every arithmetic operation.
 *
 * @throws {CalculatorError} Error 1 on overflow or a non-finite result.
 */
export function toInternal(x: number): number {
  if (Number.isNaN(x)) {
    throw new CalculatorError(ErrorCode.Overflow, 'result is not a number');
  }
  if (!Number.isFinite(x)) {
    throw new CalculatorError(ErrorCode.Overflow, 'result is infinite');
  }

  const rounded = roundToSignificantDigits(x, INTERNAL_DIGITS);

  if (Math.abs(rounded) >= OVERFLOW_LIMIT) {
    throw new CalculatorError(ErrorCode.Overflow, `|${x}| exceeds calculator range`);
  }
  // Underflow flushes to zero, keeping the sign the hardware would show.
  if (rounded !== 0 && Math.abs(rounded) < UNDERFLOW_LIMIT) {
    return Object.is(Math.sign(rounded), -1) || rounded < 0 ? -0 : 0;
  }
  return rounded;
}

/** True if the value would overflow the calculator's range. */
export function isOverflow(x: number): boolean {
  return !Number.isFinite(x) || Math.abs(x) >= OVERFLOW_LIMIT;
}

/**
 * Guard against the classic float artefact where a value that should be exactly
 * an integer arrives as 4.999999999999999. Used by argument validators (x!,
 * nPr/nCr, y^x) which must decide integrality the way a decimal machine would.
 */
export function isIntegerAtInternalPrecision(x: number): boolean {
  return Number.isInteger(roundToSignificantDigits(x, INTERNAL_DIGITS));
}

/** Negative zero is observable on the hardware; make the test explicit. */
export function isNegativeZero(x: number): boolean {
  return Object.is(x, -0);
}
