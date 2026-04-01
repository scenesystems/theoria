/**
 * ESLint Configuration for theoria monorepo
 *
 * Enforces Effect-native discipline across all packages.
 * TS formatting is handled by @effect/eslint-plugin (dprint), not prettier.
 * Prettier handles markdown/json/yaml only (see .prettierignore).
 */

import js from "@eslint/js"
import tseslint from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"
import * as effectEslint from "@effect/eslint-plugin"

// ─── File Patterns ────────────────────────────────────────────────────────────
// Shared constants for consistent targeting across config blocks.

const TS_FILES = ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"]
const SRC_FILES = ["packages/*/src/**/*.ts", "packages/*/src/**/*.mts", "packages/*/src/**/*.cts"]
const TEST_FILES = ["packages/*/test/**/*.ts", "packages/*/test/**/*.mts", "packages/*/test/**/*.cts"]
const EXAMPLE_FILES = ["packages/*/examples/**/*.ts", "packages/*/examples/**/*.mts"]
const APP_SRC_FILES = [
  "apps/*/server.ts",
  "apps/*/src/**/*.ts",
  "apps/*/src/**/*.tsx",
  "apps/*/app/**/*.ts",
  "apps/*/app/**/*.tsx"
]
const APP_TEST_FILES = ["apps/*/test/**/*.ts", "apps/*/test/**/*.mts", "apps/*/test/**/*.cts"]
const FIXTURE_FILES = ["packages/*/test/fixtures/**/*.ts"]
const PACKAGE_FILES = [...SRC_FILES, ...TEST_FILES, ...EXAMPLE_FILES]
const APP_FILES = [...APP_SRC_FILES, ...APP_TEST_FILES]
const EFFECT_FILES = [...PACKAGE_FILES, ...APP_FILES]

// ─── Effect Anti-Pattern Rules ────────────────────────────────────────────────
// Full Effect-native discipline. Applied to src/, test/, and examples/.

