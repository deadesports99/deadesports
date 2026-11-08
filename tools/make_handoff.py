#!/usr/bin/env python3
"""
Build a source-only handoff archive for the client / boss.

Excludes dependencies, build output, caches, real credentials and signing keys,
so the archive can be shared without leaking secrets. Run from the repo root:

    python tools/make_handoff.py                # -> deliverables/freefire-*-source-<date>.zip
    python tools/make_handoff.py --out foo.zip  # custom path

Afterwards, scan the archive with:

    python tools/make_handoff.py --audit deliverables/<file>.zip
"""
from __future__ import annotations

import argparse
import fnmatch
import os
import sys
import zipfile
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Whole directory trees to leave out (matched by any path segment).
EXCLUDE_DIRS = {
    "node_modules", ".git", "build", "dist", ".gradle", ".next", "coverage",
    ".scannerwork", ".idea", ".vscode", ".aider.tags.cache.v4", "__pycache__",
    "tmp_screens", "screenshots", "tmp_uitest", "deliverables", ".free-pi",
}

# Top-level folders that are reference material, not this product's source.
EXCLUDE_TOP = {"git demo repo", "ui-ux demo"}

# File patterns that must never leave the machine.
SECRET_PATTERNS = [
    ".env", "*.jks", "*.keystore", "keystore.properties", "google-services.json",
    "*.pem", "*.log", "*.pid", ".DS_Store", "Thumbs.db",
]

# Largest file worth shipping; anything bigger is almost always a binary asset.
MAX_BYTES = 8 * 1024 * 1024


def is_secret(filename: str) -> bool:
    """True when the file is a real credential (but `.env.example` stays)."""
    if filename.endswith((".example", ".sample", ".template")):
        return False
    return any(fnmatch.fnmatch(filename, pat) for pat in SECRET_PATTERNS)


def collect() -> tuple[list[str], list[str]]:
    """Return (included, skipped) relative paths."""
    included: list[str] = []
    skipped: list[str] = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel_dir = os.path.relpath(dirpath, ROOT)
        if rel_dir == ".":
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS and d not in EXCLUDE_TOP]
        else:
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT)
            if name.startswith(".aider"):
                skipped.append(rel)
                continue
            if is_secret(name):
                skipped.append(rel)
                continue
            try:
                if os.path.getsize(full) > MAX_BYTES:
                    skipped.append(rel)
                    continue
            except OSError:
                continue
            included.append(rel)
    return included, skipped


def build(out_path: str) -> None:
    files, skipped = collect()
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    if os.path.exists(out_path):
        os.remove(out_path)

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for rel in files:
            zf.write(os.path.join(ROOT, rel), rel)

    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f"created : {out_path}")
    print(f"size    : {size_mb:.1f} MB")
    print(f"files   : {len(files)}")
    print(f"skipped : {len(skipped)} (secrets, deps, build output, oversized assets)")
    print("\nExcluded secrets / credentials:")
    for rel in skipped:
        if is_secret(os.path.basename(rel)):
            print(f"  - {rel}")


def audit(zip_path: str) -> int:
    """Fail when a credential-shaped file slipped into an archive."""
    bad: list[str] = []
    with zipfile.ZipFile(zip_path) as zf:
        names = zf.namelist()
        for name in names:
            base = os.path.basename(name)
            if is_secret(base) or "/node_modules/" in name.replace("\\", "/") or name.endswith(".env"):
                bad.append(name)
    print(f"scanned {len(names)} entries in {zip_path}")
    if bad:
        print("SECRETS FOUND — do not share this archive:")
        for name in bad:
            print(f"  ! {name}")
        return 1
    print("OK: no .env, keystore, google-services.json or node_modules entries")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", help="output zip path")
    parser.add_argument("--audit", help="scan an existing zip for leaked secrets")
    args = parser.parse_args()

    if args.audit:
        sys.exit(audit(args.audit))

    target = args.out or os.path.join(
        ROOT, "deliverables", f"freefire-tournament-source-{date.today():%Y%m%d}.zip"
    )
    build(os.path.abspath(target))
