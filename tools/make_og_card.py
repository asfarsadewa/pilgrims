"""
Compose the social share card (Open Graph / Twitter) from the generated
backdrop plus deterministic typography.

    python tools/make_og_card.py

Input:  output/imagegen/og-backdrop.png
Output: public/og-card.png  (1200x630)
        public/og-card-square.png (1080x1080, for square previews)
"""

from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKDROP = os.path.join(ROOT, "output", "imagegen", "og-backdrop.png")
OUT = os.path.join(ROOT, "public", "og-card.png")
OUT_SQUARE = os.path.join(ROOT, "public", "og-card-square.png")
ICON_DIR = os.path.join(ROOT, "public", "icons")

GEORGIA = "C:/Windows/Fonts/georgia.ttf"
GEORGIA_BOLD = "C:/Windows/Fonts/georgiab.ttf"
GEORGIA_ITALIC = "C:/Windows/Fonts/georgiai.ttf"
GEORGIA_Z = "C:/Windows/Fonts/georgiaz.ttf"

INK = (240, 232, 216, 255)
DIM = (185, 182, 171, 255)
FAINT = (143, 140, 130, 255)
GOLD = (255, 210, 122, 255)

W, H = 1200, 630


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def tracked(draw, xy, text, fnt, tracking, fill, shadow=None):
    x, y = xy
    if shadow:
        sx, sy, color = shadow
        cursor = x
        for ch in text:
            draw.text((cursor + sx, y + sy), ch, font=fnt, fill=color, anchor="ls")
            cursor += draw.textlength(ch, font=fnt) + tracking
    cursor = x
    for ch in text:
        draw.text((cursor, y), ch, font=fnt, fill=fill, anchor="ls")
        cursor += draw.textlength(ch, font=fnt) + tracking
    return cursor - tracking


def block_glyph(draw, cx, cy, scale):
    """Small isometric plus-of-cubes mark, matching the title screen."""
    def cube(x, y, size, top, left, right):
        t = size
        draw.polygon(
            [(x, y - t), (x + t, y - t * 0.5), (x, y), (x - t, y - t * 0.5)],
            fill=top,
        )
        draw.polygon(
            [(x - t, y - t * 0.5), (x, y), (x, y + t), (x - t, y + t * 0.5)],
            fill=left,
        )
        draw.polygon(
            [(x + t, y - t * 0.5), (x, y), (x, y + t), (x + t, y + t * 0.5)],
            fill=right,
        )

    s = scale
    stone_top, stone_left, stone_right = (78, 84, 100, 255), (40, 44, 54, 255), (30, 33, 42, 255)
    for dx, dy in ((0, -1.0), (-1.0, 0), (1.0, 0), (0, 1.0)):
        cube(cx + dx * s * 1.18, cy + dy * s * 1.18, s, stone_top, stone_left, stone_right)
    cube(cx, cy, s, (255, 236, 178, 255), (226, 168, 74, 255), (198, 140, 54, 255))


def vignette(image: Image.Image, strength: float = 0.5) -> Image.Image:
    width, height = image.size
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse(
        [-width * 0.2, -height * 0.5, width * 1.2, height * 1.5],
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(140))
    dark = Image.new("RGBA", image.size, (3, 5, 9, 0))
    dark.putalpha(mask.point(lambda v: int((255 - v) * strength)))
    return Image.alpha_composite(image, dark)


def render(size) -> Image.Image:
    width, height = size
    backdrop = Image.open(BACKDROP).convert("RGBA")
    # cover-fit
    scale = max(width / backdrop.width, height / backdrop.height)
    resized = backdrop.resize(
        (int(backdrop.width * scale) + 1, int(backdrop.height * scale) + 1),
        Image.LANCZOS,
    )
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    canvas = resized.crop((left, top, left + width, top + height))

    # Left-to-right darkening so the type always reads.
    gradient = Image.new("RGBA", (width, 1), (0, 0, 0, 0))
    for x in range(width):
        t = max(0.0, 1.0 - x / (width * 0.72))
        gradient.putpixel((x, 0), (6, 8, 13, int(232 * (t ** 1.25))))
    shade = gradient.resize((width, height))
    canvas = Image.alpha_composite(canvas, shade)
    canvas = vignette(canvas)

    draw = ImageDraw.Draw(canvas)
    u = height / 630.0  # scale factor relative to the 1200x630 master

    pad = int(width * 0.062)
    glyph_scale = int(15 * u)
    block_glyph(draw, pad + glyph_scale + 4, int(height * 0.20), glyph_scale)

    tracked(
        draw,
        (pad, int(height * 0.255)),
        "A MEDITATION ON FOLLOWING",
        font(GEORGIA, int(17 * u)),
        5.5 * u,
        GOLD,
    )

    tracked(
        draw,
        (pad, int(height * 0.455)),
        "PILGRIMS",
        font(GEORGIA_BOLD, int(88 * u)),
        20 * u,
        INK,
        shadow=(3, 4, (0, 0, 0, 150)),
    )

    rule_y = int(height * 0.505)
    draw.line([(pad, rule_y), (pad + int(150 * u), rule_y)], fill=(255, 210, 122, 120), width=max(1, int(1.4 * u)))

    tracked(
        draw,
        (pad, int(height * 0.60)),
        "You don't control the pilgrims.",
        font(GEORGIA_ITALIC, int(29 * u)),
        0.4 * u,
        DIM,
    )
    tracked(
        draw,
        (pad, int(height * 0.66)),
        "You control what they follow.",
        font(GEORGIA_ITALIC, int(29 * u)),
        0.4 * u,
        DIM,
    )

    tracked(
        draw,
        (pad, int(height * 0.91)),
        "PILGRIMS.ASFARLAB.FUN",
        font(GEORGIA, int(14 * u)),
        3.4 * u,
        FAINT,
    )

    # Author handle, bottom-right.
    handle = "@ashthepeasant"
    handle_font = font(GEORGIA_ITALIC, int(15 * u))
    handle_tracking = 1.6 * u
    handle_width = sum(
        draw.textlength(ch, font=handle_font) for ch in handle
    ) + handle_tracking * (len(handle) - 1)
    cursor = width - pad - handle_width
    handle_y = int(height * 0.91)
    for ch in handle:
        draw.text((cursor, handle_y), ch, font=handle_font, fill=GOLD, anchor="ls")
        cursor += draw.textlength(ch, font=handle_font) + handle_tracking

    return canvas.convert("RGB")


def make_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (13, 16, 20, 255))
    glow = Image.new("L", (size, size), 0)
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse(
        [size * 0.16, size * 0.16, size * 0.84, size * 0.84],
        fill=95,
    )
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
    amber = Image.new("RGBA", (size, size), (255, 200, 110, 0))
    amber.putalpha(glow)
    image = Image.alpha_composite(image, amber)
    draw = ImageDraw.Draw(image)
    block_glyph(draw, size // 2, int(size * 0.52), int(size * 0.115))
    return image.convert("RGB")


def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    os.makedirs(ICON_DIR, exist_ok=True)
    render((W, H)).save(OUT, "PNG", optimize=True)
    render((1080, 1080)).save(OUT_SQUARE, "PNG", optimize=True)
    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png"), (32, "favicon-32.png")):
        make_icon(size).save(os.path.join(ICON_DIR, name), "PNG", optimize=True)
    print("wrote", OUT)
    print("wrote", OUT_SQUARE)
    print("wrote", ICON_DIR)


if __name__ == "__main__":
    main()
