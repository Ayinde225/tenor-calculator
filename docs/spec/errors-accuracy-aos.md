# Error Messages, Accuracy / Internal Precision, and AOS vs CHN Evaluation

> Source: official BA II Plus guidebook, pages 84-87. Behaviour described in original wording.

This section covers three appendix topics: the eight numbered error conditions (pp. 84-85), the
13-digit internal precision and display-rounding model (p. 86), and the AOS algebraic hierarchy
(p. 87). Cross-references to the CHN/AOS selection example on p. 10 are marked as out-of-range.

---

## Variables

These are cross-cutting settings rather than a worksheet register set. Only entries that pages
84-87 actually constrain or describe are listed.

| Name | Label | Default | Type | Valid range |
|---|---|---|---|---|
| `DEC` | Decimal places shown | 2 | setting | 0-9; anything outside raises Error 4 (p. 84) |
| `calcMethod` | Chn / AOS operator evaluation | `CHN` | setting | `CHN` or `AOS` (p. 87; selection UI on p. 10, out of range) |
| `internalDigits` | Guard-digit mantissa width | 13 | fixed constant | not user-settable (p. 86) |
| `displayDigits` | Max mantissa digits shown | 10 | derived from `DEC` | 10 or fewer (p. 86) |
| `calcRange` | Magnitude limit before Error 1 | ±9.9999999999999E99 | fixed constant | as printed on p. 84 — see Discrepancy D1 |
| `pendingOps` | Operations awaiting evaluation | 0 | internal | max 8; a 9th raises Error 3 (p. 84) |
| `parenLevels` | Open parenthesis nesting depth | 0 | internal | max 15; a 16th raises Error 3 (p. 84) |

---

## Behaviour

### Clearing an error (p. 84)

While an error message is displayed the calculator is in an error state. p. 84 carries a single
note on the subject — "To clear an error message, press `CE/C`" — and says nothing more. It does
not state what the display reverts to, nor whether any other key would also work. See A3.

### `ON/OFF` as an iteration interrupt (p. 85)

`ON/OFF` doubles as a break key during long iterative solves. Pressing it while an iterative
computation is running abandons the solve and raises Error 8 rather than powering the unit off.
This applies to `I/Y` in TVM, `BAL`/`INT` in Amortization, `IRR` in Cash Flow, `YLD` in Bond, and
`DEP`/`RDV` in Depreciation (p. 85). Error 8 is therefore user-initiated and is the only error in
the set that does not indicate bad input or an unsolvable problem.

### Internal precision and guard digits (p. 86)

Every result is held internally to 13 significant digits. The display shows at most 10, and fewer
when `DEC` says so. The digits held back are the guard digits, and their whole purpose is that
chained arithmetic feeds on the internal value — never on the rounded thing on screen. A parity
implementation must therefore keep a 13-digit working value in the operand stack and round only at
the display boundary (p. 86).

### Display rounding rule (p. 86)

When a result carries 11 or more significant digits, the calculator consults the guard digits to
decide the last shown digit. If the 11th significant digit is 5 or greater, the displayed value is
rounded up to the next larger value. This is round-half-up on the 11th digit, not banker's rounding
(p. 86).

### Accumulated error in iterative functions (p. 86)

Ordinary calculations are accurate to within ±1 unit in the last displayed digit. Higher-order
functions solve iteratively, and iteration lets small inaccuracies pile up in the guard digits. The
guidebook's position is that this accumulated error normally stays buried below the 10-digit display
and so never surfaces to the user (p. 86). It is not a guarantee — it is a "most cases" claim, which
matters when writing tolerance bounds for parity tests.

### AOS evaluation (p. 87)

Under AOS the calculator does not evaluate left-to-right. It applies standard algebraic hierarchy,
deferring each pending operation until it meets an operator of equal or lower priority. Unary and
prefix/postfix functions bind tightest; `=` binds loosest and forces every pending operation to
resolve (p. 87).

### CHN evaluation (p. 10 — outside this page range)

Under CHN each operator resolves as soon as the next one is entered, so problems are solved strictly
in entry order. The guidebook notes CHN is the convention most financial calculators follow, while
AOS is what most scientific calculators do (p. 10). CHN is the power-on default.

