# Depreciation Worksheet

> Source: official BA II Plus guidebook, pages 55-58. Behaviour described in original wording.
> Formulas recovered from the rendered appendix images, pages 78-79 (the text layer drops every equation).
> Error table recovered from pages 84-85. Rounding rule cross-referenced from page 9.

The Depreciation worksheet builds a year-by-year depreciation schedule under one of six methods.
It is entered with `2ND` `DEPR`, the method is cycled with `2ND` `SET`, and every other variable is
reached by scrolling with `↓` / `↑` (p. 55). Holding `↓` or `↑` auto-repeats the scroll (p. 55).

---

## Variables

Ordering below is the physical scroll order of the worksheet (p. 55).

| Display | Meaning | Key to reach | Type | Default | Valid range |
|---|---|---|---|---|---|
| `SL` | Straight-line method | `2ND` `DEPR` (worksheet entry) | Setting | **SL** (the default method) | — |
| `SYD` | Sum-of-the-years'-digits method | `2ND` `SET` | Setting | — | — |
| `DB` | Declining-balance method | `2ND` `SET` | Setting **and** Enter | `200` | positive number (percent of declining balance) |
| `DBX` | Declining-balance with crossover to SL | `2ND` `SET` | Setting **and** Enter | `200` | positive number (percent of declining balance) |
| `SLF` | French straight-line method | `2ND` `SET` | Setting/Enter | — | only selectable under European date **or** European separator format (p. 55, p. 57) |
| `DBF` | French declining-balance method | `2ND` `SET` | Setting/Enter | — | only selectable under European date **or** European separator format (p. 55, p. 57) |
| `LIF` | Life of the asset, in years | `↓` | Enter only | `1` | positive real if `SL`/`SLF`; positive **integer** if `SYD`/`DB`/`DBX`/`DBF` (p. 56) |
| `M01` | Starting month | `↓` | Enter only | `1` | `1 ≤ M01 < 13` (see Errors) |
| `DT1` | Starting date for the French straight-line method | `↓` | Enter only | — | appears only when `SLF` is the active method (p. 55, p. 57); date entry uses `dd.mmyy` under the European format (p. 9) |
| `CST` | Cost of the asset | `↓` | Enter only | `0` | `CST ≥ 0` |
| `SAL` | Salvage value of the asset | `↓` | Enter only | `0` | `SAL ≥ 0`, and `SAL ≤ CST` (see Errors) |
| `YR` | Year to compute | `↓` | Enter only | `1` | positive integer (p. 57) |
| `DEP` | Depreciation for the year | `↓` | Auto-compute | — | computed |
| `RBV` | Remaining book value at the end of the year | `↓` | Auto-compute | — | computed |
| `RDV` | Remaining depreciable value | `↓` | Auto-compute | — | computed |

Notes on the table:

- The guidebook classifies variables by how a value gets into them (p. 56). `DB` and `DBX` are dual-natured:
  selecting them is a *setting* action, but each also holds an *entered* percentage.
- Defaults listed above are the reset defaults from the table on p. 56: method `SL`, `DB` 200, `DBX` 200,
  `LIF` 1, `M01` 1, `YR` 1, `CST` 0, `SAL` 0.
- `DT1` is listed as a worksheet variable on p. 55 but is **not** given a reset default on p. 56.

---

## Behaviour

**Entering the worksheet.** `2ND` `DEPR` opens the worksheet and shows whichever depreciation method is
currently active (p. 57). Nothing is cleared by entering.

**Choosing a method.** Repeated `2ND` `SET` presses walk the method list and wrap (p. 55, p. 57). **The two
pages print the list in different orders** — see Edge cases:

- p. 55 (variable table, top-to-bottom): `SL → SYD → DB → DBX → SLF → DBF`
- p. 57 (step 3, inline): `SL → SLF → SYD → DB → DBX → DBF`

