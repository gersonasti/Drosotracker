/*
 * DrosoTracker — test suite (sin dependencias externas).
 *
 * Extrae las funciones científicas REALES de index.html (no una copia)
 * y las verifica contra valores calculados a mano / referencias independientes.
 *
 * Correr:  node tests/run-tests.mjs
 * Sale con código != 0 si algún test falla (apto para CI).
 */
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

/* ---- extracción por conteo de llaves/corchetes (roba el texto real de la función) ---- */
function grabBalanced(src, fromIdx, open, close) {
  let depth = 0, start = src.indexOf(open, fromIdx);
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) { depth--; if (depth === 0) return src.slice(fromIdx, i + 1); }
  }
  throw new Error('bloque no balanceado desde ' + fromIdx);
}
function grabFn(name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(SRC);
  if (!m) throw new Error('función no encontrada: ' + name);
  const body = grabBalanced(SRC, SRC.indexOf('{', m.index), '{', '}');
  return SRC.slice(m.index, SRC.indexOf('{', m.index)) + body;
}
function grabConst(name) {
  const m = new RegExp('const\\s+' + name + '\\s*=\\s*').exec(SRC);
  if (!m) throw new Error('const no encontrada: ' + name);
  // array multilínea → balancear corchetes; escalar → hasta el ';'
  const eq = SRC.indexOf('=', m.index);
  const nextNonSpace = SRC.slice(eq + 1).match(/\S/);
  if (nextNonSpace && nextNonSpace[0] === '[') {
    const arr = grabBalanced(SRC, SRC.indexOf('[', eq), '[', ']');
    return `const ${name} = ${arr};`;
  }
  return SRC.slice(m.index, SRC.indexOf(';', m.index) + 1);
}

// stub mínimo de localStorage para las funciones de calibración (loadCalib/saveCalib)
const stub = `const localStorage = { s:{}, getItem(k){ return k in this.s ? this.s[k] : null; }, setItem(k,v){ this.s[k]=String(v); }, removeItem(k){ delete this.s[k]; } };
let _calibCache = null;`;
const code = [
  stub,
  grabConst('T0'), grabConst('DEGREE_DAYS'), grabConst('STAGES'), grabConst('REF_TOTAL'),
  grabConst('CALIB_KEY'), grabConst('LABREF_KEY'), grabConst('CALIB_MIN'),
  grabConst('CALIB_SIGMA_T50'), grabConst('CALIB_SIGMA_BATCH'), grabConst('CALIB_PRIOR_SD'),
  grabConst('CALIB_SIGMA_T0_CROSSDAY'), grabConst('CALIB_SIGMA_T0_UNKNOWN'),
  grabFn('totalDays'), grabFn('stageBounds'), grabFn('ensureAging'), grabFn('kmCurve'), grabFn('computeT50FromCounts'),
  grabFn('loadCalib'), grabFn('saveCalib'), grabFn('normGeno'), grabFn('obsFactor'), grabFn('obsSigmaT0Days'), grabFn('obsSigmaFactor'), grabFn('obsBatch'), grabFn('calibInfo'), grabFn('calibFactorValue'), grabFn('addCalibObs'),
  grabFn('loadLabRef'), grabFn('saveLabRef'), grabFn('isLabRef'), grabFn('labFactorValue'), grabFn('calibInfoFor'),
  grabFn('lgamma'), grabFn('gammincQ'), grabFn('chiSqUpper'), grabFn('quadFormSolve'), grabFn('logRankTest'),
  grabConst('SURV_SHAPE'), grabFn('normInv'), grabFn('logRankPlan'), grabFn('timeToMortality'),
].join('\n');
const M = new Function(code + '\nreturn { T0, DEGREE_DAYS, REF_TOTAL, STAGES, CALIB_MIN, CALIB_SIGMA_T50, CALIB_SIGMA_BATCH, CALIB_PRIOR_SD, CALIB_SIGMA_T0_CROSSDAY, CALIB_SIGMA_T0_UNKNOWN, SURV_SHAPE, totalDays, stageBounds, ensureAging, kmCurve, computeT50FromCounts, loadCalib, saveCalib, calibInfo, calibFactorValue, obsSigmaT0Days, obsSigmaFactor, obsBatch, normGeno, obsFactor, addCalibObs, loadLabRef, saveLabRef, isLabRef, labFactorValue, calibInfoFor, lgamma, gammincQ, chiSqUpper, quadFormSolve, logRankTest, normInv, logRankPlan, timeToMortality };')();

