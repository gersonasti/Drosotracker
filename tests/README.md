# Tests de DrosoTracker

Suite de tests **sin dependencias externas** (corre con Node a secas). Los tests **extraen
las funciones científicas reales** de `DrosoTracker.html` (no una copia) y las verifican
contra valores calculados a mano y referencias independientes, de modo que testean el código
tal como se despliega.

## Cómo correr

```bash
node tests/run-tests.mjs
```

Imprime cada grupo de tests y un resumen. Devuelve código de salida `!= 0` si algo falla
(apto para CI, p. ej. GitHub Actions).

## Qué cubre

- **Modelo de desarrollo** (`totalDays`, `stageBounds`): suma térmica, monotonía con la
  temperatura, que los estadios sumen el total, y el escalado por el factor de calibración.
- **Kaplan–Meier** (`kmCurve`): S(t) y mediana contra un dataset canónico calculado a mano;
  manejo correcto de censuras; y contraste cruzado contra una implementación de referencia
  independiente (incluye empates y casos borde).
- **T50 por conteo** (`computeT50FromCounts`): interpolación al 50 %, y casos que devuelven
  `null` (un solo conteo, sin cruce de la mitad, sin total).
- **Calibración por genotipo** (`calibInfo`, `calibFactorValue`, `obsFactor`, `obsWeight`,
  `normGeno`): pesos por método, `obsFactor = observado/base`, la **regla de ≥3 réplicas**
  (con &lt;3 no se aplica), confianza por N, y el promedio ponderado por calidad.

## Verificación contra R

`R-crosscheck.md` reproduce el dataset de Kaplan–Meier en R (`survival::survfit`) y documenta
la concordancia con DrosoTracker — para citar en el manuscrito.
