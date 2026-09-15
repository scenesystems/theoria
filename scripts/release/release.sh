#!/usr/bin/env bash
# Release policy is kept outside workflow YAML so its Git/registry boundaries
# can be exercised against disposable repositories. Requires bash, bun, git,
# jq, curl, openssl and coreutils (all present on the GitHub Ubuntu runners).
set -euo pipefail
shopt -s inherit_errexit
policy_dir=$(dirname "$(realpath "${BASH_SOURCE[0]}")")
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT

fail() {
  echo "::error::$*" >&2
  exit 1
}
json_at() { git show "$1:$2" | jq -ce .; }
lock_at() {
  git show "$1:bun.lock" |
    bun -e 'process.stdout.write(JSON.stringify(Bun.JSONC.parse(await Bun.stdin.text())))'
}
manifests_at() {
  local revision="$1" entry directory manifest
  while IFS= read -r -d '' entry; do
    [[ "$entry" == '040000 tree '* ]] || continue
    directory=${entry#*$'\t'}
    manifest=$(json_at "$revision" "packages/$directory/package.json")
    jq -c --arg path "packages/$directory" '. + {path:$path}' <<<"$manifest"
  done < <(git ls-tree -z "$revision:packages")
}
versions_at() {
  manifests_at "$1" | jq -sc '[.[] | select(.private != true) | {key:.name,value:.version}] | from_entries'
}

fingerprint() {
  local revision="$1" package="$2" manifest root versions entry path
  manifest=$(json_at "$revision" "$package/package.json")
  root=$(json_at "$revision" package.json)
  versions=$(versions_at "$revision")
  {
    # Keep file modes, names and Git object IDs, not just concatenated contents.
    while IFS= read -r -d '' entry; do
      path=${entry#*$'\t'}
      case "$path" in
        "$package/package.json" | "$package/README.md" | "$package/CHANGELOG.md" | "$package/AGENTS.md" | "$package/test/"* | "$package/examples/"* | "$package/tsconfig.test.json") ;;
        *) printf '%s\0' "$entry" ;;
      esac
    done < <(git ls-tree -rz "$revision" -- "$package")
    while IFS= read -r -d '' entry; do
      path=${entry#*$'\t'}
      case "$path" in
        .bun-version | .node-version | tsconfig*.json | *babel*) printf '%s\0' "$entry" ;;
      esac
    done < <(git ls-tree -z "$revision")
    git ls-tree -rz "$revision" -- scripts/resolve-workspace-deps.ts
    lock_at "$revision" | jq -Sc --arg mode fingerprint --argjson manifest "$manifest" \
      --argjson root "$root" --argjson versions "$versions" -f "$policy_dir/policy.jq"
  } | sha256sum | cut -d' ' -f1
}

review() {
  local before="$1" after="$2" versions_before versions_after path old new status
  git merge-base --is-ancestor "$before" "$after" || fail "Reviewed commit is not an ancestor of the candidate. Review the candidate directly."
  versions_before=$(versions_at "$before")
  versions_after=$(versions_at "$after")
  jq -ne --arg mode versions --argjson versions_before "$versions_before" \
    --argjson versions_after "$versions_after" -f "$policy_dir/policy.jq" >/dev/null ||
    fail "Package additions/removals, prereleases or version downgrades require a new review."
  # Inspect the entire commit interval, including unrelated merges into main.
  while IFS= read -r -d '' status && IFS= read -r -d '' path; do
    case "$path" in
      .changeset/*.md)
        [[ "$status" == D && "$path" != .changeset/README.md ]] || fail "Not a consumed changeset: $path"
        ;;
      packages/*/CHANGELOG.md)
        [[ "$status" == A || "$status" == M ]] || fail "Unexpected changelog removal: $path"
        ;;
      package.json | packages/*/package.json | apps/*/package.json | scripts/package.json)
        [[ "$status" == M ]] || fail "Added/removed manifest requires review: $path"
        old=$(json_at "$before" "$path")
        new=$(json_at "$after" "$path")
        jq -e --arg mode review-manifest --argjson before "$old" \
          --argjson versions_before "$versions_before" --argjson versions_after "$versions_after" \
          -f "$policy_dir/policy.jq" <<<"$new" >/dev/null || fail "Non-version manifest change: $path"
        ;;
      bun.lock)
        old=$(lock_at "$before")
        new=$(lock_at "$after")
        jq -e --arg mode review-lock --argjson before "$old" \
          --argjson versions_before "$versions_before" --argjson versions_after "$versions_after" \
          -f "$policy_dir/policy.jq" <<<"$new" >/dev/null || fail "Dependency resolution changed; review the candidate directly."
        ;;
      *) fail "Changes beyond version finalization: $path. Review this candidate and omit reviewed_run_id." ;;
    esac
  done < <(git diff --no-renames --name-status -z "$before" "$after")
  echo "Version-only successor verified: $before -> $after" >&2
}

