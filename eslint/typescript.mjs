/**
 * TypeScript parsing and TypeScript-safe rule adjustments.
 *
 * TypeScript 7 ships no JavaScript compiler API, so typescript-eslint cannot
 * run against it. @babel/eslint-parser produces the ESTree + TS AST that the
 * `no-restricted-syntax` selectors need. TypeScript-aware lint policy (unused
 * variables, type imports, array types, explicit any, Node builtin imports)
 * is owned by .oxlintrc.json; Effect diagnostics run inside `tsc` via
 * @effect/tsgo.
 *
 * @module eslint/typescript
 */

import babelParser from "@babel/eslint-parser"

const parserOptions = (plugins) => ({
  sourceType: "module",
  requireConfigFile: false,
  babelOptions: { babelrc: false, configFile: false, parserOpts: { plugins } }
})

/**
 * @returns {import('eslint').Linter.Config[]}
 */
export const typescript = () => [
  {
    // The `jsx` parser plugin is enabled only for .tsx: with it on, Babel reads
    // generic arrows such as `<A>(x) => x` in .ts files as JSX.
    name: "theoria/typescript/parser",
    files: ["**/*.ts", "**/*.mts", "**/*.cts"],
    languageOptions: { parser: babelParser, parserOptions: parserOptions(["typescript"]) }
  },
  {
    name: "theoria/typescript/tsx-parser",
    files: ["**/*.tsx"],
    languageOptions: { parser: babelParser, parserOptions: parserOptions(["typescript", "jsx"]) }
  },
  {
    name: "theoria/typescript/rules",
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      // TypeScript reports these with TypeScript-aware semantics.
      "constructor-super": "off",
      "getter-return": "off",
      "no-class-assign": "off",
      "no-const-assign": "off",
      "no-dupe-args": "off",
      "no-dupe-class-members": "off",
      "no-dupe-keys": "off",
      "no-func-assign": "off",
      "no-import-assign": "off",
      "no-new-native-nonconstructor": "off",
      "no-obj-calls": "off",
      "no-redeclare": "off",
      "no-setter-return": "off",
      "no-this-before-super": "off",
      "no-undef": "off",
      "no-unreachable": "off",
      "no-unsafe-negation": "off",
      "no-with": "off",

      // `Effect.gen(function*() { ... })` without `yield*` is a valid Effect.
      "require-yield": "off",

      // Owned by oxlint, which has TypeScript scope analysis.
      "no-unused-vars": "off",
      "no-unused-expressions": "off",

      "object-shorthand": "error",
      "sort-imports": "off"
    }
  }
]
