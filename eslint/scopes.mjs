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

import { Array, Match, Number, String } from "effect"

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

/** Measured strict-log exits and its two exact-normalization corrections only. */
const STRICT_LOG_GUARDS = [
  "VariableDeclarator[id.name='logStrict'] > ArrowFunctionExpression.init > BlockStatement.body > IfStatement[test.operator='!'][test.argument.operator='>'][test.argument.left.name='value'][test.argument.right.value=0][consequent.type='ReturnStatement'][consequent.argument.callee.name='log']",
  "VariableDeclarator[id.name='logStrict'] > ArrowFunctionExpression.init > BlockStatement.body > IfStatement[test.callee.name='positiveInfinity'][consequent.type='ReturnStatement'][consequent.argument.object.name='Binary'][consequent.argument.property.name='positiveInfinity']",
  ...Array.map(
    [9, 17, 25],
    (term) =>
      `VariableDeclarator[id.name='logarithmStrictSeries'] > ArrowFunctionExpression.init > BlockStatement.body > IfStatement[test.callee.name='Equivalence'][test.arguments.0.name='s${term}'][test.arguments.1.name='s${
        Number.subtract(term, 2)
      }'][consequent.type='ReturnStatement'][consequent.argument.name='s${term}']`
  ),
  "VariableDeclarator[id.name='logarithmStrictFinite'] > CallExpression.init[callee.object.name='Binary'][callee.property.name='withNormalized'] > ArrowFunctionExpression > BlockStatement.body > IfStatement[test.callee.name='Equivalence'][test.arguments.0.name='mantissa'][test.arguments.1.value=1][consequent.type='ReturnStatement'][consequent.argument.callee.name='multiply']",
  "VariableDeclarator[id.name='withNormalized'] > ArrowFunctionExpression.init > BlockStatement.body > VariableDeclaration > VariableDeclarator[id.name='consumeNormal'] > ArrowFunctionExpression.init > BlockStatement.body > IfStatement[test.operator='<'][test.left.name='ratio'][test.right.value=1][consequent.type='ReturnStatement'][consequent.argument.callee.name='consume']",
  "VariableDeclarator[id.name='withNormalized'] > ArrowFunctionExpression.init > BlockStatement.body > ReturnStatement > ArrowFunctionExpression > BlockStatement.body > IfStatement[test.operator='<'][test.left.name='value'][test.right.name='minimumNormal'][consequent.type='ReturnStatement'][consequent.argument.callee.name='consumeNormal']"
]

/** Constant odd divisors and the mantissa transform; not arbitrary native arithmetic. */
const STRICT_LOG_DIVISIONS = [
  ...Array.map(
    [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31],
    (term) =>
      `VariableDeclarator[id.name='logarithmStrictSeries'] > ArrowFunctionExpression.init > BlockStatement.body :matches(VariableDeclaration > VariableDeclarator, ReturnStatement) > CallExpression[callee.name='sum'] > BinaryExpression[operator='/'][left.name='t${term}'][right.value=${term}]`
  ),
  "VariableDeclarator[id.name='logarithmStrictFinite'] > CallExpression.init[callee.object.name='Binary'][callee.property.name='withNormalized'] > ArrowFunctionExpression > BlockStatement.body > VariableDeclaration > VariableDeclarator[id.name='z'] > BinaryExpression[operator='/'][left.callee.name='sum'][left.arguments.0.name='mantissa'][left.arguments.1.operator='-'][left.arguments.1.argument.value=1][right.callee.name='sum'][right.arguments.0.name='mantissa'][right.arguments.1.value=1]"
]

/** Bisection's measured exits and sign selection; arithmetic stays Effect-native. */
const BISECTION_GUARDS = [
  ...Array.map(
    [
      "IfStatement[test.operator='<'][test.left.callee.name='abs'][test.right.name='tolerance'][consequent.argument.callee.name='midpoint']",
      "IfStatement[test.callee.name='Equivalence'][test.arguments.0.name='remaining'][test.arguments.1.value=0][consequent.argument.callee.name='exhausted']",
      "IfStatement[test.callee.name='Equivalence'][test.arguments.0.name='remaining'][test.arguments.1.value=1][consequent.argument.callee.name='exhausted']",
      "IfStatement[test.callee.name='Equivalence'][test.arguments.0.name=/^(value|nextValue)$/][test.arguments.1.value=0][consequent.argument.name=/^(mid|nextMid)$/]",
      "IfStatement[test.operator='==='][test.left.operator='<'][test.left.left.name='nextValue'][test.left.right.value=0][test.right.name='negative'][consequent.type='BlockStatement']:has(ReturnStatement > CallExpression[callee.name='narrow'])"
    ],
    (guard) => `VariableDeclarator[id.name='narrow'] > ArrowFunctionExpression.init > BlockStatement.body > ${guard}`
  ),
  "VariableDeclarator[id.name='bisect'] > ArrowFunctionExpression.init > BlockStatement.body > IfStatement[test.callee.object.name='Number'][test.callee.property.name='Equivalence'][test.arguments.1.value=0][consequent.type='ReturnStatement'][consequent.argument.name=/^(a|b)$/]",
  "VariableDeclarator[id.name='bisect'] > ArrowFunctionExpression.init > BlockStatement.body > IfStatement[test.callee.object.name='Boolean'][test.callee.property.name='not'][consequent.type='BlockStatement']:has(ReturnStatement > CallExpression[callee.name='narrow'])"
]

