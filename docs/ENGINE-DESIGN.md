# Engine Design

> Derived from `docs/spec/*.md` (the full guidebook extraction) and validated against
> `tests/golden/*.json` (256 cases). This document is what implementers build from: every section
> ends in a decision, not a survey of options. Where the guidebook is genuinely ambiguous the
> decision is still made here, marked **[DECISION]**, and cross-referenced to `OPEN-QUESTIONS.md` so
> it can be revisited when hardware arbitration becomes available.

**The engine is the product.** `packages/calculator-core` has zero runtime dependencies and no UI. It
is a pure reducer: `state + key command → new state + display`. Every worksheet formula is a pure
function over plain numbers. Nothing in the core imports a framework, touches the DOM, or reads a
clock.

**The governing rule.** Where a printed formula and a worked example disagree, **the worked example
wins** and the printed formula is recorded as a defect. This is not a stylistic preference: the
appendix contains at least four confirmed defects, and one of them (`PMT`) inverts a sign.

---

## 1. Numeric precision model

### 1.1 The two widths

| Width | Value | Source |
|---|---|---|
| Internal ("guard digits") | **13 significant digits** | p. 86 |
| Display | **≤ 10 significant digits**, further narrowed by `DEC` | p. 86, p. 9 |

The hardware is a **decimal** machine with a 13-significant-digit mantissa. IEEE-754 doubles carry
~15-17 significant digits and are therefore **more precise than the hardware**. This sounds harmless.
It is the single largest source of parity drift, because the extra precision does not merely sit
unused — it changes results.

The guidebook pins this down with its own worked example (p. 86):

```
1 ÷ 3               → 0.3333333333333      (13 digits internal, NOT 0.3333333333333333)
0.3333333333333 × 3 → 0.9999999999999      (13 digits internal, NOT 1)
display             → 1                     (the DISPLAY rounds; the internal value does not)
```

A naive double computes `(1/3)*3 === 1` exactly, so the intermediate `0.9999999999999` never exists.
Here it happens to produce the same *display* — which is exactly why it is dangerous. The divergence
is real, it is invisible in this example, and it compounds through iterative solves.

**[DECISION]** Every value entering the internal store passes through a 13-significant-digit round.
This is `toInternal()` in `src/numeric/precision.ts` and it is mandatory on the result of **every**
arithmetic operation, not just on values the user sees.

### 1.2 How to emulate 13 decimal digits with IEEE-754

Use `Number(x.toPrecision(13))`, not `Math.round(x * 10**k) / 10**k`.

The multiply-round-divide idiom fails two ways: the scale factor `10**k` overflows for extreme
exponents (the machine range runs to `E99`), and it misrounds near representability boundaries
because the intermediate product is itself inexact. `toPrecision` is specified to produce the
correctly rounded **decimal** string for the requested significant-digit count — which is precisely
the decimal semantics being emulated. Round-tripping through `Number()` then lands on the nearest
double to that decimal value.

This is not exact decimal arithmetic. It is *decimal rounding applied at every operation boundary*,
which is a faithful model of a machine whose registers hold 13 decimal digits. The residual error is
the double's representation error for a 13-digit decimal (~1e-16 relative), i.e. three orders of
magnitude below the least significant digit the machine keeps. **[DECISION]** This is accepted; a
BigDecimal library is not warranted and would violate the zero-dependency constraint.

### 1.3 Where rounding IS applied

| Site | Rounding | Source |
|---|---|---|
| After every arithmetic operation | 13 significant digits | p. 86 |
| At the display boundary | `DEC` decimal places (or floating at `DEC=9`), capped at 10 significant digits | p. 9, p. 86 |
| `2ND ROUND` | **Replaces the internal value** with its displayed, rounded form | p. 15 |
| **Amortization**, inside the loop | to the **displayed decimal setting** — see §3 | p. 76 |
| **Depreciation**, on `DEP`/`RDV`/`CST`/`SAL` | to the **displayed decimal setting** — see §3 | p. 78 |

### 1.4 Where rounding is NOT applied — and this is load-bearing

| Site | Rule | Failure if you get it wrong |
|---|---|---|
| Entered values | Stored at full internal precision **regardless of what the display shows** | `6.125 I/Y` displays `6.13`; storing `6.13` gives `PMT = -729.52` instead of `-729.13` (p. 39) |
| Computed rates | Same | `22 ÷ 12 = I/Y` displays `1.83`; storing `1.83` gives `PV = 40,601.33` instead of `40,573.18` (p. 35) |
| Cash Flow `I` | Same | `10 ÷ 12 ENTER` displays `0.83`; storing `0.83` gives `NPV = -138,181.32` instead of `-138,088.44` — off by $92.89 (p. 49) |
| `STO` / `STO +` | Memory arithmetic **must not round** | Summing four displayed PVs gives `23,171.22`; the guidebook's answer is `23,171.23` (pp. 33-34) |
| `RCL` | Recalls the full 13-digit internal value | A stored value can legitimately be more precise than anything showable (p. 9, p. 16) |
| `FV` in TVM | Uses the **unrounded** `PMT` while `BAL`/`PRN`/`INT` use the rounded one | See §3.2 — the divergence is **specified behaviour**, not a bug |
| Bond internals | No statement that Bond rounds internals, unlike Depreciation | **[DECISION]** Assume full internal precision, round only at display (`bond.md` edge case 13) |

**Changing `DEC` does not round stored values** — with the sole exception of amortization and
depreciation results (p. 9). That exception is stated once, in passing, on the format page, and has
consequences in two other worksheets. It must not be dropped.

