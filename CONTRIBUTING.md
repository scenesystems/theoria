# Contributing

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md), which includes the contact for conduct concerns. Report vulnerabilities through the [security policy](./SECURITY.md).

## Scene Systems workflow

Linear owns outcomes, acceptance criteria, and current state. Amp holds the
primary execution thread; GitHub holds delivery and verification evidence.
Public contributors can still report questions, defects, and proposals through
GitHub issues; Scene Systems tracks accepted work in Linear without duplicating
its current state across systems.

Search existing issues and Amp threads before creating another. Track substantial
authorized work with a Linear issue, a human owner, and a linked primary execution
thread. Small internal steps belong in that thread, not separate tickets.
Tracking work does not authorize it; agents follow the
[execution authority and pause rules](AGENTS.md#documentation-and-delivery).

`Done` means the issue's acceptance criteria are satisfied, not that a PR merged
or an agent stopped. A merged implementation may still leave operational
acceptance outstanding.

## Issue references

For broad operational acceptance, use relation-only `Related to THR-...` with
the actual issue ID and link. Use non-closing `Contributes to THR-...` only when
earlier automation is wanted. Do not use closing keywords for partial delivery
or negated closing phrases: automation may still interpret a closing keyword
inside a negation. A closing reference is appropriate only when merge satisfies
the issue's full acceptance criteria.

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

Run Python fixture generators with `uv run --locked` to use the root dependency
lock. For Math's environment pins and regeneration commands, see the
[Math reference fixtures guide](packages/effect-math/README.md#reference-fixtures).
Record approved reference-byte changes with before/after SHA-256 hashes; never
alter assertions or tolerances to accommodate regeneration.

## Pull requests

Submit PRs against `main`. Keep the required `Problem`, `Change`, and
`Verification` headings from the [PR template](.github/pull_request_template.md).
Explain the problem and resulting change. For Scene Systems work, include the
actual issue reference using the [linking rules](#issue-references), plus the
primary Amp thread link. Report decisive checks actually performed, their tested
revision, and material limitations; identify evidence from an earlier revision
rather than presenting it as verification of the current head. If no checks ran,
say why. Remove author prompts and omit optional empty sections.

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
