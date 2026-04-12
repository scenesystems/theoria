# Theoria App Requirements

## Purpose

This document is the architectural contract for `apps/theoria/app`.

Its job is to define the target-state structure that all future work must move toward. It is not a snapshot of the current implementation, a workaround catalog, or a design diary. When the current code disagrees with this document, the code is wrong unless an intentional amendment updates this file first.

## North Star

The Theoria app is the proving consumer for the published Theoria packages.

It must present an integrated study system through one coherent architecture.

Entries may spotlight one package, but they are not package sandboxes. Each entry is a product lens over a shared capability stack, and the app should demonstrate how the packages compose together in one real system:

- `contracts/` declares semantic authority.
- `server/` executes authority.
- `web/runtime/` and `web/services/` host browser boundary authority.
- `web/atoms/` orchestrates Effect-backed client workflows.
- `web/state/` defines pure semantic state machines.
- `web/view/` renders pure projections.

The package spotlight on a surface is a lens, not an isolation boundary.

Theoria is not a package showroom. It is a product where users bring real agent systems, traces, workflows, and study problems into one proving environment. Users should be able to import or connect external agent artifacts such as Hugging Face and OpenAgentTrace-derived traces, workflow graphs, prompts, evaluation sets, model routes, and provenance bundles, then inspect, analyze, optimize, render, sign, seal, and share them through one integrated capability stack.

Package names describe implementation substrate, not the product shape. The product shape is the user problem being worked on through an integrated study lens.

Everything belongs to the Effect ecosystem. Not everything should return `Effect<A, E, R>`.

## Canonical Architecture Sentence

Theoria must separate authority, capability, study execution, orchestration, state, and projection so that each concept has one owner, each file has one concern, each runtime boundary is explicit, and each entry remains a thin product lens over shared capabilities rather than a mini-app for one package.

## Dependency Direction

The app has three top-level layers with strict dependency direction:

- `contracts/ -> server/`
- `contracts/ -> web/`
- `server/` never imports from `web/`
- `web/` never imports from `server/`

Within `web/`, the dependency direction is:

- `contracts/ -> web/runtime/`
- `contracts/ -> web/services/`
- `contracts/ -> web/state/`
- `contracts/ -> web/view/`
- `web/runtime/ -> web/atoms/`
- `web/services/ -> web/atoms/`
- `web/state/ -> web/atoms/`
- `web/state/ -> web/view/`
- `web/atoms/ -> web/view/`
- `web/view/` may consume atoms only at the component boundary

Within `server/`, the dependency direction is:

- `contracts/ -> server/config/`
- `contracts/ -> server/kernel/`
- `contracts/ -> server/capability/`
- `contracts/ -> server/adapters/`
- `contracts/ -> server/routes/`
- `contracts/ -> server/study/`
- `server/adapters/` may depend on `server/kernel/`, `server/capability/`, and `server/study/`
- `server/routes/` may depend on `server/kernel/`, `server/adapters/`, and `server/config/`

## Page Family Contract

- Exactly three page families exist in the target state: home, entry, and package docs.
- `EntryRoute` is the only executable page family and resolves to `EntryId` plus typed entry-local inputs.
- Package-backed entries and workflow-backed entries share the same entry page family and page shell.
- `workflow-comparison`, `DeepRoute`, `DeepPagePresentation`, `DeepDivePage`, and package-named executable routes are obsolete migration debt and must not appear in target-state contracts, route-state discriminants, page-category types, or user-visible metadata.
- Page components consume contract-owned route and presentation projections; they must not parse routes themselves or branch on package id for shell composition.

## Architectural Vocabulary

Names are architecture. Each term owns one role.

### Required Terms

