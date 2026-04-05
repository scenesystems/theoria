/**
 * Study orchestration — run optimization, stream events, snapshot/resume.
 *
 * @since 0.1.0
 */
export {
  /**
   * Request the next suggested configuration from a study handle.
   *
   * @since 0.1.0
   */
  ask,
  /** @since 0.1.0 */ AskedTrial,
  /** @since 0.1.0 */ askTellProcedureCatalog,
  /** @since 0.1.0 */ cancel,
  /**
   * Stream typed lifecycle events, including sampler-start diagnostics when the active sampler emits them.
   *
   * @since 0.1.0
   */
  events,
  /** @since 0.1.0 */ fail,
  /** @since 0.1.0 */ isStudyHandle,
  /**
   * Convenience for single-objective maximization.
   *
   * @since 0.1.0
   */
  maximize,
  /**
   * Convenience for single-objective minimization.
   *
   * @since 0.1.0
   */
  minimize,
  /** @since 0.1.0 */ MultiObjectiveResult,
  /**
   * Open a study handle for the ask/tell protocol.
   *
   * @since 0.1.0
   */
  open,
  /**
   * Primary entry point for running an optimization study.
   *
   * @since 0.1.0
   */
  optimize,
  /**
   * Streaming variant of `optimize` with progress events.
   *
   * @since 0.1.0
   */
  optimizeStream,
  /** @since 0.1.0 */ pareto,
  /** @since 0.1.0 */ result,
  /**
   * Resume a study from a snapshot.
   *
   * @since 0.1.0
   */
  resume,
  /** @since 0.1.0 */ resumeFromStorage,
  /** @since 0.1.0 */ resumeFromStorageStream,
  /** @since 0.1.0 */ resumeStream,
  /** @since 0.1.0 */ SingleObjectiveResult,
  /**
   * Capture study state for persistence, including typed sampler metrics such as pending-trial truth.
   *
   * @since 0.1.0
   */
  snapshot,
  /**
   * Handle type for the ask/tell protocol.
   *
   * @since 0.1.0
   */
  StudyHandle,
  /** @since 0.1.0 */ type StudyResult,
  /**
   * Report a trial result back to a study handle.
   *
   * @since 0.1.0
   */
  tell
} from "./api.js"

export {
  /**
   * Event sink callback used by `streamFromEmitter`.
   *
   * @since 0.1.0
   */
  type EmitterSink,
  /**
   * Turn an effectful run function with event emission into a typed stream.
   *
   * @since 0.1.0
   */
  streamFromEmitter
} from "./streamBridge.js"

export {
  /** @since 0.1.0 */ defaultTerminalSink,
  /** @since 0.1.0 */ formatTerminalProgressEvent,
  /** @since 0.1.0 */ makeTerminalReporter,
  /** @since 0.1.0 */ makeTerminalSink,
  /** @since 0.1.0 */ ProgressLine,
  /** @since 0.1.0 */ reportTerminalProgress,
  /** @since 0.1.0 */ tapTerminalProgress,
  /** @since 0.1.0 */ type TerminalProgressReporter,
  /** @since 0.1.0 */ type TerminalRenderMode,
  /** @since 0.1.0 */ TerminalRenderModeSchema,
  /** @since 0.1.0 */ TerminalSink,
  /** @since 0.1.0 */ writeProgressLines
} from "./progress/index.js"

export {
  /** @since 0.1.0 */ type DirectionalOptimizeOptions,
  /** @since 0.1.0 */ DirectionalOptimizeRequestSchema,
  /** @since 0.1.0 */ type MaximizeOptionsFromSpace,
  /** @since 0.1.0 */ maximizePlanFromOptions,
  /** @since 0.1.0 */ type MinimizeOptionsFromSpace,
  /** @since 0.1.0 */ minimizePlanFromOptions
} from "./options/directional.js"

export {
  /** @since 0.1.0 */ type FlatOptimizeOptions,
  /** @since 0.1.0 */ type OptimizeOptions,
  /** @since 0.1.0 */ optimizeOptionsFromResume,
  /** @since 0.1.0 */ type OptimizeOptionsFromSpace,
  /** @since 0.1.0 */ OptimizePlan,
  /** @since 0.1.0 */ optimizePlanFromOptions,
  /** @since 0.1.0 */ optimizePlanFromResume,
  /** @since 0.1.0 */ OptimizeSettings,
  /** @since 0.1.0 */ PriorTrial,
  /** @since 0.1.0 */ pruningPolicyFromOptions,
  /** @since 0.1.0 */ type ResumeFromStorageOptions,
  /** @since 0.1.0 */ type ResumeFromStorageOptionsFromSpace,
  /** @since 0.1.0 */ type ResumeOptions,
  /** @since 0.1.0 */ type ResumeOptionsFromSpace,
  /** @since 0.1.0 */ resumeOptionsWithSnapshot,
  /** @since 0.1.0 */ ResumePlan,
  /** @since 0.1.0 */ resumePlanFromOptions,
  /** @since 0.1.0 */ type ScheduledOptimizeOptions,
  /** @since 0.1.0 */ validateSettings
} from "./options.js"

export {
  /** @since 0.1.0 */ type ExecuteOutcome,
  /** @since 0.1.0 */ type ExecuteSeed,
  /** @since 0.1.0 */ StudyClock
} from "./runtime.js"

