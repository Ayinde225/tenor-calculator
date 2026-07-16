/**
 * The reducer.
 *
 *     reduce(state, key) -> { state, display }
 *
 * Pure and total: no exception escapes this boundary. The worksheet functions
 * throw `CalculatorError` freely, and the reducer catches at the command edge and
 * converts to a latched error state. That mirrors the hardware -- an error holds
 * the display until CE/C -- and keeps the maths layer free of display concerns.
 *
 * Pipeline (docs/ENGINE-DESIGN.md §5.1):
 *
 *   1. error latched?  -> only CE/C is live; everything else is swallowed (p. 84)
 *   2. resolve the 2ND / INV / HYP latches into a logical function (§6)
 *   3. dispatch by mode: standard-calculator vs a prompted worksheet
 *   4. execute (pure worksheet functions may throw)
 *   5. catch CalculatorError -> latch errorState
 *   6. project the display from the new state
 *
 * `display` is returned beside the state rather than stored in it: it is a pure
 * projection of (state, DEC, separators), and storing it would create a second
 * source of truth for the same fact.
 */
import { CalculatorError, ErrorCode } from '../errors.js';
import { toInternal } from '../numeric/precision.js';
import { applyBinary, bindsTighterOrEqual, factorial, type BinaryOp } from '../math/operators.js';
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
  round as roundToDisplay,
  percentOf,
  percentOfBase,
} from '../math/functions.js';
import { MAX_PAREN_DEPTH, MAX_PENDING_OPS } from '../math/expression-engine.js';
import {
  type CalculatorState,
  type PendingOp,
  INITIAL_STATE,
  persist,
  restoreAfterPowerOff,
} from './state.js';
import {
  type DisplayState,
  type Indicator,
  errorDisplayState,
  makeDisplay,
  renderEntry,
  renderValue,
} from './display-state.js';
import { type Key, isDigit } from './keys.js';
import { computeTvm, type TvmVariable } from '../worksheets/tvm.js';
import {
  store,
  recall,
  memoryArithmetic,
  isMemoryAddress,
  type MemoryAddress,
  type MemoryOperation,
} from '../worksheets/memory-worksheet.js';
import {
  WORKSHEET_ENTRY_KEYS,
  enterWorksheet,
  reduceWorksheet,
  worksheetDisplay,
} from './worksheet-nav.js';
import { WORKSHEETS } from './worksheet-registry.js';

export interface ReduceResult {
  readonly state: CalculatorState;
  readonly display: DisplayState;
}

/** The value the machine is currently "holding" -- buffer if mid-entry, else committed. */
export function currentValue(state: CalculatorState): number {
  if (state.entryBuffer === null) return state.displayValue;
  const n = Number(state.entryBuffer);
  return Number.isFinite(n) ? n : 0;
}

function indicatorsFor(state: CalculatorState): Indicator[] {
  const ind: Indicator[] = [];
  if (state.secondArmed) ind.push('2nd');
  if (state.invArmed) ind.push('INV');
  if (state.hypArmed) ind.push('HYP');
  if (state.format.angleUnit === 'RAD') ind.push('RAD');
  if (state.tvm.mode === 'BGN') ind.push('BGN');
  return ind;
}

/** Project the display from state. Never mutates. */
export function project(state: CalculatorState): DisplayState {
  if (state.errorState !== null) return errorDisplayState(state.errorState);

  // 2ND RESET has been pressed and is waiting for confirmation: the LCD shows the
  // `RST ?` prompt with the ENTER annunciator lit (p. 11). It owns the whole
  // display until ENTER confirms or 2ND QUIT cancels.
  if (state.resetArmed) return makeDisplay('RST ?', '', ['ENTER']);

  const fmt = { decimals: state.format.DEC, separator: state.format.separators };
  const ind = indicatorsFor(state);

  // A displayed worksheet field owns the whole LCD: the label, the annunciator
  // prompts, and the `=` cue that says the number belongs to the label (p. 27).
  // Null means the mode names a worksheet with no descriptor yet, which renders
  // as standard mode rather than crashing.
  if (state.mode.kind === 'worksheet') {
    const d = worksheetDisplay(state, WORKSHEETS, fmt, ind);
    if (d !== null) return d;
  }

  if (state.entryBuffer !== null) return renderEntry(state.entryBuffer, fmt, '', ind);
  return renderValue(state.displayValue, fmt, '', ind);
}