### 1.5 Display rounding rule

Round-**half-up** on the first digit past the displayed width. **Not** banker's rounding (p. 86).

```
Let r = the internally computed 13-significant-digit result.
Let d = significant digits the current format would show (d ≤ 10).

if significantDigits(r) >= d + 1:
    display = roundHalfUp(r, to = d significant digits)
else:
    display = r
```

The guidebook states the rule against the **11th** significant digit specifically, because 10 is the
maximum displayed width (p. 86). At `DEC < 8` fewer digits show, and whether the decision then moves
to the `(shown+1)`-th digit is not documented. **[DECISION]** Generalise to the `(d+1)`-th digit —
this is the only reading consistent with `DEC` doing anything at all. Logged as **ERR-6**.

### 1.6 Negative zero

Negative zero is **observable on the hardware** and the display shows `-0.00`. Doubles distinguish
`-0` from `0` but `===` does not, so the test must be explicit: `Object.is(x, -0)`.

**[DECISION]** `toInternal()` preserves the sign through underflow — a value that underflows from
below flushes to `-0`, not `0`. `roundToSignificantDigits` returns `x` unchanged at `x === 0`, which
preserves `-0` because `toPrecision` on `-0` would produce the string `"0"` and lose it.

### 1.7 Overflow and underflow thresholds

| Threshold | Value | Error |
|---|---|---|
| Overflow | `\|x\| ≥ 1e100` | **Error 1** |
| Underflow | `0 < \|x\| < 1e-99` | **flushes to ±0, no error** |
| Non-finite (`NaN`, `±Infinity`) | any | **Error 1** |

**The overflow constant is contradictory in the source.** p. 84 prints the range as
`±9.9999999999999E99` — a leading 9 plus 13 more nines = **14 significant digits**. p. 86 states the
machine stores **13**. A 13-digit mantissa's largest value is `9.999999999999E99` (12 nines after the
point). The two pages cannot both be right, and no worked example exercises the boundary.

**[DECISION]** Test against `1e100` rather than either printed mantissa. Every candidate — 13-digit
`9.999999999999E99` and 14-digit `9.9999999999999E99` — is strictly below `1e100`, so this boundary
is **correct under either reading** and the ambiguity never has to be resolved to ship. Logged as
**ERR-1**.

Division by zero raises **Error 1**, including a division that only occurs internally (p. 84). Note
the asymmetry that catches people: `LN 0` is **Error 2** (invalid argument), not Error 1, because the
rule is "`LN x` where x is not > 0" — the domain check fires before any division could (p. 84).

### 1.8 Integrality at internal precision

`x!`, `nCr`/`nPr` and `y^x` all have to decide whether an operand is an integer. A double can deliver
`4.999999999999999` where the machine holds `5`. **[DECISION]** Test integrality **after** rounding to
13 digits: `Number.isInteger(roundToSignificantDigits(x, 13))`. Testing the raw double is wrong.

---

## 2. Sign conventions

There is no single sign convention. There are **three**, and which applies is a property of the
worksheet.

### 2.1 TVM and Cash Flow — the cash-flow convention

**Money received is positive. Money paid out is negative** (pp. 26-27, p. 42).

This is symmetric across entry **and** results: computed inflows come back positive, computed
outflows come back negative (p. 27). Every `CPT PMT` in the guidebook returns a negative number
because every one of them is a payment the user makes.

It is not cosmetic. It is load-bearing in two places:

- **Error 5** fires when solving `I/Y` if `FV`, `(N × PMT)` and `PV` all carry the same sign — the
  balance equation then has no sign change and the root-finder cannot bracket a root (p. 84). The
  guidebook attaches the remedy directly: make inflows positive and outflows negative.
- **IRR** requires at least one sign change across `CFo` and the `Cnn` list, and `CFo` participates in
  the count (p. 45).

### 2.2 Bond, Depreciation, Profit Margin, Breakeven — no sign convention

**Nothing in these worksheets is signed by direction.** `PRI`, `AI`, `RV`, `CPN` are positive
magnitudes per $100 of par (p. 50, p. 52). `CST`, `SAL`, `DEP`, `RBV`, `RDV` are unsigned magnitudes
(p. 58). Breakeven's `FC` and `VC` are entered as **positive** magnitudes and subtracted by the
formula — `PFT = PQ - (FC + VCQ)` (p. 81).

**Do not "helpfully" apply the TVM convention here.** The p. 72 breakeven example gives
`Q = (3000+0)/(20-15) = 600.00` with no sign flip anywhere.

### 2.3 The perpetual-annuity trap

The p. 32 perpetual-annuity example computes `110 ÷ 15 % =` → `733.33` — a **positive price**, the
opposite of the TVM worksheet's outflow-negative convention. These formulas are pencil-and-paper
aids executed on the arithmetic keys; they never touch `PV`/`PMT`. **[DECISION]** They must **not** be
routed through the TVM solver.

### 2.4 Amortization's double inversion

`I_m = RND[RND12(-i × bal(m-1))]`. For a loan (`PV > 0`) the interest component is **negative** and is
then *subtracted* from the balance — two sign inversions that cancel to a balance increase, before
`RND(PMT)` (itself negative) reduces it. `PRN` and `INT` therefore **both display negative** for a
standard loan. This looks wrong and is correct.

### 2.5 The confirmed `PMT` sign defect

**The printed `PMT` formula (p. 75) is missing its leading minus sign.**

