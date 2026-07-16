import { describe, it, expect } from 'vitest';
import {
  MEMORY_ADDRESSES,
  MEMORY_COUNT,
  MEMORY_DEFAULTS,
  clearAllMemories,
  clearMemory,
  isMemoryAddress,
  memoryArithmetic,
  memoryLabel,
  recall,
  store,
  type MemoryAddress,
  type MemoryState,
} from './memory-worksheet.js';
import { formatValue } from '../display/format.js';
import { toInternal } from '../numeric/precision.js';
import { CalculatorError, ErrorCode } from '../errors.js';

/** Every golden case in this section runs at the two-decimal default (p. 9). */
const shown = (v: number): string => formatValue(v, { decimals: 2, separator: 'US' });

/** What `RCL n` would put on the LCD -- the assertion the golden cases state. */
const shownAt = (s: MemoryState, n: MemoryAddress): string => shown(recall(s, n));

const expectError = (code: ErrorCode, fn: () => unknown): void => {
  try {
    fn();
    expect.unreachable('should have thrown');
  } catch (e) {
    expect(e).toBeInstanceOf(CalculatorError);
    expect((e as CalculatorError).code).toBe(code);
  }
};

describe('printed Memory Examples table (guidebook p. 16)', () => {
  // The printed table has a Press column but no Display column, so each golden
  // case asserts the resulting register content as a later RCL would show it.

  it('clears memory 4 by storing a zero value in it: 0 STO 4', () => {
    // golden: memory-and-last-answer-clear-memory-4-by-storing-zero
    const s = store(MEMORY_DEFAULTS, 4, 123.45);
    expect(shownAt(store(s, 4, 0), 4)).toBe('0.00');
    expect(shownAt(clearMemory(s, 4), 4)).toBe('0.00');
  });

  it('stores 14.95 in memory 3: 14.95 STO 3', () => {
    // golden: memory-and-last-answer-store-value-in-m3
    expect(shownAt(store(MEMORY_DEFAULTS, 3, 14.95), 3)).toBe('14.95');
  });

  it('recalls a value from memory 7 and leaves it there: RCL 7, RCL 7', () => {
    // golden: memory-and-last-answer-store-then-recall-round-trip
    // The CE/C between the store and the recalls is display state; what this
    // module owns is p. 16's "the recalled number remains in memory", so the
    // second RCL must produce the same value as the first.
    const s = store(MEMORY_DEFAULTS, 7, 14.95);
    expect(shownAt(s, 7)).toBe('14.95');
    expect(shownAt(s, 7)).toBe('14.95');
    expect(s).toEqual(store(MEMORY_DEFAULTS, 7, 14.95));
  });

  it('overwrites unconditionally, with no confirmation step', () => {
    const s = store(store(MEMORY_DEFAULTS, 3, 14.95), 3, -7);
    expect(recall(s, 3)).toBe(-7);
  });
});

