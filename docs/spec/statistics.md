# Statistics Worksheet

> Source: official BA II Plus guidebook, pages 59-62. Behaviour described in original wording.
> Supporting equations recovered from the Appendix reference pages (PDF p. 80) and the error table (PDF p. 84),
> because pages 59-62 contain no equations for the computed outputs. All formula images were read directly;
> the text layer of this PDF drops every equation.

Page citations below use **PDF page numbers** (the file's `========== PAGE N ==========` markers and
`pages/pageNN.png` images). The printed folio in the page footer is 5 lower — PDF p. 59 prints as "54".

---

## Variables

Two distinct portions of one worksheet share the same data set.

### Data-entry portion — `2ND` `DATA`

| Variable | Display | Type | Default | Valid range / notes |
|---|---|---|---|---|
| Current X value | `Xnn` | Enter-only | none (empty) | `nn` = index of the current point, 01-50 (p. 59, p. 60) |
| Current Y value | `Ynn` | Enter-only | `1` | Set to 1 automatically when an `Xnn` is keyed in (p. 60) |

`nn` identifies the current X or Y value (p. 59). Capacity is 50 (x,y) pairs (p. 60).

### Calculation-method portion — `2ND` `STAT`

| Variable | Display | Type | Default | Notes |
|---|---|---|---|---|
| Standard linear regression | `LIN` | Setting | **LIN is the reset default** | Selected by cycling with `2ND` `SET` (p. 59, p. 62) |
| Logarithmic regression | `Ln` | Setting | — | (p. 59) |
| Exponential regression | `EXP` | Setting | — | (p. 59) |
| Power regression | `PWR` | Setting | — | (p. 59) |
| One-variable statistics | `1-V` | Setting | — | (p. 59) |

### Computed outputs — reached with `DOWN` / `UP`

Marked **2-V only** = not displayed when `1-V` is the selected method (p. 59 footnote, p. 60, p. 62).

| Variable | Display | Type | Notes |
|---|---|---|---|
| Number of observations | `n` | Auto-compute | shown for 1-V and 2-V |
| Mean of X values | `x̄` | Auto-compute | shown for 1-V and 2-V |
| Sample standard deviation of X | `Sx` | Auto-compute | n−1 weighting; shown for 1-V and 2-V |
| Population standard deviation of X | `σx` | Auto-compute | n weighting; shown for 1-V and 2-V |
| Mean of Y values | `ȳ` | Auto-compute | **2-V only** |
| Sample standard deviation of Y | `Sy` | Auto-compute | **2-V only** |
| Population standard deviation of Y | `σy` | Auto-compute | **2-V only** |
| Linear regression y-intercept | `a` | Auto-compute | **2-V only** |
| Linear regression slope | `b` | Auto-compute | **2-V only** |
| Correlation coefficient | `r` | Auto-compute | **2-V only** |
| Predicted X value | `X'` | Enter/compute | **2-V only** — the only outputs that are not auto-computed (p. 60) |
| Predicted Y value | `Y'` | Enter/compute | **2-V only** |
| Sum of X values | `ΣX` | Auto-compute | shown for 1-V and 2-V |
| Sum of X squared values | `ΣX2` | Auto-compute | shown for 1-V and 2-V |
| Sum of Y values | `ΣY` | Auto-compute | **2-V only** |
| Sum of Y squared values | `ΣY2` | Auto-compute | **2-V only** |
| Sum of XY products | `ΣXY` | Auto-compute | **2-V only** |

For `1-V`, exactly six results are computed and displayed: `n`, `x̄`, `Sx`, `σx`, `ΣX`, `ΣX2` (p. 60, p. 62).

---

## Behaviour

- `2ND` `DATA` opens the data-entry portion and shows `X01` together with whatever value it already held (p. 61).
- `2ND` `STAT` opens the calculation-method portion and shows the method selected last (p. 62).
- `2ND` `SET` cycles the method; press it repeatedly until the wanted one appears. The cycle covers LIN, Ln, EXP, PWR and 1-V (p. 62).
- `DOWN` and `UP` walk the variable list in either portion. Holding either key scrolls continuously through a range (p. 62).
- Every statistics result except `X'` and `Y'` is calculated and shown at the moment it is scrolled to — there is no `CPT` step for them (p. 60, p. 62).
- `X'` and `Y'` work as a paired predictor: supply one, compute the other (p. 60).
- X is treated as the independent variable and Y as the dependent one (p. 61).
- Values persist until the worksheet is cleared or the entries are overwritten, so a repeat calculation rarely needs the full procedure (p. 61).
- `2ND` `DEL` deletes and `2ND` `INS` inserts a statistical data point; the DEL/INS annunciators mark these (p. 8).
- In 1-V mode `Xnn` carries the value and `Ynn` carries how many times it occurs — a frequency (p. 60).