/* ---- mini framework ---- */
let pass = 0, fail = 0;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FALLA: ' + msg); } }
function group(name, fn) { console.log('\n▶ ' + name); fn(); }

/* ============================ 1) MODELO DE DESARROLLO ============================ */
group('Modelo de desarrollo (suma térmica, Powsner 1935 · ~15–28 °C)', () => {
  // Constantes calibradas (transcripción verificada): T0 = 11.78 °C, DD = 116 (no hardcodear: se leen del módulo).
  ok(near(M.T0, 11.78) && near(M.DEGREE_DAYS, 116), 'constantes = T0 11.78 / DD 116 (Powsner, n=13)');
  ok(near(M.totalDays(25), M.DEGREE_DAYS / (25 - M.T0)), 'totalDays sigue D(T)=DD/(T−T0)');
  ok(near(M.totalDays(25), 8.77, 1e-2), '25 °C ≈ 8.77 d (antes 10)');
  ok(near(M.totalDays(18), 18.65, 1e-2), '18 °C ≈ 18.6 d');
  ok(near(M.totalDays(29), 6.74, 1e-2), '29 °C ≈ 6.74 d');
  ok(near(M.totalDays(16), 27.49, 1e-2), '16 °C ≈ 27.5 d (T0 alto ⇒ cerca del umbral tarda más)');
  ok(near(M.totalDays(20), 14.11, 1e-2), '20 °C ≈ 14.1 d');
  ok(near(M.totalDays(25, 1.1), 1.1 * M.totalDays(25)), 'el factor escala el total linealmente');
  ok(M.totalDays(29) < M.totalDays(25) && M.totalDays(25) < M.totalDays(18), 'monótona: más calor = más rápido');

  const b = M.stageBounds(25);
  ok(near(b[b.length - 1].end, M.totalDays(25)), 'los estadios suman el total de desarrollo');
  ok(b.every((s, i) => i === 0 || s.start >= b[i - 1].start), 'límites de estadio crecientes');
  ok(near(M.stageBounds(25, 1.1)[4].end, 1.1 * M.totalDays(25)), 'los límites escalan con el factor');
  // Reparto de estadios recalibrado: el error viejo estaba casi todo en la pupa (§5.6).
  ok(near(b[4].start, 4.80, 0.05), 'pupación a 25 °C ≈ día 4.8 (fin de L3, casi sin cambio)');
  ok(near(b[4].end - b[4].start, 4.00, 0.05), 'pupa a 25 °C dura ~4.0 d (antes 5.0 · sobreestimada ~25 %)');
  ok(near(b[0].end, 0.86, 0.03), 'embrión a 25 °C ≈ 0.86 d');
});

/* ============================ 2) KAPLAN–MEIER ============================ */
/* Dataset canónico con censura (N=10), median y S(t) calculables a mano y por R (ver R-crosscheck.md).
 * muertes en 4,8,8,10,14,14,16 ; censuras en 6,12,18
 * S(t): 4→0.9, 8→0.675, 10→0.5625, 14→0.28125, 16→0.140625 ; mediana = 14 (primer t con S≤0.5) */
const ECL = Date.UTC(2025, 0, 1);
const mkCross = (events, startN) => ({
  aging: {
    startN, sex: 'F', vials: 1,
    events: events.map(e => ({ date: new Date(ECL + e.day * 86400000).toISOString(), deaths: e.deaths || 0, censored: e.censored || 0 })),
  },
});
const st = { eclosionDate: new Date(ECL), adultAge: 25 };
const survAt = (km, day) => { const p = km.points.find(p => near(p.day, day)); return p ? p.surv : null; };