```
PMT = (i / G_i) × [ PV + (PV + FV) / ((1+i)^N - 1) ]      ← AS PRINTED, p. 75 — WRONG
PMT = -(i / G_i) × [ PV + (PV + FV) / ((1+i)^N - 1) ]     ← NORMATIVE
```

Substituting the p. 39 mortgage (`N=360`, `I/Y=6.125`, `P/Y=C/Y=12`, `PV=120000`, `FV=0`, END) the
printed form yields **`+729.13`**; the calculator displays **`-729.13`**. The `i = 0` form printed
directly beneath it, `PMT = -(PV+FV) ÷ N`, **does** carry its minus sign — so the page is internally
inconsistent, which is what makes this an evident typo rather than a different convention.

The magnitude as printed is correct (`729.1326…` rounds to `729.13`); **the defect is the sign alone.**
A widely repeated claim that the printed formula yields `+729.14` does not reproduce.

Golden case: `appendix-formulas-tvm-pmt-sign-convention`. See **PMT-1** in `OPEN-QUESTIONS.md`.

**[DECISION]** Every TVM solver is derived from the fundamental balance equation rather than
transcribed from the appendix, and validated against worked examples. The appendix is treated as
corroboration, not as source.

---

## 3. The two worksheets that round internally

This is the most unusual behaviour in the machine and the highest parity risk in the project.

### 3.1 Amortization (p. 76)

```
If computing bal(),  pmt2 = npmt

Let:          bal(0) = RND(PV)

Iterate:      m = 1 .. pmt2
                I_m    = RND[ RND12( -i × bal(m-1) ) ]
                bal(m) = bal(m-1) - I_m + RND(PMT)

then:         bal()   = bal(pmt2)
              ΣPrn()  = bal(pmt2) - bal(pmt1 - 1)          ← NORMATIVE (printed form omits the -1)
              ΣInt()  = (pmt2 - pmt1 + 1) × RND(PMT) - ΣPrn()

where:        RND   = round to the number of decimal places SELECTED FOR DISPLAY
              RND12 = round to 12 decimal places
```

**`RND` rounds to the DISPLAYED decimal setting.** This is unusual and load-bearing. Three
consequences, all of which have to be designed for rather than discovered:

1. **An amortization schedule is a function of `DEC`.** Change the decimal setting and the schedule
   genuinely changes. **[DECISION]** `DEC` is threaded into the amortization core as an explicit
   parameter. It is **not** a formatting concern and must not live only in the display layer. Every
   golden case for this worksheet pins `setup.decimals`.
2. **Amortization cannot be derived from the TVM closed forms.** It must be simulated period by
   period **from `m = 1`**, even when only a late range is requested. Computing `BAL` for `P1 = 300`
   walks 300 periods. You cannot jump to `bal(pmt1-1)` with a closed form and match the calculator.
3. **The load-bearing detail is the OUTER `RND` on `I_m`.** Given `bal(0) = RND(PV)`, `RND(I_m)` and
   `RND(PMT)`, the balance is *inherently* at display precision — re-rounding `bal(m)` is a no-op.
   Dropping the outer `RND` (keeping only `RND12`) gives `118,928.64 / 117,421.62 / 115,819.66`
   against the guidebook's `118,928.63 / 117,421.60 / 115,819.62`. Note it fails the **first** range,
   not just the later ones — so `amort-year1-balance` is a sufficient tripwire.

   Equivalently, an implementation may keep the **unrounded** `PMT` **if** it rounds `bal(m)`
   explicitly each period; that route also reproduces all three ranges, because rounding a 2-decimal
   balance minus the unrounded `PMT` recovers `RND(PMT)`.

**The `ΣPrn` off-by-one.** The printed `ΣPrn() = bal(pmt2) - bal(pmt1)` reproduces **none** of the
guidebook's own results. `ΣPrn` and `ΣInt` cannot both be correct under any single meaning of `pmt1`:

| Reading | `ΣPrn` (p. 40, year 1) | `ΣInt` |
|---|---|---|
| `pmt1 = P1 = 1` | `bal(9) - bal(1) = -954.74` ✗ | `-5,490.80` ✓ |
| `pmt1 = P1 - 1 = 0` | `bal(9) - bal(0) = -1,071.37` ✓ | `-6,219.93` ✗ |
| **`pmt1 = P1`, offset inside `ΣPrn`** | **`bal(9) - bal(0) = -1,071.37`** ✓ | **`-5,490.80`** ✓ |

**[DECISION]** `ΣPrn() = bal(pmt2) - bal(pmt1 - 1)` with `pmt1 = P1`; `ΣInt()` as printed. Verified
against all three years of the p. 40 example. See **AMORT-1**.

`npmt` is undefined in the guidebook. **[DECISION]** Read as: when a bare balance is requested rather
than a range, the loop's upper limit is the payment number at which the balance is wanted. See
**AMORT-2**.

### 3.2 `BAL` vs `FV` divergence — specified, not tolerance

- `BAL`, `PRN`, `INT` are computed from `PMT` **rounded to the current decimal setting**.
- `FV` is computed from the **unrounded** `PMT`.

So `BAL` after *n* payments and `FV` after the same *n* payments **will differ**. Both are correct
(p. 26).

**[DECISION]** Tests must not use a loose epsilon to paper over this. The two use different `PMT`
precision **by design**, and an epsilon wide enough to hide the divergence is wide enough to hide a
real bug.

### 3.3 Depreciation (p. 9, p. 78)

`DEP`, `RDV`, `CST` and `SAL` are rounded to the number of decimals selected for display. Accumulated
depreciation therefore accumulates **rounded** yearly figures, not exact ones.