const EFFECT_RULES = [
  // ── no-async ────────────────────────────────────────────────────────────
  { selector: "FunctionDeclaration[async=true]", message: "Do not use async functions. Use Effect.gen with yield* and Effect.tryPromise." },
  { selector: "FunctionExpression[async=true]", message: "Do not use async functions. Use Effect.gen with yield* and Effect.tryPromise." },
  { selector: "ArrowFunctionExpression[async=true]", message: "Do not use async arrow functions. Use Effect.gen with yield* and Effect.tryPromise." },
  { selector: "NewExpression[callee.name='Promise']", message: "Do not use 'new Promise()'. Use Effect.tryPromise instead." },
  { selector: "CallExpression[callee.object.name='Promise'][callee.property.name='resolve']", message: "Do not use 'Promise.resolve()'. Use Effect.succeed instead." },
  { selector: "CallExpression[callee.object.name='Promise'][callee.property.name='reject']", message: "Do not use 'Promise.reject()'. Use yield* new MyError() with Schema.TaggedError." },
  { selector: "CallExpression[callee.object.name='Promise'][callee.property.name='all']", message: "Do not use 'Promise.all()'. Use Effect.all instead." },
  { selector: "CallExpression[callee.object.name='Promise'][callee.property.name='race']", message: "Do not use 'Promise.race()'. Use Effect.raceAll instead." },
  { selector: "CallExpression[callee.object.name='Promise'][callee.property.name='allSettled']", message: "Do not use 'Promise.allSettled()'. Use Effect.forEach + Effect.either instead." },
  { selector: "CallExpression[callee.object.name='Promise'][callee.property.name='any']", message: "Do not use 'Promise.any()'. Use Effect.raceAll instead." },
  { selector: "AwaitExpression", message: "Do not use 'await'. Use Effect.gen with yield* for async operations." },

  // ── no-throw-try ────────────────────────────────────────────────────────
  { selector: "ThrowStatement", message: "Do not use 'throw'. Use yield* new MyError() with Data.TaggedError or Schema.TaggedError. For defects: Effect.die()." },
  { selector: "TryStatement", message: "Do not use try/catch. Use Effect.tryPromise with a catch handler or Effect.catchTag/catchTags." },

  // ── no-new-error ────────────────────────────────────────────────────────
  { selector: "NewExpression[callee.name='Error']", message: "Do not use 'new Error()'. Use Data.TaggedError or Schema.TaggedError for typed errors." },
  { selector: "NewExpression[callee.name='TypeError']", message: "Do not use 'new TypeError()'. Use Data.TaggedError or Schema.TaggedError." },
  { selector: "NewExpression[callee.name='RangeError']", message: "Do not use 'new RangeError()'. Use Data.TaggedError or Schema.TaggedError." },

  // ── no-console ──────────────────────────────────────────────────────────
  { selector: "CallExpression[callee.object.name='console'][callee.property.name='log']", message: "Do not use 'console.log()'. Use Effect.log() instead." },
  { selector: "CallExpression[callee.object.name='console'][callee.property.name='error']", message: "Do not use 'console.error()'. Use Effect.logError() instead." },
  { selector: "CallExpression[callee.object.name='console'][callee.property.name='warn']", message: "Do not use 'console.warn()'. Use Effect.logWarning() instead." },
  { selector: "CallExpression[callee.object.name='console'][callee.property.name='time']", message: "Do not use 'console.time()'. Use Effect.withSpan() instead." },
  { selector: "CallExpression[callee.object.name='console'][callee.property.name='timeEnd']", message: "Do not use 'console.timeEnd()'. Use Effect.withSpan() instead." },

  // ── no-let ──────────────────────────────────────────────────────────────
  { selector: "VariableDeclaration[kind='let']", message: "Do not use 'let'. Use 'const' for bindings. For mutable state, use Ref from 'effect'." },

  // ── imperative-loops ────────────────────────────────────────────────────
  { selector: "ForStatement", message: "Do not use 'for' loops. Use Arr.map, Arr.filter, Effect.forEach, or pipe." },
  { selector: "ForInStatement", message: "Do not use 'for...in'. Use Record.toEntries or Record.keys from 'effect'." },
  { selector: "ForOfStatement", message: "Do not use 'for...of'. Use Arr.map, Arr.forEach, or Effect.forEach." },
  { selector: "WhileStatement", message: "Do not use 'while'. Use Effect.iterate or Effect.loop." },
  { selector: "DoWhileStatement", message: "Do not use 'do...while'. Use Effect.iterate or Effect.loop." },

  // ── switch-statement ────────────────────────────────────────────────────
  { selector: "SwitchStatement", message: "Do not use switch statements. Use Match.type<T>().pipe(Match.tag(...), Match.exhaustive) from effect." },

  // ── collections ─────────────────────────────────────────────────────────
  { selector: "NewExpression[callee.name='Map']", message: "Do not use 'new Map()'. Use HashMap from 'effect/HashMap'." },
  { selector: "NewExpression[callee.name='Set']", message: "Do not use 'new Set()'. Use HashSet from 'effect/HashSet'." },
  { selector: "NewExpression[callee.name='WeakMap']", message: "Do not use 'new WeakMap()'. Use HashMap from 'effect/HashMap'." },
  { selector: "NewExpression[callee.name='WeakSet']", message: "Do not use 'new WeakSet()'. Use HashSet from 'effect/HashSet'." },

  // ── time-randomness ─────────────────────────────────────────────────────
  { selector: "NewExpression[callee.name='Date']", message: "Do not use 'new Date()'. Use Clock.currentTimeMillis from 'effect'." },
  { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: "Do not use 'Date.now()'. Use Clock.currentTimeMillis from 'effect'." },
  { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: "Do not use 'Math.random()'. Use Random from 'effect'." },

  // ── type-assertions ─────────────────────────────────────────────────────
  { selector: "TSAsExpression", message: "Do not use 'as' type assertions. Use Schema.decodeUnknown for runtime validation." },
  { selector: "TSAsExpression[expression.type='TSAsExpression']", message: "Do not use double 'as' assertions. Use Schema.decodeUnknown." },
  { selector: "TSSatisfiesExpression", message: "Do not use 'satisfies'. Use Schema.is or Schema.decodeUnknown." },

  // ── error-swallowing ────────────────────────────────────────────────────
  { selector: "CallExpression[callee.property.name='catchAll'] ArrowFunctionExpression CallExpression[callee.object.name='Effect'][callee.property.name='succeed'] Literal[value=null]", message: "Do not swallow errors with Effect.catchAll(() => Effect.succeed(null)). Use Option.none() or handle explicitly." },
  { selector: "CallExpression[callee.property.name='catchAll'] ArrowFunctionExpression CallExpression[callee.object.name='Effect'][callee.property.name='succeed'] Identifier[name='undefined']", message: "Do not swallow errors with Effect.catchAll(() => Effect.succeed(undefined))." },
  { selector: "CallExpression[callee.property.name='catchTag'] ArrowFunctionExpression CallExpression[callee.object.name='Effect'][callee.property.name='succeed'] Literal[value=null]", message: "Do not swallow errors with Effect.catchTag(() => Effect.succeed(null))." },
  { selector: "CallExpression[callee.property.name='catchTag'] ArrowFunctionExpression CallExpression[callee.object.name='Effect'][callee.property.name='succeed'] Identifier[name='undefined']", message: "Do not swallow errors with Effect.catchTag(() => Effect.succeed(undefined))." },
  { selector: "CallExpression[callee.property.name='catchAll'] ArrowFunctionExpression CallExpression[callee.object.name='Effect'][callee.property.name='succeed'] ArrayExpression[elements.length=0]", message: "Do not swallow errors with Effect.catchAll(() => Effect.succeed([]))." },
  { selector: "Property[key.name='catch'] > ArrowFunctionExpression[body.type='Literal'][body.value=null]", message: "Do not swallow errors with catch: () => null. Return typed error instead." },
  { selector: "Property[key.name='catch'] > ArrowFunctionExpression[body.type='Identifier'][body.name='undefined']", message: "Do not swallow errors with catch: () => undefined. Return typed error instead." },
  { selector: "Property[key.name='catch'] > ArrowFunctionExpression[body.type='Identifier'][body.name=/^e$|^err$|^error$/]", message: "Do not use catch: (e) => e. Wrap in typed error: new MyError({ cause: e })." },

  // ── promise-chaining ────────────────────────────────────────────────────
  { selector: "CallExpression[callee.property.name='then']", message: "Do not use '.then()'. Use Effect.map or Effect.andThen." },
  { selector: "CallExpression[callee.property.name='catch'][callee.object.type!='Identifier']", message: "Do not use '.catch()'. Use Effect.catchAll or Effect.catchTag." },
  { selector: "CallExpression[callee.property.name='finally']", message: "Do not use '.finally()'. Use Effect.ensuring." },

  // ── json-builtins ───────────────────────────────────────────────────────
  { selector: "CallExpression[callee.object.name='JSON'][callee.property.name='parse']", message: "Do not use 'JSON.parse()'. Use Schema.decode or Schema.decodeUnknown." },
  { selector: "CallExpression[callee.object.name='JSON'][callee.property.name='stringify']", message: "Do not use 'JSON.stringify()'. Use Schema.encode." },

  // ── object-builtins ─────────────────────────────────────────────────────
  { selector: "CallExpression[callee.object.name='Object'][callee.property.name='entries']", message: "Do not use 'Object.entries()'. Use Record.toEntries from 'effect'." },
  { selector: "CallExpression[callee.object.name='Object'][callee.property.name='keys']", message: "Do not use 'Object.keys()'. Use Record.keys from 'effect'." },
  { selector: "CallExpression[callee.object.name='Object'][callee.property.name='fromEntries']", message: "Do not use 'Object.fromEntries()'. Use Record.fromEntries from 'effect'." },
  { selector: "CallExpression[callee.object.name='Object'][callee.property.name='assign']", message: "Do not use 'Object.assign()'. Use object spread or Record.union." },
  { selector: "CallExpression[callee.object.name='Object'][callee.property.name='create']", message: "Do not use 'Object.create()'. Use object literals or Schema.Class." },
  { selector: "CallExpression[callee.object.name='Object'][callee.property.name='values']", message: "Do not use 'Object.values()'. Use Record.values from 'effect'." },

  // ── array-mutations ─────────────────────────────────────────────────────
  { selector: "CallExpression[callee.property.name='push'] > SpreadElement.arguments", message: "Do not use spread in Array.push. Use Arr.appendAll from 'effect'." },
  { selector: "CallExpression[callee.property.name='push']", message: "Do not use Array.push(). Use Arr.append or Arr.appendAll from 'effect'." },

  // ── entry-point ─────────────────────────────────────────────────────────
  { selector: "CallExpression[callee.object.name='Effect'][callee.property.name='runPromise']", message: "Do not use 'Effect.runPromise' in library code. Use Runtime.runMain at the entry point." },
  { selector: "CallExpression[callee.object.name='Effect'][callee.property.name='runSync']", message: "Do not use 'Effect.runSync' in library code. Use Runtime.runMain at the entry point." },
  { selector: "CallExpression[callee.object.name='Effect'][callee.property.name='runFork']", message: "Do not use 'Effect.runFork' in library code. Use Runtime.runMain at the entry point." },
  { selector: "CallExpression[callee.object.name='Effect'][callee.property.name='runPromiseExit']", message: "Do not use 'Effect.runPromiseExit' in library code. Use Runtime.runMain at the entry point." },

  // ── utility-types ───────────────────────────────────────────────────────
  { selector: "TSTypeReference[typeName.name='ReturnType']", message: "Do not use 'ReturnType<>'. Derive types from Schema instead." },
  { selector: "TSTypeReference[typeName.name='InstanceType']", message: "Do not use 'InstanceType<>'. Derive types from Schema instead." },
  { selector: "TSTypeReference[typeName.name='Awaited']", message: "Do not use 'Awaited<>'. Use Effect types directly." },
  { selector: "TSTypeReference[typeName.name='Parameters']", message: "Do not use 'Parameters<>'. Use Schema types or explicit types." },
  { selector: "TSTypeReference[typeName.name='Partial']", message: "Do not use 'Partial<>'. Use Schema.partial instead." },
  { selector: "TSTypeReference[typeName.name='Pick']", message: "Do not use 'Pick<>'. Use Schema.pick instead." },
  { selector: "TSTypeReference[typeName.name='Omit']", message: "Do not use 'Omit<>'. Use Schema.omit instead." },
  { selector: "TSTypeReference[typeName.name='Required']", message: "Do not use 'Required<>'. Use Schema.required instead." },

  // ── type-modeling ───────────────────────────────────────────────────────
  { selector: "TSInterfaceDeclaration", message: "Do not use TypeScript interfaces. Model runtime contracts with Schema.Class, Schema.TaggedClass, or Data.TaggedClass." },
  { selector: "TSTypeAliasDeclaration[typeAnnotation.type='TSTypeLiteral']", message: "Do not use object-literal type aliases as runtime carriers. Promote to Schema.Class/Data.Class or a schema-derived type alias." },
  { selector: "TSTypeAliasDeclaration[typeAnnotation.type='TSConditionalType']", message: "Do not use conditional helper type aliases for runtime contracts. Derive from canonical Schema values instead." },
  { selector: "TSTypeAliasDeclaration[typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.type='TSQualifiedName'][typeAnnotation.typeName.left.name='Data'][typeAnnotation.typeName.right.name='TaggedEnum']", message: "Do not define event contracts as type aliases over Data.TaggedEnum. Use schema-backed runtime models or tagged class values." },
  { selector: "TSUnionType > TSUndefinedKeyword", message: "Do not model optionality with '| undefined'. Use Option<A> in runtime and Schema.optional/Schema.OptionFromSelf in schemas." },

  // ── option-undefined-interop ────────────────────────────────────────────
  { selector: "CallExpression[callee.object.name='Option'][callee.property.name='getOrUndefined']", message: "Do not bridge Option to undefined. Stay in Option space with Option.match, Option.getOrElse, or Option.map." },
  { selector: "BinaryExpression[operator='==='][left.type='Identifier'][left.name='undefined']", message: "Do not compare with undefined. Model absence with Option and pattern-match instead." },
  { selector: "BinaryExpression[operator='==='][right.type='Identifier'][right.name='undefined']", message: "Do not compare with undefined. Model absence with Option and pattern-match instead." },
  { selector: "BinaryExpression[operator='!=='][left.type='Identifier'][left.name='undefined']", message: "Do not compare with undefined. Model absence with Option and pattern-match instead." },
  { selector: "BinaryExpression[operator='!=='][right.type='Identifier'][right.name='undefined']", message: "Do not compare with undefined. Model absence with Option and pattern-match instead." },

  // ── array-builtins ──────────────────────────────────────────────────────
  { selector: "CallExpression[callee.object.name='Array'][callee.property.name='from']", message: "Do not use Array.from(). Use Arr.fromIterable from effect/Array." },
  { selector: "CallExpression[callee.object.name='Array'][callee.property.name='isArray']", message: "Do not use Array.isArray(). Use Arr.isArray or Predicate.isArray from effect." },

  // ── module-stubs ────────────────────────────────────────────────────────
  { selector: "ExportNamedDeclaration[declaration=null][source=null][specifiers.length=0]", message: "Do not leave empty 'export {}' module stubs. Implement the module or remove the file from the public/internal graph." },

  // ── tacit-usage ─────────────────────────────────────────────────────────
  { selector: "CallExpression[callee.name='flow']", message: "Do not use flow(). Use explicit arrow functions: (x) => fn2(fn1(x))." },
  { selector: "ImportDeclaration[source.value='effect'] ImportSpecifier[imported.name='flow']", message: "Do not import 'flow' from effect. Use explicit arrow functions instead." },

  // ── abort-controller ────────────────────────────────────────────────────
  { selector: "NewExpression[callee.name='AbortController']", message: "Do not use 'new AbortController()'. Use Effect.interrupt or Fiber.interrupt." },

  // ── error-type-annotation ───────────────────────────────────────────────
  { selector: "TSTypeAnnotation TSTypeReference[typeName.name='Error']", message: "Do not use 'Error' as a type annotation. Use Schema.TaggedError or Data.TaggedError." },
  { selector: "TSTypeAnnotation TSTypeReference[typeName.name='TypeError']", message: "Do not use 'TypeError' as a type annotation. Use Schema.TaggedError or Data.TaggedError." },
  { selector: "TSTypeAnnotation TSTypeReference[typeName.name='RangeError']", message: "Do not use 'RangeError' as a type annotation. Use Schema.TaggedError or Data.TaggedError." },

  // ── no-log-interpolation ────────────────────────────────────────────────
  ...["log", "logError", "logWarning", "logDebug", "logFatal"].map((method) => ({
    selector: `CallExpression[callee.object.name='Effect'][callee.property.name='${method}'] > TemplateLiteral`,
    message: "Do not use template literals in Effect.log*(). Use Effect.annotateLogs() for structured metadata."
  }))
]

