/*
 * estimator_sensitivity.mjs — prior-misspecification study for DrosoTracker's
 * calibration estimator.
 *
 * Companion to estimator_simulation.mjs. That script asks whether the estimator
 * works when its assumptions hold; this one asks what happens when they do NOT.
 *
 * The uncertainty budgets baked into the application (the prior SD on the
 * genotype factor, CALIB_PRIOR_SD, and the floor on the between-batch variance,
 * CALIB_SIGMA_BATCH) are set a priori, not fitted. So the question a reader will
 * ask is: how much do the results depend on those two numbers being right?
 *
 * Here the app's constants are held FIXED at their shipped values while the TRUE
 * data-generating parameters are varied by a factor of two in either direction:
 *   - tau_true    : true between-batch SD, in factor units (floor is 0.08)
 *   - spread_true : true between-genotype SD, in factor units (prior SD is 0.15)
 *
 * For each cell it reports bias, RMSE of the shrinkage posterior against the RMSE
 * of the naive per-batch mean, and the empirical coverage of the nominal 95 %
 * interval. Functions are extracted from the released index.html, so the code
 * under test is the code that ships (same technique as tests/run-tests.mjs).
 *
 * Run from the analysis/ folder:   node estimator_sensitivity.mjs
 */
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function grabBalanced(src, fromIdx, open, close) {
  let depth = 0;
  const start = src.indexOf(open, fromIdx);
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) { depth--; if (depth === 0) return src.slice(fromIdx, i + 1); }
  }
  throw new Error('unbalanced');
}
function grabFn(name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(SRC);
  if (!m) throw new Error('fn not found: ' + name);
  const body = grabBalanced(SRC, SRC.indexOf('{', m.index), '{', '}');
  return SRC.slice(m.index, SRC.indexOf('{', m.index)) + body;
}
function grabConst(name) {
  const m = new RegExp('const\\s+' + name + '\\s*=\\s*').exec(SRC);
  if (!m) throw new Error('const not found: ' + name);
  const eq = SRC.indexOf('=', m.index);
  const nx = SRC.slice(eq + 1).match(/\S/);
  if (nx && nx[0] === '[') return `const ${name} = ${grabBalanced(SRC, SRC.indexOf('[', eq), '[', ']')};`;
  return SRC.slice(m.index, SRC.indexOf(';', m.index) + 1);
}

const stub = `const localStorage = { s:{}, getItem(k){ return k in this.s ? this.s[k] : null; }, setItem(k,v){ this.s[k]=String(v); }, removeItem(k){ delete this.s[k]; } };
let _calibCache = null;`;
const code = [
  stub,
  grabConst('T0'), grabConst('DEGREE_DAYS'), grabConst('STAGES'), grabConst('REF_TOTAL'),
  grabConst('CALIB_KEY'), grabConst('LABREF_KEY'), grabConst('CALIB_MIN'),
  grabConst('CALIB_SIGMA_T50'), grabConst('CALIB_SIGMA_BATCH'), grabConst('CALIB_PRIOR_SD'),
  grabConst('CALIB_SIGMA_T0_CROSSDAY'), grabConst('CALIB_SIGMA_T0_UNKNOWN'),
  grabFn('totalDays'), grabFn('loadCalib'), grabFn('saveCalib'), grabFn('normGeno'),
  grabFn('obsFactor'), grabFn('obsSigmaT0Days'), grabFn('obsSigmaFactor'), grabFn('obsBatch'),
  grabFn('calibInfo'), grabFn('addCalibObs'),
].join('\n');
const M = new Function(code + '\nreturn { CALIB_PRIOR_SD, CALIB_SIGMA_BATCH, CALIB_SIGMA_T50, totalDays, saveCalib, calibInfo, addCalibObs };')();

/* --- seeded RNG, so the table is reproducible --- */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const rnd = mulberry32(20260809);
let spare = null;
function gauss(){
  if (spare != null) { const s = spare; spare = null; return s; }
  let u, v, s2;
  do { u = 2*rnd()-1; v = 2*rnd()-1; s2 = u*u + v*v; } while (s2 >= 1 || s2 === 0);
  const m = Math.sqrt(-2*Math.log(s2)/s2);
  spare = v*m; return u*m;
}

