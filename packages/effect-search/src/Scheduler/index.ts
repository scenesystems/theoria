/**
 * Bracket topologies for successive-halving studies.
 *
 * @remarks
 * A scheduler assigns resource budgets to repeated evaluations of promoted
 * configurations. Hyperband accepts any sampler; BOHB combines the same bracket
 * topology with seeded random exploration and TPE suggestions. Study execution
 * emits bracket and round events and attaches a {@link SchedulerSummary} to the
 * result.
 *
 * @since 0.1.0
 * @module
 */
export * from "./constructors.js"
export * from "./model.js"
