/**
 * The ten memory registers M0-M9, and the Memory worksheet that fronts them.
 *
 * This is the calculator's simplest state: ten slots addressed by the digit keys
 * 0-9, each holding any value inside the machine's range (guidebook p. 16).
 * Nothing here iterates, parses a date, or has a closed form to get wrong. What
 * it does have is an operand order that is stated only in prose, and two
 * keyboard routes that look like one feature and are not.
 *
 * TWO ROUTES, OPPOSITE DISPLAY BEHAVIOUR:
 *
 *   Standard calculator (p. 16-17)   STO n | RCL n | STO <op> n
 *       "Memory arithmetic changes only the value in the affected memory and not
 *       the displayed value", and it "does not complete any calculation in
 *       progress". The display is inert; the pending-operation stack is inert.
 *
 *   Memory worksheet (p. 73)         2ND MEM, scroll to Mn, <op> value ENTER
 *       The example table shows the display tracking the register after every
 *       ENTER: `M4= 160.00` once 65 is added to 95.
 *
 * Both routes perform identical arithmetic, so both land on `memoryArithmetic`
 * here. Their divergence is purely presentational, and presentation is the state
 * machine's job: this module never formats and never reports a display value.
 * The state machine must not share a code path between the two routes naively --
 * the arithmetic is shared, the display effect is not.
 *
 * OPERAND ORDER IS LOAD-BEARING. The register is always the LEFT operand and the
 * displayed value always the right:
 *
 *     STO +   n  ->  Mn' = Mn + D
 *     STO -   n  ->  Mn' = Mn - D
 *     STO x   n  ->  Mn' = Mn x D
 *     STO /   n  ->  Mn' = Mn / D
 *     STO y^x n  ->  Mn' = Mn ^ D
 *
 * TWO INDEPENDENT SOURCES AGREE, so this is not a judgement call:
 *
 *   p. 17 prose is decisive on its own. Each row names its operands in order:
 *   "Subtract the displayed value FROM the value stored in memory 3", "Divide
 *   the value in memory 5 BY the displayed value", "Raise the value in memory 4
 *   TO THE POWER OF the displayed value". It prints no operands and no Display
 *   column, so it is easy to read past -- but it is not ambiguous.
 *
 *   p. 73 confirms it with printed numbers: starting from M4 = 95, `+ 65 ENTER`
 *   -> 160.00, `- 30 ENTER` -> 130.00, `x 95 ENTER` -> 12,350.00, `/ 65 ENTER`
 *   -> 190.00, `y^x 2 ENTER` -> 36,100.00. Every step is register-op-display.
 *   The reverse order would give 65 - 160 and 2^190 instead.
 *
 * The reverse order is a plausible misreading of p. 17 alone, which is why the
 * p. 73 chain is reproduced row-by-row in the tests as a regression guard.
 *
 * ERRORS this module can raise (pp. 84-85):
 *   Error 1  a result outside the calculator range, and STO / n with zero
 *            displayed (division by zero).
 *   Error 2  STO y^x n where the register is negative and the displayed exponent
 *            is neither an integer nor the inverse of an integer (p. 14).
 * Both come out of `applyBinary`, which is the same arithmetic the keyboard's
 * own +, -, x, / and y^x keys use -- memory arithmetic is not a second
 * implementation of the four functions and must not become one.
 *
 * Error 3 is NOT reachable: memory arithmetic explicitly does not touch the
 * pending stack (p. 16). Error 4 is not reachable from the keypad either -- the
 * address space is exactly the ten digit keys, so no keystroke can name a
 * register outside 0-9. `assertAddress` guards the API boundary against a caller
 * that bypasses the `MemoryAddress` type; it is not a hardware condition.
 *
 * Registers survive power-off via Constant Memory (p. 16) and are zeroed by
 * `2ND RESET ENTER` (p. 10). Persistence is I/O and lives outside the engine.
 *
 * Source: guidebook p. 16 (store/recall/clear), p. 17 (memory arithmetic),
 * pp. 72-73 (Memory worksheet), p. 10 (reset), pp. 84-85 (errors).
 */
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';
import { applyBinary, type BinaryOp } from '../math/operators.js';

/** Register count. Fixed at ten by the digit keys that address them (p. 16). */
export const MEMORY_COUNT = 10;

/** A register address: exactly the ten digit keys 0-9 (p. 16). */
export type MemoryAddress = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/**
 * The register file, indexed by address. A ten-tuple rather than a record of
 * named fields because the hardware addresses these positionally -- `RCL 7` is
 * an index, not a name. The Mn labels exist only in the Memory worksheet's
 * display (p. 72-73) and are produced by `memoryLabel`.
 */
