# Calibración del modelo de desarrollo de DrosoTracker

Este documento deriva y justifica las constantes térmicas del modelo huevo→adulto
de *Drosophila melanogaster* que usa DrosoTracker, a partir de datos publicados.
Las constantes y la Figura 1 se reproducen con (desde la carpeta `analysis/`):

```
Rscript calibration.R
```

que ajusta la regresión sobre los datos verificados, **se auto-verifica** (se
detiene si T₀/DD se desvían) y genera la figura de calibración en `analysis/figures/`.
Las tablas de robustez y el reparto por estadios de más abajo son valores
documentados, derivados de la misma regresión y de los mismos datos.

---

## 1. El modelo

El desarrollo se describe con una **suma térmica** (°C·días):

```
T_dev(θ) = DD / (θ − T₀)
```

donde `θ` es la temperatura, `T₀` un umbral de desarrollo y `DD` la constante
térmica (°C·días). Equivale a decir que la **tasa** de desarrollo es lineal en
la temperatura:

```
tasa = 1/T_dev = (1/DD)·θ − T₀/DD
```

Por lo tanto una **regresión lineal de la tasa contra la temperatura** entrega
`DD = 1/pendiente` y `T₀ = −intercepto/pendiente`, con sus intervalos de
confianza (método delta sobre la covarianza del ajuste) y R².

El ajuste se hace **solo en el rango lineal ~15–28 °C**. Fuera de ese rango la
relación se curva (§4) y se excluye del ajuste, aunque se grafica para mostrar la
desviación.

---

## 2. Fuente primaria y ajuste

**Powsner, L. (1935).** *The effects of temperature on the durations of the
developmental stages of* Drosophila melanogaster. *Physiological Zoology*
**8**(4): 474–520. doi:10.1086/physzool.8.4.30151263

Cepa endocriada (>75 generaciones, alta homocigosis), medio banana + agar,
incubadoras a ±0,05 °C, puesta acotada de 20–30 min, 15–30 huevos por vial. El
período huevo-larval está corregido por el tiempo previo a 25 °C (se usa la
columna corregida). El total huevo→adulto se calcula como
`egg_larval + pupal` (Tablas IX y X), promediando ambos sexos. Las temperaturas
de las dos tablas difieren en decimales (experimentos distintos) y se aparean por
proximidad; se usa la temperatura de la tabla huevo-larval. **La transcripción y
el apareamiento fueron verificados contra el PDF original por los autores**
(`analysis/data/powsner1935_total_verified.csv`).

### Ajuste principal (promedio de sexos, ~15–28 °C, n = 13)

| Parámetro | Valor | IC 95 % |
|---|---|---|
| **T₀** | **11,78 °C** | ±0,4 |
| **DD** | **116,4 °C·días** (→ 116) | ±4,2 |
| **R²** | **0,9971** | — |

Predicciones huevo→adulto (con el DD ajustado 116,4): 18 °C → 18,7 d ·
21 °C → 12,6 d · 25 °C → 8,8 d · 29 °C → 6,8 d. La app redondea DD a 116, ~0,03 d
menos a 25 °C. El rango de ajuste incluye 15,24 °C y 27,77 °C y excluye ≥28,07 °C.

*(Figura 1 — tasa vs. temperatura con la recta ajustada, su banda de confianza y
el intercepto T₀; los puntos ≥29 °C, excluidos, se apartan de la recta.)*

### Robustez

El ajuste es estable frente a cambios de rango y de sexo:

| Subconjunto | T₀ (°C) | DD | R² | n |
|---|---|---|---|---|
| Verificado, 15–28 (**principal**) | 11,78 | 116,4 | 0,9971 | 13 |
| Verificado, 16–28 | 12,12 | 113,2 | 0,9986 | 12 |
| Verificado, 18–28 | 12,12 | 113,2 | 0,9986 | 12 |
| Machos (tablas), 15–28 | 11,48 | 119,6 | 0,9972 | 13 |
| Hembras (tablas), 15–28 | 11,76 | 116,5 | 0,9947 | 13 |
| **Sexos avg, 15–32 (mal ajuste)** | **9,56** | **145,5** | **0,9193** | 18 |

