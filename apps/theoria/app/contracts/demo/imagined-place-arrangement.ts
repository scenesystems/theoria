import { Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { Text } from "@scenesystems/effect-text"

import { PlaceLine, PlaceMarker, type PlaceRendering } from "../imagined-place-result.js"
import { type ParticipantRole, type PlaceArtifact, placeFeatures, type PlaceOutline } from "../imagined-place.js"
import { prepareInputFor } from "../text.js"

import {
  flowLines,
  FlowQuality,
  flowQuality,
  minimumSeparation,
  occupiedHeight,
  placeMarkers,
  placeTextRole,
  type Stage
} from "./imagined-place-flow.js"
import { type Meander, renderSeed } from "./imagined-place-search.js"

/**
 * The text that flows around the markers: what the place is, how it feels,
 * and every feature in it, including accepted proposals. Feature names are not
 * repeated in the prose; the markers carry them, so the paragraph reads as a
 * description rather than a list.
 *
 * @since 0.3.0
 */
export const description = (place: PlaceOutline): string =>
  Arr.join(
    Arr.prependAll(Arr.map(placeFeatures(place), (feature) => feature.description), [
      place.composition.summary,
      place.composition.atmosphere
    ]),
    " "
  )

/**
 * What to prepare for measurement, in the role the stage renders it with. An
 * outline from a scenario's recording gives the text a build for it will
 * flow before that build arrives — the same words, from the recording the
 * server replays — so the stage can be cut to the paper they will want.
 */
export const descriptionInput = (place: PlaceOutline): Text.PrepareInputType =>
  prepareInputFor(placeTextRole, description(place))

/** Who added each feature, aligned with `placeFeatures(place)`; the composition's own have no contributor but the author. */
export const contributorsOf = (place: PlaceOutline): ReadonlyArray<Option.Option<ParticipantRole>> =>
  Arr.appendAll(
    Arr.map(place.composition.features, () => Option.none()),
    Arr.map(place.accepted, (proposal) => Option.some(proposal.proposer))
  )

export const Arrangement = Schema.Struct({
  markers: Schema.Array(PlaceMarker),
  lines: Schema.Array(PlaceLine),
  quality: FlowQuality
})
export type Arrangement = typeof Arrangement.Type

/**
 * The description flowed around the given markers, and how good that is: what
 * every drawing of the stage is, whether the search placed the markers or
 * they are on their way between two of its placements.
 *
 * @since 0.3.0
 */
export const arrangedAround = (
  prepared: Text.PreparedTextWithSegments,
  stage: Stage
) =>
(markers: ReadonlyArray<PlaceMarker>): Arrangement => {
  const lines = flowLines(prepared, stage, markers)
  return { markers, lines, quality: flowQuality(stage, markers, lines) }
}

/**
 * One candidate: markers on the meander, the description flowed around them,
 * and how good that is. The search calls this once per trial.
 *
 * @since 0.3.0
 */
export const arrange = (
  artifact: PlaceArtifact,
  prepared: Text.PreparedTextWithSegments,
  stage: Stage
) => {
  const around = arrangedAround(prepared, stage)
  return (meander: Meander): Arrangement =>
    around(placeMarkers(placeFeatures(artifact), contributorsOf(artifact), stage, meander))
}

/**
 * The rendering for a chosen arrangement: the stage is cut to what is used and
 * the evidence says how the search went.
 *
 * @since 0.3.0
 */
export const renderingFor = ({
  arrangement,
  bestLoss,
  stage,
  trials
}: {
  readonly arrangement: Arrangement
  readonly bestLoss: number
  readonly stage: Stage
  readonly trials: number
}): PlaceRendering => ({
  projection: {
    stageWidth: stage.stageWidth,
    stageHeight: Math.round(occupiedHeight(stage, arrangement.markers, arrangement.lines) + stage.padding),
    padding: stage.padding,
    lineHeight: stage.lineHeight,
    markers: arrangement.markers,
    lines: arrangement.lines
  },
  evidence: {
    sampler: "tpe",
    seed: renderSeed,
    trials,
    bestLoss,
    minimumSeparation: minimumSeparation(stage, arrangement.markers),
    lineCount: arrangement.quality.lineCount,
    narrowestLine: arrangement.quality.narrowestLine,
    raggedness: arrangement.quality.raggedness
  }
})
