# Cash Flow Worksheet

> Source: official BA II Plus guidebook, pages 42-49. Behaviour described in original wording.

**Page-numbering note.** All citations in this document use **PDF page numbers** (the range assigned for
this section is 42-49). The guidebook's own printed footer runs 5 lower — PDF p. 42 carries the footer
"37 Cash Flow Worksheet". Two supporting pages outside the range are cited where the material lives
there and nowhere else: the appendix formulas (p. 76-77) and the error table (p. 84-85).

The Cash Flow worksheet handles a stream of cash flows whose amounts differ from period to period, over
periods of equal length. When every cash flow is the same, the TVM worksheet is the right tool instead
(p. 42).

---

## Variables

| Name | Display label | Default | Type | Valid range / notes |
|---|---|---|---|---|
| Initial cash flow | `CFo` | `0` | Entered (enter-only) | Any value inside the calculator's numeric range. Always a known, entered quantity — every cash-flow problem begins with it (p. 43). |
| Amount of *n*th cash flow | `C01`…`C24` (`Cnn`) | `0` | Entered (enter-only) | Up to 24 flows beyond `CFo`; each may hold its own value (p. 42). Positive = inflow (money received), negative = outflow (money paid) (p. 42). |
| Frequency of *n*th cash flow | `F01`…`F24` (`Fnn`) | `1` | Entered (enter-only) | Number of consecutive occurrences of `Cnn`, stated as up to 9,999 (p. 43). The error table gives the accepted interval as **0.5-9,999**; outside it raises Error 4 (p. 84). Default of `1` is not printed as a default anywhere but is demonstrated twice: `F01` and `F03` both read `1.00` in the p. 47 example with nothing keyed into them. |
| Discount rate | `I` | `0` | Entered (enter-only) | Rate **per cash-flow period**, expressed in percent. Separate from the TVM worksheet's `I/Y`. |
| Net present value | `NPV` | `0` | Computed (compute-only) | Total present value of the whole stream, inflows and outflows together. A positive result marks the investment as profitable (p. 45). |
| Internal rate of return | `IRR` | `0` | Computed (compute-only) | The rate that drives net present value to zero (p. 45). Reported in percent. |

`nn` stands for the cash-flow number (`C01`-`C24`) or the frequency number (`F01`-`F24`) (p. 42).

**No `N` variable.** The number of flows in the stream is implied by how many `Cnn` slots hold entries;
there is no count variable to set.

---

## Behaviour

### Entering the worksheet

`CF` opens the worksheet and lands directly on `CFo` (p. 42, p. 43). Unlike the Bond worksheet, no
`2ND` prefix is involved — `CF` is a primary key.

### Navigation

`↓` and `↑` walk the variable list. The list is ordered `CFo`, `C01`, `F01`, `C02`, `F02`, … — amount and
frequency alternate, so stepping from a `Cnn` reaches its own `Fnn`, and stepping again reaches the next
`C(nn+1)` (p. 43-44). `↑` reverses that walk; the p. 47 editing example relies on this, using a single `↑`
from `F03` to get back to `C03` and two more to reach `C02`.

### Entering a value

Key digits, then `ENTER` commits the value to the displayed variable (p. 43). To make a flow an outflow,
key the magnitude and press `+/-` (p. 42) — the guidebook's own examples press `+/-` **before** `ENTER`
(`7000 +/- ENTER`, p. 47).

The documented entry loop (p. 43-44):

1. `CF` — `CFo` appears.
2. Key `CFo`, press `ENTER`.
3. `↓` — `C01` appears.
4. Key `C01`, press `ENTER`.
5. `↓` — `F01` appears.
6. Key `F01`, press `ENTER`.
7. `↓` — `C02` appears.
8. Repeat 4-7 for the rest of the stream.
9. `↓` / `↑` to review what was entered.

Steps 4 and 6 are skippable: leaving a slot alone keeps whatever it already holds. The lease example on
p. 49 does exactly this, stepping past `C01` to leave it at `0` and keying only its frequency.

### Grouping equal flows

Consecutive flows of identical value do not each need their own `Cnn` slot. Enter the amount once and set
`Fnn` to the number of consecutive periods it repeats (p. 43). This is the only way to fit long streams
into 24 slots — the p. 49 lease covers 36 months in six.

