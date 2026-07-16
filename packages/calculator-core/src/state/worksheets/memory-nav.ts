/**
 * The Memory worksheet (2ND MEM), and the standard-calculator memory keys that
 * front the same ten registers from outside any worksheet.
 *
 * TWO ROUTES TO ONE REGISTER FILE (guidebook pp. 16-17, 72-73).
 *
 *   Worksheet route -- 2ND MEM opens a plain ring of ten enter-only fields
 *   M0..M9 (p. 72-73). It is an ordinary `WorksheetDescriptor`: the generic
 *   engine in `../worksheet-nav.ts` drives every prompt, ENTER, wrap, and
 *   2ND CLR WORK from the field list. `MEMORY` below is the whole of it.
 *
 *   Standard route -- STO n, RCL n, and STO <op> n act in standard-calculator
 *   mode without entering any worksheet (p. 16-17). These are NOT navigation:
 *   STO is a prefix that spans the next one or two key presses, and the reducer
 *   is one key at a time, so the prefix needs somewhere to live between presses.
 *   `CalculatorState` carries no such scratch, so this module threads a small
 *   `MemorySession` beside it. When these keys are wired into the reducer
 *   centrally, machine.ts will own an equivalent latch (as it already does for
 *   the CPT and 2ND prefixes); until then the logic and its tests live here.
 *
 * WHY THE STANDARD ROUTE ALSO HANDLES 2ND K AND 2ND ANS. Constant arming and
 * Last Answer recall belong to the same guidebook section (pp. 18-19) and share
 * the same problem: the machine already CONSUMES a constant on `=` and updates
 * `ans` on ENTER/CPT/=/auto-compute, but nothing ARMS a constant or RECALLS the
 * answer, because the `2ND K` and `2ND ANS` keys are unwired. This module
 * supplies exactly those two missing halves and lets machine.ts do the rest.
 *
 * OPERAND ORDER IS LOAD-BEARING (p. 17). The register is always the LEFT operand
 * and the display the right: `STO - n` gives `Mn' = Mn - D`, not `D - Mn`. That
 * order lives in `../worksheets/memory-worksheet.ts`; this module only routes
 * keys to it. See that module's header for the two independent sources that pin
 * the order.
 *
 * THE DISPLAY DIVERGES BY ROUTE (p. 16, edge case #3). Standard `STO <op> n`
 * "changes only the value in the affected memory and not the displayed value":
 * the display is left exactly as keyed. The worksheet route instead assigns
 * through the field and shows the new value. Both perform identical arithmetic;
 * only the display effect differs, which is why they are separate code paths.
 *
 * Source: guidebook p. 16 (store/recall/clear, arithmetic invariants), p. 17
 * (operand order), p. 18 (constants), p. 19 (Last Answer), pp. 72-73 (the
 * Memory worksheet), p. 27 (the `=` display trap), pp. 84-85 (errors).
 */
import type { CalculatorState } from '../state.js';
import { type Key, isDigit } from '../keys.js';
import type { BinaryOp } from '../../math/operators.js';
import { toInternal } from '../../numeric/precision.js';
import { CalculatorError, type ErrorCode } from '../../errors.js';
import {
  type DisplayState,
  type Indicator,
} from '../display-state.js';
import {
  type FieldDescriptor,
  type WorksheetDescriptor,
  type WorksheetRegistry,
  enterWorksheet,
  reduceWorksheet,
  worksheetDisplay,
} from '../worksheet-nav.js';
import { reduce, project, currentValue } from '../machine.js';
import {
  type MemoryAddress,
  type MemoryOperation,
  MEMORY_ADDRESSES,
  clearAllMemories,
  memoryArithmetic,
  memoryLabel,
  recall,
  store,
} from '../../worksheets/memory-worksheet.js';

// ---------------------------------------------------------------------------
// The Memory worksheet descriptor (guidebook pp. 72-73)
// ---------------------------------------------------------------------------

