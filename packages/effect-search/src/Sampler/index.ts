/**
 * Sampling strategies, suggestion context, and deterministic selection utilities.
 *
 * @remarks
 * A sampler receives an immutable view of completed and pending trials for each
 * suggestion. Built-in samplers derive their random state from the configured
 * seed and `nextTrialNumber`; their checkpoints record configuration needed to
 * reject incompatible study resumes.
 *
 * Construct a strategy with {@link random}, {@link grid}, {@link tpe},
 * {@link cmaEs}, or {@link gpBo}, then pass it to the Study APIs.
 *
 * @since 0.1.0
 */
export * from "./checkpoints.js"
export * from "./combinators.js"
export * from "./constructors.js"
export * from "./deterministic.js"
export {
  /** Identifies a CMA-ES sampler and retains its serializable options. @since 0.2.1 @category constructors */
  CmaEs,
  /** Identifies a GP-BO sampler and retains its serializable options. @since 0.2.1 @category constructors */
  GpBo,
  /** Identifies a grid sampler and retains its traversal options. @since 0.2.1 @category constructors */
  Grid,
  /** Narrows a sampler kind to the specified algorithm tag. @since 0.2.1 @category guards */
  isSamplerKind,
  /** Applies the handler associated with a sampler kind's algorithm tag. @since 0.2.1 @category pattern-matching */
  matchSamplerKind,
  /** Identifies a random sampler and retains its seed option. @since 0.2.1 @category constructors */
  Random,
  /** Serializable algorithm identity stored with a sampler. @since 0.1.0 @category type-level */
  type SamplerKind,
  /** Decodes the algorithm identity and serializable options for a sampler. @since 0.1.0 @category schemas */
  SamplerKindSchema,
  /** Identifies a TPE sampler and retains its serializable options. @since 0.2.1 @category constructors */
  Tpe
} from "./kinds.js"
export * from "./model.js"
export * from "./options.js"
export * from "./PendingImputationPolicy.js"
export * from "./spi.js"
export * from "./stratified.js"
export * from "./SuggestContext.js"
export * from "./weighted.js"