- `Entry`: the canonical app-level unit of routing, identity, draft authority, and presentation metadata. An entry is a routeable product lens over a study problem.
- `Study`: the executable proving scenario behind an entry. A study may spotlight one package while composing several capabilities.
- `Capability`: a reusable package-owned substrate that can be used across many studies, such as text layout, numeric computation, study execution, fingerprinting, or inference routing.
- `Capability Availability`: runtime readiness or enablement for a capability or entry. This is not the same thing as the capability itself.
- `Consumer Artifact`: imported study material supplied by the user or an external system, such as agent traces, workflow graphs, prompts, evaluation sets, model routes, or provenance bundles.
- `Workflow Hookup`: the contract and runtime boundary that connects an external workflow, agent, or trace source to Theoria so it can be studied through shared capabilities.
- `Authority`: a source-of-truth relation, not a filesystem grouping. Use it for schema or execution ownership, not for parallel package-shaped app stacks.
- `Descriptor`: authored semantic metadata from which routing, presentation, defaults, and registries derive.
- `Kernel`: shared runtime or execution infrastructure that owns reusable lifecycle, transport, preload, projection, or session machinery.
- `Adapter`: thin entry-specific glue that selects or parameterizes shared kernels without re-hosting them.
- `Registry`: a composition root that collects already-defined descriptors or registrations. A registry does not author feature logic.
- `Runtime`: a boundary-bearing implementation surface that owns services, transport, lifecycle, or projection-driver integration.
- `Surface`: browser-local presentation state and rendering context for one product lens and its study workspace.
- `Workflow`: the executable plan, graph, or coordination program of a study. Every study surface runs a workflow.
- `Projection`: a pure or boundary-driven translation from semantic state into renderable or streamable structure.
- `Evidence`: durable run output, stream events, sections, and projections derived from execution.

### Reserved Terms

- `Entry` names the routeable product lens. It does not mean “one package-owned runtime silo.”
- `Study` names the composed proving program behind an entry.
- `Capability` names reusable package integration reused across studies.
- `Capability Availability` names readiness status only.
- `Consumer Artifact` names imported external study material. It is not ad hoc component state.
- `Workflow Hookup` names the explicit integration boundary for external agents and workflows. It is not a one-off fetch helper.
- `Kernel` names shared infrastructure. It does not mean semantic authority for entry identity.
- `Adapter` names thin glue over shared kernels. It is not a substitute for `study`.
- `Surface` is browser-local only. It must never name server concepts or contract authority.
- `Workflow` means the executable program of a study. It must not be split into a second parallel architectural category beside `study`.

### Drift Words To Remove

- `demo` is a legacy word. It may remain temporarily in existing paths, but no new architectural seam should be named `demo`.
- `deep dive` is obsolete page vocabulary.
- `proving-consumer` is a legacy word.
- `workflow-comparison` is obsolete workflow-study vocabulary.
- `authorities` is not a valid target-state directory concept for the app.
- directory roles named `entry/` or `studies/` are legacy when they actually mean shared infrastructure or thin glue.

### Naming Resolution

The following distinctions are mandatory:

- `entry` means routeable product lens
- `study` means the executable proving scenario behind an entry
- `consumer artifact` means imported external study material
- `workflow hookup` means the explicit connection between an external workflow and the Theoria study system
- `kernel` means shared reusable runtime or execution infrastructure
- `adapter` means thin entry-specific parameterization over shared kernels
- `workflow` means the executable program of a study
- `capability` means reusable package substrate
- `capabilities` in the current codebase is a legacy endpoint name for availability data, not the final architectural noun for the composed capability model

### Legacy Migration Debt

Current code still contains legacy names. Delete them instead of preserving them as compatibility:

- the `workflow` entry id currently names the route for the app's workflow study surface
- stale `workflow-comparison` and `Deep*` names are migration debt to remove from contracts, pages, tests, and metadata rather than aliases to preserve
- `contracts/capabilities.ts` currently models entry availability plus DSP runtime projection, not the full shared capability system
- `server/routes/capabilities.ts` currently reports readiness data, not the full capability composition graph
- current files or plans that say `server/entry`, `web/runtime/entry`, or `*/studies` for thin glue should be read as legacy names pending convergence to `kernel/` and `adapters/`

## Source Of Truth Rules

Every concept must have one authored seed and many derived projections.

### Construction And Projection Ownership

- If the output is a stable semantic value, the owning noun must publish it with `.make(...)`, `.from...(...)`, or `.project(...)`.
- If the output is a running `Stream`, the mechanism noun must publish it with `.stream(...)` or a transport-specific `.from...(...)` constructor.
- Prefer real `Schema.Class`, `Schema.TaggedClass`, `Data.Class`, `Data.TaggedClass`, `Schema.Struct`, or other schema/data owners when a noun carries defaults, projections, or derivation rules.
- Do not introduce raw namespace objects, `make*` helper facades, or compatibility aliases once a canonical noun owner exists. Update downstream consumers to the single source of truth.

