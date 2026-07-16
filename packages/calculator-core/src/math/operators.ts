/**
 * Binary operators and the AOS algebraic hierarchy.
 *
 * Source: official guidebook p. 87 (AOS priority table).
 *
 * The guidebook's table has seven priority levels:
 *
 *   1 (highest)  x², x!, 1/x, %, √x, LN, e^x, HYP, INV, SIN, COS, TAN
 *   2            nCr, nPr
 *   3            y^x
 *   4            ×, ÷
 *   5            +, −
 *   6            )
 *   7 (lowest)   =
 *
 * Level 1 is entirely unary/postfix: those keys act on the displayed value the
 * moment they are pressed and never join the pending-operation stack, so they
 * need no precedence handling here. Levels 6 and 7 are terminators rather than
 * operators. That leaves levels 2-5 as the binary operators modelled below.
 *
 * NOTE ON THE SCALE: a LOWER number binds TIGHTER. Comparisons read backwards
 * from the usual convention, so they are wrapped in `bindsTighterOrEqual`.
 */
import { toInternal, isIntegerAtInternalPrecision } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

export type BinaryOp = 'add' | 'sub' | 'mul' | 'div' | 'pow' | 'npr' | 'ncr';

/** AOS priority level, straight from the guidebook table (lower binds tighter). */
export const AOS_PRIORITY: Readonly<Record<BinaryOp, number>> = Object.freeze({
  ncr: 2,
  npr: 2,
  pow: 3,
  mul: 4,
  div: 4,
  add: 5,
  sub: 5,
});

/**
 * Should a pending operator be completed before applying `incoming`?
 *
 * True when the pending operator binds at least as tightly, which yields
 * left-associativity within a priority level.
 */
export function bindsTighterOrEqual(pending: BinaryOp, incoming: BinaryOp): boolean {
  return AOS_PRIORITY[pending] <= AOS_PRIORITY[incoming];
}

/** Factorial, defined for integers 0-69 (guidebook p. 84, Error 2). */
export function factorial(x: number): number {
  if (!isIntegerAtInternalPrecision(x) || x < 0 || x > 69) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `x! requires an integer 0-69, got ${x}`);
  }
  const n = Math.round(x);
  let acc = 1;
  for (let k = 2; k <= n; k++) acc = toInternal(acc * k);
  return acc;
}

/**
 * y^x.
 *
 * Error 2 when y < 0 and x is neither an integer nor the inverse of an integer
 * (guidebook p. 84). The inverse-of-an-integer case is what makes (-8)^(1/3)
 * legal: an odd real root exists.
 */
export function power(y: number, x: number): number {
  if (y < 0) {
    const isInt = isIntegerAtInternalPrecision(x);
    const inverse = x !== 0 ? 1 / x : Number.NaN;
    const isInverseOfInteger = Number.isFinite(inverse) && isIntegerAtInternalPrecision(inverse);

    if (!isInt && !isInverseOfInteger) {
      throw new CalculatorError(
        ErrorCode.InvalidArgument,
        `y^x with y<0 requires integer x or x=1/integer, got y=${y} x=${x}`,
      );
    }
    if (!isInt && isInverseOfInteger) {
      // Real odd root of a negative base: -((-y)^x). An even root has no real value.
      const root = Math.round(1 / x);
      if (root % 2 === 0) {
        throw new CalculatorError(
          ErrorCode.InvalidArgument,
          `even root of negative base has no real value`,
        );
      }
      return toInternal(-Math.pow(-y, x));
    }
  }
  if (y === 0 && x < 0) {
    throw new CalculatorError(ErrorCode.Overflow, 'zero raised to a negative power');
  }
  return toInternal(Math.pow(y, x));
}

/** Permutations nPr = n! / (n-r)!, computed without overflowing the factorials. */
export function permutations(n: number, r: number): number {
  assertCombinatorialArgs(n, r, 'nPr');
  let acc = 1;
  for (let k = 0; k < Math.round(r); k++) acc = toInternal(acc * (Math.round(n) - k));
  return acc;
}

/** Combinations nCr = nPr / r!. */
export function combinations(n: number, r: number): number {
  assertCombinatorialArgs(n, r, 'nCr');
  const rr = Math.round(r);
  const nn = Math.round(n);
  // Symmetry keeps the loop short and the intermediates small.
  const k = Math.min(rr, nn - rr);
  let acc = 1;
  for (let j = 0; j < k; j++) {
    acc = toInternal((acc * (nn - j)) / (j + 1));
  }
  return toInternal(acc);
}

function assertCombinatorialArgs(n: number, r: number, label: string): void {
  if (!isIntegerAtInternalPrecision(n) || !isIntegerAtInternalPrecision(r)) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `${label} requires integers`);
  }
  if (n < 0 || r < 0 || r > n) {
    throw new CalculatorError(ErrorCode.InvalidArgument, `${label} requires 0 <= r <= n`);
  }
}

/** Apply a binary operator, normalising the result into the internal store. */
export function applyBinary(op: BinaryOp, a: number, b: number): number {
  switch (op) {
    case 'add':
      return toInternal(a + b);
    case 'sub':
      return toInternal(a - b);
    case 'mul':
      return toInternal(a * b);
    case 'div':
      if (b === 0) {
        throw new CalculatorError(ErrorCode.Overflow, 'division by zero');
      }
      return toInternal(a / b);
    case 'pow':
      return power(a, b);
    case 'npr':
      return permutations(a, b);
    case 'ncr':
      return combinations(a, b);
  }
}
