# Dependency references

Vendored dependency trees are read-only references, not application imports.
Import installed packages through their public exports.

`vendor.json` records revisions. Run `bun run vendor:check` from the root before
relying on a checkout; `bun run vendor:sync` aligns it with installed versions.
Search only the dependency and API relevant to the task.

Effect lives in `effect/packages/`; Noble packages have their own directories.
Check each package's export map rather than inferring import paths from source
filenames (Noble imports commonly require `.js`). Upstream agent instructions
describe upstream development, not Theoria policy.
