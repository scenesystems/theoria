import { Effect } from "effect"
import * as Arr from "effect/Array"

import {
  DspCanonicalStep,
  type DspRunMetrics,
  type DspStageId,
  emptyDspRunMetrics
} from "../../../contracts/demo/dsp-runtime.js"
import type { EvidenceSection } from "../../../contracts/evidence.js"
import { evaluationEvidenceSection, optimizationEventSection } from "./package-evidence.js"
import type { DspExecutionStory } from "./runtime.js"
import {
  comparisonSection,
  datasetSection,
  evaluationSection,
  optimizationSection,
  providerSection,
  scenarioSection,
  signatureSection
} from "./sections.js"
import { averageScoreThrough, learnedDemosThrough, resultRows } from "./stream-support.js"

export type DspStageStory = {
  readonly stageId: DspStageId
  readonly steps: ReadonlyArray<DspCanonicalStep>
  readonly sectionEffects: ReadonlyArray<Effect.Effect<EvidenceSection, never, never>>
}

const finalMetrics = (story: DspExecutionStory): DspRunMetrics => ({
  baselineAccuracy: story.baselineScore,
  optimizedAccuracy: story.optimizedScore,
  demosLearned: story.optimization.learnedDemos,
  improvementDelta: story.optimizedScore - story.baselineScore
})

const makeStep = (options: {
  readonly metrics: DspRunMetrics
  readonly stageId: DspStageId
  readonly stepCount: number
  readonly stepIndex: number
  readonly story: DspExecutionStory
}): DspCanonicalStep =>
  new DspCanonicalStep({
    scenarioId: options.story.request.scenarioId,
    moduleType: options.story.request.moduleType,
    stageId: options.stageId,
    stepIndex: options.stepIndex,
    stepCount: options.stepCount,
    metrics: options.metrics
  })

export const buildDspStageStories = (story: DspExecutionStory): ReadonlyArray<DspStageStory> => {
  const metricName = story.scenario.metricName
  const optimizingSteps = Math.max(story.optimization.roundsUsed, 1)

  return [
    {
      stageId: "signature",
      steps: [makeStep({ story, stageId: "signature", stepIndex: 1, stepCount: 1, metrics: emptyDspRunMetrics })],
      sectionEffects: [
        Effect.succeed(
          scenarioSection({
            moduleType: story.request.moduleType,
            optimizationBudget: story.request.optimizationBudget,
            scenario: story.scenario
          })
        ),
        Effect.succeed(signatureSection(story.scenario))
      ]
    },
    {
      stageId: "baseline",
      steps: Arr.map(story.baselineReport.results, (_result, index) =>
        makeStep({
          story,
          stageId: "baseline",
          stepIndex: index + 1,
          stepCount: story.baselineReport.totalExamples,
          metrics: {
            baselineAccuracy: averageScoreThrough({
              metricName,
              report: story.baselineReport,
              stepIndex: index + 1
            }),
            optimizedAccuracy: null,
            demosLearned: null,
            improvementDelta: null
          }
        })),
      sectionEffects: [
        Effect.succeed(datasetSection(story.scenario)),
        Effect.succeed(
          evaluationSection({
            label: "Baseline Evaluation",
            metricName,
            overallScore: story.baselineScore,
            successCount: story.baselineReport.successCount,
            totalExamples: story.baselineReport.totalExamples,
            resultRows: resultRows({ metricName, report: story.baselineReport })
          })
        ),
        Effect.succeed(evaluationEvidenceSection({ evidence: story.baselineEvidence, label: "Baseline" }))
      ]
    },
    {
      stageId: "optimizing",
      steps: Arr.makeBy(optimizingSteps, (index) =>
        makeStep({
          story,
          stageId: "optimizing",
          stepIndex: index + 1,
          stepCount: optimizingSteps,
          metrics: {
            baselineAccuracy: story.baselineScore,
            optimizedAccuracy: null,
            demosLearned: learnedDemosThrough({
              learnedDemos: story.optimization.learnedDemos,
              stepCount: optimizingSteps,
              stepIndex: index + 1
            }),
            improvementDelta: null
          }
        })),
      sectionEffects: [
        Effect.succeed(
          optimizationSection({
            requestedRounds: story.request.optimizationBudget,
            roundsUsed: story.optimization.roundsUsed,
            learnedDemos: story.optimization.learnedDemos,
            acceptedTraces: story.optimization.traceAcceptedCount,
            rejectedTraces: story.optimization.traceRejectedCount,
            fallbackUsed: story.optimization.fallbackUsed
          })
        ),
        Effect.succeed(optimizationEventSection(story.optimizationEvidence))
      ]
    },
    {
      stageId: "optimized-eval",
      steps: Arr.map(story.optimizedReport.results, (_result, index) => {
        const optimizedAccuracy = averageScoreThrough({
          metricName,
          report: story.optimizedReport,
          stepIndex: index + 1
        })

        return makeStep({
          story,
          stageId: "optimized-eval",
          stepIndex: index + 1,
          stepCount: story.optimizedReport.totalExamples,
          metrics: {
            baselineAccuracy: story.baselineScore,
            optimizedAccuracy,
            demosLearned: story.optimization.learnedDemos,
            improvementDelta: optimizedAccuracy - story.baselineScore
          }
        })
      }),
      sectionEffects: [
        Effect.succeed(
          evaluationSection({
            label: "Optimized Evaluation",
            metricName,
            overallScore: story.optimizedScore,
            successCount: story.optimizedReport.successCount,
            totalExamples: story.optimizedReport.totalExamples,
            resultRows: resultRows({ metricName, report: story.optimizedReport })
          })
        ),
        Effect.succeed(evaluationEvidenceSection({ evidence: story.optimizedEvidence, label: "Optimized" }))
      ]
    },
    {
      stageId: "comparison",
      steps: [makeStep({ story, stageId: "comparison", stepIndex: 1, stepCount: 1, metrics: finalMetrics(story) })],
      sectionEffects: [
        Effect.succeed(
          comparisonSection({
            baselineScore: story.baselineScore,
            optimizedScore: story.optimizedScore,
            improvementDelta: story.optimizedScore - story.baselineScore,
            learnedDemos: story.optimization.learnedDemos
          })
        ),
        Effect.succeed(providerSection(story.provider, story.model, story.durationMs))
      ]
    }
  ]
}