### Contract Authority

- Shared types, schemas, tagged errors, default drafts, route descriptors, transport payloads, consumer artifact schemas, and workflow hookup contracts belong in `contracts/`.
- If server and web both need a type or default, it belongs in `contracts/`.
- If a value is persisted, transported, or decoded, it must be schema-owned.

### Entry Authority

- Entry descriptor data is the authored seed for entry identity.
- Routing, presentation metadata, package labels, run labels, and default draft construction must derive from the descriptor family.
- Cards and metadata must be projections of entry authority, not parallel authored registries.

### Capability Authority

- Reusable package integrations must be modeled as shared capabilities, not re-authored inside each entry.
- Capability names should derive from real shared package integrations, not from invented abstract buckets.
- If text rendering is needed, the app should flow through the `effect-text` capability surfaces.
- If numeric or statistical computation is needed, the app should flow through the `effect-math` capability surfaces.
- If study execution, streaming telemetry, optimization, or artifactized trial flow is needed, the app should flow through the `effect-search` capability surfaces.
- If hashing, fingerprints, or stable artifact identity are needed, the app should flow through the `digest` capability surfaces.
- If inference routing or LM workflow execution is needed, the app should flow through `effect-inference` and `effect-dsp` capability surfaces.
- If secure envelope or signing operations are needed, the app should flow through `seal` and `sign` capability surfaces.

Entries may spotlight one package, but the capability stack remains shared.

### Capability Availability Authority

- Availability data belongs to readiness and transport status surfaces.
- Availability answers whether a route or runtime lane is currently enabled.
- Availability must not be confused with the deeper capability model that studies compose.

### Consumer Artifact Authority

- Imported agent traces, workflow graphs, prompts, evaluation sets, model routes, and provenance bundles are first-class study material.
- If consumer-supplied study material is persisted, transported, decoded, or shared between server and web, it must be contract-owned.
- Consumer artifacts must not remain trapped inside package-specific demo payloads, one-off route handlers, or component-local form objects.

### Workflow Hookup Authority

- External workflow hookup is a first-class target-state concept.
- A workflow hookup defines how an outside agent, runtime, trace source, or graph source is connected to Theoria for study and optimization.
- Hookup contracts belong in shared authority, and hookup execution belongs in explicit runtime, service, or server integration boundaries.
- Hookups must not be modeled as ad hoc page wiring or per-entry mini-framework logic.

### Evidence Authority

- Evidence belongs to study semantics.
- Shared evidence protocol belongs in top-level `evidence/` contracts because every study uses the same item, stream, and store protocol.
- Study-specific evidence keys, sections, projections, and interpretation belong under the owning study family such as `study/workflow/evidence/`.
- The rule is: shared protocol at `evidence/`, study meaning at `study/<study>/evidence/`.

### Surface Authority

- Browser-local tab selection, program file selection, layout observation, and active run UI state belong to surface state.
- A surface is the browser workspace for one user problem, coordinating consumer artifacts, study intent, execution controls, evidence, and presentation context.
- Surfaces may host and edit semantic study input, but they must not become the semantic source of truth for consumer artifacts, workflow hookups, or contract-owned defaults.
- Browser-local state must not author contract defaults.

### Workflow Authority

- Every study surface runs a workflow.
- Workflow is the executable program of the study, not a separate sibling domain competing with study.
- Any remaining `workflow-comparison` paths or prose are deletion debt; the live public authority is the single `workflow` study domain.

### Registry Authority

- Registries compose descriptors or registrations.
- Registries do not contain domain execution logic, workflow planning, or one-off transport policy branches.

## Layer Contracts

### `contracts/`

`contracts/` is schema authority and semantic truth.

It owns:

- `Schema.Struct`, `Schema.Union`, `Schema.Literal`, `Schema.TaggedError`
- schema-derived TypeScript types
- pure derivation helpers
- tagged unions and discriminants
- contract-owned defaults
- transport payload shapes
- consumer artifact schemas
- workflow hookup contracts
- evidence contracts

It must not own:

- browser state
- React components
- server routing
- fetch logic
- provider integration
- ad hoc object literals that duplicate schema-owned concepts

Target-state contract subdomains:

```text
contracts/
  entry/
    id.ts
    descriptor.ts
    registry.ts
    routing.ts
    defaults.ts
    focus.ts
  capability/
    registry.ts
    availability.ts
    catalog.ts
    effect-text.ts
    effect-math.ts
    effect-search.ts
    effect-dsp.ts
    effect-inference.ts
    digest.ts
    seal.ts
    sign.ts
  study/
    workflow/
      evidence/
  evidence/
  presentation/
```

### `server/`

`server/` is executable authority.

It owns:

- request handling
- study execution
- shared capability integration
- provider integration
- policy, concurrency, timeouts, and scheduling
- streaming
- capability resolution
- resource lifecycle

It must be aggressively Effect-native. Server behavior should be described directly as `Effect`, `Stream`, `Layer`, and `Service`, not as imperative code wrapped afterward.

### `web/services/`

`web/services/` owns client transport boundaries.

It owns:

- HTTP and SSE clients
- schema decoding
- typed client errors
- browser-side service interfaces

It must not own:

- React rendering
- local component state
- view-model projection

### `web/runtime/`

`web/runtime/` owns browser runtime composition.

It owns:

- kernel registries
- adapter descriptors
- shared capability integration for the browser boundary
- projection-driver boundaries
- surface runtime descriptors
- release-stage runtime wiring
- runtime fingerprints and provenance

This is the client-side home for environment-dependent `Effect<A, E, R>` logic that is not itself an atom.

### `web/atoms/`

`web/atoms/` is the React and Effect bridge.

It owns three kinds of modules:

- pure derived atoms
- runtime-backed atoms
- action atoms for effectful orchestration

Atoms may orchestrate execution. They must not become a dumping ground for domain defaults, rendering logic, or generic utility code with no state role.

### `web/state/`

`web/state/` is pure semantic state.

It owns:

- tagged unions
- reducers
- evidence accumulation
- run state transitions
- local run facts
- pure state projections

It must remain pure. No I/O, no runtime execution, no `runPromise`, no fetch logic.

### `web/view/`

`web/view/` is pure projection and composition.

It owns:

- view models
- presenters
- render-only components
- layout primitives
- evidence presentation

It must not own:

- transport logic
- ad hoc runtime orchestration
- mutation side effects in render
- one-off theme systems bypassing shared abstractions

## Effect-Native Decision Rule

Everything in this app should use the Effect worldview.

That means:

- `Schema` for contracts
- `Data`, tagged errors, `Option`, `Either`, `Match`, `Cause`, `Chunk`, and `Stream` for semantics
- `Layer` and `Service` for dependency ownership
- total, explicit transformations
- no hidden runtime escape hatches

### When A Function Must Return `Effect<A, E, R>`

Return `Effect<A, E, R>` if the function answers yes to any of these:

1. It requires a service, runtime, clock, config, queue, deferred, stream, filesystem, fetch, or provider.
2. It owns interruption, cancellation, cleanup, or resource lifecycle.
3. It encodes execution order, concurrency, scheduling, or streaming semantics.
4. It crosses a transport, parsing, or decoding boundary where typed failure matters.
5. It describes what to do rather than what is true.

### When A Function Must Stay Pure

Keep the function pure if all of these are true:

1. The same input always yields the same output.
2. No environment is required.
3. No execution semantics matter.
4. No resource lifecycle exists.
5. The result is semantic truth, not runtime behavior.

### Pure Is Still Effect-Native

These are valid target-state patterns:

- reducers using `Match.exhaustive`
- projections using `Option` instead of null-heavy branching
- descriptor lookup using `Option` or `Either`
- pure view-model construction from schema-owned inputs

These must not be wrapped in `Effect.succeed(...)` merely for visual uniformity.

### Required Effect Surfaces

These should be modeled as `Effect`, `Stream`, `Layer`, or `Service`:

- HTTP handlers
- fetch clients and SSE setup
- run lifecycle orchestration
- provider capability resolution
- workflow execution
- evaluation pipelines
- projection-driver orchestration
- animation drivers with timing semantics
- any logic using `Clock`, `Queue`, `Deferred`, `Fiber`, `Stream`, `Layer`, or `Service`