### Deleting a flow

Select the flow with `↓`/`↑`, then press `2ND` `DEL`. The amount **and its frequency** are both removed,
and every later flow shifts down one slot automatically (p. 44). The `DEL` indicator on the display
confirms deletion is available at the current position (p. 43, p. 44).

The guidebook's before/after diagram (p. 44) shows a three-flow list `5,000 / 8,000 / 10,000` becoming
`5,000 / 10,000` — position 3 is consumed, not blanked.

### Inserting a flow

Select the slot where the new flow should land, press `2ND` `INS`, key the amount, press `ENTER`
(p. 44-45). The flow occupies the selected slot and everything from there on is renumbered upward,
**capped at 24** (p. 44). To make a new second cash flow, select `C02` first (p. 44). The `INS` indicator
confirms insertion is available (p. 43, p. 44).

The diagram (p. 44) shows `5,000 / 8,000` becoming `5,000 / 7,000 / 8,000` when 7,000 is inserted at
position 2.

### Computing NPV

`NPV` opens the discount-rate variable `I` (p. 45). Key the per-period rate, press `ENTER`, press `↓` to
reach `NPV`, then `CPT` (p. 45). The rate keyed must already be scaled to the cash-flow period — the
calculator does no `P/Y`-style conversion here, which is why the lease example divides 10 by 12 by hand
(p. 49).

### Computing IRR

`IRR` displays the `IRR` variable holding its current value, evaluated against whatever cash flows are
loaded; `CPT` then solves (p. 45). No discount rate is needed — `IRR` is what is being solved for.

The solve is iterative and the guidebook warns it may run for seconds or minutes (p. 45). How many
answers exist depends on how many times the sign of the stream flips (p. 45-46):

| Sign changes in the stream | Outcome |
|---|---|
| None | No solution exists. **Error 5** (p. 45). |
| Exactly one | Exactly one solution; the calculator displays it (p. 45). |
| Two or more | At least one solution exists, and there can be as many solutions as there are sign changes. The calculator reports **the one closest to zero** (p. 46). |

For the two-or-more case the guidebook is blunt that the displayed root carries no financial meaning and
should not be leaned on for an investment decision (p. 46). A stream with three sign changes may have
one, two, or three roots (p. 46).

The iteration can also simply fail on a hard problem even when a root does exist, giving **Error 7**
(p. 46).

### Independence from TVM

The `BGN`/`END` setting in the TVM worksheet has no effect on the Cash Flow worksheet (p. 49). Timing is
expressed structurally instead: to model beginning-of-period payments, the first payment of the stream is
made `CFo` and the rest shift back one slot. The lease example spells this out — four months of $0
becomes `CFo = 0` plus `C01 = 0` with `F01 = 3` (p. 49).

---

## Formulas

### Net present value (p. 76, appendix)

Transcribed exactly as rendered in the vector artwork:

```
             N                        ( 1 - (1+i)^(-n_j) )
NPV = CF_0 + Σ  CF_j (1+i)^(-S_j-1) · ---------------------
            j=1                                 i
```

with the accompanying `where:` block:

```
        ⎧  j
        ⎪  Σ  n_i      j ≥ 1
S_j  =  ⎨ i=1
        ⎪
        ⎩  0           j = 0
```

Variables:

| Symbol | Meaning |
|---|---|
| `CF_0` | Initial cash flow (`CFo`) |
| `CF_j` | Amount of the *j*th cash-flow group (`Cnn`) |
| `n_j` | Frequency of the *j*th group (`Fnn`) |
| `N` | Number of cash-flow groups entered |
| `i` | Periodic rate as a decimal |
| `S_j` | Cumulative count of periods through group *j* |

The guidebook adds that net present value depends on `CF0`, the subsequent `CFj`, each frequency `nj`,
and the specified rate `i` (p. 76).

#### ⚠ DISCREPANCY — printed exponent contradicts the worked example

The exponent renders as `-S_j-1`, i.e. **negative-S-sub-j, minus one**. Taken literally it is wrong. The
p. 47-48 example (`CFo=-7000; C01=3000,F01=1; C02=4000,F02=1; C03=5000,F03=4; I=20`) is stated to give
`NPV = 7,266.44`:

