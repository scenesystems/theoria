import { Array as Arr, Option } from "effect"
import * as ts from "typescript"

import { nullableReleaseVersion } from "./identifiers.js"
import { PublicExportDoc, type PublicExportKind } from "./model.js"

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node)
  && (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false)

const isExported = (node: ts.Node): boolean => hasModifier(node, ts.SyntaxKind.ExportKeyword)

const isDefaultExport = (node: ts.Node): boolean => hasModifier(node, ts.SyntaxKind.DefaultKeyword)

const renderJSDocComment = (comment: ts.JSDocTag["comment"]): Option.Option<string> =>
  Option.fromNullable(comment).pipe(
    Option.map((value) =>
      typeof value === "string"
        ? value
        : Arr.fromIterable(value).map((part) => part.text).join("")
    ),
    Option.map((value) => value.trim()),
    Option.filter((value) => value.length > 0)
  )

const leadingCommentTagValues = (node: ts.Node, tagName: string): ReadonlyArray<string> => {
  const sourceText = node.getSourceFile().text
  const pattern = new RegExp(`(?:^|\\n)@${tagName}(?:\\s+([^@\\n]+?))?(?=\\s+@|\\n|$)`, "g")

  return Arr.flatMap(ts.getLeadingCommentRanges(sourceText, node.pos) ?? [], (range) => {
    const comment = sourceText.slice(range.pos, range.end)

    if (!comment.startsWith("/**")) {
      return []
    }

    const normalizedComment = comment
      .replace(/^\/\*\*/, "")
      .replace(/\*\/$/, "")
      .split(/\r?\n/u)
      .map((line) => line.replace(/^\s*\*\s?/u, "").trim())
      .join("\n")

    return Arr.filterMap(
      Arr.fromIterable(normalizedComment.matchAll(pattern)),
      (match) =>
        Option.fromNullable(match[1]).pipe(
          Option.map((value) => value.trim()),
          Option.filter((value) => value.length > 0)
        )
    )
  })
}

const tagValues = (node: ts.Node, tagName: string): ReadonlyArray<string> => {
  const jsDocTagValues = Arr.filterMap(ts.getJSDocTags(node), (tag) =>
    tag.tagName.text === tagName
      ? renderJSDocComment(tag.comment)
      : Option.none<string>())

  return jsDocTagValues.length > 0 ? jsDocTagValues : leadingCommentTagValues(node, tagName)
}

const firstTagValue = (node: ts.Node, tagName: string): string | null =>
  Option.getOrNull(Option.fromNullable(tagValues(node, tagName)[0]))

const firstTagValueFromNodes = (nodes: ReadonlyArray<ts.Node>, tagName: string): string | null =>
  Option.getOrNull(
    Arr.findFirst(nodes, (node) => tagValues(node, tagName).length > 0).pipe(
      Option.flatMap((node) => Option.fromNullable(firstTagValue(node, tagName)))
    )
  )

const makePublicExportDoc = (
  exportName: string,
  kind: PublicExportKind,
  node: ts.Node
): PublicExportDoc =>
  new PublicExportDoc({
    exportName,
    kind,
    since: nullableReleaseVersion(firstTagValue(node, "since")),
    category: firstTagValue(node, "category")
  })

const makePublicExportDocFromNodes = (
  exportName: string,
  kind: PublicExportKind,
  nodes: ReadonlyArray<ts.Node>
): PublicExportDoc =>
  new PublicExportDoc({
    exportName,
    kind,
    since: nullableReleaseVersion(firstTagValueFromNodes(nodes, "since")),
    category: firstTagValueFromNodes(nodes, "category")
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
 * Collects raw JSDoc tag values from a declaration or export statement.
 *
 * @since 0.0.0
 * @category queries
 */
export const docTagValues = (node: ts.Node, tagName: string): ReadonlyArray<string> => tagValues(node, tagName)

/**
 * Collects public-export documentation metadata from one source file.
 *
 * This is the syntax-level foundation for later package-wide release
 * governance. It covers direct exported declarations, default exports,
 * namespace exports, and named re-export declarations.
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

/**
 * Builds the stable identity key used by release-snapshot governance.
 *
 * @since 0.0.0
 * @category keys
 */
export const releaseSinceSnapshotKey = (input: {
  readonly subpath: string
  readonly exportName: string
  readonly kind: PublicExportKind
}): string => `${input.subpath}::${input.exportName}::${input.kind}`