---

## Formulas

Pages 84-87 contain no derivation-style equations. The normative content is the hierarchy table,
the rounding rule, and the two constants. All are transcribed exactly as rendered.

### Algebraic hierarchy table (p. 87)

Transcribed exactly as rendered in the PDF, followed by the intended reading. The rendered cells
carry flattened superscripts and a broken radical glyph — see Discrepancy D2.

| Priority | Operations (exactly as rendered) | Intended reading |
|---|---|---|
| 1 (highest) | `x2, x!, 1/x, %,(x, LN, e2, HYP, INV, SIN, COS, TAN` | `x²`, `x!`, `1/x`, `%`, `√x`, `LN`, `eˣ`, `HYP`, `INV`, `SIN`, `COS`, `TAN` |
| 2 | `nCr, nPr` | `nCr`, `nPr` |
| 3 | `Yx` | `yˣ` |
| 4 | `×, ÷` | `×`, `÷` |
| 5 | `+, -` | `+`, `−` |
| 6 | `)` | `)` |
| 7 (lowest) | `=` | `=` |

Priorities 4 and 5 each group two operators at the *same* level, so `×` and `÷` associate
left-to-right between themselves, as do `+` and `−`.

### Display rounding rule (p. 86)

```
Let r = the internally computed 13-significant-digit result.
Let d = number of significant digits the current format would show (d <= 10).

if significantDigits(r) >= 11:
    display = roundHalfUp(r, to = d significant digits)
    # "round to the next larger value" when the (d+1)-th significant digit >= 5
else:
    display = r
```

The guidebook states the rule against the 11th digit specifically, because 10 is the maximum
displayed width (p. 86).

### Worked rounding example (p. 86)

```
Problem:  1 ÷ 3 × 3 = ?

Step 1:   1 ÷ 3               = 0.3333333333333      (13 significant digits, internal)
Step 2:   0.3333333333333 × 3 = 0.9999999999999      (13 significant digits, internal)
Display:  1
```

Both internal step values are printed literally on p. 86 and are the ground truth for guard-digit
behaviour. Note the internal result is *not* 1 — it is 0.9999999999999. Only the display rounds.
Any implementation that produces exactly 1.0 internally (e.g. by using IEEE doubles naively) will
match this example by luck while diverging elsewhere.

### Calculator range constant (p. 84)

```
±9.9999999999999E99
```

Transcribed exactly. See Discrepancy D1 — this is 14 significant digits, which contradicts the
13-digit internal width asserted on p. 86.

---

## Key sequences

Pages 84-87 specify only three interactions.

**Dismiss an error message (p. 84)**
```
CE/C
```

**Interrupt a running iterative solve, producing Error 8 (p. 85)**
```
ON/OFF            (pressed while I/Y, BAL, INT, IRR, YLD, DEP, or RDV is computing)
```

**Rounding demonstration (p. 86)**
```
1  ÷  3  ×  3  =        ->  displays 1
```

**Selecting the calculation method (p. 10 — outside this page range, listed for completeness)**
```
2ND  FORMAT   then scroll to the Chn/AOS field and press  2ND  SET  to toggle
```

---

## Clearing/reset

- **`CE/C`** — clears the error message and the error state (p. 84). Pages 84-87 do not say it
  clears pending operations or open parentheses; treat that as unspecified here (see A3).
- **`2ND CLR WORK` / `2ND CLR TVM`** — not mentioned anywhere in pages 84-87. Neither the error
  state, the `DEC` setting, nor the Chn/AOS setting is described as being touched by them.
- **`2ND QUIT`** — not mentioned in pages 84-87.
- **`2ND RESET ENTER`** — not described in this page range, but p. 87 states an equivalent by
  implication: removing or fully discharging the battery loses all data and has the same effect as
  resetting the calculator. So the reset baseline restores `DEC = 2` and `calcMethod = CHN`.
- The 13-digit internal width is a hardware property and is not affected by any clear or reset.

---

## Errors

All eight are defined in this page range. Reproduced as a condition list; the wording is mine.

