import { type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"

export class PackageDocsSearchResultItem
  extends Schema.Class<PackageDocsSearchResultItem>("PackageDocsSearchResultItem")({
    excerpt: Schema.String,
    href: Schema.String,
    packageId: PackageNameSchema,
    sourceHref: Schema.String,
    sourceLabel: Schema.String,
    title: Schema.String
  })
{}

export class PackageDocsSearchModel extends Schema.Class<PackageDocsSearchModel>("PackageDocsSearchModel")({
  query: Schema.String,
  resultSummary: Schema.String,
  results: Schema.Array(PackageDocsSearchResultItem),
  scopeDescription: Schema.String,
  scopeLabel: Schema.String
}) {}

export const packageDocsSearchScopeDescription = (packageId: PackageName | null): string =>
  packageId === null
    ? "Search README blocks, module docs, examples, release snapshots, and proof commands across every shipped capability package."
    : `Search README blocks, module docs, examples, release snapshots, and proof commands inside ${packageId}.`
