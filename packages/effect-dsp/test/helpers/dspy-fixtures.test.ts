import { FileSystem, Path } from "@effect/platform"
import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Schema } from "effect"

import {
  BootstrapDemoBudgetFixtureSchema,
  BootstrapRSCandidateCatalogFixtureSchema,
  BootstrapThresholdFilteringFixtureSchema,
  ChainOfThoughtReasoningFixtureSchema,
  ChatOutputRequirementsFixtureSchema,
  ChatParseFallbackFixtureSchema,
  ChatParseSectionsFixtureSchema,
  ChatPromptFixtureSchema,
  ChatQaOutputRequirementsFixtureSchema,
  ChatSystemMessageFixtureSchema,
  EnsembleMajorityVoteFixtureSchema,
  EvaluateEventOrderFixtureSchema,
  EvaluateReportShapeFixtureSchema,
  GepaAcceptMergeNonStrictFixtureSchema,
  GepaAcceptMutationStrictGreaterFixtureSchema,
  GepaCatalogVersionedFixturesFixtureSchema,
  GepaGovernanceOptimizerOptionsFixtureSchema,
  GepaGovernancePublicSeamsFixtureSchema,
  GepaMergeCommonAncestorCasesFixtureSchema,
  GepaMergeScheduleFixtureSchema,
  GepaOrchestrationEventOrderFixtureSchema,
  GepaOrchestrationStateTransitionsFixtureSchema,
  GepaParetoScoreMatrixFixtureSchema,
  GepaReflectDatasetShapeFixtureSchema,
  GepaReflectFormatFailureFeedbackFixtureSchema,
  GepaReflectPromptTemplateFixtureSchema,
  GepaReplayFrontierSnapshotsFixtureSchema,
  GepaReplayParamsFixtureSchema,
  GepaReplaySeedContractFixtureSchema,
  GepaSelectionWeightsFixtureSchema,
  LabeledFewShotSampleFixtureSchema,
  makeFixtureRegistry,
  MetricScoreFeedbackFixtureSchema,
  MiproPhaseConfigFixtureSchema,
  MiproTipsVocabularyFixtureSchema,
  MiproTrialBudgetCasesFixtureSchema,
  TraceEntryShapeFixtureSchema,
  TraceFiberIsolationFixtureSchema
} from "./dspy-fixtures/index.js"
import { loadManifest } from "./dspy-fixtures/io.js"

const fixtureRoot = new URL("../fixtures/dspy/", import.meta.url)
const fixtureManifestFileName = "manifest.json"

const listFixtureJsonFiles = (
  root: string,
  prefix: string
): Effect.Effect<Array<string>, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const directory = prefix === "" ? root : path.join(root, prefix)
    const entries = yield* fileSystem.readDirectory(directory).pipe(Effect.orDie)

    const nestedFiles = yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function*() {
        const relativePath = prefix === "" ? entry : `${prefix}/${entry}`
        const absolutePath = path.join(root, relativePath)
        const stat = yield* fileSystem.stat(absolutePath).pipe(Effect.orDie)

        if (stat.type === "Directory") {
          if (entry === "invalid") {
            return Arr.empty<string>()
          }

          return yield* listFixtureJsonFiles(root, relativePath)
        }

        return entry.endsWith(".json")
          ? [relativePath]
          : Arr.empty<string>()
      }))

    return Arr.flatten(nestedFiles)
  })

