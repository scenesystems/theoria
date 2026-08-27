# Theoria app

The [Theoria website](https://theoria.scenesystems.io/) is a small, working
tour of the packages in this repository. Each demo calls a real package API
and renders the same typed result or failure that an application would receive.

## What it demonstrates

| Demo            | What it shows                                                                |
| --------------- | ---------------------------------------------------------------------------- |
| `effect-text`   | Effectful text preparation followed by reusable, pure layout projections.    |
| `effect-search` | A seeded optimization study with progress and reproducible results.          |
| `effect-math`   | Mathematical operations with explicit inputs and typed domain failures.      |
| `effect-dsp`    | A language-model program running through a configured `@effect/ai` provider. |

The first three demos run without an external service. The `effect-dsp` demo
is enabled only when the server has a valid provider configuration.

## Run it locally

From the repository root:

```sh
bun run app:theoria
```

The app listens on `http://127.0.0.1:3876` by default. Set `PORT` to use a
different port.

To exercise the provider-backed demo, copy [`.env.example`](../../.env.example)
to the ignored `.env` file, choose `DSP_PROVIDER`, and fill in only the matching
provider key. Never place a provider key in a `VITE_*` variable; those values
are included in browser code.

Production configuration and secret placement are documented separately in
the [deployment guide](./DEPLOYMENT.md).

## Development workflow

The repository includes a tmux runbook for working on the server and Vite
frontend together:

```sh
bun run app:theoria:tmux
bun run app:theoria:tmux:logs
bun run app:theoria:tmux:logs:full
bun run app:theoria:tmux:stop
```

`THEORIA_PORT` changes the app port and `THEORIA_TMUX_SESSION` selects the tmux
session. The frontend development server uses port `5175`.

## How it is organized

- `server.ts` launches the application server.
- `app/contracts` defines the request, response, health, version, capability,
  and demo schemas shared by the server and browser.
- `app/server` serves static assets and the typed API. Its demo modules own
  execution limits and provider composition.
- `app/web` contains the React views and `@effect-atom/atom` state used by the
  demo cards and detail pages.

## Verify changes

From the repository root:

```sh
bun run --filter '@theoria/theoria-app' check:all
bun run --filter '@theoria/theoria-app' lint
bun run --filter '@theoria/theoria-app' test
```
