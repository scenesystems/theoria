#!/usr/bin/env bash
# scripts/vendor-sync.sh
#
# Syncs vendored source repos to match installed npm package versions.
# Uses `git clone --depth 1 --branch <tag>` (Effect-TS pattern).
# Reads configuration from .vendor/vendor.json.
#
# Usage:
#   bun run vendor:sync          # sync all vendors
#   bun run vendor:sync effect   # sync only the effect vendor
#   bun run vendor:check         # dry-run: report version drift without syncing

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
CONFIG="$REPO_ROOT/.vendor/vendor.json"
DRY_RUN=false
TARGET="${1:-}"

if [[ "$TARGET" == "--check" ]]; then
  DRY_RUN=true
  TARGET=""
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: $CONFIG not found"
  exit 1
fi

parse_json() {
  python3 -c "
import json
with open('$CONFIG') as f:
    cfg = json.load(f)
target = '$TARGET'
for name, st in cfg.get('subtrees', {}).items():
    if target and name != target:
        continue
    ver_src = '$REPO_ROOT/' + st['versionSource']
    try:
        with open(ver_src) as vf:
            installed = json.load(vf)['version']
    except FileNotFoundError:
        installed = 'NOT_INSTALLED'
    pinned = st.get('currentVersion', '')
    tag = st.get('tagTemplate', '').replace('\${version}', installed)
    print(f\"{name}|{st['remote']}|{st['prefix']}|{pinned}|{installed}|{tag}\")
"
}

sync_vendor() {
  local name="$1" remote="$2" prefix="$3" pinned="$4" installed="$5" tag="$6"

  if [[ "$installed" == "NOT_INSTALLED" ]]; then
    echo "⚠️  $name: package not installed"
    return 1
  fi

  if [[ "$pinned" == "$installed" && -d "$REPO_ROOT/$prefix" ]]; then
    echo "✅ $name: up to date at $installed"
    return 0
  fi

  echo ""
  echo "🔄 $name: ${pinned:-<none>} → $installed (tag: $tag)"

  if $DRY_RUN; then
    echo "   [dry-run] would clone $remote at $tag into $prefix"
    return 0
  fi

  local target_dir="$REPO_ROOT/$prefix"

  if [[ -d "$target_dir" ]]; then
    echo "   Removing old version..."
    rm -rf "$target_dir"
  fi

  echo "   Cloning $tag (shallow)..."
  git clone --depth 1 --branch "$tag" "$remote" "$target_dir" 2>&1 | sed 's/^/   /'

  # Update vendor.json
  python3 -c "
import json
with open('$CONFIG', 'r') as f:
    cfg = json.load(f)
cfg['subtrees']['$name']['currentVersion'] = '$installed'
cfg['subtrees']['$name']['currentTag'] = '$tag'
with open('$CONFIG', 'w') as f:
    json.dump(cfg, f, indent=2)
    f.write('\n')
"

  echo "   ✅ $name synced to $installed"
}

echo "═══════════════════════════════════════════"
echo "  Vendor Source Sync"
echo "═══════════════════════════════════════════"
if $DRY_RUN; then
  echo "  Mode: CHECK (dry-run)"
fi
echo ""

parse_json | while IFS='|' read -r name remote prefix pinned installed tag; do
  sync_vendor "$name" "$remote" "$prefix" "$pinned" "$installed" "$tag"
done

echo ""
echo "Done."
