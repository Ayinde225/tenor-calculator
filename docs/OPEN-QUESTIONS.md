# Open Questions and Known Discrepancies

> Every discrepancy and ambiguity found while extracting the guidebook into `docs/spec/*.md` and
> `tests/golden/*.json`. Each entry states **what is unclear**, **why it matters**, the **candidate
> resolutions**, and **how we resolve it** — naming either the golden test that settles it or the
> external check required.
>
> **This is a living document.** Entries move from `OPEN` to `SETTLED` as evidence arrives. An entry
> is never deleted — a settled question and its evidence are as valuable as an open one.

**Page-number convention.** All `p. N` citations are **PDF/extraction page numbers**. The printed
folio runs five lower (PDF p. 84 carries footer "79").

**Arbitration rule.** Where a printed formula and a worked example disagree, **the worked example is
normative** and the printed formula is recorded as a defect. This rule exists because the appendix
contains at least four confirmed defects and one of them inverts a sign.

## Status summary

**124 entries.**

| Class | Count | Meaning |
|---|---|---|
| **SETTLED — worked example wins** | 12 | A printed formula/table is demonstrably wrong. Resolution proven by a golden test. |
| **SETTLED — decision made / recovered** | 13 | Guidebook silent, ambiguous, or defective; we chose or recovered from another page, and recorded why. Revisit if hardware arbitrates. |
| **OPEN** | 99 | Not derivable from this source. Needs a physical BA II Plus, a clean PDF, or an orchestrator policy decision. |

The open count is large and that is the honest picture: the guidebook is a user manual, not a
specification, and it is silent on most edge cases. **Most open entries do not block Phase 1** — they
are edge conditions (fractional `P1`, `2ND SET` on `DEC`, `acosh` domain) that no worked example
reaches. The ones that *do* block are called out below.

**The five that most endanger parity**, in order:

1. **AMORT-1** + the amortization rounding rule — wrong by a cent on the guidebook's own first row.
2. **PMT-1** — a sign inversion in the printed formula.
3. **STAT-1** — an entire worksheet with no oracle anywhere in the source.
4. **ERR-4** — Error 7's trigger is unquantified, so iteration-limit parity is not derivable.
5. **DEPR-3/4/5** — `DBX`, `SLF`, `DBF` have no published formula; `FSTYR` is used but never defined.

---

# A. Confirmed defects — the printed source is wrong

These are **settled**. Each is a case where the guidebook contradicts itself and a worked example
arbitrates. They are listed first because implementing the printed form is a guaranteed parity
failure.

---

## PMT-1 — The printed `PMT` formula is missing its leading minus sign ⚠

**Status:** SETTLED — worked example wins. **Golden case:** `appendix-formulas-tvm-pmt-sign-convention`.

**What's unclear.** The appendix (p. 75) prints:

```
PMT = (i / G_i) × [ PV + (PV + FV) / ((1+i)^N - 1) ]      where i ≠ 0
```

Substituting the p. 39 mortgage — `N=360`, `I/Y=6.125`, `P/Y=C/Y=12`, `PV=120000`, `FV=0`, END —
this evaluates to **`+729.132647`**, displaying `729.13`. **The calculator displays `-729.13`.**

**Why it matters.** This is the single most-used formula in the entire product. Every loan payment,
every mortgage, every lease. An implementation transcribed faithfully from the appendix returns the
right magnitude with the wrong sign on every payment calculation — and the sign *is* the cash-flow
convention, so the error is semantic, not cosmetic.

**Candidate resolutions.**

| Candidate | Verdict |
|---|---|
| The formula is correct and TI uses a different convention for `PMT` | **Rejected.** The `i = 0` form printed *directly beneath it* — `PMT = -(PV+FV) ÷ N` — **does** carry its minus sign. The page is internally inconsistent with itself. |
| The formula is correct and the magnitude is also wrong | **Rejected.** `729.1326…` rounds to `729.13`, matching the display exactly. Only the sign is wrong. |
| **The leading minus was dropped in typesetting** | **Accepted.** |

**Resolution.** Normative form:

```
PMT = -(i / G_i) × [ PV + (PV + FV) / ((1+i)^N - 1) ]
```

**Correction to a widely repeated claim.** The project brief and several secondary sources state the
printed formula yields **`+729.14`**. That does not reproduce — the value is `729.1326…`, which rounds
to `729.13`. **The defect is the sign alone, not the magnitude.** Anyone auditing this should not go
looking for a `.14`.

**Engineering consequence.** Every TVM solver is derived from the fundamental balance equation
`0 = PV + PMT·G_i·[(1-(1+i)^-N)/i] + FV·(1+i)^-N` (p. 74, which **is** printed with correct signs)
rather than transcribed from p. 75, and validated against worked examples. The appendix is
corroboration, not source.

---

## PMT-2 — The printed `N` formula has `FV × 1` where it must be `FV × i`

**Status:** SETTLED — worked example wins.

**What's unclear.** p. 75 prints the `N` numerator as `ln((PMT × G_i - FV × 1) / (PMT × G_i + PV × i))`.

**Why it matters.** `× 1` erases the `i`-dependence of the `FV` term entirely, so the formula no longer
inverts the balance equation. Verified against the p. 39 deposit example (`P/Y=12`, `C/Y=4`, BGN,
`I/Y=0.5`, `FV=25000`, `PV=0`, `PMT=-203.129304`, true `N=120`): **as printed it returns `11576.35`**;
with `FV × i` it returns `120.000000`.

**Candidate resolutions.** This is the lowercase-L / digit-1 collision documented in **ERR-5b** — the
maths font on pp. 75-76 renders `1` with a serif indistinguishable from `l`, and `I` similarly. The
glyph is `i`, not the digit 1.

**Resolution.** Implement `FV × i`. Same font family as `k = l` (p. 75), `ln(l+i)` (p. 75), `(l+i)^N`
in `FV` (p. 75), and `l_m` / `bal(m − l)` throughout the amortization loop (p. 76) — every one of
which is resolvable from context, but **an implementer working from OCR rather than the page images
will get them wrong.**

---

## AMORT-1 — `ΣPrn` is off by one period ⚠

**Status:** SETTLED — worked example wins. **Golden cases:** `appendix-formulas-amort-year1-prn-offset`,
`-year2-prn`, `-year3-prn`, `amort-year1-principal`, `-year2-principal`, `-year3-principal`.

**What's unclear.** p. 76 prints `ΣPrn() = bal(pmt2) - bal(pmt1)`. This reproduces **none** of the
guidebook's own amortization results.

**Why it matters.** `ΣPrn` and `ΣInt` **cannot both be correct under any single meaning of `pmt1`**,
which is what proves the page is defective rather than merely using an unusual convention. Take the
p. 40 example, year 1: `P1=1`, `P2=9`, `PMT=-729.13`, `bal(0)=120000`, `bal(9)=118928.63`. The
calculator displays `PRN = -1,071.37` and `INT = -5,490.80`.

| Reading of `pmt1` | `ΣPrn` | `ΣInt` |
|---|---|---|
| `pmt1 = P1 = 1` | `bal(9) - bal(1) = -954.74` ✗ | `-5,490.80` ✓ |
| `pmt1 = P1 - 1 = 0` | `bal(9) - bal(0) = -1,071.37` ✓ | `(9-0+1) × -729.13 + 1071.37 = -6,219.93` ✗ |

Neither reading satisfies both. The printed pair is inconsistent.

**Resolution.** Move the offset **inside `ΣPrn`**, keep `pmt1 = P1`:

```
ΣPrn() = bal(pmt2) - bal(pmt1 - 1)      ← NORMATIVE
ΣInt() = (pmt2 - pmt1 + 1) × RND(PMT) - ΣPrn()   ← as printed, correct
```

Principal must be measured from the balance standing **before** payment `pmt1`, not after it.
Verified against all three years of the p. 40 example:

| Range | printed `ΣPrn` | corrected `ΣPrn` | guidebook `PRN` |
|---|---|---|---|
| 1-9 | -954.74 | **-1,071.37** | -1,071.37 ✓ |
| 10-21 | -1,384.93 | **-1,507.03** | -1,507.03 ✓ |
| 22-33 | -1,472.19 | **-1,601.98** | -1,601.98 ✓ |

`pmt1` is never explicitly defined on p. 76 — it is only related to `P1` through a closing note. The
normative reading is a **correction to the printed text**, not a transcription of it.

---

## CF-1 — The NPV discount exponent is `-S_{j-1}`, not `-S_j - 1` ⚠

**Status:** SETTLED — worked example wins. **Golden case:** `appendix-formulas-npv-discount-exponent`.

**What's unclear.** p. 76 renders the exponent as `-S_j-1` with `j` subscripted and `-1` at full
superscript size — i.e. literally `-(S_j) - 1`.

**Why it matters.** Read literally the p. 47-48 example (`CFo=-7000`; `C01=3000 F01=1`;
`C02=4000 F02=1`; `C03=5000 F03=4`; `I=20`) yields **`277.46`**. The guidebook states **`7,266.44`**.

**Two independent proofs** that the exponent indexes `S_{j-1}`:

1. **Arithmetic.** With `S_{j-1}` the terms are `2500.00 + 2777.78 + 8988.66` = `7266.4394718793` →
   displays `7,266.44` ✓. Under the literal reading the first term alone is `1736.11` and no total
   near `7,266.44` is reachable. Independently confirmed against the second worked example: the lease
   `NPV = -138,088.44` (p. 49) reproduces **only** under the corrected exponent.
2. **The appendix's own `where` clause** defines `S_j = 0` for `j = 0` — a case the summation `j=1..N`
   can **only ever reach** if the exponent indexes `S_{j-1}`. The printed form makes the guidebook's
   own definition dead code.

**Resolution.**

```
NPV = CF_0 + Σ(j=1..N) CF_j (1+i)^(-S_{j-1}) × [(1 - (1+i)^(-n_j)) / i]
where S_j = Σ(i=1..j) n_i for j ≥ 1, and S_0 = 0
```

Each group is discounted by the periods that **precede** it, then multiplied by an ordinary-annuity
factor over its own `n_j` periods. Group 1 is undiscounted. Same defect class as PMT-1 — a subscript
that lost its nesting in typesetting.

---

## OW-3 — The printed `EFF` formula has three separate defects

**Status:** SETTLED — worked example wins. **Golden case:** `appendix-formulas-eff-from-nom-plus-one`.