const result = (state: CalculatorState): ReduceResult => ({ state, display: project(state) });

/** Latch an error. The display holds `Error <n>` until CE/C (p. 84). */
function latchError(state: CalculatorState, code: ErrorCode): CalculatorState {
  return {
    ...state,
    errorState: code,
    entryBuffer: null,
    secondArmed: false,
    invArmed: false,
    hypArmed: false,
    computeArmed: false,
  };
}

/** Clear the modifier latches. Called once a key consumes them. */
const disarm = (s: CalculatorState): CalculatorState => ({
  ...s,
  secondArmed: false,
  invArmed: false,
  hypArmed: false,
  computeArmed: false,
});

// ---------------------------------------------------------------------------
// Number entry
// ---------------------------------------------------------------------------

function pressDigit(state: CalculatorState, key: Key): CalculatorState {
  const buf = state.entryBuffer ?? '';
  // The hardware accepts 10 displayed digits; further presses are ignored.
  const digitCount = buf.replace(/[-.]/g, '').length;
  if (digitCount >= 10) return state;
  return { ...state, entryBuffer: buf === '0' ? key : buf + key };
}

function pressPoint(state: CalculatorState): CalculatorState {
  const buf = state.entryBuffer ?? '0';
  if (buf.includes('.')) return state; // a second point is ignored
  return { ...state, entryBuffer: buf + '.' };
}

/**
 * +/- toggles the sign. Mid-entry it flips the buffer; on a committed value it
 * negates it. The hardware has no minus key -- you key the magnitude and then
 * press +/- (p. 26).
 */
function pressSign(state: CalculatorState): CalculatorState {
  if (state.entryBuffer !== null) {
    const buf = state.entryBuffer;
    return { ...state, entryBuffer: buf.startsWith('-') ? buf.slice(1) : '-' + buf };
  }
  return { ...state, displayValue: negate(state.displayValue) };
}

/** Backspace deletes one keyed character, decimal points included (TI KB 11231). */
function pressBackspace(state: CalculatorState): CalculatorState {
  if (state.entryBuffer === null) return { ...state, displayValue: 0 };
  const next = state.entryBuffer.slice(0, -1);
  return { ...state, entryBuffer: next === '' || next === '-' ? null : next };
}

/** Commit the entry buffer into the display value. */
function commit(state: CalculatorState): CalculatorState {
  if (state.entryBuffer === null) return state;
  return { ...state, entryBuffer: null, displayValue: toInternal(currentValue(state)) };
}

// ---------------------------------------------------------------------------
// Expression evaluation (CHN / AOS)
// ---------------------------------------------------------------------------

function reduceStack(
  state: CalculatorState,
  value: number,
  incoming: BinaryOp | null,
  minDepth: number,
): { pending: PendingOp[]; value: number } {
  const pending = [...state.pendingOps];
  let acc = value;

  while (pending.length > 0) {
    const top = pending[pending.length - 1]!;
    if (top.depth < minDepth) break;
    if (incoming !== null) {
      const shouldComplete =
        state.format.calcMethod === 'CHN' || bindsTighterOrEqual(top.op, incoming);
      if (!shouldComplete) break;
    }
    pending.pop();
    acc = applyBinary(top.op, top.operand, acc);
  }
  return { pending, value: acc };
}

function pressOperatorKey(state: CalculatorState, op: BinaryOp): CalculatorState {
  const s = commit(state);
  const { pending, value } = reduceStack(s, s.displayValue, op, s.parenLevels);

  if (pending.length >= MAX_PENDING_OPS) {
    throw new CalculatorError(
      ErrorCode.TooManyPendingOperations,
      `more than ${MAX_PENDING_OPS} pending operations`,
    );
  }
  pending.push({ op, operand: value, depth: s.parenLevels });
  return { ...s, pendingOps: pending, displayValue: value };
}

