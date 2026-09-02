---
description: Source architecture for the theoria app
globs: "**/*.ts, **/*.tsx"
alwaysApply: true
---

# app/ — Source Architecture

Three layers with strict dependency direction: `contracts/ → server/`, `contracts/ → web/`. Server and web never import from each other.

---

## contracts/ — Schema Authority

The single canonical definition for every type shared between server and web. Both layers import from here — never define domain types inline in `server/` or `web/`.

### Patterns

- **Schema → Type extraction**: `Schema.Struct({...})` then `type X = typeof X.Type`.
- **Envelope protocol**: `Envelope(DataSchema)` produces a `Success | Failure` union with typed `meta` and discriminated `ok` field.
- **Tagged errors**: `Schema.TaggedError` with `_tag` discrimination. The `DemoError` union (`demo-error.ts`) covers `DemoRequestError | DemoDecodeError | DemoExecutionError` and is the browser client's failure type.
- **Imagined Place**: `imagined-place.ts` is the request (`PlaceBuildRequest`, scenarios), `imagined-place-result.ts` the result (`PlaceBuild`, `PlaceBuildEnvelope`), and `demo/imagined-place-*.ts` the arrangement and flow projections shared by server rendering and the browser.
- **Docs**: `docs.ts` owns the `/docs` route family (`DocsRoute`, slugs, `docsPathFor`); the docs data model itself comes from `@theoria/docs-model`.
- **IDs and codes**: `Id` and `ErrorCode` are Schema-refined strings/literals. All valid values are defined once in contracts.

### Anti-patterns

- Defining a type in `server/` or `web/` that should live in `contracts/`.
- Using TypeScript `interface` instead of `Schema.Struct`.
- Duplicating schema refinements (e.g., `NonEmptyString`) — import from the contract that owns it.
- Adding an `ErrorCode` literal that no route produces.

---

## server/ — API Layer

Effect-native HTTP handlers, independent of the host runtime: `apps/theoria/server.ts` serves them with Bun, `apps/theoria/worker.ts` (via `server/worker.ts`) as a Cloudflare Worker. No framework router — routing is `Match.value(pathname)` dispatch in `router.ts`.

### Architecture

