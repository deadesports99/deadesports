"""Turn the raw upscaled logo screenshot into clean transparent app-icon assets.

Background of the source is a flat dark brown (~#170d08), so we remove it with a
border-connected flood fill plus an anti-aliased edge ramp, then trim + pad to a
square and emit the sizes used by the web app and the Android apps.
"""
from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SRC = Path("ui-ux demo/new logo/Screenshot 2026-11-07 123217_upscayl_5x_digital-art-4x.png")
OUT = Path("player-web/public/assets/logos")

BG_TOL_HARD = 16.0   # definitely background
BG_TOL_SOFT = 52.0   # edge / semi background
FEATHER = 0.9


def border_bg(img: np.ndarray) -> np.ndarray:
    h, w, _ = img.shape
    strips = np.concatenate([
        img[0:3, :, :].reshape(-1, 3),
        img[h - 3:, :, :].reshape(-1, 3),
        img[:, 0:3, :].reshape(-1, 3),
        img[:, w - 3:, :].reshape(-1, 3),
    ])
    return np.median(strips, axis=0)


def cutout(img: np.ndarray) -> np.ndarray:
    bg = border_bg(img)
    dist = np.sqrt(((img.astype(np.float32) - bg) ** 2).sum(axis=2))

    candidate = dist < BG_TOL_SOFT
    h, w = candidate.shape

    # Flood fill the background starting from every border pixel.
    seen = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and candidate[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))

    alpha = np.where(seen, 0.0, 1.0).astype(np.float32)
    # Soft ramp inside the removed area so anti-aliased rims survive.
    ramp = np.clip((dist - BG_TOL_HARD) / (BG_TOL_SOFT - BG_TOL_HARD), 0.0, 1.0)
    alpha = np.where(seen, ramp, 1.0).astype(np.float32)

    a_img = Image.fromarray((alpha * 255).astype(np.uint8), "L").filter(
        ImageFilter.GaussianBlur(FEATHER)
    )
    alpha = np.asarray(a_img).astype(np.float32) / 255.0

    rgb = img.astype(np.float32)
    # Un-spill: pull semi-transparent edge pixels away from the old background.
    a3 = alpha[..., None]
    spill = (1.0 - a3) * bg
    corrected = np.where(a3 > 0.02, (rgb - spill) / np.maximum(a3, 0.02), rgb)
    rgb = np.clip(corrected, 0, 255)

    out = np.dstack([rgb, alpha * 255.0]).astype(np.uint8)
    return out


def square_pad(rgba: Image.Image, size: int, pad_ratio: float = 0.045) -> Image.Image:
    bbox = rgba.split()[-1].point(lambda v: 255 if v > 12 else 0).getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    w, h = rgba.size
    side = int(max(w, h) * (1 + pad_ratio * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(rgba, ((side - w) // 2, (side - h) // 2), rgba)
    return canvas.resize((size, size), Image.LANCZOS)


def main() -> int:
    img = np.array(Image.open(SRC).convert("RGB"))
    cut = cutout(img)
    raw = Image.fromarray(cut, "RGBA")
    OUT.mkdir(parents=True, exist_ok=True)

    # Full transparent mark (trimmed, not square) for headers / hero spots.
    bbox = raw.split()[-1].point(lambda v: 255 if v > 10 else 0).getbbox()
    mark = raw.crop(bbox)
    mark.save(OUT / "spartan_logo_mark.png")
    print("mark", mark.size)

    # Square app icon at the sizes the app + PWA need.
    for s in (1024, 512, 192, 180, 64, 32):
        icon = square_pad(raw.copy(), s)
        name = "spartan_app_icon.png" if s == 1024 else f"spartan_app_icon_{s}.png"
        icon.save(OUT / name)
        print("icon", name, icon.size)

    # Round badge variant.
    round_src = square_pad(raw.copy(), 512, pad_ratio=0.03)
    mask = Image.new("L", (512, 512), 0)
    from PIL import ImageDraw

    ImageDraw.Draw(mask).ellipse((0, 0, 511, 511), fill=255)
    round_img = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    round_img.paste(round_src, (0, 0), mask)
    round_img.save(OUT / "spartan_badge_round.png")

    # Preview sheet on a magenta background to spot leaks / holes quickly.
    prev = Image.new("RGBA", (1400, 700), (255, 0, 255, 255))
    for i, s in enumerate((640, 160, 64, 32)):
        im = square_pad(raw.copy(), s)
        prev.paste(im, (20 + i * 340, 30), im)
    mark_s = mark.copy()
    mark_s.thumbnail((1280, 300), Image.LANCZOS)
    prev.paste(mark_s, (20, 400), mark_s)
    prev.save(Path("tmp_screens/logo_preview.png"))
    print("preview -> tmp_screens/logo_preview.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
