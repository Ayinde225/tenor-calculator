import { describe, it, expect } from 'vitest';
import { reduce, reduceAll, project, INITIAL_STATE } from './machine.js';
import { parseKeySequence } from './keys.js';
import { renderFlat } from './display-state.js';
import { ErrorCode } from '../errors.js';
import type { CalculatorState } from './state.js';
import {
  WORKSHEET_ENTRY_KEYS,
  assertRegistryConsistent,
  enterWorksheet,
  reduceWorksheet,
  worksheetDisplay,
  type WorksheetDescriptor,
  type WorksheetRegistry,
} from './worksheet-nav.js';
import { WORKSHEETS } from './worksheet-registry.js';

/** Press a recorded sequence. Tokens as an array -- `CLR WORK` is one key. */
function press(tokens: readonly string[], from: CalculatorState = INITIAL_STATE) {
  return reduceAll(from, parseKeySequence(tokens));
}

const screen = (tokens: readonly string[], from?: CalculatorState): string =>
  renderFlat(press(tokens, from).display);

const value = (tokens: readonly string[], from?: CalculatorState): string =>
  press(tokens, from).display.value;

/** The p. 40 mortgage, already solved: N=360, 6.125%, PV=120,000, monthly, END. */
const mortgage: CalculatorState = {
  ...INITIAL_STATE,
  tvm: {
    ...INITIAL_STATE.tvm,
    N: 360,
    IY: 6.125,
    PV: 120000,
    PMT: -729.132647,
    FV: 0,
    PY: 12,
    CY: 12,
    mode: 'END',
  },
};

/** The p. 41 balloon loan: $82,000 at 7% over 30 years, P1 already 1. */
const balloon: CalculatorState = {
  ...INITIAL_STATE,
  tvm: {
    ...INITIAL_STATE.tvm,
    N: 360,
    IY: 7,
    PV: 82000,
    PMT: -545.548046,
    FV: 0,
    PY: 12,
    CY: 12,
    mode: 'END',
  },
  amort: { P1: 1, P2: 1 },
};

// ===========================================================================
// The contract
// ===========================================================================

describe('the registry is the switch', () => {
  it('every descriptor agrees with its own kind declarations', () => {
    expect(() => assertRegistryConsistent(WORKSHEETS)).not.toThrow();
  });

  it('rejects a field whose kind and handlers disagree', () => {
    // The check has to actually catch something, or it is decoration.
    const broken: WorksheetRegistry = {
      DATE: {
        id: 'DATE',
        fields: [{ label: 'X=', kind: 'auto', get: () => 0, set: (s) => s }],
        clearWork: (s) => s,
      },
    };
    expect(() => assertRegistryConsistent(broken)).toThrow(/neither ENTER nor CPT/);
  });

  it('names an entry key for every worksheet id', () => {
    // A descriptor nobody can reach is dead code; the eight still to be built
    // should find their key already wired.
    const reachable = new Set(Object.values(WORKSHEET_ENTRY_KEYS));
    for (const id of Object.keys(WORKSHEETS)) expect(reachable).toContain(id);
  });

  it('routes every worksheet entry key to a registered descriptor', () => {
    // Now that all worksheets are wired, this is the invariant that matters:
    // no entry key resolves to a worksheet the registry lacks. A new entry key
    // added without its descriptor would trip here.
    for (const id of new Set(Object.values(WORKSHEET_ENTRY_KEYS))) {
      expect(WORKSHEETS[id], `entry key opens ${id}, which has no descriptor`).toBeDefined();
    }
  });

  it('renders inert rather than crashing if a mode names a descriptor-less worksheet', () => {
    // The safety net still matters even though the registry is now complete: a
    // future refactor could leave a mode pointing at a worksheet pulled from the
    // registry. Exercised against an empty registry via the parameterised nav
    // function, since no real worksheet is unregistered any more.
    const stranded: CalculatorState = {
      ...INITIAL_STATE,
      mode: { kind: 'worksheet', worksheet: 'BOND', field: 0 },
    };
    const empty: WorksheetRegistry = {};
    const fmt = { decimals: INITIAL_STATE.format.DEC, separator: INITIAL_STATE.format.separators };
    expect(worksheetDisplay(stranded, empty, fmt, [])).toBeNull();
  });
});

