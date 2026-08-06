# Calibration of the DrosoTracker development model

This document derives and justifies the thermal constants of the egg→adult model
of *Drosophila melanogaster* used by DrosoTracker, from published data.
The constants and Figure 1 are reproduced with (from the `analysis/` folder):

```
Rscript calibration.R
```

which fits the regression on the verified data, **self-checks** (it stops if
T₀/DD drift) and writes the calibration figure to `analysis/figures/`.
The robustness tables and the stage breakdown below are documented values,
derived from the same regression and the same data.

---

## 1. The model

Development is described by a **thermal summation** (°C·days):

```
T_dev(θ) = DD / (θ − T₀)
```

where `θ` is temperature, `T₀` a developmental threshold and `DD` the thermal
constant (°C·days). Equivalently, the developmental **rate** is linear in
temperature:

```
rate = 1/T_dev = (1/DD)·θ − T₀/DD
```

So a **linear regression of rate against temperature** yields
`DD = 1/slope` and `T₀ = −intercept/slope`, with their confidence intervals
(delta method on the covariance of the fit) and R².

The fit is done **only over the linear range ~15–28 °C**. Outside that range the
relationship curves (§4) and is excluded from the fit, although it is plotted to
show the departure.

---

## 2. Primary source and fit

**Powsner, L. (1935).** *The effects of temperature on the durations of the
developmental stages of* Drosophila melanogaster. *Physiological Zoology*
**8**(4): 474–520. doi:10.1086/physzool.8.4.30151263

Inbred strain (>75 generations, high homozygosity), banana + agar medium,
incubators at ±0.05 °C, 20–30 min bounded egg-lay, 15–30 eggs per vial. The
egg-larval period is corrected for the time spent at 25 °C beforehand (the
corrected column is used). The egg→adult total is computed as
`egg_larval + pupal` (Tables IX and X), averaging both sexes. Temperatures in the
two tables differ in their decimals (different experiments) and are paired by
proximity; the temperature of the egg-larval table is used. **The transcription
and the pairing were verified against the original PDF by the authors**
(`analysis/data/powsner1935_total_verified.csv`).

### Main fit (sexes averaged, ~15–28 °C, n = 13)

| Parameter | Value | 95 % CI |
|---|---|---|
| **T₀** | **11.78 °C** | ±0.4 |
| **DD** | **116.4 °C·days** (→ 116) | ±4.2 |
| **R²** | **0.9971** | — |

Egg→adult predictions (with the fitted DD of 116.4): 18 °C → 18.7 d ·
21 °C → 12.6 d · 25 °C → 8.8 d · 29 °C → 6.8 d. The app rounds DD to 116, ~0.03 d
less at 25 °C. The fitting range includes 15.24 °C and 27.77 °C and excludes
≥28.07 °C.

*(Figure 1 — rate vs. temperature with the fitted line, its confidence band and
the T₀ intercept; the excluded ≥29 °C points depart from the line.)*

### Robustness

The fit is stable across changes of range and of sex:

| Subset | T₀ (°C) | DD | R² | n |
|---|---|---|---|---|
| Verified, 15–28 (**main**) | 11.78 | 116.4 | 0.9971 | 13 |
| Verified, 16–28 | 12.12 | 113.2 | 0.9986 | 12 |
| Verified, 18–28 | 12.12 | 113.2 | 0.9986 | 12 |
| Males (tables), 15–28 | 11.48 | 119.6 | 0.9972 | 13 |
| Females (tables), 15–28 | 11.76 | 116.5 | 0.9947 | 13 |
| **Sexes avg, 15–32 (poor fit)** | **9.56** | **145.5** | **0.9193** | 18 |

The last row shows why restricting the fit to the linear range matters:
**including the non-linear extremes degrades the fit** (T₀ ≈ 9.6 · DD ≈ 146 ·
R² drops to 0.92). The constants are only reliable over ~15–28 °C. (With no
verified point between 16 and 18 °C, the 16–28 and 18–28 cut-offs coincide.)

---

## 3. Stage breakdown (at 25 °C, Powsner)

| Stage | Duration | Proportion |
|---|---|---|
| Embryo | 0.85 d | 9.8 % |
| Larval | 3.90 d | 44.8 % |
| Pupal | 3.96 d | 45.4 % |
| **Total** | **8.71 d** | 100 % |

The breakdown is stored as fractions of the total and rescaled proportionally
with temperature. The larval period is subdivided **L1 : L2 : L3 = 1 : 1 : 2**
following a *Current Biology* review (embryogenesis, L1 and L2 of one day each,
L3 of two days), **not Powsner**, who measures the larval period as a single
block (see caveat 9).

---

## 4. Range of validity and comparison between sources

The linear approximation holds over **~15–28 °C** and breaks down at the extremes:

