/**
 * Effect discipline scopes.
 *
 * Every TypeScript file receives CORE_RULES. Later blocks replace the whole
 * `no-restricted-syntax` array for the files they match, so each scope names
 * its complete rule set. Framework configuration files carry no Effect rules.
 *
 * @module eslint/scopes
 */

import { FRAMEWORK_CONFIG_PATTERNS } from "./base.mjs"
import { APPLICATION_RULES, CORE_RULES, LIBRARY_RULES, VIEW_RULES } from "./effect/index.mjs"

const TYPESCRIPT_FILES = ["**/*.{ts,tsx,mts,cts}"]

const restrict = (rules) => ({ "no-restricted-syntax": ["error", ...rules] })

/**
 * @returns {import('eslint').Linter.Config[]}
 */
export const scopes = () => [
  {
    // Repository tooling, benchmarks and anything not claimed below.
    name: "theoria/effect/core",
    files: TYPESCRIPT_FILES,
    ignores: FRAMEWORK_CONFIG_PATTERNS,
    rules: restrict(CORE_RULES)
  },
  {
    // Published packages: src, test, examples, scripts and benchmarks.
    name: "theoria/effect/packages",
    files: ["packages/**/*.{ts,tsx,mts,cts}"],
    ignores: FRAMEWORK_CONFIG_PATTERNS,
    rules: restrict(LIBRARY_RULES)
  },
  {
    // Application servers, workers, scripts and tests.
    name: "theoria/effect/apps",
    files: ["apps/**/*.{ts,mts,cts}"],
    ignores: FRAMEWORK_CONFIG_PATTERNS,
    rules: restrict(APPLICATION_RULES)
  },
  {
    // React view code.
    name: "theoria/effect/views",
    files: ["apps/**/*.tsx"],
    rules: restrict(VIEW_RULES)
  }
]
