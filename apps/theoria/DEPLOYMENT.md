# Deploying the Theoria app

This runbook is for maintainers of the public Theoria website. Local users do
not need any of this configuration unless they want to run the provider-backed
`effect-dsp` demo.

## Railway service

The production service deploys from the repository root using
[`railway.json`](../../railway.json). Keep Railway's **Root Directory** empty so
the build can resolve every workspace package.

The checked-in configuration builds the web app, starts the Bun server, and
uses `GET /api/health/live` as its health check. Railway supplies `PORT`,
`RAILWAY_ENVIRONMENT_NAME`, and `RAILWAY_GIT_COMMIT_SHA`; do not define copies
of those variables.

If the Railway environment is not literally named `production`, set
`NODE_ENV=production` so production caching and security behavior are enabled.

## Production variables and secrets

The current production site exposes only the package catalog. Demo pages and
demo API routes are disabled, so production does not need a provider key or
provider configuration.

In **Railway → Theoria service → Variables → production**, remove
`DSP_PROVIDER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and
`OPENROUTER_API_KEY`. Railway supplies the variables needed to run the catalog.

## Preview provider configuration

Provider credentials are needed only for a preview deployment that exercises
the `effect-dsp` demo. Configure them in **Railway → Theoria service → Variables
→ preview**, not in production:

| Name                          | Value                          | Treatment              |
| ----------------------------- | ------------------------------ | ---------------------- |
| `DSP_PROVIDER`                | `openai`                       | Plain runtime variable |
| `DSP_PROVIDER_MODEL`          | `gpt-4o-mini`                  | Plain runtime variable |
| `OPENAI_API_KEY`              | A fresh project-scoped API key | Sealed secret          |
| `THEORIA_PROVIDER_TIMEOUT_MS` | `120000`                       | Plain runtime variable |

The defaults allow two concurrent provider requests and four requests per
client per minute. Change them only when the provider account requires
different limits.

For Anthropic or OpenRouter, change `DSP_PROVIDER`, choose an appropriate
`DSP_PROVIDER_MODEL`, and seal the matching `ANTHROPIC_API_KEY` or
`OPENROUTER_API_KEY`. The full list of supported local and runtime options is
kept in [`.env.example`](../../.env.example).

## Secret placement

Use exactly one provider-key path in each deployment. For an OpenAI deployment,
leave `DSP_PROVIDER_API_KEY`, `ANTHROPIC_API_KEY`, and `OPENROUTER_API_KEY`
unset. Remove stale values instead of leaving a second credential in place.

Provider-specific keys take precedence over the generic
`DSP_PROVIDER_API_KEY`; blank values are treated as absent. The generic path is
available for custom deployments, but a provider-specific key is easier to
audit.

Deployed provider keys belong only in Railway's sealed preview variables. A
local key belongs in the ignored `.env` file. Do not put provider keys in:

- GitHub Actions secrets or repository variables;
- committed `.env` files;
- `VITE_*` variables or other browser-visible configuration; or
- issue descriptions, build logs, screenshots, or test fixtures.

GitHub Actions does not need a provider key to build or test the website.

## Apply and verify a change

Code changes deploy through Railway's GitHub integration. After changing a
Railway variable, redeploy the service so the new environment is loaded.

Verify the resulting deployment in this order:

1. `GET /api/health/live` returns `200`.
2. The app reports a non-placeholder build revision.
3. `GET /api/capabilities` returns an empty `demos` array in production.
4. A production demo page and demo API request both return `404`.

For a preview deployment with an OpenAI key, confirm that `effect-dsp` reports
an enabled capability and complete one provider-backed run. If it remains
unavailable, check the selected provider, model, and credential in Railway. Do
not print or copy the credential while debugging.

## Cloudflare pull request previews

The [Theoria Preview workflow](../../.github/workflows/theoria-preview.yml)
deploys a pull request's build to a per-PR Cloudflare Worker at
`https://theoria-pr-<N>.staging.scenesystems.io` and deletes that Worker, its
DNS record, and its certificate when the pull request closes. It runs on
`workflow_run` after a workflow named `Theoria` completes for the pull request,
so it executes on `main` with the `staging` environment's credentials: the pull
request's code is never run with them. Only the artifact `theoria-<head sha>`
(containing `dist/` and `.wrangler-out/worker.js`) is downloaded, checked by
[`theoria-build-check`](../../.github/actions/theoria-build-check/action.yml),
deployed with the [`wrangler.jsonc`](./wrangler.jsonc) `preview` environment
from `main`, and verified live by
[`theoria-verify-deployment`](../../.github/actions/theoria-verify-deployment/action.yml).
Pull requests from forks are not previewed.

GitHub only honors `workflow_run` for workflow files on the default branch,
which is why this workflow, the two actions, `wrangler.jsonc`, and the
`wrangler` devDependency live on `main` ahead of the `Theoria` build workflow
and the Worker itself. The full Cloudflare deployment (staging and production
from `main`) arrives with the Cloudflare migration; until then Railway remains
the production host.

### Cloudflare account and token

1. `scenesystems.io` must be an active zone in the Cloudflare account, and the
   account needs the Workers Paid plan (`limits.cpu_ms` above the Free plan
   default).
2. Create an API token from the **Edit Cloudflare Workers** template, restrict
   it to this account and the `scenesystems.io` zone, and add two zone
   permissions: **Zone → Read** and **SSL and Certificates → Edit**. The template
   covers deploying Workers and attaching Custom Domains (with their DNS
   records); the additions let the cleanup job look up the zone and delete a
   closed pull request's certificate.
3. Record the account ID from the dashboard.

The token is used by GitHub Actions only. Local `wrangler` commands
authenticate with `wrangler login`, or with a separate personal token, so a CI
credential never sits on a workstation.

### GitHub environment

In **Settings → Environments**, create `staging` with `CLOUDFLARE_ACCOUNT_ID`
and `CLOUDFLARE_API_TOKEN` as environment secrets. Restrict it to the `main`
deployment branch so a workflow edited on a pull request cannot request its
secrets, and leave it without required reviewers so previews deploy
automatically. (The `production` environment, with required reviewers, is
created with the Cloudflare migration.)

The first deployment of a pull request creates a new Custom Domain, and its
certificate can take several minutes to issue; the verification step waits up
to ten minutes before failing.
