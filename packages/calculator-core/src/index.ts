/**
 * @tenor/calculator-core
 *
 * A framework-independent, zero-dependency financial calculator engine that
 * reproduces the behaviour of a standard BA II Plus-compatible calculator.
 *
 * This package contains no UI and no I/O. Every calculation function is pure and
 * independently testable; the state machine is a pure reducer over key commands.
 */

export { ErrorCode, CalculatorError, ERROR_NAMES, errorDisplay } from './errors.js';

export {
  INTERNAL_DIGITS,
  MAX_DISPLAY_DIGITS,
  OVERFLOW_LIMIT,
  UNDERFLOW_LIMIT,
  toInternal,
  roundToSignificantDigits,
  isOverflow,
  isIntegerAtInternalPrecision,
  isNegativeZero,
} from './numeric/precision.js';

export {
  formatValue,
  DEFAULT_DISPLAY_FORMAT,
  FLOATING_DECIMAL,
  type DisplayFormat,
  type DecimalSetting,
  type SeparatorFormat,
} from './display/format.js';

export {
  AOS_PRIORITY,
  bindsTighterOrEqual,
  applyBinary,
  factorial,
  power,
  permutations,
  combinations,
  type BinaryOp,
} from './math/operators.js';

export {
  createExpressionState,
  pressOperator,
  pressEquals,
  pressOpenParen,
  pressCloseParen,
  hasPendingWork,
  clearPending,
  MAX_PAREN_DEPTH,
  MAX_PENDING_OPS,
  type CalculationMethod,
  type ExpressionState,
} from './math/expression-engine.js';

export {
  TVM_DEFAULTS,
  periodicRate,
  nominalRate,
  tvmResidual,
  solveN,
  solveIY,
  solvePV,
  solvePMT,
  solveFV,
  computeTvm,
  type TvmState,
  type TvmVariable,
  type PaymentMode,
} from './worksheets/tvm.js';
