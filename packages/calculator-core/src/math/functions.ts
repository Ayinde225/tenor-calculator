/**
 * Unary and immediate-acting keys: the top level of the AOS hierarchy.
 *
 * Every function here sits at priority 1 (guidebook p. 87), which is another way
 * of saying it acts on the displayed value the instant it is pressed and never
 * joins the pending-operation stack. That is why they are plain functions rather
 * than part of the expression engine.
 *
 * Sources: guidebook pp. 12-15 (math operations), p. 84 (Error 1/2 conditions),
 * p. 87 (hierarchy), p. 10 (angle units).
 */
import { toInternal, isIntegerAtInternalPrecision } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';
import { FLOATING_DECIMAL, type DecimalSetting } from '../display/format.js';

/** Angle unit for the trigonometric functions. Default DEG (guidebook p. 9). */
export type AngleUnit = 'DEG' | 'RAD';

const DEG_PER_RAD = 180 / Math.PI;

const toRadians = (angle: number, unit: AngleUnit): number =>
  unit === 'DEG' ? angle / DEG_PER_RAD : angle;

const fromRadians = (radians: number, unit: AngleUnit): number =>
  unit === 'DEG' ? radians * DEG_PER_RAD : radians;

/** x squared. */
export const square = (x: number): number => toInternal(x * x);

/** Square root. Error 2 when x < 0 (guidebook p. 84). */
export function squareRoot(x: number): number {
  if (x < 0) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `sqrt of a negative value: ${x}`);
  }
  return toInternal(Math.sqrt(x));
}

/** Reciprocal. Error 1 when x = 0 (guidebook p. 84). */
export function reciprocal(x: number): number {
  if (x === 0) {
    throw new CalculatorError(ErrorCode.Overflow, 'reciprocal of zero');
  }
  return toInternal(1 / x);
}

/** Natural logarithm. Error 2 when x <= 0 (guidebook p. 84). */
export function naturalLog(x: number): number {
  if (x <= 0) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `ln of a non-positive value: ${x}`);
  }
  return toInternal(Math.log(x));
}

/** e raised to x. Overflow (Error 1) is detected by toInternal. */
export const naturalExp = (x: number): number => toInternal(Math.exp(x));

/** Change sign. Note -0 is meaningful and preserved. */
export const negate = (x: number): number => (x === 0 ? -0 : toInternal(-x));

export function sine(x: number, unit: AngleUnit): number {
  return toInternal(Math.sin(toRadians(x, unit)));
}

export function cosine(x: number, unit: AngleUnit): number {
  return toInternal(Math.cos(toRadians(x, unit)));
}

/**
 * Tangent.
 *
 * The singularity is reachable in degrees but not in radians, and the difference
 * is not a technicality -- it is the decimal machine showing through.
 *
 * In DEG, 90 is an exact decimal value, so cos(90) is exactly zero and the
 * tangent genuinely overflows: Error 1. In RAD the singularity sits at pi/2,
 * which no finite decimal (or binary) value equals, so it can never be entered
 * exactly and the hardware returns a large finite result instead.
 *
 * Testing `cos(x) === 0` would satisfy neither case: in binary, cos(pi/2) is
 * 6.1e-17, so the check never fires even for 90 degrees. The angle is therefore
 * tested directly, in the unit the user actually typed.
 */
export function tangent(x: number, unit: AngleUnit): number {
  if (unit === 'DEG' && Math.abs(x % 180) === 90) {
    throw new CalculatorError(ErrorCode.Overflow, `tangent undefined at ${x} degrees`);
  }
  return toInternal(Math.tan(toRadians(x, unit)));
}

/** Inverse sine. Error 2 outside [-1, 1] (no real result). */
export function arcsine(x: number, unit: AngleUnit): number {
  if (x < -1 || x > 1) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `arcsin requires -1 <= x <= 1, got ${x}`);
  }
  return toInternal(fromRadians(Math.asin(x), unit));
}

/** Inverse cosine. Error 2 outside [-1, 1]. */
export function arccosine(x: number, unit: AngleUnit): number {
  if (x < -1 || x > 1) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `arccos requires -1 <= x <= 1, got ${x}`);
  }
  return toInternal(fromRadians(Math.acos(x), unit));
}