/* referencia KM independiente (implementada desde cero) para contraste cruzado */
function refKM(events, startN) {
  const byDay = {};
  events.forEach(e => { (byDay[e.day] = byDay[e.day] || { day: e.day, d: 0, c: 0 }); byDay[e.day].d += e.deaths || 0; byDay[e.day].c += e.censored || 0; });
  const times = Object.values(byDay).sort((a, b) => a.day - b.day);
  let n = startN, S = 1, median = null; const map = { 0: 1 };
  for (const t of times) { if (n > 0 && t.d > 0) { S *= 1 - t.d / n; if (median === null && S <= 0.5) median = t.day; } n -= t.d + t.c; map[t.day] = S; }
  return { median, S: map };
}

group('Kaplan–Meier — dataset canónico con censura (vs cálculo a mano)', () => {
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
  ok(km.median === 14, 'mediana = 14 (primer t con S ≤ 0.5)');
  ok(km.maxLife === 16, 'máximo observado (última muerte) = 16');
  ok(km.deaths === 7 && km.censored === 3, 'conteos: 7 muertes + 3 censuras = 10');
  ok(km.alive === 0, 'vivas al final = 0');
});

group('Kaplan–Meier — censurar (en vez de morir) sube la supervivencia estimada', () => {
  // Idénticos salvo el evento del día 5: muerte vs censura (N=10).
  //  X (muere el día 5):  día5 S=0.9, n→9 ; día10 S=0.9·(8/9)=0.8
  //  Y (se censura día 5): día5 S=1, n→9  ; día10 S=1·(8/9)=0.8889
  const X = M.kmCurve(mkCross([{ day: 5, deaths: 1 }, { day: 10, deaths: 1 }], 10), st);
  const Y = M.kmCurve(mkCross([{ day: 5, censored: 1 }, { day: 10, deaths: 1 }], 10), st);
  const xf = X.points[X.points.length - 1].surv, yf = Y.points[Y.points.length - 1].surv;
  ok(near(xf, 0.8), 'con muerte el día 5 → S final = 0.8');
  ok(near(yf, 8 / 9), 'con censura el día 5 → S final = 8/9 ≈ 0.889');
  ok(yf > xf, 'censurar (no morir) sube la supervivencia estimada');
});

group('Kaplan–Meier — contraste contra referencia independiente', () => {
  const datasets = [
    [{ day: 3, deaths: 2 }, { day: 7, deaths: 3 }, { day: 9, censored: 1 }, { day: 12, deaths: 4 }],
    [{ day: 5, deaths: 1 }, { day: 5, deaths: 1 }, { day: 8, censored: 2 }, { day: 20, deaths: 6 }], // empates en día 5
    [{ day: 10, deaths: 10 }], // todas mueren el mismo día
  ];
  datasets.forEach((data, i) => {
    const N = data.reduce((s, e) => s + (e.deaths || 0) + (e.censored || 0), 0);
    const km = M.kmCurve(mkCross(data, N), st);
    const ref = refKM(data, N);
    ok(km.median === ref.median, `dataset ${i + 1}: mediana coincide con la referencia (${ref.median})`);
    const allDays = [...new Set(data.map(e => e.day))];
    ok(allDays.every(d => near(survAt(km, d), ref.S[d])), `dataset ${i + 1}: S(t) coincide con la referencia en todos los tiempos`);
  });
});

/* ============================ 3) T50 POR CONTEO (interpolación) ============================ */
group('T50 por conteo (interpolación al 50 %)', () => {
  const D = (day) => new Date(ECL + day * 86400000).toISOString();
  const t50 = (counts, total) => M.computeT50FromCounts(counts, total);
  // 20 al día 9, 80 al día 10, total 100 → 50 % cae a mitad de camino → día 9.5
  const r = t50([{ t: D(9), n: 20 }, { t: D(10), n: 80 }], 100);
  ok(near((r - ECL) / 86400000, 9.5, 1e-6), '20→80 sobre 100 ⇒ T50 = día 9.5');
  // otra proporción: 18 y 52 sobre 90 (mitad=45) → frac=(45-18)/(52-18)=27/34
  const r2 = t50([{ t: D(9), n: 18 }, { t: D(10), n: 52 }], 90);
  ok(near((r2 - ECL) / 86400000, 9 + 27 / 34, 1e-6), 'interpola la fracción exacta entre dos conteos');
  ok(t50([{ t: D(9), n: 20 }], 100) === null, 'un solo conteo ⇒ null (no se puede interpolar)');
  ok(t50([{ t: D(9), n: 10 }, { t: D(10), n: 20 }], 100) === null, 'si no cruza la mitad ⇒ null');
  ok(t50([{ t: D(9), n: 20 }, { t: D(10), n: 80 }], 0) === null, 'sin total ⇒ null');
});

