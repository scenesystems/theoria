# Dependency upgrade record

The interface work in `homepage-immersive-surface.md` wants `motion`, a current
Base UI, a current React and a build that treats those as first-class. The
toolchain underneath them was a year behind: TypeScript 5.9, Vitest 3, Vite 7,
Babel 7, ESLint 9 with typescript-eslint, and a pre-release Base UI package
that has since been renamed. This file records the upgrade as it was executed,
in one pass, so that the foundations are settled before any design-system work
begins. Where a choice was made on the reader's behalf it is listed at the end.

The short version: TypeScript 7 (the native compiler) is the only `tsc`,
patched by `@effect/tsgo` so Effect diagnostics run inside type-checking and
fail it. TypeScript 6 is installed only as `typedoc`'s peer library inside
`scripts/`; no repository code imports the compiler API. typescript-eslint is
gone; oxlint owns
the TypeScript-aware rules, ESLint 10 on the Babel 8 parser owns the Effect
`no-restricted-syntax` discipline, and the `dprint` CLI owns formatting.
Vitest is 4, Vite is 8 on Rolldown, and the app's UI stack is `@base-ui/react`
1.7, `motion` 13, React 19.2.8 and `@effect-atom` 0.7. Effect itself was
already at the newest 3.x release, so the Effect upgrade is tooling, not
library versions.

## Where the repository stands

Ranges as written in `package.json` files after the upgrade.

### Compiler and Effect tooling

| Package                           | Before                     | After                                                   |
| --------------------------------- | -------------------------- | ------------------------------------------------------- |
| `typescript` (root)               | ^5.9.3                     | 7.0.2 — the only `tsc`                                  |
| `typescript` (`scripts/`)         | resolved to root           | 6.0.2 — library dependency of `typedoc`                 |
| `@effect/tsgo`                    | —                          | 0.40.0; `prepare` runs `effect-tsgo patch`              |
| `@effect/language-service`        | 0.87.1 package             | removed as a package; kept as the tsconfig plugin entry |
| `typedoc`                         | 0.28.20 at root            | 0.28.20 in `scripts/` so its peer resolves to TS 6      |
| `@types/node`                     | ^25                        | ^26.4.1                                                 |
| `tsconfig.base.json` plugin entry | `@effect/language-service` | + `includeSuggestionsInTsc`, warnings and errors fatal  |

### Lint, format and release tooling (root)

| Package                          | Before        | After                                    |
| -------------------------------- | ------------- | ---------------------------------------- |
| `@typescript-eslint/*`           | ^8.68         | removed                                  |
| `oxlint`                         | —             | 1.81.0 with `.oxlintrc.json`             |
| `eslint` / `@eslint/js`          | ^9.39 / 9     | ^10.9.1 / removed (no shared preset)     |
| `@babel/eslint-parser`           | —             | ^8.0.1 (parses TS for ESLint)            |
| `@effect/eslint-plugin`          | ^0.3.2        | removed; it depends on typescript-eslint |
| `dprint`                         | in the plugin | 0.55.2 CLI with `.dprint.json`           |
| `@babel/cli`, `@babel/core`, `…` | 7.29          | 8.0.x                                    |
| `vitest`                         | ^3.2.7        | ^4.1.10                                  |
| `@vitest/coverage-v8`            | ^3.2.7        | removed; coverage was never wired up     |
| `@effect/vitest`                 | 0.30.0        | 0.30.0; peer `vitest ^3.2` warns, runs   |
| `prettier`                       | 3.8.1         | 3.9.6                                    |
| `@changesets/cli`                | ^2.31.1       | ^3.0.1; config schema 4.0.0              |
| `@changesets/changelog-github`   | ^0.6.0        | ^1.0.0                                   |
| `lint-staged`                    | ^16           | ^17.4.1                                  |
| `.node-version`                  | 22            | 22.23.1                                  |

### App (`apps/theoria`)