**What's unclear.** p. 80 prints `EFF = 100 × (eC/Y × In(x ÷ 1) − 1`. Three defects in one line:

| Defect | As printed | Correct |
|---|---|---|
| Flattened exponent | `eC/Y × ln(...)` | `e^(C/Y × ln(...))` |
| `+` rendered as `÷` | `ln(x ÷ 1)` | `ln(x + 1)` |
| Dropped closing paren | `(… − 1` | `(… − 1)`, so `100 ×` multiplies the whole bracket |

**Why it matters.** `ln(x ÷ 1)` is **mathematically inert** — it is just `ln(x)` — and produces
`EFF ≈ -100` for any ordinary rate.

**Resolution.** `EFF = 100 × (e^((C/Y) · ln(x+1)) - 1)`, `x = .01 × NOM ÷ C/Y`. Settled by the p. 67
example (`NOM=15`, `C/Y=4` → `EFF=15.87`): `ln(x+1)` gives `100 × (1.0375^4 - 1) = 15.865` → `15.87` ✓;
`ln(x ÷ 1)` gives `-99.9998` → **`-100.00`** at `DEC = 2` ✗. The `NOM` formula one line below prints
`(x + 1)` **correctly**, which proves the `÷` is a render artifact and not the source. Round-tripping
`EFF = 15.86504150390625` back through `NOM` with `C/Y = 4` returns `15.00`, confirming the pair are
exact inverses.

Also on the same page: the `where` clause prints `CY` for `C/Y` — another render artifact.

---

## OW-2 — `#PD` is an exponent, printed as a trailing factor

**Status:** SETTLED — worked example wins. **Golden case:** `appendix-formulas-pct-change-pd-is-exponent`.

**What's unclear.** p. 81 prints `NEW = OLD(1 + %CH/100)#PD` with `#PD` at full size on the baseline
immediately after the closing parenthesis, as though it were a multiplier.

**Why it matters.** A multiplicative reading makes the compound-interest use of this worksheet
impossible — and compound interest is one of the three jobs the worksheet exists to do.

**Resolution.** `NEW = OLD × (1 + %CH/100)^#PD`. Settled by the p. 65 compound-interest example
(`OLD=500`, `NEW=750`, `#PD=5` → `%CH=8.45`): as an exponent, `100 × ((750/500)^(1/5) - 1) = 8.447` →
`8.45` ✓; as a multiplier the answer would be `10.00` ✗.

---

## OW-1 — `#PD` clears to 1, not 0 — the printed default table is wrong

**Status:** SETTLED — worked example wins. **Golden case:** `other-worksheets-cost-sell-markup`.

**What's unclear.** The p. 63 reset table prints `#PD` default = **0**. The p. 64 prose says **twice**
to "leave `#PD` set to 1".

**Why it matters.** At `#PD = 0` the equation degenerates to `NEW = OLD` and `CPT %CH` is undefined.
Every percent-change and cost-sell-markup calculation — two of the worksheet's three jobs — silently
breaks.

**Resolution.** `#PD` clears to **1**. The cost-sell-markup example (pp. 65-66) presses
`2ND CLR WORK`, enters **only** `OLD=100` and `NEW=125`, and computes `%CH = 25.00` — a result
**unreachable** unless `#PD` is 1 after the clear. Worked example wins; the printed default table is
wrong.

---

## TVM-3 — p. 41 prose contradicts its own table by two transposed digits

**Status:** SETTLED — worked example (table) wins. **Golden case:** `amort-balloon-interest`.

**What's unclear.** The p. 41 worked table displays `INT = -27,920.72`; the bullet list immediately
below states interest of **`$27,790.72`**.

**Resolution.** The table is correct. Reconstructed independently: `60 × 545.55 = 32,733.00` paid;
`PRN = 82,000 - 77,187.72 = 4,812.28`; so `INT = 32,733.00 - 4,812.28 = 27,920.72` ✓. The prose has
transposed two digits.

---

## BOND-2 — The bond example's prose dates contradict its own keystrokes

**Status:** SETTLED — worked example wins. **Golden cases:** `bond-example-settlement-date-display`,
`-redemption-date-display`.

**What's unclear.** The p. 53 narrative describes a bond maturing **December 31, 2005** and settling
**June 12, 2004**. The printed keystrokes are `6.1206` and `12.3107`, and the printed displays read
`SDT = 6-12-2006` and `RDT = 12-31-2007`.

**Why it matters (and why it turns out not to).** The displayed values win. **Mitigating fact,
verified:** the two readings are exactly two years — four semiannual periods — apart, so **both** give
`N=4`, `A/E=0.9`, `DSC/E=0.1`, and therefore the identical `PRI = 98.56` / `AI = 3.15`. Only the
displayed date strings differ. The golden tests assert the strings produced by the keystrokes as
printed.

---

## DEPR-1 — `CPT` vs `2ND SET` for incrementing `YR`

**Status:** SETTLED — decision made. **Golden cases:** `depreciation-sl-increment-yr-via-cpt`,
`-increment-yr-as-printed-2nd-set` (both spellings covered).

**What's unclear.** p. 57 states **twice** that `CPT` increments `YR` by one. The p. 58 worked example
prints the "View second year" step as `↓` `2nd` `ENTER` — i.e. `2ND SET` — showing `YR 1.00 → 2.00`.

**Why it matters.** Confirmed in **both** the text layer and a 4× magnified crop of the page image, so
this is not an extraction fault. It is a genuine printed contradiction.

**Resolution.** `YR` is an **enter-only** variable and `2ND SET` is the **setting-change** key, so the
example's key column is almost certainly a typo for `CPT`. **The resulting value is `YR = 2.00` under
both readings**, so no golden *value* is in dispute. Both spellings are carried as separate golden
cases. Accept both key sequences.

---

## CF-13 / CF-14 — `F03 = 4.0` and missing thousands separators are typesetting slips

**Status:** SETTLED — decision made. **Golden cases:** `cash-flow-machine-enter-f02-grouped`,
`cash-flow-lease-c02`.

**What's unclear.** p. 47 prints `F03` as `4.0` — the only one-decimal display in a table that is
otherwise uniformly two-decimal under the `DEC=2` default. p. 49 prints `-5000.00 / -6000.00 /
-7000.00` without separators, while p. 47 prints `-7,000.00` for the same magnitude and p. 49's own
`NPV` prints `-138,088.44` **with** one.

**Resolution.** Both are typesetting slips. The machine formats display uniformly. Golden tests assert
`4.00` and the comma-grouped forms, with the slip flagged in each case's notes. The same applies to
p. 40's `PRN`, printed as `-1071.37` and `-1601.98` (no separator) while `-1,507.03` in the **same
column** has one — which is precisely what identifies the other two as slips rather than a rule
(**TVM-2**).

---

## CF-15 / CF-16 — The p. 49 lease diagram contradicts its own table

**Status:** SETTLED — keystrokes and displays win.

**What's unclear.** The p. 49 time-line diagram labels the groups `C02 $500`, `C04 $600`, `C06 $700`.
The payment schedule, the keystrokes and the displays all use **5000 / 6000 / 7000** — the diagram is
off by a **factor of ten**. The diagram also **drops the signs**, labelling the flows positive while
the keystrokes press `+/-` on each.

**Resolution.** Keystrokes and displays win. The entered stream is negative throughout, consistent
with lease payments as outflows and with the negative `NPV = -138,088.44`.

---

# B. Source defects — content missing from the PDF itself

These are **not** extraction artifacts. The gaps are present in the **rendered page images** too, so
reading the image does not recover them.

---

## ERR-2 — The PDF systematically drops `≤` and `≥` glyphs ⚠

**Status:** OPEN — needs hardware or a clean PDF. **Blocks:** every Error 4 range check.

**What's unclear.** Throughout the Error 4 row on p. 84, the comparison operator is simply **absent**.
The clauses render as "the `P/Y` or `C/Y` value ␣ 0", "the `RV`, `CPN`, or `PRI` value ␣ 0", and so on.

**Three independent lines of evidence that the missing glyphs are relational operators:**

1. `<` and `>` render **correctly** throughout the same table (`CST < 0`, `SAL < 0`, `P2 < P1`,
   `SAL > CST`, `x is not > 0`). **Only the two-stroke composite operators fail** — a font-mapping
   defect, not an omission in the original TI document.
2. In the `YR` clause the **bottom bar of the glyph survives as a stray underscore** (`YR _ 0`) —
   exactly the residue of a `≤` whose upper chevron failed to map.
3. Every gap sits in a slot **grammatically required** to hold a comparison.

**Affected clauses (all in Error 4):** TVM `P/Y`/`C/Y`; Bond `RV`/`CPN`/`PRI`; Depreciation
declining-balance percent, `LIF`, `YR`, and **both** `M01` bounds; Interest Conversion `C/Y`.

**Candidate resolutions and current readings.**

| Clause | Reading | Confidence |
|---|---|---|
| TVM `P/Y`, `C/Y` | `≤ 0` | **High** — both are divisors and exponent denominators; 0 must certainly be rejected. Negative handling unconfirmable. |
| ICONV `C/Y` | `≤ 0` | **High** — same reasoning. |
| Depreciation `DB%`, `LIF`, `YR` | `≤ 0` | **High** — the prose on pp. 56-57 independently requires each to be positive. |
| Depreciation `M01` | `M01 < 1` or `M01 ≥ 13` | **Medium** — see **ERR-2a**. |
| **Bond `RV`, `CPN`, `PRI`** | **`< 0`, not `≤ 0`** | **Medium** — see below. |

**The Bond clause probably differs from the others.** Internal evidence favours **`< 0`**: `CPN` and
`PRI` both **default to 0** (p. 51), so a `≤ 0` rule would make the worksheet's **own default state
illegal** and would forbid pricing a zero-coupon bond. This is the one clause where the obvious
reading is likely wrong.

**How we resolve it.** **Needs physical calculator check.** Enter each boundary value and observe.
Until then the readings above are implemented and flagged.

### ERR-2a — The `M01` bounds are the least recoverable clause

Error 4 renders as `or M01 [?] 1 [?] M01 [?] 13` — **three dropped operators in one clause**. This
appears to be two bounds fused together, but **even the clause structure** cannot be determined from
the page. Whether it is `M01 < 1 or M01 ≥ 13` or some other pairing is guesswork. **Must be resolved
against hardware before implementing the Depreciation Error 4 range check.**

