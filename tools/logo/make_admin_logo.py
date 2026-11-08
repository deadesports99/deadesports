"""Admin app logo = the Spartan lion crest + an "admin" badge at its bottom-right.

The badge is a small navy disc with a gold ring and a gold gear glyph, so the
admin APK is instantly recognisable next to the player app on a launcher and in
the app bar.
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

LOGOS = Path("player-web/public/assets/logos")
MARK = Image.open(LOGOS / "spartan_logo_mark.png").convert("RGBA")

NAVY = (11, 21, 38, 255)
NAVY_DEEP = (6, 11, 20, 255)
GOLD = (255, 208, 0, 255)
GOLD_SOFT = (255, 176, 32, 255)


def square(img: Image.Image, size: int, pad: float = 0.045) -> Image.Image:
    w, h = img.size
    side = int(max(w, h) * (1 + pad * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas.resize((size, size), Image.LANCZOS)


def gear(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, color) -> None:
    """Simple 8-tooth gear: body disc + teeth + hollow centre."""
    tooth_w = r * 0.34
    tooth_h = r * 0.42
    for i in range(8):
        ang = math.radians(i * 45)
        tx, ty = cx + math.cos(ang) * r * 0.92, cy + math.sin(ang) * r * 0.92
        box = (tx - tooth_w, ty - tooth_w, tx + tooth_w, ty + tooth_w)
        draw.rectangle(box, fill=color)
    draw.ellipse((cx - r * 0.74, cy - r * 0.74, cx + r * 0.74, cy + r * 0.74), fill=color)
    draw.ellipse(
        (cx - r * 0.30, cy - r * 0.30, cx + r * 0.30, cy + r * 0.30),
        fill=NAVY,
    )


def admin_mark(size: int, crest_ratio: float = 1.0) -> Image.Image:
    """Crest with the badge anchored at its bottom-right corner."""
    base = square(MARK, size)
    if crest_ratio != 1.0:
        inner = int(size * crest_ratio)
        small = square(MARK, inner)
        base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        base.alpha_composite(small, ((size - inner) // 2, (size - inner) // 2))

    d = int(size * 0.34)                     # badge diameter
    marg = int(size * 0.015)
    x0 = size - d - marg
    y0 = size - d - marg

    badge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)

    ring = max(2, int(d * 0.10))
    # soft outer glow so the badge separates from the artwork
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((x0 - 2, y0 - 2, x0 + d + 2, y0 + d + 2), fill=(255, 176, 32, 140))
    glow = glow.filter(ImageFilter.GaussianBlur(max(1.5, d * 0.10)))
    base.alpha_composite(glow)

    bd.ellipse((x0, y0, x0 + d, y0 + d), fill=NAVY_DEEP, outline=GOLD, width=ring)
    gear(
        bd,
        x0 + d / 2,
        y0 + d / 2,
        r=d * 0.26,
        color=GOLD,
    )
    base.alpha_composite(badge)
    return base


def branded(size: int, rounded: bool, body: Image.Image) -> Image.Image:
    """App-icon tile: navy radial background + glow + the mark."""
    bg = Image.new("RGB", (size, size), (6, 11, 20))
    px = bg.load()
    c = size / 2
    for y in range(size):
        for x in range(size):
            t = min(1.0, math.hypot(x - c, y - c) / (size * 0.72))
            px[x, y] = (
                int(22 * (1 - t) + 6 * t),
                int(38 * (1 - t) + 11 * t),
                int(63 * (1 - t) + 20 * t),
            )
    tile = bg.convert("RGBA")

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        (size * 0.16, size * 0.20, size * 0.84, size * 0.88), fill=(255, 150, 40, 90)
    )
    tile.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size * 0.11)))

    w = int(size * 0.86)
    body = body.resize((w, w), Image.LANCZOS)
    tile.alpha_composite(body, ((size - w) // 2, (size - w) // 2))

    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.22), fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(tile, (0, 0), mask)
        return out
    return tile


def main() -> None:
    res = Path("android/app-admin/src/main/res")

    # 1. Adaptive launcher foreground (108dp canvas, art inside the safe zone).
    fg_canvas = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
    fg = admin_mark(300)
    fg_canvas.alpha_composite(fg, ((432 - 300) // 2, (432 - 300) // 2))
    fg_canvas.save(res / "drawable-nodpi/ic_launcher_logo.png")
    fg_canvas.save(res / "drawable-nodpi/ic_launcher_logo_round.png")

    # 2. Legacy raster mipmaps.
    for dens, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
        body = admin_mark(size)
        branded(size, True, body).save(res / f"mipmap-{dens}/ic_launcher.png")
        round_body = admin_mark(int(size * 0.94))
        tile = branded(size, False, round_body)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(tile, (0, 0), mask)
        out.save(res / f"mipmap-{dens}/ic_launcher_round.png")

    # 3. In-app app-bar mark (shared `core` module, admin-only usage).
    core = Path("android/core/src/main/res")
    for dens, size in {"mdpi": 44, "hdpi": 66, "xhdpi": 88, "xxhdpi": 132, "xxxhdpi": 176}.items():
        d = core / f"drawable-{dens}"
        d.mkdir(parents=True, exist_ok=True)
        admin_mark(size).save(d / "brand_logo_admin.png")

    # 4. Play-store / docs preview.
    preview = Image.new("RGBA", (900, 300), (240, 240, 242, 255))
    for i, s in enumerate((240, 120, 48)):
        tile = branded(s, True, admin_mark(s))
        preview.paste(tile, (20 + i * 270, 30), tile)
    preview.save(Path("tmp_screens/admin_logo_preview.png"))
    print("admin logo assets written")


if __name__ == "__main__":
    main()
