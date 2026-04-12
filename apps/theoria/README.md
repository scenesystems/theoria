# Theoria App

`apps/theoria` is the proving consumer for the Theoria packages: one integrated study system composed from shared capabilities, typed workflow evidence, and routeable entry lenses.

It also projects source-linked package documentation at `/packages`, backed by
the root-owned `bun run docs:packages` corpus rather than app-local markdown
copies.

It is intentionally minimal:

1. No showcase, lab, or package-showroom taxonomy.
1. No entry-local mini-app stacks or hidden compatibility layers.
1. Exactly three page families: home, entry, and package docs.
1. Routeable entries stay thin over shared capabilities, kernels, and workflow study seams.
1. Typed contracts, streaming evidence, and Effect-native runtime state drive every surface.

## Start

From repository root:

```sh
bun run app:theoria
```

Default URL: `http://127.0.0.1:3876`.

Frontend dev server URL: `http://localhost:5175`.

Override port:

```sh
PORT=3888 bun run app:theoria
```

## tmux Runbook

From repository root:

```sh
bun run app:theoria:tmux
bun run app:theoria:tmux:logs
bun run app:theoria:tmux:logs:full
bun run app:theoria:tmux:stop
```

The tmux runbook always starts Vite on `http://localhost:5175`.

Environment knobs:

1. `THEORIA_PORT` for app port.
1. `THEORIA_TMUX_SESSION` for tmux session selection.

Runtime knobs:

1. `BUILD_SHA` for version/envelope metadata.
1. `THEORIA_LOCAL_CONCURRENCY` / `THEORIA_PROVIDER_CONCURRENCY` for bounded execution lanes.
1. `THEORIA_LOCAL_TIMEOUT_MS` / `THEORIA_PROVIDER_TIMEOUT_MS` for per-lane timeout policy.
1. `DSP_PROVIDER`, `DSP_PROVIDER_MODEL`, and provider API keys for live `effect-dsp` execution.

## Architecture

1. `server.ts` is a thin entrypoint that launches `app/server/app.ts`.
1. `app/contracts/*` is the semantic authority for entry identity, shared capability contracts, workflow evidence, consumer artifacts, workflow hookup, and transport envelopes.
1. `app/server/router.ts` owns route composition only; execution lives under `app/server/kernel/*`, `app/server/adapters/*`, and `app/server/study/*`.
1. `app/server/study/workflow/*` is the canonical workflow-study owner seam; any remaining `workflow-comparison` mentions are deletion debt, not an architecture lane.
1. `app/server/routes/package-docs.ts` is a thin HTTP adapter over the root-owned package-doc query engine from `@theoria/source-proof`.
1. `app/web/atoms/*` keeps `@effect-atom/atom` as the sole orchestration layer; atoms compose contract-owned defaults and state-owned transitions rather than authoring semantic literals.
1. `app/web/view/*` projects contracts plus run state into entry surfaces and the `/packages` documentation route.
1. `app/web/App.tsx` resolves entry routes through contract-owned presentation paths rather than package-demo routing or deep-route aliases.

## Package Docs

From repository root:

```sh
bun run docs:packages -- --catalog
bun run docs:packages -- --package effect-search --view agent
```

In the app, open `http://127.0.0.1:3876/packages` or follow the `Docs` link on
any package card.

## Verification

```sh
bun run --filter '@theoria/theoria-app' check:all
bun run --filter '@theoria/theoria-app' lint
bun run --filter '@theoria/theoria-app' test
```