---

## OW-10 — The 30/360 February rules exist only on a scanned insert

**Status:** OPEN — source defect, partially recovered.

**What's unclear.** p. 82's final `Note:` heading is followed by **blank space** in both the text layer
and the rendered page — a dropped vector graphic. The content sits on **p. 83**, a scanned page from a
different source document typeset in a different font.

**Why it matters.** Without p. 83, rules 1 and 2 — the two last-day-of-February cases — are
**unrecoverable**, and any 30/360 date spanning end-of-February would be wrong.

**Resolution (from p. 83), applied in order:**

1. If `DT2` is the last day of February **and** `DT1` is the last day of February, set `DT2` to 30.
2. If `DT1` is the last day of February, set `DT1` to 30.
3. If `DT2` is 31 and `DT1` is 30 or 31, set `DT2` to 30.
4. If `DT1` is 31, set `DT1` to 30.

**Rule ordering is inferred, not stated.** Rule 1 must precede rule 2 because **rule 1 tests the
unmodified `DT1`** before rule 2 rewrites it. Order between rules 3 and 4 is immaterial: the only way
rule 4 rewrites `DT1` is 31 → 30, and rule 3's test accepts 30 and 31 alike.

**No worked example exercises a February boundary.** Remains open. Note also that p. 83's insert cites
**Mayle 1993** while p. 82's footnote cites **Lynch and Mayle 1986** — the insert is from a later
edition of the same work.

---

## OW-5 — The dropped `Note:` graphic at the end of the 30/360 section

**Status:** OPEN — unrecoverable from this source.

p. 82's 30/360 section ends with a bare `Note:` heading and blank space. It plausibly carried a
February/month-end qualification to the day-clamping rule (which p. 83 supplies), but **what it
actually said is unrecoverable**. Flagged in case a cleaner PDF surfaces.

---

## ERR-5b — Lowercase-L / digit-1 / capital-I collisions throughout pp. 75-76

**Status:** SETTLED — resolvable from context, but a trap.

The maths font on pp. 75-76 renders `1` with a serif **indistinguishable from `l`**, and `I`
similarly. Confirmed instances:

| Printed | Means | Page |
|---|---|---|
| `k = l` | `k = 1` (beginning-of-period) | p. 75 |
| `ln(l+i)` | `ln(1+i)` | p. 75 |
| `(l+i)^N` in `FV` | `(1+i)^N` | p. 75 |
| `PMT × G_i − FV × 1` | `FV × i` — see **PMT-2** | p. 75 |
| `l_m`, `bal(m − l)` | `I_m`, `bal(m − 1)` | p. 76 |

Additionally the p. 76 `bal(m)` line has **unbalanced parentheses**: `bal(m) = bal(m − l − l_m +
RND(PMT)` — one `(` too many, no closing `)`. The only balanced reading consistent with the worked
example is `bal(m) = bal(m-1) - I_m + RND(PMT)`.

Every one is resolvable from context. **But an implementer working from OCR rather than the page
images will get them wrong** — which is why the specs cite image provenance explicitly.

---

## SRC-1 — Other confirmed render defects (catalogue)

**Status:** SETTLED — all recovered from images and cross-checks.

| Page | Printed | Correct | How settled |
|---|---|---|---|
| p. 74 | `FVx(1 + i)^-N` | `FV × (1+i)^-N` — the `x` is a multiplication sign in the italic maths font; **no variable `x` is in scope** | context |
| p. 77 | `CPN_100`, `YLD 100` | `CPN ÷ 100`, `YLD ÷ 100` | image shows division in both |
| p. 77 | `RV` gloss is **circular**: "redemption value … (RV except in those cases where call or put features must be considered)" | `RV = 100` except where call/put applies — the `= 100` is missing from the render | Lynch & Mayle 1986, cited in the p. 77 footnote |
| p. 79 (SYD) | `(LIF+2−YR−FSTYR)×(CST−SAL` / `((LIF×(LIF+1))÷2` | Both one `)` short / one stray `(` | balance; self-consistency check at `YR=1, FSTYR=1` reproduces the printed first-year form |
| p. 80 (stats) | `(Σx)2`, trailing `1/2` on the baseline | `(Σx)²`, `^(1/2)` — **without the ½ the quantity is a variance, contradicting the "standard deviation" heading** | heading |
| p. 80 (regression) | `n(Σx2) − Σx)2` | `n(Σx²) − (Σx)²` — flattened exponents **and a dropped `(`; as printed the denominator does not parse** | balance |
| p. 80 (`r`) | `r = b δx / δy` | `r = b·σx/σy` — **`δx`/`δy` are defined NOWHERE in the guidebook; `σx`/`σy` are defined immediately above on the same page** | rearranging `b = r·σy/σx` |
| p. 81 | `(Y1 − YB) Q 365` | `× 365` — **the `Q` appears in the IMAGE as well as the text layer**, so the image does not settle it | the parallel `Number of Days II` line on p. 82, whose image prints a proper `×` |
| p. 82 | `+ (DT2 − DT1` | closing paren dropped | balance |
| p. 61 (EXP/PWR) | `Y = a bx`, `Y = a Xb` | `Y = a·b^X`, `Y = a·X^b` — **lowered pseudo-subscripts that are actually exponents** (verified at 6× zoom) | **self-proving from the same page**: EXP fits on `(X, ln Y)` ⟹ `ln Y = ln a + X·ln b` ⟹ `Y = a·b^X`. A subscript reading is meaningless. |
| p. 87 (AOS table) | `x2`, `e2`, `Yx`, `%,(x` | `x²`, `eˣ`, `yˣ`, `%, √x` — the radical glyph maps to `(` | these are named calculator keys; unambiguous |
| p. 82 | `(Y − YB)/4` printed as a bare fraction | must be an **integer** leap-day count — see **OW-7** | a fractional day count is meaningless |
| p. 81-82 | `(Y − YB)/4` **dropped entirely from the text layer** | recoverable **only** from the image | — |

Minor source typos, no behavioural content: "diplay" and "number **or** decimal places" (p. 76);
"postive" (p. 14); "M0 apears" (p. 73); a truncated sentence on p. 34 ending mid-parenthesis
("…discounted back to the beginning of the first cash flow period (time"); the p. 9 `US` separator
sample printed as `1,000.00 ` with a trailing space inside the parentheses.

---

# C. Open questions — needs hardware

---

## ERR-1 — The calculator range contradicts the 13-digit precision claim

**Status:** OPEN — needs hardware. **Mitigated: does not block shipping.**

**What's unclear.** p. 84 prints the overflow limit as `±9.9999999999999E99`. Counted digit-by-digit
from the page image: a leading 9 plus **13 further nines = 14 significant digits**. p. 86 states
results are stored internally as **13-digit** numbers. A 13-digit mantissa's largest value is
`9.999999999999E99` (12 nines after the point). **The two pages cannot both be right.**

**Why it matters.** It decides the exact overflow boundary and, transitively, the internal mantissa
width.

**Candidate resolutions.** Either p. 84 has one nine too many, or p. 86 understates the width by one
digit. No worked example in the range exercises the boundary.

**How we resolve it.** **Mitigated rather than resolved.** The engine tests against **`1e100`**. Every
candidate mantissa — 13-digit `9.999999999999E99` and 14-digit `9.9999999999999E99` — is **strictly
below `1e100`**, so the boundary is correct under **either** reading and the ambiguity never has to be
settled to ship. A hardware probe at the boundary would close it properly.

---

## ERR-3 — Does `CE/C` clear pending operations?

**Status:** OPEN — needs hardware. **Decision made in the interim.**

**What's unclear.** p. 84 says only "To clear an error message, press `CE/C`". It does **not** say what
the display reverts to, nor whether dismissing an Error 3 also unwinds the pending-operation stack and
open parentheses.

**Why it matters.** Directly determines whether an Error 3 is recoverable. If `CE/C` leaves the stack
intact, the user is still at 8 pending operations and the next operator re-raises the error.

**[DECISION]** `CE/C` clears `pendingOps` and `parenLevels`. The alternative leaves Error 3
unrecoverable without `2ND QUIT`, which the guidebook never suggests. Needs confirmation.

---

## ERR-4 — Error 7 has no stated iteration ceiling or tolerance ⚠

**Status:** OPEN — **not derivable from this source at all.**

**What's unclear.** Error 7's trigger is described **only qualitatively**: "a very complex problem
involving many iterations" (p. 85), "many iterations" (TVM `I/Y`), "very complex problem" (Bond
`YLD`). **No maximum iteration count and no convergence tolerance is published anywhere in the
guidebook.**

**Why it matters.** **Exact parity on *which inputs* raise Error 7 is therefore not derivable from
the guidebook.** Two implementations can both be "correct" and disagree about whether a given hard
problem errors or converges. This is a structural limit of the documentation, not an oversight in the
extraction.

**How we resolve it.** **Empirical calibration against hardware.** Our current caps (TVM: 100 Newton /
400 bisection, tol `1e-12`; IRR: 200 per bracket; Bond `YLD`: 200, tol `1e-13`) are chosen to be
*correct* first and *plausibly TI-like* second. They will converge on every documented example. The
open risk is only at the margins.

---

## ERR-5 — The `1 ÷ 3 × 3` display depends on `DEC`, which the guidebook does not state

**Status:** OPEN — needs an orchestrator decision or hardware.

**What's unclear.** p. 86 says `1 ÷ 3 × 3 =` displays as **`1`**. At the default `DEC = 2` a real unit
would show `1.00`. The bare `1` implies a floating-decimal context, but the guidebook never says so.

**Why it matters.** This is a live problem in the corpus. `errors-accuracy-aos-round-one-div-three-times-three`
asserts `display: "1"` with empty `setup {}`, which **contradicts the corpus-wide convention** that
computed results are `DEC`-formatted — it will not match a `DEC=2` runner.

**It was deliberately NOT auto-fixed.** At `DEC = 2` the example **demonstrates nothing about guard
digits**, because ordinary 2-decimal rounding yields `1.00` whether the internal value is
`0.9999999999999` or exactly `1.0`. Inventing `decimals: 2` would make the case *look* correct while
**destroying its entire discriminating purpose**.

**Candidate resolutions.**

