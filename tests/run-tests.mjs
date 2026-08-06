/*
 * DrosoTracker — test suite (no external dependencies).
 *
 * Extracts the REAL scientific functions from index.html (not a copy)
 * and checks them against hand-computed values / independent references.
 *
 * Run with:  node tests/run-tests.mjs
 * Exits with a non-zero code if any test fails (suitable for CI).
 */
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/* ---- extraction by brace/bracket counting (grabs the real function text) ---- */
function grabBalanced(src, fromIdx, open, close) {
  let depth = 0, start = src.indexOf(open, fromIdx);
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) { depth--; if (depth === 0) return src.slice(fromIdx, i + 1); }
  }
  throw new Error('unbalanced block from ' + fromIdx);
}
function grabFn(name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(SRC);
  if (!m) throw new Error('function not found: ' + name);
  const body = grabBalanced(SRC, SRC.indexOf('{', m.index), '{', '}');
  return SRC.slice(m.index, SRC.indexOf('{', m.index)) + body;
}
function grabConst(name) {
  const m = new RegExp('const\\s+' + name + '\\s*=\\s*').exec(SRC);
  if (!m) throw new Error('const not found: ' + name);
  // multiline array → balance brackets; scalar → up to the ';'
  const eq = SRC.indexOf('=', m.index);
  const nextNonSpace = SRC.slice(eq + 1).match(/\S/);
  if (nextNonSpace && nextNonSpace[0] === '[') {
    const arr = grabBalanced(SRC, SRC.indexOf('[', eq), '[', ']');
    return `const ${name} = ${arr};`;
  }
  return SRC.slice(m.index, SRC.indexOf(';', m.index) + 1);
}

// minimal localStorage stub for the calibration functions (loadCalib/saveCalib)
const stub = `const localStorage = { s:{}, getItem(k){ return k in this.s ? this.s[k] : null; }, setItem(k,v){ this.s[k]=String(v); }, removeItem(k){ delete this.s[k]; } };
let _calibCache = null;`;
const code = [
  stub,
  grabConst('T0'), grabConst('DEGREE_DAYS'), grabConst('STAGES'), grabConst('REF_TOTAL'),
  grabConst('CALIB_KEY'), grabConst('LABREF_KEY'), grabConst('CALIB_MIN'),
  grabConst('CALIB_SIGMA_T50'), grabConst('CALIB_SIGMA_BATCH'), grabConst('CALIB_PRIOR_SD'),
  grabConst('CALIB_SIGMA_T0_CROSSDAY'), grabConst('CALIB_SIGMA_T0_UNKNOWN'),
  grabConst('SEX_ORDER'),
  grabFn('totalDays'), grabFn('stageBounds'), grabFn('eclosionOverrideDays'),
  grabFn('ensureAging'), grabFn('cohortGroups'), grabFn('hasCohort'), grabFn('cohortIndex'), grabFn('cohortAt'), grabFn('agingEvents'),
  grabFn('kmCurve'), grabFn('computeT50FromCounts'),
  grabFn('loadCalib'), grabFn('saveCalib'), grabFn('normGeno'), grabFn('obsFactor'), grabFn('obsSigmaT0Days'), grabFn('obsSigmaFactor'), grabFn('obsBatch'), grabFn('calibInfo'), grabFn('calibFactorValue'), grabFn('addCalibObs'),
  grabFn('loadLabRef'), grabFn('saveLabRef'), grabFn('isLabRef'), grabFn('labFactorValue'), grabFn('calibInfoFor'),
  grabFn('lgamma'), grabFn('gammincQ'), grabFn('chiSqUpper'), grabFn('quadFormSolve'), grabFn('logRankTest'),
  grabConst('SURV_SHAPE'), grabFn('normInv'), grabFn('logRankPlan'), grabFn('timeToMortality'),
].join('\n');
const M = new Function(code + '\nreturn { T0, DEGREE_DAYS, REF_TOTAL, STAGES, SEX_ORDER, CALIB_MIN, CALIB_SIGMA_T50, CALIB_SIGMA_BATCH, CALIB_PRIOR_SD, CALIB_SIGMA_T0_CROSSDAY, CALIB_SIGMA_T0_UNKNOWN, SURV_SHAPE, totalDays, stageBounds, eclosionOverrideDays, ensureAging, cohortGroups, hasCohort, cohortIndex, cohortAt, agingEvents, kmCurve, computeT50FromCounts, loadCalib, saveCalib, calibInfo, calibFactorValue, obsSigmaT0Days, obsSigmaFactor, obsBatch, normGeno, obsFactor, addCalibObs, loadLabRef, saveLabRef, isLabRef, labFactorValue, calibInfoFor, lgamma, gammincQ, chiSqUpper, quadFormSolve, logRankTest, normInv, logRankPlan, timeToMortality };')();

