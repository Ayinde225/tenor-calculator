import { describe, it, expect } from 'vitest';
import { reduce, reduceAll, project, INITIAL_STATE } from './machine.js';
import { parseKeySequence, normalizeKey, type Key } from './keys.js';
import { renderFlat } from './display-state.js';
import { ErrorCode } from '../errors.js';
import type { CalculatorState } from './state.js';

/**
 * Press a recorded sequence.
 *
 * Tokens are passed as an array, never as a space-separated string: several keys
 * are canonically multi-word (`CLR TVM`, `CLR WORK`) and splitting on whitespace
 * shatters them into keys that mean something else entirely -- `CLR` alone
 * aliases to `CE/C`, so `"2ND CLR TVM"` would clear the entry and leave the TVM
 * registers standing, passing for the wrong reason.
 */
function press(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  return reduceAll(from, parseKeySequence(tokens));
}

/** The flat display string, which is what golden cases assert. */
const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(press(tokens, from).display);

/** Monthly payments. Needed explicitly, because P/Y defaults to 1 (p. 25). */
const monthly: CalculatorState = {
  ...INITIAL_STATE,
  tvm: { ...INITIAL_STATE.tvm, PY: 12, CY: 12 },
};

describe('number entry', () => {
  it('echoes keyed digits raw, without padding to DEC', () => {
    // A keyed 3 shows as "3", not "3.00" -- entry echo is not DEC-formatted.
    expect(screen(['3'])).toBe('3');
    expect(screen(['360'])).toBe('360');
  });

  it('formats a committed value to DEC', () => {
    // ...but once = commits it, it is formatted.
    expect(screen(['3', '='])).toBe('3.00');
  });

  it('applies thousands separators while typing', () => {
    expect(screen(['1234567'])).toBe('1,234,567');
    expect(screen(['5000', '+/-'])).toBe('-5,000');
  });

  it('keeps a bare trailing decimal point mid-entry', () => {
    expect(screen(['1', '2', '.'])).toBe('12.');
  });

  it('ignores a second decimal point', () => {
    expect(screen(['1', '.', '2', '.', '5'])).toBe('1.25');
  });

  it('backspaces one character at a time', () => {
    expect(screen(['123', 'BKSP'])).toBe('12');
    expect(screen(['1', '2', '.', 'BKSP'])).toBe('12');
  });
});

describe('the 2ND latch (guidebook p. 7)', () => {
  it('arms, and lights the 2nd indicator', () => {
    const r = reduce(INITIAL_STATE, '2ND');
    expect(r.state.secondArmed).toBe(true);
    expect(r.display.indicators).toContain('2nd');
  });

  it('cancels itself when pressed twice', () => {
    // There is no 2ND-of-2ND function; the second press disarms.
    const r = reduceAll(INITIAL_STATE, ['2ND', '2ND']);
    expect(r.state.secondArmed).toBe(false);
    expect(r.display.indicators).not.toContain('2nd');
  });

  it('is consumed by the key it modifies', () => {
    expect(reduceAll(INITIAL_STATE, ['2ND', 'QUIT']).state.secondArmed).toBe(false);
  });
});

describe('CPT is a prefix, not an action (guidebook p. 27)', () => {
  it('arms the next key to compute rather than store', () => {
    expect(reduce(INITIAL_STATE, 'CPT').state.computeArmed).toBe(true);
  });

  it('makes the same key mean store or compute', () => {
    // A bare PMT stores the display into PMT...
    expect(press(['425', 'PMT']).state.tvm.PMT).toBe(425);

    // ...while CPT PMT computes it, ignoring what is on the display.
    const computed = press(
      ['360', 'N', '5.5', 'I/Y', '75000', 'PV', '0', 'FV', 'CPT', 'PMT'],
      monthly,
    );
    expect(computed.state.tvm.PMT).toBeCloseTo(-425.84, 2);
  });
});

describe('guidebook worked example: monthly loan payment (p. 29)', () => {
  it('30 years at 5.5% on 75,000 with P/Y 12 -> PMT -425.84', () => {
    const r = press(
      ['30', '2ND', 'xP/Y', 'N', '5.5', 'I/Y', '75000', 'PV', '0', 'FV', 'CPT', 'PMT'],
      monthly,
    );
    expect(renderFlat(r.display)).toBe('-425.84');
    expect(r.state.tvm.N).toBe(360);
  });
});

