import { describe, it, expect, vi } from 'vitest';

/**
 * BRKEVN is not in the central WORKSHEETS registry yet -- the task wires that up
 * "centrally afterwards", so the unmodified reducer treats `2ND BRKEVN` as a dead
 * key (worksheet-nav.test.ts proves that for the still-unbuilt worksheets). To
 * exercise the descriptor the way it will actually run, inject it into the
 * registry the machine reads -- exactly the one line the central wiring will add
 * -- and then drive everything below through the real `reduceAll`, never by
 * calling the descriptor's own get/set/compute.
 */
vi.mock('../worksheet-registry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../worksheet-registry.js')>();
  const { BREAKEVEN } = await import('./breakeven-nav.js');
  return { ...actual, WORKSHEETS: { ...actual.WORKSHEETS, BRKEVN: BREAKEVEN } };
});

import { reduce, reduceAll, project, INITIAL_STATE } from '../machine.js';
import { parseKeySequence } from '../keys.js';
import { renderFlat } from '../display-state.js';
import { assertRegistryConsistent } from '../worksheet-nav.js';
import { WORKSHEETS } from '../worksheet-registry.js';
import { BREAKEVEN } from './breakeven-nav.js';
import type { CalculatorState } from '../state.js';
import type { BreakevenState } from '../../worksheets/breakeven.js';
import { ErrorCode } from '../../errors.js';

/** Press a recorded sequence. Tokens as an array -- `CLR WORK` is one key. */
function press(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  return reduceAll(from, parseKeySequence(tokens));
}

const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(press(tokens, from).display);

const value = (tokens: readonly string[], from?: CalculatorState): string =>
  press(tokens, from).display.value;

const withBE = (o: Partial<BreakevenState>): CalculatorState => ({
  ...INITIAL_STATE,
  breakeven: { ...INITIAL_STATE.breakeven, ...o },
});

/** The guidebook's canoe company (p. 72), already consistent: Q = 600 satisfies
 *  the identity for FC=3,000, VC=15, P=20, PFT=0. */
const CANOE = withBE({ FC: 3000, VC: 15, P: 20, PFT: 0, Q: 600 });

// ===========================================================================
// The descriptor is well-formed
// ===========================================================================