/* ---- mini framework ---- */
let pass = 0, fail = 0;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FAILED: ' + msg); } }
function group(name, fn) { console.log('\n▶ ' + name); fn(); }

/* ============================ 1) DEVELOPMENT MODEL ============================ */
group('Development model (thermal summation, Powsner 1935 · ~15–28 °C)', () => {
  // Calibrated constants (verified transcription): T0 = 11.78 °C, DD = 116 (not hardcoded: read from the module).
  ok(near(M.T0, 11.78) && near(M.DEGREE_DAYS, 116), 'constants = T0 11.78 / DD 116 (Powsner, n=13)');
  ok(near(M.totalDays(25), M.DEGREE_DAYS / (25 - M.T0)), 'totalDays follows D(T)=DD/(T−T0)');
  ok(near(M.totalDays(25), 8.77, 1e-2), '25 °C ≈ 8.77 d (previously 10)');
  ok(near(M.totalDays(18), 18.65, 1e-2), '18 °C ≈ 18.6 d');
  ok(near(M.totalDays(29), 6.74, 1e-2), '29 °C ≈ 6.74 d');
  ok(near(M.totalDays(16), 27.49, 1e-2), '16 °C ≈ 27.5 d (high T0 ⇒ slower near the threshold)');
  ok(near(M.totalDays(20), 14.11, 1e-2), '20 °C ≈ 14.1 d');
  ok(near(M.totalDays(25, 1.1), 1.1 * M.totalDays(25)), 'the factor scales the total linearly');
  ok(M.totalDays(29) < M.totalDays(25) && M.totalDays(25) < M.totalDays(18), 'monotonic: warmer = faster');

  const b = M.stageBounds(25);
  ok(near(b[b.length - 1].end, M.totalDays(25)), 'the stages add up to the total development time');
  ok(b.every((s, i) => i === 0 || s.start >= b[i - 1].start), 'stage bounds are increasing');
  ok(near(M.stageBounds(25, 1.1)[4].end, 1.1 * M.totalDays(25)), 'the bounds scale with the factor');
  // Recalibrated stage breakdown: the old error was almost entirely in the pupal stage (§5.6).
  ok(near(b[4].start, 4.80, 0.05), 'pupariation at 25 °C ≈ day 4.8 (end of L3, barely changed)');
  ok(near(b[4].end - b[4].start, 4.00, 0.05), 'pupa at 25 °C lasts ~4.0 d (was 5.0 · overestimated by ~25 %)');
  ok(near(b[0].end, 0.86, 0.03), 'embryo at 25 °C ≈ 0.86 d');
});

/* =============== 1b) MANUALLY ENTERED ECLOSION (overrides the model estimate) =============== */
group('Observed eclosion (a treatment can bring it forward or delay it)', () => {
  const start = new Date('2025-01-01T09:00:00');
  const days = s => M.eclosionOverrideDays({ eclosionActual: s }, start);
  ok(M.eclosionOverrideDays({}, start) === null, 'no date entered → null (the model rules)');
  ok(near(days('2025-01-13T09:00:00'), 12), 'date entered → egg→adult duration in days (12)');
  ok(near(days('2025-01-13'), 11.625), 'accepts a date with no time (midnight)');
  ok(days('2025-01-01T10:00:00') === null, 'an eclosion on the same day as the setup is discarded');
  ok(days('2024-12-30T09:00:00') === null, 'an eclosion before the setup is discarded');
  ok(days('not a date') === null, 'invalid date → null');

  // the stages are rescaled to the observed duration, keeping their proportions
  const base = M.stageBounds(25), obs = M.stageBounds(25, 1, 12);
  ok(near(obs[obs.length - 1].end, 12), 'with an observed eclosion the stages end on the entered date');
  ok(obs.every((b, i) => near(b.end / obs[obs.length - 1].end, base[i].end / base[base.length - 1].end)),
     'the per-stage proportions do not change (only the scale is stretched/compressed)');
  ok(near(M.stageBounds(25, 1, null)[4].end, M.totalDays(25)), 'with no date entered, the bounds are the model ones');
});

/* ============================ 2) KAPLAN–MEIER ============================ */
/* Canonical dataset with censoring (N=10), median and S(t) computable by hand and in R (see R-crosscheck.md).
 * deaths at 4,8,8,10,14,14,16 ; censored at 6,12,18
 * S(t): 4→0.9, 8→0.675, 10→0.5625, 14→0.28125, 16→0.140625 ; median = 14 (first t with S≤0.5) */