describe('xP/Y payment multiplier (guidebook p. 27)', () => {
  it('multiplies the display by P/Y', () => {
    expect(press(['30', '2ND', 'xP/Y'], monthly).state.displayValue).toBe(360);
  });

  it('does not commit to N by itself -- the following N does', () => {
    expect(press(['30', '2ND', 'xP/Y'], monthly).state.tvm.N).toBe(0);
    expect(press(['30', '2ND', 'xP/Y', 'N'], monthly).state.tvm.N).toBe(360);
  });
});

describe('CHN vs AOS through the keypad', () => {
  it('CHN: 3 + 2 x 4 = -> 20.00', () => {
    expect(screen(['3', '+', '2', '×', '4', '='])).toBe('20.00');
  });

  it('AOS: 3 + 2 x 4 = -> 11.00', () => {
    const aos: CalculatorState = {
      ...INITIAL_STATE,
      format: { ...INITIAL_STATE.format, calcMethod: 'AOS' },
    };
    expect(screen(['3', '+', '2', '×', '4', '='], aos)).toBe('11.00');
  });

  it('shows the running subtotal in CHN as each operator lands', () => {
    expect(screen(['3', '+', '2', '×'])).toBe('5.00');
  });
});

describe('percent is context-sensitive (guidebook p. 12)', () => {
  it('498 + 7 % = -> 532.86 (percent OF the first operand)', () => {
    expect(screen(['498', '+', '7', '%', '='])).toBe('532.86');
  });

  it('69.99 - 10 % = -> 62.99', () => {
    expect(screen(['69.99', '-', '10', '%', '='])).toBe('62.99');
  });

  it('scales by 1/100 after a multiply', () => {
    // 453 x 4 % = -> 4% of 453 = 18.12
    expect(screen(['453', '×', '4', '%', '='])).toBe('18.12');
  });
});

describe('error latching (guidebook p. 84)', () => {
  it('latches the display and swallows every key but CE/C', () => {
    const errored = press(['1', '÷', '0', '=']);
    expect(errored.display.isError).toBe(true);
    expect(errored.display.value).toBe('Error 1');
    expect(errored.state.errorState).toBe(ErrorCode.Overflow);

    expect(reduce(errored.state, '5').display.value).toBe('Error 1');
  });

  it('refuses 2ND RESET until the error is cleared (p. 11)', () => {
    const errored = press(['1', '÷', '0', '=']);
    expect(reduceAll(errored.state, ['2ND', 'RESET']).display.value).toBe('Error 1');
  });

  it('clears with CE/C and returns to zero', () => {
    const errored = press(['1', '÷', '0', '=']);
    const cleared = reduce(errored.state, 'CE/C');
    expect(cleared.state.errorState).toBeNull();
    expect(cleared.display.value).toBe('0.00');
  });

  it('never throws out of the reducer', () => {
    // The reducer is total: calculation errors become state, not exceptions.
    expect(() => press(['0', '1/X'])).not.toThrow();
    expect(press(['0', '1/X']).display.value).toBe('Error 1');
  });
});

describe('clearing is context-specific (TI KB 11231)', () => {
  it('CE/C does not erase TVM registers', () => {
    const s = press(['360', 'N', '5.5', 'I/Y']);
    const cleared = reduce(s.state, 'CE/C');
    expect(cleared.state.tvm.N).toBe(360);
    expect(cleared.state.tvm.IY).toBe(5.5);
  });

  it('2ND CLR TVM resets the five registers but keeps P/Y and END/BGN', () => {
    const bgn: CalculatorState = { ...monthly, tvm: { ...monthly.tvm, mode: 'BGN' } };
    const s = press(['360', 'N', '5.5', 'I/Y', '2ND', 'CLR TVM'], bgn);
    expect(s.state.tvm.N).toBe(0);
    expect(s.state.tvm.IY).toBe(0);
    expect(s.state.tvm.PY).toBe(12); // survives
    expect(s.state.tvm.mode).toBe('BGN'); // survives
  });

  it('2ND QUIT drops pending work and shows zero', () => {
    const s = press(['3', '+', '2', '2ND', 'QUIT']);
    expect(s.state.pendingOps).toHaveLength(0);
    expect(s.display.value).toBe('0.00');
  });
});

