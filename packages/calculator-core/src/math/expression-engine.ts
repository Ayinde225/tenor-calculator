/**
 * The pending-operation engine, implementing both calculation methods.
 *
 * CHN (chain, the default): each new binary operator immediately completes the
 * one before it, so the expression evaluates strictly left to right.
 *     3 + 2 x 4  ->  (3 + 2) x 4  =  20
 *
 * AOS (algebraic operating system): a new operator only completes pending
 * operators that bind at least as tightly, so multiplication outranks addition.
 *     3 + 2 x 4  ->  3 + (2 x 4)  =  11
 *
 * These two results are a required parity check for the project, and they are
 * the reason this is a state machine over an explicit operand/operator stack
 * rather than an expression parser. The hardware has no expression to parse: it
 * sees one keypress at a time and must produce a display value after each.
 *
 * Sources: guidebook p. 87 (AOS hierarchy), pp. 7-8 (chain default), p. 84
 * (Error 3 limits).
 */
import { applyBinary, bindsTighterOrEqual, type BinaryOp } from './operators.js';
import { CalculatorError, ErrorCode } from '../errors.js';
import { toInternal } from '../numeric/precision.js';

/** Chain or algebraic evaluation. Default CHN (guidebook p. 9). */
export type CalculationMethod = 'CHN' | 'AOS';

/** Max simultaneously active parenthesis levels (guidebook p. 84, Error 3). */
export const MAX_PAREN_DEPTH = 15;

/** Max simultaneously pending operations (guidebook p. 84, Error 3). */
export const MAX_PENDING_OPS = 8;

interface PendingOperation {
  readonly op: BinaryOp;
  readonly operand: number;
  /** Parenthesis depth at which this operation was pushed. */
  readonly depth: number;
}

export interface ExpressionState {
  readonly pending: readonly PendingOperation[];
  readonly parenDepth: number;
  readonly method: CalculationMethod;
}

export function createExpressionState(method: CalculationMethod = 'CHN'): ExpressionState {
  return { pending: [], parenDepth: 0, method };
}

/**
 * Complete every pending operation at or above `minDepth` that should fire
 * before `incoming` is pushed.
 *
 * `incoming === null` means a terminator (`=` or `)`), which completes
 * everything at this depth regardless of priority.
 */
function reduce(
  state: ExpressionState,
  value: number,
  incoming: BinaryOp | null,
  minDepth: number,
): { pending: PendingOperation[]; value: number } {
  const pending = [...state.pending];
  let acc = value;

  while (pending.length > 0) {
    const top = pending[pending.length - 1]!;
    if (top.depth < minDepth) break;

    if (incoming !== null) {
      // CHN completes unconditionally; AOS consults the hierarchy.
      const shouldComplete =
        state.method === 'CHN' || bindsTighterOrEqual(top.op, incoming);
      if (!shouldComplete) break;
    }

    pending.pop();
    acc = applyBinary(top.op, top.operand, acc);
  }

  return { pending, value: acc };
}

/**
 * Press a binary operator with `value` currently displayed.
 * Returns the new state and the value the LCD should show.
 */
export function pressOperator(
  state: ExpressionState,
  value: number,
  op: BinaryOp,
): { state: ExpressionState; display: number } {
  const { pending, value: acc } = reduce(state, value, op, state.parenDepth);

  if (pending.length >= MAX_PENDING_OPS) {
    throw new CalculatorError(
      ErrorCode.TooManyPendingOperations,
      `more than ${MAX_PENDING_OPS} pending operations`,
    );
  }

  pending.push({ op, operand: acc, depth: state.parenDepth });
  return { state: { ...state, pending }, display: acc };
}

/** Press `=`: complete everything and clear the pending stack. */
export function pressEquals(
  state: ExpressionState,
  value: number,
): { state: ExpressionState; display: number } {
  const { value: acc } = reduce(state, value, null, 0);
  return {
    state: { ...state, pending: [], parenDepth: 0 },
    display: toInternal(acc),
  };
}

/** Press `(`. */
export function pressOpenParen(state: ExpressionState): ExpressionState {
  if (state.parenDepth >= MAX_PAREN_DEPTH) {
    throw new CalculatorError(
      ErrorCode.TooManyPendingOperations,
      `more than ${MAX_PAREN_DEPTH} parenthesis levels`,
    );
  }
  return { ...state, parenDepth: state.parenDepth + 1 };
}

/**
 * Press `)`: complete every operation opened inside this parenthesis level.
 * An unmatched `)` is ignored, matching the hardware's forgiving behaviour.
 */
export function pressCloseParen(
  state: ExpressionState,
  value: number,
): { state: ExpressionState; display: number } {
  if (state.parenDepth === 0) return { state, display: value };

  const { pending, value: acc } = reduce(state, value, null, state.parenDepth);
  return {
    state: { ...state, pending, parenDepth: state.parenDepth - 1 },
    display: acc,
  };
}

/** True when any operation or parenthesis is still outstanding. */
export function hasPendingWork(state: ExpressionState): boolean {
  return state.pending.length > 0 || state.parenDepth > 0;
}

/** Abandon all pending work, as CE/C and 2ND QUIT do (guidebook p. 6). */
export function clearPending(state: ExpressionState): ExpressionState {
  return { ...state, pending: [], parenDepth: 0 };
}