const ECL = Date.UTC(2025, 0, 1);
const mkCross = (events, startN) => ({
  aging: {
    startN, sex: 'F', vials: 1,
    events: events.map(e => ({ date: new Date(ECL + e.day * 86400000).toISOString(), deaths: e.deaths || 0, censored: e.censored || 0 })),
  },
});
const st = { eclosionDate: new Date(ECL), adultAge: 25 };
const survAt = (km, day) => { const p = km.points.find(p => near(p.day, day)); return p ? p.surv : null; };

/* independent KM reference (implemented from scratch) for cross-checking */
function refKM(events, startN) {
  const byDay = {};
  events.forEach(e => { (byDay[e.day] = byDay[e.day] || { day: e.day, d: 0, c: 0 }); byDay[e.day].d += e.deaths || 0; byDay[e.day].c += e.censored || 0; });
  const times = Object.values(byDay).sort((a, b) => a.day - b.day);
  let n = startN, S = 1, median = null; const map = { 0: 1 };
  for (const t of times) { if (n > 0 && t.d > 0) { S *= 1 - t.d / n; if (median === null && S <= 0.5) median = t.day; } n -= t.d + t.c; map[t.day] = S; }
  return { median, S: map };
}

group('Kaplan–Meier — canonical dataset with censoring (vs hand computation)', () => {
  const data = [
    { day: 4, deaths: 1 }, { day: 6, censored: 1 }, { day: 8, deaths: 2 }, { day: 10, deaths: 1 },
    { day: 12, censored: 1 }, { day: 14, deaths: 2 }, { day: 16, deaths: 1 }, { day: 18, censored: 1 },
  ];
  const km = M.kmCurve(mkCross(data, 10), st);
  ok(near(survAt(km, 4), 0.9), 'S(4) = 0.9');
  ok(near(survAt(km, 8), 0.675), 'S(8) = 0.675');
  ok(near(survAt(km, 10), 0.5625), 'S(10) = 0.5625');
  ok(near(survAt(km, 14), 0.28125), 'S(14) = 0.28125');
  ok(near(survAt(km, 16), 0.140625), 'S(16) = 0.140625');
  ok(km.median === 14, 'median = 14 (first t with S ≤ 0.5)');
  ok(km.maxLife === 16, 'observed maximum (last death) = 16');
  ok(km.deaths === 7 && km.censored === 3, 'counts: 7 deaths + 3 censored = 10');
  ok(km.alive === 0, 'alive at the end = 0');
});

group('Kaplan–Meier — censoring (instead of dying) raises estimated survival', () => {
  // Identical except for the day-5 event: death vs censoring (N=10).
  //  X (dies on day 5):     day5 S=0.9, n→9 ; day10 S=0.9·(8/9)=0.8
  //  Y (censored on day 5): day5 S=1, n→9   ; day10 S=1·(8/9)=0.8889
  const X = M.kmCurve(mkCross([{ day: 5, deaths: 1 }, { day: 10, deaths: 1 }], 10), st);
  const Y = M.kmCurve(mkCross([{ day: 5, censored: 1 }, { day: 10, deaths: 1 }], 10), st);
  const xf = X.points[X.points.length - 1].surv, yf = Y.points[Y.points.length - 1].surv;
  ok(near(xf, 0.8), 'with a death on day 5 → final S = 0.8');
  ok(near(yf, 8 / 9), 'with censoring on day 5 → final S = 8/9 ≈ 0.889');
  ok(yf > xf, 'censoring (not dying) raises estimated survival');
});

group('Kaplan–Meier — cross-check against an independent reference', () => {
  const datasets = [
    [{ day: 3, deaths: 2 }, { day: 7, deaths: 3 }, { day: 9, censored: 1 }, { day: 12, deaths: 4 }],
    [{ day: 5, deaths: 1 }, { day: 5, deaths: 1 }, { day: 8, censored: 2 }, { day: 20, deaths: 6 }], // ties on day 5
    [{ day: 10, deaths: 10 }], // all die on the same day
  ];
  datasets.forEach((data, i) => {
    const N = data.reduce((s, e) => s + (e.deaths || 0) + (e.censored || 0), 0);
    const km = M.kmCurve(mkCross(data, N), st);
    const ref = refKM(data, N);
    ok(km.median === ref.median, `dataset ${i + 1}: median matches the reference (${ref.median})`);
    const allDays = [...new Set(data.map(e => e.day))];
    ok(allDays.every(d => near(survAt(km, d), ref.S[d])), `dataset ${i + 1}: S(t) matches the reference at every time`);
  });
});

