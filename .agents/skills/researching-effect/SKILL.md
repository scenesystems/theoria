---
name: researching-effect
description: Resolves Effect API and integration questions using version-aligned sources. Use when an API is unfamiliar or library behavior is uncertain.
---

# Researching Effect

- Use the installed version as the source of truth. Find relevant topics in
  `node_modules/effect/AGENTS.md` and follow their examples. Resolve API questions
  against public declarations, source, and tests matching that version.
- Read nearby consumers before introducing an abstraction. Prefer direct
  composition of public APIs over wrappers that add no domain meaning.
- Check when work executes, which failures and services it exposes, who owns
  resources, and what happens on interruption. Preserve these semantics through
  composition.
- Verify changed behavior with focused typechecks and tests in the existing
  suite. Use small, deterministic examples that exercise the actual uncertainty.
- Report missing capabilities rather than hiding mismatches with assertions,
  suppressions, private imports, or non-Effect substitutes.

## References

- [Effect documentation and guides](https://effect.website/docs/v4/): concepts,
  usage, and examples.
- [Effect API reference](https://effect.website/docs/v4/api/effect): public modules,
  signatures, and operation semantics.
- [Effect repository](https://github.com/Effect-TS/effect): implementations, tests,
  and package exports. Its [AI guides](https://github.com/Effect-TS/effect/tree/main/ai-docs)
  provide topic-specific coding examples.
- Installed references: `node_modules/effect/AGENTS.md`, its linked `ai-docs/`
  examples, and `node_modules/effect/src/`. Web documentation and repository `main`
  may be newer; check signatures against the installed version.

## Effect diagnostics and linting

- [Effect TypeScript-Go](https://github.com/Effect-TS/tsgo): Effect-aware compiler
  diagnostics, language service, and supported tooling versions.
- [Effect's Oxlint integration](https://github.com/Effect-TS/tsgo/blob/main/docs/README.md):
  type-aware configuration, presets, and patching requirements.
- [Effect diagnostic rules](https://github.com/Effect-TS/tsgo/tree/main/docs/rules):
  explanations and examples for individual findings.
- [Oxlint documentation](https://oxc.rs/docs/guide/usage/linter.html): configuration,
  CLI behavior, and general lint rules.

Read `package.json`, `.oxlintrc.json`, and the relevant tsconfig before diagnosing
tooling failures. Use `bun run lint` for repository lint checks and
`bun run effect:diagnostics` for dedicated Effect diagnostics. Check the installed
`@effect/tsgo` compatibility requirements before changing TypeScript, Oxlint, or
`oxlint-tsgolint`; fix the underlying issue rather than suppressing the finding.
