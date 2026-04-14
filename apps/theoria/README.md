# Theoria App

`apps/theoria` is the browser front door for the Theoria workspace: one place
to run package-backed workflow surfaces, inspect their evidence, and browse the
generated package docs.

It keeps package truth in the packages. The app assembles those contracts,
examples, and docs into pages you can explore without jumping between tools.

## What Is It For?

- Move from the home page into published package stories and runnable entry pages.
- Run workflow surfaces that stream evidence, diagnostics, and artifacts in one UI.
- Browse `/packages` for generated package docs built from README content, docstrings, examples, and release data.
- Refresh those package docs from the repository root with `bun run docs:packages -- --catalog` when doc inputs change.

## Getting Started

From the repository root:

```sh
bun install
bun run app:theoria
bun run app:theoria:tmux
bun run app:theoria:tmux:logs
```

The app server runs at `http://127.0.0.1:3876`. The frontend dev server is
fixed at `http://localhost:5175`. Use `bun run app:theoria` for the normal
foreground loop and the tmux runbook when you want the API and Vite processes
in the background.

If you are iterating on package docs or release metadata, keep the app running
and regenerate the docs inputs from the repository root so `/packages` reflects
the latest README, docstring, and example content.

## What Do I Open First?

- `/` is the home page for package overviews, published stories, and entry links.
- Published entry pages let you run integrated workflow surfaces and inspect the resulting evidence in place.
- `/packages` and `/packages?package=<name>` are the docs views for browsing the generated package guides.

## Development Workflow

```sh
bun run --filter '@theoria/theoria-app' check:all
bun run --filter '@theoria/theoria-app' lint
bun run --filter '@theoria/theoria-app' test
bun run --filter '@theoria/theoria-app' build
```

If you are working on package docs too, rerun `bun run check:readmes` and
`bun run docs:packages -- --catalog` from the repository root.

Use `bun run app:theoria:tmux:logs` when you want the API server and Vite logs
without giving up your shell.

## How Does It Fit The Workspace?

The app stays intentionally thin: entry behavior, package contracts, and most
evidence schemas stay upstream in the packages, while the app focuses on
routing, streaming presentation, and docs browsing.