| Reading of the exponent | Computed NPV | Matches p. 48? |
|---|---|---|
| `-S_{j-1}` (subscript *j−1*) | **7266.4394…** → `7,266.44` | ✅ |
| `-S_j - 1` (literal, as printed) | 277.4649… | ❌ |

**The worked example wins.** The implementation must use

```
             N                          ( 1 - (1+i)^(-n_j) )
NPV = CF_0 + Σ  CF_j (1+i)^(-S_{j-1}) · ---------------------
            j=1                                   i

         j-1
S_{j-1} = Σ  n_i        (S_0 = 0)
         i=1
```

Two independent pieces of evidence back this reading. First, the arithmetic above. Second, the appendix's
own `where:` block bothers to define `S_j = 0` for `j = 0` — a case the summation `j = 1 … N` can only ever
reach if the exponent indexes `S_{j-1}`. The printed form appears to be a subscript that lost its nesting
in typesetting, the same class of defect as the missing leading minus sign in the appendix PMT formula.

Restated plainly: each group is discounted by the number of periods that **precede** it, then multiplied by
an ordinary-annuity factor covering its own `n_j` periods. Group 1 is therefore undiscounted (`S_0 = 0`)
and its flows land at periods 1…n_1.

#### Zero-rate edge

The annuity factor `(1 - (1+i)^(-n_j)) / i` is `0/0` at `i = 0`. The guidebook gives no `i = 0` variant.
Its limit is `n_j`, so `NPV(i=0) = CF_0 + Σ CF_j · n_j` (the plain undiscounted sum). Treat as an
inferred behaviour — see *Edge cases*.

### Internal rate of return (p. 77, appendix)

Transcribed exactly as rendered:

```
IRR = 100 x i

where:   i satisfies npv() = 0
```

and, immediately below, on its own line:

```
i = I/Y ÷ 100
```

The guidebook adds that the internal rate of return depends on the values of the initial cash flow (`CF0`)
and the subsequent cash flows (`CFj`) (p. 77).

`npv()` refers to the NPV expression above. `IRR` is therefore the rate, in percent, at which the stream's
net present value vanishes — consistent with the plain-language definition on p. 45.

**Note on `i = I/Y ÷ 100`.** This line names `I/Y`, which is the *TVM* worksheet's rate variable; the Cash
Flow worksheet's rate is simply `I` (p. 42). Read it as `i = I ÷ 100` for this worksheet. Flagged as an
ambiguity rather than a behavioural claim.

**Sign convention.** Inflows positive, outflows negative (p. 42). The error table restates this as the
condition for a solvable problem: "make sure cash inflows are positive and outflows are negative" (p. 84).
`IRR` requires at least one sign change across `CFo` and the `Cnn` list.

### Verification of both worked examples

Both examples in the page range reproduce exactly under the corrected NPV formula:

| Example | Input | Formula output | Guidebook display |
|---|---|---|---|
| Machine, NPV (p. 48) | edited stream, `i = 0.20` | 7266.4394718… | `7,266.44` ✅ |
| Machine, IRR (p. 48) | edited stream | 52.7053745…% | `52.71` ✅ |
| Lease, NPV (p. 49) | 6 groups, `i = 10/12/100` | -138088.4358… | `-138,088.44` ✅ |

---

## Key sequences

Arrow keys are written `↓` / `↑`. `+/-` is the sign-change key.

### Open the worksheet
```
CF                          → CFo
```

### Enter a stream
```
CF
<value> +/- ENTER           → CFo   (+/- only for an outflow)
↓ <value> ENTER             → C01
↓ <value> ENTER             → F01
↓ <value> ENTER             → C02
↓ <value> ENTER             → F02
…                                   (repeat to C24 / F24)
```

### Review
```
↓   or   ↑
```

### Delete the currently displayed cash flow
```
↓/↑  (until the target Cnn shows, DEL indicator lit)
2ND DEL
```

### Insert a cash flow at the currently displayed slot
```
↓/↑  (until the target Cnn shows, INS indicator lit)
2ND INS
<value> ENTER
```

### Compute NPV
```
NPV                         → I
<rate> ENTER                → I
↓                           → NPV
CPT                         → NPV computed
```

