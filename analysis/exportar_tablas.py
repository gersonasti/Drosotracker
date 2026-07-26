#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
DrosoTracker - Exportar los datos de calibracion a una planilla para LibreOffice Calc / R.

Genera analysis/tablas/DrosoTracker_datos_calibracion.xlsx con una hoja por fuente,
una hoja TIDY consolidada (formato largo, la comoda para ggplot2), los resultados de
los ajustes y una tabla predicho-vs-observado lista para graficar. Tambien deja el
tidy como CSV suelto para leerlo directo con read.csv() en R.

Correr:  python analysis/exportar_tablas.py
"""
import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT = os.path.join(HERE, "tablas")
os.makedirs(OUT, exist_ok=True)

FIT_LO, FIT_HI = 15.0, 28.0    # rango de ajuste (incluye 15.24 y 27.77; excluye >=28.07)
NEW_T0, NEW_DD = 11.78, 116.0
NEW_PUP_FRAC = 0.546           # fin de L3 / total en el reparto de Powsner (0.098+0.448)

CITA = {
    "powsner1935": "Powsner (1935) Physiol. Zool. 8:474-520",
    "powsner1935_verificado": "Powsner (1935) Physiol. Zool. 8:474-520 (Tablas IX+X, transcripcion verificada)",
    "alsaffar1995_total": "AL-Saffar et al. (1995) Biol. Environ. 95B(2):119-122",
    "alsaffar1995_huevo_pupa": "AL-Saffar et al. (1995) J. Therm. Biol. 20(5):389-397",
    "bdsc": "Bloomington Drosophila Stock Center - Fly Culture",
}

load = lambda n: pd.read_csv(os.path.join(DATA, n))


def fit_rate(temp, dur_days, lo=FIT_LO, hi=FIT_HI):
    """Regresion tasa(1/dur) ~ temperatura en [lo,hi]. Devuelve T0, DD, R2 y n."""
    temp = np.asarray(temp, float); dur = np.asarray(dur_days, float)
    m = (temp >= lo) & (temp <= hi) & np.isfinite(dur) & (dur > 0)
    x, y = temp[m], 1.0 / dur[m]
    (b, a), cov = np.polyfit(x, y, 1, cov=True)
    r2 = 1 - np.sum((y - (b * x + a)) ** 2) / np.sum((y - y.mean()) ** 2)
    return dict(T0=-a / b, DD=1 / b, R2=r2, n=len(x))


# --------------------------------------------------------------------------- #
#  Cargar y derivar
# --------------------------------------------------------------------------- #
st = load("powsner1935_stages.csv")
st["huevo_larval_promedio_h"] = (st.egg_larval_male_h + st.egg_larval_female_h) / 2
st["pupal_promedio_h"] = (st.pupal_male_h + st.pupal_female_h) / 2
st["total_macho_h"] = st.egg_larval_male_h + st.pupal_male_h
st["total_hembra_h"] = st.egg_larval_female_h + st.pupal_female_h
st["total_promedio_h"] = (st.total_macho_h + st.total_hembra_h) / 2
st["total_promedio_d"] = st.total_promedio_h / 24
st["tasa_por_dia"] = 1 / st.total_promedio_d
st["en_rango_ajuste"] = (st.temp_eggval >= FIT_LO) & (st.temp_eggval <= FIT_HI)

emb = load("powsner1935_embryo.csv")
emb["egg_period_d"] = emb.egg_period_h / 24

al_tot = load("alsaffar1995_total.csv")
al_tot["tasa_por_dia"] = 1 / al_tot.duration_days

al_ep = load("alsaffar1995_egg_pupa.csv")
al_fl = load("alsaffar1995_fluctuating.csv")
al_fl["excluir_autores"] = al_fl.expt.isin([1, 9])   # los propios autores los descartan
bdsc = load("bdsc_reference.csv")
bdsc["tasa_por_dia"] = 1 / bdsc.duration_days

# Total huevo->adulto con la transcripcion VERIFICADA por los autores (Tablas IX+X,
# promedio de sexos). Es la fuente autoritativa del ajuste principal.
tv = load("powsner1935_total_verified.csv")
tv["tasa_por_dia"] = 1 / tv.total_days
tv["en_rango_ajuste"] = (tv.temp_c >= FIT_LO) & (tv.temp_c <= FIT_HI)

# --------------------------------------------------------------------------- #
#  Tabla TIDY (formato largo) - una fila por medicion
# --------------------------------------------------------------------------- #
rows = []


def add(fuente, temp, estadio, sexo, dur_h=None, dur_d=None, se_h=None, n=None,
        mort=None, usado=False, notas=""):
    if dur_d is None and dur_h is not None:
        dur_d = dur_h / 24
    if dur_h is None and dur_d is not None:
        dur_h = dur_d * 24
    rows.append(dict(
        fuente=fuente, cita=CITA[fuente], temp_c=temp, estadio=estadio, sexo=sexo,
        duracion_h=dur_h, duracion_d=dur_d,
        tasa_por_dia=(1 / dur_d if dur_d and dur_d > 0 else np.nan),
        se_h=se_h, n=n, mortalidad_pct=mort,
        en_rango_ajuste=(FIT_LO <= temp <= FIT_HI),
        usado_en_ajuste_principal=usado, notas=notas,
    ))


for _, r in st.iterrows():
    inrange = FIT_LO <= r.temp_eggval <= FIT_HI
    for sexo, el, pu, tot in (("macho", r.egg_larval_male_h, r.pupal_male_h, r.total_macho_h),
                              ("hembra", r.egg_larval_female_h, r.pupal_female_h, r.total_hembra_h),
                              ("promedio", r.huevo_larval_promedio_h, r.pupal_promedio_h, r.total_promedio_h)):
        add("powsner1935", r.temp_eggval, "huevo_larval", sexo, dur_h=el)
        add("powsner1935", r.temp_pupal, "pupal", sexo, dur_h=pu,
            notas="temperatura propia de la tabla pupal (experimento distinto)")
        add("powsner1935", r.temp_eggval, "total", sexo, dur_h=tot,
            usado=False,   # el ajuste usa los totales VERIFICADOS (abajo); estos quedan para sexo/estadios
            notas="total desde tablas de estadios (para analisis por sexo); NO es el input del ajuste")

# Totales VERIFICADOS = el input real del ajuste principal (marcados con usado=True en rango)
for _, r in tv.iterrows():
    add("powsner1935_verificado", r.temp_c, "total", "promedio", dur_d=r.total_days,
        usado=(FIT_LO <= r.temp_c <= FIT_HI),
        notas=("input del ajuste (T0/DD) " + (str(r.nota) if pd.notna(r.nota) else "")).strip())

for _, r in emb.iterrows():
    add("powsner1935", r.temp_c, "embrion", "sin_distincion", dur_h=r.egg_period_h, n=r.n)

for _, r in al_tot.iterrows():
    add("alsaffar1995_total", r.temp_c, "total", "sin_distincion", dur_d=r.duration_days,
        se_h=r.se * 24, n=r.n, mort=r.mortality_pct,
        notas="cria individual aislada: duraciones ~60-70% mas largas de lo estandar")

for _, r in al_ep.iterrows():
    add("alsaffar1995_huevo_pupa", r.temp_c, "huevo", "sin_distincion", dur_h=r.egg_h,
        se_h=r.egg_se, n=r.egg_n, mort=r.egg_mortality_pct, notas="solo filas de 100% HR")
    add("alsaffar1995_huevo_pupa", r.temp_c, "pupa", "sin_distincion", dur_h=r.pupa_h,
        se_h=r.pupa_se, n=r.pupa_n, mort=r.pupa_mortality_pct, notas="solo filas de 100% HR")

for _, r in bdsc.iterrows():
    add("bdsc", r.temp_c, "total", "sin_distincion", dur_d=r.duration_days,
        notas="valores redondeados de referencia; solo sanity check, no usar en ajustes")

tidy = pd.DataFrame(rows)

# --------------------------------------------------------------------------- #
#  Ajustes y predicciones
# --------------------------------------------------------------------------- #
ajustes = []
for nombre, tt, dur, lo, hi in [
    ("Powsner VERIFICADO, sexos promedio, 15-28 (PRINCIPAL)", tv.temp_c.values, tv.total_days.values, 15, 28),
    ("Powsner VERIFICADO, sexos promedio, 16-28", tv.temp_c.values, tv.total_days.values, 16, 28),
    ("Powsner VERIFICADO, sexos promedio, 18-28", tv.temp_c.values, tv.total_days.values, 18, 28),
    ("Powsner VERIFICADO, sexos promedio, 15-32 (mal ajuste)", tv.temp_c.values, tv.total_days.values, 15, 32),
    ("Powsner estadios, machos, 15-28", st.temp_eggval.values, (st.total_macho_h / 24).values, 15, 28),
    ("Powsner estadios, hembras, 15-28", st.temp_eggval.values, (st.total_hembra_h / 24).values, 15, 28),
    ("Al-Saffar total, 15-30", al_tot.temp_c.values, al_tot.duration_days.values, 15, 30),
    ("Al-Saffar total, 15-27.5", al_tot.temp_c.values, al_tot.duration_days.values, 15, 27.5),
]:
    f = fit_rate(tt, dur, lo, hi)
    ajustes.append(dict(subconjunto=nombre, rango_min=lo, rango_max=hi,
                        T0_c=round(f["T0"], 3), DD_grados_dia=round(f["DD"], 2),
                        R2=round(f["R2"], 5), n=f["n"]))
ajustes = pd.DataFrame(ajustes)

# control: el ajuste principal (datos verificados) debe reproducir T0=11.78 / DD=116.4
p = ajustes.iloc[0]
assert abs(p.T0_c - 11.78) < 0.03 and abs(p.DD_grados_dia - 116.4) < 0.6, "el ajuste principal no reproduce los valores publicados"

temps = np.arange(15, 30.01, 0.5)
predicciones = pd.DataFrame({
    "temp_c": temps,
    "eclosion_d": NEW_DD / (temps - NEW_T0),
    "pupacion_d": NEW_DD / (temps - NEW_T0) * NEW_PUP_FRAC,
    "en_rango_validez": (temps >= FIT_LO) & (temps <= FIT_HI),
})

sub = tv[tv.en_rango_ajuste]
pvo = pd.DataFrame({
    "temp_c": sub.temp_c.values,
    "observado_d": sub.total_days.values,
    "predicho_d": NEW_DD / (sub.temp_c.values - NEW_T0),
})
pvo["residual_d"] = pvo.predicho_d - pvo.observado_d

# reparto por estadios a 25 C
r25 = st.iloc[(np.abs(st.temp_eggval - 25.14)).argmin()]
emb25 = emb.loc[np.isclose(emb.temp_c, 25.06), "egg_period_h"].mean()
el25 = (r25.egg_larval_male_h + r25.egg_larval_female_h) / 2
pu25 = (r25.pupal_male_h + r25.pupal_female_h) / 2
tot25 = el25 + pu25
estadios25 = pd.DataFrame([
    dict(estadio="embrion", duracion_h=emb25, duracion_d=emb25 / 24, fraccion_del_total=emb25 / tot25),
    dict(estadio="larval", duracion_h=el25 - emb25, duracion_d=(el25 - emb25) / 24, fraccion_del_total=(el25 - emb25) / tot25),
    dict(estadio="pupal", duracion_h=pu25, duracion_d=pu25 / 24, fraccion_del_total=pu25 / tot25),
    dict(estadio="TOTAL", duracion_h=tot25, duracion_d=tot25 / 24, fraccion_del_total=1.0),
])

# --------------------------------------------------------------------------- #
#  Hoja LEEME
# --------------------------------------------------------------------------- #
leeme = pd.DataFrame([
    ("QUE ES ESTO", "Datos de calibracion del modelo de desarrollo de DrosoTracker, listos para graficar."),
    ("GENERADO POR", "analysis/exportar_tablas.py (no editar a mano: se regenera)"),
    ("", ""),
    ("HOJA tidy_todo", "Formato LARGO: una fila por medicion. Es la hoja comoda para ggplot2."),
    ("HOJA powsner_estadios", "Tabla cruda de Powsner (Tablas IX y X) + totales y tasa derivados."),
    ("HOJA powsner_embrion", "Tabla cruda de Powsner (Tabla VIII), periodo embrionario."),
    ("HOJA alsaffar_total", "Al-Saffar (Biol. Environ.) Tabla 1: huevo->adulto, cria individual aislada."),
    ("HOJA alsaffar_huevo_pupa", "Al-Saffar (J. Therm. Biol.): huevo y pupa, solo 100% HR."),
    ("HOJA alsaffar_fluctuantes", "22 regimenes alternantes. P = % del desarrollo predicho; P<100 = mas rapido."),
    ("HOJA bdsc", "Valores redondeados de referencia. Solo sanity check visual, NO usar en ajustes."),
    ("HOJA ajustes", "Resultado de las regresiones tasa~temperatura para varios subconjuntos."),
    ("HOJA predicciones", "Duracion de eclosion y pupacion predicha por temperatura (modelo calibrado)."),
    ("HOJA predicho_vs_observado", "Los 13 puntos del ajuste principal con sus residuos."),
    ("HOJA powsner_total_verif", "Totales huevo->adulto VERIFICADOS (Tablas IX+X): el input del ajuste."),
    ("HOJA estadios_25C", "Reparto embrion/larval/pupal medido a 25 C."),
    ("", ""),
    ("COLUMNA temp_c", "Temperatura de la medicion (C)."),
    ("COLUMNA estadio", "huevo_larval / pupal / total / embrion / huevo / pupa."),
    ("COLUMNA sexo", "macho / hembra / promedio / sin_distincion."),
    ("COLUMNA duracion_h, duracion_d", "Duracion en horas y en dias."),
    ("COLUMNA tasa_por_dia", "1 / duracion_d. Es la variable que se regresa contra temperatura."),
    ("COLUMNA en_rango_ajuste", "TRUE si 15 <= temp <= 28 (rango lineal declarado)."),
    ("COLUMNA usado_en_ajuste_principal", "TRUE solo para los 13 puntos VERIFICADOS que definen T0 y DD (fuente = powsner1935_verificado)."),
    ("", ""),
    ("MODELO", "T_dev(theta) = DD / (theta - T0)   <=>   tasa = (1/DD)*theta - T0/DD"),
    ("AJUSTE", "DD = 1/pendiente ; T0 = -intercepto/pendiente"),
    ("CALIBRADO", "T0 = 11.78 C ; DD = 116.4 (->116) grados-dia (~15-28 C, n=13, R2=0.997)"),
    ("", ""),
    ("EN R - leer", 'd <- read.csv("tidy_todo.csv")'),
    ("EN R - puntos del ajuste", 'fit <- subset(d, usado_en_ajuste_principal == "True")'),
    ("EN R - regresion", "m <- lm(tasa_por_dia ~ temp_c, data = fit)"),
    ("EN R - constantes", "DD <- 1/coef(m)[2] ; T0 <- -coef(m)[1]/coef(m)[2]"),
    ("OK", "Tablas de Powsner verificadas contra el PDF por el autor. Verificar Al-Saffar si se usa."),
], columns=["campo", "detalle"])

# --------------------------------------------------------------------------- #
#  Escribir
# --------------------------------------------------------------------------- #
xlsx = os.path.join(OUT, "DrosoTracker_datos_calibracion.xlsx")
with pd.ExcelWriter(xlsx, engine="openpyxl") as w:
    leeme.to_excel(w, sheet_name="LEEME", index=False)
    tidy.to_excel(w, sheet_name="tidy_todo", index=False)
    st.to_excel(w, sheet_name="powsner_estadios", index=False)
    emb.to_excel(w, sheet_name="powsner_embrion", index=False)
    al_tot.to_excel(w, sheet_name="alsaffar_total", index=False)
    al_ep.to_excel(w, sheet_name="alsaffar_huevo_pupa", index=False)
    al_fl.to_excel(w, sheet_name="alsaffar_fluctuantes", index=False)
    bdsc.to_excel(w, sheet_name="bdsc", index=False)
    tv.to_excel(w, sheet_name="powsner_total_verif", index=False)
    ajustes.to_excel(w, sheet_name="ajustes", index=False)
    predicciones.to_excel(w, sheet_name="predicciones", index=False)
    pvo.to_excel(w, sheet_name="predicho_vs_observado", index=False)
    estadios25.to_excel(w, sheet_name="estadios_25C", index=False)
    for ws in w.book.worksheets:                       # ancho de columna legible
        for col in ws.columns:
            width = max((len(str(c.value)) for c in col if c.value is not None), default=10)
            ws.column_dimensions[col[0].column_letter].width = min(max(width + 2, 10), 60)

tidy.to_csv(os.path.join(OUT, "tidy_todo.csv"), index=False, encoding="utf-8")
pvo.to_csv(os.path.join(OUT, "predicho_vs_observado.csv"), index=False, encoding="utf-8")

print(f"OK  {xlsx}")
print(f"    filas tidy: {len(tidy)}  |  hojas: 13")
print(f"    ajuste principal: T0={p.T0_c} DD={p.DD_grados_dia} R2={p.R2} n={p.n}")
print(f"    CSV sueltos: tidy_todo.csv, predicho_vs_observado.csv")
