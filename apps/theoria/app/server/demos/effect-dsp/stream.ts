import { Clock, Effect, Stream } from "effect"
import * as Arr from "effect/Array"

import { StageAdvance } from "../../../contracts/choreography.js"
import type { DspStageId } from "../../../contracts/demo/dsp-runtime.js"
import {
  DspCanonicalStep,
  type DspCanonicalStep as DspCanonicalStepType,
  type DspRunMetrics,
  emptyDspRunMetrics
} from "../../../contracts/demo/dsp-runtime.js"
import type { EvidenceSection } from "../../../contracts/evidence.js"
import {
  concatStreams,
  cueStream,
  sectionEffectsToElements,
  sectionEffectsToStream,
  stage,
  step,
  type StreamElement
} from "../stream-element.js"
import type { DspProviderRuntime } from "./provider.js"
import type { DspEvaluationReport, DspExecutionContext, DspOptimizationSummary, DspRunRequest } from "./runtime.js"
import {
  prepareExecution,
  recordResolvedRuntime,
  reportScore,
  runBaseline,
  runOptimization,
  runOptimizedEval
} from "./runtime.js"
import { dspExecutionStory } from "./runtime.js"
import {
  comparisonSection,
  datasetSection,
  evaluationSection,
  optimizationSection,
  providerSection,
  scenarioSection,
  signatureSection
} from "./sections.js"
import { buildDspStageStories, type DspStageStory } from "./stage-story.js"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const cueParamsForStep = (authoredStep: DspCanonicalStepType) => ({
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

const authoredStepElements = (steps: ReadonlyArray<DspCanonicalStepType>): Stream.Stream<StreamElement, never, never> =>
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

const stageStream = (
  stageId: string,
  steps: ReadonlyArray<DspCanonicalStepType>,
  sectionEffects: ReadonlyArray<Effect.Effect<EvidenceSection, never, never>>
): Stream.Stream<StreamElement, never, never> =>
  stage(
    stageId,
    concatStreams([authoredStepElements(steps), sectionEffectsToElements(sectionEffects)])
  )

const makeStep = (
  ctx: DspExecutionContext,
  stageId: DspStageId,
  stepIndex: number,
  stepCount: number,
  metrics: DspRunMetrics
): DspCanonicalStepType =>
  new DspCanonicalStep({
    scenarioId: ctx.request.scenarioId,
    moduleType: ctx.request.moduleType,
    stageId,
    stepIndex,
    stepCount,
    metrics
  })

const averageScoreThrough = (
  metricName: string,
  report: DspEvaluationReport,
  stepIndex: number
): number => {
  const completed = report.results.slice(0, stepIndex)
  return completed.length === 0
    ? 0
    : completed.reduce((score, result) => score + (result.scores[metricName] ?? 0), 0) / completed.length
}

const resultRows = (
  metricName: string,
  report: DspEvaluationReport
): ReadonlyArray<ReadonlyArray<string>> =>
  Arr.map(report.results, (result) => [
    `${result.index + 1}`,
    (result.scores[metricName] ?? 0).toFixed(2),
    result.durationMs.toFixed(0)
  ])

const learnedDemosThrough = (learnedDemos: number, stepCount: number, stepIndex: number): number =>
  learnedDemos === 0
    ? 0
    : Math.min(learnedDemos, Math.ceil((learnedDemos * stepIndex) / stepCount))

// ---------------------------------------------------------------------------
// Progressive stream — each phase emits as soon as it completes
// ---------------------------------------------------------------------------

const signatureStage = (ctx: DspExecutionContext): Stream.Stream<StreamElement, never, never> =>
  stageStream(
    "signature",
    [makeStep(ctx, "signature", 1, 1, emptyDspRunMetrics)],
    [
      Effect.succeed(scenarioSection({
        moduleType: ctx.request.moduleType,
        optimizationBudget: ctx.request.optimizationBudget,
        scenario: ctx.scenario
      })),
      Effect.succeed(signatureSection(ctx.scenario))
    ]
  )

const baselineStage = (
  ctx: DspExecutionContext,
  report: DspEvaluationReport,
  baselineScore: number
): Stream.Stream<StreamElement, never, never> => {
  const metricName = ctx.scenario.metricName
  const steps = Arr.map(report.results, (_result, index) =>
    makeStep(ctx, "baseline", index + 1, report.totalExamples, {
      baselineAccuracy: averageScoreThrough(metricName, report, index + 1),
      optimizedAccuracy: null,
      demosLearned: null,
      improvementDelta: null
    }))

  return stageStream("baseline", steps, [
    Effect.succeed(datasetSection(ctx.scenario)),
    Effect.succeed(evaluationSection({
      label: "Baseline Evaluation",
      metricName,
      overallScore: baselineScore,
      successCount: report.successCount,
      totalExamples: report.totalExamples,
      resultRows: resultRows(metricName, report)
    }))
  ])
}

const optimizationStage = (
  ctx: DspExecutionContext,
  baselineScore: number,
  optimization: DspOptimizationSummary
): Stream.Stream<StreamElement, never, never> => {
  const optimizingSteps = Math.max(optimization.roundsUsed, 1)
  const steps = Arr.makeBy(optimizingSteps, (index) =>
    makeStep(ctx, "optimizing", index + 1, optimizingSteps, {
      baselineAccuracy: baselineScore,
      optimizedAccuracy: null,
      demosLearned: learnedDemosThrough(optimization.learnedDemos, optimizingSteps, index + 1),
      improvementDelta: null
    }))

  return stageStream("optimizing", steps, [
    Effect.succeed(optimizationSection({
      requestedRounds: ctx.request.optimizationBudget,
      roundsUsed: optimization.roundsUsed,
      learnedDemos: optimization.learnedDemos,
      acceptedTraces: optimization.traceAcceptedCount,
      rejectedTraces: optimization.traceRejectedCount,
      fallbackUsed: optimization.fallbackUsed
    }))
  ])
}

const optimizedEvalStage = (
  ctx: DspExecutionContext,
  baselineScore: number,
  optimization: DspOptimizationSummary,
  report: DspEvaluationReport,
  optimizedScore: number
): Stream.Stream<StreamElement, never, never> => {
  const metricName = ctx.scenario.metricName
  const steps = Arr.map(report.results, (_result, index) => {
    const optimizedAccuracy = averageScoreThrough(metricName, report, index + 1)
    return makeStep(ctx, "optimized-eval", index + 1, report.totalExamples, {
      baselineAccuracy: baselineScore,
      optimizedAccuracy,
      demosLearned: optimization.learnedDemos,
      improvementDelta: optimizedAccuracy - baselineScore
    })
  })

  return stageStream("optimized-eval", steps, [
    Effect.succeed(evaluationSection({
      label: "Optimized Evaluation",
      metricName,
      overallScore: optimizedScore,
      successCount: report.successCount,
      totalExamples: report.totalExamples,
      resultRows: resultRows(metricName, report)
    }))
  ])
}

const comparisonStage = (
  ctx: DspExecutionContext,
  baselineScore: number,
  optimizedScore: number,
  optimization: DspOptimizationSummary,
  durationMs: number
): Stream.Stream<StreamElement, never, never> =>
  stageStream("comparison", [
    makeStep(ctx, "comparison", 1, 1, {
      baselineAccuracy: baselineScore,
      optimizedAccuracy: optimizedScore,
      demosLearned: optimization.learnedDemos,
      improvementDelta: optimizedScore - baselineScore
    })
  ], [
    Effect.succeed(comparisonSection({
      baselineScore,
      optimizedScore,
      improvementDelta: optimizedScore - baselineScore,
      learnedDemos: optimization.learnedDemos
    })),
    Effect.succeed(providerSection(ctx.provider, ctx.model, durationMs))
  ])

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const streamElementsForStageStories = (stages: ReadonlyArray<DspStageStory>) =>
  concatStreams(
    Arr.map(stages, ({ stageId, steps, sectionEffects }) =>
      stage(
        stageId,
        concatStreams([
          authoredStepElements(steps),
          sectionEffectsToElements(sectionEffects)
        ])
      ))
  )

export const streamSections = (request: DspRunRequest): Stream.Stream<EvidenceSection, unknown, DspProviderRuntime> =>
  Stream.unwrap(
    dspExecutionStory(request).pipe(
      Effect.map((story) => buildDspStageStories(story)),
      Effect.map((stages) => sectionEffectsToStream(Arr.flatMap(stages, ({ sectionEffects }) => sectionEffects)))
    )
  )

/**
 * Progressive streaming — each execution phase emits its stage elements
 * as soon as it completes instead of waiting for the entire story.
 *
 * Timeline:
 *   1. Signature stage emits immediately (no LLM calls)
 *   2. Baseline evaluation runs → emits baseline stage
 *   3. Optimization runs → emits optimization stage
 *   4. Optimized evaluation runs → emits optimized-eval stage
 *   5. Comparison stage emits immediately from accumulated data
 */
export const streamElementsForRequest = (
  request: DspRunRequest
): Stream.Stream<StreamElement, unknown, DspProviderRuntime> =>
  Stream.unwrap(
    prepareExecution(request).pipe(
      Effect.map((ctx) =>
        concatStreams([
          // Phase 0: Signature — immediate, no LLM calls
          signatureStage(ctx),

          // Phase 1: Baseline evaluation — runs LLM, then emits
          Stream.unwrap(
            runBaseline(ctx).pipe(
              Effect.map((baselineReport) => {
                const baselineScore = reportScore(ctx.scenario.metricName, baselineReport)
                return concatStreams([
                  baselineStage(ctx, baselineReport, baselineScore),

                  // Phase 2: Optimization — runs LLM, then emits
                  Stream.unwrap(
                    runOptimization(ctx).pipe(
                      Effect.map((optimization) =>
                        concatStreams([
                          optimizationStage(ctx, baselineScore, optimization),

                          // Phase 3: Optimized evaluation — runs LLM, then emits
                          Stream.unwrap(
                            runOptimizedEval(ctx).pipe(
                              Effect.flatMap((optimizedReport) =>
                                Clock.currentTimeMillis.pipe(
                                  Effect.flatMap((endedAt) => {
                                    const optimizedScore = reportScore(ctx.scenario.metricName, optimizedReport)
                                    const durationMs = endedAt - ctx.startedAt
                                    return recordResolvedRuntime(ctx, endedAt).pipe(
                                      Effect.as(
                                        concatStreams([
                                          optimizedEvalStage(
                                            ctx,
                                            baselineScore,
                                            optimization,
                                            optimizedReport,
                                            optimizedScore
                                          ),

                                          // Phase 4: Comparison — immediate from accumulated data
                                          comparisonStage(ctx, baselineScore, optimizedScore, optimization, durationMs)
                                        ])
                                      )
                                    )
                                  })
                                )
                              )
                            )
                          )
                        ])
                      )
                    )
                  )
                ])
              })
            )
          )
        ])
      )
    )
  )
