---
description: Source architecture for the theoria app
globs: "**/*.ts, **/*.tsx"
alwaysApply: true
---

# app/ — Target-State Architecture

Build the Theoria app as one integrated study system. Entries are routeable product lenses over shared capabilities, not package demos or mini-app silos.

Dependency direction is strict:

- `contracts/ -> server/`
- `contracts/ -> web/`
- `server/` never imports from `web/`
- `web/` never imports from `server/`

Within `web/`: `contracts/ -> runtime/services/state/view`, `runtime/services/state -> atoms`, `state -> atoms/view`, `atoms -> view`.

Within `server/`: `contracts/ -> config/kernel/capability/adapters/routes/study`, and routes only compose config + kernel + adapters.

## Core Vocabulary

- `Entry`: routeable product lens and presentation identity.
- `Study`: executable proving scenario behind an entry.
- `Workflow`: executable program of a study. The current workflow study is not a separate parallel architecture.
- `Kernel`: shared reusable runtime or execution machinery.
- `Adapter`: thin entry-specific parameterization over kernels.
- `Surface`: browser-local workspace state for one entry.
- `Evidence`: durable run output and projections derived from execution.

Do not introduce new architecture seams named `demo`, `proving-consumer`, or `authorities`.

## contracts/ — Semantic Authority

`contracts/` owns every shared schema, tagged error, default, transport payload, and derivation helper used by both server and web.

Rules:

- Prefer `Schema.Struct`, `Schema.Union`, `Schema.Literal`, and `Schema.TaggedError`.
- Extract types from schemas with `typeof X.Type`.
- If server and web both need a type, default, or parser, move it to `contracts/`.
- Shared evidence protocol belongs under `contracts/evidence/`; workflow-study evidence meaning belongs under `contracts/study/workflow/`.
- Browser-local atoms must not author contract defaults.

Anti-patterns:

- Re-defining shared types in `server/` or `web/`.
- Leaving workflow-study evidence keys or key parsers in view helpers.
- Compatibility files that preserve old nouns instead of moving the canonical owner.

## server/ — Execution and Transport

`server/` executes contract authority through shared kernels and thin adapters.

Rules:

- Routes are composition roots only.
- Split route files by owner seam when they mix decode, startup normalization, policy, and response composition.
- Registries compose already-defined descriptors or definitions; registries do not author feature logic.
- Shared lifecycle, preload, transport, and session logic belongs in `kernel/`.
- Entry-specific glue belongs in `adapters/`.
- Study semantics belong in `study/`.

Anti-patterns:

- Putting transport policy branches into registries.
- Re-hosting shared kernel logic inside one adapter.
- Using web-owned names or concepts in server code.

## web/ — Runtime, Atoms, View

### runtime/

`web/runtime/` owns browser boundary authority: runtime descriptors, projection-driver wiring, transport helpers, and entry adapters.

Rules:

- `kernel/registry.ts` is composition-only.
- Put runtime lookup helpers in focused owner files such as `surface-runtime.ts` or `surface-view.ts`, not back into the registry.
- Adapters provide thin entry-specific runtime configuration and surface hints.

### atoms/

`web/atoms/` orchestrates Effect-backed workflows over contract-owned and state-owned concepts.

Rules:

- No new defaults in `web/atoms/`.
- Durable semantic state only for real semantic identities.
- Mount-scoped DOM observation lives in `element-observation.ts` and disappears on unmount.
- When a hotspot is touched, extract a real owner seam instead of adding another helper.

### state/

`web/state/` owns pure semantic state machines and narrowing logic.

Rules:

- Keep it pure: no runtime I/O, no DOM, no fetch.
- Use exhaustive tagged-union dispatch.
- Do not park compatibility defaults or browser-owned literals here.

### view/

`web/view/` renders pure projections and composes primitives.

Rules:

- Use `SemanticText` for all text.
- Use layout primitives for structure.
- Import visual tokens from the real theme owner files under `view/primitives/theme/`, not a barrel or alias surface.
- View helpers may project evidence, but contract-owned evidence keys and key parsing stay in `contracts/`.
- Files must stay under 240 LOC; split by owner seam when they grow.

Anti-patterns:

- New re-export barrels like `designSystem.ts` or `widget-view-models.ts`.
- View components importing from `server/`.
- Dynamic Tailwind class construction.

## Current Workflow Study Guidance

- Treat `workflow` as the canonical study owner.
- `workflow-comparison` is only a compatibility label still present in some paths; do not add new authority there.
- Shared workflow evidence keys, section keys, and node-execution key parsing belong in `contracts/study/workflow/evidence.ts`.
- Workflow projections, controls, and runtime hints should speak in `workflow` terms unless a comparison-specific domain concept is truly required.

## Adding New Work

1. Start from the target owner seam, not the existing file that happens to compile.
2. Move shared nouns into `contracts/` first.
3. Put reusable execution machinery in `server/kernel/` or `web/runtime/kernel/`.
4. Keep adapters thin.
5. Prove the touched surface with `bun run check` and `bun run lint` from `apps/theoria/`.
