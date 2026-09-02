# Deploying the Theoria app

This runbook is for maintainers of the public Theoria website. Local users do
not need any of this configuration unless they want to run the provider-backed
`effect-dsp` demo.

The site is moving from Railway to Cloudflare Workers. The Cloudflare setup
below is the target. The Railway section at the end stays valid until the DNS
cutover and is then removed together with the `RAILWAY_*` fallbacks in
`app/server/config`.

## Cloudflare Workers

One Worker script, [`worker.ts`](./worker.ts), serves the API, the HTML shell
with per-route metadata, and the built web bundle in `dist/` as static assets.
[`wrangler.jsonc`](./wrangler.jsonc) declares three targets:

| Target     | Worker name       | Hostname                                 | `RELEASE_STAGE` |
| ---------- | ----------------- | ---------------------------------------- | --------------- |
| production | `theoria`         | `theoria.scenesystems.io`                | `production`    |
| staging    | `theoria-staging` | `theoria.staging.scenesystems.io`        | `production`    |
| preview    | `theoria-pr-<N>`  | `theoria-pr-<N>.staging.scenesystems.io` | `preview`       |

Staging mirrors the production surface (catalog only, demo routes return
`404`) so it is a faithful rehearsal. Previews enable the `preview` surface.
Every hostname other than `theoria.scenesystems.io` is served with
`X-Robots-Tag: noindex`: the Worker adds it to its own responses
(`app/server/indexing-policy.ts`) and [`public/_headers`](./public/_headers)
adds it to assets served directly from the edge.

### Request routing

Cloudflare serves a matching file from `dist/` directly, without invoking the
Worker, unless the path is listed in `assets.run_worker_first`. That list
covers the HTML shell (`/`, `/index.html`, `/docs`, `/docs/*`, `/demos/*`),
`/api/*`, `/sitemap.xml`, and the generated `/runtime-data/*` files, which the
Worker reads through the `ASSETS` binding but never exposes. Paths with no
matching asset (docs pages, demo pages, unknown URLs) fall through to the
Worker. `test/server/wrangler-config.test.ts` fails when the list and
`app/server/routes/static.ts` disagree.

Cache lifetimes for directly served assets come from `public/_headers`;
lifetimes for Worker responses come from `cacheControlForPath`. Cloudflare
compresses responses at the edge, so the Cloudflare build does not emit `.gz`
sidecars (`bun run build:web`); the Bun server build keeps them
(`bun run build:bun`).

### Variables and secrets

`RELEASE_STAGE` is declared per target in `wrangler.jsonc` and is authoritative.
`BUILD_SHA` is passed at deploy time (`--var BUILD_SHA:<sha>`) and surfaces as
`meta.buildSha` in API responses. Neither production nor staging needs a
provider key. The Worker exposes every string binding to Effect `Config`, so
any variable documented in [`.env.example`](../../.env.example) can be set as a
Wrangler `var` (plain) or `secret` (encrypted). Use `wrangler secret put` for
credentials; never put them in `vars` or in `.dev.vars` files that are
committed.

### Local commands

```sh
bun run build:web        # docs assets, runtime data, vite build → dist/
bun run deploy:dry-run   # bundle worker.ts for workerd without deploying
bun run preview:worker   # build, then serve production config with wrangler dev
bunx wrangler dev --env staging   # or --env preview; assumes dist/ is built
```

`wrangler dev` presents the target's route hostname to the Worker, so the
production config appears indexable locally while `--env staging` and
`--env preview` return `noindex`.

## Automated deployments

The [Theoria workflow](../../.github/workflows/theoria.yml) builds the site once
per commit (`bun run build:web`, then `wrangler deploy --dry-run` to bundle
`worker.ts` for workerd), checks the output with
[`theoria-build-check`](../../.github/actions/theoria-build-check/action.yml),
and uploads `dist/` and `.wrangler-out/` as the artifact `theoria-<sha>`. Every
deployment then uploads that exact artifact with `wrangler deploy --no-bundle`,
so staging, production, and previews serve byte-identical builds of a commit.

| Event                   | Job        | Target                                          |
| ----------------------- | ---------- | ----------------------------------------------- |
| pull request            | Build      | artifact only, no credentials                   |
| `workflow_run` of Build | PR Preview | `theoria-pr-<N>.staging.scenesystems.io`        |
| pull request closed     | Remove     | deletes `theoria-pr-<N>`                        |
| push to `main`          | Staging    | `theoria.staging.scenesystems.io`               |
| push to `main` (gated)  | Production | `theoria.scenesystems.io`, after Staging passes |

Each deployment ends with
[`theoria-verify-deployment`](../../.github/actions/theoria-verify-deployment/action.yml),
which polls `/api/health/live` until `meta.buildSha` matches the commit and then
runs the checklist below against the live hostname.

The [preview workflow](../../.github/workflows/theoria-preview.yml) runs from
trusted `main` on `workflow_run`. It confirms the pull request is still open at
the artifact's head revision before downloading the artifact and again before
deploying, re-checks the artifact, and deploys it with the `wrangler.jsonc` from
`main` (a pull request that changes `wrangler.jsonc` sees that change only after
merge). Pull request code never runs with Cloudflare credentials, and pull
requests from forks are not previewed. Updating a pull request replaces its
preview; closing it deletes the Worker and its managed DNS record. The Advanced
Certificate Cloudflare issued for the preview hostname is not deleted
automatically; prune them under **SSL/TLS → Edge Certificates** occasionally.

