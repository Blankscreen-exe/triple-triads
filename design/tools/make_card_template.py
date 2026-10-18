"""Generate measurement templates from packages/card-layout/src/card-layout.json.

Outputs (in apps/web/public/templates/, downloadable from the app's /templates page):
  card-template-lines.png    - card outlines only, transparent (drop on top of your PSD)
  card-template-labeled.png  - card outlines + labels and pixel coordinates, white background
  frame-template-lines.png         - frame outlines only, transparent (for frame.png)
  frame-template-labeled.png       - frame outlines + labels, white background
  background-template-lines.png    - background outlines only, transparent (for bg-blue.png / bg-red.png)
  background-template-labeled.png  - background outlines + labels, white background
  card-back-template-lines.png     - card edge and centre only, transparent (for card-back.png)
  card-back-template-labeled.png   - card back size and notes, white background
  sheet-digits.png           - asset sheet grid for stat characters 1-9, A
  sheet-elements.png         - asset sheet grid for element icons
  sheet-stars.png            - asset sheet grid for stars

All boxes are [x0, y0, x1, y1] in pixels; the game uses the same layout file to draw cards.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DESIGN = Path(__file__).resolve().parent.parent
OUT = DESIGN.parent / "apps" / "web" / "public" / "templates"
LAYOUT = json.loads((DESIGN.parent / "packages" / "card-layout" / "src" / "card-layout.json").read_text())

W, H = LAYOUT["width"], LAYOUT["height"]
B = LAYOUT["frameBorder"]

EDGE = (0, 0, 0, 255)
FRAME = (0, 120, 255, 255)
ZONE = (230, 30, 30, 255)
SAFE = (0, 170, 70, 255)
HINT = (150, 150, 150, 255)
LINE = 2


def font(size):
    for name in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def box(d, b, color, width=LINE):
    x0, y0, x1, y1 = b
    d.rectangle((x0, y0, x1 - 1, y1 - 1), outline=color, width=width)


def dashed_box(d, b, color, dash=16):
    x0, y0, x1, y1 = b
    x1, y1 = x1 - 1, y1 - 1
    for x in range(x0, x1, dash * 2):
        d.line((x, y0, min(x + dash, x1), y0), fill=color, width=LINE)
        d.line((x, y1, min(x + dash, x1), y1), fill=color, width=LINE)
    for y in range(y0, y1, dash * 2):
        d.line((x0, y, x0, min(y + dash, y1)), fill=color, width=LINE)
        d.line((x1, y, x1, min(y + dash, y1)), fill=color, width=LINE)


def dims(b):
    x0, y0, x1, y1 = b
    return f"{x1 - x0}x{y1 - y0} @ {x0},{y0}"


def draw_card_lines(d):
    box(d, (0, 0, W, H), EDGE)                       # card edge
    box(d, (B, B, W - B, H - B), FRAME)               # inner edge of frame border
    dashed_box(d, LAYOUT["safeArea"], SAFE)
    dashed_box(d, LAYOUT["statsArea"], ZONE, dash=8)
    for b in LAYOUT["stats"].values():
        box(d, b, ZONE)
    box(d, LAYOUT["element"], ZONE)
    box(d, LAYOUT["namePlate"], FRAME)
    box(d, LAYOUT["name"], ZONE)
    for b in LAYOUT["stars"]:
        box(d, b, ZONE)
    cx, cy = (LAYOUT["safeArea"][0] + LAYOUT["safeArea"][2]) // 2, (LAYOUT["safeArea"][1] + LAYOUT["safeArea"][3]) // 2
    d.line((cx - 12, cy, cx + 12, cy), fill=SAFE, width=LINE)
    d.line((cx, cy - 12, cx, cy + 12), fill=SAFE, width=LINE)


def draw_card_labels(d):
    f, fs = font(16), font(13)
    _, y0, _, _ = LAYOUT["safeArea"]
    d.text((320, y0 + 6), f"SAFE AREA (art subject)  {dims(LAYOUT['safeArea'])}", font=f, fill=SAFE)
    for side, b in LAYOUT["stats"].items():
        x0, y0, x1, y1 = b
        d.text((x0 + 4, y0 + 3), side.upper(), font=fs, fill=ZONE)
        d.text((x0 + 4, y1 - 18), f"{x1 - x0}x{y1 - y0}", font=fs, fill=ZONE)
    x0, y0, x1, y1 = LAYOUT["statsArea"]
    d.text((x0 + 4, y1 + 4), f"STATS AREA {dims(LAYOUT['statsArea'])}", font=fs, fill=ZONE)
    x0, y0, x1, y1 = LAYOUT["element"]
    d.text((x0 + 4, y0 + 3), "ELEMENT", font=fs, fill=ZONE)
    d.text((x0 - 150, y1 - 18), dims(LAYOUT["element"]), font=fs, fill=ZONE)
    x0, y0, _, _ = LAYOUT["name"]
    d.text((x0 + 4, y0 + 3), f"NAME (font)  {dims(LAYOUT['name'])}", font=f, fill=ZONE)
    x0, y0, _, _ = LAYOUT["namePlate"]
    d.text((x0 + 4, y0 - 20), f"NAME PLATE {dims(LAYOUT['namePlate'])}", font=fs, fill=FRAME)
    sx0, sy0, sx1, _ = LAYOUT["stars"][0]
    gap = LAYOUT["stars"][1][0] - sx1
    d.text((sx0, sy0 - 18), f"STARS 5 x {sx1 - sx0}x{sx1 - sx0}, {gap}px gap", font=fs, fill=ZONE)
    d.text((320, 3), f"CARD {W}x{H} (5:7)   |   FRAME {B}px (blue) - comes from frame.png, leave empty", font=fs, fill=FRAME)


def draw_background_lines(d):
    box(d, (0, 0, W, H), EDGE)
    box(d, LAYOUT["background"], FRAME)
    # Faint outlines of what the game draws on top of the background
    for b in (*LAYOUT["stats"].values(), LAYOUT["element"], LAYOUT["namePlate"], LAYOUT["name"], *LAYOUT["stars"]):
        box(d, b, HINT, width=1)
    dashed_box(d, LAYOUT["safeArea"], HINT)


def draw_background_labels(d):
    f, fs = font(18), font(13)
    x0, y0, x1, y1 = LAYOUT["background"]
    d.text((x0 + 300, y0 + 330), f"BACKGROUND  {dims(LAYOUT['background'])}", font=f, fill=FRAME)
    d.text((x0 + 300, y0 + 360), f"Export the full {W}x{H} canvas as bg-blue.png and bg-red.png.", font=fs, fill=FRAME)
    d.text((x0 + 300, y0 + 380), f"The outer {B}px is covered by the frame.", font=fs, fill=FRAME)
    d.text((x0 + 300, y0 + 400), "Grey outlines = card art, stats, element, name and stars drawn on top.", font=fs, fill=HINT)
    d.text((320, 3), f"CARD {W}x{H} (5:7)   |   FRAME {B}px", font=fs, fill=FRAME)


def draw_frame_lines(d):
    box(d, (0, 0, W, H), EDGE)
    box(d, LAYOUT["background"], FRAME)
    for b in (*LAYOUT["stats"].values(), LAYOUT["element"], LAYOUT["name"], *LAYOUT["stars"]):
        box(d, b, HINT, width=1)


def draw_frame_labels(d):
    f, fs = font(18), font(13)
    x0, y0, _, _ = LAYOUT["background"]
    d.text((x0 + 300, y0 + 330), f"FRAME BAND {B}px  (between black and blue lines)", font=f, fill=FRAME)
    d.text((x0 + 300, y0 + 360), f"Export the full {W}x{H} canvas as frame.png.", font=fs, fill=FRAME)
    d.text((x0 + 300, y0 + 380), "Keep the inside transparent so background and art show through.", font=fs, fill=FRAME)
    d.text((x0 + 300, y0 + 400), "Decorations may reach inward; avoid the grey boxes (drawn on top of the frame).", font=fs, fill=HINT)
    d.text((320, 3), f"CARD {W}x{H} (5:7)   |   FRAME {B}px", font=fs, fill=FRAME)


def draw_card_back_lines(d):
    box(d, (0, 0, W, H), EDGE)
    cx, cy = W // 2, H // 2
    d.line((cx - 24, cy, cx + 24, cy), fill=FRAME, width=LINE)
    d.line((cx, cy - 24, cx, cy + 24), fill=FRAME, width=LINE)


def draw_card_back_labels(d):
    f, fs = font(18), font(13)
    d.text((300, 600), f"CARD BACK  {W}x{H}", font=f, fill=FRAME)
    d.text((300, 630), f"Export the full {W}x{H} canvas as card-back.png.", font=fs, fill=FRAME)
    d.text((300, 650), "Nothing is drawn on top: no frame, numbers or name. The whole image shows.", font=fs, fill=FRAME)
    d.text((300, 670), "Used for face-down cards, such as your opponent's hand.", font=fs, fill=HINT)
    d.text((320, 3), f"CARD {W}x{H} (5:7)", font=fs, fill=FRAME)


def make_sheet(name, spec):
    cw, ch = spec["cell"]
    order = spec["order"]
    img = Image.new("RGBA", (cw * len(order), ch), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    fs = font(max(10, ch // 8))
    for i, key in enumerate(order):
        x0 = i * cw
        box(d, (x0, 0, x0 + cw, ch), ZONE)
        d.text((x0 + 4, 3), f"{i}: {key}", font=fs, fill=HINT)
    img.save(OUT / f"sheet-{name}.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    lines = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_card_lines(ImageDraw.Draw(lines))
    lines.save(OUT / "card-template-lines.png")

    labeled = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    d = ImageDraw.Draw(labeled)
    draw_card_lines(d)
    draw_card_labels(d)
    labeled.save(OUT / "card-template-labeled.png")

    fr_lines = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_frame_lines(ImageDraw.Draw(fr_lines))
    fr_lines.save(OUT / "frame-template-lines.png")

    fr_labeled = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    d = ImageDraw.Draw(fr_labeled)
    draw_frame_lines(d)
    draw_frame_labels(d)
    fr_labeled.save(OUT / "frame-template-labeled.png")

    bg_lines = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_background_lines(ImageDraw.Draw(bg_lines))
    bg_lines.save(OUT / "background-template-lines.png")

    bg_labeled = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    d = ImageDraw.Draw(bg_labeled)
    draw_background_lines(d)
    draw_background_labels(d)
    bg_labeled.save(OUT / "background-template-labeled.png")

    back_lines = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_card_back_lines(ImageDraw.Draw(back_lines))
    back_lines.save(OUT / "card-back-template-lines.png")

    back_labeled = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    d = ImageDraw.Draw(back_labeled)
    draw_card_back_lines(d)
    draw_card_back_labels(d)
    back_labeled.save(OUT / "card-back-template-labeled.png")

    for name, spec in LAYOUT["sheets"].items():
        make_sheet(name, spec)
    print(f"Wrote templates to {OUT}")


if __name__ == "__main__":
    main()
