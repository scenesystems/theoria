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
- **Tagged errors**: `Schema.TaggedError` with `_tag` discrimination. The `DemoError` union covers `DemoRequestError | DemoDecodeError | DemoExecutionError`.
- **Evidence model**: `EvidenceItem` is a tagged union (`Scalar | Comparison | Series | Table | Text`). New evidence types must be added here and dispatched via `Match.exhaustive` in all consumers.
- **IDs and codes**: `Id` and `ErrorCode` are Schema-refined strings/literals. All valid values are defined once in contracts.

### Anti-patterns

- Defining a type in `server/` or `web/` that should live in `contracts/`.
- Using TypeScript `interface` instead of `Schema.Struct`.
- Duplicating schema refinements (e.g., `NonEmptyString`) — import from the contract that owns it.
- Adding an `EvidenceItem` variant without updating `Match.exhaustive` in `view/presenter.ts`.

---

## server/ — API Layer

Bun HTTP server with Effect-native handlers. No framework router — routing is `Match.value(pathname)` dispatch in `router.ts`.

### Architecture

| File                | Role                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `app.ts`            | Layer composition: `HttpLive` from `ExecutionPolicyLive`, `DspProviderRuntimeLive`, `RuntimeInfoLive`, `BunHttpServer` |
| `router.ts`         | `Match.value(pathname)` dispatch to route handlers. API 404 returns a typed `Failure` envelope.                        |
| `config/runtime.ts` | `RuntimeInfo` service: `buildSha` + `startedAtMs` from `Config` + `Clock`                                              |
| `demos/registry.ts` | `Card → Definition` mapping via `Match.value(card.id)`. Each definition has `execute`, `preload`, `streamElements`.    |
| `demos/executor.ts` | Wraps demo execution with lane-bounded concurrency, timeout, and typed envelope responses                              |
| `demos/policy.ts`   | `ExecutionPolicy` service with `Lane` (`"local"                                                                        | "provider"`), semaphore-bounded concurrency, env-configurable timeouts |
| `routes/*.ts`       | Individual route handlers returning `HttpServerResponse`                                                               |

### Demo Vertical Slice Pattern

Each demo lives in `demos/<package-name>/run.ts` and exports:

- `run`: `Effect.Effect<RunData, unknown, DspProviderRuntime>` — the demo execution
- `preloadProgram`: `Effect.Effect<Program, unknown, never>` — source code preview
- `streamElements` (optional): `Stream.Stream<StreamElement>` — SSE evidence stream (sections + choreography cues)

Register in `registry.ts` via `makeDefinition(card, lane, execute, preload, streamElements)`.

### Anti-patterns

- Importing anything from `web/`.
- Adding routes without a `Match` arm in `router.ts`.
- Using `async/await` in handlers — all handlers are `Effect.gen`.
- Bypassing `ExecutionPolicy` for demo execution.
- Constructing envelopes without `successEnvelope` / `failureEnvelope` from `executor.ts`.

---

## web/ — React UI Layer

React 19 + effect-atom + Tailwind CSS v4. All state flows through atoms, all rendering flows through pure view model projections.

### State: `atoms/`

| File                                                              | Role                                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `runtime.ts`                                                      | `Atom.runtime(DemoClient.Default)` — the single Effect runtime bridge                                      |
| `surface.ts`                                                      | `Atom.family` per demo ID: `surfaceAtom`, `surfaceRunDataAtom`, `surfaceEvidenceStreamAtom`                |
| `actions.ts`                                                      | `appRuntime.fn` / `Atom.fnSync` action atoms: `runDemoAtom`, `selectStageTabAtom`, `selectProgramFileAtom` |
| `internal.ts`                                                     | `modifySurface`, `preloadSurface` — internal helpers consumed by `actions.ts` only                         |
| `element-observation.ts`                                          | Mount-scoped DOM observation primitives: width handles, ref-cleanup observers, ephemeral element slots     |
| `animation.ts`, `optimization-animation.ts`, `power-animation.ts` | Per-demo animation streams driven by `Atom.fn` context                                                     |
| `evidence-stream.ts`                                              | SSE evidence stream atom for live server-sent updates                                                      |
| `theme.ts`                                                        | Theme preference atom (light/dark/system)                                                                  |

**Key pattern**: `Atom.fn` atoms receive an `FnContext` (`ctx`) that reads/writes other atoms and runs Effects. `modifySurface(ctx, id, fn)` is the only way to update surface state.

### Services: `services/`

- `DemoClient`: `Effect.Service` with `run`, `preload`, `streamUrl` methods. Uses `Schema.decodeUnknown` for envelope validation. This is the only network boundary.
- `path.ts`: Route path utilities.

### State Machine: `state/`

- `SurfaceState`: full state per demo surface (preload, run, stage tab, program file index).
- `RunState`: tagged union (`RunIdle | RunRunning | RunSuccess | RunFailed`).
- `reduceRunState`: pure state transition function for the run state machine.

### Client State Categories

