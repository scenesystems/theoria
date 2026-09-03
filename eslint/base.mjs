/**
 * Base ESLint configuration: ignores, JavaScript recommended rules, globals and
 * the inline-configuration policy. Applied first.
 *
 * @module eslint/base
 */

import js from "@eslint/js"

/**
 * Framework configuration is infrastructure, not Effect orchestration. Generic
 * ESLint and oxlint policy still applies; Effect discipline does not.
 */
export const FRAMEWORK_CONFIG_PATTERNS = ["**/*.config.{ts,tsx,mts,cts}"]

export const GLOBAL_IGNORES = [
  "**/dist/**",
  "**/build/**",
  "**/node_modules/**",
  "**/.wrangler/**",
  "**/.wrangler-out/**",
  "**/__snapshots__/**",
  "**/fixtures/**/*.json",
  ".vendor/**",
  ".tmp/**"
]

const TEST_GLOBALS = {
  describe: "readonly",
  it: "readonly",
  expect: "readonly",
  beforeEach: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  afterAll: "readonly",
  vi: "readonly"
}

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
  },
  {
    name: "theoria/base/js-recommended",
    ...js.configs.recommended
  },
  {
    name: "theoria/base/globals",
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        ...TEST_GLOBALS
      }
    }
  },
  {
    // Static browser scripts served verbatim from an app's public/ directory.
    name: "theoria/base/public-browser-scripts",
    files: ["apps/*/public/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly"
      }
    }
  }
]
