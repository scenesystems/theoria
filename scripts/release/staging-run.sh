#!/usr/bin/env bash
# Resolve only a verified main staging run. With a destination, also download
# and validate its candidate record and immutable website artifact identity.
set -euo pipefail
shopt -s inherit_errexit
run_id="$1"
[[ "$run_id" =~ ^[1-9][0-9]*$ ]] || {
  echo '::error::Use the numeric staging run ID from its URL.' >&2
  exit 1
}
run=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$run_id")
jq -e --arg repo "$GITHUB_REPOSITORY" '
  .path == ".github/workflows/theoria.yml" and .head_repository.full_name == $repo and
  .head_branch == "main" and (.event == "push" or .event == "workflow_dispatch") and
  .status == "completed" and .conclusion == "success" and (.head_sha | test("^[0-9a-f]{40}$"))
' <<<"$run" >/dev/null || {
  echo '::error::Select a successful Theoria main staging run.' >&2
  exit 1
}
jobs=$(gh api --paginate --slurp "repos/$GITHUB_REPOSITORY/actions/runs/$run_id/jobs?filter=latest&per_page=100")
jq -e 'any(.[].jobs[]; .name == "Staging" and .conclusion == "success")' <<<"$jobs" >/dev/null ||
  {
    echo '::error::The selected run has no successful Staging job.' >&2
    exit 1
  }
sha=$(jq -r .head_sha <<<"$run")
if [[ $# == 1 ]]; then
  printf '%s\n' "$sha"
  exit 0
fi

destination="$2"
mkdir -p "$destination"
gh run download "$run_id" --repo "$GITHUB_REPOSITORY" --name theoria-candidate --dir "$destination"
candidate="$destination/release-candidate.json"
jq -e --arg sha "$sha" --arg run_id "$run_id" '
  .schema == 1 and .sha == $sha and .run_id == $run_id and
  (.artifact_id | test("^[1-9][0-9]*$")) and (.packages | length > 0)
' "$candidate" >/dev/null || {
  echo '::error::Candidate record does not match the staging run.' >&2
  exit 1
}
artifact_id=$(jq -r .artifact_id "$candidate")
artifacts=$(gh api --paginate --slurp "repos/$GITHUB_REPOSITORY/actions/runs/$run_id/artifacts?per_page=100")
jq -e --arg sha "$sha" --arg id "$artifact_id" '
  any(.[].artifacts[]; (.id | tostring) == $id and .name == ("theoria-" + $sha) and .expired == false)
' <<<"$artifacts" >/dev/null || {
  echo '::error::The staged website artifact is missing or expired. Stage a new candidate.' >&2
  exit 1
}
cat "$candidate"