Every client-side value must belong to exactly one category before you choose an atom shape.

- **Durable semantic state**: Stable domain identities that survive remounts and route changes. Use `Atom.make`, `Atom.family(id)`, and `Atom.keepAlive` only when the key is a real semantic identity such as a demo id, run session, pane preference, or theme preference.
- **Derived projection state**: Pure views over durable state. Use read-only derived atoms and let registry TTL reclaim them when idle.
- **Mount-scoped element observation**: Values derived from a live DOM element (`ResizeObserver`, viewport width, rects, visibility, scroll measurements). These live in `web/atoms/element-observation.ts` and must use React 19 ref cleanup plus non-`keepAlive` atom slots created per mount. Never key them by string ids like `useId()` or any other pseudo-identity.

**Rule**: If the source of truth disappears when the element unmounts, the state must disappear with it. Do not promote DOM lifetime into durable app identity.

**Current concrete observers**:

- `SemanticText` block layout measurement
- `ReflowPreview` stage viewport width
- `PresentationSurface` projection workspace width

### View: `view/`

| Directory         | Role                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `presenter.ts`    | Pure projection: `RunData → PresentedRun`. Maps `EvidenceItem` variants to `EvidenceRow` via `Match.exhaustive`.                                                                                                                                                                                                                                                                                                                                                                 |
| `surfaceModel.ts` | Pure projection: `SurfaceState → SurfaceViewModel`. No side effects, no atoms.                                                                                                                                                                                                                                                                                                                                                                                                   |
| `primitives/`     | **All** reusable building blocks: layout (`Stack`, `Cluster`, `Layer`, `Section`), typography (`SemanticText`), data display (`MetricCard`, `MetricPill`, `ComparisonBar`, `Sparkline`, `DataTable`, `EvidenceItemRenderer`), controls (`SliderRow`, `TabBar`, `TabButton`, `ActionButton`), feedback (`Skeleton`, `StageBanner`), chrome (`SiteHeader`, `SiteFooter`, `ThemeToggle`). Every visual atom lives here — `deep/` and `home/` compose primitives, never define them. |
| `home/`           | Home page compositions: `HomePage`, `HomeHero`, `PackageCard`, `PackageSection`                                                                                                                                                                                                                                                                                                                                                                                                  |
| `deep/`           | Deep dive page compositions: `DeepDivePage`, `DemoStage`, `EvidenceSections`, interactive widgets (`LiveReflow`, `LiveOptimization`, `LivePowerExplorer`)                                                                                                                                                                                                                                                                                                                        |
| `containers/`     | `Grid`, `Pane` — layout containers with scroll and grid layout from contract schemas                                                                                                                                                                                                                                                                                                                                                                                             |
| `surfaces/`       | `PresentationSurface` — the unified surface component consuming view models                                                                                                                                                                                                                                                                                                                                                                                                      |
| `text/`           | `authority.ts` — `projectText` using `effect-text` with `browserTextLayoutLayer`                                                                                                                                                                                                                                                                                                                                                                                                 |

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
- **Spacing and layout**: Controlled by layout primitives and Tailwind utilities composed through props. To change layout behavior, improve the primitive or add a variant to the contract schema (`GridLayout`, `ContentCardDensity`) — never add ad-hoc CSS to one component.
- **Component variants**: Driven by contract schemas (`SurfaceVariant`, `CardTone`, `PackageGroup`). To add a visual variant, extend the schema and handle it via `Match.exhaustive` — never branch on a string literal in a single component.
- **Tone/accent mapping**: Managed by `theme.ts` via `toneForCard` and `representativeToneFor`, resolved to `ToneClasses` via `designSystem.ts`. To change how a card looks, update the tone mapping — never put card-specific colors in a view component.

**The test**: If a change touches only one component file and adds a visual property that no other component shares, it is almost certainly wrong. The property should live in a contract, a primitive, or a theme token.

### Composition and Organization

- **One concern per file.** A component that renders evidence and also manages scroll state should be split.
- **Primitives are generic.** `ContentCard`, `MetricCard`, `DataTable`, `Sparkline` know nothing about specific demos — they render whatever contracts give them.
- **View models are the interface.** Components receive `SurfaceViewModel`, `PresentedRun`, or contract types — never raw atoms or `SurfaceState`. The `presenter.ts` and `surfaceModel.ts` pure projections are the boundary.
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

## Adding a New Demo

1. Add a `Card` entry in `contracts/card.ts` with all required metadata fields.
2. Create `server/demos/<name>/run.ts` exporting `run`, `preloadProgram`, and optionally `streamElements`.
3. Add the `Match.when` arm in `server/demos/registry.ts` → `definitionForCard`.
4. If the demo needs a client-side animation, add a `Match.when` arm in `web/atoms/actions.ts` → `animationEffectFor`.
5. If the demo adds a new `EvidenceItem` variant, update `contracts/evidence.ts` and all `Match.exhaustive` consumers (`view/presenter.ts`, evidence renderers in `view/deep/evidence/`).
