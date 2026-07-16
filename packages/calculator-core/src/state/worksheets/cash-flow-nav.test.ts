import { describe, it, expect, vi } from 'vitest';

// The central registry (worksheet-registry.ts) is wired up by a later step, so CF,
// NPV and IRR are not in it yet. Inject them here so the real reducer -- which
// reads the module-level WORKSHEETS -- routes their keys, and every test below
// drives the machine through actual key presses (reduceAll + parseKeySequence)
// rather than calling descriptor functions directly. Merging over the real
// registry keeps PROFIT/AMORT live and matches the eventual central wiring.
vi.mock('../worksheet-registry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../worksheet-registry.js')>();
  const { CASH_FLOW_WORKSHEETS } = await import('./cash-flow-nav.js');
  return { ...actual, WORKSHEETS: { ...actual.WORKSHEETS, ...CASH_FLOW_WORKSHEETS } };
});

import { reduce, reduceAll, project, INITIAL_STATE } from '../machine.js';
import { parseKeySequence } from '../keys.js';
import { renderFlat } from '../display-state.js';
import { ErrorCode } from '../../errors.js';
import type { CalculatorState } from '../state.js';
import { assertRegistryConsistent } from '../worksheet-nav.js';
import { WORKSHEETS } from '../worksheet-registry.js';
import { CASH_FLOW, NPV, IRR } from './cash-flow-nav.js';
import {
  CASH_FLOW_DEFAULTS,
  deleteFlow,
  insertFlow,
  setCFo,
  setFlow,
  setFrequency,
  setI,
  type CashFlowState,
} from '../../worksheets/cash-flow.js';
import { toInternal } from '../../numeric/precision.js';

/** Press a recorded token sequence. Tokens as an array -- `CLR WORK` is one key. */
function press(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  return reduceAll(from, parseKeySequence(tokens));
}
const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(press(tokens, from).display);

/** Seed a machine parked in standard mode holding a given cash-flow stream. */
const withStream = (cashFlow: CashFlowState): CalculatorState => ({ ...INITIAL_STATE, cashFlow });

// ---------------------------------------------------------------------------
// The p. 47-48 machine example, as cumulative key prefixes of one walk. Each
// const ends on the field its matching golden case asserts. Copied key-for-key
// from tests/golden/cash-flow.json.
// ---------------------------------------------------------------------------
const kOpen = ['CF'];
const kCFo = [...kOpen, '7000', '+/-', 'ENTER'];
const kC01 = [...kCFo, 'DOWN', '3000', 'ENTER'];
const kF01 = [...kC01, 'DOWN'];
const kC02 = [...kF01, 'DOWN', '5000', 'ENTER'];
const kF02 = [...kC02, 'DOWN', '4', 'ENTER'];
const kC03 = [...kF02, 'DOWN', '4000', 'ENTER'];
const kF03 = [...kC03, 'DOWN'];
const kUpC03 = [...kF03, 'UP'];
const kDelC03 = [...kUpC03, '2ND', 'DEL'];
const kUpC02 = [...kDelC03, 'UP', 'UP'];
const kInsC02 = [...kUpC02, '2ND', 'INS', '4000', 'ENTER'];
const kInsF02 = [...kInsC02, 'DOWN'];
const kShC03 = [...kInsF02, 'DOWN'];
const kShF03 = [...kShC03, 'DOWN'];
const kNpvI = [...kShF03, 'NPV'];
const kNpvRate = [...kNpvI, '20', 'ENTER'];
const kNpvVal = [...kNpvRate, 'DOWN', 'CPT'];
const kIrrOpen = [...kNpvVal, 'IRR'];
const kIrrVal = [...kIrrOpen, 'CPT'];

