# Deploying the Theoria app

This runbook is for maintainers of the public Theoria website. Local users do
not need any of this configuration.

The site runs on Cloudflare Workers. `apps/theoria/server.ts` still serves the
same app with Bun for local development, but nothing deploys it.

## Cloudflare Workers

One Worker script, [`worker.ts`](./worker.ts), serves the API, the HTML shell
with per-route metadata, and the built web bundle in `dist/` as static assets.
[`wrangler.jsonc`](./wrangler.jsonc) declares three targets:

| Target     | Worker name       | Hostname                                 | `RELEASE_STAGE` |
| ---------- | ----------------- | ---------------------------------------- | --------------- |
| production | `theoria`         | `theoria.scenesystems.io`                | `production`    |
| staging    | `theoria-staging` | `theoria.staging.scenesystems.io`        | `production`    |
| preview    | `theoria-pr-<N>`  | `theoria-pr-<N>.staging.scenesystems.io` | `preview`       |

Staging mirrors the production surface so it is a faithful rehearsal; previews
differ only in `RELEASE_STAGE`, which the server uses for indexing policy.
Every hostname other than `theoria.scenesystems.io` is served with
`X-Robots-Tag: noindex`: the Worker adds it to its own responses
(`app/server/indexing-policy.ts`) and [`public/_headers`](./public/_headers)
adds it to assets served directly from the edge.

### Request routing

Cloudflare serves a matching file from `dist/` directly, without invoking the
Worker, unless the path is listed in `assets.run_worker_first`. That list
covers the HTML shell (`/`, `/index.html`, `/docs`, `/docs/*`), `/api/*`, and
`/sitemap.xml`. Paths with no matching asset (docs pages, unknown URLs) fall
through to the Worker.

`bun run test:worker` (`test/worker/`) runs the bundled Worker in workerd
through Wrangler's test harness with the real `wrangler.jsonc`, `dist/`, and
`_headers`. `site.test.ts` asserts this routing over HTTP: shell paths reach the
Worker and get metadata, hashed assets come from the assets layer with the `_headers` policy, non-production hostnames are
`noindex`, and the security headers permit what the browser code needs (Shiki's
WebAssembly grammar engine requires `'wasm-unsafe-eval'`). `home.test.ts`,
`docs.test.ts`, and `docs-routes.test.ts` drive Chromium (Playwright, from
Effect) against that same server: the Imagined Place build through the real
API, the docs catalog against the generated manifest, docs navigation and
search, syntax highlighting, clipboard copy, every generated route, and
responsive layouts. The suite needs a build first (`bun run build:web && bun
run deploy:dry-run`) and Chromium (`bunx playwright install chromium`), so it
is not part of `bun run test`; the Build job runs it on the exact artifact it
uploads. `test/server/wrangler-config.test.ts` reads the configuration through
Wrangler and checks the per-target names, routes, and `RELEASE_STAGE` values.

Cache lifetimes for directly served assets come from `public/_headers`;
lifetimes for Worker responses come from `cacheControlForPath`. Cloudflare
compresses responses at the edge, so the build ships assets uncompressed.

### Variables and secrets

`RELEASE_STAGE` is declared per target in `wrangler.jsonc`; an unset value (a
local run) means `preview`, and an unsupported value stops the Worker from
starting. `BUILD_SHA` is passed at deploy time (`--var BUILD_SHA:<sha>`) and surfaces as
`meta.buildSha` in API responses. No target needs any secret: the site serves
docs and the Imagined Place build, both computed from the repository. The
Worker exposes every string binding to Effect `Config`, so any variable
documented in [`.env.example`](../../.env.example) can be set as a Wrangler
`var`.

### Local commands

```sh
bun run build:web        # docs assets, vite build → dist/
bun run deploy:dry-run   # bundle worker.ts for workerd without deploying
bun run preview:worker   # build, then serve production config with wrangler dev
bunx wrangler dev --env staging   # or --env preview; assumes dist/ is built
```

`wrangler dev` presents the target's route hostname to the Worker, so the
production config appears indexable locally while `--env staging` and
`--env preview` return `noindex`.

