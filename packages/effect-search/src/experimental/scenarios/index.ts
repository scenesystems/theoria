/**
 * Re-exports all experimental scenario definitions.
 *
 * @since 0.1.0
 */
/**
 * Conditional search space scenario that branches between linear and tree
 * model hyperparameters based on a categorical model-type selector.
 *
 * @see {@link SearchSpace} for the conditional activation machinery
 * @since 0.1.0
 * @category re-exports
 */
export * from "./conditionalLinearTree.js"
/**
 * Mixed optimizer scenario with a categorical optimizer selection alongside
 * numeric hyperparameters like learning rate and momentum.
 *
 * @see {@link SearchSpace} for mixed-type dimension handling
 * @since 0.1.0
 * @category re-exports
 */
export * from "./mixedOptimizer.js"
/**
 * Prompt engineering scenario with categorical instruction, demonstration
 * selection, and scoring strategy dimensions.
 *
 * @see {@link SearchSpace} for categorical-only search spaces
 * @since 0.1.0
 * @category re-exports
 */
export * from "./promptCategorical.js"
/**
 * Training hyperparameter scenario with learning rate, optimizer, batch
 * size, and batch-norm dimensions for testing random and TPE samplers.
 *
 * @see {@link SearchSpace} for the parameter definition API
 * @since 0.1.0
 * @category re-exports
 */
export * from "./randomTraining.js"
/**
 * Minimal single-integer slot scenario for unit-testing search space
 * mechanics in isolation.
 *
 * @see {@link SearchSpace} for the underlying dimension model
 * @since 0.1.0
 * @category re-exports
 */
export * from "./slot.js"