/**
 * Complete every pending operation and clear the stack, leaving the result on the
 * display. Shared by `=` and by worksheet ENTER: keying `10 / 12 ENTER` into a
 * worksheet field must store 0.8333..., not the bare 12, because the division is
 * a pending operation the ENTER has to settle first (guidebook p. 49 lease).
 */
export function settlePending(state: CalculatorState): CalculatorState {
  const s = commit(state);
  const { value } = reduceStack(s, s.displayValue, null, 0);
  const v = toInternal(value);
  return { ...s, pendingOps: [], parenLevels: 0, displayValue: v };
}

function pressEqualsKey(state: CalculatorState): CalculatorState {
  const s = commit(state);

  // Finalise a deferred-operand constant (p. 18 template `n <op> 2ND K c =`): the
  // operand `c` is now on the display. Capture it, then fall through to the normal
  // pending evaluation so this first `=` still computes `n <op> c`.
  if (s.constantArming !== null) {
    const armed: CalculatorState = {
      ...s,
      constant: {
        op: s.constantArming.op,
        operand: s.displayValue,
        isPercent: s.constantArming.isPercent,
      },
      constantArming: null,
    };
    const { value } = reduceStack(armed, armed.displayValue, null, 0);
    const v = toInternal(value);
    return { ...armed, pendingOps: [], parenLevels: 0, displayValue: v, ans: v };
  }

  // An armed constant re-applies its operation on every = (p. 18).
  if (s.constant !== null && s.pendingOps.length === 0) {
    const { op, operand, isPercent } = s.constant;
    const rhs = isPercent ? percentOfBase(s.displayValue, operand) : operand;
    const value = applyBinary(op, s.displayValue, rhs);
    return { ...s, displayValue: value, ans: value };
  }

  const { value } = reduceStack(s, s.displayValue, null, 0);
  const v = toInternal(value);
  return { ...s, pendingOps: [], parenLevels: 0, displayValue: v, ans: v };
}

function pressOpenParen(state: CalculatorState): CalculatorState {
  if (state.parenLevels >= MAX_PAREN_DEPTH) {
    throw new CalculatorError(
      ErrorCode.TooManyPendingOperations,
      `more than ${MAX_PAREN_DEPTH} parenthesis levels`,
    );
  }
  return { ...state, parenLevels: state.parenLevels + 1 };
}

function pressCloseParen(state: CalculatorState): CalculatorState {
  const s = commit(state);
  if (s.parenLevels === 0) return s; // an unmatched ) is ignored
  const { pending, value } = reduceStack(s, s.displayValue, null, s.parenLevels);
  return { ...s, pendingOps: pending, parenLevels: s.parenLevels - 1, displayValue: value };
}

/**
 * The percent key is context-sensitive (p. 12).
 *
 * After x or /, it scales by 1/100. After + or -, it means "that percentage OF
 * the first operand", so `498 + 7 % =` gives 532.86 rather than 498.07. The
 * guidebook prints no formula for either branch; both are inferred from its four
 * worked examples, which are mutually consistent.
 */
function pressPercent(state: CalculatorState): CalculatorState {
  // While a constant is arming (2ND K seen, operand being keyed), `%` marks the
  // constant as a percentage rather than computing one: `n + 2ND K c % =` stores
  // "add c% of each entry", so the operand `c` must survive to `=` unscaled (p. 18).
  if (state.constantArming !== null) {
    return { ...state, constantArming: { ...state.constantArming, isPercent: true } };
  }

  const s = commit(state);
  const top = s.pendingOps[s.pendingOps.length - 1];

  if (top && (top.op === 'add' || top.op === 'sub')) {
    return { ...s, displayValue: percentOfBase(top.operand, s.displayValue) };
  }
  return { ...s, displayValue: percentOf(s.displayValue) };
}

// ---------------------------------------------------------------------------
// Unary functions, resolved through the modifier latches (§6.3)
// ---------------------------------------------------------------------------