const BISECTION_SIGN =
  "VariableDeclarator[id.name='narrow'] > ArrowFunctionExpression.init > BlockStatement.body > VariableDeclaration > VariableDeclarator[id.name='sameSign'] > BinaryExpression.init[operator='==='][left.operator='<'][left.left.name='value'][left.right.value=0][right.name='negative']"

const GOLDEN_SECTION_GUARDS = [
  ...Array.map(
    [
      "IfStatement[test.operator='<'][test.left.callee.name='abs'][test.right.name='tolerance'][consequent.argument.callee.name='midpoint']",
      "IfStatement[test.callee.name='Equivalence'][test.arguments.0.name='remaining'][test.arguments.1.value=0][consequent.argument.callee.name='exhausted']",
      "IfStatement[test.callee.name='Equivalence'][test.arguments.0.name='remaining'][test.arguments.1.value=1][consequent.argument.callee.name='exhausted']",
      "IfStatement[test.operator='<'][test.left.name='nextY1'][test.right.name='nextY2'][consequent.type='BlockStatement']:has(ReturnStatement > CallExpression[callee.name='narrow'])"
    ],
    (guard) => `VariableDeclarator[id.name='narrow'] > ArrowFunctionExpression.init > BlockStatement.body > ${guard}`
  ),
  "VariableDeclarator[id.name='goldenSection'] > ArrowFunctionExpression.init > BlockStatement.body > IfStatement[test.callee.object.name='Boolean'][test.callee.property.name='not'][consequent.type='BlockStatement']:has(ReturnStatement > CallExpression[callee.name='narrow'])"
]

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
  {
    name: "theoria/effect/bisection-guards",
    files: ["packages/effect-math/src/internal/optimization/bisect.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...Array.map(EFFECT_RULES, (rule) =>
          Match.value(rule.selector).pipe(
            Match.when("IfStatement", () => ({
              ...rule,
              selector: `${rule.selector}:not(${Array.join(BISECTION_GUARDS, ", ")})`
            })),
            Match.when("ConditionalExpression", () => ({
              ...rule,
              selector:
                `${rule.selector}:not(VariableDeclarator[id.name='narrow'] > ArrowFunctionExpression.init > BlockStatement.body > VariableDeclaration > VariableDeclarator[id.name=/^(nextA|nextB)$/] > ConditionalExpression.init[test.name='sameSign'])`
            })),
            Match.when(String.startsWith("BinaryExpression[operator=/^"), () => ({
              ...rule,
              selector: `${rule.selector}:not(${
                Array.join(
                  Array.appendAll(
                    Array.flatMap(BISECTION_GUARDS, (guard) => [
                      `${guard} > BinaryExpression.test`,
                      `${guard} > BinaryExpression.test > BinaryExpression.left`
                    ]),
                    [BISECTION_SIGN, `${BISECTION_SIGN} > BinaryExpression.left`]
                  ),
                  ", "
                )
              })`
            })),
            Match.orElse(() => rule)
          ))
      ]
    }
  },
  {
    name: "theoria/effect/golden-section-guards",
    files: ["packages/effect-math/src/internal/optimization/goldenSection.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...Array.map(EFFECT_RULES, (rule) =>
          Match.value(rule.selector).pipe(
            Match.when("IfStatement", () => ({
              ...rule,
              selector: `${rule.selector}:not(${Array.join(GOLDEN_SECTION_GUARDS, ", ")})`
            })),
            Match.when("ConditionalExpression", () => ({
              ...rule,
              selector:
                `${rule.selector}:not(VariableDeclarator[id.name='narrow'] > ArrowFunctionExpression.init > BlockStatement.body > VariableDeclaration > VariableDeclarator[id.name=/^(next|nextA|nextB|nextX1|nextX2|nextY1|nextY2)$/] > ConditionalExpression.init[test.name='left'])`
            })),
            Match.when(String.startsWith("BinaryExpression[operator=/^"), () => ({
              ...rule,
              selector: `${rule.selector}:not(${
                Array.join(Array.map(GOLDEN_SECTION_GUARDS, (guard) => `${guard} > BinaryExpression.test`), ", ")
              }, VariableDeclarator[id.name='narrow'] > ArrowFunctionExpression.init > BlockStatement.body > VariableDeclaration > VariableDeclarator[id.name='left'] > BinaryExpression.init[operator='<'][left.name='y1'][right.name='y2'])`
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
        ...Array.map(EFFECT_RULES, (rule) =>
          Match.value(rule.selector).pipe(
            Match.when("IfStatement", () => ({
              ...rule,
              selector: `${rule.selector}:not(${Array.join(STRICT_LOG_GUARDS, ", ")})`
            })),
            Match.when("BinaryExpression[operator='/']", () => ({
              ...rule,
              selector: `${rule.selector}:not(${Array.join(STRICT_LOG_DIVISIONS, ", ")})`
            })),
            Match.when(String.startsWith("BinaryExpression[operator=/^"), () => ({
              ...rule,
              selector: `${rule.selector}:not(${
                Array.join(
                  Array.flatMap(STRICT_LOG_GUARDS, (guard) => [
                    `${guard} > BinaryExpression.test`,
                    `${guard} > UnaryExpression.test > BinaryExpression.argument`
                  ]),
                  ", "
                )
              })`
            })),
            Match.when("UnaryExpression[operator=/^(!|typeof)$/]", () => ({
              ...rule,
              selector: `${rule.selector}:not(${Array.unsafeGet(STRICT_LOG_GUARDS, 0)} > UnaryExpression.test)`
            })),
            Match.orElse(() => rule)
          )),
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