/**
 * M0..M9, ten plain enter-only fields (p. 72-73). `get` reads the register,
 * `set` writes it. `set` receives a value already at internal precision, and
 * `store`'s own `toInternal` is idempotent on it, so no second rounding occurs
 * (worksheet-nav.ts §set contract, §1.4).
 */
const MEMORY_FIELDS: readonly FieldDescriptor[] = MEMORY_ADDRESSES.map(
  (n): FieldDescriptor => ({
    label: `${memoryLabel(n)}=`,
    kind: 'entry',
    get: (s) => recall(s.memories, n),
    set: (s, v) => ({ ...s, memories: store(s.memories, n, v) }),
  }),
);

/**
 * The Memory worksheet. 2ND CLR WORK zeroes all ten (p. 16, p. 73) -- this is
 * the ONE worksheet whose CLR WORK reaches the register file; every other
 * worksheet's CLR WORK spares it (p. 11).
 */
export const MEMORY: WorksheetDescriptor = {
  id: 'MEM',
  fields: MEMORY_FIELDS,
  clearWork: (s) => ({ ...s, memories: clearAllMemories() }),
};

/** The registry the standard route uses to open and drive 2ND MEM. */
const MEMORY_REGISTRY: WorksheetRegistry = Object.freeze({ MEM: MEMORY });

// ---------------------------------------------------------------------------
// The standard-calculator memory keys (guidebook pp. 16-19)
// ---------------------------------------------------------------------------

/**
 * The STO/RCL prefix, awaiting the register digit (and, for STO, possibly an
 * operator first). Held beside `CalculatorState` because the state carries no
 * field for it -- see the module header.
 */
type MemoryPrefix =
  | { readonly kind: 'store' }
  | { readonly kind: 'store-op'; readonly op: MemoryOperation }
  | { readonly kind: 'recall' };

/**
 * `CalculatorState` plus the scratch the memory keys need between presses:
 * a pending STO/RCL prefix, and a constant being armed by 2ND K whose operand
 * is not yet keyed (the p. 18 template order keys the operand AFTER 2ND K).
 */
export interface MemorySession {
  readonly calc: CalculatorState;
  readonly prefix: MemoryPrefix | null;
  /** 2ND K seen; the pending operator is captured, the operand is deferred. */
  readonly arming: BinaryOp | null;
}

export function newMemorySession(calc: CalculatorState): MemorySession {
  return { calc, prefix: null, arming: null };
}

/** The five operator keys that a STO prefix accepts (p. 17). */
const MEMORY_OP: Partial<Readonly<Record<Key, MemoryOperation>>> = Object.freeze({
  '+': 'add',
  '-': 'sub',
  '×': 'mul',
  '÷': 'div',
  'Y^X': 'pow',
});

const isEntryKey = (k: Key): boolean => isDigit(k) || k === '.' || k === '+/-';

const isMemMode = (calc: CalculatorState): boolean =>
  calc.mode.kind === 'worksheet' && calc.mode.worksheet === 'MEM';

/** Clear the modifier latches, mirroring machine.ts's `disarm`. */
const disarm = (calc: CalculatorState): CalculatorState => ({
  ...calc,
  secondArmed: false,
  invArmed: false,
  hypArmed: false,
  computeArmed: false,
});

/** Latch a calculator error, mirroring machine.ts's `latchError` (p. 84). */
function latch(calc: CalculatorState, code: ErrorCode): CalculatorState {
  return {
    ...calc,
    errorState: code,
    entryBuffer: null,
    secondArmed: false,
    invArmed: false,
    hypArmed: false,
    computeArmed: false,
  };
}

const delegate = (calc: CalculatorState, key: Key): MemorySession => ({
  calc: reduce(calc, key).state,
  prefix: null,
  arming: null,
});

