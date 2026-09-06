/**
 * Base ESLint configuration: ignores and the inline-configuration policy.
 * Applied first.
 *
 * Generic JavaScript and TypeScript diagnostics are owned by oxlint
 * (.oxlintrc.json). ESLint carries only the Effect discipline that needs
 * `no-restricted-syntax` selectors over the TypeScript AST.
 *
 * @module eslint/base
 */

import { includeIgnoreFile } from "eslint/config"

/**
 * Framework configuration is infrastructure, not Effect orchestration. Generic
 * oxlint policy still applies; Effect discipline does not.
 */
export const FRAMEWORK_CONFIG_PATTERNS = ["**/*.config.{ts,tsx,mts,cts}"]

/**
 * Every tracked source file is linted. What Git does not track (build output,
 * generated data, scratch, vendored references) is not; `.gitignore` is the
 * single statement of that, read here and by oxlint (`--ignore-path`). The
 * one authored exception is `apps/*\/public/**`: static browser scripts served
 * verbatim, not Effect code.
 */
export const AUTHORED_IGNORES = ["apps/*/public/**"]

const gitignore = `${import.meta.dirname}/../.gitignore`

/**
 * @returns {import('eslint').Linter.Config[]}
 */
export const base = () => [
  includeIgnoreFile(gitignore, { name: "theoria/base/gitignore" }),
  {
    name: "theoria/base/ignores",
    ignores: AUTHORED_IGNORES
  },
  {
    name: "theoria/base/inline-configuration",
    // Lint policy lives in this directory and .oxlintrc.json only. Inline
    // disable directives are reported as warnings, and `--max-warnings=0`
    // turns them into failures.
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error"
    },
    rules: {
      "no-warning-comments": [
        "error",
        { terms: ["eslint-disable", "oxlint-disable"], location: "anywhere" }
      ]
    }
  }
]
