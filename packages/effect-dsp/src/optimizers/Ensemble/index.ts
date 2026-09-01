/**
 * Ensemble module construction — select a deterministic subset of programs,
 * run it concurrently for each input, then reduce the outputs.
 *
 * @since 0.1.0
 */

/**
 * EnsembleOptions and EnsembleReduceFn.
 *
 * @since 0.1.0
 */
export type { EnsembleOptions, EnsembleReduceFn } from "./model.js"

/**
 * `majorityVote` — select the most common output across ensemble members.
 *
 * @since 0.1.0
 */
export { majorityVote } from "./vote.js"

/**
 * `ensemble` — construct an ensemble module that runs sub-modules and reduces
 * outputs via voting.
 *
 * @since 0.1.0
 */
export { ensemble } from "./runtime.js"