/**
 * Complete an armed STO/RCL prefix with the key that follows it.
 *
 * A digit is the register address and is consumed here, NOT appended to the
 * display. `store`/`recall`/`memoryArithmetic` may throw (Error 1 on divide-by-
 * zero or overflow, Error 2 on an illegal negative-base power, pp. 84-85); the
 * throw is caught and latched exactly as the reducer would at its command edge.
 */
function completePrefix(session: MemorySession, key: Key): MemorySession {
  const { calc, prefix } = session;
  if (prefix === null) return session; // unreachable; the caller guards it

  try {
    if (prefix.kind === 'store') {
      if (isDigit(key)) {
        const n = Number(key) as MemoryAddress;
        const v = toInternal(currentValue(calc));
        // STO copies the displayed value and closes the entry, so a following
        // digit starts a fresh number; the shown NUMBER is unchanged (p. 16).
        return {
          calc: { ...calc, memories: store(calc.memories, n, v), entryBuffer: null, displayValue: v },
          prefix: null,
          arming: null,
        };
      }
      const op = MEMORY_OP[key];
      if (op !== undefined) return { ...session, prefix: { kind: 'store-op', op } };
      // A key that is neither a register nor an operator abandons the prefix.
      return reduceMemoryKey({ ...session, prefix: null }, key);
    }

    if (prefix.kind === 'store-op') {
      if (isDigit(key)) {
        const n = Number(key) as MemoryAddress;
        // Memory arithmetic leaves the display exactly as it was (p. 16): the
        // entry buffer and the committed value are both untouched here.
        return {
          calc: { ...calc, memories: memoryArithmetic(calc.memories, prefix.op, n, currentValue(calc)) },
          prefix: null,
          arming: null,
        };
      }
      return reduceMemoryKey({ ...session, prefix: null }, key);
    }

    // recall
    if (isDigit(key)) {
      const n = Number(key) as MemoryAddress;
      // RCL brings the full internal value onto the display (p. 16, MEM-6).
      return {
        calc: { ...calc, entryBuffer: null, displayValue: recall(calc.memories, n) },
        prefix: null,
        arming: null,
      };
    }
    return reduceMemoryKey({ ...session, prefix: null }, key);
  } catch (e) {
    if (e instanceof CalculatorError) return { calc: latch(calc, e.code), prefix: null, arming: null };
    throw e; // a genuine defect, not a calculator condition
  }
}

/**
 * 2ND K: arm a constant (p. 18).
 *
 * Only the operator is captured now, from the pending operation. The operand is
 * deferred to the next `%` or `=`, which is what lets a single rule accept BOTH
 * of the page's contradictory key orders (worked example `n OP c 2ND K =`, and
 * template `n OP 2ND K c =`): in both, the operand is whatever sits on the
 * display when that terminator arrives. With no pending operator there is
 * nothing to arm and 2ND K is inert.
 */
function armConstant(session: MemorySession): MemorySession {
  const { calc } = session;
  const top = calc.pendingOps[calc.pendingOps.length - 1];
  const base = disarm(calc);
  if (top === undefined) return { calc: base, prefix: null, arming: null };
  return { calc: base, prefix: null, arming: top.op };
}

/**
 * Finalise a deferred constant on its seeding `%` or `=`, then let the real
 * reducer run that key.
 *
 * The operand is the current display; `%` marks it a percentage so the constant
 * re-evaluates against each later entry (p. 18 percent templates), which is the
 * form machine.ts's `pressEqualsKey` already applies via `percentOfBase`. The
 * seeding key itself still resolves the original calculation, because a pending
 * operation is present and `pressEqualsKey`/`pressPercent` take their normal
 * path and carry the constant through.
 */
function finalizeConstant(session: MemorySession, key: '=' | '%'): MemorySession {
  const { calc, arming } = session;
  if (arming === null) return session; // unreachable; the caller guards it
  const constant = { op: arming, operand: currentValue(calc), isPercent: key === '%' };
  return { calc: reduce({ ...calc, constant }, key).state, prefix: null, arming: null };
}