/* ============================ 4) CALIBRACIÓN POR GENOTIPO (v2: shrinkage) ============================ */
group('Calibración v2 — σ por observación (método + ventana)', () => {
  const T0d = Date.parse('2025-01-01T00:00');
  const base25 = M.totalDays(25);   // base a 25 °C (≈8.80 d); con esta construcción, factor observado = F
  // cada obs en su propia TANDA (batch) salvo que se pase una compartida
  const obs = (F, method, batch) => ({ t0: '2025-01-01T00:00', t50: new Date(T0d + F * base25 * 86400000).toISOString(), temp: 25, method, batch });

  ok(near(M.obsFactor(obs(1.1, 'eye', 'b1')), 1.1, 1e-6), 'obsFactor = observado / base (1.1)');
  ok(M.normGeno('  w[1118]   ;  CyO ') === 'w[1118] ; CyO', 'normGeno recorta y colapsa espacios');

  // orden de precisión: conteo < a ojo < "ya pasó" (menor σ = más preciso)
  const sC = M.obsSigmaFactor(obs(1, 'count', 'b')), sE = M.obsSigmaFactor(obs(1, 'eye', 'b')), sP = M.obsSigmaFactor(obs(1, 'past', 'b'));
  ok(sC < sE && sE < sP, 'σ: conteo < a ojo < "ya pasó"');
  // valor del conteo: √(σ_t0² + σ_t50²)/base, con σ_t50=0.15 d y ventana 6 h (σ_t0=(6/24)/√12)
  const sT0 = (6 / 24) / Math.sqrt(12), sExpect = Math.sqrt(sT0 * sT0 + 0.15 * 0.15) / base25;
  ok(near(sC, sExpect, 1e-6), 'σ(conteo) = √(σ_t0² + σ_t50²) / base');
  // ventana de puesta más corta ⇒ menos incertidumbre
  ok(M.obsSigmaFactor({ t0: '2025-01-01T00:00', t50: new Date(T0d + base25 * 86400000).toISOString(), temp: 25, method: 'count', windowH: 3 })
     < M.obsSigmaFactor({ t0: '2025-01-01T00:00', t50: new Date(T0d + base25 * 86400000).toISOString(), temp: 25, method: 'count', windowH: 12 }),
     'ventana de puesta más corta ⇒ σ menor');

  ok(M.obsBatch({ batch: 'x', t0: 'y' }) === 'x', 'obsBatch usa el id de tanda si existe');
  ok(M.obsBatch({ t0: 'y' }) === 'y', 'obsBatch cae al t0 como proxy si no hay batch');
});

