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

### Public npm packages from a private repository

Published workspace packages use public npm access even when the GitHub repository is private. Public consumers do not need GitHub access or an npm read token, but everything included in an npm tarball is publicly downloadable.

Provenance is disabled because npm cannot generate provenance attestations from a private source repository. Keep Trusted Publishing configured separately on every npm package with these values:

| Field                | Value          |
| -------------------- | -------------- |
| Provider             | GitHub Actions |
| Organization or user | `scenesystems` |
| Repository           | `theoria`      |
| Workflow filename    | `publish.yml`  |
| Environment          | `npm`          |
| Allowed action       | `npm publish`  |

The first releases under the new scoped identities must exist on npm before their Trusted Publishers can be configured. After `bun run release:check`, bootstrap them with maintainer authentication and provenance disabled:

```sh
npm publish packages/effect-search/dist --access public --provenance=false
npm publish packages/effect-dsp/dist --access public --provenance=false
npm publish packages/effect-text/dist --access public --provenance=false
```

`@scenesystems/digest` retains its existing public identity and does not require a visibility migration. Deprecate the old unscoped `effect-search`, `effect-dsp`, and `effect-text` packages only after the replacement packages are published and consumers have migrated.

If the GitHub repository becomes public again, provenance can be re-enabled for subsequent releases by restoring `publishConfig.provenance` to `true`. Provenance cannot be added retroactively to existing npm versions.