| Candidate | Consequence |
|---|---|
| Pin `decimals: 9` (floating) | Case discriminates properly; but the `DEC` value is invented |
| Pin `decimals: 2`, expect `1.00` | Case passes but tests nothing |
| Drop the display assertion; rely on the two `INTERNAL` cases | Loses the display half of the claim |

**How we resolve it.** Needs a decision. **The load-bearing claim — internal `0.9999999999999`, display
rounds to one — holds at any `DEC`** and is already pinned by
`errors-accuracy-aos-internal-step1-one-div-three` and `-internal-step2-times-three`. Do **not** treat
the absence of `.00` as evidence about `DEC`.

---

## ERR-6 — Is the rounding decision always at the 11th digit, or at `(shown+1)`?

**Status:** OPEN — needs hardware. **Decision made in the interim.**

p. 86 states the rounding rule against the **11th** significant digit specifically, because 10 is the
maximum display width. At `DEC < 8` fewer digits show. **[DECISION]** Generalise to the `(d+1)`-th
digit, where `d` is the width the current format would show — the only reading under which `DEC` does
anything. The guidebook documents only the 10-digit case.

---

## ERR-7 — Error 1 vs Error 5 precedence on internal division by zero

**Status:** OPEN — needs hardware.

Error 1 covers division by zero "including internally"; Error 5 covers unsolvable TVM/Cash Flow
setups. **A degenerate TVM solve could plausibly hit either, and the guidebook gives no precedence
rule.** Our Error 5 pre-check (structural sign test **before** iterating) means Error 5 wins in
practice for the documented case — which is at least self-consistent.

---

## ERR-8 — Error 2's `y^x` rule admits reciprocals of integers

**Status:** OPEN — needs hardware.

`y < 0` is permitted when `x` is an integer **or `1/n` for integer `n`** — so both odd **and even**
roots of negatives are *attempted* rather than rejected up front. **What actually happens for
`y < 0, x = 1/2` (undefined in the reals) is not stated**; presumably it falls through to a different
error. The guidebook's own `Y^X` prose (p. 14) says the reciprocal of an **even** number is complex,
which suggests these should be rejected — but Error 2's condition as printed does not reject them.

---

## STAT-1 — The Statistics worksheet has NO parity oracle anywhere in the guidebook ⚠

**Status:** OPEN — **needs hardware or an independent oracle. Blocks the entire worksheet.**

**What's unclear.** Nothing is unclear about the *procedure*. What is missing is any **worked example
at all**.

**Why it matters.** `tests/golden/statistics.json` has `cases: []`. **This is correct, not an
extraction gap** — and that distinction is important enough to have been verified two independent
ways:

1. **No `Example:` heading falls anywhere within PDF pp. 59-62.** The guidebook has **no separate
   worked-example chapter**; each worksheet chapter carries its own `Example:` subsections inline, and
   **Statistics is the only worksheet chapter that has none.** Its table-of-contents entry lists
   exactly four subsections — Statistics Worksheet Variables, Regression Models, Entering Statistical
   Data, Computing Statistical Results.
2. **No example elsewhere in the guidebook drives the Statistics worksheet.**

**How we resolve it.** **The implementation must be validated against the appendix formulas (p. 80) or
real hardware, not against the guidebook.** Fabricating expected display strings would corrupt the
very ground truth the corpus exists to establish, so none were invented. Every Statistics row in
`TRACEABILITY.md` is `Blocked`.

---

## STAT-2 — How do frequencies enter the 1-V formulas?

**Status:** OPEN — needs hardware. **Decision made in the interim.**

**What's unclear.** p. 60 says `Ynn` is the **number of occurrences**. The appendix formulas (p. 80)
are written in bare `Σx`, `Σx²` and `n` **with no weight term**.

**Why it matters.** The guidebook **never states** that `n = Σ(Ynn)` or that `ΣX = Σ(Ynn · Xnn)` —
though **both are required for the frequency feature to mean anything at all**. Without weighting,
`Ynn` does nothing in 1-V mode.

**[DECISION]** Implement frequency-weighted. Flagged as undocumented.

---

## STAT-3 — Are non-integer, zero, or negative frequencies valid?

**Status:** OPEN — needs hardware.

No range and no error is printed for `Ynn` in 1-V mode. **Contrast the Cash Flow worksheet**, whose
`Fnn` is explicitly bounded 0.5-9,999 with Error 4 (p. 84) — **no analogous bound exists for `Ynn`.**

---

## STAT-4 to STAT-9 — Remaining Statistics gaps

| ID | Question | Status |
|---|---|---|
| **STAT-4** | Which error fires when `↓`/`↑` scrolls into the results portion with **no data entered**? p. 60 confirms an error appears but **does not name it**. Error 1 via `n=0` division is likely. | OPEN |
| **STAT-5** | `Ynn` defaults to 1 **in 2-V mode too** — p. 60 states the default without restricting it to 1-V, so keying an X in 2-V and scrolling past Y **silently contributes a Y of 1**. Is that real? | OPEN |
| **STAT-6** | **When is a model restriction enforced** — at data entry or at result access? p. 61 states the restrictions; p. 84 states the `LN` rule; **the guidebook never joins them.** Enforcement at result access is far likelier (the method can be changed *after* entry), but this is inference. | OPEN |
| **STAT-7** | `X'`/`Y'` when the model is **degenerate** (e.g. computing `X'` from `Y'` at `b = 0`). Not addressed. | OPEN |
| **STAT-8** | Behaviour at the **50-point capacity limit**: no error documented for a 51st point, and `2ND INS` on a full list is unstated. | OPEN |
| **STAT-9** | `2ND CLR WORK` in the STAT portion "clears all values except X and Y" — **but every result except `X'`/`Y'` auto-recomputes from X and Y on scroll.** With the data retained, scrolling immediately repopulates them. **The observable effects are only: method → `LIN`, and `X'`/`Y'` cleared.** The guidebook's own statements are in tension. | OPEN |

**Settled Statistics note (not a question):** whether `r` uses population or sample deviations is
**numerically immaterial** — the two weightings differ by a constant `√(n/(n-1))` that **cancels in
the ratio `σx/σy`**. Either choice reproduces the same `r`.

---

## DEPR-5 — `FSTYR` is used by every method and defined nowhere ⚠

**Status:** OPEN — needs a second worked example or hardware. **Reconstruction verified against the
only example.** **Golden case:** `appendix-formulas-depreciation-fstyr`.

**What's unclear.** All three published depreciation methods (p. 79) scale the first year by `FSTYR`.
**The term appears nowhere else in the guidebook** — not in the p. 79 `where` clause, not in the
Depreciation worksheet chapter.

**Why it matters.** Every first-year depreciation figure depends on it.

**Reconstruction.** Back-solved from the p. 58 straight-line example (`LIF=31.5`, `M01=3.5`,
`CST=1,000,000`, `SAL=0`, `YR=1` → `DEP=25,132.28`): since `(CST-SAL)/LIF = 31,746.03`,
`FSTYR = 25,132.28 / 31,746.03 = 0.791667 = 9.5/12`. That is **`(13 - M01)/12`** — the fraction of the
first year remaining from `M01`, with `M01`'s fractional part encoding the day within the month.

Verified to the cent: `(13 − 3.5)/12 = 0.7916666…`, and `1,000,000/31.5 × 0.7916666… = 25,132.2751…`
→ `25,132.28` ✓. Year 2 has no `FSTYR` factor: `1,000,000/31.5 = 31,746.03` ✓.

**How we resolve it.** **A single example cannot distinguish `(13 - M01)/12` from other formulations
agreeing at `M01 = 3.5`** (e.g. anything keyed off month-days rather than twelfths). **Needs a
hardware check at a second `M01` value.**

---

## DEPR-3 — `DBX`'s crossover trigger is never specified ⚠

**Status:** OPEN — **parity unreachable from this source.**

`DBX` is described in prose **only** as declining balance "with crossover to `SL` method" (p. 55). The
appendix (pp. 78-79) publishes formulas for `SL`, `SYD` and `DB` — **and nothing else.**

**Unanswered:** Is the crossover triggered when the SL charge on remaining book value over remaining
life would exceed the DB charge? Does it **latch permanently** once crossed? Nothing in pp. 55-58 or
the appendix says. **Needs hardware.**

---

## DEPR-4 — `SLF` / `DBF` behaviour and `DT1`'s role are undocumented ⚠

**Status:** OPEN — **parity unreachable from this source.**

The French methods have **no published formula**. `SLF` additionally exposes `DT1`, a starting date
entered `dd.mmyy`, whose participation in the calculation is never described. Does `DT1` **supersede**
`M01` under `SLF`, or combine with it? **Needs hardware.**

Related: **DEPR-11** — `DT1` visibility is inconsistent. The p. 55 variable table lists `DT1`
**unconditionally**; p. 57 conditions it on `SLF` being selected. The p. 55 footnote marker on `DT1`
also **points at the wrong footnote** (it carries `**`, the variable-type footnote, where `*`, the
European-format footnote, is clearly intended). Assume `DT1` is present only under `SLF`.

---

## DEPR-2 — The method cycle order is printed two different ways, and neither claims to be the cycle

**Status:** OPEN — **not established by the source; untestable from the corpus.**

**What's unclear.**

- p. 55 (variable table, top-to-bottom): `SL → SYD → DB → DBX → SLF → DBF`
- p. 57 (step 3, inline): `SL → SLF → SYD → DB → DBX → DBF`

**Why it matters, and why it matters less than it looks.** **Neither page claims its order *is* the
`2ND SET` cycle order** — p. 55's is a variable reference table (which also interleaves the non-method
variables `LIF`…`RDV`), and p. 57's is a parenthetical list of what you might want to display. **And
no worked example cycles the method at all** — the p. 58 example uses the `SL` default without
pressing `2ND SET` once.

**How we resolve it.** An implementation must pick one. **The corpus does not test it and no golden
case can currently settle it.** Needs hardware.

---

## DEPR-11 — Are yearly depreciation charges accumulated rounded or exact? ⚠

**Status:** OPEN — needs hardware. **Behaviour pinned by test; parity unproven.**

**What's unclear.** Depreciation rounds its results to the displayed decimal places (pp. 9, 56, 78).
That rule fixes how each year's `DEP` is reported, but it does not say what the *running total*
behind `RBV` accumulates: the already-rounded yearly charges, or the exact ones with rounding
applied only on output.