describe('clearing (guidebook p. 10, p. 11, p. 16, p. 73)', () => {
  it('2ND MEM 2ND CLR WORK zeroes all ten registers at once', () => {
    // golden: memory-and-last-answer-clear-all-ten-memories
    const s = store(store(MEMORY_DEFAULTS, 3, 14.95), 8, 99);
    const cleared = clearAllMemories();
    expect(shownAt(cleared, 3)).toBe('0.00');
    // The golden note: M3 is asserted because M3 is one of the two registers the
    // sequence actually writes. All ten must read zero regardless.
    for (const n of MEMORY_ADDRESSES) expect(shownAt(cleared, n)).toBe('0.00');
    // ...and the pre-clear state is genuinely non-zero, so this is not vacuous.
    expect(recall(s, 3)).toBe(14.95);
    expect(recall(s, 8)).toBe(99);
  });

  it('0 STO n spares the other nine registers (p. 11)', () => {
    let s: MemoryState = MEMORY_DEFAULTS;
    for (const n of MEMORY_ADDRESSES) s = store(s, n, (n + 1) * 10);
    const cleared = clearMemory(s, 4);

    expect(recall(cleared, 4)).toBe(0);
    for (const n of MEMORY_ADDRESSES) {
      if (n !== 4) expect(recall(cleared, n)).toBe((n + 1) * 10);
    }
  });

  it('2ND RESET ENTER zeroes all ten memories (p. 10)', () => {
    // golden: memory-and-last-answer-reset-zeroes-all-memories
    // Reset is the state machine's keystroke, but its effect on the register
    // file is exactly MEMORY_DEFAULTS -- a reset machine and a cleared one are
    // indistinguishable here. Reset also restores DEC to 2, hence '0.00'.
    const s = store(MEMORY_DEFAULTS, 3, 14.95);
    expect(recall(s, 3)).toBe(14.95);
    expect(shownAt(MEMORY_DEFAULTS, 3)).toBe('0.00');
    for (const n of MEMORY_ADDRESSES) expect(recall(MEMORY_DEFAULTS, n)).toBe(0);
  });

  it('CLR WORK in another worksheet cannot touch the registers (p. 11, p. 19)', () => {
    // golden: memory-and-last-answer-clr-work-in-other-worksheet-spares-memories
    // Worksheet isolation is structural here rather than behavioural: no other
    // worksheet module accepts or returns a MemoryState, so nothing outside this
    // file can reach a register. What is testable is the property that makes
    // that safe -- MemoryState is frozen and every write copies, so a stale
    // reference held across an unrelated worksheet's clear still reads 14.95.
    const s = store(MEMORY_DEFAULTS, 3, 14.95);
    clearAllMemories();
    clearMemory(s, 3);
    store(s, 3, 0);
    expect(shownAt(s, 3)).toBe('14.95');
    expect(Object.isFrozen(MEMORY_DEFAULTS)).toBe(true);
  });

  it('leaves the input state untouched on every write', () => {
    const s = store(MEMORY_DEFAULTS, 1, 5);
    const before = [...s];
    store(s, 1, 999);
    memoryArithmetic(s, 'add', 1, 999);
    clearMemory(s, 1);
    expect([...s]).toEqual(before);
  });
});

describe('memory arithmetic (guidebook p. 17)', () => {
  it('STO + 9 adds the displayed value to M9', () => {
    // golden: memory-and-last-answer-sto-add-to-m9
    const s = store(MEMORY_DEFAULTS, 9, 100);
    expect(shownAt(memoryArithmetic(s, 'add', 9, 5), 9)).toBe('105.00');
  });

  it('STO - 3 subtracts the display FROM M3, not the reverse', () => {
    // golden: memory-and-last-answer-sto-subtract-from-m3
    const s = store(MEMORY_DEFAULTS, 3, 100);
    expect(shownAt(memoryArithmetic(s, 'sub', 3, 30), 3)).toBe('70.00');
    expect(shownAt(memoryArithmetic(s, 'sub', 3, 30), 3)).not.toBe('-70.00');
  });

  it('STO x 0 multiplies M0 by the displayed value', () => {
    // golden: memory-and-last-answer-sto-multiply-m0
    const s = store(MEMORY_DEFAULTS, 0, 12);
    expect(shownAt(memoryArithmetic(s, 'mul', 0, 5), 0)).toBe('60.00');
  });

  it('STO / 5 divides M5 BY the displayed value, not the reverse', () => {
    // golden: memory-and-last-answer-sto-divide-m5
    const s = store(MEMORY_DEFAULTS, 5, 100);
    expect(shownAt(memoryArithmetic(s, 'div', 5, 4), 5)).toBe('25.00');
    expect(shownAt(memoryArithmetic(s, 'div', 5, 4), 5)).not.toBe('0.04');
  });

  it('STO y^x 4 raises M4 to the displayed power, not the reverse', () => {
    // golden: memory-and-last-answer-sto-power-m4
    const s = store(MEMORY_DEFAULTS, 4, 3);
    // 3^2 = 9, not 2^3 = 8. The operands are chosen so the two orders differ.
    expect(shownAt(memoryArithmetic(s, 'pow', 4, 2), 4)).toBe('9.00');
    expect(shownAt(memoryArithmetic(s, 'pow', 4, 2), 4)).not.toBe('8.00');
  });

  it('changes only the targeted register', () => {
    let s: MemoryState = MEMORY_DEFAULTS;
    for (const n of MEMORY_ADDRESSES) s = store(s, n, 100);
    const after = memoryArithmetic(s, 'add', 9, 5);
    for (const n of MEMORY_ADDRESSES) {
      expect(recall(after, n)).toBe(n === 9 ? 105 : 100);
    }
  });
});