| Package                             | Before      | After                               |
| ----------------------------------- | ----------- | ----------------------------------- |
| `@base-ui-components/react`         | ^1.0.0-rc.0 | replaced by `@base-ui/react` ^1.7.0 |
| `motion`                            | —           | ^13.2.0                             |
| `@effect/platform-browser`          | —           | ^0.77.1                             |
| `@effect-atom/atom` / `atom-react`  | ^0.5.3      | ^0.7.0                              |
| `@shikijs/*`                        | ^3.23       | ^4.4.3                              |
| `react` / `react-dom`               | ^19.2.4     | ^19.2.8                             |
| `@types/react` / `@types/react-dom` | ^19.2.14/3  | ^19.2.18 / ^19.2.7                  |
| `vite`                              | ^7.3.6      | ^8.2.2 (root override pins 8.2.2)   |
| `@vitejs/plugin-react`              | ^5.1.4      | ^6.1.1                              |
| `@tailwindcss/vite` / `tailwindcss` | ^4.2.0      | ^4.3.3                              |
| `happy-dom`                         | ^20.7.0     | ^20.13.2                            |

`@heroicons/react`, `@playwright/test` and `wrangler` were already current.

### Packages (`packages/*`)

| Package                  | Before | After                                      |
| ------------------------ | ------ | ------------------------------------------ |
| `@noble/hashes`          | 2.0.1  | 2.4.0 (digest, sign)                       |
| `@noble/curves`          | 2.0.1  | 2.4.0 (sign)                               |
| `@noble/ciphers`         | ^2.0.0 | ^2.4.0 (seal)                              |
| `@noble/post-quantum`    | 0.5.4  | 0.7.1 (sign); `XWing` → `ml_kem768_x25519` |
| `@huggingface/inference` | ^4.13  | ^4.13.28 (effect-inference)                |

Every `effect` and `@effect/*` pin was already the newest 3.x release
(`effect` 3.22.1, `platform` 0.97.1, `platform-bun` 0.91.2, `ai` 0.37.0,
`sql` 0.52.1, `rpc` 0.76.2, `cluster` 0.60.2, `workflow` 0.19.1, and so on).
Effect 4 exists only as release candidates and is out of scope. The published
`@scenesystems/*` packages keep their peer ranges (`effect ^3.22.1`).

## The constraints that shaped the layout

**TypeScript 7 ships no JavaScript compiler API.** The `typescript` package at
7.0.2 exports `tsc` and a `version` string. The AST and program API that
`typedoc` (peer `typescript 5.x || 6.0.x`) is built on is not there, and no
repository code calls it: module and source-file documentation comes from
TypeDoc's own `reflection.comment`, which requires every entrypoint and every
source file that becomes a documentation page to open with a `/** … @module */`
header.

TypeScript's own migration notes suggest installing the 6.0 API under the name
`typescript` via the `@typescript/typescript6` shim and the native compiler
under an alias. That layout does not work under Bun. The shim's type entry is
`import ts = require("@typescript/old")` with `@typescript/old` declared as
`npm:typescript@^6`; Bun resolves that alias back to the shim itself whenever
the root already maps the name `typescript` to it, creating a self-import
cycle that makes every `tsc` invocation (patched or not) spin forever on any
file that imports `typescript`. An `overrides` entry does not break the cycle.

The layout used instead keeps `typescript` at the root as the real 7.0.2
package, so `tsc` is TypeScript 7 everywhere and nothing is aliased. The only
consumer of the compiler API is `typedoc`: `scripts/` is a private workspace
(`@theoria/scripts`) declaring `typedoc: 0.28.20` and `typescript: 6.0.2`, so
typedoc's `typescript` peer resolves to 6.0.2 rather than the root's 7.0.2.
`bun run docs:api` and the app's `docs:assets` step are unchanged.

Type-checking happens from the root (`tsc -b tsconfig.json`), so TypeScript 7
checks every project including `scripts`; only typedoc's own runtime
`import "typescript"` resolves to 6.0.2.