group('Calibración v2 — encogimiento (shrinkage) hacia el prior', () => {
  const T0d = Date.parse('2025-01-01T00:00');
  const base25 = M.totalDays(25);
  const obs = (F, method, batch) => ({ t0: '2025-01-01T00:00', t50: new Date(T0d + F * base25 * 86400000).toISOString(), temp: 25, method, batch });

  ok(M.calibInfo('desconocido') === null && M.calibFactorValue('desconocido') === 1, 'sin datos → null y factor 1 (modelo base)');

  // 1 tanda por conteo con F=1.3 → posterior ENTRE 1 y 1.3 (encogido), no 1.3
  M.saveCalib({ G: [obs(1.3, 'count', 'b1')] });
  const c1 = M.calibInfo('G');
  ok(c1.factor > 1 && c1.factor < 1.3, '1 obs de 1.3 → posterior encogido dentro de (1, 1.3)');
  ok(near(c1.factor, 1.231, 2e-3), 'valor del posterior con 1 tanda (conteo) ≈ 1.231');
  ok(c1.state === 'calibrating' && c1.singleBatch === true, '1 tanda → estado "Calibrando" + aviso de tanda única');
  ok(near(M.calibFactorValue('G'), c1.factor, 1e-9), 'calibFactorValue devuelve la media posterior');

  // 3 tandas por conteo con F=1.3 → menos encogimiento (posterior más cerca de 1.3) y "Calibrado"
  M.saveCalib({ G: [obs(1.3, 'count', 'b1'), obs(1.3, 'count', 'b2'), obs(1.3, 'count', 'b3')] });
  const c3 = M.calibInfo('G');
  ok(c3.factor > c1.factor, '3 tandas encogen menos que 1 (posterior más cerca de los datos)');
  ok(near(c3.factor, 1.273, 3e-3), 'valor del posterior con 3 tandas (conteo) ≈ 1.273');
  ok(c3.state === 'calibrated' && c3.singleBatch === false, '3 tandas independientes → "Calibrado"');
  ok(c3.conf === 'med' && c3.nBatch === 3, 'confianza media con 3 tandas; nBatch = 3');

  // método más preciso encoge menos: 1 conteo (c1, ya capturado) pulla más que 1 "a ojo" (mismo F)
  M.saveCalib({ E: [obs(1.3, 'eye', 'b1')] });
  ok(c1.factor > M.calibInfo('E').factor, 'conteo pulla más hacia los datos que "a ojo" (mismo F, 1 tanda)');

  // 5 tandas → confianza alta
  M.saveCalib({ H: [1, 2, 3, 4, 5].map(i => obs(1.2, 'count', 'b' + i)) });
  ok(M.calibInfo('H').conf === 'high', '≥5 tandas → confianza alta');

  // F=1.0 (igual al base) → pct 0 y factor ≈ 1
  M.saveCalib({ B: [obs(1.0, 'count', 'b1'), obs(1.0, 'count', 'b2'), obs(1.0, 'count', 'b3')] });
  ok(M.calibInfo('B').pct === 0 && near(M.calibInfo('B').factor, 1, 1e-6), 'observaciones = base → factor 1, pct 0');
});

group('Calibración v2 — heterogeneidad (estado "Inconsistente")', () => {
  const T0d = Date.parse('2025-01-01T00:00');
  const base25 = M.totalDays(25);
  const obs = (F, method, batch) => ({ t0: '2025-01-01T00:00', t50: new Date(T0d + F * base25 * 86400000).toISOString(), temp: 25, method, batch });

  // 3 tandas precisas que DISCREPAN (1.0 / 1.5 / 1.0) → I² alto → "Inconsistente"
  M.saveCalib({ D: [obs(1.0, 'count', 'b1'), obs(1.5, 'count', 'b2'), obs(1.0, 'count', 'b3')] });
  ok(M.calibInfo('D').state === 'inconsistent', 'tandas que discrepan más que su error → "Inconsistente"');

  // 3 tandas consistentes (1.1 a ojo) → NO inconsistente (dentro de su σ), "Calibrado"
  M.saveCalib({ C: [obs(1.1, 'eye', 'b1'), obs(1.1, 'eye', 'b2'), obs(1.1, 'eye', 'b3')] });
  ok(M.calibInfo('C').state === 'calibrated', 'tandas consistentes → "Calibrado", no inconsistente');

  // observaciones de una MISMA tanda (mismo batch) no cuentan como réplicas independientes
  M.saveCalib({ S: [obs(1.2, 'count', 'same'), obs(1.2, 'count', 'same'), obs(1.2, 'count', 'same')] });
  ok(M.calibInfo('S').nBatch === 1 && M.calibInfo('S').singleBatch === true, '3 obs de una sola tanda ⇒ nBatch 1 (no son independientes)');
});

