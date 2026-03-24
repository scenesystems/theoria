/**
 * Acquisition function registry — resolves built-in and custom acquisition strategies for TPE.
 *
 * @since 0.1.0
 */
import { Match, Option } from "effect"

import { sumLogDensities } from "../../../internal/tpe/expectedImprovement.js"
import { eiAcquisition } from "./ei.js"
import {
  type AcquisitionContext,
  type AcquisitionImplementation,
  type AcquisitionOption,
  type BuiltInAcquisitionName,
  isAcquisitionImplementation,
  isBuiltInAcquisitionName
} from "./model.js"
import { piAcquisition } from "./pi.js"
import { thompsonAcquisition } from "./thompson.js"

export {
  /**
   * Log-density and cost context passed to acquisition scoring functions.
   *
   * @since 0.1.0
   * @category models
   */
  type AcquisitionContext,
  /**
   * Callable acquisition strategy with a name and scoring function.
   *
   * @since 0.1.0
   * @category models
   */
  type AcquisitionImplementation,
  /**
   * Union of built-in acquisition names and custom implementations.
   *
   * @since 0.1.0
   * @category models
   */
  type AcquisitionOption,
  /**
   * Literal union of built-in acquisition strategy names.
   *
   * @since 0.1.0
   * @category models
   */
  type BuiltInAcquisitionName,
  /**
   * Schema for validating built-in acquisition strategy name literals.
   *
   * @since 0.1.0
   * @category schemas
   */
  BuiltInAcquisitionNameSchema
} from "./model.js"

/**
 * The default acquisition strategy name used when none is explicitly
 * specified. Falls back to Expected Improvement, which provides the
 * best general-purpose exploration–exploitation tradeoff.
 *
 * @see {@link builtinAcquisitionRegistry} for the full strategy lookup
 * @see {@link resolveAcquisition} which uses this as fallback
 * @since 0.1.0
 * @category configuration
 */
export const defaultAcquisitionName: BuiltInAcquisitionName = "ei"

/**
 * Lookup table mapping each built-in acquisition name to its scoring
 * implementation. Contains entries for `"ei"`, `"pi"`, and `"thompson"`.
 *
 * @see {@link BuiltInAcquisitionName} for the key type
 * @see {@link resolveAcquisition} which queries this registry
 * @since 0.1.0
 * @category configuration
 */
export const builtinAcquisitionRegistry: Record<
  BuiltInAcquisitionName,
  AcquisitionImplementation
> = {
  ei: eiAcquisition,
  pi: piAcquisition,
  thompson: thompsonAcquisition
}

const defaultAcquisition = builtinAcquisitionRegistry[defaultAcquisitionName]

const builtinAcquisition = (
  name: BuiltInAcquisitionName
): AcquisitionImplementation => builtinAcquisitionRegistry[name]

/**
 * Resolves an optional {@link AcquisitionOption} to a concrete
 * {@link AcquisitionImplementation}, falling back to EI when no
 * option is provided. Handles both built-in name strings and
 * custom implementation instances.
 *
 * @see {@link builtinAcquisitionRegistry} for built-in strategy lookup
 * @see {@link scoreAcquisition} which calls this to score candidates
 * @since 0.1.0
 * @category constructors
 */
export const resolveAcquisition = (
  acquisition?: AcquisitionOption
): AcquisitionImplementation =>
  Option.fromNullable(acquisition).pipe(
    Option.match({
      onNone: () => defaultAcquisition,
      onSome: (candidate) =>
        Match.value(candidate).pipe(
          Match.when(isBuiltInAcquisitionName, builtinAcquisition),
          Match.when(isAcquisitionImplementation, (customAcquisition) => customAcquisition),
          Match.orElse(() => defaultAcquisition)
        )
    })
  )

/**
 * Scores a single candidate using the resolved acquisition function
 * and its log-density context. Resolves the acquisition strategy
 * on each call, making it safe to use with varying options.
 *
 * @see {@link AcquisitionContext} for the scoring inputs
 * @see {@link scoreJointAcquisition} for multi-dimensional scoring
 * @since 0.1.0
 * @category scoring
 */
export const scoreAcquisition = (
  context: AcquisitionContext,
  acquisition?: AcquisitionOption
): number => resolveAcquisition(acquisition).score(context)

/**
 * Scores a joint (multi-dimensional) candidate by summing per-dimension
 * log-density contributions into aggregate ℓ(x) and g(x) values before
 * passing them to the acquisition function. This enables independent
 * per-dimension density estimation while scoring the full configuration.
 *
 * @see {@link scoreAcquisition} for single-dimension scoring
 * @see {@link AcquisitionContext} for the aggregated scoring inputs
 * @since 0.1.0
 * @category scoring
 */
export const scoreJointAcquisition = (
  logLContributions: ReadonlyArray<number>,
  logGContributions: ReadonlyArray<number>,
  estimatedCost: Option.Option<number>,
  roll: Option.Option<number>,
  acquisition?: AcquisitionOption
): number =>
  scoreAcquisition({
    logL: sumLogDensities(logLContributions),
    logG: sumLogDensities(logGContributions),
    estimatedCost,
    roll
  }, acquisition)