## Decomposition Rules

### File Size Limit

No `.ts` or `.tsx` file in `apps/theoria/app` may exceed 240 lines unless a short decomposition comment explains the temporary exception and a follow-up split is actively underway.

Being under 240 lines is not enough. Files must also be single-concern.

### One Concern Per File

Each file must answer one question.

Examples:

- a descriptor family
- a reducer family
- one runtime registration
- one view-model projection
- one primitive component
- one workflow evidence projection family

A file must not mix:

- defaults and runtime orchestration
- descriptor authority and route lookup
- evidence projection and search execution
- React composition and transport logic
- theme tokens and component-specific overrides

### Extraction Rule

When a file grows, split by authority boundary, not by arbitrary helper count.

Preferred split seams:

- authored descriptor data
- pure derivation helpers
- execution pipeline
- lifecycle control
- evidence projection
- view-model projection
- registry composition

## Compression Rules

Duplication is a source-of-truth failure.

The target state requires the following compressions:

### Entry Identity Compression

- One entry descriptor family must author package metadata, routes, labels, and default drafts.
- `card`, `metadata`, and route lookup must derive from that family.

Entry metadata may express a spotlight package or focus, but must not imply exclusive package ownership of the whole entry.

### Draft Compression

- Default draft construction must live in contracts.
- Browser state must consume defaults, never author them.

### Runtime Compression

- Server registrations must be per-entry authored modules.
- Browser runtime descriptors must be per-entry authored modules.
- Top-level registries must only collect those authored modules.

### Kernel Compression

- Shared run lifecycle, preload wiring, stream session semantics, manifest encoding, transport decoding, projection-driver contracts, and diagnostics structure must live in reusable kernels.
- Entry-specific modules may choose or parameterize those kernels, but they must not re-host them.

## Reusable System Constraint

The target state is not one application setup per package.

The app exists to prove reusable package capabilities through one integrated runtime. Package-labeled entries are study lenses, not architectural silos. That means the architecture must be kernel-first and composition-first:

- shared execution kernels
- shared capability integrations
- shared runtime kinds
- shared state machines
- shared evidence transport
- thin authored adapters

The reusable system is product-first. Users bring real workflows into Theoria; Theoria composes shared capabilities around them. The target state is one integrated environment for understanding, evaluating, optimizing, securing, and sharing agent workflows rather than a set of package-isolated demo surfaces.

## Product Lens Principle

An entry is a routeable product lens over a user problem. It may spotlight `effect-text`, `effect-search`, `effect-math`, or another package, but the study behind that entry should still use the shared capability stack wherever appropriate.

Target-state product lenses include integrated experiences such as:

- analyze an imported Hugging Face or OpenAgentTrace workflow
- inspect an agent graph and its execution evidence
- optimize a workflow against an evaluation set
- compare baseline and optimized agent behavior
- render, audit, sign, seal, and share a study artifact
- hook an existing external agent into Theoria and study it through the full capability stack

Examples of the intended direction:

- text shown anywhere in the app should converge on `effect-text`-owned rendering and layout surfaces
- quantitative computation should converge on `effect-math`
- studies, telemetry streams, optimization traces, and artifactized trial flow should converge on `effect-search`
- stable hashing and fingerprints should converge on `digest`

The app should read as one integrated product whose surfaces emphasize different user problems, not as unrelated package demos that happen to share a repository.

An entry may author:

- descriptor metadata
- study focus metadata
- default draft selection
- consumer artifact framing
- workflow hookup framing
- manifest translation
- projection-driver choice
- interactive widget choice
- diagnostics copy

An entry must not re-author:

- capability integration logic that should be shared across studies
- fetch transport plumbing
- SSE transport plumbing
- preload orchestration
- registry composition
- run lifecycle semantics
- evidence-store semantics
- stream session semantics
- generic projection-driver interfaces
- product capability composition that should be shared across lenses

The architectural test is simple:

If adding a new entry would require copying a runtime stack, a server stack, and a browser stack, the architecture is wrong.

If connecting a new external workflow source would require inventing a package-specific mini-app instead of extending shared consumer artifact and workflow hookup authority, the architecture is wrong.

The correct target state is that a new entry usually composes existing capabilities, selects an existing kernel kind, and provides only the authored study differences.

