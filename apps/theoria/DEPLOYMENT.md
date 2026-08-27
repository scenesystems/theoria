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

Open **Railway → Theoria service → Variables → production** and configure the
current OpenAI deployment as follows:

| Name                          | Value                          | Treatment              |
| ----------------------------- | ------------------------------ | ---------------------- |
| `DSP_PROVIDER`                | `openai`                       | Plain runtime variable |
| `DSP_PROVIDER_MODEL`          | `gpt-4o-mini`                  | Plain runtime variable |
| `OPENAI_API_KEY`              | A fresh project-scoped API key | Sealed secret          |
| `THEORIA_PROVIDER_TIMEOUT_MS` | `120000`                       | Plain runtime variable |

The defaults allow two concurrent provider requests and four requests per
client per minute. Set these explicitly only when the provider account has
matching limits:

```text
THEORIA_PROVIDER_CONCURRENCY=2
THEORIA_PROVIDER_REQUESTS_PER_MINUTE=4
```

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

Runtime provider keys belong only in Railway's sealed production variables.
Do not put them in:

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
3. The `effect-dsp` card reports that its provider is ready.
4. One provider-backed demo completes successfully.

If the provider remains unavailable, check the selected provider, model, and
credential in Railway before changing application code. Do not print or copy
the credential while debugging.
