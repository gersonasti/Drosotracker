# Cross-check of the Kaplan–Meier estimator against R `survival`

This document reproduces, in **R** (package `survival`, the standard in the field), the same
dataset used by the automated test `run-tests.mjs`, in order to document for the manuscript
the **agreement** between the DrosoTracker implementation and an established reference.

## Canonical dataset

10 individuals · 7 deaths · 3 censored.

| Time (days) | Status |
|---|---|
| 4 | death |
| 6 | censored |
| 8 | death |
| 8 | death |
| 10 | death |
| 12 | censored |
| 14 | death |
| 14 | death |
| 16 | death |
| 18 | censored |

## R script

```r
library(survival)

# 1 = death (event), 0 = censored
time   <- c(4, 6, 8, 8, 10, 12, 14, 14, 16, 18)
status <- c(1, 0, 1, 1, 1,  0,  1,  1,  1,  0)

fit <- survfit(Surv(time, status) ~ 1)
summary(fit)   # S(t) at each event time
print(fit)     # median survival
```

## Expected R output (which DrosoTracker also produces)

`summary(fit)` — survival estimator:

| time | n.risk | n.event | survival |
|---|---|---|---|
| 4 | 10 | 1 | 0.9000 |
| 8 | 8 | 2 | 0.6750 |
| 10 | 6 | 1 | 0.5625 |
| 14 | 4 | 2 | 0.2813 |
| 16 | 2 | 1 | 0.1406 |

`print(fit)` → **median = 14**.

## Agreement

`tests/run-tests.mjs` automatically checks that DrosoTracker's `kmCurve` function produces
**exactly** these values: `S(4)=0.9`, `S(8)=0.675`, `S(10)=0.5625`, `S(14)=0.28125`,
`S(16)=0.140625`, and **median = 14** (the first time with `S ≤ 0.5`).

In other words: the DrosoTracker implementation agrees with R's `survival::survfit` on the
Kaplan–Meier estimator, including the handling of censored observations and the median
criterion. Running the R script above reproduces these numbers independently.

> For the paper: attach the actual R output (copied from the console) alongside this table.