`RDV = CST - SAL - accumulated depreciation` (p. 78). `RBV` has **no published formula**;
**[DECISION]** implement `RBV = CST - accumulated depreciation`, inferred from the p. 58 example. That
example uses `SAL = 0`, so `RBV` and `RDV` coincide throughout it and it **cannot discriminate** the
two definitions — a non-zero-salvage case is needed to settle it (**DEPR-8**).

**Where in the computation the rounding lands is unstated.** For declining balance the charge for year
*n* is a function of `RBV` at `YR-1`, so if `RBV` is rounded before being reused the errors compound
across the schedule; if not, they do not. The p. 58 example is consistent with both readings at
`DEC = 2` (**DEPR-9**). **[DECISION]** Round `RBV` before reuse, by symmetry with amortization's
`bal(m-1)`. Flagged for hardware arbitration.

### 3.4 `RND12` is amortization-only

The double rounding `RND[RND12(-i × bal(m-1))]` appears **only** in the amortization loop. No other
section mentions `RND12`, and the guidebook never explains why an intermediate 12-place rounding is
needed before display rounding. It is presumably a guard against the 13-digit internal precision
leaking into the schedule. **[DECISION]** Implement exactly as printed; do not "simplify" it away.

---

## 4. State shape

Every field the state machine must hold. This is the complete list — anything not here is derived.

```ts
interface CalculatorState {
  // ── Mode and display ──────────────────────────────────────────────────────
  mode: 'standard' | { worksheet: WorksheetId; field: string };
  display: DisplayState;
  entryBuffer: string | null;      // null = not mid-entry; the display echoes a committed value
  errorState: ErrorCode | null;    // latches the display until CE/C (p. 84)

  // ── Modifier latches (§6) ─────────────────────────────────────────────────
  secondArmed: boolean;            // 2ND — pressing 2ND again disarms (p. 7)
  invArmed: boolean;               // INV  — inverse-trig prefix (p. 7)
  hypArmed: boolean;               // HYP  — hyperbolic prefix (p. 7)

  // ── Expression evaluation (§5) ────────────────────────────────────────────
  pendingOps: PendingOp[];         // max 8   → Error 3 (p. 84)
  parenLevels: number;             // max 15  → Error 3 (p. 84)

  // ── Format worksheet (global, persist across power-off) ───────────────────
  DEC: number;                     // 0-8 fixed places; 9 = FLOATING, not nine places (p. 9)
  angleUnit: 'DEG' | 'RAD';
  dateFormat: 'US' | 'EUR';
  separators: 'US' | 'EUR';
  calcMethod: 'CHN' | 'AOS';       // CHN is the power-on default (p. 10)

  // ── Memory, constants, Last Answer ────────────────────────────────────────
  memories: [number, number, number, number, number,
             number, number, number, number, number];   // M0-M9, default 0
  ans: number;                     // refreshed by ENTER, CPT, = and automatic computes (p. 19)
  constant: { op: Operator; operand: number; isPercent: boolean } | null;
  randomSeed: number | null;

  // ── TVM (lives in standard-calculator mode, not a prompted worksheet) ─────
  tvm: { N: number; IY: number; PV: number; PMT: number; FV: number;
         PY: number; CY: number;                  // both default 1 (p. 25)
         timing: 'END' | 'BGN' };

  // ── Amortization ──────────────────────────────────────────────────────────
  amort: { P1: number; P2: number };              // BAL/PRN/INT are derived, never stored

  // ── Cash Flow ─────────────────────────────────────────────────────────────
  cashFlow: { CFo: number;
              flows: { amount: number; frequency: number }[];   // ≤ 24 groups
              I: number; NPV: number | null; IRR: number | null };

  // ── Bond ──────────────────────────────────────────────────────────────────
  bond: { SDT: SerialDate; CPN: number; RDT: SerialDate; RV: number;
          dayCount: 'ACT' | '360'; couponsPerYear: 1 | 2;
          YLD: number; PRI: number };             // AI is derived

  // ── Depreciation ──────────────────────────────────────────────────────────
  depr: { method: 'SL' | 'SYD' | 'DB' | 'DBX' | 'SLF' | 'DBF';
          dbPercent: number; dbxPercent: number;  // both default 200
          LIF: number; M01: number; DT1: SerialDate | null;
          CST: number; SAL: number; YR: number }; // DEP/RBV/RDV derived

  // ── Statistics ────────────────────────────────────────────────────────────
  stats: { points: { x: number; y: number }[];    // ≤ 50 pairs
           method: 'LIN' | 'Ln' | 'EXP' | 'PWR' | '1-V';
           xPrime: number | null; yPrime: number | null };

  // ── Other worksheets ──────────────────────────────────────────────────────
  pctChange: { OLD: number; NEW: number; CH: number; PD: number };  // PD clears to 1, NOT 0
  iconv:     { NOM: number; EFF: number; CY: number };              // SEPARATE from tvm.CY
  date:      { DT1: SerialDate; DT2: SerialDate; DBD: number;
               dayCount: 'ACT' | '360' };
  profit:    { CST: number; SEL: number; MAR: number };
  breakeven: { FC: number; VC: number; P: number; PFT: number; Q: number };
}
```

### 4.1 Non-obvious state decisions

- **`DEC = 9` is floating decimal, not nine fixed places** (p. 9). A naive `0`-`9` fixed-places
  implementation is wrong at the top of its range. Only `0`-`8` are fixed-place selections.
