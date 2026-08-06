/*
 * Simulation study of DrosoTracker's calibration estimator.
 * Extracts the REAL functions from index.html (same technique as tests/run-tests.mjs)
 * and evaluates the shrinkage estimator against a naive per-batch mean.
 */
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function grabBalanced(src, fromIdx, open, close) {
  let depth = 0, start = src.indexOf(open, fromIdx);
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
const M = new Function(code + '\nreturn { CALIB_PRIOR_SD, CALIB_SIGMA_BATCH, CALIB_SIGMA_T50, totalDays, saveCalib, calibInfo, addCalibObs, obsFactor, obsSigmaFactor };')();

/* --- seeded RNG --- */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const rnd = mulberry32(20260804);
let spare=null;
function gauss(){ if(spare!=null){const s=spare;spare=null;return s;} let u,v,s2; do{u=2*rnd()-1; v=2*rnd()-1; s2=u*u+v*v;}while(s2>=1||s2===0); const m=Math.sqrt(-2*Math.log(s2)/s2); spare=v*m; return u*m; }

const TEMP = 25;
const BASE = M.totalDays(TEMP);              // literature-model days at 25 C
const WINDOW_H = 6;                          // bounded egg-lay window
const SIG_T50 = M.CALIB_SIGMA_T50.count;     // 0.15 d, interpolated count
const SIG_T0  = (WINDOW_H/24)/Math.sqrt(12);
const SIG_MEAS = Math.sqrt(SIG_T50*SIG_T50 + SIG_T0*SIG_T0);   // days
const TAU_TRUE = M.CALIB_SIGMA_BATCH;        // 0.08, true between-batch SD (factor units)
const T0_MS = Date.UTC(2026,0,1,0,0,0);

function runOne(fTrue, nBatch){
  M.saveCalib({});
  const geno = 'SIM';
  const obsF = [];
  for(let b=0;b<nBatch;b++){
    const fBatch = fTrue + TAU_TRUE*gauss();
    const observedDays = fBatch*BASE + SIG_MEAS*gauss();
    const t0 = new Date(T0_MS + b*1000*3600*24*30).toISOString();
    const t50 = new Date(new Date(t0).getTime() + observedDays*86400000).toISOString();
    M.addCalibObs(geno, t0, t50, TEMP, 'count', 'batch'+b, WINDOW_H, 'bounded');
    obsF.push(observedDays/BASE);
  }
  const ci = M.calibInfo(geno, 1);
  const naive = obsF.reduce((a,b)=>a+b,0)/obsF.length;
  return { post: ci.factor, sd: ci.sdPost, naive, state: ci.state };
}

function study(label, drawTrue, reps){
  console.log('\n=== ' + label + ' ===');
  console.log('batches   bias(post)  RMSE(post)  RMSE(naive)  gain%   cover95(post)  cover95(naive)');
  for(const K of [1,2,3,5,10]){
    let bias=0, se=0, sn=0, cov=0, covN=0;
    for(let r=0;r<reps;r++){
      const fTrue = drawTrue();
      const o = runOne(fTrue, K);
      bias += (o.post - fTrue);
      se += (o.post - fTrue)**2;
      sn += (o.naive - fTrue)**2;
      if(Math.abs(o.post - fTrue) <= 1.96*o.sd) cov++;
      // naive interval: SD of the K batch factors / sqrt(K), t-free approximation using the model's own per-batch SD
      const sdN = Math.sqrt(TAU_TRUE*TAU_TRUE + (SIG_MEAS/BASE)**2)/Math.sqrt(K);
      if(Math.abs(o.naive - fTrue) <= 1.96*sdN) covN++;
    }
    const rmseP = Math.sqrt(se/reps), rmseN = Math.sqrt(sn/reps);
    console.log(String(K).padStart(5),
      (bias/reps).toFixed(4).padStart(12),
      rmseP.toFixed(4).padStart(11),
      rmseN.toFixed(4).padStart(12),
      (100*(1-rmseP/rmseN)).toFixed(1).padStart(7),
      (100*cov/reps).toFixed(1).padStart(14),
      (100*covN/reps).toFixed(1).padStart(15));
  }
}

console.log('base days at 25 C =', BASE.toFixed(3), '| sigma_meas =', SIG_MEAS.toFixed(4), 'd =',
            (SIG_MEAS/BASE*100).toFixed(2), '% of the factor | tau_true =', TAU_TRUE, '| prior SD =', M.CALIB_PRIOR_SD);

study('A. Fixed genotype, true factor = 1.12 (12 % slower)', () => 1.12, 4000);
study('B. True factor drawn from the prior N(1, 0.15^2)', () => 1 + M.CALIB_PRIOR_SD*gauss(), 4000);

/* convergence of the point estimate for the fixed genotype */
console.log('\n=== C. Mean posterior factor, true = 1.12 ===');
for(const K of [1,2,3,5,10,20]){
  let s=0; const reps=4000;
  for(let r=0;r<reps;r++) s += runOne(1.12, K).post;
  console.log('  batches', String(K).padStart(2), '-> mean posterior', (s/reps).toFixed(4),
              ' (shrinkage remaining:', (100*(1.12-s/reps)/0.12).toFixed(1)+'% of the deviation)');
}
