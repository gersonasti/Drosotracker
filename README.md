# DrosoTracker

A free web app that tracks the *Drosophila melanogaster* life cycle: developmental stages,
estimated eclosion, adult aging cohorts, and the husbandry tasks that follow from each cross.
It runs entirely in the browser, works offline, and needs no account.

**Live app: [drosotracker.pages.dev](https://drosotracker.pages.dev)**

## What it does

- **Life-cycle tracking.** Enter a cross (genotype, purpose, temperature, date) and the app
  shows the current stage, a progress ring, the estimated eclosion date and a full timeline,
  computed from a temperature-dependent thermal-summation model.
- **Automatic tasks.** Collecting virgins, removing parents, larval dissection, flipping to
  fresh food and defining an aging cohort are derived from the purpose of each cross and
  gathered in a "Pending tasks" panel.
- **Recurring tasks.** Stock-tray flipping and similar chores, independent of the crosses,
  with several people taking turns.
- **Per-genotype calibration.** Record an observed T₅₀ (the moment half the flies eclosed)
  and the model adjusts to your strain and your lab, using a shrinkage estimator that stays
  at the published base model until the data justify moving away from it.
- **Aging and survival.** Kaplan–Meier curves per cohort (females and males tracked
  separately), log-rank comparison between cohorts, and sample-size / power planning for a
  survival experiment. Export as CSV ready for GraphPad Prism or R.
- **Bilingual.** English by default, Spanish available from the ⚙️ menu.
- **Installable (PWA)**, with optional one-way sync of tasks and eclosion dates to your own
  Google Calendar.

## Privacy

Everything you enter is stored locally in your browser (`localStorage`). There is no server
database and no account. See [privacy.html](privacy.html) for the full policy, including the
optional Google Calendar integration.

## Running it locally

The app is a single self-contained HTML file. Any static server will do:

```bash
npx serve .                     # Node
python3 -m http.server 8000     # or Python, then open http://localhost:8000
```

Opening `index.html` straight from the filesystem also works, except that the service worker
(offline support) only registers over http/https.

## Repository layout

| Path | What it is |
|---|---|
| `index.html` | The whole app: markup, styles, logic and the scientific model |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | PWA: service worker, manifest and icons |
| `privacy.html` | Privacy policy (required by the Google Calendar integration) |
| `_redirects` | Redirects from the old URLs to the bare domain (Cloudflare Pages) |
| `docs/calibration.md` | Derivation and justification of the model constants |
| `analysis/calibration.R` | Reproduces the constants from the primary data and draws Figure 1 |
| `analysis/data/` | Transcribed primary data (Powsner 1935, Al-Saffar 1995, BDSC) |
| `analysis/estimator_simulation.mjs` | Simulation study of the calibration estimator |
| `tests/` | Test suite and the cross-check against R's `survival` package |

## The development model

Development is modelled as a thermal summation, `T_dev(θ) = DD / (θ − T₀)`, with
**T₀ = 11.78 °C** and **DD = 116 °C·days**, obtained by regressing developmental rate against
temperature on the verified egg→adult data of Powsner (1935), over the linear range
~15–28 °C (n = 13, R² = 0.997).

To reproduce the constants and Figure 1, from the `analysis/` folder:

```bash
Rscript calibration.R
```

The script self-checks and stops if the fitted constants drift from the published values.
The full derivation, robustness tables, range of validity and caveats are in
[`docs/calibration.md`](docs/calibration.md).

## Tests

No external dependencies; the tests extract the real scientific functions from `index.html`
so they check the code exactly as deployed.

```bash
node tests/run-tests.mjs
```

They cover the development model, the Kaplan–Meier estimator (against a hand-computed dataset
and an independent implementation), T₅₀ interpolation, the calibration estimator, the log-rank
test and the sample-size formula. See [`tests/README.md`](tests/README.md), and
[`tests/R-crosscheck.md`](tests/R-crosscheck.md) for the agreement with R's `survival::survfit`.

## License

[MIT](LICENSE).
