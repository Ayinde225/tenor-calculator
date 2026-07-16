import { describe, it, expect } from 'vitest';
import { parseKeySequence } from '../keys.js';
import { renderFlat } from '../display-state.js';
import { INITIAL_STATE } from '../machine.js';
import { ErrorCode } from '../../errors.js';
import type { CalculatorState } from '../state.js';
import { assertRegistryConsistent } from '../worksheet-nav.js';
import { MEMORY, reduceMemoryKeys, memoryDisplay } from './memory-nav.js';

/**
 * The Memory worksheet is not in the shipped `WORKSHEETS` registry yet, and the
 * standard-mode STO/RCL/2ND K/2ND ANS keys are not wired into machine.ts yet --
 * both are integrated centrally (see memory-nav.ts). So these tests drive the
 * same key presses through this module's session reducer, which composes the
 * generic navigation engine and the real reducer exactly as that integration
 * will. Tokens are an array so multi-word keys (`CLR WORK`) stay one key.
 */
function run(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  const session = reduceMemoryKeys(from, parseKeySequence(tokens));
  return { session, display: memoryDisplay(session) };
}
const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(run(tokens, from).display);
const value = (tokens: readonly string[], from?: CalculatorState): string =>
  run(tokens, from).display.value;
const memories = (tokens: readonly string[], from?: CalculatorState) =>
  run(tokens, from).session.calc.memories;

// ===========================================================================
// The descriptor is well-formed
// ===========================================================================

describe('the Memory worksheet descriptor', () => {
  it('is ten enter-only fields, M0..M9, and passes the registry self-check', () => {
    expect(() => assertRegistryConsistent({ MEM: MEMORY })).not.toThrow();
    expect(MEMORY.fields.map((f) => f.label)).toEqual([
      'M0=', 'M1=', 'M2=', 'M3=', 'M4=', 'M5=', 'M6=', 'M7=', 'M8=', 'M9=',
    ]);
    expect(MEMORY.fields.every((f) => f.kind === 'entry')).toBe(true);
  });
});

// ===========================================================================
// Entering and navigating the worksheet (guidebook pp. 21-22, 72-73)
// ===========================================================================

describe('2ND MEM opens the worksheet on M0 (p. 72)', () => {
  it('lands on M0 = 0.00 with the enter/scroll prompts lit', () => {
    const { display } = run(['2ND', 'MEM']);
    expect(renderFlat(display)).toBe('M0= 0.00');
    expect(display.indicators).toContain('ENTER');
    expect(display.indicators).toContain('UP');
    expect(display.indicators).toContain('DOWN');
    // The value belongs to the label the instant the worksheet opens (p. 21).
    expect(display.indicators).toContain('=');
  });

  it('a memory holding a value shows it on entry', () => {
    // 2ND MEM does not clear; a previously stored register is shown as-is.
    const stored = run(['14.95', 'STO', '3']).session.calc;
    expect(screen(['2ND', 'MEM', 'DOWN', 'DOWN', 'DOWN'], stored)).toBe('M3= 14.95');
  });
});