group('Calibración v2 — modos de t₀ (incertidumbre del inicio de puesta)', () => {
  const sqrt12 = Math.sqrt(12);
  ok(near(M.obsSigmaT0Days({}), (6 / 24) / sqrt12, 1e-9), 't₀ acotado por defecto = (6 h/24)/√12');
  ok(M.obsSigmaT0Days({ windowH: 3 }) < M.obsSigmaT0Days({ windowH: 12 }), 'ventana más corta ⇒ σ_t₀ menor');
  ok(M.obsSigmaT0Days({ t0Mode: 'crossday' }) === M.CALIB_SIGMA_T0_CROSSDAY, 'modo "día de cruza" usa su σ fijo');
  ok(M.obsSigmaT0Days({ t0Mode: 'unknown' }) === M.CALIB_SIGMA_T0_UNKNOWN, 'modo "desconocido" usa su σ fijo');
  ok(M.obsSigmaT0Days({}) < M.obsSigmaT0Days({ t0Mode: 'crossday' }) && M.obsSigmaT0Days({ t0Mode: 'crossday' }) < M.obsSigmaT0Days({ t0Mode: 'unknown' }),
     'σ_t₀: acotado < día de cruza < desconocido');

  // un t₀ más incierto ⇒ σ del factor mayor ⇒ el posterior encoge más (pesa menos)
  const T0d = Date.parse('2025-01-01T00:00'), base25 = M.totalDays(25);
  const t50 = new Date(T0d + 1.3 * base25 * 86400000).toISOString();
  M.saveCalib({ B: [{ t0: '2025-01-01T00:00', t50, temp: 25, method: 'eye', batch: 'b1' }] });          // acotado
  const fBounded = M.calibInfo('B').factor;
  M.saveCalib({ X: [{ t0: '2025-01-01T00:00', t50, temp: 25, method: 'eye', t0Mode: 'crossday', batch: 'b1' }] });
  const fCross = M.calibInfo('X').factor;
  ok(fBounded > fCross && fCross > 1, 'con t₀ de "día de cruza" el posterior encoge más que con puesta acotada');

  // flujo de guardado (lo que hace recordT50/saveCountCalib): addCalibObs persiste el modo
  M.saveCalib({});
  M.addCalibObs('G', '2025-01-01T00:00', t50, 25, 'eye', 'cid', undefined, 'crossday');
  const recCross = M.loadCalib()['G'][0];
  ok(recCross.t0Mode === 'crossday' && recCross.batch === 'cid', 'addCalibObs guarda t0Mode y batch');
  M.saveCalib({});
  M.addCalibObs('G', '2025-01-01T00:00', t50, 25, 'count', 'cid', 4, 'bounded');
  const recBounded = M.loadCalib()['G'][0];
  ok(recBounded.t0Mode === undefined && recBounded.windowH === 4, 'modo acotado: no guarda t0Mode y sí la ventana (4 h)');
});

group('Calibración a dos niveles — laboratorio (wild-type) + genotipo', () => {
  const T0d = Date.parse('2025-01-01T00:00'), base25 = M.totalDays(25);
  const obs = (F, m, b) => ({ t0: '2025-01-01T00:00', t50: new Date(T0d + F * base25 * 86400000).toISOString(), temp: 25, method: m, batch: b });
  const three = F => [obs(F, 'count', 'b1'), obs(F, 'count', 'b2'), obs(F, 'count', 'b3')];

  // el estimador encoge hacia el prior que se le pase (no solo hacia 1 = literatura)
  M.saveCalib({ G: three(1.3) });
  ok(M.calibInfo('G', 1.2).factor > M.calibInfo('G', 1).factor, 'prior mayor (lab) ⇒ posterior más alto (encoge hacia el lab)');
  ok(M.calibInfo('G', 1.3).pct === 0, 'pct = 0 cuando el genotipo coincide con el prior del lab');
  ok(M.calibInfo('G', 1).pct === Math.round((M.calibInfo('G', 1).factor - 1) * 100), 'con prior 1, pct es relativo a literatura (compat.)');

  // wild-type de referencia del laboratorio
  M.saveCalib({ 'Canton-S': three(1.1), G: three(1.3) });
  M.saveLabRef('Canton-S');
  ok(M.isLabRef('Canton-S') === true && M.isLabRef('G') === false, 'isLabRef marca solo el wild-type');
  const labF = M.labFactorValue();
  ok(labF > 1 && labF < 1.1, 'el factor del lab está encogido hacia literatura (entre 1 y 1.1)');
  ok(Math.abs(M.calibInfoFor('Canton-S').factor - M.calibInfo('Canton-S', 1).factor) < 1e-9, 'el wild-type encoge hacia literatura (prior 1)');
  ok(Math.abs(M.calibInfoFor('G').factor - M.calibInfo('G', labF).factor) < 1e-9, 'un genotipo encoge hacia el factor del lab');

  // jerarquía de calibFactorValue
  ok(Math.abs(M.calibFactorValue('nunca-visto') - labF) < 1e-9, 'genotipo sin calibrar ⇒ usa el factor del lab');
  ok(M.calibFactorValue('Canton-S') === M.calibInfoFor('Canton-S').factor, 'el wild-type usa su propio factor (vs literatura)');
  ok(M.calibFactorValue('G') === M.calibInfoFor('G').factor && M.calibFactorValue('G') > labF, 'un genotipo calibrado usa su posterior (vs lab) y va más lento que el lab');

  // sin wild-type de referencia ⇒ comportamiento de un nivel (backward compatible)
  M.saveLabRef('');
  ok(M.labFactorValue() === 1 && M.calibFactorValue('nunca-visto') === 1, 'sin referencia de lab ⇒ factor 1 (solo literatura)');
});

