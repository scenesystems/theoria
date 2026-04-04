import { Option } from "effect"
import * as ts from "typescript"

import { collectFromAst } from "./internal/traversal.js"

/**
 * Collects string literals from a parsed source file.
 *
 * @since 0.0.0
 * @category queries
 */
export const stringLiterals = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  return collectFromAst(sourceFile, (node) => (ts.isStringLiteral(node) ? [node.text] : []))
}

/**
 * Collects numeric literals from a parsed source file.
 *
 * @since 0.0.0
 * @category queries
 */
export const numericLiterals = (sourceFile: ts.SourceFile): ReadonlyArray<string> => {
  return collectFromAst(sourceFile, (node) => (ts.isNumericLiteral(node) ? [node.text] : []))
}

/**
 * Collects string literal property assignments for a given property name.
 *
 * @since 0.0.0
 * @category queries
 */
export const stringLiteralPropertyAssignments = (
  sourceFile: ts.SourceFile,
  propertyName: string
): ReadonlyArray<string> =>
  collectFromAst(sourceFile, (node) => {
    if (!ts.isPropertyAssignment(node) || !ts.isIdentifier(node.name) || node.name.text !== propertyName) {
      return []
    }

    return ts.isStringLiteral(node.initializer) ? [node.initializer.text] : []
  })

/**
 * Collects raw property-assignment initializer text for a given property name.
 *
 * @since 0.0.0
 * @category queries
 */
export const propertyAssignmentTexts = (sourceFile: ts.SourceFile, propertyName: string): ReadonlyArray<string> =>
  collectFromAst(sourceFile, (node) => {
    if (!ts.isPropertyAssignment(node) || !ts.isIdentifier(node.name) || node.name.text !== propertyName) {
      return []
    }

    return [node.initializer.getText(sourceFile)]
  })

/**
 * Collects raw initializer text for variable declarations with a given name.
 *
 * @since 0.0.0
 * @category queries
 */
export const variableInitializerTexts = (sourceFile: ts.SourceFile, variableName: string): ReadonlyArray<string> =>
  collectFromAst(sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || node.name.text !== variableName) {
      return []
    }

    return Option.match(Option.fromNullable(node.initializer), {
      onNone: () => [],
      onSome: (initializer) => [initializer.getText(sourceFile)]
    })
  })