| File                      | Role                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.ts`                  | `publicApp` (router + `indexingPolicy` + `xForwardedHeaders` + `securityHeaders`) and `AppLayer` (`ParticipantsLive`, `DocsCatalogLive`, `RuntimeInfoLive`, release-stage check)                                                                                    |
| `router.ts`               | `Match.value(pathname)` dispatch to route handlers. API 404 returns a typed `Failure` envelope.                                                                                                                                                                     |
| `worker.ts`               | `makeWorkerHandler(env)`: builds the Worker `fetch` handler from `publicApp` with the assets-backed `StaticStore`                                                                                                                                                   |
| `config/runtime.ts`       | `RuntimeInfo` service: `buildSha` + `startedAtMs` from `Config` + `Clock`                                                                                                                                                                                           |
| `config/release-stage.ts` | `RELEASE_STAGE` config (`production` \| `preview`); layer construction dies on an unsupported value                                                                                                                                                                 |
| `config/static-store.ts`  | `StaticStore` service: the built web bundle. `platform/bun-static-store.ts` reads `dist/`; `platform/assets-static-store.ts` reads the Workers assets binding                                                                                                       |
| `config/docs-catalog.ts`  | `DocsCatalog` service: the docs manifest read from the `StaticStore` at startup                                                                                                                                                                                     |
| `imagined-place/*`        | The home-page demo: `run.ts` builds a place from a `PlaceBuildRequest`; `compose.ts` runs the recorded `effect-dsp` programs; `authority.ts` signs and digests with `sign`/`digest`; `note.ts` seals with `seal`; `render.ts` lays the place out with `effect-text` |
| `indexing-policy.ts`      | Adds `X-Robots-Tag: noindex` on every host except `theoria.scenesystems.io`                                                                                                                                                                                         |
| `security-headers.ts`     | CSP, HSTS, and the other fixed response headers                                                                                                                                                                                                                     |
| `routes/*.ts`             | Route handlers returning `HttpServerResponse`: `health`, `version`, `imagined-place`, `sitemap`, `static`                                                                                                                                                           |

### API surface

- `GET /api/health/live`, `GET /api/health/ready`, `GET /api/version`
- `POST /api/imagined-place/build` — same-origin only, decodes `PlaceBuildRequest`, answers with `PlaceBuildEnvelope`
- `GET /sitemap.xml`
- Everything else: `routes/static.ts` serves the HTML shell (with per-route metadata) for page paths and `dist/` assets otherwise. `/api/*` never falls through to static.

### Anti-patterns

- Importing anything from `web/`.
- Adding routes without a `Match` arm in `router.ts` (and, for the Worker, without the path in `assets.run_worker_first` in `wrangler.jsonc`).
- Using `async/await` in handlers — all handlers are `Effect.gen`.
- Reading `process.env` or Bun/Node APIs in `server/` — the same code runs in workerd. Use `Config` and the `StaticStore`/`FileSystem` services.
- Hand-building envelopes — encode through the `Envelope` schema in `contracts/envelope.ts`.

---

## web/ — React UI Layer

React 19 + effect-atom + Tailwind CSS v4. All state flows through atoms, all rendering flows through pure view model projections.

### State: `atoms/`

| File                       | Role                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime.ts`               | `Atom.runtime(Layer.empty)` — the runtime bridge for atoms that need no services (wordmark loop, syntax highlighter)                                                            |
| `imagined-place.ts`        | Home demo state: `placeControlsAtom` (sent to the server), `placeStageRequestAtom` (never sent), `placeBuildAtom` via its own `placeRuntime` over `ImaginedPlaceClient.Default` |
| `imagined-place-render.ts` | Pure client-side layout of the built place into `PlaceRenderFrame`s, plus trial preview selection                                                                               |
| `docs-data.ts`             | `docsRuntime` over `DocsClient.Default`; `Atom.family` per docs asset for the manifest, module index, exports, guides, search index                                             |
| `docs.ts`                  | Docs UI state (search, navigation drawer, location hash, copied code) and its `Atom.fnSync` setters                                                                             |
| `navigation.ts`            | `pageRouteAtom`, browser history/metadata mount atoms, `navigateAtom`                                                                                                           |
| `element-observation.ts`   | Mount-scoped DOM observation primitives: width handles, ref-cleanup observers, ephemeral element slots                                                                          |
| `text.ts`                  | `makeTextProjectionAtom` / `useTextProjection`: `SemanticText` layout measurement through `effect-text`                                                                         |
| `syntax-highlighting.ts`   | Shiki highlighter loaded once through `appRuntime`                                                                                                                              |
| `wordmark.ts`              | Wordmark morph animation frame atom                                                                                                                                             |
| `theme.ts`                 | Theme preference atom (light/dark/system)                                                                                                                                       |

**Key pattern**: `Atom.fn` atoms receive an `FnContext` (`ctx`) that reads/writes other atoms and runs Effects. Feature state that needs a service builds its own `Atom.runtime` (`placeRuntime`, `docsRuntime`) rather than widening `appRuntime`.

### Services: `services/`

- `ImaginedPlaceClient`: `Effect.Service` with `build`. Encodes the request through `PlaceBuildRequest` and decodes the response through `PlaceBuildEnvelope`.
- `DocsClient`: `Effect.Service` that fetches and decodes the docs manifest and per-page assets.
- `envelopeRequest.ts`: `requestEnvelope` — the only `fetch` call site; maps HTTP and decode failures to `DemoError`.
- `browser-metadata.ts`: applies per-route `<head>` metadata.
- `path.ts`: `PageRoute` parsing and printing (`/` and the `/docs` family).

### Client State Categories

Every client-side value must belong to exactly one category before you choose an atom shape.

- **Durable semantic state**: Stable domain identities that survive remounts and route changes. Use `Atom.make`, `Atom.family(id)`, and `Atom.keepAlive` only when the key is a real semantic identity such as a demo id, run session, pane preference, or theme preference.
- **Derived projection state**: Pure views over durable state. Use read-only derived atoms and let registry TTL reclaim them when idle.
- **Mount-scoped element observation**: Values derived from a live DOM element (`ResizeObserver`, viewport width, rects, visibility, scroll measurements). These live in `web/atoms/element-observation.ts` and must use React 19 ref cleanup plus non-`keepAlive` atom slots created per mount. Never key them by string ids like `useId()` or any other pseudo-identity.

**Rule**: If the source of truth disappears when the element unmounts, the state must disappear with it. Do not promote DOM lifetime into durable app identity.

**Current concrete observers**:

- `SemanticText` block layout measurement (`atoms/text.ts`)
- `PlaceStage` stage viewport width
- `DocsOnThisPage` active-heading tracking

### View: `view/`

| Directory     | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `primitives/` | **All** reusable building blocks: layout (`Stack`, `Cluster`, `Layer`, `Section`), typography (`SemanticText`, `SemanticContent`), code (`CodeBlock`, `code/HighlightedCode`), controls (`TabBar`, `ActionButton`, `ActionControl`, `ChoicePills`, `ToggleSwitch`, `TextAreaField`), feedback (`Skeleton`, `StageBanner`, `StatusPill`, `ChangedValue`), chrome (`SiteHeader`, `SiteFooter`, `ThemeToggle`, `TheoriaLogo`, `WordmarkMorph`). Every visual atom lives here — `home/` and `docs/` compose primitives, never define them. |
| `home/`       | Home page: `HomePage`, `HomeHero`, and the Imagined Place demo (`ImaginedPlaceDemo`, `PlaceComposition`, `PlaceStage`, `PlaceWalk`, `PlaceMarker`, `PlaceProposals`, `PlaceProposalCard`, `PlaceArrangement`, `PlaceSearchTrace`, `PlaceLineage`, `PlaceControls`, `PlaceStepCard`, `PlaceHowItsBuilt`; pure projections in `placeViewModel.ts` and `placeSteps.ts`)                                                                                                                                                                   |
| `docs/`       | Docs pages: `DocsPage` shell, navigation (`DocsNavigation`, `DocsNavigationDrawer`, `DocsPackagePicker`, `DocsOnThisPage`, `DocsSearchDialog`), API views (`ApiPageView`, `ApiExportView`, `ApiMemberView`, `ApiSignatureView`), `GuidePageView`, `DocsRichText`; pure projections in `docsModel.ts`                                                                                                                                                                                                                                   |
| `text/`       | `authority.ts` — `prepareTextProjection` / `projectPreparedText` using `effect-text` with `browserTextLayoutLayer`                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Component Rules

1. Use `SemanticText` for all text rendering — never raw `<p>`, `<h1>`, `<span>` with inline text.
2. Use layout primitives (`Stack`, `Cluster`, `Layer`, `Section`, `Header`) for structure — never raw `<div>` for layout.
3. Components must fill parents: `min-w-0` + `flex-1` in flex containers.
4. All colors from CSS variable theme tokens — never hardcoded hex/rgb.
5. `Match.exhaustive` for all tagged union dispatch in renderers.
6. `ref` is a standard prop (React 19) — never use `forwardRef`.

### Abstraction-First Design (Critical)

**Never hardcode or customize an individual component's theme, layout, or visual design.** Every visual decision must flow through a shared abstraction — a primitive, a contract schema, a theme token, or a CSS variable. If the abstraction you need does not exist, **create or improve the abstraction first**, then use it.

This applies to all concerns:

- **Colors and theming**: Defined by CSS variables in `styles.css` and consumed via `bg-(--var)` / `text-(--var)`. To change a color, change the variable — never add a one-off class or inline style to a single component.
- **Typography**: All text flows through `SemanticText` which reads from `TextRole` contract semantics. To add a new text style, add a `TextRole` and its CSS variable tokens — never style text directly on a component.
- **Spacing and layout**: Controlled by layout primitives and Tailwind utilities composed through props. To change layout behavior, improve the primitive or add a variant to the contract schema (`ContentCardShape`, `ContentCardDensity`) — never add ad-hoc CSS to one component.
- **Component variants**: Driven by contract schemas (`SurfaceVariant`, `CardTone`, `PackageGroup`). To add a visual variant, extend the schema and handle it via `Match.exhaustive` — never branch on a string literal in a single component.
- **Tone/accent mapping**: Managed by `contracts/theme.ts` via `toneForCard`, resolved to `ToneClasses` via `designSystem.ts`. To change how a card looks, update the tone mapping — never put card-specific colors in a view component.

**The test**: If a change touches only one component file and adds a visual property that no other component shares, it is almost certainly wrong. The property should live in a contract, a primitive, or a theme token.

### Composition and Organization

- **One concern per file.** A component that renders evidence and also manages scroll state should be split.
- **Primitives are generic.** `ContentCard`, `CodeBlock`, `TabBar` know nothing about the home demo or the docs — they render whatever contracts give them.
- **View models are the interface.** Components receive contract types or the pure projections in `home/placeViewModel.ts` and `docs/docsModel.ts` — never raw `Result`s from a client atom threaded through several layers.
- **Flat composition over deep nesting.** Prefer composing primitives side-by-side over wrapping them in deep hierarchies. Parent components assemble children — they don't wrap-and-override.
- **240 LOC limit.** Files over 240 lines require a decomposition plan. If a component grows, extract a primitive or a sub-component.

### Anti-patterns

- **Hardcoding visual properties on a single component** — extract to a primitive, contract, or CSS variable.
- **One-off wrapper components** that exist only to override a primitive's style for one use case — improve the primitive instead.
- `useEffect` for subscriptions or side effects — use effect-atom.
- `useState` for domain state — use `Atom.make` at module level.
- Importing anything from `server/`.
- Dynamic Tailwind class construction (`bg-${x}-500`) — use `Match.exhaustive` with literal strings.
- `dark:` utility classes for color theming — CSS variable swap handles dark mode.
- Inline styles for colors — use CSS vars via className: `bg-(--my-var)`.
- Calling `Effect.runPromise` / `Effect.runSync` anywhere except `Atom.runtime`.

---

## Adding an API route

1. Define request and response schemas in `contracts/` and wrap the response in `Envelope(...)`.
2. Add `routes/<name>.ts` returning `HttpServerResponse`, and a `Match.when` arm in `server/router.ts`.
3. Add the path to `assets.run_worker_first` in `wrangler.jsonc` so the Worker, not the asset layer, answers it.
4. Add the client method to the owning `Effect.Service` in `web/services/` and reach it from an atom through that feature's `Atom.runtime`.
5. Cover it in `test/server/` (handler) and `test/worker/site.test.ts` (routing through the real Worker bundle).
