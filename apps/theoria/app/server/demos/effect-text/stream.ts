import { Effect, Option, Stream } from "effect"

import type { CanonicalStep } from "../../../contracts/canonical-step.js"
import { effectTextProjectionSteps, viewportProjectionSteps } from "../../../contracts/demo/text.js"
import type { StreamManifest } from "../../../contracts/stream-manifest.js"
import { concatStreams, sectionEffectsToStream, type StreamElement } from "../stream-element.js"
import { cachedEffectTextMeasurements } from "./analysis.js"
import { streamSectionEffectsForStory, streamStageStreamsForStory } from "./stage-story.js"

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
