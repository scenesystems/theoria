# Theoria

Effect v4 scientific-computing libraries in `packages/`; the React/Cloudflare site
is in `apps/theoria/`. Package manifests own dependencies, exports, and scripts.

## Working in this repository

- Use Bun for JavaScript dependencies and scripts. From the root, package scripts
  run as `bun run --filter '@scenesystems/effect-math' <script>`.
- Use Effect public APIs throughout TypeScript implementations, including pure
  computations, callbacks, tests, and tooling. An Effect return type does not
  make a native implementation Effect-native. Do not introduce exceptions or
  adapters that hide non-Effect operations.
  Load `researching-effect` when an API or integration is unfamiliar.
- Follow the Effect restrictions in `eslint/` and `.oxlintrc.json`; formatting is
  owned by `.dprint.json` (source) and Prettier (Markdown/JSON/YAML). Do not add
  suppressions or change lint policy to make an unrelated task pass.
- Keep changes within the requested scope. Report unrelated failures rather than
  absorbing them into the task.

## Library contracts

- Public concerns use PascalCase modules with matching root namespaces and package
  subpaths. Private mechanics live under `src/internal/` and stay private.
- Use Schema for validated/encoded data, Data for structural values without
  codecs, and Context/Layer for capabilities. Generic types and callbacks do not
  need serialization schemas.
- Schema identifiers, brands, and service keys use
  `@scenesystems/<package>/<Concern>[/<Member>]`. Preserve wire tags independently
  of local naming changes.
- `effect-study` owns reusable evaluation, history, lifecycle, and persistence;
  `effect-search` adds optimization policy; `effect-dsp` composes both for language
  model programs. Keep dependencies in that direction.
- Seed non-cryptographic sampling through Effect Random. Sign's `Entropy` and
  seal's `Cipher` supply their own cryptographic randomness; Random is not a
  source of secrets.
- Public API docstrings need `@since` and `@category`; docs-page module headers
  need `@module`. Preserve truthful versions. `bun run docs:api` checks generation.

## Verification

- For behavioral changes, write a failing regression test first. Use
  `@effect/vitest` and `it.effect`; use `it.effect.prop` for invariants and
  independent reference vectors for numerical/protocol conformance. Load
  `maintaining-fixtures` when changing reference data or generators.
- Run focused tests with `bun run test -- <test-path>` and the affected package's
  checks while iterating. Root `bun run check:all` covers source, tests, examples,
  scripts, and benchmarks; `bun run lint` includes formatting.
- For cross-package changes or integration, run `bun run check:all`,
  `bun run lint`, `bun run test`, and `bun run build`. Rebuild clean outputs after
  module moves before testing packed consumers. Documentation-only changes need
  formatting and reference checks, not a production build.
- Report the checks actually run and any failures or unverified behavior.

## Task-specific references

- App architecture and UI: `apps/theoria/AGENTS.md`.
- Local orb servers: `amp orb services ensure` uses `.amp/services.yaml`.
- Releases: `CONTRIBUTING.md`; deployment: `apps/theoria/DEPLOYMENT.md`.
  Use the documented workflows; publishing and production promotion require
  explicit approval. This guidance does not authorize either action.
- `.vendor/` contains read-only dependency references. `.specs/` is gitignored
  scratch space, not authoritative product requirements.
