---
"effect-search": patch
"effect-dsp": patch
---

fix: resolve workspace: protocol deps to real semver in dist/package.json at build time

`build-utils pack-v3` copies `workspace:^` dependencies verbatim into `dist/package.json`,
and `changeset publish` (which calls `npm publish` internally) does not rewrite them. This
made published packages uninstallable outside the monorepo.

Adds `scripts/resolve-workspace-deps.ts` which runs after all per-package builds, reads each
workspace package's actual version, and rewrites `workspace:^` → `^{version}` (and `~`, `*`
variants) in every `dist/package.json`. Also supports `--check` mode for CI verification.
