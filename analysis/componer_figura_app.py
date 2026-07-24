#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Compone las 5 capturas de la app en una figura multipanel (A-E) para el manuscrito:
A = vista principal (panel grande, izquierda), y grilla 2x2 con B cronologia,
C calibracion, D supervivencia, E tamano muestral. Recorta margenes automaticamente
y agrega las etiquetas de panel.

Correr:  python analysis/componer_figura_app.py
Salida:  figures & tables/app/figure3_interface_overview.png (+ .pdf)
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "figures & tables", "app")

PANELS = [
    ("A", "01_main_view.png"),   # vista principal completa (panel grande)
    ("B", "panel_B.png"),        # cronologia — captura de elemento (tarjeta), recorte ajustado
    ("C", "panel_C.png"),        # calibracion — captura del modal
    ("D", "panel_D.png"),        # supervivencia — captura del modal
    ("E", "panel_E.png"),        # tamano muestral — captura del modal
]

H = 2200          # altura del panel A (px); todo se escala a esto
GAP = 34          # separacion entre paneles
MARGIN = 24       # margen blanco externo
BG = (255, 255, 255)
FONT_PATH = r"C:\Windows\Fonts\arialbd.ttf"


def autocrop(im, thresh=20, pad=14):
    """Recorta al bounding box del contenido (lo que difiere del color de los bordes)."""
    a = np.asarray(im.convert("RGB")).astype(int)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    diff = np.abs(a - bg).sum(2)
    ys, xs = np.where(diff > thresh)
    if len(xs) == 0:
        return im
    x0, x1 = max(0, xs.min() - pad), min(im.width, xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(im.height, ys.max() + pad)
    return im.crop((x0, y0, x1, y1))


def scale_to_h(im, h):
    return im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)


def contain(im, w, h):
    """Escala 'im' para caber en (w,h) manteniendo aspecto, centrado sobre fondo blanco."""
    r = min(w / im.width, h / im.height)
    im2 = im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))), Image.LANCZOS)
    canvas = Image.new("RGB", (w, h), BG)
    canvas.paste(im2, ((w - im2.width) // 2, (h - im2.height) // 2))
    return canvas


def label(canvas, letter, xy, size):
    """Dibuja la etiqueta de panel (letra en caja blanca redondeada) en xy."""
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(FONT_PATH, size)
    pad = int(size * 0.28)
    tb = d.textbbox((0, 0), letter, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    x, y = xy
    box = [x, y, x + tw + 2 * pad, y + th + 2 * pad]
    d.rounded_rectangle(box, radius=int(size * 0.22), fill=(255, 255, 255), outline=(60, 60, 70), width=max(2, size // 22))
    d.text((x + pad - tb[0], y + pad - tb[1]), letter, font=font, fill=(30, 30, 40))


# --- cargar y recortar ---
imgs = {k: autocrop(Image.open(os.path.join(APP, f))) for k, f in PANELS}

# --- panel A (izquierda, altura H) ---
A = scale_to_h(imgs["A"], H)

# --- grilla 2x2 (B C / D E), altura total H ---
cell_h = (H - GAP) // 2
cell_w = int(cell_h * 0.80)
gB = contain(imgs["B"], cell_w, cell_h)
gC = contain(imgs["C"], cell_w, cell_h)
gD = contain(imgs["D"], cell_w, cell_h)
gE = contain(imgs["E"], cell_w, cell_h)
grid_w = 2 * cell_w + GAP
grid = Image.new("RGB", (grid_w, H), BG)
grid.paste(gB, (0, 0))
grid.paste(gC, (cell_w + GAP, 0))
grid.paste(gD, (0, cell_h + GAP))
grid.paste(gE, (cell_w + GAP, cell_h + GAP))

# --- lienzo final ---
W = MARGIN + A.width + GAP + grid_w + MARGIN
fig = Image.new("RGB", (W, H + 2 * MARGIN), BG)
fig.paste(A, (MARGIN, MARGIN))
gx = MARGIN + A.width + GAP
fig.paste(grid, (gx, MARGIN))

# --- etiquetas de panel ---
LS = 62
off = 14
label(fig, "A", (MARGIN + off, MARGIN + off), LS)
label(fig, "B", (gx + off, MARGIN + off), LS)
label(fig, "C", (gx + cell_w + GAP + off, MARGIN + off), LS)
label(fig, "D", (gx + off, MARGIN + cell_h + GAP + off), LS)
label(fig, "E", (gx + cell_w + GAP + off, MARGIN + cell_h + GAP + off), LS)

out_png = os.path.join(APP, "figure3_interface_overview.png")
fig.save(out_png, dpi=(300, 300))
try:
    fig.convert("RGB").save(os.path.join(APP, "figure3_interface_overview.pdf"), "PDF", resolution=300)
except PermissionError:
    print("  (aviso: no se pudo escribir el PDF — cerralo si lo tenes abierto)")
print(f"OK  {out_png}")
print(f"    tamano final: {fig.width} x {fig.height} px")
print(f"    panel A: {A.width}x{A.height} | celda grilla: {cell_w}x{cell_h}")
