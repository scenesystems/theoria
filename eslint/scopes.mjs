/**
 * Effect discipline scope.
 *
 * One rule set applies to every TypeScript file in the repository: packages,
 * application code, React views, scripts, tests and benchmarks alike.
 * Framework configuration files carry no Effect rules.
 *
 * Shipped code additionally may not name the browser's globals: `window` and
 * `document` are acquired once in the platform module and reach everything
 * else as services. Test code is not in this scope because Playwright's
 * `page.evaluate` callbacks run inside the page, where the DOM is the only
 * API there is.
 *
 * @module eslint/scopes
 */

import { FRAMEWORK_CONFIG_PATTERNS } from "./base.mjs"
import { BROWSER_GLOBALS } from "./effect/builtins.mjs"
import { EFFECT_RULES } from "./effect/index.mjs"

/** Code that ships: packages, application code and repository scripts. */
const SHIPPED_CODE_PATTERNS = ["packages/*/src/**/*.{ts,tsx}", "apps/*/app/**/*.{ts,tsx}", "scripts/**/*.ts"]

/** The one module that acquires the browser's globals. */
const PLATFORM_MODULE_PATTERNS = ["apps/*/app/web/platform/**"]

/**
 * @returns {import('eslint').Linter.Config[]}
 */
export const scopes = () => [
  {
    name: "theoria/effect",
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: FRAMEWORK_CONFIG_PATTERNS,
    rules: { "no-restricted-syntax": ["error", ...EFFECT_RULES] }
  },
  {
    name: "theoria/effect/browser-boundary",
    files: SHIPPED_CODE_PATTERNS,
    ignores: PLATFORM_MODULE_PATTERNS,
    rules: { "no-restricted-globals": ["error", ...BROWSER_GLOBALS] }
  }
]
