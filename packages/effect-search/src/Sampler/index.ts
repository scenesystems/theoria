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
  CmaEs,
  GpBo,
  Grid,
  isSamplerKind,
  matchSamplerKind,
  Random,
  type SamplerKind,
  SamplerKindSchema,
  Tpe
} from "./kinds.js"
export * from "./model.js"
export * from "./options.js"
export * from "./PendingImputationPolicy.js"
export * from "./spi.js"
export * from "./stratified.js"
export * from "./SuggestContext.js"
export * from "./weighted.js"
