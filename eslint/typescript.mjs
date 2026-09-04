/**
 * TypeScript parsing.
 *
 * TypeScript 7 ships no JavaScript compiler API, so typescript-eslint cannot
 * run against it. @babel/eslint-parser produces the ESTree + TS AST that the
 * `no-restricted-syntax` selectors need. Every generic rule is owned by
 * .oxlintrc.json, so this module configures parsers and nothing else.
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
  }
]
