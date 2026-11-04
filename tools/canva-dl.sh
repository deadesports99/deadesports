#!/usr/bin/env bash
# Download a Canva export (signed URL) immediately, because the link expires.
# Usage: ./tools/canva-dl.sh "<export-url>" "<output-file>"
set -euo pipefail

url="${1:-}"
out="${2:-}"

if [ -z "$url" ] || [ -z "$out" ]; then
  echo "usage: $0 \"<export-url>\" \"<output-file>\"" >&2
  exit 2
fi

mkdir -p "$(dirname "$out")"
curl -fsSL "$url" -o "$out"
printf 'saved: %s (%s bytes)\n' "$out" "$(wc -c < "$out" | tr -d ' ')"