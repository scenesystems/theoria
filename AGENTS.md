# Theoria

Theoria is an open-source, Effect-native scientific-computing library collection.
Libraries live in `packages/`; the documentation application lives in `apps/`.

## Design

- Use Effect public APIs throughout TypeScript, including pure computations,
  callbacks, tests, and tooling. An Effect return type does not make a native
  implementation Effect-native. Do not introduce exceptions or adapters that
  hide non-Effect operations. Lint coverage is not the limit of this requirement.
- Model validated and encoded data with Schema, structural values without codecs
  with Data, and capabilities with Context and Layer. Do not impose serialization
  on generic types, callbacks, or services.
- Depend on service contracts; let callers provide implementations. Preserve
  error and requirement channels through composition instead of installing hidden
  dependencies or erasing failures.
- Keep abstractions with the concern that owns their meaning. Prefer direct
  composition; introduce a shared abstraction only when it removes demonstrated
  duplication or complexity. Do not impose a file template on every concern.
- Work toward the requested target state. Do not invent compatibility layers,
  format versions, registries, or configuration for hypothetical consumers.
  Existing scaffolding is not a reason to add more. Remove superseded machinery
  instead of layering corrections over it.
- Treat public behavior, wire representations, resource lifetimes, and numerical
  semantics as contracts. Read the relevant implementation, documentation, and
  tests before changing them; keep specifications there, not in agent guidance.

## Engineering process

- Use Bun for JavaScript dependencies and scripts. Read the relevant
  `package.json` for available commands; run package scripts from that directory.
  Repository lint and formatter configurations own mechanical rules.
- Establish the intended behavior and investigate the specific uncertainty that
  blocks it. Research should inform implementation, not become an unrelated audit.
  If iterations stop producing progress, identify the unresolved cause before
  adding more patches, tests, or infrastructure.
- Separate behavior-preserving refactoring from behavior changes into reviewable
  steps. Keep each slice focused on its intended outcome rather than folding
  speculative follow-ups into it.
- Run focused checks while iterating. Broaden verification with the change's
  reach: root `check:all`, `lint`, `test`, and `build` cover integration. Match
  checks to the change; documentation edits do not require a production build.
- Keep work within scope. Report unrelated failures and unverified behavior
  rather than expanding the task or weakening checks.

## Tests that earn their place

- Every test must catch a plausible defect in first-party behavior. For a behavior
  change, start with a failing example that distinguishes the intended result
  from a realistic mistake. Use `@effect/vitest` and the existing test setup.
- Test outputs, failures, invariants, resource lifetimes, and real integration
  boundaries. Do not add tests about tests, guidance, file/export inventories,
  naming, or package metadata. Leave structural checks to the compiler, resolver,
  linter, build, and release tooling that own them.
- Do not add a contract-testing layer, generic harness, acceptance manifest, or
  smoke suite just to certify a change. A test called a contract test must still
  exercise meaningful behavior. Prefer a direct regression test in the owning
  suite; remove redundant scaffolding rather than expanding it.
- Use property tests for meaningful invariants and independent references for
  numerical/protocol results. Do not reproduce the implementation as its own
  oracle, assert only that nothing crashed, or weaken expectations to get green.

## Documentation and delivery

- Update the owning documentation when public behavior or setup changes. Write
  for the reader's task; do not create work diaries or parallel specifications.
- Commit completed, verified logical slices rather than accumulating an opaque
  batch. Use signed Conventional Commits: `type(scope): concise change`, with the
  type describing the change and the scope naming its owner. Inspect the staged
  diff and run relevant checks before committing; do not disable signing or
  bypass failing hooks without explicit authorization.
- When reorganizing commits, inspect the complete diff and preserve the final
  tree and behavior. Commit permission does not authorize pushing or rewriting
  published history.
- Distinguish implemented, verified, committed, pushed, merged, and released in
  status reports. Report actual results, not planned checks or assumed success.

## Task references

- Load `researching-effect` for unfamiliar Effect APIs or integration questions.
- Load `maintaining-fixtures` for reference data, provenance, or generator changes.
- Load `writing-documentation` for substantial README or documentation changes.
- Load `writing-contributions` when drafting or reviewing PR descriptions or issues.
- Load `writing-changesets` when deciding whether a changeset is needed or writing one.
- Read `CONTRIBUTING.md` for contributions, `RELEASING.md` for publishing, and the application's
  `DEPLOYMENT.md` for deployment. Use those workflows with explicit authorization
  for publishing or deployment; these instructions do not grant it.