/* ============================ 6) LOG-RANK Y χ² (comparar cohortes) ============================ */
group('χ² — p-valor de cola superior (gamma incompleta)', () => {
  ok(near(M.chiSqUpper(3.8415, 1), 0.05, 2e-3), 'χ²=3.841, df=1 → p ≈ 0.05');
  ok(near(M.chiSqUpper(5.9915, 2), 0.05, 2e-3), 'χ²=5.991, df=2 → p ≈ 0.05');
  ok(near(M.chiSqUpper(7.8147, 3), 0.05, 2e-3), 'χ²=7.815, df=3 → p ≈ 0.05');
  ok(near(M.chiSqUpper(2.7055, 1), 0.10, 2e-3), 'χ²=2.706, df=1 → p ≈ 0.10');
  ok(M.chiSqUpper(0, 1) === 1, 'χ²=0 → p = 1');
  ok(Math.abs(Math.exp(M.lgamma(5)) - 24) < 1e-6, 'lgamma(5) → ln(4!) (Γ(5)=24)');
});

group('Log-rank (Mantel–Haenszel) entre cohortes', () => {
  // Ejemplo intercalado (calculado a mano): G1 muere en día 1 y 3; G2 en 2 y 4 (n0=2 c/u).
  // O1=2, E1=1.3333, V11=0.7222 → χ² = 0.6667²/0.7222 = 0.6155, df=1.
  const g1 = { n0: 2, times: [{ day: 1, d: 1, c: 0 }, { day: 3, d: 1, c: 0 }] };
  const g2 = { n0: 2, times: [{ day: 2, d: 1, c: 0 }, { day: 4, d: 1, c: 0 }] };
  const lr = M.logRankTest([g1, g2]);
  ok(near(lr.chi2, 0.6155, 2e-3), 'χ² del ejemplo intercalado ≈ 0.6155 (a mano)');
  ok(lr.df === 1, '2 grupos → df = 1');
  ok(near(lr.O[0], 2, 1e-9) && near(lr.E[0], 1.3333, 1e-3), 'O1=2, E1≈1.333');
  ok(lr.p > 0.42 && lr.p < 0.45, 'p ≈ 0.43 (sin diferencia significativa)');

  // cohortes idénticas → sin diferencia (χ² ≈ 0, p ≈ 1)
  const same = { n0: 10, times: [{ day: 5, d: 3, c: 0 }, { day: 10, d: 4, c: 0 }] };
  const lr0 = M.logRankTest([same, { ...same, times: same.times.map(t => ({ ...t })) }]);
  ok(near(lr0.chi2, 0, 1e-9) && near(lr0.p, 1, 1e-9), 'cohortes idénticas → χ²=0, p=1');

  // separación fuerte → χ² grande, p pequeño
  const early = { n0: 8, times: [{ day: 1, d: 4, c: 0 }, { day: 2, d: 4, c: 0 }] };
  const late = { n0: 8, times: [{ day: 9, d: 4, c: 0 }, { day: 10, d: 4, c: 0 }] };
  const lrsep = M.logRankTest([early, late]);
  ok(lrsep.chi2 > 3.84 && lrsep.p < 0.05, 'cohortes bien separadas → χ² > 3.84, p < 0.05');

  // 3 grupos → df = 2
  ok(M.logRankTest([g1, g2, { n0: 2, times: [{ day: 5, d: 2, c: 0 }] }]).df === 2, '3 grupos → df = 2');
  ok(M.logRankTest([g1]) === null, 'un solo grupo → null (nada que comparar)');
});

