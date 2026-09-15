# Shared semantic rules for release-input identity and version-only successors.
def dependency_fields: ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
def dependencies: [dependency_fields[] as $field | .[$field] // {}] | add;

# Include every locked instance of a dependency, including nested resolutions,
# then its transitive dependencies/peers. This is deliberately conservative
# when several contexts resolve the same dependency differently.
def locked_entries($lock; $names):
  $lock.packages | with_entries(
    . as $entry | select(any($names[]; . as $name |
      $entry.key == $name or ($entry.key | endswith("/" + $name)) or
      ($entry.value[0] | startswith($name + "@"))
    ))
  );
def locked_closure($lock; $names):
  locked_entries($lock; $names) as $entries |
  ($names + [$entries[] | .[]? | objects | dependencies | keys[]] | unique) as $expanded |
  if $expanded == $names then $entries else locked_closure($lock; $expanded) end;

def resolve_workspace($versions):
  reduce dependency_fields[] as $field (.;
    if has($field) then .[$field] |= with_entries(
      if .value | startswith("workspace:") then
        .key as $name | .value[10:] as $range |
        if $versions[$name] == null then error("Unknown workspace dependency: " + $name)
        elif $range == "^" or $range == "*" then .value = "^" + $versions[$name]
        elif $range == "~" then .value = "~" + $versions[$name]
        else error("Unsupported workspace dependency range: " + .value) end
      else . end
    ) else . end
  );

def stable_version: type == "string" and test("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$");
def version_advance($old; $new):
  $old == $new or (($old | stable_version) and ($new | stable_version) and
    (($old | split(".") | map(tonumber)) < ($new | split(".") | map(tonumber))));

# Predict Changesets edits instead of ignoring entire JSON fields. Added
# dependencies, external upgrades, range-operator changes and exports/scripts
# changes are not version finalization.
def finalized_manifest($before; $versions_before; $versions_after):
  $before |
  if .name as $name | $versions_before[$name] != null then
    .version = $versions_after[.name]
  else . end |
  reduce dependency_fields[] as $field (.;
    if has($field) then .[$field] |= with_entries(
      .key as $name |
      if $versions_before[$name] != null and $versions_after[$name] != null then
        .value as $range |
        (["", "^", "~", "workspace:", "workspace:^", "workspace:~"] |
          map(select(. + $versions_before[$name] == $range))) as $prefix |
        if $prefix | length == 1 then .value = $prefix[0] + $versions_after[$name] else . end
      else . end
    ) else . end
  );

($ARGS.named.root // {}) as $root |
($ARGS.named.manifest // {}) as $manifest |
($ARGS.named.versions // {}) as $versions |
($ARGS.named.before // {}) as $before |
($ARGS.named.versions_before // {}) as $versions_before |
($ARGS.named.versions_after // {}) as $versions_after |
if $mode == "fingerprint" then
  ($root | dependencies | with_entries(select(.value | startswith("workspace:") | not))) as $tools |
  ($manifest | dependencies | with_entries(select(.value | startswith("workspace:") | not))) as $runtime |
  {
    manifest: ($manifest | del(.description, .homepage, .repository, .bugs, .keywords) | resolve_workspace($versions)),
    tools: $tools,
    build: $root.scripts.build,
    prepare: $root.scripts.prepare,
    locked: locked_closure(.; (($tools + $runtime) | keys | unique))
  }
elif $mode == "review-manifest" then
  finalized_manifest($before; $versions_before; $versions_after) == .
elif $mode == "review-lock" then
  ($before | .workspaces |= with_entries(.value = finalized_manifest(.value; $versions_before; $versions_after))) == .
elif $mode == "versions" then
  all($versions_before | keys[]; . as $name |
    version_advance($versions_before[$name]; $versions_after[$name])) and
  (($versions_before | keys) == ($versions_after | keys))
else error("Unknown release policy mode") end
