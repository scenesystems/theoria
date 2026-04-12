import { type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"

import { PackageDocsPackagePageRoute } from "./page-route.js"
import type { PackageDocsSearchResult } from "./shared.js"

export class PackageDocsSearchResultItem
  extends Schema.Class<PackageDocsSearchResultItem>("PackageDocsSearchResultItem")({
    excerpt: Schema.String,
    href: Schema.String,
    packageId: PackageNameSchema,
    sourceHref: Schema.String,
    sourceLabel: Schema.String,
    title: Schema.String
  })
{
  static fromResult(result: PackageDocsSearchResult): PackageDocsSearchResultItem {
    return PackageDocsSearchResultItem.make({
      excerpt: result.excerpt,
      href: PackageDocsPackagePageRoute.fromPackageId(result.packageId).path(),
      packageId: result.packageId,
      sourceHref: `https://github.com/scenesystems/theoria/blob/main/${result.source.path}`,
      sourceLabel: result.source.path,
      title: result.title
    })
  }
}

export class PackageDocsSearchModel extends Schema.Class<PackageDocsSearchModel>("PackageDocsSearchModel")({
  query: Schema.String,
  resultSummary: Schema.String,
  results: Schema.Array(PackageDocsSearchResultItem),
  scopeDescription: Schema.String,
  scopeLabel: Schema.String
}) {
  static project(input: {
    readonly packageId: PackageName | null
    readonly query: string
    readonly results: ReadonlyArray<PackageDocsSearchResult>
  }): PackageDocsSearchModel {
    const scopeLabel = PackageDocsSearchModel.scopeLabel(input.packageId)

    return PackageDocsSearchModel.make({
      query: input.query,
      resultSummary: PackageDocsSearchModel.resultSummary({
        query: input.query,
        resultCount: input.results.length,
        scopeLabel
      }),
      results: input.results.map(PackageDocsSearchResultItem.fromResult),
      scopeDescription: PackageDocsSearchModel.scopeDescription(input.packageId),
      scopeLabel
    })
  }

  static resultSummary(input: {
    readonly query: string
    readonly resultCount: number
    readonly scopeLabel: string
  }): string {
    return input.resultCount === 0
      ? `No sections matched "${input.query}" in ${input.scopeLabel.toLowerCase()}.`
      : `${input.resultCount} match${
        input.resultCount === 1 ? "" : "es"
      } for "${input.query}" in ${input.scopeLabel.toLowerCase()}.`
  }

  static scopeDescription(packageId: PackageName | null): string {
    return packageId === null
      ? "Search README blocks, module docs, examples, release snapshots, and proof commands across every shipped capability package."
      : `Search README blocks, module docs, examples, release snapshots, and proof commands inside ${packageId}.`
  }

  static scopeLabel(packageId: PackageName | null): string {
    return packageId === null ? "Capability docs" : `${packageId} docs`
  }
}
