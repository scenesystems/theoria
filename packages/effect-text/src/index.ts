/**
 * effect-text root entrypoint.
 *
 * Provisional text preparation and pure layout substrate for Effect.
 *
 * @since 0.1.0
 * @module
 */

/**
 * Provisional text preparation, prepared handles, layout, and live layers.
 *
 * @since 0.1.0
 * @category modules
 */
export * as Text from "./Text/index.js"

/**
 * Stable runtime service contracts.
 *
 * @since 0.1.0
 * @category modules
 */
export * as Contracts from "./contracts/index.js"

/**
 * Stable typed errors.
 *
 * @since 0.1.0
 * @category modules
 */
export * as Errors from "./Errors/index.js"

/**
 * Unstable experimental seams.
 *
 * @since 0.1.0
 * @category modules
 */
export * as Experimental from "./experimental/index.js"
