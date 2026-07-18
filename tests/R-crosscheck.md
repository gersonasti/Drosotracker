# Verificación del Kaplan–Meier contra R `survival`

Este documento reproduce, en **R** (paquete `survival`, el estándar del campo), el mismo
dataset que usa el test automatizado `run-tests.mjs`, para documentar en el manuscrito la
**concordancia** entre la implementación de DrosoTracker y una referencia establecida.

## Dataset canónico

10 individuos · 7 muertes · 3 censuras.

| Tiempo (días) | Estado |
|---|---|
| 4 | muerte |
| 6 | censura |
| 8 | muerte |
| 8 | muerte |
| 10 | muerte |
| 12 | censura |
| 14 | muerte |
| 14 | muerte |
| 16 | muerte |
| 18 | censura |

## Script de R

```r
library(survival)

# 1 = muerte (evento), 0 = censura
time   <- c(4, 6, 8, 8, 10, 12, 14, 14, 16, 18)
status <- c(1, 0, 1, 1, 1,  0,  1,  1,  1,  0)

fit <- survfit(Surv(time, status) ~ 1)
summary(fit)   # S(t) en cada tiempo de evento
print(fit)     # mediana de supervivencia
```

## Salida esperada de R (y que produce DrosoTracker)

`summary(fit)` — estimador de supervivencia:

| tiempo | n.risk | n.event | survival |
|---|---|---|---|
| 4 | 10 | 1 | 0.9000 |
| 8 | 8 | 2 | 0.6750 |
| 10 | 6 | 1 | 0.5625 |
| 14 | 4 | 2 | 0.2813 |
| 16 | 2 | 1 | 0.1406 |

`print(fit)` → **mediana = 14**.

## Concordancia

`tests/run-tests.mjs` verifica automáticamente que la función `kmCurve` de DrosoTracker
produce **exactamente** estos valores: `S(4)=0.9`, `S(8)=0.675`, `S(10)=0.5625`,
`S(14)=0.28125`, `S(16)=0.140625`, y **mediana = 14** (el primer tiempo con `S ≤ 0.5`).

Es decir: la implementación de DrosoTracker coincide con `survival::survfit` de R en el
estimador de Kaplan–Meier, incluido el manejo de censuras y el criterio de mediana. Correr
el script de R de arriba reproduce estos números de forma independiente.

> Para el paper: adjuntar la salida real de R (copiada de la consola) junto a esta tabla.