describe("DSPy fixture registry", () => {
  it.effect("loads schema-validated fixtures from the manifest", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      const basic = yield* registry.load("dspy.chat.qa-basic")
      const withDemo = yield* registry.load("dspy.chat.qa-with-demo")
      const systemMessage = yield* registry.load("dspy.chat.system-message.basic")
      const outputRequirements = yield* registry.load("dspy.chat.output-requirements.basic")
      const qaOutputRequirements = yield* registry.load("dspy.chat.qa-output-requirements")
      const parseSections = yield* registry.load("dspy.chat.parse-sections.basic")
      const parseFallback = yield* registry.load("dspy.chat.parse-fallback.contract")
      const cotReasoning = yield* registry.load("dspy.cot.reasoning-field.basic")
      const traceEntryShape = yield* registry.load("dspy.trace.entry-shape.basic")
      const traceFiberIsolation = yield* registry.load("dspy.trace.fiber-isolation.seed-0")
      const evaluateReportShape = yield* registry.load("dspy.evaluate.report-shape.basic")
      const evaluateEventOrder = yield* registry.load("dspy.evaluate.event-order.basic")
      const metricScoreFeedback = yield* registry.load("dspy.metric.score-feedback.contract")
      const bootstrapDemoBudget = yield* registry.load("dspy.bootstrap.demo-budget.basic")
      const bootstrapThresholdFiltering = yield* registry.load("dspy.bootstrap.threshold-filtering.basic")
      const bootstrapRSCandidateCatalog = yield* registry.load("dspy.bootstraprs.candidate-catalog.seed-9")
      const labeledFewShotSample = yield* registry.load("dspy.labeledfewshot.sample-k.seed-9")
      const ensembleMajorityVote = yield* registry.load("dspy.ensemble.majority-vote.basic")
      const miproPhaseConfig = yield* registry.load("dspy.mipro.phase-config")
      const miproTipsVocabulary = yield* registry.load("dspy.mipro.tips-vocabulary")
      const miproTrialBudgetCases = yield* registry.load("dspy.mipro.trial-budget-cases")
      const gepaParetoScoreMatrixBasic = yield* registry.load("dspy.gepa.pareto.score-matrix.basic")
      const gepaParetoScoreMatrixTies = yield* registry.load("dspy.gepa.pareto.score-matrix.ties")
      const gepaSelectionWeights = yield* registry.load("dspy.gepa.selection.weights.seed-42")
      const gepaReflectDatasetShape = yield* registry.load("dspy.gepa.reflect.dataset-shape")
      const gepaReflectPromptTemplate = yield* registry.load("dspy.gepa.reflect.prompt-template.basic")
      const gepaReflectFormatFailureFeedback = yield* registry.load("dspy.gepa.reflect.format-failure-feedback")
      const gepaAcceptMutationStrictGreater = yield* registry.load("dspy.gepa.accept.mutation-strict-greater")
      const gepaAcceptMergeNonStrict = yield* registry.load("dspy.gepa.accept.merge-non-strict")
      const gepaMergeCommonAncestorCases = yield* registry.load("dspy.gepa.merge.common-ancestor-cases")
      const gepaMergeSchedule = yield* registry.load("dspy.gepa.merge.schedule.max-merge-invocations")
      const gepaOrchestrationEventOrder = yield* registry.load("dspy.gepa.orchestration.event-order.seed-0")
      const gepaOrchestrationStateTransitions = yield* registry.load("dspy.gepa.orchestration.state-transitions.basic")
      const gepaReplayFrontierSnapshots = yield* registry.load("dspy.gepa.replay.frontier-snapshots.seed-0")
      const gepaReplayParams = yield* registry.load("dspy.gepa.replay.params.seed-0")
      const gepaGovernancePublicSeams = yield* registry.load("dspy.gepa.governance.public-seams")
      const gepaGovernanceOptimizerOptions = yield* registry.load("dspy.gepa.governance.optimizer-options")
      const gepaCatalog = yield* registry.load("dspy.gepa.catalog.versioned-fixtures")
      const gepaReplayContract = yield* registry.load("dspy.gepa.replay.seed-0.contract")

      const decodedBasic = yield* Schema.decodeUnknown(ChatPromptFixtureSchema)(basic)
      const decodedWithDemo = yield* Schema.decodeUnknown(ChatPromptFixtureSchema)(withDemo)
      const decodedSystemMessage = yield* Schema.decodeUnknown(ChatSystemMessageFixtureSchema)(systemMessage)
      const decodedOutputRequirements = yield* Schema.decodeUnknown(ChatOutputRequirementsFixtureSchema)(
        outputRequirements
      )
      const decodedQaOutputRequirements = yield* Schema.decodeUnknown(ChatQaOutputRequirementsFixtureSchema)(
        qaOutputRequirements
      )
      const decodedParseSections = yield* Schema.decodeUnknown(ChatParseSectionsFixtureSchema)(parseSections)
      const decodedParseFallback = yield* Schema.decodeUnknown(ChatParseFallbackFixtureSchema)(parseFallback)
      const decodedCotReasoning = yield* Schema.decodeUnknown(ChainOfThoughtReasoningFixtureSchema)(
        cotReasoning
      )
      const decodedTraceEntryShape = yield* Schema.decodeUnknown(TraceEntryShapeFixtureSchema)(traceEntryShape)
      const decodedTraceFiberIsolation = yield* Schema.decodeUnknown(TraceFiberIsolationFixtureSchema)(
        traceFiberIsolation
      )
      const decodedEvaluateReportShape = yield* Schema.decodeUnknown(EvaluateReportShapeFixtureSchema)(
        evaluateReportShape
      )
      const decodedEvaluateEventOrder = yield* Schema.decodeUnknown(EvaluateEventOrderFixtureSchema)(
        evaluateEventOrder
      )
      const decodedMetricScoreFeedback = yield* Schema.decodeUnknown(MetricScoreFeedbackFixtureSchema)(
        metricScoreFeedback
      )
      const decodedBootstrapDemoBudget = yield* Schema.decodeUnknown(BootstrapDemoBudgetFixtureSchema)(
        bootstrapDemoBudget
      )
      const decodedBootstrapThresholdFiltering = yield* Schema.decodeUnknown(
        BootstrapThresholdFilteringFixtureSchema
      )(bootstrapThresholdFiltering)
      const decodedBootstrapRSCandidateCatalog = yield* Schema.decodeUnknown(
        BootstrapRSCandidateCatalogFixtureSchema
      )(bootstrapRSCandidateCatalog)
      const decodedLabeledFewShotSample = yield* Schema.decodeUnknown(LabeledFewShotSampleFixtureSchema)(
        labeledFewShotSample
      )
      const decodedEnsembleMajorityVote = yield* Schema.decodeUnknown(EnsembleMajorityVoteFixtureSchema)(
        ensembleMajorityVote
      )
      const decodedMiproPhaseConfig = yield* Schema.decodeUnknown(MiproPhaseConfigFixtureSchema)(
        miproPhaseConfig
      )
      const decodedMiproTipsVocabulary = yield* Schema.decodeUnknown(MiproTipsVocabularyFixtureSchema)(
        miproTipsVocabulary
      )
      const decodedMiproTrialBudgetCases = yield* Schema.decodeUnknown(MiproTrialBudgetCasesFixtureSchema)(
        miproTrialBudgetCases
      )
      const decodedGepaParetoScoreMatrixBasic = yield* Schema.decodeUnknown(GepaParetoScoreMatrixFixtureSchema)(
        gepaParetoScoreMatrixBasic
      )
      const decodedGepaParetoScoreMatrixTies = yield* Schema.decodeUnknown(GepaParetoScoreMatrixFixtureSchema)(
        gepaParetoScoreMatrixTies
      )
      const decodedGepaSelectionWeights = yield* Schema.decodeUnknown(GepaSelectionWeightsFixtureSchema)(
        gepaSelectionWeights
      )
      const decodedGepaReflectDatasetShape = yield* Schema.decodeUnknown(GepaReflectDatasetShapeFixtureSchema)(
        gepaReflectDatasetShape
      )
      const decodedGepaReflectPromptTemplate = yield* Schema.decodeUnknown(GepaReflectPromptTemplateFixtureSchema)(
        gepaReflectPromptTemplate
      )
      const decodedGepaReflectFormatFailureFeedback = yield* Schema.decodeUnknown(
        GepaReflectFormatFailureFeedbackFixtureSchema
      )(gepaReflectFormatFailureFeedback)
      const decodedGepaAcceptMutationStrictGreater = yield* Schema.decodeUnknown(
        GepaAcceptMutationStrictGreaterFixtureSchema
      )(gepaAcceptMutationStrictGreater)
      const decodedGepaAcceptMergeNonStrict = yield* Schema.decodeUnknown(GepaAcceptMergeNonStrictFixtureSchema)(
        gepaAcceptMergeNonStrict
      )
      const decodedGepaMergeCommonAncestorCases = yield* Schema.decodeUnknown(
        GepaMergeCommonAncestorCasesFixtureSchema
      )(
        gepaMergeCommonAncestorCases
      )
      const decodedGepaMergeSchedule = yield* Schema.decodeUnknown(GepaMergeScheduleFixtureSchema)(
        gepaMergeSchedule
      )
      const decodedGepaOrchestrationEventOrder = yield* Schema.decodeUnknown(GepaOrchestrationEventOrderFixtureSchema)(
        gepaOrchestrationEventOrder
      )
      const decodedGepaOrchestrationStateTransitions = yield* Schema.decodeUnknown(
        GepaOrchestrationStateTransitionsFixtureSchema
      )(gepaOrchestrationStateTransitions)
      const decodedGepaReplayFrontierSnapshots = yield* Schema.decodeUnknown(GepaReplayFrontierSnapshotsFixtureSchema)(
        gepaReplayFrontierSnapshots
      )
      const decodedGepaReplayParams = yield* Schema.decodeUnknown(GepaReplayParamsFixtureSchema)(
        gepaReplayParams
      )
      const decodedGepaGovernancePublicSeams = yield* Schema.decodeUnknown(GepaGovernancePublicSeamsFixtureSchema)(
        gepaGovernancePublicSeams
      )
      const decodedGepaGovernanceOptimizerOptions = yield* Schema.decodeUnknown(
        GepaGovernanceOptimizerOptionsFixtureSchema
      )(gepaGovernanceOptimizerOptions)
      const decodedGepaCatalog = yield* Schema.decodeUnknown(GepaCatalogVersionedFixturesFixtureSchema)(
        gepaCatalog
      )
      const decodedGepaReplayContract = yield* Schema.decodeUnknown(GepaReplaySeedContractFixtureSchema)(
        gepaReplayContract
      )

      expect(decodedBasic.payload.messages.length).toBeGreaterThan(0)
      expect(decodedWithDemo.payload.demo).toBeDefined()
      expect(decodedSystemMessage.payload.requiredMarkers.length).toBeGreaterThan(0)
      expect(decodedOutputRequirements.payload.requiredMarkers).toContain("[[ ## completed ## ]]")
      expect(decodedQaOutputRequirements.payload.basic.messages.length).toBe(2)
      expect(decodedQaOutputRequirements.payload.withDemo.messages.length).toBe(4)
      expect(decodedQaOutputRequirements.payload.inputFields).toEqual(decodedBasic.payload.inputFields)
      expect(decodedQaOutputRequirements.payload.outputFields).toEqual(decodedBasic.payload.outputFields)
      expect(decodedParseSections.payload.parsed.answer.length).toBeGreaterThan(0)
      expect(decodedParseFallback.payload.cases.length).toBeGreaterThan(0)
      expect(decodedCotReasoning.payload.outputFieldOrder[0]).toBe("reasoning")
      expect(decodedTraceEntryShape.payload.traceEntryTupleLength).toBe(3)
      expect(decodedTraceFiberIsolation.payload.crossScopeTraceLeakDetected).toBe(false)
      expect(decodedEvaluateReportShape.payload.totalExamples).toBe(decodedEvaluateReportShape.payload.examples.length)
      expect(decodedEvaluateEventOrder.payload.eventCount).toBe(decodedEvaluateEventOrder.payload.events.length)
      expect(decodedMetricScoreFeedback.payload.cases.length).toBeGreaterThan(0)
      expect(decodedBootstrapDemoBudget.payload.expectedFinalDemoCount).toBeGreaterThan(0)
      expect(decodedBootstrapThresholdFiltering.payload.expectedRejectedQuestions.length).toBeGreaterThan(0)
      expect(decodedBootstrapRSCandidateCatalog.payload.expectedCandidateLabels.length).toBeGreaterThan(0)
      expect(decodedLabeledFewShotSample.payload.expectedSelectedQuestions.length).toBeGreaterThan(0)
      expect(decodedEnsembleMajorityVote.payload.cases.length).toBeGreaterThan(0)
      expect(decodedMiproPhaseConfig.payload.phaseOrder).toEqual(["phase1", "phase2", "phase3"])
      expect(decodedMiproTipsVocabulary.payload.defaultTips.length).toBeGreaterThan(0)
      expect(decodedMiproTrialBudgetCases.payload.cases.length).toBeGreaterThan(0)
      expect(decodedGepaParetoScoreMatrixBasic.payload.expectedFrontierIndices.length).toBeGreaterThan(0)
      expect(decodedGepaParetoScoreMatrixTies.payload.expectedFrontierIndices.length).toBeGreaterThan(0)
      expect(decodedGepaSelectionWeights.payload.weights.length).toBeGreaterThan(0)
      expect(decodedGepaReflectDatasetShape.payload.samples.length).toBeGreaterThan(0)
      expect(decodedGepaReflectPromptTemplate.payload.requiredSubstrings.length).toBeGreaterThan(0)
      expect(decodedGepaReflectFormatFailureFeedback.payload.expectedFeedback.length).toBeGreaterThan(0)
      expect(decodedGepaAcceptMutationStrictGreater.payload.cases.length).toBeGreaterThan(0)
      expect(decodedGepaAcceptMergeNonStrict.payload.cases.length).toBeGreaterThan(0)
      expect(decodedGepaMergeCommonAncestorCases.payload.candidates.length).toBeGreaterThan(0)
      expect(decodedGepaMergeSchedule.payload.attemptDecisions.length).toBeGreaterThan(0)
      expect(decodedGepaOrchestrationEventOrder.payload.timeline.length).toBeGreaterThan(0)
      expect(decodedGepaOrchestrationStateTransitions.payload.transitions.length).toBeGreaterThan(0)
      expect(decodedGepaReplayFrontierSnapshots.payload.snapshots.length).toBeGreaterThan(0)
      expect(decodedGepaReplayParams.payload.stableJsonKeys.length).toBeGreaterThan(0)
      expect(decodedGepaGovernancePublicSeams.payload.allowedEffectSearchImports.length).toBeGreaterThan(0)
      expect(decodedGepaGovernanceOptimizerOptions.payload.requiredOptionKeys.length).toBeGreaterThan(0)
      expect(decodedGepaCatalog.payload.requiredFixtureCount).toBe(decodedGepaCatalog.payload.fixtures.length)
      expect(decodedGepaCatalog.payload.fixtures.length).toBeGreaterThan(0)
      expect(decodedGepaReplayContract.payload.requiredManifestFixtures.length).toBeGreaterThan(0)
    }))

  it.effect("loads namespace fixture families for CoT, trace, evaluate, metric, and optimizer contracts", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      const cotFixtures = yield* registry.loadAll("dspy.cot.")
      const traceFixtures = yield* registry.loadAll("dspy.trace.")
      const evaluateFixtures = yield* registry.loadAll("dspy.evaluate.")
      const metricFixtures = yield* registry.loadAll("dspy.metric.")
      const bootstrapFixtures = yield* registry.loadAll("dspy.bootstrap.")
      const bootstrapRSFixtures = yield* registry.loadAll("dspy.bootstraprs.")
      const labeledFewShotFixtures = yield* registry.loadAll("dspy.labeledfewshot.")
      const ensembleFixtures = yield* registry.loadAll("dspy.ensemble.")
      const miproFixtures = yield* registry.loadAll("dspy.mipro.")
      const gepaFixtures = yield* registry.loadAll("dspy.gepa.")

      const decodedCotFixtures = yield* Effect.forEach(
        cotFixtures,
        (fixture) => Schema.decodeUnknown(ChainOfThoughtReasoningFixtureSchema)(fixture)
      )
      const decodedTraceFixtures = yield* Effect.forEach(
        traceFixtures,
        (fixture) =>
          Schema.decodeUnknown(
            Schema.Union(TraceEntryShapeFixtureSchema, TraceFiberIsolationFixtureSchema)
          )(fixture)
      )
      const decodedEvaluateFixtures = yield* Effect.forEach(
        evaluateFixtures,
        (fixture) =>
          Schema.decodeUnknown(
            Schema.Union(EvaluateReportShapeFixtureSchema, EvaluateEventOrderFixtureSchema)
          )(fixture)
      )
      const decodedMetricFixtures = yield* Effect.forEach(
        metricFixtures,
        (fixture) => Schema.decodeUnknown(MetricScoreFeedbackFixtureSchema)(fixture)
      )
      const decodedBootstrapFixtures = yield* Effect.forEach(
        bootstrapFixtures,
        (fixture) =>
          Schema.decodeUnknown(
            Schema.Union(BootstrapDemoBudgetFixtureSchema, BootstrapThresholdFilteringFixtureSchema)
          )(fixture)
      )
      const decodedBootstrapRSFixtures = yield* Effect.forEach(
        bootstrapRSFixtures,
        (fixture) => Schema.decodeUnknown(BootstrapRSCandidateCatalogFixtureSchema)(fixture)
      )
      const decodedLabeledFewShotFixtures = yield* Effect.forEach(
        labeledFewShotFixtures,
        (fixture) => Schema.decodeUnknown(LabeledFewShotSampleFixtureSchema)(fixture)
      )
      const decodedEnsembleFixtures = yield* Effect.forEach(
        ensembleFixtures,
        (fixture) => Schema.decodeUnknown(EnsembleMajorityVoteFixtureSchema)(fixture)
      )
      const decodedMiproFixtures = yield* Effect.forEach(
        miproFixtures,
        (fixture) =>
          Schema.decodeUnknown(
            Schema.Union(
              MiproPhaseConfigFixtureSchema,
              MiproTipsVocabularyFixtureSchema,
              MiproTrialBudgetCasesFixtureSchema
            )
          )(fixture)
      )
      const decodedGepaFixtures = yield* Effect.forEach(
        gepaFixtures,
        (fixture) =>
          Schema.decodeUnknown(
            Schema.Union(
              GepaParetoScoreMatrixFixtureSchema,
              GepaSelectionWeightsFixtureSchema,
              GepaReflectDatasetShapeFixtureSchema,
              GepaReflectPromptTemplateFixtureSchema,
              GepaReflectFormatFailureFeedbackFixtureSchema,
              GepaAcceptMutationStrictGreaterFixtureSchema,
              GepaAcceptMergeNonStrictFixtureSchema,
              GepaMergeCommonAncestorCasesFixtureSchema,
              GepaMergeScheduleFixtureSchema,
              GepaOrchestrationEventOrderFixtureSchema,
              GepaOrchestrationStateTransitionsFixtureSchema,
              GepaReplayFrontierSnapshotsFixtureSchema,
              GepaReplayParamsFixtureSchema,
              GepaGovernancePublicSeamsFixtureSchema,
              GepaGovernanceOptimizerOptionsFixtureSchema,
              GepaCatalogVersionedFixturesFixtureSchema,
              GepaReplaySeedContractFixtureSchema
            )
          )(fixture)
      )

      expect(decodedCotFixtures).toHaveLength(1)
      expect(decodedTraceFixtures).toHaveLength(2)
      expect(decodedEvaluateFixtures).toHaveLength(2)
      expect(decodedMetricFixtures).toHaveLength(1)
      expect(decodedBootstrapFixtures).toHaveLength(2)
      expect(decodedBootstrapRSFixtures).toHaveLength(1)
      expect(decodedLabeledFewShotFixtures).toHaveLength(1)
      expect(decodedEnsembleFixtures).toHaveLength(1)
      expect(decodedMiproFixtures).toHaveLength(3)
      expect(decodedGepaFixtures).toHaveLength(18)
    }))

  it.effect("validates the full fixture manifest against schema contracts", () =>
    Effect.gen(function*() {
      const registry = makeFixtureRegistry()
      yield* registry.validateManifest
    }))

  it.effect("fails fast when fixture files drift outside manifest coverage", () =>
    Effect.gen(function*() {
      const path = yield* Path.Path
      const rootPath = yield* path.fromFileUrl(fixtureRoot).pipe(Effect.orDie)
      const manifest = yield* loadManifest(fixtureRoot, fixtureManifestFileName)
      const manifestFiles = Arr.map(manifest.fixtures, (entry) => entry.file)
      const fixtureJsonFiles = yield* listFixtureJsonFiles(rootPath, "").pipe(
        Effect.map((files) => Arr.filter(files, (file) => file !== fixtureManifestFileName))
      )

      const orphans = Arr.filter(fixtureJsonFiles, (file) => !Arr.contains(manifestFiles, file))
      const staleManifestEntries = Arr.filter(manifestFiles, (file) => !Arr.contains(fixtureJsonFiles, file))

      expect(orphans).toStrictEqual([])
      expect(staleManifestEntries).toStrictEqual([])
    }).pipe(Effect.provide(BunContext.layer)))
})