// ===========================================================================
// Profit Margin -- three enter-or-compute fields, no settings (pp. 70-71)
// ===========================================================================

describe('golden: other-worksheets-profit-margin-* (guidebook p. 71)', () => {
  it('opens on CST', () => {
    expect(screen(['2ND', 'PROFIT'])).toBe('CST= 0.00');
  });

  it('DOWN reaches SEL, and 125 ENTER assigns it', () => {
    expect(value(['2ND', 'PROFIT', 'DOWN', '125', 'ENTER'])).toBe('125.00');
  });

  it('DOWN again reaches MAR, and 20 ENTER assigns it', () => {
    const r = press(['2ND', 'PROFIT', 'DOWN', '125', 'ENTER', 'DOWN', '20', 'ENTER']);
    expect(r.display.label).toBe('MAR=');
    expect(r.display.value).toBe('20.00');
  });

  it('UP UP walks back to CST, where CPT computes the cost', () => {
    const r = press([
      '2ND', 'PROFIT',
      'DOWN', '125', 'ENTER',
      'DOWN', '20', 'ENTER',
      'UP', 'UP', 'CPT',
    ]);
    expect(renderFlat(r.display)).toBe('CST= 100.00');
    expect(r.state.profit.CST).toBe(100);
  });
});

describe('Profit Margin fields are interchangeable (p. 70)', () => {
  it('computes MAR from CST and SEL', () => {
    // The same 100/125 pair the guidebook runs the other way round.
    const r = press(['2ND', 'PROFIT', '100', 'ENTER', 'DOWN', '125', 'ENTER', 'DOWN', 'CPT']);
    expect(renderFlat(r.display)).toBe('MAR= 20.00');
  });

  it('computes SEL from CST and MAR', () => {
    const r = press(['2ND', 'PROFIT', '100', 'ENTER', 'DOWN', 'DOWN', '20', 'ENTER', 'UP', 'CPT']);
    expect(renderFlat(r.display)).toBe('SEL= 125.00');
  });
});

// ===========================================================================
// Amortization -- entry fields, AUTO fields, and a DEC-dependent schedule
// ===========================================================================

describe('golden: amort-year1-* (guidebook p. 40)', () => {
  /** The full p. 40 path: solve the TVM first, then amortize it. */
  const solved = press(
    ['30', '2ND', 'xP/Y', 'N', '6.125', 'I/Y', '120000', 'PV', 'CPT', 'PMT'],
    { ...INITIAL_STATE, tvm: { ...INITIAL_STATE.tvm, PY: 12, CY: 12 } },
  ).state;

  const range = ['2ND', 'AMORT', '1', 'ENTER', 'DOWN', '9', 'ENTER'];

  it('BAL after payment 9', () => {
    expect(screen([...range, 'DOWN'], solved)).toBe('BAL= 118,928.63');
  });

  it('PRN over payments 1-9', () => {
    expect(screen([...range, 'DOWN', 'DOWN'], solved)).toBe('PRN= -1,071.37');
  });

  it('INT over payments 1-9', () => {
    expect(screen([...range, 'DOWN', 'DOWN', 'DOWN'], solved)).toBe('INT= -5,490.80');
  });
});

describe('golden: amort-year2-* and amort-year3-* (guidebook p. 40)', () => {
  const year2 = ['2ND', 'AMORT', '10', 'ENTER', 'DOWN', '21', 'ENTER'];
  const year3 = ['2ND', 'AMORT', '22', 'ENTER', 'DOWN', '33', 'ENTER'];

  it('year 2: BAL / PRN / INT', () => {
    expect(screen([...year2, 'DOWN'], mortgage)).toBe('BAL= 117,421.60');
    expect(screen([...year2, 'DOWN', 'DOWN'], mortgage)).toBe('PRN= -1,507.03');
    expect(screen([...year2, 'DOWN', 'DOWN', 'DOWN'], mortgage)).toBe('INT= -7,242.53');
  });

  it('year 3: BAL / PRN / INT', () => {
    expect(screen([...year3, 'DOWN'], mortgage)).toBe('BAL= 115,819.62');
    expect(screen([...year3, 'DOWN', 'DOWN'], mortgage)).toBe('PRN= -1,601.98');
    expect(screen([...year3, 'DOWN', 'DOWN', 'DOWN'], mortgage)).toBe('INT= -7,147.58');
  });
});