/* ================= 2b) PER-SEX COHORTS WITHIN A SINGLE RECORD ================= */
group('Separate ♀/♂ cohorts in one record', () => {
  const ev = (day, deaths) => ({ date: new Date(ECL + day * 86400000).toISOString(), deaths, censored: 0 });
  // old record (a single cohort, previous format) → migrates to groups without losing data
  const legacy = mkCross([{ day: 5, deaths: 2 }], 10);
  const a = M.ensureAging(legacy);
  ok(Array.isArray(a.groups) && a.groups.length === 1, 'an old record migrates to a single cohort');
  ok(a.groups[0].sex === 'F' && a.groups[0].startN === 10 && a.groups[0].events.length === 1, 'sex, N and events are preserved');
  ok(a.startN === undefined && a.events === undefined, 'the old fields are removed after migrating');
  ok(near(M.kmCurve(legacy, st).points.pop().surv, 0.8), 'the curve of the migrated record does not change (S = 0.8)');

  // new record: females and males at once, with independent curves
  const c = { aging: { groups: [
    { sex: 'M', startN: 20, vials: 1, events: [ev(10, 10)] },
    { sex: 'F', startN: 20, vials: 1, events: [ev(10, 5)] },
  ] } };
  const gs = M.cohortGroups(c);
  ok(M.hasCohort(c) && gs.length === 2, 'both cohorts count as loaded');
  ok(gs[0].sex === 'F' && gs[1].sex === 'M', 'sorted ♀ then ♂ (not in entry order)');
  ok(M.cohortIndex(c, gs[0]) === 1 && M.cohortAt(c, 1).sex === 'F', 'the index points to the real group inside aging.groups');
  ok(near(M.kmCurve(c, st, gs[0]).points.pop().surv, 0.75), '♀: S = 0.75 (5 deaths out of 20)');
  ok(near(M.kmCurve(c, st, gs[1]).points.pop().surv, 0.5), '♂: S = 0.5 (10 deaths out of 20), independent of ♀');
  ok(M.kmCurve(c, st, gs[0]).alive === 15 && M.kmCurve(c, st, gs[1]).alive === 10, 'the alive count is per cohort');
  ok(M.agingEvents(c).length === 2, 'events from all cohorts are seen together (fresh-food reminder)');
  ok(!M.hasCohort({ aging: { groups: [{ sex: 'F', startN: null, events: [] }] } }), 'a row with no N does not count as a loaded cohort');
});

/* ============================ 3) T50 FROM COUNTS (interpolation) ============================ */
group('T50 from counts (interpolation at 50 %)', () => {
  const D = (day) => new Date(ECL + day * 86400000).toISOString();
  const t50 = (counts, total) => M.computeT50FromCounts(counts, total);
  // 20 on day 9, 80 on day 10, total 100 → 50 % falls halfway → day 9.5
  const r = t50([{ t: D(9), n: 20 }, { t: D(10), n: 80 }], 100);
  ok(near((r - ECL) / 86400000, 9.5, 1e-6), '20→80 out of 100 ⇒ T50 = day 9.5');
  // another proportion: 18 and 52 out of 90 (half=45) → frac=(45-18)/(52-18)=27/34
  const r2 = t50([{ t: D(9), n: 18 }, { t: D(10), n: 52 }], 90);
  ok(near((r2 - ECL) / 86400000, 9 + 27 / 34, 1e-6), 'interpolates the exact fraction between two counts');
  ok(t50([{ t: D(9), n: 20 }], 100) === null, 'a single count ⇒ null (nothing to interpolate)');
  ok(t50([{ t: D(9), n: 10 }, { t: D(10), n: 20 }], 100) === null, 'if it never crosses the halfway point ⇒ null');
  ok(t50([{ t: D(9), n: 20 }, { t: D(10), n: 80 }], 0) === null, 'no total ⇒ null');
});