/* ============================ 7) PLANIFICACIÓN ESTADÍSTICA ============================ */
group('Cuantil normal (normInv) y tamaño muestral log-rank (Schoenfeld)', () => {
  ok(near(M.normInv(0.975), 1.95996, 1e-4), 'normInv(0.975) ≈ 1.95996');
  ok(near(M.normInv(0.80), 0.84162, 1e-4), 'normInv(0.80) ≈ 0.84162');
  ok(near(M.normInv(0.5), 0, 1e-6), 'normInv(0.5) = 0');
  ok(near(M.normInv(0.025), -1.95996, 1e-4), 'normInv(0.025) ≈ -1.95996 (simétrico)');

  // HR=2, α=0.05 (bilateral), potencia 0.80 → ~66 eventos totales (referencia estándar de Schoenfeld)
  const p = M.logRankPlan(40, 20, 0.05, 0.80, 1);
  ok(near(p.hr, 2, 1e-9), 'HR = m1/m2 = 40/20 = 2');
  ok(p.events === 66, 'HR=2, potencia 0.80 → 66 eventos (Schoenfeld)');
  ok(p.nPerGroup === 33 && p.nTotal === 66, 'con mortalidad ~100% → 33 por grupo, 66 en total');

  // mortalidad incompleta (60% muere) sube el N necesario
  const p60 = M.logRankPlan(40, 20, 0.05, 0.80, 0.6);
  ok(p60.nPerGroup > p.nPerGroup, 'menor mortalidad esperada ⇒ más moscas necesarias');

  // más potencia ⇒ más eventos; efecto más chico (HR más cerca de 1) ⇒ muchos más
  ok(M.logRankPlan(40, 20, 0.05, 0.90, 1).events > p.events, '90% de potencia pide más eventos que 80%');
  ok(M.logRankPlan(40, 30, 0.05, 0.80, 1).events > p.events, 'efecto más chico (HR 1.33) pide más eventos');
  ok(M.logRankPlan(20, 20, 0.05, 0.80, 1) === null, 'medianas iguales (sin efecto) → null');

  // duración: modelo de Weibull (forma > 1) para el patrón real de moscas (cola corta, no exponencial)
  ok(near(M.timeToMortality(30, 0.5), 30, 1e-9), 'la mediana se mapea a sí misma (q=0.5 ⇒ tiempo = mediana)');
  ok(near(M.timeToMortality(30, 0.9), 30 * Math.pow(Math.log2(10), 1/M.SURV_SHAPE), 1e-6), 'tiempo al 90% = mediana · (log2(10))^(1/forma)');
  ok(M.timeToMortality(30, 0.5) < M.timeToMortality(30, 0.9), 'más mortalidad objetivo ⇒ más tiempo');
  // cola más corta que la exponencial: al 90% da ~1.5× la mediana, no ~3.3×
  ok(M.timeToMortality(50, 0.9) < 50 * Math.log2(10) && M.timeToMortality(50, 0.9) > 50, 'cola de Weibull < cola exponencial (evita sobrestimar la duración)');
  ok(near(M.timeToMortality(50, 0.9) / 50, 1.49, 0.05), 'al 90% de mortalidad ≈ 1.5× la mediana (realista para Drosophila)');
});

/* ============================ resumen ============================ */
console.log(`\n${'─'.repeat(48)}\n${fail === 0 ? '✓ TODO OK' : '✗ HAY FALLAS'} — ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