describe('golden: amort-balloon-* (guidebook p. 41)', () => {
  // `↓ 5 2ND [xP/Y] ENTER` -- xP/Y works INSIDE the worksheet, and ENTER commits
  // the value it left on the display, not a keyed one.
  const toP2 = ['2ND', 'AMORT', 'DOWN', '5', '2ND', 'xP/Y', 'ENTER'];

  it('BAL: the balloon due after five years', () => {
    expect(screen([...toP2, 'DOWN'], balloon)).toBe('BAL= 77,187.72');
  });

  it('INT: interest received over the first five years', () => {
    expect(screen([...toP2, 'DOWN', 'DOWN', 'DOWN'], balloon)).toBe('INT= -27,920.72');
  });

  it('xP/Y turned 5 years into 60 payments before ENTER saw it', () => {
    expect(press(toP2, balloon).state.amort.P2).toBe(60);
  });
});

describe('golden: amort-year3-auto-advance-* (guidebook p. 40) -- CPT on P1', () => {
  /**
   * The recorded key list in `tvm-and-amortization.json` is one DOWN short.
   *
   * It records `2ND AMORT DOWN DOWN DOWN DOWN CPT` and expects `P1= 22.00`. Four
   * DOWNs from P1 land on INT, not back on P1. The case's OWN note says what the
   * keys should be -- "From INT, DOWN wraps to P1; CPT then advances BOTH P1 and
   * P2" and "The DOWN keys walk P1->P2->BAL->PRN->INT then wrap", which is five
   * transitions for four keys -- and the p. 40 table prints the press column as
   * `↓ CPT` from INT, one arrow then CPT. The note, the table and the worksheet's
   * five fields all agree with each other and disagree with the key list.
   *
   * So the expectation is honoured and the key list is corrected by one press.
   * The defect is pinned below rather than hidden.
   */
  const toInt = ['2ND', 'AMORT', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
  const window2: CalculatorState = { ...mortgage, amort: { P1: 10, P2: 21 } };

  it('CPT on P1 advances both bounds, preserving the window width', () => {
    const r = press([...toInt, 'DOWN', 'CPT'], window2);
    expect(renderFlat(r.display)).toBe('P1= 22.00');
    expect(r.state.amort).toEqual({ P1: 22, P2: 33 });
  });

  it('P2 is already updated when you scroll to it', () => {
    expect(screen([...toInt, 'DOWN', 'CPT', 'DOWN'], window2)).toBe('P2= 33.00');
  });

  it('the third year then reads off the advanced window', () => {
    expect(screen([...toInt, 'DOWN', 'CPT', 'DOWN', 'DOWN'], window2)).toBe('BAL= 115,819.62');
  });

  it('CPT on P2 advances the window too (p. 28)', () => {
    const r = press(['2ND', 'AMORT', 'DOWN', 'CPT'], window2);
    expect(renderFlat(r.display)).toBe('P2= 33.00');
    expect(r.state.amort).toEqual({ P1: 22, P2: 33 });
  });

  it('DEFECT: the sequence as recorded stops on INT and CPT does nothing there', () => {
    // Pinned, not papered over. If the corpus is ever corrected this test is the
    // thing that should change.
    expect(renderFlat(press(toInt, window2).display)).toBe('INT= -7,242.53');
    expect(renderFlat(press([...toInt, 'CPT'], window2).display)).toBe('INT= -7,242.53');
  });
});

describe('the amortization schedule follows DEC (p. 9, p. 76)', () => {
  it('a different decimal setting is a different schedule, not a different rendering', () => {
    const at2 = press(['2ND', 'AMORT', '1', 'ENTER', 'DOWN', '9', 'ENTER', 'DOWN'], mortgage);
    const at4 = press(['2ND', 'AMORT', '1', 'ENTER', 'DOWN', '9', 'ENTER', 'DOWN'], {
      ...mortgage,
      format: { ...mortgage.format, DEC: 4 },
    });
    expect(at2.display.value).toBe('118,928.63');
    // Not 118,928.6300: the fifth and sixth decimals are 81, not 00, because RND
    // rounds to the DISPLAYED setting INSIDE the loop -- a genuinely different
    // schedule, not the DEC=2 answer shown to more places.
    expect(at4.display.value).toBe('118,928.6181');
    expect(at4.state.displayValue).not.toBe(at2.state.displayValue);
  });
});

// ===========================================================================
// Generic navigation (pp. 21-22, 28)
// ===========================================================================

describe('the field ring wraps (p. 28)', () => {
  it('DOWN from the last field returns to the first', () => {
    // p. 28 step 6: "If INT is displayed, press ↓ to display P1 again."
    const toInt = ['2ND', 'AMORT', 'DOWN', 'DOWN', 'DOWN', 'DOWN'];
    expect(press(toInt, mortgage).display.label).toBe('INT=');
    expect(press([...toInt, 'DOWN'], mortgage).display.label).toBe('P1=');
  });

  it('UP from the first field reaches the last', () => {
    // Symmetric with the DOWN wrap. No worked example scrolls off the top, so
    // this direction is inference -- see the note in worksheet-nav.ts.
    expect(press(['2ND', 'PROFIT', 'UP'], mortgage).display.label).toBe('MAR=');
  });

  it('a full lap returns to where it started', () => {
    const lap = press(['2ND', 'AMORT', 'DOWN', 'DOWN', 'DOWN', 'DOWN', 'DOWN'], mortgage);
    expect(lap.state.mode).toEqual({ kind: 'worksheet', worksheet: 'AMORT', field: 0 });
  });

  it('re-pressing the entry key returns to the first field (p. 28)', () => {
    const r = press(['2ND', 'AMORT', 'DOWN', 'DOWN', '2ND', 'AMORT'], mortgage);
    expect(r.display.label).toBe('P1=');
  });
});

describe('automatic-compute fields are never stored (p. 22)', () => {
  it('BAL evaluates on sight and leaves no copy in state', () => {
    const r = press(['2ND', 'AMORT', '1', 'ENTER', 'DOWN', '9', 'ENTER', 'DOWN'], mortgage);
    expect(r.display.value).toBe('118,928.63');
    // The only amortization state is the range. There is nowhere for a stale BAL
    // to hide.
    expect(r.state.amort).toEqual({ P1: 1, P2: 9 });
  });

  it('a BAL already on screen re-reads when PMT changes underneath it', () => {
    const onBal = press(['2ND', 'AMORT', '1', 'ENTER', 'DOWN', '9', 'ENTER', 'DOWN'], mortgage);
    // Halve the payment from inside the worksheet, then scroll away and back.
    const changed = press(['364.57', '+/-', 'PMT', 'UP', 'DOWN'], onBal.state);
    expect(changed.display.value).not.toBe('118,928.63');
    // A payment below the monthly interest: the balance grows instead of falling.
    expect(changed.display.value).toBe('122,277.49');
  });

  it('refreshes Last Answer, being an automatic compute (p. 19)', () => {
    const r = press(['2ND', 'AMORT', '1', 'ENTER', 'DOWN', '9', 'ENTER', 'DOWN'], mortgage);
    expect(r.state.ans).toBe(r.state.displayValue);
  });
});

describe('entered values are stored at internal precision, not display precision (§1.4)', () => {
  it('keeps 6.125 as 6.125 even though the LCD shows 6.13', () => {
    const r = press(['2ND', 'PROFIT', 'DOWN', '6.125', 'ENTER'], INITIAL_STATE);
    expect(r.display.value).toBe('6.13');
    expect(r.state.profit.SEL).toBe(6.125);
  });
});

// ===========================================================================
// The display trap (p. 27) and the indicator prompts (pp. 21-22)
// ===========================================================================

describe("the '=' indicator is the only cue that the number belongs to the label (p. 27)", () => {
  it('is lit on the value a field is showing', () => {
    const r = press(['2ND', 'PROFIT', 'DOWN', '125', 'ENTER']);
    expect(r.display.label).toBe('SEL=');
    expect(r.display.indicators).toContain('=');
  });

  it('goes dark mid-entry: a half-keyed number belongs to nobody', () => {
    const r = press(['2ND', 'PROFIT', 'DOWN', '125']);
    expect(r.display.label).toBe('SEL='); // the label stays...
    expect(r.display.value).toBe('125');
    expect(r.display.indicators).not.toContain('='); // ...but the cue is gone.
  });

  it('comes back the instant ENTER assigns it', () => {
    const keyed = press(['2ND', 'PROFIT', 'DOWN', '125']);
    expect(reduce(keyed.state, 'ENTER').display.indicators).toContain('=');
  });

  it('goes dark when a TVM key leaves a foreign value under the label (p. 27)', () => {
    // The trap in its purest form: `P1= 120,000.00` on screen, and 120,000 is
    // PV, not P1. Only the missing `=` says so.
    const r = press(['2ND', 'AMORT', '120000', 'PV'], mortgage);
    expect(r.display.label).toBe('P1=');
    expect(r.display.value).toBe('120,000.00');
    expect(r.display.indicators).not.toContain('=');
    expect(r.state.amort.P1).toBe(1); // P1 was NOT touched
    expect(r.state.tvm.PV).toBe(120000);
  });

  it('goes dark when 2ND xP/Y leaves its product under the label (p. 41)', () => {
    const r = press(['2ND', 'AMORT', 'DOWN', '5', '2ND', 'xP/Y'], balloon);
    expect(r.display.label).toBe('P2=');
    expect(r.display.value).toBe('60.00');
    expect(r.display.indicators).not.toContain('=');
    expect(r.state.amort.P2).toBe(1); // still unassigned until ENTER
  });
});

describe('indicator prompts follow the variable type (pp. 21-22)', () => {
  it('an enter-or-compute variable prompts with both ENTER and COMPUTE', () => {
    // p. 22: "the calculator displays the variable label with the ENTER and
    // COMPUTE indicators." Profit Margin's three are all of that type.
    const d = press(['2ND', 'PROFIT']).display;
    expect(d.indicators).toContain('ENTER');
    expect(d.indicators).toContain('COMPUTE');
  });

  it('an automatic-compute variable prompts with neither', () => {
    const d = press(['2ND', 'AMORT', 'DOWN', 'DOWN'], mortgage).display;
    expect(d.label).toBe('BAL=');
    expect(d.indicators).not.toContain('ENTER');
    expect(d.indicators).not.toContain('COMPUTE');
  });

  it('offers UP and DOWN while more variables exist (p. 21)', () => {
    const d = press(['2ND', 'AMORT'], mortgage).display;
    expect(d.indicators).toContain('UP');
    expect(d.indicators).toContain('DOWN');
  });

  it('keeps the global annunciators lit inside a worksheet', () => {
    const bgn: CalculatorState = { ...mortgage, tvm: { ...mortgage.tvm, mode: 'BGN' } };
    expect(press(['2ND', 'AMORT'], bgn).display.indicators).toContain('BGN');
  });
});

// ===========================================================================
// Clearing and leaving (p. 11)
// ===========================================================================

describe('CE/C CE/C clears a keyed-but-not-entered value (p. 11)', () => {
  it('drops the keyed value and restores the previous one, without leaving', () => {
    const r = press(['2ND', 'PROFIT', 'DOWN', '125', 'ENTER', '999', 'CE/C', 'CE/C']);
    expect(renderFlat(r.display)).toBe('SEL= 125.00'); // "the previous value appears"
    expect(r.state.profit.SEL).toBe(125);
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'PROFIT', field: 1 });
  });

  it('the first press shows zero, detached from the label', () => {
    // Inference: p. 11 only documents the two-press outcome. See worksheet-nav.ts.
    const r = press(['2ND', 'PROFIT', 'DOWN', '125', 'ENTER', '999', 'CE/C']);
    expect(r.display.label).toBe('SEL=');
    expect(r.display.value).toBe('0.00');
    expect(r.display.indicators).not.toContain('=');
  });

  it('does not erase the worksheet', () => {
    const r = press(['2ND', 'PROFIT', '100', 'ENTER', 'DOWN', '125', 'ENTER', 'CE/C', 'CE/C']);
    expect(r.state.profit.CST).toBe(100);
    expect(r.state.profit.SEL).toBe(125);
  });
});

