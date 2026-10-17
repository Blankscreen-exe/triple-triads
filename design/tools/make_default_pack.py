"""Generate the default asset pack (Balamb Classic style placeholders).

Writes the files described in design/SPEC.md, section 7.1, to apps/web/public/packs/default/:
  bg-blue.png, bg-red.png, frame.png, card-back.png   full card size (from the layout)
  digits.png, elements.png, stars.png                  single-row sprite sheets

Everything is drawn at 4x and downscaled for smooth edges. Requires Pillow.
Run: python design/tools/make_default_pack.py
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
LAYOUT = json.loads((ROOT / "packages/card-layout/src/card-layout.json").read_text())
OUT = ROOT / "apps/web/public/packs/default"

W, H = LAYOUT["width"], LAYOUT["height"]
BORDER = LAYOUT["frameBorder"]
SS = 4  # supersampling factor

CREAM = (236, 230, 210, 255)
GOLD = (201, 178, 122, 255)
INK = (27, 35, 64, 255)
NIGHT = (11, 16, 32, 255)


def font(names, size):
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    raise SystemExit(f"None of these fonts are installed: {names}")


# Lining figures (all digits on one baseline); Georgia is avoided for its old-style figures.
SERIF_BOLD = ["cambriab.ttf", "timesbd.ttf", "DejaVuSerif-Bold.ttf", "LiberationSerif-Bold.ttf"]


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def vertical_gradient(size, stops):
    """stops: list of (position 0..1, rgba)."""
    w, h = size
    img = Image.new("RGBA", size)
    draw = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
            if p0 <= t <= p1:
                draw.line((0, y, w, y), fill=lerp(c0, c1, (t - p0) / (p1 - p0)))
                break
    return img


def diagonal_sheen(size, alpha):
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for x in range(-h, w, 48):
        draw.line((x, 0, x + h, h), fill=(255, 255, 255, alpha), width=14)
    return layer


def save(img, name, size=None):
    if size is not None:
        img = img.resize(size, Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name, optimize=True)
    print(f"  {name:14} {img.width}x{img.height}")


# --- Backgrounds -----------------------------------------------------------------------------


def background(top, middle, bottom):
    img = vertical_gradient((W, H), [(0, top), (0.45, middle), (1, bottom)])
    return Image.alpha_composite(img, diagonal_sheen((W, H), 10))


# --- Frame -----------------------------------------------------------------------------------


def frame():
    img = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    b = BORDER * SS
    # Name plate: dark band so the name and stars stay readable on any background.
    x0, y0, x1, y1 = (v * SS for v in LAYOUT["namePlate"])
    plate = vertical_gradient((x1 - x0, y1 - y0), [(0, (0, 0, 0, 90)), (1, (0, 0, 0, 175))])
    img.alpha_composite(plate, (x0, y0))
    d.line((x0, y0, x1, y0), fill=CREAM, width=3 * SS)
    # Border band: cream with a gold outer edge and a dark inner line.
    d.rectangle((0, 0, W * SS - 1, H * SS - 1), outline=CREAM, width=b)
    d.rectangle((0, 0, W * SS - 1, H * SS - 1), outline=GOLD, width=4 * SS)
    d.rectangle((b, b, W * SS - b - 1, H * SS - b - 1), outline=INK, width=2 * SS)
    return img.resize((W, H), Image.LANCZOS)


# --- Card back -------------------------------------------------------------------------------


def card_back():
    img = Image.new("RGBA", (W, H), (29, 42, 82, 255))
    d = ImageDraw.Draw(img)
    for x in range(-H, W, 36):
        d.line((x, 0, x + H, H), fill=(38, 56, 110, 255), width=16)
    d.rectangle((0, 0, W - 1, H - 1), outline=CREAM, width=BORDER)
    d.rectangle((0, 0, W - 1, H - 1), outline=GOLD, width=4)
    inset = BORDER + 24
    d.rectangle((inset, inset, W - inset - 1, H - inset - 1), outline=GOLD, width=3)
    # Central emblem: a diamond with the game's initials.
    cx, cy, r = W // 2, H // 2, 210
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=INK, outline=GOLD)
    d.polygon([(cx, cy - r + 22), (cx + r - 22, cy), (cx, cy + r - 22), (cx - r + 22, cy)], outline=CREAM)
    f = font(SERIF_BOLD, 150)
    d.text((cx, cy), "TT", font=f, fill=CREAM, anchor="mm", stroke_width=4, stroke_fill=NIGHT)
    return img


# --- Digits ----------------------------------------------------------------------------------


def digits():
    cw, ch = LAYOUT["sheets"]["digits"]["cell"]
    order = LAYOUT["sheets"]["digits"]["order"]
    img = Image.new("RGBA", (cw * len(order) * SS, ch * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = font(SERIF_BOLD, int(ch * 0.82 * SS))
    for i, char in enumerate(order):
        cx = (i + 0.5) * cw * SS
        d.text((cx, ch * 0.52 * SS), char, font=f, fill=(255, 255, 255, 255), anchor="mm",
               stroke_width=int(4.5 * SS), stroke_fill=(0, 0, 0, 255))
    return img, (cw * len(order), ch)


# --- Elements --------------------------------------------------------------------------------


def star_points(cx, cy, outer, inner, points, rotation=-math.pi / 2):
    pts = []
    for k in range(points * 2):
        r = outer if k % 2 == 0 else inner
        a = rotation + k * math.pi / points
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def droplet(cx, cy, r):
    """A teardrop pointing up (x = r·sin t·sin(t/2), y = -r·cos t), as a polygon."""
    return [
        (cx + r * math.sin(t) * math.sin(t / 2), cy - r * math.cos(t))
        for t in (math.radians(k) for k in range(0, 361, 4))
    ]


def element_icon(name, size):
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c, r = s / 2, s * 0.46
    d.ellipse((c - r, c - r, c + r, c + r), fill=(11, 16, 32, 200), outline=CREAM, width=3 * SS)
    u = s * 0.3  # symbol scale
    if name == "fire":
        d.polygon(droplet(c, c, u * 0.95), fill=(255, 122, 26, 255))
        d.polygon(droplet(c, c + u * 0.25, u * 0.5), fill=(255, 216, 74, 255))
    elif name == "ice":
        for k in range(3):
            a = math.radians(90 + k * 60)
            dx, dy = math.cos(a) * u, math.sin(a) * u
            d.line((c - dx, c - dy, c + dx, c + dy), fill=(191, 232, 255, 255), width=4 * SS)
            for sign in (1, -1):
                bx, by = c + sign * dx * 0.6, c + sign * dy * 0.6
                for turn in (0.6, -0.6):
                    ba = a + (math.pi if sign < 0 else 0) + turn
                    d.line((bx, by, bx + math.cos(ba) * u * 0.35, by + math.sin(ba) * u * 0.35),
                           fill=(191, 232, 255, 255), width=3 * SS)
    elif name == "thunder":
        bolt = [(0.15, -1), (-0.45, 0.1), (-0.02, 0.1), (-0.2, 1), (0.45, -0.15), (0.03, -0.15), (0.3, -1)]
        d.polygon([(c + x * u, c + y * u) for x, y in bolt], fill=(255, 216, 74, 255))
    elif name == "earth":
        d.polygon([(c - u, c + u * 0.7), (c - u * 0.2, c - u * 0.8), (c + u * 0.4, c + u * 0.7)],
                  fill=(176, 136, 80, 255))
        d.polygon([(c - u * 0.1, c + u * 0.7), (c + u * 0.45, c - u * 0.35), (c + u, c + u * 0.7)],
                  fill=(120, 150, 80, 255))
    elif name == "poison":
        d.polygon(droplet(c - u * 0.15, c, u * 0.8), fill=(178, 107, 255, 255))
        for bx, by, br in ((0.6, -0.5, 0.22), (0.75, 0.1, 0.14)):
            d.ellipse((c + (bx - br) * u, c + (by - br) * u, c + (bx + br) * u, c + (by + br) * u),
                      fill=(178, 107, 255, 255))
    elif name == "wind":
        for k, rr in enumerate((0.95, 0.65, 0.35)):
            box = (c - rr * u, c - rr * u, c + rr * u, c + rr * u)
            d.arc(box, 200 + k * 25, 470 + k * 25, fill=(142, 230, 160, 255), width=4 * SS)
    elif name == "water":
        d.polygon(droplet(c, c, u * 0.95), fill=(74, 168, 255, 255))
        d.ellipse((c - u * 0.35, c + u * 0.05, c - u * 0.1, c + u * 0.3), fill=(200, 230, 255, 255))
    elif name == "holy":
        d.polygon(star_points(c, c, u * 1.05, u * 0.3, 4), fill=(255, 243, 196, 255))
        d.polygon(star_points(c, c, u * 0.55, u * 0.18, 4, rotation=-math.pi / 4), fill=(255, 255, 255, 255))
    else:
        raise ValueError(f"No icon for element {name!r}")
    return img


def elements():
    cw, ch = LAYOUT["sheets"]["elements"]["cell"]
    order = LAYOUT["sheets"]["elements"]["order"]
    img = Image.new("RGBA", (cw * len(order) * SS, ch * SS), (0, 0, 0, 0))
    for i, name in enumerate(order):
        img.alpha_composite(element_icon(name, cw), (i * cw * SS, 0))
    return img, (cw * len(order), ch)


# --- Stars -----------------------------------------------------------------------------------


def stars():
    cw, ch = LAYOUT["sheets"]["stars"]["cell"]
    order = LAYOUT["sheets"]["stars"]["order"]
    img = Image.new("RGBA", (cw * len(order) * SS, ch * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, key in enumerate(order):
        cx, cy = (i + 0.5) * cw * SS, ch * 0.52 * SS
        pts = star_points(cx, cy, cw * 0.46 * SS, cw * 0.2 * SS, 5)
        if key == "filled":
            d.polygon(pts, fill=(252, 211, 77, 255), outline=(60, 40, 0, 255), width=2 * SS)
        else:
            d.polygon(pts, fill=(0, 0, 0, 90), outline=(236, 230, 210, 110), width=2 * SS)
    return img, (cw * len(order), ch)


def main():
    print(f"Writing default pack to {OUT}")
    save(background((109, 155, 230, 255), (58, 100, 196, 255), (27, 47, 122, 255)), "bg-blue.png")
    save(background((236, 138, 144, 255), (194, 66, 79, 255), (110, 21, 32, 255)), "bg-red.png")
    save(frame(), "frame.png")
    save(card_back(), "card-back.png")
    for builder, name in ((digits, "digits.png"), (elements, "elements.png"), (stars, "stars.png")):
        img, size = builder()
        save(img, name, size)


if __name__ == "__main__":
    main()