function applyTrig(state: CalculatorState, key: 'SIN' | 'COS' | 'TAN', x: number): number {
  const unit = state.format.angleUnit;
  const hyp = state.hypArmed;
  const inv = state.invArmed;

  if (hyp && inv) {
    return key === 'SIN' ? arcsinh(x) : key === 'COS' ? arccosh(x) : arctanh(x);
  }
  if (hyp) {
    return key === 'SIN' ? sinh(x) : key === 'COS' ? cosh(x) : tanh(x);
  }
  if (inv) {
    return key === 'SIN' ? arcsine(x, unit) : key === 'COS' ? arccosine(x, unit) : arctangent(x, unit);
  }
  return key === 'SIN' ? sine(x, unit) : key === 'COS' ? cosine(x, unit) : tangent(x, unit);
}

function pressUnary(state: CalculatorState, key: Key): CalculatorState {
  const s = commit(state);
  const x = s.displayValue;

  let value: number;
  switch (key) {
    case 'X^2':
      value = square(x);
      break;
    case '√X':
      value = squareRoot(x);
      break;
    case '1/X':
      value = reciprocal(x);
      break;
    case 'X!':
      value = factorial(x);
      break;
    case 'LN':
      value = naturalLog(x);
      break;
    case 'E^X':
      value = naturalExp(x);
      break;
    case 'ROUND':
      value = roundToDisplay(x, s.format.DEC);
      break;
    case 'SIN':
    case 'COS':
    case 'TAN':
      value = applyTrig(s, key, x);
      break;
    default:
      return s;
  }
  return { ...disarm(s), displayValue: value };
}

// ---------------------------------------------------------------------------
// TVM
// ---------------------------------------------------------------------------

const TVM_KEY_TO_VAR: Readonly<Record<string, TvmVariable>> = Object.freeze({
  N: 'N',
  'I/Y': 'IY',
  PV: 'PV',
  PMT: 'PMT',
  FV: 'FV',
});

/** Store the displayed value into a TVM register (p. 27). */
function storeTvm(state: CalculatorState, key: string): CalculatorState {
  const s = commit(state);
  const v = TVM_KEY_TO_VAR[key]!;
  return { ...s, tvm: { ...s.tvm, [v]: s.displayValue } };
}

/** CPT then a TVM key computes that variable (p. 27). */
function computeTvmKey(state: CalculatorState, key: string): CalculatorState {
  const s = commit(state);
  const v = TVM_KEY_TO_VAR[key]!;
  const value = computeTvm(s.tvm, v);
  return { ...s, tvm: { ...s.tvm, [v]: value }, displayValue: value, ans: value };
}

/**
 * xP/Y: multiply the displayed value by P/Y (p. 27).
 *
 * A convenience for entering years rather than periods -- `30 2ND xP/Y N` stores
 * 360 when P/Y is 12. It does not commit to N by itself; the following N does.
 */
function pressPaymentMultiplier(state: CalculatorState): CalculatorState {
  const s = commit(state);
  return { ...s, displayValue: toInternal(s.displayValue * s.tvm.PY) };
}

// ---------------------------------------------------------------------------
// Clearing (TI KB 11231, guidebook p. 11)
// ---------------------------------------------------------------------------

/**
 * CE/C.
 *
 * Clears an entry, an error, or an unfinished calculation -- but NOT worksheet
 * values. Whether it also unwinds the operator stack is not stated anywhere
 * (OPEN-QUESTIONS: ERR-3). We clear it: the alternative leaves an Error 3
 * unrecoverable without 2ND QUIT, which cannot be the intent.
 */
function pressClear(state: CalculatorState): CalculatorState {
  return {
    ...disarm(state),
    entryBuffer: null,
    displayValue: 0,
    errorState: null,
    pendingOps: [],
    parenLevels: 0,
  };
}

/** 2ND QUIT: leave any worksheet, drop pending work, show zero (p. 11). */
function pressQuit(state: CalculatorState): CalculatorState {
  return {
    ...disarm(state),
    mode: { kind: 'standard' },
    entryBuffer: null,
    displayValue: 0,
    pendingOps: [],
    parenLevels: 0,
  };
}