## Automated deployments

The [Theoria workflow](../../.github/workflows/theoria.yml) builds the site once
per commit. It first runs the app's typecheck and unit tests (`bun run
check:apps`, `bun run test:apps`), so an artifact never comes from a tree that
fails its own checks even though the Check workflow runs separately. It then
builds (`bun run build:web`, then `wrangler deploy --dry-run` to bundle
`worker.ts` for workerd), runs that bundle in workerd over HTTP and in
Chromium (`bun run test:worker`), checks the output with
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
trusted `main` on `workflow_run`. An unprivileged `resolve` job first finds the
single open pull request from this repository into `main` whose head is the
built commit (it does not trust the event's `pull_requests` list, whose order
is not guaranteed); the deploy job then re-checks the artifact, confirms the
pull request still points at that commit, and deploys it with the
`wrangler.jsonc` from `main` (a pull request that changes `wrangler.jsonc` sees
that change only after merge). Pull request code never runs with Cloudflare
credentials, and pull requests from forks are not previewed. Updating a pull
request replaces its preview; closing it deletes the Worker and its managed DNS
record, then deletes the Advanced Certificate Cloudflare issued for the preview
hostname (Cloudflare does not remove it with the Custom Domain, and each zone
has a certificate limit). A build that completes after its pull request closed
waits for that cleanup rather than cancelling it, then skips. The first
deployment of a pull request waits up to ten minutes for the certificate to be
issued before the verification checks run.

Because the deploy job runs on `main`, GitHub records its `staging` deployment
against `main` rather than the pull request, so the pull request page does not
show the deployment URL. After verification passes, the job posts a single
"Theoria preview" comment on the pull request (created once, then edited on each
redeploy, and edited again to say the preview was removed when the pull request
closes) with the hostname, the deployed commit, and the run that deployed it.

Both workflows only take effect once they exist on `main`: a pull request that
adds or edits them is built, but not previewed, until it merges.

### Cloudflare account and token

1. `scenesystems.io` must be an active zone in the Cloudflare account, and the
   account needs the Workers Paid plan (`limits.cpu_ms` above the Free plan
   default).
2. Create an API token from the **Edit Cloudflare Workers** template, restrict
   it to this account and the `scenesystems.io` zone, and add two zone
   permissions: **Zone → Read** and **SSL and Certificates → Edit**. The template
   covers deploying Workers and attaching Custom Domains (with their DNS
   records); the additions let the preview cleanup job look up the zone and
   delete a closed pull request's certificate. Without them, closing a pull
   request still deletes its Worker but the Remove job fails at the certificate
   step.
3. Record the account ID from the dashboard.

The token is used by GitHub Actions only. Local `wrangler` commands
authenticate with `wrangler login`, or with a separate personal token, so a CI
credential never sits on a workstation.

### GitHub environments

In **Settings → Environments**, create `staging` and `production`. Add
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as environment secrets to
both. Restrict both environments to the `main` deployment branch so a workflow
edited on a pull request cannot request either environment's secrets. Leave
`staging` without required reviewers so previews and merged changes deploy
automatically; add required reviewers to `production` so every release waits
for approval after staging has been verified.

Two consequences of that setup: `workflow_dispatch` runs from any branch other
than `main` fail when the Staging job requests the environment (pull request
previews are the way to review a branch), and a production approval must happen
within seven days of the push, because the build artifact expires after that
and the Production job can no longer download it. Re-run the workflow for that
commit to rebuild if an approval is late.

### Manual deploy

To deploy by hand after `wrangler login` (from `apps/theoria`; `build:web`
regenerates `public/docs-data` for the current commit, so a stale checkout
never uploads earlier revisions):

```sh
bun run build:web
bunx wrangler deploy --env staging --var BUILD_SHA:"$(git rev-parse HEAD)"
bunx wrangler deploy --env ""      --var BUILD_SHA:"$(git rev-parse HEAD)"
```

The deploy commands change Cloudflare routing; run them only as an approved
release action. Verify a deployment in this order:

1. `GET /api/health/live` returns `200`.
2. `GET /api/health/live` reports `meta.buildSha` equal to the deployed commit.
3. `GET /docs/<package>` returns `200` with a package-specific `<title>`; an
   unknown docs path returns `404` with the HTML shell.
4. `POST /api/imagined-place/build` with a valid request returns `200`.
5. On staging and previews only, every response carries
   `X-Robots-Tag: noindex`.

## Previews are public, pull-request-controlled code

A preview Worker runs whatever the pull request built, on a public hostname
under `scenesystems.io`. Two rules follow:

- Never attach secrets or privileged bindings (KV, D1, R2, queues, service
  bindings) to a `theoria-pr-<N>` Worker, whether through `wrangler secret`,
  the dashboard, or `wrangler.jsonc`. Cloudflare keeps a Worker's secrets
  across later deployments, so a value set once would be readable by every
  later revision of that pull request. Nothing served by Theoria needs a
  secret.
- Do not rely on cookies or same-site trust scoped to `scenesystems.io` in any
  other application under that zone: a preview can set parent-domain cookies.

GitHub Actions needs only the Cloudflare credentials described below to build,
test, and deploy the website.

## DNS and quota preconditions

Check these before the first preview deploys, and again before the first use of
any new hostname (`theoria.staging.scenesystems.io`, `theoria.scenesystems.io`):

1. No DNS record may already exist at the hostname. Cloudflare refuses to
   attach a Custom Domain over an existing CNAME or A record; delete the record
   first and let the Worker create its own.
2. `scenesystems.io` must be a full Cloudflare DNS zone (not a partial or
   delegated setup) so Cloudflare adds the CAA authorization its certificates
   need. If the zone carries explicit CAA records, they must permit Cloudflare's
   certificate authorities.
3. Every open pull request holds one Worker and one Custom Domain. Cloudflare
   allows 500 Workers per paid account and 100 Custom Domains per zone; leave
   headroom for the staging and production Workers and for other applications
   on the zone.
4. The build must stay within Workers limits: 10 MB of gzipped Worker code,
   100,000 static assets, and 25 MiB per asset. `theoria-build-check` reports
   the asset count and Worker size on every run.

After the first preview is live, open **SSL/TLS → Edge Certificates** for the
zone and confirm the certificate Cloudflare issued for the preview hostname is
an Advanced Certificate whose only host is that hostname. The cleanup job
deletes exactly such a certificate when the pull request closes; if Cloudflare
ever issues a multi-host or differently typed certificate, cleanup leaves it in
place and the job must be revised before certificates accumulate.

Cleanup is best-effort per close event. If a close runs while the runner or the
Cloudflare API is unavailable, delete the Worker (`theoria-pr-<N>`) and the
certificate by hand, or rerun the failed `Remove PR Preview` job from the
Actions tab.

## Taking over a hostname

The Worker claims `theoria.scenesystems.io` through the Custom Domain in
`wrangler.jsonc`. In the workflow Wrangler runs without a TTY and therefore
sends `override_existing_dns_record` and `override_existing_origin` with the
Custom Domain request, so an existing DNS record for the hostname (for example
a CNAME to a previous host) is replaced by the Worker's record in one API call
and there is no gap without a record. Every verify step polls `/api/health/live`
for up to ten minutes until the hostname reports the deployed `buildSha`. That
covers certificate issuance for a new hostname and the zone's wildcard record:
a resolver that answered for the hostname before Wrangler created its record
keeps the wildcard answer for the wildcard's 300-second TTL, and the runner
cannot bypass its resolver.

That is the whole cutover from a previous host: merge, let staging deploy and
verify, approve `production`, and let the verify step pass. Afterwards:

1. Confirm in the Cloudflare dashboard that `theoria.scenesystems.io` is now a
   Workers Custom Domain (DNS → Records shows it managed by the Worker).
2. Decommission the previous host so it stops building on pushes; nothing in
   the repository refers to it anymore.
3. Watch `wrangler tail theoria` or the Workers Logs for the first hours; the
   Worker reports `buildSha` on `/api/health/live` if anything needs to be
   correlated with a release.