describe('the BRKEVN descriptor', () => {
  it('is self-consistent: every kind matches its handlers', () => {
    expect(() => assertRegistryConsistent({ BRKEVN: BREAKEVEN })).not.toThrow();
  });

  it('rides in the same registry as the reference worksheets once wired', () => {
    // The mock stands in for the central wiring; assert the whole merged registry
    // still passes the shape check, BRKEVN included.
    expect(() => assertRegistryConsistent(WORKSHEETS)).not.toThrow();
  });

  it('scrolls FC -> VC -> P -> PFT -> Q in LCD order (p. 71)', () => {
    expect(press(['2ND', 'BRKEVN']).display.label).toBe('FC=');
    expect(press(['2ND', 'BRKEVN', 'DOWN']).display.label).toBe('VC=');
    expect(press(['2ND', 'BRKEVN', 'DOWN', 'DOWN']).display.label).toBe('P=');
    expect(press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN']).display.label).toBe('PFT=');
    expect(press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN']).display.label).toBe('Q=');
  });
});

// ===========================================================================
// Golden cases -- tests/golden/other-worksheets.json (guidebook p. 72)
// ===========================================================================

describe('golden: other-worksheets-breakeven-* (guidebook p. 72)', () => {
  // other-worksheets-breakeven-enter-fc
  it('opens on FC and enters 3,000 with a thousands separator', () => {
    expect(screen(['2ND', 'BRKEVN'])).toBe('FC= 0.00');
    expect(screen(['2ND', 'BRKEVN', '3000', 'ENTER'])).toBe('FC= 3,000.00');
  });

  // other-worksheets-breakeven-enter-vc
  it('DOWN reaches VC and enters 15', () => {
    expect(screen(['2ND', 'BRKEVN', '3000', 'ENTER', 'DOWN', '15', 'ENTER'])).toBe('VC= 15.00');
  });

  // other-worksheets-breakeven-enter-price
  it('DOWN again reaches P and enters 20', () => {
    expect(
      screen(['2ND', 'BRKEVN', '3000', 'ENTER', 'DOWN', '15', 'ENTER', 'DOWN', '20', 'ENTER']),
    ).toBe('P= 20.00');
  });

  // other-worksheets-breakeven-pft-left-at-zero
  it('steps onto PFT and leaves it at 0 (what makes Q a breakeven quantity)', () => {
    expect(
      screen([
        '2ND', 'BRKEVN',
        '3000', 'ENTER',
        'DOWN', '15', 'ENTER',
        'DOWN', '20', 'ENTER',
        'DOWN',
      ]),
    ).toBe('PFT= 0.00');
  });

  // other-worksheets-breakeven-quantity -- the project's required parity example.
  it('DOWN onto Q and CPT gives the breakeven quantity 600.00', () => {
    const r = press([
      '2ND', 'BRKEVN',
      '3000', 'ENTER',
      'DOWN', '15', 'ENTER',
      'DOWN', '20', 'ENTER',
      'DOWN',
      'DOWN', 'CPT',
    ]);
    expect(renderFlat(r.display)).toBe('Q= 600.00');
    expect(r.state.breakeven.Q).toBe(600);
  });
});

// ===========================================================================
// Every field takes ENTER, and stores at internal precision (§1.4)
// ===========================================================================

describe('ENTER assigns each variable', () => {
  it('stores PFT as a target profit when keyed', () => {
    const r = press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', '500', 'ENTER']);
    expect(renderFlat(r.display)).toBe('PFT= 500.00');
    expect(r.state.breakeven.PFT).toBe(500);
  });

  it('stores Q directly when keyed', () => {
    const r = press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', '600', 'ENTER']);
    expect(renderFlat(r.display)).toBe('Q= 600.00');
    expect(r.state.breakeven.Q).toBe(600);
  });

  it('keeps full precision even though the LCD rounds to DEC (§1.4)', () => {
    const r = press(['2ND', 'BRKEVN', '6.125', 'ENTER']);
    expect(r.display.value).toBe('6.13');
    expect(r.state.breakeven.FC).toBe(6.125);
  });
});

// ===========================================================================
// CPT computes each of the five (enter-or-compute, p. 71)
// ===========================================================================

describe('CPT solves whichever variable is left unkeyed', () => {
  it('computes FC from the other four', () => {
    // FC starts 0; CPT on FC must fill 3,000 from VC/P/PFT/Q.
    const r = press(['2ND', 'BRKEVN', 'CPT'], withBE({ VC: 15, P: 20, PFT: 0, Q: 600 }));
    expect(renderFlat(r.display)).toBe('FC= 3,000.00');
    expect(r.state.breakeven.FC).toBe(3000);
  });

  it('computes VC from the other four', () => {
    const r = press(['2ND', 'BRKEVN', 'DOWN', 'CPT'], withBE({ FC: 3000, P: 20, PFT: 0, Q: 600 }));
    expect(renderFlat(r.display)).toBe('VC= 15.00');
    expect(r.state.breakeven.VC).toBe(15);
  });

  it('computes P from the other four', () => {
    const r = press(
      ['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'CPT'],
      withBE({ FC: 3000, VC: 15, PFT: 0, Q: 600 }),
    );
    expect(renderFlat(r.display)).toBe('P= 20.00');
    expect(r.state.breakeven.P).toBe(20);
  });

  it('computes PFT from the other four', () => {
    // PFT seeded wrong (999) so the compute is observable, not a coincidence.
    const r = press(
      ['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'CPT'],
      withBE({ FC: 3000, VC: 15, P: 20, PFT: 999, Q: 600 }),
    );
    expect(renderFlat(r.display)).toBe('PFT= 0.00');
    expect(r.state.breakeven.PFT).toBe(0);
  });

  it('computes Q from the other four', () => {
    const r = press(
      ['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT'],
      withBE({ FC: 3000, VC: 15, P: 20, PFT: 0 }),
    );
    expect(renderFlat(r.display)).toBe('Q= 600.00');
    expect(r.state.breakeven.Q).toBe(600);
  });

  it('refreshes Last Answer on CPT (p. 19)', () => {
    const r = press(
      ['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT'],
      withBE({ FC: 3000, VC: 15, P: 20, PFT: 0 }),
    );
    expect(r.state.ans).toBe(600);
  });

  it('treats a nonzero PFT as a target-profit solve (p. 71)', () => {
    // A prior session leaving PFT nonzero silently changes Q; the engine reproduces it.
    const r = press(
      ['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT'],
      withBE({ FC: 3000, VC: 15, P: 20, PFT: 500 }),
    );
    expect(r.state.breakeven.Q).toBe(700);
  });
});

// ===========================================================================
// The '=' indicator and the display trap (p. 27)
// ===========================================================================

describe("the '=' indicator marks a value as belonging to its label (p. 27)", () => {
  it('is lit on a value a field is showing', () => {
    const d = press(['2ND', 'BRKEVN', '3000', 'ENTER']).display;
    expect(d.label).toBe('FC=');
    expect(d.indicators).toContain('=');
  });

  it('goes dark mid-entry: a half-keyed number belongs to nobody', () => {
    const d = press(['2ND', 'BRKEVN', '3000']).display;
    expect(d.label).toBe('FC=');
    expect(d.value).toBe('3,000'); // echoed as typed, not padded to DEC
    expect(d.indicators).not.toContain('=');
  });

  it('goes dark when a TVM key leaves a foreign value under the label (p. 27)', () => {
    // `FC= 120,000.00` on screen, but 120,000 is PV -- only the missing `=` says so.
    const r = press(['2ND', 'BRKEVN', '120000', 'PV']);
    expect(r.display.label).toBe('FC=');
    expect(r.display.value).toBe('120,000.00');
    expect(r.display.indicators).not.toContain('=');
    expect(r.state.breakeven.FC).toBe(0); // FC was never touched
    expect(r.state.tvm.PV).toBe(120000);
  });
});

// ===========================================================================
// Indicator prompts follow the field type (pp. 21-22)
// ===========================================================================

describe('indicator prompts (pp. 21-22)', () => {
  it('every field is enter-or-compute: both ENTER and COMPUTE (p. 22)', () => {
    const d = press(['2ND', 'BRKEVN']).display;
    expect(d.indicators).toContain('ENTER');
    expect(d.indicators).toContain('COMPUTE');
  });

  it('offers UP and DOWN while more variables exist (p. 21)', () => {
    const d = press(['2ND', 'BRKEVN']).display;
    expect(d.indicators).toContain('UP');
    expect(d.indicators).toContain('DOWN');
  });

  it('never lights SET: Breakeven has no settings', () => {
    // 2ND SET on a plain entry field is inert -- the field supplies no `cycle`.
    const before = press(['2ND', 'BRKEVN']);
    const after = press(['2ND', 'BRKEVN', '2ND', 'SET']);
    expect(after.display.indicators).not.toContain('SET');
    expect(renderFlat(after.display)).toBe(renderFlat(before.display));
    expect(after.state.mode).toEqual({ kind: 'worksheet', worksheet: 'BRKEVN', field: 0 });
  });
});

// ===========================================================================
// The field ring wraps (p. 28)
// ===========================================================================

describe('the field ring wraps (p. 28)', () => {
  it('DOWN from Q returns to FC', () => {
    expect(press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN']).display.label).toBe(
      'FC=',
    );
  });

  it('UP from FC reaches Q', () => {
    expect(press(['2ND', 'BRKEVN', 'UP']).display.label).toBe('Q=');
  });

  it('a full lap returns to field 0', () => {
    const lap = press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN']);
    expect(lap.state.mode).toEqual({ kind: 'worksheet', worksheet: 'BRKEVN', field: 0 });
  });

  it('re-pressing the entry key returns to FC (p. 28)', () => {
    expect(press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', '2ND', 'BRKEVN']).display.label).toBe('FC=');
  });
});

// ===========================================================================
// CE/C, 2ND CLR WORK, 2ND QUIT (p. 11)
// ===========================================================================

describe('CE/C CE/C clears a keyed-but-not-entered value (p. 11)', () => {
  it('drops the keyed value and restores the previous one, without leaving', () => {
    const r = press(['2ND', 'BRKEVN', '3000', 'ENTER', '999', 'CE/C', 'CE/C']);
    expect(renderFlat(r.display)).toBe('FC= 3,000.00');
    expect(r.state.breakeven.FC).toBe(3000);
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'BRKEVN', field: 0 });
  });

  it('the first press shows zero, detached from the label', () => {
    const d = press(['2ND', 'BRKEVN', '3000', 'ENTER', '999', 'CE/C']).display;
    expect(d.label).toBe('FC=');
    expect(d.value).toBe('0.00');
    expect(d.indicators).not.toContain('=');
  });
});

describe('2ND CLR WORK resets Breakeven and returns to FC (p. 71)', () => {
  it('zeroes all five variables and lands on FC', () => {
    const r = press(
      ['2ND', 'BRKEVN', '3000', 'ENTER', 'DOWN', '15', 'ENTER', '2ND', 'CLR WORK'],
    );
    expect(renderFlat(r.display)).toBe('FC= 0.00');
    expect(r.state.breakeven).toEqual({ FC: 0, VC: 0, P: 0, PFT: 0, Q: 0 });
  });

  it('touches only this worksheet, not the TVM registers', () => {
    const r = press(['2ND', 'BRKEVN', '2ND', 'CLR WORK'], { ...CANOE, tvm: { ...INITIAL_STATE.tvm, PV: 120000 } });
    expect(r.state.tvm.PV).toBe(120000);
  });
});

describe('2ND QUIT leaves to standard mode without clearing (p. 11)', () => {
  it('returns to standard mode at zero, keeping the values', () => {
    const r = press(['2ND', 'BRKEVN', '3000', 'ENTER', '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(renderFlat(r.display)).toBe('0.00');
    expect(r.state.breakeven.FC).toBe(3000);
  });
});

// ===========================================================================
// Errors -- the reducer stays total (p. 84, Error 1)
// ===========================================================================

describe('the reducer latches Error 1 rather than throwing', () => {
  it('P = VC divides by zero when solving Q (nonzero fixed cost)', () => {
    const r = press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT'], withBE({ FC: 3000, VC: 20, P: 20, PFT: 0 }));
    expect(r.display.isError).toBe(true);
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('P = VC divides by zero when solving Q (0/0 branch)', () => {
    const r = press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT'], withBE({ FC: 0, VC: 20, P: 20, PFT: 0 }));
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('Q = 0 divides by zero when solving P', () => {
    const r = press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'CPT'], withBE({ FC: 3000, VC: 15, PFT: 0, Q: 0 }));
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('Q = 0 divides by zero when solving VC', () => {
    const r = press(['2ND', 'BRKEVN', 'DOWN', 'CPT'], withBE({ FC: 3000, P: 20, PFT: 0, Q: 0 }));
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('an out-of-range computed Q overflows', () => {
    const r = press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT'], withBE({ FC: 1e99, VC: 0, P: 1e-50, PFT: 0 }));
    expect(r.state.errorState).toBe(ErrorCode.Overflow);
  });

  it('the failed compute does not move the field', () => {
    const r = press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT'], withBE({ FC: 3000, VC: 20, P: 20, PFT: 0 }));
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'BRKEVN', field: 4 });
  });

  it('CE/C clears the error and the worksheet is still there', () => {
    const errored = press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT'], withBE({ FC: 3000, VC: 20, P: 20, PFT: 0 }));
    const cleared = reduce(errored.state, 'CE/C');
    expect(cleared.state.errorState).toBeNull();
    expect(renderFlat(cleared.display)).toBe('Q= 0.00');
  });

  it('never throws out of the reducer at the pole', () => {
    const onQ = withBE({ FC: 3000, VC: 20, P: 20, PFT: 0 });
    expect(() => press(['2ND', 'BRKEVN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'CPT'], onQ)).not.toThrow();
    // project is total too, even parked on the pole field.
    const parked: CalculatorState = {
      ...onQ,
      mode: { kind: 'worksheet', worksheet: 'BRKEVN', field: 4 },
    };
    expect(() => project(parked)).not.toThrow();
  });
});