**`packages/source-proof` is gone.** It wrapped the TypeScript compiler API to
"prove" facts about source text: which module specifiers a file imports, which
call targets a variable initializer contains, and the documentation on each
public export. Every consumer was either a test asserting how code was written
rather than what it does, or the `api-reference` pipeline re-deriving from a
second TypeScript program what TypeDoc had already computed. The package, its
`typescript@6.0.2` dependency, the two effect-dsp boundary tests that only
inspected import specifiers, and the AST assertions inside
`packages/effect-text`'s browser-runtime contract test were removed; the
behavioural cases in that test stay. The three app tests that used its
`resolveRootFrom` now call `Path.fromFileUrl` directly.

The `api-reference` pipeline now reads public-export documentation from
TypeDoc's reflections (`scripts/api-reference/public-exports.ts`) in a convert
phase that runs before any output is emitted, so cross-package links resolve
against converted reflections rather than a parallel type-checker program.
Two consequences are visible in the generated reference:

- Exports declared as both a value and a type of the same name (a Schema
  `const` with its `type` alias) are one entry whose kind is `value`; the
  summary comes from the declaration matching that kind.
- JSDoc written inline on export specifiers (`export { /** … */ x } from`) is
  not read by TypeDoc, so those 330 comment blocks across 46 barrel files were
  deleted. Documentation lives on the declaration only. The previous extractor
  also leaked module-level summaries onto dozens of re-exported functions
  (`ask`, `tell`, every `Trial*` event and lifecycle transition in
  effect-search); the reference now shows each declaration's own summary.

**`@effect/tsgo` 0.40.0 patches TypeScript 7.0.2 exactly.** `prepare` runs
`effect-tsgo patch`, so `bun install` (including CI's
`bun install --frozen-lockfile`) leaves `tsc` reporting
`Version 7.0.2+effect-tsgo.0.40.0`. The plugin entry in `tsconfig.base.json`
sets `includeSuggestionsInTsc: true`,
`ignoreEffectSuggestionsInTscExitCode: true`,
`ignoreEffectWarningsInTscExitCode: false` and
`ignoreEffectErrorsInTscExitCode: false`. The first full run surfaced ten
warnings that had been editor-only; all were fixed rather than downgraded:

- Nine `effectFnIife` in `packages/effect-search/src/Study/{api,snapshot}`:
  `Effect.fn("name")(inner)(args)` immediately-invoked wrappers became the
  body piped through `Effect.withSpan("name")`, preserving the span names.
- One `unknownInEffectCatch` in `apps/theoria/app/web/atoms/docs.ts`: the
  clipboard call (since replaced by `Clipboard.writeString` from
  `@effect/platform-browser`) failed with a typed error instead of `unknown`.
- Twelve `multipleEffectProvide` in tests: chained `Effect.provide(A),
Effect.provide(B)` became a single `Effect.provide(Layer.merge(A, B))`
  where the layers are independent, or `A.pipe(Layer.provideMerge(B))` where
  `A`'s construction consumes `B` (the `StudyStorageLive` and rate-limit
  logger cases).

Suggestions (`catchAllToMapError`, `unnecessaryFailYieldableError`, and the
like) still print — about a hundred across the repository — and do not fail
the build.

**typescript-eslint cannot run on TypeScript 7**, and `@effect/eslint-plugin`
imports `@typescript-eslint/utils` at load time, so both were removed. The
replacement stack:

- `oxlint` 1.81 (`.oxlintrc.json`) owns `no-unused-vars`,
  `no-unused-expressions`, `no-explicit-any`, `array-type` (generic),
  `consistent-type-imports` and the TypeScript correctness rules. `bun run
lint` runs it with `--deny-warnings`. It has no path overrides. Two rules
  from its default correctness category are off: `require-yield` (an
  `Effect.gen` body without `yield*` is idiomatic and ESLint already had it
  off) and `typescript/prefer-as-const` (`eslint.config.mjs` bans every `as`
  expression, `as const` included). `unicorn/no-new-array` is on; the
  `packages/digest` buffers that used `new Array(n)` now copy or start
  empty.
- ESLint 10 with `@babel/eslint-parser` 8 owns the Effect
  `no-restricted-syntax` selectors and nothing else: one rule set (core, type
  modeling, Option discipline) for every TypeScript file, with no directory
  scopes and no weaker tier for apps or scripts. Only `**/*.config.*` and
  `apps/*/public/**` are outside it. The `jsx` parser plugin is enabled only
  for `.tsx`; with it on for `.ts`, Babel reads generic arrows such as
  `<A>(x) => x` as JSX and fails to parse.