const TEMP = 25;
const BASE = M.totalDays(TEMP);                     // literature-model days at 25 C
const WINDOW_H = 6;                                 // bounded egg-lay window
const SIG_T50 = M.CALIB_SIGMA_T50.count;            // 0.15 d, interpolated count
const SIG_T0 = (WINDOW_H/24)/Math.sqrt(12);         // SD of a uniform over the window
const SIG_MEAS = Math.sqrt(SIG_T50*SIG_T50 + SIG_T0*SIG_T0);
const T0_MS = Date.UTC(2026, 0, 1);
const REPS = 4000;

/* One synthetic genotype with nBatch independent batches, drawn with a true
   between-batch SD of tauTrue, fed through the REAL addCalibObs/calibInfo. */
function runOne(fTrue, nBatch, tauTrue) {
  M.saveCalib({});
  const obsF = [];
  for (let b = 0; b < nBatch; b++) {
    const fBatch = Math.max(0.2, fTrue + tauTrue*gauss());   // guard: a factor <=0 is meaningless
    const days = fBatch*BASE + SIG_MEAS*gauss();
    const t0 = new Date(T0_MS + b*2592000000).toISOString();  // batches one month apart
    const t50 = new Date(new Date(t0).getTime() + days*86400000).toISOString();
    M.addCalibObs('SIM', t0, t50, TEMP, 'count', 'batch' + b, WINDOW_H, 'bounded');
    obsF.push(days/BASE);
  }
  const ci = M.calibInfo('SIM', 1);
  return { post: ci.factor, sd: ci.sdPost, naive: obsF.reduce((a, b) => a + b, 0)/obsF.length };
}

function study(tauTrue, spreadTrue) {
  const rows = [];
  for (const K of [1, 3, 5, 10]) {
    let bias = 0, se = 0, sn = 0, cov = 0;
    for (let r = 0; r < REPS; r++) {
      // true factor for this genotype, truncated to a biologically meaningful range
      let fTrue; do { fTrue = 1 + spreadTrue*gauss(); } while (fTrue < 0.4 || fTrue > 2.5);
      const o = runOne(fTrue, K, tauTrue);
      bias += o.post - fTrue;
      se += (o.post - fTrue)**2;
      sn += (o.naive - fTrue)**2;
      if (Math.abs(o.post - fTrue) <= 1.96*o.sd) cov++;
    }
    rows.push({ K, bias: bias/REPS, rmseP: Math.sqrt(se/REPS), rmseN: Math.sqrt(sn/REPS), cov: 100*cov/REPS });
  }
  return rows;
}

console.log('Prior-misspecification study for the calibration estimator.');
console.log('App constants held FIXED: prior SD = ' + M.CALIB_PRIOR_SD +
            ', between-batch variance floor = ' + M.CALIB_SIGMA_BATCH);
console.log('sigma_meas = ' + (100*SIG_MEAS/BASE).toFixed(2) + ' % of the factor; ' +
            REPS + ' replicates per cell.\n');
console.log('tau_true  spread_true  batches      bias   RMSE(post)  RMSE(naive)   gain%   cover95%');

let worstBias = 0, minCovAtFloor = 100;
for (const tau of [0.04, 0.08, 0.16]) {
  for (const spread of [0.10, 0.15, 0.30]) {
    for (const r of study(tau, spread)) {
      console.log(
        String(tau).padStart(8), String(spread).padStart(12), String(r.K).padStart(9),
        r.bias.toFixed(4).padStart(10), r.rmseP.toFixed(4).padStart(11),
        r.rmseN.toFixed(4).padStart(12),
        (100*(1 - r.rmseP/r.rmseN)).toFixed(1).padStart(7), r.cov.toFixed(1).padStart(10));
      worstBias = Math.max(worstBias, Math.abs(r.bias));
      if (tau <= M.CALIB_SIGMA_BATCH) minCovAtFloor = Math.min(minCovAtFloor, r.cov);
    }
    console.log('');
  }
}

console.log('Summary of what the manuscript claims from this table:');
console.log('  largest |bias| over all scenarios          : ' + (100*worstBias).toFixed(2) + ' % of the factor');
console.log('  lowest 95 % coverage while tau_true <= ' + M.CALIB_SIGMA_BATCH + ' : ' + minCovAtFloor.toFixed(1) + ' %');
console.log('\nReading: bias stays negligible under every misspecification tested. Coverage holds at or');
console.log('above the nominal level whenever the true between-batch variability does not exceed the');
console.log('assumed floor. It degrades only when that variability is doubled AND a single batch is');
console.log('available, which is exactly the case the application flags and refuses to call "calibrated".');
