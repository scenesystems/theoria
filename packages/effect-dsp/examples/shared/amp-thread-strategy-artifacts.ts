import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect } from "effect"

import {
  BASELINE_INSTRUCTION,
  evaluationSplits,
  optimizerSplits,
  STUDY_SEED,
  validationSplits
} from "./amp-thread-strategy-study.js"
import type { runAmpThreadStrategyStudy } from "./amp-thread-strategy-study.js"
import {
  StandardExampleEvents,
  StandardExampleSummary,
  StandardModuleState,
  writeStandardArtifacts
} from "./example-report-contract.js"
import { type ExampleArtifacts } from "./output-artifacts.js"

export const AMP_THREAD_STRATEGY_EXAMPLE_NAME = "22-gepa-amp-thread-strategy-benchmark"
export const AMP_IMPLEMENTATION_STRATEGY_STUDY_EXAMPLE_NAME = "24-amp-implementation-strategy-study"

type RunAmpThreadStrategyStudyResult = typeof runAmpThreadStrategyStudy extends Effect.Effect<infer A, any, any> ? A
  : never

const COMPARISON_REPORT_FILE_NAME = "comparison-report.md"
const formatScore = (value: number): string => value.toFixed(4)
const reportScore = (value: number | undefined): number => value ?? 0

const comparisonReportMarkdown = (exampleName: string, result: RunAmpThreadStrategyStudyResult): string =>
  Arr.join(
    Arr.appendAll(
      Arr.make(
        "# Amp Thread Strategy Comparison Report",
        "",
        `- Example: ${exampleName}`,
        `- Baseline execution score: ${
          formatScore(reportScore(result.baselineReport.overallScores.strategyExecution))
        }`,
        `- Optimized execution score: ${
          formatScore(reportScore(result.optimizedReport.overallScores.strategyExecution))
        }`,
        `- Baseline rubric score: ${formatScore(reportScore(result.baselineReport.overallScores.strategyRubric))}`,
        `- Optimized rubric score: ${formatScore(reportScore(result.optimizedReport.overallScores.strategyRubric))}`,
        `- Final instructions: ${result.finalInstructions}`,
        `- Splits: train=${result.splitSummary.train}, validation=${result.splitSummary.validation}, holdout=${result.splitSummary.holdout}`,
        ""
      ),
      Arr.flatMap(result.strategyComparisons, (comparison) =>
        Arr.make(
          `## ${comparison.caseId} (${comparison.split})`,
          "",
          `- Source thread: ${comparison.threadId}`,
          `- Task: ${comparison.task}`,
          "",
          "### Canonical Strategy",
          comparison.canonicalStrategy,
          "",
          `### Baseline Strategy (${formatScore(comparison.baselineScore)})`,
          comparison.baselineStrategy,
          "",
          `Feedback: ${comparison.baselineFeedback}`,
          "",
          `### Optimized Strategy (${formatScore(comparison.optimizedScore)})`,
          comparison.optimizedStrategy,
          "",
          `Feedback: ${comparison.optimizedFeedback}`,
          ""
        ))
    ),
    "\n"
  )

const writeComparisonReport = (
  artifacts: ExampleArtifacts,
  result: RunAmpThreadStrategyStudyResult,
  exampleName: string
) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const reportPath = path.join(artifacts.reportsDir, COMPARISON_REPORT_FILE_NAME)

    yield* fileSystem.writeFileString(reportPath, comparisonReportMarkdown(exampleName, result))

    return reportPath
  })

export const writeAmpThreadStrategyArtifacts = (
  artifacts: ExampleArtifacts,
  result: RunAmpThreadStrategyStudyResult,
  exampleName = AMP_THREAD_STRATEGY_EXAMPLE_NAME
) =>
  Effect.gen(function*() {
    const summary = StandardExampleSummary.make({
      exampleName,
      optimizer: "gepa",
      metricName: "strategy-execution",
      baselineScore: reportScore(result.baselineReport.overallScores.strategyExecution),
      optimizedScore: reportScore(result.optimizedReport.overallScores.strategyExecution),
      eventCount: result.gepaEvents.length,
      optimizationSummary: {
        splitSummary: result.splitSummary,
        eventTags: result.eventTags,
        comparisonCount: result.strategyComparisons.length
      },
      seed: STUDY_SEED,
      optimizationConfig: {
        maxIterations: 3,
        seed: STUDY_SEED,
        optimizerSplits,
        validationSplits,
        evaluationSplits
      },
      trainsetSize: result.optimizerExampleCount,
      valsetSize: result.validationExampleCount,
      evalsetSize: result.evaluationExampleCount,
      instructionBefore: BASELINE_INSTRUCTION,
      instructionAfter: result.finalInstructions,
      extras: {
        benchmarkCaseIds: result.benchmarkCaseIds,
        benchmarkThreadIds: result.benchmarkThreadIds,
        strategyComparisons: result.strategyComparisons
      }
    })
    const events = StandardExampleEvents.make({
      exampleName,
      optimizer: "gepa",
      streams: Arr.make(
        { name: "gepa", events: result.gepaEvents },
        { name: "strategy-comparisons", events: result.strategyComparisons }
      )
    })
    const moduleState = StandardModuleState.make({
      exampleName,
      optimizer: "gepa",
      state: {
        finalInstructions: result.finalInstructions,
        baselineStrategyProjections: result.baselineStrategyProjections,
        optimizedStrategyProjections: result.optimizedStrategyProjections
      }
    })
    const artifactPaths = yield* writeStandardArtifacts({
      artifacts,
      summary,
      events,
      moduleState
    }).pipe(Effect.provide(artifacts.envelopeContextLayer))
    const comparisonReportPath = yield* writeComparisonReport(artifacts, result, exampleName)

    return Arr.append(artifactPaths, comparisonReportPath)
  })
