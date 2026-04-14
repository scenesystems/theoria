/**
 * Sampler strategies for suggesting configurations during optimization.
 *
 * @since 0.1.0
 */
/**
 * Dual-API combinators for suggest, checkpoint, restore, and lifecycle
 * management of sampler instances.
 *
 * @see {@link Sampler} for the core data class these combinators operate on
 * @since 0.1.0
 * @category re-exports
 */
export * from "./combinators.js"
/**
 * Constructor functions for creating Random, Grid, and TPE sampler instances
 * with default imputation policies.
 *
 * @see {@link Sampler} for the output data class
 * @since 0.1.0
 * @category re-exports
 */
export * from "./constructors.js"
/**
 * Deterministic seed stepping, LCG helpers, and seeded shuffle/sampling
 * primitives used across samplers.
 *
 * @see {@link weightedIndex} for weighted selection using these primitives
 * @since 0.1.0
 * @category re-exports
 */
export * from "./deterministic.js"
/**
 * Checkpoint schemas and type aliases used to persist sampler state across
 * study snapshots.
 *
 * @see {@link Sampler} for the runtime data class that wraps these variants
 * @since 0.1.0
 * @category re-exports
 */
export * from "./checkpoints.js"
/**
 * Option schemas and type aliases for each sampler algorithm family.
 *
 * @see {@link SamplerKindSchema} for the tagged union built from these options
 * @since 0.1.0
 * @category re-exports
 */
export * from "./options.js"
/**
 * Schemas and tagged constructors for the sampler algorithm variants.
 *
 * @see {@link Sampler} for the runtime data class that wraps these variants
 * @since 0.1.0
 * @category re-exports
 */
export {
  /** @since 0.2.1 @category constructors */
  CmaEs,
  /** @since 0.2.1 @category constructors */
  GpBo,
  /** @since 0.2.1 @category constructors */
  Grid,
  /** @since 0.2.1 @category guards */
  isSamplerKind,
  /** @since 0.2.1 @category pattern-matching */
  matchSamplerKind,
  /** @since 0.2.1 @category constructors */
  Random,
  /** @since 0.1.0 @category type-level */
  type SamplerKind,
  /** @since 0.1.0 @category schemas */
  SamplerKindSchema,
  /** @since 0.2.1 @category constructors */
  Tpe
} from "./kinds.js"
/**
 * Core Sampler data class defining the optimization algorithm contract for
 * suggesting, checkpointing, and restoring state.
 *
 * @see {@link tpe} for the primary constructor
 * @since 0.1.0
 * @category re-exports
 */
export * from "./model.js"
/**
 * Pending-trial imputation policies that synthesize observations for
 * in-flight trials so samplers avoid suggesting redundant configurations.
 *
 * @see {@link Sampler} for how imputation integrates with the suggest pipeline
 * @since 0.1.0
 * @category re-exports
 */
export * from "./PendingImputationPolicy.js"
/**
 * Service provider interface tag and layer for wiring a concrete Sampler into
 * the Effect dependency graph.
 *
 * @see {@link Sampler} for the service implementation contract
 * @since 0.1.0
 * @category re-exports
 */
export * from "./spi.js"
/**
 * Deterministic stratified round-robin sampling across seeded buckets for
 * balanced subset selection.
 *
 * @see {@link weightedIndex} for non-stratified weighted selection
 * @since 0.1.0
 * @category re-exports
 */
export * from "./stratified.js"
/**
 * Trial history and reservation context models provided to samplers when
 * requesting the next configuration.
 *
 * @see {@link Sampler} for the suggest pipeline that consumes this context
 * @since 0.1.0
 * @category re-exports
 */
export * from "./SuggestContext.js"
/**
 * Weighted-index selection, multi-draw sampling, and correlated pair drawing
 * with deterministic seed stepping.
 *
 * @see {@link stepSeed} for the LCG primitive these operations build on
 * @since 0.1.0
 * @category re-exports
 */
export * from "./weighted.js"