describe('the p. 73 Memory worksheet example table', () => {
  // The one place the guidebook prints memory arithmetic WITH operands and a
  // Display column. It runs the whole chain on M4 and confirms the operand order
  // that p. 17 states in prose.
  //
  // These seven rows ARE in the golden corpus -- not in memory-and-last-answer.json
  // but in tests/golden/other-worksheets.json, whose `other-worksheets-memory-*`
  // cases are this module's (guidebookPage 73, variable M4, these exact ops). No
  // other test file cites them, so this describe block is their only coverage.
  it('reproduces every row of the printed chain on M4', () => {
    // golden: other-worksheets-memory-clear-m4
    let s: MemoryState = store(MEMORY_DEFAULTS, 4, 0); // "Clear M4."  -> 0.00
    expect(shownAt(s, 4)).toBe('0.00');

    // golden: other-worksheets-memory-store
    s = store(s, 4, 95); // "Store 95."           95 ENTER      -> 95.00
    expect(shownAt(s, 4)).toBe('95.00');

    // golden: other-worksheets-memory-add
    s = memoryArithmetic(s, 'add', 4, 65); // "Add 65."   + 65 ENTER   -> 160.00
    expect(shownAt(s, 4)).toBe('160.00');

    // golden: other-worksheets-memory-subtract
    s = memoryArithmetic(s, 'sub', 4, 30); // "Subtract 30."  - 30 ENTER -> 130.00
    expect(shownAt(s, 4)).toBe('130.00');

    // golden: other-worksheets-memory-multiply
    s = memoryArithmetic(s, 'mul', 4, 95); // "Multiply by 95." x 95 ENTER -> 12,350.00
    expect(shownAt(s, 4)).toBe('12,350.00');

    // golden: other-worksheets-memory-divide
    s = memoryArithmetic(s, 'div', 4, 65); // "Divide by 65."  / 65 ENTER -> 190.00
    expect(shownAt(s, 4)).toBe('190.00');

    // golden: other-worksheets-memory-power
    s = memoryArithmetic(s, 'pow', 4, 2); // "Raise to 2nd power." y^x 2 ENTER -> 36,100.00
    expect(shownAt(s, 4)).toBe('36,100.00');
  });

  it('would not reproduce under the reversed operand order', () => {
    // The regression guard for the whole module. Under display-OP-register the
    // subtract row gives 65 - 160 = -95 and the divide row 65 / 12,350.
    const m4 = store(MEMORY_DEFAULTS, 4, 160);
    expect(recall(memoryArithmetic(m4, 'sub', 4, 65), 4)).toBe(95);
    expect(recall(memoryArithmetic(m4, 'sub', 4, 65), 4)).not.toBe(-95);
  });
});

