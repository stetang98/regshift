#!/usr/bin/env bash
# Copy pipeline run artifacts into the web app's static data dir.
# Usage: scripts/sync-artifacts.sh [run-id]   (default: demo)
set -euo pipefail
RUN_ID="${1:-demo}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/pipeline/runs/$RUN_ID"
DST="$ROOT/web/public/runs/demo"

for f in run obligations codemap findings proposals; do
  test -f "$SRC/$f.json" || { echo "missing $SRC/$f.json" >&2; exit 1; }
done

mkdir -p "$DST"
cp "$SRC"/{run,obligations,codemap,findings,proposals}.json "$DST/"
echo "synced run '$RUN_ID' -> $DST"