- **`iconv.CY` is separate storage from `tvm.CY`.** The guidebook never states the relationship, but
  `2ND CLR WORK` inside ICONV is explicitly defined to **leave `C/Y` untouched** (p. 67) while
  clearing `NOM`/`EFF` — which only makes sense for a variable the worksheet owns. **[DECISION]**
  separate. See **OW-4**.
- **`pctChange.PD` clears to 1, not 0.** The p. 63 reset table prints 0; the p. 64 prose says twice to
  leave it at 1; and the cost-sell-markup example presses `2ND CLR WORK`, enters only `OLD`/`NEW`, and
  gets `%CH = 25.00` — unreachable unless `#PD` is 1 after the clear. **The printed table is wrong.**
  See **OW-1**.
- **`BAL`/`PRN`/`INT`, `DEP`/`RBV`/`RDV`, `AI`, and the statistics outputs are derived, never stored.**
  They are automatic-compute variables: they evaluate the moment they are scrolled onto (p. 22).
  Storing them invites staleness bugs the hardware cannot have.
- **`NPV`/`IRR` ARE stored** (nullable). They are compute-only, and `IRR` is documented as retaining a
  stale-but-displayed value until recomputed with `CPT` (p. 45). Whether editing a flow invalidates it
  is unspecified (**CF-6**).
- **`errorState` latches.** An error holds the display until `CE/C` (p. 84). Whether `CE/C` also
  unwinds `pendingOps` and `parenLevels` is **not stated** (**ERR-3**). **[DECISION]** clear them —
  the alternative leaves an Error 3 unrecoverable without `2ND QUIT`.
- **Dates are a serial day number, not a `Date`.** The legal window is 1980-01-01 … 2079-12-31 and the
  arithmetic is defined by two explicit day-count methods (pp. 81-83). A host `Date` brings a
  timezone, a Gregorian calendar reform, and a leap-second table — none of which the machine has.
- **The two-digit-year pivot is never stated anywhere.** `06` → 2006, default `90` → 1990, window
  1980-2079. **[DECISION]** `80`-`99` → 19xx, `00`-`79` → 20xx. Inferred, not documented (**FMT-5**).

### 4.2 Persistence

**Constant Memory** retains all worksheet values, the 10 memories, and every format setting across
power-off (p. 6). **[DECISION]** The persisted slice is the whole state **minus** `display`,
`entryBuffer`, `errorState`, `secondArmed`/`invArmed`/`hypArmed`, `pendingOps`, `parenLevels`.

The two wake paths differ and must be modelled separately (p. 6):

| Wake path | Restores |
|---|---|
| After deliberate `ON/OFF` | Standard-calculator mode at zero, **error cleared**, **pending operations dropped** |
| After APD (~5 min idle) | **Everything** — display settings, stored memory, pending operations **and live error conditions** |

State restoration is conditioned on **how the machine powered down**, not merely on powering up.

Whether the constant register and the random seed survive power-off is **not stated** (**MEM-7**,
**MATH-7**). **[DECISION]** Treat both as transient (not persisted) — a constant is armed invisibly
with no indicator, and silently resurrecting one across a power cycle is the worse failure.

---

## 5. The command model

```
reduce(state: CalculatorState, key: KeyCommand) → { state: CalculatorState; display: DisplayState }
```

Pure. Total. No exceptions escape the boundary.

### 5.1 The pipeline

```
KeyCommand
   │
   ├─ 1. errorState ≠ null?  ──→  only CE/C is live; every other key is swallowed.  (p. 84)
   │                              2ND RESET is REFUSED until CE/C.  (p. 11)
   │
   ├─ 2. Resolve modifiers (§6): 2ND / INV / HYP latches turn a physical key
   │                              into a logical function.
   │
   ├─ 3. Dispatch by mode: standard-calculator vs { worksheet, field }.
   │
   ├─ 4. Execute. Pure worksheet functions may THROW CalculatorError.
   │
   ├─ 5. Catch CalculatorError → latch errorState, display `Error <n>`.
   │
   └─ 6. Render display from the new state.
```

**[DECISION]** Calculation functions throw `CalculatorError`; the reducer catches at the command
boundary and converts to a latched error state. This mirrors the hardware exactly — an error latches
the display until `CE/C` — and keeps the pure math layer free of display concerns. The reducer itself
never throws.

**[DECISION]** `display` is returned alongside the state rather than being a state field. It is a pure
projection of `(state, DEC, separators)`. Storing it would create two sources of truth for the same
fact.

### 5.2 Display is a string assertion, not a number

Every golden case asserts a **string**. Thousands separators, the `-` sign, and decimal padding are
all part of the contract:

- `-1,071.37` ≠ `-1071.37`
- `20.00` ≠ `20`
- `12-31-1990`, `9-04-2003` — dates render with an **unpadded month**
- `RST ?`, `Error 5`, `ACT`, `SL`, `2/Y` — non-numeric displays exist and are asserted

**Entry echo is not formatted to `DEC`.** Keyed entries echo raw (`3`, `8`); computed results **and
operands committed by an operator keypress** are formatted (`24.00`, `2.00`). Mid-entry the display
applies the thousands separator and keeps a bare trailing decimal point (`1,234.`) but does **not**
pad to `DEC`. The guidebook never states this rule — it is inferable only by reading the p. 18 and
p. 19 tables together (**MEM-8**).

### 5.3 The display model is composite, not a single string

`RST ?` is a prompt plus an `ENTER` indicator. `RST` + `0.00` is an annunciator plus a numeric field.
In worksheet mode **only the value appears, and the absence of the `=` indicator is the cue that the
number on screen does not belong to the label on screen** (p. 27) — a genuine display trap worth
reproducing faithfully.

