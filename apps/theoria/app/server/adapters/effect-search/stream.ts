import type { FileSystem, Path } from "@effect/platform"
import { Effect, Option, Stream } from "effect"
import * as Arr from "effect/Array"

import { effectSearchStudyTelemetrySections } from "../../../contracts/capability/effect-search-study-telemetry-evidence.js"
import { projectEffectSearchStudyTelemetry } from "../../../contracts/capability/effect-search-study-telemetry-projection.js"
import {
  bestFoundSection,
  bestTrialPoint,
  defaultSamplerSeed,
  defaultTrialBudget,
  distanceToOptimum,
  EffectSearchCanonicalStep,
  gain,
  gainPercent,
  objectiveExpression,
  optimizationEvidenceBatchSize,
  searchBounds,
  type TrialPoint,
  trialPositionsSection
} from "../../../contracts/capability/effect-search.js"
import { effectSearchEntryDescriptor } from "../../../contracts/entry/descriptors/effect-search.js"
import { entryRunIdentityForId } from "../../../contracts/entry/routing.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import type { StreamManifest } from "../../../contracts/evidence/manifest.js"
import { section, sectionUpsert, step, type StreamElement } from "../../kernel/kinds/stream-element.js"
import { type DemoStreamPlan, phaseFromElementStream } from "../../kernel/kinds/stream-plan.js"

import { preloadProgram } from "./preload.js"
import { randomLaneStory, type StudyLaneStory, tpeLaneStory } from "./study-story.js"

type EffectSearchStreamRequest = {
  readonly trialBudget: number
}

type OptimizationStory = {
  readonly elements: ReadonlyArray<StreamElement>
  readonly randomTrials: ReadonlyArray<TrialPoint>
  readonly tpeTrials: ReadonlyArray<TrialPoint>
}

type SectionAccumulator = ReadonlyArray<EvidenceSection>

const effectSearchRunIdentity = entryRunIdentityForId(effectSearchEntryDescriptor.entryId)

export const defaultEffectSearchStreamRequest: EffectSearchStreamRequest = {
  trialBudget: defaultTrialBudget
}

const requestFromManifest = (manifest: StreamManifest | null): EffectSearchStreamRequest =>
  manifest !== null && manifest._tag === effectSearchEntryDescriptor.entryId
    ? { trialBudget: manifest.trialBudget }
    : defaultEffectSearchStreamRequest

const emptyElements: ReadonlyArray<StreamElement> = []

const bestHistoryFromTrialPoints = (trials: ReadonlyArray<TrialPoint>): ReadonlyArray<number> =>
  trials.reduce<ReadonlyArray<number>>((history, trial) => {
    const bestSoFar = Option.match(Option.fromNullable(history.at(-1)), {
      onNone: () => trial.value,
      onSome: (previousBest) => Math.min(previousBest, trial.value)
    })

    return [...history, bestSoFar]
  }, [])

export const configurationSection = (request: EffectSearchStreamRequest): EvidenceSection => ({
  title: "Configuration",
  items: [
    { _tag: "Scalar", label: "Trials per sampler", value: request.trialBudget, unit: "trials", format: "integer" },
    { _tag: "Scalar", label: "Sampler seed", value: defaultSamplerSeed, unit: "seed", format: "integer" },
    { _tag: "Text", label: "X range", value: `[${searchBounds.xMin}, ${searchBounds.xMax}]` },
    { _tag: "Text", label: "Y range", value: `[${searchBounds.yMin}, ${searchBounds.yMax}]` }
  ]
})

const tpeConvergenceSection = (tpeTrials: ReadonlyArray<TrialPoint>): EvidenceSection => {
  const bestTrial = Option.getOrElse(bestTrialPoint(tpeTrials), () => ({
    x: searchBounds.xMin,
    y: searchBounds.yMin,
    value: 0,
    index: 0
  }))

  return {
    title: "TPE Convergence",
    items: [
      { _tag: "Text", label: "Objective", value: objectiveExpression },
      {
        _tag: "Text",
        label: "Best configuration",
        value: `x=${bestTrial.x.toFixed(4)}, y=${bestTrial.y.toFixed(4)}`
      },
      { _tag: "Scalar", label: "Trials", value: tpeTrials.length, unit: "trials", format: "integer" },
      {
        _tag: "Scalar",
        label: "Distance to optimum",
        value: distanceToOptimum({ x: bestTrial.x, y: bestTrial.y }),
        unit: "distance",
        format: "fixed"
      },
      {
        _tag: "Series",
        label: "TPE convergence",
        values: bestHistoryFromTrialPoints(tpeTrials),
        unit: "loss",
        role: "convergence"
      }
    ]
  }
}

