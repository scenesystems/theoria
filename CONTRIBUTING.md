# Contributing

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md), which includes the contact for conduct concerns. Report vulnerabilities through the [security policy](./SECURITY.md).

## Development

Use [Bun](https://bun.sh) and run `bun install`. Start with the affected package's
checks, for example:

```sh
bun run --filter @scenesystems/effect-search check
bun run --filter @scenesystems/effect-search test
```

For changes that affect several packages, run the root checks: `bun run check:all`,
`bun run lint`, `bun run test`, and `bun run build`. Documentation-only changes do
not need a production build. Include any failures or checks you could not run in
the pull request; leave checks and hooks enabled.

## Making changes

Use [Effect](https://effect.website/docs/v4/) public APIs throughout TypeScript,
including pure computations, callbacks, tests, and tooling. Keep each change
focused on its purpose, and separate refactoring from behavior changes. Add an
abstraction when it removes duplication or complexity already present in the code.

Tests should catch plausible defects in behavior. Use `@effect/vitest` with the
existing setup, adding a regression test to the relevant suite rather than a new
harness. Guidance, file inventories, and naming conventions do not need tests.

When public behavior or setup changes, update the document that describes it.
Link to that document from other places that need the information.

For documentation examples, run `bun run docs` and inspect affected guides using
the [docs application workflow](apps/theoria/README.md#edit-documentation).
Mark independently compilable TypeScript fences with `ts typecheck` so the
README checker includes them. README guides support `$x^2$` for inline math and
`$$` on separate lines around display math; escape a prose dollar sign as `\$`.
This syntax does not apply to TypeDoc API comments.

Run Python fixture generators with `uv run` to use their declared dependencies.

## Pull requests

Submit PRs against `main`. Explain the problem and the change, and report the
checks you ran. Omit empty sections.

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

Write the changeset for someone upgrading the package. Describe the change and
any action they need to take. Choose patch for compatible fixes and improvements,
minor for added capabilities, and major for breaking changes. For packages below
1.0, use minor for breaking changes.

Maintainers handle version bumps, generated changelogs, and publishing using the
[release runbook](RELEASING.md).
