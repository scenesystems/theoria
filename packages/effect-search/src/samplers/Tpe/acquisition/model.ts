/**
 * Acquisition function model — context, scoring protocol, and type guards for acquisition strategies.
 *
 * @since 0.1.0
 */
import type { Option } from "effect"
import { Data, Predicate } from "effect"

import type { BuiltInAcquisitionName } from "../../../contracts/Acquisition.js"

export {
  /**
   * Shared built-in acquisition strategy schema used by TPE and GP-BO.
   *
   * @since 0.1.0
   * @category schemas
   */
  BuiltInAcquisitionNameSchema,
  /**
   * Shared built-in acquisition strategy type guard used by TPE and GP-BO.
   *
   * @since 0.1.0
   * @category guards
   */
  isBuiltInAcquisitionName
} from "../../../contracts/Acquisition.js"
export {
  /**
   * Shared built-in acquisition strategy name union.
   *
   * @since 0.1.0
   * @category models
   */
  type BuiltInAcquisitionName
} from "../../../contracts/Acquisition.js"

/**
 * Immutable context record carrying the inputs needed by any acquisition
 * scoring function: log-densities under the "good" model ℓ(x) and "bad"
 * model g(x), an optional estimated cost for cost-aware acquisition, and
 * an optional random roll for stochastic strategies like Thompson sampling.
 *
 * @see {@link AcquisitionScore} which consumes this context
 * @see {@link AcquisitionImplementation} which pairs a name with a scorer
 * @since 0.1.0
 * @category models
 */
export class AcquisitionContext extends Data.Class<{
  readonly logL: number
  readonly logG: number
  readonly estimatedCost: Option.Option<number>
  readonly roll: Option.Option<number>
}> {}

/**
 * Function signature for acquisition scoring: maps an
 * {@link AcquisitionContext} to a numeric desirability score.
 * Higher scores indicate more promising candidate configurations.
 * Implement this to create custom acquisition strategies beyond
 * the built-in EI, PI, and Thompson sampling.
 *
 * @see {@link AcquisitionContext} for the scoring inputs
 * @see {@link AcquisitionImplementation} which bundles a scorer with a name
 * @since 0.1.0
 * @category models
 */
export type AcquisitionScore = (context: AcquisitionContext) => number

/**
 * Named acquisition strategy bundling a human-readable name with its
 * scoring function. Instances are registered in the acquisition registry
 * and resolved at sampling time. Use this to define custom acquisition
 * strategies beyond the built-in set.
 *
 * @see {@link AcquisitionScore} for the scoring function contract
 * @see {@link AcquisitionOption} for how implementations are selected
 * @since 0.1.0
 * @category models
 */
export class AcquisitionImplementation extends Data.Class<{
  readonly name: string
  readonly score: AcquisitionScore
}> {}

/**
 * Configuration input that accepts either a built-in acquisition name
 * string or a custom {@link AcquisitionImplementation} instance. This
 * union allows users to select built-in strategies by name or provide
 * their own scoring function.
 *
 * @see {@link BuiltInAcquisitionName} for the string literal options
 * @see {@link AcquisitionImplementation} for custom strategy instances
 * @since 0.1.0
 * @category models
 */
export type AcquisitionOption = BuiltInAcquisitionName | AcquisitionImplementation

/**
 * Type guard that structurally checks whether an unknown value conforms
 * to {@link AcquisitionImplementation} by verifying the presence of
 * `name` (string) and `score` (function) properties. Used during
 * acquisition resolution to identify custom strategy instances.
 *
 * @see {@link AcquisitionImplementation} for the matched structure
 * @see {@link isBuiltInAcquisitionName} for the literal name guard
 * @since 0.1.0
 * @category guards
 */
export const isAcquisitionImplementation = (
  input: unknown
): input is AcquisitionImplementation =>
  Predicate.isRecord(input) &&
  Predicate.hasProperty(input, "name") &&
  Predicate.isString(input.name) &&
  Predicate.hasProperty(input, "score") &&
  Predicate.isFunction(input.score)