### Compute IRR
```
IRR                         → IRR
CPT                         → IRR computed
```

### Reset
```
CF   2ND CLR WORK           → CFo, Cnn, Fnn to defaults
NPV  2ND CLR WORK           → NPV to default
IRR  2ND CLR WORK           → IRR to default
2ND RESET ENTER             → everything, all worksheets
```

---

## Clearing / reset

### `2ND CLR WORK` — scoped to the variable group you are standing in

The guidebook splits this into three separate operations depending on which key opened the current view
(p. 42):

| Standing in | `2ND CLR WORK` resets | Leaves alone |
|---|---|---|
| `CF` (`CFo`/`Cnn`/`Fnn`) | `CFo`, all `C01`-`C24`, all `F01`-`F24` to defaults | `I`, `NPV`, `IRR` |
| `NPV` (`I`/`NPV`) | `NPV` to default | `CFo`/`Cnn`/`Fnn`, `IRR` |
| `IRR` | `IRR` to default | `CFo`/`Cnn`/`Fnn`, `I`, `NPV` |

Page 43 states more loosely that `2ND CLR WORK` clears the Cash Flow worksheet; page 42 is the specific
statement and governs. Note that no bullet on p. 42 claims `2ND CLR WORK` resets `I` — the `NPV` bullet
names only `NPV`. Whether `I` is cleared alongside it is **not stated**; see *Edge cases*.

### `2ND RESET ENTER`

Restores every calculator variable and format to its default, Cash Flow worksheet included (p. 42). The
lease example opens with it and `CFo` duly reads `0.00` (p. 49).

### `CLR TVM`

Not mentioned anywhere in p. 42-49 in connection with this worksheet. It is a TVM-worksheet operation and
**does not touch** `CFo`, `Cnn`, `Fnn`, `I`, `NPV`, or `IRR`. The two worksheets keep separate rate
variables (`I` here, `I/Y` there), so clearing TVM cannot disturb the cash-flow discount rate.

### `QUIT`

Leaves the worksheet for standard-calculator mode. Pages 42-49 do not describe it as destructive, and the
worksheet model throughout the guidebook is that entered values persist until explicitly cleared or reset
— re-entering with `CF` should show the stream intact. Not directly stated in this page range; treat as an
inference.

### What survives worksheet exit

All entered values (`CFo`, `Cnn`, `Fnn`, `I`) and both computed values (`NPV`, `IRR`) persist. `IRR`
displays "current value ... based on the current cash-flow values" when reopened (p. 45), which implies the
stored `IRR` is stale-but-retained until recomputed with `CPT`.

---

## Errors

Any error is cleared with `CE/C` (p. 84). Note that **clearing** an error and **cancelling** a running
`IRR` iteration are two different keys: `CE/C` clears the message once it is displayed (p. 84), while
`ON/OFF` is what interrupts an evaluation in progress and *raises* Error 8 (p. 85). Do not conflate them.

| Error | Name | Raised by this worksheet when | Cite |
|---|---|---|---|
| **Error 4** | Out of range | An `Fnn` value outside the range **0.5-9,999** is entered. | p. 84 |
| **Error 5** | No solution exists | `IRR` is computed on a stream with **no sign change** in the cash-flow list — i.e. `CFo` and all `Cnn` share one sign. | p. 45, p. 84 |
| **Error 5** | No solution exists | A logarithm input is not `> 0` during a calculation. Listed jointly for the TVM, Cash Flow and Bond worksheets; the guidebook does not identify which Cash Flow computation takes an `LN`. | p. 84 |
| **Error 7** | Iteration limit exceeded | `IRR` is computed on a complex problem with **multiple sign changes** and the iteration does not converge. The guidebook is explicit that this can happen even when a solution exists. | p. 46, p. 85 |
| **Error 8** | Canceled iterative calculation | `ON/OFF` is pressed to stop an `IRR` evaluation in progress. | p. 85 |

Errors this worksheet does **not** raise:

- **Error 6** (invalid date) — Bond and Date worksheets only. The p. 50 note about navigating before entering values causing Error 6 is a Bond-worksheet rule and does not apply to Cash Flow; `CF` lands on a populated `CFo` (default `0`) and `↓`/`↑` navigation before any entry is normal and demonstrated (p. 49).
- **Error 2**'s amortization/depreciation clauses, **Error 3**, and the TVM/Bond/Statistics clauses of Errors 1, 4 and 5 are out of scope here.

