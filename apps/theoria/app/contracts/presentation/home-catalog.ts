import { Option, Schema } from "effect"

import { CapabilityAvailability } from "../capability/availability.js"
import type { PackageVersions } from "../capability/package-versions.js"
import { Card, PackageGroup, PackageGroupMetadata } from "../entry/card.js"
import { EntryId } from "../entry/id.js"
import type { ReleaseStage } from "../release-stage.js"
import { CardTone, representativeToneFor } from "../tone.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export class HomeCatalogAvailabilityChecking
  extends Schema.TaggedClass<HomeCatalogAvailabilityChecking>()("checking", {})
{
  static checking(): HomeCatalogAvailabilityChecking {
    return homeCatalogAvailabilityChecking
  }
}

export class HomeCatalogAvailabilityResolved extends Schema.TaggedClass<HomeCatalogAvailabilityResolved>()("resolved", {
  snapshot: CapabilityAvailability
}) {
  static fromSnapshot(snapshot: CapabilityAvailability): HomeCatalogAvailabilityResolved {
    return HomeCatalogAvailabilityResolved.make({ snapshot })
  }
}

const homeCatalogGroups: ReadonlyArray<PackageGroup> = ["effect", "scenesystems"]

export class HomeCatalogAvailabilityUnavailable extends Schema.TaggedClass<HomeCatalogAvailabilityUnavailable>()(
  "unavailable",
  {}
) {
  static unavailable(): HomeCatalogAvailabilityUnavailable {
    return homeCatalogAvailabilityUnavailable
  }
}

export const HomeCatalogAvailability = Schema.Union(
  HomeCatalogAvailabilityChecking,
  HomeCatalogAvailabilityResolved,
  HomeCatalogAvailabilityUnavailable
)

export type HomeCatalogAvailability = typeof HomeCatalogAvailability.Type

export const HomeCatalogCardStatusKind = Schema.Literal(
  "checking",
  "coming-soon",
  "ready",
  "runtime-pending",
  "status-unavailable"
)

export type HomeCatalogCardStatusKind = typeof HomeCatalogCardStatusKind.Type

export class HomeCatalogCardStatus extends Schema.Class<HomeCatalogCardStatus>("HomeCatalogCardStatus")({
  kind: HomeCatalogCardStatusKind,
  text: NonEmptyString,
  title: NonEmptyString
}) {}

export const HomeCatalogCardMetaItem = Schema.Union(
  Schema.Struct({ _tag: Schema.Literal("internal-link"), href: NonEmptyString, label: NonEmptyString }),
  Schema.Struct({ _tag: Schema.Literal("external-link"), href: NonEmptyString, label: NonEmptyString }),
  Schema.Struct({ _tag: Schema.Literal("text"), label: NonEmptyString })
)

export type HomeCatalogCardMetaItem = typeof HomeCatalogCardMetaItem.Type

export class HomeCatalogCardPresentation
  extends Schema.Class<HomeCatalogCardPresentation>("HomeCatalogCardPresentation")({
    id: EntryId,
    title: NonEmptyString,
    description: NonEmptyString,
    titlePath: Schema.NullOr(NonEmptyString),
    status: HomeCatalogCardStatus,
    metaItems: Schema.Array(HomeCatalogCardMetaItem)
  })
{
  static project({
    availability,
    card,
    packageVersions,
    releaseStage
  }: {
    readonly availability: HomeCatalogAvailability
    readonly card: Card
    readonly packageVersions: PackageVersions | null
    readonly releaseStage: ReleaseStage
  }): HomeCatalogCardPresentation {
    return HomeCatalogCardPresentation.make({
      description: card.description,
      id: card.id,
      metaItems: homeCatalogMetaItems(card, resolvedVersionFor(card, packageVersions)),
      status: homeCatalogCardStatus({ availability, card }),
      title: card.title,
      titlePath: card.visibleInReleaseStage(releaseStage) ? card.deepDivePath : null
    })
  }
}

