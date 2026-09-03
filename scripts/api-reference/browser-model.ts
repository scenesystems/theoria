import { Array as Arr } from "effect"

import type {
  ApiExport,
  ApiPage,
  DocsApiExportPage,
  DocsApiModuleIndex
} from "@theoria/docs-model"

export const browserApiExportPath = (modulePath: string, anchor: string): string =>
  `${modulePath.replace(/\.json$/u, "")}/${anchor}.json`

export const browserApiExportAsset = (
  revision: string,
  modulePath: string,
  anchor: string
): string => `/docs-data/${revision}/${browserApiExportPath(modulePath, anchor)}`

export const makeBrowserApiModuleIndex = (
  page: ApiPage,
  revision: string,
  modulePath: string,
  exportModulePath: string = modulePath
): DocsApiModuleIndex => ({
  schemaVersion: 2,
  kind: "api-module-index",
  path: page.path,
  canonical: page.canonical,
  canonicalPath: page.canonicalPath,
  aliases: page.aliases,
  package: page.package,
  module: page.module,
  categories: page.categories,
  exports: Arr.map(page.exports, ({ anchor, category, id, importKind, name, since, summary }) => ({
    id,
    name,
    anchor,
    importKind,
    category,
    since,
    summary,
    asset: browserApiExportAsset(revision, exportModulePath, anchor)
  }))
})

export const makeBrowserApiExportPage = (apiExport: ApiExport): DocsApiExportPage => ({
  schemaVersion: 1,
  kind: "api-export",
  export: apiExport
})
