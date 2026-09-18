/**
 * Effect discipline scope.
 *
 * One rule set applies to every TypeScript file in the repository: packages,
 * application code, React views, scripts, tests and benchmarks alike.
 * The five framework configuration entry points carry the same rules, with
 * Effect.runSync permitted only to materialize that synchronous host value.
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

import { BROWSER_GLOBALS, MATH_GLOBAL } from "./effect/builtins.mjs"
import { DESIGN_TOKEN_RULES } from "./effect/design-tokens.mjs"
import { CONFIG_HOST_EFFECT_RULES, EFFECT_RULES } from "./effect/index.mjs"

/** The repository's framework-owned, synchronous configuration entry points. */
const CONFIG_HOST_BOUNDARY_PATTERNS = [
  "vitest.config.ts",
  "apps/theoria/vite.config.ts",
  "apps/theoria/vitest.config.ts",
  "apps/theoria/vitest.worker.config.ts",
  "packages/sign/vitest.worker.config.ts"
]

/**
 * The modules that name the host's globals: the app's web platform module,
 * which acquires them as services, and each test suite's platform module
 * (`apps/*\/test/<suite>/platform/`), the one place that suite's fixtures
 * reach a host object.
 */
const PLATFORM_MODULE_PATTERNS = ["apps/*/app/web/platform/**", "apps/*/test/*/platform/**"]

/** The web views, whose class strings read the layout and motion contracts' tokens and no other scale. */
const WEB_VIEW_PATTERNS = ["apps/*/app/web/**/*.{ts,tsx}"]

/**
 * @returns {import('eslint').Linter.Config[]}
 */
export const scopes = () => [
  {
    name: "theoria/effect",
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: CONFIG_HOST_BOUNDARY_PATTERNS,
    rules: { "no-restricted-syntax": ["error", ...EFFECT_RULES] }
  },
  {
    name: "theoria/effect/config-host-boundary",
    files: CONFIG_HOST_BOUNDARY_PATTERNS,
    rules: { "no-restricted-syntax": ["error", ...CONFIG_HOST_EFFECT_RULES] }
  },
  {
    name: "theoria/effect/design-tokens",
    files: WEB_VIEW_PATTERNS,
    rules: { "no-restricted-syntax": ["error", ...EFFECT_RULES, ...DESIGN_TOKEN_RULES] }
  },
  {
    name: "theoria/effect/math-global",
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: { "no-restricted-globals": ["error", MATH_GLOBAL] }
  },
  {
    name: "theoria/effect/browser-boundary",
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: PLATFORM_MODULE_PATTERNS,
    rules: { "no-restricted-globals": ["error", MATH_GLOBAL, ...BROWSER_GLOBALS] }
  }
]
