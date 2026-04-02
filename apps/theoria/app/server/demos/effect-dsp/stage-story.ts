import { Effect } from "effect"
import * as Arr from "effect/Array"
import {
  DspCanonicalStep,
  type DspRunMetrics,
  type DspStageId,
  emptyDspRunMetrics
} from "../../../contracts/demo/dsp-runtime.js"
import type { EvidenceSection } from "../../../contracts/evidence.js"
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

export type DspStageStory = {
  readonly stageId: DspStageId
  readonly steps: ReadonlyArray<DspCanonicalStep>
  readonly sectionEffects: ReadonlyArray<Effect.Effect<EvidenceSection, never, never>>
}

const resultRows = (
  metricName: string,
  report: DspExecutionStory["baselineReport"]
): ReadonlyArray<ReadonlyArray<string>> =>
  Arr.map(report.results, (result) => [
    `${result.index + 1}`,
    (result.scores[metricName] ?? 0).toFixed(2),
    result.durationMs.toFixed(0)
  ])

const averageScoreThrough = ({
  metricName,
  report,
  stepIndex
}: {
  readonly metricName: string
  readonly report: DspExecutionStory["baselineReport"]
  readonly stepIndex: number
}): number => {
  const completed = report.results.slice(0, stepIndex)
  return completed.length === 0
    ? 0
    : completed.reduce((score, result) => score + (result.scores[metricName] ?? 0), 0) / completed.length
}

const finalMetrics = (story: DspExecutionStory): DspRunMetrics => ({
  baselineAccuracy: story.baselineScore,
  optimizedAccuracy: story.optimizedScore,
  demosLearned: story.optimization.learnedDemos,
  improvementDelta: story.optimizedScore - story.baselineScore
})

const makeStep = ({
  metrics,
  stageId,
  stepCount,
  stepIndex,
  story
}: {
  readonly metrics: DspRunMetrics
  readonly stageId: DspStageId
  readonly stepCount: number
  readonly stepIndex: number
  readonly story: DspExecutionStory
}): DspCanonicalStep =>
  new DspCanonicalStep({
    scenarioId: story.request.scenarioId,
    moduleType: story.request.moduleType,
    stageId,
    stepIndex,
    stepCount,
    metrics
  })

const optimizationStepCount = (story: DspExecutionStory): number => Math.max(story.optimization.roundsUsed, 1)

const learnedDemosThrough = ({
  learnedDemos,
  stepCount,
  stepIndex
}: {
  readonly learnedDemos: number
  readonly stepCount: number
  readonly stepIndex: number
}): number =>
  learnedDemos === 0
    ? 0
    : Math.min(learnedDemos, Math.ceil((learnedDemos * stepIndex) / stepCount))

export const buildDspStageStories = (story: DspExecutionStory): ReadonlyArray<DspStageStory> => {
  const metricName = story.scenario.metricName
  const optimizingSteps = optimizationStepCount(story)
  return [
    {
      stageId: "signature",
      steps: [
        makeStep({
          story,
          stageId: "signature",
          stepIndex: 1,
          stepCount: 1,
          metrics: emptyDspRunMetrics
        })
      ],
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
            resultRows: resultRows(metricName, story.baselineReport)
          })
        )
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
        )
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
            resultRows: resultRows(metricName, story.optimizedReport)
          })
        )
      ]
    },
    {
      stageId: "comparison",
      steps: [
        makeStep({
          story,
          stageId: "comparison",
          stepIndex: 1,
          stepCount: 1,
          metrics: finalMetrics(story)
        })
      ],
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