describe('the field ring walks every register and wraps (p. 28, 72-73)', () => {
  it('DOWN steps M0 -> ... -> M9 in order', () => {
    const labels: string[] = [];
    let keys: string[] = ['2ND', 'MEM'];
    for (let i = 0; i < 10; i++) {
      labels.push(run(keys).display.label);
      keys = [...keys, 'DOWN'];
    }
    expect(labels).toEqual([
      'M0=', 'M1=', 'M2=', 'M3=', 'M4=', 'M5=', 'M6=', 'M7=', 'M8=', 'M9=',
    ]);
  });

  it('DOWN from M9 wraps to M0, and UP from M0 wraps to M9', () => {
    const toM9 = ['2ND', 'MEM', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(run(toM9).display.label).toBe('M9=');
    expect(run([...toM9, 'DOWN']).display.label).toBe('M0=');
    expect(run(['2ND', 'MEM', 'UP']).display.label).toBe('M9=');
  });
});

describe('ENTER assigns the displayed value to the displayed register (p. 21)', () => {
  it('commits a keyed value into each of the ten fields', () => {
    for (let n = 0; n < 10; n++) {
      const nav = ['2ND', 'MEM', ...Array<string>(n).fill('DOWN')];
      const r = run([...nav, '42', 'ENTER']);
      expect(renderFlat(r.display)).toBe(`M${n}= 42.00`);
      expect(r.session.calc.memories[n]).toBe(42);
      expect(r.display.indicators).toContain('='); // the value now belongs to the label
    }
  });

  it('keeps entered values at full internal precision, showing the rounded form (§1.4)', () => {
    const r = run(['2ND', 'MEM', '6.125', 'ENTER']);
    expect(r.display.value).toBe('6.13');
    expect(r.session.calc.memories[0]).toBe(6.125);
  });

  it('mid-entry the = cue goes dark, then returns on ENTER (the p. 27 trap)', () => {
    expect(run(['2ND', 'MEM', '500']).display.indicators).not.toContain('=');
    expect(run(['2ND', 'MEM', '500']).display.value).toBe('500');
    expect(run(['2ND', 'MEM', '500', 'ENTER']).display.indicators).toContain('=');
  });
});

describe('CPT and 2ND SET do nothing on a memory field', () => {
  // The Memory worksheet has no compute and no setting variables; both keys are
  // inert on an enter-only field (worksheet-nav.ts).
  it('CPT leaves M0 untouched', () => {
    expect(screen(['2ND', 'MEM', 'CPT'])).toBe('M0= 0.00');
  });
  it('2ND SET leaves M0 untouched', () => {
    expect(screen(['2ND', 'MEM', 'SET'])).toBe('M0= 0.00');
  });
});

// ===========================================================================
// Clearing and leaving (guidebook p. 11, p. 16, p. 73)
// ===========================================================================

describe('golden: memory-and-last-answer-clear-all-ten-memories (p. 16)', () => {
  it('2ND MEM 2ND CLR WORK zeroes all ten and lands back on M0', () => {
    const keys = ['14.95', 'STO', '3', '99', 'STO', '8', '2ND', 'MEM', '2ND', 'CLR WORK'];
    const r = run(keys);
    expect(renderFlat(r.display)).toBe('M0= 0.00');
    // The golden asserts M3; the note says all ten must read zero.
    expect(r.session.calc.memories[3]).toBe(0);
    expect([...r.session.calc.memories]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    // ...and the pre-clear writes were genuine, so this is not vacuous.
    const before = run(['14.95', 'STO', '3', '99', 'STO', '8']).session.calc.memories;
    expect(before[3]).toBe(14.95);
    expect(before[8]).toBe(99);
  });
});

describe('2ND CLR WORK inside the worksheet resets only the registers (p. 11)', () => {
  it('clears every register and returns to M0', () => {
    const r = run(['2ND', 'MEM', '5', 'ENTER', 'DOWN', '7', 'ENTER', '2ND', 'CLR WORK']);
    expect(renderFlat(r.display)).toBe('M0= 0.00');
    expect([...r.session.calc.memories]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('2ND QUIT leaves to standard-calculator mode (p. 11)', () => {
  it('returns to standard mode at zero, keeping the stored registers', () => {
    const r = run(['14.95', 'STO', '3', '2ND', 'MEM', '2ND', 'QUIT']);
    expect(r.session.calc.mode).toEqual({ kind: 'standard' });
    expect(renderFlat(r.display)).toBe('0.00');
    expect(r.session.calc.memories[3]).toBe(14.95); // the value survives the exit
  });
});

// ===========================================================================
// Standard-mode STO / RCL (guidebook p. 16)
// ===========================================================================

describe('golden: memory-and-last-answer store/recall (p. 16)', () => {
  it('0 STO 4 clears M4 (no Display column; the register content is the claim)', () => {
    // golden: memory-and-last-answer-clear-memory-4-by-storing-zero
    const seeded = run(['123.45', 'STO', '4']).session.calc;
    expect(memories(['0', 'STO', '4'], seeded)[4]).toBe(0);
  });

  it('14.95 STO 3 stores 14.95 into M3, display left alone', () => {
    // golden: memory-and-last-answer-store-value-in-m3
    expect(memories(['14.95', 'STO', '3'])[3]).toBe(14.95);
  });

  it('RCL brings a stored value back and leaves it in place', () => {
    // golden: memory-and-last-answer-store-then-recall-round-trip
    expect(screen(['14.95', 'STO', '7', 'CE/C', 'RCL', '7', 'RCL', '7'])).toBe('14.95');
    // Non-destructive: the register still holds it after two recalls.
    expect(memories(['14.95', 'STO', '7', 'CE/C', 'RCL', '7', 'RCL', '7'])[7]).toBe(14.95);
  });

  it('STO copies without disturbing the shown value, and RCL recalls full precision (MEM-6)', () => {
    // A value more precise than the display: RCL returns all 13 digits (p. 9, p. 16).
    const s = run(['2ND', 'QUIT', '1', '÷', '3', '=', 'STO', '1']).session.calc;
    expect(s.memories[1]).toBe(0.3333333333333);
    expect(value(['RCL', '1'], s)).toBe('0.33');
  });
});

// ===========================================================================
// Memory arithmetic -- register OP display, never the reverse (guidebook p. 17)
// ===========================================================================

describe('golden: memory-and-last-answer memory arithmetic (p. 17)', () => {
  it('STO + 9 adds the display to M9', () => {
    // golden: memory-and-last-answer-sto-add-to-m9
    expect(screen(['100', 'STO', '9', '5', 'STO', '+', '9', 'RCL', '9'])).toBe('105.00');
    expect(memories(['100', 'STO', '9', '5', 'STO', '+', '9'])[9]).toBe(105);
  });

  it('STO - 3 subtracts the display FROM M3 (register is the minuend)', () => {
    // golden: memory-and-last-answer-sto-subtract-from-m3
    expect(screen(['100', 'STO', '3', '30', 'STO', '-', '3', 'RCL', '3'])).toBe('70.00');
    expect(screen(['100', 'STO', '3', '30', 'STO', '-', '3', 'RCL', '3'])).not.toBe('-70.00');
  });

  it('STO x 0 multiplies M0 by the display', () => {
    // golden: memory-and-last-answer-sto-multiply-m0
    expect(screen(['12', 'STO', '0', '5', 'STO', '×', '0', 'RCL', '0'])).toBe('60.00');
  });

  it('STO / 5 divides M5 BY the display (register is the numerator)', () => {
    // golden: memory-and-last-answer-sto-divide-m5
    expect(screen(['100', 'STO', '5', '4', 'STO', '÷', '5', 'RCL', '5'])).toBe('25.00');
    expect(screen(['100', 'STO', '5', '4', 'STO', '÷', '5', 'RCL', '5'])).not.toBe('0.04');
  });

  it('STO y^x 4 raises M4 to the displayed power (register is the base)', () => {
    // golden: memory-and-last-answer-sto-power-m4  -- 3^2 = 9, not 2^3 = 8
    expect(screen(['3', 'STO', '4', '2', 'STO', 'Y^X', '4', 'RCL', '4'])).toBe('9.00');
    expect(screen(['3', 'STO', '4', '2', 'STO', 'Y^X', '4', 'RCL', '4'])).not.toBe('8.00');
  });

  it('changes only the register, leaving the keyed display untouched', () => {
    // golden: memory-and-last-answer-memory-arithmetic-leaves-display-untouched
    // The 5 is a live keyed entry, so it echoes '5', NOT '5.00'.
    expect(screen(['100', 'STO', '9', '5', 'STO', '+', '9'])).toBe('5');
    expect(memories(['100', 'STO', '9', '5', 'STO', '+', '9'])[9]).toBe(105);
  });

  it('does not complete a calculation already in progress', () => {
    // golden: memory-and-last-answer-memory-arithmetic-does-not-complete-pending-calculation
    // 3 + 5 STO + 9 = : the STO+9 banks 5 into M9; the pending 3 + ... survives.
    const r = run(['3', '+', '5', 'STO', '+', '9', '=']);
    expect(renderFlat(r.display)).toBe('8.00');
    expect(r.session.calc.memories[9]).toBe(5);
  });
});

// ===========================================================================
// Constant calculations (guidebook p. 18) -- BOTH printed key orders
// ===========================================================================

describe('golden: constants, the printed 3/7/45-by-8 example (p. 18 worked order)', () => {
  // n OP c 2ND K = : 2ND K armed AFTER the operand.
  it('2ND QUIT clears to 0.00', () => {
    // golden: memory-and-last-answer-constants-quit-clears-display
    expect(screen(['2ND', 'QUIT'])).toBe('0.00');
  });
  it('a freshly keyed 3 echoes unformatted', () => {
    // golden: memory-and-last-answer-constants-entry-echo-unformatted
    expect(screen(['2ND', 'QUIT', '3'])).toBe('3');
  });
  it('the constant operand 8 also echoes unformatted', () => {
    // golden: memory-and-last-answer-constants-operand-echo-unformatted
    expect(screen(['2ND', 'QUIT', '3', '×', '8'])).toBe('8');
  });
  it('2ND K arms (×, 8) and the following = finishes 3 × 8', () => {
    // golden: memory-and-last-answer-constants-arm-and-first-result
    expect(screen(['2ND', 'QUIT', '3', '×', '8', '2ND', 'K', '='])).toBe('24.00');
  });
  it('7 = applies the armed constant: 7 × 8', () => {
    // golden: memory-and-last-answer-constants-second-application
    expect(screen(['2ND', 'QUIT', '3', '×', '8', '2ND', 'K', '=', '7', '='])).toBe('56.00');
  });
  it('45 = applies it again: 45 × 8', () => {
    // golden: memory-and-last-answer-constants-third-application
    expect(screen(['2ND', 'QUIT', '3', '×', '8', '2ND', 'K', '=', '7', '=', '45', '='])).toBe(
      '360.00',
    );
  });
});

describe('golden: constants, the p. 18 template table (2ND K BEFORE the operand)', () => {
  // n OP 2ND K c = : the disputed opposite order. Both must work (spec §Contradictions).
  it('add: 10 + 2ND K 5 = ... 20 = -> 25.00', () => {
    // golden: memory-and-last-answer-constant-add-template
    expect(screen(['2ND', 'QUIT', '10', '+', '2ND', 'K', '5', '=', '20', '='])).toBe('25.00');
  });
  it('subtract keeps c as the subtrahend: 50 - 30 -> 20.00', () => {
    // golden: memory-and-last-answer-constant-subtract-template-operand-order
    expect(screen(['2ND', 'QUIT', '100', '-', '2ND', 'K', '30', '=', '50', '='])).toBe('20.00');
  });
  it('divide keeps the entry as the numerator: 50 / 4 -> 12.50', () => {
    // golden: memory-and-last-answer-constant-divide-template-operand-order
    expect(screen(['2ND', 'QUIT', '100', '÷', '2ND', 'K', '4', '=', '50', '='])).toBe('12.50');
  });
  it('power keeps the entry as the base: 5 ^ 3 -> 125.00', () => {
    // golden: memory-and-last-answer-constant-power-template-operand-order
    expect(screen(['2ND', 'QUIT', '2', 'Y^X', '2ND', 'K', '3', '=', '5', '='])).toBe('125.00');
  });
  it('add-percent re-evaluates c% against each entry: 50 + 10% of 50 -> 55.00', () => {
    // golden: memory-and-last-answer-constant-add-percent-template
    expect(screen(['2ND', 'QUIT', '200', '+', '2ND', 'K', '10', '%', '=', '50', '='])).toBe(
      '55.00',
    );
  });
  it('subtract-percent: 50 - 10% of 50 -> 45.00', () => {
    // golden: memory-and-last-answer-constant-subtract-percent-template
    expect(screen(['2ND', 'QUIT', '200', '-', '2ND', 'K', '10', '%', '=', '50', '='])).toBe(
      '45.00',
    );
  });
});

// ===========================================================================
// Last Answer (guidebook p. 19)
// ===========================================================================

describe('golden: the p. 19 Last Answer example', () => {
  it('3 + 1 = sets the answer to 4.00', () => {
    // golden: memory-and-last-answer-last-answer-seed-calculation
    expect(screen(['3', '+', '1', '='])).toBe('4.00');
  });
  it('pressing an operator formats the pending operand: 2 Y^X -> 2.00', () => {
    // golden: memory-and-last-answer-last-answer-operand-is-formatted
    expect(screen(['3', '+', '1', '=', '2', 'Y^X'])).toBe('2.00');
  });
  it('2ND ANS recalls 4.00 -- Y^X did not overwrite it', () => {
    // golden: memory-and-last-answer-last-answer-recall-mid-expression
    expect(screen(['3', '+', '1', '=', '2', 'Y^X', '2ND', 'ANS'])).toBe('4.00');
  });
  it('the recalled answer closes the calculation: 2 ^ 4 -> 16.00', () => {
    // golden: memory-and-last-answer-last-answer-complete-with-recalled-value
    expect(screen(['3', '+', '1', '=', '2', 'Y^X', '2ND', 'ANS', '='])).toBe('16.00');
  });
});

// ===========================================================================
// Isolation, and the errors memory arithmetic can raise (pp. 84-85)
// ===========================================================================

describe('golden: memory-and-last-answer-clr-work-in-other-worksheet-spares-memories', () => {
  it("another worksheet's CLR WORK cannot touch the registers (p. 11, p. 19)", () => {
    const r = run(['14.95', 'STO', '3', '2ND', 'AMORT', '2ND', 'CLR WORK', '2ND', 'QUIT', 'RCL', '3']);
    expect(renderFlat(r.display)).toBe('14.95');
    expect(r.session.calc.memories[3]).toBe(14.95);
  });
});

describe('memory arithmetic latches, never throws (pp. 84-85)', () => {
  it('Error 1 on STO / n with zero displayed (division by zero)', () => {
    const r = run(['100', 'STO', '5', '0', 'STO', '÷', '5']);
    expect(r.display.isError).toBe(true);
    expect(r.display.value).toBe('Error 1');
    expect(r.session.calc.errorState).toBe(ErrorCode.Overflow);
  });

  it('Error 1 when a result overflows the calculator range', () => {
    // M0 = 10, then STO y^x 0 with 100 displayed: 10^100 = 1e100, over the limit.
    const r = run(['10', 'STO', '0', '100', 'STO', 'Y^X', '0']);
    expect(r.display.isError).toBe(true);
    expect(r.display.value).toBe('Error 1');
    expect(r.session.calc.errorState).toBe(ErrorCode.Overflow);
  });

  it('Error 2 on STO y^x n with a negative register and an even-root exponent', () => {
    // M4 = -8, then y^x 0.5: even root of a negative base has no real value (p. 84).
    const r = run(['8', '+/-', 'STO', '4', '0.5', 'STO', 'Y^X', '4']);
    expect(r.display.isError).toBe(true);
    expect(r.display.value).toBe('Error 2');
    expect(r.session.calc.errorState).toBe(ErrorCode.InvalidArgument);
  });

  it('the legal negative-base powers do not error', () => {
    // integer exponent: (-8)^2 = 64; odd real root: (-8)^(1/3) = -2.
    expect(memories(['8', '+/-', 'STO', '4', '2', 'STO', 'Y^X', '4'])[4]).toBe(64);
  });

  it('CE/C clears a latched memory error and returns to zero', () => {
    const errored = run(['100', 'STO', '5', '0', 'STO', '÷', '5']);
    expect(screen(['CE/C'], errored.session.calc)).toBe('0.00');
    expect(run(['CE/C'], errored.session.calc).session.calc.errorState).toBeNull();
  });
});

// ===========================================================================
// Reset -- covered at the register-file level; the keystroke is upstream
// ===========================================================================

describe('golden: memory-and-last-answer-reset-zeroes-all-memories', () => {
  it('the value reset restores is all-zero registers (p. 10)', () => {
    // `2ND RESET ENTER` clears the whole machine to INITIAL_STATE, which is
    // machine.ts's keystroke, not this module's -- and RESET is still a stub in
    // machine.ts (it only returns to standard mode). The register-file half of
    // this golden is pinned in worksheets/memory-worksheet.test.ts; what belongs
    // here is that the state reset restores is exactly the zeroed file.
    expect([...INITIAL_STATE.memories]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