describe('2ND CLR WORK resets this worksheet and returns to its first field', () => {
  it('clears Profit Margin to zero and lands on CST (p. 70)', () => {
    const r = press(['2ND', 'PROFIT', 'DOWN', '125', 'ENTER', 'DOWN', '20', 'ENTER', '2ND', 'CLR WORK']);
    expect(renderFlat(r.display)).toBe('CST= 0.00');
    expect(r.state.profit).toEqual({ CST: 0, SEL: 0, MAR: 0 });
  });

  it('clears Amortization to P1 = P2 = 1 (p. 26)', () => {
    const r = press(['2ND', 'AMORT', '10', 'ENTER', 'DOWN', '21', 'ENTER', '2ND', 'CLR WORK'], mortgage);
    expect(renderFlat(r.display)).toBe('P1= 1.00');
    expect(r.state.amort).toEqual({ P1: 1, P2: 1 });
  });

  it('touches only the current worksheet', () => {
    const both = press(['2ND', 'PROFIT', '100', 'ENTER'], mortgage);
    const r = press(['2ND', 'AMORT', '2ND', 'CLR WORK'], both.state);
    expect(r.state.profit.CST).toBe(100); // Profit Margin untouched
    expect(r.state.tvm.PV).toBe(120000); // and so are the TVM registers
  });
});

