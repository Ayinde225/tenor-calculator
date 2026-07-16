import { describe, it, expect } from 'vitest';
import {
  square,
  squareRoot,
  reciprocal,
  naturalLog,
  naturalExp,
  negate,
  sine,
  cosine,
  tangent,
  arcsine,
  arccosine,
  arctangent,
  sinh,
  cosh,
  tanh,
  arcsinh,
  arccosh,
  arctanh,
  round,
  percentOf,
  percentOfBase,
  RandomGenerator,
} from './functions.js';
import { formatValue } from '../display/format.js';
import { CalculatorError, ErrorCode } from '../errors.js';

const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

const expectError = (fn: () => unknown, code: ErrorCode): void => {
  try {
    fn();
    expect.unreachable('should have thrown');
  } catch (e) {
    expect(e).toBeInstanceOf(CalculatorError);
    expect((e as CalculatorError).code).toBe(code);
  }
};

describe('guidebook math examples (pp. 12-14)', () => {
  it('6.3 x^2 = 39.69', () => {
    expect(shown(square(6.3))).toBe('39.69');
  });

  it('sqrt(15.5) = 3.94', () => {
    expect(shown(squareRoot(15.5))).toBe('3.94');
  });

  it('1/x of 3.2 = 0.31', () => {
    expect(shown(reciprocal(3.2))).toBe('0.31');
  });
});

describe('percent (guidebook p. 12)', () => {
  it('scales by 1/100 in its multiplicative sense', () => {
    expect(percentOf(7)).toBe(0.07);
    expect(percentOf(100)).toBe(1);
  });

  it('takes a percentage OF the base for additive operations', () => {
    // 498 + 7 % = 532.86, not 498.07: the 7% is 7% of 498.
    expect(shown(498 + percentOfBase(498, 7))).toBe('532.86');
  });

  it('handles the discount example: 69.99 - 10 % = 62.99', () => {
    expect(shown(69.99 - percentOfBase(69.99, 10))).toBe('62.99');
  });
});

describe('logarithms', () => {
  it('ln and e^x are inverses', () => {
    expect(naturalLog(Math.E)).toBeCloseTo(1, 12);
    expect(naturalExp(1)).toBeCloseTo(Math.E, 12);
    expect(naturalLog(naturalExp(2.5))).toBeCloseTo(2.5, 10);
  });

  it('raises Error 2 for ln of a non-positive value (p. 84)', () => {
    expectError(() => naturalLog(0), ErrorCode.InvalidArgument);
    expectError(() => naturalLog(-1), ErrorCode.InvalidArgument);
  });

  it('raises Error 1 when e^x overflows the calculator range', () => {
    expectError(() => naturalExp(1000), ErrorCode.Overflow);
  });
});

describe('angle units (guidebook p. 10)', () => {
  it('computes sine in degrees by default', () => {
    expect(sine(30, 'DEG')).toBeCloseTo(0.5, 12);
    expect(sine(90, 'DEG')).toBe(1);
  });

  it('computes sine in radians when RAD is selected', () => {
    expect(sine(Math.PI / 2, 'RAD')).toBe(1);
    expect(sine(0, 'RAD')).toBe(0);
  });

  it('gives different answers for the same number under DEG and RAD', () => {
    expect(sine(1, 'DEG')).not.toBeCloseTo(sine(1, 'RAD'), 4);
  });

  it('computes cosine', () => {
    expect(cosine(0, 'DEG')).toBe(1);
    expect(cosine(60, 'DEG')).toBeCloseTo(0.5, 12);
  });

  it('returns inverse trig results in the selected unit', () => {
    expect(arcsine(0.5, 'DEG')).toBeCloseTo(30, 10);
    expect(arcsine(0.5, 'RAD')).toBeCloseTo(Math.PI / 6, 12);
    expect(arccosine(0.5, 'DEG')).toBeCloseTo(60, 10);
    expect(arctangent(1, 'DEG')).toBeCloseTo(45, 10);
  });

  it('round-trips sin and arcsin', () => {
    expect(arcsine(sine(37, 'DEG'), 'DEG')).toBeCloseTo(37, 9);
  });
});

