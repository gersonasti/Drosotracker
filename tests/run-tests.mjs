/*
 * DrosoTracker — test suite (sin dependencias externas).
 *
 * Extrae las funciones científicas REALES de DrosoTracker.html (no una copia)
 * y las verifica contra valores calculados a mano / referencias independientes.
 *
 * Correr:  node tests/run-tests.mjs
 * Sale con código != 0 si algún test falla (apto para CI).
 */
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../DrosoTracker.html', import.meta.url), 'utf8');

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

const code = [
  grabConst('T0'), grabConst('DEGREE_DAYS'), grabConst('STAGES'), grabConst('REF_TOTAL'),
  grabFn('totalDays'), grabFn('stageBounds'), grabFn('ensureAging'), grabFn('kmCurve'), grabFn('computeT50FromCounts'),
].join('\n');
const M = new Function(code + '\nreturn { T0, DEGREE_DAYS, REF_TOTAL, STAGES, totalDays, stageBounds, ensureAging, kmCurve, computeT50FromCounts };')();

/* ---- mini framework ---- */
let pass = 0, fail = 0;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ FALLA: ' + msg); } }
function group(name, fn) { console.log('\n▶ ' + name); fn(); }

/* ============================ 1) MODELO DE DESARROLLO ============================ */
group('Modelo de desarrollo (suma térmica)', () => {
  ok(near(M.totalDays(25), 10), '25 °C → 10 días (148/14.8)');
  ok(near(M.totalDays(18), 148 / 7.8), '18 °C → 148/7.8 ≈ 18.97 d');
  ok(near(M.totalDays(29), 148 / 18.8), '29 °C → 148/18.8 ≈ 7.87 d');
  ok(near(M.totalDays(25, 1.1), 11), 'factor 1.1 a 25 °C → 11 días');
  ok(M.totalDays(29) < M.totalDays(25) && M.totalDays(25) < M.totalDays(18), 'monótona: más calor = más rápido');

  const b = M.stageBounds(25);
  ok(near(b[b.length - 1].end, M.totalDays(25)), 'los estadios suman el total de desarrollo');
  ok(b.every((s, i) => i === 0 || s.start >= b[i - 1].start), 'límites de estadio crecientes');
  ok(near(M.stageBounds(25, 1.1)[4].end, 11), 'los límites escalan con el factor de calibración');
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

/* ============================ resumen ============================ */
console.log(`\n${'─'.repeat(48)}\n${fail === 0 ? '✓ TODO OK' : '✗ HAY FALLAS'} — ${pass} pasaron, ${fail} fallaron\n`);
process.exit(fail === 0 ? 0 : 1);
