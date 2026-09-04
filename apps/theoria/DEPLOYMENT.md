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
API, the package index against the generated manifest, docs navigation and
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

### Abuse protection

`POST /api/imagined-place/build` is the only route that does real work per
request, so it is the only one an anonymous client can use to burn CPU time.
Each target in `wrangler.jsonc` declares a Workers
[rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
named `PLACE_BUILD_LIMITER` (30 requests per 60 seconds per client address).
The route checks it after the method and origin checks and before it reads the
body; a refused request gets `429` with `retry-after: 60` and the
`rate-limited` error code, and never reaches the build.

**Status (2026-09-03): the binding is deployed but Cloudflare was not observed
enforcing it.** After the first production deploy with the binding, 55 empty
`POST`s over 52 seconds inside one window from one address at one location
(`SEA`) against staging, and 40 against production, were all admitted; the
same bundle in workerd (Miniflare) refuses the 31st. The deploy output lists
`env.PLACE_BUILD_LIMITER (30 requests/60s)` for both targets and no request
failed, so the binding is present and callable. A Cloudflare Community report
from 2026-08-28 ("Workers Rate Limiting binding always returns success=true for
the same key and colo") describes the same behaviour and is unresolved. Until
that changes, treat the binding as defence in depth and put the enforced limit
in the zone WAF:

1. Dashboard → `scenesystems.io` → **Security → WAF → Rate limiting rules →
   Create rule** (the API needs a token with **Zone → Zone WAF → Edit**; the
   deploy token does not have it).
2. Expression: `(http.request.uri.path eq "/api/imagined-place/build")`.
   Method and hostname fields need the Business plan; on Free and Pro the
   path applies to every hostname on the zone, which is fine because only this
   Worker serves it.
3. Characteristics `IP`; period `10 seconds` (the only period on Free); rate
   `10 requests`; action `Block`; duration `10 seconds`. That is 60 per minute
   sustained, with a 10-second block on bursts.
4. Re-run the probe: from one address, 15 empty `POST`s within 10 seconds
   should turn to `429` (Cloudflare's block page, not the Worker's envelope)
   part-way through.

Re-test the binding after Cloudflare answers the report. With both in place
the WAF rule, evaluated before the Worker runs, stops bursts, and the binding
caps a client that stays just under the WAF rate across a minute; the
`test/worker/place-build-limit.test.ts` suite keeps the Worker side honest
whichever way the platform behaves.

Facts about the binding that matter when operating it:

- Counters live per Cloudflare data center and are eventually consistent, so a
  client near the limit can get a few requests past it. The limit is a
  backstop against runaway clients, not an exact quota.
- The three targets use distinct `namespace_id`s (`1001` production, `1002`
  staging, `1003` shared by every preview Worker), so load on one never
  refuses the others. Wrangler does **not** inherit `ratelimits` into named
  environments; a target without its own entry deploys with no binding.
  `test/server/wrangler-config.test.ts` asserts every target declares exactly
  one.
- A Worker that finds no binding in `env` admits every build and logs one
  warning per isolate (`PLACE_BUILD_LIMITER binding is missing`) instead of
  failing requests: the limiter is a backstop, and a pull request that changes
  the binding is previewed with the `wrangler.jsonc` from `main`, so its
  preview would otherwise be down until merge. Grep Workers Logs for that
  warning after any deploy that touched `wrangler.jsonc`.
- The key is `cf-connecting-ip`. Clients behind one NAT share a budget; there
  is no other identity for an anonymous request.
- The Bun dev server (`bun run dev`) provides an unlimited stand-in, so local
  work never hits the limit. `wrangler dev` and the workerd test suite use
  Miniflare's implementation of the binding, and
  `test/worker/place-build-limit.test.ts` drives it to a real `429`.

To change the limit, edit all three `simple.limit` values (period must stay
`60`, which the route reports in `retry-after`) and deploy; the change ships
with the next version like any other binding. To see refusals in production,
filter Workers Logs (or `wrangler tail theoria --method POST`) for `429`
responses on `/api/imagined-place/build`. Sustained refusals from many
addresses mean a broader control (a WAF rate limiting rule on the zone, or
Turnstile in front of the build) is due; the binding alone is sized for a
single misbehaving client.

### Analytics

Two providers are supported, each switched on by a public identifier declared
in the production `vars` of `wrangler.jsonc` (`app/server/config/analytics.ts`
reads them; an empty value disables that provider, a malformed one stops the
Worker from starting):

| Variable                 | Provider                 | Where to find the value                                                                                             |
| ------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `GA_MEASUREMENT_ID`      | Google Analytics 4       | GA4 Admin → Data streams → the web stream's Measurement ID (`G-…`).                                                 |
| `CF_WEB_ANALYTICS_TOKEN` | Cloudflare Web Analytics | Cloudflare dashboard → Web Analytics → add the site with **manual** setup and copy the `token` from the JS snippet. |

The Worker emits the tags into the HTML shell only for requests on
`theoria.scenesystems.io`, so staging and previews never report traffic even
though they run the same bundle, and the Content Security Policy widens by
exactly the hosts each configured provider needs (`app/server/security-headers.ts`).
Nothing is inline: Google's `gtag.js` is bootstrapped by
[`public/analytics/gtag-init.js`](./public/analytics/gtag-init.js), which sets
region-scoped Consent Mode v2 defaults: advertising storage is _denied_
everywhere (the site runs no ads), and analytics storage is _granted_ everywhere
except the EEA, the United Kingdom, and Switzerland, where it is _denied_.
Outside those regions GA4 sets its first-party cookie and reports observed
pageviews and users (`gcs=G101`); inside them it receives cookieless pings only
(`gcs=G100`), which GA4 uses for modeling, not reporting, so those visitors
appear in Cloudflare Web Analytics but not in GA4. Do not default analytics
storage to _denied_ globally without a consent UI: GA4 then reports nothing at
all, because behavioral modeling needs thousands of consented users to train.
Cloudflare Web Analytics is cookieless by design. In-app navigation is a `pushState`, which
GA4 reports through enhanced measurement ("Page changes based on browser
history events", on by default for the web stream); do not add manual
`page_view` events or pages count twice. Turn off Cloudflare's automatic
JavaScript injection for the zone if it is enabled: the strict CSP blocks the
auto-injected snippet, and the manual tag already covers it.

### Search and sharing metadata

Every HTML response carries per-route metadata derived from one contract,
`app/contracts/metadata.ts`: title, description, canonical URL, `robots`
(`noindex` for unknown docs paths, which also return 404), Open Graph and
Twitter cards with a 1200×630 share image, and JSON-LD (`WebSite` and the
Scene `Organization` everywhere; `SoftwareSourceCode` on package pages;
`TechArticle` on guides and API modules; `BreadcrumbList` on both). The Worker
rewrites the placeholders in `index.html` (`app/server/render-head.ts`) and the
browser applies the same entries after client-side navigation. `/sitemap.xml`
lists the home page and every docs page from the shipped manifest, and
`/llms.txt` (`app/server/routes/llms.ts`) renders the llmstxt.org v2 file from
the same manifest: each package links its README as raw markdown at the
documented revision, its docs pages, and its npm page. HTML responses carry
`Link: </llms.txt>; rel="describedby"`. `/robots.txt` is static.

Share images and icons under `public/` (`social/*.png`, `apple-touch-icon.png`,
`icon-*.png`, `favicon.ico`, `manifest.webmanifest`) are committed files
rendered from `public/favicon.svg` by `bun run gen:social-assets`, which needs
ImageMagick 7 (`magick`) on the machine that runs it. Re-run it after changing
the mark, the site description, or a package's `package.json` description, and
commit the output.

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
both environments without required reviewers: every push to `main` deploys to
staging, the Staging job's verify step exercises the live staging site, and the
Production job, which `needs` that job, deploys the same build unattended only
after that verification passes. Staging is the gate, so a release (including a
merged Version Packages pull request) reaches the website in one run with no
manual step. Adding a required reviewer to `production` turns that into a
manual gate; if you do, approve within seven days of the push, because the
build artifact expires after that and the Production job can no longer
download it.

One consequence of the branch restriction: `workflow_dispatch` runs from any
branch other than `main` fail when the Staging job requests the environment;
pull request previews are the way to review a branch.

### Manual deploy

To deploy by hand after `wrangler login` (from `apps/theoria`; `build:web`
regenerates `public/docs-data` for the current commit, so a stale checkout
never uploads earlier revisions):

```sh
bun run build:web
bunx wrangler deploy --env staging --var BUILD_SHA:"$(git rev-parse HEAD)" --tag "$(git rev-parse HEAD)"
bunx wrangler deploy --env ""      --var BUILD_SHA:"$(git rev-parse HEAD)" --tag "$(git rev-parse HEAD)"
```

`--tag` records the commit on the Worker version so it can be found again for
a [rollback](#rolling-back).

The deploy commands change Cloudflare routing; run them only as an approved
release action. Verify a deployment in this order:

1. `GET /api/health/live` returns `200`.
2. `GET /api/health/live` reports `meta.buildSha` equal to the deployed commit.
3. `GET /docs/<package>` returns `200` with a package-specific `<title>`; an
   unknown docs path returns `404` with the HTML shell.
4. `POST /api/imagined-place/build` with a valid request returns `200`.
5. On staging and previews only, every response carries
   `X-Robots-Tag: noindex`.

## Rolling back

Every `wrangler deploy` creates a Worker version that captures the bundled
code, the static assets, the bindings, and the vars (including `BUILD_SHA`), and
Cloudflare keeps the last 100. A rollback promotes one of those versions to the
active deployment for every route the Worker serves; nothing is rebuilt, so
the site is back on the earlier commit within seconds and `/api/health/live`
reports that commit's `meta.buildSha` again. The rate-limit counters are
resources outside the version and are untouched.

Two paths, chosen by how fast the site has to change:

**Immediate: promote the previous version.** Use this when production is
serving something broken now. It needs an account member with Workers edit
access, either at a workstation after `wrangler login` or in the dashboard.

```sh
cd apps/theoria
bunx wrangler versions list --env ""         # production; --env staging for staging
bunx wrangler rollback <version-id> --env "" --message "revert <reason>"
```

The workflows tag every version with the commit it was built from
(`--tag <sha>`), so the list shows a `Tag` column of commit SHAs: pick the
newest version tagged with the last known-good commit. (A version deployed by
hand without `--tag` shows its commit only through `wrangler versions view
<version-id>`, under the `BUILD_SHA` var.) Afterwards run `wrangler deployments
list --env ""` and confirm the newest deployment carries the chosen version. In
the dashboard the same action is **Workers & Pages → theoria → Deployments → ⋯
on the version → Rollback**. Then verify with the checklist under
[Manual deploy](#manual-deploy), watching `meta.buildSha`.

A rollback does not change `main`. The next push to `main` deploys whatever
`main` then contains, so follow the rollback with the second path, or the bad
commit comes back on the next merge.

**Durable: revert on `main`.** Use this for anything that can wait for one CI
run (recent runs took six to eighteen minutes from push to production, most of
it the build and the two live verify steps), and always after an immediate
rollback:

```sh
git revert --no-edit <bad-commit>            # or a range: <first>^..<last>
gh pr create --base main --fill
```

Merge the pull request as usual. The Theoria workflow builds the reverted tree,
deploys it to staging, verifies it, and only then deploys production, so the
revert takes exactly the path a release does and cannot skip the staging gate.
If the revert also needs a package change, add a patch changeset like any other
fix; the website deploy does not depend on package versions.

Previews never need a rollback: push a fix to the pull request or close it.

What a rollback cannot fix: a broken route or Custom Domain (routing is not
part of a version; fix `wrangler.jsonc` and deploy) and certificate or DNS
problems (see [Taking over a hostname](#taking-over-a-hostname)).

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
`wrangler.jsonc`. Cloudflare creates the DNS record for a Custom Domain itself
and refuses to create one while the hostname has a DNS record that Cloudflare
did not create (an A or CNAME record added by hand, for example one pointing at
a previous host). Wrangler sends `override_existing_dns_record` with the
request when it runs without a TTY, but that only covers records Cloudflare
manages; the API still rejects a hand-made record with
`already has externally managed DNS records [code: 100117]`. When that happens
the Worker and its assets are already uploaded, the deploy step fails, and the
hostname keeps serving the previous host.

Cutting over from a previous host is therefore a manual DNS step followed by a
deploy:

1. In the Cloudflare dashboard open **DNS → Records** for the zone and delete
   the `theoria` record that points at the previous host. Until the next step
   finishes, the hostname is answered by the zone's wildcard record, if any.
2. Attach the hostname to the Worker right away, either by opening
   **Workers & Pages → theoria → Settings → Domains & Routes → Add → Custom
   Domain** and entering `theoria.scenesystems.io` (the already uploaded Worker
   serves immediately), or by rerunning the failed `Production` job, whose
   `wrangler deploy` now creates the Custom Domain and its record.
3. Let the verify step pass. It polls `/api/health/live` for up to ten minutes
   until the hostname reports the deployed `buildSha`; that covers certificate
   issuance for the new hostname and resolvers that cached the wildcard answer
   for its 300-second TTL, which the runner cannot bypass.

Afterwards:

1. Confirm in the Cloudflare dashboard that `theoria.scenesystems.io` is now a
   Workers Custom Domain (DNS → Records shows it managed by the Worker).
2. Decommission the previous host so it stops building on pushes; nothing in
   the repository refers to it anymore.
3. Watch `wrangler tail theoria` or the Workers Logs for the first hours; the
   Worker reports `buildSha` on `/api/health/live` if anything needs to be
   correlated with a release.