**Error 1** (overflow) is a general condition — a result outside ±9.9999999999999E99 — and is reachable from
any worksheet, but the error table names no Cash Flow-specific cause.

---

## Edge cases & ambiguities

### Documented but subtle

1. **`CFo` is mandatory and has no frequency.** The stream must open with `CFo` (p. 42, p. 43) and no
   `F00` exists — `CFo` occurs exactly once. Only `C01`-`C24` carry frequencies (p. 43).

2. **24 is the hard ceiling on *groups*, not on periods.** Frequencies stretch 24 slots across up to
   24 × 9,999 periods. Insertion is capped at 24 (p. 44); the guidebook does not say what happens when
   `2ND INS` is pressed on a full list — whether the 24th flow is silently discarded or the insert is
   refused is **unspecified**.

3. **Deleting produces a zeroed tail slot.** After `2ND DEL` on `C03` in the p. 47 example the display
   still reads `C03=` but shows `0.00` — the list shortened and `C03` is now the vacant slot past the end.
   Deletion removes the amount *and* its frequency together (p. 44).

4. **Insert lands *at* the selected slot.** `2ND INS` on `C02` makes the new value the new `C02`; the old
   `C02` becomes `C03` (p. 44-45). The p. 47 example confirms it: old `C02=5,000` reappears at `C03=5,000`
   with its `F02=4` carried along to `F03=4`. **Frequency travels with the amount when flows shift.**

5. **An inserted flow gets frequency 1.** In the p. 47 example, `2ND INS 4000 ENTER` at `C02` leaves
   `F02 = 1.00` without it being keyed. This is the `Fnn` default asserting itself on the fresh slot.

6. **The discount rate is per period, unconverted.** The lease example must key `10 ÷ 12 ENTER` to turn an
   annual 10% into a monthly rate (p. 49). There is no `P/Y` mechanism in this worksheet.

7. **`I` is stored at full precision, displayed rounded.** `10 ÷ 12 ENTER` displays `I = 0.83` but retains
   0.8333…; the published `NPV = -138,088.44` is only reproducible with the unrounded value. Computing with
   a literal 0.83 yields -138,181.32 — off by $92.89. Any implementation that rounds the *stored* rate to
   the display setting will fail this golden test.

8. **`BGN`/`END` is inert here** (p. 49). Beginning-of-period timing is modelled by promoting the first
   payment to `CFo`.

9. **Sign changes are counted across the whole stream including `CFo`.** The p. 45 "no sign change"
   diagram shows `CFo` *and* `C01`-`C05` all as up-arrows; the one-sign-change diagram flips only `CFo`
   downward. So `CFo` participates in the count.

10. **A zero flow does not count as a sign change.** Implied by the lease example, which holds
    `CFo = 0`, `C01 = 0`, `C03 = 0`, `C05 = 0` alongside negative flows and is treated as an ordinary NPV
    problem. Not stated explicitly; relevant only to `IRR` sign-change counting, which the lease never
    invokes.

### Contradictions between guidebook and guidebook

11. **NPV exponent `-S_j-1` vs `-S_{j-1}`** — see *Formulas*. The worked example is authoritative.

12. **`Fnn` lower bound 0.5 vs "number of occurrences".** Page 43 describes `F` as a count of occurrences
    up to 9,999, which reads as a positive integer. The error table (p. 84) sets the accepted interval at
    **0.5-9,999**, implying a fractional 0.5 is accepted and, by omission, that `0` is rejected with
    Error 4. What a non-integral frequency such as 2.5 *means* in the NPV summation — where `n_j` is an
    exponent, so it is at least arithmetically defined — is never explained. Whether values are truncated,
    rounded, or used as-is is **unspecified**. Recommend matching the printed bound (reject `< 0.5` and
    `> 9,999` with Error 4) and using `n_j` as-is in the formula.

13. **`F03 = 4.0` in the p. 47 editing table.** Every other display in the table carries two decimals
    (`4,000.00`, `1.00`, `5,000.00`). This lone `4.0` is a typesetting slip; at the `DEC = 2` default in
    force throughout the example the display must read `4.00`. The golden test asserts `4.00`.

