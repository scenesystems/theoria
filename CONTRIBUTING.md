# Contributing

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Please report concerns to [security@scenesystems.io](mailto:security@scenesystems.io).

## Development

Use [Bun](https://bun.sh) and run `bun install`. Start with the affected package's
checks, for example:

```sh
bun run --filter @scenesystems/effect-search check
bun run --filter @scenesystems/effect-search test
```

Broaden verification with the change's reach. Root commands are `bun run check:all`,
`bun run lint`, `bun run test`, and `bun run build`. Documentation-only changes do
not require a production build. Report failures and unverified behavior; do not
weaken checks or bypass failing hooks.

## Making changes

- Use [Effect](https://effect.website/docs/v4/) public APIs throughout TypeScript,
  including pure computations, callbacks, tests, and tooling.
- Make the smallest coherent change. Add abstractions only to remove demonstrated
  duplication or complexity. Keep refactoring separate from behavior changes.
- Use `@effect/vitest` and the existing test setup to catch plausible behavioral
  defects. Prefer direct regression tests over new harnesses or contract-testing
  layers. Do not test guidance, file inventories, or naming conventions.
- Update the owning documentation when public behavior or setup changes. Link to
  canonical information rather than duplicating it.

For documentation examples, run `bun run docs` and inspect affected guides in the
docs application. README guides support `$x^2$` for inline math and `$$` on separate
lines around display math; escape a prose dollar sign as `\$`. This syntax does
not apply to TypeDoc API comments.

Run Python fixture generators with `uv run` to use their declared dependencies.

## Pull requests

Submit PRs against `main`. Explain the problem, conceptual change, and actual
verification—not a file inventory or implementation diary. Omit empty sections.

Keep commits signed, focused, and independently reviewable. Use Conventional
Commits: `type(scope): concise change`, with the scope naming the affected owner.
Stage intended files with `git add <paths>`, inspect `git diff --cached`, then
commit with `git commit -S -m 'fix(effect-search): correct result ordering'`.

## Changesets

Run `bun run changeset` for consumer-visible behavior, API, performance, or
packaging changes. Internal changes also require a new version when they change
prepared package content. Unpackaged tests, guidance, and tooling with no
published impact need no changeset. Documentation-only updates need one when
they should be republished; see the [release content rules](RELEASING.md#package-content).

Write one conceptual note for consumers: what changes, why it matters, and any
required caller action. Choose patch for compatible fixes and improvements,
minor for added capabilities, and major for breaking changes. For packages below
1.0, use minor for breaking changes.

Maintainers handle version bumps, generated changelogs, and publishing using the
[release runbook](RELEASING.md).
