import { nullablePackageName, type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Match, Option, Schema } from "effect"

import { type EntryId, EntryId as EntryIdSchema, entryIds, isEntryId } from "../entry/id.js"
import { type WorkflowSeedId, WorkflowSeedIdSchema } from "../study/workflow/manifest.js"
import { EntryRoute, HomePageRoute, PackageDocsRoute, type PageRoute, WorkflowStudyRoute } from "./path.js"

export class HomePageRouteKey extends Schema.TaggedClass<HomePageRouteKey>()("HomePageRouteKey", {}) {
  static home(): HomePageRouteKey {
    return homePageRouteKey
  }

  serialize(): SerializedPageRouteKey {
    return decodeSerializedPageRouteKeySync("home")
  }

  route(): PageRoute.Value {
    return HomePageRoute.home()
  }
}

export class EntryRouteKey extends Schema.TaggedClass<EntryRouteKey>()("EntryRouteKey", {
  entryId: EntryIdSchema
}) {
  static fromEntryId(entryId: EntryId): EntryRouteKey {
    return EntryRouteKey.make({ entryId })
  }

  static fromSerialized(value: string): Option.Option<EntryRouteKey> {
    const entryId = value.slice(6)

    return isEntryId(entryId) ? Option.some(EntryRouteKey.fromEntryId(entryId)) : Option.none()
  }

  serialize(): SerializedPageRouteKey {
    return decodeSerializedPageRouteKeySync(`entry:${this.entryId}`)
  }

  route(): PageRoute.Value {
    return EntryRoute.fromEntryId(this.entryId)
  }
}

export class WorkflowStudyRouteKey extends Schema.TaggedClass<WorkflowStudyRouteKey>()("WorkflowStudyRouteKey", {
  sessionId: WorkflowSeedIdSchema
}) {
  static fromSessionId(sessionId: WorkflowSeedId): WorkflowStudyRouteKey {
    return WorkflowStudyRouteKey.make({ sessionId })
  }

  static fromSerialized(value: string): Option.Option<WorkflowStudyRouteKey> {
    const sessionId = value.slice(15)

    return isWorkflowSeedId(sessionId)
      ? Option.some(WorkflowStudyRouteKey.fromSessionId(sessionId))
      : Option.none()
  }

  serialize(): SerializedPageRouteKey {
    return decodeSerializedPageRouteKeySync(`workflow-study:${this.sessionId}`)
  }

  route(): PageRoute.Value {
    return WorkflowStudyRoute.fromSessionId(this.sessionId)
  }
}

export class PackageDocsLandingPageRouteKey
  extends Schema.TaggedClass<PackageDocsLandingPageRouteKey>()("PackageDocsLandingPageRouteKey", {})
{
  static landing(): PackageDocsLandingPageRouteKey {
    return packageDocsLandingPageRouteKey
  }

  serialize(): SerializedPageRouteKey {
    return decodeSerializedPageRouteKeySync("docs")
  }

  route(): PageRoute.Value {
    return PackageDocsRoute.fromSelectedPackageId(null)
  }
}

export class PackageDocsPackagePageRouteKey
  extends Schema.TaggedClass<PackageDocsPackagePageRouteKey>()("PackageDocsPackagePageRouteKey", {
    packageId: PackageNameSchema
  })
{
  static fromPackageId(packageId: PackageName): PackageDocsPackagePageRouteKey {
    return PackageDocsPackagePageRouteKey.make({ packageId })
  }

  static fromSerialized(value: string): Option.Option<PackageDocsPackagePageRouteKey> {
    const packageId = nullablePackageName(value.slice(5))

    return packageId === null ? Option.none() : Option.some(PackageDocsPackagePageRouteKey.fromPackageId(packageId))
  }

  serialize(): SerializedPageRouteKey {
    return decodeSerializedPageRouteKeySync(`docs:${this.packageId}`)
  }

  route(): PageRoute.Value {
    return PackageDocsRoute.fromSelectedPackageId(this.packageId)
  }
}

export class PageRouteKey {
  static optionFromSerialized(value: string): Option.Option<PageRouteKey.Value> {
    return Match.value(value).pipe(
      Match.when("home", () => Option.some(HomePageRouteKey.home())),
      Match.when("docs", () => Option.some(PackageDocsLandingPageRouteKey.landing())),
      Match.orElse((token) =>
        token.startsWith("workflow-study:")
          ? WorkflowStudyRouteKey.fromSerialized(token)
          : token.startsWith("docs:")
          ? PackageDocsPackagePageRouteKey.fromSerialized(token)
          : EntryRouteKey.fromSerialized(token)
      )
    )
  }

  static fromSerialized(value: SerializedPageRouteKey): PageRouteKey.Value {
    return PageRouteKey.optionFromSerialized(value).pipe(Option.getOrElse(() => HomePageRouteKey.home()))
  }
}

export namespace PageRouteKey {
  export const schema = Schema.Union(
    HomePageRouteKey,
    EntryRouteKey,
    WorkflowStudyRouteKey,
    PackageDocsLandingPageRouteKey,
    PackageDocsPackagePageRouteKey
  )

  export type Value = typeof schema.Type
}

const EntrySerializedPageRouteKey = Schema.String.pipe(
  Schema.pattern(new RegExp(`^entry:(?:${entryIds.join("|")})$`, "u"))
)

const WorkflowStudySerializedPageRouteKey = Schema.String.pipe(Schema.pattern(/^workflow-study:.+$/u))

const PackageDocsSerializedPageRouteKey = Schema.String.pipe(Schema.pattern(/^docs:.+$/u))

export const SerializedPageRouteKey = Schema.Union(
  Schema.Literal("home", "docs"),
  EntrySerializedPageRouteKey,
  WorkflowStudySerializedPageRouteKey,
  PackageDocsSerializedPageRouteKey
)

export type SerializedPageRouteKey = typeof SerializedPageRouteKey.Type

const decodeSerializedPageRouteKeySync = Schema.decodeUnknownSync(SerializedPageRouteKey)
const isWorkflowSeedId = Schema.is(WorkflowSeedIdSchema)

const homePageRouteKey = HomePageRouteKey.make({})
const packageDocsLandingPageRouteKey = PackageDocsLandingPageRouteKey.make({})
