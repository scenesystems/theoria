import { type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import {
  type AuthorityCatalogDescriptor,
  authorityCatalogDescriptors,
  authorityCatalogForId
} from "../capability/catalog.js"
import { PackageDocsPresentation } from "../presentation/package-docs/presentation.js"
import { type ReleaseStage } from "../release-stage.js"
import {
  CardReleaseState as CardReleaseStateSchema,
  type CardReleaseState as CardReleaseStateType
} from "./descriptor.js"
import { workflowEntryDescriptor } from "./descriptors/workflow.js"
import { AuthorityId, EntryId, isAuthorityId, isEntryId, type WorkflowEntryId } from "./id.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const PackageGroup = Schema.Literal("effect", "scenesystems")

export type PackageGroup = typeof PackageGroup.Type

export class PackageGroupMetadata extends Schema.Class<PackageGroupMetadata>("PackageGroupMetadata")({
  label: NonEmptyString,
  description: NonEmptyString
}) {
  static fromGroup(group: PackageGroup): PackageGroupMetadata {
    return group === "effect"
      ? PackageGroupMetadata.make({
        label: "Study Toolkit",
        description: "Math, search, inference, and text packages for building studies and improving real workflows."
      })
      : PackageGroupMetadata.make({
        label: "Trust & Provenance",
        description:
          "Hashing, sealing, and signing packages for reproducible artifacts, trustworthy evidence, and shareable results."
      })
  }
}

const CardId = Schema.Union(AuthorityId, EntryId)
type CardId = typeof CardId.Type

const packageGroupForCard = (id: CardId): PackageGroup =>
  id === workflowEntryDescriptor.entryId || id.startsWith("effect-") ? "effect" : "scenesystems"

const capabilityCard = (authority: AuthorityCatalogDescriptor): Card =>
  Card.make({
    id: authority.authorityId,
    title: authority.title,
    packageName: authority.packageName,
    description: authority.description,
    useCase: authority.useCase,
    summary: authority.summary,
    runLabel: "Open Workflow",
    deepDivePath: null,
    docsPath: PackageDocsPresentation.projectPackage(authority.packageName).canonicalPath,
    group: packageGroupForCard(authority.authorityId),
    releaseState: "published",
    version: authority.version,
    npmUrl: authority.npmUrl,
    repoUrl: authority.repoUrl,
    license: authority.license,
    interactiveLabel: null
  })

const workflowCard = (): Card => {
  const primaryAuthority = authorityCatalogForId(workflowEntryDescriptor.primaryAuthorityId)

  return Card.make({
    id: workflowEntryDescriptor.entryId,
    title: workflowEntryDescriptor.title,
    packageName: workflowEntryDescriptor.packageName,
    description: workflowEntryDescriptor.description,
    useCase: workflowEntryDescriptor.useCase,
    summary: workflowEntryDescriptor.summary,
    runLabel: workflowEntryDescriptor.runLabel,
    deepDivePath: workflowEntryDescriptor.path,
    docsPath: PackageDocsPresentation.projectPackage(workflowEntryDescriptor.packageName).canonicalPath,
    group: packageGroupForCard(workflowEntryDescriptor.entryId),
    releaseState: workflowEntryDescriptor.releaseState,
    version: primaryAuthority.version,
    npmUrl: primaryAuthority.npmUrl,
    repoUrl: primaryAuthority.repoUrl,
    license: primaryAuthority.license,
    interactiveLabel: workflowEntryDescriptor.interactiveLabel
  })
}

/**
 * Full card definition consumed by both the home catalog and entry pages.
 *
 * The `version` field provides a static fallback. Live versions are resolved
 * at runtime from the `/api/versions/packages` endpoint which reads the
 * workspace `package.json` files on server startup.
 *
 * @since 0.1.0
 */
export class Card extends Schema.Class<Card>("Card")({
  id: CardId,
  title: NonEmptyString,
  packageName: PackageNameSchema,
  description: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  deepDivePath: Schema.NullOr(NonEmptyString),
  docsPath: NonEmptyString,
  group: PackageGroup,
  releaseState: CardReleaseStateSchema,
  version: NonEmptyString,
  npmUrl: NonEmptyString,
  repoUrl: NonEmptyString,
  license: NonEmptyString,
  interactiveLabel: Schema.NullOr(NonEmptyString)
}) {
  static all(): ReadonlyArray<Card> {
    return allCards
  }

  static byId(id: string): Option.Option<Card> {
    return isEntryId(id) || isAuthorityId(id)
      ? Arr.findFirst(Card.all(), (card) => card.id === id)
      : Option.none()
  }

  static byIdForReleaseStage(id: string, stage: ReleaseStage): Option.Option<Card> {
    return Card.byId(id).pipe(
      Option.filter((card) => card.visibleInReleaseStage(stage))
    )
  }

  static forGroup(group: PackageGroup): ReadonlyArray<Card> {
    return Arr.filter(Card.all(), (card) => card.group === group)
  }

  static forPackageName(packageName: PackageName): Option.Option<Card> {
    return Arr.findFirst(Card.all(), (card) => card.packageName === packageName)
  }

  static forReleaseStage(stage: ReleaseStage): ReadonlyArray<Card> {
    return Arr.filter(Card.all(), (card) => card.visibleInReleaseStage(stage))
  }

  static project(descriptor: {
    readonly entryId: WorkflowEntryId
    readonly title: string
    readonly packageName: PackageName
    readonly description: string
    readonly useCase: string
    readonly summary: string
    readonly runLabel: string
    readonly path: string
    readonly releaseState: CardReleaseState
    readonly primaryAuthorityId: AuthorityId
    readonly interactiveLabel: string | null
  }): Card {
    const authority = authorityCatalogForId(descriptor.primaryAuthorityId)

    return Card.make({
      id: descriptor.entryId,
      title: descriptor.title,
      packageName: descriptor.packageName,
      description: descriptor.description,
      useCase: descriptor.useCase,
      summary: descriptor.summary,
      runLabel: descriptor.runLabel,
      deepDivePath: descriptor.path,
      docsPath: PackageDocsPresentation.projectPackage(descriptor.packageName).canonicalPath,
      group: packageGroupForCard(descriptor.entryId),
      releaseState: descriptor.releaseState,
      version: authority.version,
      npmUrl: authority.npmUrl,
      repoUrl: authority.repoUrl,
      license: authority.license,
      interactiveLabel: descriptor.interactiveLabel
    })
  }

  visibleInReleaseStage(stage: ReleaseStage): boolean {
    return stage === "preview" || this.releaseState === "published"
  }
}

const allCards: ReadonlyArray<Card> = [
  workflowCard(),
  ...Arr.map(authorityCatalogDescriptors, capabilityCard)
]

export type CardReleaseState = CardReleaseStateType