/* ============================ 4) PER-GENOTYPE CALIBRATION (v2: shrinkage) ============================ */
group('Calibration v2 — σ per observation (method + egg-lay window)', () => {
  const T0d = Date.parse('2025-01-01T00:00');
  const base25 = M.totalDays(25);   // base at 25 °C (≈8.80 d); with this construction, the observed factor = F
  // each obs in its own BATCH unless a shared one is passed
  const obs = (F, method, batch) => ({ t0: '2025-01-01T00:00', t50: new Date(T0d + F * base25 * 86400000).toISOString(), temp: 25, method, batch });

  ok(near(M.obsFactor(obs(1.1, 'eye', 'b1')), 1.1, 1e-6), 'obsFactor = observed / base (1.1)');
  ok(M.normGeno('  w[1118]   ;  CyO ') === 'w[1118] ; CyO', 'normGeno trims and collapses whitespace');

  // precision ordering: counting < by eye < "already happened" (smaller σ = more precise)
  const sC = M.obsSigmaFactor(obs(1, 'count', 'b')), sE = M.obsSigmaFactor(obs(1, 'eye', 'b')), sP = M.obsSigmaFactor(obs(1, 'past', 'b'));
  ok(sC < sE && sE < sP, 'σ: counting < by eye < "already happened"');
  // value for counting: √(σ_t0² + σ_t50²)/base, with σ_t50=0.15 d and a 6 h window (σ_t0=(6/24)/√12)
  const sT0 = (6 / 24) / Math.sqrt(12), sExpect = Math.sqrt(sT0 * sT0 + 0.15 * 0.15) / base25;
  ok(near(sC, sExpect, 1e-6), 'σ(counting) = √(σ_t0² + σ_t50²) / base');
  // a shorter egg-lay window ⇒ less uncertainty
  ok(M.obsSigmaFactor({ t0: '2025-01-01T00:00', t50: new Date(T0d + base25 * 86400000).toISOString(), temp: 25, method: 'count', windowH: 3 })
     < M.obsSigmaFactor({ t0: '2025-01-01T00:00', t50: new Date(T0d + base25 * 86400000).toISOString(), temp: 25, method: 'count', windowH: 12 }),
     'shorter egg-lay window ⇒ smaller σ');

  ok(M.obsBatch({ batch: 'x', t0: 'y' }) === 'x', 'obsBatch uses the batch id when present');
  ok(M.obsBatch({ t0: 'y' }) === 'y', 'obsBatch falls back to t0 as a proxy when there is no batch');
});

group('Calibration v2 — shrinkage towards the prior', () => {
  const T0d = Date.parse('2025-01-01T00:00');
  const base25 = M.totalDays(25);
  const obs = (F, method, batch) => ({ t0: '2025-01-01T00:00', t50: new Date(T0d + F * base25 * 86400000).toISOString(), temp: 25, method, batch });

  ok(M.calibInfo('unknown-genotype') === null && M.calibFactorValue('unknown-genotype') === 1, 'no data → null and factor 1 (base model)');

  // 1 batch by counting with F=1.3 → posterior BETWEEN 1 and 1.3 (shrunk), not 1.3
  M.saveCalib({ G: [obs(1.3, 'count', 'b1')] });
  const c1 = M.calibInfo('G');
  ok(c1.factor > 1 && c1.factor < 1.3, '1 obs of 1.3 → posterior shrunk inside (1, 1.3)');
  ok(near(c1.factor, 1.231, 2e-3), 'posterior value with 1 batch (counting) ≈ 1.231');
  ok(c1.state === 'calibrating' && c1.singleBatch === true, '1 batch → state "Calibrating" + single-batch warning');
  ok(near(M.calibFactorValue('G'), c1.factor, 1e-9), 'calibFactorValue returns the posterior mean');

  // 3 batches by counting with F=1.3 → less shrinkage (posterior closer to 1.3) and "Calibrated"
  M.saveCalib({ G: [obs(1.3, 'count', 'b1'), obs(1.3, 'count', 'b2'), obs(1.3, 'count', 'b3')] });
  const c3 = M.calibInfo('G');
  ok(c3.factor > c1.factor, '3 batches shrink less than 1 (posterior closer to the data)');
  ok(near(c3.factor, 1.273, 3e-3), 'posterior value with 3 batches (counting) ≈ 1.273');
  ok(c3.state === 'calibrated' && c3.singleBatch === false, '3 independent batches → "Calibrated"');
  ok(c3.conf === 'med' && c3.nBatch === 3, 'medium confidence with 3 batches; nBatch = 3');

  // a more precise method shrinks less: 1 count (c1, already captured) pulls more than 1 "by eye" (same F)
  M.saveCalib({ E: [obs(1.3, 'eye', 'b1')] });
  ok(c1.factor > M.calibInfo('E').factor, 'counting pulls towards the data more than "by eye" (same F, 1 batch)');

  // 5 batches → high confidence
  M.saveCalib({ H: [1, 2, 3, 4, 5].map(i => obs(1.2, 'count', 'b' + i)) });
  ok(M.calibInfo('H').conf === 'high', '≥5 batches → high confidence');

  // F=1.0 (equal to the base) → pct 0 and factor ≈ 1
  M.saveCalib({ B: [obs(1.0, 'count', 'b1'), obs(1.0, 'count', 'b2'), obs(1.0, 'count', 'b3')] });
  ok(M.calibInfo('B').pct === 0 && near(M.calibInfo('B').factor, 1, 1e-6), 'observations = base → factor 1, pct 0');
});