**Why it matters.** The two readings drift apart by a cent and stay apart. For the guidebook's own
building (`SL`, `LIF=31.5`, `M01=3.5`, `CST=1,000,000`, `SAL=0`) they first disagree at **year 7**:

| Reading | Year 7 `RBV` |
|---|---|
| accumulate **rounded** charges | **784,391.54** |
| accumulate **exact** charges | 784,391.53 |

**Why the guidebook cannot settle it.** Its only worked example (p. 58) stops at **year 2**, where the
two readings differ by `943,121.6900` vs `943,121.6931` — a difference the mandatory round-to-display
erases before it can be observed. The example is therefore blind to the very distinction it looks
like it would settle. Every year from 1 to 6 is likewise blind.

**Candidate resolutions.** Accumulating rounded charges is the more natural reading of "depreciation
results are rounded", and is what the engine does. Accumulating exact charges and rounding on output
is what most software would do by default, and is what amortization's sibling rule would suggest if
read loosely — though amortization explicitly re-rounds its running balance each period (p. 76),
which is weak evidence for the rounded reading here too.

**How we resolve it.** A single hardware probe: enter the p. 58 building, step to `YR = 7`, read
`RBV`. `784,391.54` confirms the current reading; `784,391.53` inverts it.

**Mitigation.** `depreciation.test.ts` asserts `784,391.54` at year 7 with a comment stating plainly
that this pins current behaviour rather than proving parity. An audit initially named the year-2
assertion *"accumulates ROUNDED yearly charges, not exact ones"* — a claim that test could not
support, since both readings pass it. Renamed, and a genuinely discriminating year-7 case added.

---

## DEPR-6 to DEPR-10 — Remaining Depreciation gaps

| ID | Question | Status |
|---|---|---|
| **DEPR-6** | **Fractional `LIF` under `SYD`/`DB`/`DBX`/`DBF`.** p. 56 states a positive-**integer** requirement, but the Error 4 list only covers `LIF ≤ 0`. Reject, truncate, or accept? | OPEN |
| **DEPR-7** | Is `SAL > CST` rejected **at entry** (Error 4) or only **at compute** (Error 2)? p. 84 lists it under Error 2 as "a **calculation** included SAL > CST", implying entry is permitted and the error surfaces on compute. | OPEN — reading is high-confidence |
| **DEPR-8** | **`RBV` has no published formula.** Inferred `RBV = CST - accumulated depreciation`. **The only worked example uses `SAL = 0`, so `RBV` and `RDV` are numerically identical throughout it and it cannot discriminate** `RBV = CST - accum` from `RBV = RDV`. **Needs a non-zero-salvage example.** | OPEN |
| **DEPR-9** | **Where in the computation does the rounding land?** For declining balance the year-`n` charge is a function of `RBV` at `YR-1`, so **if `RBV` is rounded before reuse the errors compound across the schedule; if not, they do not.** The p. 58 second-year `RBV` of `943,121.69` is consistent with **both** readings at `DEC=2`. **[DECISION]** Round before reuse, by symmetry with amortization's `bal(m-1)`. | OPEN |
| **DEPR-10** | **`CLR WORK` scope.** p. 56 names **exactly four** variables (`LIF`, `YR`, `CST`, `SAL`). `M01` and the `DB`/`DBX` percent **both have reset defaults in the same table** but are **not** named as cleared. `DT1` is not mentioned at all. | OPEN |
| **DEPR-12** | Does the schedule terminate at `RDV = 0` by clamping `DEP` to `RDV` in the final year, and with a fractional `M01` does it therefore span `ceil(LIF) + 1` calendar years? | OPEN — implied by the "last year or more" clause |

**Settled Depreciation note:** the p. 58 example cannot arbitrate the **rounding accumulation order** —
accumulating rounded `DEP` (`25,132.28 + 31,746.03 = 56,878.31` → `RBV 943,121.69`) and accumulating
unrounded (`56,878.3068` → `943,121.6931` → `943,121.69`) **land on the same cent**. The rounding rule
rests on the p. 9 / p. 78 prose alone.

---

## AMORT-2 — `npmt` is undefined

**Status:** OPEN — needs hardware. **Decision made.**

p. 76 opens with `If computing bal(), pmt2 = npmt`. **`npmt` appears nowhere else in the guidebook.**
**[DECISION]** Read as: when a bare balance is requested rather than a range, the loop's upper limit is
the payment number at which the balance is wanted. **The exact binding of `npmt` to a user-visible
variable is unstated.** No worked example in range exercises a reading other than `pmt2 = P2`.

---

## AMORT-3 to AMORT-4 — `P1`/`P2` fractional entry; non-integer `N`

| ID | Question | Status |
|---|---|---|
| **AMORT-3** | `P1`/`P2` are documented as 1-9,999 **integers**, but what happens to a fractional entry (`1.5 ENTER`)? Truncate, round, or Error 4? Unspecified. | OPEN |
| **AMORT-4** | **`N` need not be an integer** — nothing restricts it and `CPT N` routinely returns fractional periods. But `P1`/`P2` **are** integers, so **amortizing a non-integer-`N` loan is unspecified at the tail.** | OPEN |

---

## CF-2 to CF-11 — Cash Flow gaps

| ID | Question | Why it matters | Status |
|---|---|---|---|
| **CF-2** | What does `2ND INS` do on a **full 24-slot list**? p. 44 says renumbering is capped at 24 but not whether the 24th flow is **silently discarded** or the insert is **refused**. | Data loss either way | OPEN |
| **CF-3** | **`Fnn`: "occurrences" (p. 43) vs "0.5-9,999" (p. 84).** p. 43 reads as a positive integer; the error table implies a fractional **0.5 is accepted** and, by omission, that **0 is rejected**. What a non-integral frequency **means** in the NPV summation — where `n_j` is an exponent, so it is at least arithmetically defined — is **never explained**. Truncated, rounded, or used as-is? | **[DECISION]** Match the printed bound (reject `<0.5` and `>9,999` with Error 4) and use `n_j` as-is | OPEN |
| **CF-4** | **What does NPV compute at `i = 0`?** The annuity factor `(1-(1+i)^(-n_j))/i` is `0/0`. **The guidebook gives no zero-rate variant — unlike every TVM formula, which ships one.** The limit is `n_j`, giving the plain undiscounted sum `CF_0 + Σ CF_j·n_j`. **`I = 0` is the DEFAULT, so `NPV ↓ CPT` immediately after a reset hits this path.** | Reachable in ~3 keystrokes from reset | OPEN |
| **CF-5** | Does `2ND CLR WORK` in the `NPV` view also reset `I`? p. 42 names **only `NPV`**. Each of the three reset bullets names exactly the variables of its own view, so the conservative reading is **`I` is not cleared**. | Unverified | OPEN |
| **CF-6** | Is the stored `IRR` **invalidated when a cash flow is edited**? p. 45 says opening `IRR` shows the value "based on the current cash-flow values", but nothing says an edit zeroes it. **Observed: `IRR` reads `0.00` after `NPV` is computed, so computing NPV does not populate IRR.** | Stale-result display | OPEN |
| **CF-7** | **Which root does "closest to zero" select?** p. 46 does not say closest in **absolute value**, whether **negative roots** are candidates, or what the iteration **seeds** from. No worked example exercises it. **Reproducing TI's exact choice on multi-sign-change streams is not possible from this documentation alone.** | **[DECISION]** smallest `\|i\|`, dedupe at `1e-9` | OPEN |
| **CF-8** | What does `2ND DEL` do while standing on **`CFo`**? Deletion is described only for `Cnn`, and `CFo` is structurally required — presumably the `DEL` indicator simply does not light. | Not stated | OPEN |
| **CF-9** | Does a **zero flow count as a sign change** for IRR? The lease example holds `CFo=0, C01=0, C03=0, C05=0` alongside negative flows and is treated as an ordinary NPV problem, implying zeros are neutral — **but the lease never invokes IRR**, so this is inference. | IRR Error 5 boundary | OPEN |
| **CF-10** | The IRR appendix line **`i = I/Y ÷ 100` names the wrong variable.** `I/Y` is the **TVM** worksheet's rate; the Cash Flow worksheet's rate is `I` (p. 42). Read as `i = I ÷ 100` here. The line also sits after the IRR block with **no equivalent in the NPV block**, so its scope over the whole section is **inferred**. | Naming, not behaviour | SETTLED — read as `I ÷ 100` |
| **CF-11** | **Which Cash Flow computation takes a logarithm?** Error 5's "LN input is not > 0" clause is listed **jointly** for TVM/Cash Flow/Bond (p. 84) **without identifying the CF-specific trigger.** Likely internal to the IRR iteration. | Unstated | OPEN |
| **CF-12** | Does `QUIT` preserve the cash-flow stream? pp. 42-49 never describe it as destructive, and the worksheet model is that entered values persist. **Inferred, not stated in this page range.** | OPEN |
| **CF-17** | **The `◄` "entered" marker does not track what was actually keyed, and no rule reconciles the data.** It appears on displays no keystroke ever wrote (`F01=1.00◄`, `F03=1.00◄` on p. 47 — only `↓` was pressed; `C01/C03/C05 = 0.00◄` on p. 49 — stepped past, never keyed). It is **absent** from `CFo=0.00` on first display, from `I=0.00`, and from `C03=0.00` immediately after `2ND DEL`. "Marks entered values" fails on `F01`/`C01`; "marks enter-only variables" fails on `CFo` and `I`; "marks a slot holding a live value" fails on the p. 49 sequence. **Treated as unspecified — cosmetic, and outside the assertion surface.** | No golden test asserts it | OPEN |
| **CF-18** | The pp. 48-49 lease example poses **two** questions ("What is the present value?" and "What even payment amount at the beginning of each month would result in the same present value?") but **the page range answers only the first.** The follow-up is never worked; p. 50 moves on to Bond. | Missing content | OPEN |

---

## BOND-1 — The printed `PRI` → `YLD` navigation is unreachable as written

**Status:** OPEN — **do not implement a wrap-around on the strength of it.**

**What's unclear.** p. 53, *Computing the Bond Yield*, step 3 reads "Press `↓` to display **YLD**". But
`YLD` is **position 7** and `PRI` is **position 8** in the p. 50 variable order — so `↓` from `PRI`
lands on **`AI`**, not `YLD`. Wrapping the full nine-position list from `PRI` back to `YLD` would take
**eight** presses, not one.

