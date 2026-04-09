import type { Stream } from "effect"
import { Effect } from "effect"
import * as Arr from "effect/Array"

import { DspCanonicalStep, emptyDspRunMetrics } from "../../../contracts/capability/effect-dsp-runtime.js"
import type { StreamElement } from "../../kernel/kinds/stream-element.js"
import { evaluationEvidenceSection, optimizationEventSection } from "./package-evidence.js"
import type { DspEvaluationPhase, DspExecutionContext, DspOptimizationPhase } from "./runtime.js"
import {
  datasetSection,
  evaluationSection,
  optimizationSection,
  outcomeSection,
  providerSection,
  scenarioSection,
  signatureSection
} from "./sections.js"
import { averageScoreThrough, learnedDemosThrough, resultRows, stageStream } from "./stream-support.js"

export const baselineStage = (options: {
  readonly baseline: DspEvaluationPhase
  readonly baselineScore: number
  readonly ctx: DspExecutionContext
}): Stream.Stream<StreamElement, never, never> => {
  const metricName = options.ctx.scenario.metricName
  const steps = Arr.map(options.baseline.report.results, (_result, index) =>
    DspCanonicalStep.make({
      scenarioId: options.ctx.request.scenarioId,
      moduleType: options.ctx.request.moduleType,
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
          phaseId: options.baseline.evidence.phaseId,
          metricName,
          overallScore: options.baselineScore,
          successCount: options.baseline.report.successCount,
          totalExamples: options.baseline.report.totalExamples,
          resultRows: resultRows({ metricName, report: options.baseline.report })
        })
      ),
      Effect.succeed(evaluationEvidenceSection({ evidence: options.baseline.evidence }))
    ]
  })
}

export const outcomeStage = (options: {
  readonly baselineScore: number
  readonly ctx: DspExecutionContext
  readonly durationMs: number
  readonly optimization: DspOptimizationPhase
  readonly optimizedScore: number
}): Stream.Stream<StreamElement, never, never> =>
  stageStream({
    stageId: "outcome",
    steps: [
      DspCanonicalStep.make({
        scenarioId: options.ctx.request.scenarioId,
        moduleType: options.ctx.request.moduleType,
        stageId: "outcome",
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
        outcomeSection({
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

    return DspCanonicalStep.make({
      scenarioId: options.ctx.request.scenarioId,
      moduleType: options.ctx.request.moduleType,
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
          phaseId: options.optimized.evidence.phaseId,
          metricName,
          overallScore: options.optimizedScore,
          successCount: options.optimized.report.successCount,
          totalExamples: options.optimized.report.totalExamples,
          resultRows: resultRows({ metricName, report: options.optimized.report })
        })
      ),
      Effect.succeed(evaluationEvidenceSection({ evidence: options.optimized.evidence }))
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
    DspCanonicalStep.make({
      scenarioId: options.ctx.request.scenarioId,
      moduleType: options.ctx.request.moduleType,
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
    steps: [
      DspCanonicalStep.make({
        scenarioId: ctx.request.scenarioId,
        moduleType: ctx.request.moduleType,
        stageId: "signature",
        stepIndex: 1,
        stepCount: 1,
        metrics: emptyDspRunMetrics
      })
    ],
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