14. **Thousands separators missing on p. 49.** The lease table prints `-5000.00`, `-6000.00`, `-7000.00`,
    while p. 47 prints `-7,000.00` and `5,000.00` for the same magnitudes, and p. 49's own `NPV` result
    prints `-138,088.44` *with* a separator. The BA II Plus groups digits unconditionally. Treated as a
    typesetting inconsistency; the golden tests assert the comma-grouped forms.

15. **The p. 49 time-line diagram contradicts its own table.** The diagram labels the groups
    `C02 $500`, `C04 $600`, `C06 $700`, but the payment schedule, the keystrokes, and the displays all use
    **5000 / 6000 / 7000**. The diagram is off by a factor of ten. Keystrokes and displays win.

16. **The p. 49 diagram also drops the signs.** It labels the flows `$500`/`$600`/`$700` as positive while
    the keystrokes press `+/-` on each. The entered stream is negative throughout, consistent with lease
    payments as outflows from the lessee, and consistent with the negative `NPV`.

17. **The `◁` "entered" marker does not track what was actually keyed, and its rule is unspecified.**
    It appears on displays no keystroke ever wrote: `F01 = 1.00◁` and `F03 = 1.00◁` on p. 47 (only `↓`
    was pressed), and `C01 = 0.00◁`, `C03 = 0.00 ◁`, `C05 = 0.00◁` on p. 49 (stepped past, never keyed).
    It is *absent* from `CFo = 0.00` on first display (p. 47, p. 49), from `I = 0.00` (p. 48, p. 49), and
    from `C03 = 0.00` immediately after `2ND DEL` (p. 47).

    No rule reconciles these. "Marks entered values" fails on `F01`/`C01`; "marks enter-only variables"
    fails on `CFo` and `I`, which are enter-only and unmarked; "marks a slot holding a live value" fails
    on the p. 49 sequence, where `2ND RESET ENTER` `CF` `↓` shows `CFo = 0.00` unmarked but `C01 = 0.00◁`
    marked with nothing entered in either. Treat the marker as **unspecified** — cosmetic, and outside
    the assertion surface: these slots hold their documented defaults (`Cnn = 0`, `Fnn = 1`) and no
    golden test asserts the annotation.

18. **Page 42's NPV bullet is loosely worded.** "To compute net present value (NPV), press `↓` or `↑` and
    `CPT` for each variable" reads oddly — the actual procedure (p. 45) is `NPV`, key `I`, `ENTER`, `↓`,
    `CPT`. Page 45 governs.

### Unspecified — implementation must choose

19. **Does `2ND CLR WORK` in the `NPV` view also reset `I`?** Page 42 names only `NPV`. Since `I` is
    enter-only and `NPV` compute-only, and the three reset bullets each name exactly the variables of their
    view, the conservative reading is that `I` is *not* cleared. Unverified.

20. **`NPV` computed at `i = 0`.** Formula is indeterminate; limit is the undiscounted sum. No guidance in
    the guidebook. (`I = 0` is the *default*, so `NPV` `↓` `CPT` immediately after a reset hits this path.)

21. **`IRR` when the whole stream is zero.** Every flow zero means no sign change → Error 5 by the p. 84
    rule, though the case is degenerate.

22. **Which root "closest to zero" means for multi-root streams.** Page 46 does not say closest in absolute
    value, nor whether negative roots are candidates, nor what the iteration seeds from. Reproducing TI's
    exact choice on multi-sign-change streams is not possible from this documentation alone. No worked
    example exercises it.

23. **The iteration limit behind Error 7** is not quantified (p. 46, p. 85).

24. **`IRR` retains a stale value across cash-flow edits.** Page 45 says opening `IRR` shows the current
    value "based on the current cash-flow values", but nothing says the stored `IRR` is invalidated when a
    `Cnn` changes. Whether editing a flow zeroes `IRR` or leaves the prior result displayed until `CPT` is
    **unspecified**.

25. **Deleting `CFo` is not possible.** `2ND DEL` is described only for `Cnn` (p. 44), and `CFo` is
    structurally required. Behaviour of `2ND DEL` while standing on `CFo` is unstated — presumably the
    `DEL` indicator simply does not light.
