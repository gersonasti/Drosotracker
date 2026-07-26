#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
DrosoTracker - Calibracion del modelo de desarrollo por literatura.

Deriva las constantes termicas T0 y DD del modelo huevo->adulto
    T_dev(theta) = DD / (theta - T0)      <=>      tasa = 1/T_dev = (1/DD)*theta - T0/DD
por regresion lineal de la TASA de desarrollo contra la temperatura, sobre los
datos de Powsner (1935) (transcripcion verificada), rango lineal ~15-28 C. Genera la
tabla de robustez, el reparto por estadios y las figuras del manuscrito, y verifica
los valores contra los reportados a mano (sale con codigo != 0 si algo no cuadra).

Correr:  python analysis/calibracion.py
Requiere: numpy, pandas, scipy, matplotlib.
"""
import os
import sys
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
FIGS = os.path.join(HERE, "figures")
os.makedirs(FIGS, exist_ok=True)

FIT_LO, FIT_HI = 15.0, 28.0        # rango lineal de ajuste (incluye 15.24 y 27.77; excluye >=28.07)

# --------------------------------------------------------------------------- #
#  Utilidades de ajuste
# --------------------------------------------------------------------------- #
def load(name):
    return pd.read_csv(os.path.join(DATA, name))


def fit_rate(temp, dur_days, lo=FIT_LO, hi=FIT_HI):
    """Regresion lineal de tasa (1/dur) contra temperatura en [lo, hi].
    Devuelve T0, DD, R2 y sus IC 95 % (metodo delta sobre la covarianza del ajuste)."""
    temp = np.asarray(temp, float)
    dur = np.asarray(dur_days, float)
    m = (temp >= lo) & (temp <= hi)
    x, y = temp[m], 1.0 / dur[m]
    n = len(x)
    (b, a), cov = np.polyfit(x, y, 1, cov=True)      # y = b*x + a
    yhat = b * x + a
    r2 = 1.0 - np.sum((y - yhat) ** 2) / np.sum((y - np.mean(y)) ** 2)
    DD, T0 = 1.0 / b, -a / b
    vb, va, cab = cov[0, 0], cov[1, 1], cov[0, 1]
    var_DD = vb / b ** 4
    var_T0 = (va + (a / b) ** 2 * vb - 2.0 * (a / b) * cab) / b ** 2
    tcrit = stats.t.ppf(0.975, n - 2)
    return dict(n=n, slope=b, intercept=a, cov=cov, T0=T0, DD=DD, R2=r2,
                T0_ci=tcrit * np.sqrt(var_T0), DD_ci=tcrit * np.sqrt(var_DD),
                x=x, y=y, tcrit=tcrit, mask=m)


def predict(T0, DD, temp):
    return DD / (np.asarray(temp, float) - T0)


def band(fit, xs):
    """Banda de confianza 95 % de la recta ajustada (tasa) en los puntos xs."""
    b, a = fit["slope"], fit["intercept"]
    vb, va, cab = fit["cov"][0, 0], fit["cov"][1, 1], fit["cov"][0, 1]
    xs = np.asarray(xs, float)
    yhat = b * xs + a
    var = xs ** 2 * vb + va + 2.0 * xs * cab
    return yhat, fit["tcrit"] * np.sqrt(var)


# --------------------------------------------------------------------------- #
#  Datos: Powsner total huevo->adulto (promedio de sexos)
# --------------------------------------------------------------------------- #
st = load("powsner1935_stages.csv")
st["total_male_d"] = (st.egg_larval_male_h + st.pupal_male_h) / 24.0
st["total_female_d"] = (st.egg_larval_female_h + st.pupal_female_h) / 24.0
st["total_avg_d"] = (st.total_male_d + st.total_female_d) / 2.0
temp = st.temp_eggval.values

# Total huevo->adulto con la transcripcion/apareamiento VERIFICADO por los autores
# contra el PDF (Tablas IX+X, promedio de sexos). Es la fuente autoritativa del
# ajuste; el CSV de estadios se conserva solo para el reparto por estadios y sexos.
tv = load("powsner1935_total_verified.csv")
temp_v = tv.temp_c.values
dur_v = tv.total_days.values

emb = load("powsner1935_embryo.csv")
al_total = load("alsaffar1995_total.csv")
al_fluc = load("alsaffar1995_fluctuating.csv")
al_ep = load("alsaffar1995_egg_pupa.csv")
bdsc = load("bdsc_reference.csv")

checks = []   # (nombre, ok, detalle)


def check(name, got, expected, tol):
    ok = abs(got - expected) <= tol
    checks.append((name, ok, f"obtenido={got:.4g}  esperado={expected:.4g}  (tol {tol})"))
    return ok


# --------------------------------------------------------------------------- #
#  1) Ajuste principal
# --------------------------------------------------------------------------- #
main = fit_rate(temp_v, dur_v)
print("=" * 70)
print("AJUSTE PRINCIPAL - Powsner total huevo->adulto, promedio de sexos, ~15-28 C")
print(f"  n   = {main['n']}")
print(f"  T0  = {main['T0']:.2f} C   (IC95 +/- {main['T0_ci']:.2f})")
print(f"  DD  = {main['DD']:.1f} grados-dia   (IC95 +/- {main['DD_ci']:.1f})")
print(f"  R2  = {main['R2']:.4f}")
preds = {T: float(predict(main["T0"], main["DD"], T)) for T in (18, 21, 25, 29)}
print("  predicciones (dias): " + " | ".join(f"{T}C->{d:.2f}" for T, d in preds.items()))

# las predicciones usan el DD AJUSTADO (116.4); la app redondea DD a 116 (~0.03 d menos a 25 C)
check("T0 principal", main["T0"], 11.78, 0.03)
check("DD principal", main["DD"], 116.4, 0.6)
check("R2 principal", main["R2"], 0.9971, 0.001)
check("pred 25C (DD ajustado)", preds[25], 8.81, 0.03)
check("pred 29C (DD ajustado)", preds[29], 6.76, 0.05)
check("pred 18C (DD ajustado)", preds[18], 18.71, 0.15)

# --------------------------------------------------------------------------- #
#  2) Robustez del ajuste (distintos cortes)
# --------------------------------------------------------------------------- #
print("\n" + "=" * 70)
print("ROBUSTEZ DEL AJUSTE")
print(f"{'subconjunto':<34}{'T0':>7}{'DD':>8}{'R2':>9}{'n':>4}")
robust = [
    ("Verificado sexos avg, 15-28 (PRINC.)", temp_v, dur_v, 15, 28),
    ("Verificado sexos avg, 16-28", temp_v, dur_v, 16, 28),
    ("Verificado sexos avg, 18-28", temp_v, dur_v, 18, 28),
    ("Verificado sexos avg, 15-32 (mal)", temp_v, dur_v, 15, 32),
    ("Machos (tabla estadios), 15-28", temp, st.total_male_d.values, 15, 28),
    ("Hembras (tabla estadios), 15-28", temp, st.total_female_d.values, 15, 28),
]
robust_rows = []
for name, tt, dur, lo, hi in robust:
    f = fit_rate(tt, dur, lo, hi)
    print(f"{name:<34}{f['T0']:>7.2f}{f['DD']:>8.1f}{f['R2']:>9.4f}{f['n']:>4}")
    robust_rows.append((name, f["T0"], f["DD"], f["R2"], f["n"]))
check("robustez 15-28 = principal", robust_rows[0][1], main["T0"], 1e-6)   # el primero es el ajuste principal

# --------------------------------------------------------------------------- #
#  3) Otras fuentes (tabla comparativa)
# --------------------------------------------------------------------------- #
print("\n" + "=" * 70)
print("OTRAS FUENTES")
al_1530 = fit_rate(al_total.temp_c.values, al_total.duration_days.values, 15, 30)
al_1527 = fit_rate(al_total.temp_c.values, al_total.duration_days.values, 15, 27.5)
print(f"  Al-Saffar 1995 total, 15-30   : T0={al_1530['T0']:.2f}  DD={al_1530['DD']:.1f}  R2={al_1530['R2']:.3f}")
print(f"  Al-Saffar 1995 total, 15-27.5 : T0={al_1527['T0']:.2f}  DD={al_1527['DD']:.1f}  R2={al_1527['R2']:.3f}")
check("AlSaffar 15-30 T0", al_1530["T0"], 9.71, 0.1)
check("AlSaffar 15-30 DD", al_1530["DD"], 222.5, 3.0)

# --------------------------------------------------------------------------- #
#  4) Reparto por estadios a 25 C
# --------------------------------------------------------------------------- #
print("\n" + "=" * 70)
print("REPARTO POR ESTADIOS A 25 C (Powsner)")
row25 = st.iloc[(np.abs(temp - 25.14)).argmin()]
egg_larval_h = (row25.egg_larval_male_h + row25.egg_larval_female_h) / 2.0
pupal_h = (row25.pupal_male_h + row25.pupal_female_h) / 2.0
embryo_h = emb.loc[np.isclose(emb.temp_c, 25.06), "egg_period_h"].mean()
larval_h = egg_larval_h - embryo_h
total_h = egg_larval_h + pupal_h
embryo_d, larval_d, pupal_d, total_d = (embryo_h / 24, larval_h / 24, pupal_h / 24, total_h / 24)
print(f"  embrion {embryo_d:.2f} d ({embryo_d/total_d*100:.1f} %)")
print(f"  larval  {larval_d:.2f} d ({larval_d/total_d*100:.1f} %)")
print(f"  pupal   {pupal_d:.2f} d ({pupal_d/total_d*100:.1f} %)")
print(f"  total   {total_d:.2f} d")
check("embrion 25C (d)", embryo_d, 0.85, 0.03)
check("larval 25C (d)", larval_d, 3.90, 0.05)
check("pupal 25C (d)", pupal_d, 3.96, 0.05)


# --------------------------------------------------------------------------- #
#  FIGURAS
# --------------------------------------------------------------------------- #
plt.rcParams.update({
    "font.size": 9, "axes.linewidth": 0.8, "figure.dpi": 110,
    "savefig.bbox": "tight", "axes.spines.top": False, "axes.spines.right": False,
})
GREY, DARK, LIGHT = "0.45", "0.15", "0.75"


def save(fig, name):
    fig.savefig(os.path.join(FIGS, name + ".pdf"))
    fig.savefig(os.path.join(FIGS, name + ".png"), dpi=300)
    plt.close(fig)


# Fig 1 - tasa vs temperatura (figura de calibracion)
fig, ax = plt.subplots(figsize=(3.5, 3.0))
rate_all = 1.0 / dur_v
inmask = main["mask"]
ax.scatter(temp_v[inmask], rate_all[inmask], s=22, c=DARK, zorder=3, label="Powsner (ajuste)")
ax.scatter(temp_v[~inmask], rate_all[~inmask], s=22, facecolors="none", edgecolors=GREY,
           zorder=3, label="excluidos")
xs = np.linspace(FIT_LO, FIT_HI, 100)
yhat, half = band(main, xs)
ax.plot(xs, yhat, c=DARK, lw=1.3, zorder=2)
ax.fill_between(xs, yhat - half, yhat + half, color="0.8", alpha=0.6, zorder=1)
ax.axvspan(ax.get_xlim()[0], FIT_LO, color="0.93", zorder=0)
ax.axvspan(FIT_HI, ax.get_xlim()[1], color="0.93", zorder=0)
ax.axhline(0, c=GREY, lw=0.6)
ax.plot([main["T0"]], [0], marker="v", c=DARK, ms=6, zorder=4)
ax.annotate(f"T0 = {main['T0']:.1f} C", (main["T0"], 0), textcoords="offset points",
            xytext=(4, 8), fontsize=8)
ax.text(0.04, 0.96, f"DD = {main['DD']:.0f} grados-dia\nR2 = {main['R2']:.3f}\nn = {main['n']}",
        transform=ax.transAxes, va="top", fontsize=8,
        bbox=dict(boxstyle="round,pad=0.4", fc="white", ec="0.7", lw=0.6))
ax.set_xlabel("temperatura (C)")
ax.set_ylabel("tasa de desarrollo (1/dias)")
ax.legend(fontsize=7, frameon=False, loc="lower right")
save(fig, "fig1_tasa_vs_temp")

# Fig 3 - duracion por estadio vs temperatura
fig, ax = plt.subplots(figsize=(3.5, 3.0))
emb_sorted = emb.sort_values("temp_c")
embryo_interp = np.interp(temp, emb_sorted.temp_c, emb_sorted.egg_period_h)
egg_larval_avg = (st.egg_larval_male_h + st.egg_larval_female_h).values / 2.0
pupal_avg = (st.pupal_male_h + st.pupal_female_h).values / 2.0
larval_only = egg_larval_avg - embryo_interp
ax.plot(emb_sorted.temp_c, emb_sorted.egg_period_h / 24, "o-", c=DARK, ms=3, lw=1, label="embrion")
ax.plot(temp, larval_only / 24, "s-", c=GREY, ms=3, lw=1, label="larval")
ax.plot(temp, pupal_avg / 24, "^-", c=LIGHT, ms=3, lw=1, label="pupal")
ax.set_yscale("log")
ax.set_xlabel("temperatura (C)")
ax.set_ylabel("duracion (dias, log)")
ax.legend(fontsize=7, frameon=False)
save(fig, "fig3_estadios_vs_temp")

# Fig 4 - comparacion entre fuentes (Discusion)
fig, ax = plt.subplots(figsize=(3.5, 3.0))
ax.plot(temp_v, dur_v, "o-", c=DARK, ms=3, lw=1, label="Powsner 1935")
ax.plot(al_total.temp_c, al_total.duration_days, "s-", c=GREY, ms=3, lw=1, label="Al-Saffar 1995")
ax.plot(bdsc.temp_c, bdsc.duration_days, "D", c=LIGHT, ms=5, label="BDSC (ref.)")
ax.set_xlabel("temperatura (C)")
ax.set_ylabel("huevo->adulto (dias)")
ax.legend(fontsize=7, frameon=False)
save(fig, "fig4_comparacion_fuentes")

# Fig 5 - diferencias entre sexos
fig, ax = plt.subplots(figsize=(3.5, 3.0))
ax.plot(temp, st.total_male_d.values, "o-", c=DARK, ms=3, lw=1, label="machos")
ax.plot(temp, st.total_female_d.values, "s-", c=GREY, ms=3, lw=1, label="hembras")
ax.set_xlabel("temperatura (C)")
ax.set_ylabel("huevo->adulto (dias)")
ax.legend(fontsize=7, frameon=False)
save(fig, "fig5_sexos")

# Fig 6 - desviacion bajo temperaturas fluctuantes (efecto Kaufmann)
fig, ax = plt.subplots(figsize=(4.2, 3.0))
fl = al_fluc[~al_fluc.expt.isin([1, 9])].sort_values("P")
colors = [DARK if p < 100 else GREY for p in fl.P]
ax.bar(range(len(fl)), fl.P.values, color=colors, width=0.8)
ax.axhline(100, c="0.2", lw=1.0, ls="--")
mean_accel = 100 - fl[fl.P < 100].P.mean()
ax.set_xticks(range(len(fl)))
ax.set_xticklabels(fl.regime, rotation=90, fontsize=5.5)
ax.set_ylabel("P (% desarrollo predicho)")
ax.set_ylim(50, 110)
ax.text(0.02, 0.04, f"aceleracion media ~{mean_accel:.0f} %", transform=ax.transAxes, fontsize=7)
save(fig, "fig6_fluctuantes")

# --------------------------------------------------------------------------- #
#  VERIFICACION
# --------------------------------------------------------------------------- #
print("\n" + "=" * 70)
print("VERIFICACION contra los valores reportados a mano")
n_fail = 0
for name, ok, detail in checks:
    if not ok:
        n_fail += 1
        print(f"  FALLA: {name} -> {detail}")
print(f"\n  {len(checks)-n_fail}/{len(checks)} verificaciones OK")
print(f"  figuras generadas en: {FIGS}")
print("=" * 70)
sys.exit(1 if n_fail else 0)