## Shared Kernel Families

The reusable system should converge on a small set of shared kernels.

### Contract Kernels

- entry descriptor schema and registry lookup
- entry kind classification
- study focus derivation
- route and path derivation
- default draft derivation
- capability registry and capability contracts
- evidence transport contracts

### Server Kernels

- fetch-only entry execution
- streaming entry execution
- shared capability services used across studies
- capability availability and readiness reporting
- provider-capability resolution
- preload program loading
- stream-plan execution and session handling
- typed manifest validation

### Browser Runtime Kernels

- fetch runtime kind
- streaming runtime kind
- server-only streaming runtime kind
- projection-driver contract and shared ownership rules
- diagnostics section structure

### Web State And Atom Kernels

- surface state and run state reducers
- evidence accumulation
- run lifecycle orchestration
- shared preload and stream coordination

Only truly unique study logic should remain outside these kernels, such as workflow-specific execution semantics or a projection model that cannot be expressed through shared capability and runtime behavior.

### Evidence Compression

- Shared evidence protocol must be authored once in `evidence/`.
- Workflow-study evidence projections must derive from one workflow evidence family.
- Evidence section keys, labels, and mapping logic must not be re-authored across view files.

### Theme Compression

- Tones, surfaces, badges, buttons, and evidence styling must derive from a shared design-system family.
- No component may introduce one-off color or spacing logic that belongs to a shared theme abstraction.

## Target Directory Topology

The target-state internal shape is:

```text
app/
  contracts/
    entry/
      id.ts
      descriptor.ts
      kind.ts
      registry.ts
      routing.ts
      defaults.ts
      focus.ts
    capability/
      registry.ts
      availability.ts
      catalog.ts
      effect-text.ts
      effect-math.ts
      effect-search.ts
      effect-dsp.ts
      effect-inference.ts
      digest.ts
      seal.ts
      sign.ts
    study/
      workflow/
        evidence/
    evidence/
    presentation/
  server/
    kernel/
      registry.ts
      definition.ts
      capability.ts
      preload.ts
      kinds/
        fetch.ts
        streaming.ts
        workflow.ts
      stream/
        manifest.ts
        plan.ts
        session.ts
    capability/
      registry.ts
      availability.ts
      effect-text.ts
      effect-math.ts
      effect-search.ts
      effect-dsp.ts
      effect-inference.ts
      digest.ts
      seal.ts
      sign.ts
    adapters/
      digest.ts
      effect-dsp.ts
      effect-math.ts
      effect-search.ts
      effect-text.ts
      effect-inference.ts
      seal.ts
      sign.ts
      workflow.ts
    study/
      workflow/
        search/
        evaluation/
        evidence/
  web/
    runtime/
      kernel/
        registry.ts
        descriptor.ts
        kind.ts
        projection-driver.ts
        kinds/
          fetch.ts
          streaming.ts
          server-only-streaming.ts
      capability/
        registry.ts
        availability.ts
        effect-text.ts
        effect-math.ts
        effect-search.ts
        effect-dsp.ts
        effect-inference.ts
        digest.ts
        seal.ts
        sign.ts
      adapters/
        digest.tsx
        effect-dsp.tsx
        effect-math.tsx
        effect-search.tsx
        effect-text.tsx
        effect-inference.tsx
        seal.tsx
        sign.tsx
        workflow.tsx
    services/
    atoms/
      run/
      surface/
      layout/
      workflow/
      evidence/
    state/
      run/
      surface/
      evidence/
    view/
      primitives/
      surfaces/
      study/
        workflow/
      open-agent-trace/
```

This topology is directional guidance. New work must prefer it immediately. Existing files should be migrated toward it opportunistically and whenever adjacent work touches the same authority seam.

The critical constraint is that `adapters/` files are thin authored adapters over shared kernels, not mini-app roots, and `capability/` files are shared package integrations reused across studies.

Capability file names must be grounded in real reusable package integrations. Do not invent placeholder capability families.

## Naming Requirements

### Kernel And Adapter Naming

Target-state browser runtime modules use `kernel/` for shared infrastructure, `capability/` for shared package integration, and `adapters/` for thin per-entry glue.

Examples:

