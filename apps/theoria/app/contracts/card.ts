import { Match, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { ConsumerId, consumerIds, isPackageConsumerId } from "./id.js"
import {
  authorityCatalogForId,
  CardReleaseState as CardReleaseStateSchema,
  consumerPublicationForId,
  packageConsumerDescriptorForId,
  PackageGroup as PackageGroupSchema,
  packageGroupMeta,
  primaryAuthorityCatalogForDescriptor
} from "./proving-substrate.js"
import type { ReleaseStage } from "./release-stage.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export {
  authorityCatalogForId,
  CardReleaseStateSchema as CardReleaseState,
  consumerPublicationForId,
  packageGroupMeta,
  PackageGroupSchema as PackageGroup
}
export type {
  AuthorityCatalogDescriptor,
  ConsumerPublicationDescriptor,
  PackageGroupMeta
} from "./proving-substrate.js"

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
  id: ConsumerId,
  title: NonEmptyString,
  packageName: NonEmptyString,
  description: NonEmptyString,
  useCase: NonEmptyString,
  summary: NonEmptyString,
  runLabel: NonEmptyString,
  deepDivePath: NonEmptyString,
  group: PackageGroupSchema,
  releaseState: CardReleaseStateSchema,
  version: NonEmptyString,
  npmUrl: NonEmptyString,
  repoUrl: NonEmptyString,
  license: NonEmptyString,
  interactiveLabel: Schema.optional(NonEmptyString)
})

export type Card = typeof Card.Type

export const cardForId = (id: ConsumerId): Card => {
  const descriptor = packageConsumerDescriptorForId(id)
  const publication = descriptor.publication
  const authority = primaryAuthorityCatalogForDescriptor(descriptor)

  return {
    id: publication.consumerId,
    title: authority.title,
    packageName: authority.packageName,
    description: authority.description,
    useCase: authority.useCase,
    summary: authority.summary,
    runLabel: publication.runLabel,
    deepDivePath: publication.deepDivePath,
    group: publication.group,
    releaseState: publication.releaseState,
    version: authority.version,
    npmUrl: authority.npmUrl,
    repoUrl: authority.repoUrl,
    license: authority.license,
    interactiveLabel: publication.interactiveLabel
  }
}

export const cards: ReadonlyArray<Card> = Arr.map(consumerIds, cardForId)

export const effectCards: ReadonlyArray<Card> = Arr.filter(cards, (c) => c.group === "effect")

export const scenesystemsCards: ReadonlyArray<Card> = Arr.filter(cards, (c) => c.group === "scenesystems")

export const cardById = (id: string): Option.Option<Card> =>
  isPackageConsumerId(id)
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