`SLF` and `DBF` only appear in the cycle once the calculator is in the European date format or the European
number-separator format; otherwise the list is the four non-French methods (p. 55 footnote, p. 57 note).

**Declining-balance percent.** Picking `DB` or `DBX` obliges you to either key a percent or take the
standing value of 200 (p. 57). The percent must be positive (p. 56). It is entered on the same display line
as the method name — the line is simultaneously a setting and a numeric entry field (p. 55).

**Life.** `LIF` takes a positive real for the straight-line methods and a positive integer for the
sum-of-years and declining-balance families (p. 56). A fractional life such as `31.5` is therefore legal
under `SL` and is used by the worked example.

**Starting month.** `M01` packs two facts into one number (p. 56):

- the whole part is the calendar month number in which the asset is placed in service, and
- the fractional part is how much of that first month elapses before depreciation starts.

So `1.5` means "starts halfway through January" and `4.25` means "starts a quarter of the way into April"
(p. 56).

**Automatic computation.** `DEP`, `RBV` and `RDV` are not computed on demand — they evaluate as soon as you
scroll onto them with `↓` (p. 56). The `*` annunciator on the display confirms that what you are looking at
was computed rather than keyed (p. 57).

**One year at a time.** Each pass computes a single year, and each result is rounded to the currently
selected decimal-place setting (p. 56). This is deliberate: the calculator normally keeps unrounded internal
values, but amortization and depreciation are the two documented exceptions where the internal value *is*
rounded (p. 9).

**Walking the schedule.** From `RDV`, one more `↓` wraps back round to `YR` (p. 57). Pressing `CPT` there
bumps `YR` up by one (p. 57). Scrolling `↓` three more times recomputes `DEP`, `RBV` and `RDV` for the new
year (pp. 57-58). Repeat until `RDV` reaches zero — that is the guidebook's stated end-of-schedule condition
(p. 57).

**Persistence.** The worksheet holds its values and its method selection until you overwrite them or clear
the worksheet, so a follow-up problem usually needs only the changed entries re-keyed (p. 57).

---

## Formulas

Transcribed **exactly as rendered** from the appendix page images (pp. 78-79). The text extraction of the PDF
contains none of these equations.

> Editorial convention: the appendix prints each method's *general* form as a bare stacked fraction with no
> `DEP =` label (only the "first year" / "last year" clauses are labelled). Where a `DEP =` prefix appears
> below on a general form it is **added for readability** and is not in the source. Parentheses, operators
> and signs are never added — see the `SYD` note.

### Shared definitions (p. 78)

```
RDV = CST - SAL - accumulated depreciation
```

> Values for `DEP`, `RDV`, `CST`, and `SAL` are rounded to the number of decimals you choose to be displayed (p. 78).

`RBV` is not given a formula anywhere in the appendix. Its behaviour is fixed by the worked example (p. 58):

```
RBV = CST - accumulated depreciation
```

(Verified: `1,000,000 − 25,132.28 = 974,867.72`, and `1,000,000 − 25,132.28 − 31,746.03 = 943,121.69`.)
Because `SAL = 0` in the only worked example, `RBV` and `RDV` coincide there and the example cannot
distinguish the two definitions on its own; the `RDV` definition above is the appendix's, the `RBV`
definition is inferred.

### Straight-line depreciation (p. 79)

```
DEP = (CST - SAL) / LIF

First year:          DEP = ((CST - SAL) / LIF) × FSTYR
Last year or more:   DEP = RDV
```

### Sum-of-the-years'-digits depreciation (p. 79)

Rendered literally, parenthesis-for-parenthesis. The page draws these as stacked fractions with no `DEP =`
label on the general form, so they are reproduced stacked here rather than linearised (a `/` linearisation
cannot represent the fraction bar without inventing the very parentheses that are at issue):

```
(LIF+2−YR−FSTYR)×(CST−SAL
─────────────────────────
    ((LIF×(LIF+1))÷2

                LIF×(CST−SAL)
First year:  ───────────────────  × FSTYR
              ((LIF×(LIF+1))÷2

Last year or more:  DEP = RDV
```