### Cloudflare account and token

1. `scenesystems.io` must be an active zone in the Cloudflare account, and the
   account needs the Workers Paid plan (`limits.cpu_ms` above the Free plan
   default).
2. Create an API token from the **Edit Cloudflare Workers** template and
   restrict it to this account and the `scenesystems.io` zone. That template
   covers Workers Scripts, Workers Routes, and the zone DNS access Wrangler needs
   to attach Custom Domains.
3. Record the account ID from the dashboard.

### GitHub environments

In **Settings → Environments**, create `staging` and `production`. Add
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as environment secrets to
both. Restrict both environments to the `main` deployment branch so a workflow
edited on a pull request cannot request either environment's secrets. Leave
`staging` without required reviewers so previews and merged changes deploy
automatically; add required reviewers to `production` so every release waits
for approval after staging has been verified.

### Manual deploy

To deploy by hand with the same token:

```sh
bun run build:web
bunx wrangler deploy --env staging --var BUILD_SHA:"$(git rev-parse HEAD)"
bunx wrangler deploy --env ""      --var BUILD_SHA:"$(git rev-parse HEAD)"
```

The deploy commands change Cloudflare routing; run them only as an approved
release action. Verify a deployment in this order:

1. `GET /api/health/live` returns `200`.
2. `GET /api/health/live` reports `meta.buildSha` equal to the deployed commit.
3. `GET /api/capabilities` returns an empty `demos` array on production and
   staging.
4. A production demo page and demo API request both return `404`.
5. `GET /docs/<package>` returns `200` with a package-specific `<title>`; an
   unknown docs path returns `404` with the HTML shell.
6. On staging and previews only, every response carries
   `X-Robots-Tag: noindex`.

## Provider configuration for previews

Provider credentials are needed only for a preview that exercises the
`effect-dsp` demo. Set them on the preview Worker, not on production or
staging:

| Name                          | Value                          | Treatment       |
| ----------------------------- | ------------------------------ | --------------- |
| `DSP_PROVIDER`                | `openai`                       | Wrangler `var`  |
| `DSP_PROVIDER_MODEL`          | `gpt-4o-mini`                  | Wrangler `var`  |
| `OPENAI_API_KEY`              | A fresh project-scoped API key | Wrangler secret |
| `THEORIA_PROVIDER_TIMEOUT_MS` | `120000`                       | Wrangler `var`  |

The defaults allow two concurrent provider requests and four requests per
client per minute. Change them only when the provider account requires
different limits. The in-memory rate limiter is per Worker isolate; treat it
as a courtesy limit, not an enforcement boundary.

For Anthropic or OpenRouter, change `DSP_PROVIDER`, choose an appropriate
`DSP_PROVIDER_MODEL`, and store the matching `ANTHROPIC_API_KEY` or
`OPENROUTER_API_KEY` as a secret. The full list of supported options is kept
in [`.env.example`](../../.env.example).

Use exactly one provider-key path in each deployment. Provider-specific keys
take precedence over the generic `DSP_PROVIDER_API_KEY`; blank values are
treated as absent. Do not put provider keys in:

- GitHub Actions secrets or repository variables;
- committed `.env` or `.dev.vars` files;
- `VITE_*` variables or other browser-visible configuration; or
- issue descriptions, build logs, screenshots, or test fixtures.

GitHub Actions does not need a provider key to build or test the website.

## Cutover from Railway

Cloudflare and Railway can run side by side until DNS moves, because the
production Worker only claims `theoria.scenesystems.io` when it is first
deployed with that Custom Domain.

1. Complete the Cloudflare account, token, and GitHub environment setup above.
2. Merge the Cloudflare deployment change. The push to `main` deploys staging;
   verify `https://theoria.staging.scenesystems.io` by hand as well as through
   the workflow checks.
3. If `theoria.scenesystems.io` currently has a DNS record pointing at Railway,
   delete it: Wrangler cannot create a Custom Domain over an existing CNAME.
4. Approve the `production` deployment. Wrangler creates the DNS record and
   certificate for `theoria.scenesystems.io`.
5. Verify production with the checklist above, then remove the Railway service,
   `railway.json`, the `build:bun` script and `.gz` sidecar step, and the
   `RAILWAY_*` fallbacks in `app/server/config`.

## Railway (until cutover)

The current production service deploys from the repository root using
[`railway.json`](../../railway.json). Keep Railway's **Root Directory** empty so
the build can resolve every workspace package. The configuration builds the web
app with `bun run build:bun`, starts the Bun server, and uses
`GET /api/health/live` as its health check. Railway supplies `PORT`,
`RAILWAY_ENVIRONMENT_NAME`, and `RAILWAY_GIT_COMMIT_SHA`.

Set `RELEASE_STAGE=production` on the production service. When `RELEASE_STAGE`
is absent the server falls back to the Railway environment name and then
`NODE_ENV`; an invalid `RELEASE_STAGE` value fails startup. Production does not
need a provider key: remove `DSP_PROVIDER_API_KEY`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, and `OPENROUTER_API_KEY` from the production variables.
