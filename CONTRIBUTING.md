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
bun run --filter effect-search check
bun run --filter effect-search test
```

## Fixture Generation

Some packages use [uv](https://docs.astral.sh/uv/) to generate golden test fixtures from reference implementations (Optuna, DSPy). Always use `uv run` — never `python3` directly.

## Releases

This project uses [Changesets](https://github.com/changesets/changesets) for versioning. Before committing, create a changeset:

```sh
bun run changeset
```

Maintainers handle version bumps and publishing.
