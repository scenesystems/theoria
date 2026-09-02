import type { DocsApiExportPage, DocsApiModuleIndex } from "@theoria/docs-model"
import { Option } from "effect"

import { apiPageFixture } from "./docs-fixtures.js"

const packageRoot = `/docs-data/0123456789abcdef0123456789abcdef01234567/packages/effect-search`

export const docsApiModuleIndexFixture: DocsApiModuleIndex = {
  schemaVersion: 2,
  kind: "api-module-index",
  path: apiPageFixture.path,
  canonical: apiPageFixture.canonical,
  canonicalPath: apiPageFixture.canonicalPath,
  aliases: apiPageFixture.aliases,
  package: apiPageFixture.package,
  module: apiPageFixture.module,
  categories: apiPageFixture.categories,
  exports: apiPageFixture.exports.map(({ anchor, category, id, importKind, name, since, summary }) => ({
    id,
    name,
    anchor,
    importKind,
    category,
    since,
    summary,
    asset: `${packageRoot}/pages/Study/${anchor}.json`
  }))
}

export const docsApiExportPageFixture = (index: number): DocsApiExportPage => ({
  schemaVersion: 1,
  kind: "api-export",
  export: Option.getOrThrow(Option.fromNullable(apiPageFixture.exports[index]))
})
