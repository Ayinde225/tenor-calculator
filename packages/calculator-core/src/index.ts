/**
 * @tenor/calculator-core
 *
 * A framework-independent, zero-dependency financial calculator engine that
 * reproduces the behaviour of a standard BA II Plus-compatible calculator.
 *
 * This package contains no UI and no I/O. Every calculation function is pure and
 * independently testable.
 */

// ---------------------------------------------------------------------------
// Core: errors, precision, display, and the standard calculator
// ---------------------------------------------------------------------------

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
  type AngleUnit,
} from './math/functions.js';

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

// ---------------------------------------------------------------------------
// The state machine: the keypad-facing surface
// ---------------------------------------------------------------------------

export {
  reduce,
  reduceAll,
  project,
  currentValue,
  INITIAL_STATE,
  type ReduceResult,
} from './state/machine.js';

export {
  normalizeKey,
  parseKeySequence,
  isKey,
  isDigit,
  type Key,
  type DigitKey,
  type EntryKey,
  type OperatorKey,
  type UnaryKey,
  type ModifierKey,
  type WorksheetKey,
  type TvmKey,
  type MemoryKey,
  type ControlKey,
} from './state/keys.js';

export {
  makeDisplay,
  renderFlat,
  renderValue,
  renderEntry,
  errorDisplayState,
  type DisplayState,
  type Indicator,
} from './state/display-state.js';

export {
  FORMAT_DEFAULTS,
  persist,
  restoreAfterPowerOff,
  restoreAfterApd,
  type CalculatorState,
  type FormatSettings,
  type PersistedState,
  type Mode,
  type WorksheetId,
  type PendingOp,
  type ConstantState,
} from './state/state.js';

// ---------------------------------------------------------------------------
// Worksheets
//
// Namespaced rather than flattened. Several worksheets legitimately share names
// -- Bond and Date each define their own `DayCountMethod` and `daysBetween`,
// Cash Flow and Statistics each define a `DEFAULT_FREQUENCY` -- and those are
// genuinely distinct concepts, not accidental collisions. Flattening them would
// force arbitrary renames that no longer match the guidebook's own vocabulary,
// which is the vocabulary this package exists to reproduce.
//
//     import { tvm, bond } from '@tenor/calculator-core';
//     tvm.solvePMT(state);
//     bond.computePrice(state);
// ---------------------------------------------------------------------------

export * as tvm from './worksheets/tvm.js';
export * as amortization from './worksheets/amortization.js';
export * as cashFlow from './worksheets/cash-flow.js';
export * as bond from './worksheets/bond.js';
export * as depreciation from './worksheets/depreciation.js';
export * as statistics from './worksheets/statistics.js';
export * as percentChange from './worksheets/percent-change.js';
export * as interestConversion from './worksheets/interest-conversion.js';
export * as dateWorksheet from './worksheets/date.js';
export * as profitMargin from './worksheets/profit-margin.js';
export * as breakeven from './worksheets/breakeven.js';
export * as memory from './worksheets/memory-worksheet.js';

// The TVM types are re-exported flat as well: they are the engine's most-used
// surface and read better unqualified at call sites.
export type { TvmState, TvmVariable, PaymentMode } from './worksheets/tvm.js';
