import { Effect, Option, Stream } from "effect"

import { effectTextProjectionSteps, viewportProjectionSteps } from "../../../contracts/capability/effect-text.js"
import type { StreamManifest } from "../../../contracts/evidence/manifest.js"
import type { CanonicalStep } from "../../../contracts/study/workflow/canonical-step.js"
import { concatStreams, sectionEffectsToStream, type StreamElement } from "../../kernel/kinds/stream-element.js"
import { makeStreamPlan, phaseFromElementStream } from "../../kernel/kinds/stream-plan.js"
import { cachedEffectTextMeasurements } from "./analysis.js"
import { preloadProgram } from "./preload.js"
import { streamSectionEffectsForStory, streamStagePlansForStory, streamStageStreamsForStory } from "./stage-story.js"

export const runSummary =
  "Browser-backed measurement, prepared-handle reuse, obstacle-aware reflow, and optional calibration work — all grounded in the shipped effect-text browser and React surfaces."

const normalizeCustomText = (customText: Option.Option<string>): Option.Option<string> =>
  customText.pipe(
    Option.map((text) => text.trim()),
    Option.filter((text) => text.length > 0)
  )

type EffectTextStreamRequest = {
  readonly customText: Option.Option<string>
  readonly projectionSteps: ReadonlyArray<CanonicalStep>
}

const requestFromManifest = (manifest: StreamManifest | null): EffectTextStreamRequest => {
  const rawCustomText = manifest != null && manifest._tag === "effect-text" ? manifest.customText : ""
  const viewportWidthPx = manifest != null && manifest._tag === "effect-text" ? manifest.viewportWidthPx : 0

  return {
    customText: normalizeCustomText(Option.some(rawCustomText)),
    projectionSteps: viewportWidthPx > 0
      ? viewportProjectionSteps(rawCustomText, viewportWidthPx)
      : effectTextProjectionSteps(rawCustomText)
  }
}

export const streamSections = (customText?: string) =>
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const measurements = yield* cachedEffectTextMeasurements

      return sectionEffectsToStream(
        streamSectionEffectsForStory({
          customText: normalizeCustomText(Option.fromNullable(customText)),
          measurements,
          projectionSteps: []
        })
      )
    })
  )

export const streamElements = (manifest: StreamManifest | null): Stream.Stream<StreamElement, unknown, never> =>
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const request = requestFromManifest(manifest)
      const measurements = yield* cachedEffectTextMeasurements
      return concatStreams(
        streamStageStreamsForStory({
          customText: request.customText,
          measurements,
          projectionSteps: request.projectionSteps
        })
      )
    })
  )

export const streamPlan = (manifest: StreamManifest | null) =>
  Effect.gen(function*() {
    const request = requestFromManifest(manifest)
    const measurements = yield* cachedEffectTextMeasurements

    return makeStreamPlan({
      packageName: "effect-text",
      program: preloadProgram,
      summary: runSummary,
      phases: streamStagePlansForStory({
        customText: request.customText,
        measurements,
        projectionSteps: request.projectionSteps
      }).map(({ stageId, stream }) => phaseFromElementStream(stageId, stream))
    })
  })
