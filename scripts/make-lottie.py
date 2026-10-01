#!/usr/bin/env python3
"""
Generates the site's Lottie scenes into public/lottie/.
Authored against the text-to-lottie skill: native text layers (Clash Display,
already loaded on every page), lead/follow easing from the skill's anchors,
build > settle > hold spine, one flourish per scene, zero chrome.

  python3 scripts/make-lottie.py
"""
import json, math, os
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.qu2cuPen import Qu2CuPen

FONT_FILE = os.path.join(os.path.dirname(__file__), 'fonts', 'ClashDisplay-Bold.ttf')
_TT = TTFont(FONT_FILE)
_UPM = _TT['head'].unitsPerEm
_CMAP = _TT.getBestCmap()
_GS = _TT.getGlyphSet()


def glyph_char(ch):
    """Lottie `chars` entry: glyph outlines at a 100-unit em, y down, baseline origin."""
    k = 100.0 / _UPM
    name = _CMAP.get(ord(ch))
    if name is None:
        return {"ch": ch, "size": 100, "style": "Bold", "w": 30, "data": {"shapes": []}, "fFamily": "Clash Display"}
    g = _GS[name]
    rec = RecordingPen()
    g.draw(Qu2CuPen(rec, max_err=1.0, all_cubic=True))
    contours, cur = [], None
    for op, args in rec.value:
        if op == 'moveTo':
            cur = {"v": [], "i": [], "o": []}
            contours.append(cur)
            x, y = args[0]
            cur["v"].append([x * k, -y * k]); cur["i"].append([0, 0]); cur["o"].append([0, 0])
        elif op == 'lineTo':
            x, y = args[0]
            cur["v"].append([x * k, -y * k]); cur["i"].append([0, 0]); cur["o"].append([0, 0])
        elif op == 'curveTo':
            (c1x, c1y), (c2x, c2y), (x, y) = args[-3], args[-2], args[-1]
            px, py = cur["v"][-1]
            cur["o"][-1] = [c1x * k - px, -c1y * k - py]
            cur["v"].append([x * k, -y * k]); cur["i"].append([c2x * k - x * k, -c2y * k + y * k]); cur["o"].append([0, 0])
        elif op == 'qCurveTo':
            raise RuntimeError('quadratic segment leaked through Qu2CuPen')
        elif op in ('closePath', 'endPath'):
            if cur and len(cur["v"]) > 1 and cur["v"][0] == cur["v"][-1]:
                cur["i"][0] = cur["i"][-1]
                for key in ("v", "i", "o"):
                    cur[key].pop()
    shapes = [{"ind": n, "ty": "sh", "ks": {"a": 0, "k": {"i": c["i"], "o": c["o"], "v": c["v"], "c": True}}} for n, c in enumerate(contours) if len(c["v"]) > 1]
    adv = _TT['hmtx'][name][0] * k
    if ch == ' ':
        adv = max(adv, 24.0)  # Clash Display's space is 0.14em; open it up for display sizes
    # lottie-web appends the group transform itself (dataManager.checkChars), so `it` holds paths only
    return {"ch": ch, "size": 100, "style": "Bold", "w": adv, "data": {"shapes": [{"ty": "gr", "it": shapes}]}, "fFamily": "Clash Display"}


def chars_for(*texts):
    seen, out = set(), []
    for t in texts:
        for ch in t:
            if ch not in seen:
                seen.add(ch); out.append(glyph_char(ch))
    return out

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'lottie')
os.makedirs(OUT, exist_ok=True)

FPS = 60
TEXT = [0.961, 0.953, 0.937]      # #F5F3EF
ACCENT = [1.0, 0.353, 0.122]      # #FF5A1F
LINE = [0.29, 0.29, 0.29]         # hairline on #0D0D0D
FONT = {"list": [{"fName": "ClashDisplay-Bold", "fFamily": "Clash Display", "fStyle": "Bold", "ascent": 72}]}

# Easing anchors (x1,y1,x2,y2) from motion-taste.md
ENTRANCE_SHARP = (.20, .75, .34, .94)
SETTLE_SOFT = (.00, .65, .51, .99)
EXPRESSIVE_POP = (.94, .75, .34, .94)
EXIT_ACCEL = (1.0, .02, .54, .42)


def kf(frames, ease=SETTLE_SOFT, dims=1):
    """frames: list of (t, value). Returns animated property dict."""
    keys = []
    for idx, (t, v) in enumerate(frames):
        v = v if isinstance(v, list) else [v]
        k = {"t": t, "s": v}
        if idx < len(frames) - 1:
            e = ease if not isinstance(ease, list) else ease[idx]
            if e == 'hold':
                k["h"] = 1
            else:
                x1, y1, x2, y2 = e
                k["o"] = {"x": [x1] * dims, "y": [y1] * dims}
                k["i"] = {"x": [x2] * dims, "y": [y2] * dims}
        keys.append(k)
    return {"a": 1, "k": keys}


def st(v):
    return {"a": 0, "k": v}


