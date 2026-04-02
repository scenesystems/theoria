import { Effect, Option, Stream } from "effect"

import type { CanonicalStep } from "../../../contracts/canonical-step.js"
import { effectTextProjectionSteps, viewportProjectionSteps } from "../../../contracts/demo/text.js"
import type { EvidenceSection } from "../../../contracts/evidence.js"
import type { StreamManifest } from "../../../contracts/stream-manifest.js"
import {
  concatStreams,
  sectionEffectsToElements,
  sectionEffectsToStream,
  stage,
  step,
  type StreamElement
} from "../stream-element.js"
import { type CachedEffectTextMeasurements, cachedEffectTextMeasurements } from "./analysis.js"
import { customTextSection } from "./custom-text-section.js"
import {
  corpusMatrixSectionEffects,
  corpusOverviewSectionEffect,
  obstacleSectionEffect,
  performanceSectionEffect
} from "./sections.js"

const normalizeCustomText = (customText: Option.Option<string>): Option.Option<string> =>
  customText.pipe(
    Option.map((text) => text.trim()),
    Option.filter((text) => text.length > 0)
  )

const customTextSectionEffects = (
  customText: Option.Option<string>
): ReadonlyArray<Effect.Effect<EvidenceSection, unknown, never>> =>
  Option.match(customText, {
    onSome: (text) => [customTextSection(text)],
    onNone: () => []
  })

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

const evidenceSectionEffects = (
  customText: Option.Option<string>,
  measurements: CachedEffectTextMeasurements
): ReadonlyArray<Effect.Effect<EvidenceSection, unknown, never>> => [
  corpusOverviewSectionEffect,
  ...customTextSectionEffects(customText),
  obstacleSectionEffect(measurements),
  performanceSectionEffect(measurements),
  ...corpusMatrixSectionEffects(measurements)
]

const customTextStage = (customText: Option.Option<string>): Stream.Stream<StreamElement, unknown, never> =>
  Option.match(customText, {
    onSome: (text) => stage("custom-text", sectionEffectsToElements([customTextSection(text)])),
    onNone: () => Stream.empty
  })

export const streamSections = (customText?: string) =>
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const measurements = yield* cachedEffectTextMeasurements

      return sectionEffectsToStream(
        evidenceSectionEffects(normalizeCustomText(Option.fromNullable(customText)), measurements)
      )
    })
  )

export const streamElements = (manifest: StreamManifest | null): Stream.Stream<StreamElement, unknown, never> =>
  Stream.unwrapScoped(
    Effect.gen(function*() {
      const request = requestFromManifest(manifest)
      const measurements = yield* cachedEffectTextMeasurements
      const corpusOverviewStream = stage(
        "corpus-overview",
        concatStreams([
          sectionEffectsToElements([corpusOverviewSectionEffect]),
          customTextStage(request.customText)
        ])
      )

      const projectionStepStream = stage(
        "corpus-sweep",
        Stream.fromIterable(request.projectionSteps).pipe(Stream.map(step))
      )

      const trailingEvidenceStream = concatStreams([
        stage("obstacle-reflow", sectionEffectsToElements([obstacleSectionEffect(measurements)])),
        stage("performance", sectionEffectsToElements([performanceSectionEffect(measurements)])),
        stage("corpus-matrix", sectionEffectsToElements(corpusMatrixSectionEffects(measurements)))
      ])

      return concatStreams([
        corpusOverviewStream,
        Stream.merge(projectionStepStream, trailingEvidenceStream)
      ])
    })
  )
