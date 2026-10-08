# Theoria app

The [Theoria website](https://theoria.scenesystems.io/) contains the package
guides and API reference under `/docs`. Its home page demonstrates the libraries
with [Imagined Place](./docs/imagined-place-landing-demo.md), which lays out a
description around a drawing and lets readers accept signed proposals for changes.

Press a mark in the demo to read its answer. Answers stay within the viewport
and avoid the discs, including their invisible touch targets. Long answers
scroll internally; their prose remains selectable and their links stay active.
If there is no free reading region at least 96px high at the answer's width,
the answer still opens, covering the fewest discs and preferring those farther
from the pressed mark. Press Escape or outside the answer to reach a covered
disc. This last-resort placement is exposed as `data-answer-placement="fallback"`;
unobstructed placements use `"free"`.

## Run it locally

Install dependencies from the repository root with `bun install`, then start
the API server:

```sh
bun run app:theoria
```

In another terminal, run `bun run dev:web` from `apps/theoria` and open
`http://localhost:5175`. Vite serves the frontend and proxies API requests to
the Bun server on port `3876`. The Bun server alone serves the API and any
existing web build; it does not start Vite.

Set `PORT` for the API server and the matching `THEORIA_PORT` for Vite to use
another backend port. No provider keys are needed for the local demo.

For production configuration, see the [deployment guide](./DEPLOYMENT.md).

## Development workflow

From an active local tmux session, the repository can run both servers together:

```sh
bun run app:theoria:tmux
bun run app:theoria:tmux:logs
bun run app:theoria:tmux:logs:full
bun run app:theoria:tmux:stop
```

`THEORIA_PORT` changes the app port and `THEORIA_TMUX_SESSION` selects the tmux
session. The frontend development server uses port `5175`.

In an Amp orb, run `amp orb services ensure` from the repository root instead.
The checked-in service configuration starts both servers and returns the docs
portal URL.

## Edit documentation

Run `bun run docs` from the repository root after changing package READMEs or
public TSDoc. It typechecks README examples and regenerates guides, API pages,
navigation, and search data. Reload the affected `/docs` pages in Vite to review
them; Markdown changes are not watched automatically.

The [generator](../../scripts/api-reference/) converts Markdown and TypeDoc into
the [shared documentation model](../../packages/docs-model/src/docs-data.ts),
which the [docs views](./app/web/view/docs/) render. Edit the source README or
TSDoc rather than generated files under `public/docs-data`.

## Directory structure

- `server.ts` serves the app with Bun; `worker.ts` serves the same app as a
  Cloudflare Worker.
- `app/contracts` defines shared schemas, including docs routes and the Imagined
  Place request and result.
- `app/server` handles API requests and serves static assets.
- `app/web` contains React views and Effect reactivity state, connected through
  `@effect/atom-react`.

## Verify changes

From the repository root:

```sh
bun run --filter '@theoria/theoria-app' check:all
bun run --filter '@theoria/theoria-app' lint
bun run --filter '@theoria/theoria-app' test
```

`bun run --filter '@theoria/theoria-app' test:worker` runs the built Worker in
workerd and Chromium; it needs `build:web` and `deploy:dry-run` first.