**Why it matters.** The parallel `PRI` computation (`YLD` → `↓` → `PRI`) walks **forward** and is
self-consistent. Only the yield path is broken. **An earlier draft of `bond.md` rationalised this into
a fabricated "wraps around the list" mechanism — an implementer could have coded it.** That has been
corrected.

**Candidate resolutions.** The printed `↓` is **almost certainly a typo for `↑`** — but the guidebook
never says so. Alternatively the step list silently assumes the user has not yet walked past `YLD`.

**How we resolve it.** **No golden case asserts this path**, precisely because the guidebook does not
pin down what is displayed. Needs hardware.

---

## BOND-3 / BOND-4 and remaining Bond gaps

| ID | Question | Status |
|---|---|---|
| **BOND-3** | `ACT`/`360` and `2/Y`/`1/Y` are **two toggles, not four fields.** The p. 50 variable table lists each state on its **own row with its own Key column**, which misleads into modelling four variables; the defaults table on the **same page** collapses them to two. | SETTLED — two toggles |
| **BOND-4** | **What if `RDT` does not fall on a coupon date?** p. 51 states the assumption but **never specifies the consequence**. Coupon dates are back-counted from `RDT` regardless, so an off-cycle `RDT` would **silently shift the whole coupon schedule** rather than erroring. | OPEN |
| **BOND-5** | **Does Bond round its internals to the displayed decimals?** p. 78 explicitly says `DEP`/`RDV`/`CST`/`SAL` are rounded **for Depreciation** — **no equivalent statement exists for Bond.** **[DECISION]** Assume full internal precision, round only at display. | OPEN |
| **BOND-6** | Is `CPT` on `AI` a no-op, an error, or undefined? `AI` is auto-compute and the guidebook never addresses pressing `CPT` on it. | OPEN |
| **BOND-7** | Does `PRI` have a documented **upper** bound, or is Error 4 purely a lower-bound-at-zero check? Only the relation to 0 is mentioned. | OPEN |
| **BOND-8** | **Rounding mode at the display boundary is not discriminated by the example.** `PRI = 98.56275` displays as `98.56` under **both** round-half-even and truncation. A tie-breaking case would be needed. | OPEN |
| **BOND-9** | **Two-digit year pivot never stated.** Dates keyed `mm.ddyy`; window 1980-2079; `06` → 2006; default `90` → 1990. Implies `80`-`99` → 19xx and `00`-`79` → 20xx, but **inferred, not documented.** Same as **FMT-5**. | OPEN |
| **BOND-10** | The p. 52 Yield-to-Maturity **glossary** asserts interest compounded **semiannually**, yet the worksheet supports `1/Y` (annual, `M=1`). **The glossary text is loose; the formulas govern.** | SETTLED — formulas govern |
| **BOND-11** | **Bond `N` rounds UP, always** — `2.4 → 3` (p. 78). This is a **ceiling**, not round-half-up (`2.1 → 3` too). The single example rounds the same way under either rule, so the wording is the only evidence — but it is unambiguous. | SETTLED — ceiling |

---

## MEM-5 — `2ND K`: the constant-arming key order is printed two contradictory ways ⚠

**Status:** SETTLED — **both accepted.** **Golden cases:** 7 cases tagged `DISPUTED KEY ORDER`.

**What's unclear.** p. 18 prints **two mutually incompatible grammars** for the same feature, roughly
two inches apart:

| Source on p. 18 | Order | Literal keys |
|---|---|---|
| Worked example, "Multiply 3, 7, and 45 by 8" | `2ND K` **after** the operand | `3 × 8` │ `2ND K =` → `24.00` |
| "Keystrokes for Constant Calculations" table (**all 7 rows**) | `2ND K` **before** the operand | `n × 2ND K c =` |

**Why it matters.** This is the sharpest conflict in the range and is **load-bearing for any
constant-calculation parser**. It is a printed **self-contradiction**, not an omission.

**The evidence pins each side firmly.** The example's own row labels make its order unambiguous: `× 8`
is captioned "Enter the operation and a constant value", and `2ND K =` is captioned "Store the
operation and value, and then calculate" — so `8` is keyed **before** `2ND K`. The template rows are
equally unambiguous in the rendered image: `2nd [K]` is typeset **between** the operator and the
italic `c`. The intro prose ("enter a number and an operation, and then press `2nd [K]`") names only
**two** items before `K`, siding with the table **2-to-1**.

**Resolution.** **Neither order is authoritative, because both are printed.** The golden corpus carries
**both families**, every case tagged `DISPUTED KEY ORDER`. **A parity implementation must accept
`2ND K` on either side of the constant operand to pass the corpus.**

---

## MEM-1 to MEM-8 — Memory, constants, and Last Answer gaps

| ID | Question | Status |
|---|---|---|
| **MEM-1** | **`2ND MEM 2ND CLR WORK` leaves you inside the Memory worksheet.** p. 16 presents it as a plain "clear all memories" action, but the first half is a **worksheet entry** — the sequence silently leaves the calculator inside the Memory worksheet displaying `M0=`. p. 16 **never says** a following `2ND QUIT` is needed. The Memory chapter (p. 73) gives the equivalent clear as a bare `2ND CLR WORK` from inside, implying the post-state. | OPEN — reading is high-confidence |
| **MEM-2** | **Exactly which keys preserve an armed constant?** p. 18 says only "a key other than a number or `=`" — **it does not say** whether the decimal point, `+/-`, backspace, `2ND` itself, `STO`, or `RCL` count as "a number". **Under the strict reading `STO` would discard the constant, making "store the running result and continue" impossible — and no example tests it.** | OPEN |
| **MEM-3** | **Two memory-arithmetic mechanisms with OPPOSITE display behaviour.** Standard mode (p. 16): `STO OP n`, and the display **explicitly does not change**. Memory worksheet (p. 73): `OP value ENTER` while parked on a register, and the example table shows the **display updating** to the new register value (`M4= 160.00` after adding 65 to 95). **Both are correct for their context, but they cannot share a naive code path — and pp. 16-17 never mention the second form exists.** | SETTLED — implement both |
| **MEM-4** | **What is `ANS` after a reset?** p. 10 lists what reset clears (display, all 10 memories, unfinished calculations, all worksheet data) — **`ANS` is not named.** Defaulting it to `0` is an assumption. | OPEN |
| **MEM-6** | **Precision on recall.** Internal storage is 13 digits but the display shows at most 10. **Confirm `RCL` recalls the full internal value** rather than the displayed rounding — implied by p. 9 but **not stated for the memory path.** | OPEN — reading is high-confidence |
| **MEM-7** | **Does the constant register survive power-off?** Constant Memory is documented as preserving stored values (p. 16) and worksheet data (p. 19) — **the constant register is neither.** **[DECISION]** Treat as transient: a constant is armed **invisibly with no indicator** (see MEM-9), and silently resurrecting one across a power cycle is the worse failure. | OPEN |
| **MEM-8** | **Entry echoes are NOT formatted to `DEC`**, contradicting p. 9's statement that all examples assume two decimals. The constants example (p. 18) prints `3` and `8` for keyed entries but `24.00`/`56.00`/`360.00` for results; the Last Answer example (p. 19) prints `2.00` after `2 Y^X`. **Reconciliation: formatting is triggered by the OPERATOR keypress, not by the digit entry. The guidebook never states this rule — it exists only as an inference across two tables.** | SETTLED — inferred rule; golden cases pin both sides |
| **MEM-9** | **Is there any display indicator for an armed constant?** The indicator tables on pp. 7-8 list **no `K` indicator**, so a constant appears to be **armed invisibly with no way to check its state.** | OPEN |
| **MEM-10** | Does `STO` or `RCL` update `ANS`? p. 19 lists exactly three triggers (`ENTER`, `CPT`, `=`) plus automatic computation — **neither `STO` nor `RCL` is among them**, so the answer should be no. But `RCL` **visibly changes the display**, and the guidebook never states the negative case. | OPEN |
| **MEM-11** | **Does scrolling onto an automatic-compute variable overwrite `ANS`?** p. 19 says `ANS` changes whenever the calculator "calculates a value automatically", and p. 22 defines automatic-compute variables as computing **on scroll**. **Read together, merely pressing `↓` in the Amortization worksheet clobbers `ANS`** — a real trap, never called out as a consequence. | OPEN |
| **MEM-12** | **Can `STO`/`RCL` be used mid-constant-calculation** without discarding the constant? No example exercises it, and the strict reading of MEM-2 says no. | OPEN |
| **MEM-13** | When `RCL` supplies a value to an **enter-only worksheet variable** (permitted by p. 21), **is `ENTER` still required** to commit it? The general enter-only rule says yes, but p. 21 does not spell it out for the `RCL` path. | OPEN |
| **MEM-14** | Does memory arithmetic **inside the Memory worksheet** share the pending-operation stack with standard mode, and can it therefore raise Error 3? Not stated. Standard-mode `STO OP n` explicitly **cannot** (p. 16). | OPEN |
| **MEM-15** | What does a **bare arithmetic key press followed immediately by `ENTER`** (no operand) do in the Memory worksheet? | OPEN |
| **MEM-16** | Do the two-state format settings **cycle in a defined order** under repeated `2ND SET`? p. 9 documents `2ND SET` only as "change the setting" — unambiguous for a binary toggle, but never stated. | OPEN |

---

## MATH-1 — Factorial and zero: two pages directly contradict

**Status:** OPEN — needs hardware. **Decision made.** **Golden case:** `clearing-and-math-ops-factorial-5`
(notes record the conflict).

**What's unclear.** p. 14 requires the operand to be a **positive integer ≤ 69** — which **excludes 0**.
The Error 2 row (p. 84, verified in the rendered image) fires when `x` is **"not an integer 0-69"** —
which **explicitly admits 0**. **Both cannot hold.**

**Why it matters.** `0! = 1` mathematically, and the error table is the more precise of the two
statements. **No worked example arbitrates.**

**[DECISION]** Accept `0 2ND X!` → `1.00`. The error table is more precise **and** matches
mathematics. Needs hardware confirmation.

---

## MATH-2 — The random-seed example contradicts the seed rule

**Status:** OPEN — needs hardware. **Golden case:** `clearing-and-math-ops-store-seed` (marked **NOT
EXECUTABLE** as a parity assertion).

