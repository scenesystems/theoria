# Contributing

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Please report concerns to [security@scenesystems.io](mailto:security@scenesystems.io).

## Pull Requests

1. Fork the repository and clone it locally.
2. Create a branch: `git checkout -b my-new-feature`
3. Install dependencies: `bun install`
4. Make your changes and add tests if applicable.
5. Run the checks: `bun run check && bun run lint && bun run test`
6. Create a changeset: `bun run changeset`
7. Commit: `git commit -am 'feat(effect-search): add some feature'`
8. Push: `git push origin my-new-feature`
9. Open a pull request against `main`.

## Guidelines

- All code must be idiomatic [Effect](https://effect.website). See [AGENTS.md](./AGENTS.md) for the full banned-constructs table.
- All tests must pass. Add new tests for new behavior.
- Changes must be consistent with the project's existing style and conventions.
- Write clear commit messages and include a summary in the PR description.
- If your change requires documentation, update the relevant docs.

## Development

Requires [bun](https://bun.sh) ≥ 1.3.

```sh
bun install
bun run check       # Type check
bun run lint        # Lint
bun run test        # Test
bun run build       # Build
```

Per-package:

```sh
bun run --filter @scenesystems/effect-search check
bun run --filter @scenesystems/effect-search test
```

## Fixture Generation

Some packages use [uv](https://docs.astral.sh/uv/) to generate golden test fixtures from reference implementations (Optuna, DSPy). Always use `uv run` — never `python3` directly.

## Releases

This project uses [Changesets](https://github.com/changesets/changesets) for versioning. Before committing, create a changeset:

```sh
bun run changeset
```

Maintainers handle version bumps and publishing.

Merge the **Version Packages** PR, then select the successful Theoria staging
candidate with `run_id` in **Publish Packages** on `main`. The dispatcher starts
the actual publication on an immutable `theoria-candidate-<sha>` tag so npm
provenance and GitHub releases identify the selected commit, not a newer `main`.
Wait for that tag run's publication verification to succeed. Publishing does
not deploy the production website; **Theoria Production** separately promotes
the same candidate after checking package compatibility. Website-only releases
can reuse already published packages with matching prepared content. See the
[deployment runbook](apps/theoria/DEPLOYMENT.md#promote-staging-to-production)
for version-only review carry-forward, ordering, and recovery.

### npm Trusted Publishing

Published workspace packages use public npm access and provenance attestations from this public repository. Keep Trusted Publishing configured separately on every npm package with these values:

| Field                | Value          |
| -------------------- | -------------- |
| Provider             | GitHub Actions |
| Organization or user | `scenesystems` |
| Repository           | `theoria`      |
| Workflow filename    | `publish.yml`  |
| Environment          | `npm`          |
| Allowed action       | `npm publish`  |

The publish workflow uses npm's OpenID Connect flow and does not require a long-lived npm token. Its `pack` job downloads the staged package output, checks the workspace and content identity, and packs unpublished versions without rebuilding or holding the token; its `publish` job runs on a GitHub-hosted runner with `id-token: write`, publishes those tarballs, and executes no build or test code. Every public package keeps `publishConfig.provenance` enabled so npm can link the published tarball to this repository and workflow.

The GitHub `npm` environment must allow deployment **tags** matching
`theoria-candidate-*`; keep other tags/branches restricted. The Trusted Publisher
workflow filename and environment remain `publish.yml` and `npm`. The workflow
validates the tag's event SHA against a successful main staging candidate before
requesting that environment. This one-time environment rule requires maintainer
approval; the workflow does not modify repository access controls.

Configure the Trusted Publisher before attempting the first automated release of a new package. Existing versions published without provenance cannot be changed retroactively; subsequent versions receive their own attestations.
