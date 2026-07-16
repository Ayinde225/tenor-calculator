import { describe, it, expect } from 'vitest';
import {
  INTERNAL_DIGITS,
  OVERFLOW_LIMIT,
  roundToSignificantDigits,
  toInternal,
  isIntegerAtInternalPrecision,
  isNegativeZero,
} from './precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

describe('13-digit internal precision (guidebook p. 86)', () => {
  it('reproduces the guidebook 1 / 3 x 3 worked example', () => {
    // The guidebook states the machine solves this in two steps:
    //   1 / 3            = 0.3333333333333
    //   0.3333333333333 x 3 = 0.9999999999999
    const step1 = toInternal(1 / 3);
    expect(step1.toPrecision(INTERNAL_DIGITS)).toBe('0.3333333333333');

    const step2 = toInternal(step1 * 3);
    expect(step2.toPrecision(INTERNAL_DIGITS)).toBe('0.9999999999999');

    // ...and only the display rounding turns that into 1.
    expect(Number(step2.toPrecision(10))).toBe(1);
  });

  it('differs from naive double arithmetic, which is the whole point', () => {
    // If this ever starts passing as equal, the emulation has been defeated.
    expect((1 / 3) * 3).toBe(1);
    expect(toInternal(toInternal(1 / 3) * 3)).not.toBe(1);
  });

  it('discards precision beyond 13 significant digits', () => {
    expect(roundToSignificantDigits(0.3333333333333333, 13)).toBe(0.3333333333333);
    expect(roundToSignificantDigits(1.2345678901234567, 13)).toBe(1.234567890123);
  });

  it('rounds at the 14th significant digit', () => {
    expect(roundToSignificantDigits(1.2345678901236, 13)).toBe(1.234567890124); // up
    expect(roundToSignificantDigits(1.2345678901234, 13)).toBe(1.234567890123); // down
    expect(roundToSignificantDigits(1.234567890123, 13)).toBe(1.234567890123); // unchanged
  });

  it('does not attempt exact decimal midpoint semantics', () => {
    // A decimal midpoint such as 1.00000000000005 is not representable in binary:
    // the nearest double is 1.00000000000004996, genuinely below the midpoint, so
    // it rounds down. Chasing "round half up" here would be emulating an artefact
    // of the literal rather than the hardware. 13-digit truncation is the contract;
    // the 14th-digit cases above are what is actually specified.
    expect(roundToSignificantDigits(1.00000000000005, 13)).toBe(1);
  });

  it('leaves zero, and preserves negative zero', () => {
    expect(roundToSignificantDigits(0, 13)).toBe(0);
    expect(isNegativeZero(roundToSignificantDigits(-0, 13))).toBe(true);
    expect(isNegativeZero(toInternal(-0))).toBe(true);
  });
});

describe('range limits (guidebook pp. 84-85)', () => {
  it('accepts values inside the calculator range', () => {
    expect(toInternal(9.999999999999e99)).toBe(9.999999999999e99);
    expect(toInternal(-9.999999999999e99)).toBe(-9.999999999999e99);
  });

  it('raises Error 1 on overflow', () => {
    expect(() => toInternal(1e100)).toThrow(CalculatorError);
    try {
      toInternal(1e100);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as CalculatorError).code).toBe(ErrorCode.Overflow);
    }
  });

  it('raises Error 1 for non-finite results (e.g. divide by zero)', () => {
    expect(() => toInternal(1 / 0)).toThrow(CalculatorError);
    expect(() => toInternal(0 / 0)).toThrow(CalculatorError);
    expect(() => toInternal(Number.NaN)).toThrow(CalculatorError);
  });

  it('uses 1e100 as the boundary, valid under either printed-range reading', () => {
    // Both candidate mantissas from the guidebook sit below the boundary.
    expect(9.999999999999e99).toBeLessThan(OVERFLOW_LIMIT);
    expect(9.9999999999999e99).toBeLessThan(OVERFLOW_LIMIT);
  });

  it('flushes underflow to zero', () => {
    expect(toInternal(1e-105)).toBe(0);
    expect(isNegativeZero(toInternal(-1e-105))).toBe(true);
  });
});

describe('integrality at internal precision', () => {
  it('treats float artefacts as the integer a decimal machine would see', () => {
    expect(isIntegerAtInternalPrecision(5)).toBe(true);
    expect(isIntegerAtInternalPrecision(4.999999999999999)).toBe(true); // rounds to 5 at 13 digits
    expect(isIntegerAtInternalPrecision(4.9)).toBe(false);
    expect(isIntegerAtInternalPrecision(-3)).toBe(true);
  });
});
