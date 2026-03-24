# docs/ — Theoria API Reference Site

Jekyll-based API documentation site using the [Just the Docs](https://just-the-docs.com/) theme.

## Theme Configuration

`_config.yml` declares **both** `theme:` and `remote_theme:`:

- `theme: just-the-docs` — used locally via the Docker preview (gem installed from `Gemfile`)
- `remote_theme: just-the-docs/just-the-docs` — used in CI by `actions/jekyll-build-pages@v1` (loaded via the `jekyll-remote-theme` plugin bundled in the `github-pages` gem)

Both must be present. Do not remove either.

## Tracked vs Generated Content

**Tracked** (committed to git):

- `_config.yml` — Jekyll configuration
- `_includes/` — custom footer and nav footer overrides
- `_sass/color_schemes/scene.scss` — Scene Systems ocean teal dark theme
- `Dockerfile`, `Gemfile`, `Gemfile.lock` — local preview infrastructure

**Generated** (gitignored, created at build time):

- `_effect/`, `_scenesystems/` — collection directories populated by `scripts/docs.mjs`
- `index.md` — root landing page
- `_site/`, `.jekyll-cache/` — Jekyll build output

Never manually edit generated content. Modify `scripts/docs.mjs` instead.

## Build Pipeline

1. `bun run docgen` — runs `@effect/docgen` per-package, outputs to `packages/*/docs/modules/`
2. `node scripts/docs.mjs` — aggregates docgen output into `docs/_effect/` and `docs/_scenesystems/`
3. Jekyll builds the final site from `docs/`

The aggregation script (`scripts/docs.mjs`) performs:

- Hierarchical nav page creation (package → directory → module)
- Frontmatter rewriting (`parent`/`grand_parent` for Just the Docs nav trees)
- Ambiguous directory name disambiguation across packages via `grand_parent`
- Pure barrel file filtering (re-export-only `index.ts` files are excluded)
- "View source" link injection pointing to GitHub source
- Package landing pages populated from each package's `README.md`

## Local Preview

```sh
bun run docs:preview
```

This runs docgen, the aggregation script, builds a Docker image from `docs/Dockerfile` (Ruby 3.3 + Jekyll 4.4 + just-the-docs gem), and serves at `http://localhost:4000`.

## CI Workflow

`.github/workflows/pages.yml` — triggers on push to `main`, PRs, and manual dispatch:

- Runs `bun run docgen` and `node scripts/docs.mjs`
- Builds with `actions/jekyll-build-pages@v1` (uses `remote_theme` from `_config.yml`)
- Deploys to GitHub Pages on `main`; uploads a `docs-preview` artifact on PRs

## Custom Styling

`_sass/color_schemes/scene.scss` defines the `scene` color scheme (dark mode, ocean teal palette). The color values are derived from `@scene/theme`. Reference `color_scheme: scene` in `_config.yml`.

## Adding a New Package

1. Add an entry to the `PACKAGES` array in `scripts/docs.mjs`: `[dirName, displayName, navOrder, collection]`
2. The `collection` must be either `"effect"` or `"scenesystems"` (matching the collections in `_config.yml`)
3. Ensure the package has a `docgen` script in its `package.json`