describe('2ND QUIT leaves to standard-calculator mode (p. 11)', () => {
  it('returns to standard mode at zero, keeping the worksheet values', () => {
    const r = press(['2ND', 'PROFIT', 'DOWN', '125', 'ENTER', '2ND', 'QUIT']);
    expect(r.state.mode).toEqual({ kind: 'standard' });
    expect(renderFlat(r.display)).toBe('0.00');
    expect(r.state.profit.SEL).toBe(125);
  });

  it('drops the label with the mode', () => {
    expect(press(['2ND', 'AMORT', '2ND', 'QUIT'], mortgage).display.label).toBe('');
  });
});

// ===========================================================================
// Totality
// ===========================================================================

describe('the reducer stays total inside a worksheet', () => {
  it('latches Error 2 rather than throwing when P2 < P1', () => {
    // p. 84: computing BAL/PRN/INT with P2 < P1 is Error 2.
    const r = press(['2ND', 'AMORT', '9', 'ENTER', 'DOWN', '1', 'ENTER', 'DOWN'], mortgage);
    expect(r.display.isError).toBe(true);
    expect(r.state.errorState).toBe(ErrorCode.InvalidArgument);
  });

  it('the failed navigation does not move the field', () => {
    const r = press(['2ND', 'AMORT', '9', 'ENTER', 'DOWN', '1', 'ENTER', 'DOWN'], mortgage);
    expect(r.state.mode).toEqual({ kind: 'worksheet', worksheet: 'AMORT', field: 1 });
  });

  it('CE/C clears the error and the worksheet is still there', () => {
    const errored = press(['2ND', 'AMORT', '9', 'ENTER', 'DOWN', '1', 'ENTER', 'DOWN'], mortgage);
    const cleared = reduceAll(errored.state, ['CE/C', 'CE/C']);
    expect(cleared.state.errorState).toBeNull();
    expect(renderFlat(cleared.display)).toBe('P2= 1.00');
  });

  it('never throws out of project, even powered off on a throwing field', () => {
    const bad: CalculatorState = {
      ...mortgage,
      amort: { P1: 9, P2: 1 },
      mode: { kind: 'worksheet', worksheet: 'AMORT', field: 2 }, // BAL, which will throw
      poweredOn: false,
    };
    expect(() => project(bad)).not.toThrow();
    expect(() => reduce(bad, '5')).not.toThrow();
    // The field cannot be read, so it cannot be claimed to belong to the label.
    expect(project(bad).indicators).not.toContain('=');
  });
});