def transform(p=(0, 0), o=100, s=(100, 100), a=(0, 0), r=0):
    return {"o": o if isinstance(o, dict) else st(o), "r": st(r),
            "p": p if isinstance(p, dict) else st([p[0], p[1], 0]),
            "a": st([a[0], a[1], 0]),
            "s": s if isinstance(s, dict) else st([s[0], s[1], 100])}


def text_layer(ind, name, text, x, y, size, ip, op, justify=2, tracking=-30,
               color=TEXT, rise=None, opacity=None):
    """rise=(start_frame, end_frame, px, window_pct): per-character rise + fade."""
    doc = {"s": size, "f": "ClashDisplay-Bold", "t": text, "j": justify,
           "tr": tracking, "lh": size * 1.1, "ls": 0, "fc": color}
    layer = {"ddd": 0, "ind": ind, "ty": 5, "nm": name, "sr": 1,
             "ks": transform((x, y), o=opacity if opacity else 100), "ao": 0,
             "t": {"d": {"k": [{"s": doc, "t": 0}]}, "p": {},
                   "m": {"g": 1, "a": st([0, 0])}, "a": []},
             "ip": ip, "op": op, "st": 0, "bm": 0}
    if rise:
        f0, f1, px, w = rise
        layer["t"]["a"].append({
            "nm": "rise",
            "s": {"t": 0, "xe": st(0), "ne": st(0), "a": st(100), "b": 1, "rn": 0,
                  "sh": 2, "s": st(0), "e": st(w), "r": 1,
                  "o": kf([(f0, -w), (f1, 100)], ENTRANCE_SHARP)},
            "a": {"p": st([0, px, 0]), "o": st(0)},
        })
    return layer


def path_shape(vertices, closed=False, tangents=None):
    n = len(vertices)
    i = tangents[0] if tangents else [[0, 0]] * n
    o = tangents[1] if tangents else [[0, 0]] * n
    return {"ty": "sh", "nm": "path", "ks": st({"i": i, "o": o, "v": vertices, "c": closed})}


def stroke(color, width, opacity=100):
    return {"ty": "st", "nm": "stroke", "c": st(color), "o": st(opacity) if not isinstance(opacity, dict) else opacity,
            "w": st(width), "lc": 2, "lj": 2}


def fill(color, opacity=100):
    return {"ty": "fl", "nm": "fill", "c": st(color), "o": opacity if isinstance(opacity, dict) else st(opacity), "r": 1}


def trim(start, end, ease=SETTLE_SOFT):
    return {"ty": "tm", "nm": "trim", "s": st(0), "e": kf([(start, 0), (end, 100)], ease), "o": st(0), "m": 1}


def group(name, items, p=(0, 0), s=(100, 100), o=100, a=(0, 0)):
    tr = {"ty": "tr", "p": st([p[0], p[1]]), "a": st([a[0], a[1]]),
          "s": s if isinstance(s, dict) else st([s[0], s[1]]),
          "r": st(0), "o": o if isinstance(o, dict) else st(o), "sk": st(0), "sa": st(0)}
    return {"ty": "gr", "nm": name, "it": items + [tr]}


def shape_layer(ind, name, groups, ip, op, p=(0, 0), opacity=100):
    return {"ddd": 0, "ind": ind, "ty": 4, "nm": name, "sr": 1,
            "ks": transform(p, o=opacity), "ao": 0, "shapes": groups,
            "ip": ip, "op": op, "st": 0, "bm": 0}


def comp(name, w, h, op, layers, texts=()):
    return {"v": "5.12.1", "fr": FPS, "ip": 0, "op": op, "w": w, "h": h, "nm": name,
            "ddd": 0, "assets": [], "fonts": FONT, "chars": chars_for(*texts), "layers": layers, "markers": []}


def bolt_vertices(cx, cy, size):
    # 24-unit lucide-style bolt silhouette, scaled and centred
    pts = [(13, 2), (3, 14), (11, 14), (10, 22), (21, 10), (13, 10)]
    k = size / 24
    return [[cx + (x - 12) * k, cy + (y - 12) * k] for x, y in pts]


def sine_path(x0, x1, y, amp, waves, steps_per_wave=8):
    n = waves * steps_per_wave
    L = (x1 - x0) / waves
    v, ti, to = [], [], []
    h = (x1 - x0) / n
    for j in range(n + 1):
        x = x0 + j * h
        ph = 2 * math.pi * (x - x0) / L
        v.append([x, y + amp * math.sin(ph)])
        dy = amp * math.cos(ph) * 2 * math.pi / L
        to.append([h / 3, dy * h / 3])
        ti.append([-h / 3, -dy * h / 3])
    return v, (ti, to)


