# DrosoTracker tests

A test suite with **no external dependencies** (it runs on plain Node). The tests
**extract the real scientific functions** from `index.html` (not a copy) and check them
against hand-computed values and independent references, so they test the code exactly as
it is deployed.

## How to run

```bash
node tests/run-tests.mjs
```

It prints each test group and a summary, and exits with a non-zero code if anything fails
(suitable for CI, e.g. GitHub Actions).

## What it covers

- **Development model** (`totalDays`, `stageBounds`): thermal summation, monotonicity with
  temperature, stages adding up to the total, and scaling by the calibration factor.
- **Kaplan–Meier** (`kmCurve`): S(t) and median against a hand-computed canonical dataset;
  correct handling of censored observations; and a cross-check against an independent
  reference implementation (including ties and edge cases).
- **T50 from counts** (`computeT50FromCounts`): interpolation at 50 %, and the cases that
  return `null` (a single count, no crossing of the halfway point, no total).
- **Per-genotype calibration** (`calibInfo`, `calibFactorValue`, `obsFactor`, `obsWeight`,
  `normGeno`): per-method weights, `obsFactor = observed/base`, the **≥3 replicates rule**
  (below 3 it is not applied), confidence by N, and the quality-weighted average.

## Cross-check against R

`R-crosscheck.md` reproduces the Kaplan–Meier dataset in R (`survival::survfit`) and
documents the agreement with DrosoTracker, for citation in the manuscript.
