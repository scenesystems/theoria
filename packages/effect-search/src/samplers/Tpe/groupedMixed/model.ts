/**
 * Grouped mixed settings model — multivariate and group-dimensions feature flags.
 *
 * @since 0.1.0
 */
import { Data } from "effect"

/**
 * Feature flags controlling whether TPE uses correlated multivariate
 * continuous kernels and conditional-group decomposition. When both
 * flags are `false` the sampler treats every dimension independently;
 * enabling them activates increasingly sophisticated sampling strategies
 * that exploit inter-parameter structure.
 *
 * @see {@link suggestGroupedMixedJoint} for the grouped sampling pipeline
 * @see {@link orderedGroups} for conditional-group construction
 * @since 0.1.0
 * @category models
 */
export class GroupedMixedSettings extends Data.Class<{
  readonly multivariate: boolean
  readonly groupDimensions: boolean
}> {}