group('Calibration v2 — heterogeneity (state "Inconsistent")', () => {
  const T0d = Date.parse('2025-01-01T00:00');
  const base25 = M.totalDays(25);
  const obs = (F, method, batch) => ({ t0: '2025-01-01T00:00', t50: new Date(T0d + F * base25 * 86400000).toISOString(), temp: 25, method, batch });

  // 3 precise batches that DISAGREE (1.0 / 1.5 / 1.0) → high I² → "Inconsistent"
  M.saveCalib({ D: [obs(1.0, 'count', 'b1'), obs(1.5, 'count', 'b2'), obs(1.0, 'count', 'b3')] });
  ok(M.calibInfo('D').state === 'inconsistent', 'batches disagreeing by more than their error → "Inconsistent"');

  // 3 consistent batches (1.1 by eye) → NOT inconsistent (within their σ), "Calibrated"
  M.saveCalib({ C: [obs(1.1, 'eye', 'b1'), obs(1.1, 'eye', 'b2'), obs(1.1, 'eye', 'b3')] });
  ok(M.calibInfo('C').state === 'calibrated', 'consistent batches → "Calibrated", not inconsistent');

  // observations from the SAME batch do not count as independent replicates
  M.saveCalib({ S: [obs(1.2, 'count', 'same'), obs(1.2, 'count', 'same'), obs(1.2, 'count', 'same')] });
  ok(M.calibInfo('S').nBatch === 1 && M.calibInfo('S').singleBatch === true, '3 obs from a single batch ⇒ nBatch 1 (they are not independent)');
});

group('Calibration v2 — t₀ modes (uncertainty in the start of egg-laying)', () => {
  const sqrt12 = Math.sqrt(12);
  ok(near(M.obsSigmaT0Days({}), (6 / 24) / sqrt12, 1e-9), 'bounded t₀ by default = (6 h/24)/√12');
  ok(M.obsSigmaT0Days({ windowH: 3 }) < M.obsSigmaT0Days({ windowH: 12 }), 'shorter window ⇒ smaller σ_t₀');
  ok(M.obsSigmaT0Days({ t0Mode: 'crossday' }) === M.CALIB_SIGMA_T0_CROSSDAY, '"cross day" mode uses its fixed σ');
  ok(M.obsSigmaT0Days({ t0Mode: 'unknown' }) === M.CALIB_SIGMA_T0_UNKNOWN, '"unknown" mode uses its fixed σ');
  ok(M.obsSigmaT0Days({}) < M.obsSigmaT0Days({ t0Mode: 'crossday' }) && M.obsSigmaT0Days({ t0Mode: 'crossday' }) < M.obsSigmaT0Days({ t0Mode: 'unknown' }),
     'σ_t₀: bounded < cross day < unknown');

  // a more uncertain t₀ ⇒ larger σ of the factor ⇒ the posterior shrinks more (it weighs less)
  const T0d = Date.parse('2025-01-01T00:00'), base25 = M.totalDays(25);
  const t50 = new Date(T0d + 1.3 * base25 * 86400000).toISOString();
  M.saveCalib({ B: [{ t0: '2025-01-01T00:00', t50, temp: 25, method: 'eye', batch: 'b1' }] });          // bounded
  const fBounded = M.calibInfo('B').factor;
  M.saveCalib({ X: [{ t0: '2025-01-01T00:00', t50, temp: 25, method: 'eye', t0Mode: 'crossday', batch: 'b1' }] });
  const fCross = M.calibInfo('X').factor;
  ok(fBounded > fCross && fCross > 1, 'with a "cross day" t₀ the posterior shrinks more than with a bounded egg-lay');

  // saving flow (what recordT50/saveCountCalib do): addCalibObs persists the mode
  M.saveCalib({});
  M.addCalibObs('G', '2025-01-01T00:00', t50, 25, 'eye', 'cid', undefined, 'crossday');
  const recCross = M.loadCalib()['G'][0];
  ok(recCross.t0Mode === 'crossday' && recCross.batch === 'cid', 'addCalibObs stores t0Mode and batch');
  M.saveCalib({});
  M.addCalibObs('G', '2025-01-01T00:00', t50, 25, 'count', 'cid', 4, 'bounded');
  const recBounded = M.loadCalib()['G'][0];
  ok(recBounded.t0Mode === undefined && recBounded.windowH === 4, 'bounded mode: does not store t0Mode but does store the window (4 h)');
});

