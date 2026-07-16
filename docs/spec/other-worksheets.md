# Other Worksheets — Percent Change/Compound Interest, Interest Conversion, Date, Profit Margin, Breakeven, Memory

> Source: official BA II Plus guidebook, pages 63-73 (worksheet chapters) plus the Appendix formula pages 80-82, which are the only place the equations for these worksheets appear. Behaviour described in original wording.

## Key-token glossary

The guidebook prints secondary functions as bracketed labels above the keys. This spec and the golden tests use these canonical tokens:

| Guidebook glyph | Token used here | Meaning |
| --- | --- | --- |
| `2nd` | `2ND` | secondary-function shift |
| `[Δ%]` | `Δ%` | Percent Change/Compound Interest worksheet |
| `[ICONV]` | `ICONV` | Interest Conversion worksheet |
| `[DATE]` | `DATE` | Date worksheet |
| `[PROFIT]` | `PROFIT` | Profit Margin worksheet |
| `[BRKEVN]` | `BRKEVN` | Breakeven worksheet |
| `[MEM]` | `MEM` | Memory worksheet |
| `[CLR WORK]` | `CLR WORK` | clear the active worksheet |
| `[SET]` | `SET` | cycle a setting |
| `[RESET]` | `RESET` | full calculator reset |
| `↓` / `↑` | `DOWN` / `UP` | move to next / previous worksheet variable |
| `ENTER` | `ENTER` | commit a keyed-in value |
| `CPT` | `CPT` | compute the displayed variable |
| `+/−` | `+/-` | change sign |
| `+` `−` `×` `÷` `yˣ` | `+` `-` `*` `/` `Y^X` | arithmetic keys (used for memory arithmetic) |

Display annotations in the guidebook tables: a small `◄` marks a value the user entered, a small `*` marks a value the calculator computed (pp. 65-72). Those markers are display chrome, not part of the numeric string.

The six worksheets in this chapter are reached with `2ND Δ%`, `2ND ICONV`, `2ND DATE`, `2ND PROFIT`, `2ND BRKEVN`, and `2ND MEM` (p. 63).

---

# Percent Change/Compound Interest Worksheet

Handles three problem shapes off one equation: percent change, compound interest, and cost-sell-markup (p. 63).

## Variables

| Name | Label | Reached by | Default | Type | Valid range / notes |
| --- | --- | --- | --- | --- | --- |
| Old value / Cost / Present value | `OLD` | `2ND Δ%` | 0 | Enter/compute | any real |
| New value / Selling price / Future value | `NEW` | `DOWN` | 0 | Enter/compute | any real |
| Percent change / Percent markup / Rate per period | `%CH` | `DOWN` | 0 | Enter/compute | expressed in percent, not decimal; negative means a decrease (p. 64) |
| Number of periods | `#PD` | `DOWN` | see discrepancy below | Enter/compute | 1 for percent-change and cost-sell-markup work (p. 64) |

The guidebook classifies every one of these by how the value gets in, not by what it means (p. 63).

**Default-value discrepancy (`#PD`).** The reset table on p. 63 prints `#PD` default = **0**. The prose on p. 64 repeatedly says to *leave* `#PD` at **1** for percent-change and cost-sell-markup problems, and the cost-sell-markup worked example on pp. 65-66 presses `2ND CLR WORK`, enters only `OLD` and `NEW`, and gets `%CH = 25.00` — which is only reachable if `#PD` is 1 after the clear. Per the golden-tests-win rule, **`#PD` clears to 1**; the printed table is wrong.

## Behaviour

- `2ND Δ%` opens the worksheet and shows the current `OLD` (p. 64).
- `DOWN` / `UP` walk the four variables in the order `OLD → NEW → %CH → #PD`; the list is cyclic in practice (the examples on p. 65 press `UP` from `%CH` to reach `NEW`, and from `#PD` to reach `%CH`).
- Keying a number then `ENTER` fixes that variable as known. Do not key a value into the variable you intend to solve (p. 64).
- Landing on the unknown variable and pressing `CPT` solves the single governing equation for it and displays the answer (p. 64).
- Role mapping by problem type (p. 64):
  - **Percent change** — supply any two of `OLD`, `NEW`, `%CH`; leave `#PD` = 1. Positive `%CH` is an increase, negative is a decrease.
  - **Compound interest** — supply any three of `OLD` (present value), `NEW` (future value), `%CH` (rate per period), `#PD` (number of periods); compute the fourth.
  - **Cost-sell-markup** — supply two of `OLD` (cost), `NEW` (selling price), `%CH` (percent markup); leave `#PD` = 1.