// ---------------------------------------------------------------------------
// The p. 49 lease example, likewise cumulative.
// ---------------------------------------------------------------------------
const kReset = ['2ND', 'RESET', 'ENTER'];
const kLOpen = [...kReset, 'CF'];
const kLC01 = [...kLOpen, 'DOWN'];
const kLF01 = [...kLC01, 'DOWN', '3', 'ENTER'];
const kLC02 = [...kLF01, 'DOWN', '5000', '+/-', 'ENTER'];
const kLF02 = [...kLC02, 'DOWN', '8', 'ENTER'];
const kLC03 = [...kLF02, 'DOWN'];
const kLF03 = [...kLC03, 'DOWN', '3', 'ENTER'];
const kLC04 = [...kLF03, 'DOWN', '6000', '+/-', 'ENTER'];
const kLF04 = [...kLC04, 'DOWN', '9', 'ENTER'];
const kLC05 = [...kLF04, 'DOWN'];
const kLF05 = [...kLC05, 'DOWN', '2', 'ENTER'];
const kLC06 = [...kLF05, 'DOWN', '7000', '+/-', 'ENTER'];
const kLF06 = [...kLC06, 'DOWN', '10', 'ENTER'];
const kLNpvI = [...kLF06, 'NPV'];
const kLRate = [...kLNpvI, '10', '/', '12', 'ENTER'];
const kLNpvVal = [...kLRate, 'DOWN', 'CPT'];

/** The p. 47 EDITED stream, built through the maths exactly as the guidebook edits it. */
function editedStream(): CashFlowState {
  let s = setCFo(CASH_FLOW_DEFAULTS, -7000);
  s = setFlow(s, 1, 3000);
  s = setFrequency(setFlow(s, 2, 5000), 2, 4);
  s = setFlow(s, 3, 4000);
  return insertFlow(deleteFlow(s, 3), 2, 4000); // delete C03, insert 4000 at C02
}

/** The p. 49 lease stream, six groups over 36 months. */
function leaseStream(): CashFlowState {
  let s = setFrequency(CASH_FLOW_DEFAULTS, 1, 3);
  s = setFrequency(setFlow(s, 2, -5000), 2, 8);
  s = setFrequency(s, 3, 3);
  s = setFrequency(setFlow(s, 4, -6000), 4, 9);
  s = setFrequency(s, 5, 2);
  return setFrequency(setFlow(s, 6, -7000), 6, 10);
}

// ===========================================================================
// The descriptors are well-formed
// ===========================================================================

describe('the CF / NPV / IRR descriptors are well-formed', () => {
  it('each agrees with its own kind declarations, and so does the merged registry', () => {
    expect(() => assertRegistryConsistent({ CF: CASH_FLOW, NPV, IRR })).not.toThrow();
    expect(() => assertRegistryConsistent(WORKSHEETS)).not.toThrow();
  });

  it('all three are reachable through their primary entry keys', () => {
    // No 2ND prefix: CF, NPV and IRR are primary keys (p. 42, 45).
    expect(press(['CF']).state.mode).toEqual({ kind: 'worksheet', worksheet: 'CF', field: 0 });
    expect(press(['NPV']).state.mode).toMatchObject({ worksheet: 'NPV', field: 0 });
    // IRR is recomputed on sight, so opening it on a no-sign-change stream raises
    // Error 5 before it can settle (see the errors block). A stream with an IRR
    // confirms the entry key routes to the descriptor.
    expect(press(['IRR'], withStream(editedStream())).state.mode).toMatchObject({
      worksheet: 'IRR',
      field: 0,
    });
  });

  it('NPV opens on I, not on NPV -- the discount rate comes first (p. 45)', () => {
    expect(press(['NPV']).display.label).toBe('I=');
  });
});

// ===========================================================================
// Golden: entering and reviewing the machine stream (guidebook p. 47)
// ===========================================================================

