import { Match, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { authorityCatalogForId } from "../capability/catalog.js"
import { type ReleaseStage } from "../release-stage.js"
import {
  CardReleaseState as CardReleaseStateSchema,
  type CardReleaseState as CardReleaseStateType
} from "./descriptor.js"
import { primaryAuthorityIdForEntry } from "./focus.js"
import { EntryId, entryIds, isEntryId } from "./id.js"
import { entryDescriptorForId } from "./registry.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const PackageGroup = Schema.Literal("effect", "scenesystems")

export type PackageGroup = typeof PackageGroup.Type

export type PackageGroupMeta = {
  readonly label: string
  readonly description: string
}

const packageGroupMetaById: Record<PackageGroup, PackageGroupMeta> = {
  effect: {
    label: "Effect Packages",
    description: "Effect-native scientific and inference packages published under the effect-* surface."
  },
  scenesystems: {
    label: "Scene Systems Packages",
    description: "Scene Systems cryptographic and proving entries published under the @scenesystems surface."
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
  packageName: NonEmptyString,
  description: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  deepDivePath: NonEmptyString,
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

export const effectCards: ReadonlyArray<Card> = Arr.filter(cards, (c) => c.group === "effect")

export const scenesystemsCards: ReadonlyArray<Card> = Arr.filter(cards, (c) => c.group === "scenesystems")

export const cardById = (id: string): Option.Option<Card> =>
  isEntryId(id)
    ? Option.some(cardForId(id))
    : Option.none()

export const cardVisibleInReleaseStage = (card: Card, stage: ReleaseStage): boolean =>
  Match.value(stage).pipe(
    Match.when("preview", () => true),
    Match.when("production", () => card.releaseState === "published"),
    Match.exhaustive
  )

export const cardsForReleaseStage = (stage: ReleaseStage): ReadonlyArray<Card> =>
  Arr.filter(cards, (card) => cardVisibleInReleaseStage(card, stage))

export const cardByIdForReleaseStage = (id: string, stage: ReleaseStage): Option.Option<Card> =>
  cardById(id).pipe(
    Option.filter((card) => cardVisibleInReleaseStage(card, stage))
  )

export type CardReleaseState = CardReleaseStateType
