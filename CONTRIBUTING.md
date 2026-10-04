# Contributing

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Please report concerns to [security@scenesystems.io](mailto:security@scenesystems.io).

## Pull Requests

1. Fork the repository and clone it locally.
2. Create a branch: `git checkout -b my-new-feature`
3. Install dependencies: `bun install`
4. Make your changes and add tests if applicable.
5. Run the checks: `bun run check && bun run lint && bun run test`
6. Create a changeset: `bun run changeset`
7. Commit: `git commit -am 'feat(effect-search): add some feature'`
8. Push: `git push origin my-new-feature`
9. Open a pull request against `main`.

## Guidelines

- All code must be idiomatic [Effect](https://effect.website). See [AGENTS.md](./AGENTS.md) for the full banned-constructs table.
- All tests must pass. Add new tests for new behavior.
- Changes must be consistent with the project's existing style and conventions.
- Write clear commit messages and include a summary in the PR description.
- If your change requires documentation, update the relevant docs.

## Development

Requires [bun](https://bun.sh) ≥ 1.3.

```sh
bun install
bun run check       # Type check
bun run lint        # Lint
bun run test        # Test
bun run build       # Build
```

Per-package:

```sh
bun run --filter @scenesystems/effect-search check
bun run --filter @scenesystems/effect-search test
```

## Mathematics in documentation

README guides support KaTeX's LaTeX math syntax through `remark-math`. Use `$x^2$` for inline math and put display delimiters on their own lines:

```markdown
For $\sigma > 0$:

$$
f(x) = \frac{1}{\sigma\sqrt{2\pi}}\exp\left(-\frac{x^2}{2\sigma^2}\right)
$$
```

Code spans and fenced code blocks remain literal. Escape a prose dollar sign as `\$`. Generated guides retain the LaTeX source; the site renders accessible MathML, without permitting TeX commands that inject HTML or load external resources. Invalid expressions appear as escaped source with an error label. This syntax applies to README guides, not TypeDoc API comments, which use a separate conversion pipeline.

Run `bun run docs` to validate examples and regenerate documentation, then inspect the affected guide in the docs application.

## Fixture Generation

Some packages use [uv](https://docs.astral.sh/uv/) to generate golden test fixtures from reference implementations (Optuna, DSPy). Always use `uv run` — never `python3` directly.

## Releases

This project uses [Changesets](https://github.com/changesets/changesets) for versioning. Before committing, create a changeset:

```sh
bun run changeset
```

Maintainers handle version bumps and publishing.

Merge the **Version Packages** PR, then select the successful Theoria staging
candidate with `run_id` in **Publish Packages** on `main`. The dispatcher starts
the actual publication on an immutable `theoria-candidate-<sha>` tag so npm
provenance and GitHub releases identify the selected commit, not a newer `main`.
Wait for that tag run's publication verification to succeed. Publishing does
not deploy the production website; **Theoria Production** separately promotes
the same candidate after checking package compatibility. Website-only releases
can reuse already published packages with matching prepared content. See the
[deployment runbook](apps/theoria/DEPLOYMENT.md#promote-staging-to-production)
for version-only review carry-forward, ordering, and recovery.

### npm Trusted Publishing

Published workspace packages use public npm access and provenance attestations from this public repository. Keep Trusted Publishing configured separately on every npm package with these values:

| Field                | Value          |
| -------------------- | -------------- |
| Provider             | GitHub Actions |
| Organization or user | `scenesystems` |
| Repository           | `theoria`      |
| Workflow filename    | `publish.yml`  |
| Environment          | `npm`          |
| Allowed action       | `npm publish`  |

The publish workflow uses npm's OpenID Connect flow and does not require a long-lived npm token. Its `pack` job downloads the staged package output, checks the workspace and content identity, and packs unpublished versions without rebuilding or holding the token; its `publish` job runs on a GitHub-hosted runner with `id-token: write`, publishes those tarballs, and executes no build or test code. Every public package keeps `publishConfig.provenance` enabled so npm can link the published tarball to this repository and workflow.

The GitHub `npm` environment must allow deployment **tags** matching
`theoria-candidate-*`; keep other tags/branches restricted. The Trusted Publisher
workflow filename and environment remain `publish.yml` and `npm`. The workflow
validates the tag's event SHA against a successful main staging candidate before
requesting that environment. This one-time environment rule requires maintainer
approval; the workflow does not modify repository access controls.

For a package name that does not exist yet, use the bootstrap workflow below,
then configure its Trusted Publisher before subsequent releases. Existing
versions published without provenance cannot be changed retroactively.

### First publication of a new package

**Bootstrap Packages** (`.github/workflows/bootstrap.yml`) is a separate,
manual-only workflow for new names, including future scopes. It does not run
when a version PR merges and cannot publish another version of an existing
package. Normal releases continue to use **Publish Packages** without an npm
token. Do not publish a placeholder version or publish the real first version
locally: the release gates require matching staged content and CI provenance.

Before first use, a repository administrator must configure the GitHub
`npm-bootstrap` environment with required reviewers and allow only deployment
**tags** matching `theoria-candidate-*`. A sole maintainer should select their own
account as a required reviewer and leave **Prevent self-review** unchecked, so
they can approve the publication checkpoint. Enable that restriction only when
another authorized maintainer can review the run. Make the existing
release app credentials (`APP_ID`, `APP_PRIVATE_KEY`) available to it. The
workflow does not create environments or change access controls.

1. Merge the bootstrap workflow before selecting a candidate; the candidate
   commit must contain it. Merge the **Version Packages** PR and wait for the
   resulting **Theoria** staging run to succeed. Select that finalized candidate,
   not the earlier run with queued changesets. Artifacts expire after seven days.
2. An npm maintainer with permission to create packages in the target scope
   creates a short-lived **granular access token**, with **Packages and scopes →
   Read and write**, permission to publish (not stage-only), and **Bypass 2FA**
   enabled. Restrict it to the target scope, since the new package name cannot
   yet be selected. Organization-management permission alone does not grant
   package publication. Store it only as `NPM_BOOTSTRAP_TOKEN` in the protected
   `npm-bootstrap` GitHub environment; never commit or paste it into a workflow
   input, command line, issue, or PR.
3. Dispatch **Bootstrap Packages** on `main` with the successful staging
   `run_id` and an explicit JSON array of new names. For example:

   ```sh
   gh workflow run bootstrap.yml --ref main \
     -f run_id=STAGING_RUN_ID \
     -f 'packages=["@scenesystems/effect-study"]'
   ```

   Optional `reviewed_run_id` has the same version-only review rules as normal
   publication. The main dispatcher starts the actual run on the immutable
   candidate tag. Review its candidate and exact package list, then approve the
   `npm-bootstrap` environment. Wait for the **tag run**, including **Verify
   bootstrap publication**, to succeed—not just the main dispatcher.

4. On npm, configure each newly created package's Trusted Publisher with
   `scenesystems/theoria`, **`publish.yml`**, environment **`npm`**, allowing
   `npm publish`. Do not configure `bootstrap.yml` as its routine publisher.
   Revoke the bootstrap token and delete the GitHub environment secret. Once
   Trusted Publishing is configured, restrict traditional token publishing in
   the package settings as described in the npm guidance below.
5. Dispatch **Publish Packages** on `main` with the same `run_id` to publish the
   remaining candidate versions. It verifies and skips matching versions
   already bootstrapped. Website promotion remains a separate approval.

Bootstrap rejects empty/duplicate/unknown names, existing package names, and
registry errors. It checks absence before packing and again immediately before
publishing with the bootstrap credential, including private packages that an
anonymous registry lookup cannot see. It uses the staged package output without rebuilding, verifies each
selected tarball's content and integrity, and preserves Changesets dependency
ordering. Only the selected packages publish with public access, the `latest`
tag, and provenance; the bootstrap token is exposed only to final admission and publication,
with lifecycle scripts disabled. Normal and bootstrap publications share a
concurrency lock. Neither reruns a publishing job from stale prerequisites.

**Recovery:** If nothing published, correct the error and make a fresh dispatch.
If only some names published, inspect the registry and run logs, configure
Trusted Publishing for those names, then make a fresh bootstrap dispatch listing
only names still absent. Do not rerun a failed publishing job or try to recreate
an existing name. If all selected versions published but recording failed, wait
for registry propagation and use **Publish Packages** with the same candidate;
its verification accepts bootstrap provenance. Investigate content/provenance
mismatches instead of bypassing them. Never move a candidate tag; if artifacts
expired, select a new successful staging run.

See npm's [granular token guidance](https://docs.npmjs.com/creating-and-viewing-access-tokens),
[provenance requirements](https://docs.npmjs.com/generating-provenance-statements/),
and [Trusted Publishing setup](https://docs.npmjs.com/trusted-publishers/).