describe('golden: cash-flow-machine-* entry and review (guidebook p. 47)', () => {
  it('CF opens on CFo at its 0 default', () => {
    expect(screen(kOpen)).toBe('CFo= 0.00');
  });
  it('enters the initial outflow of -7,000 (+/- before ENTER)', () => {
    expect(screen(kCFo)).toBe('CFo= -7,000.00');
  });
  it('DOWN lands on C01 and 3000 ENTER assigns it', () => {
    expect(screen(kC01)).toBe('C01= 3,000.00');
  });
  it('F01 shows its default 1.00 with nothing keyed -- proving the Fnn default', () => {
    expect(screen(kF01)).toBe('F01= 1.00');
  });
  it('two DOWN from C01 reach C02 (amount/frequency alternate)', () => {
    expect(screen(kC02)).toBe('C02= 5,000.00');
  });
  it('F02 = 4 groups the four equal 5,000 flows (frequency displays at DEC, 4.00)', () => {
    expect(screen(kF02)).toBe('F02= 4.00');
  });
  it('enters the year-6 inflow at C03', () => {
    expect(screen(kC03)).toBe('C03= 4,000.00');
  });
  it('F03 shows its default 1.00', () => {
    expect(screen(kF03)).toBe('F03= 1.00');
  });
  it('UP from F03 returns to C03, still 4,000.00', () => {
    expect(screen(kUpC03)).toBe('C03= 4,000.00');
  });
  it('UP UP after the (inert) delete reaches C02, still 5,000.00', () => {
    // The golden's 2ND DEL is a no-op here (see the blocked-cases block), but C02
    // holds 5,000 in both the edited and the un-edited stream, so this row still
    // lands on the guidebook's value.
    expect(screen(kUpC02)).toBe('C02= 5,000.00');
  });
  it('2ND INS 4000 ENTER shows C02= 4,000.00', () => {
    // The display coincides with the guidebook because keying 4000 into C02
    // overwrites it to 4,000 whether or not the insert-shift happened; the missing
    // shift is caught by the blocked cases that follow.
    expect(screen(kInsC02)).toBe('C02= 4,000.00');
  });
});

// ===========================================================================
// Golden: the p. 49 lease, row by row (all reproduce through key presses)
// ===========================================================================

describe('golden: cash-flow-lease-* entry (guidebook p. 49)', () => {
  it('opens CFo at 0 and leaves it (month 1 of the opening $0 group)', () => {
    expect(screen(kLOpen)).toBe('CFo= 0.00');
  });
  it('steps past C01, leaving it at 0', () => {
    expect(screen(kLC01)).toBe('C01= 0.00');
  });
  it('F01 = 3 for the three remaining $0 months', () => {
    expect(screen(kLF01)).toBe('F01= 3.00');
  });
  it('C02 = -5,000 (comma-grouped, per CF-14)', () => {
    expect(screen(kLC02)).toBe('C02= -5,000.00');
  });
  it('F02 = 8', () => {
    expect(screen(kLF02)).toBe('F02= 8.00');
  });
  it('C03 left at 0', () => {
    expect(screen(kLC03)).toBe('C03= 0.00');
  });
  it('F03 = 3', () => {
    expect(screen(kLF03)).toBe('F03= 3.00');
  });
  it('C04 = -6,000', () => {
    expect(screen(kLC04)).toBe('C04= -6,000.00');
  });
  it('F04 = 9', () => {
    expect(screen(kLF04)).toBe('F04= 9.00');
  });
  it('C05 left at 0', () => {
    expect(screen(kLC05)).toBe('C05= 0.00');
  });
  it('F05 = 2', () => {
    expect(screen(kLF05)).toBe('F05= 2.00');
  });
  it('C06 = -7,000', () => {
    expect(screen(kLC06)).toBe('C06= -7,000.00');
  });
  it('F06 = 10, completing the 36-month line', () => {
    expect(screen(kLF06)).toBe('F06= 10.00');
  });
});

// ===========================================================================
// Golden: NPV / IRR opening rows (guidebook pp. 48-49)
// ===========================================================================