- Markup here is measured against **cost**, which is why the guidebook sends markup work to this worksheet rather than to Profit Margin (p. 70).

## Formulas

Rendered on p. 81. The vector art flattens the exponent onto the baseline; as printed it reads:

```
NEW = OLD(1 + %CH/100)#PD
```

The `#PD` is an **exponent**, not a trailing factor. The unambiguous form is:

$$\mathrm{NEW} = \mathrm{OLD}\left(1 + \frac{\%\mathrm{CH}}{100}\right)^{\#\mathrm{PD}}$$

Where (p. 81):
- `OLD` = old value
- `NEW` = new value
- `%CH` = percent change
- `#PD` = number of periods

Solved forms implied by the same equation:

```
%CH = 100 × ( (NEW/OLD)^(1/#PD) − 1 )
OLD = NEW / (1 + %CH/100)^#PD
#PD = ln(NEW/OLD) / ln(1 + %CH/100)
```

**Sign/typography flags.**
- The printed exponent is typographically lost. Confirmed by the compound-interest example (p. 65): `OLD=500`, `NEW=750`, `#PD=5` ⇒ `%CH = 8.45`. Only the exponent reading gives `100×((750/500)^(1/5) − 1) = 8.4472…`; a multiplicative reading gives nonsense.
- No sign inversion is present in this formula — unlike the TVM `PMT` formula elsewhere in the appendix, the worked examples here agree with the printed equation once the exponent is restored.
- `%CH` is a percent, so the `/100` is load-bearing.

## Key sequences

Compute percent change (p. 65):
```
2ND Δ%   658 ENTER   DOWN 700 ENTER   DOWN CPT        → %CH = 6.38
```
Compute the new amount for a stated percent change (continues above, p. 65):
```
7 +/- ENTER   UP CPT                                  → NEW = 611.94
```
Compute a compound growth rate (p. 65):
```
2ND Δ%   500 ENTER   DOWN 750 ENTER   DOWN DOWN 5 ENTER   UP CPT   → %CH = 8.45
```
Compute markup (pp. 65-66):
```
2ND Δ%   2ND CLR WORK   100 ENTER   DOWN 125 ENTER   DOWN CPT      → %CH = 25.00
```

## Clearing/reset

- `2ND CLR WORK` while inside the worksheet resets its four variables to defaults (p. 63): `OLD=0`, `NEW=0`, `%CH=0`, `#PD=1` (see the `#PD` discrepancy above).
- `2ND RESET ENTER` resets every calculator variable and format, this worksheet included (p. 63).
- `CLR TVM` is a TVM-worksheet operation and does not appear anywhere in this chapter; it does not touch `OLD/NEW/%CH/#PD`.
- `2ND QUIT` leaves the worksheet for standard-calculator mode without clearing anything — worksheet values persist and reappear on the next `2ND Δ%`. The first percent-change example (p. 65) relies on this: it opens on "Current value" without clearing, and the cost-sell-markup example (p. 65) has to press `2ND CLR WORK` explicitly to get `OLD= 0.00`.

## Errors

- **Error 1 (Overflow)** — a result outside ±9.9999999999999E99, or an internal divide by zero (p. 84). Reachable by computing `%CH` or `#PD` with `OLD = 0` (the ratio `NEW/OLD` divides by zero), or by a compound projection large enough to overflow.
- **Error 2 (Invalid argument)** — computing `y^x` with `y < 0` and `x` neither an integer nor the inverse of an integer, and computing `LN` of a non-positive number (p. 84). Reachable when `NEW/OLD` is negative and `#PD` is fractional, or when solving `#PD` where `ln(NEW/OLD)` or `ln(1 + %CH/100)` has a non-positive argument.

## Edge cases & ambiguities

- The p. 63 default table contradicts p. 64 prose and the p. 65 example on `#PD` — resolved to 1 (above).
- `%CH = -100` makes `1 + %CH/100 = 0`; solving `OLD` from `NEW` then divides by zero (Error 1), and solving `#PD` takes `ln(0)` (Error 2). The guidebook does not call this out.
- With `#PD = 0` the equation degenerates to `NEW = OLD`; the guidebook never states what `CPT %CH` does in that state. Another reason to read `#PD`'s clear value as 1.
- Two-variable percent-change work is just the `#PD = 1` special case of the compound equation; there is no separate code path described.
- The guidebook does not state a valid range for `#PD` (integer vs. fractional). The formula admits fractional exponents; Error 2 conditions imply fractional values are permitted when the base is positive.

---

# Interest Conversion Worksheet

Converts between a nominal (annual percentage) rate and an annual effective rate (p. 66).

## Variables

| Name | Label | Reached by | Default | Type | Valid range / notes |
| --- | --- | --- | --- | --- | --- |
| Nominal rate | `NOM` | `2ND ICONV` | 0 | Enter/compute | entered as an **annual** rate in percent (p. 67) |
| Annual effective rate | `EFF` | `DOWN` | 0 | Enter/compute | entered as an **annual** rate in percent (p. 67) |
| Compounding periods per year | `C/Y` | `DOWN` | 1 | Enter-only | must be > 0; `C/Y ≤ 0` raises Error 4 (pp. 66-67, 84) |

`C/Y` is enter-only — it can never be the target of `CPT` (p. 66).

## Behaviour

- `2ND ICONV` opens the worksheet showing the current `NOM` (p. 67).
- Variable order is `NOM → EFF → C/Y` via `DOWN` (p. 66).
- Enter whichever rate is known, set `C/Y`, then move to the other rate and press `CPT` (p. 67).
- Both `NOM` and `EFF` are annual figures. `NOM` is the per-compounding-period rate times the number of compounding periods per year; `EFF` is the compounded annual rate actually earned over the stated period (p. 66).
- The stated motivation: two investments quoting the same nominal rate but compounding at different frequencies are not comparable until both are converted to `EFF` (p. 66).
- This `C/Y` is the Interest Conversion worksheet's own variable. The guidebook lists it under this worksheet with its own default of 1 (p. 67), separate from the TVM worksheet's `C/Y`.

## Formulas

Rendered on p. 80. **Both printed equations are typographically corrupt** — the exponent is flattened onto the baseline and the closing parenthesis is dropped. Exactly as rendered:

```
EFF = 100 × (eC/Y × In(x ÷ 1) − 1
  where:  x = .01 × NOM ÷ CY

NOM = 100 × C/Y × (e1 ÷ C/Y × IN(x + 1) − 1
  where:  x = .01 × EFF
```

Reconstructed unambiguous forms:

$$\mathrm{EFF} = 100 \times \left(e^{\,\mathrm{C/Y}\,\times\,\ln(x+1)} - 1\right), \qquad x = 0.01 \times \frac{\mathrm{NOM}}{\mathrm{C/Y}}$$

$$\mathrm{NOM} = 100 \times \mathrm{C/Y} \times \left(e^{\,\frac{1}{\mathrm{C/Y}}\,\times\,\ln(x+1)} - 1\right), \qquad x = 0.01 \times \mathrm{EFF}$$

Equivalently: `EFF = 100 × ((1 + 0.01×NOM/C/Y)^(C/Y) − 1)` and `NOM = 100 × C/Y × ((1 + 0.01×EFF)^(1/C/Y) − 1)`.

Where:
- `NOM` = nominal annual rate, in percent
- `EFF` = annual effective rate, in percent
- `C/Y` = compounding periods per year
- `x` = the intermediate defined per-equation above
- `e` = base of natural logarithms; `ln` = natural log (printed inconsistently as `In` and `IN`)

**Discrepancy flags (all confirmed against the p. 67 worked example, `NOM=15`, `C/Y=4` ⇒ `EFF=15.87`).**
1. `In(x ÷ 1)` in the `EFF` equation must be `ln(x + 1)`. With `÷ 1` the expression yields `100 × ((1+0.0375/1)^4 − 1)` only by coincidence of `x÷1 = x`, which then gives `ln(0.0375)` — a negative log producing `EFF ≈ −100`, not 15.87. The `+ 1` reading gives `100 × (1.0375^4 − 1) = 15.8650…` ⇒ displays `15.87`. **The example wins.**
2. `eC/Y × In(...)` and `e1 ÷ C/Y × IN(...)` are flattened exponents: the whole `C/Y × ln(x+1)` and `(1/C/Y) × ln(x+1)` products are exponents of `e`.
3. Both equations are missing their closing parenthesis before the `− 1`; the `− 1` is inside the outer parentheses, so the `100 ×` multiplies the whole bracket.
4. `CY` in the first `where:` clause is `C/Y`.
5. The two forms are exact inverses; round-tripping `EFF = 15.8650…` back through the `NOM` equation with `C/Y = 4` returns `15.00`.

## Key sequences

Convert 15% nominal, quarterly compounding, to an effective rate (p. 67):
```
2ND ICONV   15 ENTER   DOWN DOWN 4 ENTER   UP CPT      → EFF = 15.87
```
(`DOWN DOWN` from `NOM` passes `EFF` and lands on `C/Y`; `UP` from `C/Y` returns to `EFF`.)

Convert an effective rate back to nominal:
```
2ND ICONV   DOWN <eff> ENTER   DOWN <c/y> ENTER   UP UP CPT   → NOM
```

## Clearing/reset

- `2ND CLR WORK` inside this worksheet clears `NOM` and `EFF` to 0 and **explicitly leaves `C/Y` alone** (p. 67). This is the one asymmetry worth implementing carefully.
- `2ND RESET ENTER` resets everything including `C/Y` back to 1 (pp. 66-67).
- `CLR TVM` is not mentioned for this worksheet and does not clear `NOM`/`EFF`.
- `2ND QUIT` exits without clearing; values persist.

## Errors

- **Error 4 (Out of range)** — the guidebook lists "Interest Conversion worksheet: the `C/Y` value ≤ 0" (p. 84). The relational operator is itself a dropped vector glyph in the source (the line renders as "the C/Y value  0."), so the operator is inferred; the only sensible reading given `C/Y` sits in a divisor and an exponent is `≤ 0`.
- **Error 1 (Overflow)** — a very large `NOM` with a very large `C/Y` can push `EFF` past the display range (p. 84).
- **Error 2 (Invalid argument)** — `ln` of a non-positive argument (p. 84). Reachable when `1 + x ≤ 0`, i.e. `NOM ≤ −100 × C/Y` or `EFF ≤ −100`.

## Edge cases & ambiguities

- Whether this `C/Y` is shared with the TVM worksheet's `C/Y` is never stated. The guidebook gives it its own default row (1) under this worksheet (p. 67) while the TVM `C/Y` defaults to 1 as well, so the two are indistinguishable from the printed defaults alone. Implementations should treat them as **separate** storage, since `2ND CLR WORK` here is defined to not touch `C/Y` at all.
- `C/Y = 1` makes `EFF = NOM` exactly; not stated but implied by both formulas.
- Fractional `C/Y` is not prohibited by anything printed; the formula tolerates it.
- Whether `CPT` on `C/Y` is a no-op or an error is not stated; `C/Y` is typed Enter-only (p. 66).

---

# Date Worksheet

Counts days between two dates, or projects a date from a start date and a day count (p. 68).

## Variables

| Name | Label | Reached by | Default | Type | Valid range / notes |
| --- | --- | --- | --- | --- | --- |
| Date 1 | `DT1` | `2ND DATE` | 12-31-1990 | Enter/compute | Jan 1 1980 – Dec 31 2079 (p. 81); assumed earlier than `DT2` (p. 68) |
| Date 2 | `DT2` | `DOWN` | 12-31-1990 | Enter/compute | same range |
| Days between dates | `DBD` | `DOWN` | 0 | Enter/compute | |
| Actual/actual day-count | `ACT` | `DOWN` | selected (default method) | Setting | mutually exclusive with `360` |
| 30/360 day-count | `360` | `DOWN` | not selected | Setting | mutually exclusive with `ACT` |

`ACT` and `360` occupy one setting slot; `2ND SET` toggles between them (p. 68). The guidebook marks both with an asterisk in the variable table (p. 68) to flag them as settings rather than numbers.

## Behaviour

- `2ND DATE` opens the worksheet on `DT1` (p. 69).
- Variable order via `DOWN`: `DT1 → DT2 → DBD → ACT/360` (p. 68).
- Enter values for exactly two of `DT1`, `DT2`, `DBD`; do not key anything into the one you want solved (p. 69).
- Dates are keyed in the currently selected US or European date format (p. 68). The p. 69 example keys `9.0403` and gets `DT1= 9-04-2003`, i.e. US `MM.DDYY` with a two-digit year mapped into the 1980-2079 window.
- `2ND SET` on the `ACT`/`360` slot switches to the other method (p. 69).
- `CPT` on the unknown variable produces the answer (p. 69).
- Computing a `DT1` or `DT2` also shows a three-letter weekday abbreviation, e.g. `WED` (p. 68).
- **`360` restricts what is computable**: with the 30/360 method selected you can compute `DBD` but **not** `DT1` or `DT2` (p. 69). With `ACT` selected, the calculator uses real month lengths and leap-year adjustments (p. 69).

## Formulas

Rendered on pp. 81-82.

### Actual/actual method (p. 81)

The method assumes the actual number of days per month and per year.

```
DBD (days between dates) = number of days II − number of days I

Number of Days I  = (Y1 − YB) × 365
                  + (number of days MB to M1)
                  + DT1
                  + (Y1 − YB)/4

Number of Days II = (Y2 − YB) × 365
                  + (number of days MB to M2)
                  + DT2
                  + (Y2 − YB)/4
```

Note on the rendering: on p. 81 the multiplication sign in `(Y1 − YB) × 365` is drawn as a glyph that extracts as `Q`. The corresponding line for `Number of Days II` on p. 82 renders the same operator correctly as `×`, which settles it.

Where (p. 82):
- `M1` = month of first date
- `DT1` = day of first date
- `Y1` = year of first date
- `M2` = month of second date
- `DT2` = day of second date
- `Y2` = year of second date
- `MB` = base month (January)
- `DB` = base day (1)
- `YB` = base year (first year after a leap year)

### 30/360 method (p. 82)

The method assumes 30 days per month and 360 days per year. As rendered the closing parenthesis is dropped:

```
DBD = (Y2 − Y1) × 360 + (M2 − M1) × 30 + (DT2 − DT1
```

Correct form:

$$\mathrm{DBD} = (Y2 - Y1) \times 360 + (M2 - M1) \times 30 + (DT2 - DT1)$$

**Day-clamping rule (p. 82), applied before the subtraction:**
- If `DT1` is 31, change `DT1` to 30.
- If `DT2` is 31 **and** `DT1` is 30 or 31, change `DT2` to 30; otherwise leave `DT2` at 31.

Source attribution for the 30/360 rule: Lynch and Mayle, *Standard Securities Calculation Methods*, Securities Industry Association, 1986 (p. 82 footnote).

**Discrepancy flag.** Page 82 ends with a bare `Note:` heading followed by blank space — a dropped vector graphic. Whatever qualification it carried is unrecoverable from this source. Flag as an open question.

## Key sequences

Days between two dates, actual/actual (p. 69):
```
2ND DATE   9.0403 ENTER   DOWN 11.0103 ENTER   DOWN DOWN   UP CPT      → DBD = 58.00
```
(The `DOWN DOWN` from `DT2` reaches the `ACT` setting slot to confirm the method; `UP` returns to `DBD`.)

Switch the day-count method:
```
2ND DATE   DOWN DOWN DOWN   2ND SET                    → toggles ACT ↔ 360
```

Project a date forward:
```
2ND DATE   <mm.ddyy> ENTER   DOWN DOWN <days> ENTER   UP CPT     → DT2 (+ weekday)
```

## Clearing/reset

- `2ND CLR WORK` inside the Date worksheet clears `DT1`, `DT2`, `DBD` back to defaults (`12-31-1990`, `12-31-1990`, `0`) and **does not touch the day-count method** (p. 68).
- `2ND RESET ENTER` resets everything, day-count method included, back to `ACT` (p. 68).
- `CLR TVM` is unrelated and leaves date variables intact.
- `2ND QUIT` exits without clearing.

## Errors

- **Error 6 (Invalid date)** — the date is invalid (the guidebook's example is January 32) or is in the wrong format (`MM.DDYYYY` instead of `MM.DDYY`) (p. 85).
- **Error 4 (Out of range)** — a computed date falls outside January 1 1980 through December 31 2079 (p. 84). The same window is stated as the enterable range on p. 81.

## Edge cases & ambiguities

- `DT1` is assumed earlier than `DT2` (p. 68), but the guidebook never says what happens if it isn't. The 30/360 formula is a signed subtraction and would return a negative `DBD`; the actual/actual formula would likewise. Unspecified whether the calculator rejects or signs the result.
- The `(Y − YB)/4` leap-day term is printed as an unadorned fraction with no floor/truncation notation, yet a fractional day count is meaningless. The intended reading is an integer count of leap days — the printed formula is incomplete on this point.
- `YB` is defined circularly-ish as "base year (first year after leap year)" (p. 82) with no concrete value given, and `MB`/`DB` are January/1. The base year constant is not printed anywhere in this source.
- `DB` (base day) is defined on p. 82 but never used in either printed equation.
- The p. 69 example computes `DBD` = 58 for 2003-09-04 → 2003-11-01, which is the actual/actual count (26 remaining days in September + 31 in October + 1 in November). Under 30/360 the same pair gives `(0)×360 + (2)×30 + (1 − 4) = 57`. The guidebook does not print the 30/360 comparison; noted here as an implementation check, not as a guidebook fact.
- Two-digit year → century mapping (`03` → 2003, and by the 1980-2079 window, `80`-`99` → 19xx) is implied by the example and the range statement but never spelled out.
- Whether `CPT DT1`/`CPT DT2` under the `360` method raises an error or is silently inert is not stated — p. 69 only says you "cannot" compute them.

---

# Profit Margin Worksheet

Relates cost, selling price, and **gross profit margin** (p. 70).

## Variables

| Name | Label | Reached by | Default | Type | Valid range / notes |
| --- | --- | --- | --- | --- | --- |
| Cost | `CST` | `2ND PROFIT` | 0 | Enter/compute | any real |
| Selling price | `SEL` | `DOWN` | 0 | Enter/compute | any real; `SEL = 0` divides by zero |
| Profit margin | `MAR` | `DOWN` | 0 | Enter/compute | percent of **selling price** |

## Behaviour

- `2ND PROFIT` opens the worksheet on `CST` (p. 70).
- Variable order via `DOWN`: `CST → SEL → MAR` (p. 70).
- Enter the two known variables, then land on the third and press `CPT` (p. 70).
- **Margin is not markup.** Gross profit margin is (selling price − cost) as a percentage **of the selling price**; markup is the same numerator as a percentage **of the cost** (p. 70). Markup problems belong in the Percent Change/Compound Interest worksheet, not here (p. 70).

## Formulas

Rendered on p. 81, and it is the one equation in this chapter that survives the vector export cleanly:

```
GrossProfit Margin = (SellingPrice − Cost) / SellingPrice × 100
```

$$\mathrm{MAR} = \frac{\mathrm{SEL} - \mathrm{CST}}{\mathrm{SEL}} \times 100$$

Where:
- `CST` = cost (`Cost` in the printed formula)
- `SEL` = selling price (`SellingPrice` in the printed formula)
- `MAR` = gross profit margin, in percent

Solved forms:
```
CST = SEL × (1 − MAR/100)
SEL = CST / (1 − MAR/100)
```

**Sign convention.** All three quantities are unsigned in normal use. No sign inversion is present; the p. 71 worked example (`SEL=125`, `MAR=20` ⇒ `CST=100.00`) matches the printed formula exactly: `125 × (1 − 0.20) = 100`.

The printed variable names in the formula (`Cost`, `SellingPrice`) differ from the display labels (`CST`, `SEL`, `MAR`); the appendix does not supply a `where:` block mapping them, so the correspondence is inferred from the worksheet table on p. 70.

## Key sequences

Find cost from selling price and margin (p. 71):
```
2ND PROFIT   DOWN 125 ENTER   DOWN 20 ENTER   UP UP CPT        → CST = 100.00
```
Find margin from cost and selling price:
```
2ND PROFIT   <cost> ENTER   DOWN <sel> ENTER   DOWN CPT        → MAR
```

## Clearing/reset

- `2ND CLR WORK` inside the worksheet sets all three variables to zero (p. 70).
- `2ND RESET ENTER` resets everything including these (p. 70).
- `CLR TVM` is unrelated.
- `2ND QUIT` exits without clearing.

Note that the p. 71 example opens on `CST= 0.00` without pressing `CLR WORK`, implying a freshly reset machine rather than any auto-clear on entry.

## Errors

- **Error 1 (Overflow)** — internal divide by zero (p. 84). Reachable by computing `MAR` with `SEL = 0`, or computing `SEL` with `MAR = 100` (the `1 − MAR/100` divisor vanishes).

## Edge cases & ambiguities

- `MAR = 100` is a pole in the `SEL` solution; `MAR > 100` implies negative cost. Neither is discussed.
- Negative `MAR` (cost above selling price) is arithmetically fine but the guidebook never mentions it.
- No valid range is printed for any of the three variables.

---

# Breakeven Worksheet

Five-variable model of fixed costs, unit variable cost, unit price, profit, and quantity (p. 71).

## Variables

| Name | Label | Reached by | Default | Type | Valid range / notes |
| --- | --- | --- | --- | --- | --- |
| Fixed cost | `FC` | `2ND BRKEVN` | 0 | Enter/compute | any real |
| Variable cost per unit | `VC` | `DOWN` | 0 | Enter/compute | any real |
| Unit price | `P` | `DOWN` | 0 | Enter/compute | any real; `P = VC` is a pole when solving `Q` |
| Profit | `PFT` | `DOWN` | 0 | Enter/compute | set to 0 to solve for the breakeven quantity (p. 71) |
| Quantity | `Q` | `DOWN` | 0 | Enter/compute | any real |

## Behaviour

- `2ND BRKEVN` opens on `FC` (p. 72).
- Variable order via `DOWN`: `FC → VC → P → PFT → Q` (p. 71).
- Enter four known values, then land on the fifth and press `CPT` (p. 71).
- The breakeven point is where total costs equal total revenues; below that quantity the operation runs at a loss (p. 71).
- **To get the classic breakeven quantity, enter `PFT = 0` and compute `Q`** (p. 71). The p. 72 example leans on `PFT` already being 0 and simply steps past it.

## Formulas

Rendered cleanly on p. 81:

```
PFT = PQ − (FC + VCQ)
```

$$\mathrm{PFT} = P \cdot Q - (\mathrm{FC} + \mathrm{VC} \cdot Q)$$

Where (p. 81):
- `PFT` = profit
- `P` = price
- `FC` = fixed cost
- `VC` = variable cost
- `Q` = quantity

Solved forms:
```
Q  = (FC + PFT) / (P − VC)
P  = (PFT + FC + VC×Q) / Q
VC = (P×Q − FC − PFT) / Q
FC = P×Q − VC×Q − PFT
```

**Sign convention.** `FC` and `VC` are entered as positive magnitudes and are subtracted by the formula — there is no cash-flow sign convention here, unlike TVM. Verified by the p. 72 example: `FC=3000`, `VC=15`, `P=20`, `PFT=0` ⇒ `Q = (3000+0)/(20−15) = 600.00`, matching the printed formula with no sign flip.

## Key sequences

Breakeven quantity (p. 72):
```
2ND BRKEVN   3000 ENTER   DOWN 15 ENTER   DOWN 20 ENTER   DOWN   DOWN CPT   → Q = 600.00
```
(The lone `DOWN` displays `PFT= 0.00` and leaves it as-is; the next `DOWN CPT` lands on `Q` and solves.)

## Clearing/reset

- `2ND CLR WORK` sets all five Breakeven variables to zero (p. 71).
- `2ND RESET ENTER` resets all calculator variables and formats, these included (p. 72).
- `CLR TVM` is unrelated.
- `2ND QUIT` exits without clearing.

## Errors

- **Error 1 (Overflow)** — internal divide by zero (p. 84). Reachable when computing `Q` with `P = VC` (zero contribution margin), or when computing `P`/`VC` with `Q = 0`.

## Edge cases & ambiguities

- `P = VC` is the degenerate case: no quantity satisfies a nonzero `FC`, and every quantity satisfies `FC = 0`. Not discussed in the guidebook.
- The p. 72 example opens on `FC=` "Current value", so the worksheet is not auto-cleared on entry — but the example nevertheless depends on `PFT` being 0. If a prior session left `PFT` nonzero, the sequence yields a different `Q`. The guidebook is silent on this; a faithful implementation should reproduce whatever `PFT` holds.
- Non-integer computed `Q` is possible and the guidebook offers no rounding rule.
- The p. 72 instruction list has an off-by-one ("Repeat step 3…" where step 2 is meant); cosmetic, no behavioural content.

---

# Memory Worksheet

A browsable view of the calculator's 10 general-purpose memories (p. 72).

## Variables

| Name | Label | Reached by | Default | Type | Valid range / notes |
| --- | --- | --- | --- | --- | --- |
| Memory 0 | `M0` | `2ND MEM` | 0 | Enter-only | any real |
| Memory 1 | `M1` | `DOWN` | 0 | Enter-only | any real |
| Memory 2 | `M2` | `DOWN` | 0 | Enter-only | any real |
| Memory 3 | `M3` | `DOWN` | 0 | Enter-only | any real |
| Memory 4 | `M4` | `DOWN` | 0 | Enter-only | any real |
| Memory 5 | `M5` | `DOWN` | 0 | Enter-only | any real |
| Memory 6 | `M6` | `DOWN` | 0 | Enter-only | any real |
| Memory 7 | `M7` | `DOWN` | 0 | Enter-only | any real |
| Memory 8 | `M8` | `DOWN` | 0 | Enter-only | any real |
| Memory 9 | `M9` | `DOWN` | 0 | Enter-only | any real |

Every memory variable is Enter-only (pp. 72-73) — `CPT` has no meaning here.

## Behaviour

- `2ND MEM` opens the worksheet on `M0` (p. 73).
- `DOWN` / `UP` step one memory at a time, `M0` through `M9` (p. 73).
- To store, navigate to the memory, key a value, press `ENTER` (p. 73).
- The worksheet is a *view*: the same ten memories are reachable directly with `STO` + digit and `RCL` + digit (p. 72).
- **Memory arithmetic inside the worksheet**: with a memory displayed, pressing an arithmetic key, then an operand, then `ENTER`, applies the operation to the stored value in place and redisplays the memory (p. 73). The worked sequence exercises `+`, `−`, `×`, `÷`, and `yˣ`.

## Formulas

None. The worksheet stores and displays values; memory arithmetic applies the pressed operator between the stored value (left operand) and the keyed value (right operand):

```
Mn ← Mn <op> keyed_value
```

Confirmed left-operand ordering by the p. 73 sequence: from `M4 = 190.00`, `Y^X 2 ENTER` gives `36,100.00` = 190², not 2¹⁹⁰. Likewise `÷ 65` from `12,350` gives `190`, not `65/12350`.

## Key sequences

Full memory-arithmetic walkthrough (p. 73):
```
2ND MEM                        → M0= current value
DOWN DOWN DOWN DOWN            → M4= current value
0 ENTER                        → M4= 0.00
95 ENTER                       → M4= 95.00
+ 65 ENTER                     → M4= 160.00
- 30 ENTER                     → M4= 130.00
* 95 ENTER                     → M4= 12,350.00
/ 65 ENTER                     → M4= 190.00
Y^X 2 ENTER                    → M4= 36,100.00
```

## Clearing/reset

- `2ND CLR WORK` inside the Memory worksheet clears **all ten** memories at once (p. 73). This is the only clear operation described for this worksheet — there is no single-memory clear key; the p. 73 example clears `M4` individually by storing `0`.
- `2ND RESET ENTER` resets all calculator variables, memories included.
- `CLR TVM` does not touch memories.
- `2ND QUIT` exits without clearing; stored values remain reachable via `RCL` + digit.

## Errors

- **Error 1 (Overflow)** — a memory-arithmetic result outside ±9.9999999999999E99, or dividing by zero (p. 84).
- **Error 2 (Invalid argument)** — `Y^X` with a negative stored value and an exponent that is neither an integer nor the inverse of an integer (p. 84).

## Edge cases & ambiguities

- The guidebook does not say what a *bare* arithmetic key press followed by `ENTER` (no operand) does.
- Whether memory arithmetic in the worksheet shares the pending-operation stack with standard-calculator mode (and hence Error 3's 8-pending-operation limit) is not stated.
- `2ND CLR WORK` here is unusually broad — it wipes all ten memories, not just the displayed one. Worth an explicit confirmation-free warning in any UI.
- The p. 73 heading text ends "M0 apears" (guidebook typo); no behavioural content.

---

# Cross-cutting notes

## Display formatting

All worked examples in pp. 63-73 display two decimal places, the calculator's default `DEC` setting. Values ≥ 1000 are shown with a thousands separator: `3,000.00`, `12,350.00`, `36,100.00` (pp. 72-73). Dates display as `MM-DD-YYYY` in US format, unpadded on the month for single-digit months: `9-04-2003`, `11-01-2003`, `12-31-1990` (p. 69).

## Summary of flagged discrepancies

| Where | Printed | Corrected by | Resolution |
| --- | --- | --- | --- |
| p. 63 reset table | `#PD` default `0` | p. 64 prose + p. 65 cost-sell-markup example | `#PD` clears to **1** |
| p. 81 Percent Change | `NEW = OLD(1 + %CH/100)#PD` | p. 65 compound-interest example (`8.45`) | `#PD` is an **exponent** |
| p. 80 Interest Conversion | `EFF = 100 × (eC/Y × In(x ÷ 1) − 1` | p. 67 example (`15.87`) | `ln(x **+** 1)`; `e^(...)`; closing paren before `− 1` |
| p. 80 Interest Conversion | `NOM = 100 × C/Y × (e1 ÷ C/Y × IN(x + 1) − 1` | inverse round-trip of the p. 67 example | `e^((1/C/Y) × ln(x+1))`; closing paren before `− 1` |
| p. 80 `where:` | `x = .01 × NOM ÷ CY` | context | `CY` is `C/Y` |
| p. 81 Days I | `(Y1 − YB) Q 365` | p. 82 renders the same operator as `×` | `Q` is the multiplication sign |
| p. 82 30/360 | `DBD = (Y2 − Y1) × 360 + (M2 − M1) × 30 + (DT2 − DT1` | balance | missing closing parenthesis |
| p. 84 Error 4 | "Interest Conversion worksheet: the C/Y value  0." | context | relational operator dropped; reads `≤ 0` |
| p. 82 | trailing bare `Note:` with no content | — | unrecoverable from this source |