group('Two-level calibration — laboratory (wild-type) + genotype', () => {
  const T0d = Date.parse('2025-01-01T00:00'), base25 = M.totalDays(25);
  const obs = (F, m, b) => ({ t0: '2025-01-01T00:00', t50: new Date(T0d + F * base25 * 86400000).toISOString(), temp: 25, method: m, batch: b });
  const three = F => [obs(F, 'count', 'b1'), obs(F, 'count', 'b2'), obs(F, 'count', 'b3')];

  // the estimator shrinks towards whatever prior it is given (not only towards 1 = literature)
  M.saveCalib({ G: three(1.3) });
  ok(M.calibInfo('G', 1.2).factor > M.calibInfo('G', 1).factor, 'higher prior (lab) ⇒ higher posterior (shrinks towards the lab)');
  ok(M.calibInfo('G', 1.3).pct === 0, 'pct = 0 when the genotype matches the lab prior');
  ok(M.calibInfo('G', 1).pct === Math.round((M.calibInfo('G', 1).factor - 1) * 100), 'with prior 1, pct is relative to the literature (back-compat)');

  // the lab's reference wild-type
  M.saveCalib({ 'Canton-S': three(1.1), G: three(1.3) });
  M.saveLabRef('Canton-S');
  ok(M.isLabRef('Canton-S') === true && M.isLabRef('G') === false, 'isLabRef flags only the wild-type');
  const labF = M.labFactorValue();
  ok(labF > 1 && labF < 1.1, "the lab factor is shrunk towards the literature (between 1 and 1.1)");
  ok(Math.abs(M.calibInfoFor('Canton-S').factor - M.calibInfo('Canton-S', 1).factor) < 1e-9, 'the wild-type shrinks towards the literature (prior 1)');
  ok(Math.abs(M.calibInfoFor('G').factor - M.calibInfo('G', labF).factor) < 1e-9, 'a genotype shrinks towards the lab factor');

  // calibFactorValue hierarchy
  ok(Math.abs(M.calibFactorValue('never-seen') - labF) < 1e-9, 'an uncalibrated genotype ⇒ uses the lab factor');
  ok(M.calibFactorValue('Canton-S') === M.calibInfoFor('Canton-S').factor, 'the wild-type uses its own factor (vs the literature)');
  ok(M.calibFactorValue('G') === M.calibInfoFor('G').factor && M.calibFactorValue('G') > labF, 'a calibrated genotype uses its posterior (vs the lab) and develops more slowly than the lab');

  // with no reference wild-type ⇒ single-level behaviour (backward compatible)
  M.saveLabRef('');
  ok(M.labFactorValue() === 1 && M.calibFactorValue('never-seen') === 1, 'no lab reference ⇒ factor 1 (literature only)');
});

/* ============================ 6) LOG-RANK AND χ² (comparing cohorts) ============================ */
group('χ² — upper-tail p-value (incomplete gamma)', () => {
  ok(near(M.chiSqUpper(3.8415, 1), 0.05, 2e-3), 'χ²=3.841, df=1 → p ≈ 0.05');
  ok(near(M.chiSqUpper(5.9915, 2), 0.05, 2e-3), 'χ²=5.991, df=2 → p ≈ 0.05');
  ok(near(M.chiSqUpper(7.8147, 3), 0.05, 2e-3), 'χ²=7.815, df=3 → p ≈ 0.05');
  ok(near(M.chiSqUpper(2.7055, 1), 0.10, 2e-3), 'χ²=2.706, df=1 → p ≈ 0.10');
  ok(M.chiSqUpper(0, 1) === 1, 'χ²=0 → p = 1');
  ok(Math.abs(Math.exp(M.lgamma(5)) - 24) < 1e-6, 'lgamma(5) → ln(4!) (Γ(5)=24)');
});

