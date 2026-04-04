import { Array as Arr, Option } from "effect"
import * as ts from "typescript"

import { collectFromAst, renderExpressionChain } from "./internal/traversal.js"

/**
 * Parses a TypeScript source file for structural inspection.
 *
 * @since 0.0.0
 * @category parsing
 */
export const parseTypeScript = (fileName: string, source: string): ts.SourceFile =>
  ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

/**
 * Collects import, export, and dynamic-import module specifiers from a parsed source file.
 *
 * @since 0.0.0
 * @category queries
 */
export const moduleSpecifiers = (sourceFile: ts.SourceFile): ReadonlyArray<string> =>
  collectFromAst(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      return Option.match(Option.fromNullable(node.moduleSpecifier), {
        onNone: () => [],
        onSome: (specifier) => (ts.isStringLiteral(specifier) ? [specifier.text] : [])
      })
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      return Option.match(Option.fromNullable(node.arguments[0]), {
        onNone: () => [],
        onSome: (firstArgument) => (ts.isStringLiteral(firstArgument) ? [firstArgument.text] : [])
      })
    }

    return []
  })

/**
 * Collects property-access chains such as `Study.open` from a parsed source file.
 *
 * @since 0.0.0
 * @category queries
 */
export const propertyAccessChains = (sourceFile: ts.SourceFile): ReadonlyArray<string> =>
  collectFromAst(sourceFile, (node) =>
    ts.isPropertyAccessExpression(node)
      ? Option.match(renderExpressionChain(node), {
        onNone: () => [],
        onSome: (chain) => [chain]
      })
      : [])

/**
 * Collects call-expression targets such as `Text.layoutLinesWith` from a parsed source file.
 *
 * @since 0.0.0
 * @category queries
 */
export const callExpressionTargets = (sourceFile: ts.SourceFile): ReadonlyArray<string> =>
  collectFromAst(sourceFile, (node) =>
    ts.isCallExpression(node)
      ? Option.match(renderExpressionChain(node.expression), {
        onNone: () => [],
        onSome: (chain) => [chain]
      })
      : [])

/**
 * Collects identifier names from a parsed source file.
 *
 * @since 0.0.0
 * @category queries
 */
export const identifierNames = (sourceFile: ts.SourceFile): ReadonlyArray<string> =>
  collectFromAst(sourceFile, (node) => (ts.isIdentifier(node) ? [node.text] : []))

/**
 * Collects names of exported declarations from a parsed source file.
 *
 * @since 0.0.0
 * @category queries
 */
export const exportedDeclarationNames = (sourceFile: ts.SourceFile): ReadonlyArray<string> =>
  collectFromAst(sourceFile, (node) => {
    if (
      !ts.canHaveModifiers(node)
      || !ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      return []
    }

    if (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      return Option.match(Option.fromNullable(node.name), {
        onNone: () => [],
        onSome: (name) => [name.text]
      })
    }

    if (ts.isVariableStatement(node)) {
      return Arr.flatMap(
        node.declarationList.declarations,
        (declaration) => ts.isIdentifier(declaration.name) ? [declaration.name.text] : []
      )
    }

    return []
  })
