/**
 * Effect discipline scope.
 *
 * One rule set applies to every TypeScript file in the repository: packages,
 * application code, React views, scripts, tests and benchmarks alike.
 * Framework configuration files carry no Effect rules.
 *
 * No file may name the browser's globals except the platform modules:
 * `window`, `document` and `navigator` are acquired once in the app's platform
 * module and reach everything else as services, and the worker tests keep the
 * functions Playwright runs inside the page in their own platform module.
 *
 * @module eslint/scopes
 */

import { FRAMEWORK_CONFIG_PATTERNS } from "./base.mjs"
import { BROWSER_GLOBALS } from "./effect/builtins.mjs"
import { EFFECT_RULES } from "./effect/index.mjs"

/**
 * The modules that name the browser's globals: the app's platform module,
 * which acquires them as services, and the worker tests' in-page module, whose
 * functions Playwright serialises and runs inside the page.
 */
const PLATFORM_MODULE_PATTERNS = ["apps/*/app/web/platform/**", "apps/*/test/worker/platform/**"]

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
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: [...FRAMEWORK_CONFIG_PATTERNS, ...PLATFORM_MODULE_PATTERNS],
    rules: { "no-restricted-globals": ["error", ...BROWSER_GLOBALS] }
  }
]