- The `dprint` CLI (`.dprint.json`, typescript plugin 0.96.1, the same options
  the ESLint rule used) owns formatting for every tracked `.ts/.tsx/.mts/.cts`
  and `.js/.jsx/.mjs/.cjs` file, including `scripts/`, package `scripts/` and
  `benchmarks/`, config files and `apps/*/public`. `bun run lint` ends with
  `dprint check`; `lint:fix` and `lint-staged` run `dprint fmt`. ESLint lints
  its own config file too; nothing tracked is exempt from the three tools.
- `trailingCommas: never` also removes the `<A,>` comma that TSX needs to
  parse a generic arrow function, and dprint offers no TSX-only exception.
  Generic helpers in `.tsx` files are therefore written as `function f<A>()`
  declarations.
- The pre-commit hook (`.husky/pre-commit`) runs secretlint on staged files,
  `lint-staged` (oxlint `--fix`, ESLint `--fix`, `dprint fmt`, and prettier
  for markdown/json/yaml), then `bun run check:all`. It no longer runs the
  full test suite; CI owns that.

The migration was validated against a fixture file containing one deliberate
violation per rule, linted before and after. All 46 `no-restricted-syntax`
findings matched line for line; `no-unused-vars` and `no-explicit-any` moved
from typescript-eslint to oxlint; the import-order finding moved from
`@effect/dprint` to `dprint check`.

**Vite 8 replaced Rollup with Rolldown.** `apps/theoria/vite.config.ts` now
uses `build.rolldownOptions.output.codeSplitting.groups` with regex tests and
priorities in place of the `manualChunks` function. Vendor groups outrank the
workspace groups: Bun's isolated install links `effect` beneath each workspace
package (`packages/effect-text/node_modules/effect/…`), and with the workspace
regex winning, the Effect runtime was emitted inside the `effect-text` chunk.
With the fix the production build emits:

| Chunk          | Size (min) | gzip   | Contents                         |
| -------------- | ---------- | ------ | -------------------------------- |
| `index`        | 158 kB     | 45 kB  | application code                 |
| `react-vendor` | 190 kB     | 60 kB  | react, react-dom, scheduler      |
| `ui-vendor`    | 225 kB     | 74 kB  | @base-ui, @heroicons             |
| `effect-core`  | 326 kB     | 101 kB | effect, @effect/\*, @effect-atom |
| `effect-text`  | 378 kB     | 162 kB | @scenesystems/effect-text        |
| `wasm-inlined` | 622 kB     | 232 kB | shiki oniguruma (lazy)           |
| `typescript`   | 181 kB     | 16 kB  | shiki grammar (lazy)             |
| `shellscript`  | 41 kB      | 6 kB   | shiki grammar (lazy)             |
| `dist-*` (two) | 118 kB     | 38 kB  | shiki core (lazy)                |

`motion` is installed and routed to `ui-vendor` by the chunk regex. The root
`MotionConfig` in `App.tsx`, the `AnimationFrame` service and the wordmark morph
import it, so the runtime is in the production bundle; the redesign builds on
that footprint rather than adding a second animation runtime.

**Vitest 4 removed the options the root config set.** `poolOptions` became
top-level `maxWorkers: process.env.CI ? 2 : 4`. The root `coverage` block had
sat outside `test`, where Vitest ignored it, and nothing ran coverage; it and
`@vitest/coverage-v8` were removed rather than migrated. Every config now sets
`passWithNoTests: false`, and `bunfig.toml` (which pointed `bun test` at an
empty directory so it exited 0) is gone: an empty run is a failure, and
`bun test` fails on `@effect/vitest` instead of passing silently.

**Base UI renamed its package at 1.0.0.** Twenty-four import sites moved from
`@base-ui-components/react/<part>` to `@base-ui/react/<part>`; no component
API changed.

**`@noble/post-quantum` 0.7 removed the `XWing` alias.**
`packages/sign/src/algorithms/hybrid.ts` now imports `ml_kem768_x25519`. The
`sign`, `seal` and `digest` known-answer tests pass on noble 2.4.

