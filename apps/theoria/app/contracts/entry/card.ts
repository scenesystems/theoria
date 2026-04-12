import { type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { authorityCatalogForId } from "../capability/catalog.js"
import { PackageDocsPresentation } from "../presentation/package-docs/presentation.js"
import { type ReleaseStage } from "../release-stage.js"
import {
  CardReleaseState as CardReleaseStateSchema,
  type CardReleaseState as CardReleaseStateType
} from "./descriptor.js"
import { EntryId, isEntryId } from "./id.js"
import { type AnyEntryDescriptor, EntryRegistry } from "./registry.js"

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
        label: "Effect Capabilities",
        description:
          "Effect-native computation, optimization, and inference capabilities that compose inside Theoria study entries."
      })
      : PackageGroupMetadata.make({
        label: "Scene Systems Capabilities",
        description:
          "Scene Systems security, provenance, and delivery capabilities that ground Theoria evidence and sharing surfaces."
      })
  }
}

const packageGroupForEntry = (entryId: typeof EntryId.Type): PackageGroup =>
  entryId.startsWith("effect-") ? "effect" : "scenesystems"

const entryRegistry = EntryRegistry.current()

/**
 * Full card definition consumed by both the home catalog and deep-dive pages.
 *
 * The `version` field provides a static fallback. Live versions are resolved
 * at runtime from the `/api/versions/packages` endpoint which reads the
 * workspace `package.json` files on server startup.
 *
 * @since 0.1.0
 */
export class Card extends Schema.Class<Card>("Card")({
  id: EntryId,
  title: NonEmptyString,
  packageName: PackageNameSchema,
  description: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  deepDivePath: NonEmptyString,
  docsPath: NonEmptyString,
  group: PackageGroup,
  releaseState: CardReleaseStateSchema,
  version: NonEmptyString,
  npmUrl: NonEmptyString,
  repoUrl: NonEmptyString,
  license: NonEmptyString,
  interactiveLabel: Schema.optional(NonEmptyString)
}) {
  static all(): ReadonlyArray<Card> {
    return allCards
  }

  static byId(id: string): Option.Option<Card> {
    return isEntryId(id)
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

  static project(descriptor: AnyEntryDescriptor): Card {
    const authority = authorityCatalogForId(descriptor.primaryAuthorityId)
    const interactiveLabel = Option.fromNullable(descriptor.interactiveLabel)

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
      group: packageGroupForEntry(descriptor.entryId),
      releaseState: descriptor.releaseState,
      version: authority.version,
      npmUrl: authority.npmUrl,
      repoUrl: authority.repoUrl,
      license: authority.license,
      ...Option.match(interactiveLabel, {
        onNone: () => ({}),
        onSome: (resolvedInteractiveLabel) => ({ interactiveLabel: resolvedInteractiveLabel })
      })
    })
  }

  visibleInReleaseStage(stage: ReleaseStage): boolean {
    return stage === "preview" || this.releaseState === "published"
  }
}

const allCards: ReadonlyArray<Card> = Arr.map(entryRegistry.descriptors, Card.project)

export type CardReleaseState = CardReleaseStateType
