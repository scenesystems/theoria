import { Array as Arr, Option } from "effect"
import * as ts from "typescript"

import { PublicExportDoc, type PublicExportKind } from "./model.js"
import { docSummary, docSummaryFromNodes, docTagValue, docTagValueFromNodes } from "./publicDoc.js"

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node)
  && (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false)

const isExported = (node: ts.Node): boolean => hasModifier(node, ts.SyntaxKind.ExportKeyword)

const isDefaultExport = (node: ts.Node): boolean => hasModifier(node, ts.SyntaxKind.DefaultKeyword)

const makePublicExportDoc = (
  exportName: string,
  kind: PublicExportKind,
  node: ts.Node
): PublicExportDoc =>
  new PublicExportDoc({
    exportName,
    kind,
    summary: docSummary(node),
    since: docTagValue(node, "since"),
    category: docTagValue(node, "category")
  })

const makePublicExportDocFromNodes = (
  exportName: string,
  kind: PublicExportKind,
  nodes: ReadonlyArray<ts.Node>
): PublicExportDoc =>
  new PublicExportDoc({
    exportName,
    kind,
    summary: docSummaryFromNodes(nodes),
    since: docTagValueFromNodes(nodes, "since"),
    category: docTagValueFromNodes(nodes, "category")
  })

const bindingElementDocNodes = (element: ts.BindingElement): ReadonlyArray<ts.Node> =>
  Option.match(Option.fromNullable(element.propertyName), {
    onNone: () => [element.name, element],
    onSome: (propertyName) => [propertyName, element.name, element]
  })

const docsFromNamedExportDeclaration = (node: ts.ExportDeclaration): ReadonlyArray<PublicExportDoc> =>
  Option.match(Option.fromNullable(node.exportClause), {
    onNone: () => [],
    onSome: (exportClause) => {
      if (ts.isNamespaceExport(exportClause)) {
        return [makePublicExportDocFromNodes(exportClause.name.text, "namespace", [exportClause, node])]
      }

      if (ts.isNamedExports(exportClause)) {
        const baseKind: PublicExportKind = node.isTypeOnly ? "type" : "value"

        return Arr.map(
          exportClause.elements,
          (element) =>
            makePublicExportDocFromNodes(element.name.text, element.isTypeOnly ? "type" : baseKind, [element, node])
        )
      }

      return []
    }
  })

const docsFromBindingName = (
  bindingName: ts.BindingName,
  kind: PublicExportKind,
  nodes: ReadonlyArray<ts.Node>
): ReadonlyArray<PublicExportDoc> => {
  if (ts.isIdentifier(bindingName)) {
    return [
      makePublicExportDocFromNodes(kind === "default" ? "default" : bindingName.text, kind, [bindingName, ...nodes])
    ]
  }

  if (ts.isObjectBindingPattern(bindingName)) {
    return Arr.flatMap(
      bindingName.elements,
      (element) => docsFromBindingName(element.name, kind, [...bindingElementDocNodes(element), ...nodes])
    )
  }

  return Arr.flatMap(bindingName.elements, (element) =>
    ts.isBindingElement(element)
      ? docsFromBindingName(element.name, kind, [...bindingElementDocNodes(element), ...nodes])
      : [])
}

const docsFromVariableStatement = (node: ts.VariableStatement): ReadonlyArray<PublicExportDoc> => {
  if (!isExported(node)) {
    return []
  }

  const kind: PublicExportKind = isDefaultExport(node) ? "default" : "value"

  return Arr.flatMap(
    node.declarationList.declarations,
    (declaration) => docsFromBindingName(declaration.name, kind, [declaration, node])
  )
}

const docsFromDeclaration = (
  node:
    | ts.ClassDeclaration
    | ts.EnumDeclaration
    | ts.FunctionDeclaration
    | ts.InterfaceDeclaration
    | ts.ModuleDeclaration
    | ts.TypeAliasDeclaration
): ReadonlyArray<PublicExportDoc> => {
  if (!isExported(node)) {
    return []
  }

  if (isDefaultExport(node)) {
    return [makePublicExportDoc("default", "default", node)]
  }

  const kind: PublicExportKind = ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
    ? "type"
    : ts.isModuleDeclaration(node)
    ? "namespace"
    : "value"

  return Option.match(Option.fromNullable(node.name), {
    onNone: () => [],
    onSome: (name) => [makePublicExportDoc(name.text, kind, node)]
  })
}

/**
 * Collects public-export documentation metadata from one source file.
 *
 * Direct declarations, default exports, namespace exports, and named re-exports
 * retain the JSDoc attached at their declaration site.
 *
 * @since 0.0.0
 * @category queries
 */
export const publicExportDocs = (sourceFile: ts.SourceFile): ReadonlyArray<PublicExportDoc> =>
  Arr.flatMap(sourceFile.statements, (statement) => {
    if (ts.isExportDeclaration(statement)) {
      return docsFromNamedExportDeclaration(statement)
    }

    if (ts.isExportAssignment(statement)) {
      return [makePublicExportDoc("default", "default", statement)]
    }

    if (ts.isVariableStatement(statement)) {
      return docsFromVariableStatement(statement)
    }

    if (
      ts.isClassDeclaration(statement)
      || ts.isEnumDeclaration(statement)
      || ts.isFunctionDeclaration(statement)
      || ts.isInterfaceDeclaration(statement)
      || ts.isModuleDeclaration(statement)
      || ts.isTypeAliasDeclaration(statement)
    ) {
      return docsFromDeclaration(statement)
    }

    return []
  })