La última fila muestra por qué importa restringir el ajuste al rango lineal:
**incluir los extremos no lineales degrada el ajuste** (T₀ ≈ 9,6 · DD ≈ 146 ·
R² baja a 0,92). Las constantes solo son fiables en ~15–28 °C. (Al no haber un
punto verificado entre 16 y 18 °C, los cortes 16–28 y 18–28 coinciden.)

---

## 3. Reparto por estadios (a 25 °C, Powsner)

| Estadio | Duración | Proporción |
|---|---|---|
| Embrión | 0,85 d | 9,8 % |
| Larval | 3,90 d | 44,8 % |
| Pupal | 3,96 d | 45,4 % |
| **Total** | **8,71 d** | 100 % |

El reparto se guarda como fracciones del total y se reescala proporcionalmente con
la temperatura. El período larval se subdivide **L1 : L2 : L3 = 1 : 1 : 2** a partir
de una revisión de *Current Biology* (embriogénesis, L1 y L2 de un día cada uno,
L3 de dos días), **no de Powsner**, que mide el período larval como un bloque único
(ver caveat 9).

---

## 4. Rango de validez y comparación entre fuentes

La aproximación lineal vale en **~15–28 °C** y se rompe en los extremos:

- Por encima de ~29 °C la duración vuelve a subir (el mínimo de Powsner cae en
  28–29 °C; el estadio pupal de Al-Saffar sube de 87,2 h a 27,5 °C a 101,3 h a 30 °C).
- Cerca del umbral inferior la relación también se curva (>50 días a 12 °C).

Otras fuentes, para contexto (no usadas en las constantes):

| Fuente | Rango | T₀ (°C) | DD | R² |
|---|---|---|---|---|
| Powsner 1935 (total) | ~15–28 | 11,78 | 116,4 | 0,997 |
| Al-Saffar 1995 (total) | 15–30 | 9,71 | 222,5 | 0,987 |
| Al-Saffar 1995 (total) | 15–27,5 | 9,10 | 236,1 | 0,986 |

Al-Saffar da duraciones ~60–70 % más largas porque **crió cada larva aislada**
(1 huevo por compartimento), lo que enlentece el desarrollo larval; sus valores de
huevo y pupa, en cambio, son normales. Es evidencia de que las condiciones de
cultivo cambian las constantes térmicas — el argumento central para la calibración
por genotipo/laboratorio de la app. *(Figuras 4 y 6.)*

---

## 5. Caveats a tener presentes

1. **T₀ es un parámetro de ajuste, no un cero fisiológico.** Powsner mostró que
   huevos a 10,3 °C completaron un 9,1 % de su desarrollo embrionario, casi 2 °C
   por debajo del cero extrapolado, y que la curva tasa-temperatura es sigmoidea.
2. **Rango de validez ~15–28 °C** (§4).
3. **Las constantes no son transferibles entre genotipos.** Sewall Wright, citado
   al pie por el propio Powsner, advierte que los datos valen solo para ese stock
   endocriado. Es la **justificación bibliográfica del módulo de calibración por
   genotipo**: la fuente primaria advierte contra el uso universal de sus propios
   valores.
4. **Variación entre laboratorios** (Powsner vs. Al-Saffar, ~60–70 %, con el
   estadio larval como responsable).
5. **Densidad y nutrición.** Powsner no halló efecto entre 7 y 57 larvas/vial con
   puesta acotada, pero el hacinamiento *con inanición* alarga el desarrollo
   (111 → 188 h). El factor crítico es la comida disponible.
6. **Diferencias entre sexos.** Existen y cambian con la temperatura; el modelo usa
   el promedio de ambos (Figura 5).