/** 2ND CLR TVM: reset only the five TVM registers (p. 26). P/Y, C/Y and END/BGN survive. */
function pressClearTvm(state: CalculatorState): CalculatorState {
  return {
    ...disarm(state),
    tvm: { ...state.tvm, N: 0, IY: 0, PV: 0, PMT: 0, FV: 0 },
    entryBuffer: null,
    displayValue: 0,
  };
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Standard-mode memory, Last Answer, and the constant
// ---------------------------------------------------------------------------

/** The five operators a STO prefix accepts (guidebook p. 17). */
const MEMORY_OP: Partial<Readonly<Record<Key, MemoryOperation>>> = Object.freeze({
  '+': 'add',
  '-': 'sub',
  '×': 'mul',
  '÷': 'div',
  'Y^X': 'pow',
});

/**
 * Resolve a pending STO/RCL prefix with the key that follows it.
 *
 * A digit picks the register and completes the operation. An operator, after a
 * plain `STO`, upgrades the prefix to `STO <op>` and waits for the register.
 * Anything else abandons the prefix and is handled normally -- the hardware does
 * not trap you in a half-finished STO.
 *
 * STO and STO-arithmetic leave the display untouched (p. 16); only RCL changes it.
 */
function resolveMemoryPrefix(
  state: CalculatorState,
  prefix: NonNullable<CalculatorState['memoryPrefix']>,
  key: Key,
): CalculatorState {
  if (isDigit(key)) {
    const n = Number(key);
    if (!isMemoryAddress(n)) return { ...state, memoryPrefix: null };
    const addr: MemoryAddress = n;

    switch (prefix.kind) {
      case 'store':
        return { ...state, memories: store(state.memories, addr, state.displayValue), memoryPrefix: null };
      case 'store-op':
        return {
          ...state,
          memories: memoryArithmetic(state.memories, prefix.op, addr, state.displayValue),
          memoryPrefix: null,
        };
      case 'recall': {
        const v = recall(state.memories, addr);
        return { ...state, displayValue: v, entryBuffer: null, memoryPrefix: null };
      }
    }
  }

  const op = MEMORY_OP[key];
  if (op !== undefined && prefix.kind === 'store') {
    return { ...state, memoryPrefix: { kind: 'store-op', op } };
  }

  // Not part of the STO/RCL grammar: drop the prefix and let the key act.
  return dispatch({ ...state, memoryPrefix: null }, key);
}

/** 2ND ANS: recall the Last Answer as the current operand (p. 19). */
function pressLastAnswer(state: CalculatorState): CalculatorState {
  return { ...disarm(state), displayValue: state.ans, entryBuffer: null };
}

/**
 * In-place arithmetic inside the Memory worksheet (p. 73).
 *
 * On a memory field, an operator arms `worksheetMemOp` and the following ENTER
 * applies `M<field> = M<field> <op> keyed`, then redisplays the register. This is
 * distinct from the standard-mode STO grammar: here the operand is keyed normally
 * and there is no register digit, because the register is the field you are on.
 *
 * Returns null for keys it does not own, so navigation and digit entry fall
 * through to the generic worksheet handling.
 */
function reduceMemoryWorksheet(state: CalculatorState, key: Key): CalculatorState | null {
  if (state.mode.kind !== 'worksheet' || state.mode.worksheet !== 'MEM') return null;

  const op = MEMORY_OP[key];
  if (op !== undefined) {
    return { ...commit(state), worksheetMemOp: op };
  }

  if (key === 'ENTER' && state.worksheetMemOp !== null) {
    const memOp = state.worksheetMemOp;
    const s = commit(state);
    const addr = s.mode.kind === 'worksheet' ? s.mode.field : 0;
    if (!isMemoryAddress(addr)) return { ...s, worksheetMemOp: null };
    const memories = memoryArithmetic(s.memories, memOp, addr, s.displayValue);
    return {
      ...s,
      memories,
      displayValue: recall(memories, addr),
      entryBuffer: null,
      worksheetMemOp: null,
    };
  }

  return null;
}

/**
 * 2ND K: arm the constant from the pending operation (p. 18).
 *
 * Two printed forms (p. 18), distinguished by whether the operand is already keyed:
 *
 *   `3 x 8 2ND K =`      -- operand 8 is on the display: capture (x, 8) immediately.
 *   `10 + 2ND K 5 =`     -- operator pending, operand not yet keyed: DEFER, arming
 *                           the operator now and finalising the operand at `=`.
 *
 * The pending operation is left in place either way, so the first `=` still
 * evaluates `n <op> c`; every later `=` re-applies `<op> c` (pressEqualsKey).
 * With no pending operator there is nothing to capture.
 */
function pressConstantArm(state: CalculatorState): CalculatorState {
  const top = state.pendingOps[state.pendingOps.length - 1];
  if (top === undefined) return disarm(state);

  // Operand already keyed (entry buffer live): capture it now.
  if (state.entryBuffer !== null) {
    const s = commit(state);
    return { ...disarm(s), constant: { op: top.op, operand: s.displayValue, isPercent: false } };
  }

  // Operand deferred: arm the operator, finalise the operand at the next `=`.
  return { ...disarm(state), constantArming: { op: top.op, isPercent: false } };
}

/**
 * Apply one key press.
 *
 * Total: every failure is converted into a latched error rather than thrown.
 */
export function reduce(state: CalculatorState, key: Key): ReduceResult {
  // 0. Powered off: only ON/OFF is live.
  if (!state.poweredOn) {
    if (key === 'ON/OFF') {
      return result(restoreAfterPowerOff(persist(state)));
    }
    return result(state);
  }

  // 1. An error latches the display until CE/C (p. 84). 2ND RESET is refused
  //    until then (p. 11), so no key may sneak past this gate but CE/C.
  if (state.errorState !== null) {
    if (key === 'CE/C') return result(pressClear(state));
    if (key === 'ON/OFF') return result({ ...state, poweredOn: false });
    return result(state);
  }

  try {
    return result(dispatch(state, key));
  } catch (e) {
    if (e instanceof CalculatorError) return result(latchError(state, e.code));
    throw e; // a genuine defect, not a calculator condition
  }
}

function dispatch(state: CalculatorState, key: Key): CalculatorState {
  // 2ND RESET is armed and waiting for confirmation (p. 11). ENTER performs the
  // hard reset; 2ND QUIT cancels; anything else also cancels and is then handled
  // normally, since the guidebook commits only to those two outcomes and a
  // stranded RST prompt would be worse than a lenient cancel.
  if (state.resetArmed) {
    if (key === 'ENTER') return INITIAL_STATE;
    if (key === '2ND') return { ...state, secondArmed: true }; // lets 2ND QUIT cancel
    return dispatch({ ...state, resetArmed: false }, key);
  }

  // A STO/RCL prefix is pending: the next key names the register (or, after a
  // plain STO, an operator). Resolved before anything else so the register digit
  // is not mistaken for number entry (p. 16).
  if (state.memoryPrefix !== null) {
    return resolveMemoryPrefix(state, state.memoryPrefix, key);
  }

  // 2. The modifier latches.
  if (key === '2ND') {
    // Pressing 2ND twice disarms. There is no 2ND-of-2ND function (p. 7).
    return { ...state, secondArmed: !state.secondArmed };
  }
  if (key === 'INV') {
    // INV is itself a second-level prefix: the following trig key needs no 2ND.
    return { ...state, invArmed: true, secondArmed: false };
  }
  if (key === 'HYP') {
    return { ...state, hypArmed: true, secondArmed: false };
  }

  if (key === 'ON/OFF') {
    // Powering down deliberately: Constant Memory keeps the worksheets, memories
    // and formats; the display, error and pending work are dropped on wake (p. 6).
    return { ...state, poweredOn: false };
  }

  // SET is the second function of the ENTER key, so `2ND ENTER` is `2ND SET`. The
  // corpus records the p. 58 depreciation year-bump in that physical spelling
  // while other cases use the SET token; both must cycle the setting.
  if (state.secondArmed && key === 'ENTER') {
    return dispatch(state, 'SET');
  }

  // 3. The prompted worksheets.
  //
  // An entry key is checked before navigation so that `2ND PROFIT` pressed inside
  // AMORT switches worksheets rather than being swallowed, and so that `2ND
  // AMORT` pressed inside AMORT returns to P1 -- which p. 28 offers as the
  // alternative to pressing `↓` from INT.
  const opens = WORKSHEET_ENTRY_KEYS[key];
  if (opens !== undefined) return disarm(enterWorksheet(state, opens, WORKSHEETS));

  // The Memory worksheet claims operator keys and ENTER-after-operator for its
  // in-place arithmetic, before the generic navigation or the standard operator
  // handling can see them (p. 73).
  const mem = reduceMemoryWorksheet(state, key);
  if (mem !== null) return disarm(mem);

  // Navigation claims only the keys it owns; everything else falls through to the
  // standard-calculator handling below and stays live inside the worksheet. That
  // is deliberate. p. 22: "You can assign values to TVM variables while in a
  // prompted worksheet". p. 41 uses `2ND xP/Y` inside AMORT to key 5 years as 60
  // payments. Those keys leave a number on the LCD that does not belong to the
  // displayed label, which is precisely the p. 27 trap the `=` indicator marks.
  if (state.mode.kind === 'worksheet') {
    const next = reduceWorksheet(state, key, WORKSHEETS);
    if (next !== null) return disarm(next);
  }

  // 4. Dispatch.
  if (isDigit(key)) return pressDigit(state, key);

  switch (key) {
    case '.':
      return pressPoint(state);
    case '+/-':
      return pressSign(state);
    case 'BKSP':
      return pressBackspace(state);

    case '+':
      return pressOperatorKey(state, 'add');
    case '-':
      return pressOperatorKey(state, 'sub');
    case '×':
      return pressOperatorKey(state, 'mul');
    case '÷':
      return pressOperatorKey(state, 'div');
    case 'Y^X':
      return pressOperatorKey(state, 'pow');
    case 'NPR':
      return pressOperatorKey(state, 'npr');
    case 'NCR':
      return pressOperatorKey(state, 'ncr');
    case '=':
      return pressEqualsKey(state);
    case '(':
      return pressOpenParen(state);
    case ')':
      return pressCloseParen(state);
    case '%':
      return pressPercent(state);

    case 'X^2':
    case '√X':
    case '1/X':
    case 'X!':
    case 'LN':
    case 'E^X':
    case 'ROUND':
    case 'SIN':
    case 'COS':
    case 'TAN':
      return pressUnary(state, key);

    case 'CE/C':
      return pressClear(state);
    case 'QUIT':
      return pressQuit(state);
    case 'CLR TVM':
      return pressClearTvm(state);
    case 'RESET':
      // Arm the two-step confirmation: show `RST ?` and wait (p. 11). The armed
      // branch at the top of dispatch handles the ENTER/cancel that follows.
      return { ...disarm(state), resetArmed: true };

    case 'N':
    case 'I/Y':
    case 'PV':
    case 'PMT':
    case 'FV':
      // The same key stores or computes depending on whether CPT armed it (p. 27).
      return state.computeArmed
        ? disarm(computeTvmKey(state, key))
        : disarm(storeTvm(state, key));

    case 'xP/Y':
      return disarm(pressPaymentMultiplier(state));

    case 'STO':
      // A prefix: commit the display, then wait for the register (p. 16).
      return { ...disarm(commit(state)), memoryPrefix: { kind: 'store' } };
    case 'RCL':
      return { ...disarm(commit(state)), memoryPrefix: { kind: 'recall' } };
    case 'ANS':
      return pressLastAnswer(state);
    case 'K':
      return pressConstantArm(state);

    case 'CPT':
      // A prefix, not an action: it arms the next key.
      return { ...state, computeArmed: true, secondArmed: false };

    default:
      return disarm(state);
  }
}

/** Apply a sequence of keys, for tests and for replaying recorded sequences. */
export function reduceAll(state: CalculatorState, keys: readonly Key[]): ReduceResult {
  let s = state;
  let d = project(state);
  for (const k of keys) {
    const r = reduce(s, k);
    s = r.state;
    d = r.display;
  }
  return { state: s, display: d };
}

export { INITIAL_STATE };