## Records and absence are Effect-native

The upgrade left the packages type-checking under TypeScript 7 but still
describing their data the way TypeScript alone would: 119 `Readonly<{ … }>`
record wrappers, 27 `| null` annotations, five `typeof x === "undefined"` probes,
and `Option.getOrUndefined` / `onNone: () => undefined` bridges where an
`Option` met a field that wanted `undefined`. None of these were caught, because
the ESLint Effect rules had no selectors for them.

Every one is gone, and `eslint/effect/types.mjs` now rejects the patterns so
they cannot return:

- **Records.** Data-only shapes are `Schema.Struct` with `type X = typeof
X.Type`. Shapes that carry functions, Effects, Layers, generics or internal
  state are `class X extends Data.Class<{ … }> {}`; the instance type is
  `Readonly<Fields>`, plain literals stay assignable, and `X & { … }` becomes
  `Data.Class<X & { … }>`. The banned forms are `Readonly<{ … }>`,
  `type X = { … }` and `type X = A & { … }` (including the `{ … } & {}`
  spelling). React component props are annotated inline on the parameter.
- **Absence.** `| null` and `| undefined` in annotations, `=== null`,
  `?? null`, and `typeof x === "undefined"` are out; the value is an
  `Option<A>`. Where the wire format carries `null` (the docs manifest, the
  API reference model) the schema field is `Schema.OptionFromNullOr`, so
  producers and consumers both see `Option` and only the encoded JSON sees
  `null`. Public signatures changed accordingly: `docsApiRoute(pkg, moduleSlug:
Option<DocsModuleSlug>)`, `DocsApiRoute.moduleSlug`, `DocsHeader` and
  `DocsSearchDialog` active-package props, effect-dsp's
  `projectSingleObjective(report, Option<string>)`, and effect-text's
  `BrowserParityResolvedCase`. The four recursive JSON value aliases
  (`FieldValue`, `ArtifactPayload`, `ProviderMetadataValue`,
  `StudyObjectiveCacheKey`) keep `| null` as a top-level alias member: that
  is JSON's `null`, not absence.
- **Bridges.** `Option.getOrNull`, `Option.getOrUndefined`,
  `Option.getOrElse(() => undefined)` and `onNone: () => undefined` are
  banned. A third-party optional field takes a conditional spread,
  `...Option.match(o, { onNone: () => ({}), onSome: (v) => ({ field: v }) })`.
  A React 19 callback ref lifts its argument with `Option.fromNullable`
  (`observeOnMount` in `apps/theoria/app/web/atoms/element-observation.ts`).
- **Browser globals.** The app never renders on a server, so
  `typeof window === "undefined"` guards were dead branches; they are gone. The
  document is a service, `BrowserDocument` in `app/web/platform`, provided once
  in `main.tsx`; the one genuinely optional capability, a 2D canvas for text
  measurement, is `BrowserDocument.canvasContext2d`, an `Option` the text
  layout layer matches on (`browserTextLayout.ts`).
- **Layout slots.** `Layout.tsx` had a polymorphic `as` generic over
  `ElementType`, unsound in the case TypeScript 7 could not even express
  (`keyof JSX.IntrinsicElements` hits TS2590). The slots are now one factory
  generic over a closed `LayoutTag` union, typed with Base UI's
  `useRender.ComponentProps<Tag>`: `<Main>` accepts the attributes and ref of a
  `<main>`, and the element is swapped or composed through Base UI's `render`
  prop rather than an `as` prop, the same way every other Base UI component in
  the app chooses its element.

Where the migration found absence that was only standing in for a derivable
value, it derived the value instead: `maxWidth: number | null` in the text
authority meant "use the contract's width", so `projectText` now defaults
`maxWidth` to `maxWidthFor(role, variant)` and no `Option` is needed.

## Host globals are services

