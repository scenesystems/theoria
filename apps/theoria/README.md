# Theoria App

`apps/theoria` is a single live surface for running real package APIs directly.

It is intentionally minimal:

1. No showcase/lab/catalog route taxonomy.
1. No command-documentation cards.
1. Four executable demo cards (`effect-text`, `effect-search`, `effect-math`, `effect-dsp`).
1. Typed request/response contracts and Effect-native runtime state.

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

## Production Environment

Configure the deployed app in **Railway → Theoria service → Variables → production**. For the current OpenAI deployment, set:

| Name                          | Value                          | Treatment              |
| ----------------------------- | ------------------------------ | ---------------------- |
| `DSP_PROVIDER`                | `openai`                       | Plain runtime variable |
| `DSP_PROVIDER_MODEL`          | `gpt-4o-mini`                  | Plain runtime variable |
| `OPENAI_API_KEY`              | A fresh project-scoped API key | Sealed secret          |
| `THEORIA_PROVIDER_TIMEOUT_MS` | `120000`                       | Plain runtime variable |

The provider defaults are two concurrent requests and four requests per client per minute. Override them only when the provider account has matching limits:

```text
THEORIA_PROVIDER_CONCURRENCY=2
THEORIA_PROVIDER_REQUESTS_PER_MINUTE=4
```

Railway supplies `PORT`, `RAILWAY_ENVIRONMENT_NAME`, and `RAILWAY_GIT_COMMIT_SHA`; do not duplicate them. If the Railway environment is not literally named `production`, set `NODE_ENV=production`.

Use exactly one provider-key path. For OpenAI, leave `DSP_PROVIDER_API_KEY`, `ANTHROPIC_API_KEY`, and `OPENROUTER_API_KEY` unset. Remove stale values rather than setting a second key. Provider-specific keys take precedence, while blank provider-specific values fall back safely.

Do not put runtime provider keys in GitHub Actions secrets, repository variables, `VITE_*` variables, or committed files. For local testing, copy the repository-root `.env.example` to the ignored `.env` file and set the selected provider key there.

## Architecture

1. `server.ts` is a thin entrypoint that launches `app/server/app.ts`.
1. `app/contracts/*` is the schema authority for IDs, envelopes, demo payloads, health/version, and capabilities.
1. `app/server/router.ts` owns route composition for static shell/modules and typed API endpoints.
1. `app/server/demos/*` implements registry-driven vertical slices, bounded execution policy, and live DSP provider composition.
1. `app/web/atoms/*` keeps `@effect-atom/atom` as the sole state authority. `Atom.fn` atoms handle orchestration (preload-before-run, sequence guards). `DemoClient` is an `Effect.Service` wired through `Atom.runtime`.
1. `app/web/view/*` projects contracts + run state to the single live card surface.
1. `app/web/main.tsx` routes `/demos/:id` into deep dive pages, rendered from the same typed contracts as the home cards.

## Verification

```sh
bun run --filter '@theoria/theoria-app' check:all
bun run --filter '@theoria/theoria-app' lint
bun run --filter '@theoria/theoria-app' test
```
