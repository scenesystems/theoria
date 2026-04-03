import { Array as Arr, Option } from "effect"
import * as ts from "typescript"

import {
  type PackagePublicEntrypoint,
  PackagePublicExport,
  type PublicExportDoc,
  type PublicExportKind
} from "./model.js"
import { docTagValues, publicExportDocs } from "./publicExports.js"

const localDocFor = (
  docs: ReadonlyArray<PublicExportDoc>,
  exportName: string
): Option.Option<PublicExportDoc> => Arr.findFirst(docs, (doc) => doc.exportName === exportName)

const firstDocTagValueFromDeclarations = (
  declarations: ReadonlyArray<ts.Declaration>,
  tagName: string
): string | null =>
  Option.getOrNull(
    Arr.findFirst(declarations, (declaration) => docTagValues(declaration, tagName).length > 0).pipe(
      Option.flatMap((declaration) => Option.fromNullable(docTagValues(declaration, tagName)[0]))
    )
  )

const aliasedSymbol = (checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol =>
  symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol

const exportKindFromSymbol = (
  exportName: string,
  localDoc: Option.Option<PublicExportDoc>,
  resolvedSymbol: ts.Symbol
): PublicExportKind =>
  Option.match(localDoc, {
    onNone: () => {
      if (exportName === "default") {
        return "default"
      }

      const declarations = resolvedSymbol.getDeclarations() ?? []

      if (declarations.some((declaration) => ts.isModuleDeclaration(declaration))) {
        return "namespace"
      }

      return declarations.every((declaration) =>
          ts.isInterfaceDeclaration(declaration) || ts.isTypeAliasDeclaration(declaration)
        )
        ? "type"
        : "value"
    },
    onSome: (doc) => doc.kind
  })

const preferredDocField = (
  localDoc: Option.Option<PublicExportDoc>,
  field: "category" | "since",
  declarations: ReadonlyArray<ts.Declaration>
): string | null =>
  Option.match(localDoc, {
    onNone: () => firstDocTagValueFromDeclarations(declarations, field),
    onSome: (doc) => doc[field] ?? firstDocTagValueFromDeclarations(declarations, field)
  })

const publicExportsFromEntrypoint = (
  checker: ts.TypeChecker,
  entrypoint: PackagePublicEntrypoint,
  sourceFile: ts.SourceFile
): ReadonlyArray<PackagePublicExport> => {
  const moduleSymbol = Option.fromNullable(checker.getSymbolAtLocation(sourceFile))

  const entrypointDocs = publicExportDocs(sourceFile)

  return Option.match(moduleSymbol, {
    onNone: () => [],
    onSome: (resolvedModuleSymbol) =>
      Arr.map(checker.getExportsOfModule(resolvedModuleSymbol), (exportSymbol) => {
        const resolvedSymbol = aliasedSymbol(checker, exportSymbol)
        const resolvedDeclarations = resolvedSymbol.getDeclarations() ?? []
        const exportName = exportSymbol.getName()
        const localDoc = localDocFor(entrypointDocs, exportName)
        const kind = exportKindFromSymbol(exportName, localDoc, resolvedSymbol)

        return new PackagePublicExport({
          subpath: entrypoint.subpath,
          exportName,
          kind,
          since: preferredDocField(localDoc, "since", resolvedDeclarations),
          category: preferredDocField(localDoc, "category", resolvedDeclarations)
        })
      })
  })
}

const exportKey = (entry: PackagePublicExport): string => `${entry.subpath}::${entry.exportName}::${entry.kind}`

/**
 * Resolves the complete package public surface from manifest entrypoints.
 *
 * This is the semantic layer above `publicExportDocs`: the TypeScript checker
 * determines which consumer-facing exports actually exist for each public
 * subpath, while local barrel docs remain the preferred source for `@since`
 * and `@category` when they are present.
 *
 * @since 0.0.0
 * @category queries
 */
export const packagePublicExports = (
  program: ts.Program,
  entrypoints: ReadonlyArray<PackagePublicEntrypoint>
): ReadonlyArray<PackagePublicExport> => {
  const checker = program.getTypeChecker()

  return Arr.flatMap(
    Arr.fromIterable(entrypoints),
    (entrypoint) =>
      Option.match(Option.fromNullable(program.getSourceFile(entrypoint.sourceFile.absolute)), {
        onNone: () => [],
        onSome: (sourceFile) => publicExportsFromEntrypoint(checker, entrypoint, sourceFile)
      })
  )
    .sort((left, right) => exportKey(left).localeCompare(exportKey(right)))
}
