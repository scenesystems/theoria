/**
 * Exposes TPE partitioning and deterministic search-space fixtures for compatibility tests.
 *
 * @remarks
 * These declarations may change without a major-version release. Production
 * optimization uses the stable `Sampler`, `SearchSpace`, and `Study` entry points.
 *
 * @since 0.1.0
 */

import { splitByObjectiveSpec as _splitTpeTrialsByObjectiveSpec } from "../samplers/Tpe/split/index.js"

/**
 * Partitions completed observations into the groups fitted by TPE.
 *
 * @remarks
 * `below` contains the observations selected for the promising density and
 * `above` contains the remainder. Scalar objectives use direction-adjusted
 * values. Vector objectives use non-dominated rank and hypervolume weighting;
 * vectors with the wrong arity or a non-finite entry are omitted. Constraint
 * residuals at or below zero are feasible and take precedence during the split.
 * `epsilon` affects vector dominance only. The result is ordered by trial number
 * within each group.
 *
 * @param completed - Completed observations available to the sampler.
 * @param objectiveSpec - Objective arity and comparison direction for each coordinate.
 * @param epsilon - Additive vector-dominance tolerance; defaults to zero.
 * @returns TPE observations divided into `below` and `above` groups.
 *
 * @since 0.1.0
 * @category experimental
 */
export const splitTpeTrialsByObjectiveSpec = _splitTpeTrialsByObjectiveSpec

/**
 * Defines fixed search-space fixtures and matching configuration decoders for tests.
 *
 * @remarks
 * These declarations may change without a major-version release.
 *
 * @since 0.1.0
 * @category experimental
 */
export * as Scenarios from "./scenarios/index.js"