The parentheses in the printed source are **unbalanced** — the general form's numerator `(CST − SAL` is
missing its closing paren (2 opens, 1 close), and both denominators `((LIF × (LIF+1)) ÷ 2` carry a stray
opening paren (3 opens, 2 closes). The first-year numerator `LIF × (CST − SAL)` is balanced and has **no**
leading paren. Read as intended:

```
DEP        = (LIF + 2 - YR - FSTYR) × (CST - SAL) / (LIF × (LIF + 1) / 2)
First year = LIF × (CST - SAL) / (LIF × (LIF + 1) / 2) × FSTYR
```

Self-consistency check: substituting `YR = 1` and `FSTYR = 1` into the general form reproduces the first-year
form exactly, which supports the reading above.

### Declining-balance depreciation (p. 79)

```
DEP = (RBV × DB%) / (LIF × 100)

where:  RBV is for YR - 1

First year:  DEP = ((CST × DB%) / (LIF × 100)) × FSTYR

Unless;      (CST × DB%) / (LIF × 100) > RDV ;  then use  RDV × FSTYR

If DEP > RDV, use DEP = RDV

If computing last year, DEP = RDV
```

### `FSTYR`

`FSTYR` appears in every first-year formula but the appendix **never defines it** (pp. 78-79). From the `M01`
semantics on p. 56 and the arithmetic of the worked example on p. 58 it is the fraction of the first calendar
year during which the asset is in service:

```
FSTYR = (13 - M01) / 12
```

Verification against the p. 58 example: `M01 = 3.5` → `FSTYR = (13 − 3.5)/12 = 9.5/12 = 0.7916666…`, and
`(1,000,000 − 0)/31.5 × 0.7916666… = 25,132.2751…` → displays `25,132.28`, which is exactly the printed
result. Year 2 has no `FSTYR` factor: `1,000,000/31.5 = 31,746.0317…` → `31,746.03`, also matching. This
gives high confidence in the reconstruction, but it is a reconstruction and should be flagged as such.

### Sign conventions

Depreciation quantities are unsigned. `CST`, `SAL`, `DEP`, `RBV` and `RDV` are all entered and displayed as
non-negative magnitudes; the p. 58 example shows `DEP = 25,132.28*` with no minus sign. The declining-balance
percent must be entered positive (p. 56) — no negative-rate convention exists here. **This section carries no
cash-flow sign convention at all**, and therefore none of the sign-flip discrepancies that affect the TVM
appendix formulas apply.

### Methods with no published formula

The appendix supplies formulas only for `SL`, `SYD`, and `DB`. There is **no** printed formula for:

- `DBX` (declining balance with crossover to straight line),
- `SLF` (French straight-line),
- `DBF` (French declining balance).

`DBX` is described in prose only as declining balance "with crossover to `SL`" (p. 55). The crossover trigger,
and whether the switch happens once the SL charge on remaining book value would exceed the DB charge, is not
stated anywhere in pages 55-58 or in the appendix. `SLF`/`DBF` behaviour and the role of `DT1` are likewise
undocumented beyond the variable table.

---

## Key sequences

### Selecting a method (p. 57)

```
2ND  DEPR                → shows current method
2ND  CLR WORK            → (optional) clear the worksheet
2ND  SET  [2ND SET …]    → cycle until the wanted method appears.
                           p. 57 prints the list as SL / SLF / SYD / DB / DBX / DBF;
                           p. 55 orders it SL / SYD / DB / DBX / SLF / DBF. Order unresolved.
<value>  ENTER           → required for DB / DBX unless accepting 200
```

### Entering data (p. 57)

```
↓  <LIF>  ENTER
↓  <M01>  ENTER
↓  <DT1>  ENTER          → only present when SLF is the active method
↓  <CST>  ENTER
↓  <SAL>  ENTER
↓  <YR>   ENTER
```