**What's unclear.** p. 14 requires the seed to be **an integer greater than zero**, keyed before
`STO 2ND RAND`. The p. 13 example table keys `STO 2ND RAND` with the display sitting at **`0.86`** —
the random number just generated by the row above — and shows `0.86` as the result.

**`0.86` is greater than zero but is NOT an integer**, so it fails the rule on exactly one count.

**Candidate resolutions.** Either the table is **reusing the prior row's display for layout economy**,
or **non-integer seeds are silently accepted/truncated**. The golden case records the printed sequence
and marks it not executable. Needs hardware.

---

## MATH-3 — `INV` and `HYP` omit the `2ND` prefix

**Status:** SETTLED — printed sequences reproduced verbatim. **Sub-question OPEN.**

**What's unclear.** The guidebook prints `11.54 2nd [SIN]` for sine but `.2 [INV] [SIN]` for arcsine
and `.5 2nd [HYP] [SIN]` for sinh — i.e. **`[SIN]` is reached with no `2nd`** once `INV` or `HYP` has
been pressed.

**Why it matters.** Read literally, **`INV` and `HYP` are themselves second-level-selecting prefixes**
— consistent with p. 7, which describes `INV` and `HYP` as **indicators** meaning "press a key to
select its inverse trigonometric / hyperbolic function". **This conflicts with a canonical
"emit `2ND` before every secondary function" rule.**

**Resolution.** The golden file **reproduces the printed sequences verbatim rather than normalising
them**. **OPEN sub-question:** is `2ND INV SIN` **also** accepted as an alias? The guidebook only ever
prints `INV`/`HYP` without a following `2nd`, so whether the `2nd` is **optional, forbidden, or a
no-op** after `INV`/`HYP` is unspecified. **[DECISION]** accept it as a tolerant alias; assert only the
printed form.

---

## MATH-4 to MATH-8 — Remaining standard-math gaps

| ID | Question | Status |
|---|---|---|
| **MATH-4** | **`nCr`/`nPr` domain is under-specified and carries NO error code.** "Both `n` and `r` must be greater than 0" (p. 14) **excludes `r = 0`** even though `nC0 = nP0 = 1`. **Nothing covers** non-integer operands, `r > n` (which would need the factorial of a negative), or **`n > 69`** — where a literal evaluation of the printed `n!/((n-r)!×r!)` **breaches the factorial limit and would raise Error 2**, even though e.g. `70 nCr 68` is a small number the calculator plausibly handles. **No error code is assigned to any of these violations.** | OPEN |
| **MATH-5** | **Are `acosh(x<1)` and `atanh(\|x\|≥1)` Error 2 or Error 1?** The p. 84 table lists **no hyperbolic domain conditions at all.** | OPEN |
| **MATH-6** | **Scientific-notation entry is gated on a NON-DEFAULT mode.** p. 15 states `Y^X` enters an exponent **only "With AOS selected"** — but **CHN is the default**. Under CHN, `3 × 10 Y^X 3` evaluates left-to-right as `(3×10)^3 = 27,000` rather than `3×10^3 = 3,000`. **The guidebook prints no display for this example, so no golden case is derivable without inventing a result — it is omitted rather than guessed.** | OPEN |
| **MATH-7** | **Is the random seed cleared by `2ND CLR WORK`, `2ND QUIT`, or a memory clear?** The p. 11 clearing table lists **no target that covers it**; only a full RESET can be assumed to discard it. | OPEN |
| **MATH-8** | **What does `2ND ROUND` do** when pressed on a **freshly keyed number** rather than a computed result, when `DEC = 9`, or when the format is floating? **Every example applies it to a completed result at `DEC = 2`.** | OPEN |
| **MATH-9** | **Does `%` have defined behaviour outside the four printed contexts** — standalone, immediately after `Y^X`, or inside parentheses? The AOS hierarchy (p. 87) ranks `%` at the **highest** priority, implying it is a valid unary postfix, **but no example shows it.** | OPEN |
| **MATH-10** | **If `2ND RESET` is pressed while an error is live** (skipping the required `CE/C`), is the reset **silently refused** or does the `RST ?` prompt simply **never appear**? p. 11 states the requirement but not the failure mode. | OPEN |
| **MATH-11** | Is the **mid-entry display format** (`1,234.` — thousands separator, bare trailing decimal point, unpadded to `DEC`) **uniform across all entry contexts**, or specific to entry with a pending operation? | OPEN |

**Settled standard-math notes (not questions):**

- **`Y^X`'s "positive" precondition is self-contradictory prose.** p. 14 says `Y^X` raises the
  displayed "**postive**" [sic] number to any power, but its own **immediately following note**
  explains the rules for raising a **negative** number, and Error 2 (p. 84) confirms negative bases are
  legal when `x` is an integer or the inverse of an integer. **"Positive" is wrong as a stated
  precondition; the Error 2 condition governs.**
- **`x²` is filed in the wrong table.** `6.3 X^2 → 39.69` (p. 13) is printed inside the table headed
  "These operations require you to press `=` to complete", yet **the row's own Press column contains
  no `=`** and the result is shown immediately. **The worked example wins: `X^2` is immediate.**
  (`nCr`/`nPr` in the same table genuinely **do** require `=`.)
- **The percent add-on row straddles a page break.** The terminating `=` for `498 + 7 % = 532.86` is
  **not on p. 12** with the rest of its row — it sits alone in an orphaned continuation row at the top
  of p. 13. **Text-only extraction misattributes it to the percent-discount row below.**
- **The discount example does not prove the rounding claim.** `69.99 - 10 %` displays `7.00`
  (internally `6.999`). **Both `69.99-6.999 = 62.991` and `69.99-7.00 = 62.99` display as `62.99`**, so
  this example **cannot discriminate** rounded-vs-internal arithmetic. **The ROUND diagram
  (`783.6498340833 → 783.6500000000`) is the only real evidence and it carries no keystrokes.**
- **`nPr`'s formula is orphaned from its prose.** The equation is printed at the **top of p. 15 above
  the *Rounding* heading**, while the prose introducing it is at the **foot of p. 14**. A reader working
  page-by-page finds `nPr` prose with no equation and an unlabelled equation opening the next page.
- **`%` has no printed formula at all.** Its context-sensitive behaviour is **only inferable from the
  four worked examples**, which are mutually consistent. The spec's percent formulas are marked
  **reconstructed inference, not transcription**.

---

## FMT-1 — `↑↑↑` cannot reach the number separators

**Status:** OPEN — needs hardware. **`↓↓↓` is authoritative.** **Golden case:**
`overview-display-formats-nav-dec-to-separators` (encodes **only** the `↓` path).

**What's unclear.** p. 9 states the number-separator format is reached from `DEC` by **`↑ ↑ ↑` *or*
`↓ ↓ ↓`**. Verified against the rendered image (zoomed 3× to confirm the arrow glyphs and press
counts).

**Why it matters.** **Only the `↓` path is arithmetically possible.** With the five formats ordered
`DEC(1), angle(2), date(3), separator(4), method(5)` — an order the guidebook **itself fixes** via its
own "press `↓` to reach angle units" example — `↓↓↓` correctly lands on 4. But `↑↑↑` **cannot**:

- if the list **wraps**, `↑↑` lands on 4 and `↑↑↑` **overshoots to 3** (dates);
- if the list **does not wrap** at the top, `↑↑↑` **never leaves `DEC`**.

The `↑` figure appears to be a **symmetric copy-edit** of the `↓` figure.

**Why it matters beyond navigation.** **It makes the wrap question unresolvable from this page.**
`↓`-direction navigation is safe; **`↑`-direction and wrap behaviour need a hardware check or another
page before being encoded.** Only the `↓` path is in the golden tests.

---

## FMT-2 to FMT-6 — Format gaps

| ID | Question | Status |
|---|---|---|
| **FMT-2** | **Chn/AOS results are given as bare integers in prose.** p. 10 writes "the Chn answer is **20**" and "the AOS answer is **11**" as **arithmetic, not display captures**. At the `DEC=2` default that every example assumes (p. 9), the readout is `20.00` / `11.00`. The parallel math-operations table on p. 12 confirms the convention (`6 + 4 =` → `10.00`, image-verified). **Golden tests record the two-decimal form with the substitution flagged.** | SETTLED |
| **FMT-3** | **What does `2ND SET` do when `DEC` is displayed?** `DEC` is numeric and takes a keyed value + `ENTER`; the other four formats take `2ND SET`. **Behaviour on `DEC` is unstated — plausibly a no-op.** | OPEN |
| **FMT-4** | **Does the `Eur` separator setting change the ENTRY radix key, or only display rendering?** p. 9 defines `Eur` rendering (`1.000,00`) but **says nothing about entry**. Related and sharper: **how does an `Eur` radix comma interact with the `mm.ddyy` date convention, which uses a period as its field separator?** | OPEN |
| **FMT-5** | **What is the century rule expanding `yy` → `yyyy`?** **Not stated in range.** The Date worksheet's Jan 1 1980 - Dec 31 2079 range (p. 84) **implies** a 1980-2079 window, **but that is inference from an error bound, not a statement.** **[DECISION]** `80`-`99` → 19xx, `00`-`79` → 20xx. | OPEN |
| **FMT-6** | **What happens to a fractional `DEC` entry** (e.g. `2.5 ENTER`)? The appendix ties Error 4 to "the `DEC` value is outside the range 0-9" — **which a fractional value does not violate.** Truncate, round, or Error 4? | OPEN |
| **FMT-7** | **Exact display strings for FORMAT-worksheet states are largely unprinted.** p. 9 says only that "the `DEC` indicator appears with the selected number of decimal places" — **it never shows the literal readout** (`DEC=2`? `DEC 2.00`?). The three navigation golden cases assert the **setting labels from the p. 9 table rather than captured readouts**, and are marked **derived**. | OPEN |
| **FMT-8** | **What display results from `2ND CLR WORK` with a format shown?** The reset-to-defaults behaviour is stated (p. 10) but **no resulting display string is given**, so no golden case asserts one. | OPEN |

