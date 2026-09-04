/**
 * Runs, observes, snapshots, and resumes optimization studies.
 *
 * @remarks
 * A study owns trial numbering, objective execution, pruning, stop behavior, and
 * result aggregation. A `SearchSpace` defines valid configurations and a `Sampler`
 * proposes them. Use `optimize` for a completed result, `optimizeStream` for
 * lifecycle events, or `open` when an external worker evaluates asked trials.
 *
 * @since 0.1.0
 * @module
 */
export {
  ask,
  AskedTrial,
  askTellProcedureCatalog,
  cancel,
  events,
  fail,
  isStudyHandle,
  maximize,
  minimize,
  MultiObjectiveResult,
  open,
  optimize,
  optimizeStream,
  pareto,
  result,
  resume,
  resumeFromStorage,
  resumeFromStorageStream,
  resumeStream,
  SingleObjectiveResult,
  snapshot,
  StudyHandle,
  type StudyResult,
  tell
} from "./api.js"

export { type EmitterSink, streamFromEmitter } from "./streamBridge.js"

export {
  defaultTerminalSink,
  formatTerminalProgressEvent,
  makeTerminalReporter,
  makeTerminalSink,
  ProgressLine,
  reportTerminalProgress,
  tapTerminalProgress,
  type TerminalProgressReporter,
  type TerminalRenderMode,
  TerminalRenderModeSchema,
  TerminalSink,
  writeProgressLines
} from "./progress/index.js"

export {
  type DirectionalOptimizeOptions,
  DirectionalOptimizeRequestSchema,
  type MaximizeOptionsFromSpace,
  maximizePlanFromOptions,
  type MinimizeOptionsFromSpace,
  minimizePlanFromOptions
} from "./options/directional.js"

export {
  type FlatOptimizeOptions,
  type OptimizeOptions,
  optimizeOptionsFromResume,
  type OptimizeOptionsFromSpace,
  OptimizePlan,
  optimizePlanFromOptions,
  optimizePlanFromResume,
  OptimizeSettings,
  PriorTrial,
  pruningPolicyFromOptions,
  type ResumeFromStorageOptions,
  type ResumeFromStorageOptionsFromSpace,
  type ResumeOptions,
  type ResumeOptionsFromSpace,
  resumeOptionsWithSnapshot,
  ResumePlan,
  resumePlanFromOptions,
  type ScheduledOptimizeOptions,
  validateSettings
} from "./options.js"

export { type ExecuteOutcome, type ExecuteSeed, StudyClock } from "./runtime.js"

export {
  ExecuteRequest,
  ObjectiveEvaluator,
  ObjectiveEvaluatorLive,
  SamplerEngine,
  SamplerEngineLive,
  SnapshotCodec,
  SnapshotCodecLive,
  StudyKernel,
  StudyKernelLive,
  StudyServicesLive
} from "./services.js"

export { type ObjectiveFunction, ObjectiveFunctionSchema, ObjectiveReport } from "./objectiveEvaluator.js"

export {
  ContinueHeartbeat,
  ContinuePruneDecision,
  defaultStopMode,
  type HeartbeatDecision,
  HeartbeatDecisionSchema,
  IntermediateReport,
  isPruneDecision,
  matchHeartbeatDecision,
  matchPruneDecision,
  neverPruningPolicy,
  ObjectiveTrialRuntime,
  preferredStopRequest,
  type PrunedDecision,
  type PruneDecision,
  PruneDecisionSchema,
  PruneTrialDecision,
  PruningPolicy,
  PruningPolicyContext,
  StopHeartbeat,
  type StopMode,
  stopModeOrDefault,
  StopModeSchema,
  StopRequest,
  thresholdPruningPolicy
} from "./runtime/pruning.js"

export {
  type PercentilePrunerContext,
  PercentilePrunerContextSchema,
  type PercentilePrunerHistoryTrial,
  PercentilePrunerHistoryTrialSchema,
  type PercentilePrunerReport,
  PercentilePrunerReportSchema,
  type PercentilePrunerSettings,
  PercentilePrunerSettingsSchema,
  type PercentilePrunerTrialState,
  PercentilePrunerTrialStateSchema,
  shouldPruneByPercentile
} from "./runtime/percentilePruning.js"

export {
  decodeStudySnapshot,
  nextTrialNumberFromTrials,
  type SnapshotFormatVersion,
  SnapshotFormatVersionSchema,
  StudySnapshot,
  StudySnapshotFormatVariantSchema
} from "./snapshot/versioning.js"

export { type SnapshotMetadata, SnapshotMetadataSchema } from "./snapshot/metadata.js"

export { type SnapshotTrial, SnapshotTrialSchema, type TrialStateSnapshot } from "./snapshot/stateCodec.js"

export {
  makeStudyObjectiveCache,
  StudyObjectiveCache,
  type StudyObjectiveCacheApi,
  StudyObjectiveCacheFileSystem,
  StudyObjectiveCacheLive,
  StudyObjectiveCacheMemory,
  StudyObjectiveCacheOptions,
  studyObjectiveCacheOptions,
  StudyObjectiveCacheSql
} from "./studyObjectiveCache.js"

export {
  makeStudyStorage,
  StudyStorage,
  type StudyStorageApi,
  StudyStorageLive,
  StudyStorageOptions,
  studyStorageOptions
} from "./studyStorage.js"

export { envelopeEventPublisher } from "./events.js"