### Computing results (p. 57)

```
↓        → DEP  (auto-computed, shows *)
↓        → RBV  (auto-computed, shows *)
↓        → RDV  (auto-computed, shows *)
```

### Generating the schedule (pp. 57-58)

```
↓        → wraps from RDV back to YR
CPT      → YR = YR + 1
↓        → DEP
↓        → RBV
↓        → RDV
```

Repeat until `RDV = 0`.

---

## Clearing/reset

**`2ND` `CLR WORK` (pressed while inside the Depreciation worksheet)** — clears `LIF`, `YR`, `CST` and `SAL`
back to their defaults (`1`, `1`, `0`, `0`). It explicitly does **not** touch the active depreciation method,
and does **not** touch any other calculator variable or format setting (p. 56). The p. 56 bullet lists exactly
four variables; `M01`, `DB`/`DBX` percent, and `DT1` are **not** named as cleared by `CLR WORK`, even though
`M01` and the DB percent do have documented reset defaults. See Edge cases.

**`2ND` `RESET` `ENTER`** — resets every calculator variable and format to default, the Depreciation worksheet
included (p. 56). Afterwards: method `SL`, `DB` 200, `DBX` 200, `LIF` 1, `M01` 1, `YR` 1, `CST` 0, `SAL` 0.

**`2ND` `QUIT`** — returns to standard-calculator mode. Pages 55-58 do not describe `QUIT` as clearing or
altering any Depreciation worksheet value; per the persistence statement on p. 57 the worksheet keeps its
contents until explicitly changed or cleared, so leaving and re-entering preserves everything.

**`2ND` `CLR TVM`** — a TVM-worksheet operation. It has no documented effect on Depreciation variables, and
pages 55-58 never mention it.

---

## Errors

| Error | Raised when |
|---|---|
| **Error 2 — Invalid argument** | A depreciation calculation is attempted where `SAL > CST` (p. 84). |
| **Error 4 — Out of range** | A value entered for one of the depreciation variables is out of range: declining-balance percent `≤ 0`; `LIF ≤ 0`; `YR ≤ 0`; `CST < 0`; `SAL < 0`; or `M01 < 1` or `M01 ≥ 13` (p. 84). |
| **Error 8 — Canceled iterative calculation** | `ON/OFF` is pressed to stop the evaluation of `DEP` or `RDV` (p. 85). |

Caveats on Error 4: the comparison operators in the depreciation bullet on p. 84 are drawn as vector glyphs
and are **absent from both the text layer and the rendered page image** — the page literally prints
"declining balance percent  0; **LIF**  0; **YR** _ 0; **CST** < 0; **SAL** < 0; ... **M01** 1  **M01**  13".
`CST < 0` and `SAL < 0` survive intact. The rest are reconstructed from the prose constraints on pp. 56-57
(DB percent must be positive, `LIF` must be positive, `YR` must be a positive integer, `M01` is a month number
so `1 ≤ M01 < 13`), which uniquely determine `≤ 0`, `≤ 0`, `≤ 0`, `< 1`, `≥ 13`. Treat the exact boundary
operators as high-confidence inference, not transcription.

Errors 1, 3, 5, 6 and 7 have no depreciation-specific trigger listed in the guidebook's error table
(pp. 84-85). Error 1 (overflow) remains reachable generically if a result exceeds the calculator range.

Note on the Error 8 key: p. 85 names `ON/OFF` as the key that stops the evaluation, for every worksheet
listed (TVM, Amortization, Cash Flow, Bond, Depreciation) — not `CE/C`. `CE/C` appears on p. 84 only in the
header note "To clear an error message, press `CE/C`", which is a different action (dismissing the error
after the fact, not canceling the calculation).

---

## Edge cases & ambiguities