The last plain-JavaScript layer was the one under the app and the scripts: 37
`globalThis` reads, `window`/`document`/`localStorage`/`navigator` used from
atoms and views, `fetch` in the clients, `new URL` in 40 files, host timers and
`requestAnimationFrame` in animation and measurement code, `process.*` and
`Bun.CryptoHasher` in package scripts, `crypto.randomUUID` as the server's
request id. Each is now an Effect service or an Effect module, and the ESLint
`HOST_GLOBAL_RULES` (`eslint/effect/builtins.mjs`) reject the globals so they
cannot return. `window`, `document` and `navigator` are covered by the
scope-aware `no-restricted-globals` block in `eslint/scopes.mjs`, which applies
to shipped code (`packages/*/src`, `apps/*/app`, `scripts`) outside
`apps/*/app/web/platform/`, the one module that acquires them. Test code is
outside that block because Playwright's `page.evaluate` callbacks run inside
the page, where the DOM is the only API there is.

- **Browser.** `apps/theoria/app/web/platform/` defines `BrowserWindow` and
  `BrowserDocument` tags acquired once in a `Layer.sync`, plus
  `AnimationFrame` and `ElementSize` (`ResizeObserver`) wrappers. `browser.ts`
  merges them with `BrowserKeyValueStore.layerLocalStorage`, `Clipboard.layer`
  and `FetchHttpClient.layer` into `BrowserLive`; `appRuntime = Atom.runtime(BrowserLive)`.
  `main.tsx` starts through `BrowserRuntime.runMain`. Theme preference is an
  `Atom.kvs` over the key-value store with a tri-state `ColorModePreference`
  (`system` / `light` / `dark`) under the key `theoria/color-mode-preference`;
  the old `theoria-color-mode` key is not migrated. `ImaginedPlaceClient` and
  `DocsClient` send through `HttpClient`; navigation reads and writes history
  through `BrowserWindow`.
- **Base UI and Motion.** Every control that Base UI provides is composed from
  it rather than hand-written: `TabGroup`/`TabBar`/`Tab`/`TabPanel` over
  `Tabs` (the tabs now carry `tablist`/`tab` roles), `ChoicePills` over
  `RadioGroup`, `ToggleSwitch` over `Switch`, `TextAreaField` with
  `FieldGroup`/`FieldLabel`/`FieldDescription` over `Field`, the docs
  navigation drawer over `Drawer`, and the layout primitives take Base UI's
  `render` prop. The wordmark morph animates with Motion (`motion/react`,
  `MotionConfig` at the app root) instead of a hand-rolled frame loop.
- **Server.** `router.ts` takes the request id from the tracer span
  (`Effect.currentSpan`, guaranteed by `HttpApp.toHandled`'s tracer middleware)
  instead of `crypto.randomUUID()`, and returns 400 for a URL it cannot parse.
  The Workers `StaticStore` builds an `HttpClient` from the `ASSETS` binding
  with `HttpClient.make`, so asset reads are ordinary traced client requests.
- **Scripts and tests.** Package scripts resolve their root from
  `import.meta.url` through `Url.fromString` + `Path.fromFileUrl` rather than
  `process.cwd()`, hash with `@scenesystems/digest` rather than
  `Bun.CryptoHasher`, and exit through `BunRuntime.runMain` (exit code 1 on any
  failure) rather than `process.exit`; the bespoke `exitCode` fields are gone.
  Fixture registries take a `rootDirectory` string. Timer-based tests use a
  forked `Effect.sleep` fiber instead of `setInterval`. `@scenesystems/sign`
  gained `generateEntropy` so hedged signing has a CSPRNG source that is not
  Effect's seedable `Random`.
- **Web interop stays where Effect puts it.** `HttpServerRequest.fromWeb` and
  `HttpClientResponse.fromWeb` take web `Request`/`Response` values by design,
  and Effect's own tests build fixtures with `new Request`/`new Response` at
  that seam, so those constructors are not banned. Vitest runs on Node, so
  `BunHttpServer.layerTest` is not available to app tests.
- **Removed as governance rather than migrated.** `effect-search`'s TPE
  wall-clock budget test, `effect-text`'s synthetic-regression harness (the
  `browser-parity.contract.test.ts` already compares the committed artifacts
  against real output) and its `verifySupportManifest` self-consistency script.
