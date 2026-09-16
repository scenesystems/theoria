/**
 * Effect-native configuration search, objective evaluation, and study execution.
 *
 * @since 0.7.0
 * @module
 */
/** Acquisition scoring policies. @since 0.7.0 @category modules */
export * as Acquisition from "./Acquisition.js"
/** Search artifact schemas and provenance. @since 0.7.0 @category modules */
export * as Artifact from "./Artifact.js"
/** Run-scoped artifact sequence allocation. @since 0.7.0 @category modules */
export * as ArtifactContext from "./ArtifactContext.js"
/** Artifact delivery and persistence. @since 0.7.0 @category modules */
export * as ArtifactSink from "./ArtifactSink.js"
/** Schema-encoded caching and canonical identities. @since 0.7.0 @category modules */
export * as Cache from "./Cache.js"
/** Objective comparison polarity. @since 0.7.0 @category modules */
export * as Direction from "./Direction.js"
/** Sampling distributions and schema annotations. @since 0.7.0 @category modules */
export * as Distribution from "./Distribution.js"
/** Objective values and comparison specifications. @since 0.7.0 @category modules */
export * as Objective from "./Objective.js"
/** Schema-keyed objective evaluation caching. @since 0.7.0 @category modules */
export * as ObjectiveCache from "./ObjectiveCache.js"
/** Pareto dominance, frontiers, and hypervolume. @since 0.7.0 @category modules */
export * as Pareto from "./Pareto.js"
/** Terminal study progress reporting. @since 0.7.0 @category modules */
export * as Progress from "./Progress.js"
/** Intermediate reporting and pruning policies. @since 0.7.0 @category modules */
export * as Pruning from "./Pruning.js"
/** Suggestion strategies and sampler checkpoints. @since 0.7.0 @category modules */
export * as Sampler from "./Sampler.js"
/** Resource allocation and promotion schedules. @since 0.7.0 @category modules */
export * as Scheduler from "./Scheduler.js"
/** Typed expected search failures. @since 0.7.0 @category modules */
export * as SearchError from "./SearchError.js"
/** Typed configuration spaces and conditional branches. @since 0.7.0 @category modules */
export * as SearchSpace from "./SearchSpace.js"
/** Optimization and scoped ask/tell execution. @since 0.7.0 @category modules */
export * as Study from "./Study.js"
/** Study lifecycle notifications. @since 0.7.0 @category modules */
export * as StudyEvent from "./StudyEvent.js"
/** Study checkpoint encoding and recovery. @since 0.7.0 @category modules */
export * as StudySnapshot from "./StudySnapshot.js"
/** Durable study logs and snapshots. @since 0.7.0 @category modules */
export * as StudyStorage from "./StudyStorage.js"
/** Search trial records and transitions. @since 0.7.0 @category modules */
export * as Trial from "./Trial.js"
