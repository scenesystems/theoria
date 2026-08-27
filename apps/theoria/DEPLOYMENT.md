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