**[DECISION]** `DisplayState` carries `{ label, value, indicators }` rather than a flat string. The
flat string is a rendering of it, produced for golden-test comparison.

---

## 6. The 2ND / INV / HYP modifier model

Three latches, not one. They are **not** interchangeable and they compose.

| Latch | Set by | Cleared by | Meaning (p. 7) |
|---|---|---|---|
| `secondArmed` | `2ND` | consuming a key, **or a second `2ND` press** | The next key selects its second function |
| `invArmed` | `INV` | consuming a trig key | The next key selects its **inverse** trigonometric function |
| `hypArmed` | `HYP` (reached via `2ND HYP`) | consuming a trig key | The next key selects its **hyperbolic** function |

### 6.1 `2ND` cancels itself

Pressing `2ND` twice **disarms**. It does not double-arm and does not fall through to a
second-function-of-`2ND`. There is no `2ND 2ND` compound function (p. 7).

### 6.2 `INV` and `HYP` are themselves second-level prefixes

This is the subtle one. The guidebook prints:

```
11.54  2ND  SIN            → sine            (2ND required)
.2     INV  SIN            → arcsine         (NO 2ND before SIN)
.5     2ND  HYP  SIN       → sinh            (NO 2ND before SIN)
5      2ND  HYP  INV  SIN  → arcsinh         (NO 2ND before SIN)
```

Read literally, once `INV` or `HYP` has been pressed, `SIN` is reached **without** a `2ND`. This is
consistent with p. 7, which describes `INV` and `HYP` as **indicators** meaning "press a key to select
its inverse trigonometric / hyperbolic function."

This conflicts with a naive "emit `2ND` before every secondary function" rule. **The golden corpus
reproduces the printed sequences verbatim rather than normalising them** — 6 of the 12 trig cases in
`clearing-and-math-ops.json` omit the `2ND`.

**[DECISION]** `INV` and `HYP` each imply the second level for the following trig key. Whether
`2ND INV SIN` is *also* accepted as an alias is unspecified (**MATH-3**); accept it as a no-op-tolerant
alias so both spellings parse, but only the printed form is asserted by tests.

### 6.3 Resolution order

```
if (hypArmed && invArmed)  → inverse hyperbolic   (5 2ND HYP INV SIN → arcsinh)
else if (hypArmed)         → hyperbolic           (.5 2ND HYP SIN → sinh)
else if (invArmed)         → inverse trig         (.2 INV SIN → arcsin)
else if (secondArmed)      → second function      (11.54 2ND SIN → sin)
else                       → primary function
```

Note that `2ND HYP INV SIN` sets **both** `hypArmed` and `invArmed`, and the `2ND` that reached `HYP`
is consumed by `HYP` itself — it does not survive to `SIN`.

---

## 7. CHN vs AOS evaluation

Two evaluation strategies selected by one format setting. `CHN` is the power-on default (p. 10).

### 7.1 CHN (chain) — the default

Each operator **resolves as soon as the next operator is entered**. Problems are solved strictly in
entry order. The guidebook notes this is the convention most financial calculators follow (p. 10).

There is at most one pending operation at a time (ignoring parentheses), so CHN is structurally
incapable of raising Error 3 through operator depth alone — it retires each operation as it is
entered.

### 7.2 AOS (algebraic operating system)

Standard algebraic hierarchy. Each pending operation is **deferred until an operator of equal or
lower priority arrives**, at which point it resolves. The guidebook notes this is what most scientific
calculators do (p. 10).

**The hierarchy (p. 87), highest priority first:**

| Priority | Operations |
|---|---|
| 1 (highest) | `x²`, `x!`, `1/x`, `%`, `√x`, `LN`, `eˣ`, `HYP`, `INV`, `SIN`, `COS`, `TAN` |
| 2 | `nCr`, `nPr` |
| 3 | `yˣ` |
| 4 | `×`, `÷` |
| 5 | `+`, `−` |
| 6 | `)` |
| 7 (lowest) | `=` |

Priorities 4 and 5 each group **two operators at the same level**, so `×` and `÷` associate
left-to-right between themselves, as do `+` and `−`.

`=` binds loosest and forces every pending operation to resolve. `)` sits one level above `=` and
resolves everything back to the matching `(`.

### 7.3 `3 + 2 × 4 =` worked through — the only example that separates the two

This is the guidebook's sole discriminating example (p. 10). It lives on p. 10, which
`overview-display-formats` owns; the cases are `overview-display-formats-chn-3-plus-2-times-4` and
`-aos-3-plus-2-times-4`, both at `decimals: 2`.

**CHN → 20.00**

| Key | Action | Pending after | Display |
|---|---|---|---|
| `3` | entry | — | `3` |
| `+` | push `(3, +)` | `[3 +]` | `3.00` |
| `2` | entry | `[3 +]` | `2` |
| `×` | **next operator arrives → RESOLVE the pending `+` immediately**: `3 + 2 = 5`. Push `(5, ×)`. | `[5 ×]` | `5.00` |
| `4` | entry | `[5 ×]` | `4` |
| `=` | resolve: `5 × 4 = 20` | `[]` | **`20.00`** |

**AOS → 11.00**

