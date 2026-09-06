import { Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { Sampler, SearchSpace } from "@scenesystems/effect-search"
import type { Text } from "@scenesystems/effect-text"

import { PlaceLine, PlaceMarker, type PlaceRendering } from "../imagined-place-result.js"
import { type ParticipantRole, type PlaceArtifact, placeFeatures } from "../imagined-place.js"
import { prepareInputFor } from "../text.js"

import {
  flowLines,
  FlowQuality,
  flowQuality,
  type Meander,
  meanderBounds,
  minimumSeparation,
  occupiedHeight,
  placeMarkers,
  placeTextRole,
  type Stage
} from "./imagined-place-flow.js"

/**
 * Deterministic search settings. The seed is fixed so the same artifact at the
 * same stage width always renders the same way; both values are reported.
 *
 * @since 0.3.0
 */
export const renderSeed = 42
export const renderTrials = 36

export const renderSampler = () => Sampler.tpe({ seed: renderSeed })

/**
 * The text that flows around the markers: what the place is, how it feels,
 * and every feature in it, including accepted proposals. Feature names are not
 * repeated in the prose; the markers carry them, so the paragraph reads as a
 * description rather than a list.
 *
 * @since 0.3.0
 */
export const description = (artifact: PlaceArtifact): string =>
  Arr.join(
    Arr.prependAll(
      Arr.map(placeFeatures(artifact), (feature) => feature.description),
      [artifact.composition.summary, artifact.composition.atmosphere]
    ),
    " "
  )

/** What to prepare for measurement, in the role the stage renders it with. */
export const descriptionInput = (artifact: PlaceArtifact): Text.PrepareInputType =>
  prepareInputFor(placeTextRole, description(artifact))

/** Who added each feature, aligned with `placeFeatures(artifact)`. */
export const contributorsOf = (artifact: PlaceArtifact): ReadonlyArray<Option.Option<ParticipantRole>> =>
  Arr.appendAll(
    Arr.map(artifact.composition.features, () => Option.none()),
    Arr.map(artifact.accepted, (proposal) => Option.some(proposal.proposer))
  )

export const meanderSpace = SearchSpace.make({
  edge: SearchSpace.float(...meanderBounds.edge),
  swing: SearchSpace.float(...meanderBounds.swing),
  phase: SearchSpace.float(...meanderBounds.phase),
  turns: SearchSpace.float(...meanderBounds.turns),
  top: SearchSpace.float(...meanderBounds.top),
  step: SearchSpace.float(...meanderBounds.step)
})

export const Arrangement = Schema.Struct({
  markers: Schema.Array(PlaceMarker),
  lines: Schema.Array(PlaceLine),
  quality: FlowQuality
})
export type Arrangement = typeof Arrangement.Type

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
) =>
(meander: Meander): Arrangement => {
  const markers = placeMarkers(placeFeatures(artifact), contributorsOf(artifact), stage, meander)
  const lines = flowLines(prepared, stage, markers)
  return { markers, lines, quality: flowQuality(stage, markers, lines) }
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