- **Vitest projects.** The root `vitest.config.ts` now declares two projects:
  `packages` (Node) and the app's own `vitest.config.ts` (happy-dom). Before,
  the root run also matched `apps/*/test/**/*.test.ts` in Node without a DOM,
  so app files ran twice under different environments.

## Verification

Every gate ran green on the upgraded tree:

```
bun run check          # tsc -b tsconfig.json, TS 7.0.2+effect-tsgo, ~6 s
bun run check:tests    # tsconfig.test.json: package and app tests, package scripts that import test helpers
bun run check:examples # tsconfig.examples.json: package examples, fixture scripts, effect-text benchmarks
bun run check:all      # the three above; this is what CI and the pre-commit hook run
bun run check:apps
bun run lint           # oxlint --deny-warnings && eslint --max-warnings=0 && dprint check
bun run test           # vitest 4 projects: 365 files, 2001 tests (packages in Node, app in happy-dom)
bun run test:apps      # the app project alone: 26 files, 93 tests
bun run test:worker    # after deploy:dry-run — the built Worker in workerd + Chromium: 6 files, 23 tests
bun run build          # tsc -b, Babel 8 CJS/ESM, typedoc on TS 6, Vite 8 web build
```

`check:examples` is new. Before it, the eight per-package
`tsconfig.examples.json` projects were only reachable through each package's
own `check:examples` script, which nothing at the root or in CI invoked, and
`packages/effect-text/benchmarks` belonged to no project at all. The first run
found two real type errors in the benchmarks (an `Effect` whose
`MeasurementFailed` failure had been erased by a `never` annotation, and a
profile array widened to `string`) and ten `multipleEffectProvide` warnings in
examples; all were fixed rather than excluded.

A clean `rm -rf node_modules && bun install` reproduces the layout from the
lockfile alone: `node_modules/.bun` contains exactly `typescript@6.0.2` (linked
only from `scripts/`), `typescript@7.0.2` and one `typedoc@0.28.20` variant
whose `typescript` link points at 6.0.2.

## Decisions to revisit

- TypeScript 6 remains installed as a library in `scripts/` only because
  `typedoc` 0.28 requires it; it leaves with the first typedoc release that
  supports TypeScript 7. Nothing else depends on it: module comments come from
  TypeDoc's `reflection.comment` (every entrypoint and documented source file
  carries a `@module` header), and authored `@example` blocks are compiled by
  spawning `tsc` through `scripts/typecheck/snippets.ts`, shared with
  `scripts/check-readme-examples.ts`.
- Bun stays at 1.3.9. Its JavaScriptCore fragments a multi-gigabyte heap into
  tens of thousands of kernel memory mappings and, at Linux's default
  `vm.max_map_count` of 65,530, retries `madvise` forever with no JavaScript
  running. The API reference generator used to hold every package's TypeScript
  program in one process (nine programs, 6-7 GB, 65-85k mappings) and stalled on
  roughly every other `bun run build`. It now converts each package in a process
  of its own (`scripts/api-reference-convert.ts`, driven by
  `scripts/api-reference/convert-packages.ts`) and revives the serialized
  reflections one module at a time in the generator, so the largest process
  measured 22.5k mappings and 2.2 GB under the stock limit (the parent 22k and
  1.7 GB), with the whole reference finishing in about 46 seconds. This is also TypeDoc's
  own multi-package pattern (`packages` entry point strategy: convert
  separately, merge the JSON) and does not depend on the Bun version.
- Effect warnings fail `tsc`; suggestions do not.
- Vitest stops at 4.1, not 5.0, as requested; `.node-version` 22.23.1 already
  satisfies Vitest 5's Node floor.
- `@effect/vitest` 0.30.0 stays with a peer warning rather than an override,
  so the warning disappears on its own when a matching release appears.
- `@changesets/cli` 3 exits 1 from `changeset version` when there is nothing
  to release; no release script in the repository assumes otherwise today.
- The web build's two chunks above 500 kB (`wasm-inlined`, `effect-text`) are
  reported by Vite as a warning. Both are lazy-loaded; the redesign is the
  place to decide whether the text engine should split further.
