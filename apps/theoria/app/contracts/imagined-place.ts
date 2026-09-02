import { Schema } from "effect"
import * as Arr from "effect/Array"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const UnitInterval = Schema.Number.pipe(Schema.between(0, 1))

/**
 * Recorded place patterns a visitor can start from.
 *
 * @since 0.3.0
 */
export const PlaceScenario = Schema.Literal("unfinished-light", "lost-market", "drowned-library")
export type PlaceScenario = typeof PlaceScenario.Type
export const placeScenarios: ReadonlyArray<PlaceScenario> = PlaceScenario.literals

/**
 * What the visitor sees of a pattern before anything is built: its name and
 * the brief the recorded composition was made for. The server catalog uses the
 * same brief, so editing it is the visible difference between "recorded for
 * this brief" and "your brief".
 *
 * @since 0.3.0
 */
export const placeScenarioMeta: Record<PlaceScenario, { readonly label: string; readonly brief: string }> = {
  "unfinished-light": {
    label: "Unfinished light",
    brief:
      "A lighthouse on a rock you can only reach at low tide, whose lamp burns only while someone inside is writing a letter they can't finish. The boats steer by it, so someone always has to be writing."
  },
  "lost-market": {
    label: "Lost market",
    brief:
      "A market that opens once a month in whichever building the town has just emptied, selling only things people have lost. You can buy back your own thing, but only by telling the day you lost it."
  },
  "drowned-library": {
    label: "Drowned library",
    brief:
      "The library of the valley town that was flooded for the reservoir. Every ten years they drain the water for the dam works, and for a week the town comes back to read what survived."
  }
}

/**
 * Who can sign something in the demo. The author is the visitor; the neighbor
 * is another person; the program is the model program acting as a proposer.
 *
 * @since 0.3.0
 */
export const ParticipantRole = Schema.Literal("author", "neighbor", "program")
export type ParticipantRole = typeof ParticipantRole.Type

export const PlaceFeature = Schema.Struct({
  name: NonEmptyString,
  description: NonEmptyString,
  weight: UnitInterval
})
export type PlaceFeature = typeof PlaceFeature.Type

/**
 * Output contract of the composer program in `server/imagined-place/compose.ts`.
 *
 * @since 0.3.0
 */
export const PlaceComposition = Schema.Struct({
  title: NonEmptyString,
  summary: NonEmptyString,
  atmosphere: NonEmptyString,
  features: Schema.Array(PlaceFeature).pipe(Schema.minItems(3))
})
export type PlaceComposition = typeof PlaceComposition.Type

/**
 * Output contract of the proposer program: one feature and why it belongs.
 *
 * @since 0.3.0
 */
export const ProposedFeature = Schema.Struct({
  ...PlaceFeature.fields,
  rationale: NonEmptyString
})
export type ProposedFeature = typeof ProposedFeature.Type

/**
 * A proposal offered to the author. It is digested and signed on its own so it
 * keeps its identity and its proposer's signature after a merge.
 *
 * @since 0.3.0
 */
export const Proposal = Schema.Struct({
  proposer: ParticipantRole,
  feature: ProposedFeature
})
export type Proposal = typeof Proposal.Type

/**
 * One version of the place. The content ID is a digest of this value and
 * nothing else. `parent` is the content ID of the version this one extends, so
 * the chain of IDs is the place's lineage. Presentation never lives here.
 *
 * @since 0.3.0
 */
export const PlaceArtifact = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  parent: Schema.optional(NonEmptyString),
  scenario: PlaceScenario,
  brief: NonEmptyString,
  composition: PlaceComposition,
  accepted: Schema.Array(Proposal)
})
export type PlaceArtifact = typeof PlaceArtifact.Type

/**
 * Every feature that appears in the rendered place: the composition's own,
 * then each accepted proposal's, in acceptance order.
 *
 * @since 0.3.0
 */
export const placeFeatures = (artifact: PlaceArtifact): ReadonlyArray<PlaceFeature> =>
  Arr.appendAll(
    artifact.composition.features,
    Arr.map(artifact.accepted, (proposal) => ({
      name: proposal.feature.name,
      description: proposal.feature.description,
      weight: proposal.feature.weight
    }))
  )

export const briefMaxLength = 280

/**
 * Everything the visitor can change about the place itself. Presentation
 * (stage width) is not here: it never reaches the server and never changes a
 * content ID.
 *
 * @since 0.3.0
 */
export const PlaceBuildRequest = Schema.Struct({
  scenario: PlaceScenario,
  brief: NonEmptyString.pipe(Schema.maxLength(briefMaxLength)),
  acceptNeighbor: Schema.Boolean,
  acceptProgram: Schema.Boolean
})
export type PlaceBuildRequest = typeof PlaceBuildRequest.Type

export class PlaceBuildError extends Schema.TaggedError<PlaceBuildError>()("PlaceBuildError", {
  stage: Schema.Literal("compose", "propose", "identity", "render", "signature", "seal"),
  message: Schema.String
}) {}