| Key | Action | Pending after | Display |
|---|---|---|---|
| `3` | entry | — | `3` |
| `+` | push `(3, +)` — priority 5 | `[3 +]` | `3.00` |
| `2` | entry | `[3 +]` | `2` |
| `×` | **priority 4 > priority 5 → DO NOT resolve. Defer.** Push `(2, ×)`. | `[3 +] [2 ×]` | `2.00` |
| `4` | entry | `[3 +] [2 ×]` | `4` |
| `=` | priority 7 → resolve **all**, innermost first: `2 × 4 = 8`, then `3 + 8 = 11` | `[]` | **`11.00`** |

The one-line difference: on `×`, CHN **resolves** the pending `+` and AOS **defers** it. Everything
else follows.

> Both displays are the `DEC = 2` rendering. The guidebook states the answers as bare `20` and `11` in
> prose — as arithmetic, not as display captures — but p. 9 states every guidebook example assumes
> `DEC = 2`, and the parallel math-operations table on p. 12 confirms the convention (`6 + 4 =` →
> `10.00`). See **FMT-2**.

### 7.4 Error 3

Two **independent** ceilings raising the same error (p. 84):

- more than **15** active parenthesis levels
- a calculation requiring more than **8** pending operations

Either can be breached without the other. AOS is the more exposed method, since deferring `×`/`÷` past
a pending `+`/`-` is precisely what consumes a pending slot.

**[DECISION]** Both evaluators share one expression engine parameterised by a
`shouldResolve(incoming, pending) → boolean` predicate. CHN returns `true` unconditionally; AOS
returns `priority(incoming) >= priority(pending)`. Two engines would drift.

---

## 8. Iterative solvers

Three quantities have no closed form. All three are root-finds; none of them has a documented method,
seed, tolerance, or iteration cap — **the guidebook describes Error 7's trigger only qualitatively**
("many iterations", "very complex"). Exact parity on *which* inputs raise Error 7 is therefore **not
derivable from the guidebook** and requires empirical calibration against hardware (**ERR-4**).

The decisions below are ours. They are chosen to be *correct* first and *plausibly TI-like* second.

### 8.1 TVM `i` (from `CPT I/Y`)

**When iteration is needed.** Only when `PMT ≠ 0`. With `PMT = 0` the balance equation collapses to a
single growth factor and `i` follows from a closed form (p. 74):

```
i = (-FV ÷ PV)^(1÷N) - 1          where PMT = 0
```

The ratio is negated because `PV` and `FV` carry opposite signs under the cash-flow convention, so
`-FV ÷ PV` is positive and the root is real. When they share a sign the base is negative and a
non-integer `N` raises **Error 2**.

**The residual.** The master balance equation (p. 74):

```
f(i) = PV + PMT × G_i × [(1 - (1+i)^-N) / i] + FV × (1+i)^-N
```

| Aspect | Decision |
|---|---|
| Method | **Newton with a numerical derivative, falling back to bracketed bisection** |
| Why | Newton is quadratic and lands in ~4-6 iterations for well-posed problems. It wanders on a flat derivative or a bad seed; bisection cannot miss a bracketed root. Belt and braces. |
| Seed | The current `I/Y` converted to a periodic rate if non-zero, else a small positive rate |
| Domain | `i > -1` — rates below −100% per period are not meaningful |
| Tolerance | `\|f(i)\| < 1e-12`, or `\|i_{n+1} - i_n\| < 1e-12` |
| Iteration cap | **100** for Newton; **400** for the bisection fallback |
| Non-convergence | **Error 7** |
| No sign change in `FV`, `(N × PMT)`, `PV` | **Error 5** — checked **before** iterating, so it is a fast fail rather than a timeout |
| `ON/OFF` during the solve | **Error 8** |