const APP_EFFECT_RULES = EFFECT_RULES.filter((rule) => {
  if (typeof rule !== "object" || rule === null || !("selector" in rule) || typeof rule.selector !== "string") {
    return true
  }

  return !rule.selector.startsWith("TSInterfaceDeclaration")
    && !rule.selector.startsWith("TSTypeAliasDeclaration[typeAnnotation.type='TSTypeLiteral']")
    && !rule.selector.startsWith("TSTypeAliasDeclaration[typeAnnotation.type='TSConditionalType']")
    && !rule.selector.startsWith("TSTypeAliasDeclaration[typeAnnotation.type='TSTypeReference']")
})

// React component props fundamentally use `| undefined` and `=== undefined`.
// TSX view files relax these rules while keeping all other Effect discipline.
const APP_TSX_EFFECT_RULES = APP_EFFECT_RULES.filter((rule) => {
  if (typeof rule !== "object" || rule === null || !("selector" in rule) || typeof rule.selector !== "string") {
    return true
  }

  return !rule.selector.startsWith("TSUnionType > TSUndefinedKeyword")
    && !rule.selector.startsWith("BinaryExpression[operator='==='][right.type='Identifier'][right.name='undefined']")
    && !rule.selector.startsWith("BinaryExpression[operator='==='][left.type='Identifier'][left.name='undefined']")
    && !rule.selector.startsWith("BinaryExpression[operator='!=='][right.type='Identifier'][right.name='undefined']")
    && !rule.selector.startsWith("BinaryExpression[operator='!=='][left.type='Identifier'][left.name='undefined']")
    && !rule.selector.startsWith("CallExpression[callee.object.name='Option'][callee.property.name='getOrUndefined']")
    && !rule.selector.startsWith("TSTypeReference[typeName.name='Omit']")
})

