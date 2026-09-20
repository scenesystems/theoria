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

import { Array, Match, String } from "effect"

import { BROWSER_GLOBALS, MATH_GLOBAL, NUMBER_PARSING_GLOBALS } from "./effect/builtins.mjs"
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

/** Only softplus's two authorized asymptotic guards, not arbitrary native control flow. */
const SOFTPLUS_GUARDS = Array.map(
  [
    "IfStatement[test.operator='>'][test.left.name='x'][test.right.value=33.3][consequent.type='ReturnStatement'][consequent.argument.name='x']",
    "IfStatement[test.operator='>'][test.left.name='x'][test.right.type='UnaryExpression'][test.right.operator='-'][test.right.argument.value=37][consequent.type='ReturnStatement'][consequent.argument.callee.name='log1p']"
  ],
  (guard) =>
    `ExportNamedDeclaration > VariableDeclaration[kind='const'] > VariableDeclarator[id.name='log1pexp'] > ArrowFunctionExpression.init > BlockStatement.body > ${guard}`
)

/** Only the specifically authorized log-space return guards, not general control flow. */
const LOGSPACE_GUARDS = Array.appendAll(
  Array.append(
    SOFTPLUS_GUARDS,
    "ExportNamedDeclaration > VariableDeclaration[kind='const'] > VariableDeclarator[id.name=/^(xlogy|xlog1py)$/] > ArrowFunctionExpression.init > BlockStatement.body > IfStatement[test.callee.object.name='Number'][test.callee.property.name='Equivalence'][test.arguments.length=2][test.arguments.0.name='x'][test.arguments.1.value=0][consequent.type='ReturnStatement'][consequent.argument.value=0]"
  ),
  Array.map(
    [0, 1],
    (ordering) =>
      `ExportNamedDeclaration > VariableDeclaration[kind='const'] > VariableDeclarator[id.name='logaddexp'] > ArrowFunctionExpression.init > BlockStatement.body > IfStatement[test.operator='==='][test.left.name='ordering'][test.right.value=${ordering}][consequent.type='ReturnStatement'][consequent.argument.callee.name='sum']`
  )
)

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
    rules: { "no-restricted-globals": ["error", MATH_GLOBAL, ...NUMBER_PARSING_GLOBALS] }
  },
  {
    name: "theoria/effect/browser-boundary",
    files: ["**/*.{ts,tsx,mts,cts}"],
    ignores: PLATFORM_MODULE_PATTERNS,
    rules: { "no-restricted-globals": ["error", MATH_GLOBAL, ...NUMBER_PARSING_GLOBALS, ...BROWSER_GLOBALS] }
  },
  {
    name: "theoria/effect/logspace-guards",
    files: ["packages/effect-math/src/internal/numeric/logspace.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...Array.map(EFFECT_RULES, (rule) =>
          Match.value(rule.selector).pipe(
            Match.when("IfStatement", () => ({
              ...rule,
              selector: `${rule.selector}:not(${Array.join(LOGSPACE_GUARDS, ", ")})`
            })),
            Match.when(String.startsWith("BinaryExpression[operator=/^"), () => ({
              ...rule,
              selector: `${rule.selector}:not(${
                Array.join(Array.map(LOGSPACE_GUARDS, (guard) => `${guard} > BinaryExpression.test`), ", ")
              })`
            })),
            Match.orElse(() => rule)
          ))
      ]
    }
  },
  // Authorized binary64 intrinsics and numerical extrema. Permit only their direct,
  // identically named const exports in the owning modules, not general Math
  // access, calls, aliases, computed properties, or other operations.
  ...[
    ["binary", ["abs", "min", "max", "floor", "ceil", "sqrt", "hypot", "log2", "pow"]],
    ["transcendental", ["log", "log1p", "log10", "exp", "expm1", "sin", "cos", "atan2", "sinh", "cosh"]]
  ].map(([module, operations]) => ({
    name: `theoria/effect/numeric-${module}`,
    files: [`packages/effect-math/src/internal/numeric/${module}.ts`],
    rules: {
      "no-restricted-globals": ["error", ...NUMBER_PARSING_GLOBALS, ...BROWSER_GLOBALS],
      "no-restricted-syntax": [
        "error",
        ...EFFECT_RULES,
        {
          selector: `Identifier[name='Math']:not(${
            operations.map((operation) =>
              `ExportNamedDeclaration > VariableDeclaration[kind='const'] > VariableDeclarator[id.name='${operation}'] > MemberExpression.init[computed=false][property.name='${operation}'] > Identifier.object`
            ).join(", ")
          })`,
          message: "Only the explicitly listed direct intrinsic exports are allowed in their numeric owners."
        }
      ]
    }
  }))
]