The Error 5 pre-check is not an optimisation. The guidebook defines the condition structurally ("`FV`,
`N × PMT` and `PV` all carry the same sign", p. 84), so it must be *detected*, not discovered by a
solver that fails to bracket.

### 8.2 The `i = 0` branch is a separate code path

Each of `N`, `PMT`, `PV`, `FV` is published as a **pair**: a compounding form for `i ≠ 0` and a
straight-line form for `i = 0` (p. 75). The `i = 0` forms are **not** a limiting approximation — at
`i = 0` the compounding forms divide by zero.

**[DECISION]** Branch on `i === 0` **exactly, not on a tolerance.** A tolerance here would silently
switch formulas for a very small but genuine rate.

```
N   = -(PV + FV) ÷ PMT
PMT = -(PV + FV) ÷ N
PV  = -(FV + PMT × N)
FV  = -(PV + PMT × N)
```

Note the `i = 0` forms contain **no `G_i` term at all**. With `i = 0`, `G_i = 1 + 0×k = 1` regardless
of `k`, so **END and BGN are indistinguishable at zero interest**. This is consistent — and it means a
BGN annuity at 0% must **not** be special-cased.

### 8.3 Cash Flow `IRR`

**The residual.** `npv(i) = 0`, with `IRR = 100 × i` (p. 77).

| Aspect | Decision |
|---|---|
| Method | **Bracketed bisection** |
| Why | The guidebook's root-count semantics are defined in terms of sign changes, and multi-root streams are explicitly in scope. Newton on a multi-root polynomial jumps between basins unpredictably; bisection on an explicit bracket is reproducible. Reproducibility beats speed here — the guidebook itself warns the solve may run "seconds to minutes" (p. 45). |
| Bracketing | Scan outward for a sign change, then bisect inside it |
| Iteration cap | **200** per bracket |
| Root dedupe tolerance | `1e-9` |
| No sign change in the stream | **Error 5** — checked before iterating (p. 45, p. 84) |
| Non-convergence | **Error 7** — explicitly possible **even when a solution exists** (p. 46) |
| `ON/OFF` during the solve | **Error 8** |

**Root selection for multi-sign-change streams.** The guidebook says the calculator reports "the one
closest to zero" and bluntly warns that root **carries no financial meaning** (p. 46). It does not say
closest in absolute value, whether negative roots are candidates, or what the iteration seeds from. No
worked example exercises it. **[DECISION]** Collect the roots found, dedupe at `1e-9`, and return the
one with the smallest `|i|`. **Reproducing TI's exact choice is not possible from this documentation**
(**CF-7**).

**Sign changes are counted across `CFo` AND the `Cnn` list** — `CFo` participates (p. 45). A zero flow
does not count as a sign change (inferred from the lease example, **CF-9**).

### 8.4 Bond `YLD`

**Two regimes** (p. 78). With **one coupon period or less** remaining, `Y` has a closed form and no
iteration happens. With **more than one**, there is no closed form and yield is found by iterative
search on the multi-period price formula.

| Aspect | Decision |
|---|---|
| Method | **Plain bisection** on `price(Y) - PRI` |
| Why | Unlike IRR, this residual is **monotone decreasing in `Y`** — a higher yield always means a lower price. A bracket therefore contains **exactly one** root and bisection cannot miss it. Newton buys nothing and risks leaving the bracket. |
| Bracketing | Scan for a sign change; failure to bracket means the entered `PRI` corresponds to no reachable yield |
| Tolerance | `1e-13` |
| Iteration cap | **200** |
| Non-convergence / no bracket | **Error 7** |
| `ON/OFF` during the solve | **Error 8** |

**Errors 7 and 8 attach to `YLD` only, never to `PRI`** — consistent with `YLD` being the iterative
solve and `PRI` being closed-form (p. 78).

**`N` rounds UP, always.** A fractional coupon count is raised to the next whole number: `2.4 → 3`
(p. 78). This is a **ceiling**, not round-half-up — `2.1 → 3` too. The wording ("raise it to the next
whole number") is the only evidence, but it is unambiguous.

### 8.5 `ON/OFF` as a break key — Error 8

`ON/OFF` doubles as an **interrupt** during long iterative solves. Pressing it while an iterative
computation is running abandons the solve and raises **Error 8** rather than powering the unit off
(p. 85). It applies to TVM `I/Y`, Amortization `BAL`/`INT`, Cash Flow `IRR`, Bond `YLD`, and
Depreciation `DEP`/`RDV`.

**`CE/C` is NOT the abort key.** `CE/C` only clears the resulting message (p. 84 header note). Several
specs originally conflated the two; all have been corrected. Error 8 is user-initiated and is the only
error in the set that does not indicate bad input or an unsolvable problem.

**[DECISION]** Solvers accept a cancellation token checked once per iteration. The core stays
synchronous and pure; the host decides how to deliver the signal.

### 8.6 Accuracy expectations

Ordinary calculations are accurate to within ±1 unit in the last displayed digit. Higher-order
functions iterate, and iteration lets small inaccuracies pile up in the guard digits. The guidebook's
position is that this accumulated error **normally** stays buried below the 10-digit display (p. 86).

It is **not a guarantee** — it is a "most cases" claim. That matters directly when writing tolerance
bounds for parity tests: the correct assertion is on the **displayed string**, not on an internal
value with an epsilon.

---

## 9. Module boundaries

```
src/
  errors.ts              The eight error conditions. ErrorCode is the guidebook's own numbering —
                         the LCD renders `Error 5`, so the numbers are observable behaviour.
  numeric/precision.ts   toInternal, roundToSignificantDigits, overflow/underflow, negative zero.
                         EVERY arithmetic result passes through here.
  display/format.ts      state → display string. DEC, separators, scientific notation, dates.
                         Pure projection; holds no state.
  math/operators.ts      Operator table + AOS priorities.
  math/functions.ts      Unary/binary functions + their domain checks (which raise Error 1/2).
  math/expression-engine.ts
                         One engine, parameterised by shouldResolve. CHN and AOS both run through it.
  worksheets/*.ts        One pure module per worksheet. No display, no state machine, no I/O.
```

**The dependency rule:** `worksheets/` may import `numeric/` and `errors`. `numeric/` imports only
`errors`. **Nothing imports `display/`.** The display layer is downstream of everything and upstream
of nothing — which is what keeps the amortization `RND(DEC)` coupling honest: `DEC` is passed **into**
the amortization function as a parameter, rather than the amortization function reaching out to a
display module.

---

## 10. Testing strategy

**Golden tests are the arbiter, not the printed formulas.**

| Layer | What it proves |
|---|---|
| `tests/golden/*.json` (256 cases) | Keystroke → display-string parity against the guidebook's own worked examples. **These are the contract.** |
| Unit tests per module | Internal invariants the guidebook cannot see (e.g. `toInternal` preserves `-0`; the bisection bracket is valid). |
| Property tests | Round-trips the guidebook implies but never states: `NOM → EFF → NOM`, `PV → FV → PV` at `PMT = 0`. |

**Every golden case pins `setup.decimals`** where the result depends on it — which, because of §3, is
most of them.

**The statistics gap is real and must not be papered over.** `tests/golden/statistics.json` has
`cases: []`. Pages 59-62 are entirely procedural; Statistics is the only worksheet chapter in the
guidebook with no `Example:` subsection, and no example elsewhere drives it. **This section has no
parity oracle in the source document** and must be validated against the appendix formulas (p. 80) or
real hardware. Inventing expected values would corrupt the ground truth the corpus exists to
establish. See **STAT-1**.