/** 2ND ANS: recall the last answer onto the display as an operand (p. 19). */
function recallAns(calc: CalculatorState): CalculatorState {
  return { ...disarm(calc), entryBuffer: null, displayValue: calc.ans };
}

/**
 * Route one key through the memory layer.
 *
 * Ownership, in order: an armed STO/RCL prefix; the memory keys themselves
 * (STO, RCL, 2ND K, 2ND ANS, 2ND MEM); the seeding terminator of a deferred
 * constant; the Memory worksheet's navigation; and finally everything else,
 * which the real reducer handles -- digits, operators, `=` (including applying
 * an armed constant), `%`, other worksheets, clearing, QUIT and power. Latched
 * errors are handed straight to the reducer, which gates them to CE/C (p. 84).
 */
export function reduceMemoryKey(session: MemorySession, key: Key): MemorySession {
  const { calc, prefix, arming } = session;

  if (calc.errorState !== null) return delegate(calc, key);
  if (prefix !== null) return completePrefix(session, key);

  switch (key) {
    case 'STO':
      return { calc: disarm(calc), prefix: { kind: 'store' }, arming: null };
    case 'RCL':
      return { calc: disarm(calc), prefix: { kind: 'recall' }, arming: null };
    case 'K':
      return armConstant(session);
    case 'ANS':
      return { calc: recallAns(calc), prefix: null, arming: null };
    case 'MEM':
      return { calc: disarm(enterWorksheet(disarm(calc), 'MEM', MEMORY_REGISTRY)), prefix: null, arming: null };
    default:
      break;
  }

  if (arming !== null) {
    if (key === '=' || key === '%') return finalizeConstant(session, key);
    // Keying the constant's operand (template order): build it, keep the arm.
    if (isEntryKey(key)) return { calc: reduce(calc, key).state, prefix: null, arming };
    // Any structural key abandons the arm; let the reducer have the key.
    return delegate(calc, key);
  }

  if (isMemMode(calc)) {
    const next = reduceWorksheet(calc, key, MEMORY_REGISTRY);
    if (next !== null) return { calc: disarm(next), prefix: null, arming: null };
  }

  return delegate(calc, key);
}

/** Fold a whole key sequence, for tests and for replaying recorded runs. */
export function reduceMemoryKeys(calc: CalculatorState, keys: readonly Key[]): MemorySession {
  let s = newMemorySession(calc);
  for (const k of keys) s = reduceMemoryKey(s, k);
  return s;
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/** The global annunciators, mirroring machine.ts's `indicatorsFor`. */
function globalIndicators(calc: CalculatorState): Indicator[] {
  const ind: Indicator[] = [];
  if (calc.secondArmed) ind.push('2nd');
  if (calc.invArmed) ind.push('INV');
  if (calc.hypArmed) ind.push('HYP');
  if (calc.format.angleUnit === 'RAD') ind.push('RAD');
  if (calc.tvm.mode === 'BGN') ind.push('BGN');
  return ind;
}

/**
 * Project the LCD for a session.
 *
 * Inside the Memory worksheet the field-aware projection owns the screen (label,
 * ENTER/UP/DOWN prompts, and the `=` trap of p. 27); everywhere else -- standard
 * mode, an armed STO/RCL prefix, another worksheet, a latched error -- the
 * machine's own `project` already renders correctly, since none of those depend
 * on the MEM descriptor.
 */
export function memoryDisplay(session: MemorySession): DisplayState {
  const { calc } = session;
  if (calc.errorState === null && isMemMode(calc)) {
    const fmt = { decimals: calc.format.DEC, separator: calc.format.separators };
    const d = worksheetDisplay(calc, MEMORY_REGISTRY, fmt, globalIndicators(calc));
    if (d !== null) return d;
  }
  return project(calc);
}