**Settled format notes:** **`DEC = 9` is floating decimal, not nine fixed places** — the format table
prints the range as "0-9 (Press 9 for floating-decimal)". **A naive 0-9 fixed-places implementation is
wrong at the top of its range.** And **`2ND CLR WORK` is context-sensitive**: p. 11's clearing table
describes it generically as resetting "the prompted worksheet", but p. 10 states that **with any single
format displayed it resets ALL five** — **a per-variable `CLR WORK` implementation would be wrong
here.** Finally, the **date grammar splits**: p. 9's table describes `mm-dd-yyyy` (four-digit year,
hyphens) while p. 10's entry convention is `mm.ddyy` (two-digit year, period) — **different grammars
for the same setting**; the appendix confirms the entry grammar is enforced (`MM.DDYYYY` raises
Error 6), so **the p. 9 form is display-only**.

---

## TVM-1 to TVM-5 — TVM gaps

| ID | Question | Status |
|---|---|---|
| **TVM-1** | **Does `2ND CLR TVM` also reset the END/BGN setting?** p. 25 lists only `N`, `I/Y`, `PV`, `PMT`, `FV`, and p. 26 gives END/BGN **its own separate reset** (`2ND BGN 2ND CLR WORK`) — which **strongly implies `CLR TVM` leaves it alone**. But this is **inferred from the reset table's structure rather than stated.** | OPEN |
| **TVM-2** | **Is the thousands separator suppressed for `PRN` specifically, or is p. 40 mis-typeset?** **Two of three `PRN` values lack the separator while the third has it**, and every other value in the section carries one. Almost certainly typesetting — **but worth a hardware check since golden tests assert the exact string.** | OPEN — reading is high-confidence |
| **TVM-4** | **What is the exact iteration/convergence tolerance for `CPT I/Y`, and where is the Error 7 boundary?** See **ERR-4**. Our golden test for `I/Y` (`5.50`) passes with a bisection solver, but **the calculator's actual solver and its Error 7 threshold are unspecified.** | OPEN |
| **TVM-5** | **Does `If computing bal(), pmt2 = npmt` describe a distinct single-payment BAL entry point** separate from the `P1`/`P2` range, or is it **just naming the loop bound**? The line is cryptic and **no worked example exercises a reading other than `pmt2 = P2`.** See **AMORT-2**. | OPEN |

**Settled TVM notes:** the p. 76 **symbol collision** — the NPV `where` clause defines
`S_j = Σ(i=1..j) n_i`, using **`i` as a summation index while `i` is simultaneously the interest rate
in the formula directly above**. The two are unrelated; **an implementer reading only the `where`
clause could bind the wrong one.**

---

## OW-4 to OW-9 — Other-worksheet gaps

| ID | Question | Status |
|---|---|---|
| **OW-4** | **Is the Interest Conversion `C/Y` shared storage with the TVM `C/Y`?** Both default to 1 and **the guidebook never states the relationship.** **[DECISION]** Treat as **SEPARATE**, since `2ND CLR WORK` in ICONV is **explicitly defined to leave `C/Y` untouched** — which only makes sense for a variable the worksheet owns. Needs hardware confirmation. | OPEN |
| **OW-6** | **What happens when `DT1` is later than `DT2`?** p. 68 states `DT1` is "assumed" earlier but **never says whether the calculator rejects the input or returns a signed negative `DBD`.** **Both printed formulas are signed subtractions.** | OPEN |
| **OW-7** | **The `(Y − YB)/4` leap-day term is printed as a bare fraction with no floor/truncation notation** — yet a fractional day count is **meaningless**. Since **both** `Number of Days I` and `II` carry the same term and `DBD` is their **difference**, **truncation cancels EXCEPT across a leap-day boundary — where it decides the answer.** **[DECISION]** Read as a floor. **The only DBD example (p. 69, Sept 4 → Nov 1 2003) is within one year, so the leap term cancels and it does not test this at all.** | OPEN |
| **OW-8** | **What is the concrete value of `YB`, the actual/actual base year?** p. 82 defines it **only descriptively** as "first year after leap year" and **never prints a number.** `MB` = January and `DB` = 1 are given — **but `DB` is then never used in either equation.** Any year `≡ 1 (mod 4)` in the 1980-2079 range works, since **that range contains no century non-leap exception.** | OPEN — mitigated |
| **OW-9** | **Under the `360` method, does `CPT` on `DT1`/`DT2` raise an error or silently do nothing?** p. 69 only says you "can compute `DBD` … **but not** `DT1` or `DT2`". | OPEN |
| **OW-11** | **Is `#PD` constrained to integers?** **No valid range is printed.** The formula admits fractional exponents and the Error 2 conditions imply fractional values are permitted when the base is positive. | OPEN |
| **OW-12** | **Are the other-worksheet variable lists cyclic on `↓` past the last variable?** The examples only ever demonstrate `↑` to backtrack, **never `↓`-wrapping.** | OPEN |
| **OW-13** | `%CH = -100` makes `1 + %CH/100 = 0`; solving `OLD` then divides by zero (Error 1) and solving `#PD` takes `ln(0)` (Error 2). **The guidebook does not call this out.** Likewise `MAR = 100` is a **pole** in the `SEL` solution and `MAR > 100` implies negative cost — **neither is discussed.** And `P = VC` is Breakeven's degenerate case: **no quantity satisfies a nonzero `FC`, and every quantity satisfies `FC = 0`** — not discussed. | OPEN |
| **OW-14** | The p. 72 Breakeven example **opens on `FC=` "Current value"**, so the worksheet is **not auto-cleared on entry** — **but the example nevertheless depends on `PFT` being 0.** If a prior session left `PFT` nonzero, the sequence yields a different `Q`. **The guidebook is silent; a faithful implementation should reproduce whatever `PFT` holds.** | OPEN |

**Settled other-worksheet notes:** the **Profit Margin formula uses the names `Cost` and
`SellingPrice` with no `where:` block**, whereas the worksheet table uses `CST`/`SEL`/`MAR` — **the
mapping is inferred, not printed.** And **`DB = base day (1)` is defined in the p. 82 where-block but
appears in neither printed Days-between-Dates equation.**

---

# D. Process and documentation issues

---

## DOC-1 — `overview-display-formats.md` states the page offset as "six lower"; it is five

**Status:** OPEN — trivial, but it is a spec defect and the specs are the contract.

`docs/spec/overview-display-formats.md` states: "The printed footer on those pages runs **six** lower:
PDF p. 6 carries the footer '1', PDF p. 11 carries the footer '6'."

**Its own examples show five** (6−1 = 5; 11−6 = 5). Every sibling spec — `clearing-and-math-ops.md`
("PDF page minus 5"), `memory-and-last-answer.md` ("five lower"), `statistics.md` ("5 lower") — says
**five**. `overview-display-formats.md` is the outlier and its prose contradicts its own worked
examples.

**Resolution.** The offset is **five**. Fix the prose in that spec. No behaviour depends on it, but a
spec that miscounts its own citation offset undermines confidence in every citation it makes.

---

## KEY-1 — Physical `2ND` key pairings are not asserted anywhere

**Status:** OPEN — needs a keyboard photo or hardware. **Does not block the engine.**

**What's unclear.** The specs record second-function **names** and key **sequences**, not **which
primary key each second function is printed above**. The guidebook's p. 20 worksheet-keys table names
the sequences (`2ND AMORT`, `2ND P/Y`, …) but the extraction did not capture the keyboard layout
figure's key-cap assignments.

**Why it matters — and why it doesn't, yet.** **The engine is layout-independent**: it consumes key
*tokens*. This matters only for the **Phase 4 UI**, when key-cap art is drawn and the second-function
labels must sit above the right keys. Resolve before UI work, not before engine work.

---

## TOK-1 — Canonical token for the backspace/delete key

**Status:** SETTLED — `BKSP`. Cross-section agreement needed if new specs are added.

The key is drawn only as a right-arrow glyph (`→`). `clearing-and-math-ops.md` adopts **`BKSP`** and
the golden corpus follows. Recorded so a future section does not invent `DEL` (which is taken —
`2ND DEL` deletes cash flows and statistical data points) or `←`.

---

## TOK-2 — Arithmetic key tokens are `×` and `÷`, never ASCII `*` and `/`

**Status:** SETTLED — corpus-wide. **This has already bitten once.**

The guidebook prints boxed `×` and `÷` glyphs. An earlier draft of
`overview-display-formats.json` tokenized multiply as ASCII `*` in both p. 10 Chn/AOS cases, against
17 uses of `×`/`÷` in 5 of 6 sibling files. **`errors-accuracy-aos.json` duplicated those exact two
cases using `×` and its notes said "dedupe at merge" — the divergent token would have silently
defeated dedupe.** Fixed; the token-convention line in that spec now carries an explicit warning.

Note the guidebook is **itself inconsistent in prose**: p. 10's Chn line reads `3 + 2 = 5, 5 * 4 = 20`
(comma, ASCII asterisk) while its AOS line reads `2 × 4 = 8; 3 + 8 = 11` (semicolon, multiplication
sign). **The pressed key is `×` in both examples**; only the narration differs.

---

## DEDUPE-1 — `appendix-formulas.json` cases originate outside its own `sourcePages`

**Status:** OPEN — needs an orchestrator policy decision.

**What's unclear.** Pages 74-83 contain **zero worked examples** — the appendix is pure formula
reference. All 30 cases in `appendix-formulas.json` are therefore **cross-referenced from worked
examples elsewhere** (pp. 39, 40, 48, 54, 58, 65, 66, 67, 69, 71, 72), each chosen because it
**arbitrates a specific defect** in the pp. 74-83 formulas. `guidebookPage` in each case records the
**real source page**, not a page in the declared range.

**Why it matters.** These cases **overlap** with the TVM / cash-flow / bond / depreciation /
other-worksheets sections. Ids are namespaced `appendix-formulas-*` to avoid collision, and the
duplicate pairs are cross-referenced in notes — but **if the harness requires cases to originate
within their file's declared `sourcePages`, this file needs a policy decision.**

**Precedent.** The same problem in `errors-accuracy-aos.json` was resolved by **deletion**: its two
p. 10 CHN/AOS cases were out of range **and had wrong expected values** (`20`/`11` with empty `setup`
instead of `20.00`/`11.00` at `decimals: 2`), and `overview-display-formats.json` — which legitimately
owns pp. 6-11 — already held correct versions. **That file is now 3 cases, all in range.**
`appendix-formulas.json` is different: its cases are the **arbiters** and deleting them would lose the
defect documentation. **Recommend keeping them and relaxing the harness rule.**