// ===========================================================================
// The two contract corners neither reference worksheet reaches
// ===========================================================================

describe('settings and conditional fields', () => {
  /**
   * Neither PROFIT nor AMORT has a setting or a conditional field, so the
   * `cycle` and `visible` halves of the contract are proved against a synthetic
   * descriptor. The eight worksheets still to be built need both: ACT/360, 2/Y
   * 1/Y, END/BGN, the DEPR method and the STAT method are settings, and Bond's
   * and Depreciation's field lists change shape with them.
   */
  const spy: WorksheetDescriptor = {
    id: 'DATE',
    fields: [
      {
        label: '',
        kind: 'setting',
        get: (s) => (s.date.method === 'ACT' ? 'ACT' : '360'),
        cycle: (s) => ({
          ...s,
          date: { ...s.date, method: s.date.method === 'ACT' ? '360' : 'ACT' },
        }),
      },
      {
        label: 'DBD=',
        kind: 'entry',
        get: (s) => s.date.DBD,
        set: (s, v) => ({ ...s, date: { ...s.date, DBD: v } }),
        // Only reachable under ACT, purely to exercise the skip.
        visible: (s) => s.date.method === 'ACT',
      },
      { label: 'END=', kind: 'entry', get: () => 0, set: (s) => s },
    ],
    clearWork: (s) => s,
  };
  const registry: WorksheetRegistry = { DATE: spy };
  const fmt = { decimals: 2 as const, separator: 'US' as const };

  const opened = enterWorksheet(INITIAL_STATE, 'DATE', registry);

  it('renders a setting as its printed name, with the SET indicator', () => {
    const d = worksheetDisplay(opened, registry, fmt, []);
    expect(d?.value).toBe('ACT');
    expect(d?.indicators).toContain('SET');
    expect(d?.indicators).toContain('=');
  });

  it('2ND SET cycles the setting in place', () => {
    const cycled = reduceWorksheet(opened, 'SET', registry);
    expect(cycled?.date.method).toBe('360');
    expect(cycled?.mode).toEqual({ kind: 'worksheet', worksheet: 'DATE', field: 0 });
    expect(worksheetDisplay(cycled!, registry, fmt, [])?.value).toBe('360');
  });

  it('DOWN skips a field whose visible() is false', () => {
    const under360 = reduceWorksheet(opened, 'SET', registry)!;
    expect(reduceWorksheet(under360, 'DOWN', registry)?.mode).toEqual({
      kind: 'worksheet',
      worksheet: 'DATE',
      field: 2, // DBD skipped
    });
    // ...and stops there when it is true.
    expect(reduceWorksheet(opened, 'DOWN', registry)?.mode).toEqual({
      kind: 'worksheet',
      worksheet: 'DATE',
      field: 1,
    });
  });

  it('the wrap honours visibility too', () => {
    const under360 = reduceWorksheet(opened, 'SET', registry)!;
    const last = reduceWorksheet(under360, 'DOWN', registry)!;
    expect(reduceWorksheet(last, 'DOWN', registry)?.mode).toMatchObject({ field: 0 });
    // UP from the first wraps past the invisible DBD to the last.
    expect(reduceWorksheet(under360, 'UP', registry)?.mode).toMatchObject({ field: 2 });
  });

  it('ENTER, CPT and SET are ignored by a field that cannot take them', () => {
    const onSetting = opened;
    expect(reduceWorksheet(onSetting, 'ENTER', registry)).toBe(onSetting);
    expect(reduceWorksheet(onSetting, 'CPT', registry)).toBe(onSetting);
    const onEntry = reduceWorksheet(opened, 'DOWN', registry)!;
    expect(reduceWorksheet(onEntry, 'SET', registry)).toBe(onEntry);
  });

  it('leaves unclaimed keys to the standard calculator', () => {
    expect(reduceWorksheet(opened, '5', registry)).toBeNull();
    expect(reduceWorksheet(opened, 'QUIT', registry)).toBeNull();
    expect(reduceWorksheet(opened, 'PV', registry)).toBeNull();
  });
});