# ─────────────────────────────────────────────────────────────────
# 1. Footer wordmark: SOKO ⚡ MOTO
#    build (chars rise, bolt draws) > settle (bolt fills) > hold
# ─────────────────────────────────────────────────────────────────
W, H, OP = 1600, 340, 110
bolt = bolt_vertices(790, 212, 160)
bolt_group = group("bolt", [
    path_shape(bolt, closed=True),
    trim(14, 52, ENTRANCE_SHARP),
    stroke(ACCENT, 7),
])
bolt_fill_group = group("bolt-fill", [
    path_shape(bolt, closed=True),
    fill(ACCENT, kf([(46, 0), (66, 100)], SETTLE_SOFT)),
])
rule_group = group("rule", [
    path_shape([[60, 318], [1540, 318]]),
    trim(30, 92, SETTLE_SOFT),
    stroke(LINE, 2),
])
wordmark = comp("SOKO MOTO wordmark", W, H, OP, [
    text_layer(1, "SOKO", "SOKO", 380, 285, 200, 0, OP, rise=(0, 34, 150, 40)),
    shape_layer(2, "bolt", [bolt_group], 0, OP),
    shape_layer(3, "bolt fill", [bolt_fill_group], 0, OP),
    text_layer(4, "MOTO", "MOTO", 1205, 285, 200, 0, OP, rise=(10, 46, 150, 40)),
    shape_layer(5, "rule", [rule_group], 0, OP),
], texts=("SOKO", "MOTO"))

# ─────────────────────────────────────────────────────────────────
# 2. Closing CTA: SEE IT BEFORE / IT SAILS.
#    support line settles, active phrase "IT SAILS." travels in,
#    one flourish: a wave hairline draws under it, then the bolt of a
#    ship-mast tick lands. Hold.
# ─────────────────────────────────────────────────────────────────
W2, H2, OP2 = 1400, 460, 130
wave_v, wave_t = sine_path(40, 1000, 428, 9, 6)
wave_group = group("wave", [
    path_shape(wave_v, closed=False, tangents=wave_t),
    trim(44, 104, ENTRANCE_SHARP),
    stroke(ACCENT, 5),
])
sails = text_layer(3, "IT SAILS.", "IT SAILS.", 40, 372, 150, 0, OP2, justify=0, tracking=-25)
# whole-phrase travel: position leads, opacity follows (early-opacity / late-settle)
sails["ks"]["p"] = kf([(18, [-90, 372, 0]), (64, [40, 372, 0])], EXPRESSIVE_POP, dims=3)
sails["ks"]["o"] = kf([(18, 0), (40, 100)], SETTLE_SOFT)
see_it = comp("See it before it sails", W2, H2, OP2, [
    text_layer(1, "SEE IT BEFORE", "SEE IT BEFORE", 40, 200, 150, 0, OP2, justify=0, tracking=-25,
               rise=(0, 40, 110, 35)),
    shape_layer(2, "wave", [wave_group], 0, OP2),
    sails,
], texts=("SEE IT BEFORE", "IT SAILS."))

# ─────────────────────────────────────────────────────────────────
# 3. 404: the "0" is a battery that drains in steps, flickers, cuts back. Loop.
# ─────────────────────────────────────────────────────────────────
W3, H3, OP3 = 900, 420, 200
bx, by, bw, bh, r = 300, 125, 300, 170, 30   # battery body (top-left, size)
body = {"ty": "rc", "nm": "body", "d": 1, "p": st([bx + bw / 2, by + bh / 2]), "s": st([bw, bh]), "r": st(r)}
nub = {"ty": "rc", "nm": "nub", "d": 1, "p": st([bx + bw + 14, by + bh / 2]), "s": st([22, 64]), "r": st(8)}
body_group = group("battery", [body, nub, stroke(TEXT, 10)])
# fill rect anchored at left edge: scale x drains in stepped beats
inner_w, inner_h, pad = bw - 44, bh - 44, 22
drain = kf([
    (0, [100, 100]), (22, [74, 100]),      # beat 1
    (44, [74, 100]), (62, [50, 100]),      # beat 2
    (84, [50, 100]), (100, [26, 100]),     # beat 3
    (122, [26, 100]), (136, [7, 100]),     # beat 4 (almost empty)
    (172, [7, 100]), (184, [100, 100]),    # cut back to full (loop reset)
], ease=[SETTLE_SOFT, 'hold', SETTLE_SOFT, 'hold', SETTLE_SOFT, 'hold', SETTLE_SOFT, 'hold', EXIT_ACCEL], dims=2)
flicker = kf([(136, 100), (140, 25), (143, 100), (150, 20), (153, 100), (172, 100), (184, 100)],
             ease=['hold'] * 6, dims=1)
fill_rect = {"ty": "rc", "nm": "charge", "d": 1, "p": st([inner_w / 2, 0]), "s": st([inner_w, inner_h]), "r": st(12)}
fill_group = group("charge", [fill_rect, fill(ACCENT, flicker)], p=(bx + pad, by + bh / 2), s=drain)
four_oh_four = comp("404 battery", W3, H3, OP3, [
    text_layer(1, "4", "4", 160, 300, 260, 0, OP3, tracking=0),
    shape_layer(2, "battery", [body_group], 0, OP3),
    shape_layer(3, "charge", [fill_group], 0, OP3),
    text_layer(4, "4 (right)", "4", 740, 300, 260, 0, OP3, tracking=0),
], texts=("4",))

for name, data in [("wordmark", wordmark), ("see-it", see_it), ("four-oh-four", four_oh_four)]:
    path = os.path.join(OUT, name + ".json")
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(path, os.path.getsize(path), "bytes")
