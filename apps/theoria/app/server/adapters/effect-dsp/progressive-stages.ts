import type { Stream } from "effect"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import {
  DspCanonicalStep,
  type DspRunMetrics,
  type DspStageId,
  emptyDspRunMetrics
} from "../../../contracts/capability/effect-dsp-runtime.js"
import type { StreamElement } from "../../kernel/kinds/stream-element.js"
import { evaluationEvidenceSection, optimizationEventSection } from "./package-evidence.js"
import type { DspEvaluationPhase, DspExecutionContext, DspOptimizationPhase } from "./runtime.js"
import {
  comparisonSection,
  datasetSection,
  evaluationSection,
  optimizationSection,
  providerSection,
  scenarioSection,
  signatureSection
} from "./sections.js"
import { averageScoreThrough, learnedDemosThrough, resultRows, stageStream } from "./stream-support.js"

const makeStep = (options: {
  readonly ctx: DspExecutionContext
  readonly metrics: DspRunMetrics
  readonly stageId: DspStageId
  readonly stepCount: number
  readonly stepIndex: number
}): DspCanonicalStep =>
  new DspCanonicalStep({
    scenarioId: options.ctx.request.scenarioId,
    moduleType: options.ctx.request.moduleType,
    stageId: options.stageId,
    stepIndex: options.stepIndex,
    stepCount: options.stepCount,
    metrics: options.metrics
  })

export const baselineStage = (options: {
  readonly baseline: DspEvaluationPhase
  readonly baselineScore: number
  readonly ctx: DspExecutionContext
}): Stream.Stream<StreamElement, never, never> => {
  const metricName = options.ctx.scenario.metricName
  const steps = Arr.map(options.baseline.report.results, (_result, index) =>
    makeStep({
      ctx: options.ctx,
      stageId: "baseline",
      stepIndex: index + 1,
      stepCount: options.baseline.report.totalExamples,
      metrics: {
        baselineAccuracy: averageScoreThrough({ metricName, report: options.baseline.report, stepIndex: index + 1 }),
        optimizedAccuracy: null,
        demosLearned: null,
        improvementDelta: null
      }
    }))

  return stageStream({
    stageId: "baseline",
    steps,
    sectionEffects: [
      Effect.succeed(datasetSection(options.ctx.scenario)),
      Effect.succeed(
        evaluationSection({
          label: "Baseline Evaluation",
          metricName,
          overallScore: options.baselineScore,
          successCount: options.baseline.report.successCount,
          totalExamples: options.baseline.report.totalExamples,
          resultRows: resultRows({ metricName, report: options.baseline.report })
        })
      ),
      Effect.succeed(evaluationEvidenceSection({ evidence: options.baseline.evidence, label: "Baseline" }))
    ]
  })
}

export const comparisonStage = (options: {
  readonly baselineScore: number
  readonly ctx: DspExecutionContext
  readonly durationMs: number
  readonly optimization: DspOptimizationPhase
  readonly optimizedScore: number
}): Stream.Stream<StreamElement, never, never> =>
  stageStream({
    stageId: "comparison",
    steps: [
      makeStep({
        ctx: options.ctx,
        stageId: "comparison",
        stepIndex: 1,
        stepCount: 1,
        metrics: {
          baselineAccuracy: options.baselineScore,
          optimizedAccuracy: options.optimizedScore,
          demosLearned: options.optimization.summary.learnedDemos,
          improvementDelta: options.optimizedScore - options.baselineScore
        }
      })
    ],
    sectionEffects: [
      Effect.succeed(
        comparisonSection({
          baselineScore: options.baselineScore,
          optimizedScore: options.optimizedScore,
          improvementDelta: options.optimizedScore - options.baselineScore,
          learnedDemos: options.optimization.summary.learnedDemos
        })
      ),
      Effect.succeed(providerSection(options.ctx.provider, options.ctx.model, options.durationMs))
    ]
  })

export const optimizedEvalStage = (options: {
  readonly baselineScore: number
  readonly ctx: DspExecutionContext
  readonly optimization: DspOptimizationPhase
  readonly optimized: DspEvaluationPhase
  readonly optimizedScore: number
}): Stream.Stream<StreamElement, never, never> => {
  const metricName = options.ctx.scenario.metricName
  const steps = Arr.map(options.optimized.report.results, (_result, index) => {
    const optimizedAccuracy = averageScoreThrough({
      metricName,
      report: options.optimized.report,
      stepIndex: index + 1
    })

    return makeStep({
      ctx: options.ctx,
      stageId: "optimized-eval",
      stepIndex: index + 1,
      stepCount: options.optimized.report.totalExamples,
      metrics: {
        baselineAccuracy: options.baselineScore,
        optimizedAccuracy,
        demosLearned: options.optimization.summary.learnedDemos,
        improvementDelta: optimizedAccuracy - options.baselineScore
      }
    })
  })

  return stageStream({
    stageId: "optimized-eval",
    steps,
    sectionEffects: [
      Effect.succeed(
        evaluationSection({
          label: "Optimized Evaluation",
          metricName,
          overallScore: options.optimizedScore,
          successCount: options.optimized.report.successCount,
          totalExamples: options.optimized.report.totalExamples,
          resultRows: resultRows({ metricName, report: options.optimized.report })
        })
      ),
      Effect.succeed(evaluationEvidenceSection({ evidence: options.optimized.evidence, label: "Optimized" }))
    ]
  })
}

export const optimizationStage = (options: {
  readonly baselineScore: number
  readonly ctx: DspExecutionContext
  readonly optimization: DspOptimizationPhase
}): Stream.Stream<StreamElement, never, never> => {
  const optimizingSteps = Math.max(options.optimization.summary.roundsUsed, 1)
  const steps = Arr.makeBy(optimizingSteps, (index) =>
    makeStep({
      ctx: options.ctx,
      stageId: "optimizing",
      stepIndex: index + 1,
      stepCount: optimizingSteps,
      metrics: {
        baselineAccuracy: options.baselineScore,
        optimizedAccuracy: null,
        demosLearned: learnedDemosThrough({
          learnedDemos: options.optimization.summary.learnedDemos,
          stepCount: optimizingSteps,
          stepIndex: index + 1
        }),
        improvementDelta: null
      }
    }))

  return stageStream({
    stageId: "optimizing",
    steps,
    sectionEffects: [
      Effect.succeed(
        optimizationSection({
          requestedRounds: options.ctx.request.optimizationBudget,
          roundsUsed: options.optimization.summary.roundsUsed,
          learnedDemos: options.optimization.summary.learnedDemos,
          acceptedTraces: options.optimization.summary.traceAcceptedCount,
          rejectedTraces: options.optimization.summary.traceRejectedCount,
          fallbackUsed: options.optimization.summary.fallbackUsed
        })
      ),
      Effect.succeed(optimizationEventSection(options.optimization.evidence))
    ]
  })
}

export const signatureStage = (ctx: DspExecutionContext): Stream.Stream<StreamElement, never, never> =>
  stageStream({
    stageId: "signature",
    steps: [makeStep({ ctx, stageId: "signature", stepIndex: 1, stepCount: 1, metrics: emptyDspRunMetrics })],
    sectionEffects: [
      Effect.succeed(
        scenarioSection({
          moduleType: ctx.request.moduleType,
          optimizationBudget: ctx.request.optimizationBudget,
          scenario: ctx.scenario
        })
      ),
      Effect.succeed(signatureSection(ctx.scenario))
    ]
  })