describe('golden: NPV and IRR open on the right field (guidebook pp. 48-49)', () => {
  it('machine: NPV opens on I at 0', () => {
    expect(screen(kNpvI)).toBe('I= 0.00');
  });
  it('machine: 20 ENTER sets the per-period rate', () => {
    expect(screen(kNpvRate)).toBe('I= 20.00');
  });
  it('lease: NPV opens on I at 0', () => {
    expect(screen(kLNpvI)).toBe('I= 0.00');
  });
});

// ===========================================================================
// Descriptor correctness on pre-built streams: the compute half of every golden
// the framework cannot key its way to (see the blocked block). Seeding a stream
// and then driving the ACTUAL NPV/IRR key path proves the maths wiring is right
// and isolates the failures below as pure key-routing gaps.
// ===========================================================================

describe('descriptor correctness given the stream the framework cannot key in', () => {
  it('displays the p. 47 EDITED stream field-for-field (proves the DEL/INS gap is only routing)', () => {
    // Edited stream: CFo=-7000; C01=3000/F01=1; C02=4000/F02=1; C03=5000/F03=4.
    const s = withStream(editedStream());
    expect(screen(['CF'], s)).toBe('CFo= -7,000.00');
    expect(screen(['CF', 'DOWN', 'DOWN', 'DOWN'], s)).toBe('C02= 4,000.00');
    expect(screen(['CF', 'DOWN', 'DOWN', 'DOWN', 'DOWN'], s)).toBe('F02= 1.00'); // golden inserted-flow-gets-1
    expect(screen(['CF', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'], s)).toBe('C03= 5,000.00'); // golden verify-c03
    expect(screen(['CF', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'], s)).toBe('F03= 4.00'); // golden verify-f03
  });

  it('shows C03 as a vacant 0.00 slot on the POST-DELETE stream (golden delete-c03)', () => {
    // Delete C03 from the entered stream -> two groups; C03 is now past the end.
    let s = setCFo(CASH_FLOW_DEFAULTS, -7000);
    s = setFlow(s, 1, 3000);
    s = setFrequency(setFlow(s, 2, 5000), 2, 4);
    s = deleteFlow(setFlow(s, 3, 4000), 3);
    expect(screen(['CF', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'], withStream(s))).toBe('C03= 0.00');
  });

  it('computes NPV = 7,266.44 for the edited machine at 20% (golden compute-npv)', () => {
    expect(screen(['NPV', '20', 'ENTER', 'DOWN', 'CPT'], withStream(editedStream()))).toBe(
      'NPV= 7,266.44',
    );
  });

  it('computes IRR = 52.71 for the edited machine (golden compute-irr)', () => {
    expect(screen(['IRR', 'CPT'], withStream(editedStream()))).toBe('IRR= 52.71');
  });

  it('computes the lease NPV = -138,088.44 once I holds the unrounded 10/12 rate', () => {
    // Stored I is 0.8333...; the display rounds to 0.83 but the maths uses full
    // precision, so the answer matches p. 49 to the cent (golden lease-compute-npv).
    const s = withStream(setI(leaseStream(), toInternal(10 / 12)));
    expect(screen(['NPV'], s)).toBe('I= 0.83'); // display rounds
    expect(press(['NPV'], s).state.cashFlow.I).toBe(0.8333333333333); // storage does not
    expect(screen(['NPV', 'DOWN', 'CPT'], s)).toBe('NPV= -138,088.44');
  });

  it('ignores the discount rate when solving IRR (I=20 leaks nowhere)', () => {
    // p. 48: IRR reads the same regardless of I. Compute IRR after setting I=20.
    const s = withStream({ ...editedStream(), I: 20 });
    expect(screen(['IRR', 'CPT'], s)).toBe('IRR= 52.71');
  });

  it('falls back to the undiscounted sum at the default I = 0 (NPV DOWN CPT after a clear)', () => {
    // -7000 + 3000 + 4000 + 5000x4 = 20,000; the annuity factor's 0/0 resolves to n.
    expect(screen(['NPV', 'DOWN', 'CPT'], withStream(editedStream()))).toBe('NPV= 20,000.00');
  });
});

// ===========================================================================
// Golden cases blocked by framework limitations OUTSIDE this task's two files.
//
// These assert the guidebook's exact display and FAIL against the framework as
// delivered. Each cause lives in machine.ts or worksheet-nav.ts, which this task
// must not edit, and the descriptor produces the right value the moment the gap
// is closed -- proven in "descriptor correctness ..." above. They are left as
// honest failures rather than papered over. See docs/OPEN-QUESTIONS and the
// cash-flow-nav.ts header.
//
//   A. 2ND INS / 2ND DEL are dead keys. reduceWorksheet claims only UP/DOWN/
//      ENTER/CPT/SET/CLR WORK/CE/C and the reducer has no INS/DEL case, so the
//      p. 47 edit never runs and everything downstream sees the pre-edit stream.
//   B. No NPV/IRR register. CashFlowState is {CFo, groups, I}; NPV and IRR are
//      recomputed on sight, so opening IRR shows its computed value, never the
//      retained 0.00 the hardware prints before CPT.
//   C. ENTER drops a pending operation. pressEnter reads currentValue, which
//      ignores pendingOps, so `10 / 12 ENTER` stores 12, not 0.8333...
//   D. RESET is a no-op reset. The reducer's RESET only sets standard mode; it
//      neither restores defaults nor prints the RST acknowledgement.
// ===========================================================================

describe('golden cases fixed since this descriptor was written', () => {
  // BLOCKED C -> fixed: worksheet ENTER now settles pending arithmetic, so the
  // monthly rate keyed as `10 / 12 ENTER` stores 0.8333... instead of a bare 12.
  it('cash-flow-lease-enter-monthly-rate -> I= 0.83', () => {
    expect(screen(kLRate)).toBe('I= 0.83');
  });
  it('cash-flow-lease-compute-npv -> NPV= -138,088.44', () => {
    expect(screen(kLNpvVal)).toBe('NPV= -138,088.44');
  });
  // BLOCKED D -> fixed: 2ND RESET is now the real two-step confirm. After ENTER
  // the machine is in standard mode showing 0.00 (RST is an annunciator, not a
  // label, so the flattened display is the value alone).
  it('cash-flow-lease-reset-defaults -> 0.00', () => {
    expect(screen(kReset)).toBe('0.00');
  });
});

/**
 * Cash-flow editing (2ND INS / 2ND DEL) and the NPV/IRR retained registers, now
 * built. INS/DEL edit the flow list through the reducer; NPV and IRR are stored
 * registers (ENGINE-DESIGN §4) that show 0.00 until CPT computes them, so
 * computing NPV never populates IRR (p. 48).
 */
describe('cash-flow editing and NPV/IRR registers (guidebook pp. 47-48)', () => {
  it('deletes the last flow, leaving the slot vacant', () => {
    expect(screen(kDelC03)).toBe('C03= 0.00');
  });
  it('gives an inserted flow the default frequency of 1', () => {
    expect(screen(kInsF02)).toBe('F02= 1.00');
  });
  it('renumbers the displaced amount upward (C02 5,000 -> C03)', () => {
    expect(screen(kShC03)).toBe('C03= 5,000.00');
  });
  it('carries the displaced frequency with its amount (F02 4 -> F03)', () => {
    expect(screen(kShF03)).toBe('F03= 4.00');
  });
  it('computes NPV on the EDITED stream -> 7,266.44 (arbiter)', () => {
    expect(screen(kNpvVal)).toBe('NPV= 7,266.44');
  });
  it('IRR reads 0.00 on open, since computing NPV does not populate it', () => {
    expect(screen(kIrrOpen)).toBe('IRR= 0.00');
  });
  it('computes IRR on CPT -> 52.71 (arbiter)', () => {
    expect(screen(kIrrVal)).toBe('IRR= 52.71');
  });
});

// ===========================================================================
// Navigation: the ring, the wrap, and the dynamic field list (pp. 42-44, 28)
// ===========================================================================

describe('the dynamic field list grows one empty slot at a time (pp. 43-44)', () => {
  it('a fresh worksheet exposes only CFo, C01 and F01', () => {
    // DOWN reaches C01, DOWN reaches F01, DOWN wraps back to CFo -- C02 is not yet
    // on the ring because no first group has been entered.
    expect(screen(['CF']).startsWith('CFo=')).toBe(true);
    expect(screen(['CF', 'DOWN'])).toBe('C01= 0.00');
    expect(screen(['CF', 'DOWN', 'DOWN'])).toBe('F01= 1.00');
    expect(screen(['CF', 'DOWN', 'DOWN', 'DOWN'])).toBe('CFo= 0.00'); // wraps (p. 28)
  });

  it('entering C01 reveals the next empty pair C02/F02', () => {
    // With one group entered, DOWN past F01 now reaches C02 instead of wrapping.
    const s = press(['CF', 'DOWN', '1000', 'ENTER']).state; // C01 = 1000, flowCount 1
    expect(screen(['DOWN', 'DOWN'], s)).toBe('C02= 0.00');
  });

  it('UP from CFo wraps to the last visible field', () => {
    // Empty stream: last visible is F01, so UP from CFo lands on F01.
    expect(screen(['CF', 'UP'])).toBe('F01= 1.00');
  });

  it('re-pressing CF returns to the first field (p. 28)', () => {
    expect(press(['CF', 'DOWN', 'DOWN', 'CF']).display.label).toBe('CFo=');
  });
});

// ===========================================================================
// The '=' display trap and the prompt annunciators (pp. 21-22, 27)
// ===========================================================================

describe("the '=' cue and the prompt annunciators (pp. 21-22, 27)", () => {
  it('lights = on a committed field value', () => {
    const d = press(kCFo).display;
    expect(d.label).toBe('CFo=');
    expect(d.indicators).toContain('=');
  });

  it('goes dark mid-entry on a Cnn field', () => {
    const d = press(['CF', 'DOWN', '3000']).display;
    expect(d.label).toBe('C01=');
    expect(d.value).toBe('3,000');
    expect(d.indicators).not.toContain('=');
  });

  it('goes dark when a TVM key leaves a foreign value under CFo (p. 27)', () => {
    const r = press(['CF', '120000', 'PV']);
    expect(r.display.label).toBe('CFo=');
    expect(r.display.value).toBe('120,000.00');
    expect(r.display.indicators).not.toContain('='); // 120,000 is PV, not CFo
    expect(r.state.cashFlow.CFo).toBe(0); // CFo untouched
    expect(r.state.tvm.PV).toBe(120000);
  });

  it('Cnn/Fnn prompt with ENTER only (enter-only, p. 42)', () => {
    const d = press(['CF', 'DOWN']).display; // C01
    expect(d.indicators).toContain('ENTER');
    expect(d.indicators).not.toContain('COMPUTE');
  });

  it('NPV and IRR prompt with COMPUTE only (compute-only, p. 42)', () => {
    const npv = press(['NPV', 'DOWN'], withStream(editedStream())).display;
    expect(npv.label).toBe('NPV=');
    expect(npv.indicators).toContain('COMPUTE');
    expect(npv.indicators).not.toContain('ENTER');

    const irr = press(['IRR'], withStream(editedStream())).display;
    expect(irr.label).toBe('IRR=');
    expect(irr.indicators).toContain('COMPUTE');
    expect(irr.indicators).not.toContain('ENTER');
  });

  it('offers UP/DOWN in CF and NPV, but not on the single-field IRR ring', () => {
    expect(press(['CF']).display.indicators).toContain('DOWN');
    expect(press(['NPV']).display.indicators).toContain('DOWN');
    // IRR is a one-field worksheet, so there is nothing to scroll to.
    expect(press(['IRR'], withStream(editedStream())).display.indicators).not.toContain('DOWN');
  });
});

// ===========================================================================
// Entered values keep full internal precision (§1.4)
// ===========================================================================

describe('entered values are stored at internal precision, not display precision', () => {
  it('keeps CFo = 6.125 even though the LCD shows 6.13', () => {
    const r = press(['CF', '6.125', 'ENTER']);
    expect(r.display.value).toBe('6.13');
    expect(r.state.cashFlow.CFo).toBe(6.125);
  });
});

// ===========================================================================
// 2ND CLR WORK -- three separately scoped resets (guidebook p. 42)
// ===========================================================================

describe('2ND CLR WORK is scoped to the view you stand in (guidebook p. 42)', () => {
  const seeded: CalculatorState = withStream({ ...editedStream(), I: 20 });

  it('in CF: clears CFo and every Cnn/Fnn, but LEAVES I (the NPV rate)', () => {
    const r = press(['CF', '2ND', 'CLR WORK'], seeded);
    expect(renderFlat(r.display)).toBe('CFo= 0.00');
    expect(r.state.cashFlow.CFo).toBe(0);
    expect(r.state.cashFlow.groups).toEqual([]);
    expect(r.state.cashFlow.I).toBe(20); // I survives -- p. 42 names only CFo/Cnn/Fnn
  });

  it('in CF: touches only Cash Flow, not the TVM registers or Profit Margin', () => {
    const both: CalculatorState = {
      ...seeded,
      tvm: { ...seeded.tvm, PV: 120000 },
      profit: { ...seeded.profit, CST: 42 },
    };
    const r = press(['CF', '2ND', 'CLR WORK'], both);
    expect(r.state.tvm.PV).toBe(120000);
    expect(r.state.profit.CST).toBe(42);
  });

  it('in NPV: leaves the flows and I intact (NPV is recomputed, not a stored register)', () => {
    // p. 42's NPV bullet names only NPV; there is no stored NPV to zero, and I is
    // left alone (OPEN-QUESTIONS CF-19). The clear simply re-lands on I.
    const r = press(['NPV', '2ND', 'CLR WORK'], seeded);
    expect(r.display.label).toBe('I=');
    expect(r.state.cashFlow.I).toBe(20);
    expect(r.state.cashFlow.groups).toEqual(editedStream().groups);
  });

  it('in IRR: leaves the flows intact (IRR is recomputed, not stored)', () => {
    const r = press(['IRR', '2ND', 'CLR WORK'], seeded);
    expect(r.display.label).toBe('IRR=');
    expect(r.state.cashFlow.groups).toEqual(editedStream().groups);
  });
});

// ===========================================================================
// 2ND QUIT (guidebook p. 11)
// ===========================================================================

describe('2ND QUIT leaves to standard mode, keeping the stream (p. 11)', () => {
  it('returns to standard mode at zero but preserves the entered flows', () => {
    const r = press([...kCFo, 'DOWN', '3000', 'ENTER', '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(renderFlat(r.display)).toBe('0.00');
    expect(r.state.cashFlow.CFo).toBe(-7000);
    expect(r.state.cashFlow.groups[0]?.C).toBe(3000);
  });

  it('re-entering with CF shows the retained stream, not a fresh default', () => {
    const left = press([...kCFo, '2ND', 'QUIT']).state;
    expect(screen(['CF'], left)).toBe('CFo= -7,000.00');
  });
});

// ===========================================================================
// Error conditions the worksheet raises (guidebook pp. 84-85)
// ===========================================================================

describe('errors latch rather than throw (guidebook pp. 84-85)', () => {
  it('Error 4: an Fnn outside 0.5-9,999 (here 0) keyed into F01', () => {
    const r = press(['CF', 'DOWN', 'DOWN', '0', 'ENTER']);
    expect(r.display.value).toBe('Error 4');
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
    // CE/C recovers and the worksheet is still there.
    const cleared = reduce(r.state, 'CE/C');
    expect(cleared.state.errorState).toBeNull();
    expect(cleared.state.mode.kind).toBe('worksheet');
  });

  it('Error 4: an Fnn above 9,999', () => {
    const r = press(['CF', 'DOWN', 'DOWN', '10000', 'ENTER']);
    expect(r.display.value).toBe('Error 4');
    expect(r.state.errorState).toBe(ErrorCode.OutOfRange);
  });

  it('Error 5: IRR on a stream with no sign change (empty/default stream)', () => {
    // p. 84: IRR without at least one sign change. IRR is a retained register, so
    // opening the field shows 0.00 and the error appears when CPT computes it.
    const r = press(['IRR', 'CPT']);
    expect(r.display.value).toBe('Error 5');
    expect(r.state.errorState).toBe(ErrorCode.NoSolution);
  });

  it('Error 5: IRR on an all-outflow stream (the lease has no sign change)', () => {
    const r = press(['IRR', 'CPT'], withStream(leaseStream()));
    expect(r.display.value).toBe('Error 5');
    expect(r.state.errorState).toBe(ErrorCode.NoSolution);
  });

  it('Error 5: NPV at I <= -100, where the LN input 1 + i goes non-positive (p. 84)', () => {
    // Fires on scrolling onto NPV, which computes it -- like any auto compute.
    const r = press(['NPV', '100', '+/-', 'ENTER', 'DOWN', 'CPT'], withStream(editedStream()));
    expect(r.display.value).toBe('Error 5');
    expect(r.state.errorState).toBe(ErrorCode.NoSolution);
  });

  it('Error 7: IRR on two sign changes with no real root (p. 46)', () => {
    // NPV = -1 + 3x - 3x^2 has a negative discriminant: two sign changes, no root.
    let s = setCFo(CASH_FLOW_DEFAULTS, -1);
    s = setFlow(setFlow(s, 1, 3), 2, -3);
    const r = press(['IRR', 'CPT'], withStream(s));
    expect(r.display.value).toBe('Error 7');
    expect(r.state.errorState).toBe(ErrorCode.IterationLimitExceeded);
  });

  it('a latched error swallows every key but CE/C, then the worksheet resumes', () => {
    const errored = press(['CF', 'DOWN', 'DOWN', '0', 'ENTER']);
    expect(press(['9'], errored.state).display.value).toBe('Error 4'); // 9 ignored
    const back = reduce(errored.state, 'CE/C');
    expect(back.state.errorState).toBeNull();
    expect(back.state.mode.kind).toBe('worksheet');
  });
});

// ===========================================================================
// Totality: project never throws, even on a throwing field powered off
// ===========================================================================

describe('IRR is a retained register, so opening it never computes (p. 45, p. 48)', () => {
  it('shows 0.00 on a default stream instead of throwing Error 5', () => {
    // Under the register model, opening IRR reads its stored value; only CPT
    // computes, so an unsolvable stream cannot make the display throw on landing.
    const onIrr: CalculatorState = {
      ...INITIAL_STATE,
      mode: { kind: 'worksheet', worksheet: 'IRR', field: 0 },
    };
    expect(() => project(onIrr)).not.toThrow();
    expect(project(onIrr).value).toBe('0.00');
    expect(project(onIrr).indicators).toContain('='); // the register value IS on screen
  });

  it('projection stays total even powered off', () => {
    const off: CalculatorState = {
      ...INITIAL_STATE,
      mode: { kind: 'worksheet', worksheet: 'IRR', field: 0 },
      poweredOn: false,
    };
    expect(() => project(off)).not.toThrow();
    expect(() => reduce(off, '5')).not.toThrow();
  });
});
