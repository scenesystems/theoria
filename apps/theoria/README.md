# Theoria app

The [Theoria website](https://theoria.scenesystems.io/) introduces the packages
in this repository. The home page runs the Imagined Place demo, a small
composition built on the packages themselves, and `/docs` serves the generated
API reference and guides for every published package.

Press a mark in the demo to read its answer. Answers stay within the viewport
and avoid the discs, including their invisible touch targets. Long answers
scroll internally; their prose remains selectable and their links stay active.
If there is no free reading region at least 96px high at the answer's width,
the answer still opens, covering the fewest discs and preferring those farther
from the pressed mark. Press Escape or outside the answer to reach a covered
disc. This last-resort placement is exposed as `data-answer-placement="fallback"`;
unobstructed placements use `"free"`.

## Run it locally

From the repository root:

```sh
bun run app:theoria
```

The app listens on `http://127.0.0.1:3876` by default. Set `PORT` to use a
different port. No provider keys or other secrets are needed: the demo runs
entirely on deterministic local computation.

Production configuration is documented separately in the
[deployment guide](./DEPLOYMENT.md).

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

- `server.ts` serves the app with Bun; `worker.ts` serves the same app as a
  Cloudflare Worker.
- `app/contracts` defines the schemas shared by the server and browser: the
  package cards, docs routes, the Imagined Place request and result, the
  response envelope, and the text and theme tokens.
- `app/server` serves static assets and the typed API: health, version,
  sitemap, and `POST /api/imagined-place/build`.
- `app/web` contains the React views and core Effect reactivity state, with
  `@effect/atom-react` bindings, for the home page and the docs pages.

## Verify changes

From the repository root:

```sh
bun run --filter '@theoria/theoria-app' check:all
bun run --filter '@theoria/theoria-app' lint
bun run --filter '@theoria/theoria-app' test
```

`bun run --filter '@theoria/theoria-app' test:worker` runs the built Worker in
workerd and Chromium; it needs `build:web` and `deploy:dry-run` first.
