import { type PackageName, PackageNameSchema } from "@theoria/source-proof/contracts"
import { Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { authorityCatalogForId } from "../capability/catalog.js"
import { packageDocsPresentationForPackage } from "../presentation/package-docs.js"
import { type ReleaseStage } from "../release-stage.js"
import {
  CardReleaseState as CardReleaseStateSchema,
  type CardReleaseState as CardReleaseStateType
} from "./descriptor.js"
import { primaryAuthorityIdForEntry } from "./focus.js"
import { EntryId, entryIds, isEntryId } from "./id.js"
import { entryDescriptorForId } from "./registry.js"
import { entryVisibleInReleaseStage } from "./routing.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const PackageGroup = Schema.Literal("effect", "scenesystems")

export type PackageGroup = typeof PackageGroup.Type

export type PackageGroupMeta = {
  readonly label: string
  readonly description: string
}

const packageGroupMetaById: Record<PackageGroup, PackageGroupMeta> = {
  effect: {
    label: "Effect Capabilities",
    description:
      "Effect-native computation, optimization, and inference capabilities that compose inside Theoria study entries."
  },
  scenesystems: {
    label: "Scene Systems Capabilities",
    description:
      "Scene Systems security, provenance, and delivery capabilities that ground Theoria evidence and sharing surfaces."
  }
}

const packageGroupForEntry = (entryId: typeof EntryId.Type): PackageGroup =>
  entryId.startsWith("effect-") ? "effect" : "scenesystems"

export const packageGroupMeta = (group: PackageGroup): PackageGroupMeta => packageGroupMetaById[group]

/**
 * Full card definition consumed by both the home catalog and deep-dive pages.
 *
 * The `version` field provides a static fallback. Live versions are resolved
 * at runtime from the `/api/versions/packages` endpoint which reads the
 * workspace `package.json` files on server startup.
 *
 * @since 0.1.0
 */
export const Card = Schema.Struct({
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
})

export type Card = typeof Card.Type

export const cardForId = (id: typeof EntryId.Type): Card => {
  const descriptor = entryDescriptorForId(id)
  const authority = authorityCatalogForId(primaryAuthorityIdForEntry(id))
  const interactiveLabel = Option.fromNullable(descriptor.interactiveLabel)

  return {
    id: descriptor.entryId,
    title: descriptor.title,
    packageName: descriptor.packageName,
    description: descriptor.description,
    useCase: descriptor.useCase,
    summary: descriptor.summary,
    runLabel: descriptor.runLabel,
    deepDivePath: descriptor.path,
    docsPath: packageDocsPresentationForPackage(descriptor.packageName).canonicalPath,
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
  }
}

export const cards: ReadonlyArray<Card> = Arr.map(entryIds, cardForId)

export const cardsForGroup = (group: PackageGroup): ReadonlyArray<Card> =>
  Arr.filter(cards, (card) => card.group === group)

export const effectCards: ReadonlyArray<Card> = cardsForGroup("effect")

export const scenesystemsCards: ReadonlyArray<Card> = cardsForGroup("scenesystems")

export const cardById = (id: string): Option.Option<Card> =>
  isEntryId(id)
    ? Option.some(cardForId(id))
    : Option.none()

export const cardForPackageName = (packageName: PackageName): Option.Option<Card> =>
  Arr.findFirst(cards, (card) => card.packageName === packageName)

export const cardVisibleInReleaseStage = (card: Card, stage: ReleaseStage): boolean =>
  entryVisibleInReleaseStage(card, stage)

export const cardsForReleaseStage = (stage: ReleaseStage): ReadonlyArray<Card> =>
  Arr.filter(cards, (card) => cardVisibleInReleaseStage(card, stage))

export const cardByIdForReleaseStage = (id: string, stage: ReleaseStage): Option.Option<Card> =>
  cardById(id).pipe(
    Option.filter((card) => cardVisibleInReleaseStage(card, stage))
  )

export type CardReleaseState = CardReleaseStateType
