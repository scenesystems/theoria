# Theoria app

The [Theoria website](https://theoria.scenesystems.io/) introduces the packages
in this repository. The home page runs the
[Imagined Place demo](./docs/imagined-place-landing-demo.md), a composition built
on the packages themselves, and `/docs` serves the generated
API reference and guides for every published package.

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

Production configuration is documented separately in the
[deployment guide](./DEPLOYMENT.md).

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