### Error 1 — Overflow (p. 84)
- A result falls outside ±9.9999999999999E99.
- Division by zero, including a division that only happens internally.
- `1/x` evaluated at x = 0.
- Statistics worksheet: a calculation where every X value, or every Y value, is identical.

### Error 2 — Invalid argument (p. 84)
- `x!` where x is not an integer in 0-69.
- `LN x` where x is not > 0.
- `yˣ` where y < 0 and x is neither an integer nor the reciprocal of an integer.
- `√x` where x < 0.
- Amortization worksheet: computing `BAL`, `PRN`, or `INT` with P2 < P1.
- Depreciation worksheet: a calculation in which SAL > CST.

### Error 3 — Too many pending operations (p. 84)
- More than 15 active levels of parentheses.
- A calculation requiring more than 8 pending operations.

### Error 4 — Out of range (p. 84)
- Amortization worksheet: P1 or P2 outside 1-9,999.
- TVM worksheet: P/Y or C/Y `[?]` 0 — operator dropped, see D2; almost certainly `≤ 0`.
- Cash Flow worksheet: an Fnn value outside 0.5-9,999.
- Bond worksheet: RV, CPN, or PRI `[?]` 0 — operator dropped; almost certainly `≤ 0`.
- Date worksheet: a computed date outside January 1, 1980 through December 31, 2079.
- Depreciation worksheet: declining balance percent `[?]` 0; LIF `[?]` 0; YR `[?]` 0; CST < 0;
  SAL < 0; or M01 `[?]` 1 / M01 `[?]` 13 — four dropped operators, see D2.
- Interest Conversion worksheet: C/Y `[?]` 0 — operator dropped; almost certainly `≤ 0`.
- `DEC` outside 0-9.

### Error 5 — No solution exists (p. 84)
- TVM worksheet: computing `I/Y` when FV, (N × PMT), and PV all carry the same sign. The guidebook
  attaches the remedy directly: inflows must be positive and outflows negative.
- TVM, Cash Flow, and Bond worksheets: an LN input that is not > 0 arises during the solve.
- Cash Flow worksheet: computing `IRR` with no sign change anywhere in the cash-flow list.