const randomSearchSection = (randomTrials: ReadonlyArray<TrialPoint>): EvidenceSection => {
  const bestTrial = Option.getOrElse(bestTrialPoint(randomTrials), () => ({
    x: searchBounds.xMin,
    y: searchBounds.yMin,
    value: 0,
    index: 0
  }))

  return {
    title: "Random Search",
    items: [
      { _tag: "Text", label: "Objective", value: objectiveExpression },
      {
        _tag: "Text",
        label: "Best configuration",
        value: `x=${bestTrial.x.toFixed(4)}, y=${bestTrial.y.toFixed(4)}`
      },
      { _tag: "Scalar", label: "Trials", value: randomTrials.length, unit: "trials", format: "integer" },
      {
        _tag: "Scalar",
        label: "Distance to optimum",
        value: distanceToOptimum({ x: bestTrial.x, y: bestTrial.y }),
        unit: "distance",
        format: "fixed"
      },
      {
        _tag: "Series",
        label: "Random convergence",
        values: bestHistoryFromTrialPoints(randomTrials),
        unit: "loss",
        role: "convergence"
      }
    ]
  }
}

const optimizationResultsSection = ({
  randomTrials,
  tpeTrials
}: {
  readonly randomTrials: ReadonlyArray<TrialPoint>
  readonly tpeTrials: ReadonlyArray<TrialPoint>
}): EvidenceSection => {
  const randomBest = Option.getOrElse(bestTrialPoint(randomTrials), () => ({
    x: searchBounds.xMin,
    y: searchBounds.yMin,
    value: 0,
    index: 0
  }))
  const tpeBest = Option.getOrElse(bestTrialPoint(tpeTrials), () => ({
    x: searchBounds.xMin,
    y: searchBounds.yMin,
    value: 0,
    index: 0
  }))

  return {
    title: "Optimization Results",
    items: [
      {
        _tag: "Comparison",
        label: "Best objective value",
        baseline: randomBest.value,
        improved: tpeBest.value,
        unit: "loss",
        direction: "lower-is-better"
      },
      {
        _tag: "Comparison",
        label: "Distance to optimum",
        baseline: distanceToOptimum({ x: randomBest.x, y: randomBest.y }),
        improved: distanceToOptimum({ x: tpeBest.x, y: tpeBest.y }),
        unit: "distance",
        direction: "lower-is-better"
      },
      {
        _tag: "Scalar",
        label: "Absolute gain",
        value: gain(randomBest.value, tpeBest.value),
        unit: "loss",
        format: "fixed"
      },
      {
        _tag: "Scalar",
        label: "Percent gain",
        value: gainPercent(randomBest.value, tpeBest.value),
        unit: "%",
        format: "fixed"
      }
    ]
  }
}

const runtimeSummarySection = (request: EffectSearchStreamRequest): EvidenceSection => ({
  title: "Runtime Summary",
  items: [
    { _tag: "Scalar", label: "Trials per sampler", value: request.trialBudget, unit: "trials", format: "integer" },
    { _tag: "Text", label: "Objective", value: objectiveExpression },
    { _tag: "Text", label: "Optimum", value: `(2, -1) → 0` },
    {
      _tag: "Text",
      label: "Proof",
      value:
        "The run authored optimizer checkpoints, package StudyEvent telemetry, and evidence on the server, then projected them in the browser without recomputing ask/tell state locally."
    }
  ]
})

const shouldPublishCheckpoint = ({
  nextTrialCount,
  publishedTrialCount
}: {
  readonly nextTrialCount: number
  readonly publishedTrialCount: number
}): boolean =>
  nextTrialCount > publishedTrialCount
  && (nextTrialCount === 1 || nextTrialCount % optimizationEvidenceBatchSize === 0)

const shouldAppendCheckpoint = ({
  nextTrialCount,
  phase,
  publishedTrialCount
}: {
  readonly nextTrialCount: number
  readonly phase: "running" | "complete"
  readonly publishedTrialCount: number
}): boolean => phase === "complete" || shouldPublishCheckpoint({ nextTrialCount, publishedTrialCount })

const checkpointAt = (story: StudyLaneStory, index: number) =>
  story.checkpoints[index] ?? {
    events: story.events,
    trialPoints: story.trialPoints
  }

