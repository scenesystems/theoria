#!/usr/bin/env bash
# Run from the repository root. Optional arguments are runtime executable paths.
set -euo pipefail
output=${OUTPUT:-.tmp/digest-throughput.jsonl}
mkdir -p "$(dirname "$output")"
bundle=$(mktemp --suffix=.mjs)
trap 'rm -f "$bundle"' EXIT
bun build packages/digest/benchmark/canonicalJsonThroughput.ts --target=node --outfile="$bundle" >&2
sha256sum "$bundle" >&2
runtimes=("$@")
if [ ${#runtimes[@]} -eq 0 ]; then runtimes=(node bun); fi
for runtime in "${runtimes[@]}"; do
  for shape in numbers scalars records escaped ascii bmp astral escaped-long; do
    for round in 1 2 3; do
      engines=(baseline candidate)
      if [ "$round" -eq 2 ]; then engines=(candidate baseline); fi
      for engine in "${engines[@]}"; do
        CASE="$shape" ENGINE="$engine" "$runtime" "$bundle" |
          jq -c --arg runtime "$runtime" --argjson round "$round" '. + {runtime:$runtime,round:$round}'
      done
    done
  done
done > "$output"
jq -s '
  def median: sort | .[length / 2 | floor];
  [ .[] | . as $run | .samples[] |
    {runtime:$run.runtime,case:$run.case,engine:$run.engine,phase,ms} ] |
  group_by([.runtime,.case,.phase]) | map(
    . as $group |
    (map(select(.engine=="baseline")|.ms)|median) as $baseline |
    (map(select(.engine=="candidate")|.ms)|median) as $candidate |
    {runtime:.[0].runtime,case:.[0].case,phase:.[0].phase,
     baselineMs:$baseline,candidateMs:$candidate,ratio:($candidate/$baseline),
     targetRatio:1,pass:($candidate<=$baseline)}
  )' "$output" > "$output.ratios.json"
cat "$output.ratios.json"
# Performance failures stay visible; this command is deliberately separate from
# correctness CI, which cannot promise an uncontended benchmark host.
jq -e 'all(.[]; .pass)' "$output.ratios.json" > /dev/null