group('Log-rank (Mantel–Haenszel) between cohorts', () => {
  // Interleaved example (computed by hand): G1 dies on days 1 and 3; G2 on 2 and 4 (n0=2 each).
  // O1=2, E1=1.3333, V11=0.7222 → χ² = 0.6667²/0.7222 = 0.6155, df=1.
  const g1 = { n0: 2, times: [{ day: 1, d: 1, c: 0 }, { day: 3, d: 1, c: 0 }] };
  const g2 = { n0: 2, times: [{ day: 2, d: 1, c: 0 }, { day: 4, d: 1, c: 0 }] };
  const lr = M.logRankTest([g1, g2]);
  ok(near(lr.chi2, 0.6155, 2e-3), 'χ² of the interleaved example ≈ 0.6155 (by hand)');
  ok(lr.df === 1, '2 groups → df = 1');
  ok(near(lr.O[0], 2, 1e-9) && near(lr.E[0], 1.3333, 1e-3), 'O1=2, E1≈1.333');
  ok(lr.p > 0.42 && lr.p < 0.45, 'p ≈ 0.43 (no significant difference)');

  // identical cohorts → no difference (χ² ≈ 0, p ≈ 1)
  const same = { n0: 10, times: [{ day: 5, d: 3, c: 0 }, { day: 10, d: 4, c: 0 }] };
  const lr0 = M.logRankTest([same, { ...same, times: same.times.map(t => ({ ...t })) }]);
  ok(near(lr0.chi2, 0, 1e-9) && near(lr0.p, 1, 1e-9), 'identical cohorts → χ²=0, p=1');

  // strong separation → large χ², small p
  const early = { n0: 8, times: [{ day: 1, d: 4, c: 0 }, { day: 2, d: 4, c: 0 }] };
  const late = { n0: 8, times: [{ day: 9, d: 4, c: 0 }, { day: 10, d: 4, c: 0 }] };
  const lrsep = M.logRankTest([early, late]);
  ok(lrsep.chi2 > 3.84 && lrsep.p < 0.05, 'well-separated cohorts → χ² > 3.84, p < 0.05');

  // 3 groups → df = 2
  ok(M.logRankTest([g1, g2, { n0: 2, times: [{ day: 5, d: 2, c: 0 }] }]).df === 2, '3 groups → df = 2');
  ok(M.logRankTest([g1]) === null, 'a single group → null (nothing to compare)');
});

/* ============================ 7) STATISTICAL PLANNING ============================ */
group('Normal quantile (normInv) and log-rank sample size (Schoenfeld)', () => {
  ok(near(M.normInv(0.975), 1.95996, 1e-4), 'normInv(0.975) ≈ 1.95996');
  ok(near(M.normInv(0.80), 0.84162, 1e-4), 'normInv(0.80) ≈ 0.84162');
  ok(near(M.normInv(0.5), 0, 1e-6), 'normInv(0.5) = 0');
  ok(near(M.normInv(0.025), -1.95996, 1e-4), 'normInv(0.025) ≈ -1.95996 (symmetric)');

  // HR=2, α=0.05 (two-sided), power 0.80 → ~66 total events (standard Schoenfeld reference)
  const p = M.logRankPlan(40, 20, 0.05, 0.80, 1);
  ok(near(p.hr, 2, 1e-9), 'HR = m1/m2 = 40/20 = 2');
  ok(p.events === 66, 'HR=2, power 0.80 → 66 events (Schoenfeld)');
  ok(p.nPerGroup === 33 && p.nTotal === 66, 'with ~100% mortality → 33 per group, 66 in total');

  // incomplete mortality (60% die) raises the required N
  const p60 = M.logRankPlan(40, 20, 0.05, 0.80, 0.6);
  ok(p60.nPerGroup > p.nPerGroup, 'lower expected mortality ⇒ more flies needed');

  // more power ⇒ more events; a smaller effect (HR closer to 1) ⇒ many more
  ok(M.logRankPlan(40, 20, 0.05, 0.90, 1).events > p.events, '90% power asks for more events than 80%');
  ok(M.logRankPlan(40, 30, 0.05, 0.80, 1).events > p.events, 'a smaller effect (HR 1.33) asks for more events');
  ok(M.logRankPlan(20, 20, 0.05, 0.80, 1) === null, 'equal medians (no effect) → null');

  // duration: Weibull model (shape > 1) for the real fly pattern (short tail, not exponential)
  ok(near(M.timeToMortality(30, 0.5), 30, 1e-9), 'the median maps to itself (q=0.5 ⇒ time = median)');
  ok(near(M.timeToMortality(30, 0.9), 30 * Math.pow(Math.log2(10), 1/M.SURV_SHAPE), 1e-6), 'time to 90% = median · (log2(10))^(1/shape)');
  ok(M.timeToMortality(30, 0.5) < M.timeToMortality(30, 0.9), 'higher target mortality ⇒ more time');
  // shorter tail than the exponential: at 90% it gives ~1.5× the median, not ~3.3×
  ok(M.timeToMortality(50, 0.9) < 50 * Math.log2(10) && M.timeToMortality(50, 0.9) > 50, 'Weibull tail < exponential tail (avoids overestimating the duration)');
  ok(near(M.timeToMortality(50, 0.9) / 50, 1.49, 0.05), 'at 90% mortality ≈ 1.5× the median (realistic for Drosophila)');
});

/* ============================ summary ============================ */
console.log(`\n${'─'.repeat(48)}\n${fail === 0 ? '✓ ALL OK' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