7. **Temperaturas fluctuantes aceleran el desarrollo ~15 %** respecto de la suma
   térmica (efecto Kaufmann / suma de tasas; Worner 1992). Al-Saffar lo confirma en
   22 regímenes alternantes, pero concluye que es **demasiado pequeño para
   invalidar** el modelo. En uso real (incubadoras que oscilan, viales que se sacan)
   cabe esperar desarrollo algo más rápido; empuja en la misma dirección que el
   sesgo ya corregido, y la calibración por genotipo lo absorbe. (Figura 6.)
8. **El reparto por estadios se midió a 25 °C** y se reescala proporcionalmente;
   asume proporciones interestadio constantes (aproximación buena en el rango medio,
   peor en los bordes, sobre todo para el período larval).
9. **La subdivisión L1/L2/L3 proviene de una fuente distinta de Powsner** (revisión
   de *Current Biology*), que mide el período larval como bloque único. Parkin &
   Burnet 1986 implicaría 1 : 1 : 1,5; la diferencia es de horas.
10. **El modelo es muy sensible cerca del umbral inferior.** Por debajo de ~18 °C,
    como θ se acerca a T₀, dividir por `(θ − T₀)` hace que la duración crezca rápido
    y que un pequeño error de temperatura se amplifique. Usar las predicciones con
    cautela cerca del límite frío.

---

## 6. Datos y reproducibilidad

Datos primarios transcritos en `analysis/data/`:

| Archivo | Fuente |
|---|---|
| `powsner1935_total_verified.csv` | Powsner 1935 total huevo→adulto (Tablas IX+X, prom. sexos), **transcripción verificada — input del ajuste** |
| `powsner1935_stages.csv` | Powsner 1935, Tablas IX (huevo-larval) y X (pupal), por sexo |
| `powsner1935_embryo.csv` | Powsner 1935, Tabla VIII (período embrionario) |
| `alsaffar1995_total.csv` | Al-Saffar et al. 1995 (*Biol. Environ.*), Tabla 1 |
| `bdsc_reference.csv` | Bloomington Drosophila Stock Center (sanity check) |

El script `analysis/calibration.R` (R) ajusta la regresión sobre
`powsner1935_total_verified.csv`, reproduce las constantes (T₀ = 11,78 · DD = 116,38 ·
R² = 0,997), se auto-verifica, y genera la Figura 1 en PDF vectorial + PNG 300 dpi.

### Referencias de calibración

- Powsner, L. (1935). *Physiol. Zool.* **8**(4): 474–520. doi:10.1086/physzool.8.4.30151263
- AL-Saffar, Z.Y., Grainger, J.N.R. & Aldrich, J. (1995). *Biol. Environ.: Proc. R. Ir. Acad.* **95B**(2): 119–122. JSTOR 20504505
- AL-Saffar, Z.Y., Grainger, J.N.R. & Aldrich, J. (1995). *J. Thermal Biology* **20**(5): 389–397. doi:10.1016/0306-4565(94)00075-T
- Worner, S.P. (1992). *Environ. Entomol.* **21**: 689–699.
- Bloomington Drosophila Stock Center — Fly Culture. https://bdsc.indiana.edu/information/fly-culture.html

> Verificar los datos bibliográficos completos antes de citar en el manuscrito.
> La atribución de la subdivisión larval a *Current Biology* está pendiente de
> confirmar autores y datos completos.

### Correspondencia con el código de la app

Las constantes viven en `index.html`:

```js
const T0 = 11.78;         // Powsner 1935, regresión ~15–28 °C (n=13, R²=0.997)
const DEGREE_DAYS = 116.0;
```

y el reparto de estadios en el array `STAGES` (fracciones ×10: embrión 0,98 ·
L1 1,12 · L2 1,12 · L3 2,24 · pupa 4,54). La calibración **por genotipo** (v2)
encoge hacia este modelo base; ver el bloque "Calibración por genotipo (v2)" en el
mismo archivo.
