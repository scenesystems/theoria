import { Clock, Effect, Stream } from "effect"
import * as Arr from "effect/Array"

import type { EvidenceSection } from "../../../contracts/evidence.js"
import { concatStreams, sectionEffectsToStream, type StreamElement } from "../stream-element.js"
import {
  baselineStage,
  comparisonStage,
  optimizationStage,
  optimizedEvalStage,
  signatureStage
} from "./progressive-stages.js"
import type { DspProviderRuntime } from "./provider.js"
import {
  dspExecutionStory,
  type DspRunRequest,
  prepareExecution,
  reportScore,
  runBaseline,
  runOptimization,
  runOptimizedEval
} from "./runtime.js"
import { buildDspStageStories, type DspStageStory } from "./stage-story.js"
import { stageStream } from "./stream-support.js"

export const streamElementsForStageStories = (stages: ReadonlyArray<DspStageStory>) =>
  concatStreams(
    Arr.map(stages, ({ stageId, steps, sectionEffects }) => stageStream({ stageId, steps, sectionEffects }))
  )

export const streamSections = (request: DspRunRequest): Stream.Stream<EvidenceSection, unknown, DspProviderRuntime> =>
  Stream.unwrap(
    dspExecutionStory(request).pipe(
      Effect.map(buildDspStageStories),
      Effect.map((stages) => sectionEffectsToStream(Arr.flatMap(stages, ({ sectionEffects }) => sectionEffects)))
    )
  )

export const streamElementsForRequest = (
  request: DspRunRequest
): Stream.Stream<StreamElement, unknown, DspProviderRuntime> =>
  Stream.unwrap(
    prepareExecution(request).pipe(
      Effect.map((ctx) =>
        concatStreams([
          signatureStage(ctx),
          Stream.unwrap(
            runBaseline(ctx).pipe(
              Effect.map((baseline) => {
                const baselineScore = reportScore(ctx.scenario.metricName, baseline.report)

                return concatStreams([
                  baselineStage({ baseline, baselineScore, ctx }),
                  Stream.unwrap(
                    runOptimization(ctx).pipe(
                      Effect.map((optimization) =>
                        concatStreams([
                          optimizationStage({ baselineScore, ctx, optimization }),
                          Stream.unwrap(
                            runOptimizedEval(ctx).pipe(
                              Effect.flatMap((optimized) =>
                                Clock.currentTimeMillis.pipe(
                                  Effect.map((endedAt) => {
                                    const optimizedScore = reportScore(ctx.scenario.metricName, optimized.report)

                                    return concatStreams([
                                      optimizedEvalStage({
                                        baselineScore,
                                        ctx,
                                        optimization,
                                        optimized,
                                        optimizedScore
                                      }),
                                      comparisonStage({
                                        baselineScore,
                                        ctx,
                                        durationMs: endedAt - ctx.startedAt,
                                        optimization,
                                        optimizedScore
                                      })
                                    ])
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
