/**
 * Selects pure, decoded, or runtime-policy integration for numerical calculus.
 *
 * @since 0.1.0
 * @category operations
 */

/**
 * Applies runtime precision and diagnostics policies to calculus results.
 *
 * @since 0.1.0
 * @category operations
 */
export * from "./operations/policies.js"

/**
 * Runs calculus operations directly on trusted functions and numeric inputs.
 *
 * @since 0.1.0
 * @category operations
 */
export * from "./operations/pure.js"

/**
 * Decodes unknown inputs and captures synchronous callback exceptions.
 *
 * @since 0.1.0
 * @category operations
 */
export * from "./operations/validated.js"