- `web/runtime/kernel/registry.ts`
- `web/runtime/kernel/projection-driver.ts`
- `web/runtime/capability/effect-text.ts`
- `web/runtime/adapters/<entry>.tsx`

No new module should be named `proving-consumer-*`.

### Workflow Naming

Use `study` and `workflow` together, not as competing parallel domains.

- Domain schemas: `study/workflow/...`
- Domain runtime modules: `server/study/workflow/...`
- Domain views: `web/view/study/workflow/...`

Do not use `workflow` as a substitute for entry, runtime, state, or surface.

The only valid target-state uses of `workflow` are:

- the executable program of a study
- the app's workflow study domain
- package concepts that are genuinely named workflow in upstream libraries

`workflow-comparison` is obsolete migration debt and must be deleted from the public route, page, state, and metadata model.

### Capability Naming

Use `capability` for reusable shared package substrate.

Use `availability` for runtime readiness and enablement.

Default to package-grounded capability names such as `effect-text`, `effect-math`, `effect-search`, `effect-dsp`, `effect-inference`, `digest`, `seal`, and `sign`.

Do not invent placeholder capability families like `text`, `math`, `study`, `artifact`, or `crypto` unless they become real shared consumer-facing concepts with multiple concrete owners.

Do not use `capabilities` to mean both the shared substrate model and the readiness endpoint.

### Surface Naming

Use `surface` only for browser-local presentation state, models, atoms, and components.

Valid examples:

- `surface-state.ts`
- `surface-runtime.ts`
- `PresentationSurface.tsx`

Invalid examples:

- server-side surface registries
- contract-owned route descriptors named as surfaces

## Current Convergence Map

The following files are the main structural hotspots and define the first target-state splits.

### `contracts/proving-substrate.ts`

Current issue: mixes catalog data, descriptor construction, unions, routing, defaults, and fingerprinting.

Target split:

- `contracts/capability/catalog.ts`
- `contracts/capability/registry.ts`
- `contracts/capability/availability.ts`
- `contracts/entry/descriptor.ts`
- `contracts/entry/registry.ts`
- `contracts/entry/routing.ts`
- `contracts/entry/defaults.ts`
- `contracts/entry/focus.ts`
- `contracts/entry/fingerprint.ts`

### `web/state/surface-state.ts`

Current issue: mixes state types, reducers, evidence accumulation, runtime facts, telemetry, and default draft ownership.

Target split:

- `web/state/run/session.ts`
- `web/state/run/facts.ts`
- `web/state/run/telemetry.ts`
- `web/state/run/reducer.ts`
- `web/state/evidence/reducer.ts`
- `web/state/surface/defaults.ts` only if the value remains browser-local

Contract-owned default drafts must move to `contracts/entry/defaults.ts` instead.

### `web/atoms/actions.ts`

Current issue: mixes generic run orchestration with workflow-specific draft editing.

Target split:

- `web/atoms/run/control-actions.ts`
- `web/atoms/run/lifecycle-actions.ts`
- `web/atoms/surface/selection-actions.ts`
- `web/atoms/surface/program-source-actions.ts`
- `web/atoms/workflow/draft-actions.ts`

### `server/entries/registry.ts`

Current issue: authors manifest acceptance, per-entry behavior, capability policy, preload wiring, and workflow registration in one composition file.

Target split:

- shared kernels under `server/kernel/`
- shared package integration kernels under `server/capability/`
- thin adapters under `server/adapters/*.ts`
- `server/kernel/registry.ts` as composition only

The goal is not one registration directory per package. The goal is one reusable study runtime system whose entries compose shared capability integrations.

### Legacy `server/workflow-comparison/search-study.ts`

Current issue: mixes search-space definition, selection evaluation, event formatting, study execution, and evidence publication.

Target split:

- `server/study/workflow/search/dimensions.ts`
- `server/study/workflow/search/selection.ts`
- `server/study/workflow/search/study.ts`
- `server/study/workflow/evaluation/variant-execution.ts`
- `server/study/workflow/evidence/search-progress.ts`
- `server/study/workflow/evidence/search-summary.ts`

Delete the legacy `server/workflow-comparison/` family by moving its owned study logic into `server/study/workflow/`.

### `web/view/primitives/designSystem.ts`