/** Inverse tangent. Defined for all real x. */
export function arctangent(x: number, unit: AngleUnit): number {
  return toInternal(fromRadians(Math.atan(x), unit));
}

/**
 * Hyperbolic functions.
 *
 * These take a plain real argument, not an angle, so the DEG/RAD setting does not
 * apply -- pressing 2ND HYP suspends the angle unit entirely.
 */
export const sinh = (x: number): number => toInternal(Math.sinh(x));
export const cosh = (x: number): number => toInternal(Math.cosh(x));
export const tanh = (x: number): number => toInternal(Math.tanh(x));

/** Inverse hyperbolic sine. Defined for all real x. */
export const arcsinh = (x: number): number => toInternal(Math.asinh(x));

/** Inverse hyperbolic cosine. Error 2 when x < 1. */
export function arccosh(x: number): number {
  if (x < 1) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `arccosh requires x >= 1, got ${x}`);
  }
  return toInternal(Math.acosh(x));
}

/** Inverse hyperbolic tangent. Error 2 outside (-1, 1); +/-1 overflows. */
export function arctanh(x: number): number {
  if (x <= -1 || x >= 1) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `arctanh requires -1 < x < 1, got ${x}`);
  }
  return toInternal(Math.atanh(x));
}

/**
 * ROUND (2ND ROUND): collapse the internal value onto its displayed form.
 *
 * This is the deliberate inverse of the machine's normal contract. Ordinarily the
 * display is a lossless view and the 13-digit internal value keeps its guard
 * digits (p. 9); ROUND discards them, so subsequent arithmetic uses exactly what
 * the user can see (p. 15). It is the only key that lets the display setting
 * reach the stored value on demand.
 */
export function round(x: number, decimals: DecimalSetting): number {
  if (decimals === FLOATING_DECIMAL) {
    // Floating decimal shows up to 10 significant digits; that is what it rounds to.
    return toInternal(Number(x.toPrecision(10)));
  }
  return toInternal(Number(x.toFixed(decimals)));
}

/**
 * Percent, in its multiplicative sense: x% -> x/100.
 *
 * The % key is context-sensitive on the hardware (p. 12): after x or / it scales
 * by 1/100, but after + or - it means "that percentage OF the first operand", so
 * `498 + 7 % =` gives 532.86 rather than 498.07. That branch needs the pending
 * operation and therefore lives in the state machine; this is the scalar half.
 * The guidebook prints no formula for either -- both are inferred from its four
 * worked examples.
 */
export const percentOf = (x: number): number => toInternal(x / 100);

/**
 * Percent applied against a pending additive operation: base +/- (base * x/100).
 * Split out here so the rule is stated once and tested directly.
 */
export const percentOfBase = (base: number, x: number): number => toInternal((base * x) / 100);

/**
 * Pseudo-random number in [0, 1), from a seedable generator.
 *
 * A seeded generator rather than Math.random because the hardware's RAND is
 * seedable (STO 2ND RAND, p. 14) and the engine must stay a pure, reproducible
 * reducer -- a nondeterministic call inside it would make state transitions
 * untestable. Algorithm choice is ours; the guidebook does not specify one, and
 * the exact sequence is therefore a known parity gap. See docs/OPEN-QUESTIONS.md.
 */
export class RandomGenerator {
  private state: number;

  constructor(seed = 1) {
    this.state = RandomGenerator.normalizeSeed(seed);
  }

  /** The hardware requires a positive integer seed (guidebook p. 14). */
  static normalizeSeed(seed: number): number {
    if (!isIntegerAtInternalPrecision(seed) || seed <= 0) {
      throw new CalculatorError(
        ErrorCode.InvalidArgument,
        `random seed must be a positive integer, got ${seed}`,
      );
    }
    return Math.round(seed) >>> 0 || 1;
  }

  seed(value: number): void {
    this.state = RandomGenerator.normalizeSeed(value);
  }

  /** mulberry32: small, fast, well-distributed, and fully deterministic. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return toInternal(((t ^ (t >>> 14)) >>> 0) / 4294967296);
  }
}