export type MemoryState = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

type MutableMemoryState = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/**
 * All ten registers zeroed. This is the state after `2ND MEM 2ND CLR WORK`
 * (p. 16, p. 73) and after `2ND RESET ENTER` (p. 10); the registers have no
 * other default, since a fresh machine and a cleared one are indistinguishable.
 */
export const MEMORY_DEFAULTS: MemoryState = Object.freeze([
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
] as const);

/** The ten addresses in worksheet scroll order, M0 first (p. 72-73). */
export const MEMORY_ADDRESSES: readonly MemoryAddress[] = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
] as const);

/**
 * The five operations memory arithmetic accepts (p. 17). A subset of the
 * keyboard's binary operators -- nPr and nCr have no STO form.
 */
export type MemoryOperation = Extract<BinaryOp, 'add' | 'sub' | 'mul' | 'div' | 'pow'>;

/** True when `n` names a register. The state machine's keystroke-level guard. */
export function isMemoryAddress(n: number): n is MemoryAddress {
  return Number.isInteger(n) && n >= 0 && n < MEMORY_COUNT;
}

function assertAddress(n: number): void {
  if (!isMemoryAddress(n)) {
    throw new CalculatorError(
      ErrorCode.OutOfRange,
      `memory address must be an integer 0-${MEMORY_COUNT - 1}, got ${n}`,
    );
  }
}

/** The label the Memory worksheet shows for a register, e.g. `M4` (p. 72-73). */
export function memoryLabel(n: MemoryAddress): string {
  return `M${n}`;
}

function write(state: MemoryState, n: MemoryAddress, value: number): MemoryState {
  const next: MutableMemoryState = [...state];
  next[n] = value;
  return next;
}

/**
 * `STO n` -- copy the displayed value into register n (p. 16).
 *
 * Unconditional: "the displayed value replaces any previous value stored in the
 * memory", with no confirmation step and no way to refuse. `toInternal` enforces
 * p. 16's "any numeric value within the range of the calculator" -- a value the
 * machine cannot represent cannot be stored, and says so with Error 1.
 *
 * The display is untouched and any pending calculation stays pending; neither is
 * modelled here because neither lives here.
 */
export function store(state: MemoryState, n: MemoryAddress, value: number): MemoryState {
  assertAddress(n);
  return write(state, n, toInternal(value));
}

/**
 * `RCL n` -- read register n (p. 16).
 *
 * Non-destructive: "the recalled number remains in memory", so the same value
 * can be recalled any number of times.
 *
 * Returns the full internal value, not a display value. Internal precision is 13
 * digits and the LCD renders at most 10 (p. 9), so a register can legitimately
 * hold more than any display can show, and RCL must hand back all of it.
 */
export function recall(state: MemoryState, n: MemoryAddress): number {
  assertAddress(n);
  return state[n];
}

/**
 * `0 STO n` -- clear one register, leaving the other nine alone (p. 11, p. 16).
 *
 * There is no dedicated clear-this-memory key; the guidebook's instruction is
 * literally "to clear an individual memory, store a zero value in it", so this
 * is `store(state, n, 0)` and deliberately nothing more.
 */
export function clearMemory(state: MemoryState, n: MemoryAddress): MemoryState {
  return store(state, n, 0);
}

/**
 * `2ND MEM 2ND CLR WORK` -- zero all ten registers at once (p. 16, p. 73).
 *
 * Takes no prior state: every register goes to zero regardless of what was
 * there, so the result is `MEMORY_DEFAULTS` itself. Safe to return the frozen
 * constant because `MemoryState` is immutable and every write here copies.
 *
 * The first half of that sequence enters the Memory worksheet, so the calculator
 * is left inside it showing `M0=`. p. 16 presents the whole thing as a plain
 * clear and never mentions a following `2ND QUIT`; that post-state is the state
 * machine's call, informed by p. 73. Nothing in the register file depends on it.
 */
export function clearAllMemories(): MemoryState {
  return MEMORY_DEFAULTS;
}

/**
 * `STO <op> n`, and the Memory worksheet's `<op> value ENTER` (p. 17, p. 73).
 *
 * "Perform a calculation with a stored value and store the result with a single
 * operation" -- the register is read, combined with the displayed value, and
 * written back in one step.
 *
 * @param displayed the right-hand operand. Register OP displayed, never the
 *   reverse; see the module comment for the p. 73 example that settles it.
 */
export function memoryArithmetic(
  state: MemoryState,
  op: MemoryOperation,
  n: MemoryAddress,
  displayed: number,
): MemoryState {
  assertAddress(n);
  return write(state, n, applyBinary(op, state[n], displayed));
}