### Error 6 — Invalid date (p. 85)
- Bond and Date worksheets: a date that does not exist (the guidebook's example is January 32), or
  one keyed in the wrong format — `MM.DDYYYY` where `MM.DDYY` was required.
- Bond worksheet: a calculation attempted with a redemption date at or before the settlement date.

### Error 7 — Iteration limit exceeded (p. 85)
- TVM worksheet: `I/Y` on a problem complex enough to need many iterations.
- Cash Flow worksheet: `IRR` on a complex problem with multiple sign changes.
- Bond worksheet: `YLD` on a very complex problem.

### Error 8 — Canceled iterative calculation (p. 85)
Raised when `ON/OFF` is pressed to stop an evaluation in progress:
- TVM worksheet: stopping `I/Y`.
- Amortization worksheet: stopping `BAL` or `INT`.
- Cash Flow worksheet: stopping `IRR`.
- Bond worksheet: stopping `YLD`.
- Depreciation worksheet: stopping `DEP` or `RDV`.

### Errors raised by *this* section's own behaviour
Only Error 3 (parenthesis/pending-operation limits) and Error 4 (`DEC` outside 0-9) originate in
the general calculation and display machinery described here. The rest are raised by the individual
worksheets and are listed on pp. 84-85 only because the appendix is the central error table.

---

## Edge cases & ambiguities

**D1 — The calculator range constant contradicts the 13-digit precision claim.**
p. 84 prints the limit as `±9.9999999999999E99`. Counted digit by digit from the page image, that is
a leading 9 plus 13 further nines = **14 significant digits**. p. 86 states results are stored
internally as 13-digit numbers. A 13-digit mantissa's largest value is `9.999999999999E99`
(12 nines after the point). The two pages cannot both be right. Both are transcribed above as
printed; no worked example in this range exercises the boundary, so this cannot be resolved from
pages 84-87 alone. Flagged for the orchestrator.

**D2 — The source PDF systematically drops `≤` / `≥` glyphs.**
This is a font-mapping defect in the PDF itself, not a text-extraction artifact — the gaps are
present in the rendered page images too. The evidence that the missing glyphs are relational
operators, not omissions in the original TI document:
- `<` and `>` render correctly throughout the same table (`CST < 0`, `SAL < 0`, `P2 < P1`,
  `SAL > CST`, `x is not > 0`). Only the two-stroke composite operators fail.
- In the `YR` clause the bottom bar of the glyph survives as a stray underscore (`YR _ 0`), which is
  exactly the residue of a `≤` whose upper chevron failed to map.
- Every gap sits in a slot that is grammatically required to hold a comparison.

Affected clauses, all in Error 4: TVM `P/Y`/`C/Y`; Bond `RV`/`CPN`/`PRI`; Depreciation declining
balance percent, `LIF`, `YR`, and both `M01` bounds; Interest Conversion `C/Y`. The reading `≤ 0`
is near-certain for the value clauses, but per the no-guessing rule the spec records the gap rather
than silently filling it. The `M01` bounds are the least recoverable: `M01 [?] 1 [?] M01 [?] 13`
appears to be two bounds fused by the dropped glyphs, and even the clause structure is unclear.
**Resolve against hardware or a clean PDF before implementing Error 4 range checks.**

**D3 — Flattened superscripts and a broken radical in the AOS table (p. 87).**
`x2` is `x²`, `e2` is `eˣ`, `Yx` is `yˣ`, and `%,(x` is `%, √x` — the radical glyph maps to `(`.
Same class of PDF font defect as D2. The intended reading is unambiguous here because these are
named calculator keys, so this is recorded as a transcription note rather than an open question.

**A1 — The p. 86 example's display depends on `DEC`, which the guidebook does not state.**
p. 86 says `1 ÷ 3 × 3 =` displays as `1`. At the default `DEC = 2` the display would be `1.00`. The
bare `1` implies a floating-decimal context. The load-bearing claim — that the internal value is
0.9999999999999 and the *display* rounds to one — holds at any `DEC`. The golden test records
`display: "1"` as printed and flags the format dependency; do not treat the absence of `.00` as
evidence about `DEC`.

**A2 — `1 ÷ 3 × 3` cannot distinguish AOS from CHN.**
`×` and `÷` share priority 4 (p. 87), so both methods evaluate it left-to-right and both give 1.
The example is a rounding demonstration only. The sole example that separates the two methods is
`3 + 2 × 4 =` on p. 10 (CHN → 20, AOS → 11), which is outside this page range. That example is
**not** carried in this section's golden corpus: p. 10 belongs to `overview-display-formats`
(pp. 6-11), whose corpus already holds both cases at `decimals: 2` with displays `20.00` / `11.00`.
This section documents the hierarchy that explains the result; it does not re-assert the result.

**A3 — Does `CE/C` clear pending operations?**
p. 84 says only that `CE/C` clears the error message. Whether dismissing an Error 3 also unwinds the
pending-operation stack and open parentheses, or leaves them intact, is not stated here. Unspecified
in this range.

**A4 — Error 1 vs Error 5 on internal division by zero.**
Error 1 covers division by zero "including internally," and Error 5 covers unsolvable TVM/Cash Flow
setups. A degenerate TVM solve could plausibly hit either. The guidebook gives no precedence rule.

**A5 — Error 7 has no stated iteration ceiling.**
The trigger is described qualitatively ("many iterations", "very complex"). No maximum iteration
count or convergence tolerance is published anywhere in this range, so exact parity on *which*
inputs raise Error 7 is not derivable from the guidebook. Empirical calibration required.

**A6 — Error 2's `yˣ` rule admits reciprocals of integers.**
`y < 0` is permitted when x is an integer or `1/n` for integer n — i.e. odd and even roots of
negatives are both attempted rather than rejected up front. What happens for `y < 0, x = 1/2`
(a real overflow/undefined case) is not stated; presumably it falls through to a different error.

**A7 — Error 3's two limits are independent.**
15 parenthesis levels and 8 pending operations are separate ceilings that raise the same error. A
calculation can breach either without the other.