- Above ~29 °C the duration rises again (Powsner's minimum falls at 28–29 °C;
  Al-Saffar's pupal stage rises from 87.2 h at 27.5 °C to 101.3 h at 30 °C).
- Near the lower threshold the relationship also curves (>50 days at 12 °C).

Other sources, for context (not used for the constants):

| Source | Range | T₀ (°C) | DD | R² |
|---|---|---|---|---|
| Powsner 1935 (total) | ~15–28 | 11.78 | 116.4 | 0.997 |
| Al-Saffar 1995 (total) | 15–30 | 9.71 | 222.5 | 0.987 |
| Al-Saffar 1995 (total) | 15–27.5 | 9.10 | 236.1 | 0.986 |

Al-Saffar reports durations ~60–70 % longer because **each larva was reared in
isolation** (1 egg per compartment), which slows larval development; their egg
and pupal values, by contrast, are normal. This is evidence that culture
conditions change the thermal constants, the core argument for the app's
per-genotype / per-lab calibration. *(Figures 4 and 6.)*

---

## 5. Caveats to keep in mind

1. **T₀ is a fitting parameter, not a physiological zero.** Powsner showed that
   eggs at 10.3 °C completed 9.1 % of their embryonic development, almost 2 °C
   below the extrapolated zero, and that the rate-temperature curve is sigmoid.
2. **Range of validity ~15–28 °C** (§4).
3. **The constants are not transferable between genotypes.** Sewall Wright,
   quoted in a footnote by Powsner himself, warns that the data apply only to
   that inbred stock. This is the **published justification for the per-genotype
   calibration module**: the primary source warns against universal use of its
   own values.
4. **Between-laboratory variation** (Powsner vs. Al-Saffar, ~60–70 %, with the
   larval stage responsible).
5. **Density and nutrition.** Powsner found no effect between 7 and 57
   larvae/vial with a bounded egg-lay, but crowding *with starvation* lengthens
   development (111 → 188 h). The critical factor is available food.
6. **Sex differences.** They exist and change with temperature; the model uses
   the average of both (Figure 5).
7. **Fluctuating temperatures speed development up by ~15 %** relative to thermal
   summation (Kaufmann effect / rate summation; Worner 1992). Al-Saffar confirms
   this across 22 alternating regimes, but concludes it is **too small to
   invalidate** the model. In real use (incubators that oscillate, vials taken
   out) somewhat faster development is to be expected; it pushes in the same
   direction as the bias already corrected for, and the per-genotype calibration
   absorbs it. (Figure 6.)
8. **The stage breakdown was measured at 25 °C** and is rescaled proportionally;
   it assumes constant between-stage proportions (a good approximation in the
   mid-range, worse at the edges, above all for the larval period).
9. **The L1/L2/L3 subdivision comes from a source other than Powsner** (a
   *Current Biology* review), who measures the larval period as a single block.
   Parkin & Burnet 1986 would imply 1 : 1 : 1.5; the difference is a matter of
   hours.
10. **The model is very sensitive near the lower threshold.** Below ~18 °C, as θ
    approaches T₀, dividing by `(θ − T₀)` makes the duration grow quickly and
    amplifies a small temperature error. Use the predictions with caution near
    the cold limit.

---

## 6. Data and reproducibility

Primary data transcribed in `analysis/data/`:

| File | Source |
|---|---|
| `powsner1935_total_verified.csv` | Powsner 1935 egg→adult total (Tables IX+X, sexes avg), **verified transcription — input of the fit** |
| `powsner1935_stages.csv` | Powsner 1935, Tables IX (egg-larval) and X (pupal), by sex |
| `powsner1935_embryo.csv` | Powsner 1935, Table VIII (embryonic period) |
| `alsaffar1995_total.csv` | Al-Saffar et al. 1995 (*Biol. Environ.*), Table 1 |
| `bdsc_reference.csv` | Bloomington Drosophila Stock Center (sanity check) |

The script `analysis/calibration.R` (R) fits the regression on
`powsner1935_total_verified.csv`, reproduces the constants (T₀ = 11.78 ·
DD = 116.38 · R² = 0.997), self-checks, and generates Figure 1 as vector PDF +
300 dpi PNG.

### Calibration references

- Powsner, L. (1935). *Physiol. Zool.* **8**(4): 474–520. doi:10.1086/physzool.8.4.30151263
- AL-Saffar, Z.Y., Grainger, J.N.R. & Aldrich, J. (1995). *Biol. Environ.: Proc. R. Ir. Acad.* **95B**(2): 119–122. JSTOR 20504505
- AL-Saffar, Z.Y., Grainger, J.N.R. & Aldrich, J. (1995). *J. Thermal Biology* **20**(5): 389–397. doi:10.1016/0306-4565(94)00075-T
- Worner, S.P. (1992). *Environ. Entomol.* **21**: 689–699.
- Bloomington Drosophila Stock Center — Fly Culture. https://bdsc.indiana.edu/information/fly-culture.html

> Check the full bibliographic details before citing in the manuscript.
> The attribution of the larval subdivision to *Current Biology* still needs its
> authors and full details confirmed.

### Correspondence with the app code

The constants live in `index.html`:

```js
const T0 = 11.78;         // Powsner 1935, regression ~15–28 °C (n=13, R²=0.997)
const DEGREE_DAYS = 116.0;
```

and the stage breakdown in the `STAGES` array (fractions ×10: embryo 0.98 ·
L1 1.12 · L2 1.12 · L3 2.24 · pupa 4.54). The **per-genotype** calibration (v2)
shrinks towards this base model; see the "Per-genotype calibration (v2)" block in
the same file.
