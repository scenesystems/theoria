import { nullablePackageName, type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Match, Option, Schema } from "effect"

import { type EntryId, EntryId as EntryIdSchema, entryIds, isEntryId } from "../entry/id.js"

export class HomePageRouteKey extends Schema.TaggedClass<HomePageRouteKey>()("HomePageRouteKey", {}) {}

export class DeepPageRouteKey extends Schema.TaggedClass<DeepPageRouteKey>()("DeepPageRouteKey", {
  entryId: EntryIdSchema
}) {}

export class PackageDocsLandingPageRouteKey
  extends Schema.TaggedClass<PackageDocsLandingPageRouteKey>()("PackageDocsLandingPageRouteKey", {})
{}

export class PackageDocsPackagePageRouteKey
  extends Schema.TaggedClass<PackageDocsPackagePageRouteKey>()("PackageDocsPackagePageRouteKey", {
    packageId: PackageNameSchema
  })
{}

export const PageRouteKey = Schema.Union(
  HomePageRouteKey,
  DeepPageRouteKey,
  PackageDocsLandingPageRouteKey,
  PackageDocsPackagePageRouteKey
)

export type PageRouteKey = typeof PageRouteKey.Type

const DeepSerializedPageRouteKey = Schema.String.pipe(
  Schema.pattern(new RegExp(`^deep:(?:${entryIds.join("|")})$`, "u"))
)

const PackageDocsSerializedPageRouteKey = Schema.String.pipe(Schema.pattern(/^docs:.+$/u))

export const SerializedPageRouteKey = Schema.Union(
  Schema.Literal("home", "docs"),
  DeepSerializedPageRouteKey,
  PackageDocsSerializedPageRouteKey
)

export type SerializedPageRouteKey = typeof SerializedPageRouteKey.Type

const decodeSerializedPageRouteKeySync = Schema.decodeUnknownSync(SerializedPageRouteKey)

export const homePageRouteKey = HomePageRouteKey.make({})

export const packageDocsLandingPageRouteKey = PackageDocsLandingPageRouteKey.make({})

export const deepPageRouteKey = (entryId: EntryId): PageRouteKey => DeepPageRouteKey.make({ entryId })

export const packageDocsPackagePageRouteKey = (packageId: PackageName): PageRouteKey =>
  PackageDocsPackagePageRouteKey.make({ packageId })

export const serializePageRouteKey = (key: PageRouteKey): SerializedPageRouteKey =>
  decodeSerializedPageRouteKeySync(
    Match.value(key).pipe(
      Match.tag("HomePageRouteKey", () => "home"),
      Match.tag("PackageDocsLandingPageRouteKey", () => "docs"),
      Match.tag("DeepPageRouteKey", ({ entryId }) => `deep:${entryId}`),
      Match.tag("PackageDocsPackagePageRouteKey", ({ packageId }) => `docs:${packageId}`),
      Match.exhaustive
    )
  )

const deepPageRouteKeyForValue = (value: string): Option.Option<PageRouteKey> => {
  const entryId = value.slice(5)

  return isEntryId(entryId) ? Option.some(DeepPageRouteKey.make({ entryId })) : Option.none()
}

const packageDocsPageRouteKeyForValue = (value: string): Option.Option<PageRouteKey> => {
  const packageId = nullablePackageName(value.slice(5))

  return packageId === null ? Option.none() : Option.some(PackageDocsPackagePageRouteKey.make({ packageId }))
}

export const decodePageRouteKey = (value: string): Option.Option<PageRouteKey> =>
  Match.value(value).pipe(
    Match.when("home", () => Option.some(homePageRouteKey)),
    Match.when("docs", () => Option.some(packageDocsLandingPageRouteKey)),
    Match.orElse((token) =>
      token.startsWith("docs:") ? packageDocsPageRouteKeyForValue(token) : deepPageRouteKeyForValue(token)
    )
  )
