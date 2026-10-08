# Releasing packages

Maintainers publish staged candidates through GitHub Actions. Do not publish
locally, move candidate tags, or bypass content and provenance checks. Website
deployment is a [separate promotion](apps/theoria/DEPLOYMENT.md#promote-staging-to-production).

## Publish a version

1. Merge **Version Packages** to finalize versions and changelogs.
2. Wait for that commit's **Theoria** staging run to succeed. Copy its `run_id`
   from the job summary or `/actions/runs/` URL. Select this finalized candidate,
   not a run with pending changesets. Artifacts expire after seven days.
3. Run **Publish Packages** on `main` with that `run_id`:

   ```sh
   gh workflow run publish.yml --ref main -f run_id=STAGING_RUN_ID
   ```

4. Wait for the resulting `theoria-candidate-<sha>` **tag run**, including
   **Verify and record package publication**, to succeed. A successful dispatcher
   alone does not mean publication succeeded.

For new package names, complete [first publication](#first-publication-of-a-new-package)
first. For `reviewed_run_id` and website promotion ordering, follow the
[deployment runbook](apps/theoria/DEPLOYMENT.md#carry-a-review-through-version-finalization).

## Package content

An existing npm version must match the candidate's prepared package content.
Changed content requires a changeset and a versioned candidate, even when the
public API is unchanged. The [content comparison](scripts/release/Npm.ts) excludes
root package `README.md`, `CHANGELOG.md`, and descriptive manifest metadata.
Use a patch changeset to republish those updates intentionally.

## Publishing setup

Configure npm Trusted Publishing for each package: GitHub Actions repository
`scenesystems/theoria`, workflow `publish.yml`, environment `npm`, allowed action
`npm publish`. Keep public access and `publishConfig.provenance` enabled.
Routine publishing uses OIDC, not a long-lived npm token.

The GitHub `npm` environment must allow deployment tags matching
`theoria-candidate-*`; restrict other tags and branches. Access-control changes
require administrator approval.

## First publication of a new package

Use **Bootstrap Packages** only for names that do not exist on npm. Do not
publish placeholder versions. Before use, an administrator must configure the
`npm-bootstrap` environment with required reviewers, deployment tags matching
`theoria-candidate-*`, and release app credentials `APP_ID` and `APP_PRIVATE_KEY`.
A sole reviewer must be allowed to approve their own run.

1. Select a successful finalized staging candidate as above.
2. Create a short-lived npm granular token with **Packages and scopes -> Read and
   write** and **Bypass 2FA**, restricted to the target scope. Store it only as the
   protected environment secret `NPM_BOOTSTRAP_TOKEN`.
3. Run **Bootstrap Packages** on `main` with the candidate's `run_id` and an
   explicit JSON array of new package names:

   ```sh
   gh workflow run bootstrap.yml --ref main \
     -f run_id=STAGING_RUN_ID \
     -f 'packages=["@scenesystems/effect-study"]'
   ```

   Review the pinned candidate and selected packages, approve the environment,
   and wait for the **tag run**, including **Verify bootstrap publication**.
   Optional `reviewed_run_id` follows the deployment runbook's version-only rules.

4. Configure Trusted Publishing for each new package using `publish.yml`, not
   `bootstrap.yml`. Revoke the bootstrap token and delete its environment secret.
   Restrict traditional token publishing following npm's guidance below.
5. Run **Publish Packages** with the same `run_id` for remaining candidate
   versions. It skips matching versions already bootstrapped.

## Recovery

Inspect registry state and logs before retrying. Correct the cause and make a
fresh dispatch; do not rerun a failed publishing job from stale prerequisites.
If bootstrap partially published, configure Trusted Publishing for those names
and bootstrap only names still absent. If publication succeeded but recording
failed, wait for registry propagation and run **Publish Packages** with the same
candidate. If artifacts expired, select a new successful staging run.

Investigate content or provenance mismatches rather than bypassing checks.
Published versions cannot be replaced or have provenance added retroactively.

See npm's [granular token guidance](https://docs.npmjs.com/creating-and-viewing-access-tokens),
[provenance requirements](https://docs.npmjs.com/generating-provenance-statements/),
and [Trusted Publishing setup](https://docs.npmjs.com/trusted-publishers/).