// ─── Config ───────────────────────────────────────────────────────────────────

/** @type {import('eslint').Linter.Config[]} */
export default [
  // ── 1. Ignores ──────────────────────────────────────────────────────────
  {
    name: "theoria/ignores",
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/docs/**",
      "**/node_modules/**",
      "**/__snapshots__/**",
      "**/fixtures/**/*.json",
      "*.config.mjs",
      ".vendor/**",
      ".tmp/**"
    ]
  },

  // ── 2. Base rules ──────────────────────────────────────────────────────
  {
    name: "theoria/base",
    ...js.configs.recommended
  },

  // ── 3. TypeScript ───────────────────────────────────────────────────────
  {
    name: "theoria/typescript",
    files: TS_FILES,
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: {
        jsx: true
      },
      globals: {
        console: "readonly",
        process: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      // Disable base rules that conflict with TS
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      "no-fallthrough": "off",
      "no-irregular-whitespace": "off",
      "require-yield": "off",

      // TypeScript rules
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-types": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-interface": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/array-type": ["warn", { default: "generic", readonly: "generic" }],

      // Style
      "object-shorthand": "error",
      "sort-imports": "off"
    }
  },

  // ── 4. dprint formatting (Effect ecosystem convention) ──────────────────
  {
    name: "theoria/dprint",
    files: EFFECT_FILES,
    plugins: {
      "@effect": effectEslint
    },
    rules: {
      "@effect/dprint": [
        "error",
        {
          config: {
            useTabs: false,
            indentWidth: 2,
            lineWidth: 120,
            semiColons: "asi",
            quoteStyle: "alwaysDouble",
            trailingCommas: "never",
            operatorPosition: "maintain",
            "arrowFunction.useParentheses": "force"
          }
        }
      ]
    }
  },

  // ── 5. Effect anti-pattern rules (src + test + examples) ─────────────────
  //    Split into named constants above so individual blocks can override
  //    for src-only or test-only rules in the future.
  {
    name: "theoria/effect-rules",
    files: PACKAGE_FILES,
    rules: {
      "no-restricted-syntax": ["error", ...EFFECT_RULES]
    }
  },

  {
    name: "theoria/app-effect-rules",
    files: APP_FILES,
    rules: {
      "no-restricted-syntax": ["error", ...APP_EFFECT_RULES]
    }
  },

  // ── 5b. TSX relaxation — React props use `| undefined` inherently ──────
  {
    name: "theoria/app-tsx-rules",
    files: ["apps/*/app/**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...APP_TSX_EFFECT_RULES]
    }
  },

  // ── 6. Fixture files (relaxed) ──────────────────────────────────────────
  {
    name: "theoria/fixtures",
    files: FIXTURE_FILES,
    rules: {
      "no-restricted-syntax": "off"
    }
  },

  // ── 7. Declaration files ────────────────────────────────────────────────
  {
    name: "theoria/declarations",
    files: ["**/*.d.ts"],
    rules: {
      "no-restricted-syntax": "off"
    }
  }
]
