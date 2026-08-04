#!/usr/bin/env bash
# scripts/vendor-sync.sh
#
# Syncs vendored source repos to match installed npm package versions.
# Uses a shallow tag clone or an immutable revision when configured.
# Reads configuration from .vendor/vendor.json.
#
# Usage:
#   bun run vendor:sync          # sync all vendors
#   bun run vendor:sync effect   # sync only the effect vendor
#   bun run vendor:check         # dry-run: report version drift without syncing
#   bun run vendor:check effect  # verify only the effect vendor

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
CONFIG="$REPO_ROOT/.vendor/vendor.json"
DRY_RUN=false
TARGET=""

for argument in "$@"; do
  if [[ "$argument" == "--check" ]]; then
    DRY_RUN=true
  else
    TARGET="$argument"
  fi
done

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
    revision = st.get('revision', '')
    print(f\"{name}|{st['remote']}|{st['prefix']}|{pinned}|{installed}|{tag}|{revision}\")
"
}

verify_vendor() {
  local name="$1" prefix="$2" revision="$3"
  local target_dir="$REPO_ROOT/$prefix"

  if [[ ! -d "$target_dir" ]]; then
    echo "❌ $name: vendored source is missing at $prefix"
    return 1
  fi

  if [[ -n "$revision" ]]; then
    local actual_revision
    actual_revision="$(git -C "$target_dir" rev-parse HEAD 2>/dev/null || true)"
    if [[ "$actual_revision" != "$revision" ]]; then
      echo "❌ $name: checkout is ${actual_revision:-<unreadable>}, expected $revision"
      return 1
    fi
  fi

  python3 - "$CONFIG" "$REPO_ROOT" "$name" "$prefix" <<'PY'
import json
import pathlib
import sys

config_path, repository_root, vendor_name, prefix = sys.argv[1:]
with open(config_path) as file:
    subtree = json.load(file)["subtrees"][vendor_name]

failures = []
for package_name, manifests in subtree.get("packageManifests", {}).items():
    installed_path = pathlib.Path(repository_root, manifests["installed"])
    vendored_path = pathlib.Path(repository_root, prefix, manifests["vendored"])

    try:
        with installed_path.open() as file:
            installed = json.load(file)
    except FileNotFoundError:
        failures.append(f"{package_name}: installed manifest missing at {manifests['installed']}")
        continue

    try:
        with vendored_path.open() as file:
            vendored = json.load(file)
    except FileNotFoundError:
        failures.append(f"{package_name}: vendored manifest missing at {manifests['vendored']}")
        continue

    if installed.get("name") != package_name:
        failures.append(
            f"{package_name}: installed manifest declares {installed.get('name', '<missing>')}"
        )
    if vendored.get("name") != package_name:
        failures.append(
            f"{package_name}: vendored manifest declares {vendored.get('name', '<missing>')}"
        )
    if installed.get("version") != vendored.get("version"):
        failures.append(
            f"{package_name}: installed {installed.get('version', '<missing>')}, "
            f"vendored {vendored.get('version', '<missing>')}"
        )

if failures:
    for failure in failures:
        print(f"❌ {vendor_name}: {failure}")
    raise SystemExit(1)

package_count = len(subtree.get("packageManifests", {}))
if package_count > 0:
    print(f"   verified {package_count} installed/vendored package manifests")
PY
}

sync_vendor() {
  local name="$1" remote="$2" prefix="$3" pinned="$4" installed="$5" tag="$6" revision="$7"

  if [[ "$installed" == "NOT_INSTALLED" ]]; then
    echo "⚠️  $name: package not installed"
    return 1
  fi

  if [[ "$pinned" == "$installed" && -d "$REPO_ROOT/$prefix" ]]; then
    if verify_vendor "$name" "$prefix" "$revision"; then
      echo "✅ $name: up to date at $installed"
      return 0
    fi

    if $DRY_RUN; then
      return 1
    fi
  fi

  echo ""
  local ref="${revision:-$tag}"
  echo "🔄 $name: ${pinned:-<none>} → $installed (ref: $ref)"

  if $DRY_RUN; then
    echo "   [dry-run] would clone $remote at $ref into $prefix"
    return 0
  fi

  local target_dir="$REPO_ROOT/$prefix"

  if [[ -d "$target_dir" ]]; then
    echo "   Removing old version..."
    rm -rf "$target_dir"
  fi

  echo "   Cloning $ref (shallow)..."
  if [[ -n "$revision" ]]; then
    git init --quiet "$target_dir"
    git -C "$target_dir" remote add origin "$remote"
    git -C "$target_dir" fetch --depth 1 origin "$revision" 2>&1 | sed 's/^/   /'
    git -C "$target_dir" -c advice.detachedHead=false checkout --detach FETCH_HEAD 2>&1 | sed 's/^/   /'
  else
    git clone --depth 1 --branch "$tag" "$remote" "$target_dir" 2>&1 | sed 's/^/   /'
  fi

  verify_vendor "$name" "$prefix" "$revision"

  # Update vendor.json
  python3 -c "
import json
with open('$CONFIG', 'r') as f:
    cfg = json.load(f)
cfg['subtrees']['$name']['currentVersion'] = '$installed'
if not '$revision':
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

parse_json | while IFS='|' read -r name remote prefix pinned installed tag revision; do
  sync_vendor "$name" "$remote" "$prefix" "$pinned" "$installed" "$tag" "$revision"
done

echo ""
echo "Done."