const computeOptimizationStory = (request: EffectSearchStreamRequest): Effect.Effect<OptimizationStory, never, never> =>
  Effect.gen(function*() {
    const [tpeStory, randomStory] = yield* Effect.all([
      tpeLaneStory(request.trialBudget),
      randomLaneStory(request.trialBudget)
    ], { concurrency: "unbounded" })
    const elements = Arr.reduce(
      Arr.range(0, request.trialBudget - 1),
      { elements: emptyElements, publishedTrialCount: 0 },
      (state, index) => {
        const tpeCheckpoint = checkpointAt(tpeStory, index)
        const randomCheckpoint = checkpointAt(randomStory, index)
        const nextTrialCount = Math.min(tpeCheckpoint.trialPoints.length, randomCheckpoint.trialPoints.length)
        const phase = index + 1 === request.trialBudget ? "complete" : "running"
        const telemetry = projectEffectSearchStudyTelemetry({
          randomEvents: randomCheckpoint.events,
          randomTrialPoints: randomCheckpoint.trialPoints,
          trialBudget: request.trialBudget,
          tpeEvents: tpeCheckpoint.events,
          tpeTrialPoints: tpeCheckpoint.trialPoints
        })
        const nextElements = [
          ...state.elements,
          step(
            new EffectSearchCanonicalStep({
              trialBudget: request.trialBudget,
              phase,
              tpeTrials: tpeCheckpoint.trialPoints,
              randomTrials: randomCheckpoint.trialPoints,
              telemetry
            })
          )
        ]

        if (!shouldAppendCheckpoint({ nextTrialCount, phase, publishedTrialCount: state.publishedTrialCount })) {
          return {
            elements: nextElements,
            publishedTrialCount: state.publishedTrialCount
          }
        }

        return {
          elements: [
            ...nextElements,
            sectionUpsert(
              trialPositionsSection({
                force: phase === "complete",
                randomPoints: randomCheckpoint.trialPoints,
                tpePoints: tpeCheckpoint.trialPoints
              })
            ),
            ...Option.match(bestFoundSection(tpeCheckpoint.trialPoints, randomCheckpoint.trialPoints), {
              onNone: (): ReadonlyArray<StreamElement> => [],
              onSome: (nextSection): ReadonlyArray<StreamElement> => [sectionUpsert(nextSection)]
            }),
            ...effectSearchStudyTelemetrySections(telemetry).map(sectionUpsert)
          ],
          publishedTrialCount: nextTrialCount
        }
      }
    )

    return {
      elements: elements.elements,
      randomTrials: randomStory.trialPoints,
      tpeTrials: tpeStory.trialPoints
    }
  })

const streamPhasesForStory = ({
  request,
  story
}: {
  readonly request: EffectSearchStreamRequest
  readonly story: OptimizationStory
}): ReadonlyArray<{
  readonly name: string
  readonly stream: Stream.Stream<StreamElement, never, never>
}> => [
  {
    name: "projection-events",
    stream: Stream.fromIterable(story.elements)
  },
  { name: "configuration", stream: Stream.succeed(section(configurationSection(request))) },
  { name: "tpe-convergence", stream: Stream.succeed(section(tpeConvergenceSection(story.tpeTrials))) },
  { name: "random-search", stream: Stream.succeed(section(randomSearchSection(story.randomTrials))) },
  {
    name: "optimization-results",
    stream: Stream.succeed(
      section(optimizationResultsSection({ randomTrials: story.randomTrials, tpeTrials: story.tpeTrials }))
    )
  },
  { name: "runtime-summary", stream: Stream.succeed(section(runtimeSummarySection(request))) }
]

const appendOrReplaceSection = (
  sections: SectionAccumulator,
  nextSection: EvidenceSection
): SectionAccumulator => {
  const existingIndex = sections.findIndex((section) => section.title === nextSection.title)

  return existingIndex === -1
    ? [...sections, nextSection]
    : sections.map((section, index) => (index === existingIndex ? nextSection : section))
}

const projectionSectionsForStory = (story: OptimizationStory): ReadonlyArray<EvidenceSection> =>
  story.elements.reduce<SectionAccumulator>((sections, element) => {
    if (element._tag === "section" || element._tag === "section-upsert") {
      return appendOrReplaceSection(sections, element.section)
    }

    return sections
  }, [])

export const runSummary = "effect-search compared adaptive TPE against random search under fixed budget."

export const runSections = (
  request: EffectSearchStreamRequest
): Effect.Effect<ReadonlyArray<EvidenceSection>, never, never> =>
  computeOptimizationStory(request).pipe(
    Effect.map((story) => [
      ...projectionSectionsForStory(story),
      configurationSection(request),
      tpeConvergenceSection(story.tpeTrials),
      randomSearchSection(story.randomTrials),
      optimizationResultsSection({ randomTrials: story.randomTrials, tpeTrials: story.tpeTrials }),
      runtimeSummarySection(request)
    ])
  )

export const streamSections = (request: EffectSearchStreamRequest): Stream.Stream<EvidenceSection, never, never> =>
  Stream.unwrap(
    computeOptimizationStory(request).pipe(
      Effect.map((story) =>
        Stream.fromIterable(streamPhasesForStory({ request, story })).pipe(
          Stream.flatMap(({ stream }) => stream),
          Stream.filterMap((element) =>
            element._tag === "section" || element._tag === "section-upsert"
              ? Option.some(element.section)
              : Option.none()
          )
        )
      )
    )
  )

export const streamElements = (manifest: StreamManifest | null) =>
  Stream.unwrap(
    computeOptimizationStory(requestFromManifest(manifest)).pipe(
      Effect.map((story) =>
        Stream.fromIterable(streamPhasesForStory({ request: requestFromManifest(manifest), story })).pipe(
          Stream.flatMap(({ stream }) => stream)
        )
      )
    )
  )

export const streamPlan = (
  manifest: StreamManifest | null
): Effect.Effect<DemoStreamPlan<FileSystem.FileSystem | Path.Path, unknown>, never, never> =>
  Effect.gen(function*() {
    const request = requestFromManifest(manifest)
    const story = yield* computeOptimizationStory(request)

    return {
      packageName: effectSearchRunIdentity.packageName,
      program: preloadProgram,
      summary: runSummary,
      phases: streamPhasesForStory({ request, story }).map(({ name, stream }) => phaseFromElementStream(name, stream))
    }
  })