Current issue: acts as a style warehouse instead of a navigable abstraction family.

Target split:

- `web/view/primitives/theme/tone.ts`
- `web/view/primitives/theme/surface.ts`
- `web/view/primitives/theme/button.ts`
- `web/view/primitives/theme/badge.ts`
- `web/view/primitives/theme/evidence.ts`
- `web/view/primitives/theme/obstacle.ts`

### `web/runtime/proving-consumer.tsx`

Current issue: target naming is partially adopted but the file still preserves legacy `proving-consumer` vocabulary.

Target split and rename:

- shared kernels under `web/runtime/kernel/`
- shared capability integrations under `web/runtime/capability/`
- thin adapters under `web/runtime/adapters/*.tsx`
- a single registry that composes entry descriptors and adapters over shared runtime kinds

The goal is not one browser runtime stack per entry. The goal is one browser runtime system with shared capability integrations and thin study-specific parameters.

## View And Styling Rules

The app must preserve abstraction-first design.

- text flows through `SemanticText`
- layout flows through layout primitives
- colors flow through shared theme tokens
- component variants flow through schema-backed or design-system-backed abstractions
- render dispatch over tagged unions uses `Match.exhaustive`

No new one-off view wrapper should exist only to override style for a single use case. Improve the primitive or theme abstraction instead.

## Client State Rules

Every client-side value must be classified before implementation.

### Durable Semantic State

Use module-level atoms or atom families for:

- entry identity
- run sessions
- durable user preferences
- semantic workflow drafts

### Derived Projection State

Use pure derived atoms or pure view-model functions for:

- labels
- summaries
- progress projections
- evidence display models

### Mount-Scoped Observation State

Use mount-scoped atom patterns for:

- DOM measurements
- viewport widths
- visibility
- element-bound observers

DOM lifetime must not be promoted into semantic identity.

## Migration Directives

All new work in `apps/theoria/app` must obey these directives:

1. Do not create new files or exports with `demo` or `proving-consumer` architectural naming.
2. Do not add new contract defaults in `web/state/` or `web/atoms/`.
3. Do not add new registry-owned feature logic in current registry hotspots such as `server/entries/registry.ts`, future `server/kernel/registry.ts`, or browser runtime registries.
4. Do not add new files over 240 lines.
5. Do not merge unrelated concerns into an existing hotspot file because it is already large.
6. When touching a hotspot file, prefer extracting one real authority seam rather than adding more internal helpers.
7. When a concept is shared between server and web, move it into `contracts/` before extending it.
8. When a client orchestration path needs environment, timing, cancellation, or streaming semantics, make it a real Effect boundary rather than free-floating plain TypeScript.
9. When logic is purely semantic, keep it pure and model it with Effect-native data types rather than wrapping it in `Effect.succeed`.
10. Do not create per-entry mini-frameworks or mirrored per-package directory trees when the difference can be represented as a thin adapter over a shared kernel.
11. Only create a dedicated per-study domain directory when that study owns unique domain logic that cannot be expressed through the shared entry and capability systems.
12. Delete `workflow-comparison`; do not model `workflow` and `workflow-comparison` as separate first-class architectural categories.
13. Do not use `capabilities` as the architectural name for readiness data and shared package substrate at the same time.
14. Stable semantic values belong to noun-owned `.make(...)`, `.from...(...)`, or `.project(...)` APIs; running streams belong to mechanism-owned `.stream(...)` or transport-specific constructors.
15. Do not introduce raw owner facades or `make*` helper namespaces when a real schema/data owner can carry the behavior.

## Definition Of Done

The app architecture is converging correctly only when all of the following are true:

- every architectural noun has one meaning
- every shared semantic concept has one owner
- every registry is compositional rather than behavioral
- every runtime boundary is explicit
- pure state and view layers remain pure
- effectful orchestration lives in server, services, runtime, and action atoms
- entries are mostly descriptors plus thin adapters over shared capabilities and kernels
- no new file exceeds 240 lines
- large hotspot files trend smaller over time rather than larger

## Acceptance Proof

Run from `apps/theoria/`:

```sh
bun run check
bun run check:tests
bun run lint
bun run test
bun run build
```

## Change Rule

If future work needs to violate this document, update this file first so the architectural contract stays ahead of implementation drift.