describe('invariants the display model depends on (guidebook p. 16)', () => {
  it('leaves the display untouched: only the register moves', () => {
    // golden: memory-and-last-answer-memory-arithmetic-leaves-display-untouched
    // The golden expects DISPLAY '5' (unformatted echo). This module cannot make
    // that assertion -- it holds no display -- but it can assert the half that is
    // its own: `5 STO + 9` moves M9 and returns nothing the display could show.
    const s = store(MEMORY_DEFAULTS, 9, 100);
    const after = memoryArithmetic(s, 'add', 9, 5);
    expect(recall(after, 9)).toBe(105);
    // The displayed operand is an input, never a return value: nothing in this
    // module's surface can hand a caller a new display value.
    expect(after).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 105]);
  });

  it('does not complete a calculation in progress', () => {
    // golden: memory-and-last-answer-memory-arithmetic-does-not-complete-pending-calculation
    // `3 + 5 STO + 9 =` must apply 5 to M9 and still yield 8.00. The pending
    // stack is the expression engine's; what this module guarantees is the
    // precondition -- memory arithmetic takes the displayed operand and touches
    // nothing else, so there is no path from here to the pending stack.
    const s = store(MEMORY_DEFAULTS, 9, 0);
    const after = memoryArithmetic(s, 'add', 9, 5);
    expect(recall(after, 9)).toBe(5);
  });
});

describe('precision: registers out-precise the display (p. 9, p. 16)', () => {
  it('recalls the full 13-digit internal value, not the displayed one', () => {
    // p. 16 permits storing "any numeric value within the range of the
    // calculator" -- 13 significant digits -- while the LCD shows at most 10.
    const oneThird = toInternal(1 / 3);
    const s = store(MEMORY_DEFAULTS, 1, oneThird);
    expect(recall(s, 1)).toBe(0.3333333333333);
    expect(shown(recall(s, 1))).toBe('0.33');
    expect(formatValue(recall(s, 1), { decimals: 9, separator: 'US' })).toBe('0.3333333333');
  });

  it('normalises a stored value into the 13-digit store', () => {
    const s = store(MEMORY_DEFAULTS, 2, 1.23456789012345678);
    expect(recall(s, 2)).toBe(1.234567890123);
  });

  it('carries a stored sign intact -- no cash-flow convention applies here', () => {
    const s = store(MEMORY_DEFAULTS, 6, -14.95);
    expect(recall(s, 6)).toBe(-14.95);
    expect(shownAt(s, 6)).toBe('-14.95');
  });

  it('accumulates UNROUNDED values through STO + n (p. 34 ABC Company)', () => {
    // golden: tvm-variable-cash-flow-total-pv -- flagged "CRITICAL PRECISION TEST:
    // Memory must accumulate UNROUNDED values". That case lives in the TVM golden
    // file and needs CPT PV to run end-to-end, so the TVM module owns it; but the
    // property it is actually testing is this module's, and no test anywhere
    // asserted it. The four PVs are fed in directly here to pin the memory half.
    const pvs = [5000 / 1.1, 7000 / 1.21, 8000 / 1.331, 10000 / 1.4641].map(toInternal);

    let s: MemoryState = store(MEMORY_DEFAULTS, 1, pvs[0] as number);
    for (const pv of pvs.slice(1)) s = memoryArithmetic(s, 'add', 1, pv);

    expect(recall(s, 1)).toBe(23171.23147326);
    expect(shownAt(s, 1)).toBe('23,171.23');

    // The failure mode the golden names: accumulating the DISPLAYED (rounded)
    // values instead gives 23,171.22. If store/memoryArithmetic ever rounded to
    // the DEC setting, this module would produce that instead -- memory is NOT
    // one of the two worksheets (amortization, depreciation) that round to DEC.
    const unformat = (v: number): number => Number(shown(v).replace(/,/g, ''));
    let rounded: MemoryState = store(MEMORY_DEFAULTS, 1, unformat(pvs[0] as number));
    for (const pv of pvs.slice(1)) {
      rounded = memoryArithmetic(rounded, 'add', 1, unformat(pv));
    }
    expect(shownAt(rounded, 1)).toBe('23,171.22');
    expect(shownAt(rounded, 1)).not.toBe(shownAt(s, 1));
  });
});