### Regression models (p. 61)

| Method | Model | Restriction |
|---|---|---|
| LIN | `Y = a + bX` | none |
| Ln | `Y = a + b ln(X)` | every X > 0 |
| EXP | `Y = a·b^X` | every Y > 0 |
| PWR | `Y = a·X^b` | every X > 0 and every Y > 0 |

Fitting is performed on transformed data, and the transformation is what distinguishes the four methods (p. 61):

| Method | Transformed x | Transformed y |
|---|---|---|
| LIN | X | Y |
| Ln | ln(X) | Y |
| EXP | X | ln(Y) |
| PWR | ln(X) | ln(Y) |

The calculator picks the `a` and `b` giving the best-fitting line or curve (p. 61).

### Correlation coefficient (p. 61)

`r` gauges how well the fitted equation matches the data: values near 1 or −1 indicate a good fit, values near zero a poor one (p. 61).

---

## Formulas

**Provenance warning.** Pages 59-62 print the four model equations only (p. 61). The equations defining
`n`, `x̄`, `Sx`, `σx`, `a`, `b`, `r` live in the Appendix (PDF p. 80) and exist solely as vector drawings —
they were read from `pages/page80.png`. Both transcriptions below are given: first *exactly as rendered*,
then the corrected reading, with the evidence for the correction.

### Model equations — as rendered on p. 61

```
LIN    Y = a + b X          None
Ln     Y = a + b ln(X)      All X values > zero
EXP    Y = a bx             All Y values > zero
PWR    Y = a Xb             All X and Y values > zero
```

The trailing `x` in the EXP row and `b` in the PWR row are typeset as *lowered, baseline-shifted* glyphs —
verified at 6× zoom on `pages/page61.png`. They are **exponents rendered as pseudo-subscripts**, a
typesetting defect in the source PDF.

**Corrected:**

```
LIN:  Y = a + b*X
Ln:   Y = a + b*ln(X)
EXP:  Y = a * b^X
PWR:  Y = a * X^b
```

**Evidence (self-proving from the same page).** p. 61 states EXP fits using X and ln(Y). A model linear in
`(X, ln Y)` means `ln Y = ln a + X·ln b`, i.e. `Y = a·b^X` — an exponent, not a subscript. Likewise PWR fits
using ln(X) and ln(Y): `ln Y = ln a + b·ln X`, i.e. `Y = a·X^b`. A subscript reading is mathematically
meaningless and contradicts the transformation table printed six lines below it.

### Descriptive statistics — Appendix, PDF p. 80

The Appendix notes these apply to both x and y (p. 80).

As rendered (exponents and the bracket power are flattened to the baseline in the PDF):

```
Standard deviation with n weighting (σx):     [ ( Σx² − (Σx)2 / n ) / n ]   1/2
Standard deviation with n−1 weighting (sx):   [ ( Σx² − (Σx)2 / n ) / n−1 ] 1/2
Mean:                                          x̄ = (Σ x) / n
```

**Corrected** — `(Σx)2` is `(Σx)²`, and the trailing `1/2` is the exponent applied to the bracket:

```
σx = [ ( Σx² − (Σx)²/n ) / n ]^(1/2)          # population, n weighting
Sx = [ ( Σx² − (Σx)²/n ) / (n−1) ]^(1/2)      # sample, n−1 weighting
x̄  = (Σx) / n
```

The same three apply to y, giving `σy`, `Sy`, `ȳ` (p. 80).

Note the case convention clash: the Appendix writes the sample deviation as lowercase `sx`, while the display
label on p. 59 is capital `Sx`, and the Appendix writes the population deviation `σx` matching the p. 59
display `σx`. Implement by weighting (n vs n−1), not by letter case.

### Regression — Appendix, PDF p. 80

Introduced with the note that they apply to every regression model **using transformed data** (p. 80) — so
substitute the transformed x and y of the selected method before applying them.

As rendered:

```
b = ( n(Σ xy) − (Σ y)(Σ x) ) / ( n(Σ x2) − Σ x)2 )
a = ( Σ y − b Σ x ) / n
r = b δx / δy
```

**Corrected:**

```
b = [ n·Σ(xy) − (Σy)(Σx) ] / [ n·Σ(x²) − (Σx)² ]
a = [ Σy − b·Σx ] / n
r = b · σx / σy
```

Three rendering defects fixed above, all confirmed at 6× zoom on `pages/page80.png`:

1. `Σ x2` is `Σx²` — flattened exponent.
2. `− Σ x)2` has an **unbalanced parenthesis**: the opening `(` is missing and the `2` is a flattened exponent.
   It must read `− (Σx)²`. As literally printed, the denominator does not parse.
3. `r = b δx / δy` uses `δ` (delta) where the symbol is `σ` (sigma) — a symbol-font substitution. The
   identity `b = r·σy/σx` rearranges to `r = b·σx/σy`, which confirms sigma.

**Sign conventions.** This worksheet has none of the cash-flow sign conventions that corrupt the TVM appendix
formulas. `b` and `r` carry the sign of the underlying association (both are negative for a downward-sloping
fit); `a` may be any sign. No leading-minus defect of the kind found in the TVM `PMT` formula applies here.

**Population vs sample in `r`.** The Appendix does not say whether `σx`/`σy` in the `r` formula are the n- or
(n−1)-weighted deviations. It is numerically immaterial: the two weightings differ by a constant factor
`√(n/(n−1))` that cancels in the ratio `σx/σy`. Either choice reproduces the same `r`.

---

## Key sequences

Canonical tokens: `2ND`, `DATA`, `STAT`, `SET`, `CLR WORK`, `RESET`, `ENTER`, `CPT`, `DOWN`, `UP`, `DEL`, `INS`.

**Entering statistical data (p. 61-62)**

```
2ND DATA                 -> X01 shown with any previous value
2ND CLR WORK             -> clear the worksheet
<value> ENTER            -> store X01   (1-V: first data point; 2-V: first X)
DOWN                     -> show Y01
<value> ENTER            -> store Y01   (1-V: frequency, default 1; 2-V: first Y)
DOWN                     -> show X02
... repeat until every point is entered
```

**Selecting a calculation method and computing results (p. 62)**

```
2ND STAT                 -> shows the method used last (LIN, Ln, EXP, PWR or 1-V)
2ND SET (repeat)         -> cycle to the wanted method; 1-V for one-variable data
DOWN (repeat)            -> step through and auto-compute each result
```

**Computing Y' from X' (p. 62)**

```
2ND STAT
UP or DOWN until X' shown
<value> ENTER            -> store X'
DOWN                     -> show Y'
CPT                      -> compute predicted Y'
```

**Computing X' from Y' (p. 62)**

```
2ND STAT
UP or DOWN until Y' shown
<value> ENTER            -> store Y'
UP                       -> show X'
CPT                      -> compute X'
```

Note the asymmetry, which is exact per p. 62: the Y' procedure moves `DOWN` from X' to Y', while the X'
procedure moves `UP` from Y' to X'. This matches the display order `... a, b, r, X', Y', ΣX ...` on p. 59.

---

## Clearing/reset

| Action | Effect | Does **not** touch |
|---|---|---|
| `2ND` `CLR WORK` inside `2ND` `DATA` | Clears every X and Y value and every value in the statistics portion (p. 60) | The selected calculation method — explicitly preserved (p. 60) |
| `2ND` `CLR WORK` inside `2ND` `STAT` | Resets the method to `LIN` and clears all values **except** X and Y (p. 60) | The entered X and Y data points (p. 60) |
| `2ND` `RESET` `ENTER` | Resets the method to `LIN` and clears all values **including** X and Y (p. 60) | — (full reset) |
| `2ND` `QUIT` | Not documented for this worksheet on pp. 59-62. By the general worksheet model it leaves the worksheet for standard-calculator mode and retains stored data. | — (see Edge cases) |

`CLR TVM` is a TVM-worksheet operation and has no effect on any Statistics variable; the two worksheets share
no storage.

---

## Errors

| Error | Raised when |
|---|---|
| **Error 1 — Overflow** | A statistics calculation in which the X values are all identical, or the Y values are all identical (PDF p. 84, confirmed from `pages/page84.png`). The two triggers fail by **different** mechanisms, and each is sufficient on its own: with every X identical, `σx = 0` and the `b` denominator `n·Σx² − (Σx)²` collapses to zero, so `b` itself divides by zero; with every Y identical, `σy = 0` while the `b` denominator is fine — `b` evaluates to 0 and `r = b·σx/σy` then divides by zero as `0/0`. Note that `σx` sits in the **numerator** of `r`, so `σx = 0` alone does not make `r` divide by zero; it is the `b` denominator that fails in that case. |
| **Error 1 — Overflow** | A result falls outside the calculator range `±9.9999999999999E99` (p. 84). Reachable here via `ΣX2`/`ΣY2`/`ΣXY` on large inputs, and via `EXP`/`PWR` predictions of `Y'`. |
| **Error 2 — Invalid argument** | `LN` of a non-positive argument (p. 84). This is the mechanism behind the p. 61 model restrictions: `Ln` with any X ≤ 0; `EXP` with any Y ≤ 0; `PWR` with any X ≤ 0 or Y ≤ 0. *Inference* — see Edge cases. |
| **Unnamed error** | Scrolling with `DOWN` or `UP` into the results portion when no data points have been entered (p. 60). The guidebook says an error is displayed but does **not** name it. |

