/**
 * Effect discipline scope.
 *
 * One rule set applies to every TypeScript file in the repository: packages,
 * application code, React views, scripts, tests and benchmarks alike.
 * Framework configuration files carry no Effect rules.
 *
 * No file may name the host's globals except the platform modules:
 * `window`, `document` and `navigator` are acquired once in the app's web
 * platform module and reach everything else as services, the DOM constructors
 * and observers are read from the window that service provides, and each test
 * suite that must touch a host object keeps that in its own platform module:
 * the worker tests' functions Playwright runs inside the page, and the server
 * tests' one web `Request` that `HttpServerRequest.fromWeb` turns into a
 * server request.
 *
 * @module eslint/scopes
 */

import { FRAMEWORK_CONFIG_PATTERNS } from "./base.mjs"
import { BROWSER_GLOBALS } from "./effect/builtins.mjs"
import { EFFECT_RULES } from "./effect/index.mjs"

/**
 * The modules that name the host's globals: the app's web platform module,
 * which acquires them as services, and each test suite's platform module
 * (`apps/*\/test/<suite>/platform/`), the one place that suite's fixtures
 * reach a host object.
 */
const PLATFORM_MODULE_PATTERNS = ["apps/*/app/web/platform/**", "apps/*/test/*/platform/**"]

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