describe('error conditions (guidebook pp. 84-85)', () => {
  it('raises Error 1 for STO / n with zero displayed', () => {
    const s = store(MEMORY_DEFAULTS, 5, 100);
    expectError(ErrorCode.Overflow, () => memoryArithmetic(s, 'div', 5, 0));
  });

  it('raises Error 1 when a result leaves the calculator range', () => {
    const s = store(MEMORY_DEFAULTS, 0, 9e99);
    expectError(ErrorCode.Overflow, () => memoryArithmetic(s, 'mul', 0, 10));
    expectError(ErrorCode.Overflow, () => memoryArithmetic(s, 'pow', 0, 2));
  });

  it('raises Error 1 when the value being stored is out of range', () => {
    expectError(ErrorCode.Overflow, () => store(MEMORY_DEFAULTS, 0, 1e100));
    expectError(ErrorCode.Overflow, () => store(MEMORY_DEFAULTS, 0, Number.NaN));
  });

  it('raises Error 2 for STO y^x n with a negative register and a fractional exponent', () => {
    // p. 14 / p. 84: y^x with y < 0 needs an integer x or the inverse of one.
    const s = store(MEMORY_DEFAULTS, 4, -8);
    expectError(ErrorCode.InvalidArgument, () => memoryArithmetic(s, 'pow', 4, 0.5));
    expectError(ErrorCode.InvalidArgument, () => memoryArithmetic(s, 'pow', 4, 1.7));
  });

  it('allows the legal negative-base powers', () => {
    const s = store(MEMORY_DEFAULTS, 4, -8);
    expect(recall(memoryArithmetic(s, 'pow', 4, 2), 4)).toBe(64); // integer exponent
    expect(recall(memoryArithmetic(s, 'pow', 4, 1 / 3), 4)).toBe(-2); // odd real root
  });

  it('raises no error for the other four ops on a negative register', () => {
    const s = store(MEMORY_DEFAULTS, 3, -100);
    expect(recall(memoryArithmetic(s, 'sub', 3, 30), 3)).toBe(-130);
    expect(recall(memoryArithmetic(s, 'div', 3, 4), 3)).toBe(-25);
  });

  it('guards the API boundary against an address outside 0-9', () => {
    // Not a hardware condition: no keystroke can name a register outside 0-9
    // (p. 16), so the calculator never shows this. The cast is what a caller
    // bypassing the MemoryAddress type would do.
    for (const bad of [-1, 10, 1.5, Number.NaN]) {
      expectError(ErrorCode.OutOfRange, () => recall(MEMORY_DEFAULTS, bad as MemoryAddress));
      expectError(ErrorCode.OutOfRange, () => store(MEMORY_DEFAULTS, bad as MemoryAddress, 1));
      expectError(ErrorCode.OutOfRange, () =>
        memoryArithmetic(MEMORY_DEFAULTS, 'add', bad as MemoryAddress, 1),
      );
    }
  });
});

describe('the register file itself (guidebook pp. 72-73)', () => {
  it('has exactly ten registers, all defaulting to zero', () => {
    expect(MEMORY_COUNT).toBe(10);
    expect(MEMORY_DEFAULTS).toHaveLength(10);
    expect(MEMORY_ADDRESSES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(MEMORY_DEFAULTS.every((v) => v === 0)).toBe(true);
  });

  it('labels registers M0-M9 in worksheet scroll order', () => {
    expect(MEMORY_ADDRESSES.map(memoryLabel)).toEqual([
      'M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9',
    ]);
  });

  it('accepts exactly the ten digit keys as addresses', () => {
    for (const n of MEMORY_ADDRESSES) expect(isMemoryAddress(n)).toBe(true);
    for (const bad of [-1, 10, 1.5, Number.NaN, Infinity]) {
      expect(isMemoryAddress(bad)).toBe(false);
    }
  });

  it('addresses each register independently', () => {
    let s: MemoryState = MEMORY_DEFAULTS;
    for (const n of MEMORY_ADDRESSES) s = store(s, n, n * 1.5);
    for (const n of MEMORY_ADDRESSES) expect(recall(s, n)).toBe(n * 1.5);
  });
});
