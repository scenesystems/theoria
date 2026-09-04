/**
 * Effect discipline scope.
 *
 * One rule set applies to every TypeScript file in the repository: packages,
 * application code, React views, scripts, tests and benchmarks alike.
 * Framework configuration files carry no Effect rules.
 *
 * @module eslint/scopes
 */

import { FRAMEWORK_CONFIG_PATTERNS } from "./base.mjs"
import { EFFECT_RULES } from "./effect/index.mjs"

/**
 * @returns {import('eslint').Linter.Config[]}
 */
export const scopes = () => [
  {
    name: "theoria/effect",
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: FRAMEWORK_CONFIG_PATTERNS,
    rules: { "no-restricted-syntax": ["error", ...EFFECT_RULES] }
  }
]