export {
  /** @since 0.1.0 */ ExecuteRequest,
  /** @since 0.1.0 */ ObjectiveEvaluator,
  /** @since 0.1.0 */ ObjectiveEvaluatorLive,
  /** @since 0.1.0 */ SamplerEngine,
  /** @since 0.1.0 */ SamplerEngineLive,
  /** @since 0.1.0 */ SnapshotCodec,
  /** @since 0.1.0 */ SnapshotCodecLive,
  /** @since 0.1.0 */ StudyKernel,
  /** @since 0.1.0 */ StudyKernelLive,
  /** @since 0.1.0 */ StudyServicesLive
} from "./services.js"

export {
  /** @since 0.1.0 */ type ObjectiveFunction,
  /** @since 0.1.0 */ ObjectiveFunctionSchema,
  /** @since 0.1.0 */ ObjectiveReport
} from "./objectiveEvaluator.js"

export {
  /** @since 0.1.0 @category constructors */ ContinueHeartbeat,
  /** @since 0.1.0 @category constructors */ ContinuePruneDecision,
  /** @since 0.1.0 */ defaultStopMode,
  /** @since 0.1.0 */ type HeartbeatDecision,
  /** @since 0.1.0 */ HeartbeatDecisionSchema,
  /** @since 0.1.0 */ IntermediateReport,
  /** @since 0.1.0 @category guards */ isPruneDecision,
  /** @since 0.1.0 @category pattern-matching */ matchHeartbeatDecision,
  /** @since 0.1.0 @category pattern-matching */ matchPruneDecision,
  /** @since 0.1.0 */ neverPruningPolicy,
  /** @since 0.1.0 */ ObjectiveTrialRuntime,
  /** @since 0.1.0 */ preferredStopRequest,
  /** @since 0.1.0 */ type PrunedDecision,
  /** @since 0.1.0 */ type PruneDecision,
  /** @since 0.1.0 */ PruneDecisionSchema,
  /** @since 0.1.0 @category constructors */ PruneTrialDecision,
  /** @since 0.1.0 */ PruningPolicy,
  /** @since 0.1.0 */ PruningPolicyContext,
  /** @since 0.1.0 @category constructors */ StopHeartbeat,
  /** @since 0.1.0 */ type StopMode,
  /** @since 0.1.0 */ stopModeOrDefault,
  /** @since 0.1.0 */ StopModeSchema,
  /** @since 0.1.0 */ StopRequest,
  /** @since 0.1.0 */ thresholdPruningPolicy
} from "./runtime/pruning.js"

export {
  /** @since 0.1.0 */ type PercentilePrunerContext,
  /** @since 0.1.0 */ PercentilePrunerContextSchema,
  /** @since 0.1.0 */ type PercentilePrunerHistoryTrial,
  /** @since 0.1.0 */ PercentilePrunerHistoryTrialSchema,
  /** @since 0.1.0 */ type PercentilePrunerReport,
  /** @since 0.1.0 */ PercentilePrunerReportSchema,
  /** @since 0.1.0 */ type PercentilePrunerSettings,
  /** @since 0.1.0 */ PercentilePrunerSettingsSchema,
  /** @since 0.1.0 */ type PercentilePrunerTrialState,
  /** @since 0.1.0 */ PercentilePrunerTrialStateSchema,
  /** @since 0.1.0 */ shouldPruneByPercentile
} from "./runtime/percentilePruning.js"

export {
  /** @since 0.1.0 */ decodeStudySnapshot,
  /** @since 0.1.0 */ nextTrialNumberFromTrials,
  /** @since 0.1.0 */ type SnapshotFormatVersion,
  /** @since 0.1.0 */ SnapshotFormatVersionSchema,
  /** @since 0.1.0 */ StudySnapshot,
  /** @since 0.1.0 */ StudySnapshotFormatVariantSchema
} from "./snapshot/versioning.js"

export {
  /** @since 0.1.0 */ type SnapshotMetadata,
  /** @since 0.1.0 */ SnapshotMetadataSchema
} from "./snapshot/metadata.js"

export {
  /** @since 0.1.0 */ type SnapshotTrial,
  /** @since 0.1.0 */ SnapshotTrialSchema,
  /** @since 0.1.0 */ type TrialStateSnapshot
} from "./snapshot/stateCodec.js"

export {
  /** @since 0.1.0 */ makeStudyObjectiveCache,
  /** @since 0.1.0 */ StudyObjectiveCache,
  /** @since 0.1.0 */ type StudyObjectiveCacheApi,
  /** @since 0.1.0 */ StudyObjectiveCacheFileSystem,
  /** @since 0.1.0 */ StudyObjectiveCacheLive,
  /** @since 0.1.0 */ StudyObjectiveCacheMemory,
  /** @since 0.1.0 */ StudyObjectiveCacheOptions,
  /** @since 0.1.0 */ studyObjectiveCacheOptions,
  /** @since 0.1.0 */ StudyObjectiveCacheSql
} from "./studyObjectiveCache.js"

export {
  /** @since 0.1.0 */ makeStudyStorage,
  /** @since 0.1.0 */ StudyStorage,
  /** @since 0.1.0 */ type StudyStorageApi,
  /** @since 0.1.0 */ StudyStorageLive,
  /** @since 0.1.0 */ StudyStorageOptions,
  /** @since 0.1.0 */ studyStorageOptions
} from "./studyStorage.js"

export {
  /**
   * Create an event publisher that wraps study events in artifact envelopes and writes them to a sink.
   *
   * @since 0.1.0
   */
  envelopeEventPublisher
} from "./events.js"