published_source() {
  local name="$1" version="$2" encoded status metadata url integrity digest statement sha
  encoded=$(jq -rn --arg name "$name" '$name | @uri')
  status=$(curl --silent --show-error --max-time 60 --retry 3 --output "$scratch/metadata" \
    --write-out '%{http_code}' "https://registry.npmjs.org/$encoded/$version")
  if [[ "$status" == 404 ]]; then
    echo null
    return
  fi
  [[ "$status" == 200 ]] || fail "npm metadata request for $name@$version returned HTTP $status."
  metadata=$(cat "$scratch/metadata")
  url=$(jq -er '.dist.attestations.url' <<<"$metadata")
  [[ "$url" == https://registry.npmjs.org/-/npm/v1/attestations/* ]] || fail "No npm-hosted provenance for $name@$version."
  integrity=$(jq -er '.dist.integrity | select(startswith("sha512-"))' <<<"$metadata")
  digest=$(printf '%s' "${integrity#sha512-}" | base64 -d | od -An -v -tx1 | tr -d ' \n')
  status=$(curl --silent --show-error --max-time 60 --retry 3 --output "$scratch/attestation" --write-out '%{http_code}' "$url")
  [[ "$status" == 200 ]] || fail "npm provenance request for $name@$version returned HTTP $status."
  # npm's registry is the trusted publication record. Check its provenance
  # subject against the registry's tarball integrity, repository and workflow;
  # gitHead alone is absent from some tarball publications and is insufficient.
  statement=$(jq -ce --arg digest "$digest" --arg repo "https://github.com/${GITHUB_REPOSITORY:-scenesystems/theoria}" '
    [.attestations[] | select(.predicateType == "https://slsa.dev/provenance/v1") |
      .bundle.dsseEnvelope.payload | @base64d | fromjson |
      select(any(.subject[]; .digest.sha512 == $digest)) |
      select(.predicate.buildDefinition.externalParameters.workflow.repository == $repo) |
      select(.predicate.buildDefinition.externalParameters.workflow.path == ".github/workflows/publish.yml") |
      .predicate.buildDefinition.resolvedDependencies[] |
      select(.uri | startswith("git+" + $repo + "@")) |
      .digest.gitCommit | select(test("^[0-9a-f]{40}$"))] | unique | select(length == 1) | .[0]
  ' "$scratch/attestation")
  sha=$(jq -r . <<<"$statement")
  jq -nc --arg sha "$sha" --arg integrity "$integrity" '{sha:$sha,integrity:$integrity}'
}

candidate() {
  local revision="$1" run_id="$2" artifact_id="$3" manifest path input
  [[ "$revision" =~ ^[0-9a-f]{40}$ && "$run_id" =~ ^[1-9][0-9]*$ && "$artifact_id" =~ ^[1-9][0-9]*$ ]] || fail "Invalid candidate identity."
  manifests_at "$revision" | jq -c 'select(.private != true)' >"$scratch/manifests"
  : >"$scratch/packages"
  while IFS= read -r manifest; do
    path=$(jq -r .path <<<"$manifest")
    input=$(fingerprint "$revision" "$path")
    jq -c --arg input "$input" '{name,version,path,input:$input}' <<<"$manifest" >>"$scratch/packages"
  done <"$scratch/manifests"
  jq -sc --arg sha "$revision" --arg run_id "$run_id" --arg artifact_id "$artifact_id" \
    '{schema:1,sha:$sha,run_id:$run_id,artifact_id:$artifact_id,packages:.}' "$scratch/packages"
}

check_packages() {
  local file="$1" require_published="$2" package name version path expected source sha actual revision declarations
  jq -e '.schema == 1 and (.sha | test("^[0-9a-f]{40}$")) and (.packages | length > 0)' "$file" >/dev/null
  revision=$(jq -r .sha "$file")
  declarations=$(manifests_at "$revision" | jq -sc '[.[] | select(.private != true) | {name,version,path}] | sort_by(.name)')
  jq -e --argjson declarations "$declarations" '([.packages[] | {name,version,path}] | sort_by(.name)) == $declarations' "$file" >/dev/null ||
    fail "Candidate package list does not match its commit. Stage a new candidate."
  jq -c '.packages[]' "$file" >"$scratch/candidate-packages"
  : >"$scratch/records"
  while IFS= read -r package; do
    name=$(jq -r .name <<<"$package")
    version=$(jq -r .version <<<"$package")
    path=$(jq -r .path <<<"$package")
    expected=$(jq -r .input <<<"$package")
    actual=$(fingerprint "$revision" "$path")
    [[ "$actual" == "$expected" ]] || fail "Candidate input record does not match $name at its commit. Stage a new candidate."
    source=$(published_source "$name" "$version")
    if [[ "$source" == null ]]; then
      [[ "$require_published" == false ]] || fail "$name@$version is not published. Publish this candidate before promoting the website."
      jq -c '. + {state:"unpublished"}' <<<"$package" >>"$scratch/records"
      continue
    fi
    sha=$(jq -r .sha <<<"$source")
    if ! git cat-file -e "$sha^{commit}" 2>/dev/null; then git fetch --quiet --no-tags origin "$sha"; fi
    actual=$(fingerprint "$sha" "$path")
    [[ "$actual" == "$expected" ]] || fail "$name@$version exists on npm but its package/build inputs differ. Add a changeset and stage the versioned candidate; do not publish or promote under this version."
    jq -c --argjson source "$source" '. + {state:"published",publication:$source}' <<<"$package" >>"$scratch/records"
  done <"$scratch/candidate-packages"
  jq -s --slurpfile candidate "$file" '$candidate[0] + {packages: .}' "$scratch/records"
}

case "${1:-}" in
  fingerprint) fingerprint "$2" "$3" ;;
  review) review "$2" "$3" ;;
  published-source) published_source "$2" "$3" ;;
  candidate) candidate "$2" "$3" "$4" ;;
  check) check_packages "$2" false ;;
  published) check_packages "$2" true ;;
  *) fail 'Usage: release.sh fingerprint|review|published-source|candidate|check|published ...' ;;
esac