describe('tangent singularities', () => {
  it('raises Error 1 at 90 degrees and its odd multiples', () => {
    // 90 is exact in a decimal machine, so the singularity is genuinely reachable.
    expectError(() => tangent(90, 'DEG'), ErrorCode.Overflow);
    expectError(() => tangent(270, 'DEG'), ErrorCode.Overflow);
    expectError(() => tangent(-90, 'DEG'), ErrorCode.Overflow);
  });

  it('does not raise in radians, where pi/2 is unreachable', () => {
    // No finite decimal equals pi/2, so the hardware returns a large finite value
    // rather than overflowing. Asserting an error here would be emulating a
    // singularity the user can never actually land on.
    expect(() => tangent(Math.PI / 2, 'RAD')).not.toThrow();
    expect(Math.abs(tangent(Math.PI / 2, 'RAD'))).toBeGreaterThan(1e15);
  });

  it('computes ordinary tangents', () => {
    expect(tangent(45, 'DEG')).toBeCloseTo(1, 10);
    expect(tangent(0, 'DEG')).toBe(0);
    expect(tangent(180, 'DEG')).toBeCloseTo(0, 10);
  });
});

describe('inverse trig domain (Error 2)', () => {
  it('rejects arguments outside [-1, 1]', () => {
    expectError(() => arcsine(1.5, 'DEG'), ErrorCode.InvalidArgument);
    expectError(() => arccosine(-2, 'DEG'), ErrorCode.InvalidArgument);
  });

  it('accepts the endpoints', () => {
    expect(arcsine(1, 'DEG')).toBeCloseTo(90, 10);
    expect(arccosine(-1, 'DEG')).toBeCloseTo(180, 10);
  });
});

describe('hyperbolic functions', () => {
  it('ignores the angle unit', () => {
    // HYP suspends DEG/RAD: the argument is a real number, not an angle.
    expect(sinh(1)).toBeCloseTo(1.175201194, 8);
    expect(cosh(0)).toBe(1);
    expect(tanh(0)).toBe(0);
  });

  it('inverts correctly', () => {
    expect(arcsinh(sinh(2))).toBeCloseTo(2, 10);
    expect(arccosh(cosh(2))).toBeCloseTo(2, 10);
    expect(arctanh(tanh(0.5))).toBeCloseTo(0.5, 10);
  });

  it('enforces the inverse hyperbolic domains', () => {
    expectError(() => arccosh(0.5), ErrorCode.InvalidArgument);
    expectError(() => arctanh(1), ErrorCode.InvalidArgument);
    expectError(() => arctanh(-1), ErrorCode.InvalidArgument);
  });
});

describe('ROUND (guidebook p. 15)', () => {
  it('collapses the internal value onto the displayed value', () => {
    // Normally 1/3 keeps its guard digits; ROUND discards them.
    expect(round(1 / 3, 2)).toBe(0.33);
    expect(round(2 / 3, 2)).toBe(0.67);
  });

  it('is what makes later arithmetic use the displayed number', () => {
    const unrounded = 1 / 3;
    expect(unrounded * 3).not.toBe(0.99);
    expect(round(unrounded, 2) * 3).toBeCloseTo(0.99, 12);
  });

  it('honours the decimal setting', () => {
    expect(round(3.14159265, 0)).toBe(3);
    expect(round(3.14159265, 4)).toBe(3.1416);
  });

  it('rounds to ten significant digits under floating decimal', () => {
    expect(round(1 / 3, 9)).toBe(0.3333333333);
  });
});

describe('sign change', () => {
  it('negates, and yields negative zero from zero', () => {
    expect(negate(5)).toBe(-5);
    expect(negate(-5)).toBe(5);
    expect(Object.is(negate(0), -0)).toBe(true);
  });
});

describe('random number generation (guidebook p. 14)', () => {
  it('produces values in [0, 1)', () => {
    const rng = new RandomGenerator(1);
    for (let i = 0; i < 200; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is deterministic for a given seed, so state transitions stay testable', () => {
    const a = new RandomGenerator(42);
    const b = new RandomGenerator(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('produces different streams for different seeds', () => {
    expect(new RandomGenerator(1).next()).not.toBe(new RandomGenerator(2).next());
  });

  it('requires a positive integer seed', () => {
    expectError(() => new RandomGenerator(0), ErrorCode.InvalidArgument);
    expectError(() => new RandomGenerator(-5), ErrorCode.InvalidArgument);
    expectError(() => new RandomGenerator(1.5), ErrorCode.InvalidArgument);
  });

  it('reseeds to replay a stream', () => {
    const rng = new RandomGenerator(7);
    const first = rng.next();
    rng.seed(7);
    expect(rng.next()).toBe(first);
  });
});

describe('reciprocal and square root errors (p. 84)', () => {
  it('raises Error 1 for 1/0', () => {
    expectError(() => reciprocal(0), ErrorCode.Overflow);
  });

  it('raises Error 2 for sqrt of a negative', () => {
    expectError(() => squareRoot(-1), ErrorCode.InvalidArgument);
  });

  it('accepts sqrt(0)', () => {
    expect(squareRoot(0)).toBe(0);
  });
});