export class HomeCatalogSectionPresentation extends Schema.Class<HomeCatalogSectionPresentation>(
  "HomeCatalogSectionPresentation"
)({
  group: PackageGroup,
  tone: CardTone,
  title: NonEmptyString,
  description: NonEmptyString,
  cards: Schema.Array(HomeCatalogCardPresentation)
}) {
  static project({
    availability,
    group,
    packageVersions,
    releaseStage
  }: {
    readonly availability: HomeCatalogAvailability
    readonly group: PackageGroup
    readonly packageVersions: PackageVersions | null
    readonly releaseStage: ReleaseStage
  }): HomeCatalogSectionPresentation {
    const metadata = PackageGroupMetadata.fromGroup(group)

    return HomeCatalogSectionPresentation.make({
      cards: Card.forGroup(group).map((card) =>
        HomeCatalogCardPresentation.project({ availability, card, packageVersions, releaseStage })
      ),
      description: metadata.description,
      group,
      title: metadata.label,
      tone: representativeToneFor(group)
    })
  }
}

export class HomeCatalogPresentation extends Schema.Class<HomeCatalogPresentation>("HomeCatalogPresentation")({
  sections: Schema.Array(HomeCatalogSectionPresentation)
}) {
  static project({
    availability,
    packageVersions,
    releaseStage
  }: {
    readonly availability: HomeCatalogAvailability
    readonly packageVersions: PackageVersions | null
    readonly releaseStage: ReleaseStage
  }): HomeCatalogPresentation {
    return HomeCatalogPresentation.make({
      sections: homeCatalogGroups.map((group) =>
        HomeCatalogSectionPresentation.project({ availability, group, packageVersions, releaseStage })
      )
    })
  }
}

const homeCatalogMetaItems = (card: Card, version: string): ReadonlyArray<HomeCatalogCardMetaItem> => [
  { _tag: "internal-link", href: card.docsPath, label: "Docs" },
  { _tag: "external-link", href: card.npmUrl, label: `npm@${version}` },
  { _tag: "external-link", href: card.repoUrl, label: "Source" },
  { _tag: "text", label: card.license }
]

const readyStatus = (): HomeCatalogCardStatus =>
  HomeCatalogCardStatus.make({
    kind: "ready",
    text: "Ready",
    title: "Runtime readiness confirmed for this study entry."
  })

const runtimePendingStatus = (reason: string): HomeCatalogCardStatus =>
  HomeCatalogCardStatus.make({
    kind: "runtime-pending",
    text: "Runtime Pending",
    title: reason
  })

const homeCatalogCardStatus = ({
  availability,
  card
}: {
  readonly availability: HomeCatalogAvailability
  readonly card: Card
}): HomeCatalogCardStatus => {
  if (card.releaseState === "coming-soon") {
    return HomeCatalogCardStatus.make({
      kind: "coming-soon",
      text: "Coming Soon",
      title: "This study entry has not shipped yet."
    })
  }

  if (availability._tag === "checking") {
    return HomeCatalogCardStatus.make({
      kind: "checking",
      text: "Checking Status",
      title: "Theoria is resolving runtime readiness for this study entry."
    })
  }

  if (availability._tag === "unavailable") {
    return HomeCatalogCardStatus.make({
      kind: "status-unavailable",
      text: "Status Unavailable",
      title: "Theoria could not confirm runtime readiness for this study entry."
    })
  }

  return Option.match(availability.snapshot.entry(card.id), {
    onNone: () => runtimePendingStatus("Runtime registration has not shipped for this study entry yet."),
    onSome: (
      entry
    ) => (entry.enabled
      ? readyStatus()
      : runtimePendingStatus(entry.reason ?? "Runtime is not available for this study entry yet."))
  })
}

const resolvedVersionFor = (card: Card, packageVersions: PackageVersions | null): string =>
  packageVersions?.versionFor(card.packageName) ?? card.version

const homeCatalogAvailabilityChecking = HomeCatalogAvailabilityChecking.make({})
const homeCatalogAvailabilityUnavailable = HomeCatalogAvailabilityUnavailable.make({})
