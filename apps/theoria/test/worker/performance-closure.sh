#!/usr/bin/env bash
set -euo pipefail

# Run under an orb supervised service, from the current repository root.
# Both roots must already contain build:web and deploy:dry-run output.
historical="$(realpath "${1:?historical repository root}")"
output="$(realpath "${2:?existing evidence directory}")"
current="$(pwd)"
runner="$current/apps/theoria/test/worker/performance-closure.ts"
export THEORIA_WORKER_PORT=8787
export WRANGLER_SEND_METRICS=false

# A supervisor restart must never silently collect another batch or overwrite
# a failed sample. Repetition requires a new evidence directory.
if ! mkdir "$output/run-once"; then
  echo "This batch has already started; refusing an automatic rerun."
  exit 0
fi

git rev-parse HEAD > "$output/current-source.txt"
git -C "$historical" rev-parse HEAD > "$output/historical-source.txt"
bun --version > "$output/bun-version.txt"
sha256sum "$runner" > "$output/runner-sha256.txt"

run_sample() {
  local source="$1" mode="$2" width="$3" ordinal="$4" root
  root="$current"
  if [[ "$source" == H ]]; then root="$historical"; fi
  local label="$source-$mode-$width-$ordinal"
  printf '%s %s\n' "$(date -u +%FT%TZ)" "$label"
  THEORIA_WORKER_ROOT="$root/apps/theoria" CLOSURE_MODE="$mode" \
    CLOSURE_LABEL="$label" CLOSURE_WIDTH="$width" \
    bun "$runner" > "$output/$label.log" 2>&1
  grep '"kind":"completion"' "$output/$label.log"
}

# Each invocation owns a new browser and workerd and closes both before the
# next. H-C-C-H gives cross-source pairs and adjacent same-source controls.
for width in 1440 390; do
  for block in 1 2; do
    ordinal=0
    for source in H C C H; do
      ordinal=$((ordinal + 1))
      run_sample "$source" latency "$width" "$block-$ordinal"
    done
  done
done
for width in 1440 390; do
  for source in H C; do run_sample "$source" vitals "$width" 1; done
done
for width in 1440 390; do
  ordinal=0
  for source in H C C H; do
    ordinal=$((ordinal + 1))
    run_sample "$source" heap "$width" "$ordinal"
  done
done