describe('indicators', () => {
  it('lights BGN in beginning-of-period mode', () => {
    const bgn: CalculatorState = {
      ...INITIAL_STATE,
      tvm: { ...INITIAL_STATE.tvm, mode: 'BGN' },
    };
    expect(project(bgn).indicators).toContain('BGN');
  });

  it('lights RAD in radian mode', () => {
    const rad: CalculatorState = {
      ...INITIAL_STATE,
      format: { ...INITIAL_STATE.format, angleUnit: 'RAD' },
    };
    expect(project(rad).indicators).toContain('RAD');
  });
});

describe('trig through the modifier latches (guidebook p. 7, ENGINE-DESIGN §6.3)', () => {
  it('2ND SIN gives sine', () => {
    expect(screen(['30', '2ND', 'SIN'])).toBe('0.50');
  });

  it('INV SIN gives arcsine, with no 2ND before SIN', () => {
    // The guidebook prints `.2 INV SIN`, not `.2 INV 2ND SIN`.
    expect(press(['.5', 'INV', 'SIN']).state.displayValue).toBeCloseTo(30, 8);
  });

  it('2ND HYP SIN gives sinh, with no 2ND before SIN', () => {
    expect(press(['1', '2ND', 'HYP', 'SIN']).state.displayValue).toBeCloseTo(1.175201194, 6);
  });

  it('2ND HYP INV SIN gives arcsinh', () => {
    expect(press(['1', '2ND', 'HYP', 'INV', 'SIN']).state.displayValue).toBeCloseTo(
      0.881373587,
      6,
    );
  });

  it('consumes the latches once used', () => {
    const r = press(['1', '2ND', 'HYP', 'INV', 'SIN']);
    expect(r.state.hypArmed).toBe(false);
    expect(r.state.invArmed).toBe(false);
  });
});

describe('power behaviour (guidebook p. 6)', () => {
  it('swallows every key but ON/OFF when powered off', () => {
    const off = reduce(INITIAL_STATE, 'ON/OFF');
    expect(off.state.poweredOn).toBe(false);
    expect(reduce(off.state, '5').state.displayValue).toBe(0);
  });

  it('retains worksheet values across a deliberate power cycle', () => {
    const s = press(['360', 'N', '5.5', 'I/Y']);
    const cycled = reduceAll(s.state, ['ON/OFF', 'ON/OFF']);
    // Constant Memory keeps the registers...
    expect(cycled.state.tvm.N).toBe(360);
    expect(cycled.state.tvm.IY).toBe(5.5);
    // ...but the machine wakes at zero in standard mode.
    expect(cycled.display.value).toBe('0.00');
    expect(cycled.state.poweredOn).toBe(true);
  });

  it('drops pending operations across a deliberate power cycle', () => {
    const s = press(['3', '+']);
    expect(reduceAll(s.state, ['ON/OFF', 'ON/OFF']).state.pendingOps).toHaveLength(0);
  });
});

describe('the key parser', () => {
  it('expands a multi-digit literal into digit presses', () => {
    expect(parseKeySequence(['360'])).toEqual(['3', '6', '0']);
  });

  it('turns a leading minus into a trailing +/-, as the hardware requires', () => {
    expect(parseKeySequence(['-729.13'])).toEqual([
      '7', '2', '9', '.', '1', '3', '+/-',
    ] as Key[]);
  });

  it('strips thousands separators, which are display artefacts not presses', () => {
    expect(parseKeySequence(['25,000'])).toEqual(['2', '5', '0', '0', '0']);
  });

  it('normalises the alias spellings the corpus actually contains', () => {
    expect(parseKeySequence(['*'])).toEqual(['×']);
    expect(parseKeySequence(['EQUALS'])).toEqual(['=']);
    expect(parseKeySequence(['/'])).toEqual(['÷']);
    expect(parseKeySequence(['PLUS'])).toEqual(['+']);
  });

  it('preserves mixed-case canonical keys', () => {
    // Upper-casing blindly would turn xP/Y into XP/Y, which is not a key, and
    // the press would vanish silently.
    expect(normalizeKey('xP/Y')).toBe('xP/Y');
    expect(normalizeKey('XP/Y')).toBe('xP/Y');
    expect(normalizeKey('Δ%')).toBe('Δ%');
  });

  it('returns null for a token that names no key', () => {
    expect(normalizeKey('NOT_A_KEY')).toBeNull();
  });

  it('keeps multi-word keys intact', () => {
    expect(normalizeKey('CLR TVM')).toBe('CLR TVM');
    expect(normalizeKey('CLR WORK')).toBe('CLR WORK');
  });
});
