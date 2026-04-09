import { type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"

import { EntryId } from "../../entry/id.js"

export class PackageDocsNavigationItem extends Schema.Class<PackageDocsNavigationItem>("PackageDocsNavigationItem")({
  href: Schema.String,
  label: Schema.String,
  packageId: PackageNameSchema,
  selected: Schema.Boolean
}) {}

export class PackageDocsLink extends Schema.Class<PackageDocsLink>("PackageDocsLink")({
  external: Schema.Boolean,
  href: Schema.String,
  label: Schema.String
}) {}

const PackageDocsSectionFields = {
  content: Schema.String,
  id: Schema.String,
  sourceHref: Schema.String,
  sourceLabel: Schema.String,
  title: Schema.String
}

export class PackageDocsCodeSection
  extends Schema.TaggedClass<PackageDocsCodeSection>()("code", PackageDocsSectionFields)
{}

export class PackageDocsProseSection extends Schema.TaggedClass<PackageDocsProseSection>()(
  "prose",
  PackageDocsSectionFields
) {}

export const PackageDocsSection = Schema.Union(PackageDocsCodeSection, PackageDocsProseSection)

export type PackageDocsSection = typeof PackageDocsSection.Type

export class PackageDocsGroup extends Schema.Class<PackageDocsGroup>("PackageDocsGroup")({
  sections: Schema.Array(PackageDocsSection),
  title: Schema.String
}) {}

export class PackageDocsSummaryItem extends Schema.Class<PackageDocsSummaryItem>("PackageDocsSummaryItem")({
  label: Schema.String,
  value: Schema.String
}) {}

export class PackageDocsPageModel extends Schema.Class<PackageDocsPageModel>("PackageDocsPageModel")({
  description: Schema.String,
  entryId: Schema.NullOr(EntryId),
  groups: Schema.Array(PackageDocsGroup),
  links: Schema.Array(PackageDocsLink),
  navigation: Schema.Array(PackageDocsNavigationItem),
  packageId: PackageNameSchema,
  summary: Schema.Array(PackageDocsSummaryItem),
  title: Schema.String,
  version: Schema.String
}) {}

export const packageDocsSearchScopeLabel = (packageId: PackageName | null): string =>
  packageId === null ? "Capability docs" : `${packageId} docs`
