#!/usr/bin/env python3
"""Рендер Description-картинки 640×360 для BotFather (бренд CitySignal)."""
import io, os, tempfile
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

INTER = "/Users/askarembulatov/event-app/react_native_sf/node_modules/@fontsource/inter/files"
MENLO = "/System/Library/Fonts/Menlo.ttc"
OUT = "/Users/askarembulatov/event-app/react_native_sf/bot-setup/description-640x360.png"
TMP = tempfile.mkdtemp()

def woff2ttf(name):
    src = os.path.join(INTER, name)
    dst = os.path.join(TMP, name.replace(".woff", ".ttf"))
    f = TTFont(src)
    f.flavor = None
    f.save(dst)
    return dst

inter900_lat = woff2ttf("inter-latin-900-normal.woff")
inter900_cyr = woff2ttf("inter-cyrillic-900-normal.woff")

S = 2  # supersample
W, H = 640 * S, 360 * S
INK = (13, 13, 13)
PAPER = (255, 255, 255)
SIGNAL = (0, 85, 255)
YELLOW = (255, 213, 0)
INK55 = (120, 120, 120)
DOT = (238, 238, 238)

img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)

# faint dot grid
for y in range(24 * S, H, 26 * S):
    for x in range(24 * S, W, 26 * S):
        r = 1.1 * S
        d.ellipse([x - r, y - r, x + r, y + r], fill=DOT)

M = 34 * S

def is_cyr(ch):
    return "Ѐ" <= ch <= "ӿ"

def tracked_width(text, font_lat, font_cyr, tracking):
    w = 0.0
    for ch in text:
        f = font_cyr if is_cyr(ch) else font_lat
        w += d.textlength(ch, font=f) + tracking
    return w - tracking if text else 0

def draw_tracked(x, baseline, text, font_lat, font_cyr, fill, tracking):
    cx = x
    for ch in text:
        f = font_cyr if is_cyr(ch) else font_lat
        d.text((cx, baseline), ch, font=f, fill=fill, anchor="ls")
        cx += d.textlength(ch, font=f) + tracking

# ── mono lines: Menlo (has latin+cyrillic), bold index 1
menlo_lbl = ImageFont.truetype(MENLO, 12 * S, index=1)
menlo_tag = ImageFont.truetype(MENLO, 12 * S, index=0)

# label row (baseline y=46)
draw_tracked(M, 46 * S, "CITYSIGNAL", menlo_lbl, menlo_lbl, INK55, 3 * S)
rt = "АФИША ГОРОДА"
rw = tracked_width(rt, menlo_lbl, menlo_lbl, 3 * S)
draw_tracked(int(640 * S - M - rw), 46 * S, rt, menlo_lbl, menlo_lbl, INK55, 3 * S)
# rule under label
d.rectangle([M, 57 * S, 640 * S - M, 57 * S + 2 * S], fill=INK)

# wordmark CITY (baseline 178)
inter_city_l = ImageFont.truetype(inter900_lat, 104 * S)
inter_city_c = ImageFont.truetype(inter900_cyr, 104 * S)
draw_tracked(M - 2 * S, 178 * S, "CITY", inter_city_l, inter_city_c, INK, -3 * S)
cityW = tracked_width("CITY", inter_city_l, inter_city_c, -3 * S)

# yellow register square
ys = 26 * S
yx = int(M - 2 * S + cityW + 22 * S)
yy = 108 * S
d.rectangle([yx, yy, yx + ys, yy + ys], fill=YELLOW)
d.rectangle([yx, yy, yx + ys, yy + ys], outline=INK, width=2 * S)

# SIGNAL plate
sigW = tracked_width("SIGNAL", inter_city_l, inter_city_c, -3 * S)
padX = 12 * S
plate_x, plate_top, plate_h = M - 2 * S, 196 * S, 96 * S
d.rectangle([plate_x, plate_top, plate_x + sigW + padX * 2, plate_top + plate_h], fill=SIGNAL)
draw_tracked(int(plate_x + padX), int(plate_top + 74 * S), "SIGNAL", inter_city_l, inter_city_c, PAPER, -3 * S)

# bottom rule + tagline
d.rectangle([M, 311 * S, 640 * S - M, 311 * S + 2 * S], fill=INK)
draw_tracked(M, 336 * S, "ЧТО ДВИЖЕТСЯ В ГОРОДЕ · СОБЕРИ ЛЕНТУ ПОД СЕБЯ",
             menlo_tag, menlo_tag, INK55, 2 * S)

img = img.resize((640, 360), Image.LANCZOS)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT, "PNG")
print("saved", OUT, img.size)