The row assignment above needed the rendered image to settle. In the extracted text the error table's left-hand
labels interleave with the right-hand bullets, which makes the Statistics bullet look as though it might belong
to Error 2. `pages/page84.png` shows unambiguously that it sits in the **Error 1 / Overflow** row.

Errors 3, 4, 5, 6, 7 and 8 have no documented Statistics-worksheet cause (p. 84-85). In particular this
worksheet runs no iterative solver, so Errors 7 and 8 are unreachable from it.

Any error message is cleared with `CE/C` (p. 84).

---

## Edge cases & ambiguities

1. **No worked example exists — anywhere.** The Statistics section (PDF pp. 59-62) is entirely procedural.
   The guidebook has **no separate worked-example chapter**: each worksheet chapter carries its own `Example:`
   subsections inline, and Statistics is the only worksheet chapter that has none. Its table-of-contents entry
   lists exactly four subsections — Statistics Worksheet Variables, Regression Models, Entering Statistical
   Data, Computing Statistical Results — whereas TVM, Cash Flow, Bond, Depreciation and every Other-Worksheets
   section each carry one or more `Example:` headings. Verified two ways: no `Example:` heading falls anywhere
   within the Statistics section, and no example elsewhere in the guidebook drives the Statistics worksheet.
   `tests/golden/statistics.json` therefore has `cases: []`, and this is correct rather than an extraction gap.
   **This section has no parity oracle in the source document** — the implementation must be validated against
   the Appendix formulas (PDF p. 80) or real hardware, not against the guidebook.
2. **How frequencies enter the 1-V formulas is unstated.** p. 60 says `Ynn` is the number of occurrences, but
   the Appendix formulas (p. 80) are written in bare `Σx`, `Σx²`, `n` with no weight term. The guidebook never
   states that `n = ΣYnn` or that `ΣX = Σ(Ynn·Xnn)`, though both are required for the frequency feature to mean
   anything. Implement as frequency-weighted; flagged as undocumented.
3. **Non-integer or zero frequencies are unspecified.** No stated range for `Ynn` in 1-V mode, and no stated
   error for a fractional or negative frequency. Contrast the Cash Flow worksheet, whose `Fnn` is explicitly
   bounded 0.5-9,999 with Error 4 (p. 84) — no analogous bound is printed for `Ynn`.
4. **`CLR WORK` in the STAT portion is self-contradictory in effect.** p. 60 says it clears all values except X
   and Y — but every result other than `X'`/`Y'` is auto-computed from X and Y on access (p. 60, p. 62). With
   the data retained, scrolling immediately repopulates them. The observable effects are therefore: method to
   `LIN`, and `X'`/`Y'` cleared. Worth pinning against hardware.
5. **`Ynn` defaulting to 1 applies in 2-V mode too.** p. 60 states the default without restricting it to 1-V,
   so keying an X in 2-V mode and scrolling past Y silently contributes a Y of 1.
6. **`QUIT` is not described for this worksheet.** Its behaviour in the table above is extrapolated from the
   general worksheet model, not from pp. 59-62.
7. **Restriction violations have no explicitly stated error.** p. 61 gives the restrictions; p. 84 gives the LN
   rule. The guidebook never joins them. Whether the calculator rejects a bad point at entry or only at the
   moment a result is accessed is unstated — the latter is far likelier, since the method can be changed after
   the data is entered.
8. **`X'`/`Y'` predictions are undefined when a model is degenerate**, e.g. computing `X'` from `Y'` when
   `b = 0`. Not addressed on pp. 59-62.
9. **Whether `r` is reported for a perfectly-fitting transformed model** and its sign for `EXP`/`PWR` (where
   the fit is on `ln Y`) is not discussed. `r` describes the transformed fit, per the p. 80 header.
10. **Capacity behaviour at the 50-point limit is unstated** (p. 60): no documented error for attempting a 51st
    point, and no statement of what `2ND` `INS` does when the list is already full.
11. **Display labels vs. text-layer garbling.** The text extraction renders `x̄` as `v`, `ȳ` as `y`, and the
    `Σ` glyph as `G`. The p. 59 image is authoritative: the labels are `x̄`, `ȳ`, `Sx`, `σx`, `Sy`, `σy`,
    `ΣX`, `ΣX2`, `ΣY`, `ΣY2`, `ΣXY`.
