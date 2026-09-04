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

/**
 * Framework configuration is infrastructure, not Effect orchestration. Generic
 * oxlint policy still applies; Effect discipline does not.
 */
export const FRAMEWORK_CONFIG_PATTERNS = ["**/*.config.{ts,tsx,mts,cts}"]

/**
 * Kept identical to `ignorePatterns` in .oxlintrc.json so both linters see the
 * same tree. `apps/*\/public/**` holds static browser scripts served verbatim;
 * they are not authored Effect code.
 */
export const GLOBAL_IGNORES = [
  "**/dist/**",
  "**/build/**",
  "**/node_modules/**",
  "**/.wrangler/**",
  "**/.wrangler-out/**",
  "**/__snapshots__/**",
  "**/fixtures/**/*.json",
  ".vendor/**",
  ".tmp/**",
  "apps/*/public/**"
]

/**
 * @returns {import('eslint').Linter.Config[]}
 */
export const base = () => [
  {
    name: "theoria/base/ignores",
    ignores: GLOBAL_IGNORES
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
