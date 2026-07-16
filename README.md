# Tenor

An independent, BA II Plus–compatible financial calculator for the web.

> **Disclaimer**
>
> This is an independent financial calculator application. It is not manufactured,
> sponsored, endorsed, or approved by Texas Instruments.
>
> BA II Plus™ is a trademark of Texas Instruments. This project is not affiliated
> with Texas Instruments and makes no claim of approval for any examination.

`Tenor` is a working product name — a finance term for the time remaining on a
contract. It carries no association with any existing product and can be changed
before release. See [docs/IP.md](docs/IP.md).

## Status

Early development. Following the phased plan in the project brief.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Research, spec extraction, traceability matrix | Complete |
| 1 | Calculator engine: precision, display, standard math, CHN/AOS, memory | In progress |
| 2 | TVM and amortization | TVM solvers done; amortization pending |
| 3 | Cash flow, bonds, depreciation, statistics, other worksheets | Not started |
| 4 | UI and PWA | Not started |
| 5 | Optional accounts and sync | Not started |
| 6 | Final parity audit | Not started |

## Layout

```
packages/calculator-core/   framework-independent engine, zero runtime deps
  src/errors.ts             the eight error conditions
  src/numeric/              13-digit internal precision layer
  src/display/              LCD formatting
  src/math/                 operators, CHN/AOS expression engine
  src/worksheets/           TVM (more to follow)

docs/spec/                  behavioural spec per guidebook section
docs/TRACEABILITY.md        feature -> guidebook section -> tests -> status
docs/ENGINE-DESIGN.md       precision model, state shape, solver design
docs/OPEN-QUESTIONS.md      known ambiguities and how to resolve them

tests/golden/               golden-test corpus extracted from guidebook examples
research/                   local-only reference material (gitignored, never shipped)
```

## Development

```bash
npm install
npm test           # vitest
npm run typecheck
```

## Design notes

**The engine is the product.** `calculator-core` has no dependencies and no UI. It
is a pure reducer: `state + key command -> new state + display`. Every worksheet
formula is a pure function.

**13-digit internal precision is emulated, not assumed.** The hardware keeps 13
significant digits and displays at most 10. IEEE-754 doubles carry more, so the
extra precision is actively discarded after each operation. The guidebook's own
`1 ÷ 3 × 3` example pins this down: the machine holds `0.9999999999999`, where a
naive double holds exactly `1`. See `src/numeric/precision.ts`.

**Golden tests are the arbiter, not the printed formulas.** The guidebook's
appendix contains at least one sign error — the printed `PMT` formula returns
`+729.13` for the guidebook's own mortgage example, which the hardware displays as
`-729.13`. Every solver is therefore derived from the fundamental TVM equation and
validated against worked examples. See [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md).

## Intellectual property

The reference guidebook is third-party copyrighted material. It is used only as a
development reference and is never committed or shipped: `research/` is gitignored.
All specification prose in `docs/` is original wording with page citations. Facts —
formulas, key sequences, defaults, error conditions — are not copyrightable and are
recorded exactly.

The public product must have its own name and visual identity, must not use TI
branding, product photography, or trade dress, and must not be advertised as
approved for examinations. A trademark and trade-dress review is required before
any commercial release.
