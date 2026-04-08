import type { Effect } from "effect"
import { Match, Option, Stream } from "effect"
import * as Arr from "effect/Array"

import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import type { CanonicalStep } from "../../../contracts/study/workflow/canonical-step.js"
import { sectionEffectsToElements, stage, step, type StreamElement } from "../../kernel/kinds/stream-element.js"
import type { CachedEffectTextMeasurements, ObstacleProjection } from "./analysis.js"
import { customTextSection } from "./custom-text-section.js"
import {
  browserEnvelopeSection,
  browserEnvelopeSectionEffect,
  consumerProofSection,
  consumerProofSectionEffect,
  experimentalLaneSection,
  experimentalLaneSectionEffect
} from "./package-story.js"
import type { CorpusMatrixEntry, WidthMetric } from "./projection.js"
import {
  corpusMatrixSection,
  corpusMatrixSectionEffects,
  corpusOverviewSectionEffect,
  corpusSection,
  obstacleSection,
  obstacleSectionEffect,
  performanceSection,
  performanceSectionEffect,
  widthMetricsSection
} from "./sections.js"

type EffectTextRunStory = {
  readonly baselineDurationMs: number
  readonly naiveLineErrorMean: number
  readonly obstacleProjection: ObstacleProjection
  readonly optimizedDurationMs: number
  readonly projectedMatrix: ReadonlyArray<CorpusMatrixEntry>
  readonly sampleLabel: string
  readonly widthMetricSnapshot: ReadonlyArray<WidthMetric>
}

type EffectTextStreamStory = {
  readonly customText: Option.Option<string>
  readonly measurements: CachedEffectTextMeasurements
  readonly projectionSteps: ReadonlyArray<CanonicalStep>
}

type SectionStageDescriptor = {
  readonly _tag: "sections"
  readonly stageId: string
  readonly runSections: (story: EffectTextRunStory) => ReadonlyArray<EvidenceSection>
  readonly streamSections: (
    story: EffectTextStreamStory
  ) => ReadonlyArray<Effect.Effect<EvidenceSection, unknown, never>>
}

type ProjectionStepStageDescriptor = {
  readonly _tag: "projection-steps"
  readonly stageId: "corpus-sweep"
  readonly projectionSteps: (story: EffectTextStreamStory) => ReadonlyArray<CanonicalStep>
}

type EffectTextStageDescriptor = SectionStageDescriptor | ProjectionStepStageDescriptor

const customTextSectionEffects = (
  customText: Option.Option<string>
): ReadonlyArray<Effect.Effect<EvidenceSection, unknown, never>> =>
  Option.match(customText, {
    onSome: (text) => [customTextSection(text)],
    onNone: () => []
  })

const effectTextStageDescriptors: ReadonlyArray<EffectTextStageDescriptor> = [
  {
    _tag: "projection-steps",
    stageId: "corpus-sweep",
    projectionSteps: ({ projectionSteps }) => projectionSteps
  },
  {
    _tag: "sections",
    stageId: "consumer-proof",
    runSections: () => [consumerProofSection()],
    streamSections: () => [consumerProofSectionEffect]
  },
  {
    _tag: "sections",
    stageId: "browser-envelope",
    runSections: () => [browserEnvelopeSection()],
    streamSections: () => [browserEnvelopeSectionEffect]
  },
  {
    _tag: "sections",
    stageId: "corpus-overview",
    runSections: ({ sampleLabel }) => [corpusSection(sampleLabel)],
    streamSections: () => [corpusOverviewSectionEffect]
  },
  {
    _tag: "sections",
    stageId: "custom-text",
    runSections: () => [],
    streamSections: ({ customText }) => customTextSectionEffects(customText)
  },
  {
    _tag: "sections",
    stageId: "performance",
    runSections: ({ baselineDurationMs, naiveLineErrorMean, optimizedDurationMs }) => [
      performanceSection({ baselineDurationMs, optimizedDurationMs, naiveLineErrorMean })
    ],
    streamSections: ({ measurements }) => [performanceSectionEffect(measurements)]
  },
  {
    _tag: "sections",
    stageId: "obstacle-reflow",
    runSections: ({ obstacleProjection: projection }) => [obstacleSection(projection)],
    streamSections: ({ measurements }) => [obstacleSectionEffect(measurements)]
  },
  {
    _tag: "sections",
    stageId: "experimental-lane",
    runSections: () => [experimentalLaneSection()],
    streamSections: () => [experimentalLaneSectionEffect]
  },
  {
    _tag: "sections",
    stageId: "corpus-matrix",
    runSections: ({ projectedMatrix, widthMetricSnapshot }) => [
      corpusMatrixSection(projectedMatrix),
      widthMetricsSection(widthMetricSnapshot)
    ],
    streamSections: ({ measurements }) => corpusMatrixSectionEffects(measurements)
  }
]

const sectionStageStream = (
  stageId: string,
  sectionEffects: ReadonlyArray<Effect.Effect<EvidenceSection, unknown, never>>
): Stream.Stream<StreamElement, unknown, never> =>
  sectionEffects.length === 0
    ? Stream.empty
    : stage(stageId, sectionEffectsToElements(sectionEffects))

const stageStreamFor = (
  descriptor: EffectTextStageDescriptor,
  story: EffectTextStreamStory
): Stream.Stream<StreamElement, unknown, never> =>
  Match.value(descriptor).pipe(
    Match.tag("sections", ({ stageId, streamSections }) => sectionStageStream(stageId, streamSections(story))),
    Match.tag("projection-steps", ({ projectionSteps, stageId }) =>
      stage(stageId, Stream.fromIterable(projectionSteps(story)).pipe(Stream.map(step)))),
    Match.exhaustive
  )

export const runSectionsForStory = (story: EffectTextRunStory): ReadonlyArray<EvidenceSection> =>
  Arr.flatMap(
    effectTextStageDescriptors,
    (descriptor) => descriptor._tag === "sections" ? descriptor.runSections(story) : []
  )

export const streamSectionEffectsForStory = (
  story: EffectTextStreamStory
): ReadonlyArray<Effect.Effect<EvidenceSection, unknown, never>> =>
  Arr.flatMap(
    effectTextStageDescriptors,
    (descriptor) => descriptor._tag === "sections" ? descriptor.streamSections(story) : []
  )

export const streamStageStreamsForStory = (
  story: EffectTextStreamStory
): ReadonlyArray<Stream.Stream<StreamElement, unknown, never>> =>
  Arr.map(effectTextStageDescriptors, (descriptor) => stageStreamFor(descriptor, story))

export const streamStagePlansForStory = (
  story: EffectTextStreamStory
): ReadonlyArray<{
  readonly stageId: string
  readonly stream: Stream.Stream<StreamElement, unknown, never>
}> =>
  Arr.map(effectTextStageDescriptors, (descriptor) => ({
    stageId: descriptor.stageId,
    stream: stageStreamFor(descriptor, story)
  }))