1. **`CPT` vs `2ND` `SET` for incrementing `YR` — printed contradiction.** The prose on p. 57 says twice, in
   two separate places, that `CPT` increments `YR` by one. The worked example on p. 58 prints the "View second
   year" step as `↓` `2nd` `ENTER` (i.e. `2ND` `SET`) and shows `YR` moving `1.00 → 2.00◄`. Both the text layer
   and a magnified crop of the page image confirm the `2nd ENTER` glyphs, so this is not an extraction fault.
   The two readings cannot both be right: `2ND` `SET` is the setting-change key and `YR` is an enter-only
   variable, so the example's key column is almost certainly a typo for `CPT`. The resulting *value* is
   uncontested (`YR = 2.00`) either way. Golden tests cover both spellings.

2. **Method cycle order — printed contradiction.** The guidebook prints the six methods in two different
   orders. The p. 55 variable table lists them top-to-bottom as `SL`, `SYD`, `DB`, `DBX`, `SLF`, `DBF`; p. 57
   step 3 lists them inline as "(`SL`, `SLF`, `SYD`, `DB`, `DBX`, or `DBF`)". Neither page states that its
   order *is* the `2ND SET` cycle order — p. 55's is a variable reference table (which also interleaves the
   non-method variables `LIF`…`RDV`), and p. 57's is a parenthetical list of what you might want to display.
   So the actual cycle order is **not established** by pages 55-58, and no worked example cycles the method
   (the p. 58 example uses the `SL` default without pressing `2ND SET` at all). An implementation must pick
   one; the corpus does not test it, and no golden case can currently settle it.

3. **`FSTYR` is used but never defined** (pp. 78-79). Reconstruction `(13 − M01)/12` is verified to the cent
   against the only worked example, but a second example with a different `M01` would be needed to rule out
   alternatives.

4. **No formula for `DBX`, `SLF`, `DBF`.** The crossover rule for `DBX` and the entire French-method behaviour
   (including how `DT1` participates) are unspecified in this source. An implementation cannot achieve parity
   on these three methods from the guidebook alone.

5. **`RBV` has no published formula.** Inferred as `CST − accumulated depreciation`. Since the only worked
   example uses `SAL = 0`, `RBV` and `RDV` are numerically identical throughout it, so the example does not
   discriminate between `RBV = CST − accum` and `RBV = RDV`. A non-zero-salvage case is needed to settle it.

6. **`CLR WORK` scope is under-specified.** p. 56 names only `LIF`, `YR`, `CST`, `SAL`. Whether `M01` returns
   to 1 and whether the `DB`/`DBX` percent returns to 200 is not stated, despite both having reset defaults
   in the p. 56 table. `DT1` is not mentioned at all.

7. **Rounding is load-bearing.** Depreciation is one of only two worksheets whose *internal* values are
   rounded to the display setting (p. 9, p. 56). Accumulated depreciation therefore accumulates **rounded**
   yearly `DEP` figures, not exact ones. In the p. 58 example both interpretations happen to land on the same
   cent, so the example does not prove the accumulation order; the p. 9 and p. 78 rounding statements do.

8. **Schedule termination.** The guidebook's stated stop condition is `RDV = 0` (p. 57). With a fractional
   `M01` the schedule runs one calendar year longer than `LIF` (the first partial year plus a final partial
   year), which is why the `SL` and `SYD` formulas both carry a "last year or more: `DEP = RDV`" clause (p. 79).

9. **`DT1` visibility.** p. 57 conditions the `DT1` entry step on `SLF` being selected, while the variable
   table on p. 55 lists `DT1` unconditionally. Assume it is present only under `SLF`.

10. **Fractional `LIF` under `SYD`/`DB`.** The integer-only constraint (p. 56) is stated as a rule, but the
   error table's `LIF` bullet only covers `LIF ≤ 0` (p. 84). What the calculator does with a fractional `LIF`
   under `SYD` — reject, truncate, or accept — is not documented.

11. **All examples assume two decimal places** (p. 9). Every displayed value in the p. 58 example, and every
    golden test derived from it, is contingent on `DEC = 2`.
