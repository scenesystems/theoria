# Releasing packages

Publish packages through GitHub Actions using a successful staging candidate.
Keep candidate tags immutable and leave content and provenance checks enabled.
Local publication is unsupported. Publishing packages leaves the website
unchanged; promote it through the [deployment workflow](apps/theoria/DEPLOYMENT.md#promote-staging-to-production).

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

Before publication, the workflow compares each package with its existing npm
version. If the prepared content differs, add a changeset and stage a new
version, even if the API is unchanged. The
[comparison](scripts/release/Npm.ts) excludes the package's root `README.md`,
`CHANGELOG.md`, and descriptive manifest metadata. Add a patch changeset if
those updates need to reach npm.

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

Check the registry and job logs before retrying a failed publication. After
correcting the cause, dispatch the workflow again so it rechecks prerequisites.
Do not use GitHub's job rerun action.

If bootstrap published only some packages, configure Trusted Publishing for
those names and bootstrap the ones still absent. If publication succeeded but
recording failed, wait for registry propagation and run **Publish Packages**
with the same candidate. Expired artifacts require a new successful staging run.

Investigate content or provenance mismatches rather than bypassing checks.
Published versions cannot be replaced or have provenance added retroactively.

See npm's [granular token guidance](https://docs.npmjs.com/creating-and-viewing-access-tokens),
[provenance requirements](https://docs.npmjs.com/generating-provenance-statements/),
and [Trusted Publishing setup](https://docs.npmjs.com/trusted-publishers/).
