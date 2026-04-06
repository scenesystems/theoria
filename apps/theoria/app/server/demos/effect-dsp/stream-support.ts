import type { Effect } from "effect"
import { Stream } from "effect"
import * as Arr from "effect/Array"

import { StageAdvance } from "../../../contracts/choreography.js"
import type { DspCanonicalStep } from "../../../contracts/demo/dsp-runtime.js"
import type { EvidenceSection } from "../../../contracts/evidence.js"
import {
  concatStreams,
  cueStream,
  sectionEffectsToElements,
  stage,
  step,
  type StreamElement
} from "../stream-element.js"

const cueParamsForStep = (authoredStep: DspCanonicalStep) => ({
  scenarioId: authoredStep.scenarioId,
  moduleType: authoredStep.moduleType,
  stepCount: authoredStep.stepCount,
  ...(authoredStep.metrics.baselineAccuracy === null
    ? {}
    : { baselineAccuracy: authoredStep.metrics.baselineAccuracy }),
  ...(authoredStep.metrics.optimizedAccuracy === null
    ? {}
    : { optimizedAccuracy: authoredStep.metrics.optimizedAccuracy }),
  ...(authoredStep.metrics.demosLearned === null ? {} : { demosLearned: authoredStep.metrics.demosLearned }),
  ...(authoredStep.metrics.improvementDelta === null ? {} : { improvementDelta: authoredStep.metrics.improvementDelta })
})

export const averageScoreThrough = (options: {
  readonly metricName: string
  readonly report: {
    readonly results: ReadonlyArray<{
      readonly scores: Readonly<Record<string, number>>
    }>
  }
  readonly stepIndex: number
}): number => {
  const completed = options.report.results.slice(0, options.stepIndex)

  return completed.length === 0
    ? 0
    : completed.reduce((score, result) => score + (result.scores[options.metricName] ?? 0), 0) / completed.length
}

export const authoredStepElements = (
  steps: ReadonlyArray<DspCanonicalStep>
): Stream.Stream<StreamElement, never, never> =>
  concatStreams(
    Arr.map(steps, (authoredStep) =>
      concatStreams([
        cueStream(
          new StageAdvance({
            stageId: authoredStep.stageId,
            step: authoredStep.stepIndex,
            params: cueParamsForStep(authoredStep)
          })
        ),
        Stream.make(step(authoredStep))
      ]))
  )

export const learnedDemosThrough = (options: {
  readonly learnedDemos: number
  readonly stepCount: number
  readonly stepIndex: number
}): number =>
  options.learnedDemos === 0
    ? 0
    : Math.min(options.learnedDemos, Math.ceil((options.learnedDemos * options.stepIndex) / options.stepCount))

export const resultRows = (options: {
  readonly metricName: string
  readonly report: {
    readonly results: ReadonlyArray<{
      readonly index: number
      readonly scores: Readonly<Record<string, number>>
      readonly durationMs: number
    }>
  }
}): ReadonlyArray<ReadonlyArray<string>> =>
  Arr.map(options.report.results, (result) => [
    `${result.index + 1}`,
    (result.scores[options.metricName] ?? 0).toFixed(2),
    result.durationMs.toFixed(0)
  ])

export const stageStream = (options: {
  readonly stageId: string
  readonly steps: ReadonlyArray<DspCanonicalStep>
  readonly sectionEffects: ReadonlyArray<Effect.Effect<EvidenceSection, never, never>>
}): Stream.Stream<StreamElement, never, never> =>
  stage(
    options.stageId,
    concatStreams([authoredStepElements(options.steps), sectionEffectsToElements(options.sectionEffects)])
  )
